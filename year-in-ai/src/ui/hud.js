import { CATEGORY_BY_ID, YEAR, YEAR_DAYS, dayOfYear } from "../config.js";
import { LABS, LAB_BY_ID } from "../data/labs.js";
import { CARD_STATIONS, STATIONS } from "../journey.js";
import { arenaWordmark, markFor } from "./marks.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

const BOLT = `<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M6.1 0 0 7h3.3L2.9 12 10 4.6H6.1L6.1 0Z"/></svg>`;
const BARS = `<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="0" y="6" width="2.6" height="6"/><rect x="4.7" y="2.5" width="2.6" height="9.5"/><rect x="9.4" y="0" width="2.6" height="12"/></svg>`;
const CHEV = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function monthTicks() {
  const out = [];
  for (let m = 0; m < 12; m++) {
    const iso = `${YEAR}-${String(m + 1).padStart(2, "0")}-01`;
    out.push({ iso, u: dayOfYear(iso) / YEAR_DAYS, label: `${String(m + 1).padStart(2, "0")}'01'${String(YEAR).slice(2)}`, anchor: "start" });
  }
  out.push({ iso: `${YEAR}-12-31`, u: 1, label: `12'31'${String(YEAR).slice(2)}`, anchor: "end" });
  return out;
}

export function createHud(ctx) {
  const top = document.getElementById("hud-top");
  const bottom = document.getElementById("hud-bottom");
  const radarRoot = document.getElementById("radar");
  const sheet = document.getElementById("menu-sheet");
  const scrims = document.querySelectorAll(".scrim");

  // ───────────────────────── top: timeline + nav ─────────────────────────
  top.innerHTML = `
    <div class="timeline">
      <div class="timeline-label mono">${YEAR}<br />TIMELINE</div>
      <div class="timeline-track"><svg aria-hidden="true"></svg></div>
    </div>
    <div class="nav-row">
      <button class="btn" data-nav="prev"><span>&#8592;</span> Prev. Milestone</button>
      <button class="btn" data-nav="next">Next Milestone <span>&#8594;</span></button>
    </div>`;

  const track = top.querySelector(".timeline-track");
  const tlSvg = track.querySelector("svg");
  const H = 36;

  let tlWidth = 0;
  const tlParts = {};
  let monthLabels = [];

  function buildTimeline() {
    const w = Math.max(220, track.clientWidth);
    tlWidth = w;
    tlSvg.setAttribute("viewBox", `0 0 ${w} ${H}`);
    tlSvg.innerHTML = "";
    monthLabels = [];

    tlSvg.appendChild(el("line", { class: "tl-axis", x1: 0, y1: 14, x2: w, y2: 14 }));

    // thin the month labels out so they never collide on narrow screens
    const ticks = monthTicks();
    const every = Math.max(1, Math.ceil((ticks.length * (w < 620 ? 86 : 58)) / w));
    ticks.forEach((m, i) => {
      const x = m.u * w;
      tlSvg.appendChild(el("line", { class: "tl-tick", x1: x, y1: 14, x2: x, y2: 19.5 }));
      if (i % every !== 0 && i !== ticks.length - 1) return;
      const t = el("text", { class: "tl-month", x, y: 30, "text-anchor": m.anchor });
      t.textContent = m.label;
      tlSvg.appendChild(t);
      monthLabels.push({ node: t, x, anchor: m.anchor });
    });

    // one outlined capsule per milestone
    for (const s of CARD_STATIONS) {
      const x = (dayOfYear(s.date) / YEAR_DAYS) * w;
      tlSvg.appendChild(el("rect", { class: "tl-pip", x: x - 1.6, y: 8, width: 3.2, height: 12, rx: 1.2 }));
    }

    tlParts.progress = el("line", { class: "tl-progress", x1: 0, y1: 14, x2: 0, y2: 14 });
    tlParts.head = el("rect", { class: "tl-head", x: -3, y: 8, width: 2.6, height: 12, rx: 1.3 });
    tlParts.caret = el("path", { class: "tl-head", d: "M0 0 L0 0 L0 0" });
    tlParts.catPlate = el("rect", { fill: "#1a1819", x: 0, y: 22, width: 0, height: 11 });
    tlParts.cat = el("text", { class: "tl-cat", x: 0, y: 30 });
    tlSvg.append(tlParts.progress, tlParts.head, tlParts.caret, tlParts.catPlate, tlParts.cat);
  }

  buildTimeline();
  window.addEventListener("resize", buildTimeline);

  top.querySelector('[data-nav="prev"]').addEventListener("click", () => ctx.step(-1));
  top.querySelector('[data-nav="next"]').addEventListener("click", () => ctx.step(1));

  // ───────────────────────── bottom bar ─────────────────────────
  bottom.innerHTML = `
    <div class="brand">
      <button class="brand-menu" aria-label="All milestones"><i></i><i></i><i></i></button>
      <div class="brand-text">${arenaWordmark()}<span class="brand-sub mono">Year in AI ${YEAR}</span></div>
    </div>
    <div class="modes" role="group" aria-label="View">
      <button class="mode" data-mode="milestones" aria-pressed="true">${BOLT} Milestones</button>
      <button class="mode" data-mode="data" aria-pressed="false">${BARS} Data</button>
    </div>
    <div style="width:186px" aria-hidden="true"></div>`;

  bottom.querySelector(".brand-menu").addEventListener("click", () => openSheet(true));
  bottom.querySelectorAll(".mode").forEach((b) =>
    b.addEventListener("click", () => ctx.setMode(b.dataset.mode)),
  );

  function setMode(mode) {
    bottom.querySelectorAll(".mode").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  }

  // ───────────────────────── radar ─────────────────────────
  radarRoot.innerHTML = `
    <div class="radar-dial">
      <svg viewBox="0 0 158 158">
        <defs>
          <clipPath id="radar-clip"><circle cx="79" cy="70" r="61" /></clipPath>
          <path id="radar-arc" d="M 29 54 A 55 55 0 0 1 129 54" fill="none" />
        </defs>
        <g clip-path="url(#radar-clip)" class="radar-grid-g"></g>
        <circle class="radar-ring" cx="79" cy="70" r="61" />
        <text class="radar-label"><textPath href="#radar-arc" startOffset="50%" text-anchor="middle">LAB POSITION</textPath></text>
        <g class="radar-blips"></g>
        <text class="radar-rank" x="79" y="124">NO. 1</text>
      </svg>
    </div>
    <div class="radar-following mono">
      <span>Following</span>
      <div class="follow-select">
        <button class="follow-btn" aria-haspopup="true" aria-expanded="false"><span data-follow-name>Open AI</span>${CHEV}</button>
        <div class="follow-menu" role="menu">
          ${LABS.map(
            (l) => `<button role="menuitemradio" data-lab="${l.id}">${markFor(l.id)}<span>${l.name}</span></button>`,
          ).join("")}
        </div>
      </div>
    </div>`;

  const gridG = radarRoot.querySelector(".radar-grid-g");
  for (let i = -6; i <= 6; i++) {
    gridG.appendChild(el("line", { class: "radar-grid", x1: 79 + i * 11, y1: 0, x2: 79 + i * 11, y2: 158 }));
    gridG.appendChild(el("line", { class: "radar-grid", x1: 0, y1: 70 + i * 11, x2: 158, y2: 70 + i * 11 }));
  }
  const blipsG = radarRoot.querySelector(".radar-blips");
  const rankText = radarRoot.querySelector(".radar-rank");
  const followName = radarRoot.querySelector("[data-follow-name]");
  const followBtn = radarRoot.querySelector(".follow-btn");
  const followMenu = radarRoot.querySelector(".follow-menu");

  followBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = followMenu.classList.toggle("is-open");
    followBtn.setAttribute("aria-expanded", String(open));
  });
  followMenu.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      ctx.setFollowed(b.dataset.lab);
      followMenu.classList.remove("is-open");
      followBtn.setAttribute("aria-expanded", "false");
    }),
  );
  document.addEventListener("click", () => {
    followMenu.classList.remove("is-open");
    followBtn.setAttribute("aria-expanded", "false");
  });

  const blips = new Map();
  function blipFor(id) {
    if (!blips.has(id)) {
      const r = el("rect", { width: 7, height: 7, x: -10, y: -10 });
      blipsG.appendChild(r);
      blips.set(id, r);
    }
    return blips.get(id);
  }

  // ───────────────────────── milestone index sheet ─────────────────────────
  sheet.innerHTML = `
    <div class="sheet-inner">
      <div class="sheet-head mono"><span>All milestones &middot; ${YEAR}</span>
        <button class="sheet-close mono">Close</button></div>
      <div class="sheet-list">
        ${STATIONS.map((s) => {
          const cat = CATEGORY_BY_ID[s.category];
          const label = s.chapter ? `${s.lead} ${s.emph}` : s.title.join(" ");
          const d = new Date(s.date + "T00:00:00Z");
          const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
          return `<button class="sheet-item" data-jump="${s.index}">
            <span class="si-cat" style="color:${cat.color}">${cat.label}${s.chapter ? " &middot; chapter" : ""}</span>
            <span class="si-date">${date}</span>
            <span class="si-title">${label}</span>
          </button>`;
        }).join("")}
      </div>
    </div>`;

  function openSheet(on) {
    sheet.hidden = !on;
  }
  sheet.querySelector(".sheet-close").addEventListener("click", () => openSheet(false));
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) openSheet(false);
  });
  sheet.querySelectorAll("[data-jump]").forEach((b) =>
    b.addEventListener("click", () => {
      ctx.jumpTo(STATIONS[Number(b.dataset.jump)].t);
      openSheet(false);
    }),
  );

  // ───────────────────────── live updates ─────────────────────────
  let blinkToken = 0;

  function blinkCategory() {
    tlParts.cat.classList.remove("is-blinking");
    void tlParts.cat.offsetWidth;
    tlParts.cat.classList.add("is-blinking");
    const token = ++blinkToken;
    setTimeout(() => {
      if (token === blinkToken) tlParts.cat.classList.remove("is-blinking");
    }, 1100);
  }

  function setAccent(color) {
    document.documentElement.style.setProperty("--accent", color);
  }

  function update(state) {
    const { yearU, chapterU, category, followedRank, followedId, labs, travel, visible } = state;
    top.classList.toggle("is-on", visible);
    bottom.classList.toggle("is-on", visible);
    radarRoot.classList.toggle("is-on", visible);
    scrims.forEach((n) => n.classList.toggle("is-on", visible));

    const x = yearU * tlWidth;
    const x0 = chapterU * tlWidth;
    tlParts.progress.setAttribute("x1", Math.min(x0, x));
    tlParts.progress.setAttribute("x2", x);
    tlParts.head.setAttribute("x", x - 1.5);
    tlParts.caret.setAttribute("d", `M${x - 5.5} 0.5 L${x + 5.5} 0.5 L${x} 7 Z`);
    const plateW = category.label.length * 7.6 + 12;
    const cx = Math.min(Math.max(x, plateW / 2), tlWidth - plateW / 2);
    tlParts.cat.setAttribute("x", cx);
    if (tlParts.cat.textContent !== category.label) tlParts.cat.textContent = category.label;
    tlParts.catPlate.setAttribute("x", cx - plateW / 2);
    // month labels duck out of the way of the category plate
    const pa = cx - plateW / 2 - 3;
    const pb = cx + plateW / 2 + 3;
    for (const ml of monthLabels) {
      const wLbl = 46;
      const a = ml.anchor === "end" ? ml.x - wLbl : ml.anchor === "middle" ? ml.x - wLbl / 2 : ml.x;
      const b = a + wLbl;
      ml.node.style.opacity = b > pa && a < pb ? "0" : "";
    }
    tlParts.catPlate.setAttribute("width", plateW);

    // radar blips
    const seen = new Set();
    for (const l of labs) {
      const ahead = -l.z - travel;
      const rx = 79 + (l.x / 62) * 54;
      const ry = 70 - (ahead - 27) * 0.42;
      const b = blipFor(l.lab);
      const inside = Math.hypot(rx - 79, ry - 70) < 58;
      b.setAttribute("x", rx - 3.5);
      b.setAttribute("y", ry - 3.5);
      b.setAttribute("fill", l.followed ? category.color : "#fbfaf6");
      b.setAttribute("opacity", inside ? (l.hidden ? 0 : 1) : 0);
      seen.add(l.lab);
    }
    for (const [id, node] of blips) if (!seen.has(id)) node.setAttribute("opacity", 0);

    rankText.textContent = `NO. ${Math.max(1, Math.round(followedRank))}`;
    const lab = LAB_BY_ID[followedId];
    if (lab && followName.textContent !== lab.name) followName.textContent = lab.name;
    followMenu.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-current", String(b.dataset.lab === followedId)),
    );
  }

  return { update, setMode, setAccent, blinkCategory, openSheet };
}
