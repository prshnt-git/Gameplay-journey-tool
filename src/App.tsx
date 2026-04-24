import { startTransition, useEffect, useRef, useState } from "react";

import { ControlPanel, type ControlTab } from "./components/ControlPanel";
import { WorkspaceView } from "./components/WorkspaceView";
import { AggregatePayload, EventVisibility, Manifest, MatchData, MatchSummary, MetricId, PlayerFilter, ViewMode } from "./types";

function createVisibilityMap(manifest: Manifest): EventVisibility {
  return Object.fromEntries(manifest.eventTypes.map((eventType) => [eventType.id, true]));
}

function defaultEventIdsForMetric(metricId: MetricId): string[] {
  switch (metricId) {
    case "traffic":
      return ["Position", "BotPosition"];
    case "kills":
      return ["Kill", "Killed", "BotKill", "BotKilled"];
    case "deaths":
      return ["Killed", "BotKilled", "KilledByStorm"];
    case "loot":
      return ["Loot"];
    default:
      return [];
  }
}

function createVisibilitySubset(manifest: Manifest, visibleEventIds: string[]): EventVisibility {
  const visibleSet = new Set(visibleEventIds);
  return Object.fromEntries(manifest.eventTypes.map((eventType) => [eventType.id, visibleSet.has(eventType.id)]));
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [isManifestLoading, setIsManifestLoading] = useState(true);

  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedDateId, setSelectedDateId] = useState("all");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState<MetricId>("traffic");
  const [selectedPlayerType, setSelectedPlayerType] = useState<PlayerFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("match");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [eventVisibility, setEventVisibility] = useState<EventVisibility>({});
  const [activeControlTab, setActiveControlTab] = useState<ControlTab>("scope");
  const [inspectorSyncKey, setInspectorSyncKey] = useState(0);

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [aggregateData, setAggregateData] = useState<AggregatePayload | null>(null);

  const matchCacheRef = useRef<Record<string, MatchData>>({});
  const aggregateCacheRef = useRef<Record<string, AggregatePayload>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      setIsManifestLoading(true);

      try {
        const response = await fetch("/data/manifest.json");
        if (!response.ok) {
          throw new Error(`Manifest request failed with ${response.status}`);
        }

        const nextManifest = (await response.json()) as Manifest;
        if (cancelled) {
          return;
        }

        const defaultMatch =
          nextManifest.matches.find((match) => match.matchId === nextManifest.defaultMatchId) ??
          nextManifest.matches[0] ??
          null;
        const defaultMapId = defaultMatch?.mapId ?? nextManifest.maps[0]?.id ?? "";

        startTransition(() => {
          setManifest(nextManifest);
          setSelectedMapId(defaultMapId);
          setSelectedDateId("all");
          setSelectedMatchId(defaultMatch?.matchId ?? null);
          setSelectedMetricId("traffic");
          setSelectedPlayerType("all");
          setViewMode(defaultMatch ? "match" : "overview");
          setShowHeatmap(true);
          setEventVisibility(createVisibilityMap(nextManifest));
          setActiveControlTab(defaultMatch ? "match" : "scope");
          setManifestError(null);
        });
      } catch (error) {
        if (!cancelled) {
          setManifestError(error instanceof Error ? error.message : "Failed to load manifest.");
        }
      } finally {
        if (!cancelled) {
          setIsManifestLoading(false);
        }
      }
    }

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMatches: MatchSummary[] = manifest
    ? manifest.matches.filter((match) => {
        if (match.mapId !== selectedMapId) {
          return false;
        }

        return selectedDateId === "all" || match.dates.includes(selectedDateId);
      })
    : [];

  useEffect(() => {
    if (!manifest) {
      return;
    }

    if (selectedMatchId && filteredMatches.some((match) => match.matchId === selectedMatchId)) {
      return;
    }

    const nextMatchId = filteredMatches[0]?.matchId ?? null;
    startTransition(() => {
      setSelectedMatchId(nextMatchId);
      if (!nextMatchId) {
        setViewMode("overview");
      }
    });
  }, [filteredMatches, manifest, selectedMatchId]);

  useEffect(() => {
    if (viewMode === "overview" && selectedPlayerType !== "all") {
      setSelectedPlayerType("all");
    }
  }, [selectedPlayerType, viewMode]);

  const selectedMap = manifest?.maps.find((map) => map.id === selectedMapId) ?? null;
  const selectedMetric = manifest?.metrics.find((metric) => metric.id === selectedMetricId) ?? null;
  const selectedMatchSummary = manifest?.matches.find((match) => match.matchId === selectedMatchId) ?? null;

  const scopeId = selectedDateId === "all" ? "all" : selectedDateId;
  useEffect(() => {
    if (!selectedMap) {
      setAggregateData(null);
      return;
    }

    const dataPath = selectedMap.aggregatePaths[scopeId];
    if (!dataPath) {
      setAggregateData(null);
      return;
    }

    const cached = aggregateCacheRef.current[dataPath];
    if (cached) {
      setAggregateData(cached);
      return;
    }

    setAggregateData(null);

    let cancelled = false;

    async function loadAggregate() {
      try {
        const response = await fetch(dataPath);
        if (!response.ok) {
          throw new Error(`Aggregate request failed with ${response.status}`);
        }

        const payload = (await response.json()) as AggregatePayload;
        if (cancelled) {
          return;
        }

        aggregateCacheRef.current[dataPath] = payload;
        startTransition(() => setAggregateData(payload));
      } catch (error) {
        if (!cancelled) {
          console.error(error instanceof Error ? error.message : "Failed to load aggregate heatmap.");
        }
      }
    }

    void loadAggregate();

    return () => {
      cancelled = true;
    };
  }, [scopeId, selectedMap]);

  useEffect(() => {
    if (!selectedMatchSummary) {
      setMatchData(null);
      return;
    }

    const dataPath = selectedMatchSummary.dataPath;
    const cached = matchCacheRef.current[dataPath];
    if (cached) {
      setMatchData(cached);
      return;
    }

    setMatchData(null);

    let cancelled = false;

    async function loadMatch() {
      try {
        const response = await fetch(dataPath);
        if (!response.ok) {
          throw new Error(`Match request failed with ${response.status}`);
        }

        const payload = (await response.json()) as MatchData;
        if (cancelled) {
          return;
        }

        matchCacheRef.current[dataPath] = payload;
        startTransition(() => setMatchData(payload));
      } catch (error) {
        if (!cancelled) {
          console.error(error instanceof Error ? error.message : "Failed to load match telemetry.");
        }
      }
    }

    void loadMatch();

    return () => {
      cancelled = true;
    };
  }, [selectedMatchSummary]);

  const hotspots = selectedMap?.highlights[scopeId]?.[selectedMetricId] ?? [];

  if (isManifestLoading) {
    return (
      <main className="app loading-screen">
        <div className="loading-card">
          <p className="eyebrow">LILA Player Journey Visualizer</p>
          <h1>Building tactical telemetry view...</h1>
          <p>Loading manifest, map assets, and match index.</p>
        </div>
      </main>
    );
  }

  if (manifestError || !manifest) {
    return (
      <main className="app loading-screen">
        <div className="loading-card is-error">
          <p className="eyebrow">Manifest Error</p>
          <h1>Telemetry index unavailable</h1>
          <p>{manifestError ?? "The manifest could not be loaded."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app app-shell">
      <div className="app-chrome" />

      <div className="layout-grid shell-grid">
        <ControlPanel
          maps={manifest.maps}
          dates={manifest.dates}
          metrics={manifest.metrics}
          filteredMatches={filteredMatches}
          selectedMapId={selectedMapId}
          selectedDateId={selectedDateId}
          selectedMetricId={selectedMetricId}
          selectedMatchId={selectedMatchId}
          selectedPlayerType={selectedPlayerType}
          showHeatmap={showHeatmap}
          viewMode={viewMode}
          eventVisibility={eventVisibility}
          activeTab={activeControlTab}
          onMapChange={(value) => {
            setSelectedMapId(value);
            setActiveControlTab("scope");
            setInspectorSyncKey((current) => current + 1);
          }}
          onDateChange={(value) => {
            setSelectedDateId(value);
            setActiveControlTab("scope");
            setInspectorSyncKey((current) => current + 1);
          }}
          onMetricChange={(value) => {
            setSelectedMetricId(value);
            setEventVisibility(createVisibilitySubset(manifest, defaultEventIdsForMetric(value)));
            setActiveControlTab("signal");
            setInspectorSyncKey((current) => current + 1);
          }}
          onMatchChange={(value) => {
            setSelectedMatchId(value);
            setViewMode("match");
            setActiveControlTab("match");
            setInspectorSyncKey((current) => current + 1);
          }}
          onPlayerTypeChange={(value) => {
            setSelectedPlayerType(value);
            setActiveControlTab("signal");
            setInspectorSyncKey((current) => current + 1);
          }}
          onShowHeatmapChange={(value) => {
            setShowHeatmap(value);
            setActiveControlTab("signal");
            setInspectorSyncKey((current) => current + 1);
          }}
          onViewModeChange={(value) => {
            setViewMode(value);
            setActiveControlTab(value === "match" ? "match" : "scope");
            setInspectorSyncKey((current) => current + 1);
          }}
          onSetVisibleEvents={(eventIds) => {
            setEventVisibility(createVisibilitySubset(manifest, eventIds));
            setActiveControlTab("signal");
            setInspectorSyncKey((current) => current + 1);
          }}
          onActiveTabChange={(tab) => {
            setActiveControlTab(tab);
            setInspectorSyncKey((current) => current + 1);
          }}
        />

        <WorkspaceView
          manifest={manifest}
          selectedMap={selectedMap}
          selectedDateId={selectedDateId}
          selectedMetric={selectedMetric}
          selectedMatchSummary={selectedMatchSummary}
          matchData={matchData}
          aggregateData={aggregateData}
          hotspots={hotspots}
          viewMode={viewMode}
          showHeatmap={showHeatmap}
          selectedPlayerType={selectedPlayerType}
          eventVisibility={eventVisibility}
          activeControlTab={activeControlTab}
          inspectorSyncKey={inspectorSyncKey}
        />
      </div>
    </main>
  );
}
