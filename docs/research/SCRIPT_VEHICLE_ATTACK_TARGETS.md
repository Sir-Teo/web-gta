# Scripted attacks on the actual vehicle target

TASK_DESTROY_CAR previously received no combat entity for a bike, boat or
aircraft. A dismounted ZERO2 courier could therefore abandon its attack on the
RC Baron. The weapon sight check also judged a scripted car target against CJ's
occupied vehicle, even when the script named a different vehicle.
Ordinary NPC bullet impacts also dispatched damage only to automobiles and
pedestrians, so fixing target selection alone left the Baron unharmed.

The host now exposes a shared combat view for supported cars, bikes, boats and
aircraft, independently of the existing seat/boarding interface. The view reads
the actual body, live health, destruction state, disposal and collision radius.
Automobiles retain their original object. Non-car melee calls go through each
class's existing damage method, including aircraft scaling, script immunity,
proofs and attacker storage. NPC melee supplies explicit non-player attribution,
so player-only damage protection also applies to these hits.
Ordinary NPC bullets now dispatch physical hits on bikes, boats and aircraft
through the same live-class damage view, including incidental vehicles outside
the current scripted attack. Shooter ownership and explicit non-player
attribution reach the existing damage gates. Full non-car tyre and impact-push
behavior is outside this integration.

Scripted gun sight uses the body the task actually targets. That body's own
collision confirms visibility; other vehicles and world geometry still block
the line. The ordinary player and pedestrian sight paths retain their existing
behavior.

The task's continuation now checks a valid target with native float32 health
not less than or equal to zero, rather than its wrecked status. A zero-health
bicycle ends the task even though CBmx's destruction method never makes a wreck.
An independent script health write does not become a status query.

## Native capture and checks

`scripts/research/native-destroy-car-target.py` runs the pinned iOS executable in
Unicorn 2.1.4, verifying SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
It verifies vtable `0x1005b8d78` +0x60 points to DestroyCar::ControlSubTask at
`0x1003b8d50`. Only GetTaskType is intercepted, returning an existing LeaveCar
subtask (704). Native reference/health selection and return execute; armed/melee
subtask control is outside these captures.

Thirty-six cases vary target presence, packed status and nine float32 health
patterns: positive/negative zero, one, minus one, infinities, quiet NaN and signed
subnormals. Wrecked status does not affect the health gate. NaN retains the task,
as the native FCMP/B.LS branch does. The host predicate follows that comparison
after rounding its double-valued health to float32.
The previous status-based continuation disagreed with nine of the 36 cases.

Unit checks compare all captures and exercise live-class melee adaptation,
protection/proofs, attacker ownership, wrapper reuse, disposal and actual Rapier
sight with CJ elsewhere and intervening cover. The existing native ped-sight and
script-task cases also pass: 93 focused checks in total. Additional dispatch
checks verify actual per-class bullet damage, player-only protection and missing
or disposed collider owners.

The baseline browser executes actual TASK_DESTROY_CAR bytecode against a remote
Baron while CJ remains elsewhere. Before the fix its gunman stayed in standStill
for 100 observations; aircraft health remained 1000 with last weapon -1.
Baseline trace: `artifacts/script-vehicle-attack-before.json`.

All 4,683 unit tests pass (51 skipped), and the build passes. Three live cases
execute TASK_DESTROY_CAR bytecode against a motorbike (461), Tropic (454) and
remote Baron (464). Each remains the gunman's attack target and takes a real
non-player pistol hit: 1000 health becomes 975, last weapon is 22 and the CJ
attacker predicate is false. CJ stays put, with no skips, give-ups or page errors.
Per-model traces and screenshots are `artifacts/script-vehicle-attack-{model}`.
The fixture uses the open street; an earlier Baron position on a roof blocked
its actual muzzle line and correctly received no damage. Original shot callbacks
are preserved while recording the successful impacts.

The existing automobile gun/melee regression and ZERO2's controlled original
result, reward and delayed cleanup also pass on the same production code. See
[ZERO2's coverage and remaining limits](ZERO2_VALIDATION.md).

This integrates the existing authored attack and weapon runners with their real
target. It does not establish complete native attack tasks, weapon switching,
ammo selection, boarding choreography, event ownership or NPC entity-reference
lifetimes. Train combat retains its existing coverage.
