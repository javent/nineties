"""Render the header wordmark from the user-requested Revue Regular font.

Usage: python tools/make-wordmark.py /path/to/reve.ttf
Requires: fonttools, uharfbuzz.

Source: https://font.download/font/revue
The source lists this font as free for personal use. Obtain an appropriate
license before public/commercial use; see licenses/Revue-Usage-Notes.txt.
Only an outlined SVG is shipped, not the font binary. Outlining is not a license.
The existing header peel/reset animation uses this SVG without changes.
"""
from pathlib import Path
import sys
import re
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
data = source.read_bytes()
font = TTFont(source)
face = hb.Face(data)
hfont = hb.Font(face)
hfont.scale = (face.upem, face.upem)
buffer = hb.Buffer()
buffer.add_str('Mid90s Minifridge')
buffer.guess_segment_properties()
hb.shape(hfont, buffer, {'kern': True, 'liga': True})
glyphs = font.getGlyphSet()
order = font.getGlyphOrder()
paths = SVGPathPen(glyphs)
bounds = BoundsPen(glyphs)
x = y = 0
for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions):
    glyph = glyphs[order[info.codepoint]]
    transform = (1, 0, 0, 1, x + pos.x_offset, y + pos.y_offset)
    glyph.draw(TransformPen(paths, transform))
    glyph.draw(TransformPen(bounds, transform))
    x += pos.x_advance
    y += pos.y_advance
x0, y0, x1, y1 = bounds.bounds
pad = 12
width, height = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" fill="currentColor">
  <title>Mid90s Minifridge</title>
  <desc>Wordmark rendered from Revue Regular using the user-specified Font.Download source. This is an outlined image, not a bundled font. See the font usage notes before public or commercial use.</desc>
  <g transform="translate({-x0+pad:g} {y1+pad:g}) scale(1 -1)">
    <path d="{paths.getCommands()}"/>
  </g>
</svg>
'''
output = ROOT / 'artwork' / 'mid90s-minifridge-wordmark.svg'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(svg)
# Keep the browser's inline wordmark synchronized with the editable SVG master.
inline = svg.replace('<svg ', '<svg class="brand-wordmark" data-typeface="Revue" aria-hidden="true" focusable="false" ', 1)
index = ROOT / 'index.html'
html = index.read_text()
pattern = r'(<button\b(?=[^>]*\bid="home")[^>]*>).*?(</button>)'
html, count = re.subn(pattern, lambda m: m.group(1) + '\n' + inline + '\n' + m.group(2), html, count=1, flags=re.S)
if count != 1:
    raise RuntimeError('Could not locate the #home wordmark button')
index.write_text(html)
print(f'Wordmark: {width:g} × {height:g} units, {len(svg):,} bytes. The source font is not bundled.')
