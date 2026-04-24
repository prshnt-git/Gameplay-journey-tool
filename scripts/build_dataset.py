from __future__ import annotations

import argparse
import json
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import mean, median

import pandas as pd
import pyarrow.parquet as pq
from PIL import Image

APP_MAP_SIZE = 1024
HEATMAP_GRID_SIZE = 40

EVENT_META = {
    "Position": {
        "label": "Human Position",
        "category": "movement",
        "description": "A human player's movement sample.",
    },
    "BotPosition": {
        "label": "Bot Position",
        "category": "movement",
        "description": "A bot movement sample.",
    },
    "Kill": {
        "label": "Kill",
        "category": "combat",
        "description": "A human player killed another human player.",
    },
    "Killed": {
        "label": "Killed",
        "category": "combat",
        "description": "A human player was killed by another human player.",
    },
    "BotKill": {
        "label": "Bot Kill",
        "category": "combat",
        "description": "A human player killed a bot.",
    },
    "BotKilled": {
        "label": "Bot Killed",
        "category": "combat",
        "description": "A human player was killed by a bot.",
    },
    "KilledByStorm": {
        "label": "Storm Death",
        "category": "environment",
        "description": "A player died to the storm.",
    },
    "Loot": {
        "label": "Loot",
        "category": "item",
        "description": "A player picked up an item.",
    },
}

HEATMAP_METRICS = {
    "traffic": {
        "label": "Traffic",
        "description": "Movement density from human and bot travel samples.",
        "events": {"Position", "BotPosition"},
        "color": "#68f7ff",
    },
    "kills": {
        "label": "Kill Zones",
        "description": "Locations where kills happened.",
        "events": {"Kill", "BotKill"},
        "color": "#ff6b6b",
    },
    "deaths": {
        "label": "Death Zones",
        "description": "Locations where deaths happened.",
        "events": {"Killed", "BotKilled", "KilledByStorm"},
        "color": "#ffb55c",
    },
    "loot": {
        "label": "Loot Routes",
        "description": "Locations where players looted.",
        "events": {"Loot"},
        "color": "#9bff8a",
    },
}


@dataclass(frozen=True)
class MapConfig:
    id: str
    source_filename: str
    source_format: str
    scale: float
    origin_x: float
    origin_z: float


MAP_CONFIGS: dict[str, MapConfig] = {
    "AmbroseValley": MapConfig(
        id="AmbroseValley",
        source_filename="AmbroseValley_Minimap.png",
        source_format="PNG",
        scale=900,
        origin_x=-370,
        origin_z=-473,
    ),
    "GrandRift": MapConfig(
        id="GrandRift",
        source_filename="GrandRift_Minimap.png",
        source_format="PNG",
        scale=581,
        origin_x=-290,
        origin_z=-290,
    ),
    "Lockdown": MapConfig(
        id="Lockdown",
        source_filename="Lockdown_Minimap.jpg",
        source_format="JPEG",
        scale=1000,
        origin_x=-500,
        origin_z=-500,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build static app data from LILA parquet files.")
    parser.add_argument("--source", required=True, help="Path to the player_data folder from the assignment.")
    parser.add_argument(
        "--out",
        default="public/data",
        help="Output directory for generated app data. Defaults to public/data.",
    )
    return parser.parse_args()


def decode_event(value: object) -> str:
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8")
    return str(value)


def date_label(date_id: str) -> str:
    month, day = date_id.split("_", 1)
    return f"{month} {day}, 2026"


def humanize_number(value: int) -> str:
    return f"{value:,}"


def project_point(x_value: float, z_value: float, config: MapConfig) -> tuple[float, float]:
    u = (x_value - config.origin_x) / config.scale
    v = (z_value - config.origin_z) / config.scale
    pixel_x = u * APP_MAP_SIZE
    pixel_y = (1 - v) * APP_MAP_SIZE
    pixel_x = min(max(pixel_x, 0), APP_MAP_SIZE)
    pixel_y = min(max(pixel_y, 0), APP_MAP_SIZE)
    return round(pixel_x, 2), round(pixel_y, 2)


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def resize_maps(source_root: Path, maps_root: Path) -> list[dict[str, object]]:
    source_maps_dir = source_root / "minimaps"
    maps_root.mkdir(parents=True, exist_ok=True)
    map_entries: list[dict[str, object]] = []

    for map_id, config in MAP_CONFIGS.items():
        source_path = source_maps_dir / config.source_filename
        if not source_path.exists():
            raise FileNotFoundError(f"Missing minimap for {map_id}: {source_path}")

        output_name = f"{map_id}.{'jpg' if config.source_format == 'JPEG' else 'png'}"
        output_path = maps_root / output_name

        with Image.open(source_path) as image:
            resized = image.resize((APP_MAP_SIZE, APP_MAP_SIZE), Image.Resampling.LANCZOS)
            save_kwargs: dict[str, object] = {"optimize": True}
            if config.source_format == "JPEG":
                if resized.mode != "RGB":
                    resized = resized.convert("RGB")
                save_kwargs["quality"] = 92
            resized.save(output_path, config.source_format, **save_kwargs)

        map_entries.append(
            {
                "id": map_id,
                "label": map_id.replace("Valley", " Valley").replace("Rift", " Rift"),
                "image": f"/maps/{output_name}",
                "width": APP_MAP_SIZE,
                "height": APP_MAP_SIZE,
                "projection": {
                    "originX": config.origin_x,
                    "originZ": config.origin_z,
                    "scale": config.scale,
                },
            }
        )

    return map_entries


def build_heatmap_payload(
    map_id: str,
    scope_id: str,
    points: list[dict[str, object]],
    sample_counts: dict[str, int],
) -> dict[str, object]:
    metric_bins = {
        metric_id: [[0 for _ in range(HEATMAP_GRID_SIZE)] for _ in range(HEATMAP_GRID_SIZE)]
        for metric_id in HEATMAP_METRICS
    }
    max_values = {metric_id: 0 for metric_id in HEATMAP_METRICS}

    for point in points:
        px = float(point["pixelX"])
        py = float(point["pixelY"])
        grid_x = min(HEATMAP_GRID_SIZE - 1, max(0, int(px / APP_MAP_SIZE * HEATMAP_GRID_SIZE)))
        grid_y = min(HEATMAP_GRID_SIZE - 1, max(0, int(py / APP_MAP_SIZE * HEATMAP_GRID_SIZE)))
        event_name = str(point["event"])

        for metric_id, metric_meta in HEATMAP_METRICS.items():
            if event_name not in metric_meta["events"]:
                continue
            metric_bins[metric_id][grid_y][grid_x] += 1
            max_values[metric_id] = max(max_values[metric_id], metric_bins[metric_id][grid_y][grid_x])

    return {
        "mapId": map_id,
        "scopeId": scope_id,
        "gridSize": HEATMAP_GRID_SIZE,
        "metrics": {
            metric_id: {
                "label": metric_meta["label"],
                "color": metric_meta["color"],
                "maxValue": max_values[metric_id],
                "sampleCount": sample_counts.get(metric_id, 0),
                "bins": metric_bins[metric_id],
            }
            for metric_id, metric_meta in HEATMAP_METRICS.items()
        },
    }


def summarize_top_cells(payload: dict[str, object]) -> dict[str, list[dict[str, object]]]:
    summary: dict[str, list[dict[str, object]]] = {}
    for metric_id, metric_payload in payload["metrics"].items():  # type: ignore[index]
        top_cells: list[dict[str, object]] = []
        bins: list[list[int]] = metric_payload["bins"]  # type: ignore[index]
        cell_size = APP_MAP_SIZE / HEATMAP_GRID_SIZE

        for y_index, row in enumerate(bins):
            for x_index, value in enumerate(row):
                if value <= 0:
                    continue
                top_cells.append(
                    {
                        "value": value,
                        "pixelX": round((x_index + 0.5) * cell_size, 1),
                        "pixelY": round((y_index + 0.5) * cell_size, 1),
                    }
                )

        top_cells.sort(key=lambda item: item["value"], reverse=True)
        summary[metric_id] = top_cells[:5]
    return summary


def build_dataset(source_root: Path, out_root: Path) -> None:
    if not source_root.exists():
        raise FileNotFoundError(f"Source dataset not found: {source_root}")

    public_root = out_root.parent
    maps_root = public_root / "maps"
    matches_root = out_root / "matches"
    aggregates_root = out_root / "aggregates"

    ensure_clean_dir(out_root)
    ensure_clean_dir(matches_root)
    ensure_clean_dir(aggregates_root)
    ensure_clean_dir(maps_root)

    map_entries = resize_maps(source_root, maps_root)

    day_dirs = sorted(
        day_dir for day_dir in source_root.iterdir() if day_dir.is_dir() and day_dir.name.startswith("February_")
    )
    if not day_dirs:
        raise RuntimeError("No February_* folders found in the provided source directory.")

    manifest_matches: list[dict[str, object]] = []
    date_stats: dict[str, dict[str, object]] = {}
    event_counts: Counter[str] = Counter()
    map_file_counts: Counter[str] = Counter()
    unique_users: set[str] = set()
    unique_humans: set[str] = set()
    unique_bots: set[str] = set()
    bounds_ok = True

    aggregate_points: dict[str, dict[str, list[dict[str, object]]]] = defaultdict(lambda: defaultdict(list))
    aggregate_sample_counts: dict[str, dict[str, Counter[str]]] = defaultdict(lambda: defaultdict(Counter))

    match_buckets: dict[str, dict[str, object]] = {}
    file_count = 0
    total_rows = 0
    human_file_count = 0
    bot_file_count = 0

    for day_dir in day_dirs:
        date_id = day_dir.name
        date_summary = {
            "id": date_id,
            "label": date_label(date_id),
            "fileCount": 0,
            "rowCount": 0,
            "matchIds": set(),
        }

        for parquet_path in sorted(day_dir.iterdir()):
            if not parquet_path.is_file():
                continue

            file_count += 1
            table = pq.read_table(parquet_path)
            frame = table.to_pandas()
            frame["event"] = frame["event"].apply(decode_event)
            timestamps = pd.to_datetime(frame["ts"])
            frame["tsMs"] = timestamps.map(lambda value: int(value.value // 1_000_000))

            user_id = str(frame["user_id"].iloc[0])
            match_id = str(frame["match_id"].iloc[0])
            map_id = str(frame["map_id"].iloc[0])
            config = MAP_CONFIGS[map_id]
            is_bot = user_id.isdigit()
            map_file_counts[map_id] += 1

            row_count = len(frame.index)
            total_rows += row_count
            if is_bot:
                bot_file_count += 1
            else:
                human_file_count += 1

            date_summary["fileCount"] += 1
            date_summary["rowCount"] += row_count
            date_summary["matchIds"].add(match_id)

            unique_users.add(user_id)
            if is_bot:
                unique_bots.add(user_id)
            else:
                unique_humans.add(user_id)

            if match_id not in match_buckets:
                match_buckets[match_id] = {
                    "matchId": match_id,
                    "mapId": map_id,
                    "dates": set(),
                    "participants": {},
                    "points": [],
                    "eventPoints": [],
                    "eventCounts": Counter(),
                    "rowCount": 0,
                    "minTsMs": None,
                    "maxTsMs": None,
                }

            bucket = match_buckets[match_id]
            bucket["dates"].add(date_id)
            bucket["rowCount"] += row_count

            participant_summary = {
                "userId": user_id,
                "isBot": is_bot,
                "rowCount": row_count,
                "eventCounts": Counter(frame["event"].tolist()),
            }
            bucket["participants"][user_id] = participant_summary

            for _, row in frame.iterrows():
                pixel_x, pixel_y = project_point(float(row["x"]), float(row["z"]), config)
                in_bounds = 0 <= pixel_x <= APP_MAP_SIZE and 0 <= pixel_y <= APP_MAP_SIZE
                bounds_ok = bounds_ok and in_bounds

                point = {
                    "userId": user_id,
                    "isBot": is_bot,
                    "dateId": date_id,
                    "event": row["event"],
                    "timeMs": int(row["tsMs"]),
                    "worldX": round(float(row["x"]), 2),
                    "worldY": round(float(row["y"]), 2),
                    "worldZ": round(float(row["z"]), 2),
                    "pixelX": pixel_x,
                    "pixelY": pixel_y,
                }

                bucket["points"].append(point)
                bucket["eventCounts"][row["event"]] += 1
                event_counts[row["event"]] += 1

                for metric_id, metric_meta in HEATMAP_METRICS.items():
                    if row["event"] in metric_meta["events"]:
                        aggregate_sample_counts[map_id]["all"][metric_id] += 1
                        aggregate_sample_counts[map_id][date_id][metric_id] += 1

                aggregate_points[map_id]["all"].append(point)
                aggregate_points[map_id][date_id].append(point)

                if row["event"] not in {"Position", "BotPosition"}:
                    bucket["eventPoints"].append(
                        {
                            "id": f"{match_id}:{len(bucket['eventPoints'])}",
                            **point,
                        }
                    )

            bucket["minTsMs"] = (
                int(frame["tsMs"].min())
                if bucket["minTsMs"] is None
                else min(int(bucket["minTsMs"]), int(frame["tsMs"].min()))
            )
            bucket["maxTsMs"] = (
                int(frame["tsMs"].max())
                if bucket["maxTsMs"] is None
                else max(int(bucket["maxTsMs"]), int(frame["tsMs"].max()))
            )

        date_stats[date_id] = date_summary

    aggregate_catalog: dict[str, dict[str, str]] = defaultdict(dict)
    aggregate_highlights: dict[str, dict[str, dict[str, list[dict[str, object]]]]] = defaultdict(dict)

    for map_id, scopes in aggregate_points.items():
        for scope_id, points in scopes.items():
            payload = build_heatmap_payload(map_id, scope_id, points, dict(aggregate_sample_counts[map_id][scope_id]))
            output_path = aggregates_root / map_id / f"{scope_id}.json"
            write_json(output_path, payload)
            aggregate_catalog[map_id][scope_id] = f"/data/aggregates/{map_id}/{scope_id}.json"
            aggregate_highlights[map_id][scope_id] = summarize_top_cells(payload)

    match_event_density: list[float] = []
    match_durations: list[int] = []
    richest_match_id = None
    richest_match_score = -1

    for match_id, bucket in sorted(match_buckets.items()):
        points = sorted(bucket["points"], key=lambda point: (point["timeMs"], point["userId"], point["event"]))
        min_ts = int(bucket["minTsMs"])
        max_ts = int(bucket["maxTsMs"])
        duration_ms = max(1, max_ts - min_ts)

        for point in points:
            point["relativeTimeMs"] = point["timeMs"] - min_ts

        event_points = sorted(
            bucket["eventPoints"],
            key=lambda point: (point["timeMs"], point["userId"], point["event"]),
        )
        for event_point in event_points:
            event_point["relativeTimeMs"] = event_point["timeMs"] - min_ts

        participant_entries = sorted(
            [
                {
                    "userId": participant["userId"],
                    "isBot": participant["isBot"],
                    "rowCount": participant["rowCount"],
                    "eventCounts": dict(sorted(participant["eventCounts"].items())),
                }
                for participant in bucket["participants"].values()
            ],
            key=lambda entry: (entry["isBot"], entry["userId"]),
        )

        humans = sum(0 if entry["isBot"] else 1 for entry in participant_entries)
        bots = sum(1 if entry["isBot"] else 0 for entry in participant_entries)
        score = len(points) + len(event_points) * 4 + len(participant_entries) * 10
        if score > richest_match_score:
            richest_match_score = score
            richest_match_id = match_id

        match_payload = {
            "matchId": match_id,
            "mapId": bucket["mapId"],
            "dates": sorted(bucket["dates"]),
            "primaryDate": sorted(bucket["dates"])[0],
            "durationMs": duration_ms,
            "startTimeMs": min_ts,
            "endTimeMs": max_ts,
            "humans": humans,
            "bots": bots,
            "participantCount": len(participant_entries),
            "rowCount": len(points),
            "eventCounts": dict(sorted(bucket["eventCounts"].items())),
            "participants": participant_entries,
            "trackPoints": points,
            "eventPoints": event_points,
        }
        write_json(matches_root / f"{match_id}.json", match_payload)

        manifest_matches.append(
            {
                "matchId": match_id,
                "mapId": bucket["mapId"],
                "dates": sorted(bucket["dates"]),
                "primaryDate": sorted(bucket["dates"])[0],
                "durationMs": duration_ms,
                "humans": humans,
                "bots": bots,
                "participantCount": len(participant_entries),
                "rowCount": len(points),
                "eventCount": len(event_points),
                "eventCounts": dict(sorted(bucket["eventCounts"].items())),
                "dataPath": f"/data/matches/{match_id}.json",
            }
        )
        match_event_density.append(len(event_points) / max(1, len(points)))
        match_durations.append(duration_ms)

    manifest_matches.sort(
        key=lambda item: (
            item["primaryDate"],
            item["mapId"],
            -item["participantCount"],
            -item["rowCount"],
            item["matchId"],
        )
    )

    map_summaries = []
    for map_entry in map_entries:
        map_id = str(map_entry["id"])
        scoped_match_summaries = [match for match in manifest_matches if match["mapId"] == map_id]
        map_event_counts = Counter()
        for match in scoped_match_summaries:
            map_event_counts.update(match["eventCounts"])

        map_summaries.append(
            {
                **map_entry,
                "matchCount": len(scoped_match_summaries),
                "fileCount": map_file_counts[map_id],
                "rowCount": sum(int(match["rowCount"]) for match in scoped_match_summaries),
                "eventCounts": dict(sorted(map_event_counts.items())),
                "aggregatePaths": aggregate_catalog[map_id],
                "highlights": aggregate_highlights[map_id],
            }
        )

    date_entries = []
    for date_id in sorted(date_stats):
        date_summary = date_stats[date_id]
        match_ids = date_summary["matchIds"]
        date_entries.append(
            {
                "id": date_id,
                "label": date_summary["label"],
                "fileCount": date_summary["fileCount"],
                "rowCount": date_summary["rowCount"],
                "matchCount": len(match_ids),
            }
        )

    stats = {
        "totalFiles": file_count,
        "totalRows": total_rows,
        "uniqueAgents": len(unique_users),
        "uniqueHumanPlayers": len(unique_humans),
        "uniqueBots": len(unique_bots),
        "uniqueMatches": len(match_buckets),
        "humanFiles": human_file_count,
        "botFiles": bot_file_count,
        "botOnlyMatches": sum(1 for match in manifest_matches if match["humans"] == 0),
        "eventCounts": dict(sorted(event_counts.items())),
        "matchDurationMs": {
            "min": min(match_durations),
            "max": max(match_durations),
            "average": round(mean(match_durations), 2),
            "median": round(median(match_durations), 2),
        },
        "eventDensity": {
            "average": round(mean(match_event_density), 4),
            "median": round(median(match_event_density), 4),
        },
        "coordinateProjection": {
            "appMapSize": APP_MAP_SIZE,
            "heatmapGridSize": HEATMAP_GRID_SIZE,
            "allPointsInBounds": bounds_ok,
        },
    }

    manifest = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "datasetName": "LILA BLACK - Player Event Data",
        "defaultMatchId": richest_match_id,
        "maps": map_summaries,
        "dates": date_entries,
        "stats": stats,
        "metrics": [
            {
                "id": metric_id,
                "label": metric_meta["label"],
                "description": metric_meta["description"],
                "color": metric_meta["color"],
            }
            for metric_id, metric_meta in HEATMAP_METRICS.items()
        ],
        "eventTypes": [
            {
                "id": event_name,
                "label": event_meta["label"],
                "category": event_meta["category"],
                "description": event_meta["description"],
            }
            for event_name, event_meta in EVENT_META.items()
        ],
        "matches": manifest_matches,
    }
    write_json(out_root / "manifest.json", manifest)

    print(f"Built manifest with {humanize_number(file_count)} files and {humanize_number(total_rows)} rows.")
    print(f"Generated {humanize_number(len(manifest_matches))} match files and {humanize_number(len(map_entries))} map assets.")
    print(f"Default showcase match: {richest_match_id}")


def main() -> None:
    args = parse_args()
    source_root = Path(args.source).expanduser().resolve()
    out_root = Path(args.out).expanduser().resolve()
    build_dataset(source_root, out_root)


if __name__ == "__main__":
    main()
