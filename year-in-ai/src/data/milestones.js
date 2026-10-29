/**
 * The scroll journey. Stations are laid out in date order; the camera travels
 * one `WORLD.unitsPerDay` per day of 2026.
 *
 * `chapter: true` stations are the big serif title cards that open a category
 * ("This was the year of agents"); everything else is a milestone card.
 *
 * Sample content, written to match the design mocks.
 */

export const MILESTONES = [
  // ───────────────────────────── TEXT ─────────────────────────────
  {
    chapter: true,
    date: "2026-01-04",
    category: "text",
    lead: "This was",
    emph: "the year of language",
  },
  {
    date: "2026-01-16",
    category: "text",
    lab: "google",
    title: ["GEMINI 3.2 ULTRA", "RETAKES #1 IN", "TEXT ARENA"],
    note: "FIRST MODEL PAST 1500 ELO",
    cta: "SEE FULL POST",
    media: "leaderboard",
  },
  {
    date: "2026-02-09",
    category: "text",
    lab: "deepseek",
    title: ["DEEPSEEK V4 OPENS", "THE TOP FIVE TO", "OPEN WEIGHTS"],
    note: "STYLE CONTROL ON",
    cta: "SEE FULL POST",
    media: "chat",
  },
  {
    date: "2026-03-05",
    category: "text",
    lab: "openai",
    title: ["GPT-5.5 SHIPS", "A 4M TOKEN", "CONTEXT WINDOW"],
    note: "LONG CONTEXT ARENA DEBUT",
    cta: "SEE FULL POST",
    media: "chat",
  },

  // ───────────────────────────── IMAGE ─────────────────────────────
  {
    chapter: true,
    date: "2026-03-22",
    category: "image",
    lead: "This was",
    emph: "the year of images",
  },
  {
    date: "2026-04-02",
    category: "image",
    lab: "google",
    title: ["IMAGEN 5 CLEARS", "THE TYPOGRAPHY", "BENCHMARK"],
    note: "99.1% LEGIBLE RENDERS",
    cta: "SEE FULL POST",
    media: "imagecompare",
  },
  {
    date: "2026-04-21",
    category: "image",
    lab: "openai",
    title: ["GPT IMAGE 2", "TAKES #1 WITH", "IN-CANVAS EDITS"],
    note: "1.4M VOTES IN 9 DAYS",
    cta: "SEE FULL POST",
    media: "imagecompare",
  },
  {
    date: "2026-05-08",
    category: "image",
    lab: "xai",
    title: ["GROK IMAGINE 3", "CLOSES THE GAP", "TO HALF A POINT"],
    note: "CLOSEST RACE OF THE YEAR",
    cta: "SEE FULL POST",
    media: "votes",
  },

  // ───────────────────────────── CODE ─────────────────────────────
  {
    chapter: true,
    date: "2026-05-24",
    category: "code",
    lead: "This was",
    emph: "the year of code",
  },
  {
    date: "2026-06-03",
    category: "code",
    lab: "anthropic",
    title: ["CLAUDE FABLE 4.5", "HOLDS CODE ARENA", "FOR 140 DAYS"],
    note: "LONGEST REIGN ON RECORD",
    cta: "SEE FULL POST",
    media: "codediff",
  },
  {
    date: "2026-06-27",
    category: "code",
    lab: "moonshot",
    title: ["KIMI K3 LANDS", "TOP THREE ON A", "PERMISSIVE LICENSE"],
    note: "OPEN WEIGHTS, 1T PARAMS",
    cta: "SEE FULL POST",
    media: "leaderboard",
  },

  // ───────────────────────────── VIDEO ─────────────────────────────
  {
    chapter: true,
    date: "2026-07-05",
    category: "video",
    lead: "This was",
    emph: "the year of video",
  },
  {
    date: "2026-07-16",
    category: "video",
    lab: "openai",
    title: ["SORA 3 BRINGS", "60 SECOND SHOTS", "WITH NATIVE AUDIO"],
    note: "FIRST SYNCED-DIALOGUE WIN",
    cta: "SEE FULL VIDEO",
    media: "videoframes",
  },
  {
    date: "2026-08-04",
    category: "video",
    lab: "google",
    title: ["VEO 4 RETAKES", "VIDEO ARENA ON", "PHYSICS SCORES"],
    note: "+38 ELO OVERNIGHT",
    cta: "SEE FULL VIDEO",
    media: "videoframes",
  },

  // ───────────────────────────── AGENT ─────────────────────────────
  {
    chapter: true,
    date: "2026-08-10",
    category: "agent",
    lead: "This was",
    emph: "the year of agents",
  },
  {
    date: "2026-08-24",
    category: "agent",
    lab: "moonshot",
    title: ["KIMI AGENT RUNS", "A 300 STEP TASK", "WITHOUT A RESET"],
    note: "NEW LONG-HORIZON RECORD",
    cta: "SEE FULL POST",
    media: "agentbooking",
  },
  {
    date: "2026-09-03",
    category: "agent",
    lab: "anthropic",
    title: ["CLAUDE FABLE 5", "TAKES #1 IN AGENT", "ARENA AND CODE", "ARENA"],
    note: "",
    cta: "SEE FULL POST",
    media: "agentbooking",
  },
  {
    date: "2026-09-21",
    category: "agent",
    lab: "openai",
    title: ["OPERATOR 2 CUTS", "TASK COST BY", "ELEVEN TIMES"],
    note: "$0.04 PER COMPLETED TASK",
    cta: "SEE FULL POST",
    media: "votes",
  },

  // ───────────────────────────── WEBDEV ─────────────────────────────
  {
    chapter: true,
    date: "2026-10-01",
    category: "webdev",
    lead: "This was",
    emph: "the year of the web",
  },
  {
    date: "2026-10-13",
    category: "webdev",
    lab: "openai",
    title: ["OPEN AI GPT 6", "ASTRA RELEASE"],
    note: "3D GENERATION\nCOMPARISON",
    cta: "SEE FULL VIDEO",
    media: "goldengate",
  },
  {
    date: "2026-11-02",
    category: "webdev",
    lab: "anthropic",
    title: ["CLAUDE OPUS 4.6", "SHIPS ONE-SHOT", "FULL-STACK APPS"],
    note: "72% FIRST-RUN PASS RATE",
    cta: "SEE FULL POST",
    media: "codediff",
  },
  {
    date: "2026-11-28",
    category: "webdev",
    lab: "moonshot",
    title: ["KIMI WEBDEV HITS", "TOP THREE ON", "OPEN WEIGHTS"],
    note: "RUNS ON TWO GPUS",
    cta: "SEE FULL POST",
    media: "leaderboard",
  },
  {
    date: "2026-12-18",
    category: "webdev",
    lab: "openai",
    title: ["TWO MILLION", "VOTES CLOSE OUT", "THE YEAR"],
    note: "THANK YOU FOR VOTING",
    cta: "SEE THE DATA",
    media: "votes",
  },
];

/** Media keys → generated screenshot assets. */
export const MEDIA = {
  leaderboard: "media/leaderboard.jpg",
  chat: "media/chat.jpg",
  imagecompare: "media/image-compare.jpg",
  codediff: "media/code-diff.jpg",
  videoframes: "media/video-frames.jpg",
  agentbooking: "media/agent-booking.jpg",
  goldengate: "media/golden-gate.jpg",
  votes: "media/votes.jpg",
};
