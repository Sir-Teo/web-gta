# IPL placement reader

The asset pipeline now reads San Andreas text `inst` records and binary `bnry` instance records. The local model preview accepts a separate IPL file and displays matching placements of the selected model. It does not yet assemble a complete district.

## Evidence

- [FileLoader::LoadObjectInstance](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileLoader.cpp) supplies the eleven text fields and negates the quaternion imaginary component when constructing a matrix. Its heading-only path uses the corresponding inverse rotation.
- [FileObjectInstance](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileObjectInstance.h) specifies the 40-byte instance layout: position, quaternion, model ID, instance flags and LOD index. Interior is the low eight bits of instance flags; the complete word must be retained.
- [tBinaryIplFile](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/tBinaryIplFile.h) specifies the 76-byte header and instance offset at byte 28.
- [IplStore](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/IplStore.cpp) resolves streamed LOD indices against a separately selected static instance array. The reader therefore retains nonnegative LOD indices without assuming they index the current file.
- [DragonFF map reader](https://github.com/Parik27/DragonFF/blob/master/gtaLib/map.py) independently uses the same instance offset and forty-byte record layout.

Sources inspected September 13, 2026. These are implementation references; no retail map data or original-game placement capture was verified.

## Supported behavior

Text input accepts comma/whitespace separators, hash comments and CRLF. It retains model names; binary records contain IDs without names. Source positions and quaternion values are preserved. The rendering adapter conjugates and normalizes the quaternion, applies native translation, then converts Z-up to Y-up once. It does not mirror geometry or alter scale. `modelObject` optionally composes this placement above the retained DFF frame hierarchy.

The reader limits source files to 64 MiB and 200,000 instances. It rejects incomplete binary headers/instance ranges, invalid IDs/flags/LOD fields, nonfinite or extreme coordinates, near-zero/non-unit quaternions and malformed text records. Accepted quaternion length tolerance is 0.01; this is an importer policy. Unrelated sections produce notices and are not interpreted. Binary instance count and offset define the consumed range; the header size fields and unrelated section payloads are not used or validated.

## Verification and remaining work

Five unit cases cover matching text/binary diagnostic records, retained flags and external LOD references, quarter-turn orientation on multiple axes, unit scale/handedness, malformed/truncated data, skipped-section notices and placement composed with the independently exported DFF's nested frames. The composed diagnostic top lands at the explicitly calculated runtime coordinate. Existing model browser scenarios verify that the optional adapter does not change unplaced previews.

Next work includes explicit LOD-array ownership, collision import and streaming. Full original clump-root behavior, special object transforms and small-angle heading optimizations still need comparison with source assets and captures. No gameplay scene is replaced by this reader yet.


## Placement preview

Choose a DFF directly or from an IMG, optionally load IDE definitions and textures, then choose a separate IPL file and press **Apply placements**. Text instances match the selected model basename without case sensitivity; binary instances use the selected model's IDE ID and require that definition. Interior selection is explicit, defaulting to exterior 0. No-match and missing-ID cases report an error. **Remove placements** restores the unplaced model; **Clear / cancel** also clears the IPL selection.

Repeated placements clone object hierarchies while sharing geometry, materials, native mip textures and day/night vertex-color buffers. Resources are disposed once through their common owner. The preview fits all displayed instances and records source positions, quaternions, interior flags and unresolved LOD references in metadata. Placement limits are 4,096 instances, two million submitted triangles and 100,000 hierarchy nodes. These are bounded preview policies, not production district-streaming budgets. No LOD switching occurs.

Two added unit cases cover model/interior selection, binary ID requirements, shared mesh resources, one-time disposal and excessive placement rejection. Two browser cases verify repeated placement coordinates, unchanged geometry counts, interior filtering, no-match recovery, restoration to the unplaced model, and binary IPL resolution through IDE data. A captured pair of diagnostic models was visually inspected. Original district fidelity and retail pixel comparison remain unverified.


## Multiple model types

**Assemble archive scene** loads all resolvable model types for the selected IPL interior from one IMG archive. Text names resolve directly; binary model IDs use IDE definitions. Repeated models are grouped and share their own GPU geometry/materials. Each model uses its IDE dictionary or a same-basename fallback and follows loaded texture-parent links. Single-model dictionary overrides are not applied to whole-scene assembly.

Missing model files and missing binary ID definitions are counted as omitted placements; missing dictionaries and unbound texture names are listed. Unsupported or malformed model payloads fail assembly instead of silently treating them as absent. Ambiguous IDE IDs fail explicitly. Clear/replacement terminate the scene worker, and completed geometry/pixel buffers are transferred to the renderer. Reassembly releases all previous model owners.

Scene limits are 4,096 interior placements, 256 model types, two million submitted triangles, 100,000 hierarchy nodes and 128 MiB retained geometry/pixel arrays. Source reading and per-model decoding retain their existing limits; these totals do not bound browser overhead or transient decoder memory. A scene-local cache now shares dictionary parsing, decoded raster objects and GPU textures across model types that resolve to the same source raster.

Two scene unit cases verify grouped repeated models, IDE dictionary binding, omitted placement counts, missing-texture notices, ambiguous IDs and empty interiors. A browser scenario assembles two model types with three instances, verifies world framing and submitted triangles, repeats assembly with stable GPU resource counts, and clears all geometry. Its capture was visually inspected. The production smoke check assembles two diagnostic placements and verifies visible framebuffer pixels using the emitted worker. None of these diagnostic checks establishes full original-map compatibility, automatic LOD ownership, collision or gameplay installation.


## Shared scene textures

Within one scene load, archive dictionary reads are cached by entry offset in the selected file. The source-byte cache evicts oldest entries above 64 MiB; eviction may cause later rereading/redecoding but does not prevent assembling a scene with more distinct source dictionaries. Native dictionary parsing and decoded textures use weak identity caches. Parent fallback reuses the resolved parent raster; child overrides retain distinct identity. Equal texture names from unrelated dictionaries are never sufficient for sharing.

Scene memory accounting counts shared decoded pixel buffers once. Transfer lists deduplicate shared buffers, and the renderer reference-counts GPU textures by the resulting shared raster object. Each model retains separate materials and geometry. Releasing one model leaves shared textures live for the others; releasing the last owner disposes the GPU texture once. Model disposal is idempotent.

The diagnostic scene browser case now uses two model types and three placements referencing one TXD and verifies exactly one loaded GPU texture, unchanged resource counts after reassembly and complete geometry cleanup. Unit checks verify shared decoded identity, independent same-name sources, inherited raster reuse and last-owner GPU disposal. These are resource-count/ownership checks, not full browser heap measurements or district frame-rate benchmarks. Source-cache eviction and transient decoder allocations can reduce sharing and increase peak memory; persistent streaming caches remain unfinished.


## Archived IPL selection

The placement panel now lists searchable IPL entries from the selected IMG, with up to 200 matches. An archived entry can drive both the selected model's placement preview and complete archive-scene assembly. Only its payload slice is read, under the existing IMG bounds, packing and 64 MiB limits. Separate IPL files take precedence over archive selection; preview metadata identifies the source actually used.

Trailing zero sector padding is removed from text IPL input before section parsing. Binary instances continue to use their declared offsets/counts. Removing placements clears both choices, and switching or clearing the archive discards its placement selection. Files remain local and are not persisted or uploaded.

A unit case verifies padded archived text parsing, source labels and external-file precedence. A browser scenario searches/selects an archived IPL, assembles its scene, reports a malformed entry, overrides it with a separate file, removes placements and clears the archive. Binary IPL parsing and IDE ID resolution retain their existing unit/browser coverage; this new scenario uses an authored text fixture. One explicit static/streamed pair is now supported as described below; multiple streamed sources and automatic relationship discovery remain unfinished.


## Preserved visibility metadata and LOD identity

Scene parts now retain their unfiltered source placement indices, text/binary format and resolved IDE definition. Grouping repeated models and filtering interiors do not renumber those indices. The worker reports each selected placement's nonnegative LOD target as local, other-interior, missing-model, missing-placement or external-static-array. Binary links are always external-static-array until a corresponding static source is supplied; numeric overlap with a streamed placement is not sufficient to establish a link. Local status means that the indexed target exists and is loaded, not that the scene is complete or ready for source-accurate rendering; cycle validation is described below.

The IDE reader preserves draw distance and flags for `objs` and `tobj`, plus on/off hours for timed objects. It accepts supported modern layouts and legacy one-to-three-distance layouts, retaining the first distance as the source loader does. Distances must be finite and nonnegative within the importer's coordinate-scale limit; flags retain 32-bit bit patterns, including signed decimal representations; visibility hours must be integers from 0 through 24. Three-field association-only records remain accepted without visibility metadata. Other IDE sections still supply only associations. Model-name merging retains the last equivalent dictionary association and its metadata; it does not yet validate conflicting visibility definitions.

The workshop exposes these fields and target classifications in scene metadata. Visual placement behavior remains raw: no LOD suppression, fades, distance culling or streaming has been introduced. Playable-scene timed visibility is described below. Collision installation retains its current independent behavior.

Primary references checked at gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp): `LoadObject` and the timed-object loader select modern versus legacy fields and use the first draw distance. `LinkLods` uses original loaded-building indices. This supports preserving identity before filtering/grouping rather than deriving links from model groups.
- [IplStore.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/IplStore.cpp): streamed objects resolve LOD indices through a selected static entity array. The paired-source workflow below now supplies that relationship explicitly.
- [Renderer.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp): map visibility considers draw distance, camera multiplier, collision bounds, far clip, fading, model availability and LOD-child state. A section of the pinned LOD-list code initializes a loop condition false before testing that condition; this is a reason to verify the reverse-engineered control flow against stronger evidence before porting it. The source is not sufficient by itself to claim exact retail renderer behavior.

The next renderer work requires loading related static/streamed sources with explicit namespaces, validating links and cycles, and verifying child/fade selection. A nearest-distance toggle alone would not reproduce the source behaviors above. Diagnostic coverage now checks preserved indices after interior filtering and model grouping, missing targets, a binary index that must not resolve locally, modern/legacy visibility fields and invalid numeric data. Browser coverage verifies readable metadata while retaining the existing geometry/resource counts. Original-map compatibility and pixel fidelity remain unproven.


## Explicit static and streamed IPL pair

When the primary placement source is binary, **Static .ipl for streamed LODs** accepts one separate text IPL. Assembly reads both and groups their model instances together while retaining per-placement references: namespace (`primary` or `static`), original index, format, source label and optional LOD target. A streamed index targets the static namespace; a text index targets its own namespace. The same numeric index can therefore occur in both files without aliasing, including within one shared model group. The source references remain attached to scene parts sent to the game.

A supplied static source must be text, and pairing is rejected for a text primary. Without a supplied static source, binary links remain explicitly unresolved. Combined selected-interior placement counts and decoded model/texture/geometry budgets use the existing scene limits. Both files retain their individual 64 MiB input caps. Known LOD chains are checked for cycles iteratively before model decoding; missing targets remain reportable rather than being invented or redirected. Local and resolved-static statuses identify available target placements, while omitted models and other interiors retain their distinct statuses.

The workshop shows both source labels and scoped placement keys. **Remove static IPL** reassembles the primary alone; it also restarts a pending assembly through the existing worker-cancellation path. **Remove placements** and **Clear / cancel** clear the static file as well. The picker applies to whole-scene assembly; selected-model placement inspection remains a single-source workflow. Files are neither uploaded nor persisted.

Unit coverage verifies equal numeric indices across namespaces within one model group, resolved static targets, incompatible formats and cyclic static links. The browser assembles two sources, inspects scoped metadata, removes the static source, checks that its geometry was released and clears the remainder. Production smoke resolves the same relationship using the emitted worker without development hooks. These are original diagnostic fixtures.

The relationship follows the pinned `IplStore` static-array lookup described above; the user must choose the matching base file. Automatic discovery and multiple streamed files are not yet implemented. LOD render selection/fading, distance visibility, streaming residency and original LOD collision sharing remain unfinished. In particular, current raw scene rendering still treats loaded placements independently; collision now excludes resolved LOD targets as described below; successful link resolution does not prove correct visual replacement or collision ownership.


## Playable timed-object visibility

Installed `tobj` model groups now follow their retained on/off hours. The runtime uses the current whole game hour, includes the starting hour and excludes the ending hour. Overnight ranges wrap across midnight; equal hours are inactive; 0–24 is active all day. Input minutes are normalized to a day and must be finite. Missing schedules remain unfiltered, while a partial or invalid supplied schedule fails installation before resource allocation.

[Clock.cpp, pinned commit](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clock.cpp) implements the corresponding `GetIsTimeInRange` predicate. The browser sets initial visibility at installation and updates it only when the hour changes. It reads simulation time, so pause freezes the clock and cannot advance the schedule. Group visibility changes do not allocate/dispose meshes or remove collision. Static inspection previews intentionally retain all imported placements.

This implements the interval gate, not the full timed-model streaming path. The pinned [Renderer.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp) also considers the availability of a corresponding timed model before hiding an out-of-range object. Counterpart identification and installed-scene fallback are described below. Source collision ownership, fades and streaming residency remain unimplemented here. Current installed collision persists even when its visual group is hidden; that behavior is explicitly tested but is not a claim of original collision fidelity.

Unit coverage checks ordinary/overnight boundaries, equal and full-day schedules, negative/day-wrapped minutes, invalid data, unchanged collider counts and disposal. The real-browser imported-floor scenario assigns a 17–18 schedule, walks and pauses normally, then waits for the actual clock to reach 18:00. It verifies zero visible imported instances, unchanged geometry allocation and retained ground support. Production smoke also installs a timed floor at an active hour; it does not wait for that boundary. Original assets and retail visual comparisons remain unavailable to these diagnostic checks.


## Timed-model counterpart availability

Scene assembly now retains registered day/night counterpart names on each timed model part. The lookup follows the pinned [TimeInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Models/TimeInfo.cpp): it checks the first literal `_nt` marker, otherwise `_dy`, replaces from that marker to the end of the name, and looks up an already registered timed definition. Lookup is case-insensitive while marker detection is case-sensitive. The relationship is linked in both directions, following the reciprocal registration in the pinned [FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp).

The normal two-name pair links in either registration order. Unusual names with trailing text after a marker can depend on definition order; no suffix-end assumption is imposed. Only timed definitions qualify. Assembly uses the supplied merged IDE record sequence, so it does not reconstruct overwritten definitions or original global registration history.

At installation, the runtime records which model names actually have loaded scene parts. An in-range timed group is visible. An out-of-range group hides when it has no registered counterpart or when that counterpart is loaded; it stays visible when its registered counterpart is unavailable. This follows the availability gate in the pinned renderer reference above. An unrelated missing model or an unregistered guessed name does not activate fallback. Workshop metadata shows the counterpart name and whether it has a loaded scene part.

Availability here means the installed scene's model set, not the contents of every local archive or a global streaming manager. The importer does not proactively load unplaced counterparts, add missing replacement placements, implement asset residency changes, or transfer collision ownership. Reinstalling a scene recomputes availability. Both groups may be visible if their supplied time intervals overlap; this change does not rewrite source schedules to make them complementary.

Unit cases cover normal and reversed registration, unpaired/non-timed records, case-sensitive markers with case-insensitive lookup, marker truncation/order behavior, preservation of an unplaced registered counterpart, and runtime visibility with missing versus loaded counterparts. Browser metadata verifies loaded counterparts before static-source removal and unavailable counterparts afterward; the existing real-clock scenario still verifies that an unpaired object hides at its off hour. Production smoke remains a general regression check rather than a counterpart-specific runtime scenario. Original retail streaming/visual parity remains unproven.


## Collision participation of LOD replacements

Resolved LOD replacement placements are now excluded from playable collision. The shared collision planner uses namespaced placement references, not model-name prefixes or filtered array positions. Detailed child placements retain their own collision. Exclusion is per placement: an unrelated instance of the same model remains collidable. A replacement is excluded even if it has COL data, and a replacement without COL data no longer prevents entering the scene. Missing collision on a detailed or otherwise collidable placement still prevents installation by default.

The planner validates reference counts/identity and known cycles before physics allocation, under the combined 4,096-placement cap. It does not guess unresolved external LOD targets. The workshop's playability check, runtime collider limits/installation and supported-spawn search use the same planner. Model geometry and collision metadata remain owned by their original scene parts; source inspection overlays still display supplied collision data even for replacement entities that are not collidable in the game.

The pinned [FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp) calls `SetupBigBuilding` for entities with LOD children. The pinned [Entity.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp) makes those entities non-colliding. This supports excluding replacement entities from player/camera physics while retaining their visual and bounds data. FileLoader also shares collision-model data for a single-child LOD and has additional multi-child and draw-distance-dependent behavior; that complete ownership/bounds logic is not implemented here.

Unit coverage verifies multiple detailed children with a COL-free replacement, exclusion when a replacement supplies COL, required collision on details, per-placement ownership within one model, and rejection of cyclic/duplicate identity. The browser and production imported-floor workflows now include a distant replacement with no COL. They open through the normal workshop action and spawn/walk on detailed collision. The timed browser check hides the detailed visual at 18:00 while the raw replacement remains visible and ground support persists.

Visual LOD replacement/fading, collision-bound inheritance, ordinary large-building classification from camera-scaled draw distance, and original streaming ownership remain unfinished. This change does not establish full original collision or world fidelity.


## Single-child LOD visibility bounds

Scene assembly now retains visibility bounds independently from active collision. Models with COL data initially use their own source bounds. A resolved LOD target with exactly one detailed child can inherit that child's loaded COL bounds, following the single-child sharing branch in the pinned FileLoader reference above. The retained record names its donor and marks inheritance. Bounds stay in native model coordinates and reference the existing bound data; no collision mesh is duplicated, moved or installed on the replacement.

Sharing is recorded at model-part scope, matching the source's model-level collision-data association. Repeated targets of one model may therefore nominate the same donor. If distinct collision objects nominate conflicting donors for that model, the importer reports ambiguity and retains its own bounds instead of selecting one by incidental iteration order. A multi-child target retains its own aggregate bounds unless another single-child instance of that same model establishes an unambiguous model-level donor. Missing donor collision is reported, with no fabricated bound.

This is a direct loaded-child bounds adapter. It does not reproduce order-dependent, multi-level collision-pointer propagation or mutate original COL ownership. A child that only has inherited visibility bounds cannot currently donate a full collision model further up a chain. Playable rendering now uses these retained radii to limit nominal draw distance against the far clip; inspection remains raw. Source fades and frustum policy remain unfinished. Workshop metadata exposes radius, donor and inheritance so the source relationship is inspectable before those renderer changes.

Three unit cases verify shared bound identity without active collision, aggregate and conflicting-donor behavior, and missing-data handling. Browser and production imported-scene checks verify that a collision-free replacement reports bounds inherited from the detailed floor before opening the game. These original fixtures establish the data relationship, not original-map rendering or pixel fidelity.


## Loaded-scene distance and LOD selection

Playable imports now select visibility per placement after the current frame's camera and lighting update. The nominal range is the smaller of the supplied IDE draw distance and camera far clip plus the retained COL visibility radius. A missing draw-distance definition imposes no extra IDE cutoff. Distance is measured from the linked, loaded LOD placement's origin when present, otherwise the object's own origin. Native positions are converted consistently to the renderer's axes. Unresolved references do not invent a replacement or another origin.

A precomputed child-first order handles grouped models, shared replacements and nested relationships without recursive per-frame traversal. Any selected child suppresses its replacement and propagates coverage to higher replacements. Once no child supplies coverage, an eligible replacement can render. Model-root timed visibility composes with the per-placement gate; distance selection cannot reactivate an out-of-range timed group. Visual selection never removes colliders or reallocates model owners. Three.js may register a previously hidden geometry on the GPU when it first renders.

These inputs come from `SetupMapEntityVisibility`, `SetupEntityVisibility`, `SetupBigBuildingVisibility` and `ProcessLodRenderLists` in the pinned [Renderer.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp). The implementation deliberately remains a nominal-distance loaded-scene stage: multiplier one, hard cutoffs, no source distance adjustment/fade band, low-LOD scale, model alpha, streaming availability or original occlusion. Ordinary Three.js mesh frustum culling occurs afterward and does not feed coverage counts. Shared groups with different child ranges can therefore show only the eligible detailed subset. The reference's suspicious `bAllLodsRendered` loop and complete aggregate behavior still require stronger verification before claiming source parity.

Unit cases exercise exact cutoff boundaries, timed-root composition, shared and nested replacements, parent-origin coordinates and inherited radius. The browser imported-floor fixture uses co-located detail/replacement and a six-unit diagnostic cutoff: real V camera controls switch to the LOD and restore detail, then the actual 18:00 clock boundary restores the LOD while the player stays grounded. GPU geometry counts remain stable after both choices have first rendered. Production uses the same co-located pair with its ordinary 200-unit definition. No retail geometry or pixel comparison is implied.


## Frustum eligibility before LOD coverage

The playable visibility pass now checks each placement's world-space sphere against the current camera frustum before that placement supplies LOD coverage. Retained visibility bounds take precedence over the model's own COL bounds. The native center is transformed by the receiving placement matrix, including inverse IPL rotation and axis conversion; an inherited bound is not transformed by its donor's placement. Radius contributes to both frustum intersection and the existing far-clip distance limit.

With no COL bounds, a sphere enclosing the loaded static geometry supplies a conservative fallback. Its radius also extends the far-clip distance limit, preventing an object that intersects the far plane from disappearing merely because its origin lies beyond that plane. Empty unknown bounds remain eligible rather than being guessed as a zero-radius object. Bounds are computed at installation for static imported placements. A future animated or moving imported-entity path must refresh them.

Each update refreshes the camera world matrix and projection-view frustum before child-first selection. Camera turns, projection changes and camera parent transforms therefore affect the same frame's coverage decision. Timed eligibility, distance and LOD suppression continue to compose without changing physics or GPU ownership. Mesh-level Three.js frustum culling still follows; it is not original occlusion testing.

The pinned [Entity.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp) defines `GetIsOnScreen` through a collision sphere whose center is transformed from object space. The pinned [Renderer.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp) checks on-screen and non-occluded status before incrementing the parent's rendered-child count. However, [Camera.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Camera.cpp) still delegates the lower-level sphere test to the native executable and includes a mirror-camera alternative. The browser uses Three.js's six-plane frustum; exact original edge cases, mirrors and occlusion remain unverified.

New unit cases cover an off-screen child with an on-screen replacement, immediate camera turns, rotated/inherited centers, changed projection, invalid source spheres, geometry fallback, parented camera transforms and far-plane intersection. The existing real-browser imported-floor test remains integration coverage for distance/time selection and collision support; the deliberately disjoint child/replacement scenario is unit coverage, not a retail-image comparison.

### Source evidence for the next fade stage

The pinned [constants.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/constants.h) defines maximum fading distance 20, low-LOD distance 150, LOD distance 300 and streaming distance 50. [VisibilityPlugins.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/VisibilityPlugins.cpp), `CalculateFadingAtomicAlpha`, combines model alpha with `min((drawRadius + 20 - distance) / fadingDistance, 1)`. Its no-parent path adjusts fade width beyond 150 and applies low-LOD scale for big buildings. These are inspected reference inputs, not implemented fade behavior. Applying them also requires distance-selection alignment, material alpha/depth behavior and LOD coverage during partial opacity.


## Loaded-model distance fading

Playable imports now use the inspected distance-alpha formula with loaded model alpha 255 and distance multipliers one. A linked detail uses a 20-unit fade width ending 20 units beyond its nominal range. An unparented model whose effective draw distance exceeds 150 uses `effectiveDrawDistance / 15 + 10` for the width. Alpha is truncated to a byte and clamped to the renderable range. Missing IDE draw distance retains the conservative non-fading fallback; it is not treated as original model data.

Fading begins at `drawRadius + 20 - fadeWidth`, including that boundary. Detail in this band does not claim opaque LOD coverage, so its replacement remains eligible even at the band's initial alpha 255. A zero-alpha detail is hidden. Timed model eligibility and sphere-frustum checks continue to apply, and visual fading never changes physical ownership.

Each placement captures its original mesh/material references and lazily creates reusable fade-material copies. Copies are shared among that placement's meshes when the source material is shared, but never mutated across placements. They retain source textures, geometry, custom shader callbacks and the existing depth-write policy. Fade alpha caps material opacity with `min(sourceOpacity, alpha/255)`; it does not multiply material opacity. Fade materials enable blending and remove the ordinary alpha-test threshold. Original material RGB is retained as metadata and applied while fading, matching the source's forced material-color modulation. Restoring full detail reattaches the original materials. Scene disposal restores references and releases only owned copies before source resources are released.

The source evidence is `CalculateFadingAtomicAlpha`, `RenderAtomicWithAlpha`, `RenderEntity` and `SetupRenderFadingAtomic` in the pinned VisibilityPlugins reference above, plus the fade path in Renderer. The latter keeps detail out of opaque child counts while it is queued for distance fading. No fade-specific unconditional depth-write disable was found in these inspected paths, so this change preserves existing material depth behavior. That existing behavior and Three.js transparency sorting are not a verified reproduction of all original draw ordering.

Verification includes numerical fade-band boundaries, expanded widths, nested/shared LOD transitions, alpha capping, shader callback retention, material-array reuse, sibling isolation and idempotent cleanup. A 64×64 real WebGL probe reads pixels from two placements sharing a material: fading one to 64 preserves the other at 128, a cap above the original alpha leaves it at 128, and restoration returns the original appearance. A separate sample checks forced RGB modulation during fading. The imported-floor browser scenario now expects detail plus replacement at the far camera, restores detail alone with the near camera, and still verifies the actual timed transition, stable warmed geometry and ground support.

Original model streaming alpha, camera/low-LOD multipliers, the special distance correction above 300, complete big-building classification, aggregate LOD arbitration, additive flags, original sorting/occlusion and retail visual comparison remain unfinished. This is source-derived loaded-scene fading, not a claim of complete source renderer parity.


## IDE flags in the distance-fading path

Fade materials now receive the scene part's retained IDE flags. The supported bits are `0x8` for additive blending, `0x40` for disabled depth writes, and `0x200000` for disabled backface culling. Additive fading uses source-alpha/one blending. Two-sided fading uses one draw pass, avoiding Three.js's default two-pass treatment of transparent double-sided materials. Unset and unrelated bits preserve the existing fade material behavior. Source materials remain untouched and are restored on leaving the fade band.

The mapping is explicit in the pinned [eItemDefinitionFlags.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Enums/eItemDefinitionFlags.h) and [BaseModelInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Models/BaseModelInfo.cpp), `SetBaseModelInfoFlags`. The inspected `RenderEntity` and `SetupRenderFadingAtomic` paths in the pinned VisibilityPlugins source apply depth-write suppression, culling changes and additive destination blending during distance fading.

This implementation is limited to that fading path. Ordinary non-fading flag behavior, draw-last queue semantics and complete render-order compatibility remain unfinished; returning to full detail restores the pre-existing source material policy. These flags do not infer glass behavior, roads, destructibility, tree animation or collision exclusions.

The GPU probe measures normal versus additive blending over a non-black background, front-face culling versus two-sided drawing, and depth-write suppression using a later drawn surface behind the faded plane. The unit test checks the same material policies, unchanged originals, restoration and unrelated bits. These diagnostic checks establish the browser blend/depth/culling behavior, not retail-scene fidelity.


## Persistent two-sided imported objects

The `0x200000` no-backface-culling flag now applies to fully visible imported placements as well as their distance fades. A flagged placement owns a normal material override that changes only culling/pass policy; original opacity, alpha test, blending, depth writes, texture references and shader callbacks are retained. Its fade override remains separate. Returning from a fade reuses the normal two-sided override, and disposal restores the shared source materials and releases both owned sets exactly once.

The pinned Entity reference above copies the model's culling property into the entity in `SetModelIndexNoCreate`. In the pinned Renderer reference, `RenderOneNonRoad` disables culling around rendering a non-vehicle entity with that property and restores it afterward. This supports preserving culling across visibility states rather than tying it only to fade alpha. The browser uses placement-owned materials to express the state without mutating shared resources.

Unit coverage checks normal/fade reuse, material-array sharing, sibling isolation, unchanged non-culling properties and disposal. The GPU probe renders a back-facing plane at full visibility, through a fade, and after returning to full visibility. All three stages retain the flagged back face. Ordinary draw-last/depth-write semantics, road-specific rendering and full original render-order/light behavior remain unfinished; this does not establish retail pixel parity.


## Normal draw-last materials and distance ordering

The retained `0x4` draw-last bit now creates a normal placement-owned material override using Three.js's transparent queue. In this path, `0x40` disables depth writes and removes the normal alpha threshold. Otherwise exterior placements use the inspected threshold 100/255, while interior placements use zero. Normal draw-last does not enable additive blending merely because `0x8` is present: the inspected additive setup belongs to distance fading. Two-sided policy remains composable with these normal overrides.

Each selected fading or draw-last placement assigns its meshes a render order derived from negative camera distance, producing farthest-first ordering among those imported queued meshes. It uses the same parent-origin distance already calculated by scene visibility. Ordinary placements recover their captured render order, and disposal restores both material and order ownership. Material copies are reused when moving between the normal and fade paths.

The pinned Renderer reference routes draw-last and fading entities into the alpha list in `AddEntityToRenderList`. The pinned VisibilityPlugins reference chooses normal alpha/depth policy in `RenderEntity`, inserts by distance and traverses the ordered list from tail to head. [Core/LinkList.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Core/LinkList.h), `InsertSorted`, establishes ascending insertion, hence descending rendering.

Unit checks cover normal queue material policy, interior/no-depth-write exceptions, transition reuse, distance validation and render-order restoration. GPU checks verify that low alpha is discarded outdoors but survives indoors and with no-depth-write, and that changing supplied placement distances reverses the composition of overlapping red/green surfaces even when their geometric depth order stays fixed.

This is the ordinary imported alpha-queue adapter. Underwater and special really-draw-last queues, original queue capacity/fallback, equal-distance tie order, ordering relative to every other renderer family and exact threshold-edge behavior remain unverified. The previously noted distance corrections and retail pixel comparisons also remain unfinished.

## Multiple streams belonging to one static IPL

The scene importer now accepts additional binary IPLs from selected IMG entries and/or separate files. The primary stream retains namespace `primary`; added streams use `stream:1` through `stream:255`, while the explicitly selected static text IPL remains `static`. Each stream retains its own original indices and targets the shared static array, consistent with the IplStore relationship described above. Files are not concatenated into an instance array whose offsets would corrupt LOD references. The collision planner accepts the additional bounded namespaces and excludes a shared replacement once, retaining every detailed child.

The caller explicitly chooses related streams: automatic filename-family discovery and validation against original game registration metadata remain unfinished. Missing static files produce unresolved external-array links for every stream, not guessed local links. Additional text IPLs, duplicate case-insensitive stream filenames, more than 255 added streams, aggregate source data above 128 MiB and combined input above 200,000 instances reject. The existing 4,096 selected-interior placement and scene geometry/resource limits still apply. This is multi-file scene assembly, not dynamic whole-world streaming.

Workshop controls support multiple archived and external streams. Searching archived placements preserves already selected additional streams even outside the current matches. Replacing the archive clears its additional entry selections so numeric entry indices cannot silently select unrelated files; clearing/removing placements clears additional selections too. Metadata reports all actual source names and distinct LOD keys. Placement/collision pickers now use full-width stacked controls; inspected browser capture: `artifacts/multi-ipl-preview.png`.

Verification: 473 unit tests across 95 files; build; two focused browser scenarios pass. New cases cover two streams with repeated index zero sharing one static target, collision exclusion without losing children, archived stream labels, duplicate selections, incompatible formats, three browser streams from mixed sources, preserved search selections, static-source removal, archive replacement and geometry cleanup. These diagnostic fixtures establish bookkeeping behavior, not retail district or pixel accuracy.

## District stream discovery

**Select district streams** now derives the case-insensitive `<static-stem>_stream` prefix from the chosen static IPL and selects matching archived IPL entries. This follows `CIplStore::SetupRelatedIpls` in the pinned [IplStore.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/IplStore.cpp), inspected locally at lines 754–792: it appends `_stream` to the extracted static name and compares that prefix case-insensitively before assigning the static array index. The matcher deliberately does not require numeric suffixes or numerically reorder them.

The browser keeps archive directory order, selects the first match as primary and the remainder as additional streams, and clears prior external stream selections. This is an explicit button action; it does not auto-load assets. No match or excessive match count leaves prior selections unchanged. It includes matches beyond the ordinary search display's 200 rows, within the existing 256-stream total limit. Binary format and LOD validation occur during assembly. Native IPL pool registration order across multiple archives is not recreated; directory order is the local importer's deterministic ordering, and each stream's indices remain independent.

Validation: 475 unit tests across 96 files and build pass. The district browser scenario now uses the button to find two out-of-numeric-order archived streams, then adds an external stream and verifies shared LOD links, search selection retention, static removal, archive replacement and cleanup. This does not establish real district contents, full registration metadata or dynamic streaming parity.

## External scene texture dictionaries

Scene assembly now accepts multiple external TXDs, keyed by case-insensitive filename. Explicitly selected files override same-name IMG dictionaries for both the IDE-selected base and its parent chain. Parent texture lookup still fills only unresolved child texture names. This enables importing separately stored map dictionaries without renaming or repacking the IMG. The existing single-model manual TXD picker is independent.

External dictionary bytes share the scene's bounded 64 MiB retained-source cache with archived dictionary bytes. External cache keys are File identities, while archive keys remain offsets within the selected IMG; these cannot collide. Shared decoded rasters remain shared across model types and placement instances. External selection is limited to 256 files/128 MiB total and 64 MiB per file; existing chain/decode/scene limits still apply. Duplicate case-insensitive filenames reject explicitly. Scene notices list selected external dictionary overrides, and clear resets the scene dictionary picker.

Verification: 477 unit tests/96 files, build and two focused browser scenarios pass. Unit cases verify an external base replacing an archived base, an absent base supplied externally, shared decoded identity, an external parent filling an absent child texture and conflicting external filenames. The district browser scenario supplies its missing shared TXD, verifies no unbound-texture notice, one GPU texture across four placements, and texture disposal/input clearing. Existing archived-parent behavior also passes. The updated diagnostic capture was visually inspected. Retail texture coverage, platform-specific lighting comparison and multi-archive texture registration remain unfinished.

## Bounded native map-area assembly and Grove validation

The workshop can limit assembly to a native XY center/radius. Selection uses placement origins before model decode, then includes every reachable same-interior LOD ancestor. Filtering preserves original source namespaces/indices and original ordering. Radius must be finite and positive. This allows a useful local scene from a district that exceeds model limits as a whole. It is not a spatial intersection query: large objects with origins outside the radius may overlap the selected area and remain absent. Input dependency limits and the 4,096-instance/256-model scene limits remain intact. Dynamic streaming is not implemented by this filter.

A real sample from the public Noclip archive was assembled with `LAe2.ipl`, all seven `lae2_stream` entries, all archived COLs and a 180-unit region at `(2495,-1687)`. Relevant definitions were `generic_*`, `LA_*`, `leveldes_*`, `interior_propext.ide`, and `txd.ide` from the viewer's public manifest. Result: **171 model types, 469 placements, zero omitted placements and zero missing required collision models**. Sixty-three resolved LOD replacements are excluded from playable collision. Metadata still reports unsupported non-instance IPL sections, and LOD-only models without COL data generate source-inspection notices.

Do not indiscriminately combine every IDE on the public host: `country/countn2.ide` and `leveldes/leveldes.ide` both define ID 16700 with different models. The audit retained the applicable district/shared files; full game registration order and dataset-version reconciliation are still required for a world-wide import. `interior/propext.ide` supplies the otherwise missing exterior basketball-hoop and vending-machine definitions 947/955.

Another real-data issue was `generic/dynamic2.ide`'s five-field type-one legacy record. The pinned [FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp), `LoadObject`, first scans five fields, then accepts at least five assignments in the type-one fallback. Its previously read flags survive the absent sixth field. The parser now supports that precise untimed case; e.g. `1 0` yields draw distance 0 and flags 0. Type-two/type-three and timed layouts retain their existing validation.

Chrome verification opened the assembled scene in gameplay, confirmed all 469 instances installed, found the player grounded, and moved roughly 4.1 world units with a 1.2-second W input while grounded. Screenshots `artifacts/native-grove-preview.png` and `artifacts/native-grove-walk.png` were inspected. The runtime still uses the authored character; camera/spawn selection, lighting, region-edge completeness and original visual parity are not established by this walk. No world assets were bundled.

Ordinary validation: 480 tests across 96 files, build, and the district browser scenario pass. That browser case additionally narrows to one detailed placement, retains its distant static LOD, and restores the full selection. Real-asset audit outputs are `/tmp/web-gta-world-scene.json`, `/tmp/web-gta-grove-browser-summary.txt`, `/tmp/web-gta-grove-game-state.json`, `/tmp/web-gta-grove-browser.log`; temporary runners moved outside the ordinary suite to `/tmp/web-gta-world-scene.local.test.ts` and `/tmp/web-gta-grove-world.local.spec.ts`.
