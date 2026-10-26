# Gang drive-by kill accounting and callback lifetime

Gang drive-by drivers and gunners now report their first accepted fatal hit
with the unit's gang and existing creator classification. Player-ped,
player-vehicle and remote kills reach the same counter/respect routes as
walking peds. Driver coast and dead-gunner contacts cannot report another kill.
Forced instant-hit head death is separate from the original weapon factor,
including a victim above the previous 1,000-point stand-in amount.

## Source and routing

The creator rule follows CEventHandler::RegisterKill (PC `0x4B9340`) and the
existing CDarkel routes, pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`. The raw player-ped route adds the
player/checkpoint counts and the appropriate gang count/respect: Families
(index 1) costs five respect, another gang gains 0.75. The mapped player-vehicle
route adds 121 alone. The remote route adds 120 and the relevant friendly/enemy
gang counter, without player respect. These unit members are not recruits.
[Source identity and unported accounting fields](POLICE_SEATED_KILLS.md#reference)
remain subject to that document's scope.

Death descriptions retain whether the fatal hit was already accounted for.
A counted driver body's later exit or a counted occupant's drag-out uses the
shared corpse restoration path rather than another synthetic weapon hit.
The gunner's firing state stops before its kill callback. Invalid, occupied,
gone and already-dead entries report no new death.

## Async setup repair

The drive-by manager is created in a dynamic-import callback. Its previous
onCrewDiesOut assignment was guarded by if(driveby) before that import created
the manager, so it was never installed in the ordinary startup sequence. The
new onCrewKilled callback initially exposed the same lifecycle problem.
Both callbacks are now installed immediately after construction alongside the
other manager hooks.

The diagnostic live capture recorded zero health and stopped firing, a
completed stationary coast with driverOut=true, unchanged counters and no
body. Moving registration to the manager's creation fixes both reporting and
the missing exit-body callback. The diagnostic is retained in
artifacts/gang-seated-kills-failure.json.

## Checks and limits

Units cover gang identity, all mapped creators, surviving hits, high-health
forced heads, repeated/dead/invalid entries and corpse descriptions. The live
matrix uses native gang-war attack-car setup with Families and rival crews,
two occupants each and all three creators. One high-health driver is killed
through the actual pistol API; the remaining hits exercise the seated damage
adapter. The test waits for each driver's ordinary two-second coast and body,
checking counters remain stable after reconstruction.

Complete native creator identity, NPC-to-ambient seated routing, other ped
fields, non-bullet deaths, traffic-driver accounting and matched retail
input/task/render equivalence remain open.

Validation: 26 focused units, the full suite (5,690 passed, 51 skipped), a build
and the six live gang/creator cases pass. All twelve occupant deaths report
immediately, all repeated-contact counters remain stable and every delayed
driver body preserves those totals. The actual pistol trial produces fatal
head blood after reducing the 5,000-HP driver to zero.

The surrounding live gang-car jack passes from both doors, with its original
models and firing/exit behavior. Provoking and clearing the Ballas war still
creates its attack car and transfers zone strength to the Families.
