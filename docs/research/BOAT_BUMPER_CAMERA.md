# Boat bumper camera source

## Corrected behavior

The boat's bumper camera now uses its helm dummy instead of the front/top corner
of its collision bounds. The source ignores the dummy's X, adds native model-space
`(0, 0.08, 0.62)`, transforms by the hull pose, then adds **0.5 in world Z**. The
extra height remains vertical when the boat rolls or pitches. Camera setup now
runs after the vehicle render roots update, so it samples the hull pose used by
the current frame.

The dummy index deserves care: `Process_1stPerson` reads
`DUMMY_LIGHT_FRONT_MAIN` (slot 0) for boats, but the captured boat descriptor table
maps **`ped_frontseat` to slot 0**, flags 9. Searching a boat for an automobile's
`headlights` frame would select the wrong resource. The checked-in independent
table is in `tests/fixtures/boat-components-reference.json`, captured directly
from `0x10064c018..0x10064c138` by `emulate-boat-components.py`.

## Source and reference boundaries

The reversed-PC source is revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`. Local archive files were compared
byte-for-byte with the public raw files at that revision:

- `Cam.cpp`: `2df8f5b892109c4f71173b09558877dbdc79ef0ec6cf3fb15bbfcce9962a214d`
- `Models/VehicleModelInfo.cpp`: `2393d438087b5d97c116227cc656f455a2c3d6395e5a5fbd461c6b9fbae07632`
- `Models/VehicleModelInfo.h`: `f71e89336f39826b6b4e571dce51a51831571f1d116b34ae75e641e50aef4242`

`CCam::Process_1stPerson` is at PC `0x517EA0`; the source calculation is in
`Cam.cpp:715..750`. `CVehicleModelInfo::PreprocessHierarchy` fills dummy positions;
`CVehicleStructure` initially zeros missing slots. Source identities and URLs:
`artifacts/boat-bumper-source-files.json`.

`scripts/research/capture-pc-bumper-source.py` verifies the camera source hash and
compiles the unmodified dummy/source fragment and boat-height line. Matrix rows,
dummy values and vehicle type are declared inputs. Matrix/vector primitives use
standalone scalar float32 C++ arithmetic, with FP contraction disabled. This is
a **source-compiled reference**, not a retail-PC executable capture. It does not
establish original x87 settings, camera look handlers, wheelie/ground protection,
the full camera task, or matched original-PC images.

The host's existing quaternion/double transform remains; sub-millimetre differences
from the float32 source reference are measured rather than called bit-exact.
The boat's existing seat accessor supplies the model dummy; arbitrary nested
dummy hierarchy equivalence is outside this change.

Replay recorded browser frames with:

```sh
python scripts/research/capture-pc-bumper-source.py \
  --source artifacts/gta-reversed-4281f82d8af83e14935ac84a69dfd1ceebb9f256 \
  --profiles artifacts/boat-bumper-camera-live.json \
  --output artifacts/boat-bumper-live-source.json
```

## Validation

The unchanged game reproduced the source mismatch in 20 stationary/held frames:
Squalo 446 was approximately **8.3 metres** from the source position, and Reefer
453 approximately **6.2 metres**. The separately compiled PC source confirms
those errors. Evidence: `artifacts/boat-bumper-camera-baseline.json`,
`artifacts/boat-bumper-baseline-source.json`,
`artifacts/boat-bumper-baseline-verification.json` and
`artifacts/boat-bumper-camera-baseline-source.log`.

TypeScript and all 156 focused camera/boat/ride checks pass. All ten playable
boats pass the browser source-placement check, including throttle/steering after
streaming resumes. The existing real-key car bumper cycle/FOV check also passes.

All 110 recorded boat frames (40 unheld) agree with the separately compiled PC
source within **0.000138 metres**, below the declared 0.001-metre comparison
tolerance. The current render-frame transform agrees within 9e-16 metres.
This is a coordinate/source check, not a matched original-game image claim.
Evidence: `artifacts/boat-bumper-camera-browser-final.log`,
`artifacts/boat-bumper-camera-live.json`, `artifacts/boat-bumper-live-source.json`
and `artifacts/boat-bumper-live-verification.json`.

The `/web-gta/` production build passes (`artifacts/boat-bumper-camera-build.log`).
The production browser smoke passes saved-game launch, walking, map waypoint,
Greenwood entry/exit, pause/resume, aimed pistol, Rustler takeoff and gear control,
with no page errors or failed requests
(`artifacts/boat-bumper-camera-production.log`).
