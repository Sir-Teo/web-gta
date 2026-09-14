# Native character asset audit

Inspected 2026-09-13. The public world archive and acquisition hashes are recorded in [PUBLIC_WORLD_RESOURCES.md](PUBLIC_WORLD_RESOURCES.md). These results describe that downloaded sample, not verified retail-version provenance or rendered character parity.

## Normal CJ movement package acquired and tested (2026-09-14)

A public `ped.ifp` backup is now available locally at
`/Users/teo/Developer/web-gta-content/animations/ped.ifp`. The source is the
[2015 original-mod backups forum post](https://forum.bugged.ro/topic/133882-moduri-originale-mafioti-pedpythonrifleifp/),
which links to this [MediaFire download page](https://www.mediafire.com/file/gk2ga2uglnjr2hb/ped.ifp/file).
The actual downloaded bytes, not the uploader's description, were inspected:

- 1,433,248 bytes, ANP3 format, 294 clips, 7,607 tracks, 112,150 keyframes.
- SHA-256: `f7483f49080a0f833dc73ef09aa2224f99a9e90757fa5c2b7db5505cbef33eac`.
- Provenance and parsed details remain alongside the file in `ped-source.json`
  and `ped-inspection.json`. This is an inspected public backup; retail byte
  identity has not been independently established. Other advertised backup
  sources did not yield a usable independent comparison.

The pinned reversed [player animation table](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Animation/AnimAssocAnimations.h#L700)
names `walk_player`, `run_player`, `SPRINT_civi`, `IDLE_STANCE`, `roadcross` and
`walk_start`. The inspected package contains the following relevant clips
(capitalization below is from the package):

| Clip | Duration (seconds, rounded) | Tracks | Role in this validation |
|---|---:|---:|---|
| `WALK_player` | 1.200 | 32 | Assigned walk; horizontal root translation held in place |
| `run_player` | 0.733 | 32 | Assigned run; horizontal root translation held in place |
| `IDLE_stance` | 1.500 | 32 | Assigned idle; source motion |
| `sprint_civi` | 0.533 | 32 | Inspected only; not assigned |
| `WALK_start` | 0.267 | 32 | Inspected only; not assigned |

All five use translated root track 0, bone ID 0. The audit also confirms named
jump and crouch clips, but this pass does not integrate or validate those actions.
Reproduce the inspection with:

```sh
node scripts/content/audit-ped.mjs /absolute/ped.ifp /absolute/report.json
```

The actual-control browser test now covers both Normal and Fat. For Normal it
first assembles Grove Street from the local native map folder, opens its game,
checks imported `timecycp.dat`, then opens that game's character workshop,
assembles the classic Normal outfit, assigns its three matching clips and sends
CJ back to the same session. Walking, running and returning to idle pass with
movement and no page errors. Inspected `artifacts/native-cj-normal-walking.png`
and `artifacts/native-cj-normal-idle.png`: the clothed native CJ is visible in the
native Grove Street scene. This is combined content integration evidence, not a
pixel-match claim. Foliage/fence aliasing, lighting/shadow calibration, original
walk/run/sprint selection and animation-speed/foot-contact parity remain work.

Both gameplay cases and the build pass. Logs:
`/tmp/web-gta-normal-cj-browser.log`, `/tmp/web-gta-normal-cj-build.log`.
This section supersedes historical statements below that normal `ped.ifp`
remained unavailable. Native bytes remain outside the repository and build.

## Distinct native sprint gait

The normal preset now also assigns `sprint_civi`. With all three moving roles
installed, directional input runs, Alt plus movement walks, and Shift plus
movement sprints. Releasing Shift or exhausting stamina returns to running.
Ordinary running does not request stamina drain in this mode. Each gait uses
its own source root motion and shares the existing phase-preserving transition
system. A sprint assignment requires a run assignment; the workshop reports an
incomplete setup and the gameplay adapter rejects it. Existing imports without
a sprint role retain their two-gait controls and behavior.

The pinned [PC controls configuration](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/ControllerConfigManager.cpp#L533)
assigns a separate walk modifier to left Alt. The
[player-on-foot task](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskSimplePlayerOnFoot.cpp#L937)
caps movement blend at the walking range when that modifier is active. The
browser retains its existing Shift-sprint and Space-jump bindings; original PC
bindings use Space-sprint and Shift-jump. This is a gait/content integration,
not a complete reproduction of the original input or movement controller.

The existing authored stamina drain/recovery, exhaustion hysteresis, transition
duration and launch-phase approximation remain in use. Stat-dependent sprint
speed, native association weights, analog gait blending and exact foot contact
remain unverified. The sprint root is sampled at its source timeline rate.

Validation: 633 unit tests in 136 files, four character browser checks, build
and production smoke pass. The real Normal CJ case exercises Alt-walk,
Shift-sprint, release-to-run and idle in native Grove Street. Unit checks cover
non-draining run output, distinct sprint displacement, exhaustion/recovery and
rejecting sprint without run. Inspected `artifacts/native-cj-normal-sprinting.png`.
Logs: `/tmp/web-gta-sprint-{all-unit,browser,production}.log`.

## Assemble CJ through the workshop

With the assembled Normal body and acquired `ped.ifp` loaded, click **Assign
normal CJ movement** to set `IDLE_stance`, `WALK_player`, `run_player` and `sprint_civi` together.
The control is available only for a native player body and a package with all
four nonempty clips and an unambiguous translated root bone (ID 0) in all three
moving clips. It resolves names without case sensitivity and finds the actual
root track index. Idle retains source motion; walk/run hold horizontal root
motion in place. All four clips are checked against the preview rig before
the assignments change. Manual assignment and separately assigned jump/crouch
roles remain available. The preset explicitly selects normal movement; it does
not infer stat variants.

The normal gameplay test now uses this control in the native Grove Street
session and checks the resulting roles, walk/run/idle transitions and removal
of player-only controls when a generic model replaces CJ. Preset unit checks
exercise a root at index 1, missing/ambiguous clips and invalid root identities.
Validation: three preset unit tests, both native player gameplay tests, six
animation/character browser regression tests and the build pass. Inspected
`artifacts/native-cj-movement-preset.png`. Logs are
`/tmp/web-gta-movement-preset-{build,browser,characters}.log`.

Open **Assemble native CJ** in the model workshop, select the listed DFF/TXD
files from the depot's `player/` directory, choose Normal, Fat or Ripped and an
outfit, then click **Assemble CJ**. Available outfits are the base body, vest
with base legs/feet, and vest with native jeans and sneakers. The required-file
list changes with the outfit. The worker validates duplicate names, missing
dependencies and selection size before reading the required files; unrelated
selected files do not replace required slots.

The resulting preview keeps the native player-body marker and applies the
source shoulder helper-bone correction after animation sampling. Its character
coordinate selector is fixed to the original pedestrian convention. Loading a
generic DFF clears that marker and restores the normal coordinate controls.
This removes the need for injected test code to construct and install CJ.

Choose a matching IFP in the animation controls and assign idle, walk and run.
For the acquired Fat body, the verified setup is `FatIdle` with Source motion,
`FatWalk` with translation track 0 held in place, and `FatRun` with track 0 held
in place. From a game's **Open character workshop for this session** link,
**Use character in linked game** replaces the placeholder in that same paused
session. A standalone workshop can open its character test game instead.

The browser test now uses these actual controls to recover from missing files,
assemble 1,721 vertices / 2,332 triangles, select and assign the Fat clips, install
CJ, walk, run and return to idle. It also loads a generic DFF afterward to check
that player-only preview state is cleared. Current workshop captures use
`artifacts/native-cj-fat-workshop.png` and `native-cj-normal-workshop.png`; Fat gameplay captures are
`artifacts/native-cj-fat-walking.png`, `native-cj-fat-running.png` and
`native-cj-fat-idle.png`. Normal-body locomotion has its own source clips and
combined Grove Street check described above. Continuous stat interpolation, the full wardrobe and seam processing
remain unfinished; existing native-character limitations still apply.

Validation: 629 unit tests in 135 files, eight animation/player browser checks,
build and production smoke pass. Logs: `/tmp/web-gta-cj-workshop-all-unit.log`,
`/tmp/web-gta-cj-workshop-regression.log` and
`/tmp/web-gta-cj-workshop-production.log`. Native files remain external to the
repository and production build.

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

## Character installation into an existing scene

The game menu now exposes **Open character workshop for this session**. Its workshop uses **Use character in linked game** instead of spawning an isolated character test. The session keeps its world, player position, timecycle and simulation; a successful replacement pauses it for review. The ordinary standalone workshop behavior remains available when opened without a session target.

Each game owns a random, session-local BroadcastChannel distinct from the existing standalone test channel. Requests and success/failure acknowledgements carry request IDs. The workshop reports a missing response after five seconds, closes its request channel on completion/reset/disposal, and supports retry. The game closes its receiver during cleanup. Failed NativeCharacter construction preserves the previously installed character. Assets are still local and are not written to saves or uploaded.

`tests/browser/character-session.spec.ts` exercises repeated replacement without moving the player, malformed-request rejection, subsequent visibility of the preserved character, and closed-session feedback. It waits for the workshop's initialized button before selecting files; the initial popup audit exposed a pre-handler input race in the test.

The optional Grove reference test now also requires extracted `fam1.dff`, `fam1.txd`, and `fat.ifp` in `GTA_REFERENCE_DIR`. It installs the pedestrian through this actual UI into the 469-placement native scene with native timecycle lighting, then verifies native-character visibility and grounded walking. Reviewed `artifacts/native-grove-character.png`. This is a native pedestrian integration reference, not CJ or final atmospheric/animation parity. The older `native-grove-timecycle.png` remains the earlier placeholder-character capture.

## Component resource follow-up and explicit clump inspection

The [CustomSeif/GTASA3DSkins repository](https://github.com/CustomSeif/GTASA3DSkins) is available at inspected tree revision `a65ed2325c0bd64c8e91f81f6220c9ede3ebe4eb`. It advertises converted pedestrian models, but its `sql-inserts-skins.sql` row for model `cj`, ID 0, sets the model URL to `No URL`. It is not a verified CJ asset source. Local API tree and SQL: `/tmp/web-gta-skins-tree.json`, `/tmp/web-gta-skins.sql`. Exact inspected tree SHA: `a65ed2325c0bd64c8e91f81f6220c9ede3ebe4eb`.

A public launcher manifest search lead pointed to `http://launcher.kingofsamp.com/api-beta/anim/ped.ifp`; that endpoint returned HTTP 404. The HTTPS candidate failed hostname certificate verification. No usable animation asset was acquired from this lead, and certificate verification was not disabled. The exact starting outfit descriptor has not yet been independently extracted from startup game data; filename guesses must not be treated as a complete outfit dependency manifest.

MTA's primary [Clothing Component IDs documentation](https://wiki.multitheftauto.com/wiki/Clothing_Component_IDs) describes three clumps for the normal, fat and ripped clothing variants and identifies PLAYER.IMG as the original component source. Our previous DFF reader read only the first root clump and ignored following ones. That was insufficient for inspecting such component containers.

`readDff(bytes, clumpIndex?)` now indexes up to 16 consecutive root clumps within the existing 64 MiB limit. Multiple clumps require explicit selection; a selected model reports its zero-based index and total in warnings. The workshop's **Model clump (0 = first)** field sends that selection through the worker, including for archive entries. New local files and explicit archive model changes reset the selection. Invalid indices and truncated following clump chunks fail clearly; existing IMG sector padding remains accepted. Non-clump trailing sections remain outside this reader's scope.

Scene loading supplies no clump selection, so it cannot silently render only part of a multi-clump model. The preview displays one selected clump; it does not combine skeletons, blend body variants, name variants by index, or assemble clothing. A synthetic container made from two independent exported fixtures verifies selection, preserved skin data, absent-index recovery and file replacement in unit/browser checks. Real CJ component files remain unavailable for direct validation.

## Root motion follows the turning body

A native forward-stride regression exposed another mismatch: NativeCharacter rotated movement immediately to the requested input heading, while Simulation gradually rotated the visible actor. During a right turn, displacement could therefore point sideways relative to the model. Failure log: `/tmp/web-gta-native-turn-before.log`.

The native pedestrian preset now keeps extracted motion and transition velocities in actor coordinates. `Controls.animationMotionSpace = 'actor'` makes Simulation rotate the stride using its updated heading, before collision resolution. The rendered native root uses that same heading plus the native forward-axis correction. Omitted or explicit `world` space preserves the existing direct-displacement contract for custom rigs and other callers. Unknown spaces fail before simulation state advances.

Unit coverage checks the first intermediate turning step, all cardinal headings, actor-space wall collision, invalid-space atomicity and existing world-space behavior. The real pedestrian browser test records twelve render-frame samples during a right turn and checks applied strides align with the actor heading (dot product above 0.95, allowing source lateral motion). The standalone and imported Grove character scenarios pass, and the updated pedestrian capture was inspected.

Verified 488 unit tests/97 files, build, four character/Grove browser scenarios and the strengthened real-character turning test. Logs `/tmp/web-gta-native-turn-{unit,build,browser,reference}.log`. This fixes the coordinate/ordering mismatch; the existing exponential turning rate and transition duration are still authored approximations, not a reproduction of all original pedestrian turning behavior.

## Native pedestrian ambient channel

Pinned [app_light.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/app/app_light.cpp) stores separate ambient colors for the world and for pedestrians/cars/objects. The latter reads the three `GetAmbient*_Obj` timecycle values and applies `CCoronas::LightsMult`. [TimeCycle.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TimeCycle.cpp) divides the interpolated object ambient channels by 255. These are lighting coefficients, not sRGB display colors.

LocalTimecycle now exposes those normalized object channels separately from building ambient. WorldLighting passes the current object ambient to the imported character with the existing sun-light multiplier. Shared material uniforms replace the authored indirect ambient term while retaining prelight, the material ambient coefficient, direct light and texture modulation. Clearing local lighting disables the override without rebuilding the character. Raw model inspection and unlit geometry retain their existing paths.

This implements one source-backed part of character illumination. The pinned [Renderer::SetupLightingForEntity](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp) also applies collision/contact and generated-light multipliers; app_light adds brightness adjustments and derives directional illumination separately. Those factors are not yet reproduced here. Directional lighting remains authored. The currently sampled public timecycp table gives object ambient `[0.959747850894928, 0.9454360008239746, 0.7137255072593689]` at 17:25/weather 0, so enabling the source channel does not by itself establish appropriate final brightness.

GPU checks verify colored ambient replacement even with a different scene ambient, and addition of direct illumination. Unit checks cover independent timecycle fields, shared-uniform updates, clear/fallback and invalid-input preservation. The real Grove character run passes and its updated capture was inspected. Verified 490 unit tests/97 files, build and both GPU/Grove browser scenarios. Logs `/tmp/web-gta-object-ambient-{unit,build,browser}.log`. Overall character-lighting/pixel parity remains unverified.

## Collision contact brightness

Pinned [ColPoint.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Collision/ColPoint.h) stores day brightness in the low nibble and night brightness in the high nibble. [ColPoint.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Collision/ColPoint.cpp) scales each nibble by 0.5/15 and blends with the building day/night balance. [Physical::GetLightingFromCol(true)](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Physical.cpp) adds the mean world ambient before brightness correction. Renderer::SetupLightingForEntity then computes `0.95 * lighting + 0.05`, before generated point-light effects.

The imported game now samples collision metadata beneath grounded feet once per simulation step. It reuses the verified Rapier triangle-to-source-face mapping, including back-face indices. The probe starts 0.15 units above the foot and extends downward 0.5 units; it excludes the player and sensors, requires an upward-facing hit, and examines the nearest collider before looking up native metadata. Unknown nearer geometry cannot be skipped to sample a native floor behind it. The last packed byte is retained while airborne and decoded against current time each render; unresolved grounded contacts clear the override.

This probe and airborne retention are explicit integration approximations, not a transcription of original CPed collision selection/smoothing. The decoded contact plus world ambient factor now scales both imported-character ambient and direct light. Source prelight remains additive. Native timecycle must be active; missing contact metadata leaves the previous ambient-only behavior. Generated point lights, original directional illumination and brightness adjustments remain unfinished.

The Grove reference reports packed byte `0x35` at the sampled standing/walking location: day brightness 5/30 and night brightness 3/30. Reviewed the updated `artifacts/native-grove-character.png`; the contact factor reduces the previously excessive brightness. Unit coverage includes packed interpolation, the entity multiplier, nearest unknown obstruction, sensor exclusion, bounded queries, and distinct triangle light bytes. GPU coverage checks direct-light multiplication, and the real Grove browser test requires a resolved contact byte. Verified 493 unit tests/98 files, build and GPU/Grove browser scenarios; logs `/tmp/web-gta-contact-light-{unit,build,browser}.log`.


## Acquired player body inputs

A second public source now supplies actual player body components through [GTA Stuff](https://gtastuff.com/models/). Its viewer uses `/api/file?name=<filename>&source=player.img` for this archive. The project acquired **11 files / 1,404,928 bytes** into `/Users/teo/Developer/web-gta-content/player`: torso, head, legs, feet and vest DFF/TXD pairs, plus hands.dff. `sources.json` records each URL, response size and SHA-256 hash. These are public-source inputs, not a completed CJ character or a verified redistribution license.

Reproduce with `node scripts/content/audit-player.mjs /absolute/content-directory`. The script validates cached hashes, fetches missing/changed files, parses every clump and dictionary with the project's native readers, and writes `inspection.json`. It neither changes the game character nor bundles/downloads native assets at runtime.

Every DFF contains three clumps, each with 38 frames, a 37-node HAnim hierarchy and a 37-bone skinned geometry. Atomic frame names identify their order as **0 Ripped, 1 Fat, 2 Normal**. The source clothing builder selects geometry by these names; assuming index zero means Normal would be incorrect. All variants of each component have the following counts:

| Component | Vertices | Triangles |
|---|---:|---:|
| torso | 405 | 646 |
| head | 581 | 756 |
| hands | 258 | 300 |
| legs | 287 | 388 |
| feet | 214 | 276 |
| vest alternative | 405 | 646 |

The five base parts total 1,745 vertices / 2,366 triangles before assembly. Matching counts are not a proof that different part skeletons or variants can be concatenated unchanged. Vest and torso files have distinct hashes despite matching topology counts.

All source material texture names are empty. The source [ClothesBuilder.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/ClothesBuilder.cpp) assigns materials during `CreateSkinnedClump`: torso and hands use the constructed torso texture; the other base slots use head, legs and feet. The downloaded raw raster names are `torso` (256×256), `head8bit` (128×128), `legs` (128×256), `feet8bit` (64×64), and `vest` (256×256). Thus ordinary name-based binding of each DFF to its TXD does not reproduce the original clothing pipeline. All five supplied samplers use filter 1 and repeat addressing.

`ConstructGeometryArray` blends named Normal/Fat/Ripped geometry, and `CreateSkinnedClump` builds combined geometry and skin using a separate bones clump. The pinned source explicitly marks `ConstructTextures` and `ConstructGeometryAndSkinArrays` unreversed; their wrappers are not complete algorithm evidence. Remaining work includes validating the skeleton/template mapping, named-variant blending and seam handling, clothing/skin texture composition, material assignment and compatible animations. The reported geometry plugin 0x253f2fd is also still unsupported. No arbitrary texture-name fallback or FAM1-as-CJ substitution was added.

Validation: all 18 clumps and five texture dictionaries parse; a repeat acquisition run uses the verified cache and regenerates the same inventory. The browser loads head and torso, selects all six named variants, verifies their vertex counts and captures their Normal clumps. Raw previews are untextured white silhouettes, so these captures prove geometry delivery, not appearance parity. Build passes. Logs: `/tmp/web-gta-player-{content,browser,build}.log`. Captures: `artifacts/native-player-head.png` and `artifacts/native-player-torso.png`.


## Player template and clothing palette remapping

The depot now also contains `player/player.dff`, fetched with `source=gta3.img` from the same public provider. It has a six-vertex geometry, 33 frames and a **32-bone skin hierarchy**. The body components have **37-bone palettes**. Their slot ordering differs: directly copying component bone indices into the template palette would assign some vertices to the wrong bones. The earlier small-geometry observation should not be interpreted as an unusable asset: `Clothes::ConstructPedModel` passes the pedestrian model clump into `ClothesBuilder::CreateSkinnedClump` as the bones/template input.

All 18 acquired component variants map their positive-weight influences to the template by HAnim node ID. IDs **303, 304, 305, 306, 307** are absent from the template but have zero vertex weights in every inspected variant. No missing weighted bones were dropped or assigned to arbitrary substitutes. The normal torso/legs/feet frame data match each other; head/hands differ slightly, with maximum component inverse-matrix differences around 0.0000051 against torso. That comparison is not permission to concatenate frame arrays.

`remapPlayerSkin` explicitly converts source palette slots through node IDs to destination slots. It preserves weights, creates independent output arrays, derives the used destination palette from positive influences and copies the template inverse bind matrices. A missing positive-weight destination bone is rejected; zero-weight slots normalize to zero. Hierarchy sizes, index uniqueness and IDs are checked. This is the skin-palette preparation step, not complete geometry assembly, texture construction or character replacement.

The acquisition audit now acquires 12 files, parses 19 model clumps and five dictionaries, and regenerates `player/rig-comparison.json` for all 18 component variants. That report records variant names, source/destination bone counts, used target slots and absent unweighted IDs. `sources.json` includes the template URL/hash. Reproduction remains `node scripts/content/audit-player.mjs /absolute/content-directory`.

Validation includes synthetic reordered palettes, rejected missing weighted bones, independent output storage, malformed hierarchy rejection, and the actual downloaded Normal/Fat/Ripped variants against the player template. All weighted source node IDs match their remapped destination node IDs. The player remains the authored placeholder until the remaining geometry, material and animation integration is complete. Logs: `/tmp/web-gta-player-remap-{audit,tests,all-unit,build}.log`.


## First assembled body diagnostic

**Update:** the initial raw `torso.txd`/`head.txd`/`legs.txd`/`feet.txd` binding described below is superseded by the dedicated `player_*.txd` inputs in the next section. The earlier dark patches were not sufficient evidence of missing mesh geometry.

`assemblePlayerBody` now combines the five selected components on the native player template. It validates a consistent named Normal/Fat/Ripped variant, remaps each skin palette by node ID, clones the source data and supplies explicit per-slot texture bindings. The browser adapter keeps five skinned geometries sharing the template's frame hierarchy instead of claiming to reproduce the original combined geometry/seam processing. Template placeholder geometry is excluded.

The diagnostic uses the raw Normal torso/head/hands/legs/feet inputs and explicit torso/head8bit/legs/feet8bit rasters. Hands share the torso raster. All output materials use white RGBA as the source clothing builder does. This is raw base-body material assignment, not the clothing/skin texture-composition pipeline. It does not assemble a vest outfit or normalize texture names globally.

A browser preview initially exposed a sideways stored template pose. Applying the acquired native **FatIdle** pose makes the model upright without an arbitrary corrective model rotation: its measured browser-space dimensions are approximately **0.709 × 1.801 × 0.389**. This is a skeleton/animation compatibility probe, not the intended normal-CJ idle behavior. The assembled body has **1,745 vertices, 2,366 triangles, five 32-bone skinned geometries and four bound rasters**.

The capture `artifacts/native-player-assembled.png` was visually inspected. It shows a recognizable textured body, but also visible gaps and raw-material artifacts around body/clothing boundaries. Their exact causes still require separating geometry/seam processing from texture composition. Consequently the helper is not yet installed as the playable character. The diagnostic replaces neither the authored default nor the existing session character. Stats blending, normal-CJ animation selection, seam treatment and native material composition remain unfinished.

Validation: synthetic/data-contract checks verify source immutability, template palette use, explicit binding requirements and rejection of mixed variants. The browser test renders the native inputs, applies FatIdle, verifies counts and upright dimensions and reports no page errors. A first test-harness attempt removed live workshop controls and caused cleanup errors; the corrected probe overlays its own canvas and retains the workshop DOM. Final checks: 606 unit tests / 128 files and build pass; browser assembly test passes in 1.9 seconds. Logs: `/tmp/web-gta-player-assembly-{unit,all-unit,browser,build}.log`; capture metrics: `artifacts/native-player-assembled.json`.

## Dedicated native base-body dictionaries

The shoulder protrusions observed during this texture investigation are addressed by the native post-animation correction documented below.

The public GTA Stuff file endpoint also supplies `player_torso.txd`, `player_face.txd`, `player_legs.txd` and `player_feet.txd` from `player.img`. The acquisition script now includes these files and records their URLs, sizes and SHA-256 hashes in the depot's `player/sources.json`. The completed inspection contains 16 files, 19 parsed DFF clumps and nine TXD dictionaries.

| Dictionary | Verified raster names | Size |
|---|---|---|
| `player_torso.txd` | `torso`, `torso_fat`, `torso_ripped` | 256 × 256 |
| `player_face.txd` | `face` | 128 × 128 |
| `player_legs.txd` | `legs`, `legs_fat`, `legs_ripped` | 128 × 256 |
| `player_feet.txd` | `foot` | 64 × 64 |

`readPlayerBaseBody` selects the corresponding discrete Normal/Fat/Ripped clumps and torso/legs rasters, shares the torso texture with hands, and binds face/foot explicitly. Each lookup is restricted to its dedicated dictionary. Missing files, missing named rasters and unknown variants are rejected. Source texture pixels and sampler metadata are preserved; this reader does not claim to reproduce the subsequent clothing builder's texture-copy/composition step.

With these inputs, the Normal-body browser preview shows skin and underwear with the earlier large waist/leg black patches removed. A solid-color diagnostic had shown connected waist/wrist/ankle geometry, and a flipped-V experiment worsened texture alignment; no UV-flip workaround was retained. Sharp shoulder protrusions remain visible with the FatIdle compatibility pose, and their geometry/pose cause is not yet resolved. The body is still not installed as the playable character. Continuous stat blending, clothing layers, shoulder/seam handling and the correct normal-CJ animation remain required.

Validation: all three variants resolve exactly four dedicated rasters and five 32-bone meshes; wrong-dictionary and missing-file inputs fail. The browser preview checks exact Normal raster names, upright dimensions, vertex/triangle counts and disposal without page errors. All 608 tests in 129 files and the build pass. The browser diagnostic passes; its log also reports a multiple-Three.js-instance warning from the direct module-import harness, so this is not a warning-free runtime claim. Logs: `/tmp/web-gta-player-base-{browser,unit,build}.log`. Inspected capture: `artifacts/native-player-assembled.png`.

## Native player shoulder correction

The pointed shoulder artifacts were caused by a missing post-animation operation, not by missing triangles. A CPU-skinned comparison between each component and its assembled equivalent isolated the discrepancy to torso influences on HAnim IDs 301 and 302. The largest sampled discrepancy was 0.28224 world units; the head, hands, legs and feet differed by less than 0.000002. The component places those helper bones under the upper arms; the player template places them under Spine1. Changing the template hierarchy would conceal the missing native behavior.

The pinned [CPed::ShoulderBoneRotation](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Ped/Ped.cpp) at `0x5DF560` supplies the actual correction and is called for `MODEL_PLAYER`. For each side it copies the upper-arm matrix into the breast/shoulder helper, expresses it relative to the clavicle, halves the first angle extracted with `ORDER_ZYX | SWAP_XZ`, then restores the clavicle transform. Its paired Euler conversion conventions are defined in [CMatrix](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Core/Matrix.cpp).

`playerShoulderMatrix` implements that rotation/translation calculation with the native singular-branch threshold. `bindPlayerShoulders` resolves the six required bones by native ID and writes the corrected world transforms back through each helper's existing parent. Call it explicitly after player animation/IK and before drawing; it is not applied to arbitrary pedestrians. The browser base-body diagnostic now uses this step. Source vertices, skin weights, inverse binds and parent relationships are unchanged.

Rear, front and side captures show the pointed protrusions removed. Captures: `artifacts/native-player-assembled.png`, `artifacts/native-player-assembled-front.png` and `artifacts/native-player-assembled-side.png`. This remains an unclothed Normal-body diagnostic using FatIdle, not the final playable CJ or a pixel-parity comparison. Clothing composition, normal locomotion and gameplay installation remain unfinished.

Tests cover mixed rotations against independent axis-matrix composition, arm-origin preservation, both singular quarter turns, helper-parent conversion and repeated-update stability. The build and browser check pass. The full unit run passed 610 tests but timed out in the existing three-minute traffic simulation test; the targeted traffic/shoulder rerun is recorded separately in `/tmp/web-gta-player-shoulders-recheck.log`. Other logs: `/tmp/web-gta-player-shoulders-{unit,build,browser}.log`.

## Native vest texture composition

`readPlayerBaseBody(files, variant, 'vest')` now uses the acquired `vest.dff` variant as the torso component and overlays the `vest` raster from `vest.txd` onto the matching base torso skin. The hands retain the shared composed torso texture. The bare-body path remains available. Missing garment assets or raster names fail explicitly.

The [pinned ClothesBuilder source](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/ClothesBuilder.cpp) defines the relevant primitives: `CopyTexture` (`0x5A5730`) copies level-zero raster data and selects linear filtering; `PlaceTextureOnTopOfTexture` (`0x5A57B0`) replaces the entire destination RGBA pixel whenever source alpha is nonzero. It does not interpolate partially transparent source pixels with destination skin. `composePlayerTexture` implements that behavior, keeps inputs immutable, checks matching dimensions and emits an independently owned level-zero texture. This is the supported vest composition path, not a reconstruction of the still-unreversed complete `ConstructTextures` routine or all clothing/stat blends.

Pixel tests verify transparent holes, alpha values 1 and 128, layer ordering and source immutability. Native-data tests check every output pixel for Normal/Fat/Ripped, and confirm that the actual vest geometry replaces the bare torso. Browser cases render both bare and vest bodies with the shoulder correction; front, side and rear vest captures were inspected. The vest covers the torso while leaving skin visible at its openings. Lower-body clothing and shoes are not implemented by this change. Captures: `artifacts/native-player-vest{,-front,-side}.png`.

Build and both browser cases pass. The first full unit run passed 612 tests and timed out in the existing three-minute traffic simulation test; the full-suite rerun with two workers passed all 613 tests in 131 files, recorded in `/tmp/web-gta-player-vest-unit-recheck.log`. Other logs: `/tmp/web-gta-player-vest-{unit,build,browser}.log`.

## Jeans and black low-top sneakers

Four further `player.img` resources were downloaded through the GTA Stuff file endpoint and recorded with URL, byte count and SHA-256 in `player/sources.json`: `jeans.dff`, `jeansdenim.txd`, `sneaker.dff` and `sneakerbincblk.txd`. The acquisition inspection now covers 20 files, 25 model clumps and 11 texture dictionaries. All acquired clothing variants also pass the existing template-palette remapping audit.

| Input | Inspected content |
|---|---|
| `jeans.dff` | Ripped/Fat/Normal clumps, each 294 vertices, 428 triangles, 37 source bones |
| `jeansdenim.txd` | Raster **`legs`**, 128 × 256 |
| `sneaker.dff` | Ripped/Fat/Normal clumps, each 183 vertices, 202 triangles, 37 source bones |
| `sneakerbincblk.txd` | Raster `sneakerbincblk`, 64 × 64 |

The [MTA clothing reference](https://wiki.preview.multitheftauto.com/reference/ID_Lists/CJ_Clothes/Type-3) pairs `sneakerbincblk` with the `sneaker` model. The acquired files establish the actual dictionary raster names and dimensions; notably, the jeans raster is not named after its file. Public content provenance remains distinct from verified retail byte identity.

`readPlayerBaseBody(files, variant, 'classic')` combines the vest, jeans and sneakers with native head and hands. `PLAYER_CLASSIC_FILES` specifies all required inputs. Garment rasters compose over the matching skin slots with the already-verified nonzero-alpha replacement rule and linear sampling. Output materials continue to use the constructed body slot names; garment dictionaries are explicitly scoped so the jeans raster cannot shadow a base skin lookup. The outfit contains **1,721 vertices, 2,332 triangles, five 32-bone meshes and four bound textures**.

The browser renders bare, vest-only and classic outfits, applying the native shoulder correction after FatIdle. Inspected classic front, side and rear captures show the native vest, belt, jeans pockets/cuffs and black low-tops. Captures: `artifacts/native-player-classic{,-front,-side}.png`. This is a fully clothed assembly preview, not gameplay installation, continuous body-stat blending or a pixel-parity claim. Normal-CJ locomotion and animation-driven clothing seam checks remain required.

Validation: all three discrete body variants resolve their native garment geometry and pass per-pixel checks for jeans/shoe composition; missing model and wrong dictionary inputs fail explicitly. All 614 tests in 131 files pass with two workers, the build passes, and all three browser assembly cases pass. Logs: `/tmp/web-gta-player-outfit-acquire.log` and `/tmp/web-gta-player-classic-{unit,build,browser}.log`.

## Native player body in the gameplay character adapter

The idle foot clipping reported during this first integration is corrected by the subsequent [ground alignment work](GROUND_ALIGNMENT.md): authored road collision and capsule dimensions now agree with rendering and the simulation's foot-origin convention.

`readPlayerBaseBody` now returns the explicit `playerBody: true` marker. `NativeCharacter` accepts that marker only with the San Andreas pedestrian coordinate convention, validates the required shoulder bones and applies the native shoulder update **after animation sampling and pose blending**. Generic imported pedestrians do not receive the player-only correction. Failed construction still disposes the candidate model and preserves the previously installed character through the renderer's existing replacement path.

The new browser integration case assembles the **Fat** classic outfit, pairs it with the acquired `FatWalk`, `FatRun` and `FatIdle` clips, sends it through the existing live-session character channel, and verifies walking/running/idle transitions plus simulation displacement. This is a matching-body/animation gameplay probe; it does not claim normal-CJ locomotion. The test currently supplies the assembled source programmatically through the workshop channel. A user-facing multi-file CJ assembly control is still needed.

Inspected walking and idle gameplay captures show the clothed native body replacing the authored player stand-in in the authored neighborhood. The idle shoes visibly clip into the ground: foot placement, animation-root alignment and ground adaptation remain unresolved. No compensating arbitrary height offset was added. The scene is not the separately imported native Grove Street region. Captures: `artifacts/native-cj-fat-{walking,running,idle}.png`.

Validation covers explicit marker/convention rejection, required bones, 60 frames of walk/run/idle blended poses with both helper matrices checked against the source-derived correction, and successful live-session installation. The full pre-final-test suite passed 615 tests; the subsequent focused native-character run covers the added pose test. Build and gameplay browser check pass. Logs: `/tmp/web-gta-player-gameplay-{unit,poses,build,browser}.log`. Unsupported character actions continue to use the existing stand-in fallback; full CJ action coverage, normal locomotion, ground alignment and the importer UI remain unfinished.
