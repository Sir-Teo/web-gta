# Ordinary seated damage below one HP

CPedDamageResponseCalculator::ComputeWillKillPed (PC 0x4B3210) kills in its
ordinary branch when health minus the damage factor is less than 1.0. Exactly
one HP survives. The walking pedestrian helper and player simulation already
implemented that boundary; several seated handlers instead clamped only at
zero, leaving a positive fractional survivor.

The existing healthAfter helper now lives in the pure ped/damage module and
remains re-exported by WorldPedestrians. Mission riders, recruited passengers,
police drivers/passengers, gang drivers/shooters and traffic drivers use the
same ordinary boundary. Their existing accepted-death paths still own the
seat flags, driver coast/exit behavior, blood and accounting.

Pinned source:
[PedDamageResponseCalculator.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/PedDamageResponseCalculator.cpp).
The check is explicit in the reversed PC routine. Its forced-death and
speaking-fall exception branches are separate; this change applies the
ordinary subtraction result in the named seated shot entries.

Unit actor fixtures verify exactly-one survival and sub-one death through all
seven seated roles, including their existing driver/passenger death state.
The original walking-helper import remains compatible. Live mission-rider and
recruit head contacts disable forced critical death and leave either one or
half an HP before applying this boundary. They check resulting health, the
script/seat death state, 16/32 head blood, once-only nonplayer counters and
vehicle-health change during the measured shot. Existing live combat,
passenger death/exit and creator/mission kill regressions cover surrounding
behavior.

This aligns the ordinary death threshold. Full native damage/armour/forced
death, float32 calculation ordering, all ambient-crew kill accounting, other
damage entries and matched retail PC captures remain open.
