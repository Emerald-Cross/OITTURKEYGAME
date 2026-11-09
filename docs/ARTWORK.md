# Autumn arcade artwork

The gallery background is the user's supplied autumn landscape, copied without modification to `public/assets/autumn-woods.png`.

`public/assets/woodland-sprites.png` was made with the built-in image generation tool, using that landscape as a style reference. It is the original transparent 1536 × 1024 output. The runtime uses CSS background positions to display individual cells; no generated assets are needed from an external host.

| Atlas cell | Illustration |
| --- | --- |
| Top left | Small wild turkey |
| Top center | Fan-tailed tom turkey |
| Top right | Brown bear |
| Bottom left | Whitetail deer |
| Bottom center | Squirrel |
| Bottom right | Feather puff |

Active QR payloads and their SVG files are unchanged. The TV now draws exactly one of them at a time as a large patch on the animal’s body, surrounded by a feather or fur silhouette. Nonlethal feather effects stay above the QR area; clearance puffs appear after the code is hidden. Health, points, and QR visibility update immediately in the existing message handler, before decorative animations.

The feather favicon and small interface icons are native SVG. Typography uses locally available system sans-serif and Georgia-family serif fonts. Audio is synthesized through Web Audio after the user enables it.

## Generation prompt

> Use case: stylized-concept. Asset type: production sprite atlas for the OIT Turkey Hunt scanner arcade game. The supplied image is STYLE REFERENCE ONLY: match its beautiful clean 2D autumn illustration, confident flat silhouettes, subtle painterly shading, natural ochre/rust/forest palette, warm sunny light. Generate ONE transparent PNG sprite atlas in landscape 3:2 aspect ratio, in a precisely evenly spaced THREE COLUMN by TWO ROW grid. Each of the six grid cells contains exactly one standalone centered isolated illustration, with generous transparent margin and NO element crossing a cell boundary. The center of each character must align exactly with the center of its grid cell. TOP LEFT: a small alert wild turkey, side/three-quarter view facing right, copper and dark brown natural feathers, red wattle, long neck, two legs, folded wings, tasteful expressive eye. TOP MIDDLE: a large magnificent tom turkey facing slightly left, standing proudly with wide raised fan tail, beautiful layered natural brown/ochre feather patterns, mildly smug but recognizable realistic turkey anatomy. TOP RIGHT: a stocky warm brown black-bear species, all four paws visible standing in three quarter side view, slightly surprised, friendly enough for all ages, natural anatomy. BOTTOM LEFT: elegant whitetail deer doe, alert, facing left, full body. BOTTOM MIDDLE: a small reddish-brown squirrel seated with bushy tail, facing right. BOTTOM RIGHT: a circular airy puff burst of scattered tan, cream, brown and rust feathers, a soft creamy central puff, no text, no blood. Style is polished illustrated clipart, natural charming animals, distinct readable shapes at a distance. NO exaggerated cartoon grin, no silly googly eyes, no costumes or accessories, no scenery, no backgrounds, no words, no labels, no codes, no border, no drop shadows outside cells. Actual transparent background. Professional cohesive game asset sheet.

## Woodland encounter scenery

`public/assets/woodland-cover.svg` is a native vector foreground extension: ochre/rust leaf crowns, a shaded tree trunk, and olive undergrowth matched to the original landscape palette. Mirrored foreground edges, a vector/CSS stump, grass silhouettes, warm haze, and ground shadows frame the clearing. The original background and animal atlas are reused without image edits. CSS perspective provides depth for illustrated animal billboards; these are layered illustrations, not volumetric animal models.

The TV fills the viewport in all phases. Camp uses a modal notebook for settings, scanner status, diagnostics, and saved scores. The body patch is a regular square QR with its original quiet zone; decorative feather edges remain outside the white scan area. Hit puffs and floating point feedback do not cover an active QR.
