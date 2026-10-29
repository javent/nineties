/**
 * Global look-and-feel constants for the Year in AI 2026 fly-through.
 * Colours were sampled directly from the design mocks.
 */

export const PALETTE = {
  bg: "#1a1819",
  paper: "#fbfaf6",
  ink: "#1a1819",
  hud: "#dad9d6",
  dim: "#7b7977",
  faint: "#45423f",
};

/**
 * Every leaderboard category owns a colour. Jumping between categories tints
 * the floor grid, the followed lab slab and the timeline marker.
 */
export const CATEGORIES = [
  { id: "text", label: "TEXT", color: "#e8b33c", noun: "language" },
  { id: "image", label: "IMAGE", color: "#e04fa0", noun: "images" },
  { id: "code", label: "CODE", color: "#f2663d", noun: "code" },
  { id: "video", label: "VIDEO", color: "#9b6bf2", noun: "video" },
  { id: "agent", label: "AGENT", color: "#299bfe", noun: "agents" },
  { id: "webdev", label: "WEBDEV", color: "#41bd4b", noun: "the web" },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/** World-space tuning for the corridor. */
export const WORLD = {
  cell: 9.2, // grid cell size in world units
  followDistance: 27, // how far ahead of the camera the followed slab sits
  rankSpacing: 19, // z gap between consecutive leaderboard ranks
  laneWidth: 11.2, // lateral gap between lab lanes
  slab: { w: 7.45, h: 0.72, d: 14 },
  cameraHeight: 9.2,
  cameraLateral: 0.0,
  unitsPerDay: 1.3, // travel distance that equals one day of 2026
};

/** Scroll feel. */
export const SCROLL = {
  wheelScale: 0.075,
  touchScale: 0.12,
  keyStep: 34,
  damping: 0.085,
};

export const YEAR = 2026;
export const YEAR_START = Date.UTC(YEAR, 0, 1);
export const YEAR_END = Date.UTC(YEAR, 11, 31);
export const YEAR_DAYS = (YEAR_END - YEAR_START) / 86400000;

export function dayOfYear(iso) {
  return (Date.parse(iso + "T00:00:00Z") - YEAR_START) / 86400000;
}

export function yearProgress(iso) {
  return dayOfYear(iso) / YEAR_DAYS;
}
