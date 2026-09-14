# Current asset provenance

The playable world uses original native content from the inspected public dataset.

| Content | Provenance record |
|---|---|
| Complete IMG archive, terrain, buildings, collision, placement and environment data | `scripts/content/world-sources.json` and `public/play/world/manifest.json` |
| Vehicle definitions, handling, colors and shared textures | `scripts/content/vehicle-sources.json`; vehicle model/texture entries retain their IMG provenance |
| CJ body, clothes and movement animations | Native player/animation resources in `public/play/world/files`; source acquisition and format research under `scripts/content` and `docs/research` |
| Original radar tiles and assembled map | `public/play/navigation/provenance.json`; all 144 `radar*.txd` entries decoded losslessly from the original IMG |
| Native footstep banks | `scripts/content/feet-sources.json` and the published world resource manifest |
| UnifrakturCook Bold | Google Fonts; bundled SIL Open Font License at `public/fonts/OFL.txt` |
| HUD and favicon | Project-authored UI, retained independently of world content |

The manifest records exact source byte lengths, hashes and upstream URLs. Public
availability and successful parsing do not certify a retail version or establish
redistribution rights. See `static-world-content.md` and the vehicle audit for
coverage and unresolved source data.

The procedural sandbox geometry, characters, cars, star field, city lights,
synthetic ambience and third-party replacement audio are deleted. Native asset
workshops and independent parser/physics fixtures remain development tools.
