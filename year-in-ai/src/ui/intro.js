import { arenaWordmark } from "./marks.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (u) => u * u * (3 - 2 * u);
/** 0 before `a`, 1 between `b` and `c`, 0 after `d` */
const window4 = (t, a, b, c, d) =>
  smooth(clamp((t - a) / (b - a), 0, 1)) * (1 - smooth(clamp((t - c) / (d - c), 0, 1)));

const vhp = (pct) => (window.innerHeight * pct) / 100;

export function createIntro() {
  const root = document.getElementById("intro");

  root.innerHTML = `
    <div class="intro-block" data-block="title">
      <span class="title-mark">${arenaWordmark()}</span>
      <h1 class="title-main"><em>Year in</em> AI 2026</h1>
      <p class="title-sub mono">Scroll up and down to move<br />backward and forward</p>
    </div>
    <div class="intro-block statement" data-block="stat">
      What a<br />year it&rsquo;s been<br />
      <span class="boxed">2,000,000</span><br />
      <em>people voted on arena.ai</em>
    </div>
    <div class="intro-block statement" data-block="outro">
      That was<br /><em>the year in AI</em><br />
      <span class="outro-note mono">2026 &middot; measured by ${""}2,000,000 votes on arena.ai</span>
    </div>
    <div id="cue" class="mono">Scroll<i></i></div>`;

  const title = root.querySelector('[data-block="title"]');
  const stat = root.querySelector('[data-block="stat"]');
  const outro = root.querySelector('[data-block="outro"]');
  const cue = root.querySelector("#cue");

  function update(t, total) {
    const tOp = window4(t, -1, 0, 12, 40);
    title.style.opacity = String(tOp);
    title.style.transform = `translate(-50%, -50%) translateY(${(-t * 0.5).toFixed(1)}px)`;
    title.style.visibility = tOp < 0.01 ? "hidden" : "visible";

    const sOp = window4(t, 80, 104, 126, 152);
    stat.style.opacity = String(sOp);
    stat.style.transform = `translate(-50%, -50%) translateY(${(-vhp(14) - (t - 104) * 0.22).toFixed(1)}px) scale(${(0.94 + sOp * 0.06).toFixed(3)})`;
    stat.style.visibility = sOp < 0.01 ? "hidden" : "visible";

    const oOp = window4(t, total - 86, total - 46, total + 999, total + 1000);
    outro.style.opacity = String(oOp);
    outro.style.visibility = oOp < 0.01 ? "hidden" : "visible";
    outro.style.transform = `translate(-50%, -50%) translateY(${(-vhp(19) + (total - t) * 0.26).toFixed(1)}px)`;

    cue.classList.toggle("is-on", t < 10);
    root.style.pointerEvents = "none";
    return { titleOpacity: tOp, statOpacity: sOp, outroOpacity: oOp };
  }

  return { update };
}

export { window4, clamp, smooth };
