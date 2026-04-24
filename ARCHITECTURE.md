# Architecture

This document is a backend and product-goal handoff for the LILA APM assignment.
It intentionally does **not** describe frontend layout, component structure, or visual design. The expectation is that another UI system such as Google Stitch can consume this document and build the presentation layer on top of the data contracts defined here.

## Goal

Build a reliable telemetry foundation that converts raw player-journey parquet files into a clean, static, query-ready dataset for product and level-design review.

The backend must make it easy to answer questions like:

- Which maps are most active?
- Where do players and bots travel?
- Where do kills, deaths, storm eliminations, and looting cluster?
- What happened inside a specific match, in chronological order?
- How does one date scope differ from another?

The backend is designed to support a map-first reviewer experience, but the backend itself remains presentation-agnostic.

## System Role

The system has one job:

1. Ingest raw gameplay telemetry files.
2. Normalize and enrich the records.
3. Precompute match-level and aggregate outputs.
4. Publish static JSON artifacts that any frontend can consume directly.

This is a **build-time data product**, not a runtime API service.

## Backend Strategy

The project uses a preprocessing pipeline rather than a live backend server.

Why this approach:

- The source dataset is finite and small enough to process ahead of time.
- The assignment favors clarity, portability, and reviewer convenience.
- Static outputs are easier to host, cheaper to serve, and lower-risk than standing up a database and API for a one-off review tool.
- Precomputation keeps the eventual UI fast because heavy work is done before deployment.

In practice, the backend is the Python build pipeline in:

`scripts/build_dataset.py`

## Source Dataset

The source folder contains 5 days of production gameplay telemetry for **LILA BLACK** across:

- February 10, 2026 to February 14, 2026
- 1,243 parquet files
- about 89k event rows
- 796 unique matches
- 339 unique agents
- 3 maps: `AmbroseValley`, `GrandRift`, `Lockdown`

Each parquet file represents:

- one player or bot
- in one match
- over one journey timeline

Filename convention:

`{user_id}_{match_id}.nakama-0`

Key source semantics:

- numeric `user_id` means bot
- UUID-like `user_id` means human
- `ts` is match-relative event time, not calendar date
- date scope comes from the parent folder, not the timestamp value
- the `event` column is stored as bytes and must be decoded

## Processing Pipeline

The pipeline runs once at build time:

```bash
python scripts/build_dataset.py --source <player_data_path> --out public/data
```

The pipeline performs the following stages.

### 1. Discovery

- Find every `February_*` folder in the source dataset.
- Walk every file in each day folder.
- Treat each file as a parquet table even though it has no `.parquet` extension.

### 2. Read And Normalize

For each source file:

- read parquet into a dataframe
- decode `event` from bytes to UTF-8 text
- convert `ts` into integer milliseconds for ordering
- extract stable identifiers:
  - `user_id`
  - `match_id`
  - `map_id`
  - `date_id`
- classify `isBot` from the `user_id` pattern

### 3. Enrich

For every row, compute:

- world coordinates:
  - `x`
  - `y`
  - `z`
- map-projected 2D coordinates:
  - `pixelX`
  - `pixelY`
- event metadata
- player type
- scope tags such as date and map

### 4. Reconstruct Matches

Rows are grouped by `match_id` so the backend can reconstruct the full match from many player files.

For each match the pipeline derives:

- all participants
- participant type split: humans vs bots
- ordered full track timeline
- ordered discrete event timeline
- event counts
- duration
- row count
- showcase score for selecting a default match

### 5. Precompute Aggregates

To avoid runtime spatial computation, the pipeline pre-bins map events into heatmap grids.

Metrics:

- `traffic` = `Position` + `BotPosition`
- `kills` = `Kill` + `BotKill`
- `deaths` = `Killed` + `BotKilled` + `KilledByStorm`
- `loot` = `Loot`

Aggregates are produced for:

- each map
- each date scope
- an all-days scope

### 6. Publish Static Artifacts

The pipeline writes JSON contracts for:

- dataset manifest
- match detail payloads
- aggregate heatmaps

It also resizes the map images into application-ready assets so overlay coordinates line up with a canonical square space.

## Coordinate Projection

This is the most important backend transformation.

The source README defines a world-to-minimap projection using map-specific `scale`, `origin_x`, and `origin_z` values. The backend applies those rules and projects telemetry from `(x, z)` world space into a normalized 2D minimap space.

Formula:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

Implementation rules:

- `1024 x 1024` is treated as the canonical render space
- minimap assets are resized to that same square size
- projected points are clamped into bounds
- projection correctness is validated during dataset generation

Map configs used by the backend:

- `AmbroseValley`: scale `900`, origin `(-370, -473)`
- `GrandRift`: scale `581`, origin `(-290, -290)`
- `Lockdown`: scale `1000`, origin `(-500, -500)`

## Output Contracts

The backend publishes three primary contract types.

### 1. Manifest

Path:

`public/data/manifest.json`

Purpose:

- top-level dataset index
- boot payload for any frontend
- source of truth for maps, dates, stats, metrics, event types, and match summaries

Contains:

- dataset metadata
- generation timestamp
- maps and projection metadata
- dates and counts
- global stats
- supported metrics
- supported event types
- match summaries
- default showcase match id

### 2. Match Payload

Path pattern:

`public/data/matches/<match_id>.json`

Purpose:

- reconstruct one match in full
- support timeline playback, event inspection, and participant analysis

Contains:

- match identifiers
- map id
- date scope
- duration
- participants
- event counts
- `trackPoints`
- `eventPoints`

Important distinction:

- `trackPoints` contains the full ordered telemetry timeline
- `eventPoints` contains only non-movement events for discrete event inspection

### 3. Aggregate Payload

Path pattern:

`public/data/aggregates/<map_id>/<scope_id>.json`

Purpose:

- support heatmap and hotspot views without runtime aggregation

Contains:

- map id
- scope id
- grid size
- one matrix per metric
- max value and sample count per metric

## Domain Rules And Assumptions

The backend makes the following explicit decisions.

### Date

- `date` is derived from the folder name
- `ts` is not used as wall-clock time

### Player Type

- bot if `user_id.isdigit() == True`
- human otherwise

### Event Taxonomy

- movement: `Position`, `BotPosition`
- combat: `Kill`, `Killed`, `BotKill`, `BotKilled`
- environment: `KilledByStorm`
- item: `Loot`

### Match Ordering

- match rows are sorted by normalized millisecond timestamp
- relative playback time is computed by subtracting the minimum match timestamp

## Operational Model

There is no persistent runtime backend.

The operational flow is:

1. Raw assignment files are placed in `player_data/`
2. The dataset builder runs locally
3. Static outputs are generated into `public/data/` and `public/maps/`
4. A static host serves the files
5. The frontend reads the JSON directly

This keeps deployment simple and deterministic.

## Why No Live API

A live API was intentionally avoided.

Reasons:

- unnecessary operational complexity for a finite assignment dataset
- no need for authentication, writes, or transactional state
- no advantage from a database when the entire workload can be materialized ahead of time
- easier review and reproducibility for the evaluator

If this evolved into a production analytics product, the next step would likely be:

- object storage for raw and derived artifacts
- scheduled ETL
- a query service or tile service for larger datasets
- versioned manifests
- incremental rebuilds instead of full regeneration

## Handoff Boundary For Frontend Generation

The frontend generator should assume:

- the backend contract is already stable
- the UI should read from `manifest.json` first
- selected match and aggregate scopes are lazy-loaded by path
- map rendering should use the provided image asset and projected pixel coordinates directly
- no frontend-side coordinate math is required beyond drawing what the backend already computed

## Non-Goals For This Document

This document does not define:

- page layout
- component hierarchy
- animation design
- styling system
- panel behavior
- interaction microcopy

Those are intentionally left to the frontend implementation phase.
