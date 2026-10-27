# Explicit script-ped armour

ADD_ARMOUR_TO_CHAR now updates the live ped rather than a script-only number.
GET_CHAR_ARMOUR reads the remainder after accepted damage. The pool retains the
live value when rebuilding a ped in a vehicle and back on foot, including
armour assigned while the first body is still loading. Recruited passengers
also retain the figure through boarding and exit.

## Reference and order

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` identifies
AccountForPedArmour at PC `0x4AD550`. Its implementation still calls the retail
executable; the unexecuted proposed body is not independent PC evidence.
The pinned iOS binary (SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`)
inlines the operation in ComputeDamageResponse at
`0x100289d30–0x100289dc4`, after AccountForPedDamageStats and before
ComputeWillKillPed:

1. Drowning (53) and falling (54) bypass armour.
2. Otherwise subtract the stat-scaled factor from armour, passing only any
   overflow to the health calculation and recording the absorbed amount.
3. Forced death and mega punch run afterwards. An already-supported forced
   headshot still kills, but armour spends the scaled hit amount first.

PC ComputeWillKillPed `0x4B3210` records the actual lost health, including all
remaining health on death. Both health loss and armour loss now reach the
on-foot damage-animation calculation, and an armour-only hit records the last
weapon. Physical proofs, vest rejection and known NPC group rejection run
before spending armour. Accepted blood remains an impact effect even when
armour absorbs all damage.

## Verification

Unit checks cover absorption, overflow, equality, bypass weapons, NPC weakness,
rejected impacts, pending creation and both vehicle rebuilds. A live browser
trial covers script reads, ordinary hits, weakness, friendly scaling, bypasses,
proofs, forced headshots, a real mounted-gun impact and vehicle transitions.

The full unit suite passes (5,652 passed, 51 skipped), the build passes, and
ten live browser checks pass across armour, weapon contacts, NPC groups,
creator/kill accounting and recruited-passenger protections. The seated trial
checks fifteen source/weakness/critical-hit combinations in original cars and
on a motorcycle; all preserve measured vehicle health and emit blood after
the resulting health and armour are available.

This change handles explicitly assigned armour on walking script peds, mission
riders and recruited passengers. Ambient cop defaults and crew retention are covered in
[cop armour](COP_ARMOUR.md); ongoing fire uses a separate path. Complete PC executable parity, float32 rounding and damage-task
coverage remain unverified.

## Seated spending and retained weakness

Mission riders and recruited passengers now spend retained armour on accepted
seated shots. WeaponSystem keeps the original hit factor alongside its legacy
ambient-crew head amount. The retained-ped adapters apply weakness and, for a
raw player-ped attack on a group member, friendly scaling before absorption.
Then they apply forced head death separately. Thus a critical hit kills even a
5,000-HP target without spending 1,000 points of armour for a 25-point bullet.
NPC contacts use the same retained-ped ordering. Physical proofs and source
gates still run first; blood samples the resulting health and armour, and the
existing fatal transition owns once-only kill accounting.

Seated mission peds now load their defend weakness from the same model stats
as walking peds. The carried state retains it through script vehicle rebuilds.
For example, peds.ide assigns MALE01 to STAT_SENSIBLE_GUY, whose pedstats.dat
weakness is 1.1. A 125-point ordinary sniper hit therefore removes 137.5 health
without armour. Earlier seated fixtures incorrectly assumed 1.0. The one-HP
boundary fixture now starts from the scaled damage plus the intended remainder.

Ambient gang/traffic legacy forced-head amounts, ongoing fire,
full native source/group/task coverage, float32 parity and matched retail
captures remain open.
