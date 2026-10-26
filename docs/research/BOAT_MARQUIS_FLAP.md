# Marquis boom hinge

The original Marquis model (484) supplies `boat_flap_left`, but WorldBoat left
its boom at the imported transform. It now follows CBoat's render-time CDoor
mechanism, including acceleration, gravity on a tilted hull, damping, the
angular-speed cap and unequal stop rebounds. Other boats keep their own
component rules, and a missing optional frame creates no mechanism.

## Source and selected executable

The pinned gta-reversed revision is
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`:

- CBoat constructor, PC `0x6F2940`, initializes the Marquis limits to ±PI/10
  and the direction to negative Y.
- CBoat::PreRender, PC `0x6F1180`, transforms the flap's current frame-local
  position by the vehicle basis, calls CDoor::Process, replaces its rotation
  basis with the resulting angle and restores the original frame position.
  It snapshots move/turn speed after processing.
- CDoor::Process, PC `0x6F4040`, uses point-speed change plus timestep × .008
  world gravity, transformed into vehicle coordinates, to produce torque.
  Ordinary boats damp angular speed by .98 once per call, cap it to ±.5,
  and add it to the angle without another timestep multiplication.
  The open stop rebounds by −.8; the closed stop rebounds by −.4.
- CPhysical::GetSpeed, PC `0x542CE0`, subtracts the transformed centre of mass
  from the point offset before crossing with current angular velocity. The
  previous-speed expression in CDoor uses the unadjusted point offset.
  The adapter preserves that asymmetry.

The published constructor names axis Y. The selected iOS arm64 constructor
at `0x10045ae8c`, initialization block `0x10045b068..0x10045b0ac`, stores axis
**Z** for both Marquis and ordinary boats. Its Marquis limits are
±0.3141592741012573, direction 4 and axis 2. The actual boom therefore turns
around native Z; the discrepancy remains explicit rather than treating the
transcription as executable proof. The selected direction rotation also uses
ordinary sine/cosine signs, consistent with the earlier door investigation.

## Independent captures

`scripts/research/emulate-boat-flap.py` executes the constructor initialization
and the ordinary-boat integration region `0x10045f004..0x10045f244` of
CDoor::Process (`0x10045ee04`) with Unicorn 2.1.4. It checks the existing pinned
14,226,544-byte binary's SHA-256:
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
No binary is downloaded and the application gains no dependency.

The checked-in fixture records both constructor branches and 120 integration
cases: torque signs, the exact .001 threshold, stationary/moving hinges,
positive/negative limits, speed caps and stop states. The tests require exact
float agreement. Regeneration must be byte-identical. Torque is an input to
these captures: point-speed, matrix and trigonometric calculations are covered
by source-contract and browser tests, not claimed as captured native arithmetic.

## Integration and validation

`NativeBoatFlap` owns the boat-specific numerical state. It does not change
ordinary car doors. WorldBoat supplies native-unit linear/angular velocity,
its interpolated render axes and handling's centre of mass. Rapier already
combines contact response into body velocity; separate original friction-speed
accumulators are not reconstructed here. The flap retains render-to-render
velocity history, including its constructor's zero state.

The native render rule is once per visible component update. A zero simulation
interval removes added gravity but still damps/integrates existing hinge
motion. Invisible hulls skip processing. Basis replacement preserves the
current attachment position and does not accumulate the imported rotation.

Focused checks cover captures, constant translation, the centre-of-mass
asymmetry, tilted gravity, basis replacement, zero-timestep inertia, absent
frames and other models. Browser validation uses the actual Marquis through
WorldBoat with native paint and textures. Small movement and both stops match
captured results; turns of ±PI/2 verify coordinate conversion. Subsequent
constant speed damps existing motion, hidden rendering skips updates, and all
scene children and diagnostic GPU geometries are released. All-ten-model
components and the script-driven propeller-water lifecycle also pass.

This establishes the selected hinge behavior within the existing renderer.
Matched original-PC captures, complete atomic callbacks, LOD/transparency
behavior, broader boat AI and campaign recovery remain separate work.

All 431 focused checks and 6,689 unit tests pass (51 skipped), and the final
TypeScript/build validation passes. The first full run exposed an existing
15-second deadline around the combined 147-cutscene inventory. Each package
now has its own timed case with the same assertions; all pass under full load.

Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, Rustler takeoff and landing gear with no page
errors, failed requests or development inspection hook.
