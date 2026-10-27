# Bicycle bunny-hop rider poses and PC control

The BMX, Chopper and Mountain Bike render their original BIKE_BUNNYHOP
association while CJ charges and releases a jump. Previously the bike launched
while CJ kept the ordinary still/pedal pose. A full hop also blends the crank
towards π/2, as native CBmx::ProcessDrivingAnims does, instead of pedalling
through the jump.

PC CBmx::ProcessBunnyHop (0x6C0590) owns the charge and association together:

- A fresh press with zero charge adds one native timestep, creates the
  association at time zero, blends in at 8 per second and pauses playback.
  The held branch then adds another timestep, capped at 25, and holds the clip
  at `0.2 × charge / 25`. Later held frames add one timestep each.
- Release starts at
  `(0.2 − heldTime) / 0.2 × (duration − 0.2) + 0.2` and plays at 1.5× speed.
  The clip's finish callback supplies the charge for the launch once.
- The association cuts gas only when its existing blend exceeds 0.5.
- Charge stays nonzero through the association's finish fade. After removal,
  ProcessBunnyHop finds no association and clears the charge. A new press can
  then rearm it. The PC code has no additional half-second or shared cooldown.

`stepNativeBicycleHop` now drives that lifecycle, its rendered pose, the crank
and the physical finish callback from one state. `controlJump` and `hopLaunch`
are diagnostic projections of that state. The previous independent release
countdown, authored missing-clip delay and shared iOS cooldown are removed.
Another bicycle cannot block this one or shorten a cooldown by stepping it.
A missing clip creates no synthetic association. All three shipped jump clips
last 0.3333333433 seconds, so a full charge releases over about 0.088889 seconds.

The pinned ARM64 descriptor table at 0x100624910 contains `[206, 0x1018]` for
BIKE_BUNNYHOP: FINISH_AUTO_REMOVE, PARTIAL and SECONDARY_TASK_ANIM. The PC
descriptor array currently omits its last three bicycle entries, so this table
is necessary evidence. CAnimBlendAssociation::UpdateTime (PC 0x4D13D0) fades a
finished association at −4 per second; UpdateBlend is PC 0x4D1490. A cancelled
association uses the −8 rate explicitly set by ProcessBunnyHop for a departed
player. Departure also clears that ped's association from the host vehicle.

The player renderer adds the timed layer after the ordinary steering layer.
NativeCharacter samples and blends the original skeleton tracks over the ride
pose. The crank prioritizes the jump association throughout its finish fade.
Frozen physics holds both the association and the crank without replaying time.

Sources at the pinned PC revision:
[Bmx.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Bmx.cpp),
[AnimBlendAssociation.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Animation/AnimBlendAssociation.cpp).
The [ARM64 timing and descriptor capture](bicycle-hop-capture.json) is reproducible:

```
node scripts/content/capture-bicycle-hop.mjs [path-to-pinned-executable]
```

Focused units cover the two first-press branches, blend-gated gas, partial
release, finish callback, retained charge, fade/removal/rearming, independent
bicycles, missing clips, interruption and crank priority. The live touch
regression holds the actual Bunny hop button, verifies the rendered association
against charge, releases into a physical jump and checks that the layer clears.
All three original bicycle models also verify charge, release time, jump crank
position, freeze, physical launch, fade-out and remount. Existing bicycle/quad
handling, drowning, airborne steering and knock-off checks run alongside them.

Remaining differences: the host cancels an interrupted secondary association
when controls are disabled because it lacks the native task manager's complete
association cleanup. Body/contact integration is still the browser controller;
the original launch turn force, suspension, speed-dependent cadence, sprint
selection and complete animation-task blending remain open. Association clocks
advance with the host's fixed physics steps. This source-backed integration does
not establish matched retail PC animation or dynamics parity.
