# Native bicycle cranks and pedals

The later [association integration](BICYCLE_ASSOCIATION_BLENDING.md) replaces
the initial speed-selected pedal clock described below with native
pedal/sprint blending and wrapped phase before the clump time update.

The BMX (481), Chopper (509) and Mountain Bike (510) now animate their imported
`chainset`, `pedal_r` and `pedal_l` frames. Previously these frames stayed fixed
while the rider's feet cycled through the native pedal clip.

CBmx::ProcessDrivingAnims uses the selected BIKE_PEDAL or BIKE_SPRINT association:
`crank = -2π × currentTime / clipDuration`. Without an active association it keeps
`pow(float32(0.97), nativeTimeStep)` of the previous angle. Both pedal angles
are the negative of the crank. CBmx::PreRender applies these as native X rotations,
replacing each present frame's basis and preserving its mounting translation.
The pedals remain children of the crank, so their treads stay level. Replacing
the rest basis matters for the Mountain Bike, whose pedal frames start rotated
180 degrees.

The browser reads the duration of the same loaded IFP clip sampled by the rider
renderer. The BMX and Chopper pedal cycles last 0.7333333492 seconds; the Mountain
Bike lasts 0.6666666865 seconds. Each physics step updates the crank once. Rendering
interpolates through the shortest angular distance across a wrapped clip phase,
without accumulating repeated-frame drift. Frozen and abandoned bicycles hold
their crank; script drivers use the same path as CJ.

Evidence: ARM64 CBmx::ProcessDrivingAnims at 0x100459b78, its phase/damping slice
at 0x10045a0a8–0x10045a0f0 and pedal negation at 0x10045a210–0x10045a21c;
CBmx::PreRender frame slice at 0x10045aca0–0x10045adc8. The
[instruction capture](bicycle-pedals-capture.json) verifies the pinned executable's
hash, instruction words and constants. Reproduce with:

```
node scripts/content/capture-bicycle-pedals.mjs [path-to-pinned-executable]
```

The live regression loads all three original models and their IFP blocks, pedals
through actual simulation steps, checks phase against clip duration, verifies
level treads and original mounting positions, and covers script drivers, freeze,
abandonment and repeated rendering. Focused units check timestep damping and
interpolation across the phase wrap. Existing fourteen-model wheel checks pass.

The association-selection state machine remains the browser's existing rider
controller: speed selects pedal/still. The subsequent
[cadence port](BICYCLE_RIDER_CADENCE.md) now advances its available pedal clock
with captured speed/gear/lean/playing decisions. Native
sprint selection, transition blending,
hand placement and full suspension geometry remain unported. Bunny-hop pose
ownership was subsequently integrated in [the jump association slice](BICYCLE_HOP_POSES.md). This
change implements the original crank/frame math for the available association;
it does not establish complete bicycle animation or dynamics parity. Matched
retail PC captures remain outstanding.
