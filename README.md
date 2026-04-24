# Gameplay Journey Tool

Map-first telemetry explorer for **LILA BLACK** built for the LiLa APM assignment. This repo turns raw parquet journey files into a browser-based review surface for level designers, product reviewers, and telemetry-driven map analysis.

<img width="1092" height="398" alt="Vercel_Page" src="https://github.com/user-attachments/assets/08816b64-1163-4f46-b8d5-1513239cfad7" />


## Repository Description

Suggested GitHub description:

`Map-first gameplay telemetry explorer for LILA BLACK with match playback, heatmaps, and level-design insights.`

## What The Tool Does

The app transforms raw telemetry into a level-design workflow with:

- minimap-accurate player and bot trails
- kill, death, loot, and storm markers
- map/date/match filters
- short-form match playback with scrubber, speed control, and event stepping
- aggregate heatmaps for traffic, kills, deaths, and loot

## Stack

- **Frontend:** React 18, TypeScript, Vite
- **Data pipeline:** Python 3.11, PyArrow, Pandas, Pillow
- **Hosting target:** Vercel static deployment

## What Is In The Repo

- `src/` React app
- `scripts/build_dataset.py` parquet-to-static-data pipeline
- `public/data/` generated manifest, match files, and aggregate heatmaps
- `public/maps/` resized 1024x1024 minimaps used by the app
- `ARCHITECTURE.md` design and tradeoff notes
- `INSIGHTS.md` 3 level-design takeaways from the telemetry

The generated app data is already included, so reviewers can run the UI immediately without the raw parquet source folder.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Build production assets:

```bash
npm run build
```

## Rebuild The Dataset

If you want to regenerate the static data from the raw assignment files:

```bash
python scripts/build_dataset.py --source "C:\\path\\to\\player_data" --out public/data
```

For this assignment environment, the source folder used was:

```text
C:\Users\LUVEY\Desktop\LILA assignement\player_data
```

What the script does:

- reads every parquet file across February 10-14, 2026
- decodes the binary `event` column into strings
- derives `date` from the folder name
- detects bots via numeric `user_id`
- projects world `x/z` coordinates into minimap pixel space
- writes:
  - `public/data/manifest.json`
  - `public/data/matches/<match_id>.json`
  - `public/data/aggregates/<map>/<scope>.json`
  - optimized minimap assets in `public/maps/`

## Data Notes

- `ts` is treated as **match-relative telemetry time**, not calendar date.
- Date filtering comes from the source folder (`February_10` ... `February_14`).
- Projection follows the README formula from the assignment and all projected points land inside the minimap bounds.
- The playback UI intentionally uses **relative time (`T+...`)** because match windows in this dataset are very short.

## Deployment

`vercel.json` is included for a static Vite deployment.

Recommended Vercel settings:

- Build command: `npm run build`
- Output directory: `dist`

No environment variables are required.

## Current Dataset Snapshot

- 1,243 files
- 89,104 event rows
- 796 unique matches
- 339 unique agents
- 3 maps: Ambrose Valley, Grand Rift, Lockdown

## Assignment Deliverables

- Working web app in this repo
- `ARCHITECTURE.md`
- `INSIGHTS.md`
- deployment-ready Vercel config

## Known Limitation

The repo is deployment-ready, but publishing a live Vercel URL still requires the owner's Vercel account/project connection.
