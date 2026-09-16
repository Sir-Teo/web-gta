# Combat and population corrections — September 16, 2026

## Observed runtime defects

- Police spawn scoring preferred behind-camera nodes but still accepted visible nodes. Model downloads could finish after the camera turned. Roadblocks had no view check.
- Civilians and foot police appeared on visible sidewalk nodes; traffic and population cleanup could remove entities while they were visible.
- Native vehicle LOD callbacks existed but gameplay never invoked them. Physics activation at 100 m also hid the entire car, defeating its distant model.
- Every officer used a wanted-level timer, pistol effects/audio, and guaranteed target damage, even when holding an automatic weapon. The damage did not come from the muzzle ray.
- Every bullet multiplied damage by the player's melee strength and knocked its victim down. Civilians fled from the player even when the incident was elsewhere. Punches triggered knockdown without reducing health.

## Changes

Population creation uses an expanded camera frustum test. Visible candidates wait; police and traffic repeat the test immediately before creating the car, after asset loading. Police also recheck proximity. Ambient pedestrian, generated-car, police and traffic cleanup waits off camera. This is a conservative browser policy, not a port of the unreversed population generator. In the playable world, reinforcements now arrive as police-car crews; the independent wanted-triggered sidewalk cop filler is disabled. Car crews stepping out and carjack victims remain visible transitions, not ambient spawns. Ambient patrolling foot-police scheduling remains unfinished.

Gameplay now calls the existing native car LOD adapter with camera-to-clump distance. Physics activation and visual visibility are separate. The original high-detail / low-detail thresholds and outer cull are retained; damage-frame visibility composes with atomic LOD selection. This still lacks native alpha ordering, component-facing culling and fades.

Officers load their actual weapon's native skill/animation group (including `colt_cop`), damage, range, magazine, fire marker, loop and reload timing. Effects and sound use that weapon ID. Firing waits for a clear target and a stationary firing stance. A ray from the gunflash/hand determines the actual impact, including cover, cars, the player and other pedestrians. Target position is captured for a firing cycle, allowing motion to escape the aim rather than assigning damage directly. Each muzzle ray then disperses inside the native weapon.dat crosshair radius (the same GetWeaponRadiusOnScreen row the player crosshair uses), so officers miss at range instead of landing perfect rays. Muzzle flashes, reload reactions and fire animation loops follow the state. Pursuing officers now use the run animation at their running speed, fixing the walk-animation slide. Exact native NPC burst-command selection remains unfinished; dispersion beyond the weapon radius is still not represented.

At one star an unarmed player no longer draws gunfire. The native pursuit code selects the nightstick unless the player's weapon is instant-hit/projectile (with further state exceptions); the browser uses chase/arrest for the non-gun branch and has not yet added the nightstick attack task. Armed one-star and higher-star pursuits can use guns.

Surviving ordinary bullet hits use a native hit reaction without forcing a knockdown. Explosions, melee and lethal hits retain knockdown/death behavior. Gun damage uses weapon damage without the unsupported universal ×3 multiplier; the existing melee multiplier remains. Civilians flee the remembered incident location. Punches now reduce health using the existing browser unarmed damage value (15), which remains approximate.

## References and limits

Pinned gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [CTaskSimpleUseGun](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskSimpleUseGun.cpp): weapon-aware aiming/firing task, animation groups, hand-based gun firing. Parts of ProcessPed remain unreversed/commented.
- [CTaskComplexPolicePursuit](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskComplexPolicePursuit.cpp): SetWeapon's one-star distinction.
- [CCopPed](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Ped/CopPed.cpp): pistol, SWAT, FBI and army loadouts; shooting-rate/accuracy fields. Exact accuracy conversion is not yet implemented.
- [CTaskSimpleGunControl](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskSimpleGunControl.cpp): burst and attack-period rules. The default period is an executable-memory reference, so this pass does not claim to have ported it.
- [CPedDamageResponseCalculator](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PedDamageResponseCalculator.cpp): damage/death/armour interfaces. AccountForPedDamageStats is an executable call, not evidence for a universal multiplier.
- Local `weapon.dat`, `ped.ifp` and weapon IFPs supply the loaded numbers and poses. See [car LOD](CAR_LOD.md) for VisibilityPlugins thresholds.

The browser still approximates combat decision-making, pedestrian event responses, navigation, arrest and population scheduling. These fixes address the observed shortcuts, not complete original-game equivalence.

Pursuit destination selection now includes the player's height. The previous XY-only nearest-node query could select an overpass instead of the closer street in 3D. A two-level graph regression covers this distinction; A* remains the browser route adapter, not native CPathFind.

## Verification

Targeted browser scenarios cover off-camera population blocking, canceling a car spawn after an asynchronous load, low-detail car rendering beyond the physics radius, nonfatal bullet reactions, one-star non-gun pursuit, two-star shooting, cover, surrender, car crews exiting and returning, traffic, weapons, and a live Grove pursuit. The live capture is `artifacts/combat-pursuit-playtest.png`. Exact burst spacing, full pedestrian decision makers and nightstick attacks remain open.
