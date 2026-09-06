# Sticker artwork — provenance & editing notes

This redesign uses the supplied sticker photographs and matching higher-resolution references. These are **recognizable existing graphics**, not newly invented brand marks and not CC0 artwork. Brand names identify the depicted designs; the project is not affiliated with or endorsed by those brands. Inclusion and attribution do not grant commercial publishing or redistribution rights—check those rights before public/commercial use.

The original refrigerator model, interaction code, CC0 enamel/HDRI assets, and font licenses are documented separately in `README.md` and `licenses/`.

## Directly adapted from your photograph

Source: the user-provided `s-l1200-2.jpg` (989 × 1200).

| Catalog label   | Adaptation                                                       |
| --------------- | ---------------------------------------------------------------- |
| Pat Duffy       | Skeleton/gunslinger rectangle; cropped and perspective-corrected |
| Creature        | Green/yellow wordmark; peach background removed                  |
| Rainbow Melt    | The multicolored dripping figure; background removed             |
| Vans            | Red/white “Off the Wall” board shape; background removed         |
| Toy Machine     | Yellow-horned monster and wordmark; background removed           |
| Spitfire        | Holographic Bighead-style flame graphic; background removed      |
| Zumiez          | Yellow ornamental ticket; cropped and perspective-corrected      |
| Alien Workshop  | Arched red/black alien illustration; background removed          |
| Journeys        | Purple hand graphic; background and finger gaps removed          |
| 187 Killer Pads | Red/black wordmark; background removed                           |

**Rainbow Melt** is a descriptive label, not a verified maker/brand attribution. No claim is made that every design in the supplied photo was originally released in the 1990s.

The JPEG photo texture, fine printed detail, and white die-cut borders are retained. Background removal does not remove the warm/pink colors enclosed inside the artwork. The rectangular stickers are perspective-corrected before being placed on the curved 3D paper.

## Classic additions guided by the smaller collection photograph

The user-provided `images-8.jpg` (387 × 516) supplies the visual direction for these four additions. Higher-resolution references avoid enlarging very small crops from the collection photo.

- **Santa Cruz — Classic Dot.** Matching red/yellow logo sticker, photographed product reference from Route One. [1](https://www.routeone.eu/products/santa-cruz-classic-dot-sticker)
  - Image: `https://www.routeone.eu/cdn/shop/products/001078336.jpg?v=1734969509&width=1000`
  - The sticker is separated from the white photo background, including its protruding lettering and white keyline.
- **Independent — Truck Company cross logo.** Reference from VectorSeek. [1](https://vectorseek.com/vector_logo/independent-truck-company-logo-vector/)
  - Image: `https://vectorseek.com/wp-content/uploads/2022/04/Independent-Truck-Company-Logo-Vector.jpg`
  - The central logo is used on a circular paper silhouette. The site's download-format illustrations are not part of the sticker. This asset is not covered by the project's CC0 PBR/HDRI terms; check the source's terms and the brand owner's rights.
- **Bullet — Dragon Crest.** A matching crest motif on a complete red hexagonal vintage sticker, from the higher-resolution product photograph returned by the reference search. [2](https://www.ebay.com/b/Santa-Cruz-Skateboarding-Longboarding-Stickers-Decals/47357/bn_73771273)
  - Image: `https://i.ebayimg.com/images/g/c40AAeSwf1FqNrlM/s-l1600.jpg`
  - Only the complete red foreground sticker is isolated. The partially hidden sticker behind it and the tabletop are not used.
- **Santa Cruz — Speed Face.** A clearer reference of the same blue face character, photographed as an enamel pin. [2](https://www.ebay.com/itm/384237988626)
  - Image: `https://i.ebayimg.com/images/g/fZQAAOSw3kVg09vY/s-l1600.jpg`
  - The blue character is isolated, with a small paper keyline added. The red scorpion-heart pin and the photo background are not used. It is rendered as flexible sticker paper in the application, not as a physical pin.

## New additions from the third supplied photograph

Source: user-provided **`s-l1200-3.jpg`**, 1200 × 903. All ten graphics below are adapted directly from this photo; no replacement web images were used.

| Catalog label             | Design / extraction                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Black Label               | Yellow elephant and black wordmark backing; die-cut outline isolated                  |
| Alien Workshop · Spectrum | White alien head, colored rays and wordmark; oval outline isolated                    |
| Anti Hero                 | Eagle and banner; irregular feather/banner silhouette isolated                        |
| DVS                       | Red, black and white logo; die-cut outline isolated                                   |
| Independent · Crossbar    | Red cross-and-bar wordmark; outline isolated                                          |
| Plan B                    | Black letters with blue/red dots; rounded rectangular paper crop                      |
| Krux                      | Yellow emblem and black wordmark; long rounded rectangular paper crop                 |
| Element                   | Red circular tree emblem; outer silhouette isolated                                   |
| Krooked                   | Eye-letter wordmark and skateboarding caption; actual white paper silhouette isolated |
| éS                        | White script on red; rounded rectangular paper crop                                   |

The `Spectrum` and `Crossbar` suffixes distinguish these from the two existing designs; they are descriptive catalog labels, not asserted official SKU names. The original Alien Workshop and Independent stickers remain in the collection.

The grid-like tabletop and the external photo shadows are removed, while the printed graphics and white keylines are retained. The Element symbol was cross-checked against a product identification reference; that site's image is not used in the artwork. [1](https://www.muraldecal.com/en/stickers/product/element-804/element-red-logo-17526)

These remain third-party brand graphics, with the same ownership and publishing-rights cautions as the rest of the collection. Their inclusion does not establish that each particular print dates to the 1990s.

## Band pack from the supplied cutting-mat photograph

Source: user-provided **`90s-bands-sticker-pack.jpg`**, 1024 × 1024. Fifteen connected sticker silhouettes were isolated directly from this photo:

Weezer; Soundgarden; Alice in Chains; Foo Fighters; Red Hot Chili Peppers; Radiohead; Smashing Pumpkins; Stone Temple Pilots; Oasis; Rage Against the Machine; Nirvana; The Offspring; Pearl Jam; R.E.M.; Nine Inch Nails.

The Foo Fighters round emblem/script, Radiohead bear/name, and Nirvana name/smiley remain joined as in the reference backing. The dark cutting mat, green grid, ruler labels and external photo shadows are removed. These are existing third-party band graphics, not new project illustrations or CC0 art. No claim is made that every specific logo variant first appeared in the 1990s.

The new set starts in the collection drawer, with individual transparent PNG masters and alpha WebP production files named `sticker-band-*.png` / `.webp`. `tools/extract-bands.py` documents the extraction. All 24 previously included graphics remain available.

## Files and rendering

- Editable, transparent **PNG masters**: `artwork/stickers/sticker-*.png`.
- Alpha-preserving **WebP production textures**: `public/assets/sticker-*.webp`.
- Catalog labels, categories, sizes, positions, and image URLs: `src/sticker-catalog.js`.
- Re-optimize PNG masters with `python tools/optimize_stickers.py` (Pillow required).
- Rebuild the offline page with `npm run standalone`.

All production graphics are bundled locally; the page does not hotlink any of these websites or fetch external artwork at runtime. Each cutout gets a matching silver adhesive underside, a soft contact shadow, a segmented bending mesh, and an alpha-aware picking mask.
