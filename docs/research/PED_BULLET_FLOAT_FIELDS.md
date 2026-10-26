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

## Seated mission riders and retained recruits (October 26, 2026)

The separate scriptRiderShot and CarEntry.passengerShot adapters still had the
same double-precision factor, armour and ordinary health operations. They now
reuse pedDamageFactor, spendPedArmourFloat32 and healthAfterFloat32, including
float32 player-friendly scaling. Their existing proof/source gates, critical
head override, once-only kill callbacks and corpse/exit ownership remain.

Fourteen role-specific checks expose ten failures before repair, then pass
with the existing proof, armour and passenger tests (66 focused cases). The
live fixture checks mission riders and retained native MALE01 recruit records.
For each role, real NPC muzzles verify one HP, partial armour, exact armour and
below-one death; a raw-player adapter call checks group-friendly scaling with
actual script membership or the retained follow flag. It checks car health,
post-frame health, blood and first-fatal accounting. All ten scenarios pass.

The recruit fixture initially selected a line through CJ's nearer driver head:
the damage adapter correctly retained that protected contact, leaving the
recruit unchanged. The fixture now requires the shared incoming-seat query to
identify the recruit before issuing its actual muzzle shot. No gameplay or
collision filter was changed to fix that test setup.
The existing script armour/rebuild and street-recruit wounded-exit/dead-seat
regressions also pass. No page errors occur in either transition check.
All 6,033 unit tests pass (51 skipped) with the seated adapters updated.
The final build and production smoke pass for the seated update, including
native car entry, walking, saved-game return, map/waypoint, pause/resume,
Rustler takeoff and landing gear, with no page errors or failed requests.

## Player melee and shared foot damage responses (October 26, 2026)

The physical player-melee entry still used double arithmetic after the earlier
bullet work. In particular, its retained native 0.1 friendly factor was
multiplied in double: an 82.5 factor became 8.250000122929 rather than the
native float product 8.25. A 9.25-HP recruit consequently died just below one.
A normal jab could also retain a non-native fractional HP field.

The melee entry now rounds the selected existing player attack strength,
weakness, friendly product, armour and health operations as native floats.
Its existing attack multiplier, friendly cap, ground row, proofs, weapon
choices, recruitment departure and mega-punch/critical ordering are retained.
Other generic damage classes continue on their existing path.

Both physical bullet entries and applyNpcBullet also used quantized stored HP
loss as DamageHealth. PC ComputeWillKillPed (`0x4B3210`) instead reports the
remaining factor on survival and the stored pre-hit health on death. These
foot entries now supply that response to damage animation and last-weapon
tracking, as the player calculator and NPC fist entry already do. At 2^30 HP,
a native pistol factor of 27.5 leaves HP unchanged but retains its positive
damage response. Sub-ULP factors likewise retain their native event amount.

The same pinned iOS float/armour instructions and PC health/response body
described above support these selected operations. The existing player attack
profile is preserved; the unavailable PC AccountForPedDamageStats body and
complete native calculator/task behavior remain explicit gaps.

Twenty-two new cases expose ten failures before repair. They cover player
melee one-HP/friendly boundaries, full/partial armour, proofs, fatal and tiny
responses, plus player/NPC/raw-vehicle bullet responses independently of stored
HP loss. All 198 focused checks pass with existing armour, critical/proof
acceptance, bullet precision and damage-animation checks, followed by the build.

The expanded live bullet fixture fires fifteen real player/NPC pistols and
public scripted Hunter gun contacts. All three creators retain one HP,
partial/full armour and genuine below-one death, and now check the native
response amount too. The additional large-HP cases expose field quantization
without replacing the response by HP loss. Blood remains eight body particles
at the resulting vitals, fatal accounting is once-only, and post-frame health
matches. All fifteen contacts pass without page errors.

The player-melee fixture uses the public weapon system's original ground kick
at its native hit frame. Its friendly case joins a CREATE_CHAR Families ped
through the actual group-control method before the kick. Other cases cover
one HP, partial/full armour, large-HP response and genuine below-one death,
with animation response and post-frame health/accounting checks.

The initial ground-kick setup exposed two fixture errors: it fired before the
fall updated the body's centre, and supplied a camera ray without turning CJ.
Melee uses CJ's heading and its existing ground-target height/cone tests. The
fixture now waits for the actual fallen body to enter those bounds and faces
the target before firing. Neither range/cone filtering nor hit-frame timing
was changed to make the contact pass.

The six kicks then produced the expected vitals and responses, but a new
post-frame assertion incorrectly assumed the recruited mission ped stayed
disbanded. damageCollider clears its immediate follow field; the mission's
playerRecruited registration retains script membership, and group sync
restores the field on the next frame. The fixture checks the existing
immediate clear at animation response and records the later field separately.
Complete group-event ownership/removal remains open; this arithmetic repair
does not establish that native group behavior.

All six ground-kick cases pass without page errors. Ordinary, partially
armoured and actually recruited friendly targets retain exactly one HP after
normal world frames; full armour absorbs exactly 82.5, leaving 17.5. The large
HP target loses 64 stored HP while the native response remains 82.5. A genuine
below-one target reports its pre-hit 83 HP once on death. Every attack selects
the ground move and resolves at the original hit frame, with its native health/
armour response reaching animation.

The NPC kickboxing regression passes too. A later player mouse-combo run
recorded a press with no fire call, rather than a rejected/damaging strike.
The input handler treats an unlocked click as an attack only when its press/
release lasts under 350 ms; separate browser down/wait/up commands can be
delayed around frames. The fixture now uses Playwright's single click action
and records releases/targets. Its passing trace contains four canvas clicks
of 0.2–0.6 ms and raw 6/9/15/25 jab/cross/hook/ground damage, preserving the
existing combo, knockdown and ground-target assertions without changing input
or combat implementation.

All 6,211 unit tests pass (51 skipped) with the melee float operations and
shared foot damage responses.
The final build and full production smoke also pass, including saved-game
return, walking, native car entry, map/waypoint, pause/resume, Rustler takeoff
and landing gear. No page errors or failed requests occur.
