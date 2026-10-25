# Bicycle bunny-hop rider poses

The BMX, Chopper and Mountain Bike now render their original BIKE_BUNNYHOP
association while CJ charges and releases a jump. Previously the bike launched
while CJ kept the ordinary still/pedal pose. A full hop also blends the crank
towards π/2, as native CBmx::ProcessDrivingAnims does, instead of pedalling
through the jump.

PC CBmx::ProcessBunnyHop (0x6C0590) blends the association in at 8 per second,
holds its time at `0.2 × charge / 25`, and releases it at 1.5× speed. A partial
charge starts the release at
`(0.2 − heldTime) / 0.2 × (duration − 0.2) + 0.2`. The existing browser launch
timer already uses that relationship; the visual now consumes that same timer
and the loaded clip's duration. There is one owner of release timing.

The pinned ARM64 descriptor table at 0x100624910 contains `[206, 0x1018]` for
BIKE_BUNNYHOP: FINISH_AUTO_REMOVE, PARTIAL and SECONDARY_TASK_ANIM. The PC
descriptor array currently omits its last three bicycle entries, so this table
is necessary evidence. CAnimBlendAssociation::UpdateTime (PC 0x4D13D0) fades a
finished association at −4 per second. A cancelled association uses the −8
rate explicitly set by ProcessBunnyHop. In the host, disabling controls also
cancels the visual; departure clears the departed rider's association from the
vehicle so a later rider cannot inherit it.

The player renderer adds this timed layer after the ordinary steering layer.
The animation sampler blends its original skeleton tracks over the ride pose;
the bike supplies no replacement character geometry or invented jump keyframes.
NativeCharacter already supports timed partial layers. The crank prioritizes
the jump association while it exists, including its fade-out.

Sources at the pinned PC revision:
[Bmx.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Bmx.cpp),
[AnimBlendAssociation.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Animation/AnimBlendAssociation.cpp).
The [ARM64 timing and descriptor capture](bicycle-hop-capture.json) is reproducible:

```
node scripts/content/capture-bicycle-hop.mjs [path-to-pinned-executable]
```

Focused units cover charge, partial release, 1.5× playback, fade, cancellation,
missing clips, frozen timing and jump priority over crank pedalling. The live
touch regression holds the actual Bunny hop button, verifies the rendered
association against the bike's charge, releases into a physical jump, and
checks that the jump layer clears. All three original bicycle models also
verify full charge, matching release time, jump crank position, frozen poses,
physical launch, fade-out and a fresh pose on remount. Existing bicycle/quad handling, drowning,
airborne steering and knock-off checks pass alongside it.

The pre-existing browser charge/launch physics and iOS-derived shared cooldown
are retained. Their PC differences, original suspension, launch turn force,
speed-dependent cadence, sprint selection and complete animation-task blending
remain open. This is an association rendering integration, not proof of full
PC bunny-hop dynamics or matched retail animation parity.
