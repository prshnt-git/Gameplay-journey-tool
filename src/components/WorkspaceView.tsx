import { useEffect, useMemo, useRef, useState } from "react";

import { usePlayback } from "../hooks/usePlayback";
import {
  AggregatePayload,
  EventVisibility,
  HotspotCell,
  Manifest,
  MatchData,
  MatchSummary,
  MetricSummary,
  PlayerFilter,
  PointEvent,
  ViewMode,
} from "../types";
import { type ControlTab } from "./ControlPanel";
import { DetailsPanel } from "./DetailsPanel";
import { MapStage } from "./MapStage";
import { TimelineControls } from "./TimelineControls";

function matchesPlayerType(isBot: boolean, filter: PlayerFilter): boolean {
  if (filter === "all") {
    return true;
  }

  return filter === "bots" ? isBot : !isBot;
}

interface WorkspaceViewProps {
  manifest: Manifest;
  selectedMap: Manifest["maps"][number] | null;
  selectedDateId: string;
  selectedMetric: MetricSummary | null;
  selectedMatchSummary: MatchSummary | null;
  matchData: MatchData | null;
  aggregateData: AggregatePayload | null;
  hotspots: HotspotCell[];
  viewMode: ViewMode;
  showHeatmap: boolean;
  selectedPlayerType: PlayerFilter;
  eventVisibility: EventVisibility;
  activeControlTab: ControlTab;
  inspectorSyncKey: number;
}

export function WorkspaceView({
  manifest,
  selectedMap,
  selectedDateId,
  selectedMetric,
  selectedMatchSummary,
  matchData,
  aggregateData,
  hotspots,
  viewMode,
  showHeatmap,
  selectedPlayerType,
  eventVisibility,
  activeControlTab,
  inspectorSyncKey,
}: WorkspaceViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const hydratedMatchRef = useRef<string | null>(null);

  const scopedTrackPoints = useMemo(
    () =>
      matchData
        ? matchData.trackPoints.filter(
            (point) =>
              matchesPlayerType(point.isBot, selectedPlayerType) &&
              ((point.event === "Position" && Boolean(eventVisibility.Position)) ||
                (point.event === "BotPosition" && Boolean(eventVisibility.BotPosition))),
          )
        : [],
    [eventVisibility.BotPosition, eventVisibility.Position, matchData, selectedPlayerType],
  );

  const scopedEventPoints = useMemo(
    () =>
      matchData
        ? matchData.eventPoints.filter(
            (eventPoint) =>
              matchesPlayerType(eventPoint.isBot, selectedPlayerType) && Boolean(eventVisibility[eventPoint.event]),
          )
        : [],
    [eventVisibility, matchData, selectedPlayerType],
  );

  const filteredEventTimeline = useMemo(() => {
    const seen = new Set<number>();
    const timeline: number[] = [];

    for (const eventPoint of scopedEventPoints) {
      if (seen.has(eventPoint.relativeTimeMs)) {
        continue;
      }

      seen.add(eventPoint.relativeTimeMs);
      timeline.push(eventPoint.relativeTimeMs);
    }

    return timeline.sort((left, right) => left - right);
  }, [scopedEventPoints]);

  const playback = usePlayback({
    durationMs: viewMode === "match" ? matchData?.durationMs ?? 0 : 0,
    eventTimes: filteredEventTimeline,
  });

  useEffect(() => {
    hydratedMatchRef.current = null;

    if (!selectedMatchSummary) {
      return;
    }

    playback.pause();
    setSelectedEventId(null);
  }, [selectedMatchSummary?.matchId]);

  useEffect(() => {
    if (!matchData || viewMode !== "match") {
      return;
    }

    if (hydratedMatchRef.current === matchData.matchId) {
      return;
    }

    hydratedMatchRef.current = matchData.matchId;
    playback.pause();
    playback.seek(0);
  }, [matchData, viewMode]);

  useEffect(() => {
    if (viewMode !== "match") {
      playback.pause();
    }
  }, [viewMode]);

  const filteredTrackPoints = useMemo(
    () =>
      viewMode === "match"
        ? scopedTrackPoints.filter((point) => point.relativeTimeMs <= playback.currentTimeMs)
        : [],
    [playback.currentTimeMs, scopedTrackPoints, viewMode],
  );

  const filteredEventPoints = useMemo(
    () =>
      viewMode === "match"
        ? scopedEventPoints.filter((eventPoint) => eventPoint.relativeTimeMs <= playback.currentTimeMs)
        : [],
    [playback.currentTimeMs, scopedEventPoints, viewMode],
  );

  const nextVisibleEvent = useMemo(
    () =>
      viewMode === "match"
        ? scopedEventPoints.find((eventPoint) => eventPoint.relativeTimeMs > playback.currentTimeMs) ?? null
        : null,
    [playback.currentTimeMs, scopedEventPoints, viewMode],
  );

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    const stillVisible = filteredEventPoints.some((eventPoint) => eventPoint.id === selectedEventId);
    if (!stillVisible) {
      setSelectedEventId(null);
    }
  }, [filteredEventPoints, selectedEventId]);

  const selectedEvent: PointEvent | null =
    filteredEventPoints.find((eventPoint) => eventPoint.id === selectedEventId) ?? null;
  const filteredPopulationCount =
    viewMode === "match" && matchData
      ? matchData.participants.filter((participant) => matchesPlayerType(participant.isBot, selectedPlayerType)).length
      : 0;

  return (
    <>
      <div className="workspace-main">
        <MapStage
          map={selectedMap}
          metric={selectedMetric}
          aggregateData={aggregateData}
          showHeatmap={showHeatmap}
          viewMode={viewMode}
          trackPoints={filteredTrackPoints}
          eventPoints={filteredEventPoints}
          nextEvent={nextVisibleEvent}
          selectedEventId={selectedEventId}
          hotspots={hotspots}
          onSelectEvent={setSelectedEventId}
          timelineSlot={
            viewMode === "match" && selectedMatchSummary ? (
              <TimelineControls
                compact
                currentTimeMs={playback.currentTimeMs}
                durationMs={matchData?.durationMs ?? 0}
                isPlaying={playback.isPlaying}
                speed={playback.speed}
                disabled={!matchData}
                eventTimes={filteredEventTimeline}
                onSeek={playback.seek}
                onStepPrevious={() => playback.stepToBoundary("previous")}
                onTogglePlayback={playback.toggle}
                onStepNext={() => playback.stepToBoundary("next")}
                onSpeedChange={playback.setSpeed}
              />
            ) : null
          }
        />
      </div>

      <DetailsPanel
        manifest={manifest}
        selectedMap={selectedMap}
        selectedDateId={selectedDateId}
        selectedMetric={selectedMetric}
        selectedMatchSummary={selectedMatchSummary}
        selectedEvent={selectedEvent}
        aggregateData={aggregateData}
        hotspots={hotspots}
        viewMode={viewMode}
        nextEvent={nextVisibleEvent}
        selectedPlayerType={selectedPlayerType}
        visiblePopulationCount={filteredPopulationCount}
        visibleMarkerCount={filteredEventPoints.length}
        activeControlTab={activeControlTab}
        inspectorSyncKey={inspectorSyncKey}
        showHeatmap={showHeatmap}
      />
    </>
  );
}
