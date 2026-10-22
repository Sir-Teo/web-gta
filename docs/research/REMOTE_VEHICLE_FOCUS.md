# Remote focus for bike and boat collision

ZERO2's RC Baron could fire repeatedly at its first courier without hitting the
motorbike. A controlled probe recorded 508 aircraft shots, unchanged courier
health and a disabled courier collision body throughout. CJ remained in the
original frozen van, whose script position is roughly 700 units above the city.
Bike activation measured distance from CJ even though streaming, cars and
aircraft already followed the remote vehicle.

Bike and boat physics activation and visibility now use `Simulation.worldFocus`.
The existing getter follows the remote vehicle while remote control owns one,
and returns to CJ when it does not. Their `distance()` methods still measure
distance from CJ for boarding and interaction. The existing strict 250-unit
budget, bike ground-collision loading and boat autopilot exception are retained.
This corrects the host's remote-world integration; it does not establish native
distance-budget parity or change the authored bike/boat integrators.

`tests/remote-vehicle-focus.test.ts` uses actual Rapier bodies to check both
families beside the remote focus while CJ is far away, inactive bodies beside CJ
while focus is elsewhere, return to CJ, the ordinary strict distance boundary and
the bike's streamed-ground gate. Five cases failed before the change. Active
frozen bodies remain available to weapon ray queries.

The permanent `tests/browser/zero2-combat.spec.ts` passes after the change. It
waits for ZERO2's actual gameplay help and fade-in, holds the real fire key and
moves only the player-controlled Baron to aim at the moving first courier. Its
own health is maintained for this diagnostic. The bike's original 1000 health
falls to zero through M4 weapon 31, the attacker query identifies CJ, the driver
dies, the original reaction flag becomes one and the script's courier counter
reaches one. CJ's position and van occupancy remain unchanged; skips, give-ups
and page errors are empty. The inspected screenshot shows the Baron in San
Fierro and the original “One down, four to go!” message. Trace and screenshot:
`artifacts/zero2-combat.json` and `artifacts/zero2-combat.png`.

All 4,624 unit tests pass (51 skipped) and the build passes. The live frozen-boat
fire and four-class freeze/release regressions also pass. The latter now releases
the boat's independent anchor before asserting forward motion, retaining its
original threshold. The initial check established controlled first-courier
combat. Its [extended regression](ZERO2_VALIDATION.md) subsequently reaches all
five deaths, the original reward and delayed cleanup. Uninterrupted flight
remains unverified. Historical mission sweep outcomes are preserved.

See [remote-control acquisition, streaming and limits](REMOTE_CONTROL.md).
Complete remote camera behavior and uninterrupted ZERO2 flight still require
separate coverage. Later population and controlled-result evidence follows.

The later [population-centre integration](REMOTE_POPULATION_FOCUS.md) also fixes
retirement and spawning around remote control, with native selection captures
and a live return/lifetime regression. The controlled ZERO2 result is documented
separately above; uninterrupted flight remains unverified.
