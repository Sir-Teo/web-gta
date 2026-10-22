# ZERO4: controlled route, result and return

The original New Model Army script now reaches ZERO_4, awards $7,000 and
returns CJ to solid ground outside Zero's shop with the screen visible,
controls restored and remote mode ended. The full regression uses controlled
checkpoints for the player's RC helicopter. Uninterrupted/manual play and
complete native enemy-AI parity remain unverified.

The original setup loads the native RC battlefield in area
10. Its own helicopter, magnet and barrel participate in the original pickup,
carry and drop sequence. The released barrel falls and lands through the
existing object physics, rather than remaining suspended or falling through an
absent arena.

`tests/browser/zero4-magnet.spec.ts` launches mission 74, skips supported
cutscenes and waits for the original remote-control/gameplay state. It requires
fixed arena ground before interacting. Only the player-operated RC helicopter
is frozen and moved to controlled checkpoints. Original NPCs, object positions,
script locals, counters and health are not directly written.

The real ControlLeft/fire button reaches the script's circle button 17. Local
142 names its original barrel (local 77), and local 122 changes from zero to one
on pickup. The barrel follows the helicopter. The next button press clears the
attachment and held state. At the original helipad, fixed ground is
1343.9885816574097. The released barrel drops from about 1348.323 to 1344.423 and
lands; CJ stays at his original bicycle position. Skipped commands, give-ups and
page errors are empty.

Trace: `artifacts/zero4-magnet.json`; inspected screenshot:
`artifacts/zero4-magnet.png`. Earlier blue-void/ground and suspended-barrel
reproductions are kept separately. The combined occupied-area, house/street
transfer and ZERO4 mechanics run passes on the same production code.

`tests/browser/zero4-cargo.spec.ts` also picks up both original planks and drops
them above the two original bridge positions. Gravity brings each into the
script's placement region; the original script snaps and freezes them and sets
both bridge flags. The helicopter then picks up the original bomb and drops it
above the first original tank. The original collision/timer branch creates the
explosion: tank health falls from 1,000 to zero and last weapon damage is 51.
The capture stops before its delayed wreck transition. The other tanks remain
at 1,000 health. Only the player's RC is moved/frozen; CJ is unchanged and no
object/NPC positions, counters or health are directly written. Skipped commands,
give-ups and page errors are empty. Trace: `artifacts/zero4-cargo.json`;
inspected screenshot: `artifacts/zero4-cargo.png`.

Bomb pickup exposed the host's automobile-only APPLY_FORCE_TO_CAR gate. The
[native vehicle-force port](SCRIPT_VEHICLE_FORCE.md) removes that family gate
and corrects effective mass and the COM-relative application point.

`tests/browser/zero4-route.spec.ts` extends those mechanics through the original
result. It places both bridges, bombs each original tank and uses the magnet
to move the three starting barrels off the road. All three tanks reach zero
health, weapon damage 51 and the native wrecked state. The original Bandit
follows recording 521 at the script's 0.5 speed, pauses at the first barrel,
resumes after it is cleared and reaches the original goal near
(-1131.51, 1057.80, 1345.53). Its health stays 2,000 throughout 297 route polls.
No NPC, object, timer, counter or health is directly changed by the fixture.
Only the player-operated RC is frozen and moved; real button presses invoke
all pickups and releases.

The original result registers ZERO_4 and adds $7,000, then cleanup leaves CJ
grounded at native (-2244.6694, 132.5227, 35.3449) outside Zero's shop. Area is
zero, the fade is zero and finished, controls are on, CJ is unfrozen and remote
mode is off. All terrain holds and pending installations are clear. Skipped
commands, give-ups and page errors are empty. The 5.3-minute browser regression
passes. Full trace: `artifacts/zero4-route.json`; inspected screenshot showing
MISSION PASSED! $7000 and CJ outside the shop: `artifacts/zero4-route.png`.

This result exposed and fixed two host cleanup gaps. An occupied-vehicle
teleport must update CJ's position before a subsequent same-step vehicle
deletion; otherwise the frozen bicycle reaches San Fierro while CJ remains
in the arena. Native mission fade ownership also supplies the final 500 ms
fade-in. Both faulty full-route captures are preserved separately, and focused
regressions cover their corrections. See [player teleport](PLAYER_VEHICLE_TELEPORT.md)
and [mission fade cleanup](MISSION_FADE_CLEANUP.md).

This is a controlled original-script result. Manual/uninterrupted helicopter
flight, full enemy helicopter behavior and complete native physics/combat
parity remain separate work.
See [script interior loading](SCRIPT_INTERIOR_SCENES.md) and
[object detach motion](OBJECT_DETACH_MOTION.md).

Final verification passes 5,227 unit tests (51 skipped) and the build. Source
census classifications and the historical mission sweep are unchanged.
