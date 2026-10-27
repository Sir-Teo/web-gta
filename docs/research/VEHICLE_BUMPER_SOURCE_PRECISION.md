# Vehicle bumper source precision

The shared vehicle bumper source now uses the captured float32 operation order
for dummy offsets, orientation transform, physical-origin addition and boat
world-height lift. This replaces the host double transform while retaining its
selected quaternion-derived basis and interpolation inputs.

## Independent references

The existing pinned native executable has SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`
and size 14,226,544 bytes. Actual `Process_1stPerson` source selection at
`0x100217890` executes, including actual `CMatrix::TransformVector`
`0x1002cb268`, vehicle-position addition and boat height. Capture stops before
bike neck/LOS or upside-down protection.

`scripts/research/emulate-vehicle-bumper-source.py --source-precision` produces
144 fixed cases covering automobile/quad, boat and bike source branches,
nonzero ignored dummy X, varied dummy offsets, tilted/scaled bases, large and
negative world positions, rounding edge values, and distinct selected-matrix
and body positions. They are checked in as
`tests/fixtures/vehicle-bumper-source-reference.json`.

The independently pinned PC `Cam.cpp` source has SHA-256
`2df8f5b892109c4f71173b09558877dbdc79ef0ec6cf3fb15bbfcce9962a214d`
at revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.
`scripts/research/capture-pc-bumper-source.py` compiles its unmodified
dummy/source fragment and boat-height line with declared scalar float32 matrix
and vector primitives and FP contraction disabled. It now accepts a separate
body `position` input, defaulting to the selected matrix position for older
recordings. Full-precision decimal output preserves exact float32 results.
All 144 source-compiled PC results equal the actual native outputs exactly
(`artifacts/vehicle-bumper-float-pc.json`). This is a source-compiled reference,
not a retail-PC executable capture.

## Scalar order

The helper ignores dummy X, adds float32 0.08 to dummy Y and 0.62 to dummy Z,
multiplies the three selected basis rows, adds those products in native order,
and adds the separately declared body origin. Every scalar step rounds to
float32. Boat world Z then adds float32 0.5. Bike neck/velocity/visibility,
upside-down lift and look routines remain following stages.

## Validation and limits

All 144 new reference cases and 999 focused camera/ownership checks pass, as
does TypeScript. The preceding body-origin checkpoint measured a residual
0.0001220703125-metre native disagreement from the double source transform.
Its 53-frame recording and verification were retained as
`artifacts/vehicle-bumper-float-baseline-origin.json` and
`artifacts/vehicle-bumper-float-baseline-verification.json`.

The browser's independent seat geometry checks use double transforms. Their
boat and quad thresholds now allow one millimetre for float32 world-coordinate
quantization; fixed native fixtures and separate live native/PC replay enforce
exact scalar behavior. The selected basis, interpolation, model dummy inputs,
building-query membership and bone services remain explicit host boundaries.
Whole retail-PC camera ownership, x87 settings, displayed-axis identity and
matched PC images are outside these source checks.

All 14 bike/quad models pass their browser height, movement and visibility
fallback checks. All 149 recorded base sources match both actual native output
and the source-compiled PC fragment exactly. All 139 bike camera sources after
the following neck/velocity/LOS stage also match native output exactly.
Evidence: `artifacts/vehicle-bumper-float-bike-live.json`,
`artifacts/vehicle-bumper-float-bike-base-native.json`,
`artifacts/vehicle-bumper-float-bike-pc.json`,
`artifacts/vehicle-bumper-float-bike-height-native.json` and
`artifacts/vehicle-bumper-float-bike-verification.json`.

All 53 controlled banked/moving origin observations now match native source
coordinates exactly, closing the preceding checkpoint's residual discrepancy
(`artifacts/vehicle-bumper-float-origin-verification.json`). All ten boat
models pass; all 110 boat sources match both native and source-compiled PC
output exactly (`artifacts/vehicle-bumper-float-boat-verification.json`).
The replay inputs and outputs use the corresponding
`artifacts/vehicle-bumper-float-{origin,boat}-*` files.
The complete 84-observation passenger regression passes, including all three
car seats, quad, NPC-driven bike and driverless bike, Q/E views and draw-time
culling. All 15 car/quad/driverless forward sources match both native and
source-compiled PC output exactly, and all 12 NPC-driver normal sources match
the native following stage exactly
(`artifacts/vehicle-bumper-float-passenger-verification.json`).

All four browser specs pass (`artifacts/vehicle-bumper-float-browser.log`). The
production build passes (`artifacts/vehicle-bumper-float-build.log`). Final
production smoke passes save/resume, walking, car entry, map waypoint,
pause/resume and aircraft takeoff/gear with no browser errors or failed requests
(`artifacts/vehicle-bumper-float-production.log`).
