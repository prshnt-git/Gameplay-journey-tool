export const EVENT_COLORS: Record<string, string> = {
  Position: "#6cf3ff",
  BotPosition: "#ffb96d",
  Kill: "#ff6678",
  Killed: "#ff9365",
  BotKill: "#f24d63",
  BotKilled: "#ffbc7a",
  KilledByStorm: "#7bb5ff",
  Loot: "#8dff8f",
};

export const HUMAN_TRAIL = "#75f7ff";
export const BOT_TRAIL = "#ffb46e";
export const SURFACE_GRID = "#1d2a38";

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
