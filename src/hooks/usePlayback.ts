import { useEffect, useRef, useState } from "react";

import { clamp } from "../lib/format";

interface PlaybackOptions {
  durationMs: number;
  eventTimes: number[];
}

export function usePlayback({ durationMs, eventTimes }: PlaybackOptions) {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentTimeMs((current) => clamp(current, 0, durationMs));
    if (durationMs <= 0) {
      setIsPlaying(false);
    }
  }, [durationMs]);

  useEffect(() => {
    if (!isPlaying || durationMs <= 0) {
      return;
    }

    let previousTime = performance.now();

    const tick = (now: number) => {
      const delta = now - previousTime;
      previousTime = now;

      setCurrentTimeMs((current) => {
        const next = current + delta * speed;
        if (next >= durationMs) {
          setIsPlaying(false);
          return durationMs;
        }

        return next;
      });

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
    };
  }, [durationMs, isPlaying, speed]);

  const reset = () => {
    setIsPlaying(false);
    setCurrentTimeMs(0);
  };

  const seek = (nextTimeMs: number) => {
    setCurrentTimeMs(clamp(nextTimeMs, 0, durationMs));
  };

  const toggle = () => {
    if (durationMs <= 0) {
      return;
    }

    setIsPlaying((current) => {
      if (!current && currentTimeMs >= durationMs) {
        setCurrentTimeMs(0);
      }

      return !current;
    });
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const stepToBoundary = (direction: "next" | "previous") => {
    if (eventTimes.length === 0) {
      return;
    }

    setIsPlaying(false);

    if (direction === "next") {
      const nextBoundary = eventTimes.find((time) => time > currentTimeMs + 1);
      seek(nextBoundary ?? durationMs);
      return;
    }

    const reversed = [...eventTimes].reverse();
    const previousBoundary = reversed.find((time) => time < currentTimeMs - 1);
    seek(previousBoundary ?? 0);
  };

  return {
    currentTimeMs,
    isPlaying,
    speed,
    pause,
    reset,
    seek,
    setSpeed,
    stepToBoundary,
    toggle,
  };
}
