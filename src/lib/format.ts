import { DateSummary, MatchSummary } from "../types";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDurationMs(value: number): string {
  if (value < 1000) {
    return `${value.toFixed(0)} ms`;
  }

  return `${(value / 1000).toFixed(3)} s`;
}

export function formatTimelineLabel(value: number): string {
  return `T+${(value / 1000).toFixed(3)}s`;
}

export function dateLabelFromId(dateId: string, dates: DateSummary[]): string {
  return dates.find((date) => date.id === dateId)?.label ?? dateId.replace("_", " ");
}

export function shortMatchId(matchId: string): string {
  return matchId.length <= 24 ? matchId : `${matchId.slice(0, 8)}...${matchId.slice(-10)}`;
}

export function formatEventName(eventName: string): string {
  return eventName.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function matchOptionLabel(match: MatchSummary, dates: DateSummary[]): string {
  const dateLabel = dateLabelFromId(match.primaryDate, dates);
  return `${shortMatchId(match.matchId)} | ${dateLabel} | ${match.humans}H/${match.bots}B`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pluralize(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}
