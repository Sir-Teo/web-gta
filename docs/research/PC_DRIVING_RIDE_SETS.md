# Original-PC driving ride sets

## Change

Car and seated-boat drivers now select the original-PC weak, standard and pro
ride sets: driving stat 160 below 50 uses weak, 50 through below 100 uses standard,
and 100 onward uses pro. Slow steering uses move-speed magnitude <= float32 0.4.
Low, standing-boat, kart and truck categories retain their source precedence.
The previous iOS selector only chose standard/pro at skill 50.

Weak idle, steering, slow steering and look-back clips are now installed on the
player. Runtime car and boat callers supply all three native move-speed components
for the source magnitude calculation. Seated-boat rendering also uses the same
simultaneous track-aware partial path as cars, rather than sequential overlays.
The explicit iOS selector mode remains available to the native reference tests;
gameplay defaults to PC 1.0.

## Source identity and reference limits

The reversed-PC `CVehicle::ProcessDrivingAnims` selector and `RideAnims.h` tables
come from gta-reversed commit `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.
The local extracted files were compared byte-for-byte against that commit's
public raw files. The directory is a source archive, not its own Git checkout.
Evidence: `artifacts/pc-driving-source-files.json`.

SHA-256 identities used by the generator:

- `Entity/Vehicle/Vehicle.cpp`: `58cb9544808afd23f3de1b5e43ad73463fabb66a438a394f6ffb0cd5cd3b19d8`
- `RideAnims.h`: `6503e5b65f1ffd3dd1d20146697d47ee79eded04470becdc37018b1e70ca586a`
- `Enums/AnimationEnums.h`: `050232f3cbef01f3308b3070bdd363a8664926a520a3e7827b18a8677b22231d`

`scripts/research/capture-pc-driving-rides.py` checks those identities, compiles the
unmodified selector fragment with the original ride/enum headers, and records
four animation IDs. Category/stat services are declared inputs. Its standalone
vector magnitude uses scalar float32 C++ arithmetic with FP contraction disabled.
The fixture records the exact source fragment, compiler and flags.

This is a **source-compiled reference**, not a retail-PC executable capture.
Original PC x87 settings, full-body idle task ownership, skill-change transition
scheduling and original-PC rendering/physics equivalence remain unverified.
The host's existing entry/idle transition policy remains separate from selecting
the correct set; the boat clip checks do not establish native mid-ride task timing.

Regenerate with `--source <source archive> --output <json>`; `--profiles` appends
observed `sourceInput` objects after the 512 fixed cases. No compiler is needed
to run the checked-in TypeScript fixture tests.

## Validation

All **512 fixed source cases** match, covering skill boundaries, slow/fast 3D
speed, negative velocity components and category precedence. The original 260
native partial/controller cases still run against the explicit iOS selector.
All **779 focused checks** and TypeScript pass.

Real keyboard checks pass for Greenwood at skills 0, 80 and 100, plus Remington,
Linerunner and Kart. Each uses the expected loaded/rendered idle and both shooting
sides, one visible right-hand gun, native animation readiness and release. No
page errors are reported (`artifacts/pc-driving-rides-browser.log`).

All **1,620 live selections match the compiled PC source**, including 552 frames
whose chosen IDs differ from iOS. For partial/clump/weapon validation,
`emulate-car-driving.py` receives the PC ride table as an explicitly declared
input at `0x1004805f4`; it replaces the iOS selector result. Its original iOS
choice is retained separately, and **the PC selection is validated by the source
reference, not by pretending the iOS selector implements PC tiers**.

Given those declared PC tables, all 1,620 native partial/clump, animation-readiness,
weapon-state, ammo, retry timestamp and fire-result outputs match exactly. They
include 480 ready frames and 100 successful shots. All **100 muzzle and final
ray endpoints** also match their native captures exactly, with six accepted
automatic targets. Evidence:

- `artifacts/pc-driving-live.json`
- `artifacts/pc-driving-selector-live-source.json`
- `artifacts/pc-driving-body-live-native.json`
- `artifacts/pc-driving-live-verification.json`
- `artifacts/pc-driving-rays-live-verification.json`

Entry steering/reverse, driver weapon restore and standing-boat steering pass.
A seated Squalo renders all three PC tiers and their steering clips with the
weighted partial path. Evidence: `artifacts/pc-driving-rides-browser-regression.log`,
`artifacts/pc-driving-boat-browser.log` and `artifacts/pc-boat-driving-live.json`.
Screenshots `artifacts/car-driveby-left-492-{0,80,100}.png` and
`artifacts/pc-boat-driving-{0,80,100}.png` show current state, not matched original-PC
captures.

The final full suite passes **17,751 tests / 51 skipped** across 892 passing
files. TypeScript and the `/web-gta/` production build pass. The production
browser smoke passes saved-game launch, walking, map waypoint, Greenwood entry
and exit, pause/resume, aimed pistol, Rustler takeoff and landing-gear control,
with no page errors or failed requests. Evidence:
`artifacts/pc-driving-rides-full-unit.log`, `artifacts/pc-driving-rides-build.log`
and `artifacts/pc-driving-rides-production.log`.
