/**
 * Labs that race down the corridor.
 *
 * NOTE: the rankings and milestones in this folder are illustrative sample
 * content built to match the design mocks — swap `rankSeries` / `MILESTONES`
 * for a real Arena leaderboard feed when wiring this up for production.
 */

export const LABS = [
  { id: "openai", name: "OPEN AI", mark: "openai" },
  { id: "anthropic", name: "ANTHROPIC", mark: "anthropic" },
  { id: "google", name: "GOOGLE", mark: "google" },
  { id: "moonshot", name: "MOONSHOT AI", mark: "moonshot" },
  { id: "xai", name: "XAI", mark: "xai" },
  { id: "deepseek", name: "DEEPSEEK", mark: "deepseek" },
  { id: "meta", name: "META", mark: "meta" },
  { id: "mistral", name: "MISTRAL", mark: "mistral" },
];

export const LAB_BY_ID = Object.fromEntries(LABS.map((l) => [l.id, l]));

/** Lateral lane offsets (in lane units) keyed by lab, so slabs never overlap. */
export const LANES = {
  openai: 0,
  anthropic: 1,
  moonshot: -1,
  google: 1.9,
  xai: -1.9,
  deepseek: 2.8,
  meta: -2.8,
  mistral: 3.7,
};

const O = "openai";
const A = "anthropic";
const G = "google";
const M = "moonshot";
const X = "xai";
const D = "deepseek";
const E = "meta";
const S = "mistral";

/**
 * Snapshots of leaderboard order per category. Ranks are interpolated between
 * snapshots so slabs glide past each other as the year scrolls by.
 */
export const RANK_SERIES = {
  text: [
    { date: "2026-01-01", order: [G, O, A, X, D, M, E, S] },
    { date: "2026-03-10", order: [O, G, A, D, X, M, E, S] },
    { date: "2026-06-02", order: [A, O, G, D, M, X, E, S] },
    { date: "2026-09-14", order: [G, A, O, M, D, X, S, E] },
    { date: "2026-12-31", order: [A, G, O, D, M, X, S, E] },
  ],
  image: [
    { date: "2026-01-01", order: [G, O, X, E, D, A, M, S] },
    { date: "2026-04-21", order: [O, G, X, D, E, M, A, S] },
    { date: "2026-08-05", order: [X, O, G, M, D, E, S, A] },
    { date: "2026-12-31", order: [G, X, O, D, M, E, S, A] },
  ],
  code: [
    { date: "2026-01-01", order: [A, O, G, D, M, X, S, E] },
    { date: "2026-05-12", order: [A, G, O, M, D, S, X, E] },
    { date: "2026-09-03", order: [A, O, M, G, D, S, X, E] },
    { date: "2026-12-31", order: [O, A, M, G, D, S, X, E] },
  ],
  video: [
    { date: "2026-01-01", order: [G, O, X, E, M, D, S, A] },
    { date: "2026-06-18", order: [O, G, M, X, E, D, S, A] },
    { date: "2026-10-02", order: [G, O, M, X, D, E, S, A] },
    { date: "2026-12-31", order: [O, G, X, M, D, E, S, A] },
  ],
  agent: [
    { date: "2026-01-01", order: [A, O, G, M, D, X, S, E] },
    { date: "2026-05-19", order: [O, A, M, G, D, X, S, E] },
    { date: "2026-08-24", order: [O, M, A, G, D, X, S, E] },
    { date: "2026-09-03", order: [A, O, M, G, D, X, S, E] },
    { date: "2026-11-11", order: [O, A, G, M, D, S, X, E] },
    { date: "2026-12-31", order: [A, O, G, M, S, D, X, E] },
  ],
  webdev: [
    { date: "2026-01-01", order: [A, G, O, M, D, X, S, E] },
    { date: "2026-07-07", order: [A, O, G, M, X, D, S, E] },
    { date: "2026-10-01", order: [O, A, G, M, D, X, S, E] },
    { date: "2026-10-28", order: [O, A, M, G, D, X, S, E] },
    { date: "2026-12-31", order: [O, G, A, M, D, S, X, E] },
  ],
};
