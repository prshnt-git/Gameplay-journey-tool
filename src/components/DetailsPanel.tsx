import { useEffect, useMemo, useRef, useState } from "react";

import { dateLabelFromId, formatDurationMs, formatEventName, formatNumber, shortMatchId } from "../lib/format";
import { AggregatePayload, HotspotCell, Manifest, MapSummary, MatchSummary, MetricSummary, PlayerFilter, PointEvent, ViewMode } from "../types";
import { type ControlTab } from "./ControlPanel";

interface DetailsPanelProps {
  manifest: Manifest;
  selectedMap: MapSummary | null;
  selectedDateId: string;
  selectedMetric: MetricSummary | null;
  selectedMatchSummary: MatchSummary | null;
  selectedEvent: PointEvent | null;
  aggregateData: AggregatePayload | null;
  hotspots: HotspotCell[];
  viewMode: ViewMode;
  nextEvent: PointEvent | null;
  selectedPlayerType: PlayerFilter;
  visiblePopulationCount: number;
  visibleMarkerCount: number;
  activeControlTab: ControlTab;
  inspectorSyncKey: number;
  showHeatmap: boolean;
}

type InspectorTab = "summary" | "selection" | "guide";

interface NarrativeCard {
  label: string;
  title: string;
  detail: string;
}

interface SummaryCard {
  label: string;
  value: string;
}

const GUIDE_ROWS = [
  { label: "Human route", note: "Solid cyan trail with a circular live marker.", tone: "human" },
  { label: "Bot route", note: "Dashed amber trail with a square live marker.", tone: "bot" },
  { label: "Combat markers", note: "Kills use red diamonds; deaths use coral crosshair markers.", tone: "combat" },
  { label: "Utility markers", note: "Loot uses green squares; storm deaths use blue triangles.", tone: "utility" },
] as const;

function buildGuideDescription(viewMode: ViewMode, selectedDateId: string, scopeLabel: string) {
  const scopeWarning =
    selectedDateId === "all" || scopeLabel.includes("14")
      ? " February 14 is a partial collection day, so compare it with earlier days carefully."
      : "";

  if (viewMode === "overview") {
    return `Overview combines all scoped matches into one layer so repeat routes and contested cells show up quickly. H1 and H2 mark the strongest hotspots in scope.${scopeWarning}`;
  }

  return "Playback reveals one run over time. The scrubber stages the route, and the Event tab inspects whichever marker you select.";
}

function buildQuestion(metricLabel: string | undefined) {
  if (metricLabel === "Traffic") {
    return "Which routes repeat, and which spaces are consistently ignored?";
  }

  if (metricLabel === "Kill Zones") {
    return "Where do fights cluster, and are those choke points intentional?";
  }

  if (metricLabel === "Death Zones") {
    return "Where are players getting punished, and is that pressure fair?";
  }

  if (metricLabel === "Loot Routes") {
    return "Are pickup locations pulling players through the intended parts of the map?";
  }

  return "What does this telemetry layer reveal about how the space is actually being used?";
}

function buildInsight(metricLabel: string | undefined, hotspotValue: number | null, matchCount: number, sampleCount: number) {
  if (!metricLabel) {
    return "Use the current scope to decide which route, conflict zone, or ignored space deserves closer review.";
  }

  if (metricLabel === "Traffic") {
    return hotspotValue
      ? `Traffic concentrates in repeat paths. The strongest hotspot reaches ${formatNumber(hotspotValue)} samples across ${formatNumber(matchCount)} scoped matches.`
      : "Traffic view is best for spotting repeat routes and ignored space.";
  }

  if (metricLabel === "Kill Zones") {
    return hotspotValue
      ? "Combat clusters into a small set of cells. Review the strongest conflict area before changing cover, sightlines, or choke points."
      : "Kill view highlights repeated combat spaces and contested routes.";
  }

  if (metricLabel === "Death Zones") {
    return hotspotValue
      ? "Deaths collect into fewer, sharper hotspots than general travel. Review whether these spaces are intended chokepoints or punishing funnels."
      : "Death view is useful for checking punishing routes, storm pressure, and one-sided engagements.";
  }

  return sampleCount > 0
    ? "Loot pickups are concentrated into repeated stop points. Compare this with traffic to see whether loot placement is pulling players correctly."
    : "Loot view is useful for checking whether pickup spaces are attracting the routes you expect.";
}

function hotspotLabel(index: number) {
  return index === 0 ? "H1" : `H${index + 1}`;
}

function populationLabel(filter: PlayerFilter) {
  if (filter === "humans") {
    return "Humans only";
  }

  if (filter === "bots") {
    return "Bots only";
  }

  return "All agents";
}

function buildNarrativeCard({
  activeControlTab,
  viewMode,
  selectedMapLabel,
  scopeLabel,
  selectedMetricLabel,
  showHeatmap,
  selectedScopeMatchCount,
  sampleCount,
  selectedMatchSummary,
  selectedPlayerType,
  visiblePopulationCount,
  visibleMarkerCount,
}: {
  activeControlTab: ControlTab;
  viewMode: ViewMode;
  selectedMapLabel: string;
  scopeLabel: string;
  selectedMetricLabel: string;
  showHeatmap: boolean;
  selectedScopeMatchCount: number;
  sampleCount: number;
  selectedMatchSummary: MatchSummary | null;
  selectedPlayerType: PlayerFilter;
  visiblePopulationCount: number;
  visibleMarkerCount: number;
}): NarrativeCard {
  if (activeControlTab === "scope") {
    return {
      label: "Current scope",
      title: `${selectedMapLabel} - ${scopeLabel}`,
      detail:
        viewMode === "overview"
          ? `${formatNumber(selectedScopeMatchCount)} matches are in scope. Use overview to compare repeat patterns before opening one run.`
          : `${formatNumber(selectedScopeMatchCount)} matches fit this slice. Playback is narrowed to one selected run without changing the broader scope.`,
    };
  }

  if (activeControlTab === "signal") {
    return {
      label: "Signal focus",
      title: `${selectedMetricLabel} - ${showHeatmap ? "Heatmap layer" : "Markers only"}`,
      detail:
        viewMode === "overview"
          ? `${formatNumber(sampleCount)} scoped samples feed this layer across the selected slice.`
          : `${populationLabel(selectedPlayerType)} with ${formatNumber(visibleMarkerCount)} matching markers across ${formatNumber(visiblePopulationCount)} filtered agents.`,
    };
  }

  return {
    label: "Selected run",
    title: selectedMatchSummary ? shortMatchId(selectedMatchSummary.matchId) : "No match selected",
    detail: selectedMatchSummary
      ? `${selectedMatchSummary.humans} humans, ${selectedMatchSummary.bots} bots, ${formatDurationMs(selectedMatchSummary.durationMs)}, ${formatNumber(selectedMatchSummary.eventCount)} logged events.`
      : "Choose a match to inspect one run in detail.",
  };
}

function buildSummaryCards({
  activeControlTab,
  viewMode,
  selectedMapLabel,
  scopeLabel,
  selectedMetricLabel,
  showHeatmap,
  selectedScopeMatchCount,
  sampleCount,
  hotspotValue,
  selectedMatchSummary,
  selectedPlayerType,
  visibleMarkerCount,
}: {
  activeControlTab: ControlTab;
  viewMode: ViewMode;
  selectedMapLabel: string;
  scopeLabel: string;
  selectedMetricLabel: string;
  showHeatmap: boolean;
  selectedScopeMatchCount: number;
  sampleCount: number;
  hotspotValue: number | null;
  selectedMatchSummary: MatchSummary | null;
  selectedPlayerType: PlayerFilter;
  visibleMarkerCount: number;
}): SummaryCard[] {
  if (activeControlTab === "scope") {
    return [
      { label: "Map", value: selectedMapLabel },
      { label: "Date", value: scopeLabel },
      { label: "View", value: viewMode === "overview" ? "Overview" : "Playback" },
      { label: "Matches", value: formatNumber(selectedScopeMatchCount) },
    ];
  }

  if (activeControlTab === "signal") {
    return [
      { label: "Signal", value: selectedMetricLabel },
      { label: "Layer", value: showHeatmap ? "Heatmap" : "Markers" },
      { label: "Samples", value: formatNumber(sampleCount) },
      { label: "Peak", value: hotspotValue ? formatNumber(hotspotValue) : "No data" },
    ];
  }

  return [
    { label: "Match", value: selectedMatchSummary ? shortMatchId(selectedMatchSummary.matchId) : "None" },
    { label: "Duration", value: selectedMatchSummary ? formatDurationMs(selectedMatchSummary.durationMs) : "0 ms" },
    { label: "Population", value: populationLabel(selectedPlayerType) },
    { label: "Markers", value: formatNumber(visibleMarkerCount) },
  ];
}

export function DetailsPanel({
  manifest,
  selectedMap,
  selectedDateId,
  selectedMetric,
  selectedMatchSummary,
  selectedEvent,
  aggregateData,
  hotspots,
  viewMode,
  nextEvent,
  selectedPlayerType,
  visiblePopulationCount,
  visibleMarkerCount,
  activeControlTab,
  inspectorSyncKey,
  showHeatmap,
}: DetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("summary");
  const autoOpenedEventIdRef = useRef<string | null>(null);

  const selectedMetricPayload = selectedMetric && aggregateData ? aggregateData.metrics[selectedMetric.id] : null;
  const selectedScopeMatchCount = manifest.matches.filter(
    (match) => match.mapId === selectedMap?.id && (selectedDateId === "all" || match.dates.includes(selectedDateId)),
  ).length;
  const scopeLabel = selectedDateId === "all" ? "All days" : dateLabelFromId(selectedDateId, manifest.dates);
  const selectedMapLabel = selectedMap?.label ?? "No map";
  const selectedMetricLabel = selectedMetric?.label ?? "Signal";
  const sampleCount = selectedMetricPayload?.sampleCount ?? 0;
  const topHotspotValue = hotspots[0]?.value ?? null;
  const keyInsight = useMemo(
    () => buildInsight(selectedMetric?.label, topHotspotValue, selectedScopeMatchCount, sampleCount),
    [sampleCount, selectedMetric?.label, selectedScopeMatchCount, topHotspotValue],
  );
  const rankedHotspots = hotspots.slice(0, 2);
  const eventDescriptions = useMemo(
    () => Object.fromEntries(manifest.eventTypes.map((eventType) => [eventType.id, eventType.description])),
    [manifest.eventTypes],
  );
  const narrativeCard = useMemo(
    () =>
      buildNarrativeCard({
        activeControlTab,
        viewMode,
        selectedMapLabel,
        scopeLabel,
        selectedMetricLabel,
        showHeatmap,
        selectedScopeMatchCount,
        sampleCount,
        selectedMatchSummary,
        selectedPlayerType,
        visiblePopulationCount,
        visibleMarkerCount,
      }),
    [
      activeControlTab,
      sampleCount,
      scopeLabel,
      selectedMapLabel,
      selectedMatchSummary,
      selectedMetricLabel,
      selectedPlayerType,
      selectedScopeMatchCount,
      showHeatmap,
      viewMode,
      visibleMarkerCount,
      visiblePopulationCount,
    ],
  );
  const summaryCards = useMemo(
    () =>
      buildSummaryCards({
        activeControlTab,
        viewMode,
        selectedMapLabel,
        scopeLabel,
        selectedMetricLabel,
        showHeatmap,
        selectedScopeMatchCount,
        sampleCount,
        hotspotValue: topHotspotValue,
        selectedMatchSummary,
        selectedPlayerType,
        visibleMarkerCount,
      }),
    [
      activeControlTab,
      sampleCount,
      scopeLabel,
      selectedMapLabel,
      selectedMatchSummary,
      selectedMetricLabel,
      selectedPlayerType,
      selectedScopeMatchCount,
      showHeatmap,
      topHotspotValue,
      viewMode,
      visibleMarkerCount,
    ],
  );
  const guideDescription = useMemo(
    () => buildGuideDescription(viewMode, selectedDateId, scopeLabel),
    [scopeLabel, selectedDateId, viewMode],
  );

  useEffect(() => {
    if (selectedEvent?.id && autoOpenedEventIdRef.current !== selectedEvent.id) {
      autoOpenedEventIdRef.current = selectedEvent.id;
      setActiveTab("selection");
    }
    if (!selectedEvent?.id) {
      autoOpenedEventIdRef.current = null;
    }
  }, [selectedEvent?.id]);

  useEffect(() => {
    if (!selectedEvent) {
      setActiveTab("summary");
    }
  }, [inspectorSyncKey, selectedEvent]);

  useEffect(() => {
    if (viewMode === "overview" && activeTab === "selection") {
      setActiveTab("summary");
    }
  }, [activeTab, viewMode]);

  return (
    <aside className="panel details-panel inspector-dock">
      <div className="panel-header dock-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>Evidence</h2>
        </div>
        <div className="dock-meta-chip">
          <strong>{selectedMapLabel}</strong>
          <span>{scopeLabel}</span>
        </div>
      </div>

      <section className="panel-section dock-tabs-section">
        <div className="dock-tabs">
          <button type="button" className={activeTab === "summary" ? "is-active" : ""} onClick={() => setActiveTab("summary")}>
            Readout
          </button>
          <button type="button" className={activeTab === "selection" ? "is-active" : ""} onClick={() => setActiveTab("selection")}>
            Event
          </button>
          <button type="button" className={activeTab === "guide" ? "is-active" : ""} onClick={() => setActiveTab("guide")}>
            Guide
          </button>
        </div>
      </section>

      {activeTab === "summary" ? (
        <section className="panel-section dock-panel compact-dock-panel inspector-panel-body">
          <article className="focus-card tight">
            <span className="brief-label">{narrativeCard.label}</span>
            <strong>{narrativeCard.title}</strong>
            <p>{narrativeCard.detail}</p>
          </article>

          <div className="stat-grid">
            {summaryCards.map((card) => (
              <div key={card.label} className="stat-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>

          <article className="focus-card tight">
            <span className="brief-label">{viewMode === "overview" ? "Question to answer" : "Why it matters"}</span>
            <strong>{selectedMetricLabel}</strong>
            <p>{viewMode === "overview" ? buildQuestion(selectedMetric?.label) : keyInsight}</p>
          </article>

          {viewMode === "overview" && rankedHotspots.length > 0 ? (
            <div className="hotspot-list compact">
              {rankedHotspots.map((hotspot, index) => (
                <article key={`${hotspot.pixelX}-${hotspot.pixelY}-${index}`} className="hotspot-card compact-hotspot">
                  <span>{hotspotLabel(index)}</span>
                  <div>
                    <strong>{index === 0 ? "Strongest hotspot" : "Secondary hotspot"}</strong>
                    <p>{formatNumber(hotspot.value)} samples in the current scope.</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {viewMode === "match" ? (
            <article className="focus-card tight">
              <span className="brief-label">Playback cue</span>
              <strong>
                {selectedEvent
                  ? `${formatEventName(selectedEvent.event)} selected`
                  : nextEvent
                    ? formatEventName(nextEvent.event)
                    : "No upcoming event"}
              </strong>
              <p>
                {selectedEvent
                  ? `${shortMatchId(selectedEvent.userId)} at ${formatDurationMs(selectedEvent.relativeTimeMs)}.`
                  : nextEvent
                    ? `${shortMatchId(nextEvent.userId)} next at ${formatDurationMs(nextEvent.relativeTimeMs)}.`
                    : `${visiblePopulationCount} agents remain in the current playback filter.`}
              </p>
            </article>
          ) : null}
        </section>
      ) : null}

      {activeTab === "selection" ? (
        <section className="panel-section dock-panel compact-dock-panel inspector-panel-body">
          {selectedEvent ? (
            <>
              <article className="focus-card tight">
                <span className="brief-label">Selected marker</span>
                <strong>{formatEventName(selectedEvent.event)}</strong>
                <p>Inspect this marker within the current playback state.</p>
              </article>

              <div className="stat-grid">
                <div className="stat-card">
                  <span>Time</span>
                  <strong>{formatDurationMs(selectedEvent.relativeTimeMs)}</strong>
                </div>
                <div className="stat-card">
                  <span>Actor</span>
                  <strong>{selectedEvent.isBot ? "Bot agent" : "Human player"}</strong>
                </div>
                <div className="stat-card">
                  <span>Identity</span>
                  <strong>{shortMatchId(selectedEvent.userId)}</strong>
                </div>
                <div className="stat-card">
                  <span>Position</span>
                  <strong>{`${selectedEvent.pixelX.toFixed(0)}, ${selectedEvent.pixelY.toFixed(0)}`}</strong>
                </div>
                <div className="stat-card stat-card-wide">
                  <span>Meaning</span>
                  <strong>{eventDescriptions[selectedEvent.event] ?? "Event description unavailable."}</strong>
                </div>
              </div>
            </>
          ) : viewMode !== "match" ? (
            <div className="empty-list">Event inspection is available in playback. Switch from overview when you want per-event detail.</div>
          ) : nextEvent ? (
            <>
              <article className="focus-card tight">
                <span className="brief-label">Upcoming cue</span>
                <strong>{formatEventName(nextEvent.event)}</strong>
                <p>No marker is selected. This is the next visible event in the current playback filter.</p>
              </article>

              <div className="stat-grid">
                <div className="stat-card">
                  <span>Time</span>
                  <strong>{formatDurationMs(nextEvent.relativeTimeMs)}</strong>
                </div>
                <div className="stat-card">
                  <span>Actor</span>
                  <strong>{nextEvent.isBot ? "Bot agent" : "Human player"}</strong>
                </div>
                <div className="stat-card">
                  <span>Identity</span>
                  <strong>{shortMatchId(nextEvent.userId)}</strong>
                </div>
                <div className="stat-card">
                  <span>Position</span>
                  <strong>{`${nextEvent.pixelX.toFixed(0)}, ${nextEvent.pixelY.toFixed(0)}`}</strong>
                </div>
                <div className="stat-card stat-card-wide">
                  <span>Meaning</span>
                  <strong>{eventDescriptions[nextEvent.event] ?? "Event description unavailable."}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-list">No selected or upcoming event is available in the current playback state.</div>
          )}
        </section>
      ) : null}

      {activeTab === "guide" ? (
        <section className="panel-section dock-panel compact-dock-panel inspector-panel-body">
          <article className="focus-card tight">
            <span className="brief-label">How to read the stage</span>
            <strong>{viewMode === "overview" ? "Overview guide" : "Playback guide"}</strong>
            <p>{guideDescription}</p>
          </article>

          <div className="reference-grid compact">
            {GUIDE_ROWS.map((row) => (
              <div key={row.label} className={`reference-row reference-row-${row.tone}`}>
                <span className={`legend-swatch legend-swatch-${row.tone}`} />
                <div>
                  <strong>{row.label}</strong>
                  <p>{row.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
