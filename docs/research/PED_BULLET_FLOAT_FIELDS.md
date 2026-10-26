# Native float fields in pedestrian bullet damage

A pedestrian with 28.5 HP, native weakness 1.1 and a 25-damage body hit should
retain exactly 1 HP. The old double calculation produced a factor of
27.500000000000004 and a remainder of 0.9999999999999964. The existing ordinary
below-one death rule then killed the pedestrian. Armour similarly retained
12.499999999999996 instead of the native 12.5.

Pedestrian bullet entries now round the damage and weakness fields, multiply
in float32, spend float32 armour and subtract the float32 health remainder.
The existing healthAfterFloat32 applies the native strict below-one boundary.
Player bullet friendly scaling also rounds the native 0.1 factor/product before
its existing 12.5 cap. NPC accepted-bullet calculation and the shared physical
bullet entry use these operations, including nonplayer mounted damage routed
through that physical entry.

## Reference

ComputeWillKillPed (PC `0x4B3210`, gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) uses the stored float health and
damage fields and kills below 1, preserving exactly 1. The iOS executable's
AccountForPedDamageStats (`0x10028a070`) uses single-precision weakness math;
inlined AccountForPedArmour (`0x100289d30`–`0x100289dc4`) loads/stores float
armour, subtracts the absorbed factor, then calls ComputeWillKillPed. The binary
identity and selected calculator research are recorded in
[NPC critical hits](NPC_CRITICAL_HEADS.md).

The important rounding points are the native fields and operations, rather
than an epsilon around death. A genuine remainder below 1 still dies. Armour
absorption precedes a separate critical decision; forced deaths retain their
existing behavior. Generic non-bullet physical entries and other host classes
are outside this change; they do not acquire calculator semantics merely by
using a shared vitals field.

## Verification

Six initial integration tests expose all six failures before repair across
NPC and player/nonplayer physical bullet entries. Thirteen cases now check
exact-one survival, armour remainders, partial-armour crossings, below-one
death and the friendly-scaling boundary. Seventy-two focused checks pass,
including ordinary/critical blood, proofs, native pieces and NPC acceptance.

The live fixture fires actual player and NPC pistols and the public scripted
Hunter gun at native MALE01 bodies. It seeds native float boundary states,
disables critical hits to isolate ordinary damage and checks blood at the
resulting health/armour. The one-HP result is checked again after ordinary
world frames. Death hooks distinguish a real below-one kill from a surviving
one-HP impact. Source weapon data and model weakness define the native factor;
expected surviving one-HP outcomes are exact, not approximate comparisons.

Complete native calculator/task parity, other damage classes/host records,
global random streams and matched retail PC traces remain open.

The build, all twelve live shots and the five-case critical-head regression
pass. Player/NPC pistols preserve 1 HP with and without partial armour and
retain exactly 12.5 armour under full absorption. The mounted minigun preserves
its one-HP boundaries as well. Each below-one hit reports one death; surviving
one-HP hits report none and remain alive after subsequent world frames. All
impacts emit eight body particles at the resulting health/armour. No page
errors occur.

All 6,019 unit tests pass (51 skipped).
The final build and production smoke also pass, including walking, native car
entry, saved-game return, map/waypoint, pause/resume, Rustler takeoff and landing
gear. No page errors or failed requests occur.
