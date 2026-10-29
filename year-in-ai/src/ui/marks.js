/**
 * Simple monochrome glyphs standing in for each lab, drawn as inline SVG so
 * they stay crisp at any size and need no network requests.
 */

const wrap = (body, fill = "currentColor") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${fill}" aria-hidden="true">${body}</svg>`;

export const MARKS = {
  // Six-lobed rosette
  openai: wrap(`
    <g stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round">
      <path d="M12 3.4 18.1 7v7L12 17.6 5.9 14V7Z"/>
      <path d="M12 3.4v7.1L5.9 14"/>
      <path d="M18.1 7 12 10.5v7.1"/>
    </g>`),

  // Angular burst "A"
  anthropic: wrap(`
    <g stroke-width="1.5" stroke-linecap="round">
      <path d="M5.4 19 10.6 5h2.1"/>
      <path d="M18.6 19 13.4 5"/>
      <path d="M9.2 14.2h6.1"/>
    </g>`),

  // Four-quadrant G
  google: wrap(`
    <g stroke-width="1.5" stroke-linecap="round">
      <path d="M18.4 8.1A7 7 0 1 0 19 12h-7"/>
    </g>`),

  // Crescent moon + orbit
  moonshot: wrap(`
    <g stroke-width="1.4" stroke-linecap="round">
      <circle cx="12" cy="12" r="7"/>
      <path d="M12 5a7 7 0 0 1 0 14"/>
      <path d="M6.3 8.4h11.4M5.3 12h13.4M6.3 15.6h11.4"/>
    </g>`),

  // X
  xai: wrap(`
    <g stroke-width="1.6" stroke-linecap="round">
      <path d="M5.8 5.4 18.2 18.6M18.2 5.4 5.8 18.6"/>
    </g>`),

  // Whale fluke
  deepseek: wrap(`
    <g stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.3 9.2c4.3-.4 6.6 1.4 7.7 3.6 1.1-2.2 3.4-4 7.7-3.6"/>
      <path d="M12 12.8V19"/>
      <path d="M8.6 17.1 12 19l3.4-1.9"/>
      <circle cx="12" cy="6.4" r="1.3"/>
    </g>`),

  // Interlocking loops
  meta: wrap(`
    <g stroke-width="1.45" stroke-linecap="round">
      <path d="M3.6 15.4c0-4.6 2.1-7.6 4.6-7.6 3.4 0 5 8.4 8.2 8.4 2 0 3.6-1.9 3.6-4.6"/>
      <path d="M20 11.6c0-2.9-1.6-4.9-3.6-4.9-3.2 0-4.8 8.4-8.2 8.4-2.5 0-4.6-1.6-4.6-4.4"/>
    </g>`),

  // Stacked bars
  mistral: wrap(`
    <g stroke-width="1.4">
      <path d="M5 5.6h3.6v12.8H5zM11.2 5.6h3.6v12.8h-3.6zM17.4 5.6H21v12.8h-3.6z"/>
      <path d="M5 9.9h16M5 14.1h16" stroke-opacity=".55"/>
    </g>`),
};

/** The Arena column capital, used in the wordmark + at the vanishing point. */
export const ARENA_COLUMN = `
<svg viewBox="0 0 28 22" aria-hidden="true" class="column">
  <rect x="0.5" y="0.5" width="27" height="3" />
  <path d="M2.6 4.6h22.8l-1.4 2.8H4Z" />
  <g>
    <rect x="5.2" y="8.4" width="1.9" height="13.1" />
    <rect x="8.8" y="8.4" width="1.9" height="13.1" />
    <rect x="12.4" y="8.4" width="1.9" height="13.1" />
    <rect x="16" y="8.4" width="1.9" height="13.1" />
    <rect x="19.6" y="8.4" width="1.9" height="13.1" />
  </g>
</svg>`;

export function arenaWordmark(extraClass = "") {
  return `<span class="wordmark ${extraClass}">${ARENA_COLUMN}<span class="wordmark-text">Arena</span></span>`;
}

export function markFor(id) {
  return MARKS[id] || MARKS.openai;
}
