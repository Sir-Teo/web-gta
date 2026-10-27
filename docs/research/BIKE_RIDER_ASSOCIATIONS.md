# Ordinary motorcycle and quad rider associations

The eleven supported motorcycles and quads now use a Ride base with native
Still, Pushes/Reverse, Left/Right and Back/Fwd associations. Still blends in
below native forward-speed magnitude 0.02, rather than replacing the whole
pose at the previous host threshold. Association fades, partial availability,
lean filters, sampled pose times and clump clocks follow the selected
ordinary native controller path.

Acceleration, braking and fast reverse can produce automatic fore/aft lean.
A first passenger suppresses this automatic player lean. The host now checks
actual player/script passenger presence, including a passenger retained dead
in the seat. The player and script-driver renderer sample the held base
association time, so a finished Ride clip is not wrapped to its first frame.

Computed gas and foot-brake state is published during the input/physics step.
Previously a non-quad bike's gas field was only updated by its audio-state
pass; a scripted rider outside that pass could receive stale gas. Handbrake
is kept separate from the foot-brake field used by the rider controller.

Bicycle pedal/sprint ownership remains in its separately captured controller.
This pass replaces the earlier [motorcycle/quad lean-only integration](BIKE_RIDER_LEAN_POSES.md).

## Independent native execution

The pinned iOS executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The harness enters CBike::ProcessRiderAnims at `0x100457674` and stops at
`0x100457f0c`, before skeletal vibration. It then runs the actual scalar clump
update at `0x10013ad30`, with zero pose frames.

Actual GetAssociation, BlendAnimation, AddAnimation, SetCurrentTime,
association/filter decisions, UpdateBlend, shared-clock arithmetic and
UpdateTime execute. The following are declared inputs or external boundaries:

- Actor player type/skill, existing associations and scalar vehicle/handling
  fields; flat pitch, zero turn and neutral contact fields. Collision/task
  reaction branches and wheelie/stoppie overrides are outside this capture.
- Asset descriptor lookup and zero-node association construction. New objects
  use amount 1, speed 1, zero clocks/delta and the selected native descriptor
  flags; native resource-reference bookkeeping is not instantiated.
- Asset decompression, allocation cleanup and frame effects.
- Imported powf, evaluated by the host C library's float implementation; call
  arguments/results are recorded. The iOS system-library powf body is not run.

All **755 fixed cases** compare exactly through the controller stage and the
following scalar clump frame. Cases cover player/NPC, solo/passenger, gas,
brake and speed boundaries, retained lean, existing/fading Still/Pushes,
drive-by presence, fading pedal/sprint clips, timestep changes and quad
reverse completion. The fixture records native timestep globals explicitly;
reconstructing them from the already rounded seconds value changes rounding.

## Descriptor and clock details

Native group definitions for bikes, bikev, bikeh, biked and wayfarer point to
`0x1006248b0`. Their Pushes (200) flags are `0x1016`, including looped.
The quad definition at `0x100628888` points to descriptors `0x100624c70`;
QUAD_reverse (200) flags are `0x1014`, without looped. The port preserves that
difference: the quad reverse clip plays to its end and holds there. Quad Still
(195) maps to QUAD_ride, and the Wayfarer uses the WF clip prefix.

Still requests blend at 2; Pushes requests at 4. The ordinary departure fade
is -4. Available lean blend predicts the next Still, drive-by and Pushes
amounts using the native unclipped timestep, in order. The existing blend
manager handles other partial fades and phase/lifetime rules.

Side lean retains powf(float32(0.86), timestep); forward lean retains
powf(float32(0.89), timestep). Acceleration below 0.3 times prepared flat
velocity can request back lean -0.3. Foot braking above 0.5 and forward speed
above 0.01 can request forward lean 0.1. Side lean attenuates the automatic
fore/aft target. Reverse-pedalling and passenger decisions are preserved.
Pose associations use their loaded IFP duration and filtered time.

The browser still supplies its existing physical body lean and zero explicit
forward-lean input. Wheelie/stoppie geometry, high-turn task reactions,
skeletal vibration, complete native vehicle/task scheduling, rider changes
without an empty ownership frame, and precise vehicle-owned filter lifetime
remain separate work. Skeleton sampling uses the existing browser IFP and
partial-pose paths; root frame extraction/flag context and bit-exact native
pose sampling are not established by these scalar captures. Selected iOS
execution does not establish whole-game original-PC parity.

## Verification

The final independent live replay matches **2,704 / 2,704 frames exactly**
for complete association scalar state and filtered side/forward state,
including 274 quad and 110 passenger frames, with real loaded durations.
Evidence: `artifacts/bike-rider-controller-live-native.json` and
`artifacts/bike-rider-controller-live-verification.json`.

Eight browser checks pass in 24.8 seconds: loaded all-model rider posing,
existing bike steering/hop/knock-off/quad/drowning/boarding/airborne checks,
and bicycle cadence/crank/hop regressions. After the descriptor and pedal
publication refinements, three final checks pass in 45 seconds: all-model
controller/ownership/freeze/reverse, bicycle articulation and a real-game
PCJ-600 keyboard/passenger/braking regression. The latter verifies the actual
passenger-presence provider and renderer, with no page errors. The quad
reverse clip is also checked after completion and remains at its final time.

TypeScript and **2,841 focused tests** pass, including all controller cases,
existing bicycle clocks/blends, lean/filter/reverse references, native partial
poses, bindings, hop and crank checks. Evidence:

- `artifacts/bike-rider-controller-focused-final.log`
- `artifacts/bike-rider-controller-types-final.log`
- `artifacts/bike-rider-controller-browser.log`
- `artifacts/bike-rider-controller-browser-pedals-final.log`
- `artifacts/bike-rider-controller-live-keys.json`
- `artifacts/bike-rider-controller-live-passenger.png`

Regenerate the fixture with `scripts/research/emulate-bike-rider-controller.py`,
supplying `--binary` and `--output`. Unicorn and host-libm powf are required.
`--profiles` accepts rows containing `nativeInput` and appends native replays
after the 755 fixed cases.


The final full unit suite passes **13,168 tests / 51 skipped**, across 881
passing files (163.72 seconds). Evidence:
`artifacts/bike-rider-controller-full-unit-final.log`.
The fixed native fixture regenerates byte for byte.


The final TypeScript/production build passes (6.36 seconds). The built-game
smoke passes save resume, walking, car entry/driving, map waypoint, pause,
aircraft takeoff and gear checks with no page errors or failed requests.
Evidence: `artifacts/bike-rider-controller-build-final.log` and
`artifacts/bike-rider-controller-production-final.log`.
