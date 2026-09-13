# Native character asset audit

Inspected 2026-09-13. The public world archive and acquisition hashes are recorded in [PUBLIC_WORLD_RESOURCES.md](PUBLIC_WORLD_RESOURCES.md). These results describe that downloaded sample, not verified retail-version provenance or rendered character parity.

## What the archive actually contains

Extracted sector-padded entries from `/tmp/web-gta-noclip-world/gta3.img` and passed them through the existing DFF, TXD and IFP readers. All eight selected files parsed without an exception.

| Entry | Observed contents | Consequence |
|---|---|---|
| `player.dff` | 8,192 bytes; 33 frames; one geometry, 6 vertices, 2 triangles, 32 skin bones; no material texture name | Skeleton/template, not a complete drawable CJ body. |
| `csplay.dff` | 12,288 bytes; 62 frames; one geometry, 6 vertices, 2 triangles, 61 skin bones | Cutscene template has a different bone count; not interchangeable with gameplay clothing by assumption. |
| `fam1.dff` | 81,920 bytes; 33 frames; 1,011 vertices, 1,113 triangles, 32 skin bones; texture `FAM1` | Usable native pedestrian candidate for a separate NPC rendering/animation audit. Not CJ. |
| `player.txd` | `torso8bit` 256×256 and `head8bit` 128×128, both XRGB8888 | Does not supply a full assembled outfit. |
| `csplay.txd` | Zero textures | No ready cutscene appearance. |
| `fam1.txd` | `FAM1` 128×256 DXT1 | Texture name matches pedestrian material. |
| `fat.ifp` | ANP3, 18 animations; FatWalk duration 1.1666666269302368 seconds, FatRun 0.7666666507720947 | Body-specific animation reference; not a substitute for normal locomotion. |
| `muscular.ifp` | ANP3, 17 animations; MuscleWalk duration 1.0666667222976685 seconds, MuscleRun 0.800000011920929 | Separate body-specific animation reference. |

Each inspected DFF reports geometry plugin `0x253f2fd` as not rendered. Matching bone counts and texture names alone do not prove correct binding, material rendering or animation playback. No native character was installed in gameplay during this audit.

The tested URL `https://z.noclip.website/GrandTheftAutoSanAndreas/models/player.imgz` returned HTTP 404. This is a failed candidate path, not proof that the archive is unavailable everywhere. The world archive has no exact `ped.ifp` entry; the normal locomotion package remains to be sourced separately.

## Assembly design and source limits

Pinned [ClothesBuilder.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/ClothesBuilder.cpp) provides the following evidence:

- `LoadCdDirectory` reads `MODELS\\PLAYER.IMG`; geometry and texture requests resolve hashed component names through this directory.
- `CreateSkinnedClump` supplies missing base parts named torso, head, hands, legs and feet. It handles ten model/material slots and constructs geometry against the template's skin and hierarchy.
- `ConstructGeometryArray` selects component clumps and references `normal`, `fat` and `ripped` frames for blending. Body shape is therefore more than a uniform scale applied to a finished character.
- `ConstructTextures` and `ConstructGeometryAndSkinArrays` still call the original executable at this revision. Several related functions are marked unreversed or unsafe to hook. This source is not a complete standalone clothing assembler.

The browser implementation should first support one fixed, verified outfit and normal body shape. Keep each component's source identity, hierarchy and vertex weights; map bone IDs explicitly into the gameplay skeleton. Reject incompatible mappings. Preserve component material assignments and implement texture composition only from independently checked behavior. Validate seams, bind pose and stationary animation before enabling root-motion-driven walking. Add fat/muscle blending, clothing changes, layered textures and cutscene assembly only after that baseline is visually verified.

The existing single-clump preview and character test remain useful for complete pedestrian models. CJ needs a component-aware import/assembly stage; selecting the template directly cannot replace the placeholder protagonist. Scene and character handoffs also need a combined-session validation so a native model can be exercised in the actual imported district.

## Reproduction evidence

Local audit script: `/tmp/web-gta-character-reference.local.test.ts` (temporarily executed under `tests/`, then removed from the ordinary suite). Results: `/tmp/web-gta-character-audit.json`; runner log: `/tmp/web-gta-character-audit.log`. No source assets added to the repository or build.

SHA-256 of extracted, sector-padded files:

```text
player.dff   321fe0d44af5641c795cf5fda334ad049e96744e6f5d68afa3768a0652d88344
csplay.dff   fd6cab8ab8e03da7dacaff5baf9c8c40a3be49dd5c03cb758bbddba1ef0f96ed
fam1.dff     a84a4eb45c0c3f944314c1749df12d6bdcfcdb004965538a3f781c00d013e669
fat.ifp      0c529a99bfa679c628eeac0be6313acbe3af6de64a6d319ad2055d96fcdc0367
muscular.ifp 1f147f36ac8e0939292203f3d5e7d60678bd8c6fb56a75105590b39e71805634
```

## Browser validation and entity origin correction

The opt-in `tests/browser/pedestrian-reference.spec.ts` now loads `fam1.dff`, `fam1.txd` and `fat.ifp` from `GTA_REFERENCE_DIR`, assigns FatIdle/FatWalk, and exercises the character through the actual workshop/game handoff. It verifies 32 bound tracks, visible installed native character, horizontal movement, return to idle and no page errors. Run with:

```sh
GTA_REFERENCE_DIR=/tmp/web-gta-noclip-world npx playwright test tests/browser/pedestrian-reference.spec.ts
```

Initial screenshot inspection found the lower body buried in the road despite a passing animation/movement test. The simulation records a foot position; native pedestrian models use an entity origin above the feet. Pinned [TempColModels.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Collision/TempColModels.cpp) initializes the standard pedestrian bounds with minimum Z=-1. [FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp) assigns that collision model in LoadPedObject. [Entity.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp) returns minus the collision minimum Z from GetDistanceFromCentreOfMassToBaseOfModel, and [PlayerCommands.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Scripts/Commands/PlayerCommands.cpp) adds that distance to the supplied player position.

Character import now offers an explicit origin choice: existing feet-origin rigs or original San Andreas pedestrians. The latter places the native root one unit above interpolated feet. The offset remains fixed while crouching; the animation owns pose changes. It does not infer a native pedestrian from filenames or bone counts, rescale geometry, or move collision. The source choice is copied into the session handoff and resets with the model.

Reviewed `artifacts/native-pedestrian-preview.png` and the corrected `artifacts/native-pedestrian-game.png`. This establishes textured, animated native pedestrian rendering and removes the gross vertical placement error. It does not establish correct normal locomotion selection, facing conventions, foot contact across all clips, original lighting, or CJ assembly. Those still need independent validation. Ordinary tests: 484/97; build passes; both existing character browser tests and this real-data test pass. Logs `/tmp/web-gta-ped-origin-{unit,build,browser}.log`.

## Forward-axis correction

The next audit measured native translated root tracks directly. FatRun advances from native Y=0 to 3.021484375; FatWalk to 1.671875 (with X drift -0.001953125); MuscleRun to 4.326171875; MuscleWalk to 1.8671875. Root bone ID is 0. These are displacement per animation cycle, not speeds. Source audit output: `/tmp/web-gta-ped-direction.jsonl`.

Our model import rotates `(x,y,z)` to `(x,z,-y)`, so native +Y forward becomes runtime -Z. The simulation's heading zero instead denotes +Z. Previously the native character used the simulation heading directly for both its visible root and extracted motion. A directional browser assertion exposed W moving **1.3201088801543743 units opposite** the requested direction; the old test only checked movement magnitude. Failure evidence: `/tmp/web-gta-ped-facing-before.log`.

The explicit workshop setting is now **Character coordinates** and the session field is `convention`. Its original San Andreas pedestrian preset includes the one-unit origin height plus a 180-degree heading offset applied equally to pose and extracted motion. The custom preset preserves feet origin and runtime +Z forward. Raw preview geometry/animations remain in the native import basis. Neither preset infers a forward axis from a model name or silently changes the source animation.

The strengthened real-data browser test asserts positive movement projected onto camera-relative W input. A synthetic native +Y stride regression checks both displacement and visible forward at all four cardinal headings. Reviewed the updated game capture: look-behind now presents the pedestrian's face rather than its back. Verified 485 tests/97 files, build and three browser character tests; logs `/tmp/web-gta-ped-facing-{unit,build,browser}.log`. Turn-rate fidelity, foot contact, normal animation selection, lighting and CJ assembly remain incomplete.
