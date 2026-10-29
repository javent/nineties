import { CATEGORY_BY_ID, WORLD } from "../config.js";
import { LAB_BY_ID } from "../data/labs.js";
import { MEDIA } from "../data/milestones.js";
import { STATIONS } from "../journey.js";
import { arenaWordmark, markFor } from "./marks.js";

const SVGNS = "http://www.w3.org/2000/svg";

export const CARD_AHEAD = 23;
const FOCUS_RANGE = 10;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;

const BOLT = `<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M6.1 0 0 7h3.3L2.9 12 10 4.6H6.1L6.1 0Z"/></svg>`;
const EXPAND = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8.4 1.6h4v4M12.4 1.6 8.2 5.8M5.6 12.4h-4v-4M1.6 12.4l4.2-4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW = `&#8599;`;
const SHARE = `<svg viewBox="0 0 12 12" aria-hidden="true" style="width:10px;height:10px;stroke:currentColor;fill:none;stroke-width:1.3"><path d="M6 8V1.4M3.6 3.6 6 1.2l2.4 2.4M1.6 7.6v3h8.8v-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function fmtDate(iso) {
  return new Date(iso + "T00:00:00Z")
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

export function createWorldLayer(stage, ctx) {
  const layer = document.getElementById("world-layer");
  const leaders = document.getElementById("leaders");

  // ─────────────────────── horizon wordmark ───────────────────────
  const horizon = document.createElement("div");
  horizon.id = "horizon-mark";
  horizon.innerHTML = arenaWordmark();
  layer.appendChild(horizon);

  // ─────────────────────── lab chips ───────────────────────
  const chips = new Map();
  function chipFor(id) {
    if (!chips.has(id)) {
      const lab = LAB_BY_ID[id];
      const n = document.createElement("div");
      n.className = "anchored chip mono";
      n.innerHTML = `<span class="chip-mark">${markFor(id)}</span>
        <span class="chip-body"><b>${lab.name}</b><span data-rank></span></span>`;
      layer.appendChild(n);
      const line = document.createElementNS(SVGNS, "path");
      line.setAttribute("stroke", "#fbfaf6");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("fill", "none");
      leaders.appendChild(line);
      chips.set(id, { node: n, line, rank: n.querySelector("[data-rank]") });
    }
    return chips.get(id);
  }

  // ─────────────────────── station cards ───────────────────────
  let cardNo = 0;
const cards = STATIONS.map((s) => {
    const cat = CATEGORY_BY_ID[s.category];
    const node = document.createElement("div");
    node.className = "anchored";
    if (s.chapter) {
      node.innerHTML = `<div class="chapter-card">${s.lead} <em>${s.emph}</em></div>`;
    } else {
      const lab = LAB_BY_ID[s.lab];
      const no = ++cardNo;
      node.innerHTML = `<div class="milestone-card" style="--accent:${cat.color}">
        <button class="mc-expand" aria-label="Expand">${EXPAND}</button>
        <div class="mc-meta">
          <span class="mc-cat">${cat.label}</span>
          <span class="mc-badge">${BOLT} Milestone #${no}</span>
          <span class="mc-date">${fmtDate(s.date)}</span>
          <span class="mc-title">${s.title.join("\n")}</span>
          ${s.note ? `<span class="mc-note">${s.note}</span>` : ""}
          <button class="mc-link">${s.cta} ${ARROW}</button>
          <button class="mc-share">Share milestone ${SHARE}<i class="mc-dot"></i></button>
        </div>
        <div class="mc-media"><img src="${MEDIA[s.media]}" alt="${lab ? lab.name + " — " : ""}${s.title.join(" ")}" loading="lazy" decoding="async" /></div>
      </div>`;
    }
    layer.appendChild(node);
    // nudge alternate cards off the centre line so they don't stack up
    const lateral = s.chapter ? 1.6 : (s.index % 2 === 0 ? -2.6 : 2.2);
    return { station: s, node, lateral, focus: 0 };
  });

  layer.querySelectorAll(".mc-expand, .mc-link").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      ctx.openSheet();
    }),
  );

  // ─────────────────────── per-frame update ───────────────────────
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;

  function updateChips(labs, travel, category, slabTopY, reveal, lift = 0) {
    const seen = new Set();
    for (const l of labs) {
      const c = chipFor(l.lab);
      seen.add(l.lab);
      const ahead = -l.z - travel;
      if (l.hidden || ahead < 5 || ahead > 200 || reveal <= 0.01) {
        c.node.style.opacity = "0";
        c.line.setAttribute("opacity", "0");
        continue;
      }
      const p = stage.project(l.x, slabTopY, l.z);
      if (!p.visible) {
        c.node.style.opacity = "0";
        c.line.setAttribute("opacity", "0");
        continue;
      }
      const k = clamp(52 / ahead, 0.3, 1.1) * (1 - lift * 0.55);
      let cx = p.x + 54 * k;
      let cy = p.y - 108 * k;

      const w = c.node.offsetWidth || 150;
      const h = c.node.offsetHeight || 36;
      cx = clamp(cx, 14, vw() - w - 14);
      cy = clamp(cy, vh() * (0.43 - 0.33 * lift), vh() - 132);

      const fade = clamp((200 - ahead) / 70, 0, 1) * clamp((ahead - 5) / 12, 0, 1) * (l.opacity ?? 1) * reveal;
      c.node.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      c.node.style.opacity = String(fade);
      c.node.style.zIndex = String(820 - Math.round(ahead));
      c.rank.textContent = `${category.label} RANKING: ${Math.max(1, Math.round(l.rank))}`;

      // elbowed leader line, like the mocks
      const ex = cx + 6;
      const ey = cy + h;
      c.line.setAttribute("d", `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      c.line.setAttribute("opacity", String(fade * 0.85));
    }
    for (const [id, c] of chips) {
      if (!seen.has(id)) {
        c.node.style.opacity = "0";
        c.line.setAttribute("opacity", "0");
      }
    }
  }

  function updateCards(travel, camY, reveal, lift = 0) {
    for (const card of cards) {
      const s = card.station;
      const anchorZ = -(s.t + CARD_AHEAD);
      const anchorY = 13.4;
      const dz = -anchorZ - travel; // distance ahead of the camera
      const focus = smooth(1 - clamp(Math.abs(travel - s.t) / FOCUS_RANGE, 0, 1));
      card.focus = focus;

      // a card lives from far away until shortly after the camera passes it
      const past = travel - s.t;
      const passOut = 1 - clamp((past - FOCUS_RANGE) / 9, 0, 1);
      if (dz < 4 || dz > 230 || passOut <= 0.01 || reveal <= 0.01) {
        card.node.style.opacity = "0";
        continue;
      }

      const p = stage.project(card.lateral, anchorY, anchorZ);
      const dist = Math.max(6, Math.hypot(card.lateral - 0, anchorY - camY, dz));
      const scale3d = clamp(CARD_AHEAD / dist, 0.06, 1);

      const dockX = vw() * (s.chapter ? 0.53 : 0.5);
      const dockY = vh() * (s.chapter ? 0.225 : 0.252);

      const x = lerp(p.visible ? p.x : dockX, dockX, focus);
      const y = lerp(p.visible ? p.y : dockY, dockY, focus);
      const scale = lerp(scale3d, 1, focus);

      let op = clamp((230 - dz) / 90, 0, 1);
      op = Math.max(op, focus) * passOut * reveal * (1 - lift * (1 - focus) * 0.96);
      const blur = clamp((1 - scale) * 2.6, 0, 2.4) * (1 - focus);

      card.node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
      card.node.style.opacity = String(op);
      card.node.style.filter = blur > 0.06 ? `blur(${blur.toFixed(2)}px)` : "none";
      card.node.style.zIndex = String(Math.round(400 - dz) + (focus > 0.5 ? 300 : 0));
      card.node.style.pointerEvents = focus > 0.85 ? "auto" : "none";
    }
  }

  function updateHorizon(opacity, camY) {
    if (opacity <= 0.01) {
      horizon.style.opacity = "0";
      return;
    }
    const p = stage.project(0, camY, -99999);
    horizon.style.opacity = String(opacity);
    horizon.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y - 6).toFixed(1)}px, 0)`;
  }

  function resize() {
    leaders.setAttribute("viewBox", `0 0 ${vw()} ${vh()}`);
  }
  window.addEventListener("resize", resize);
  resize();

  return { updateChips, updateCards, updateHorizon, cards, layer };
}
