# Bicycle pedal and sprint associations

BMX, Chopper and Mountain Bike riders now use their loaded BIKE_RIDE base
with BIKE_PEDAL (207) and BIKE_SPRINT (208) partial associations. The native
controller requests, fades, playing flags, playback speeds, synchronization,
float32 phase wrapping and automatic removal own the pedal/sprint state.
The renderer samples that state without advancing it. Scripted drivers use
the same partial associations; explicit scripted rider clips retain their
existing task ownership.

The actual sprint blend also feeds the existing captured BMX energy/input
controller. It no longer has to omit that association-presence input.

## Independent executable captures

The pinned iOS reference is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Four fixtures execute native instructions independently of the TypeScript:

- **139** BlendAnimation cases: `0x10013d5dc`, actual SyncAnimation, Start
  and SetCurrentTime. Static descriptor lookup, zero-node allocation and
  asset decompression are declared stubs.
- **111** clump-frame cases: `0x10013ad30`, actual UpdateBlend, shared
  period and UpdateTime. Zero pose-frame count, external frame effects and
  virtual allocation cleanup are declared. Scalar timing is not stubbed.
- **174** combined controller/frame cases: CBmx from `0x100459cb0` to
  `0x100459db0` (before fallback crank/pose) or `0x10045a0f4` (normal phase
  continuation), followed by the actual scalar clump frame. Ordinary CBike
  rider fallback is declared as a stub; Left/Right/Fwd associations are
  absent declared inputs. Allocation/decompression/frame stubs match above.
- **67** skinned-frame cases: `0x10013bb3c`, actual AnimBlendNode::Update
  and quaternion sampling, with static uncompressed keyframes. No calls or
  arithmetic are stubbed. Root velocity extraction is disabled. Cases cover
  overlap, missing tracks, opposite quaternion signs and translation.

The native descriptor table is `0x1006248b0`, IDs 194–208. Pedal/sprint flags
are `0x1032`: partial, looped, synchronized and secondary. BIKE_RIDE is 194;
195 is BIKE_STILL; 196/197 are Left/Right; 202–204 are drive-by poses.
These identities come from the executable's full fifteen-entry table.

## Behavior that differs from a single clip clock

New synchronized clips copy normalized phase, converting to their own
length. Sprint and pedal seconds therefore differ even at the same phase.
When a sprint is requested while a pedal association remains, the native
code sets playing on both and writes cadence to the pedal association.
The shared clock uses `sum(amount) / sum(amount * duration / speed)`.
It does not independently advance each clip by its own speed.

Coasting can create a paused pedal association synchronized to the outgoing
sprint. Its time then holds while the sprint fades. A seconds-based check
must allow the one conversion between clip durations. Negative blend delta
and positive amount do not by themselves stop a playing association.

SetCurrentTime repeatedly subtracts a looped duration. Per-frame UpdateTime
subtracts once. An existing association restarts at exactly its duration;
a greater time is a different case. The implementation preserves float32
rounding at the captured operations.

Cranks use the controller's normal pedal/sprint phase before the clump time
update. Freeze and repeated render calls leave clocks unchanged; rider
absence releases the owner. The existing PC-reversed bunny-hop owner keeps
its launch callback/time lifecycle. Its partial blend request fades the
pedal/sprint associations at 8, and its time is advanced only by that owner.

## Pose composition and remaining boundaries

The later [root-frame correction](VEHICLE_ROOT_POSE_BLEND.md) applies the
non-extracting skinned root callback separately. The normal-frame formula
below remains applicable to the other bones.

`PartialPose` follows the skinned callback's per-bone partial sum, weighted
quaternion terms with hemisphere correction and final normalization, and
translation/rest contribution. Tracks absent from a partial leave the ride
contribution available on that bone. It avoids sequential overlay weighting,
which made equal partial amounts unequal in the final pose.

The 67 native static-key pose comparisons use angular tolerance 1e-6 and
translation tolerance 1e-5. Browser quaternion/matrix sampling uses Three's
number arithmetic; this is not a bit-exact float32 native pose sampler.
Controller/association scalar fixtures compare exactly.

Ordinary CBike rider fallback state, its crank overrides/easing, lean pose
associations and phase initialization from Left/Right/Fwd remain separate
work. The host retains its existing fallback pose/easing and lean overlay.
It supplies zero forward lean and absent drive-by associations where those
host controllers do not exist. Full native task scheduling, hop scalar
float32 parity and original-PC whole-game parity are not established by
these selected iOS captures.

## Regeneration

Run each `scripts/research/emulate-bicycle-{blend,clump-frame,rider-associations}.py`
and `scripts/research/emulate-partial-pose.py` with `--binary` naming the
pinned executable and `--output` naming a temporary JSON file. Unicorn is
required. The combined harness accepts `--profiles` with recorded live
controller inputs and pre-frame associations, appending native results to
its fixed cases. The fixtures are under `tests/fixtures/`.

The 877 focused tests pass. All four fixed native fixtures regenerate byte
for byte. All **468 recorded live controller steps** independently replay
through the combined native harness with exact association scalar and
normal-path crank matches, including reverse-motion fallback and remount.
Evidence: `artifacts/bicycle-associations-live-native.json` and
`artifacts/bicycle-associations-live-verification.json`.

Seven browser checks pass in the initial integration run (2.6 minutes):
all-model crank/hop articulation, actual-key sprint/energy and visible sprint
partial pose, four script rider/boarding/passenger/exit checks, and the touch
hop pose. The coast assertion was updated to allow clip-duration conversion;
its final all-model run also tests reverse-motion fallback after the partials
have faded and passes (6.4 seconds). Evidence:
`artifacts/bicycle-associations-browser.log` and
`artifacts/bicycle-associations-browser-fallback-final.log`.

A final selector repair ensures a faded managed pedal association cannot
return through the legacy speed-based full-body pedal selector. The initial
full-unit run was stopped to include that repair; the final suite includes it. All **10,839 tests pass / 51 skipped**, across
877 passing files (202.43 seconds). The final TypeScript/production build
also passes (10.48 seconds). Evidence:
`artifacts/bicycle-associations-full-unit-final.log` and
`artifacts/bicycle-associations-build-final.log`.


The final built-game smoke also passes: saved-game resume, walking, Greenwood
entry/driving, map waypoint, pause/resume, aircraft takeoff and landing gear,
with no page errors or failed requests. Evidence:
`artifacts/bicycle-associations-production-final.log`.
