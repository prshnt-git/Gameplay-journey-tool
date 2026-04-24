import { useState } from "react";

import { formatTimelineLabel } from "../lib/format";

interface TimelineControlsProps {
  compact?: boolean;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  speed: number;
  disabled: boolean;
  eventTimes: number[];
  onSeek: (timeMs: number) => void;
  onStepPrevious: () => void;
  onTogglePlayback: () => void;
  onStepNext: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export function TimelineControls({
  compact = false,
  currentTimeMs,
  durationMs,
  isPlaying,
  speed,
  disabled,
  eventTimes,
  onSeek,
  onStepPrevious,
  onTogglePlayback,
  onStepNext,
  onSpeedChange,
}: TimelineControlsProps) {
  const normalizedDuration = Math.max(durationMs, 1);
  const isAtEnd = currentTimeMs >= durationMs && durationMs > 0;
  const playLabel = isPlaying ? "Pause" : isAtEnd ? "Replay" : "Play";
  const [showTools, setShowTools] = useState(false);

  if (compact) {
    return (
      <section className={`panel timeline-panel is-compact ${disabled ? "is-disabled" : ""}`}>
        <div className="timeline-inline">
          <button type="button" className="primary-button timeline-play-button" onClick={onTogglePlayback} disabled={disabled}>
            {playLabel}
          </button>

          <div className="timeline-track-wrap">
            <input
              className="timeline-slider"
              type="range"
              min={0}
              max={normalizedDuration}
              value={Math.min(currentTimeMs, normalizedDuration)}
              onChange={(event) => onSeek(Number(event.currentTarget.value))}
              disabled={disabled}
            />

            <div className="timeline-markers" aria-hidden="true">
              {eventTimes.map((timeMs, index) => (
                <span
                  key={`${timeMs}-${index}`}
                  className="timeline-marker"
                  style={{ left: `${(timeMs / normalizedDuration) * 100}%` }}
                />
              ))}
            </div>
          </div>

          <div className="timeline-inline-meta">
            <span className="timeline-inline-label">Playback</span>
            <div className="timeline-readout">
              <span>{formatTimelineLabel(currentTimeMs)}</span>
              <span>{formatTimelineLabel(durationMs)}</span>
            </div>
          </div>

          <button
            type="button"
            className={`ghost-button timeline-tools-toggle ${showTools ? "is-active" : ""}`}
            onClick={() => setShowTools((current) => !current)}
            aria-expanded={showTools}
            disabled={disabled}
          >
            Tools
          </button>
        </div>

        {showTools ? (
          <div className="timeline-tools-popover">
            <div className="timeline-secondary-actions">
              <button type="button" className="ghost-button" onClick={onStepPrevious} disabled={disabled}>
                Prev
              </button>
              <button type="button" className="ghost-button" onClick={onStepNext} disabled={disabled}>
                Next
              </button>
            </div>

            <div className="timeline-secondary-copy">
              <span>{eventTimes.length} markers</span>
              <span>Use stepping and speed only for closer inspection.</span>
            </div>

            <div className="speed-switch">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`speed-chip ${speed === option ? "is-active" : ""}`}
                  onClick={() => onSpeedChange(option)}
                  disabled={disabled}
                >
                  {option}x
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={`panel timeline-panel ${disabled ? "is-disabled" : ""}`}>
      <div className="timeline-headline">
        <div className="timeline-mini-label">
          <strong>Playback</strong>
          <span>Use the scrubber to reconstruct the selected match.</span>
        </div>

        <div className="timeline-readout">
          <span>{formatTimelineLabel(currentTimeMs)}</span>
          <span>{formatTimelineLabel(durationMs)}</span>
        </div>
      </div>

      <div className="timeline-track-wrap">
        <input
          className="timeline-slider"
          type="range"
          min={0}
          max={normalizedDuration}
          value={Math.min(currentTimeMs, normalizedDuration)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          disabled={disabled}
        />

        <div className="timeline-markers" aria-hidden="true">
          {eventTimes.map((timeMs, index) => (
            <span
              key={`${timeMs}-${index}`}
              className="timeline-marker"
              style={{ left: `${(timeMs / normalizedDuration) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="timeline-controls">
        <div className="timeline-buttons">
          <button type="button" className="ghost-button" onClick={onStepPrevious} disabled={disabled}>
            Prev
          </button>
          <button type="button" className="primary-button" onClick={onTogglePlayback} disabled={disabled}>
            {playLabel}
          </button>
          <button type="button" className="ghost-button" onClick={onStepNext} disabled={disabled}>
            Next
          </button>
        </div>

        <div className="speed-switch">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`speed-chip ${speed === option ? "is-active" : ""}`}
              onClick={() => onSpeedChange(option)}
              disabled={disabled}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
