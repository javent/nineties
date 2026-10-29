import { MILESTONES } from "./data/milestones.js";
import { LABS, LANES, RANK_SERIES } from "./data/labs.js";
import { WORLD, YEAR_DAYS, dayOfYear } from "./config.js";

export const INTRO = {
  title: 0,
  horizon: 46,
  stat: 104,
  gate: 152, // the year proper starts here
};
export const OUTRO = 104;

/** No two cards may dock at once, so stations get pushed apart on the travel axis. */
const MIN_GAP = 24;

const smooth = (u) => u * u * (3 - 2 * u);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ───────────────────────── station layout ─────────────────────────

export const STATIONS = MILESTONES.map((m, i) => ({
  ...m,
  index: i,
  day: dayOfYear(m.date),
  t: INTRO.gate + dayOfYear(m.date) * WORLD.unitsPerDay,
  type: m.chapter ? "chapter" : "milestone",
}));

for (let i = 1; i < STATIONS.length; i++) {
  STATIONS[i].t = Math.max(STATIONS[i].t, STATIONS[i - 1].t + MIN_GAP);
}

export const CARD_STATIONS = STATIONS.filter((s) => s.type === "milestone");
export const CHAPTERS = STATIONS.filter((s) => s.type === "chapter");

const LAST = STATIONS[STATIONS.length - 1];
export const TOTAL_TRAVEL = LAST.t + OUTRO;

/**
 * Travel distance ⇄ day of the year. Piecewise linear through every station so
 * the timeline marker lands exactly on a milestone's pip as its card docks.
 */
const ANCHORS = [
  { t: INTRO.gate, day: 0 },
  ...STATIONS.map((s) => ({ t: s.t, day: s.day })),
  { t: TOTAL_TRAVEL, day: YEAR_DAYS },
].filter((a, i, arr) => i === 0 || a.t > arr[i - 1].t);

export function dayForTravel(t) {
  if (t <= ANCHORS[0].t) return 0;
  const last = ANCHORS[ANCHORS.length - 1];
  if (t >= last.t) return last.day;
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i];
    const b = ANCHORS[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / (b.t - a.t);
      return a.day + (b.day - a.day) * u;
    }
  }
  return last.day;
}

/** 0 → 1 across the year, for the timeline ruler. */
export function dateForTravel(t) {
  return clamp(dayForTravel(t) / YEAR_DAYS, 0, 1);
}

export function travelForDate(iso) {
  const found = STATIONS.find((s) => s.date === iso);
  return found ? found.t : INTRO.gate + dayOfYear(iso) * WORLD.unitsPerDay;
}

/** Which chapter (category) owns a given travel distance. */
export function chapterAt(t) {
  let found = CHAPTERS[0];
  for (const c of CHAPTERS) if (t >= c.t - 12) found = c;
  return found;
}

export function nearestCard(t) {
  let best = CARD_STATIONS[0];
  let bestD = Infinity;
  for (const s of CARD_STATIONS) {
    const d = Math.abs(s.t - t);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function nextStation(t, dir) {
  if (dir > 0) {
    for (const s of STATIONS) if (s.t > t + 1.5) return s;
    return { t: TOTAL_TRAVEL };
  }
  for (let i = STATIONS.length - 1; i >= 0; i--) if (STATIONS[i].t < t - 1.5) return STATIONS[i];
  return { t: INTRO.title };
}

// ───────────────────────────── rankings ─────────────────────────────

const seriesCache = new Map();

function series(categoryId) {
  if (!seriesCache.has(categoryId)) {
    const snaps = (RANK_SERIES[categoryId] || RANK_SERIES.text).map((s) => ({
      day: dayOfYear(s.date),
      ranks: Object.fromEntries(s.order.map((id, i) => [id, i + 1])),
    }));
    seriesCache.set(categoryId, snaps);
  }
  return seriesCache.get(categoryId);
}

/** Smoothly interpolated rank for every lab at a point in the year. */
export function ranksAt(categoryId, day) {
  const snaps = series(categoryId);
  let a = snaps[0];
  let b = snaps[0];
  if (day >= snaps[snaps.length - 1].day) {
    a = b = snaps[snaps.length - 1];
  } else {
    for (let i = 0; i < snaps.length - 1; i++) {
      if (day >= snaps[i].day && day <= snaps[i + 1].day) {
        a = snaps[i];
        b = snaps[i + 1];
        break;
      }
    }
  }
  const span = b.day - a.day;
  const u = span > 0 ? smooth(clamp((day - a.day) / span, 0, 1)) : 0;
  const out = {};
  for (const lab of LABS) {
    const ra = a.ranks[lab.id] ?? LABS.length;
    const rb = b.ranks[lab.id] ?? LABS.length;
    out[lab.id] = ra + (rb - ra) * u;
  }
  return out;
}

/**
 * World placement of every lab slab for the current camera travel.
 * The followed lab holds the centre lane a fixed distance ahead; everyone else
 * is pushed forward or pulled back by how far their rank sits from it.
 */
export function labLayout(t, followedId, categoryId, compress = 0) {
  const ranks = ranksAt(categoryId, dayForTravel(t));
  const followedRank = ranks[followedId] ?? 1;

  // the overhead DATA view squeezes the pack together so the whole field fits
  const lead = WORLD.followDistance + 18 * compress;
  const gap = WORLD.rankSpacing * (1 - 0.6 * compress);
  const lane = WORLD.laneWidth * (1 + 0.3 * compress);

  const others = LABS.filter((l) => l.id !== followedId);
  const laneSeq = [1, -1, 1.85, -1.85, 2.7, -2.7, 3.55, -3.55];

  const out = [
    {
      lab: followedId,
      rank: followedRank,
      followed: true,
      x: (followedRank - 1) * 1.1,
      z: -(t + lead),
    },
  ];
  others.forEach((l, i) => {
    const r = ranks[l.id] ?? LABS.length;
    out.push({
      lab: l.id,
      rank: r,
      followed: false,
      x: laneSeq[i % laneSeq.length] * lane + (LANES[l.id] ?? 0) * 0.5,
      z: -(t + lead + (followedRank - r) * gap),
    });
  });
  return out;
}

/** Lateral history of the followed lab, used to draw its trail ribbon. */
export function followedTrail(t, followedId, categoryId, back = 170, steps = 46) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const tt = t - back + (back * i) / steps;
    const r = ranksAt(categoryId, dayForTravel(tt))[followedId] ?? 1;
    pts.push({ x: (r - 1) * 1.1, z: -(tt + WORLD.followDistance) });
  }
  return pts;
}
