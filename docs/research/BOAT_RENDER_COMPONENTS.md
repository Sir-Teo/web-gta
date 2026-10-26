# Boat moving components

WorldBoat previously rendered its original model with fixed component frames.
Engine speed reached audio, but static/blurred propellers, steering flaps and
scanning hardware retained their imported transforms and alpha.

CBoat::PreRender (PC `0x6F1180`, gta-reversed
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) supplies the component rules:

- Rudder and rear flaps take native Z rotation minus the steering angle.
- Propeller angle advances by engine speed times the native timestep, wrapping
  only while greater than one full turn. Static pairs rotate +2/-2 times the
  angle; blurred pairs rotate -1/+1, about native Y.
- Static alpha falls from 255 to zero with engine speed; blurred alpha is
  max(0, 150 minus static alpha). SetComponentAtomicAlpha enables material RGB
  modulation and replaces the material alpha, independently of clump fading.
- Predator, Reefer and Tropic rotate a supplied moving node about native Z by
  the old scan value, then advance scan by game seconds. Missing nodes are skipped.

SetComponentRotation (`0x6DBA30`) with its reset flag uses SetRotateYOnly or
SetRotateZOnly: replace the basis, retaining current translation. It does not
multiply the imported rest rotation or accumulate steering transforms.
GetCurrentAtomicObjectCB selects the last drawn atomic directly attached to
a frame, excluding child frames; the browser binding follows that selection.

## Independent executable evidence

The PC SetCompAlphaCB (`0x6D2950`) is a retail delegate. The pinned iOS callback
at `0x10047e758` directly stores the incoming alpha byte at material offset
0xB and retains RGB. SetComponentAtomicAlpha (`0x10047e760`) also enables the
geometry modulation flag. The iOS boat renderer is `0x10045b230`, found through
the function-start table and the boat virtual table. Its propeller/alpha block
is `0x10045b2d0` through `0x10045b354`.

The optional `scripts/research/emulate-boat-components.py` executes those
instructions with Unicorn 2.1.4 and the actual alpha callback, without replacing
the arithmetic in Python. It requires the existing pinned 14,226,544-byte
binary, SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
No binary download or new application dependency is added.

The saved fixture contains 132 captures across speed, blend thresholds,
timesteps and full-turn boundaries, plus 18 descriptor entries read directly
from `0x10064c018`. Regeneration is byte-identical. All 132 captures match the
host's native float operations exactly. This supports the selected numerical
profile; it is not a matched original-PC capture.

## Integration and checks

WorldBoat accumulates simulation seconds between render updates, including a
visible frozen hull, and clears that interval after each update. Invisible
hulls discard the interval without advancing components. Pauses supply no new
simulation time. Components use their own absolute opacity before the existing
clump multiplier, preserving source alpha for other materials and avoiding
compounded fading. Material-color modulation uses stored native RGB, including
resolved paint, without modifying the asset records.

All 167 focused checks pass, including captures, absolute matrices, retained
translations, atomic selection, paired directions, scan ordering, RGB flags,
fade restoration and existing vehicle-alpha/frozen/AI adapters. The build passes.

A browser fixture loads all ten original boat models through WorldBoat. Its
actual component inventory is eight rear-flap frames, twenty propeller frames
and one scanned frame, on the Reefer. No supplied model has boat_rudder_hi;
synthetic source-contract tests cover it and all three radar model branches.
All available transforms, static/blurred material alpha and 128/255 clump fade
pass, with no page errors. All model scene children and uploaded diagnostic GPU
geometries are released. Rendered Predator idle/running/faded images differ and
show the original paired engine geometry under neutral diagnostic lighting.

All 6,403 unit tests pass (51 skipped), followed by final TypeScript validation.
The real SCM boat engine start/stop/restart regression also passes. Its setup
now uses SCM's no-offset player teleport and waits for terrain/audio readiness;
the old direct debug placement could leave audio suspended behind a streaming
hold before any navigation command. Normal production smoke passes saved-game
return, movement, car entry, map/waypoint, pause/resume, Rustler takeoff and
gear with no page errors, failed requests or development inspection hook.

Marquis door/flap dynamics, propeller particle systems, every original atomic
render callback, full LOD/transparency-pipeline behavior and matched PC motion
captures remain separate work. These checks establish component transforms,
material state and lifecycle within the existing renderer.
