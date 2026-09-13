# Asset provenance

| Asset | Source | Terms and status |
|---|---|---|
| UnifrakturCook Bold font | [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/unifrakturcook) | SIL Open Font License; bundled license at `public/fonts/OFL.txt` |
| Environment geometry and surface textures | Authored locally in `src/render/environment.ts` and `src/render/textures.ts` | Procedural geometry and deterministic canvas textures; no original game files bundled |
| Character | Authored articulated geometry in `src/render/character.ts` | Provisional visual asset; not a reference-validated character model or animation set |
| Sedans | Authored geometry in `src/render/vehicle.ts` | Provisional vehicle silhouettes; dimensions and handling not reference-calibrated |
| HUD and favicon | Authored SVG, canvas and CSS | Original implementation; layout inspired by the selected reference |

The environment takes visual direction from original-era Grove Street screenshots found during research. Those images are references only and are not included in the game. No original Rockstar models, textures, audio or animation files are distributed here.

The character and vehicles must move behind asset-provider interfaces and be replaced with approved production models/animations as the asset pipeline matures. The current procedural scene is a calibration foundation, not a claim of pixel fidelity. Preserve this distinction in screenshots, progress reports and acceptance records.
