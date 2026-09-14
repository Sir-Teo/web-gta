# Native car model preprocessing

The installed ordinary-car assembly now runs `prepareCarModel` before rendering. Raw DFF previews remain unchanged. This stage implements two parts of the pinned [VehicleModelInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Models/VehicleModelInfo.cpp): `HideDamagedAtomicCB` clears flags when an atomic's own frame name contains the case-sensitive substring `_dam`; the main-wheel branch of `PreprocessHierarchy` moves the wheel atomic onto its dummy and clones that atomic for the other wheel frames. `MoveObjectsCB` reassigns the frame without baking the removed child's transform.

The supported layout has exactly one atomic in the right-front wheel subtree and empty target wheel subtrees. Ambiguous and already-populated targets reject before chassis installation. Conventional dummy names resolve wheel identities unless explicit indices are supplied. The executable's descriptor table has not been extracted, so this resolver is not claimed to reproduce all native vehicle layouts. Geometry and source frames stay shared and immutable; only the prepared atomic list changes. Empty child frames are retained for inspection but no longer affect the moved wheel mesh.

The public archive's `greenwoo.dff` has 54 frames and 24 atomics, including a single wheel atomic beneath `wheel_rf_dummy`. Its wheel child has a small Y offset that the source collapse discards. Preparation produces 27 atomics, ten hidden damaged variants and four references to wheel geometry zero. The four wheels occupy distinct positions. This count includes the low-detail chassis; distance callback selection is not implemented here.

Validation includes source-preserving unit checks, damaged-name case sensitivity, invalid wheel layouts, actual Greenwood archive inspection, assembly rollback and a browser render. The browser diagnostic temporarily hides `chassis_vlo` to inspect the high-detail model, verifies that wheel visibility changes framebuffer output, checks shared geometry and releases GPU resources. Its screenshot is `artifacts/native-greenwood-prepared.png`. It now resolves the own and shared public texture dictionaries; it is not a retail appearance comparison. The preview now applies the first listed Greenwood CARCOLS combination; see CAR_COLORS.md.

Unfinished native setup includes descriptor-driven dummy/extra/upgrade handling, damageable-component frame collapse, paired-wheel handling, component visibility flags and callback ordering, distance-based LOD, wheel scaling/rotation/suspension animation, textures, palette selection, material light/environment effects, and gameplay entry. Cars are not yet included in the published walking areas. This stage does not restore the old authored driving sandbox.


## Per-instance paint materials

`bindNativeCarPaint` implements the four exact RGB markers in `SetEditableMaterialsCB` from the source linked above: `(60,255,0)`, `(255,0,175)`, `(0,255,255)` and `(255,0,255)` select slots zero through three. Alpha is ignored for marker matching and retained during updates. The resolved shared light texture is excluded by identity, because its materials enter a separate native callback branch. Matching a texture name alone would be insufficient when dictionaries provide distinct textures with the same name.

The generic model renderer exposes material-to-source bindings. Each car owns its rendered materials, so repainting does not change another car or the imported DFF. Colors are explicit byte RGB triples; all four slots are validated before mutation. Repeated updates continue to use source markers, avoiding misclassification of previously assigned paint colors. Geometry without material modulation retains its existing behavior. Fade-color metadata follows the current paint. The assembly accepts initial colors and exposes `setColors`, with a disposal guard.

Unit checks cover marker boundaries, alpha, texture identity, unmodulated geometry, atomic validation, source preservation, repeated painting, separate instances and assembly integration. The actual Greenwood browser diagnostic verifies framebuffer changes between two paint schemes, then restores its initial diagnostic colors. The renderer's existing normalized-RGB/color-output policy remains in place; exact retail display conversion is unverified. Random color selection, remaps, active light textures and environmental reflections remain unfinished.


## Verified public vehicle resources

The existing [Noclip San Andreas dataset](https://z.noclip.website/GrandTheftAutoSanAndreas/models/generic/vehicle.txd) also exposes `data/vehicles.ide`, `data/handling.cfg` and `data/carcols.dat`. Exact byte counts and SHA-256 values are recorded in `scripts/content/vehicle-sources.json`. Acquire them alongside the existing IMG depot with:

```sh
node scripts/content/acquire-vehicles.mjs /absolute/content-depot
node scripts/content/acquire-vehicles.mjs /absolute/content-depot --verify-only
```

The downloader uses bounded, hashed staging and atomic installation from the existing acquisition library. Verified files are reused without network requests. Files live under the depot's `vehicles/` directory, separate from world-map IDE discovery. These hashes establish dataset identity, not a retail-version certification. No new game files are committed to the web repository or published by this acquisition step.

The shared dictionary contains 19 textures. All 12 Greenwood references decode: `greenwoo92wheel64` and `greenwoo92interior128` come from `greenwoo.txd`; ten other references resolve from the shared dictionary. This includes tires, steering wheel, glass/scratch textures, lights, grime, generic trim, dashboard and two plate textures. Every selected texture has one supplied mip level; original mip-chain completeness is unverified. The browser diagnostic now renders these textures, preserves paint changes, and verifies GPU cleanup. It uses an explicitly selected native color combination, incomplete lighting/material effects and explicitly hidden low-detail geometry.

Vehicle 492 identifies `greenwoo`, handling key `GREENWOO`, and front/rear wheel sizes 0.7. The complete handling file now parses into 210 base records and 79 specialized rows. TORNADO's `400220000` model-flags token at line 231 remains exact raw data with an explicit conversion issue; it is not dropped or truncated. Native preparation still rejects this out-of-range value. Native loader behavior for this oversized field remains unresolved. CARCOLS now supplies explicitly selected palette combinations; see CAR_COLORS.md.

Validation: `GTA_CONTENT_DIR=/absolute/content-depot npx vitest run tests/native-vehicle-resources.test.ts` verifies all four hashes and the above associations; the existing native-car browser diagnostic verifies the textured render. The published walking areas do not yet load these vehicle resources.

## Light-material marker removal

`bindNativeCarLightMaterials` applies the off-state portion of `SetEditableMaterialsCB` from the pinned source above. Every material referencing the resolved shared light texture receives white RGB while retaining alpha, even when its marker is unrecognized. Its immutable source RGB classifies the four light slots: `(255,175,0)` left front, `(0,255,200)` right front, `(185,255,0)` left rear and `(255,60,0)` right rear. These identities follow `SetupLightFlags` order and ignore alpha during matching. Texture identity, rather than a name-only heuristic, controls entry into this branch.

The assembly applies this before paint binding. Paint changes continue to exclude the light texture, and fade-color metadata stays white. The raw DFF and generic model workshop remain unchanged. This removes the unintended unequal marker-color multiplication visible on the textured Greenwood's rear lamps.

Unit checks cover all slot identities, near-color rejection, alpha preservation, unknown markers, same-name/different-texture exclusion, missing texture rejection and assembled repaint isolation. The native browser diagnostic compares framebuffers before and after marker removal, checks all four slots, and retains its textured paint/wheel/cleanup checks. The updated screenshot remains `artifacts/native-greenwood-prepared.png`.

Active-light texture substitution and surface-property switching remain unfinished. The inspected source stores `gLightSurfProps` at executable address `0x8A645C`; its values have not been verified, so this step introduces no guessed emissive intensity. Brake/headlight activation, projected illumination, coronas, reflections, damage-state behavior and retail pixel comparison remain separate unfinished work.

## Initial suspension wheel pose

The assembly now initializes wheel-frame local Z from the verified `SetupSuspensionLines` calculation in pinned [Automobile.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Automobile.cpp). Front and rear height are computed as `(1 - 1 / (forceLevel * 4)) * springLength + radius - lineStartZ`. The source then initializes every wheel position using its radius minus the **front** height, including rear wheels. This behavior is preserved when front and rear dimensions differ.

`nativeSuspensionRestPose` evaluates the calculation with explicit float32 steps. `applyNativeWheelRestPose` resolves imported frame IDs and replaces only local Z, preserving authored X/Y and basis. All frame targets and positions are validated before writes. Source DFF matrices remain unchanged. The renderer traversal updates world matrices before world-space measurements.

For the public Greenwood, initial local wheel Z changes from about −0.35 m to −0.431818 m. At the measured resting chassis height, rendered wheel centers lie within 1 mm of the 0.35 m tire radius above the diagnostic road. The slight pitch permitted by its unequal front/rear axle offsets accounts for sub-millimeter differences. No handling values were tuned for this check. Unit tests also cover unequal rear dimensions, frame identity, matrix preservation and failed-update atomicity; the textured browser diagnostic uses the same native initialization.

This is initial setup only. `UpdateWheelMatrix` at `0x6AA290` and `PreRender` at `0x6AAB50` remain delegated to the executable in the inspected source snapshot. Dynamic suspension visual updates, wheel spin, steering rotations, special wheel scaling and their timing still require verified implementation. The car is not yet integrated into the published walking areas.
