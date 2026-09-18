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
- [CCopPed](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Ped/CopPed.cpp): pistol, SWAT, FBI and army loadouts with shooting accuracies 60/68/76/84; the browser scales the weapon.dat cone by 60/accuracy (street cops unscaled), since the executable mapping is not reversed.
- [CTaskSimpleGunControl](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskSimpleGunControl.cpp): burst and attack-period rules. The default period is an executable-memory reference, so this pass does not claim to have ported it.
- [CPedDamageResponseCalculator](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PedDamageResponseCalculator.cpp): damage/death/armour interfaces. AccountForPedDamageStats is an executable call, not evidence for a universal multiplier.
- Local `weapon.dat`, `ped.ifp` and weapon IFPs supply the loaded numbers and poses. See [car LOD](CAR_LOD.md) for VisibilityPlugins thresholds.

The browser still approximates combat decision-making, pedestrian event responses, navigation, arrest and population scheduling. These fixes address the observed shortcuts, not complete original-game equivalence.

Pursuit destination selection now includes the player's height. The previous XY-only nearest-node query could select an overpass instead of the closer street in 3D. A two-level graph regression covers this distinction; A* remains the browser route adapter, not native CPathFind.

## Verification

Targeted browser scenarios cover off-camera population blocking, canceling a car spawn after an asynchronous load, low-detail car rendering beyond the physics radius, nonfatal bullet reactions, one-star non-gun pursuit, two-star shooting, cover, surrender, car crews exiting and returning, traffic, weapons, and a live Grove pursuit. The live capture is `artifacts/combat-pursuit-playtest.png`. Exact burst spacing, full pedestrian decision makers and nightstick attacks remain open.

## Cars striking pedestrians

Before this change, a car touching an upright pedestrian only knocked it down for a fixed time. Pedestrians took no damage from cars, and because their bodies are kinematic, the physics solver treated each one as an immovable wall that stopped the car.

Car and pedestrian colliders now share no solver contact (`simulation/solverGroups.ts`). The impact follows two reversed routines, ported in `combat/nativeCarPedHit.ts`:

- **`CPhysical::ApplyCollision`, ped branch.** The struck ped has `bDisableTurnForce`, so the vehicle's mass and turn mass count ten times. The common normal speed, mean elasticity of 0.05 and the two intensities follow the source. The ped's force never points down, and it is halved when the car is nearly still. The car's force is divided by ten again, so a car barely slows.
- **`CTaskSimpleKillPedWithCar::ProcessPed`.** Sides beyond 99 percent of the car's half-width are left or right hits, and run-overs when the ped is within 85 percent of the leading half-length. A ped above the car's origin is thrown onto the bonnet with the source's speed formula. Anything else is dragged under the front. The ped takes 1000 damage as `WEAPON_RAMMEDBYCAR` or `WEAPON_RUNOVERBYCAR` on the arm or seat, with the ported death animation choice. The car is pushed back by 100 scaled by `min(1, mass / 1400)`, and run-overs play `AE_PED_CRUNCH`.

Known differences:

- `CPed::KillPedWithCar` (0x5F0360), which chooses between the kill task and lesser responses, is a retail stub upstream. The kill gate is authored: a ped impact intensity above 12, about 8 m/s of closing speed on a 70 kg ped. Below it, cars faster than 2 m/s keep the old authored knockdown, and slower cars only push the ped by the native impulse.
- `CPedGeometryAnalyser::ComputePedHitSide` is a stub; the side facing the car's approach is used. The contact normal runs from the ped's centre to the car's centre of mass rather than from the collision point.
- The reversed task maps the ped into the car's frame with `TransformPoint`, which would give world coordinates. The inverse rotation is used, since the bounding-box tests need model space.
- Pedestrians are kinematic, so thrown and bonnet speeds only slide the body along the ground. `DamageCarBonnet`, the hit-and-run event, pad shake and hits on the player on foot are not reproduced.

Verification: ten unit tests cover the impact maths, the kill gate crossing, the clamp and each branch of the kill task. A browser test stands a civilian in front of the Grove Street car at 12 m/s: the pedestrian dies, and the car keeps more than 60 percent of its speed.

## Melee input, combo swings and hit reactions

- **Left click attacks.** SA's left button fires or swings. The browser also uses a left drag to turn the camera when the pointer is not locked, and a left press only attacked while aiming, so fists and melee weapons could not be used from the mouse at all. A short, nearly still left click (under 6 px and 350 ms) now attacks; under pointer lock the held left button fires.
- **Combo swings.** Each swing plays its stage's clip from the native melee group tables (`aMelee_1Animations` and the rest in `Animation/AnimAssocAnimations.h`): FightA_1 to FightA_3 for fists, Bat_1 to Bat_3 for bats and clubs, and likewise for knives, swords, chainsaws, dildos and flowers. Before this, every swing replayed the first clip.
- **Chaining.** A new strike may start once the current one's melee.dat hit frame has passed, and a press before its chain frame continues the combo. The authored 0.65 s refire interval had been longer than the jab's chain window, so combos never reached the second hit.
- **Ground attacks.** A downed ped within reach in front takes the AGROUND attack with the group's ground clip (FightA_G, Bat_4 and so on) and its melee.dat damage. Before, standing swings passed over downed peds.
- **Hit reactions.** A player's combo hit goes through the ported `CEventDamage::ComputeDamageAnim` with the fight task's combo set and current move. Frontal hits play HitA_1 to HitA_3; side and rear hits use the body-part reactions; low health still floors the victim. Before, every surviving melee hit knocked the victim down.

Known differences: `CTaskSimpleFight::IsComboSet`, `FightStrike` and most of the fight task are retail stubs. The victim falls on the combo's third move as an assumption about `IsComboSet`. Weapon combos use the HitA clips for victims, because the per-group hit clips live in the weapon animation files that pedestrians do not load. Damage lands on the click rather than on the hit frame.

Verification: a browser test chains jab, cross and hook on a civilian standing in front of CJ. The first two only stagger, the third floors, and a further click kicks the downed victim. The weapons, combat, damage reaction and character browser tests pass.

## Bullets on props and tyres

`CWeapon::DoBulletImpact` (0x73B550) is reversed even though `FireInstantHit`, the hitscan itself, is not. Two of its branches are now ported.

- **Props.** Props below the breakable damage effects are pushed, not damaged. A static prop with no uproot limit unfreezes, and a moving prop takes `ApplyForce(normal x -2)` at the hit point, a fifth of that for shotgun pellets. Breakables take `ObjectDamage` by their OBJECT.DAT gun-break mode: 50, 151, or 151 times the smash multiplier. Props of 99998 kg or more, and those with a damage multiplier of 99.9 or more, ignore bullets. So a pistol round knocks a cardboard box off the kerb, one shot breaks a road barrier, and a lamppost needs twenty.
- **Tyres.** `FireInstantHit` sets `CWorld::bIncludeCarTyres`, so shots also test the wheel spheres `CAutomobile::SetUpWheelColModel` builds: half the IDE wheel size at each wheel frame. A hit runs `CAutomobile::BurstTyre`: the Rhino is immune, a tyre bursts once, `AE_TYRE_BURST` plays, and the car takes a random sideways nudge and yaw of up to 0.03 of its mass and turn mass. The existing wheel port then applies the burst: random suspension drops from `DoBurstAndSoftGroundRatios`, the lateral noise of `fBurstTyreMod` 0.13, and the automobile damage manager's wheel damage effect of 0.5 on grip, which had been passed as 1.

Known differences: `Fx_c::AddTyreBurst` is a retail stub, so no burst effect plays. `CVehicle::InflictDamage` is a stub too, so non-wheel hits keep the existing vehicle damage, and the vehicle push from `DoBulletImpact` is not applied. Only the player's instant-hit shots test tyres; drive-by and NPC shots do not yet.

Verification: unit tests cover each branch of the object rule. Browser tests knock the Grove Street cardboard box loose with a pistol, burst the Greenwood's front-left tyre with one round, and drive the car afterwards.
