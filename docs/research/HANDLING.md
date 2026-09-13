# Vehicle handling data

## Source and scope

Pinned reference: gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`, [cHandlingDataMgr.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.cpp). This is source-informed PC behavior, not a retail-file compatibility result or a PS2 handling measurement.

`readHandling` reads the base vehicle records from HANDLING.CFG into raw named values. It preserves ordered duplicate definitions, original numeric precision, source line numbers and exact handling names. It does not convert values to Rapier settings. Existing playable cars still use authored handling.

## Base record layout

Each base row contains a name followed by 35 values. The source `tHandlingData::InitFromData` expects 35 successful conversions after skipping the name.

| Positions after name | Fields |
|---|---|
| 1–6 | Mass, turn mass, drag multiplier, center of mass X/Y/Z |
| 7–10 | Percent submerged, traction multiplier, traction loss, traction bias |
| 11–16 | Gear count, maximum velocity, engine acceleration, engine inertia, drive type, engine type |
| 17–20 | Brake deceleration, brake bias, ABS byte, steering lock |
| 21–27 | Suspension force, damping, high-speed compression damping, upper/lower limits, front/rear bias, anti-dive |
| 28–30 | Seat offset, collision damage multiplier, monetary value |
| 31–35 | Hexadecimal model flags, hexadecimal handling flags, front/rear light bytes, animation-group byte |

Numbers remain in file units. Hex flags preserve the complete unsigned 32-bit range. Byte fields retain raw integer values and report values outside 0–255; no wrap is applied here. Invalid numeric syntax, nonfinite/float-overflow values, malformed field counts and oversized flag words reject with source-line context. Nonpositive mass, zero submerged percentage and unknown drive/engine characters remain inspectable with explicit issues rather than being silently replaced.

The browser reader accepts BOM, whitespace/control separators and commas, skips semicolon comments, and stops at the exact trimmed `;the end` marker. It caps input text at 4 MiB and total retained records at 50,000. These are browser resource limits, not native table capacities. It intentionally rejects partially scanned numeric tokens and extra base fields rather than emulating permissive scanf behavior.

Specialized prefixes are retained separately: `!` bike, `$` flying, `%` boat and `^` vehicle animation groups. Their raw token rows carry a noninterpretation warning; even malformed numeric tokens there are not claimed to have been validated. The aircraft source contains an explicit extra-character scan for an RCRAIDER field, reinforcing the need for a distinct schema. Specialized physics is not supported by this reader.

The convenience index is exact and case-sensitive with last-definition replacement. It does not emulate the native fixed 210-name table or `FindExactWord`'s prefix comparison. Model IDE handling-name associations and release-specific handling IDs remain integration work.

## Required preparation and physics integration

The source first multiplies engine acceleration by 0.4, then its game-unit conversion applies acceleration scale `1 / 50²` and velocity scale `0.277778 / 50`. It derives reciprocal mass, buoyancy and mass-scaled collision damage. A decrementing drag/acceleration search reduces maximum velocity in 0.01 increments before model/flag-dependent forward and reverse limits. Four-wheel versus two-wheel drive changes the engine-acceleration divisor, and transmission gear ratios are initialized afterward.

Those dependencies rule out treating maximum velocity as a direct Rapier speed cap or engine acceleration as a wheel force. Next work must preserve the raw record, implement a separately inspectable preparation result with explicit float and invalid-input policy, resolve model IDs/flags and gear behavior, and define how the vehicle controller consumes the result. Keep the existing authored settings as an explicit development preset until that mapping is verified. Do not install a half-converted record into a running vehicle.

Acceptance requires two contrasting vehicles, acceleration/braking/cornering traces, drive-wheel behavior, reverse limits, mass/center-of-mass effects, suspension contact and save/reload consistency. Retail measurements remain missing, so no handling-fidelity percentage is justified.

## Verification

276 unit tests across 55 files and the build passed. Five new tests check an independently specified synthetic record's complete field mapping, high-bit flags, special-row preservation, exact duplicate lookup, raw unsupported values, malformed tokens/counts and input limits. No retail HANDLING.CFG is bundled. Browser and production suites were not repeated because no runtime input or physics path consumes the reader yet.

## Prepared native handling

`prepareHandling(record, handlingId)` now produces a separate prepared result without modifying the raw record. The ID is explicitly the native 0–209 handling-table index, not a vehicle model ID. The [manager header](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.h) identifies RC Bandit as 38 and the bike interval as 162–174. The [handling structure](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/tHandlingData.h) places the maximum-speed-limit flag at bit 24 of handling flags.

Preparation narrows the six byte fields explicitly and rounds floating fields/intermediate operations to float32. It applies the initial acceleration multiplier, game-unit acceleration/velocity/braking scales, reciprocal mass, buoyancy and damage conversion. The drag search preserves the mandatory first 0.01 decrement and both source resistance formulas. It exposes iteration count for inspection. RC reverse behavior takes precedence over the maximum-speed flag, which takes precedence over the bike reverse branch; ordinary reverse speed retains the source minimum magnitude.

[InitGearRatios](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cTransmission.cpp) supplies the forward maxima and shift thresholds. The prepared array has six cleared slots, with reverse in slot zero and forward gears beginning at one. The [transmission header](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cTransmission.h) declares six total slots even though its gear-count comment says 1–6. The browser rejects forward counts outside 1–5 to avoid reproducing an out-of-bounds write. Unused slots remain zeroed.

Input domains are explicit: mass and narrowed submerged percentage must be positive; speed, acceleration, braking and drag cannot be negative; drive/engine enums and integer ranges must be supported. Nonfinite results reject. A float subtraction that cannot advance or a drag search exceeding 100,000 iterations rejects instead of blocking the browser indefinitely. These are deliberate validation policies, not claims about native malformed-file behavior. Unchanged suspension/traction/center-of-mass fields retain their native axes and units in the prepared record; they are not yet Rapier parameters.

Float32-at-each-operation is an explicit browser arithmetic policy. The original executable's compiler, x87 register precision, constant folding and edge-case results have not been compared, so this is source-level reproduction rather than binary arithmetic parity. Gear selection, drive acceleration over time, tire contact, suspension forces, handling-name resolution and local file/UI-to-vehicle integration remain unfinished.

Verification: 282 unit tests across 56 files and build passed. Six preparation tests cover independently calculated zero-drag quantities, 2WD/4WD divisors, special-ID/flag precedence, both drag-threshold crossings, reverse and forward gear slots, raw-record preservation, byte narrowing, invalid IDs/gear counts and bounded pathological searches. No runtime vehicle path consumes prepared handling yet; browser and production checks were not repeated.

## Transmission drive increment

`stepNativeTransmission` now evaluates the pinned `CalculateDriveAcceleration` flow against a prepared handling record. Inputs explicitly use signed native forward velocity and native 20 ms timestep units. Output is a drive increment, not a Rapier wheel force. The function returns replacement gear/inertia state without mutating the caller's state, so failed evaluation cannot partially commit a gear change.

The implementation preserves throttle-dependent forward/reverse selection, strict versus inclusive shift thresholds, potentially multiple gear changes in one call, the 1G/2G boost flag priority, the single-gear exception, reverse multiplication, perfect-handling/nitros multipliers, global forward/reverse bounds and the separate gear-maximum taper. Any shift disables inertia pointers and cheat modifiers for the rest of that call, as in the source. The native `gearChangeCount` argument is unused in this implementation; no arbitrary shift delay was added.

Optional inertia state retains the source's two float accumulators as ratio and smoothing. Grounded updates use the current gear's velocity span, clamp the response to 0.1–1 and smooth with the source's 0.85 fraction. Airborne updates increase the stored ratio and set smoothing to 0.1, but do not multiply the current call's drive increment by that new smoothing value. The controller uses the caller's wheel-contact boolean; it does not infer contact from vehicle speed.

Browser input policy limits throttle to -1–1 and timestep to 0–3, rejects invalid gears/nonfinite arithmetic and rejects zero inertia when its airborne division is needed. A bounded shift loop fails if malformed prepared data does not converge. Like the preparation stage, arithmetic rounds intermediate operations to float32 without claiming original executable precision parity. Zero timestep is not a substitute for skipping a paused controller call: gear and inertia state may still change even when the resulting drive increment is zero.

Verification: 288 unit tests across 57 files and build passed. Six controller tests cover analytic drive increments and modifiers, reverse/forward boundary behavior, multi-gear shifts, inertia bypass after shifts, grounded smoothing, airborne memory, global cutoffs, an isolated diagnostic gear taper, raw state preservation and invalid inputs. Browser/production checks were not repeated because this controller is not connected to the playable cars yet. The next integration must trace the original wheel-force consumer and contact selection, establish native-to-Rapier units, and resolve handling identity before applying local data to a vehicle.

## Driven contact history and per-wheel thrust

Tracing the [automobile caller](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Automobile.cpp) corrected an ambiguity in the transmission signature: its parameter named `allWheelsOnGround` receives the driven-wheel contact count. Any nonzero count selects grounded inertia. The browser input is now named `hasDriveWheelContact` to express the actual predicate.

The automobile refreshes a wheel's contact counter to four native time units when suspension compression is below one. Otherwise it decrements the counter before deciding whether the wheel still counts. Drive layout selects which retained contacts contribute to the transmission count. The caller divides transmission acceleration by `m_fVelocityFrequency`, and wheel-pair processing supplies that increment to each eligible driven wheel without another count division. Native wheel ordering is FL/RL/FR/RR; the browser's existing Rapier setup uses FL/FR/RL/RR.

`stepDriveContacts` implements that retention/count stage with explicit wheel names. `stepNativeDrivetrain` composes it with transmission updates, requires the velocity-frequency divisor as an input and returns eligible per-wheel native thrust. Engine-disabled calls preserve transmission state while contact history still updates. Inputs and previous state are not mutated. The composition covers the base automobile path; engine/aircraft eligibility and modifier selection remain caller responsibilities.

The [wheel consumer](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Vehicle.cpp) sets forward contact response from thrust, then applies combined lateral/longitudinal adhesion and traction-loss rules. It forms mass-scaled movement and effective-mass turning contributions, with a separate anti-dive turn direction when needed. Consequently the new per-wheel output is still not a Rapier force: tire response, contact normals/speeds, braking, velocity-frequency scheduling and native impulse-unit conversion must be resolved before physics integration. Burnout, burst tires, NPC modifiers and native contact-point retention also remain unfinished.

Verification: 293 unit tests across 58 files and build passed. Five new tests cover one-wheel contact for each drive layout, exact contact expiry/refresh, transition from grounded to airborne inertia, explicit axle routing, 2WD/4WD total-thrust equivalence, the velocity-frequency divisor, engine-disabled state and rejection without partial commits. Browser/production suites were not repeated because this composition is not yet connected to playable cars.

## Scalar tire response

`nativeWheelResponse` implements the scalar forward/right portion of the pinned `CVehicle::ProcessWheel`. It accepts already projected contact speeds, contact count, per-wheel thrust/brake/adhesion and prior wheel state. Braking takes precedence over drive thrust. Coasting uses an explicit resistance input; `nativeCoastBrake` supplies the source's car/bike/plane/RC calculation and preserves the high-resistance branch's precedence.

The response scales adhesion by native timestep, adjusts it for prior slip and player-controlled wheel spin, limits lateral response while driving, and applies a combined forward/right traction circle. It distinguishes normal, spinning, skidding and fixed wheels, including the higher front-wheel spin threshold above the source speed threshold. Burst-tire lateral perturbation requires a caller-supplied bounded random sample and is used only when lateral contact speed is nonzero. The signed forward-speed term is preserved, including reverse motion. The helper never samples nondeterministic randomness itself.

Anti-dive returns a distinct forward turning component: full configured reduction for braking, half for driving, none for ordinary coasting. The linear forward/right response remains unchanged by that turning adjustment. Global-basis projection, contact normals, effective turning mass and native-to-physical impulse conversion remain separate stages. These scalar calculations alone do not replace Rapier tire contact.

The source's `bAlreadySkidding` deserves explicit caution: it is a static reference set when the incoming wheel state is non-normal, with no clearing assignment visible in the inspected function. The helper therefore accepts and returns that shared latch explicitly instead of silently treating it as a per-wheel flag or assuming a reset. Its complete native lifetime and call ordering are unverified; future wheel-loop integration must resolve that behavior. The current helper is source-informed and does not claim that this suspicious lifetime reproduces retail behavior.

Input validation requires finite supported contact data, one to four contact wheels, nonnegative resistance/adhesion coefficients and bounded native timestep/throttle. Float32 rounding remains the project's stated source-level arithmetic policy. Raw state is not mutated. Original global constants, surface-specific adhesion inputs, wheel-pair brake/traction bias, burnout and precise random sequencing still require integration evidence.

Verification: 300 unit tests across 59 files and build passed. Seven new cases cover drive/brake/coast precedence, combined slip and front/rear thresholds, lock-up, spin/shared-history differences, deterministic burst input, anti-dive separation, coasting branches and invalid input. The tests retain signed-zero behavior rather than changing arithmetic to satisfy an exact positive-zero assertion. Browser/production suites were not repeated because playable car physics still does not consume the helper.

## Native response to physical motion

The pinned [CPhysical implementation](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Physical.cpp) adds movement force divided by mass directly to native movement speed. `ApplyTurnForce` subtracts the world-aligned center-of-mass offset from the supplied point and adds cross(point, force) divided by scalar turn mass. The [GetMass helper](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Physical.h) separately computes effective mass from the origin-relative point and force direction. Those are deliberately different lever arms; substituting the COM-relative point into both changes the result.

`nativeWheelVelocityDelta` now builds linear and turning responses from an orthonormal contact basis, computes the effective turning mass and applies the COM adjustment at the later stage. Inputs are native Z-up, world-aligned vectors; contact/COM positions are offsets from the vehicle origin, not absolute world positions. The helper covers ordinary finite, positive mass/turn-mass vehicles. Zero turning response leaves linear response intact, including the full anti-dive case. Source-disabled movement/rotation, infinite mass and other special physical flags are not implemented.

`applyNativeWheelDelta` applies the calculated increments to a dynamic Rapier body's velocities. Native movement/turn speed is per 20 ms unit, as shown by source integration against `CTimer::GetTimeStep`; conversion to per-second velocity multiplies by 50. The Rx(-90°) mapping converts native Z-up into browser Y-up for both linear and angular vectors. The response already contains timestep scaling and must not be multiplied by frame duration again.

The bridge deliberately prescribes velocity changes using the native scalar turn-mass calculation instead of letting Rapier substitute its inertia tensor for that calculation. This is not a claim that the whole rigid-body simulation matches: Rapier still governs collision response, constraints and pose integration, and the native orientation update has its own arithmetic. The bridge currently targets unconstrained dynamic bodies; locked axes and special physical flags need separate policy. Both output velocities are calculated/validated before either write, so invalid numeric input cannot partially apply motion.

Verification: 306 unit tests across 60 files and build passed. Six new cases verify the independent effective-mass/COM calculations, anti-dive separation, actual Rapier velocity and one-step translation, symmetric yaw cancellation, rotated basis mapping, invalid data without partial writes and static-body rejection. These are real physics-engine checks using synthetic contact inputs. Playable cars still use the authored controller; suspension/contact sampling, surface/bias inputs, update ordering, local handling identity/application and retail traces remain unfinished. Browser/production suites were not repeated because no application path invokes the bridge yet.

## Contact basis and relative velocity sampling

The automobile projects its forward axis onto the collision plane, normalizes it, derives the right axis by a cross product and then applies steering in that plane. Before tire processing it samples every wheel's contact velocity and subtracts the contacted physical entity's velocity. `CPhysical::GetSpeed` includes movement, rotation about the world-aligned COM offset and the native friction-velocity accumulators. Consequently chassis linear speed alone is not a sufficient tire input.

`nativeContactBasis` now implements the road-plane projection and source steering convention in native Z-up coordinates. It validates unit input axes/normals and returns no usable basis for a degenerate forward projection instead of generating NaN motion. `sampleNativeWheelContact` reads an updated Rapier wheel raycast, obtains the hit point/normal/body, samples both bodies at that point, subtracts ground motion, converts to native axes/time units and projects onto the wheel basis. It returns origin-relative contact and COM offsets, ground collider identity and the raw Rapier suspension length. It does not label that length as native compression.

The installed Rapier declarations and official [rigid-body API](https://rapier.rs/javascript3d/classes/RigidBody.html#velocityAtPoint) provide point velocity and world COM. The [vehicle-controller API](https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html#wheelContactPoint) provides hit geometry and ground collider ownership. These APIs were verified against real raycast contacts, not mocked controller values. Rapier's current solved velocities stand in for its physical state; the original separate friction accumulators are not reconstructed by this sampling adapter.

Call order is part of the integration contract: refresh raycasts, snapshot all wheel contacts/speeds, then compute/apply tire responses. Sampling the next wheel after applying the previous wheel's response would differ from the native precomputed contact-speed array. Rapier's own tire response must also be separated from the custom stage to avoid applying friction twice. Tests disable built-in suspension/tire forces while isolating the sampler; this is not a playable suspension calibration.

Missing contact returns no current sample. Native retained-wheel processing instead has a distinct fallback using the transformed collision line endpoint or disk bottom when suspension contact is absent. That fallback, surface/bias inputs, suspension compression conversion, modifier selection and the actual playable update loop remain unfinished. Steering input uses the native convention explicitly; no unverified mapping from browser steering controls is hidden here.

Verification: 311 unit tests across 61 files and build passed. Five new cases check sloped/steered orthonormal bases, real moving/rotating ground subtraction, COM-dependent rotational speed, an actual contact-to-tire-brake-to-body-motion chain, missing/degenerate contact and invalid indices. In the full chain, a 0.01 native braking increment reduces a body's forward speed from 10 to 9.5 units/second with the expected turning response. Browser/production tests were not repeated because playable cars still use the authored controller.

## Four-wheel frame composition

`stepNativeWheelFrame` composes retained drive contacts, transmission, per-wheel tire response and native motion into one pure frame result. Contact geometry/speeds must be snapshotted before evaluation. Per-wheel brake, coasting and adhesion inputs remain explicit resolved parameters; this layer does not manufacture surface tables or omit their unresolved axle/suspension modifiers.

The source processes front-left/front-right then rear-left/rear-right unless handling flag bit 23 selects rear-first order. The frame preserves that ordering, including the explicit shared skid latch. It also implements the wheel-pair correction that clears a driven wheel's spinning state under negative throttle after the response calculation. Returned diagnostic response state and next-frame stored wheel state remain distinguishable.

A retained contact with no current ray hit requires caller-supplied fallback geometry; missing geometry rejects instead of silently dropping a wheel that still counts for transmission/contact sharing. All next state and motion values are computed without modifying prior state or the body. `applyNativeWheelDeltas` accumulates the ordered velocity changes and validates the entire batch before writing either physical velocity. A bad later wheel cannot leave earlier wheel motion committed. An empty batch does not wake the body.

Verification: 316 unit tests across 62 files and build passed. Five new cases include a complete four-wheel real-raycast → drivetrain → tire → Rapier motion test, rear-first shared-state ordering, reverse spinning-state correction, explicit fallback requirements and atomic batch failure. The synthetic driven-wheel case produces the independently expected 0.3072 units/second forward increment with symmetric yaw cancellation. Built-in tire/suspension forces are disabled in that isolated test and compression/adhesion are supplied diagnostics; it is not a tuned driving scenario. Browser/production suites were not repeated because the application still uses authored vehicle control. Surface/bias resolution, native suspension/fallback data, shared-latch lifetime, local handling selection and playable-loop integration remain required.
