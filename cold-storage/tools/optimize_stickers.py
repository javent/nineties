"""Keep editable transparent PNG masters and ship compact, alpha-preserving WebP."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
for p in sorted((ROOT/'artwork'/'stickers').glob('sticker-*.png')):
    image=Image.open(p).convert('RGBA')
    target=ROOT/'public'/'assets'/p.with_suffix('.webp').name
    image.save(target,format='WEBP',quality=94,method=6,exact=True)
    print(target.name,target.stat().st_size)
