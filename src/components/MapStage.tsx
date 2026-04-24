import { ReactNode, useEffect, useRef } from "react";

import { clamp } from "../lib/format";
import { BOT_TRAIL, EVENT_COLORS, HUMAN_TRAIL, hexToRgba } from "../lib/palette";
import { AggregatePayload, HotspotCell, MapSummary, MetricSummary, PointEvent, TrackPoint, ViewMode } from "../types";

interface MapStageProps {
  map: MapSummary | null;
  metric: MetricSummary | null;
  aggregateData: AggregatePayload | null;
  showHeatmap: boolean;
  viewMode: ViewMode;
  trackPoints: TrackPoint[];
  eventPoints: PointEvent[];
  nextEvent: PointEvent | null;
  selectedEventId: string | null;
  hotspots: HotspotCell[];
  onSelectEvent: (eventId: string) => void;
  timelineSlot?: ReactNode;
}

interface HeatmapCanvasProps {
  aggregateData: AggregatePayload | null;
  metric: MetricSummary | null;
  visible: boolean;
  viewMode: ViewMode;
}

function HeatmapCanvas({ aggregateData, metric, visible, viewMode }: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const deviceRatio = window.devicePixelRatio || 1;
    canvas.width = 1024 * deviceRatio;
    canvas.height = 1024 * deviceRatio;
    context.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
    context.clearRect(0, 0, 1024, 1024);

    if (!visible || !aggregateData || !metric) {
      return;
    }

    const metricPayload = aggregateData.metrics[metric.id];
    const cellSize = 1024 / aggregateData.gridSize;
    const radius = cellSize * 1.8;
    const maxValue = Math.max(metricPayload.maxValue, 1);

    for (let yIndex = 0; yIndex < aggregateData.gridSize; yIndex += 1) {
      for (let xIndex = 0; xIndex < aggregateData.gridSize; xIndex += 1) {
        const value = metricPayload.bins[yIndex][xIndex];
        if (value <= 0) {
          continue;
        }

        const normalized = clamp(value / maxValue, 0, 1);
        const centerX = (xIndex + 0.5) * cellSize;
        const centerY = (yIndex + 0.5) * cellSize;
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, hexToRgba(metric.color, 0.18 + normalized * 0.7));
        gradient.addColorStop(0.55, hexToRgba(metric.color, 0.1 + normalized * 0.25));
        gradient.addColorStop(1, hexToRgba(metric.color, 0));

        context.fillStyle = gradient;
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      }
    }

    context.strokeStyle = hexToRgba(metric.color, 0.24);
    context.lineWidth = 1;
    for (let grid = 0; grid <= aggregateData.gridSize; grid += 1) {
      const offset = grid * cellSize;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, 1024);
      context.stroke();

      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(1024, offset);
      context.stroke();
    }
  }, [aggregateData, metric, visible]);

  return (
    <canvas
      ref={canvasRef}
      className={`heatmap-canvas ${visible ? "" : "is-hidden"} ${viewMode === "match" ? "is-match" : "is-overview"}`}
    />
  );
}

function EventGlyph({ event }: { event: PointEvent }) {
  const color = EVENT_COLORS[event.event] ?? "#ffffff";

  if (event.event === "Loot") {
    return <rect x={-5} y={-5} width={10} height={10} rx={2} fill={color} />;
  }

  if (event.event === "KilledByStorm") {
    return <polygon points="0,-6 6,5 -6,5" fill={color} />;
  }

  if (event.event === "Kill" || event.event === "BotKill") {
    return <rect x={-4.5} y={-4.5} width={9} height={9} transform="rotate(45)" fill={color} />;
  }

  if (event.event === "Killed" || event.event === "BotKilled") {
    return (
      <>
        <circle r={5.5} fill="none" stroke={color} strokeWidth={2} />
        <path d="M-3 0 H3 M0 -3 V3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </>
    );
  }

  return <circle r={5} fill={color} />;
}

export function MapStage({
  map,
  metric,
  aggregateData,
  showHeatmap,
  viewMode,
  trackPoints,
  eventPoints,
  nextEvent,
  selectedEventId,
  hotspots,
  onSelectEvent,
  timelineSlot,
}: MapStageProps) {
  if (!map) {
    return (
      <section className="panel stage-panel">
        <div className="empty-stage">No map selected yet.</div>
      </section>
    );
  }

  const tracksByUser: Record<string, TrackPoint[]> = {};
  for (const point of trackPoints) {
    if (!tracksByUser[point.userId]) {
      tracksByUser[point.userId] = [];
    }
    tracksByUser[point.userId].push(point);
  }

  const currentPositions = Object.values(tracksByUser).map((points) => points[points.length - 1]);

  return (
    <section className="panel stage-panel">
      <div className="stage-frame">
        <div className="stage-surface">
          <img
            className="stage-map"
            src={map.image}
            alt={`${map.label} minimap`}
            decoding="async"
          />
          <div className="stage-wash" aria-hidden="true" />
          <div className="stage-grid" aria-hidden="true" />
          <HeatmapCanvas aggregateData={aggregateData} metric={metric} visible={showHeatmap} viewMode={viewMode} />

          <svg className="stage-overlay" viewBox="0 0 1024 1024" preserveAspectRatio="none">
            <defs>
              <filter id="trail-glow">
                <feGaussianBlur stdDeviation="2.2" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {Object.entries(tracksByUser).map(([userId, points]) => {
              const lastPoint = points[points.length - 1];
              const strokeColor = lastPoint.isBot ? BOT_TRAIL : HUMAN_TRAIL;

              return (
                <polyline
                  key={userId}
                  className={`track-line ${lastPoint.isBot ? "is-bot" : "is-human"}`}
                  points={points.map((point) => `${point.pixelX},${point.pixelY}`).join(" ")}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={lastPoint.isBot ? 2 : 2.6}
                  strokeDasharray={lastPoint.isBot ? "8 6" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#trail-glow)"
                />
              );
            })}

            {currentPositions.map((point) =>
              point.isBot ? (
                <rect
                  key={`head-${point.userId}`}
                  x={point.pixelX - 5}
                  y={point.pixelY - 5}
                  width={10}
                  height={10}
                  rx={2}
                  fill={BOT_TRAIL}
                  className="current-head"
                />
              ) : (
                <g key={`head-${point.userId}`} className="current-head">
                  <circle cx={point.pixelX} cy={point.pixelY} r={8} fill={hexToRgba(HUMAN_TRAIL, 0.2)} />
                  <circle cx={point.pixelX} cy={point.pixelY} r={4} fill={HUMAN_TRAIL} />
                </g>
              ),
            )}

            {eventPoints.map((event) => (
              <g
                key={event.id}
                className={`event-marker ${selectedEventId === event.id ? "is-selected" : ""}`}
                transform={`translate(${event.pixelX},${event.pixelY})`}
                onClick={() => onSelectEvent(event.id)}
              >
                <circle
                  r={selectedEventId === event.id ? 12 : 9}
                  fill={hexToRgba(EVENT_COLORS[event.event] ?? "#ffffff", selectedEventId === event.id ? 0.2 : 0.08)}
                  stroke={hexToRgba(EVENT_COLORS[event.event] ?? "#ffffff", 0.55)}
                  strokeWidth={selectedEventId === event.id ? 2 : 1}
                />
                <EventGlyph event={event} />
              </g>
            ))}

            {nextEvent ? (
              <g transform={`translate(${nextEvent.pixelX},${nextEvent.pixelY})`} className="next-event-pulse">
                <circle
                  r={18}
                  fill="none"
                  stroke={hexToRgba(EVENT_COLORS[nextEvent.event] ?? "#ffffff", 0.58)}
                  strokeWidth={2}
                />
              </g>
            ) : null}
          </svg>

          {viewMode === "overview" && hotspots.length > 0 ? (
            <div className="hotspot-layer" aria-hidden="true">
              {hotspots.slice(0, 2).map((hotspot, index) => (
                <div
                  key={`${hotspot.pixelX}-${hotspot.pixelY}-${index}`}
                  className="hotspot-pin"
                  style={{
                    left: `${(hotspot.pixelX / 1024) * 100}%`,
                    top: `${(hotspot.pixelY / 1024) * 100}%`,
                  }}
                >
                  <span>{`H${index + 1}`}</span>
                </div>
              ))}
            </div>
          ) : null}

          {timelineSlot ? <div className="stage-timeline-overlay">{timelineSlot}</div> : null}
        </div>
      </div>
    </section>
  );
}
