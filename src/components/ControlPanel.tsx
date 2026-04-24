import { useMemo } from "react";

import { dateLabelFromId, formatDurationMs, formatNumber, shortMatchId } from "../lib/format";
import { DateSummary, EventVisibility, MapSummary, MatchSummary, MetricId, MetricSummary, PlayerFilter, ViewMode } from "../types";

interface ControlPanelProps {
  maps: MapSummary[];
  dates: DateSummary[];
  metrics: MetricSummary[];
  filteredMatches: MatchSummary[];
  selectedMapId: string;
  selectedDateId: string;
  selectedMetricId: MetricId;
  selectedMatchId: string | null;
  selectedPlayerType: PlayerFilter;
  showHeatmap: boolean;
  viewMode: ViewMode;
  eventVisibility: EventVisibility;
  activeTab: ControlTab;
  onMapChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onMetricChange: (value: MetricId) => void;
  onMatchChange: (value: string) => void;
  onPlayerTypeChange: (value: PlayerFilter) => void;
  onShowHeatmapChange: (value: boolean) => void;
  onViewModeChange: (value: ViewMode) => void;
  onSetVisibleEvents: (eventIds: string[]) => void;
  onActiveTabChange: (tab: ControlTab) => void;
}

export type ControlTab = "scope" | "signal" | "match";

interface SignalFocusOption {
  id: string;
  label: string;
  eventIds: string[];
}

function quickSlice(matches: MatchSummary[], selectedMatchId: string | null) {
  if (matches.length <= 4) {
    return matches;
  }

  const selectedIndex = Math.max(0, selectedMatchId ? matches.findIndex((match) => match.matchId === selectedMatchId) : 0);
  const start = Math.min(Math.max(selectedIndex - 1, 0), Math.max(matches.length - 4, 0));
  return matches.slice(start, start + 4);
}

function compactDateLabel(dateId: string, dates: DateSummary[]) {
  return dateLabelFromId(dateId, dates).replace("February", "Feb").replace(", 2026", "");
}

function signalFocusOptions(metricId: MetricId): SignalFocusOption[] {
  switch (metricId) {
    case "traffic":
      return [
        { id: "traffic-all", label: "All routes", eventIds: ["Position", "BotPosition"] },
        { id: "traffic-human", label: "Human routes", eventIds: ["Position"] },
        { id: "traffic-bot", label: "Bot routes", eventIds: ["BotPosition"] },
      ];
    case "kills":
      return [
        { id: "kills-all", label: "All combat", eventIds: ["Kill", "Killed", "BotKill", "BotKilled"] },
        { id: "kills-dealt", label: "Kills dealt", eventIds: ["Kill", "BotKill"] },
        { id: "kills-taken", label: "Deaths taken", eventIds: ["Killed", "BotKilled"] },
      ];
    case "deaths":
      return [
        { id: "deaths-all", label: "All deaths", eventIds: ["Killed", "BotKilled", "KilledByStorm"] },
        { id: "deaths-player", label: "Player deaths", eventIds: ["Killed", "BotKilled"] },
        { id: "deaths-storm", label: "Storm only", eventIds: ["KilledByStorm"] },
      ];
    case "loot":
      return [{ id: "loot-only", label: "Loot only", eventIds: ["Loot"] }];
    default:
      return [];
  }
}

export function ControlPanel({
  maps,
  dates,
  metrics,
  filteredMatches,
  selectedMapId,
  selectedDateId,
  selectedMetricId,
  selectedMatchId,
  selectedPlayerType,
  showHeatmap,
  viewMode,
  eventVisibility,
  activeTab,
  onMapChange,
  onDateChange,
  onMetricChange,
  onMatchChange,
  onPlayerTypeChange,
  onShowHeatmapChange,
  onViewModeChange,
  onSetVisibleEvents,
  onActiveTabChange,
}: ControlPanelProps) {
  const selectedMatch = filteredMatches.find((match) => match.matchId === selectedMatchId) ?? null;
  const selectedMatchIndex = Math.max(0, selectedMatchId ? filteredMatches.findIndex((match) => match.matchId === selectedMatchId) : 0);
  const quickMatches = useMemo(() => quickSlice(filteredMatches, selectedMatchId), [filteredMatches, selectedMatchId]);
  const currentMetric = metrics.find((metric) => metric.id === selectedMetricId) ?? null;
  const currentSignalOptions = signalFocusOptions(selectedMetricId);
  const activeEventIds = Object.entries(eventVisibility)
    .filter(([, isVisible]) => isVisible)
    .map(([eventId]) => eventId)
    .sort()
    .join("|");

  const goToMatch = (nextIndex: number) => {
    const nextMatch = filteredMatches[nextIndex];
    if (nextMatch) {
      onMatchChange(nextMatch.matchId);
    }
  };

  return (
    <aside className="panel control-panel control-dock">
      <div className="panel-header dock-header">
        <div>
          <p className="eyebrow">LILA APM</p>
          <h2>Review Scope</h2>
        </div>
        <div className="dock-meta-chip">
          <strong>{formatNumber(filteredMatches.length)}</strong>
          <span>matches</span>
        </div>
      </div>

      <section className="panel-section dock-tabs-section">
        <div className="dock-tabs">
          <button type="button" className={activeTab === "scope" ? "is-active" : ""} onClick={() => onActiveTabChange("scope")}>
            Scope
          </button>
          <button type="button" className={activeTab === "signal" ? "is-active" : ""} onClick={() => onActiveTabChange("signal")}>
            Signal
          </button>
          <button type="button" className={activeTab === "match" ? "is-active" : ""} onClick={() => onActiveTabChange("match")}>
            Match
          </button>
        </div>
      </section>

      {activeTab === "scope" ? (
        <section className="panel-section dock-panel compact-dock-panel">
          <article className="focus-card tight">
            <span className="brief-label">Current scope</span>
            <strong>
              {maps.find((map) => map.id === selectedMapId)?.label ?? "No map"} -{" "}
              {selectedDateId === "all" ? "All days" : dateLabelFromId(selectedDateId, dates)}
            </strong>
            <p>Choose the map, date slice, and review mode before interpreting the routes on the stage.</p>
          </article>

          <div className="button-field">
            <span>Map</span>
            <div className="button-grid three-up">
              {maps.map((map) => (
                <button
                  key={map.id}
                  type="button"
                  className={`option-button ${selectedMapId === map.id ? "is-active" : ""}`}
                  onClick={() => onMapChange(map.id)}
                >
                  {map.label}
                </button>
              ))}
            </div>
          </div>

          <div className="button-field">
            <span>Date</span>
            <div className="button-grid two-up">
              <button
                type="button"
                className={`option-button ${selectedDateId === "all" ? "is-active" : ""}`}
                onClick={() => onDateChange("all")}
              >
                All days
              </button>
              {dates.map((date) => (
                <button
                  key={date.id}
                  type="button"
                  className={`option-button ${selectedDateId === date.id ? "is-active" : ""}`}
                  onClick={() => onDateChange(date.id)}
                >
                  {compactDateLabel(date.id, dates)}
                </button>
              ))}
            </div>
          </div>

          <div className="button-field">
            <span>View</span>
            <div className="button-grid two-up">
              <button
                type="button"
                className={`option-button ${viewMode === "overview" ? "is-active" : ""}`}
                onClick={() => onViewModeChange("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`option-button ${viewMode === "match" ? "is-active" : ""}`}
                onClick={() => onViewModeChange("match")}
              >
                Playback
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "signal" ? (
        <section className="panel-section dock-panel compact-dock-panel">
          <article className="focus-card tight">
            <span className="brief-label">Active signal</span>
            <strong>{currentMetric?.label ?? "Signal"}</strong>
            <p>Keep this rail tight: choose the lens first, then narrow the playback view only if it helps the review.</p>
          </article>

          <div className="button-field">
            <span>Metric</span>
            <div className="button-grid two-up">
              {metrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  className={`option-button ${selectedMetricId === metric.id ? "is-active" : ""}`}
                  onClick={() => onMetricChange(metric.id)}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          <div className="button-field">
            <span>Map layer</span>
            <div className="button-grid two-up">
              <button
                type="button"
                className={`option-button ${showHeatmap ? "is-active" : ""}`}
                onClick={() => onShowHeatmapChange(true)}
              >
                Heatmap
              </button>
              <button
                type="button"
                className={`option-button ${!showHeatmap ? "is-active" : ""}`}
                onClick={() => onShowHeatmapChange(false)}
              >
                Markers only
              </button>
            </div>
          </div>

          {viewMode === "match" ? (
            <>
              <div className="button-field">
                <span>Population</span>
                <div className="button-grid three-up">
                  <button
                    type="button"
                    className={`option-button ${selectedPlayerType === "all" ? "is-active" : ""}`}
                    onClick={() => onPlayerTypeChange("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`option-button ${selectedPlayerType === "humans" ? "is-active" : ""}`}
                    onClick={() => onPlayerTypeChange("humans")}
                  >
                    Humans
                  </button>
                  <button
                    type="button"
                    className={`option-button ${selectedPlayerType === "bots" ? "is-active" : ""}`}
                    onClick={() => onPlayerTypeChange("bots")}
                  >
                    Bots
                  </button>
                </div>
              </div>

              {currentSignalOptions.length > 0 ? (
                <div className="button-field">
                  <span>Playback focus</span>
                  <div className={`button-grid ${currentSignalOptions.length === 3 ? "three-up" : "two-up"}`}>
                    {currentSignalOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option-button ${
                          activeEventIds === [...option.eventIds].sort().join("|") ? "is-active" : ""
                        }`}
                        onClick={() => onSetVisibleEvents(option.eventIds)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <article className="focus-card subtle-card">
              <span className="brief-label">Overview mode</span>
              <strong>Signal filters are simplified here.</strong>
              <p>Overview compares scoped hotspots by metric. Detailed event filters appear only in playback, where they stay truthful to the loaded match data.</p>
            </article>
          )}
        </section>
      ) : null}

      {activeTab === "match" ? (
        <section className="panel-section dock-panel compact-dock-panel">
          <article className="focus-card tight">
            <span className="brief-label">Current match</span>
            <strong>{selectedMatch ? shortMatchId(selectedMatch.matchId) : "No match selected"}</strong>
            <p>
              {selectedMatch
                ? `${dateLabelFromId(selectedMatch.primaryDate, dates)} - ${formatDurationMs(selectedMatch.durationMs)}`
                : "Switch to playback when you want to inspect a specific match."}
            </p>
          </article>

          <div className="button-grid three-up">
            <button
              type="button"
              className="option-button"
              onClick={() => goToMatch(Math.max(selectedMatchIndex - 1, 0))}
              disabled={filteredMatches.length === 0 || selectedMatchIndex <= 0}
            >
              Prev
            </button>
            <button
              type="button"
              className={`option-button ${viewMode === "match" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("match")}
            >
              Playback
            </button>
            <button
              type="button"
              className="option-button"
              onClick={() => goToMatch(Math.min(selectedMatchIndex + 1, filteredMatches.length - 1))}
              disabled={filteredMatches.length === 0 || selectedMatchIndex >= filteredMatches.length - 1}
            >
              Next
            </button>
          </div>

          {quickMatches.length > 0 ? (
            <div className="quick-match-grid">
              {quickMatches.map((match) => (
                <button
                  key={match.matchId}
                  type="button"
                  className={`quick-match-button ${selectedMatchId === match.matchId ? "is-active" : ""}`}
                  onClick={() => onMatchChange(match.matchId)}
                >
                  <strong>{shortMatchId(match.matchId)}</strong>
                  <small>
                    {match.humans}H / {match.bots}B - {formatDurationMs(match.durationMs)}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-list">No matches fit the current map and date scope.</div>
          )}
        </section>
      ) : null}
    </aside>
  );
}
