# RIOT2 gunshot hearing range

`SET_GUNSHOT_SENSE_RANGE_FOR_RIOT2` (098A) now changes the shared gunshot-event range used by
mission-created pedestrians. RIOT2 (mission 109) sets 15 at SCM 2586347 and restores -1 at
2598862 and 2610506. Ambient pedestrians retain their 45-unit hearing radius.

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
The command handler at `0x100203814` copies its raw float operand into global `0x10064a130`,
whose initial value is -1. This is shared state, with no command-side clamp or timed reset.

CEventGunShot::AffectsPed (`0x1002888e0` range branch; reversed PC `0x4B2CD0`) uses a positive
override only when the listener's created-by byte is 2 (mission). Otherwise a mission ped uses
GetPedFOVRange, the maximum of hearing and seeing range. Both default to 15, or 40 for gang
ped types 7–16. The existing SET_SENSE_RANGE command changes both together. Ambient listeners
always use 45, even when the override is positive.

The preceding native code at `0x100288890` measures float32 three-dimensional distance between
the firing entity and listener origins. It squares the selected range and rejects only distances
greater than that value; the boundary is included. The muzzle point is used separately by the
silent-shot facing and line-of-sight checks. Previously the browser used the muzzle distance and
a fixed 45-unit range for every listener.

## Integration and checks

ScmGameState owns the float32 override. The live pedestrian world reads it through a provider,
so rebuilding the world does not silently reset this script global. Known NPC shooters use their
own entity origins; player shots use CJ's origin. The existing fallback for an unknown NPC ID
still uses the supplied shot point. Police event handling, group coverage, silent-shot visibility
and subsequent AI responses retain their existing engine limits.

Five unit checks cover float32 boundaries, inclusive 3D distance, positive/reset behavior,
mission defaults, explicit sense ranges, ambient hearing, NPC source origins and group exclusion.
The adapter check executes all three original RIOT2 instructions. The browser runs those same
instructions against a live mission gang member 20 units away and an ambient listener 22 units
away, reading the real received events synchronously before the script loop clears them. The
mission listener hears before and after the override; the ambient listener hears in every phase.
This does not establish a complete RIOT2 mission pass.
