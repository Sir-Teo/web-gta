# Asset provenance

| Asset | Source | Terms and status |
|---|---|---|
| UnifrakturCook Bold font | [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/unifrakturcook) | SIL Open Font License; bundled license at `public/fonts/OFL.txt` |
| Environment geometry and surface textures | Authored locally in `src/world/props.ts`, `src/render/environment.ts` and `src/render/textures.ts` | Procedural geometry and deterministic canvas textures; no original game files bundled |
| Crowd | The same authored character rig, with local clothing/skin palettes and instanced body parts in `src/render/CrowdVisual.ts` | Provisional population appearance; no original pedestrian models or animations |
| Character | Authored articulated geometry in `src/render/character.ts` | Provisional visual asset; not a reference-validated character model or animation set |
| Sedans | Authored geometry in `src/render/vehicle.ts` | Provisional vehicle silhouettes; dimensions and handling not reference-calibrated |
| Time-of-day palette, stars and light coronas | Authored table in `src/world/timecycle.ts`, seeded star points and a generated radial glow texture in `src/render/WorldLighting.ts` | Original procedural content; no original TIMECYC.DAT, star or corona assets bundled; sample hours follow the documented PC reference |
| Engine recording | [qubodup — Car Engine Loop](https://opengameart.org/content/car-engine-loop-96khz-4s) | CC BY 3.0 selected from the offered licenses; attributed in the Audio menu and `public/audio/CREDITS.txt`; converted to mono 44.1 kHz PCM and reduced in gain |
| Concrete/grass footsteps | [Kenney — Impact Sounds](https://kenney.nl/assets/impact-sounds) | CC0; variants 000–002 converted to PCM; included original license |
| Vehicle door recordings | [looneybits — Car_door_SFX](https://opengameart.org/content/cardoorsfx) | CC0; converted to mono 44.1 kHz PCM |
| Wind/cricket beds and horn | Authored signals in `src/audio/synthesis.ts` | Provisional procedural audio; not original game assets |
| HUD and favicon | Authored SVG, canvas and CSS | Original implementation; layout inspired by the selected reference |

The environment takes visual direction from original-era Grove Street screenshots found during research. Those images are references only and are not included in the game. No original Rockstar models, textures, audio or animation files are distributed here.

The character and vehicles must move behind asset-provider interfaces and be replaced with approved production models/animations as the asset pipeline matures. The current procedural scene is a calibration foundation, not a claim of pixel fidelity. Preserve this distinction in screenshots, progress reports and acceptance records.

The audio manifest at `public/audio/manifest.json` records each bundled recording’s creator, source URL, license, SHA-256, byte count, duration and sample format. These recordings improve the playable foundation without establishing original-game audio fidelity.
