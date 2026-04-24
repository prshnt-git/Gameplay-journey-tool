export type MetricId = "traffic" | "kills" | "deaths" | "loot";
export type PlayerFilter = "all" | "humans" | "bots";
export type ViewMode = "match" | "overview";

export interface ProjectionConfig {
  originX: number;
  originZ: number;
  scale: number;
}

export interface HotspotCell {
  value: number;
  pixelX: number;
  pixelY: number;
}

export interface MapSummary {
  id: string;
  label: string;
  image: string;
  width: number;
  height: number;
  projection: ProjectionConfig;
  matchCount: number;
  fileCount: number;
  rowCount: number;
  eventCounts: Record<string, number>;
  aggregatePaths: Record<string, string>;
  highlights: Record<string, Record<MetricId, HotspotCell[]>>;
}

export interface DateSummary {
  id: string;
  label: string;
  fileCount: number;
  rowCount: number;
  matchCount: number;
}

export interface DatasetStats {
  totalFiles: number;
  totalRows: number;
  uniqueAgents: number;
  uniqueHumanPlayers: number;
  uniqueBots: number;
  uniqueMatches: number;
  humanFiles: number;
  botFiles: number;
  botOnlyMatches: number;
  eventCounts: Record<string, number>;
  matchDurationMs: {
    min: number;
    max: number;
    average: number;
    median: number;
  };
  eventDensity: {
    average: number;
    median: number;
  };
  coordinateProjection: {
    appMapSize: number;
    heatmapGridSize: number;
    allPointsInBounds: boolean;
  };
}

export interface MetricSummary {
  id: MetricId;
  label: string;
  description: string;
  color: string;
}

export interface EventTypeSummary {
  id: string;
  label: string;
  category: string;
  description: string;
}

export interface MatchSummary {
  matchId: string;
  mapId: string;
  dates: string[];
  primaryDate: string;
  durationMs: number;
  humans: number;
  bots: number;
  participantCount: number;
  rowCount: number;
  eventCount: number;
  eventCounts: Record<string, number>;
  dataPath: string;
}

export interface Manifest {
  generatedAt: string;
  datasetName: string;
  defaultMatchId: string | null;
  maps: MapSummary[];
  dates: DateSummary[];
  stats: DatasetStats;
  metrics: MetricSummary[];
  eventTypes: EventTypeSummary[];
  matches: MatchSummary[];
}

export interface ParticipantSummary {
  userId: string;
  isBot: boolean;
  rowCount: number;
  eventCounts: Record<string, number>;
}

export interface TrackPoint {
  userId: string;
  isBot: boolean;
  dateId: string;
  event: string;
  timeMs: number;
  relativeTimeMs: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  pixelX: number;
  pixelY: number;
}

export interface PointEvent extends TrackPoint {
  id: string;
}

export interface MatchData {
  matchId: string;
  mapId: string;
  dates: string[];
  primaryDate: string;
  durationMs: number;
  startTimeMs: number;
  endTimeMs: number;
  humans: number;
  bots: number;
  participantCount: number;
  rowCount: number;
  eventCounts: Record<string, number>;
  participants: ParticipantSummary[];
  trackPoints: TrackPoint[];
  eventPoints: PointEvent[];
}

export interface AggregateMetric {
  label: string;
  color: string;
  maxValue: number;
  sampleCount: number;
  bins: number[][];
}

export interface AggregatePayload {
  mapId: string;
  scopeId: string;
  gridSize: number;
  metrics: Record<MetricId, AggregateMetric>;
}

export type EventVisibility = Record<string, boolean>;
