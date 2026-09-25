# Original PC 1.0 fidelity audit

Target selected by the user on September 17, 2026: one-to-one original PC 1.0 behavior and presentation, across the entire game. No subsystem is accepted merely because its browser implementation exists or its unit tests pass.

## Reference identity

- Platform/release: original PC 1.0.
- Executable hash, region, settings, frame limiter, resolution and capture setup: **unverified**.
- Algorithm research: gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`, verified against the local checkout. Routines still calling the retail executable are not available implementations.
- Original-game input traces and matched captures: **not established by this audit**.

## Open compatibility requirements

| System | Current evidence / difference | Required acceptance evidence |
| --- | --- | --- |
| Script runtime and campaign | `ScmRuntime` executes numeric/control-flow families, ordinary and mission scheduling, mission loading, native no-ops and a first set of game-state commands, separately from gameplay. With a recording world adapter, packaged MAIN reaches mission INITIAL, which stops at CREATE_LOCKED_PROPERTY_PICKUP (mission offset 868); message queues, help text, intro text lines, switch tables, streaming requests and the radar blip table are ported, and 1,190 of 1,455 distinct MAIN.SCM commands remain unsupported. Authored mission objectives are not original campaign execution. | Original threads, variables, native commands, cleanup, cutscenes, success/failure/retry and saved script state execute correctly across the campaign and side content. |
| Physics and vehicles | Rapier contacts are approximate; `planeFlight.ts` uses authored equations, including a purported ground effect without a ground-distance input. Bike lean and boat integration retain authored behavior. | Original dynamics/task semantics and repeated multi-class acceleration, braking, cornering, impact, flight and water trials. |
| Player, camera and animation | Movement/animation pieces are implemented; native constants do not prove complete transition or collision equivalence. | Matched input/pose/contact/camera traces, including occlusion, interiors and vehicle transitions. |
| Population and police | Authored recovery, spawn decisions, clamps and roadblock placement remain. | Original task/event scheduling, population selection, pursuit and mission-exception behavior. |
| Combat | Native assets/data and selected algorithms coexist with browser task integration. | Damage, targeting, animation events, projectiles, AI decisions and all equipment compared against PC 1.0. |
| Renderer, streaming and effects | Earlier PS2-inspired choices require reassessment. Sirens/skidmarks/effect triggers include approximations. | Matched PC captures and motion; correct collision/navigation/resource lifetime across traversal and interior transitions. |
| Audio | `radioSpeech.ts` substitutes frontend-bank loops for radio and combat vocals for speech. | Original station content/scheduling, speech selection and audio entity behavior. |
| Saves, stats and progression | Selected state persists; complete native world/script state is not established. | Reload equivalence for original progress, stats, entities and script state; original save compatibility or explicitly verified semantic equivalence. |
| Complete content | Vehicle/weapon/archive counts do not establish playable coverage. | Versioned inventory of campaign, side activities, interiors, UI, customization and special vehicle systems, each with end-to-end evidence. |
| Runtime reliability | Passing units coexist with browser failures. | Reproductions resolved and regression-tested; sustained traversal, cold launch and resource-lifetime checks. |

## September 17 initial reproduction

- Baseline unit suite: 1,103 passed, 41 skipped. This is implementation regression evidence, not reference matching.
- Hangar launch failed with `No runway terrain beneath the plane`: newly installed paused terrain was absent from the world ray query's broad phase. `fixedGroundDistance` queries enabled fixed colliders directly, without stepping other entities. Regression tests cover replacement, removal, dynamic bodies, disabled geometry and sensors.
- After that fix, launch and flight assertions passed; landing gear remained down. Recruitment consumed `KeyG` before checking whether the player was in an aircraft. The recruitment context now guards input consumption.
- The flight screenshot was inspected: aircraft, terrain and HUD render. This is browser visual inspection, not a PC reference comparison.

Verification after both fixes: production build passed; both new fixed-ground regression tests passed; all four aircraft browser tests passed (launch/takeoff/gear/pause, all 17 aircraft asset lifetimes, landing/exit, wheel rendering). Other browser test files were not rerun in this pass.

## World streaming stalls while driving

Reproduced (September 19) with a scripted ride: CJ teleported west along the Los Santos flood channel at 15 m/s, as a car ride through Ganton and East Los Santos streams. Terrain following stopped after the second window and the player drove on to the edge of the loaded world.

- Cause: any exception while installing a window called `follower.finish(id, false)`, which disabled following for the rest of the session and paused the game with a menu. The commonest exception was the window's own support check, `assertInstalledSceneSupport` / `assertNativeVehicleTerrainSupport`, which refuses a window while the car is airborne over a curb or CJ brushes a wall ("The new terrain obstructs the current player position"). `CStreaming` never refuses a sector; entities stay in the world and only their models stream.
- Fix: `SceneRegionFollower.finish` keeps following after a failure and re-requests the same window after 0.5, 2 and 5 s backoffs (`REGION_RETRY_MS`), holding the player at the 85% safety boundary meanwhile; the third consecutive failure stops following and shows the menu. The support check is advisory: a miss while the game runs retries for 0.6 s (`SUPPORT_RETRY_LIMIT` × 150 ms), then the window installs where the player stands and the character controller settles him. The boundary wait is a hold, not a pause: the simulation stands still while the view, pointer lock and held keys stay and no menu opens (the original hitches while CStreaming catches up), and it releases only once the player is inside the new window. The hung-request timeout is 45 s, not 120.
- Worker failures: six 400 m grid windows across Las Venturas and San Fierro failed with "This is not a RenderWare model clump" because waterfalls, neon signs, scrolling billboards and the night casino blocks store an rwID_UVANIMDICT chunk ahead of the clump, which `RpClumpStreamRead` skips over; `readDff` now reads past it (the UVs are not animated yet). Two windows carried AREA 13 placements of gym props absent from the published archive, and the worker threw for any unresolved placement; a missing or corrupt model is now left out of its window with a notice.
- Swap cost: every window replacement rebuilt the Three objects of all models in range, so retained models re-uploaded their geometry after each swap. `ModelObjectPool` shares built sources (geometries, materials, frame hierarchy) across the windows of one dataset, keyed by model name, and the building and entity lighting state objects the pooled materials read their uniforms from carry over with the texture pool.
- Evidence: `tests/browser/streaming-drive.spec.ts` (60 s, 17 windows requested, 16 installed, 7 boundary-pause ticks of 200 ms, no animate callback over 50 ms after the first second, no frame gap over 300 ms, headless Chrome). `tests/static-world-coverage.test.ts` streams all 225 windows of a 400 m grid over the world through the worker's pipeline in Node (219 loaded before these changes, 225 after; median 0.76 s, slowest 1.6 s, at most 160 detailed models and 720 placements per window). The Claude browser pane reports `visibilityState` hidden and throttles animation frames in ~1 s bursts; frame pacing is only measured in Playwright.
- Transfer: each request names the models the installed window holds and the worker strips those parts to placements, collision and definition; the main thread puts its own copies back before installing (`residentModels.ts`). Message payload per window fell from 15 to 20 MB to 2 to 4 MB with about 85% of parts resident; the synchronous swap takes 11 to 23 ms (`following.lastSwap` in the dev state).
- The bundled start scene installs under the archive's identity (its sha256 comes from the published manifest) with its models on the resident list, so the first streamed window borrows 209 of its colliders and sends 10 MB instead of 17.
- Pre-build: a following window's model instances and the colliders of placements the current window lacks are built ahead at 4 ms per frame (`InstalledNativeScene.prebuild`), so the synchronous commit only assembles the root, visibility, catalog and vegetation and retires the old window. On the scripted drive the commit fell from 13 to 28 ms to 6 to 13 ms, with 5 to 13 ms of pre-build spread over frames; frame period p99 20 ms. A support-check miss is tested against the colliders the next window will own (retained plus pre-built) before anything is assembled, and the pre-built window survives the retry, so a miss costs a few ray casts instead of a synchronous rebuild.
- Frame profile (dev state `frameProfile`, averages on the scripted drive in headless Chrome): population scheduling 0.02 ms, fixed steps 1.0 ms (traffic 0.07, pedestrians 0.19, player 0.18), between steps and render 0.5 ms, render update 3.2 ms of which the three.js draw submission 2.5 ms (software GL in headless), character shadow capture 0.3 ms, visibility and vegetation 0.26 ms. With 300 to 570 draw calls a frame (two to three render passes over 93 to 163 meshes inside the frustum), draw submission is the next cost on real GPUs. Instancing repeated placements was measured and dropped: `__game.drawGroups()` groups the in-frustum meshes by geometry and material, and at five points (Grove Street, the channel, downtown) only 0 to 45 of them repeat a pair, almost all of those car wheels and pedestrians, not world placements, so a placement is drawn once for its geometry either way; and each placement's own material swap and depth-sort key in `placementFade` would have had to move into per-instance attributes.
- Retired sources: a built model source that no window uses any more stays in the pool within a 48 MB geometry budget, oldest evicted first, as CStreaming keeps a model loaded until memory is needed; the dataset's last window disposes them. Driving 450 m west and back: the outbound leg built 190 sources over 8 windows, the return leg 57 over 7 (`retiredModels`, `retiredModelMB` in the dev state). A retired source keeps the decoded model it was built from and is named in the worker request's resident list, so on the way back every window of the same 450 m ride travels without geometry or rasters (0 MB payload for all seven return windows, 0.9 to 3 MB outbound).
- Remaining difference: the world is still streamed as whole 180-unit windows replaced at once rather than per model by `CStreaming`'s request list and LRU, so a swap still rebuilds placement hierarchies, visibility entries, vegetation and the collision of placements new to the window on the main thread.

## Frozen world: a traffic car retired while another driver scanned it

Reproduced (September 19) in a headless drive along the Los Santos channel: after ~40 s every frame threw `RuntimeError: unreachable` from `WorldTraffic.beforeStep`, and cars, pedestrians and the player stood still from then on.

- Cause: `beforeStep` copied the fleet's cars, retired a stalled driver mid-loop (`removeTrafficCar` disposes the car and frees its Rapier body), and the next driver's danger scan read the freed body through the copy. Rapier traps on a freed handle; the retired driver stayed in the list because the loop threw, so the trap repeated every frame.
- Fix: the scan walks the fleet's live set and skips disposed cars (`WorldCar.disposed`), police units and traffic drivers drop a disposed car before touching its body, and each population system's update runs under a guard that logs a fault once and keeps the player, world and renderer stepping (`subsystemFaults` in the dev state).
- Evidence: `tests/browser/player-interactions.spec.ts` drives the same route with the population running and asserts no page errors and no subsystem faults.

## Stuck after a long drive: a pedestrian leak, a spawn-relative fall reset and a stale car

Reproduced (September 19) with a scripted 3.6 km loop through Los Santos at car speed (west along the channel, north
through downtown, east across the hills, south back to the channel), sampling the heap, the Rapier body count and the
frame profile every 10 s. Three separate faults stopped the ride:

- Culled pedestrians leaked their bodies. `WorldPedestrians.update` dropped a ped that left the keep band (65 m, or
  25 m below the player) from its list without `remove()`, so the Rapier body, collider, character controller and
  the scene view stayed behind. Standing on a downtown rooftop 84 m up, every street-level spawn was culled on its
  next check: about ten leaked bodies a second, the pedestrian step climbing from 0.3 ms to 400 ms a frame inside a
  minute and the heap past 1 GB. The cull now gives everything back (`CPopulation::RemovePed`), and the spawner no
  longer picks nodes more than 25 m below the player, which the band would cull at once.
  `tests/browser/pedestrian-cull-leak.spec.ts` stands on that rooftop for 30 s: 300 peds churn, the body count must
  not grow.
- The fall-through reset was measured from the last window's spawn height. Every terrain install set `sim.respawn` to
  where the player stood, and the simulation reset him to it whenever he dropped 30 m below that: jumping off a
  rooftop, or driving down a hillside within one window, teleported him back up, and a scripted drive stalled there
  for good. The reset now fires only below the world (`WORLD_FLOOR_Y` -100; no San Andreas ground lies under -50).
  Unit: a 100 m fall lands; a drop to -150 resets.
- `worldCar` kept a fleet car the fleet had already disposed when no nearer car replaced it, and the dev state read
  its freed body, which traps Rapier and poisons every later call (`recursive use of an object`). The frame loop drops
  a disposed car, and the dev state skips one.

After the fixes the loop completes 66 window swaps with the body count bounded, the heap between 250 and 460 MB,
no faults and frame work at 3.4 ms median, 7.3 ms at the 99th percentile.

## Civilian rosters by zone

Every civilian came from a packaged trio (`bmydj`, `wmybmx`, `wfyri`, plus two old models), so downtown Los Santos
was walked by the same DJ in red trousers as Ganton. The original keeps eight ped models resident for the zone the
player is in (`CStreaming::StreamZoneModels`, gta-reversed ead3051): `CPopCycle::PickPedMIToStreamInForCurrentZone`
draws a popcycle group by its percentage for the zone type, week type and hour, cycles that group's models round
robin (`ms_NextPedToLoadFromGroup`) past the ones already resident, the roster is rebuilt with at least four models
when the zone type changes and otherwise swaps one unused slot every 300 frames, and
`CPopulation::ChooseCivilianOccupation` dresses each new civilian from the resident slots. pedgrp.dat's popcycle
groups are read with their Los Santos, San Fierro and Las Venturas lines (`m_TranslationArray` is retail data; the
file's own order pairs them). The slot rule in ChooseCivilianOccupation compares a model's reference count with its
slot index, which spreads spawns over the slots; the browser takes the resident model with the fewest living peds.
The zone's INITIAL race mask (SET_ZONE_POPULATION_RACE) was ignored: PickPedMIToStreamInForCurrentZone only
streams models CPopCycle::IsRaceAllowedInCurrentZone admits (the race is the first of the model name's two leading
letters, B, W, O or I, H; other names pass everywhere), and ChooseCivilianOccupation and its vehicle variant skip
resident models the mask rejects. The roster now streams and chooses by that mask (`pedRace`, `raceAllowed`).
The shipped INITIAL restricts 26 zones: Ganton and Idlewood to black models (mask 1), East Los Santos to white and
hispanic (10), El Corona, Little Mexico and Las Colinas to black and hispanic (9), Chinatown to white and oriental
(6); Grove Street's civilians were mixed before.
Sampled in play: downtown at 18:51 streams `ofyst`, `bmybu`, `bfybu`, `omyst`, `bmyri`, `hfyst`, `bfyri`; Ganton
`hfost`, `bmotr1`, `bmydj`, `bmost` beside the Families parties. The dev state lists the roster and each ped's model. Traffic drivers come from the same roster through
`CPopulation::ChooseCivilianOccupationForVehicle`: a resident model whose peds.ide cars-can-drive mask covers the
vehicle's class (the mask's bits follow eVehicleClass), the least used first, any resident model otherwise; the choice
is made once per car and the ped who is dragged out keeps it.

## Who spawns next: the popcycle ped targets

Street spawns rolled each path node against the zone's gang strength (a party on `strength/255`) and dealer
strength, then filled with civilians up to a device budget. CPopCycle::Update turns the popcycle row into ped
targets for the zone (`m_NumDealers_Peds`, `m_NumGangs_Peds`, `m_NumCops_Peds`, `m_NumOther_Peds`: the row's
maximum times its column for the type times the zone's fraction, the other column applied twice and damped by
rain), and CPopCycle::FindNewPedType takes the type whose target exceeds its living count by the most (a deficit
under two is scaled by a random fraction, refused types sit at -10, and the types are tried from the highest
deficit down), with PickGangToCreateMembersOf choosing the gang furthest below its share of the zone's strength.
The browser ports all three (`populationTargets`, `newPedTypeOrder`, `gangToCreateMembersOf`), the fleet provides
the targets for the player's zone, and the spawner takes gang parties, dealers or civilians in that order; cops are
still refused on foot (reinforcements arrive with their cars), and specs without a fleet keep the turf rolls.
The street also waits for the targets and the streamed roster before its first spawn: the first seconds used to
fill Ganton with fallback-dressed civilians and turf parties (a dozen Families for a target of two) before the
vehicle catalog and the zone arrived. Ganton at 17:30 now holds two Families, five roster civilians and at most one
dealer for its popcycle maximum of eight, and the dev state's `pedestrians.targets` and `pedestrians.zone` show the
numbers behind it.

## Glass windows

Shots and cars left the world's glass windows untouched. CGlass keeps the windows whose IDE flags mark them as glass
(IS_GLASS_TYPE_1 0x200, IS_GLASS_TYPE_2 0x400: the Otto's Autos showroom, the San Fierro car show, the cop windows,
`wglasssmash`, `bd_window`): WasGlassHitByBullet cracks a window with the first round and breaks it one time in four
afterwards, CPhysical::ApplyCollision breaks it when a vehicle's blow beats its uproot limit and cracks it past 50
otherwise, WindowRespondsToExplosion breaks it within 10 units of a blast and cracks it within 30, and
WindowRespondsToCollision hides the window, drops its collision and throws CFallingGlassPane pieces from its
two-triangle collision quad (up to 3 × 3 sections of four pieces each, spread ±0.096 from the blow and pushed 0.1
from the impact, delayed 100 ms a unit from the impact under 300 damage), which fall a fiftieth a frame, tumble,
and vanish at the ground with four glass shards and a landing sound; ReportGlassCollisionEvent plays collision-bank
sounds 56 (break), 51 (hit) and 15 to 18 (landing). The browser ports all of it (`nativeGlass.ts`, the
`GlassPanesView` highlight and cracked-glass triangles with the reversed alpha rules, `placementInfo` on the
installed scene, `wincrack_32` from effectsPC.txd) and the dev API lists windows (`glassNear`) and the state
(`glass`). Authored: the pane polygon table lives in the exe (a fan of four about the centre stands in) and an
unbroken window is still drawn as its model rather than through the reflection polys (PreRenderForGlassWindow).
Car windscreens follow: when CAutomobile::SetPanelDamage takes the windscreen to DAMSTATE_OPENED_DAMAGED,
CGlass::CarWindscreenShatters finds the collision's first two glass-surfaced triangles, projects their corners on
the pane's forward (right × normal) and right (up × normal), takes the bottom-left corner and the extents, and
throws CAR-type panes (two sections an axis, the slow kind) with the car's move speed; the browser's car does the
same through `windscreenGlassFrame` and hands the frame to the pane system instead of a flying panel.

## Parked car generators

Every generator record spawned once per session, within 75 units, and never again. CCarGenerator::Process
regenerates whenever its car is gone and the player is in range (CheckIfWithinRangeOfAnyPlayers: within 160 units
and 50 high; during the start window, GenerateEvenIfPlayerIsCloseCounter, at any distance; otherwise only in the
140 to 160 approach band, or at any distance for a force-spawn record, while the player heads toward it, and not
while the generator waits for the player to get far away after a blockage or after he took the car), keeps at
most 5 parked cars by day and 10 between 21:00 and 7:00 unless the record ignores the limit, and after the player
drives the car off it waits a minute (m_nNextGenTime + 60000) and until he is out of range. The fleet now keeps
that state per record (`generatorInRange`, `parkedCarLimit`, `generatorFlags` in `worldCarGenerators.ts`), so
neighbourhoods refill as the player returns and the parked count follows the clock; the dev state's fleet shows
`closeCounter` and `parkedLimit`.

## Car alarms

Only a rattled locked door set off an alarm (8 s, authored). CCarGenerator::DoInternalProcessing fits a generated
car with an armed alarm on its alarmChance percentage (m_nAlarmState -1), CPhysical::AddCollisionRecord sets both
vehicles' armed alarms off for 15 s when they collide, and CVehicle::ProcessCarAlarm counts the alarm down with the
horn pulsing. The browser rolls the generator's chance (`rollAlarm`), records vehicle collisions between fleet cars
and sets the armed alarms off for 15 s; the rattle alarm stays as the authored break-in response. The fleet's
snapshot shows `alarm` and `alarmArmed` per car.

## Street peds in water

A ped pushed into the sea walked on the seabed. CPed::ProcessBuoyancy lifts a ped with the buoyancy of 1.1 × mass /
125 (1.8 dead), and once the water stands 0.6 above his centre it marks him drowning and raises CEventInWater;
CTaskComplexInWater then gives a street ped (bDrownsInWater) CTaskComplexDie with WEAPON_DROWNING and the DROWN
clip, and CTaskSimpleDie kills him when the clip ends (the player, sunbathers and the player's group swim
instead). The browser reads the water level for each ped, holds a drowning ped's centre 0.55 under the surface
(the tread submerge) at up to 0.1 units a frame while the drown clip plays, kills him when it ends, and floats the
body 0.3 under the surface. Authored: the sunbather exception (pedstats are not on the catalog) and swimming
homies (they are left out of drowning but do not swim after CJ). The dev state shows `drowning` and `drowned`.

## Street peds falling

Off the ground a street ped sank at a flat 5 m/s with no fall clip and landed without a sound. CPhysical::ApplyGravity
pulls a ped down 0.008 units a frame² against the ped air resistance; CTaskSimpleInAir plays FALL_glide and, once
the fall passes 0.1 units a frame, FALL_fall; CTaskComplexInAirAndLand then lands him with FALL_land after a glide,
FALL_collapse after a real fall, or knocks him down (CTaskSimpleFall, KO_skid_back) when the fastest fall passed
0.4 units a frame. The browser marks a ped airborne when the controller resolves the full ground pull without
touching anything (`air` in the dev state: `vz`, `clip`), integrates the native gravity and air resistance, plays
the two in-air clips as reactions, lands by the same three-way rule and charges the same landing damage as the
player (speed − 10 units, × 8). Authored: the ground pull that detects the take-off (the player's own probe);
the FALL_land duration comes from the clip.

## Cops on the beat looking for trouble

A wandering cop ignored everything until the player was wanted. CTaskComplexWanderCop::ScanForStuff runs every
50 ms while the cop wanders: LookForCarAlarms sets one star (SetWantedLevelNoDrop) when the player's automobile
sounds its alarm within 20 units; LookForStolenCopCars gives a clean player driving a law enforcer one star;
LookForCriminals takes the first gangster or PED_TYPE_CRIMINAL wandering within 10 units ahead of the cop in clear
sight, chases him (CEventPedToChase's CTaskComplexSeekEntity, 30 s, walk inside 2 units, stop within 1) and makes
him flee the cop for good (CEventPedToFlee's CTaskComplexSmartFleeEntity, 100 units safe), then waits 30 s and
never picks the same criminal again. The browser's foot officers run the same three scans on the same timers
(`chase` per ped in the dev state; `pedestrians.playerVehicle` reports the player's car, its alarm and law flag).
Authored: the criminal's CTX_GLOBAL_CRIMINAL_PLEAD line (speech banks are not shipped).

## Drivers leaving burning cars

A traffic car burned down with its driver still at the wheel. CAutomobile::ProcessControl raises CEventVehicleOnFire
(a global event) when the engine fire starts under 250 health; it reaches the car's occupants and peds on foot
within 10 units. The random drivers' decision makers (R_Norm, R_Tough and R_Weak.ped) answer it in a vehicle with
TASK_COMPLEX_LEAVE_CAR_AND_FLEE, which CEventHandler::ComputeVehicleOnFireResponse turns into CTaskComplexLeaveAnyCar
followed by CTaskComplexSmartFleeEntity 15 units from the car; on foot they have no choice and stay, while gang
members (GangMbr.ped) smart-flee 15 units. The browser's traffic reports the transition once per car
(`WorldTraffic.onFire`), the car-entry system plays the driver's get-out clip with the car stopped (several NPC exits
at once now; `CarEntry.evictDriver`), the driver steps out as a street ped fleeing the car's stopped position
(`fleePlayer.point`, 15 units), and gang bystanders within 10 units flee likewise (`pedestrians.vehicleOnFire`).
Authored: officers on foot (Cop.ped also flees) keep their police logic, and police units' drivers are not evicted.

## Drivers rammed by the player

A traffic car the player rammed just honked. CAutomobile::VehicleDamage raises CEventVehicleDamageCollision on the
driven car's driver when a collision with another driven car costs over 5 health (before the player and rammed-by-
player divisors). The default decision makers answer event 73 in a vehicle (data/decision/allowed): R_Norm draws
nothing 50, a flee-scene drive 25 and road rage 25 from the player (a threat can also be rammed back); R_Tough rages
50; R_Weak flees 50 (10 from a neutral source); gang members inform their group (an avoided task, so nothing) and cops
hunt criminals only. CEventHandler::ComputeVehicleDamageResponse maps them: CTaskComplexCarDriveMissionFleeScene is
MISSION_CRUISE at cruise speed 40 with DRIVING_STYLE_AVOID_CARS; CTaskComplexRoadRage (reversed) leaves the car when
the rammer sits in one, turns to face him, shakes a fist (CTaskSimpleShakeFist, FUCKU), seeks him for 20 s and fights
(CTaskComplexKillPedOnFoot, or CTaskComplexDestroyCar when armed and the rammer stays in his car). The browser reports
the raw loss and whether the player's car did it (`WorldCar.onCollisionDamage`), the traffic driver draws the same rows
(`src/vehicle/nativeCollisionDecision.ts`, the driver's pedstats decision maker through `pedestrians.decisionMakerOf`),
a flee-scene driver cruises at 40 avoiding cars (`fleeScene` in the traffic snapshot), and a rager is put out through
the car-entry exit, faces the player, shakes his fist and comes for him (`rage` per ped, then the brawl for 20 s).
Authored: only the player's car is a source (which AI driver hears an AI-to-AI ram depends on the impact direction,
not modelled); the bat, golf club or shovel half the ragers draw, a gangster's pistol, the destroy-car branch and the
drive-back-to-the-car ending are left out; the mission-kill-ped ram-back applies to threats only.

## Peds investigating a stealth kill

Nobody reacted to a body left by a knife kill. CEventDeadPed::AffectsPed reaches only stealth kills: the living peds
within 8 units with the body ahead of them. Their decision makers answer event 11 on foot (data/decision/allowed):
R_Norm nothing 10, CTaskComplexInvestigateDeadPed 70, CTaskComplexSmartFleeEntity 20; R_Tough nothing 30,
investigate 50; R_Weak nothing 10, investigate 10/30/60/50 and flee 80/60/30/40 by relationship; gang members only
look (an avoided task, so nothing); cops have no row. CEventHandler::ComputeDeadPedResponse builds the investigate
task (reversed): stand still 1000 ms, CTaskComplexGoToPointAndStandStill at a run to 2 units from the body (radius
0.5, re-aimed when the point moves over a unit), CTaskSimpleAchieveHeading at it, the head look-at for 5 to 7 s with
CTaskComplexSignalAtPed (a retail stub), CTaskSimpleRunAnim ROADCROSS saying CTX_GLOBAL_SHOCKED, then
CTaskSimpleGoToPoint back to the start at a walk; the flee is CTaskComplexSmartFleeEntity from the body for good
(100,000 units). The browser raises the event when the knife kill ends and runs the same phases (`investigate` per
ped in the dev state, the head look pointed at the body through `lookAt`, the flee as a fixed point).
Authored: the SHOCKED line (speech banks are not shipped); the signal-at-ped gesture is left out.

## Drivers whose tyres are shot out

CWeapon::DoBulletImpact raises CEventVehicleDamageWeapon on a car's occupants only when a ped's bullet bursts a tyre
(a body hit just inflicts damage). The default decision makers' event 41 rows (data/decision/allowed): R_Norm flees
the scene 75 from the player (nothing 25; a threat may be rammed); R_Tough nothing 50 or CTaskComplexKillPedOnFoot 50,
which CEventHandler::IsKillTaskAppropriate turns into the flee-scene drive for a driver without a gun facing a gunman;
R_Weak nothing 30, flee the scene 35, CTaskComplexLeaveCarAndFlee 35 (CTaskComplexLeaveCar at once, then
CTaskComplexSmartFleePoint 60 units from where he was, for good); gang members inform their group and cops hunt
criminals, neither of which applies. The browser's tyre bursts carry their shooter (`WorldCar.burstTyre(...,shotBy)`,
`onTyreShot`), the traffic driver draws the rows (`weaponDamageResponse`), flee-scene drivers cruise at 40 avoiding
cars, and a leaving driver is put out through the car-entry exit and runs 60 units (`fled` in the traffic snapshot).
Authored: passengers (none ride in traffic) and a ped shooter's relationship (neutral column).

## Jacked drivers

A driver dragged out of his car ran for 8 s (authored). CEventDraggedOutCar is answered by the victim's decision maker
(event 7, data/decision/allowed): R_Norm CTaskComplexKillPedOnFoot 10, CTaskComplexSmartFleeEntity 75,
CTaskComplexStealCar 15; R_Tough kill 75 from the player and steal 25; R_Weak flee; gang members and cops inform
(avoided). CEventHandler::ComputeDraggedOutCarResponse (reversed) only acts on the kill (when IsKillTaskAppropriate,
an unarmed victim against an unarmed jacker: CreateStealCarBackSeq, a 500 to 1500 ms pause on a coin flip or
CTaskSimpleAchieveHeading at the jacker with CTaskSimpleShakeFist, then CTaskComplexStealCar, whose enter-car task
gives up after 10 s; against a gunman CTaskComplexSmartFleeEntity for good), KILL_CRIMINAL, DESTROY_CAR, HIT_HEAD and
EVASIVE_STEP; a drawn flee or steal falls to its default and leaves the victim with no task, so he walks off. The
browser draws the same rows when the victim steps out (`spawnJacked`, `stealBack` per ped in the dev state,
`jackedRandom` for probes) and runs at the car for up to 10 s. Authored: re-entering and driving the car away
(CTaskComplexStealCar's set-as-auto-driver and flee-scene drive), the JACKED_ON_STREET line.

## Gang wars

Turf never changed hands. CGangWars (gta-reversed ead3051, its Update reversed in outline) runs two wars over the
zones' gang strengths. Offensive: the player's on-foot kills of Ballas and Vagos add 1 provocation each (fading
1/2000 a native time step); past 2.1 the war starts in the zone he stands in when its strongest gang is Ballas or
Vagos (GW_PROV, civilians sprint off, every gangster but the Families turns on him, no civilians spawn), the ferocity
is the zone's strength sum over 15 (at most 2; 0 or 5 by the Families' territory share past 0.4), and three waves
follow 10 s apart, the first two each moving 30 % of every other gang's strength to the Families (under 4 drops to 0)
and the third all of it (GW_CLR1/2, GW_YRS, respect + 45); 30 s outside the zone plus 50 units loses it (GW_WARN at
10 s, GW_FLEE). Defensive: a 648 to 1,620 s timer (LA time, 0.6× elsewhere, capped at 30 s during a war or when the
player is on a mission or above 950) picks an enemy zone (Ballas plus Vagos 20 or more) and a Families zone (over
15, not the Grove Street home, over 60 units from the player) within 10 units of it, notifies (GW_ATK, a gang blip
blinking faster as the timer runs down) and counts 200 ms a unit plus 240 s: no show costs the zone 30 strength and
30 respect (GW_NOSH); arriving within 70 units spawns the defending group (10 × (0.4 × difficulty + 0.6) gangsters in
a ring, pistol, Micro SMG, shotgun and MP5 in turn, accuracy 90 − difficulty × 60, with a health or armour pickup)
and adds 30 s; beating them (at most one left, none within 45 units) adds 10 to the Families up to 55 (GW_WON), too
slow costs 3 strength a defender and 30 respect (GW_SLOW). The browser ports the state machine
(`src/simulation/GangWars.ts`, `gangWars` in the dev state), the attackers as bPartOfAttackWave peds
(`pedestrians.spawnAttackWave`, never culled, on the kill task with the war's guns, gang-coloured radar squares),
and the zone strengths feed the popcycle at once; random traffic stops too (CCarCtrl::GenerateRandomCars checks
DontCreateCivilians). Authored: the offensive waves themselves (CreateAttackWave is a
retail stub: 4 + 2 × ferocity attackers, at most 12, round a node 45 units from the player), the wave cars, the
messages' words (the GXT is not shipped), and gang wars on from the start (the script switches them on after
Doberman; there is no campaign here). The radar and map carry CRadar::DrawRadarGangOverlay's territories: every
navigation zone with Ballas, Families or Vagos strength filled with the strength-weighted gang colours at alpha 3 ×
the sum (55 to 120), and the contested zone red at 160 pulsing on a 1,024 ms sine (CTheZones::FillZonesWithGangColours,
RadarMode 1 and 2); `overlays` and `contested` sit in the dev state. The defending group's three gang cars stand on the
nearest car nodes within 100 units of the point (none within 25 of the player), facing away from the defenders' node, and
the attacking gang's models stream in within 150 units of the point (TellStreamingWhichGangsAreNeeded).

## Standing still after leaving a car

CJ walked a few steps on his own after closing the car door (0.6 m at 60 Hz, a lurch of over 4 m/s at low frame
rates). The player's move blend ratio (CPlayerPed's m_fMoveBlendRatio, stepped by PlayerControlZelda) and the
character view's copy were not stepped while he sat in the car or ran the entry sequence, so the run up to the car
was still in them when CTaskSimpleCarSetPedOut stood him beside it, and the walk clip and its speed then faded out
over the next half second. Both ratios, the speed and the jump momentum now reset when a ride or entry sequence
begins or ends (`WorldCar.setPedInAsDriver`/`setPedOut`, `NativeCharacter.resetLocomotion`), as the ped stands
still under the set-out task. Regression: `tests/browser/car-exit-still.spec.ts`.

## Gang members' weapons

A gang party carried at most one pistol, on strong turf in an armed or wanted pursuit (authored). CPopulation::AddPed
gives a third of the gang members it creates (CGeneral::RandomBool(33)) a random one of their gang's three weapon
choices that are not unarmed (CGangInfo::GetRandomWeapon): CGangs::Initialise sets Ballas pistol and Micro SMG,
Families and Vagos pistol, Da Nang Boys and Aztecas pistol and Micro SMG, Mafia Desert Eagle, Triad pistol and AK-47,
and the script's SET_GANG_WEAPONS overrides them (main.scm's MAIN thread gives the Families a Desert Eagle, an MP5 and a
knife; Ryder's second mission a pistol and Tec-9). The browser draws the same way for every party member
(`src/simulation/nativeGangWeapons.ts`, `pedestrians.gangWeaponRandom` for probes). Authored: a melee choice the ped
catalog cannot arm (the knife) leaves the member unarmed; drive-by crews and war attackers keep their own guns.

## Roadblock crews

Roadblock crews climbed out through their doors. CRoadBlocks::GenerateRoadBlockPedsForCar (reversed) stands them
beside the car at fixed placements in car space, two per positions type (city cops at ±1.5 across and +1.9 / −2.6
along, special cops from the Enforcer, Barracks, FBI Rancher and the SF cop car at 0 / +3.2 and ±1.5 / −1.8), scaled
by the car's collision radius over the default cop car's, standing still (bStayInSamePlace, crouching when they
shoot), each on CTaskComplexKillPedOnFoot at the player with the pistol or the unit's loadout. The browser places the
crew that way (`roadblockCrewPlacements`), on the side away from the player, facing him. Authored: the positions type
and the number of peds per car come from the unreversed CreateRoadBlockBetween2Points (away side, 4 and 2 here), the
default cop car radius is a constant (2.7), and the crew fights with the ordinary officer logic (no crouch fire, no
stay-in-place flag) and the roadblock nodes themselves are not shipped (roadblox.dat).

## Gang parties hanging out

A gang party walked off as soon as it spawned. CTaskComplexGangLeader (reversed) runs the leader: a 5 s stand
(CTaskSimpleStandStill), then CTaskComplexTurnToFaceEntity at a random member, then another stand, or a walk
(CTaskComplexWanderGang for 0 to 15 s, 5 % of the time or with fewer than three members) after which the group's
default tasks go random and the party breaks up; every frame he looks at a random member 5 % of the time for 3 to
5 s (the IK look-at), and when no partial clip runs a draw of 0 to 500 lands on 51 to 55 for one of the gangs
block's prtial_gngtlkA to H talk clips (and on 100 for a hand signal). The browser loads the gangs block's talk clips
as upper-body reactions and runs the same phases on the leader (`hangout` and `party` per ped in the dev state,
`hangoutRandom` for probes); followers hold their spot facing the leader while he stands and share the talk clips and
looks. Authored: CTaskComplexGangFollower is a retail stub (the followers' hold and face), the hand-signal, drink and
smoke clips (no held objects), the walk's end waits on the timer alone (the node-distance check is left out), and
the abuse speech (no speech banks).

## Steps sat on with the attractors block

Peds on porch steps used the bench's SEAT clips. CTaskSimpleSitDown, CTaskSimpleSitIdle and CTaskSimpleStandUp play
Stepsit_in, Stepsit_loop and Stepsit_out from the attractors anim block for a step attractor and SEAT_down, SEAT_idle
and SEAT_up from the default block for a seat. attractors.ifp is in the shipped archive after all, so the step clips
load with the ped reactions and the STEP attractors sit on them (`sitClips`).

## Drivers dying with their cars

A traffic car that blew up with its driver aboard simply lost him. CEventVehicleDied reaches the occupants:
CEventHandler::ComputeVehicleDiedResponse sets their health to 0, marks them scorched and gives them CTaskComplexDie
by WEAPON_EXPLOSION with KO_shot_front. The browser reports the blow-up with a driver aboard (`WorldCar.onBlowUp`,
`WorldTraffic.onDriverDied`) and lays the driver out at his seat as a street ped killed by the explosion
(`pedestrians.spawnDead`). Authored: the scorched rendering; police crews and drive-by cars keep their own handling.

## Killing dealers thins the zone's dealers

Dealers came back at the zone's full dealer strength however many the player shot. CDarkel::RegisterKillByPlayer calls
CPopCycle::PlayerKilledADealer for a player kill of any ped type from PED_TYPE_DEALER up (the reversed source flags the
comparison as a likely bug), and that takes one dealer strength off the zone the player stands in, never below 0; the
popcycle's dealer share (strength / 100, floor 0.1) follows at once. The browser's kill callback now carries the
victim's ped type and whether the player did it (`src/simulation/nativePopCycleEvents.ts`).

## The health bar at low health

The HUD health bar sat still however low CJ's health was. CHud::RenderHealthBar skips the bar on the frames where the
frame counter has its 8 bit clear (EachFrames(8) is `(frame & 8) == 0`) once health is under 10, so it blinks every eight frames, and
CHud::RenderArmorBar draws only above 1 armour. The browser's bar now blinks the same way (`src/ui/nativeHudBars.ts`).
Authored: the script's m_ItemToFlash flashes.

## Headlight beams

Lit headlights brightened their lamp materials and nothing else. CVehicle::DoHeadLightBeam (reversed) draws a white
RwIm3D fan in front of each lit lamp: 3 units along the forward tilted down by 0.15 (0.5 for the forklift), 0.1 wide
at the lamp and 1 wide at the end, faded to nothing at the far edge, additive with no depth write, at alpha
(1 − |dot(lamp→camera, forward)|) × 32, so it shows from the side and vanishes head-on. The bike's Render draws it
for its front lamp; CAutomobile::Render is a retail stub, so the browser draws cars' two lamps by the same rule
(authored), the second at the headlights dummy mirrored across the car's right axis, skipping broken lamps, on the
same night rule as the lamps (`src/render/HeadlightBeams.ts`).

## Headlight pools on the road

Lit headlights lit nothing on the road ahead. CVehicle::DoHeadLightReflection (reversed) stores an additive shadow
under the lamps through CShadows::StoreCarLightShadow: with both lamps working DoHeadLightReflectionTwin stores one
`headlight` pool of lightSize 4 × the headlights dummy's x, centred lightSize × 2 + 1 + dummy.y ahead, 2 units up, a
front half-vector of forward × lightSize × 2 and a side half-vector of lightSize; a single working lamp stores a
`headlight1` pool offset to its side (bikes and the Quad at lightSize 1.25); colour 45, 45, 45 at intensity 128 over 6
units of height, dropped 27 units from the camera and faded from 18. The browser stores the same pools through its
light-pool projector (rotated footprints and per-pool cut-offs added; `src/render/carLightPools.ts`,
`carLightPools` in the dev state), on the lamps' night rule, with the two rasters from the particle dictionary.
The on/off rule is CVehicle::GetVehicleLightsStatus (reversed; see "Vehicle lights" below). Authored: the static/dynamic shadow split
(one projector serves both), and the camera-facing cut (the 7.0 cosine never triggers).

## The Rhino's cannon

The Rhino drove like a heavy car and nothing more. CAutomobile::TankControl (reversed) runs under the player: with the
camera on its string the turret follows the camera front, the yaw at 0.015 a time step toward atan2(−front.x,
front.y) and the pitch at 0.005 toward atan2(front.z, |front.xy|) + 15°, the yaw wrapped, the pitch capped at 35° and
floored at −7° (rising toward −3° as the turret faces backwards); the car-gun button fires every 800 ms along
(sin −yaw, cos yaw, sin pitch) from the barrel node (misc_c), kicks the tank back by 0.1 × that vector a step, and
puts EXPLOSION_TANK_FIRE where the 60-unit line first hits, pulled 4 % back toward the muzzle. BlowUpCarsInPath
(reversed) blows up every car a Rhino moving 0.1 units a step or more touches (no Rhinos, no scorched wrecks), and the
player's reports CRIME_EXPLOSION each time. The browser runs both on the fleet's Rhino (`src/simulation/nativeTankControl.ts`,
`tank` in the dev state; Ctrl or the mouse fires), turning misc_a for the yaw and misc_c for the pitch (the frame
rotation lives in the unreversed PreRender; the axes are authored), with the Rhino's explosion- and bullet-proof
flags already on it. Authored: CWeapon::DoTankDoomAiming (a retail stub) and the tank_fire particle burst.

## Peds turning their heads

Street peds never looked at anything. IKChainManager_c::LookAt puts a CTaskSimpleIKLookAt on the ped: its chain runs
from the head (effector 0, 0.05, 0) to the neck, so it holds the head bone alone, and every frame
IKChain_c::MoveBonesToTarget turns the bone about the axis between its effector direction and the target by a
quarter of the angle (bone speed 1 × acos(dot) × 0.25), BoneNode_c::Limit clamps its Tait-Bryan angles to the
joint limits, and BlendKeyframe slerps the animated head toward it by the task's blend, which CTaskSimpleIKChain
raises to 1 over 500 ms, holds, and drops to 0 over the last 500 ms with the original's lerp step.
CPedIntelligence::LookAtInterestingEntities starts one on 1 frame in 100 for an on-screen ped that is not looking,
at a random interesting entity within 15 units, for 3 to 5 s. The browser ports the task, the chain step, the
limits and the slerp (`nativeIkLookAt.ts`, `NativeCharacter.setHeadLook`), restoring the animated head when the
chain goes (the original rewrites the frame from its keyframes; a clip without a head track would otherwise keep
the pose). Authored: the head's joint limits (BoneNodeManager_c::ms_boneInfos lives in the exe: ±80° about the
bone axis, ±35° and ±25° about the others) and the interesting entity, which is the player (the entity list's
sources are not reversed). CJ's own intelligence runs the same roll, glancing at a random street ped within 15
units. The dev state's `look` per ped and `playerLook` show the blends.

## Removing street peds

Off-screen peds lived until 65 units away and on-screen ones for ever. CPopulation::ManagePed removes a ped whose
removal distance (the planar distance, 30 less for gang members, over PedCreationDistMultiplier) reaches 54.5
units (65 with bCullExtraFarAway) at once off screen and by fading on screen; within 25 units or on screen the ped
is needed for another 4 s (10 s for a cop), and an off-screen ped past that time is removed, so the crowd behind
the player recycles quickly and the popcycle refills ahead. The browser's cull now follows that rule
(`neededUntil` per ped, refreshed every frame; cops keep the 65 unit distance; CPed::CanBeDeleted keeps recruited
crew and police car crews out of it). PedCreationDistMultiplier now reads the player's car speed (1 to 1.5 as
the planar speed in units a frame passes 0.1), stretching the creation and removal bands while driving. Peds also fade: AddPed sets the
clump alpha to 0 so a new ped fades in, bFadeOut fades a far on-screen ped or a body older than 30 s, and the ped
goes once the alpha reaches 0; the step is CVehicle::UpdateClumpAlpha's 8 a frame out and 16 a frame in (the ped
path is retail code; the browser scales every material's own alpha by the clump alpha, `NativeCharacter.setAlpha`).
Generated cars fade in the same way: CCarGenerator and the car control set a new car's clump alpha to 0 and
CVehicle::UpdateClumpAlpha raises it 16 a frame, so fleet-spawned traffic, generator and set-piece cars start
invisible and fade in over sixteen frames (`WorldCar.fadeIn`, the installed car's `setAlpha`).

## Peds at attractors

Nobody used the world's 2dfx ped attractors: the ATMs, benches, bus stops, shop windows and porch steps that models
carry as effect type 3 (56 bytes: type, queue, use and forward directions, script name, ped-existing probability).
CPopulation::Update follows every successful AddToPopulation with GeneratePedsAtAttractors for one ped: a random
free attractor of a placed model in the creation band (42.5 to 50.5 units on screen, 15 to 25 off it), ATMs, seats
and bus stops only between 9:00 and 20:00, a resident model that may stand on foot (cars-can-drive bit 0x1000) and
is no dealer, medic, fireman, criminal, bum or prostitute, placed 0.02 units along the effect's forward direction
facing its use direction and using it at once (bUseAttractorInstantly). CTaskComplexUseAttractor then sits
(SEAT_down, SEAT_idle for 15 to 60 s on 40% of the draws and otherwise until interrupted, SEAT_up), runs the ATM clip
and pays 20 + 20 × [0, 50), waits for a bus, or stands 3 to 6 s at a shop window and 6 to 12 s at a pizza counter,
and BroadcastDeparture frees the slot. The browser reads the attractor block, the installed scene lists placed
attractors near a point (`attractorsNear`, also in the dev API), and the street spawner ports the spawn and the use
tasks; a threat, a blow or a flee aborts the use. CPedAttractor's queues are ported too (`nativeAttractors.ts`):
ATMs and bus stops hold five peds, everything else one, slot i stands a unit back along the queue direction with a
±0.1 jitter behind the head, the head faces the use direction and the line the queue direction, a new ped only
joins once the tail stands in its slot (HasQueueTailArrivedAtSlot), and when a ped leaves the others walk up a slot
after 2 s per slot (BroadcastDeparture, CTaskComplexGoToAttractor). Not modelled: wandering peds being drawn to
attractors (CAttractorScanner is a retail stub), buses (a stop is waited at for 20 to 60 s, authored) and the
attractors anim block (Stepsit_in/loop/out, loaded from the shipped attractors.ifp since the step port below). Grove Street's porch steps and the shop windows
of the Ganton parade are the nearest attractors to the spawn.

## Gang models in the zone

Turf party members and drive-by crews drew any of a gang's three pedgrp.dat models at random, so a Grove Street
party could show all three Families at once. CStreaming::StreamZoneModels keeps two models resident for every gang
the zone's INITIAL strengths name, the pair at `CurrentGangMemberToLoad` and the next, and slides that cursor one
model on every 550 frames (modulo 21); gangs the zone stops naming lose their models, and CGangs::ChooseGangPedModel
dresses each member in a resident model. The browser keeps the same mask and cursor (`GangPedRoster`), parties and
drive-by crews take resident models (the whole group only while nothing is resident), and the dev state's
`pedestrians.gangs` lists what each gang has streamed.

Traffic never carried gang cars. The same streamer keeps one random cargrp.dat model per active gang resident
(`ms_loadedGangCars`, groups 18 to 27 of the file), CPopCycle::Update gives gangs their share of the zone's cars
(the popcycle gang column scaled by the zone's summed gang strength over 100, capped at a half) and gang cars carry
gang members. CCarCtrl::ChooseModel, which decides when a spawned car is a gang car, is a retail stub, so the browser
draws each traffic car against that share (authored) from the dominant gang (PickGangToCreateMembersOf) with a
resident gang model at the wheel; the dragged-out driver keeps his gang. Drive-by crews arrive in the gang's resident
car rather than any traffic model. `fleet.gangCars` in the dev state lists the resident gang cars.

Every traffic car took a zone roster driver. CPopulation::FindSpecificDriverModelForCar_ToUse seats a fixed driver
in some cars first: the Stretch's chauffeur (`wmych`), a cab driver in the Taxi and Cabbie (two per city,
CStreaming::GetDefaultCabDriverModel keeps the last one while his model is loaded), the ice-cream man in Mr Whoopee,
a guard in the Securicar, the pizza rider, the BMX rider, and one of two bikers on the Freeway a third of the time
each. The browser's driver picker takes that model when the archive has it (`nativeCarDrivers.ts`), then the gang
or zone roster.

No police car cruised the streets at zero stars. CPopCycle::UpdatePercentages gives cops their fraction of the
zone's population (0.3 less the gang fraction where gangs reach 0.15, else the gang fraction, floored at 0.03 or
0.02, raised to a tenth in RESIDENTIAL_RICH, SHOPPING_POSH and AIRPORT zones and a twentieth in RESIDENTIAL_AVERAGE,
none on the BEACH or the GOLF_CLUB), Update scales the popcycle cop column by it (m_NumCops_Cars), and a cruising
law enforcer takes the pursuit mission as soon as the player is wanted (CCarAI::UpdateCarAI's law-enforcer default,
BackToCruisingIfNoWantedLevel the other way). The browser draws each traffic car against that cop share (ChooseModel
is a retail stub, as for gang cars), spawns the level's cop car with AddPoliceCarOccupants' crew as a police unit
in MISSION_CRUISE (stop-for-cars style, traffic lights, 12 to 15 units), and the existing wanted switch turns it into
a pursuit unit; zones INITIAL marks no-cops get none. `zonePercentages` in `populationCycle.ts` is the port.


## Ambient traffic density

Traffic models were drawn uniformly over every member of every car group with a nonzero popcycle weight, so a 15%
group counted as much as a 35% one. `CStreaming::LoadZoneVehicle` draws a car group by its popcycle percentage
(`CPopCycle::PickARandomGroupOfOtherPeds`) and `CCarCtrl::ChooseCarModelToLoad` a random model of it, sixteen tries;
the browser does the same for each traffic car, keeping the uniform pool as the fallback. Ganton at dusk over 40 s:
Perennial 40, Greenwood 17, Newsvan 10, Clover 9, Bobcat and Sadler 3.

Traffic was also limited to the 60 cars in an explicit handling-id table (the tVehicleType index the handling port
needs), 37 of the 100 cars the Los Santos car groups name; every one of the other 63 loads. The id is now the fixed
table's where it has an entry and the line's position in handling.cfg otherwise (the enum's order for every car but
the two police cars, which the file lists the other way round), so Stallions, Sabres, Hermes, Virgos, Remingtons,
Blades and Picadors join Ganton's traffic.

Every popcycle lookup used an authored Wednesday. `CClock` starts the game on day 4 and moves to the next weekday
each midnight (`CurrentDay` 1 to 7), and the popcycle's weekend rows run from Saturday 20:00 to Monday 20:00; the
simulation now keeps that weekday (`Simulation.weekDay`, rolled by `advanceClock`, which the save's six passed hours
also go through), the fleet's four popcycle lookups read it, and a save point stores and restores it with the clock.


Ambient drivers took half the popcycle car maximum, capped at 7, so Ganton at 17:00 (popcycle 8 cars) ran four cars
where the original runs eight. CPopCycle::Update splits the zone's car maximum between dealer, gang, cop and other
cars, all of them driving (parked cars come from the car generators), so the drivers now take the whole maximum with
a browser ceiling of 14. Measured standing at Ganton and downtown Los Santos: 6 to 8 drivers instead of 4, the
traffic step 0.1 ms a frame, render time unchanged.

## Flight ceiling

A Rustler climbed to 4.5 km in a flight probe; the original stops aircraft at a ceiling. `CVehicle::HeightAboveCeiling`
(0x6D2600, reversed in gta-reversed ead3051) gives 800 m for planes and helicopters and 500 m for the RC Baron (with a
band between 950 and 1500 m). Its caller `FlyingControl` is still a retail stub, so the response above the ceiling is
authored from play: the nose is held down and a downward push grows with the height above the ceiling. In the probe
the Rustler tops out at 802 m, noses over and dives away at 74 m/s.

## Loading holds while driving and flying

A player dropped over ground that was not streamed in (a parachutist far from any window, a dev teleport) fell out
of the world: the follower asked for nothing while he was airborne, an arriving window was deferred until he landed
on nothing, and the keep-position install refused him. A standing, flying or falling player (below -4 m/s) may now
request and take a window; `tests/browser/terrain-under-a-falling-player.spec.ts` drops CJ 120 m over downtown San
Fierro and he lands on the streamed window after one 1.9 s hold. With that, the route probe drove San Fierro (49
windows) and Las Venturas (68 windows) at 35 m/s with no hold, no fault and a bounded heap.

Reported on September 19 as painful. Measured with the route probe (`tests/browser/route-drive.spec.ts`, which now
prints each window's worker stage timings, request-to-install latency and the hold count): at 70 m/s a window took
1.3 to 1.9 s in the worker and the 90 s diagonal held 53 times for 28.6 s in all; at 35 m/s, 4 holds.

- The worker decoded every model of the window again and only then stripped the resident ones; a resident model now
  skips the decode altogether (its collision comes from the COL lookup readModel makes).
- The vegetation package, the district collision collections (250 to 350 ms a window) and the procedural plant
  models were read again for every window; they are cached per world and, for collision collections, per archive
  and selection (six selections kept).
- The follower centred the next window a fixed two seconds ahead; it now leads by the measured request-to-install
  latency plus 0.8 s (2 to 4 s), clamped at 0.8 radius, so a fast car does not outrun its own prefetch.
- An aircraft more than 40 m above the ground never holds: nothing under it needs collision until it comes down.

Parsed district placements are memoized the same way (24 per archive). After: a window takes 60 to 350 ms in the worker (placement merge about 10 ms, new-model decode 5 to 270 ms), the
70 m/s diagonal holds once, at its start, for 1.4 s, and the 35 m/s drive likewise. A two-minute Rustler flight from Verdant Meadows at 37 to 47 m/s streamed 52 windows with no hold at all (worker 40 to 310 ms), and a minute in the starter car driven for real along the channel floor (up to 39 m/s, 18 windows) held nowhere either. The channel's concrete sides there are 41 to 60 degree walls (measured with `groundAt`), so a car that cannot climb them from the floor is behaving as the original does. `following.latencyEma`,
`following.leadSeconds` and `following.holds` are in the dev state.

## Distant scenery on the ground

CRenderer draws its visible LOD list after RenderEverythingBarRoads with the camera's zShift lowered by 100, a depth
bias that pushes big buildings behind anything drawn at the same depth. The browser gives big-building meshes render
order 1 (after regular entities, after roads at -2) and a polygon offset, so a LOD that shares a surface with a detail
model it is not linked to (East Los Santos' `billbd3` rows carry LOD index -1 while `lodlbd3` stands at the same
spot) stays hidden behind it. `__game.placementsNear(radius)` lists nearby placements with their LOD state.

Reported on September 19 as "terrain rendering too slow": from a downtown rooftop the city ended 180 m away in
sky, and driving, buildings appeared at the window edge. The 1,000 m ring of native LOD and big-building models that
flight already streamed (`lodRadius`, bounded per placement by its own draw distance) was switched off on the ground.
It is now always on: the follower keeps `lodRadius` 1000 whether on foot, driving or flying, so the LOD world is
drawn out to each model's draw distance as CStreaming and the renderer do (3,204 native models draw beyond 600 m,
4,135 of the 4,482 beyond 300 m are `lod` models). On the scripted channel drive a window now carries about 750
model parts and 1,100 to 1,400 placements; resident stripping keeps the payload at 1 to 4 MB, the synchronous commit
runs 8 to 14 ms: the visibility graph and per-placement fades over the larger placement set, 5 ms of the commit, are now built as the pre-build job's last step and adopted when the commit took every pre-built visual and frame
work stays at 5.5 ms median, 9.9 ms at the 99th percentile in headless Chrome.

## Camera after leaving a car

Reported again on September 19 as "bugs after CJ gets off a car". Entering the starter car from the front left the
camera where it stood (the car camera only swung behind the vehicle above 1 m/s), so leaving without driving put the
camera in CJ's face and forward walked him toward it, into the car. `Process_FollowCar_SA` and `Process_FollowPed_SA`
are retail stubs in the pinned gta-reversed, so the behaviour is authored from play: the car camera now swings behind
the vehicle as soon as CJ is in and returns there two seconds after the last look, standing or moving; and on foot the
camera hangs on a string, keeping its place while CJ moves so that walking away trails it behind him and walking past
it swings it round (holding a sideways key circles him round the camera, as the original does). Aiming, glancing and
mouse looks still take precedence. `tests/browser/camera-car-exit.spec.ts` covers the front entry and rest exit.

## Player interactions checked after the reports

`tests/browser/player-interactions.spec.ts` (headless Chrome) reproduces the September 19 reports about aiming while walking and leaving a car:

- Pistol aimed on foot (weapon.dat flags 0x3033: aim with arm, move aim, move fire; move speed 1.0): CJ walks on the GunMove clips at about 1.8 m/s forward, back and sideways with his body on the aim, keeps firing at the pistol's rate while walking and reloads when the clip empties; pressing aim mid-run slews `m_MoveCmd` from the run into the gun walk over 0.3 s (ControlGunMove's 0.07 per step) and releasing it resumes the run at once. An earlier trial that looked like a stall was CJ knocked down by return fire (`ko_shot_front`) after the shots raised his wanted level.
- Car: approach, align, open, get in, close, shuffle from the passenger side, seated in 4.5 s; F at 9 m/s holds the handbrake until the car stops (`waitSlow`), then the get-out clip plays and CJ walks away; from rest, get out and close the door from outside.
- Pedestrians: 38 to 39 peds sampled over 40 s of slow driving, none in the plain walk state still for 4 s except two waiting at a crossing (`roadcross`).

Remaining differences seen on the way: the exit handbrake stops a 9 m/s car in about 0.5 s; the reversed `CTaskSimpleCarWaitToSlowDown::ProcessPed` applies no brake for a player driver (it only zeroes an AI driver's cruise speed) and `CTaskComplexLeaveCar` is a retail stub upstream, so the handbrake is an authored stand-in until the leave-car task is reversed. The car also rolls at up to 0.4 m/s during the get-out clip because `beginGetOut` releases that handbrake before the ped is out.

## Animated texture coordinates (RpUVAnim)

- Source: librw's clean-room `uvanim.cpp` / `anim.cpp` for the stream layout (rwID_UVANIMDICT ahead of the clump: STRUCT { numAnims } then rwID_ANIMANIMATION per animation with version 0x100, interpolator 0x1C0 linear or 0x1C1 param, numFrames, flags, duration, custom data (int, name[32], nodeToUVChannel[8]) and keyframes { time, uv[6], prevFrame }; rwID_UVANIMPLUGIN 0x135 in a material extension: STRUCT { mask } then a 32-byte name per set slot), and gta-reversed `CEntity::PreRender`, which runs `MaterialUpdateUVAnimCB` over an atomic's materials: `RpMaterialUVAnimAddAnimTime(CTimer::GetTimeStepInSeconds())` then `RpMaterialUVAnimApplyUpdate`.
- Port: `src/assets/uvAnimation.ts` reads both chunks and samples keyframes as `uvAnimLinearInterpCB` / `uvAnimParamInterpCB` (the param angle takes the short way round), builds the node matrix as `uvAnimLinearApplyCB` (right = uv[0..1], up = uv[2..3], pos = uv[4..5]) or `uvAnimParamApplyCB` (scale, skew and position, then a rotation about the texture centre), pre-concatenates the nodes into the channel matrix, and restarts an animation from zero once its time passes the duration (`AnimInterpolator::addTime`). A material with slots gets its own texture instance (the raster stays shared and uploaded once) whose `matrix` is the channel-0 transform; the installed scene advances every animator once per fixed step.
- Evidence: `tests/uv-animation.test.ts` (dictionary and plugin layout, scrolling, rotation about the centre, restart, channel selection, angle wrap, dictionary ahead of a clump). Channel 1 (second UV set) is computed but not applied.
- MatFX environment maps (rwID_MATERIALEFFECTSMAT, `readMaterialEffects` after librw's readMaterialMatFX): a material's env texture from its dictionary chain (vehicleenvmap128 from vehicle.txd for cars, glass maps for buildings) is sampled where the view-space normal points, uv = (0.5 + 0.5·n.x, 0.5 − 0.5·n.y) as librw's normal2texcoord, and added scaled by the effect coefficient (PC style: white env colour, no light clamp), through `nativeEnvMap` on both the generic and the building-pipeline materials. fbAlpha scales the env term by the texel alpha as `matfx_env.frag`'s `fba = max(pass1.a, disableFBA)`; bump, dual and UV-transform effects are read past, not rendered, and the env term is added after the fog, faded by the fog factor, as the original fogs it to black.

## Player input and swimming corrections

- Reproduced a dry-land jump failure through the production game entry screen: the swim task unconditionally cleared `controls.jump`. It now preserves the command outside swimming. The new browser check passes, and existing heavy-weapon/aiming jump restrictions still pass. Inspected the airborne screenshot.
- Corrected the grounded swim timeout from seconds to native time units using `CPed::ProcessBuoyancy` and `CTaskSimpleSwim::ProcessPed`.
- Replaced constant swim breath consumption with the source association-dependent formula. Corrected capacity overshoot and integer drowning-event damage in `CPlayerPed::HandlePlayerBreath`.
- Depth convention (2026-09-20): every native water depth compares against `CPed::GetPosition`, the ped origin a unit
  above the feet the simulation tracks (the ped COL bounds run from z −1). The port had used the feet: CJ started
  swimming knee-deep and treaded with his hips above the surface. `PED_ORIGIN_HEIGHT` now offsets the entry rule
  (origin 0.6 under, `CPed::ProcessBuoyancy`; the buoyancy-force trigger would fire 0.13 deeper), the strand exit
  (no water ends the task at once; standing counts SWIM_STOP_TIME only where the origin is not 0.6 under, since
  ProcessBuoyancy clears bIsStanding there), the back-to-surface check and the submerge servo (origin at the
  waterline minus the submerge depth). Entry with the origin 2 under goes straight to SWIM_UNDERWATER_SPRINTING
  (`CTaskSimpleSwim::ProcessPed`). `swimSubmergeZ` had dropped the breaststroke blend from the 0.55 remainder
  (native: 1 − breast − crawl), holding a full breaststroke 0.95 under instead of 0.4. Verified off Santa Maria
  Beach: treading at feet −1.55, the breaststroke at −1.4 with the head and hands at the surface.
  Street peds use the same origin: drowning starts with the origin 0.6 under, and a drowning or drowned ped floats
  where 1.1× (1.8× dead) buoyancy balances CPhysical gravity, the origin 0.727 (0.056) under (`pedFloatDepth`).
- Fourteen focused swim tests and the production build passed. The complete unit suite then passed 1,108 tests with 41 skipped; three targeted browser tests passed (dry-land jumping, weapon movement restrictions, boat boarding/driving/shore exit). Full original animation association scheduling, lung stats and player breath lifecycle remain open; see [swimming evidence](research/PLAYABLE_SWIMMING.md).

The full objective remains open. The [blueprint](FIDELITY_BLUEPRINT.md) defines comparison gates; the [gap checklist](GAPS_CHECKLIST.md) retains historical implementation detail with outstanding work restored.

## Breath ownership and vehicle drowning

- Added the source `m_bRequireHandleBreath` lifecycle. Breath now recovers after swimming ends and during ordinary vehicle travel, without double recovery while a swim/drowning callback owns it.
- Connected car and aircraft drowning states to driver breath handling; connected the boat's source inverted/slow/submerged branch separately. Original-asset browser tests verify drain, armour bypass and recovery, plus upright/inverted boat differences.
- Extended the existing death timer to occupied-vehicle frames and clear seat ownership before reset. Reset restores on-foot collision and breath ownership. Unit tests verify the delay, callback and reset state; the browser tests do not establish a retail-equivalent death sequence.
- Verification: 1,112 unit tests passed, 41 skipped; seven targeted browser tests passed (aircraft, boats and vehicle breath); production build passed. Inspected the flight screenshot from this run.
- Still open: native lung-capacity stats, bike/NPC/passenger drowning, pedestrian head-submersion outside the swim task, damage-event semantics and full vehicle buoyancy parity. These changes do not establish full swimming or survival equivalence.

## Damage and vehicle-death events

- Corrected occupied vehicle destruction: the native event sets health to zero directly; the browser previously reduced/absorbed it as ordinary damage. All four vehicle adapters now bypass armour and stat scaling for this event.
- Corrected the ordinary fatal-hit threshold to below one HP and stopped subsequent hits from restarting the death timer.
- The global 0.4 player multiplier is now explicitly marked unverified: the consuming stat routine is unreversed in the pinned source. See [damage evidence and outstanding branches](research/PLAYER_DAMAGE.md).
- Verification: production build passed; full unit suite 1,114 passed and 41 skipped; three targeted browser tests passed for vehicle death and breath. Earlier in this pass, the three existing vehicle-life browser tests also passed.

## SCM execution foundation

Added single-instruction decoding and `ScmThread` for numeric storage, arithmetic, conditional control flow, subroutines and waits. The original MAIN bytecode executes its name instruction and stops explicitly on DO_FADE at 55987. This component is not connected to gameplay and does not establish campaign compatibility. [Source semantics, tested scope and next missing systems](research/SCM_RUNTIME.md).

Verification: production build passed; 1,121 unit tests passed, 41 skipped, including existing full mission decoding and the new execution-core tests. No rendering behavior was changed in this step.

## Ordinary SCM thread scheduling

Added START_NEW_SCRIPT numeric argument copying, original active/idle list ordering, the 96-slot pool, ordinary-thread TIMERA/TIMERB updates while sleeping, and termination/slot reset. Source-ordered tests verify that new children wait for the next pass while existing threads continue. The runtime remains separate from gameplay and original MAIN still stops at DO_FADE. Mission-shared state, native handlers and cleanup are not complete.

Verification: 1,125 unit tests passed, 41 skipped; production build passed. Four new scheduler tests cover ordering, argument bits, sleeping timers, overflow, pool reuse and invalid starts. No rendering behavior changed; browser tests were not rerun for this step.

## Expanded execution and character replacement

- Added numeric array addressing, remaining basic variable arithmetic, timed arithmetic, copies, conversions and absolute values. Added the ordinary DO_FADE adapter and source visual fade state; the next original MAIN boundary is SET_TOTAL_NUMBER_OF_MISSIONS. These runtime components remain separate from gameplay, and audio/mission fade behavior remains open.
- Broad browser testing reproduced repeated animation-binding exceptions after replacing CJ with a workshop rig. Automatic packaged swim installation now checks coordinate convention and skeleton compatibility once per character instance. Custom assignments remain available. The three character browser tests pass, including an added no-page-errors assertion for repeated live replacement; inspected the diagnostic-rig screenshot.
- The pinned `CVehicle::FlyingControl` directly invokes retail address 0x6D85F0 and contains only an unfinished fragment below it. It cannot supply a full flight port; the current authored flight model remains a gap requiring further reverse engineering or reference evidence.
- `CStats::GetFatAndMuscleModifier` likewise delegates to retail address 0x559AF0. Native lung capacity depends on that routine; the current capacity of 100 remains an approximation rather than a verified PC 1.0 value.
- Corrected browser checks that had become stale: mute checks measure audible output rather than the shared weapon/speech voice pool; workshop metadata selects its named panel; the imported LOD fixture straddles current camera distances. Shadow recovery now targets the continuous world's actual entry button and no longer claims that the retired Verdant Meadows URL loads a separate scene.
- Added short/long text storage and arrays, text assignments/comparisons, true/false condition commands, and script random commands consuming an explicitly shared PC CRT stream. These additions do not change the original MAIN boundary or establish whole-engine RNG equivalence.

Browser verification: the broad sweep passed 141 tests and skipped 42, with seven failures. Retesting the corrected checks passed six unique tests, including the imported scene's complete timed-visibility and collision flow. One duplicate shadow test for a retired alternate scene was removed; it did not exercise that scene because the URL now opens Grove Street. In total, all 147 enabled unique browser tests passed across the sweep and targeted reruns; there was no second full-suite run. Inspected the recovered Grove Street shadow screenshot and diagnostic character screenshot. Skipped content tests remain unverified, and none of these runs establishes retail reference equivalence.

Final verification for this batch: 1,167 unit tests passed, 41 skipped; production build passed with existing bundling warnings; diff whitespace checks passed.

## SCM mission loading and game-state commands

- Reproduced the native ScriptSpace layout (200,000 + 69,000 bytes), mission-block loading from the MultiScriptArray, shared mission locals with once-per-frame mission timers, the fail-mission countdown and wrapper reset, the death/arrest check with its on-mission flag, LAUNCH_MISSION and name-based termination. `ShutdownThisScript` and mission cleanup remain unreversed; releasing the mission-running flag on retirement is reconstructed from that routine's purpose, not from source.
- Added the 242 PC 1.0 native no-op commands verbatim from the pinned checkout, and script-visible state for stats, clock, maximum wanted level, forced weather, fade colour, zone-name display and language, with the corresponding commands. Twelve of the new handlers follow engine routines or documented statics because their command dispatch is still unreversed; they are marked in source and in [the runtime notes](research/SCM_RUNTIME.md).
- The original MAIN now executes its whole prologue against a recording adapter, launches mission INITIAL into the mission block, and stops at that mission's first property-pickup command. Coverage over the packaged file: 196 of 1,455 distinct commands, 241,057 of 360,439 instruction sites. Entity, task, blip, text, audio and streaming commands are the outstanding families; the runtime is still not connected to the live simulation, because a partially executed prologue would leave the screen faded out.
- Verification: production build passed with the existing bundling warnings; 1,182 unit tests passed, 41 skipped, including nine new mission tests and six new game-state tests. Browser tests were not rerun; no rendering behaviour changed.

## SCM messages, switch tables and streaming requests

- Ported the CMessages brief, big-message and previous-brief queues, the CHud help-message state and the 96 intro text lines with their native defaults, keyed by GXT label because no text file is in the content depot. The pinned transcription of `CMessages::Process` shifts the queue the wrong way after an expiry; the original close-up behaviour is reproduced and noted.
- Implemented SWITCH_START/SWITCH_CONTINUED through the reversed jump-table helpers (the dispatch itself is unreversed) and verified against all 592 switches in the packaged file: sorted cases, chained continuation blocks and a non-zero default address in every one. Added the constant-operand compare family and adapter-routed model requests, model-loaded checks, release and fade status.
- Ported the 175-entry CRadar blip table with its handle counters and attribute routines; the blip command dispatch is unreversed, so the display defaults of the add commands are documented as conventional rather than verified. Sequence tasks remain open because the pinned checkout only stubs them.
- Coverage over the packaged file is now 265 of 1,455 distinct commands and 264,773 of 360,439 instruction sites. Entity, task, camera, pickup and mission-audio commands remain the open families, and the runtime is still not connected to the live simulation.
- Verification: production build passed with the existing bundling warnings; 1,199 unit tests passed, 41 skipped, including nine message tests, five switch/compare tests and three blip tests. Browser tests were not rerun; no rendering behaviour changed.

## Upstream search for the remaining blockers

The user asked for the blocked routines to be unblocked from related project
code. `gta-reversed-modern` was cloned and compared function by function
against the pinned checkout: both contain 8,304 reversed functions and differ
in five `CSprite` helpers only, so the pinned revision is already current.
`CVehicle::FlyingControl`, `CStats::GetFatAndMuscleModifier`,
`CPickups::GenerateNewOne`, `CPedDamageResponseCalculator::AccountForPedDamageStats`,
`CRunningScript::ShutdownThisScript` and `CTaskSequences::GetAvailableSlot` are
retail stubs in both. A search of GitHub code, issues and pull requests and of
the modding forums found no published reversal of the flight model; the
gta-reversed author's own partial stops at an unidentified branch. The depot
holds data files only and no executable, so the flight model, bike and quad
control, plane and heli control, trains, gunplay, melee, projectiles and
weather stay authored until someone reverses them upstream.

What the same survey did establish is that `CAutomobile::ProcessControl`,
`CCollision::ProcessColModels`, the `CPhysical` force and collision routines,
`CBoat::ProcessControl`, `CPickup::Update`, `CPopulation::AddPed`,
`CWanted::Update` and `CGameLogic::Update` are all fully reversed and
available. Vehicle, boat, population and wanted work already draws on them.
`CGameLogic::Update` did not, and is ported in this pass.

## Native wasted and busted respawn

- Replaced the authored death recovery with the reversed `CGameLogic::Update`
  sequence over the `CRestart` tables: the three and four second holds, the
  one-shot fade to black, the wait for that fade, the hospital and
  wanted-level fees, the twelve hour clock advance and the nearest hospital or
  police restart point. The eight hospital and seven police points come from
  the packaged script through a new extractor. See
  [the damage and respawn notes](research/PLAYER_DAMAGE.md).
- The previous behaviour charged a flat 100 for both outcomes, respawned at
  the current spawn point, advanced no clock and used a four second timer.
- Verification: production build passed; 1,210 unit tests passed and 41
  skipped, including eleven new restart and game-logic tests. The random range
  helper the script runtime used inline is now shared with the busted voice
  pick, and its existing tests still pass. Five browser tests passed: a new one
  confirming the live world extracts all fifteen restart points and starts in
  the playing state with no page errors, plus the existing fade, progression
  and two wanted checks, which cover the rewired arrest path.
- Not evidence of retail equivalence: no reference capture of the wasted or
  busted sequence was compared, so the timings and fees are source-matched
  rather than trace-matched.

## Native damage and death reactions

- Pedestrians hit by weapons now choose their reaction clip through the
  reversed `CEventDamage::ComputeDeathAnim` and `ComputeDamageAnim`, with
  `CPed::GetLocalDirection`. The weapon id and hit point come from the weapon
  system. Before, every gun hit and death used one flinch and one knockdown.
- Body part comes from hit height and side, because the retail hit-sphere
  table the game uses is not published. `ComputeWillForceDeath`, the
  fat-and-muscle knockback modifier and task abort results are still retail
  stubs upstream and take neutral values.
- `ComputeWillKillPed` (0x4B3210, reversed) kills a ped that a blow leaves
  under 1 HP, as it already did for the player. Before, peds died only at 0.
- Verification: unit tests over the reaction choice and a browser test that
  shoots three live pedestrians and checks the chest flinch, the shotgun death
  and the running partial shot.

## Street props: smashing, destruction and break pieces

- Cars used to stop dead on bins, bags, boxes and lampposts because every
  OBJECT.DAT prop was a fixed collider. The static-object branch of
  `CPhysical::ApplyCollision` and `CObject::ObjectDamage` are now ported:
  props lose health, smash, break or uproot, and the car keeps the native
  share of its momentum. Uprooted props become dynamic bodies with their
  OBJECT.DAT mass, launched by the general two-body collision response.
  Destruction sounds, causes-explosion props and OBJECT.DAT effects follow the
  same routines. Breakable props such as lampposts throw their
  breakable-plugin pieces through a port of `BreakObject_c`.
- An uprooted prop's later motion is Rapier's. Damaged-model swaps, hydrant
  jets and parking-meter money are not reproduced. See
  [the object data notes](research/OBJECT_DATA.md).
- Verification: 1,287 unit tests passed, including the damage, impact,
  two-body, effect, sound, plugin reader and piece simulation cases. Browser
  drives through three Grove Street props and into a fire hydrant pass. The
  full browser suite passed apart from four tests that failed while files were
  being edited mid-run; all four pass when rerun. The start scene package was
  rebuilt to carry the breakable plugin.

## Cars striking pedestrians

- Pedestrians took no damage from cars, and their kinematic bodies stopped
  cars like walls. Impacts now follow the ped branch of
  `CPhysical::ApplyCollision`, where the car counts ten times its mass, and
  the reversed `CTaskSimpleKillPedWithCar::ProcessPed`: run-overs, bonnet
  throws, 1000 damage with the native death animation, the push back on the
  car and the crunch sound.
- `CPed::KillPedWithCar` is a retail stub, so the kill gate (impact intensity
  12) is authored, and non-lethal hits keep the old knockdown. See
  [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: 1,297 unit tests passed, and a browser test runs down a
  civilian at 12 m/s. Traffic, weapons, damage reaction, passenger, combat,
  prop and navigation browser tests passed; the recruitment test failed once
  and passed on rerun.

## Melee: left click, combo swings and hit reactions

- A left click never attacked unless aiming, because the left button also
  drags the camera. A short click now attacks, as SA's left button does.
- Swings play each combo stage's native clip and the ground attack on downed
  peds; combos chain at melee.dat hit and chain frames instead of an authored
  interval that made chaining impossible. Frontal combo hits play the native
  HitA reactions through the ported damage animation choice, and only the
  third hit floors the victim.
- Most of `CTaskSimpleFight` is a retail stub, so the fall on the third move
  is assumed. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- Strike timing follows melee.dat:
  - A blow lands on its move's hit frame, from where the player stands then,
    rather than on the click.
  - A press during a move is held until its chain frame (or the end of its
    swing clip, whichever comes first), when the next move starts. A press
    within 0.25 s after the chain frame still chains; later ones start over.
  - The ground and moving attacks carry their own melee.dat hit and chain
    frames.
- Every melee blow goes through the ported `CEventDamage::ComputeAnim` with
  the attacker's fight move (0–2 the attacks, 3 the ground attack, 4 the
  moving attack). The authored knockdown with a `min(7, damage × 0.1)` push no
  longer floors healthy peds, and a floored ped takes the floor hit.
- `CTaskSimpleBeHit::StartAnim` plays FIGHT_HIT_1 + move from the attacker's
  combo group (TaskSimpleBeHit.cpp): Bat_Hit, knife_hit, sword_Hit, Dildo_Hit,
  Flower_hit and CSaw_Hit, from the weapon's IFP. Before, every victim played
  the fist group's HitA.
- `FightStrike` is a stub, so the strike stays a 0.45 sphere swept along the
  player's heading over the combo's 1.6 range rather than melee.dat's strike
  levels and per-move radius.
- The chainsaw follows melee.dat's CHAINSAW row like the other weapons: CSaw_1–3
  land 50, 60 and 100 on frames 14, 14 and 13. The ground attack does 25, as does
  the moving attack. Holding attack chains the moves, as the held attack's command
  11 each frame does. Before, it cut 18 × 3 every 0.12 s and floored the victim
  on every tick. The rest of its cadence while held is in the stubbed
  `ProcessPed`.
- Street brawlers, fighting CJ or another ped, fight through the same melee.dat
  combo (UNARMED_1) as cops with nightsticks (BBALLBAT):
  - Each move lands on its hit frame for its damage × the brawler's pedstats
    attack strength, if the target is still within the range plus the move's
    radius. The next move starts on the chain frame while the target stays in
    reach.
  - `CTaskSimpleFightingControl::CalcMoveCommand` (reversed) starts no move
    while the target is 15° or more off the ped's heading. The ped turns at its
    pedstats heading change rate.
  - CJ plays HitA_1–3 for the move through the ported `ComputeAnim`.
  - Before, every NPC punch dealt a flat 10 at the start of FightA_1, and the
    brawler snapped to face its target.
  - The half-second pause between combos is authored, because the attack
    cadence is in the stubbed `ProcessPed`.
  - When CJ swims, a brawler stops following him, as the reversed
    `CTaskComplexKillPedOnFootMelee` does with a submerged target.
    - It turns to face CJ and shakes its fist (`CTaskSimpleShakeFist`,
      FUCKU at blend 4), then stands for 2 s, and repeats.
    - Once CJ is out of the water it fights on.
- Stealth kills follow `CPedIntelligence::TestForStealthKill` (reversed) and
  `ProcessPlayerWeapon`'s KILL_Partial gate.
  - The victim must be up with at least 1 HP, walking or still, within 2.5 in
    3D, facing away, and not on a kill task against the player (brawling,
    beating or arresting him). The authored 1 m height window is gone.
  - The player must hold the target button with a move blend ratio under 1.9,
    not sprinting, and with no attack running.
  - The victim is `m_p3rdPersonMouseTarget`, but `Compute3rdPersonMouseTarget`
    is a stub. The candidate nearest the crosshair ray stands in for it; before,
    it was simply the nearest ped.
  - The event-and-acquaintance check (a hostile ped already reacting to the
    player) needs ped.dat relationships, which are not loaded yet.

## Bullets on props and tyres

- The reversed `CWeapon::DoBulletImpact` now drives bullet hits on OBJECT.DAT
  props (pushes that knock light props loose; gun-break damage on breakables)
  and on tyres, through the wheel spheres of `SetUpWheelColModel` and
  `CAutomobile::BurstTyre`. The wheel port's existing burst handling is now
  fed, with the native 0.5 wheel damage effect.
- The tyre burst effect (`Fx_c::AddTyreBurst`) and `CVehicle::InflictDamage`
  remain retail stubs. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: 1,301 unit tests passed; the weapon, traffic, car, prop,
  pedestrian, drive-by and navigation browser tests passed.

## Explosions

- Explosions now use the reversed `CExplosion::AddExplosion` parameters and
  `CWorld::TriggerExplosionSectorList`: per-type radius and force, full
  strength inside half the radius, 250 damage to peds, 1100 to vehicles,
  turn forces on vehicles, and uprooting, pushing and ObjectDamage for props,
  with no line-of-sight shielding. The authored radii, damage and wall check
  are gone. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: 1,309 unit tests passed; a grenade browser test and the
  weapon, aircraft, FX, combat audio and vehicle life browser tests passed.

## Fire

- The reversed `CFire` and `CFireManager` replace the authored flame hazards
  and burn list: a 60-fire pool, native burn times, strength steps and effect
  names, player and vehicle ignition, merging, and water. Molotovs, rockets,
  object explosions and the flamethrower start fires through the native
  explosion and shot routines. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: 1,321 unit tests passed; a molotov browser test and the
  weapon, FX, combat audio, explosion and vehicle life browser tests passed.

## Bumping into pedestrians

- The player's side follows `CEventHandler::ComputePlayerCollisionWithPedResponse`
  (reversed), in `ped/nativePlayerBump.ts`. By both move states and who walked
  into whom:
  - A running ped that walks into CJ while he stands staggers him: HIT_FRONT,
    HIT_L, HIT_BACK or HIT_R, as `CTaskComplexHitResponse` plays.
  - So does sprinting head-on into a running ped.
  - A player weaker than the ped by pedstats defend weakness would fall instead.
    CJ's is 0.4, so he never does.
  - `ComputePedHitSide` is a stub, so the side is where the ped is.
  - The BUMP line needs speech banks the depot lacks. The two-second look-at is
    not ported. `AnnoyPlayerPed` changes only the player's temper, which nothing
    here reads.
- Bumps are noticed when either one moves, not only CJ.
- The ped's side (0x4BE7D0 and 0x4BDB80) is a stub and keeps the authored shove.

## Player reactions and props kicked on foot

- CJ now flinches, is knocked down and gets up, and holds a death clip,
  through the ported damage and death animation choice fed by damage events
  from NPC gunfire, punches, nightsticks, drive-bys and explosions. Before,
  CJ showed no reaction and stayed standing when wasted.
- CJ's movement sweep now knocks loose props over and shoves moving ones, per
  the ped branch of `CPhysical::ApplyCollision`.
- See [the combat notes](research/COMBAT_AND_POPULATION.md) and
  [the object data notes](research/OBJECT_DATA.md).

## Wasted and busted screen text

- `CPlayerInfo::KillPlayer` adds the "DEAD" text for 4 s and the arrest adds
  "BUSTED" for 5 s, both as the white middle big message. `CHud::DrawBustedWastedMessage`
  draws it in the gothic font at scale 2.1, light grey (225, 225, 225) with a
  3 pixel black edge, its bottom 30 lines of the 448-line frame above the
  centre. Its alpha climbs 0.4 per millisecond, so it fades in over about
  0.64 s. The zone and vehicle names are hidden while it shows, and
  `CHud::ResetWastedText` clears it at resurrection.
- The previous build showed a small "Wasted" toast plus a red full-screen
  "Wasted" overlay whenever health reached zero, and a separate "Busted"
  overlay during the arrest timer. Both overlays are gone.
- Known differences:
  - The reversed `CGameLogic::Update` only adds "BUSTED" when the arrested
    ped is the co-op second player. Retail shows it to a lone player too,
    presumably from `CPlayerInfo::Process` (0x56F8D0), which is still a retail
    stub. The browser shows it on every arrest.
  - The sprite font is replaced by UnifrakturCook, sized so its capitals
    roughly fill the sprite cell. The sideways stretch follows the screen's
    aspect as `SCREEN_STRETCH_X` does.
  - The 4 and 5 s lifetimes run on page time rather than game time.
- Verification: the game-logic unit tests check the busted message and the
  reset. The player reactions browser test checks the text, its colour, the
  hidden zone name and that it clears.

## Cars striking the player

- Traffic, police and empty rolling cars used to stop dead against CJ, because
  his kinematic capsule was an immovable wall to the solver, and CJ never
  reacted to being hit.
- Contacts now follow the ped branch of `CPhysical::ApplyCollision` and the
  reversed `CEventHandler::ComputeVehicleCollisionResponse`. A car at 25 m/s or
  more knocks CJ down. A slower car shoves him along, and he shakes a fist at a
  driven car when standing still and unarmed. A stuck CJ is knocked down by a
  car above 2.5 m/s once the impulse passes 10. See
  [the combat notes](research/COMBAT_AND_POPULATION.md).
- The knockdown outcome comes from the Vice City `KillPedWithCar`, because the
  San Andreas function and the hit task's subtasks are retail stubs.
- Verification: five new unit tests cover the response rules. Two new browser
  tests launch the empty car at CJ: at 30 m/s he falls and the car keeps most of
  its speed, and at 5 m/s he is pushed aside unhurt. The car entry, traffic,
  police, shove, street life and pedestrian car tests still pass.

## Police arrests on foot

- The authored arrest, where standing still or holding H to surrender for
  1.2 s near a cop meant busted, is gone. So is the instant wanted-level reset
  at arrest, and the pursuit hint under the stars.
- Cops now pick weapons with `CTaskComplexPolicePursuit::SetWeapon`. At one star
  an unarmed CJ faces the nightstick and its melee.dat combo, whose third swing
  knocks him down. A cop within 3 units of a falling CJ arrests him with the
  `ARRESTgun` clip, CJ stays down, and the busted sequence runs with the wanted
  level kept for the fee. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: seven new unit tests cover the weapon choice, the arrest reach
  and the fall flags. The police browser tests now check the pistol arrest of a
  falling suspect and the nightstick combo. A new end-to-end test places a cop
  at one star and waits for the busted text. The combat test now checks that a
  one-star cop draws the pistol once CJ holds a gun.

## Guns aimed at pedestrians

- Aiming an instant-hit weapon at a locked-on ped now raises the native
  `CEventGunAimedAt`. Street peds face CJ, raise their hands for 3 to 5 s and
  walk off. Armed street peds turn on him, fleeing peds keep fleeing, and cops
  report `CRIME_AIM_GUN`. Before this, aiming at a ped did nothing. See
  [the combat notes](research/COMBAT_AND_POPULATION.md).
- With the decision-maker files loaded, every street maker (rand_norm,
  rand_tough, rand_weak) answers with the reaction. Without them, only
  rand_norm and rand_weak peds react. See
  [Decision makers](#decision-makers).
- Fixed an operator-precedence bug in the pedestrian speed choice: `??`
  binds tighter than `?:`, so a cop, gang member or follower told to stand
  still (speed 0) fell through to walking. They now stand.
- `HANDSUP`, `HANDSCOWER` and other ped.ifp clips with name-only tracks now
  resolve their bones through the rest of the pack, as the weapon loader does.
- Verification: five unit tests cover the event rules and the task. A new
  browser test aims at a civilian and checks it raises its hands, walks off at
  least 3 units, and ignores an aimer behind it. The police, gang, recruit,
  street life, shove, melee, lock-on and weapons browser tests still pass.

## Gunshots heard by pedestrians

- Shots now reach street peds through `CEventGunShot::AffectsPed`: 45 units for
  any shooter, and a silenced pistol only reaches peds that face the muzzle
  with a clear line of sight. The previous build used an authored 35-unit
  radius, and 8 units for the silenced pistol whatever the ped faced.
- Affected peds answer from their decision maker when its files are loaded
  (see [Decision makers](#decision-makers)); otherwise they flee.
- Verification: a new browser test checks that a shot 50 units away is not
  heard, and that a silenced shot scares a ped facing it but not one behind.
  The weapons, lock-on, combat audio, gang, wanted and street life tests pass.

## Fleeing the player

- Fleeing the player follows `CTaskComplexSmartFleeEntity` (reversed): sprint
  away until `safe` from the player's position, with that position re-read
  every 1000 ms once he has moved a unit. The flee time is 1,000,000 ms.
  - Safe distances: 60 after the player's gunshot, his aimed gun and his
    damage (`ComputeGunShotResponse`, `ComputeGunAimedAtResponse`,
    `ComputePersonalityResponseToDamage`).
  - Without the decision-maker files, bystanders within 12 of a hurt ped
    flee him to 45 (authored). With them, bystanders ignore a panicked ped;
    see [Decision makers](#decision-makers).
  - Before, every flee lasted 8 s straight away from a fixed point, about
    47 units.
- `CTaskComplexSmartFleePoint`'s route (`ComputeFleeDir`, the wander
  subtask and `CPathFind::FindNextNodeWandering`) is a stub.
  - The browser follows the ped path network, taking at each node the link
    heading most directly away from the threat. It turns back along the
    current link when that link leads toward him.
  - It runs straight away only when no link leads away or no node lies within
    20. Running straight had pinned peds against walls short of the safe
    distance.
- Whether a damaged ped flees or fights comes from its decision maker when
  the files are loaded. NPC shooters are fled as entities to 60; other point
  threats keep the 8 s flee.

## Decision makers

- `src/ped/nativeDecisionMaker.ts` reads the retail `data/decision/allowed`
  files, following `CDecisionMakerTypesFileLoader::LoadDecisionMaker`
  (reversed).
  - Each row has six choices. Each choice has a task, four chances
    (friend, threat, player, neutral), an in-vehicle flag, an on-foot flag
    and six unused facial chances.
  - A ped's pedstats column picks its maker: rand_norm, rand_tough,
    rand_weak, cop, and so on (`CPed::SetPedDefaultDecisionMaker`).
- `MakeDecision`, `CDecision::MakeDecision` and
  `CEventSource::ComputeEventSourceType` are retail stubs. They follow the
  documented behaviour:
  - The event's source picks the chance column: the player column for CJ,
    and `ped.dat` acquaintances for other peds (respect or like gives friend,
    hate or dislike gives threat).
  - One task is drawn with probability proportional to its chance, among
    those allowed on foot.
  - `INFORM_RESPECTED_FRIENDS`, `INFORM_GROUP` and `LOOK_AT` are left out,
    as `ComputeResponseTaskType` asks.
  - `TASK_NONE` is a real choice to do nothing.
  - The Families use the friend column for CJ. That is authored: the script
    sets their respect for him.
- The answers follow the reversed handlers:
  - `ComputePersonalityResponseToDamage` for damage, where the kill task needs
    `IsKillTaskAppropriate` (the ped has a gun, or the attacker has none).
  - `ComputeShotFiredResponse` for gunshots, and `ComputeGunAimedAtResponse`
    for an aimed gun.
- `HandleEvents` gates each new event against the one the ped is answering.
  An event of the same type is dropped. Otherwise priority decides: damage 65,
  an aimed gun 50, a gunshot 35.
- Examples from the retail tables, when punched by CJ:
  - rand_tough peds always fight back; shot at, the unarmed ones run.
  - rand_norm peds fight 60% of the time and flee 40%.
  - rand_weak peds always flee.
  - Unarmed peds of all three flee CJ's gunshots. Armed rand_tough peds attack
    him 60% of the time.
- A fleeing ped raises `CEventSeenPanickedPed` (priority 13). Its handler
  flees the source of the event the bystander is already answering, and only
  events of priority 13 or lower (chat partners, attractors) give way to it.
  None of those are modelled, so bystanders no longer flee a hurt ped.
- Approximations:
  - Ducking, cowering and hands-up answers are not modelled. The street
    makers only list them for sources other than CJ.
  - A kill task lasts 10 s, because `CTaskComplexKillPedOnFoot`'s control
    is a stub.
  - Facial chances are ignored.
  - Rows for events 0, 16, 45 and 74, which `PedEvent.txt` does not index,
    are read but never asked for.
- The files come from the content depot. The published world does not carry
  them yet, so the game keeps the authored answers until they are published.
- Verification: unit tests check the parser, the draw, the priority gate and
  the retail shares above. A browser test loads the depot files into a live
  crowd and checks the fight, flee, gunshot, aimed-gun and Families answers.

## Pedestrians wandering

- A wandering ped now keeps a direction in eighths of a turn, started at
  random as `GetWanderTaskByPedType` does. Before, it took each node's links
  in turn (round-robin), avoiding the node it came from
  (`src/ped/nativeWander.ts`).
- `CTaskComplexWander::UpdateDir` is reversed:
  - At a node with three or more links, it draws
    (3 × frame counter + the ped's seed) % 100.
  - From 81 to 90 the ped turns a quarter one way; above 90, a quarter the
    other.
  - It keeps the turn only if the link it then takes lies within three eighths
    of the old direction, compared without wrapping round, as in the source.
- `CPathFind::FindNextNodeWandering` and `CreateNextSubTask` are stubs. The
  next node is the link heading closest to the direction, not back where the
  ped came from unless nothing else leads on. A straight-on step takes that
  link's direction, so peds follow bends.
- `CPathFind::TakeWidthIntoAccountForWandering` (reversed) gives each ped its
  own point beside a node, fixed by its random seed:
  - x: the width byte × ((seed % 16) − 7) × 0.00775;
  - y: the same with ((seed / 16) % 16) − 7.

  That is up to about the path width either way, so peds spread across the
  pavement instead of walking one line.
- A wanderer arrives within 0.5 of its point, the `CTaskSimpleGoToPoint`
  radius `ControlSubTask` sets; it was 0.8.
- `ScanForBlockedNode` (reversed) re-routes a ped from its next node when the
  ped is within 3 of its point there and the closest vehicle's collision
  radius plus 1 covers that point. The closest ped is not tested, because the
  ped collision's bounding radius is not in the published data.
- A stuck wanderer now scratches its head, as `ControlSubTask` does.
  - `CPedIntelligence::ProcessStaticCounter` (reversed) counts frames while a
    walking go-to ped stays within a quarter unit of where it last moved.
  - Past 30 frames (a second at the PC's 30 fps), the ped plays XPRESSscratch
    standing still.
  - `CreateNextSubTask` then turns the wander an eighth and takes the link
    from its next node closest to that direction.
  - Before, a ped with little headway for 2 s simply took another node.
  - The retail counter also needs a collision entity; here, standing still
    while walking toward a node stands in for it.
- Peds now stop at road crossings.
  - `CPathFind::TestCrossesRoad` and `TestForPedTrafficLight` (reversed)
    read each link's intersection byte from nodes.dat: bit 0 is a road
    crossing, bit 1 a pedestrian light.
  - At such a link the ped turns to the heading of its point on the far side
    (`ComputeTargetHeading`, `CTaskSimpleAchieveHeading` at half rate to
    0.2 rad).
  - Without a light, `CTaskComplexCrossRoadLookAndAchieveHeading` plays the
    group's ROADCROSS clip (animgrp.dat's fifth) once, then the ped crosses.
  - With one, `CTaskComplexObserveTrafficLights` repeats ROADCROSS and a
    3–5 s stand while `LightForPeds` is not green, and crossing follows the
    green.
  - The light is read on the same timer the traffic uses, so peds cross only
    while cars have red.
  - `CreateNextSubTask`, which chooses these tasks, is a stub; they start when
    the wander takes such a link.
- Verification: unit tests cover the sectors, the draw, the link choice, the
  turn rule and the offset. The street life, flee, melee, gang, police,
  car-ped and weapons browser tests pass.

## Burning pedestrians

- A burning ped used to flinch on every frame of fire damage and scare its
  neighbours from its own position. It now runs `CTaskComplexOnFire`: it
  sprints away from CJ without flinching, cries out now and then, and dies with
  `KO_SHOT_FRONT_0`. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: the molotov browser test now checks that the burning civilian
  flees without a flinch clip and dies with the fire death clip. It passed four
  repeated runs. The weapons and damage-reaction tests still pass.

## Pedestrians dodging vehicles

- Street peds in the path of a moving vehicle now answer through the reversed
  `ComputeVehiclePotentialCollisionResponse`. They step aside, dive with
  `EV_dive` and get up, raise their hands or shake a fist, and a honking
  player makes more of them move or turn. Before this they walked into cars
  without reacting. See [the combat notes](research/COMBAT_AND_POPULATION.md).
- The scan that raises the event is a retail stub, so its Vice City ancestor
  stands in.
- Verification: seven unit tests cover the scan and the response. A browser
  test drives the empty car at a ped with the horn on and checks that it
  dodges out of the lane. It and the car-kills-ped test passed five repeats
  each. The street life and traffic tests pass.

## HUD ammo readout

- The weapon readout used to show the weapon name, skill level, clip and
  reserve, and loading or reloading states in a monospace line. The original
  HUD shows none of that. `CHud::DrawAmmo` (reversed) now draws the rounds
  outside the clip, a dash and the rounds in the clip, centred under the weapon
  icon in light blue (172, 203, 241) with a black edge.
- With fists, `CHud::DrawWeaponIcon` draws hud.txd's `fist` raster
  (SPRITE_FIST) in the icon's 47 × 58 box. The drawn fist remains only until
  the sprite loads.
- As in the original: one-round and 1000-plus clips show the total alone, the
  flamethrower counts in tens, and nothing is drawn for fists, melee slots, the
  gifts, the cane, the parachute, USE weapons or 9999 spare rounds.
- The browser still reports a weapon whose assets failed to load, which the
  original never needs.
- Known difference: the subtitles sprite font is replaced by bold Arial.
- Verification: two unit tests cover the text rules. A browser test checks the
  readout's text, colour and place under the pistol icon, and that fists show
  none. The weapons browser tests pass.

## Zone and vehicle names

- The zone name used to sit permanently in the bottom-right corner in beige,
  and getting into a car printed a control prompt ("W/S drive · A/D steer…").
  Neither is in the original.
- `CHud::SetZoneName`, `DrawAreaName`, `SetVehicleName` and `DrawVehicleName`
  (all reversed) now drive both slots. A name fades in over 1 s, holds until
  3 s after it began, and fades out over 1 s. A new name first fades the old
  one out. The zone and vehicle names push each other out, and a small message
  or the wasted and busted text pushes the zone name out.
- The zone name is gothic in light blue (172, 203, 241). The vehicle name is
  HUD green (54, 104, 44), shown while the player is in a vehicle.
- Known differences:
  - Zone and vehicle names are GXT text, and the depot has no GXT file. The
    zone slot shows the loaded region's name once at start, and vehicles keep
    their browser names.
  - The menu font is replaced by Arial Black. The camera-fade pauses in
    `DrawAreaName` are not reproduced.
- Verification: four unit tests cover the name states. A browser test checks
  that the zone name shows and fades, and that getting into the Greenwood shows
  its name in HUD green with no prompt.

## Wanted stars

- `CHud::DrawWanted` is a retail stub, so the stars follow its Vice City
  ancestor: six stars, the wanted ones gold and the rest dark. For 2 s after
  the level changes, the wanted stars show only on frames where the 30 fps
  frame counter has bit 4 set, so they blink.
- The earlier build drew hollow outlines for the unwanted stars, never
  blinked, and recoloured the stars while the police searched.
- Verification: a unit test covers the blink timing, and the police browser
  tests pass.

## Busted in a car

- A cop at the driver's door used to make CJ step out normally, after which a
  pistol cop could shoot him where he stood. CJ is now dragged out with
  `CAR_jackedLHS` and lands on the ground. A cop out of reach runs in rather
  than shooting, and arrests him there. See
  [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: a new browser test puts CJ in the Greenwood at two stars,
  places a cop by the door and drags him out. It checks the drag phase, that CJ
  is out of the car, the arrest and the busted text. The earlier police tests
  pass.

## Cars on their roofs

- A car on its roof used to stay there unharmed. `CAutomobile::VehicleDamage`
  (reversed) takes 4 health per frame from any upside-down car that is not the
  player's, so it catches fire below 250 and blows up about five seconds later.
- The player's own car is handled by `CPlayerInfo::Process`, a retail stub.
  The browser uses its Vice City ancestor: every 32 frames at 30 fps it adds 2
  for a car on its roof or 1 on its side, while the car is slower than 0.05
  units per frame and out of water, and clears the count otherwise. Past 6 it
  caps health at 249, which sets the car alight.
- Known difference: the Vice City rule also marks the engine as damaged, and
  the browser does not track engine status.
- Verification: two browser tests flip the Greenwood. Empty, it drops below
  250 and is wrecked. With CJ inside, it keeps its health for two seconds and
  is capped at 249 soon after. The other car browser tests pass.

## Car component groups

- `CDamageManager::GetComponentGroup` follows gta-reversed's later fix
  (db11601c08): the windscreen is a panel, grouped with the bumpers, not a
  light.
  - Its damage now uses the panel multiplier, 2.5 × 0.6, so it cracks past
    intensity 100 rather than 90.
  - It no longer smashes a fifth light.

## HUD radar

- The minimap was a 180-pixel north-up square view of 700 units with parked
  cars as cyan markers, a dashed line to the waypoint and an "N ↑ · Map [M]"
  label. `CRadar` is fully reversed upstream, and the radar now follows it:
  - `CRadar::DrawMap`: 180 units to the edge on foot. In a vehicle it widens
    from 180 at 0.3 units per frame to 350 at 0.9, and a plane scales with
    altitude.
  - `CRadar::CalculateCachedSinCos`: the map turns with the camera, so the
    view direction is up.
  - `CRadar::DrawBlips`: the north blip sits on the rim, the player arrow turns
    by the player's heading against the radar's, and the waypoint blip is
    limited to the rim.
  - `CRadar::TransformRadarPointToScreenSpace` and `CHud::DrawRadar`: centred
    87 across and 66 up of the 640 by 448 frame, 76 lines tall, inside a black
    rim 4 wider.
- Known differences:
  - The radar is kept round instead of stretched on wide screens.
  - The radar tiles come from the prepared San Andreas image.
  - Script blips come only from the INITIAL mission, read statically (see
    below). Blips that later threads and missions add, such as the shops,
    are not drawn.
- The rim and blips now use `hud.txd`'s rasters:
  - `CHud::DrawRadar` draws RADAR_DISC four times, tinted black and mirrored
    into each quarter. The quarter reaches 42 lines from the centre, a thin
    ring from about 38 to 42 around the map's 38.
  - `CRadar::DrawRadarSprite` draws `radar_north` and `radar_waypoint`
    16 × 16 lines at the blip.
  - `DrawRotatingRadarSprite` draws `radar_centre` with its corners 8 lines
    out, at the player's heading minus the radar's minus 180°.
    - `CSprite2d::SetVertices` puts the texture's first row at the bottom, so
      the up-pointing arrow shows upright when CJ faces the view direction.
  - Until the sprites load, the old drawn shapes stand in.
- The INITIAL mission's sprite blips are now on the radar
  (`src/assets/scmRadarBlips.ts`). They are read from main.scm without
  running it: the mission's global assignments give the coordinates, and
  `CHANGE_BLIP_DISPLAY` and `REMOVE_BLIP` are followed on each handle.
  - That gives 26 properties for sale (radar_propertyR), 6 owned
    (radar_propertyG), 3 races (radar_race) and 9 Pay 'n' Sprays
    (radar_spray), all short-range.
  - `CRadar::DrawCoordBlip` draws a short-range sprite blip only inside the
    radar and limits the others to its rim.
  - `DrawBlips` draws the north blip first, then the other blips, then the
    player's arrow.
- In a plane other than the Vortex, `CHud::DrawRadar` rotates
  `radarRingPlane`, an artificial horizon, over the radar at
  π − atan2(−right.z, up.z). It is kept round at the 59-line extent, like the
  radar.
- In a plane, a heli or with the parachute out, the altimeter sits left of
  the radar:
  - a bar of (10, 10, 10, 100), 10 wide and 76 tall;
  - a 2-pixel mark of (200, 200, 200, 200) that reaches the top at 200 units
    of altitude, or at 950 above 200.
- The full map behind M is unchanged.
- Verification: three unit tests cover the range, radar space and the north
  blip. The navigation browser test passes, and screenshots show the map
  turning with the camera and the north blip moving round the rim.

## Radio station name

- Tuning the radio used to post a "Radio · station" message in the prompt
  line. `CAERadioTrackManager::DisplayRadioStationName` (reversed) now draws
  the station for 2.5 s at the top centre, in the menu font and HUD gold
  (144, 98, 16) with a black edge, only while the player is in a vehicle. It
  also shows on getting into a car, as starting the radio does in the
  original.
- Known differences: the menu font is replaced by Arial Black, and the grey
  shown while stations scroll by is not drawn, as the browser tunes one
  station per key press.
- Verification: the HUD names browser test checks the station shows on
  getting in, in gold, hides after 2.5 s and changes on the radio key.

## Prompt-line messages

- Four prompt-line messages with no counterpart in the original are gone:
  - the camera mode name on V;
  - the crew join, full and dismiss lines on G, where the recruit still
    answers with a line;
  - "… picked up" for a dropped gun, where the pickup sound remains;
  - "There is not enough room to stand."
- Still shown, and still not in the original: the browser activity rewards,
  save-point and asset-error messages, and the plane, boat and bike hints.

## Skidmarks

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.

- `CSkidmarks` and `CSkidmark` (Skidmarks.cpp, Skidmark.cpp) are fully
  reversed and ported in `render/nativeSkidmarks.ts`:
  - 32 marks, each a strip of up to 15 segments behind one wheel.
  - A point is added at most every 100 ms; in between, the newest point
    follows the wheel.
  - A mark not continued in a frame fades: over 2.5 to 5 s with fewer than
    four segments, 10 to 20 s from nine, and 5 to 10 s in between.
  - When all 32 marks are in use, a new wheel takes the oldest mark that is
    off screen.
  - Colours by surface: black, sandy (45, 31, 4), muddy (69, 69, 61) and
    bloody (32, 0, 0). They dim to 0.4 at night with the building
    day-night balance, and are drawn at half alpha. The first point, and the
    last point of a fading mark, are transparent.
  - `Render` draws each segment 0.1 above the contact points with the
    `particleskid` raster from particle.txd. The texture's V runs 5.01 per
    point. Z writes are off and fog is on.
- Which wheels lay marks is decided in `CAutomobile::PreRender` and
  `CVehicle::AddSingleWheelParticles`, both retail stubs. The browser
  follows their Vice City ancestor (reVC `CAutomobile::PreRender`). A wheel
  on the ground and off water lays a mark:
  - while it spins or is locked;
  - while it skids, if it is a rear wheel or a rear wheel is skidding;
  - in any state, on a muddy surface (SURFINFO.DAT's skidmark column) or
    with blood on the tyre.
  Marks follow each wheel's suspension contact point.
- Known differences:
  - The reversed `CSkidmark::Update` adds the fade times to the old values
    (`m_fadeBeginMs += now + low`). Vice City assigns them, and so does the
    browser.
  - The mark width comes from the stubbed caller. The browser uses Vice
    City's half-width of 0.125 × (1 + |turn|), which is SA's formula with a
    length of 0.25.
  - `Render` sets only the raster, so the filter comes from the
    surrounding render state. The browser samples linearly with wrapping.
  - Bloody tyres: `CPed::DeadPedMakesTyresBloody` is reversed, but its
    per-vehicle half, `MakeTyresMuddySectorList`, is a stub. The browser
    follows reVC's version, called for every dead ped each step
    (`simulation/nativeTyreBlood.ts`). A grounded, clean wheel turns bloody
    when:
    - the car is within 10 units on each ground axis and moving faster
      than √0.05 units per frame (about 11.2 m/s);
    - the wheel's approximate position, a corner of the collision box at
      the car's height, is within 1 unit of the body across the ground and
      2 units vertically.
    A car heavier than 500 also gets an upward ApplyMoveForce of
    50 × min(1, 70 / 1000) and an ApplyTurnForce of 50 × min(1, 100 / 2000)
    at the wheel. The bloody wheel then lays a red trail until its mark
    passes eight segments. The splatter sound and pad shake are not
    reproduced, and bikes do not pick up blood.
- The previous browser marks were authored: quads every 0.35 m, 40 s fades
  and 600 quads, laid only on DEFAULT surfaces.
- Verification: unit tests cover the point cadence, widths, fade times,
  colours, part alpha, blood trails, slot reuse, the wheel rule and the
  drawn strips. A browser test launches the Greenwood and stops it with the
  handbrake: the rear wheels lay textured marks. Unit tests cover the blood
  rule. A browser test drives over a body above the speed threshold, which
  starts a bloody mark.

## Traffic driving

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.

- SA's `CCarCtrl::SteerAICarWithPhysicsFollowPath`, `PickNextNodeRandomly`,
  `FindMaximumSpeedForThisCarInTraffic`, `SlowCarDownForOtherCar` and
  `TestCollisionBetween2MovingRects` are retail stubs. Ambient traffic now
  follows their Vice City ancestors (reVC CarCtrl.cpp), ported in
  `vehicle/nativeCarCtrl.ts`:
  - Each car keeps a CAutoPilot-style route: the link it is heading for,
    the one after, and a lane on each.
  - It steers at a point 0.4 of the way back from its lane point towards
    the car, within `FindMaxSteerAngle`. Above 0.45 units per frame the
    steer is capped at 0.2.
  - Speed follows the cruise speed, lowered by the heading error, by the
    turn onto the next link within 40 units, by any vehicle ahead in the
    14-unit scan box, and by pedestrians it is due to reach within 4 s.
  - At a node it picks the next link at random, as `PickNextNodeRandomly`
    does. The first pass keeps to turns the lane allows and avoids U-turns,
    dead ends, switched-off roads and wrong-way roads. Later passes relax
    those rules, and a U-turn is the last resort. A car moves a lane over
    one time in four on segments of 14 units or more.
- SA pieces used where they are known:
  - `FindMaxSteerAngle` (0x427FE0, reversed).
  - A lane width of 5.4: SA's `CCarPathLink::OneWayLaneOffset` divides the
    path width by 16 × 5.4.
  - SA navigation links, with the lanes a car may use in its direction of
    travel as `DoPathSearch` reads them.
  - `CTrafficLights::ShouldCarStopForLight` over the current, next and
    previous links.
  - `CCarAI::MakeWayForCarWithSiren` (0x41D660, reversed): cars faster than
    about 11 m/s ahead of a siren swerve and stop for 2.5 s, and others
    heading towards it wait 2 or 4 s.
- Cruise speeds follow Vice City's `GenerateOneRandomCar`, by the model's
  VEHICLES.IDE class. They are 9 to 14 CarAI units (60 × units per frame,
  about 7.5 to 11.7 m/s), 12 to 18 for executive cars and 7 to 10 for poor
  ones. Big or long vehicles take three quarters. Traffic used to drive at an
  authored 5.5 m/s.
- AI cars now set their steer angle, gas, brake and handbrake directly, as
  `SteerAICarWithPhysics` writes them. They used to go through the player's
  smoothed pad input.
- Known differences:
  - The two-way lane offset of half a lane is Vice City's rule, because
    SA's `OneWayLaneOffset` (0x44DB00) is not reversed.
  - `TEMPACT_SWIRVELEFT_STOP` is SA-only. It follows Vice City's swerve
    (a steer of −0.15, straightening over the last second) and brakes at
    0.5.
  - Vice City's `SlowCarDownForOtherCar` accepts every proximity below 1.5,
    and the test never exceeds 1, so any vehicle ahead in the scan box caps
    the speed at 62 % of cruise. This is kept.
  - Weaving through traffic (`FindAngleToWeaveThroughTraffic`) and the
    15-second standoff rule are not ported.
- Police cars steer with the same port.
  - Far-away chases (`MISSION_RAMPLAYER_FARAWAY`) follow their route with
    `SteerAICarWithPhysicsFollowPath` as avoid-cars drivers, so traffic and
    lights do not slow them. A patrolling unit stops for lights.
  - Close pursuit (`MISSION_RAMPLAYER_CLOSE`) uses
    `SteerAICarWithPhysicsHeadingForTarget`, with the seeded ramming target.
    A unit on an odd seed that runs with the player's car lines up beside it
    and turns into it (`TEMPACT_TURNLEFT/RIGHT`, 250 ms). Others aim up to
    0.8 units to one side. The handbrake is pulled for turns sharper than
    0.7 rad above 0.3 units per frame.
  - This replaces the authored look-ahead steering and corner speeds. The
    route itself is still the browser's A* search to the node nearest the
    player (`PickNextNodeToChaseCar`'s `DoPathSearch` stands behind it).
- Jams follow `CCarAI::UpdateCarAI` (reversed).
  - A car that has moved under 0.012 units per frame for
    500 × (seed mod 16) + 40 ms, while touching something, reverses for
    750 ms with its steer mirrored. It turns to `DRIVINGSTYLE_AVOID_CARS`,
    which ignores traffic and lights, and sounds its horn.
  - One car in eight that has not moved faster than 0.05 units per frame for
    30 s does the same with a 400 ms reverse.
  - The decompiled test lists exactly the missions Vice City exclude, so it
    is taken as inverted, as the police port already does. Read literally,
    stationary mission cars would reverse, and cruising cars never would.
  - Beyond the physics radius (100 units, with 5 of hysteresis) traffic drives
    on rails (`STATUS_SIMPLE`) instead of freezing. SA's `UpdateCarOnRails` is
    a stub, so this is Vice City's:
    - The car follows `CCurves::CalcCurvePoint` (reversed) from one link's
      lane point to the next, with `GetRandomOffsetForVehicle`'s skew.
    - The curve takes `CalcSpeedScaleFactor` × 1000 / `m_fMaxTrafficSpeed`
      ms.
    - `SlowCarOnRailsDownForTrafficAndLights` eases that speed toward the
      traffic limit by 0.05 up and 0.7 down per TimeStep, or to 0 at a red
      light. `ModifySpeed` re-times the curve, keeping the car's place on it.
    - `DragCarToPoint` puts the nose on the point and the tail 3 back, each
      on the ground below, and pitches the car between them.
    - The original switches a simple car to physics on events (a collision,
      a U-turn, a long jam, a burst tyre). The browser uses distance
      instead, because its nearby traffic always runs physics.
      - A car leaving physics first curves from where it is to the link it
        was heading for. Coming back, it heads for the next link at the
        rails speed.
    - The rails speed reads CarAI speed units as units per second (VC's
      timing), a little faster than physics cruising.
  - Traffic sees vehicles and pedestrians only: a static obstacle is driven
    into, as in the original. The authored recovery still removes a car
    stalled off screen.
- Verification: unit tests cover lane points, the steering and speed rules,
  the node choice, the slow-downs, cruise speeds and the siren yield.
  Browser tests cover lane keeping, stopping behind a parked car, slowing
  and honking for a pedestrian, the siren swerve, and the Grove Street and
  native-road traffic. A live run shows cars holding their lanes at their
  class cruise speeds and stopping at lights.

## Police set pieces

- The INITIAL mission's 209 `ADD_SET_PIECE` commands are read from
  main.scm into `CSetPieces` (reversed). Each is a 2D area and two spawn
  and target points.
- `CSetPieces::Update` checks an eighth of them each 30 fps frame.
  `CSetPiece::Update` acts while the player stands in a piece's area, at
  most every 4 s after it last generated.
  - Two slow or medium cars (cruise 4 or 24) come for a wanted player on
    foot with `MISSION_SLOWLY_DRIVE_TOWARDS_PLAYER_1`. Both must generate.
  - Quick cars (cruise 16) need two stars and a vehicle, and only generate
    while the player moves toward their spawn point. They start at 2/3
    units a frame with `TEMPACT_GOFORWARD` for 100 ms, then block or ram.
  - One or two cops on foot come for a wanted player on foot.
- `TryToGenerateCopCar` puts the level's default cop car on the ground at
  the spawn point, facing its target, with the usual crew.
  - `_1` heads for the destination and becomes `_2` within 1.5 units.
    `_2`'s crew leaves the car and it stops for good once the player is
    within 13 or beyond 70, or no longer wanted.
  - That mission's steering is in the unreversed `SteerAICarWithPhysics`.
    The cars drive straight at the destination, then at the player.
  - `BLOCKPLAYER_FORWARDANDBACK` steering is unreversed too, so those cars
    ram like `RAMPLAYER_CLOSE`.
- Cops on foot are the level's default cop with a pistol, on the ground at
  the spawn point, facing the target. `CTaskComplexBeCop`'s run to the
  target first is not ported; they join the pursuit where they stand.
- gta-reversed's conditions for the cop pieces and the two-quick-car pieces
  (`wanted < 1 && vehicle`) would send police at a player with no stars.
  The one-car pieces' `||` is read for them too.
- Verification: unit tests cover each type's conditions, the 4 s hold, the
  frame slicing and the retail count. A browser test stands a one-star
  player in the set piece west of Grove Street and sees its two cops
  arrive.

- Set-piece cops (2026-09-20): `CSetPiece::TryToGenerateCopPed` gives the cop `CTaskComplexBeCop` with a
  `CTaskComplexGoToPointAndStandStill` (run, radius 0.5) to its target; `CTaskComplexWanderCop` runs that go-to only
  while `ShouldPursuePlayer` is false (a clean wanted level), otherwise the pursuit starts at once. The browser now
  sends a cop spawned at wanted level 0 running to its target (`sendOfficer` with an arrival radius), then it stands
  and wanders as a cop; at any wanted level it joins the pursuit where it stands, as before. `CWanted::
  CanCopJoinPursuit` is not ported.

## Police reaching a player on foot

- Grove Street's only car entrance is its west end, so a unit spawned north or
  east of CJ's house has a road route of about 600 units. The browser was
  routing correctly. Units stalled because they overshot a corner at the three-star
  chase speed (`FindPoliceCarSpeedForWantedLevel`, reversed), landed below the
  road, and kept aiming at the same node.
- The route's goal is the node `FindNodeClosestToCoors` would pick. The metric is
  |dx| + |dy| + 3|dz|, as in SA's reversed `FindNodeClosestToCoorsFavourDirection`
  and in Vice City. Before, it was plain 3D distance.
- A unit thrown off its link rejoins the road where it is, by Vice City's
  `JoinCarWithRoadSystem` with SA's reversed
  `FindNodeClosestToCoorsFavourDirection` (a node behind costs up to 40 more).
  Off its link means 12 across it, 3 above or below it, or stuck through two
  recoveries. It then routes again from there. Before, it drove straight at the
  player into walls. When to rejoin is the browser's, because SA's chase
  steering is a stub.
- Measured at two stars in Grove Street, three runs each: the first unit came
  close about 8 s sooner, and a cop reached CJ on foot within about a minute.
- Porting Vice City's placement (`GenerateCarCreationCoors`: 110 ahead within
  45°, or 40 to the side) made it worse. Units spawned ahead took the long route
  and were removed past 220. SA's `GenerateOneRandomCar` is a stub, so the
  browser keeps its 60–110 ring.
- SA's foot cops come from the stubbed `CPopulation::AddToPopulation`, and Vice
  City spawns no cop cars at one star. Neither is ported.

## Crimes against pedestrians

- `CCrime::ReportCrime` (Crime.cpp) returns unless the player committed the
  crime. A ped punching the player no longer files `CRIME_DAMAGED_PED`
  against him; the browser used to, so street fights started by hotheads or
  rival gangs built chaos toward a star.
- The victim's ped type goes through
  `CPedType::PoliceDontCareAboutCrimesAgainstPedType`: gangs 1–10, CRIMINAL
  and DEALER, from peds.ide. `CWanted::ReportCrimeNow` divides the chaos by
  3 for those victims. Punches, gunfire, stealth kills and run-overs now pass
  the flag.

## Cash from dead pedestrians

- CPed's constructor (Ped.cpp, reversed) sets `m_nMoneyCount`: 400 with a 3%
  chance, 20–69 for models in pedgrp.dat's POPCYCLE_GROUP_BUSINESS and
  CASUAL_RICH lines, otherwise 0–24.
- `CPed::CreateDeadPedMoney` (0x4590F0) drops the count when it is over 10,
  except from cops, medics, firemen and peds in vehicles. Its caller is a stub;
  the Vice City ancestor calls it as the ped dies, next to the weapon drop, and
  so does the browser.
- `CPickups::CreateSomeMoney` makes min(amount / 20 + 1, 7) wads of
  amount / wads + 0–3. Each wad steps 1.5 × the sine and the cosine of two
  separate random angles from the last and sits 0.5 above the ground. The
  model is `Money` (dyn_cash, ID 1212).
- `CPickup::Update` hands a wad to the living player on foot within √1.8
  across the ground and 2 vertically, with AE_FRONTEND_PICKUP_MONEY.
  `GenerateNewOne` is a stub; the Vice City ancestor times PICKUP_MONEY out
  after 30 s. `CTX_GLOBAL_PICKUP_CASH` is not spoken (no speech banks).

## Gun aiming and firing on foot

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.

- The PC's default control method is mouse and keys, which sets
  `CCamera::m_bUseMouse3rdPerson` (MenuManager.cpp). With it set,
  `CTaskSimplePlayerOnFoot::ProcessPlayerWeapon` clears any gun target every
  frame. It also drops a lock when that flag is set, and target shifting
  requires it to be off. So shots go along the crosshair: no lock-on, no chest
  bend, no Q/E cycling.
- The ped or vehicle the crosshair ray meets first, within the weapon range,
  stands in for `m_p3rdPersonMouseTarget`. `Compute3rdPersonMouseTarget` is a
  stub. It feeds the crosshair indicator and CEventGunAimedAt. The original
  raises that event only on a locked target, so raising it from the mouse
  target is an assumption.
- `CPad::GetWeapon` is the held button, so every gun keeps firing at its own
  rate while it is down. Before, the pistols, Desert Eagle, shotguns, country
  rifle and sniper needed a click per shot.
- Firing requires `m_nMoveState != PEDMOVE_SPRINT`, and sprinting drops the aim
  of any non-melee weapon.
- The joypad lock-on model (`weapons/nativeLockOn.ts`, with authored priority
  weights) is removed.
- Moving while aiming follows `CTaskSimpleUseGun` (TaskSimpleUseGun.cpp,
  reversed), in `animation/nativeGunMoveAnims.ts`:
  - `PlayerControlZeldaWeapon` gives `ControlGunMove` the stick / 128.
    `m_MoveCmd` slews by 0.07 × TimeStep.
  - `SetMoveAnim` plays GunMove_FWD/BWD/L/R from ped.ifp. The blends are the
    command's share of |x| + |y| as Gun_stand fades by 0.16 × TimeStep. They
    play at weapon.dat's move speed × |command|. The clips are synchronised
    and extract velocity, so the player strafes at their weighted root
    travel.
  - Weapons aimed with the arm (pistol, sawn-off, SMGs) blend the dominant
    direction's clip instead.
  - While firing a weapon without bMoveFire, the player stands still, and he
    cannot fire until `m_MoveCmd` settles.
  - Without bMoveAim, the aim pose drops while moving. weapon.dat's POOR rows
    of the AK, M4, MP5, Desert Eagle, shotgun and silenced pistol have
    neither flag; STD adds bMoveAim and PRO bMoveFire.
  - The original clears `m_MoveCmd` under its 0.1 threshold, which stalls
    it at high frame rates. At the PC's 30 fps one slew already clears the
    threshold, so the browser does not clear it.
  - Before, the aiming player slid at the running move blend's speed while
    playing the forward run.
- `DoBulletImpact`'s 150-point player shot within one unit spares only the
  shotgun and SPAS-12, so the sawn-off gets it.
- The spread is the reversed `GetWeaponRadiusOnScreen` circle. The authored
  multipliers are gone: skill practice × 0.25, which counted skill twice
  over weapon.dat's skill rows, crouch × 1.4 and moving × 0.6.
- SA has no reload control: `CWeapon::Fire` reloads when a clip runs out. The
  R key no longer reloads.
- Pistol whip: `CTaskSimpleUseGun::RequirePistolWhip` (0x61E200, reversed)
  turns firing an instant-hit or area gun into GUN_BUTT (GUN_BUTT_crouch
  ducked) from ped.ifp's pistlwhp group. It takes a living ped within 1 unit
  across the ground, in front within 30° of the heading, whose head is between
  the player's position and 1.5 above it, and not floored. It is not taken
  twice in a row. melee.dat's PISTOL_WHIP row lands 10 on frame 7. The victim
  plays HitA_2 through the ported ComputeAnim: ComputeDamageAnim takes CTaskSimpleFight::m_aComboData[0]'s group
  (UNARMED_1) with ANIM_ID_FIGHT_HIT_2, not the pistlwhp group's HIT_GUN_BUTT. No round is spent.
  - The browser places the victim's head 0.75 above its body centre instead of
    reading the head bone.
- The crosshair sits where `CCamera::m_f3rdPersonCHairMultX/Y` put it: 0.53 of
  the width and 0.4 of the height. `CHud::DrawCrossHairs` sizes it at
  64 × `GetWeaponRadiusOnScreen` in the 640 × 448 frame, with a dot only at
  the 0.2 minimum. `Find3rdPersonCamTargetVector` fires through that point.
  The first-person weapons aim down the middle (see below).
  - It is drawn from hud.txd's siteM16 raster, four quarters mirrored. It shows
    only in the aim camera, for the pistols through the country rifle, the
    flamethrower and the minigun, as `CHud::DrawCrossHairs` has it. Melee,
    throwables and sprays get no crosshair.
  - The authored green "locked" tint is gone.
- Holding the target button blocks jumping. `PlayerControlZelda` jumps only
  while `GetTarget` is off, and `PlayerControlZeldaWeapon` never jumps.

## Bullet traces

- Bullet lines draw as `CBulletTraces` (reversed) instead of the earlier
  authored full-length lines.
  - Each shot's `AddTrace` wrapper takes a 2 to 5 unit piece at a random
    point of the line, 0.01 wide, for 300 ms at alpha 70. Of the 16 slots,
    the 6th to 10th live half as long and the rest a quarter.
  - Aircraft guns take `FireOneInstantHitRound`'s streak: the whole line,
    0.02 wide, 750 ms at alpha 150.
  - The player's shots in the first-person modes leave none while he moves
    under 0.05 units a frame.
- `Render` shrinks each streak toward its end as it ages. It is pale yellow
  and opaque only at the end, alpha blended without depth writes.
- A trace crossing the camera plane within 2 units reports a bullet-pass
  event on its side and end (`PlayFrontEndSoundForTrace`). The frontend
  entity's bullet-pass cases are ported: a random whizz at most every 5
  frames, and the bank rotates after 10.
  - The four GENRL bullet-pass banks are not in the packaged audio yet, so
    the whizz stays silent until they are published.
- Verification: unit tests cover slot lifetimes, the streak shape, fading
  and the pass test. A browser test fires an M4 burst and sees the traces
  appear and clear.
- Thrown grenades and molotovs trail `CMotionBlurStreaks` ribbons
  (reversed), registered from `CEntity::PreRender`.
  - They show while the projectile moves over 0.03 units a frame in 2D (a
    molotov only above water). Each is 0.14 wide across the camera's right,
    joining the last three 30 fps frames.
  - Grenades are grey (100, 100, 100), molotovs orange (255, 160, 100). The
    newest edge has a third of the alpha and older ones less. Fogged, alpha
    blended, without depth writes.
  - `CSpecialFX::AddWeaponStreak`, for bats, clubs and katanas, is unused in
    the original, so melee swings leave none.
  - A unit test covers the history and fades; a browser test throws a
    grenade and sees its streak.

## First-person weapons

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 and the Vice City
ancestor (reVC), in `weapons/nativeFirstPerson.ts`.

- weapon.dat's b1stPerson flag (0x4) marks the sniper rifle, both rocket
  launchers and the camera. Aiming one puts the camera in its weapon mode, as
  `ProcessPlayerWeapon` does on the target button.
  - Outside that mode these weapons get only `PlayerPassiveControlGun`.
    `FireSniper`, `FireProjectile` and the camera's fire refuse the player, so
    they cannot fire from the hip.
  - Releasing the button leaves the mode. SA's code for that is a stub; VC's
    `PlayerControlSniper` does it.
  - The ped turns with the camera. Jumping is refused. The walk keys strafe on
    the GunMove clips, because with a mouse
    `CPad::GetPedWalkUpDown(ped)` reads the left stick.
  - Weapon cycling is ignored in these modes (VC `ProcessWeaponSwitch`; SA's
    is a stub).
- Cameras:
  - Rockets follow `CCam::Process_Rocket` (0x511B50, reversed): FOV 70, the
    head bone plus 0.1 up, `ClipAlpha`'s −85.5° to 60°, and a 0.15 near
    plane.
  - The sniper rifle and camera: SA's `Process_M16_1stPerson` is a stub, so
    they follow VC's `Process_Sniper`. The head plus 0.1 up, 0.19 behind it
    (0.5 behind and 0.18 left ducked), −89.5° to 60°.
  - The zoom starts at 70. A wheel notch (PED_SNIPER_ZOOM_IN on wheel up)
    sets the target 10 from the current FOV. `WellBufferMe(0.5, 0.25)` eases
    toward it while it is more than 0.5 off. PgUp/PgDn (and X/Z) scale the FOV
    by (255 × TimeStep + 10000) / 10000 a frame. The FOV stays within 15 to 70,
    or 3 to 70 for the camera.
  - Mouse look turns 3 × m_fMouseAccelHorzntl and 4 × m_fMouseAccelVertical
    per count × FOV / 80. VC's third-person mouse camera uses 2.5 and 4 at FOV
    70, so first person turns 1.2 × FOV / 70 and FOV / 70 of the browser's
    third-person rates.
  - The camera weapon's snapshot range, 90 / FOV × 20, uses this FOV.
- The sniper fires `CWeapon::FireSniper` (0x73AAC0). It adds a
  `CBulletInfo` bullet (BulletInfo.cpp, reversed) from the camera along its
  front at 16 units a frame, with the STD row's damage (125), plus a
  FIRE_WEAPON crime and a gunshot event. The instant-hit line, the spread and
  the 100-unit weapon range do not apply.
  - `CBulletInfo::Update` moves it velocity × TimeStep / 2 a frame
    (400 m/s) for a second. The first thing on each frame's stretch takes the
    hit: a ped's damage event, a car's damage or a burst tyre, an object's or
    building's impact.
  - The bullet flies on through what it hit. The original restarts the line
    on the ped's surface; here that ped is skipped from then on.
  - At most eight bullets fly at once.
  - The dead-ped FLOOR_HIT, the pad shake and `CamShakeNoPos(0.2)` are not
    reproduced.
- The player's rocket starts one unit along the camera's front
  (`FireProjectile`) and flies along it.
  - `CProjectileInfo::AddProjectile` is a stub, so the homing flight stays
    authored.
- The heat seeker's lock follows the reversed code
  (`src/weapons/nativeHeatSeeker.ts`):
  - `PickTargetForHeatSeekingMissile` rates each living vehicle from five
    units along the aim: `sqrt(distance) / 10` plus its distance off the line
    over its distance.
    - A vehicle off the line by more than its distance / 1.2 (about 56°) is
      rejected.
    - The last target's rating is quartered, so the lock holds.
  - `CCam::Process_Rocket` re-picks each frame. Once a second it tests a line
    of sight from CJ through buildings, vehicles and objects, but not peds.
    - The lock timer restarts whenever the target changes or is out of sight.
    - After 1.5 s the crosshair turns red.
  - `FireProjectile` homes only once `CWeaponEffects::IsLockedOn`, which
    reads the red crosshair's rotation. It then picks again from CJ's
    position along his heading. Before the lock, or with nothing picked, it
    fires a plain rocket.
  - This replaces an authored rule: the nearest car inside about 20°, picked
    at launch.
  - Boats, bikes and aircraft can be targets now, and homing follows them.
  - The `MarkTarget` sprite (particle.txd `target256`) is not drawn, because
    `CWeaponEffects::Render` is a stub.
- `CHud::DrawCrossHairs` draws the sniper and camera from the weapon TXD's
  CROSSHAIR raster (SNIPERcrosshair, cameraCrosshair) four times, mirrored into
  each quarter. The quarters span 210 × 210 (the camera 256 × 192) of the
  640 × 448 frame around the centre. The rest of the HUD draws over them.
  - The rocket's siterocket, from hud.txd, draws as four 24 × 24 quarters 20
    from the centre.
- The camera projection was being overwritten each frame with a 70°
  *vertical* FOV. The ported `CameraSize` branch that gives the source FOV to
  the wider axis applies again: 70 across a landscape window. The aimed third
  person camera's 52 stays authored, since `Process_AimWeapon` and
  `Process_FollowPedWithMouse` are stubs. The sun, stars and coronas scale by
  the current FOV.

## Adrenaline pills

- An adrenaline pickup used to vanish without effect. It now follows
  `CPickups::GivePlayerGoodiesWithPickUpMI` (reversed): `m_bAdrenaline` for
  20 s and a full sprint (`ResetSprintEnergy`).
  - While it lasts, a sprint spends no stamina (`CPlayerPed::HandleSprintEnergy`).
  - CJ's blows use `ComputeDamageAnim`'s adrenaline branch: five times the
    knockback, at strength 2.
  - Respawning clears it.
- The time scale adrenaline sets (which `ClearAdrenaline` resets) is not in the
  reversed `CPlayerPed::ProcessControl`. It is most likely in the stubbed
  `CPlayerInfo::Process`, so the game does not slow.

## Street lights and coronas

- DFF geometries' 2d effects (plugin 0x253F2F8) are read as
  `t2dEffectPluginStreamRead` lays them out. gta3.img has 1,022 lights,
  793 ped attractors, 14,908 cover points, 489 road signs, 78 entry exits,
  45 particles and 5 escalators.
- `CEntity::ProcessLightsForEntity` (reversed) runs each frame for placements
  whose models carry lights, if the renderer holds them in range.
  - That is the LOD choice, whether or not on screen, like CRenderer's
    visible and in-range lists.
  - Day, night and both-time lights fade with `GetDayNightBalance`.
  - The random, rain-only, anim-speed, blinking and check-direction modes
    follow the reversed code.
  - The brightness is `m_fSpriteBrightness` (timecyc ×10) × the flash
    fade / 10.
  - Tipped objects (up.z < 0.96) stay dark.
  - For the 5-on-5-off modes, gta-reversed's
    `9 * (offset % 10000 / 10000)` is always 0 in integers. The 1,111 ms
    phases show the intended `9 * (offset % 10000) / 10000`, which is used.
- `CCoronas` and `CRegisteredCorona` (reversed) keep 64 slots.
  - Coronas are registered each frame and fade at 15 a frame toward their
    intensity, or out when off screen, occluded by buildings or unregistered.
  - The look-change brightening applies. Only-long-distance lights show
    from 50 units.
- `CCoronas::Render` draws each as a `coronastar` sprite, additive and
  depth-tested.
  - It is pulled toward the camera by its near clip, faded from half its far
    clip and stretched by fog, sized as `CSprite::CalcScreenCoors` gives it.
- The bundled start scene was packaged without 2d effects. The world worker
  reads its models' effects from gta3.img instead of the package being
  republished.
- Each lit effect with a shadow size leaves an additive `shad_exp` light
  pool, drawn as `CShadows::RenderStaticShadows` (reversed) draws static
  shadows.
  - Blending is ONE/ONE, raised 0.06, with no fog and no lighting.
  - The colour is the light's × its shadow multiplier × the flash fade.
  - It uses the near-clip depth bias RenderScene gives static shadows.
  - `StoreStaticShadow` and `GeneratePolysForStaticShadow` are stubs. The
    square is projected down onto collision within the light's z distance
    (15 by default), cached per light, and drawn within 40 units, the draw
    distance passed.
- Traffic lights follow `CTrafficLights::DisplayActualLight` (reversed), run
  from `CEntity::PreRender` for the nine traffic-light models.
  - The pole's forward picks the north-south or west-east visual phase
    (`FindTrafficLightType`). Only the lamps on the side facing the camera
    light up.
  - Coronas are sprite brightness × 0.07 and sprite size × 0.175, within 50
    units, by day and night.
  - A pool of the lit colour lies below when `TrafficLightsBrightness`
    exceeds 0.05.
  - `aTrafficLightColoursR/G/B` are exe data gta-reversed only references,
    so each lamp's own 2d effect colour stands in.
  - The lit lamp's lens is a `CBrightLights` light (reversed), up to 32
    within 60 units. It is a hexagon at half alpha, or an octagon for the
    five small-lens models. Its colour is the phase's with a random flicker,
    fading from 45 units. It is untextured, alpha blended and unfogged.
    `m_fLODDistMultiplier` is taken as 1.
- Particle 2d effects follow `CEntity::CreateEffects` (reversed): each one
  plays `Fx_c::CreateEntityFx`'s FX system at the effect position under the
  placement's modelling matrix, created regardless of its bounds.
  - The game creates them with the entity's RwObject and kills them with it
    (`DetachFromRwObject`). Here they live as long as the installed scene
    that holds the placement. `FxSystem_c`'s cull distance still stops
    far systems emitting.
  - Props smashed or moved after the scene installs keep their effect at the
    placed position.
- The sun's sea reflection follows `CCoronas::RenderSunReflection`
  (reversed).
  - A strip of `coronaheadlightline` runs from 40 units toward the sun to
    about 1.4 km, 0.1 units above sea level (raised by the wind). It
    shimmers with 20 widths on a 2048 ms cycle.
  - Its colour is a quarter of the sun core plus corona. It peaks with the
    sun a quarter up and is scaled down by cloud, fog and wind. It fades out
    within 350 units of five sea-level shores, among them Ganton's canal.
  - It is drawn additive, depth-tested and unfogged, before the water.
    `CWaterLevel::RenderWater` is unreversed, so the water drawn over it is
    this port's.
- Wet roads reflect coronas, following `CCoronas::RenderReflections`
  (reversed).
  - While `WetRoads` is above 0, each corona registered with a reflection
    finds the ground under it. Slots re-probe one frame in 16.
    `CWorld::FindGroundZFor3DCoord` tests buildings and dummies only.
    Here the probe skips both the dummies and the objects: the lamps within
    reach are objects by then, and a probe starting inside one would stop
    at once.
  - A corona under 20 units above that ground, with the camera above the
    ground, gets a `coronareflect` sprite. It sits at the corona mirrored
    through the ground, 0.75 × 2 of the corona's size.
  - Its colour is the corona's × WetRoads × the distance fade × (1 − h / 20)
    × 230 / 256, at intensity 128. Its far clip is ¾ of the corona's, at most
    55.
  - It is drawn additive, unfogged and not depth tested, right after the
    road models (IDE flag 1), so all later geometry covers it. Roads come
    first in the opaque pass here for that reason.
  - gta-reversed compares the valid-height flag rather than the height with
    20, and checks neither the slot's id nor its reflection flag. Its
    re-probe test misreads the operator precedence. The intended checks
    are used.
- The sun's lens flare follows `CCoronas::Render`'s flare pass (reversed).
  - `SunFlareDef`'s 26 `coronastar` sprites are strung along the line from the
    screen centre through the sun's corona (id 2), each at its own fraction of
    that line and four times its listed size in raster pixels.
  - Each sprite's colour is the corona's byte × a random 0.7 to 1 of its faded
    intensity × its own multiplier (int16 / 65535), then × 255 / 256 for the
    sprite intensity. They are additive, unfogged and drawn without depth,
    right after the coronas.
  - `CWorld::ProcessLineOfSight` from the corona to the camera takes the flare
    away when a vehicle or ped stands in the line. Buildings are not tested
    here: they fade the corona itself, which the flare is scaled by.
  - The sizes are in raster pixels, so they follow the drawing buffer as the
    original follows the screen resolution.
  - `HeadLightsFlareDef` is ported with it, for the unreversed vehicle lights.
    None of gta3.img's 1,022 2d effect lights asks for a flare.
- Not ported:
  - point lights (`CPointLights`);
  - pole shadows (`StoreShadowForPole`);
  - the headlight flares and their `HeadLightsSpectrum` pass, with the
    vehicle lights they belong to.
- Verification: unit tests cover the plugin reader against lamppost1 and
  trafficlight1, the corona fades and the light rules. A browser test sees
  Grove Street's lamps dark at noon and, at 23:00, glowing orange with their
  pools drawn. It also sees Grove's `insects` particle effects running.
  Unit tests cover the bright-light shapes, fading and flicker, and the
  sun strip's geometry and fades. A browser test reads the lit lens colour
  of a Ganton signal at night. A unit test covers the reflection selection
  and the re-probe cadence. In the browser, the rainy-weather cheat wets
  Grove Street's road and its lamps draw reflections. A unit test covers the
  flare tables and colours; a browser test looks up at the morning sun, sees
  all 26 sprites and reads the warm light one of them adds.

## Cheats

- Typed PC codes follow `CCheat::AddToCheatString` (reversed). The newest
  letter goes first, the latest 6 to 29 letters are hashed with
  `CKeyGen::GetKey`, and the last table entry matching wins.
  - A cheat that was on reports CHEAT8 ("Cheat deactivated"), otherwise
    CHEAT1. `STAT_TIMES_CHEATED` counts them.
  - The text shows on the prompt line; the help box is not ported.
  - The M key opens this port's map, which keeps listening to letters
    because the original has no such overlay.
- The hash table is `m_aCheatHashKeys` as gta-reversed lists it, re-paired.
  - Its hash column loses the GangLand and Midnight hashes and slips one,
    then two rows. Every later hash was matched to its cheat by hashing the
    published PC code; 47 are checked in the tests.
  - The Rancher's JQNTDMH hashes to 0, the value its row holds.
  - Left out: aggressive drivers (hash lost), prostitutes pay and taxi nitro
    (pushed off the table), and cars on water and the unused Predator (their
    listed 0 would take JQNTDMH).
- Effects follow the reversed cheat functions and the places the original
  reads `CCheat::IsActive`.
  - Weapon sets 1 to 3.
  - HESOYAM: $250,000, full armour and health, and the player's car at 1000
    health, fire out and `CAutomobile::Fix`.
  - Wanted level: +2 stars, clear, six stars, and AEZAKMI, which blocks
    `ReportCrimeNow` and `SetWantedLevel`.
  - Weather: `ForceWeatherNow` for sunny, extra sunny, cloudy, rainy,
    foggy and sandstorm. The storm is rainy with rain and wind at 1.
  - Clock and speed: the faster clock runs a game minute each 30 fps
    frame. Midnight and the orange sky stop the clock.
    - gta-reversed sets 21:00 when the orange sky turns off. It is set when
      it turns on, the behaviour players know.
    - Faster and slower gameplay double or halve the time scale between 0.25
      and 4. A stunt jump's slow motion resets it to 1, as `ResetTimeScale`
      does.
  - Traffic: green lights (`LightForCars1/2`), and black or pink paint
    (`ChooseVehicleColour`).
  - Player: infinite ammo (`CWeapon::Fire`), infinite oxygen
    (`HandlePlayerBreath`), and mega jump (the jump force × 10).
    - Mega punch: fists, knuckles and the parachute deal the victim's whole
      health. Its ×20 knockback is not ported.
    - Suicide is a 1,000-point unarmed hit.
    - Parachute, and adrenaline (the pill's 20 s; cleared when it turns off).
    - The drive-by cheat gives a Micro Uzi when the SMG slot is empty; its
      free aim is not ported.
    - Hitman level for weapons 22 to 32, and full driving skill.
  - Blowing up every car, bike, boat and aircraft.
  - Perfect handling feeds the ported traction and transmission cheat
    branches (traction × 4, `CHEAT_HANDLING_PERFECT`). Its boost jump
    (`BoostJumpControl`) is not ported.
  - Smash n boom blows up a car the player's vehicle damages
    (`CAutomobile::VehicleDamage`).
  - Float away turns off gravity for a vehicle the player's vehicle hits
    hard enough to damage it (`CPhysical::ApplyCollision`, which the
    original runs on any collision).
  - `VehicleDamage`'s Rhino rule is ported with it: a car the player's Rhino
    rams to 0 health blows up at once.
  - `VehicleCheat` sets the model down its bounding radius plus 2 ahead of
    CJ, across his path, abandoned. This covers the Rhino, Bloodring,
    Rancher, Hotring A and B, Romero, Stretch, Trashmaster, Caddy, Hydra,
    Hunter, Quad, Tanker (without its trailer), Dozer and Stunt plane.
    - The Vortex hovercraft and the Monster truck have no vehicle class
      here.
    - `ClearSpaceForMissionEntity` is not ported.
    - Six handling IDs were added from gta-reversed's `eHandlingId` for
      these cars.
- Cheats whose effect is not ported only toggle. These are the population
  themes (beach, funhouse, country, ninja, Elvis, gangs), riots, peds
  attacking, cars and boats flying, nitro, the bunny hop, infinite health
  (its checks are unreversed), never hungry, and recruit anyone.
  - Fat, muscle, skinny and max stamina do nothing yet.
- Verification: unit tests cover the codes, the toggle messages and the
  hooks for traffic, colours, wanted, ammo and oxygen. A browser test types
  HESOYAM, AEZAKMI, AIWPRTON, ZEIIVG twice and KANGAROO, and checks money,
  armour, stars, the Rhino, the toggle and the jump height. A second one
  rams a cheat-spawned Trashmaster under JCNRUAD and sees it wrecked.

## The jetpack

- ROCKETMAN (and the PS2 code YECGAA) runs `CCheat::JetpackCheat`, which gives
  the player `CTaskSimpleJetPack` (reversed) unless he already wears one. It
  is not a toggle.
- The task flies him on its own thrust, in native units a frame:
  - The nominal 0.8 lift always runs, halved while braking. Gravity is a full
    0.008, so a coasting pack cannot hold him up; the ground does, until the
    thrust lifts him.
  - The forward key leans the thrust toward 75° at `0.9 ^ TimeStep` and adds
    the 0.6 full thrust along it. At the full lean the lift only carries the
    flier, so height is won on the way into the lean and the flight runs on
    level: the climb comes from pulsing forward, as it does in the original.
  - The climb fades out a hundred units above the ground below and is gone by
    two hundred.
  - The side keys strafe at 0.3, their command gaining 0.1 a frame and losing
    the 0.05 it decays by, and the whole move speed is scaled by
    `(1 − speed × 0.02) ^ TimeStep` every frame, which settles the flight at
    about 24 metres a second.
  - The legs hang free: they swing with the velocity each frame adds, are
    pulled level by gravity and damp at 0.98, within 45°. `ApplyRollAndPitch`
    turns the thigh bones by that swing, about the bone's Z and Y.
  - The camera aims the flight (`m_bUseMouse3rdPerson`, the PC's default
    control method). With the pad the standing player's walk axes would steer
    him through a stick heading instead; on foot the walk still steers here.
    The hover brake is on the pad's look-behind button, which the PC's on-foot
    keys do not carry, so `m_ThrustStop` never engages.
  - `CTaskSimpleJetPack::ProcessAnims` blends the idle animation while the
    pack carries him, and leaves him to `SetRealMoveAnim` on the ground.
  - Standing still, the exit-vehicle key drops the pack, which
    `CPickups::GenerateNewOne` leaves behind as a PICKUP_ONCE_TIMEOUT_SLOW
    pickup. Walking into it hands the pack back
    (`GivePlayerGoodiesWithPickUpMI`, with the frontend info sound), and
    `CPickup::Update` refuses it to a player who already wears one.
    `GenerateNewOne` and `CreatePickupCoorsCloseToCoors` are unreversed, so the
    pickup goes two units in front of the player, clear of his reach, and gives
    up after five minutes.
  - `MakeAbortable` keeps the pack through damage: a dead flier still in the
    air spins out on it, thrust cut, the strafe hard over one way or the other
    and his heading wobbling on a 2 s sine, and only loses it once he is back
    on the ground. gta-reversed's
    `m_ThrustStrafe + CGeneral::DoCoinFlip() ? -1.f : 1.f` parses as
    `(strafe + flip) ? -1 : 1`, which would only ever hold ±1; the intended sum
    is used. A wasted or busted player loses the pack with the respawn.
- `RenderJetPack` draws the pack: gta3.img's `jetpack` clump rides the player's
  spine, and its two `jetball` frames swivel with the strafe command and the
  pitch the thrust angle gives, less ten times the heading he turned through.
  - The original hangs it off the ped's hierarchy matrix array at
    `PED_NODE_LEFT_ARM` (3), which lands on the Spine1 node rather than an arm.
    That node leans in this port's assembled player skeleton, which would tip
    the pack over, so it hangs off Spine (2) with the offset moved up the bone
    (0.3 rather than 0.1) to sit square on the back.
- `DoJetPackEffect` keeps a `jetpack` FX system on each jet ball, offset by
  0.15, at the key time the thrust fades in and out: blue under power and
  orange coasting. The original's `m_ThrustFwd != 0` test shows the blue flame
  while braking too, which is kept.
- Its audio (`CAEPedAudioEntity::TurnOnJetPack` and `UpdateJetPack`) is not
  ported.
- Verification: unit tests cover the control input, the thrust, the height
  fade, the leg swing and the flame's key time. A browser test types
  ROCKETMAN, sees the coasting pack hold the player down, pulses forward to
  climb and fly 20 metres, sees the pack worn with both flames burning, then
  brakes back to the ground, drops the pack and its flames and walks back into
  the pickup to wear it again. The dying flier's spin is covered by a unit
  test.

## Gang tags

- The world's 100 tags follow `CTagManager` (reversed). They are the IPL
  instances of IDE models flagged as tags (0x100000), gathered in load
  order as `CEntity::Add`'s `AddTag` does.
- Each tag model has two materials: the rival gang's tag, and CJ's Grove
  tag drawn at the tag's alpha. The alpha starts at 0 (`SetupAtomic`) and
  is restored whenever the scene reinstalls (`ResetAlpha`).
  - Before this port both drew at full alpha, so every tag showed the Grove
    tag from the start.
- Spray-can shots paint tags (`CWorld::SprayPaintWorld`). A shot reaching a
  tag within its range adds 8 alpha, up to 255, and is spent.
  - Finishing a tag plays the part-mission-complete chime.
  - A tag counts as tagged past alpha 228. Passing it shows the TAG_ONE or
    TAG_ALL message for 5 s. The GXT wording is not available, so the text
    is this port's.
- The original takes the first 15 buildings `FindObjectsInRange` returns,
  tags or not; only tags are considered here.
- Tag alphas are saved with the progress, as `CTagManager::Save` does.
- Verification: unit tests cover painting, counting, the messages, saving
  and the IPL scan. A browser test finds the Ballas tag under the Ganton
  freeway and sprays it until the Grove tag covers it.

## Distant plane trails

- `CPlaneTrails` (reversed) circles three planes around the map every 131 s,
  at 500 to 600 units up.
  - Each registers a trail point every 2 s. Points last 30 s and fade over
    their last 10 s.
  - The trails are white lines whose alpha is up to 110 × the brightest
    sky-bottom channel, cut by cloud, fog and rain. They are drawn after the
    sky and before the clouds, with no depth test.
- At night each plane's light (red, pale yellow, white) blinks every
  512 ms as a 5-unit corona out to 2000 units.
  - gta-reversed's `ClockHoursInRange` helper (`hour > after && hour <
    before`) never passes these night ranges (22 to 7, 21 to 7, 20 to 6),
    so the ranges are read as wrapping past midnight.
- Verification: unit tests cover the point history, fading and the
  blinking lights. A browser test sees the three trails form.

## Birds

- `CBirds` (reversed) now flies birds past the camera by day.
  - On frame 6 of every 512 (30 fps frames), between 05:00 and 22:00 in the
    outside world, up to six birds spawn in a formation.
    - Near water (within 30 units): grey gulls, 4–13 units above the camera
      at 45 units out.
    - In the desert: large dark birds, some gliding or circling. Following
      `Update`, a desert flock only replaces birds already flying.
    - Elsewhere: small birds, 2–10 units up at 40 units out.
  - They head for a point 8 units ahead of the camera, easing onto their
    target velocity, and vanish once past their range in 2D.
  - A flock whose flight path is blocked by a building is not created.
  - They are drawn as `CBirds::Render` builds them: eight prelit vertices a
    side on `cloudmasked`, with flapping wings, a 0.1 bob and a fade over the
    last 30% of the range.
  - A bullet line through a bird's 0.5 sphere kills it
    (`HandleGunShot`, fed from every tracer).
- `TheCamera.m_fDistanceToWater` comes from the stubbed
  `CWaterLevel::FindNearestWaterAndItsFlow`. Birds only compare it with 30,
  so water.dat is sampled on rings of 10, 20 and 30 units instead.
- Verification: unit tests cover spawning, the biomes, flight, removal, the
  shot test and the vertices. A browser test sees a flock drawn over Grove
  Street and shoots a bird down.

## Entry exits and interiors

- The 376 IPL `enex` rows are read as `CFileLoader::LoadEntryExit` scans them
  and pooled in GTA.DAT order (`CEntryExitManager::AddOne`).
  - Each pair links to the first same-named record without the pair flag
    (`LinkEntryExit`, `PostEntryExitsCreation`). Only DESHOUS (twice) and
    STUDRAN find no partner.
  - Burglary houses stay shut, as `ms_bBurglaryHousesEnabled` starts false.
- INITIAL's entry exit commands are applied in order, read from main.scm
  without running it.
  - 30 `SET_CLOSEST_ENTRY_EXIT_FLAG` calls shut the safehouses for sale.
    `FindNearestEntryExit` picks the airstrip's area-10 DESHOUS record for one
    of them, as it is nearer in 2D.
  - `SWITCH_ENTRY_EXIT` shuts the date restaurants and girlfriends' houses.
    The command is unreversed; it is applied to every record of the name,
    the only reading under which multi-door diners open and close together.
- Each frame follows `CEntryExitManager::Update` (reversed).
  - An enabled door whose rect (rotated by `IsInArea`'s matrix) holds CJ within
    1 unit of its height starts `CEntryExit::TransitionStarted` (reversed).
  - A spawn point more than 10 units away warps: 0.5 s to black. No door
    objects stream, so `FindNearestDoor` finds none and the door is marked
    `UNKNOWN_PAIRING` as in the original.
  - Nearer ones (the LA atrium) walk CJ 4 units on
    (`CTaskComplexGotoDoorAndOpen`) behind a 1 s fade.
  - Standing on the arrival exit keeps doors shut until CJ steps off every
    rect (`ms_exitEnterState` 3 → 4 → 0).
- Door markers follow `CEntryExitManager::Update`'s marker pass and
  `C3dMarkers` (reversed).
  - Enabled doors in the 60-unit square 30 units ahead of the camera, open at
    this hour, on screen and within 40 units, place a yellow cone 1 unit above
    the door (`PlaceMarkerCone`, size 2).
  - Each is one of 32 `diamond_3` instances (gta3.img). It is scaled to 70%
    within 5 units of the player, bobs 0.3 units at 5° a time step, and is
    halved and dropped under a roof found by a 1.5-unit line check every 2 s.
  - `SetBrightMarkerColours` lights it (ambient 0.6, a white directional
    light). It is drawn with depth writes off, and the model's vertex alpha
    fades it from tip to rim.
  - As reversed, `PlaceMarkerCone` passes a rotate rate of 0, so the cones do
    not spin. The render's pulse term is `sin(0)`.
  - `s_SavedAlpha`'s initial value is exe data; 0 stands in.
  - Controls-disabled, cutscene and replay states do not hide the markers yet.
- `CEntryExit::TransitionFinished` is unreversed; its commented draft in
  gta-reversed is followed.
  - The spawn point's area streams while game time is suspended
    (`CTimer::Suspend` around `LoadScene`).
  - CJ lands at `FindValidTeleportPoint` (a 0.35 sphere, then two 8-point
    rings) and fades back over 1 s.
  - The draft turns CJ to the entered door's `m_fExitAngle`. The data shows
    each record's exit angle faces away from its own door, so the spawn
    point's angle is used instead.
  - Random peds are removed (`RemoveAllRandomPeds`). Nothing generates while
    the area cannot see outside (`GenerateRandomCars`,
    `CanSeeOutSideFromCurrArea`).
  - Not ported: the interior's own peds (`PopulateInterior`), the enex name
    (GXT text is missing), the sky colour (`StartExtraColour`), group warping
    and shop loading.
  - Vehicles are not taken through doors yet.
- `AREA_CODE_13` placements now load in every area (`CEntity::IsInArea`). The
  49 outdoor ones were missing before, among them SF station roads, Pershing
  Square LODs and the Johnson house door frames.
- Interiors stream from `MODELS\GTA_INT.IMG`. It is in the content depot, and
  the world loader can open it after gta3.img as one virtual archive
  (`CStreaming::LoadCdDirectory`: the first IMG keeps a repeated name). It is
  not yet published with the world, so doors into interiors neither show nor
  open.
- Verification:
  - Unit tests cover parsing, links, script switches, `IsInArea`, the
    transition states and the teleport search against the retail data.
  - A browser test checks CJ's door stays shut without interiors.
  - Unit tests cover the marker slots, bobbing, scaling, roof drop and
    reuse. A browser test draws a cone at Grove Street and reads yellow
    at its centre.
  - A second browser test walks CJ into his house and back out once
    `gta_int.img` is published.

## Player idle animations

- `CTaskSimplePlayerOnFoot::PlayIdleAnimations` (reversed) now runs.
  - After CJ has been left untouched for more than 10 s, and at least 20 s
    after the last one, he plays one of STRETCH, TIME, SHLDR or STRLEG. They
    come from playidles.ifp in gta3.img, at blend 8, and never repeat the
    previous clip.
  - Any input within 10 s blends the idle out.
  - The untouched time is CPad's: every key, button, wheel or mouse movement
    resets it. So do ducking, aiming, moving, a vehicle, an arrest or a fall.
    It runs on game time and stops while paused.
  - A rig without the native skeleton gets no idles.
- Verification: unit tests cover the timer; a browser test waits for an idle
  and blends it out with a key press.

## Crouching

- `CTaskSimplePlayerOnFoot::PlayerControlDucked` (reversed) now governs a
  crouched CJ. Sprint or a jump press stands him up (`ClearTaskDuckSecondary`)
  if there is room.
  - Sprint runs on from the crouch.
  - Only the ducked control runs that frame, so the jump press does not also
    jump.
  - Before, sprint while crouched kept a slow crouch-walk.
  - The enter/exit key already stands him up through the vehicle entry.
- Crouched movement follows `CTaskSimpleDuck` (reversed): `ControlDuckMove`
  and `SetMoveAnim`.
  - Without an aimed gun, CJ turns to the stick and crouch-walks forward on
    GUNCROUCHFWD.
  - With one, the stick passes straight through. Forward and back walk on
    GUNCROUCHFWD/BWD without turning him.
  - A push almost purely sideways (|y| under 0.1, |x| at least 0.9) rolls on
    CROUCH_ROLL_L/R, about 2.8 units.
  - The walk command eases 0.07 a frame, and the clips play at
    max(0.6, |command|).
  - A roll ignores the pad until its clip ends. It cannot be stood out of
    (`MakeAbortable`), and the gun holds its fire (`StopFireGun`).
  - Before, a crouched CJ aiming walked forward whatever the stick said.
- Not ported: the duck waits for WEAPON_CROUCH to blend fully in before its
  first move clip.

## Running

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166; Vice City ancestor
reVC (mrxenginner/reVC, miami branch).

- `CTaskSimplePlayerOnFoot::PlayerControlZelda` (0x6883D0) is reversed. The move
  blend ratio is the stick magnitude / 60 (a key gives 128, so 2.13, or 1 with
  walk held). It slews at 0.07 × TimeStep per frame (3.5 per second) and drops
  to 0 when the stick is let go (`animation/playerMoveBlend.ts`).
- `CPlayerPed::SetRealMoveAnim` (0x60A9C0) is a retail stub. The browser ports
  its Vice City ancestor, whose `m_fMoveSpeed` is the same ratio from the same
  pad formula (`animation/nativeMoveAnims.ts`):
  - From idle, WALK_start (0.27 s) plays alone. WALK_player and run_player
    then restart.
  - Below ratio 1 the player walks; from 1 to 2 walk blends into run by the
    ratio; above 2 he runs.
  - While sprint is held, sprint_civi blends in at 2 per second against run.
    Letting go fades it out at 1 per second.
  - Stopping from a sprint plays Run_stop, or Run_stopR past half the
    cycle, to its end. The heading is held meanwhile (`m_headingRate` 0).
    Stopping otherwise blends IDLE_stance in at 4 per second while walk and
    run fade.
- Associations follow the reversed `CAnimManager::BlendAnimation` /
  `AddAnimation` and `CAnimBlendAssociation::UpdateBlend` / `UpdateTime`:
  - WALK, RUN and SPRINT are synchronised. `RpAnimBlendClumpUpdateAnimations`
    advances them at one phase rate, Σ blend / Σ blend × length, and a newly
    blended one joins the moving anim's phase.
  - The ped moves by the blend-weighted sum of each clip's root travel over
    the frame (`FrameUpdateCallBackSkinnedWithVelocityExtraction`), not
    normalised.
  - The pose is the weighted blend of the clips.
- Measured in Grove Street:
  - Starting takes 0.27 s of walk start, then reaches run speed (5.7 m/s)
    about 0.6 s after the press.
  - A run stops within about 0.25 units.
  - Sprint builds to about 9.6 m/s over 0.5 s.
  - A sprint stop slides 2.2–2.3 units in 0.9 s.
- Known differences:
  - `CPlayerPed::ControlButtonSprint` (sprint tapping) is a stub, so a held
    sprint plays at speed 1. The tired idle (IDLE_tired), adrenaline speeds
    and the stamina rules (`HandleSprintEnergy` depends on a stubbed stat
    modifier) keep the browser's model.
  - Turning: `CPed::CalculateNewVelocity` is a stub. Its Vice City ancestor
    turns toward the aimed heading by at most DEGTORAD(rate) × TimeStep a
    frame, and pedstats.dat gives STAT_PLAYER 9 (450° per second). The
    browser previously eased at an authored 11 to 8 rad/s.
  - Street peds keep the browser's single-clip gaits; this is the player's
    association set.
  - Without the native character, the simulation falls back to discrete
    walk, run and sprint stops. Its slew is now 3.5 per second, not 4.2.

## Jumping

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.

- `CTaskSimpleJump` (TaskSimpleJump.cpp), `CTaskSimpleInAir` and
  `CTaskComplexInAirAndLand` are reversed and followed in
  `simulation/Simulation.ts` and `simulation/nativePlayerLocomotion.ts`:
  - JUMP_launch or JUMP_launch_R plays first. They are partial clips that
    extract velocity, so the ped travels their root motion: 1.04 units
    and 0.83 units in 0.2 s. The move blend and heading hold meanwhile:
    `StartLaunchAnim` fixes `m_fAimingRotation`, and `PlayerControlZelda`
    does not run under the jump task.
  - Once the clip ends, `ProcessPed` tests for a climb (see Climbing), then
    `CheckIfJumpBlocked`:
    - The ped position is one unit above the feet, and ms_colModelPed1's
      spheres sit at −0.2, 0.2 and 0.6.
    - A 0.25 sphere, 0.25 ahead and 0.25 above the head sphere, makes a
      climb jump.
    - The three spheres shrunk to 0.3 and raised 0.75 block the jump if
      they touch anything.
  - `Launch` applies the player's 8.5 upward force to the 70-unit ped:
    0.121 units per frame, 6.07 m/s. It sets the ground speed along the
    heading to 0.1 units per frame, 0.1–0.17 over the RUN association's
    blend, or 0.17–0.22 over SPRINT's. The squared-speed comparison it
    guards with is almost always true, so even a standing jump leaves at
    0.1 (5 m/s). A climb jump goes straight up, and gravity is cut to 0.65
    of its value while CLIMB_jump plays.
  - `CPhysical::ApplyGravity` takes 0.008 units per frame² (20 m/s²).
    `ApplyAirResistance` scales the whole move speed by
    (1 − |v| / 175)^TimeStep, with CPed's 1/175.
  - `CTaskSimpleInAir` under `CTaskComplexJump` keeps a rising ped moving
    forward at 0.05 units per frame for up to 1000 ms of pushing.
  - No on-foot task steers the ped in the air. A ped leaving a ledge keeps
    its ground speed, and a wall takes the speed into it.
- Known differences:
  - `CPlayerPed::SetRealMoveAnim` is a retail stub. Its Vice City ancestor
    blends walk into run and plays SPRINT while sprinting. The browser reads
    the RUN and SPRINT blends off its walk (1.0), run (1.8) and sprint (2.5)
    move-blend stops.
  - `CStats::GetFatAndMuscleModifier(STAT_MOD_2)`, which scales the launch
    clip speed and the jump, is a stub. The browser uses 1.
  - `CPed::ProcessControl` is a stub. Gravity and air resistance for peds
    follow its Vice City ancestor, which calls `CPhysical::ProcessControl`.
    Vice City's ped air resistance (0.4 / 70) is SA's 1/175.
  - A blocked jump runs `CTaskSimpleHitHead` (reversed): HIT_WALL blends
    in and CJ stands still until the clip ends.
  - A climb jump shows CLIMB_jump while it plays in the air, as
    `CTaskSimpleInAir` keeps it. The glide follows once it ends.
  - Peds count in the climb-jump sphere, which `TestSphereAgainstWorld`
    leaves out.
- The previous browser jump was tuned: 6.6 m/s against 19.6 m/s² (a
  1.11-unit hop). It kept only the ground speed at the press, steered with 8%
  of the stick in the air, and dropped the ground speed off ledges.
- Verification: unit tests cover the hop height (about 0.87 at 60 Hz), a
  standing jump's 5 m/s along the heading, a ceiling within the raised
  spheres blocking the jump, and forward launch motion. In Grove Street a
  standing jump covers 1.2 units in the launch and 2.7 in the air, a run jump
  4.75, and a fresh sprint leaves at 11 m/s.

## Climbing

Pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.

- `CTaskSimpleClimb` (TaskSimpleClimb.cpp) is fully reversed and ported in
  `ped/nativeClimb.ts`:
  - `ScanToGrab` places the climb model's 22 spheres (radius 0.4) ahead of
    the ped and takes, per entity, the lowest-index sphere that penetrates
    it, at the entity's closest point (`CCollision::ProcessColModels` with
    one col point per sphere).
  - A first hit on spheres 0–4 or 10 (head height, or above the reach)
    blocks the whole scan. Sphere 16 is ignored. So is a point no higher
    than the current hold and not nearer, and a surface without
    SURFINFO.DAT's climbable flag.
  - Out of the launch, spheres 5, 11 and 17 are skipped.
  - A flat normal keeps the ped's heading. Otherwise the normal, turned
    away from the ped, must face it by more than 0.3; the hold then faces
    into the surface. The 16-sphere find-edge model around the hit then
    moves the hold to the edge.
  - `TestForClimb` rejects a hold without room for the 7-sphere stand-up
    model at the edge. From the air this marks the jump's climb invalid.
  - Entry: `CTaskSimpleJump::ProcessPed` tests once the launch clip ends,
    before `CheckIfJumpBlocked`. `CTaskSimpleInAir::ProcessPed` tests each
    frame of a jump while the ped rises faster than −0.2 units per frame
    and moves faster than 0.05 across the ground. A hold less than 1.4
    above the ped (1.1 from the air) is pulled up to directly; a higher
    one is grabbed.
  - `ProcessPed`, `StartAnim` and `MakeAbortable` drive the heights with
    the CLIMB_* clips from ped.ifp:
    - grab: CLIMB_jump, blend 8;
    - hang: CLIMB_idle, blend 4, while jump is not held;
    - pull: CLIMB_Pull;
    - stand: CLIMB_Stand;
    - finish: CLIMB_Stand_finish;
    - vault: CLIMB_jump_B, then CLIMB_jump2fall, when the 6-sphere vault
      model finds nothing past the edge.
    The ped eases to the hanging (−0.4, −1.1), edge (−0.4, 0), stand-up
    (0.15, 1) and vault (0.5, 0) offsets, capped at 0.2 units per frame. It
    gives up after 1 s (0.5 s hanging) short of a hold. Exit-vehicle drops
    the ped. The finish leaves it standing with 0.05 forward, and the vault
    falling at (forward / 50, −0.05).
  - The association timing follows `CAnimManager::BlendAnimation` and
    `CAnimBlendAssociation::UpdateBlend` / `UpdateTime`: a new partial clip
    starts at blend 0, and a clip is finished when its time equals its
    length. The clips keep their root translation (no velocity extraction),
    and their root offsets match the hold offsets above.
  - `GetCameraTargetPos` moves the camera's follow point with the body
    during CLIMB_Pull, CLIMB_Stand and CLIMB_jump_B.
- Known differences:
  - `CStats::GetFatAndMuscleModifier` is a retail stub. The browser uses the
    values for an unmodified body: 0 for STAT_MOD_0 (no reach restriction)
    and 1 for STAT_MOD_1 (climb clip speed).
  - The quarter-of-the-gap ease is per frame. The browser steps at 60 Hz
    and applies it at the PC frame limiter's 30 fps rate.
  - Entities come from a physics query rather than the sector lists, so
    their order can differ. The hold chosen between two candidates can
    depend on that order.
  - Physical climb entities are not grabbed: moving objects, boats while
    swimming, stopped trains. Objects with object.dat's hanging response
    (infinite mass) are left out of every scan, as in the game.
  - The triangle surface under a contact comes from a ray toward the
    contact point.
  - The world's SURFINFO.DAT sets the climbable and sprint flags, through
    the scene environment for the published world as for a local folder.
    - Steep cliffs, steep slidy grass, glass, garage doors, doors, lamp posts,
      scaffold poles, hydrants, benches, bins and barrels refuse a climb.
    - Carpet, floorboards and metal and concrete floors, fences and dumpsters
      refuse a sprint.
    - With no SURFINFO.DAT at all, every surface counts as climbable and
      sprintable.
  - The reversed `GetCameraTargetPos` groups its lerp arguments as the two
    horizontal offsets and the two vertical offsets, which would mix the
    axes. The browser interpolates each offset from one hold to the next.
  - Speech (`StartSpeech`), the quiet sound event at the finish and the
    camera stick modifier are not reproduced.
- Verification: unit tests cover the hold on a two-unit wall, the blocking
  spheres, a hold without room to stand, the climbable flag, the launch-only
  spheres, vehicles, the full grab–pull–stand sequence, hanging without
  jump held, the vault over a thin fence, exit-vehicle and the camera
  target. In Grove Street, CJ pulls up and vaults a garden wall and a
  static object, and pulls up onto a 2.2-unit wall to stand on it.

## Engine efficiency: scene matrices and collision culls

- A CPU profile of ten seconds of walking in Grove Street showed matrix
  updates, the pedestrian step and actor shape casts as the largest script
  costs after the WebGL calls.
- The scene root and the world, vegetation, grass and procedural containers
  no longer auto-update, and neither do mesh atoms under their frames. The
  scene root used to force every world matrix in the tree to be recomputed
  each frame. Vehicle roots now recompose only when their pose moves, so
  parked cars cost nothing. Code that writes matrices directly already flags
  them, and the bike recomposes after adding its lean.
- The per-collider car tests against peds and against CJ first check the
  car's bound radius. The run-over vehicle list is built once per step
  instead of once per ped per car. `currentShapeCast` skips actors beyond the
  sweep plus 20 units, and car body data is built once.
- Measured in the running game: a scene matrix update takes 0.11 ms, against
  0.30 ms for the previous full recompute. Objects updating their matrix
  every frame fell from 1,101 to 98. In the profile, the pedestrian step fell
  from 3.8% to about 2% of main-thread time and actor shape casts from 1.8%
  to 1%.
- Verification: the unit tests pass, and so do the vehicle, entry, bike,
  boat, plane, rotorcraft, prop, grass, procedural object, weapon, street
  life and shadow browser tests.
- Regression, fixed later: a moving car was drawn where it had been parked.
  In three.js r186, `updateWorldMatrix(true, false)` (behind
  `getWorldPosition` and `localToWorld`) clears an object's dirty flag
  without updating its children. The driver's seat query cleared the flag
  that the recomposed root had set, so the renderer never refreshed the
  body. `composeVehicleRoot` now brings the vehicle's hierarchy up to date
  when its pose changes, which costs the same as before for a moving
  vehicle and nothing for a parked one. None of the browser tests checked
  where the body was drawn; a unit test now reproduces the cleared flag.

## Engine efficiency: one world archive per page

- Each subsystem (map, pedestrians, vehicles, weapons, audio banks and
  more) opened the static world archive on its own. The manifest and IMG
  directory were fetched, checked and parsed each time, and each copy kept
  its own 64 MB chunk cache, so shared chunks were downloaded and
  decompressed more than once.
- `openStaticWorld` now hands every caller the same archive for a base URL.
  Loose resources such as `ped.ifp` are fetched and verified once. A caller
  that passes an abort signal still gets a private archive, because aborting
  a shared one would fail every other user.
- Measured from a fresh load to the first ped on foot: downloads fell from
  131.5 to 75.5 MB, array buffers from 277 to 194 MB, the JS heap from 90 to
  80 MB, and the time until pedestrians are ready from 986 to 506 ms.

## Engine efficiency: compressed DXT textures

- 25,137 of the 25,995 rasters in gta3.img are DXT1 or DXT3. The browser
  used to decode every one to RGBA8 in the worker or on the main thread,
  copy the pixels between threads and upload them as uncompressed textures.
  That is 8 times the stored size for DXT1 and 4 times for DXT3.
- Models read through `ModelReadCache` now keep DXT rasters as stored, and
  `nativeTexture` uploads them as S3TC compressed textures. This is how the
  D3D9 device that the PC game targets samples them. The RGBA DXT1 format
  keeps D3D9's transparent black for the fourth entry of a three-colour
  block. Without `WEBGL_compressed_texture_s3tc`, the blocks are decoded at
  upload as before. CJ's clothing composition and the direct decode API
  still produce RGBA pixels.
- Some dictionaries store zero-byte DXT levels below 4×4. The RGBA path
  rebuilds them by averaging the previous level. A compressed chain now ends
  before the first absent level instead. What the retail game samples from
  such a level depends on the memory D3D9 leaves in it.
- The Grove Street start package was rebuilt with the stored blocks. Apart
  from texture data and notices it is identical, and its texture data fell
  from 132.8 to 19.3 MB. The package itself fell from 30.4 to 10.9 MB.
- Measured in the running game at the start, texture data held by the
  scene fell from 69.1 MB over 514 textures to 11.2 MB over 459, with 429
  of them compressed. GPU texture memory falls by the same ratio.
- Verification: new unit tests cover the compressed chain and both upload
  paths. The unit suite passes, and so do the streaming, building, alpha,
  sampler, raster output, lighting, grass, procedural, HUD and car browser
  tests. The prop smash test failed once under load at car entry and
  passes alone.
- The start package's buffers are now decoded with `Uint8Array.fromBase64`,
  or a plain loop where the browser lacks it. `Uint8Array.from` with a
  callback per character took about 540 ms. Reading the whole package now
  takes about 100 ms, against about 630 ms before.

## Engine efficiency: one controller sweep for grounded walkers

- A 20 s profile of Grove Street showed the pedestrian step spending most of
  its time in Rapier's character controller: two sweeps per ped per 1/50 s
  step, a lateral one and then a gravity one.
- When the lateral sweep ends grounded, snap-to-ground already holds the
  capsule on the floor, so the downward sweep cannot move it. It is now
  skipped. A ped that walks off an edge, falls or jumps still takes both
  sweeps. CJ uses the same path.
- Measured over 20 s: controller time fell from 672 ms for 9 peds to
  561 ms for 11, about a third less per ped.
- On trimesh and box floors, walking heights match the previous path to
  within 0.2 mm. On the one-cell heightfield in the unit-test helper, the
  idle capsule settles 0.285 m into the cell. The previous path kept a
  walker there, while the lateral sweep alone brings it back to the
  surface. The crouch overhang test now measures its clearance from the
  floor surface instead of from that settled start.
- Verification: the unit suite passes, and so do the walking, street life,
  combat, police, wanted, busted, evasive, car and ped browser tests. The
  recruit test fails its dismissal check about one run in five, with or
  without this change.

## Engine efficiency: one bone update per character pose

- `bindAnimation().sample` brought the whole character's world matrices up
  to date after every clip. A character layering a locomotion clip, a
  weapon pose and a reaction recomputed its hierarchy three times, then once
  more at the end of the pose.
- Clips now layer on local matrices only, and `NativeCharacter` updates the
  world matrices once per pose. For CJ, the shoulder correction starts with
  a full update of its own, so the extra pass after it is dropped. Other
  callers of `sample` keep the old behaviour by default.
- Measured over 20 s of Grove Street, the matrix work inside character
  updates fell by about a quarter per character.
- Verification: the unit suite passes, and so do the character, player
  assembly, shadow, weapon, aiming, car entry, occupant, drive-by and street
  life browser tests.

### Soft ground: sand drag and rail-track resistance (CAutomobile::DoSoftGroundResistance)

- Source: gta-reversed ead3051 `CAutomobile::DoSoftGroundResistance` (0x6A4AF0), called at the end of
  `ProcessControl` for every automobile on the ground, and `IsAnyWheelTouchingSand` /
  `IsAnyWheelTouchingRailTrack` (a wheel with compression under 1 on a SAND adhesion-group surface, or on
  SURFACE_RAILTRACK, 178).
- Port: `src/simulation/nativeSoftGround.ts` (`softGroundResistance`). With a wheel on sand and the model
  neither the RC Bandit nor the Rhino, the planar move speed (the move speed less its component along the
  car's up axis) is opposed by 0.005 a time step: the whole planar speed under 0.3 units a step (the car is
  bogged down, `bIsBoggedDownInSand`), a 0.3-unit push against the direction of travel above it with the rate
  eased by max(0.2, 1 − 2 × speed). Offroad-ability handling flags (0x100000, 0x200000) scale the rate by
  0.6 or 0.3, and wet roads over 0.2 by 1.2 − WetRoads. On a rail track the planar speed is opposed by
  `ms_fRailTrackResistance` × time step instead; that constant's default is exe data the reference does not
  carry, so `WorldCar.railTrackResistance` is 0 until it is measured.
- `WorldCar.softGround` runs after the wheel step each frame: the wheel contact materials
  (`wheelGround`) resolve the SAND group through SURFINFO.DAT and the rail id, the delta is applied to the
  body's velocity in native units, and `touchingSand` / `boggedDownInSand` are kept for the dev state
  (`nativeCar.touchingSand`, `nativeCar.boggedDown`). The native flag also suppresses the suspension camera
  shake, which the browser does not have.
- Dev probes added for surface work: `__game.surfaceAt(x,z,top)` (the collision material and face under a
  point), `__game.collisionFacesOf(material)` (world centroids of loaded faces with a material) and
  `__game.collisionMaterialHistogram()`; the fleet snapshot carries each car's heading and
  `nativeCar.wheelMaterials` the material under each wheel.
- Verification: `tests/native-soft-ground.test.ts` (bogged-down loss, the eased push, the offroad and wet
  scalings, exemptions and the rail branch) and `tests/browser/soft-ground-sand.spec.ts` (the driven car held
  over Santa Maria Beach until SAND_BEACH faces stream in, parked on them: no sand at Grove Street, sand and
  bogged down at rest on the strand, still driving at speed a second and a half later).

### Fire Truck and S.W.A.T. water cannon (CAutomobile::FireTruckControl, CWaterCannon)

- Source: gta-reversed ead3051 `CAutomobile::FireTruckControl` (0x729B60, run by `ProcessControl` for the
  player's Fire Truck 407 and S.W.A.T. tank 601), `CWaterCannons::UpdateOne/Update/Render` and
  `CWaterCannon::Update_OncePerFrame/Update_NewInput/PushPeds/Render`, with
  `CEventHandler::ComputeWaterCannonResponse` and `CTaskComplexFallAndGetUp(hitSide)`.
- Port: `src/simulation/nativeWaterCannon.ts`. `stepFireTruckAim` follows the camera front in car space: yaw
  toward atan2(−x, y) at a step over 20, pitch toward atan2(z, |xy|) plus 15° (22° S.W.A.T.) at the step in
  seconds, yaw wrapped to ±π, pitch clamped to ±20° (−10°…35° S.W.A.T.). `cannonEmission` builds the frame's
  section while the car gun is held: from the misc_a node 1.2 (2.0) units along the nozzle direction plus the
  node's own speed for a step (move speed plus turn speed × offset), or from (0, 1.5, 1.8) in car space when the
  model has no node; the direction gets up to 15/1000 of random lift and the section moves at the car's speed
  (z scaled 0.3) plus 0.5 (0.4) of the direction. `WaterCannon` keeps the 32-section ring: after the first 150 ms
  the write slot advances and empties every frame, live sections fall at 1/250 a step² and call
  `extinguishPointWithWater(point, 2, 0.5)`, every fourth frame (frame + index, as a byte) they push peds, and the
  cannon frees itself when no section is live. `waterCannonPedSpeed` is PushPeds' direct change (a tenth of the
  gap to a tenth of the water's speed, only where the signs agree) followed by the event response (the mean of
  0.6 × water and the ped, capped at 0.2 a step). `renderGeometry` walks the ring from the write slot backwards,
  and for each consecutive live pair under 5 units apart emits three crossed quads (up = the pair's direction ×
  the camera forward, right and forward random unit vectors, all over 20, scaled by i²/32 + 3; colour 200, 200,
  255 with alpha 64 × (1 − i/32)), stopping at the first pair whose line of sight is blocked, where four
  prt_watersplash particles leave along the normal at 3 × random(0.2, 1.8) (and 0.6 of that).
- Browser: `main.ts` runs the aim and emission each step for the occupied 407/601 (`WorldCar.setCannon` turns the
  misc_a node to the yaw), updates the ring every step while it lives (the jet keeps flying after the gun is
  released or the truck is left), and draws it through a fogged `NativeImmediateTriangles` with the line of sight
  cast against non-kinematic colliders (buildings and vehicles, as native; peds are kinematic). `WorldPedestrians.
  waterCannonPush` knocks a ped within √5 units of a section (measured from its pelvis-height origin) down with the
  fall clip for its hit side (ko_skid_front / ko_spin_r / ko_skid_back / ko_spin_l) at the pushed speed, and adds
  the two prt_smokeII_3_expand puffs through `WorldFx.waterCannon.pedSmoke`. Not ported: the upward
  ApplyMoveForce on the ped (the browser peds have no vertical dynamics on the ground) and the cannon audio.
- Verification: `tests/native-water-cannon.test.ts` (aim rates, lifts and clamps, wrap, emission, ring lifecycle,
  ped speed, render geometry and the blocked pair) and `tests/browser/water-cannon.spec.ts` (a spawned Fire Truck:
  Ctrl fills the ring and draws it, a civilian 10 m ahead is knocked down with a fall clip, the ring drains and
  frees after release).

### Vehicle cheats clear their landing spot (CTheScripts::ClearSpaceForMissionEntity)

- Source: gta-reversed ead3051 `CTheScripts::ClearSpaceForMissionEntity` (0x486B00), which the vehicle cheats run on
  the car they drop: every entity whose collision the new car's collision model overlaps is removed — deletable,
  unlocked vehicles with their driver and passengers (CPopulation::RemovePed), and deletable peds not in a vehicle.
- Port: `WorldFleet.clearSpaceFor` queries the physics world with the new car's bounding box at its spawn pose
  (`intersectionsWithShape`); fleet cars that are neither occupied nor locked are disposed, and ped colliders go to
  `clearPed` (`WorldPedestrians.removeCollider`). The player's own collider is skipped. `placeCheatVehicle` calls
  it before the car is created. Not ported: the world's static objects are untouched, as the native only removes
  vehicles and peds; the native suspension-line exclusion has no counterpart (the box query has no lines).
- Verification: `tests/browser/cheat-clear-space.spec.ts` (the Greenwood parked and a civilian stood where the
  Rhino cheat lands are both gone once the tank appears).

### The Vortex hovercraft rides the water (CAutomobile::DoHoverSuspensionRatios)

- Source: gta-reversed ead3051 `CAutomobile::DoHoverSuspensionRatios` (0x6A45C0) for the Vortex (539) and the
  unused CARS_ON_WATER cheat (its hash is zero in retail): with the up axis at or over 0.3 and the car not drowning,
  a wheel line whose end has a water level above the wheel's ground contact (MAP_Z_LOW_LIMIT without one) and within
  a unit above the line end takes its collision fraction from the water plane (1 at or under the end,
  (start.z − water)/(start.z − end.z) between, 0 over the start) with the contact on the water and the normal up.
  `ProcessSuspension` springs the Vortex along the car's down axis (`ApplySpringCollision`, not the Alt form) with
  the force level scaled by |accelerate − brake| × 0.25 + 1, and `CAutomobile::ProcessBuoyancy` keeps the player's
  upright Vortex out of the drowning and submerged states after applying buoyancy.
- Port: `src/simulation/nativeHoverSuspension.ts` (`hoverWheelContact`, `hoverActive`);
  `NativeRaycastVehicle.stepPlayer` takes a `hover` provider (per-wheel line in native world space, the raycast
  contact height) and `sampleNativeSuspensionWheels` substitutes the water-plane fraction and contact (ground
  speed zero) for that wheel; `WorldCar` supplies it for the Vortex from WATER.DAT, sets the 'direction' spring mode
  and force scale, and bypasses drowning. The plane-typed Vortex now loads through the fixed car path (no wheel
  atomic: the wheel dummies keep their suspension lines and no wheel mesh is cloned; no light texture).
- Not yet: boarding through the door flow (the Vortex has no doors and the VORTEX anim group; the spec warps CJ in
  with `carEntry.warpIn`), and the hovercraft's water spray and engine effects. The approach task now chases a door
  drifting with its car instead of reporting a blocked way (a hovercraft slides on land at 0.05 traction).
- Verification: `tests/native-hover-suspension.test.ts` and `tests/browser/vortex-hover.spec.ts` (a spawned Vortex
  dropped over the 5.9 m deep water off Santa Maria Beach settles at the surface instead of the floor and drives
  across it).

### Frame limiter (FrontEndMenuManager.m_bPrefsFrameLimiter)

- Source: the PC original ships with the frame limiter on (`CMenuManager::SetDefaultPreferences`), capping the game at
  30 frames a second; the cap's constant lives in the executable's RenderWare glue, not in the reference.
- Port: `src/core/frameLimiter.ts`. The render loop keeps its fixed 60 Hz simulation but draws a display frame only
  when a 1/30 s interval has passed on a drift-free grid (every second frame at 60 Hz, every fourth at 120 Hz; a
  stall resynchronises instead of bursting), and idles at 10 a second under the menu, which draws nothing new. The
  setting sits in the menu's Audio panel (`#display-frame-limiter`), persists in `grove-display-v1`, defaults to on,
  and `__game.setFrameLimiter(on)` toggles it for probes; `state().frameLimiter` reports it.
- Why: the user reported the CPU running hot. On a 60 or 120 Hz display the limiter removes half to three quarters
  of the draw and per-frame CPU work with no change to the simulation, which is what the original does.
- Verification: `tests/frame-limiter.test.ts` and `tests/browser/frame-limiter.spec.ts` (30.3 draws and 60.7 ticks a
  second with the limiter, 60.3 draws without, 10 under the menu). Main-thread task time while walking in headless
  Chromium at 60 Hz: 252 ms a second with the limiter against 412 without (a 120 Hz display would draw twice as
  many frames again). A CPU profile at 30 fps is 73% idle; three.js draw submission is the largest remaining slice
  (838 draw calls a frame for 58k triangles, cars about 43% of them), which per-texture batching would cut next.

### Shooting the driver (CWorld::ProcessLineOfSight on seated peds, CTaskComplexDieInCar)

- Source: gta-reversed ead3051. A bullet line tests seated peds through their own collision, the three
  `CTempColModels::ms_colModelPed1` spheres (radius 0.35 at z −0.2, 0.2, 0.6 about the origin at the seat dummy); the
  windows are open in the car's collision model. `CTaskComplexDie` on a ped in a vehicle runs
  `CTaskComplexDieInCar`: an explosion, an aircraft, or a car already still (`CVehicle::CanPedStepOutCar`: planar speed
  at most 0.01 a step, vertical 0.05, turning 0.02) ends in the seat or straight out of the door; otherwise
  `PreparePedVehicleForPedDeath` sets the cruise speed to zero with no mission, the driver keeps the wheel for 2000 ms,
  then `CTaskComplexLeaveCarAndDie` if the car can be stepped out of, else `CTaskSimpleDieInCar` (CAR_dead_LHS).
- Port: `src/vehicle/nativeDieInCar.ts` (`seatedPedHit`, `canPedStepOutCar`, `dieInCarPlan`). The weapon system's
  instant hits test every NPC driver's spheres before the car's shell (`WeaponSystem.seatedDriverHit`), allowing the
  ped a unit past the shell hit because the browser's car colliders close the window openings; a hit goes to
  `WorldTraffic.driverShot` (CPed health 100 less the weapon's damage, CRIME_DAMAGED_PED) instead of the bodywork. The
  fatal shot starts the 2000 ms coast at cruise speed zero; then the car brakes to a halt and the driver leaves and
  dies through the door (`CarEntry.evictDriver` into `spawnDead`) when the car is still, or dies in his seat holding
  CAR_dead_LHS (`VehicleOccupants.markDeadInSeat`) when it is still rolling. Dev: `__game.driverHead(handle)`,
  `__game.traffic()`, `__game.weapons()`, `__game.occupants()`; traffic snapshots carry `health/dying/dead/deadInSeat`.
- Police crews take the same path (`WorldPolice.crewSeats` lists every seated cop, `crewShot` applies the damage,
  CRIME_DAMAGED_COP): a killed driver coasts 2000 ms and then leaves dead through the door or dies in his seat, a
  killed passenger dies in his seat (CAR_dead_RHS); dead seats no longer count toward the pursuit. Drive-by crews
  (`GangDriveBy.crewSeats/crewShot`) follow suit: the driver coasts and dies out of the door or in his seat, a dead
  shooter drops his gun pose for CAR_dead_RHS and stops firing.
- Not ported: the death event handed to the other occupants, the driver's death speech, civilian passengers.
- Verification: `tests/native-die-in-car.test.ts` and `tests/browser/shoot-driver.spec.ts` (a pistol from 3 m off
  the window wounds the driver to 75, the fatal shot zeroes the cruise speed, and two seconds later the car has
  stopped with the dead driver out of the door or in the seat); `tests/browser/shoot-cop-driver.spec.ts` does the
  same to a patrol car at two stars.

### Pedestrian walk / don't-walk signs (CTrafficLights::DisplayActualLight, CShinyTexts)

- Source: gta-reversed ead3051. Four traffic light models carry a pedestrian sign spanned by two entity-space corners
  (trafficlight1, cj_traffic_light4 and gay_traffic_light, cj_traffic_light5); `CTrafficLights::LightForPeds` runs
  on the clock ((ms / 2) & 16383: red under 12000, green under 15383, then yellow), the red half of the `handman`
  raster (the hand) draws for red and the green half (the man) for green or while bit 0x100 of the time is set
  (blinking through the yellow); `CShinyTexts::RegisterOne` keeps a sign within 60 units and fades its colour over
  the second half of that range, and `CShinyTexts::Render` draws the quads additively with vertex colour and no
  depth write.
- Port: `src/world/nativeShinyTexts.ts` (`lightForPeds`, `pedSignalCorners`, `pedSignalQuad`, `shinyFade`) and
  `src/render/NativeShinyTexts.ts`; the lit-placement pass registers a sign for every traffic light model in view,
  and the `handman` raster comes from the particle dictionary alongside the other extra coronas. `state().shinyTexts`
  counts the quads drawn.
- Verification: `tests/native-shiny-texts.test.ts` and `tests/browser/ped-signal.spec.ts` (a sign registered every
  frame 12 units from the Ganton signal).

### Rain shelters (PED_ATTRACTOR_SHELTER, CTaskComplexWaitForDryWeather)

- Source: gta-reversed ead3051. `CPopulation::IsCorrectTimeOfDayForEffect` lets shelter attractors be used at any
  hour; `CTaskComplexUseAttractor` answers one with `CTaskComplexWaitForDryWeather`, which stands still 1000 ms at a
  time (`CTaskSimpleStandStill`) and ends once `CWeather::Rain` is under 0.2, so a ped under a shelter in the dry
  leaves after a second and one caught in the rain waits it out. `CPedAttractorManager::IsApproachable` asks only
  for a clear line of sight to a shelter.
- Port: the crowd's attractor set includes shelters; `beginAttractor` stands the ped in one-second slices and
  `stepAttractor` re-arms the slice while the crowd's `rain` provider (CWeather::Rain from the main loop) reports
  0.2 or more. The approach keeps the browser's common attractor path.

### Get-up after a fall (CTaskSimpleGetUp, CPedPlacement::IsPositionClearOfCars)

- Source: gta-reversed ead3051. `CTaskSimpleGetUp::StartAnim` first asks `CPedPlacement::IsPositionClearOfCars`
  (a 0.25 sphere at the ped's origin against the vehicles); a car over the ped that is not a bike or quad, the entity
  the ped is attached to or the one it stands on sets `bStuckUnderCar` and the task waits (a stuck player takes
  WEAPON_RUNOVERBYCAR damage of the time step every frame, an NPC nothing while the player has controls). Otherwise it
  blends `ANIM_ID_GETUP_FRONT` when the clump's first association carries `ANIMATION_IS_FRONT` and `ANIM_ID_GETUP`
  otherwise, and the ped counts as fallen until the clip passes three quarters of its length. The front flags come
  from the default group's descriptors (KO_shot_front, KO_skid_back, FLOOR_hit_f, FALL_front, EV_dive, the jacked and
  roll-out clips).
- Port: `src/ped/nativeGetUp.ts` (front clip set, `getUpClip`, `getUpBlockedBy`, `stuckUnderCarDamage`,
  `fallenDuringGetUp`). Street peds remember their fall clip (`fallClip`, set by `hit`, which every car strike and
  water-cannon knockdown goes through); when the knockdown timer reaches the get-up clip's length the crowd tests the
  origin sphere against the fleet's car colliders (`carOver`) and either holds the fall pose with `stuckUnderCar`
  (the timer parked at the clip length) or plays the get-up at its own pace. The player's fall sites record
  `playerFallClip`, the get-up window is sized by the chosen clip, and `carOverPlayer` holds `sim.knockdown` while
  `damagePlayer` takes fifty a second. `state().stuckUnderCar` and the people snapshot's `stuckUnderCar` /
  `downSeconds` expose it. The `getup` clip joins the shared reaction set. A fallen ped's character controller
  ignores the car colliders (`characterMovement` filter): the controller used to shove the low collider out of a
  car parked over the ped, through the road, so the ped fell out of the world instead of waiting.
- Verification: `tests/native-get-up.test.ts`; `tests/browser/get-up-under-car.spec.ts` runs the starter car over CJ
  and over a placed civilian, parks it back over each of them, and checks that both stay down (CJ losing health)
  until the car is moved, then rise with the clip their fall clip calls for.
- Limits: the native col-model test is a Rapier collider intersection here; the one-in-eight-frame retry,
  `m_pEntityIgnoredCollision`, attached and standing-on entities (peds never stand on cars in the browser) and the
  1000 damage to an NPC once player controls are disabled are not represented; the browser's 3.5 s knockdown timer
  stays (native CTaskComplexFallAndGetUp times the lie-down separately).

### Thrown weapons (CTaskSimpleThrowProjectile)

- Source: gta-reversed ead3051. The press constructs the task with the button time; `StartAnim` blends
  `WEAPON_start_throw` (16) and, when its finish callback fires, `WEAPON_throw` at 1000, or `WEAPON_throwu` only when
  there is a target entity over 10 units away, a target point over 10 units away, the button is still down and the
  weapon is not the satchel charge. `ProcessPed` fires when the clip crosses weapon.dat's anim loop 2 fire time
  (`WEAPON_throw`) or anim loop fire time (`WEAPON_throwu`): for the player the button counter (milliseconds held,
  capped at 533) over 20 becomes `m_fAttackButtonCounter`, and `CWeapon::Fire` passes counter × 0.0375 as the
  projectile force (an NPC passes 0.3, or the target distance past 10 over 10 clamped to 0.2..1).
  `CProjectileInfo::AddProjectile`, which turns the force into the flight, is a raw call.
- Port: `src/weapons/nativeThrowProjectile.ts` (counter, forces, clip choice, fire time and frame test).
  `WeaponSystem.fire` starts the task for the four thrown kinds instead of launching at the press; `stepThrow` counts
  the button (`throwHeld`, fed from the fire button each frame in main.ts), hands the start clip to the throw clip
  and launches through `launchThrown` at the fire frame (ammunition, sound, EXPLOSION crime and the projectile as
  before, with the browser's projectile speed since AddProjectile is unavailable). The weapon assets load
  `WEAPON_start_throw` and `WEAPON_throwu` beside `WEAPON_throw`, the view installs them and plays whichever the
  task names (`onThrowClip`) and reports their lengths (`throwClipSeconds`). `attackButtonCounter` feeds the
  crosshair radius (CPlayerPed::GetWeaponRadiusOnScreen) until the task ends. `weapons.throwing`,
  `attackButtonCounter` and `lastThrowForce` are in the snapshot.
- Verification: `tests/native-throw-projectile.test.ts`; the weapon suite's grenade test now waits for the fire frame
  and a new case checks the wind-up, the throw clip, the fire frame, the counter and a tap's zero force;
  `tests/browser/native-motion-blur-streaks.spec.ts` throws a grenade through the task.
- Limits: the player's target entity (CTaskSimplePlayerOnFoot's weapon control is a stub) is always absent, so the
  player never plays `WEAPON_throwu`; the force does not change the projectile's speed; the counter's decay and
  growth in CTaskSimpleUseGun remain a comment sketch.

### Road sign text (CCustomRoadsignMgr, roadsign 2d effects)

- Source: gta-reversed ead3051. `t2dEffectRoadsignStreamData` holds the sign size, a rotation about Z, X and Y in
  degrees, `CRoadsignAttrFlags` (two-bit fields: lines 1..3 or 4 for 0, symbols per line 2/4/8 or 16 for 0, text
  colour 0..3) and four 16-character lines. `CEntity::CreateEffects` calls `CCustomRoadsignMgr::CreateRoadsignAtomic`:
  a quad per line, the width across, the line height (sign height over the lines) with 0.95 of it used, stacked by the
  per-count table (one line at -h/2; two at 0 and -h; three at h/2, -h/2, -3h/2; four at h, 0, -h, -2h), uvs (0,1)
  (1,1) (1,0) (0,0), prelit white, material colour white, black, grey or red by palette, and a texture per line
  built by `RoadsignGenerateTextRaster` from `roadsignfont` (particle.txd, 32 x 512): each character an 8 x 16
  cell at the column and row of `RoadsignGetLineAndRow` (anything unlisted, the underscore included, is column 0,
  row 26). The atomic's frame is created standalone, rotated Z then X then Y and translated to the effect position,
  and never parented to the entity; `CEntity::Render` draws it through `RenderRoadsignAtomic` as it stands (alpha
  test 100 and alpha 255 within 40 units, 254 fading to 0 by 500 units), so the effect's position and rotation are
  world coordinates and the sign models are world-anchored (rdsigns4_lae05's effects sit at native (2672.93,
  -1085.88, 75.43) and (2673.4, -1072.07, 75.43)).
- Port: the 2d effect reader keeps the roadsign entry (`ModelRoadsignEffect`, with the three flag decoders);
  `src/world/nativeRoadsigns.ts` holds the glyph table, the line raster copy, the quad layout and the distance
  alpha; `src/render/NativeRoadsigns.ts` keeps one world-space group in native axes, builds a mesh per effect per
  placement instance when the scene installs a part or receives its effects from the archive (`SceneOptions.roadsigns`,
  `attach` in `buildNativeScene` and `supplyEffects`), shares line textures and geometry, gives each sign its own
  materials for the fade, drops signs whose placement left the scene, and hides them past 500 units. The font comes
  from particle.txd when the scene environment loads (`decodeNamedTextures(['roadsignfont'])`); attachments made
  before it wait. `state().roadsigns` counts signs, visible signs and textures.
- Verification: `tests/native-roadsigns.test.ts` (glyph cells, raster copy from a coded charset, line offsets,
  quad, fade, the 88-byte effect and flag decoding); `tests/browser/native-roadsigns.spec.ts` streams the LS Forum
  overhead sign, checks the mesh sits within a unit of the effect's world position facing west with three line
  materials, and screenshots it (`artifacts/native-roadsigns.png`: "LS Forum / Ocean Docks / Palomino").
- Limits: the alpha test stays at 100 through the fade (the original leaves whatever reference the previous draw
  set once past 40 units); the sign has no lighting (prelit white in the original as well, but under the entity's
  dynamic lights there).

### Occlusion culling (COcclusion, COccluder, CActiveOccluder, CEntity::IsEntityOccluded)

- Source: gta-reversed ead3051. `CFileLoader::LoadOcclusionVolume` reads an `occl` line (centre x and y, bottom z,
  width, length, height, rotations about Z, Y and X, flags) and `COcclusion::AddOne` floors the absolute sizes
  (dropping an all-zero box), adds 180 degrees to each limited rotation, and lists map occluders as far away;
  files ending in `int.ipl` fill the interior set. `ProcessBeforeRendering`, when the area can see outside, walks at
  most sixteen far-away occluders a frame into the nearby list (`NearCamera`: centre distance less half the longer
  of length and width under 250), and `COccluder::ProcessOneOccluder` projects each nearby one: the centre at a
  depth between -150 and 300, the eight corners (or a flat quad for a zero dimension) through `CalcScreenCoors`
  (depth over 1; pixels from the view matrix; the four-argument form's scales are the screen size over the depth by
  70 over the field of view), one outline line per box edge that separates a camera-facing face from a hidden one
  (`ProcessLineSegment`: an off-screen end interpolated to depth 1.1, the line turned to keep the projected centre
  inside it, rejected when it misses the screen with the screen centre outside it), an outline at least 15 % of the
  width and 10 % of the height (10 % and 7 % flat), and the camera-facing faces' normals and offsets. Interior
  occluders follow, and an active occluder whose every outline end lies inside a nearer one's outline goes
  (`OccluderHidesBehind`). `IsPositionOccluded` needs the sphere's depth past the occluder's, its scaled radius
  inside every line and the point behind every face; `CEntity::IsEntityOccluded` (called by
  `CRenderer::SetupEntityVisibility` for on-screen entities and big buildings) tries the bound centre with 0.9 of
  the scaled radius, then the centre alone and four bounding box corners, and two more corners for a box over 60
  wide or long and over 30 tall.
- Port: `src/world/nativeOcclusion.ts` (the module above, native axes, the camera as position, view transform,
  half-angle tangents, pixel size and native field of view); the IPL reader keeps the `occl` section
  (`IplOccluder`), `readWorldOccluders` gathers the world's records (external files first, interiors by file name)
  and the world worker's ready message carries them; main runs `processBeforeRendering` with the renderer camera
  right before the scene's view update, and `sceneVisibility` (given `SceneOptions.occlusion`) culls an on-screen
  entry whose bound sphere and collision bounding box corners (through its placement matrix) the entity test
  rejects, counting them (`occludedCount`). `state().occlusion` reports the pools, the active count and the culled
  placements.
- Verification: `tests/native-occlusion.test.ts` (screen coordinates and scales, the 2d line helpers, AddOne,
  a wall in front of the camera hiding spheres and entities behind it, the far-away and nearby lists, a hidden
  occluder dropped, a flat quad, the `occl` parse); `tests/browser/native-occlusion.spec.ts` faces the Grove
  Street occluder wall and checks placements are culled, fewer when facing away (`artifacts/native-occlusion.png`).
- Limits: the screen scale uses the renderer's projection tangents rather than the RenderWare view window; a
  placement without collision bounds uses its sphere as the box; `CCarGenerator`'s use of the point test is not
  wired (the browser's generators spawn by distance).

### Screen colour filter (CPostEffects::Render, CPostEffects::ColourFilter)

- Source: gta-reversed ead3051. After the frame is drawn, `CPostEffects::Render` copies the front buffer, applies
  the fog effect when on, takes `CTimeCycle::GetPostFxColors` (the interpolated postfx1 and postfx2 bytes with
  their alphas), greys both to 64 under night vision or infrared, scales pass 1 by `gfLaRiotsLightMult`, scales
  both by 1 + (1 - s_ExtraMult / 0.35) where s_ExtraMult creeps by 0.0005 a time step toward the player's
  `CPhysical::GetLightingFromCol` (the ambient before brightness averaged over its channels plus the contact
  surface brightness, 1 until a surface sets it; outdoors scaled through TEST_ADD_AMBIENT_LIGHT_FRAC) and never
  passes 0.35, and, with `m_bColorEnable` (true by default), `ColourFilter` draws the copied front buffer over the
  frame twice with SRCALPHA / ONE blending and the pass colour as the vertex colour: each pass adds colour x alpha
  x screen. `CRGBA::ScaleRGB` stores the scaled bytes through a uint8 cast, so an overflow wraps.
- Port: `src/world/nativePostEffects.ts` (the lighting, the s_ExtraMult creep, the multiplier, the pass colours with
  the byte wrap, the night vision flash count and the infrared expansions); `src/render/NativePostEffects.ts` copies
  the drawing buffer into a framebuffer texture from a capture object's pre-render hook (order 998, the native
  front buffer copy) and draws the passes as full-screen quads in the native order with the native blends: the two
  colour-filter passes (front buffer x pass colour, source alpha added to the frame; orders 999.1 and 999.2), the
  night vision flash (the buffer added int(count) times at 8/255, folded into one draw and capped at the buffer
  once), the (32, 255, 32) ZERO / SRCCOLOR tint and Grain(48), or infrared's four additive draws of the buffer in
  (255, 60, 40) grown by 0.3 px steps, the (255, 64, 255) tint and Grain(64); the rain grain keeps order 1000. The
  local timecycle sample carries `postFx`, world lighting keeps the frame's pair, and the frame loop feeds the
  effects with the goggle state, the crept multiplier (contact brightness from the renderer's contact lighting, the
  ambient from the timecycle) and the frame's native steps. The CSS goggle filters are gone. `state().colourFilter`
  shows the passes and s_ExtraMult, `state().postEffects` the vision mode and flash; `__game.setColourFilter(on)` is
  m_bColorEnable; `colourFilterPixelProbe` compares the frame with and without the filter passes; `readPixel`
  reads a freshly drawn frame (the frame limiter leaves a spec's own animation frame with a cleared buffer).
- Verification: `tests/native-post-effects.test.ts`; `tests/browser/native-colour-filter.spec.ts` (the passes on
  at the spawn, the frame only gaining, most pixels changed, the toggle); `tests/browser/native-vision-effects.spec.ts`
  (night vision greens the frame's centre, infrared turns it magenta, both with the filter greyed, and the plain
  frame returns when the goggles come off).
- Limits: TEST_ADD_AMBIENT_LIGHT_FRAC is a binary float (0x8CD7B8) the reference does not give, so the exterior
  scale of the collision lighting is not applied (the interior form runs everywhere); the LA riots multiplier stays
  1; the vision light setups (SetLightsForNightVision, the infrared default and heat object lights) are not in the
  reference, so the scene's own lighting stays under the goggles (peds keep the browser's heat material); the
  flash adds the buffer at most once where the original's fifty draws saturate.

### Underwater screen ripple (CPostEffects::Render, UnderWaterRipple)

- Source: gta-reversed ead3051. With `CWeather::UnderWaterness` at or over `m_fWaterFXStartUnderWaterness`
  (0.535) or `m_waterEnable`, `CPostEffects::Render` climbs `s_WaterGreen` by the time step to 24 (0 above
  water), builds the colour from `m_waterCol` (64, 64, 64) plus 184 on every channel and `s_WaterGreen` on green
  (each capped at 255), scales it by 1 - min(`CWeather::WaterDepth`, 90) / 90 (`m_bWaterDepthDarkness` is on) and
  calls `UnderWaterRipple`, which redraws the copied front buffer over the frame as a triangle strip of rows every
  SCREEN_STRETCH_Y(24) pixels whose texture coordinates sway by sin(0.04 y + 0.0015 t) x xoffset, xoffset being
  SCREEN_STRETCH_X(4) x `s_WaterGreen` / 24, with the colour at alpha 255. `CWeather::Update`, which sets
  `UnderWaterness` and `WaterDepth`, is a raw call in the reference.
- Port: the helpers in `src/world/nativePostEffects.ts` (`waterGreen`, `underWaterColour`, `underWaterWave`,
  `underWaterXOffset`); `NativePostEffects.updateUnderWater` keeps a strip mesh (order 1000.5, after the rain
  grain as in the original) over the captured frame, rebuilding its rows for the drawing buffer's height and
  updating the swaying texture coordinates and the tint every frame. The frame loop takes the water surface at
  the camera (`WaterLevels.level`) and counts the camera under it as underwaterness 1 with the depth the surface
  less the camera height, feeding both the weather (`underwaterness`, which the moving fog and rain already read)
  and the pass. `state().postEffects.underwater` shows the state, `s_WaterGreen` and the row count;
  `__game.postEffectPixelProbe(names)` compares the frame with and without named post-effect quads.
- Verification: `tests/native-post-effects.test.ts` (the climb, the colour with and without depth darkness, the
  amplitude and the sway); `tests/browser/native-underwater-ripple.spec.ts` dives CJ off the Santa Maria shore and
  checks the ripple strip appears with the camera under the surface and changes the frame, and goes on surfacing.
- Limits: the underwaterness ramp of the original `CWeather::Update` is unknown, so the camera under the surface
  counts as fully under at once; the row spacing follows the drawing buffer's height as SCREEN_STRETCH_Y does.

### Number plates (CCustomCarPlateMgr, CVehicleModelInfo::SetCarCustomPlate)

- Source: gta-reversed ead3051. `CCustomCarPlateMgr::Initialise` reads `platecharset` (32 x 256, nearest filtering)
  and `plateback1..3` from vehicle.txd. When a vehicle model loads, `SetCarCustomPlate` builds an eight-character
  text with `GeneratePlateText` (two letters, two digits, then a space, a digit and two letters; each character
  from `CGeneral::GetRandomNumberInRange`, whose integer form takes an exclusive upper bound, so the original draws
  letters A..W and digits 0..8) and `SetupClump` walks the clump's materials: the one whose texture is named
  `carplate` takes `CreatePlateTexture`, a 64 x 16 raster with each character's 8 x 16 cell copied from the charset
  (`RenderLicenseplateTextToRaster`; the cells run a..z then 0..9, four to a row, and anything else is the blank
  cell at column 0, row 9), and the one named `carpback` takes the plateback `GetMapRegionPlateDesign` picks (2 for
  the LA weather region, 1 for Las Venturas and the desert, 0 for San Fierro and the default). Every vehicle of a
  model shows the model's plate (`CVehicle::CustomCarPlate_TextureCreate` keeps the model's text), and
  `CAutomobile::CustomCarPlate_BeforeRenderingStart` swaps the material's texture for the instance's around
  rendering. `LoadPlatecharsetDat` is a raw call; the palette it loads is unused by the copy.
- Port: `src/vehicle/nativeCarPlates.ts` (the charset cells, the integer random range, the text generator, the
  region design and the raster copy). The vehicle catalog decodes the charset and the three platebacks once, keeps
  one text per model id, and swaps the `carplate` and `carpback` entries of a loaded car's textures before the
  model is built, so the ordinary material path picks them up; the fleet passes the player's weather region as the
  spawn region (`nativeWeatherRegion`), `NativeCarAssets.plate` carries the text and design, and the fleet snapshot
  reports them.
- Verification: `tests/native-car-plates.test.ts` (the cells, the generator against a fixed random, the region
  design and the raster copy from a coded charset); `tests/browser/native-car-plates.spec.ts` checks every fleet
  car's plate matches the native pattern with the Los Santos design, that the material's texture is the generated
  64 x 16 raster rather than the model's 16 x 16 placeholder, and screenshots a parked car's boot
  (`artifacts/native-car-plates.png`).
- Limits: the plate text is drawn from the browser's random rather than the native CRT sequence, so the strings
  differ from a given save's; the bundled starter Greenwood loads outside the catalog and keeps its model texture;
  the per-instance texture swap is unnecessary here because the browser builds a car's materials per model load.

### Volumetric clouds (CClouds::VolumetricCloudsRender)

- Source: gta-reversed ead3051. `VolumetricCloudsInit` lays out one cloud as three axis-aligned quads (18 vertices,
  two triangles each, the second repeating two corners) with the normals (0,1,0), (0,0,1) and (1,0,0);
  `ms_vc.texture` is `cloudhigh` from particle.txd. Each frame `VolumetricCloudsRender` sets the density from the FX
  quality (1 high, 1/3 medium, 1/2 low) over `MAX_VOLUMETRIC_CLOUDS` (180), takes the draw distance as the far clip
  capped at 600 with the fade starting 100 short of it and creation 200 past it, and, when the camera or the player
  has moved since the last frame, calls `VolumetricClouds_Create` with a point ahead of the player's vehicle (or the
  camera) at the creation distance jittered by (200, 200, 50): five clouds walk away from that point by a random
  1..5 scale times three, each with sizes drawn from that scale (20x to 100x across, 40x tall) and an alpha of 36
  to 128. Every frame each cloud drifts with `m_fVolumetricCloudWindMoveFactor` times the wind direction, one past
  the draw distance goes unless it was only just created, and its alpha loses the height fader (`gfVolumetricCloudFader`,
  which climbs four a time step under 220 units until it reaches 255 and the pass returns, and falls again above)
  and then fades linearly over the last 100 units. The grey is the six sky top and bottom channels over six plus 64,
  capped at 255, and each quad's alpha is the absolute dot of the camera-to-cloud direction with its normal. The
  pass is depth tested, alpha blended, writes no depth and culls neither side.
- Port: `src/world/nativeVolumetricClouds.ts` holds the model table, the density, distance, colour, fader and alpha
  rules and `VolumetricCloudField`, which owns the 180 slots and runs the creation, drift, deletion and per-quad
  alpha of a frame; `src/render/NativeVolumetricClouds.ts` fills one dynamic mesh (positions and RGBA vertex
  colours, the shared uvs built once) from the field's draws and sets its draw range. The frame loop feeds it the
  camera and player positions, the occupied aircraft or car (else the camera) as the creation anchor, the
  timecycle's sky top and bottom bytes, the wind direction, the camera's far clip and whether the area is outside.
  `cloudhigh` joins EXTRA_SKY_TEXTURES and the world lighting exposes the sky top. `state().volumetricClouds`
  reports the slots in use, the fader, the draw distance, the grey and the clouds drawn.
- Verification: `tests/native-volumetric-clouds.test.ts` (the model's quads and normals, the density and distance,
  the grey, the fader, the alpha fade, creation ahead of the anchor with the native drop rule, the per-quad alphas
  around the camera and the interior and ground cases); `tests/browser/native-volumetric-clouds.spec.ts` shows
  nothing on the ground, drains the fader at 600 units, flies until clouds come into range and screenshots them
  (`artifacts/native-volumetric-clouds.png`).
- Limits: `m_fVolumetricCloudWindMoveFactor` and `m_bVolumetricCloudHeightSwitch` are binary values the reference
  only points at, so the drift is off by default and the height switch is taken as on (which is what the retail
  game shows); the cloud positions come from the browser's random rather than the native CRT sequence.

### Vehicle extra components (CVehicleModelInfo::CreateInstance, ChooseComponent)

- Source: gta-reversed ead3051. A vehicle model's `extra1`..`extra6` frames hold optional parts (bull bars, roof
  racks, loads, spoilers). `PreprocessHierarchy` removes those atomics from the clump into `m_apExtras` in name
  order, so none renders by default, and `CreateInstance` clones back at most two: `ChooseComponent` for the first
  and `ChooseSecondComponent` for the second. Both read the model's comps value, the hexadecimal vehicles.ide
  column, as two halves of sixteen bits, each three four-bit component indices (0xF for none) and a four-bit rule.
  The global `ChooseComponent` picks one of the listed components at random under ALLOW_ALWAYS (1) or
  ONLY_WHEN_RAINING (2), one or nothing under MAYBE_HIDE (3), and any of the first five slots under FULL_RANDOM (4).
  `IsValidCompRule` rejects ONLY_WHEN_RAINING unless the old or the new weather type is rainy, which sends the
  choice to the fallback: two draws in three of a component `GetListOfComponentsNotUsedByRules` says no valid rule
  names (none at all under FULL_RANDOM). The second component runs the B rule the same way and falls back only when
  the A rule was valid, again two draws in three.
- Port: `src/vehicle/nativeVehicleExtras.ts` (the comps decode, the count, the validity, the rule pick, the unused
  list, both choices and the frame lookup). `installNativeCar` finds the model's extra frames, chooses this
  instance's pair and clears the render flag of every other extra atomic, which is what taking them out of the
  clump amounts to here; the fleet passes CWeather's rainy weather type (`WorldFleet.raining`, from the new
  `NativeWeather.rainyWeatherType`) so the rain rule can apply.
- Verification: `tests/native-vehicle-extras.test.ts` (the decode and count, the weather rule, each rule's pick,
  the unused list, the fallbacks and the frame order, which is not the hierarchy order: the Bobcat stores extra2
  first); `tests/browser/native-vehicle-extras.spec.ts` spawns a Sadler, a Walton and a Bobcat and checks each
  shows at most two of its extras. Before this the extra atomics kept their render flag, so all four of the
  Sadler's rendered together.
- Limits: the choice uses the browser's random rather than the native CRT sequence, so a given car's parts differ
  from a given save's; the extras stay part of the instance's model rather than being cloned onto the clump, so a
  vehicle keeps its pair for its lifetime as in the original.

### Vehicle paint variations (CVehicleModelInfo::ChooseVehicleColour)

- Source: gta-reversed ead3051. Every vehicle model keeps `m_nLastColorVariation`, and each new vehicle advances it
  by the caller's shift (1 from CAutomobile, CBike, CBoat and CTrain) around the model's carcols variation count
  (up to eight), taking that line's four palette indices. A model with no variations, and every model under the
  black traffic cheat, paints all four slots with index 0; the pink traffic cheat uses 126. When the model has more
  than one variation and the chosen paint is the one the player's own vehicle of that model already wears, the
  counter advances once more.
- Port: `src/vehicle/nativeVehicleColours.ts` holds the rotation; the vehicle catalog owns one
  (`colourRotation`), `carColorVariationCount` and `carColorVariationIndices` read the model's line, and
  `loadFixedWorldCar` asks the rotation for the variation instead of always taking the first, passing a
  player-match test built from the occupied car's indices (`WorldFleet.playerColours`, from the new
  `NativeCarAssets.colourIndices` and `colourVariation`). The browser previously took variation 0 for every car, so
  all traffic of a model shared one paint.
- Verification: `tests/native-vehicle-colours.test.ts` (the counter's first step to variation 1, the per-model
  counters, the single-variation and no-variation cases, the eight-variation cap, the player re-roll happening once
  and a shift other than one); `tests/browser/native-vehicle-colours.spec.ts` spawns four Sadlers in turn and
  checks they take different variations and different paint (`artifacts/native-vehicle-colours.png`).
- Limits: the counter is per catalog rather than per model info, which is the same thing while one world is loaded;
  bikes, boats and planes still take their existing paint path.

### Escalators (CEscalator, CEscalators)

- Source: gta-reversed ead3051. A model's escalator 2d effect (40 bytes: the sloped run's bottom and top, the upper
  run's end, and a direction byte, 0 down and 1 up) is transformed out of object space by
  `CEntity::CreateEffects` and handed to `CEscalators::AddOne`, which fills one of thirty-two slots.
  `CEscalator::AddThisOne` drops all four points by the step model's bounding box height, counts the planes (one
  plus two and a half per unit of the sloped run, one plus one every 3.2 units of each flat run, up to forty-two
  step objects in all) and takes a rotation whose forward is the flat direction from the bottom to the start.
  `Update` creates the step objects (MI_ESCALATORSTEP on the slope, MI_ESCALATORSTEP8 on the flats) once the camera
  is within the bounding radius plus twenty, advances a position that wraps every unit by the time step over
  twenty-five (backwards going down), and lays each step out: the sloped ones back from the top by
  (index - position + 1) / 2.5, the flat ones out from the start and from the top at (8 n + 4 + position) / 2.5,
  each with a move speed of 0.016 along its run. Three units past the build distance the objects go again.
- Port: the 2d effect reader keeps the escalator entry; `src/world/nativeEscalators.ts` holds the plan, the
  position advance, the step poses and the thirty-two-slot field; `src/assets/escalatorAssets.ts` reads
  `esc_step` and `esc_step8` with `escstep.txd` from the archive and takes the step height from the sloped model's
  own vertical extent (the collision archive has no entry for it); `src/render/NativeEscalators.ts` keeps one
  world-space group in native axes, clones a step model per slot when an escalator builds, places them every frame
  with the shared rotation, and drops them when it switches off. The installed scene exposes
  `escalatorPlacements()` (the effect with its placement's native modelling matrix) and the frame loop feeds new
  placements in whenever the streaming window or the supplied effects change, deduplicated by world position.
  `state().escalators` reports the slots, the built ones, their steps and the objects drawn.
- Verification: `tests/native-escalators.test.ts` (the plan's drop, counts, rotation and bounding sphere, the
  wrapping position both ways, each run's step placement and spacing, the build and drop distances, the
  thirty-two-slot limit and the effect parse); `tests/browser/native-escalators.spec.ts` stands at the Los Santos
  mall escalator at native (1129, -1502), waits for its effects to stream, and checks the steps build and move
  (`artifacts/native-escalators.png`).
- Riding: CEscalator::Update gives each step object its move speed (0.016 units a frame along the run), and CPhysical
  carries a ped standing on it by its ground physical. The steps have no collision here, so the player stands on the
  ramp, and `Simulation.groundCarry` adds the speed of the step under his feet (`NativeEscalatorField.stepUnder`: half
  a step model's width across, half a step along, 0.6 up or down) to his grounded move, rising with it on the way up.
  Street peds are not carried.
- Limits: the steps themselves have no collision; the step height comes from the model rather than a collision bounding box; the native
  object-pool limit that can refuse to build an escalator has no equivalent here.

### Gang stare (CTaskComplexStareAtPed, ComputeStareResponse, DoGangAbuseSpeech)

- Source: gta-reversed ead3051. `CGroupEventHandler::ComputeStareResponse` gives every member of a ped group the
  stare task when the target is within eight units of the group's leader, with a timeout of
  `GetRandomNumberInRange(3000, 5000)` plus a bias of `GetRandomNumberInRange(-1000, 1000)` for a sexy-ped event (a
  threat gets a timeout of a day). `CTaskComplexStareAtPed` starts with `CTaskSimpleStandStill` of 500 to 1000 ms
  and then alternates `CTaskComplexTurnToFaceEntityOrCoord` with another stand still; each frame it keeps an IK
  look at the target's head (0.15 blend, 500 ms), calls `CTaskComplexGangLeader::DoGangAbuseSpeech` (a gangster
  says the line for the target's gang, the player counting as the Families one) and, while the leader is within
  eight units and no partial animation runs, plays a random `PRTIAL_GNGTLKA..H` clip on a one-in-a-hundred draw.
  It ends when the timeout runs out or the leader leaves the range.
- Port: `src/ped/nativeStareAtPed.ts` (the range, the timeout and stand durations with the native exclusive integer
  ranges, the phase machine, the talk-clip draw and the abuse line by gang). The crowd's gang party gives every
  member a stare when the player comes inside the leader's eight units: the member stands still, turns to face him,
  looks at him and takes the talk clips, and the hangout's own look and talk draws pause while it runs.
  `state().pedestrians.people[].stare` reports the phase and the time left.
- Verification: `tests/native-stare-at-ped.test.ts` (the range, both random ranges, the phase alternation and
  timeout, the talk draw and the abuse mapping); `tests/browser/native-gang-stare.spec.ts` walks the player up to a
  Ballas party and checks every member takes the task, turns to face him without leaving its spot, looks at him,
  plays a gang talk clip, sends the abuse vocal once, and drops the task on the timeout and out of range.
- Limits: the trigger is the player's approach rather than a group decision maker's response, because the group
  decision files that choose TASK_GROUP_STARE_AT_PED are not in the depot; the abuse line uses the browser's threat
  vocal, since the dedicated abuse speech banks are not there either.

### Performance pass, 2026-09-20

Measured in headless Chrome with the frame limiter on (30 fps), driving out of Grove Street with streaming active,
over 761 frames. The main thread is comfortably inside its budget and the remaining costs are asset-inherent.

- Main thread: 246 ms of CPU a second, 75.3% of samples idle. Frame pacing over 1,494 animation frames: half under
  18.1 ms, 99% under 25.4 ms, one frame over 50 ms and none over 100 ms, so there is no stutter to chase.
- Frame profile per frame: render 4.20 ms (of which the three.js draw submission is 3.24 ms, before-render work
  0.48 ms and the character shadow 0.31 ms), fixed simulation steps 2.11 ms (pedestrians 0.39, player 0.32,
  traffic 0.10, the rest Rapier), between-step work 0.64 ms, population scheduling 0.02 ms. Headless rasterizes in
  software, so the draw submission figure is an upper bound on real hardware.
- Top non-idle samples are all three.js: updateMatrixWorld 1.9%, multiplyMatrices 1.4%, renderBufferDirect 1.1%,
  projectObject 1.0%, then uniform refresh work under 0.5% each. No game module exceeds 0.3%.
- Tried and rejected: taking the static scene subtree out of the per-frame matrix walk
  (`root.matrixWorldAutoUpdate = false`). Timed directly over 200 calls, `scene.updateMatrixWorld()` took 0.194 ms
  with the walk and 0.210 ms without it, so the 5,400 static placements are not what that call costs. Reverted.
- Measured and rejected: merging draw spans that share a material within a geometry. Over 598 Los Santos and
  generic world models, 2,732 live spans reduce to 2,613 by material key, a 4.4% saving, and only 96 of those are
  already adjacent in the index buffer. Draw calls track material count, which the original game pays as well: a
  visible car is 60 to 70 material groups and the streamed world about 550 at downtown.
- Textures already upload as stored DXT blocks wherever the context has WEBGL_compressed_texture_s3tc
  (`readModel` keeps its decode cache compressed); without the extension they are decoded, which is the correct
  fallback but costs four to eight times the memory on devices that lack S3TC.
- The one substantial lever left, per-atomic vehicle culling, is blocked by the missing component flag table
  recorded in the gaps checklist.

### Water cannon audio (CAEWaterCannonAudioEntity)

- Source: gta-reversed ead3051. `Service` runs while the frontend game and collision banks are loaded and keeps
  four sounds: the frontend bank's sound 0 at speed 1.78 and volume +6 and the collision bank's sound 3 at speed
  0.5 and volume -9, both at the cannon's last section point while that section is in use and the cannon has an
  id; and the collision bank's sound 3 twice more at the splash point, at speed 1 and volume -3 and at half the
  speed six decibels quieter. Every voice is started once with SOUND_REQUEST_UPDATES and then has its volume,
  speed and position moved each service, rolls off at 2, and is stopped when its condition lapses.
  `UpdateParameters` releases a slot whose sound has ended, and `CWaterCannon::Update` sets the splash point where
  the jet's line first hits the world.
- Port: `src/audio/native/NativeWaterCannonAudio.ts` holds the four voice specifications and the service;
  `NativeAudioEngine` owns one as `waterCannon` and reports it in the audio snapshot. The frame loop services it
  with the jet's last live section, and stands in for the native line test by casting the tip two units down onto
  fixed geometry, splashing at what it finds.
- Verification: `tests/native-water-cannon-audio.test.ts` (the voice table, starting and moving the jet pair,
  adding and dropping the splash pair, the bank gate and the released slot);
  `tests/browser/native-water-cannon-audio.spec.ts` boards a Fire Truck, sprays, and checks the two jet voices
  come up, the splash pair joins once the jet reaches the ground, and all four go when the jet drains.
- Limits: the splash point comes from a downward ray at the jet's tip rather than the line test the browser's
  cannon does not run, so a jet that meets a wall splashes at the ground under it.

## Engine efficiency: flattened static placements

A streamed placement never animates its frame hierarchy, so the RenderWare frames a building's model carries are
pure overhead once the model is instanced: three.js still walks them every frame in `updateMatrixWorld` and again
when it builds the render list. `flattenStaticModel` in `src/assets/ModelObjects.ts` bakes each mesh's world
transform into its own matrix, reparents it to the model root and drops the now-empty frames. It leaves skinned
models alone (their bones move), and running it twice changes nothing, so a source shared between streaming
windows can be flattened once and reused. `placedModelObjects` runs it behind a `flatten` option that
`nativeScene` sets at both of its call sites; the model viewer does not, so a previewed model keeps the hierarchy
the inspector shows.

Measured in the default world after streaming settled, three runs each, mean of 200 timed calls per run:

| | objects in scene | `scene.updateMatrixWorld` | `renderer.render` |
| --- | --- | --- | --- |
| before | 5,742 | 0.475 ms | 2.205 ms |
| after | 4,405 | 0.360 ms | 2.036 ms |

That is a quarter fewer scene objects, 24% off the matrix walk and 7.7% off render submission, about 0.28 ms of
every frame. Mesh count is unchanged, so nothing about what is drawn or how many draw calls it takes has moved.

- Verification: `tests/flatten-static-model.test.ts` (world transforms preserved, frames dropped, idempotent,
  skinned models untouched, a model with no meshes); the world specs that walk the streamed scene all still pass
  (`static-world`, `static-world-walk`, `streaming-drive`, `native-occlusion`, `native-roadsigns`,
  `native-escalators`, `native-prop-smash`, `native-prop-kick`).
- Safety: every consumer of `userData.nativeFrame` is a vehicle or a character (wheel poses, character bones, the
  jet pack, headlight dummies), none of which takes this path, and occlusion and visibility work from the
  per-placement instance, which flattening leaves in place.

What is left in render submission, measured on the same scene: 854 draw calls carry 58,391 triangles, about
sixty-eight triangles a call, from 459 visible meshes and 1,287 material groups. The cost is the call count, not
the geometry. Merging the material groups inside each placement was measured and pays nothing, because a
building's parts almost never share a material: the 1,287 groups hold 1,290 distinct materials across 424
instances. The only merge with real upside is a global one by material across the whole streamed window, which
would trade away the per-placement frustum and occlusion culling that currently drops a third of the groups, and
would have to rebuild its geometry on every streaming swap. That trade needs its own measurement before anyone
takes it.

### Restart points in the script runtime (CRestart commands)

- Source: gta-reversed ead3051, `Restart.cpp`. `AddHospitalRestartPoint` (0x460730) and `AddPoliceRestartPoint`
  (0x460780) append a point, a heading in degrees and the `STAT_CITY_UNLOCKED` threshold to one of two ten-slot
  tables. `OverrideNextRestart` (0x4607D0) and `CancelOverrideRestart` (0x460800) hold a point that the next
  lookup of either kind consumes, `SetRespawnPointForDurationOfMission` (0x460810) replaces the query point once,
  and the extra hospital and police points carry their own radius, which a zero turns off.
- Port: the engine routines were already in `src/simulation/nativeRestart.ts`; this adds the script commands that
  reach them. `ScmGameState` owns one `NativeRestart`, and `ScmGameCommands` handles ADD_HOSPITAL_RESTART,
  ADD_POLICE_RESTART, OVERRIDE_NEXT_RESTART, CANCEL_OVERRIDE_RESTART, SET_EXTRA_HOSPITAL_RESTART_POINT,
  SET_EXTRA_POLICE_STATION_RESTART_POINT and SET_RESPAWN_POINT_FOR_DURATION_OF_MISSION. Only the last of those
  has a reversed command handler; the rest dispatch to the executable in the reference, so each one calls the
  engine routine it is documented to reach.
- Verification: `tests/scm-restart-commands.test.ts` runs the real INITIAL block from the published `main.scm`
  and checks the tables the runtime builds match `readInitialRestartPoints` entry for entry, eight hospitals and
  seven police points; it also runs the script's own extra-point, override, cancel and mission-respawn commands
  and checks what the death lookup then returns, including a city still locked behind its town id.
- Correction: the static reader's restart capacity said sixteen; `Restart.h` sets `MAX_RESTART_POINTS` to ten.

### Stunt jumps in the script runtime (CStuntJumpManager::AddOne)

- Source: gta-reversed ead3051, `StuntJumpManager.cpp` 0x49CB40. `AddOne` takes a start box, a landing box, the
  fixed camera position and the reward, and fills one of the pool's 256 slots.
- Port: `ScmGameState` holds the pool and `ADD_STUNT_JUMP` fills it, building each box from the centre and
  positive radius the command carries, the reading the static extractor already documented. The save key is the
  command's own script offset, as the native pool has no identity of its own.
- Verification: `tests/scm-initial-commands.test.ts` runs INITIAL from the restart block onwards and checks the
  seventy jumps the runtime collects equal `readInitialStuntJumps` entry for entry. The run then stops at
  CREATE_OBJECT_NO_OFFSET, the next command of that block the runtime has not ported.

### Parked car generators in the script runtime (CTheCarGenerators)

- Source: gta-reversed ead3051, `TheCarGenerators.cpp` and `CarGenerator.cpp`. `CreateCarGenerator` (0x6F31A0)
  refuses a model outside the vehicle range unless it is -1, then fills the first free slot of five hundred
  through `Setup`, which packs the heading into a signed byte at 256/360 of a degree, clears the wait and
  owned-car flags, takes the force-spawn flag as the high-priority one, and leaves the record switched off with
  its next generation time a millisecond away. `SwitchOff` (0x6F2E30) zeroes the count, `SwitchOn` (0x6F32C0)
  sets it to 0xFFFF and re-times the record with `CalcNextGen` (0x6F2E40), four milliseconds on.
- Port: `src/engine/ScmCarGenerators.ts` holds the array and those routines, `ScmGameState` owns one, and
  CREATE_CAR_GENERATOR and SWITCH_CAR_GENERATOR reach them. Neither command handler is reversed, so the count
  the script passes is read the way the field is documented: none turns the generator off and the script's 101
  turns it on for good. The spawning half of `Process` stays with the world's own IPL generators.
- Verification: `tests/scm-car-generators.test.ts` covers the slot, the packed heading, the refused models and
  the full array, runs the real MAIN stretch that creates the parked cars and checks each record against the
  command that made it including the slot number written back to the script, and runs the script's own switch
  commands for both counts.

### Script objects (ObjectCommands.cpp)

- Source: gta-reversed ead3051. The Object namespace of `ObjectCommands.cpp` is reversed: `CreateObject` sets
  the model's alpha, makes an OBJECT_MISSION (or OBJECT_MISSION2 for an external script), drops the point with
  `CWorld::PutToGroundIfTooLow`, lifts it by `CEntity::GetDistanceFromCentreOfMassToBaseOfModel` (0x536BE0),
  clears the orientation and adds the object to the mission cleanup list when the script uses one.
  `RemoveObject`, `DoesObjectExists`, `MarkObjectNoLongerNeeded`, `DoNotRemoveObject`, the coordinate, heading,
  velocity, scale and collision pairs and `DoesObjectHaveThisModel` follow. Headings pass through
  `FixAngleDegrees`, which moves an angle one step into range rather than taking a modulus, and velocities are
  the per-frame field times fifty.
- Port: `src/engine/ScmObjects.ts` stands in for the object pool, holding what a script can read back, and
  `ScmGameState` owns one. CREATE_OBJECT needs two world lookups, the ground level and the model's base offset,
  and says so when the host has neither; CREATE_OBJECT_NO_OFFSET, whose own handler is unreversed, is the same
  command without them. Four more unreversed handlers set the field their reversed siblings name:
  SET_OBJECT_COLLISION_DAMAGE_EFFECT the collision damage effect, FREEZE_OBJECT_POSITION the
  bDontApplySpeed flag that FREEZE_CHAR_POSITION sets for a ped, SET_OBJECT_DYNAMIC the static flag inverted,
  and SET_OBJECT_PROOFS the five physical proofs SET_CAR_PROOFS and SET_CHAR_PROOFS set.
- Verification: `tests/scm-objects.test.ts` runs the real INITIAL commands, checks the ground drop and base lift
  against a world that answers both, checks the no-offset form leaves the point alone, checks an external script
  makes mission-two objects, and covers the angle fix, the velocity scaling, the handle that stops existing and
  the four flag fields.
- Frontier: INITIAL now runs from its restart points through its objects and stops at ROTATE_OBJECT, a timed
  rotation whose handler the reference does not reverse.

### Zone population in the script runtime (CTheZones)

- Source: gta-reversed ead3051, `ZoneCommands.cpp`, which is reversed in full. Every zone command looks its zone
  up by label through `CTheZones::FindZoneByLabel` for ZONE_TYPE_INFO and writes one CZoneInfo field; a label no
  zone carries reaches no record and the command does nothing. `InitZonesPopulationSettings` (0x5720D0) fills the
  array with fresh records, which carry population type RESIDENTIAL_AVERAGE, every race bit set, no gang or
  dealer strength and cops allowed. SET_ZONE_FOR_GANG_WARS_TRAINING and SET_SPECIFIC_ZONE_TO_TRIGGER_GANG_WAR
  reach CGangWars' two zone statics.
- Port: `src/engine/ScmZones.ts` holds one record per info label, the order the browser's world zones are
  indexed in, and `ScmGameState` owns it along with the two gang war statics. The population type, dealer and
  gang strengths, race mask and no-cops flag, their two getters, the reset and the gang war statics all run;
  GET_CURRENT_POPULATION_ZONE_TYPE asks the host, since the answer is CPopCycle's current zone.
- Verification: `tests/scm-zone-commands.test.ts` runs INITIAL's whole zone block against the world's real zone
  labels and checks every resulting record equals what `readInitialZonePopulation` extracts, including that no
  label went unresolved; dropping one label from the world shows the runtime skipping it and keeping it as a
  diagnostic, exactly as the static reader reports it.

### The script's camera (TheCamera)

- Source: gta-reversed ead3051, `CameraCommands.cpp`, reversed, over `CCamera::SetCamPositionForFixedMode`
  (0x50BEC0), `TakeControlNoEntity` (0x50C8B0), `Restore` (0x50B930) and `RestoreWithJumpCut` (0x50BAB0). All
  four only set fields the camera reads on its next update. POINT_CAMERA_AT_POINT replaces a target at or below
  minus a hundred with the ground under it, and takes control as the script (1); a later request from a script
  (2) yields to a hold already in force. Both restores hand the camera back to the player and pick the mode from
  what the player is doing: the car camera in a vehicle or while climbing into one, the on-foot camera while
  leaving one.
- Port: `src/engine/ScmCamera.ts` carries that state and `ScmGameState` owns it, so a host applies it to the
  camera it draws with rather than the runtime moving anything. The restores ask the host what the player is
  doing, in the terms the native routine reads the ped state in, and the point command asks it for a ground
  height.
- Verification: `tests/scm-camera-commands.test.ts` runs the script's own SET_FIXED_CAMERA_POSITION,
  POINT_CAMERA_AT_POINT and RESTORE_CAMERA_JUMPCUT, checks the ground substitution on an assembled command
  carrying the sentinel, checks a cutscene keeps the camera against a script request, and covers the three
  player states the restore chooses its mode from.
- Census note: of the 1,152 commands in `main.scm` the runtime still does not handle, 325 have a reversed
  handler in the reference. The largest remaining group is the char commands, which all work through a CPed
  the runtime cannot create, because CREATE_CHAR is one of the handlers the reference leaves to the executable.

### The script's sprites and boxes (DrawCommands.cpp)

- Source: gta-reversed ead3051, `DrawCommands.cpp`, reversed in full. Each draw claims the next of 128
  rectangles for the frame: DRAW_SPRITE the textured type carrying the sprite slot less one, DRAW_RECT the
  mono-colour type with no texture, DRAW_SPRITE_WITH_ROTATION the angled type with the angle in radians, and
  DRAW_WINDOW a text box with its own corners, a fixed backing colour and a header cut to eight characters, with
  the placeholder "DUMMY" meaning none. Every box is centred on its point, and its corners are stretched from
  the 640x448 design space to the screen. LOAD_SPRITE lowers a name into one of 128 sprite slots, and
  SET_SPRITES_DRAW_BEFORE_FADE marks the box the next draw will claim.
- Port: `ScmIntroRectangles` in `src/engine/ScmMessages.ts`, beside the intro text lines it shares a frame reset
  with: CTheScripts clears both under the same UseTextCommands gate, so the runtime's frame does too. The
  texture dictionary the sprites come from is the host's to load, through two adapter calls.
- Verification: `tests/scm-sprites.test.ts` runs the script's own LOAD_SPRITE and DRAW_SPRITE, checks a wider
  screen stretches the corners out of the design space, and covers the rotation, the window header, the
  before-fade flag, the gated frame reset and the full-array refusal.

### Small engine statics the script sets (GameCommands.cpp)

- Source: gta-reversed ead3051, `GameCommands.cpp` and `ScriptCommands.cpp`, both reversed. Each of these
  commands sets or reads exactly one engine static: the ped density multiplier, the military zone flag, the
  radar and area name on the HUD, the no-resprays flag, the taxi nitro and pimp cheats, the two photo flags, the
  language and widescreen options, the mission fail countdown, and the ground height under a point. The
  progress and mission-attempt commands go through `CStats::IncrementStat` (0x55C1B0), which ignores a value at
  or below zero and stops a capped stat at a thousand.
- Port: the flags live on `ScmGameState` beside the ones already there, and `ScmStats` gained the increment.
  The two increments that read the player rather than the stat table, calories and the health stat beside it,
  fail explicitly and are left to a host that knows the player's health.
- Verification: `tests/scm-game-statics.test.ts` runs the script's own density, radar, military zone, progress,
  mission-given and ground-height commands, reading the last one's answer back out of the thread's own local,
  and assembles the three commands that belong to the streamed mission scripts rather than MAIN.

### Script fires (CFireManager)

- Source: gta-reversed ead3051, `FireManager.cpp` and `Fire.cpp`, both reversed. `StartScriptFire` (0x53A270)
  takes the next free slot of sixty, and when every slot is burning it puts out the first script or
  first-generation fire to make room; the fire's strength is the size the command asks for and its generations
  are trimmed by the manager's own cap, which starts at 999,999. The handle is a script thing index, the slot
  in its low half under a counter that moves on with every fire that slot carries. `RemoveScriptFire` (0x539700)
  and `RemoveAllScriptFires` (0x539720) only touch fires the script owns, `ClearAllScriptFireFlags` (0x5397A0)
  lets go of them while they keep burning, `ExtinguishPoint` (0x539450) puts out everything in a sphere, and the
  two counting routines (0x5397F0, 0x539860) ignore the script's own fires, one over a flat range and one over
  a box.
- Port: `src/engine/ScmFires.ts` holds the pool and those routines, and `ScmGameState` owns it. The spreading,
  burning down and particles of `CFire::ProcessFire` belong to a host that draws the fires; this is what the
  script can set and read.
- Verification: `tests/scm-fires.test.ts` covers the handle layout, a fire's life from lighting to removal, the
  trimmed generations, a full pool taking its own slot back, the difference between clearing the flags and
  removing the fires, the two counts and the sphere, and runs the script's own START_SCRIPT_FIRE, which writes
  its handle into the mission locals it indexes.

### Wanted level commands (CWanted)

- Source: gta-reversed ead3051, `PlayerCommands.cpp` over `Wanted.cpp`, both reversed. `SetWantedLevel`
  (0x562500 region) trims the level to the maximum the script set, clears the queued crimes, takes the chaos
  that goes with the level from its own table and re-derives the level from it; the no-drop form only ever
  raises it, and clearing the level is the same call at zero.
- Port: the browser's `NativeWanted` already carried those routines for its own pursuit; `ScmGameState` now owns
  one and the four commands drive it. SET_MAX_WANTED_LEVEL, which the runtime already had, now also lowers the
  chaos ceiling the port clamps against, so the trim and the ceiling agree.
- Verification: `tests/scm-wanted-commands.test.ts` runs the script's own alter, clear and compare commands,
  including the negated form of the comparison, and checks the maximum trims a later request.

### Score, stats and the script's arithmetic

- Source: gta-reversed ead3051, `PlayerCommands.cpp`, `StatCommands.cpp` and `MathCommands.cpp`, all reversed.
  The score commands add to and read back `CPlayerInfo::m_nMoney`. The stat commands wrap `IncrementStat` and
  `DecrementStat` (0x55C2E0), which ignores a value at or below zero and never takes a stat below nothing, and
  each shows a HUD message with its change. Sine and cosine take degrees, and the two distance commands measure
  flat and full.
- Port: the money and the odd-job title flag join the other statics on `ScmGameState`, and `ScmStats` gained the
  decrement. The HUD message a stat change shows belongs to a host.
- Verification: `tests/scm-score-and-math.test.ts` runs the script's own score and stat commands, including the
  negated comparison, and assembles the four arithmetic commands to check the degree conversion and both
  distances.

### Set pieces and the camera's scriptable components

- Source: gta-reversed ead3051. `CSetPieces::AddOne` (0x499500) fills one of 210 slots with an ambush: its type,
  the area as a rectangle whichever corners the script gave, and two spawn-and-target pairs; a full table drops
  the request. `CCamera::InitialiseScriptableComponents` (0x50D2D0) puts the script's zoom, track and move
  fields back to idle, and `LerpFOV` (0x50D280) runs a zoom from now to now plus the limit.
- Port: `src/engine/ScmSetPieces.ts` holds the table and `ScmCamera` gained the scriptable fields, the reset and
  the zoom. The spawning half of `CSetPieces::Update`, an eighth of the table a frame, belongs to a host with a
  traffic system. The linear track and move the script starts are not ported: `VectorTrackLinear` and
  `VectorMoveLinear` are the two camera routines the reference leaves to the executable.
- Verification: `tests/scm-set-pieces.test.ts` covers the rectangle, the full table, the script's own
  ADD_SET_PIECE with its twelve coordinates, and what the reset does and does not touch.

## Engine efficiency: where the remaining CPU goes

A sampling profile of a thirty-second drive west along the flood channel, at the native limiter's thirty drawn
frames a second over the fixed sixty-hertz simulation, puts the browser at about 206 ms of CPU a second, three
quarters of the time idle. No function of this codebase takes more than 0.3% of the samples. What is left sits
in three.js and breaks down roughly as:

| share of all samples | what |
| --- | --- |
| 1.4% | `updateMatrixWorld` |
| 1.3% | `multiplyMatrices` |
| 1.0% | `renderBufferDirect` |
| 0.7% | `projectObject` |
| 0.7% | material uniform refresh and the lights-dirty mark |

Two candidates were measured and rejected on the numbers:

- **Freezing the static scene root's matrix updates.** An earlier pass measured this with a forced walk, which
  three.js runs whatever the flag says, so the result meant nothing. Measured the way the renderer actually
  calls it, the whole unforced walk costs 0.128 ms a frame and freezing the 2,999-object streamed subtree
  changes it by nothing at all. The matrix time in the profile is the animated hierarchies, characters and
  vehicles, not the static world.
- **Turning off the renderer's shader error checking**, which forces a driver sync per compiled program. Over
  the same drive it made no difference: 206.4 against 206.1 ms of CPU a second, the same nine frames over 25 ms,
  because the scene only ever compiles about forty programs.

What is left is the draw call count already recorded above. The flatten in this round remains the one measured
win, and the next one would have to be a global merge by material, with the trade that entry names.

### The pad a script reads (CPad)

- Source: gta-reversed ead3051, `PadCommands.cpp` over `CRunningScript::GetPadState` (0x4859F0), both reversed.
  The script asks for one field of the controller state at a time by a button id that indexes the order the
  switch is written in, starting at the two stick axes. IS_BUTTON_PRESSED is that state non-zero and the menu
  not just closed, so a button still held as the frontend exits does not count. The joypad, mouse inversion and
  returned-from-frontend questions read the menu options and the same pad flag.
- Port: `src/engine/ScmPads.ts` holds two pads, the menu options and the mouse movement, and a host fills them
  from its own controls each frame. An id past the end of the switch reads as nothing, which is what the
  source's fall-through leaves the caller with.
- Verification: `tests/scm-pads.test.ts` checks every id against the field it names, the two pads keeping their
  own state, the frontend flag suppressing a held button, and the script's own IS_BUTTON_PRESSED in both its
  plain and negated forms.

### Road and pedestrian path switches (CPathFind)

- Source: gta-reversed ead3051, `PathCommands.cpp` over `CPathFind::SwitchRoadsOffInArea` (0x452C80), both
  reversed. Each command turns the corners it is given into a box and switches the car or pedestrian nodes in
  it off, on, or back to what the map shipped with. Besides flipping the nodes, the routine keeps a list of at
  most sixty-four areas so later work can see them: a new area removes every switch that lies wholly inside it,
  and unless it is the back-to-original form it is appended.
- Port: `src/engine/ScmNodeSwitches.ts` keeps that list and `ScmGameState` owns it; flipping the nodes belongs
  to whatever holds the path graph, which can ask the list what covers a point. The removal follows retail,
  which shifts only the entry after the removed one and then drops the last slot, so an area outside the new one
  can be lost with the areas inside it; the reference marks that as an R* bug and fixes it behind a flag, and
  this port keeps what the script actually ran against.
- Verification: `tests/scm-node-switches.test.ts` covers the box from either corner order, the back-to-original
  form removing rather than adding, the swallow with retail's loss, the case where nothing is lost, the
  sixty-four cap, the removal ignoring whether a switch is for cars or pedestrians, and the script's own
  SWITCH_ROADS_OFF.

### Camera shake, the running queries and the directional scene load

- Source: gta-reversed ead3051, `CameraCommands.cpp` and `ScriptCommands.cpp` over `CamShakeNoPos` (0x50A970),
  `CCamera::AddShakeSimple`, `VectorMoveRunning` (0x474861) and `VectorTrackRunning` (0x474891), all reversed.
  A shake from the script divides its strength by a thousand and only takes over when it beats what is left of
  the last one, which decays by a unit a second and is read between nothing and two. The two running queries
  are the clock against the end of the move or track. IS_POINT_ON_SCREEN drops a point at or below the map's
  low limit to the ground under it before asking the camera, and the directional scene load streams around a
  point facing a heading.
- Port: the shake, the two spans and the queries join `ScmCamera`; the sphere test and the scene load are the
  host's, since one needs the camera's frustum and the other its streamer. The linear move and track that would
  set those end times are still the two camera routines the reference leaves to the executable, so the queries
  answer against whatever a host puts there.
- Verification: `tests/scm-camera-shake.test.ts` covers the decay rule with a weaker shake ignored and then
  taken, the script's own SHAKE_CAM and its thousandth, the simple shake's span surviving until the components
  reset, the boundary of both running queries, and a point below the map floor being tested at the ground.

### Streamed scripts (CStreamedScripts)

- Source: gta-reversed ead3051, `StreamedScripts.cpp`, reversed in full. The eighty-two slots are registered in
  the order the archive lists its files; `ReadStreamedScriptData` then walks MAIN.SCM's streamed table and gives
  each registered file the size and the index the script addresses it by. A slot holds its bytes once the
  streamer has read them, `StartNewStreamedScript` hands those bytes to a thread that runs external and counts
  one more user, `ReInitialise` drops every hold so the streamer may reclaim, and a running thread's bytes name
  the slot they came from.
- Port: `src/engine/ScmStreamedScripts.ts` is the registry, `ScmGameState` owns it, and `ScmRuntime.startStreamed`
  runs a thread over a file's own bytes rather than the script space, with the external flags set. Reading the
  archive stays with a host, which is what the browser's IMG reader already does.
- Verification: `tests/scm-streamed-scripts.test.ts` registers the published `script.img` and checks all
  seventy-nine external scripts the header names resolve to a file, with the size and script index the header
  gives each; it then loads one through the IMG reader, starts it, and checks the thread runs over that file,
  says it is external, and opens on the script name every file begins with. A name the archive does not carry
  stops the read, which in the source is an out-of-bounds read.

### Streamed script commands, and forty more no-ops

- Source: gta-reversed ead3051. The streamed script commands dispatch to the executable, so each one calls the
  `CStreamedScripts` routine it is named for: the script addresses a file by the index the header's table gave
  it, which the registry translates to a slot, and then asks whether the file is loaded, starts a thread over
  it, lets its hold go, drops it from memory or counts how many threads it has.
- Port: the commands sit on `ScmGameState.streamedScripts`, and starting one goes through a host, which loads
  the file if it must and runs the thread. The runtime cannot fetch from the archive itself.
- The same checkout registers forty more commands as no-ops than the one this runtime's list came from: the
  two-player camera modes, the debug file writers, the remote controlled car, the taxi shortcuts, and the rest
  of the cut features. PC 1.0 parses their operands and does nothing, so they join the list.
- Verification: `tests/scm-streamed-scripts.test.ts` asks after a real file by the script's own index, sees it
  unloaded, loads it from the published archive, sees it loaded, and starts it. The no-op count is asserted in
  `tests/scm-missions.test.ts`, which also runs three of them and checks they leave storage and the condition
  flag alone.

### The peds a script holds (CharacterCommands.cpp)

- Source: gta-reversed ead3051, `CharacterCommands.cpp`, whose bodies are reversed even where the creation
  dispatch is not: CREATE_CHAR reaches `CPopulation::AddPed` (0x612710), which is reversed. IS_CHAR_DEAD tests
  the pointer before the state, so a handle that names no ped answers dead. SET_CHAR_HEALTH with a health of
  nothing kills the ped with a die task instead of setting the field. GET_CHAR_COORDINATES answers with the
  vehicle's position while the ped rides in one, SET_CHAR_ACCURACY sets the weapon accuracy byte,
  SET_CHAR_ONLY_DAMAGED_BY_PLAYER the invulnerable flag, SET_CHAR_PROOFS the same five proofs the car and
  object commands set, and MARK_CHAR_AS_NO_LONGER_NEEDED leaves the ped in the world for the streamer.
- Port: the runtime keeps no ped state at all. A host owns its peds and answers for them by handle, and every
  adapter method mirrors the body of the command that calls it, including the two decisions the commands make
  themselves: a missing handle is dead, and a health of nothing kills. Without a host these commands fail
  rather than guess.
- Verification: `tests/scm-chars.test.ts` runs the script's own CREATE_CHAR against a stand-in world, then
  assembles the rest to check the dead test in all three states, the kill rather than set, the move and read
  back, the release, the proofs and accuracy, and the explicit failure with no host.
- This is the largest family in the script: with it the runtime covers 81.4% of MAIN.SCM's instructions, up
  from 77.0%.

### The vehicles a script holds (VehicleCommands.cpp)

- Source: gta-reversed ead3051. `CCarCtrl::CreateCarForScript` (0x431F80) is reversed: a point at or below the
  map's low limit drops to the ground, the car is lifted off the base of its model, placed on the road when it
  is not a mission car, locked, left abandoned with the engine off and joined to the road system. The ped side
  is reversed too: a ped is in a car while it holds one at all, even opening or closing the door, and in a
  particular car or model when that is the one it holds.
- Port: the same shape as the peds. A host owns the vehicles and answers by handle; the runtime keeps the parts
  the commands decide for themselves, including the heading that is degrees to the script and fixed into range
  on the way in and out. What counts as a wrecked car is the host's, since that dispatch is not reversed; the
  runtime only keeps the half the ped equivalent shows, that a handle naming nothing is dead.
- Verification: `tests/scm-cars.test.ts` runs the script's own CREATE_CAR against a stand-in world, then
  assembles the rest to check the dead test in all three states, the heading fixed both ways, the move, read
  back, proofs and release, and a ped tested against the car it holds, another car and a model.
- With this family the runtime covers 83.9% of MAIN.SCM's instructions, up from 81.4%.

### The tasks a script hands a ped

- Source: gta-reversed ead3051. `CRunningScript::GivePedScriptedTask` (0x465C20) is reversed, and with it the
  four task commands whose dispatch is: the two kill-on-foot forms, the turn to face, and the immediate flush.
  The routine's first branch is the one that matters here: a ped handle of -1 does not name a ped at all, and
  the task joins the sequence being recorded instead. Otherwise the ped takes the task and keeps the command
  that asked for it beside it, which is what GET_SCRIPT_TASK_STATUS reads later.
- Port: the runtime describes the task rather than building it, since the tasks belong to a host, and makes the
  handle decision itself. The kill task carries the arguments the reversed handlers pass, with the plain form's
  zero flags, delay and chance and the ducking form's own.
- Verification: `tests/scm-tasks.test.ts` checks the task reaching a ped with its command number, the ducking
  form's arguments, the handle of -1 going to the sequence instead, the immediate flush, and both commands
  failing rather than dropping a task when no host is there.

### Locating a ped (the LOCATE_CHAR family)

- Source: gta-reversed ead3051, `CharacterCommands.cpp`'s locate helpers, reversed. The area is a box around a
  point with a radius per axis, not a sphere, and the flat forms ignore height entirely. The ped is read at its
  vehicle's position while it rides in one, since that is what GetCharCoordinates answers. Before any of that,
  the command's own gates apply: whether the ped must be in a car, must be on foot, or must be stopped. The
  last operand asks for the area to be highlighted, and the source draws it whatever the answer turns out to be.
- Port: twelve commands, the three gates against a named point and against another ped, in two and three
  dimensions, over the ped adapter the char family already uses. The highlight is an optional host call.
- Verification: `tests/scm-locate.test.ts` checks the box rather than a sphere, height ignored by the flat form
  and not by the other, both gates in both states, the char forms measuring from the other ped, and the
  highlight happening on a miss.

### The rest of the reversed ped commands

- Source: gta-reversed ead3051, `CharacterCommands.cpp`. Nine more commands whose dispatch is reversed: the
  decision maker a ped answers events with, the area it is visible in, the never-target flag, the current
  weapon, the damage question, both warps, the animation question and the scripted speech gate. Two carry
  decisions worth keeping: the damage counts when that ped dealt it or when the vehicle that ped rides in did,
  and the speech gate takes its ped as a pointer and returns early when there is none, so a handle the world
  does not know is a no-op rather than a failure.
- Port: each one reaches the world through the ped adapter, with the damage test assembled in the runtime from
  the last damage and the other ped's vehicle.
- Verification: `tests/scm-ped-commands.test.ts` covers the four setters, the damage test in all four states
  including the car that stands in for its rider, both warps, and the animation and speech pair.

### Ped flags, health, attachment and areas

- Source: gta-reversed ead3051, `CharacterCommands.cpp`. Fourteen more reversed commands. Three carry a
  decision: the critical-hits command stores the opposite of its own sense, because the field is a no-critical
  flag; sitting in a car is more than holding one, since the ped must have the sitting task as well; and
  storing the car a ped rides throws when the ped is on foot rather than writing anything, so the runtime stops
  there too. The two area tests take a pair of corners rather than a point and a radius, in either order, and
  read the ped at its vehicle while it rides in one.
- Port: the flags, the health, the attachment with its angle in radians, and both area tests, all through the
  ped adapter.
- Verification: `tests/scm-ped-flags.test.ts` covers each flag reaching its own field, the health truncated to
  a whole number, sitting against merely holding, the throw on a ped on foot, the attachment's five arguments,
  and the corners given in both orders.

### More vehicle commands, and a correction to the car generator switch

- Source: gta-reversed ead3051, `VehicleCommands.cpp`. Reading it properly turned up a mistake in the earlier
  car generator port: SWITCH_CAR_GENERATOR does not treat 101 as a special value. Any count at all switches the
  generator on, which means always, and only then is a count of a hundred or fewer written over that. The
  script's 101 is simply the first count the overwrite leaves alone. A count of 150 therefore means always,
  where the earlier port would have spawned a hundred and fifty cars. Fixed, with the reversed handler cited.
- Ported with it: the speed a script reads, which is the move speed times fifty, the driving style, the two
  extra paint slots, the helicopter audio and orientation, the remote car, the in-the-air question, the
  generator's owned flag, and the rail track resistance, which takes its own default back for any multiplier at or
  below nothing.
- The train station skip has its opcode handler only. The live host has no trains (CTrain is unported and
  SkipToNextAllowedStation unreversed), so a thread reaching it gives up. The same holds for every train command:
  CREATE_MISSION_TRAIN, SET_TRAIN_(CRUISE_)SPEED, SWITCH_RANDOM_TRAINS, GET_TRAIN_CARRIAGE and the rest.
- Left out on purpose: the two car colour questions and the boot pop. Their handlers are reversed, but the
  pinned opcode table carries no operand list for them, so the decoder could not read their arguments. They do
  not appear in MAIN.SCM, which is why its decode has never tripped over them.
- Verification: `tests/scm-vehicle-commands.test.ts` covers the readers, the four world calls, the resistance
  default at zero and below, and the generator count in all four cases including the one the correction fixes.

### The sequences a script records (CTaskSequences)

- Source: gta-reversed ead3051. `CTaskSequences` (0x632D90, 0x632DD0) and the container half of
  `CTaskComplexSequence` are reversed: sixty-four sequences, each holding eight tasks, with a ninth dropped
  rather than stored, and a flush that takes the progress and the repeat mode with the tasks. The four command
  dispatches are not reversed, so each one names the static it reaches. SET_SEQUENCE_TO_REPEAT is reversed, and
  it does something worth keeping: it checks the index it is given, then sets the repeat mode of the *active*
  sequence rather than of the one it just checked.
- Port: `src/engine/ScmSequences.ts` holds the table and `ScmGameState` owns it. A task recorded with a ped
  handle of -1 now lands in the runtime's own active sequence rather than going out to a host, which is where
  the static actually lives. Performing a sequence hands its tasks and its repeat flag to the ped through the
  host.
- Verification: `tests/scm-sequences.test.ts` covers opening emptying the slot first, closing leaving nothing
  active, the eight-task limit and the dropped ninth, clearing taking the repeat mode with it while leaving the
  slot open, the repeat command's misdirected index, performing with both tasks and the repeat flag, and the
  initialise that puts everything back.
- This was the largest family left: coverage reaches 87.9%.

### The one-field commands

- Source: gta-reversed ead3051. Thirteen commands whose own dispatch is not reversed but whose field the
  reference names: the weapon a ped is given, its maximum health and shoot rate, the two relationship commands,
  the task clear that lets a ped finish what it is doing rather than flushing it, a car's health, freeze and
  door lock, and the car density, widescreen and area statics.
- Port: each reaches its field through the world, except the three statics, which sit on the game state beside
  the ped density already there. The two task clears stay separate, since one is the immediate flush and one
  is not.
- Verification: `tests/scm-field-commands.test.ts` covers all thirteen, including the car health truncated to a
  whole number on the way out and the immediate flush refusing a host that only answers the ordinary clear.
- The runtime now executes 89.3% of MAIN.SCM's instructions, and the reversed-handler pool the census found is
  effectively exhausted: what remains is either unreversed in the reference or needs data the browser does not
  publish.

### Commands over reversed engine routines

- Source: gta-reversed ead3051. Four commands whose own dispatch is not reversed but whose engine routine is:
  `CWorld::ClearExcitingStuffFromArea` (0x56A0D0) clears the peds, cars and objects in a radius that may be
  deleted, leaving the player and their group alone, with a flag for the projectiles and shadows;
  `CEntity::TransformFromObjectSpace` (0x5334F0) takes an offset through an entity's own right, forward and up
  rows into the world, which is what the car offset and the object placement both use; and
  `CPedScriptedTaskRecord::GetStatus` (0x608710) answers with the status held for that ped and command, or none
  at all when it holds nothing.
- Port: the transform is done in the runtime, since it is arithmetic over a matrix the host hands over, and the
  object placement writes to the script's own object table rather than out to the world.
- Verification: `tests/scm-world-routines.test.ts` checks the clear's three arguments, both axes of the
  transform against a car turned a quarter turn, the object moved to the right place, and the status for a
  command the record holds and one it does not.

### Recorded car paths (CVehicleRecording)

- Source: gta-reversed ead3051, `VehicleRecording.cpp`, whose script-facing routines are reversed. A file is
  requested by the number the script names it by and is only loaded once the streamer has it. Starting a
  playback takes the first idle of sixteen slots, at speed one from the start, and holds a reference to the
  file; stopping gives both back. A file still held is not removed. Pausing, unpausing and the speed reach the
  slot the car plays in, and a car with no playback is left alone rather than failing.
- Port: `src/engine/ScmVehicleRecordings.ts` keeps the files and the sixteen slots; reading the file and
  driving the car along it are the host's. The three start commands differ only in whether the car uses its
  own AI and whether the path loops.
- Verification: `tests/scm-vehicle-recordings.test.ts` covers the request before and after a load, the slot and
  reference taken and given back, a held file surviving a remove, the three start forms, pausing and the speed,
  a car that is not playing, and the sixteen slots filling up.

### Animation blocks (CAnimManager)

- Source: gta-reversed ead3051, `AnimManager.cpp`: blocks are found by name without regard to case
  (0x4D3940), and the reference count rises and falls with `AddAnimBlockRef` (0x4D3FC0) and
  `RemoveAnimBlockRef` (0x4D3FD0). The record itself carries the name, a loaded flag and that count.
- Port: `src/engine/ScmAnimBlocks.ts` keeps the table; streaming the file in is the host's. Each request holds
  the block and each remove lets one hold go, with the block counting as unloaded once nothing holds it. The
  source decrements without a floor, which cannot underflow here.
- Verification: `tests/scm-anim-blocks.test.ts` covers the request before and after a load, the case-insensitive
  match keeping one block rather than two, two holds released one at a time, and a remove for a block nobody
  asked for doing nothing.

### Custom number plates for the next car

- Source: gta-reversed ead3051, `CVehicleModelInfo::SetCustomCarPlateText` (0x4C8980), reversed. The plate
  field holds eight characters and a terminator, and the reference notes that the original truncates what it is
  given to fit; this port truncates, since the browser follows retail. The design sits beside the text as the
  model's plate type.
- Port: the plates live on the game state keyed by model, which is where `CVehicleModelInfo` keeps them, so the
  next car of that model takes what the script set.
- Verification: `tests/scm-custom-plates.test.ts` covers a plate cut to eight characters, a short one kept as
  it is with its design beside it, and two models keeping their own.

### Peds created straight into a car

- Source: gta-reversed ead3051, `CPopulation::AddPedInCar` (0x613A00), reversed: a ped created into a seat of a
  car, as its driver or in the seat the script names. The routine substitutes its own model for the emergency
  vehicles, a fireman for the fire truck, a medic for the ambulance, a cop type for each police model and a
  gang model for a gang rating, but those read streaming defaults and gang tables the browser does not carry,
  so they stay with the host.
- Port: the three commands reach the host, one with the ped type and model the script names, and two asking for
  a civilian occupation the game picks, one into the driver's seat and one into a named seat.
- Verification: `tests/scm-chars-in-cars.test.ts` covers the named form's arguments and its handle written back,
  both random forms with their seats, and the explicit failure when no host is there.

### Locating a car

- Source: gta-reversed ead3051. The car locate commands' own helper is not reversed, but the char one is, and
  these have its shape: a box around the point with a radius per axis, the flat form ignoring height, and the
  area highlighted whatever the answer turns out to be. `CTheScripts::IsVehicleStopped` (0x469440 region) is
  reversed and is what the stopped forms would ask, when they are ported.
- Verification: the two forms are covered in `tests/scm-locate.test.ts` beside the char ones, including the
  height the flat form ignores and the highlight on a miss.

## The original script runs inside the game

Until now the script runtime was a library with tests beside it. `src/simulation/ScmMission.ts` puts it in the
game: once the world source hands over `main.scm`, CGame::Initialise's start of MAIN happens for real, and
CTheScripts::Process runs a frame at a time inside the frame loop. A command the runtime has not ported stops
the script where the original would have carried on, and the stop is kept and reported rather than swallowed.

What the published game now does on boot, from the script itself rather than from a static reading of the file:
fades in, creates the player where the script puts them and turns them to face the heading it asks for, sets
the twenty-two ped-type relationships, the clock to eight in the morning, the wanted ceiling, the mission and
progress totals, and launches INITIAL. INITIAL then stops at CREATE_LOCKED_PROPERTY_PICKUP, which needs
`CPickups::GenerateNewOne`, a raw call into the executable.

The browser adapter answers what the opening asks for: the fade, the scene load, the player's placement and
heading, the camera hand-back and the riot flag. The zone table is loaded with the world's real 378 info zone
labels, so the zone commands that follow will land on them.

- Verification: `tests/browser/native-script-runtime.spec.ts` boots the published game, waits for the script to
  start and then to stop, and checks the clock, the relationship count, the wanted ceiling, the mission and
  progress totals, the zone table, both threads by name and the command it stopped at. `streaming-drive` still
  passes with the script running.

### The script's pickups

- Source: `CPickups::GenerateNewOne` (0x456F20) is one of the routines the reference still calls into the
  executable, so the slot allocation and merging behind it are not known. What is known, and what
  `src/assets/scmPickups.ts` has read the file with all along, is each command's operand layout and the model
  and pickup type the commands without a model operand imply. These commands place the same records while the
  script runs, rather than the file only being read statically.
- Port: `src/engine/ScmPickups.ts` holds them, with the money, protection, property, snapshot, horseshoe and
  oyster forms carrying their own type, and the ask, collect and remove commands over the same table.
- Verification: `tests/scm-pickup-commands.test.ts` runs the script's own locked property pickup, checks its
  label and type, and shows INITIAL now carrying through its pickups to the entry-exit flag beyond them.
- Frontier: INITIAL now stops at SET_CLOSEST_ENTRY_EXIT_FLAG, which the published game reports too. Coverage
  reaches 91.3%.

### Entry-exits and garages, and how far the opening now runs

- Source: gta-reversed ead3051. The garage routines are reversed: `GetGarageNumberByName` (0x447680) looks a
  garage up by name ignoring case and answers -1 for one this world does not carry, which is what lets a
  script run past a garage that is not there; `ActivateGarage` (0x447CD0), `DeActivateGarage` (0x447CB0),
  `ChangeGarageType` (0x4476D0) with its door reset for the lower types, and the open and closed questions
  follow. The two entry-exit commands take the operand layouts `src/assets/scmEntryExits.ts` already reads the
  file with; applying a flag to the nearest entry-exit is the host's, since it holds them.
- With these the opening runs a long way further. In the published game it now places 45 pickups, both restart
  tables, all 70 stunt jumps, 10 car generators, 30 entry-exit flags and 13 objects before stopping at
  ROTATE_OBJECT, a timed rotation the reference does not reverse. The game's own ground lookup answers
  CWorld::PutToGroundIfTooLow for the objects; the lift off the base of the model waits on the streamer
  knowing the model's bounds, so an object sits with its origin on the ground until then.
- Verification: `tests/browser/native-script-runtime.spec.ts` pins all of those figures and the command it
  stops at. Coverage reaches 91.4%.
- One conflict found by running the rest of the browser suite: CREATE_PLAYER moved the player to the script's
  own start, which fought the browser's placement and broke the two prop-smash specs, where the player could no
  longer reach their car. The browser has already placed the player by the time the script runs, from its own
  start, a restart point or a save, so the script's creation point is now recorded and reported rather than
  applied. The specs pass again and the point itself is asserted.

### One thread giving up no longer stops the script

The runtime used to throw out of the whole scheduler when any thread met a command it had not ported, so the
first gap ended everything. `ScmRuntime.onUnsupported` now lets a host hear about it: that thread is retired
where the original would have carried on, and every other thread runs on. Without a handler the command still
throws, so the unit tests that pin each frontier keep working.

In the published game the three opening threads now each give up on their own command rather than the first one
taking the others with it: INITIAL at ROTATE_OBJECT, MAIN at ALLOCATE_STREAMED_SCRIPT_TO_OBJECT and INITIL2 at
SET_OBJECT_ROTATION, none of which the reference registers anywhere. MAIN and INITIL2 running on took the car
generators from ten to twelve and the objects from thirteen to fourteen, and the second initialisation mission
runs at all for the first time.

- Verification: `tests/browser/native-script-runtime.spec.ts` asserts the three give-ups in order with their
  commands, that nothing stopped the script outright, and the state each thread reached.

### The second initialisation mission runs to its end

Two more commands, and INITIL2 finishes rather than giving up:

- SET_OBJECT_ROTATION is `CPlaceable::SetOrientation`'s three angles, kept in radians, with the heading
  following the one about the vertical axis, fixed into range as SET_OBJECT_HEADING does.
- CREATE_CAR_GENERATOR_WITH_PLATE is the same generator with a plate registered for it in
  `CSpecialPlateHandler` (0x6F2D90, reversed), which holds fifteen entries of a generator id and its text and
  drops a sixteenth. The plate text is the operand before the handle, which a first attempt had the wrong way
  round: the runtime's string reader refused the handle's global, which is how the mistake surfaced.

With those the published game's opening places 105 car generators and 17 objects, up from twelve and thirteen,
and only two threads give up: INITIAL at ROTATE_OBJECT and MAIN at ALLOCATE_STREAMED_SCRIPT_TO_OBJECT, neither
of which the reference registers anywhere.

## Both initialisation missions run to their end

Four more commands took INITIAL from giving up to finishing, and with it the zone population block it had never
reached:

- ROTATE_OBJECT is registered nowhere in the reference, so only what the script does with it is known: its one
  use turns an object from ninety degrees to ninety with the collision check off, which finishes at once. The
  runtime sets the heading and reports the rotation done, and refuses a call whose two angles differ, since that
  would need the handler to say how it steps between them.
- SET_OBJECT_AREA_VISIBLE is CEntity::SetAreaCode, the same field the reversed char command sets for a ped.
- CONNECT_LODS is CEntity::SetLod, pointing a detailed object at the one that stands in for it far away.
- GET_OFFSET_FROM_OBJECT_IN_WORLD_COORDS is the car offset's twin over the object's own rows, which
  `CMatrix::SetRotate` builds from its three angles.

In the published game the opening now runs from the fade to the end of both initialisation missions: 208 car
generators, 60 objects, 41 entry-exit flags, both restart tables, all 70 stunt jumps, the pickups, and the
population of 292 zones set by the script rather than read from the file. Only MAIN gives up, at
ALLOCATE_STREAMED_SCRIPT_TO_OBJECT, whose command the reference does not register and whose record it documents
but does not fill.

## The script brains, and the variable bits that start the whole thread set

MAIN's remaining block hands streamed scripts to the things that should start them, and then the game's flow
threads open. Five families carried it through:

- CScriptsForBrains' seventy slots, in `src/engine/ScmScriptBrains.ts`. Only
  `GetIndexOfScriptBrainWithThisName` (0x46AA30) is reversed, not `AddNewScriptBrain`, so the operand mapping was
  grounded in MAIN's own calls rather than guessed: the allocations all read
  `[[4,4],[4,-4],[4,100],[6,6],[4,1]]`, which is a streamed script index, a negative model meaning a used-object
  name, a percentage chance, an activation radius as a float and a grouping id, in the order the record declares
  them. SWITCH_OBJECT_BRAINS turns every object brain of a grouping on or off together and leaves ped and
  code-use brains alone.
- ATTACH_ANIMS_TO_MODEL is `CBaseModelInfo::SetAnimFile`, the block a model takes its animations from.
- REQUEST_IPL, REMOVE_IPL and REMOVE_IPL_DISCREETLY are `CIplStore::RequestIplAndIgnore` (0x405850) and its two
  removals, recorded by group name.
- SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE finds a world object, so it is a host call like the ground lookups.
- The eighteen variable-bit commands (0x8B4-0x8C5) are set, clear and test over a global or a local variable,
  with the bit given as an immediate, from a global, or from a local. The dispatch is unreversed, but nothing
  outside the script's own variables is reached, and the operand shapes are unambiguous in the file: the first
  operand is always the variable itself, including the array forms, and the second is always the bit. A shift
  count is masked to five bits, as the instruction it compiles to is.

Those bits are what the flow threads branch on, so porting them opened the whole set at once. The published
game's opening now starts twenty-four threads: fifteen are still running their own waits, and nine have each
stopped at the first thing they need from a world the browser does not answer for yet, which is peds and
vehicles a started game would already hold. MAIN itself reaches GIVE_PLAYER_CLOTHES_OUTSIDE_SHOP, past the
second wanted ceiling it sets, which is why the snapshot now reports four rather than six: the script sets six
at 56008 and four at 59814, and five only much later.

Coverage of the original script is 91.59% of 360,439 instructions, over 548 distinct opcodes, with 907 still
unhandled. The largest remaining groups are mission audio (about 4,600 instructions across six commands) and the
task constructors, both of which need operand meanings the reference does not document.

## The cheat table, the pad shake, and the player's own ped

`Scripts/Commands/GameCommands.cpp` is fully reversed, and four of its commands were still missing:

- ARE_ANY_CAR_CHEATS_ACTIVATED is `CCheat::IsAnyActive` over perfect handling, cars on water and boats fly. The
  two cheats the script switches itself, all taxis having nitro and the pimp cheat, had been two loose booleans;
  they are entries of `CCheat::m_aCheatsActive` like the rest, so they now share the one table in
  `src/engine/ScmCheats.ts`. Neither has a cheat function of its own, so applying one is setting its flag.
- SHAKE_PAD is `CPad::StartShake`, which keeps two of its own oddities. A shake is only taken up while one is
  already running, because the body guards the assignment with the duration it is about to overwrite, so a first
  request sets the delay and the frequency but no duration. And the delay it remembers is compared against a
  later request's frequency, so a stronger shake gets through early while a weaker one is dropped.
- IS_XBOX_VERSION is false in this build, and DO_DEBUG_STUFF counts itself and does no more.

The jump and taxi stat registrations in the same file are registered as unsupported there, so retail did nothing
with them; our command table also gives them no parameters, which would make them undecodable anyway. They stay
out.

The larger change is that the browser now answers the script's questions about the player's ped. Nine threads had
each stopped at the first ped they needed. `ScmMissionWorld` gained one method for the player's ped, reporting
its native position, the vehicle it is in, whether it has stopped, its health and whether it is dead;
CTheScripts::IsPedStopped asks a vehicle whether its moving speed is under a step's worth and a ped on foot
whether it is standing in place and on the ground, which the browser's own speed and grounded flag answer. A
handle the browser does not hold retires that thread rather than being answered with an invented ped.

The opening now runs twenty-four threads, nineteen of them still waiting, and five give up: GET_CHAR_AREA_VISIBLE,
IS_CHAR_IN_ANY_TRAIN, GIVE_PLAYER_CLOTHES_OUTSIDE_SHOP, LOCATE_CHAR_ANY_MEANS_OBJECT_2D and
CAN_PLAYER_START_MISSION. Coverage is 91.594% over 550 distinct opcodes.

## What the script asks about a ped, and what the player is wearing

Fourteen more commands, all of them reversed in `Scripts/Commands/CharacterCommands.cpp` and
`PlayerCommands.cpp`:

- The six locate-char-object commands are LocateCharEntity2D and its 3D twin, which pass the entity's position
  straight to the locate routines the runtime already has. The objects are the runtime's own, so nothing outside
  it is asked.
- IS_CHAR_ON_ANY_BIKE, IS_CHAR_IN_ANY_BOAT, IS_CHAR_IN_ANY_HELI and IS_CHAR_IN_ANY_PLANE are
  IsPedInVehicleOfAppearance against one entry of eVehicleAppearance each, and IS_CHAR_IN_FLYING_VEHICLE is the
  heli question or the plane one. IS_CHAR_IN_ANY_TRAIN has no appearance to match, and the reference leaves its
  handler unregistered, so it asks CVehicle::IsSubTrain, which is the only test the engine has for one.
- GET_CHAR_AREA_VISIBLE returns a comparison rather than the area code its own documentation promises: the
  variable takes one when the ped is anywhere but the normal world.
- CAN_PLAYER_START_MISSION is CPlayerPed::CanPlayerStartMission, whose eight gates the runtime combines itself
  while the host reports what it can see. The browser's game logic state and the player's health carry the first
  and the last; a knockdown stands for the physical response task and a climb for a primary task that is not
  driving. It has no coop game, no event responses and no script commands given to the player, so those are
  none, and the doc comment says so rather than leaving it to be guessed.
- GIVE_PLAYER_CLOTHES is CPedClothesDesc::SetTextureAndModel, which needed CKeyGen first: the game's name hash
  is CRC-32-IEEE seeded with every bit set and left as its own remainder, with no final inversion, so a key is
  the standard CRC of the uppercased name inverted back. `src/engine/nativeKeyGen.ts` builds the table from the
  polynomial rather than copying it, and the test pins three values against that identity. The outside-shop twin
  takes the same four operands and dresses the same description; its handler is unregistered in the reference,
  so what is kept beyond the dressing is that the script asked for it away from a shop.

The opening now runs its whole thread set with only two give-ups, BUILD_PLAYER_MODEL in MAIN and
IS_PLAYER_CONTROL_ON in HJ, and twenty-two threads waiting on their own timers. Coverage is 91.65% over 563
distinct opcodes.

## CPlayerInfo's own fields, and the control the script takes away

`Scripts/Commands/PlayerCommands.cpp` is reversed end to end, and twenty-eight of its commands were missing.
Most are one field each, so they went into `src/engine/ScmPlayerInfo.ts` with CPlayerInfo::Clear's own defaults:
never gets tired, fast reload, fire proof, can do drive-by, the two maxima, the sprint and group switches, the
drunkenness and its fade, CWanted's two back-off flags, CGameLogic's four two-player statics, and the crane
CRopes hands the player. Three commands keep a detail worth naming:

- Recruitment and the four button commands are stored the other way round from what the script asks: the script
  enables a button and the pad remembers it as disabled, which is the field the source writes.
- Only three of the four crane commands switch the water fog. The quarry crane leaves it alone.
- Both back-off commands stop every law enforcer where it stands, but only as they go on.

SET_PLAYER_CONTROL is MakePlayerSafe with the state inverted, and that routine sets the pad's own safe flag,
clears the damage flag and makes everybody back off before it reaches the ped. IS_PLAYER_CONTROL_ON, whose own
handler the reference does not register, is that same flag read back, which is what makes it portable at all.

CShopping's two clothes-state commands keep an original bug. The store copies the description aside and raises a
flag; the restore points a local at the stored copy, never writes it back, and lowers the flag, so the clothes
never return. The test says so in as many words, so a later reader does not take it for a mistake here.

The published opening now starts twenty-six threads. Twenty-three are waiting on their own timers, and three
give up: INTRO at LOAD_MISSION_TEXT, GFAGNT at SHOW_UPDATE_STATS and MAIN at GET_AREA_VISIBLE, having dressed
the player, asked for their model to be rebuilt and left them in control of themselves. Coverage is 91.78% over
584 distinct opcodes.

## Mission audio, which turned out not to be blocked after all

An earlier pass recorded mission audio as unportable because the operand meanings were not documented. That was
wrong, and the census that found it is worth keeping: sweeping every `REGISTER_COMMAND_HANDLER` in the
reference's command files against our opcode table and the script's own usage counts found 247 reversed commands
the script uses and this runtime had not ported, 8,308 instructions in all. Mission audio was the top of that
list.

The command layer is reversed in `Scripts/Commands/ScriptCommands.cpp` and the slot interface in
`Audio/AudioEngine.h`; only the mixing behind them still calls into the executable, which the script never sees.
`src/engine/ScmMissionAudio.ts` keeps the four slots of CAEScriptAudioEntity with two details that are easy to
lose: the script numbers its slots from one and every command subtracts one before the engine sees it, and an
empty slot reads -1 in its event, bank and bank-slot fields rather than zero. Playing a slot that has not
finished loading does nothing. The two questions with no slot operand, whether any audio is playing and whether
any is loading, ask about all four at once, which is the only reading their empty operand list allows.

Four smaller commands went in beside it: the day of the week is CClock::CurrentDay, which the runtime's clock
already kept; GET_AREA_VISIBLE reads back the same CGame::currArea its setter writes; SHOW_UPDATE_STATS is
CStats::bShowUpdateStats; and GET_CITY_PLAYER_IS_IN is the map zone's own level at the player, which the
browser's zone reader already answers.

Coverage jumps from 91.78% to 93.12% of 360,439 instructions, over 600 distinct opcodes. In the published game
MAIN now reaches HAS_CHAR_GOT_WEAPON and is the only thread to give up; twenty-five others are waiting, the
intro and the game's own flow among them, and INTRO has loaded its block of mission text.

## The ped questions, and MAIN stops giving up

The census that found mission audio had one flaw worth recording: it counted commented-out registrations, since
the reference leaves many `//REGISTER_COMMAND_HANDLER` lines beside the live ones. Filtering those out drops the
list from 247 commands to 164, worth 3,189 instructions. Eighteen of them went in here, each following its own
reversed body:

- The three weapon questions. A ped carries a weapon when any slot holds that type; the current weapon matches
  by type, with WEAPON_ANYMELEE matching any melee one; and the damage question treats its two wildcards apart,
  where a ped last damaged by the unidentified type counts as damaged by no weapon. Those wildcards sit at the
  end of eWeaponType, at 56 and 57, which a first attempt had two too low.
- Three of the four ped flags are stored the other way round from the command that sets them: allowed to duck,
  drops weapons when dead and, from the player set earlier, the buttons.
- The speech commands read backwards from their names as well: shutting a ped up disables its speech.
- An animation the ped is not playing leaves GET_CHAR_ANIM_CURRENT_TIME's variable at nothing, which is what the
  source returns rather than an error.

The browser then answers the weapon questions from the player's own inventory, which holds one entry per weapon
picked up, and the catalog says which are melee. With that, MAIN stops giving up altogether. The only thread
that still does is INTRO, at the cutscene it wants to load, and twenty-five threads are running.

Coverage is 93.52% of 360,439 instructions over 622 distinct opcodes, up from 76.0% when this runtime was first
wired into the published game.

## The camera's two linear runs, and locating by a car

Eleven more, all from the reversed command layer:

- CAMERA_SET_VECTOR_TRACK and CAMERA_SET_VECTOR_MOVE fill fields CCamera::InitialiseScriptableComponents already
  declared here. Their own routines still call into the executable, so only the fields are known, which is
  enough: two points, a window and whether it eases. Both commands give the script's from first and its to
  second while both routines take the to first, so the pair is swapped on the way in; keeping the script's order
  would put the camera at the wrong end. The track's duration is a whole number of milliseconds and the move's
  is a float.
- POINT_CAMERA_AT_CAR is CCamera::TakeControl over a vehicle, in the mode and with the switch the script chose.
- GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS is the third of the object-space transforms, beside the car and object
  forms already here.
- HAS_CHAR_SPOTTED_CHAR is CPed::OurPedCanSeeThisEntity with the flag that counts a ped behind this one.
- The six locate-char-vehicle commands are LocateCharEntity2D and its 3D twin once more, over a car.

Coverage is 93.70% over 633 distinct opcodes; 822 opcodes in the file remain unhandled.

## The rest of the ped's own state

Eighteen more, again one reversed body each. Three carry a detail worth keeping:

- GET_CHAR_HEADING goes through GetPedOrItsVehicle, so a ped riding a car reads the car's heading rather than
  its own.
- HAS_CHAR_BEEN_PHOTOGRAPHED lowers the flag as it answers, so asking twice in a row gives yes then no.
- START_CHAR_FIRE is CFireManager::StartScriptFire at the ped's own position, at eight tenths strength and one
  generation, which the command fixes rather than taking from the script.

The rest are plain: the water flag, visibility, bleeding, drowning and never leaving a group, the ped's own
speech pair (which unlike the blanket form can stop what it is saying), the weapon clearing and ammo, the money,
the car a ped is using or climbing into, a passenger seat's occupant, the warp into one, and the stuck-car check
removal. Where the source returns nothing, the script's variable is left at nothing rather than an error: no
weapon of that type means no ammo, and a ped in no car leaves the car variable empty.

Coverage is 93.82% over 651 distinct opcodes. The census now lists 118 reversed commands still unported, worth
about 1,000 instructions, so this vein is nearly exhausted; what remains beyond it is commands the reference
does not reverse at all.

## Making the script runtime cheap enough to run every frame

The published game now drives the original script in the frame loop, so its cost is the browser's cost. Measured
first, in the game itself: 0.094 ms a frame, about 5.7 ms of CPU a second at sixty frames, out of the roughly
206 ms a second the whole engine was measured at while driving. Small, but it was the newest thing in the loop
and nothing had ever looked at it.

A Node profile of the same work, stepping the real script 40,000 times, put about three quarters of the time in
decoding instructions rather than running them: the plain decoder builds a `BinaryReader` per instruction and
that reader takes a subarray per byte read. Two changes followed, each measured on its own:

| Change | ms per frame (Node, best of five) |
|---|---|
| Before | 0.0684 |
| Allocation-free decoder for the execution path | 0.0538 |
| One scratch word for the parameter union, and no array literal per read | 0.0306 |

The decoder change adds `decodeScmInstructionInto`, which reads straight from a DataView and refills a record
the thread owns, pooling the parameter objects between instructions. The plain decoder stays for the tools that
read a whole block, which want their own objects. The second change removed a `new DataView(new ArrayBuffer(4))`
and an `[1,4,5,6].includes(type)` from every immediate operand read, which was over half the remaining time.

A third change was tried and rejected on measurement: sharing one record for the variable-lookup result instead
of returning a fresh `{view,offset}`. It measured 0.0398 against 0.0306, so the engine was already eliding that
allocation and the shared field writes cost more than they saved.

In the browser the frame cost fell from 0.094 ms to 0.045 ms, about 2.7 ms of CPU a second given back. To
reproduce: `window.__game.missionForProfiling()` hands a measurement the mission so it can be stepped on its
own, and the Node profile is a compile of `src/simulation/ScmMission.ts` driven under `node:inspector`.

## The tilted rectangle the angled-area commands test against

notsa::shapes::AngledRect is reversed, so the six angled-area commands port whole. The script gives two corners
and a signed width: the rectangle runs from A to B and the width is laid off perpendicular to that line, to the
left when it is positive and to the right when it is negative, with the sign choosing only the side. A point is
inside when it projects onto both directions within their extents, so the test needs no corner list.

Two details are easy to get wrong and are pinned by tests. CVector2D::Normalise leaves a zero-length vector
pointing along x rather than at nothing, so a rectangle whose corners are the same still has a direction and
holds only that one corner; a first attempt left it at nothing, which made every point inside. And the source
highlights the area whether the ped is in it or not and whether the in-car and on-foot checks passed or not,
folding a failed check into the same "outside" answer rather than skipping the test.

The three-dimensional form adds a height band between the two corners' own heights, taken in either order.

Six stopped forms of the locate commands went in beside them; the runtime's own locate gate already knew how to
ask whether a ped had stopped, so they needed only wiring. SET_PLAYER_IS_IN_STADIUM is
CTheScripts::bPlayerIsOffTheMap.

Coverage is 93.86% over 662 distinct opcodes.

## The decision makers, and what to do when the slot allocator is not reversed

LOAD_CHAR_DECISION_MAKER was the largest single command left, at 169 uses. Its own body is reversed, and so is
the name table it goes through: five ped files and one group file, chosen by the type the script names. What is
not reversed is `CDecisionMakerTypes::AddDecisionMaker`, which still calls into the executable, so the slot it
picks and the number it hands back are unknown.

That number is opaque to the script. It stores the handle and passes it to the commands that dress a ped or a
group; it never reads it. So the slots are allocated here, in the order the script asks, after the ten the game
builds in, and wrapped in the same script-thing handle every other table uses. The decisions themselves live in
files this port does not publish, and choosing between them belongs to a host, so only what the script can see
is kept: the type, the file that type reads, and whether the thread that loaded it uses mission cleanup.

A type outside the name table loads nothing rather than failing, which is what the file reader's own warning
path comes to. The table holds twenty, ten of them the game's own, so a script can load ten before it is
refused.

Coverage is 93.93% over 665 distinct opcodes, and the census is down to about 106 reversed commands.

## Past nine tenths: targeting, boxes, and the last commands with bodies of their own

Seventeen more, which take the runtime past 94%. Four keep a detail:

- IS_CHAR_HEALTH_GREATER compares with greater **or equal** although it is named for greater, which the source
  is plain about and the test pins.
- POINT_CAMERA_AT_CHAR hands the camera the ped only when it is the player's own; any other ped gives it no
  entity at all, so the two cases are not the same call with a different argument.
- IS_EXPLOSION_IN_AREA sorts the two corners itself, so the script may give them either way round.
- SET_OBJECT_ANIM_CURRENT_TIME scales its progress by the animation's own speed, while the ped form scales by
  the animation's length. The two look like the same command and are not, so each has its own adapter.

The rest are plain host calls: the three targeting questions over what the player is aiming at, the two
stuck-car checks (the plain one leaving the warp's four switches at nothing), the attach to an object with its
angle limit in radians, the dead ped's pickup point, the current weapon, the signal-after-kill flag, the group
follow switch, the info-zone question and the object animation trio.

Coverage is 94.01% of 360,439 instructions over 684 distinct opcodes, from 76.0% when this runtime was first
wired into the published game and 91.47% at the start of this session's work. The census is down to about 89
reversed commands, none of them used more than sixty times.

## The touching questions, the unit boundary, and the in-car camera

Nineteen more. Three groups carry something worth keeping:

- All three touching questions ask of the car a ped rides rather than the ped itself when it rides one, which is
  what GetPedOrItsVehicle does for them. One adapter serves all three, taking the kind of thing asked about.
- A police vehicle is any law-enforcement one except the Predator, which the source names outright; a taxi is one
  of two models by name rather than a class. The three model ids were taken from eModelID and are 420, 438 and
  430.
- Speeds and velocities cross the script boundary fifty times larger than the engine keeps them, because the
  engine works in units a frame at fifty frames. GET_CHAR_SPEED multiplies by fifty and SET_CHAR_VELOCITY
  divides, which is easy to leave out and would make every scripted speed fifty times wrong.
- SET_PLAYER_IN_CAR_CAMERA_MODE refuses a zoom of four and leaves the field alone, and turning the first-person
  in-car camera off also drops the zoom back to two.

The script counts weapon slots from one and the ped counts from nothing, so that command subtracts one; it gives
back the type, the ammo, and the model a pickup of that weapon would use. The dead ped's pickup point is its own
call rather than the ped's position.

Coverage is 94.04% over 703 distinct opcodes. The census is down to 65 reversed commands worth 190 instructions
between them, so what is left there is a long even tail; most of it is conversation nodes and camera attachment.

## What a draw call costs here, measured rather than assumed

Earlier notes said draw-call count was "the remaining lever" without a figure behind it. It has one now.

A frame while driving, measured in the running game over 361 frames:

| Section | ms per frame |
|---|---|
| render | 3.49 |
| steps | 1.96 |
| between | 0.64 |

Inside those steps, peds take 0.44, the player 0.28 and traffic 0.10, so about 1.14 ms is physics and the rest of
the step. A CPU profile of the same run says the machine is 77.8% idle at the thirty-frame limiter, and that no
function of this codebase is above 0.4% of samples; the top entries are all three.js matrix and draw work.

The draw cost was then measured directly, by rendering the same frame sixty times, hiding every other mesh and
rendering sixty more:

| Draw calls | Triangles | ms per render |
|---|---|---|
| 852 | 59,605 | 2.11 |
| 431 | 28,084 | 1.11 |

That is 2.4 microseconds a draw call, and a render cost proportional to the call count rather than to the
triangles: 852 calls carry only 69 triangles each, so the call itself dominates what it draws. Halving the calls
would halve the render section.

What stops that being easy is measured too. The scene holds 1,526 meshes over 974 geometries with 2,728 material
instances, but only 1,220 distinct material signatures and 34 compiled programs. So deduplicating materials
would remove about 1,500 redundant instances and the uniform refreshes that go with them, but it would not
merge draws: with roughly as many distinct signatures as there are visible draws, nearly every draw already has
a material of its own, because each placement carries its own texture. Cutting the call count therefore needs
texture atlasing, not merging, and that is a change with real visual risk rather than a free win.

This is recorded rather than acted on. The cheap reading, that merging static placements would pay for itself,
is wrong for this scene, and the next person to look should start from the signature count.

## The conversations, and a nop record that was right where I was wrong

CConversations' command layer is reversed, along with the routines behind all of it except
`DoneSettingUpConversation`, which moves the temporary nodes into the permanent table and turns each yes and no
name into another node's index. So the names stay names here rather than becoming indices that are not known,
which costs nothing: the only question the script asks, whether a conversation sits at a named node, compares
names anyway.

Three details the source carries and the tests pin: a node name is cut to six characters and raised to upper
case as it is stored; the scripted-speech forms of the node commands negate their three speech ids, which is how
the engine tells scripted speech from ordinary; and an end node carries no answers, with both answer speeches at
nothing. The three table sizes are fourteen conversations, fifty nodes and twelve temporary nodes.

One attempt here was wrong and worth recording. I gave CLEAR_ALL_CONVERSATIONS a handler that emptied the table,
and the test failed because the command never reached it: it is already in this runtime's native-nop list, which
PC 1.0 parses and does nothing with, and GET_CONVERSATION_STATUS is there too. That list predates this work and
is right; the handler is gone and a comment says why, so the next reader does not add it back. The test now
asserts that the slot survives the command.

Coverage is 94.05% over 709 distinct opcodes.

## Clearing the tail, and the one command left out on purpose

Thirty more commands, the last sweep of the reversed-command census. Four details:

- SET_CAMERA_ZOOM reaches the follow-ped camera or the car one depending on which mode is active, and neither in
  any other mode, so it is not one field.
- The vehicle camera tweak's reset is not all zeroes: the distance and altitude scales go back to one and only
  the angle to nothing, with the model to none.
- SET_CAMERA_POSITION_UNFIXED gives its vertical angle first and its horizontal second, which is the order the
  source assigns them in and the opposite of what the command's name suggests.
- CAN_CHAR_SEE_DEAD_CHAR names a second ped in its operands and the source ignores it: it asks whether the first
  ped can see any dead ped its own scanner holds.
- IS_CHAR_TOUCHING_OBJECT_ON_FOOT is the only touching question that does not fall back to the car a ped rides.

One command is deliberately left unported. IS_CHAR_ATTACHED_TO_ANY_CAR's reversed body asks whether the *ped* is
of the vehicle type, which is never true, so as written the command always answers no. That contradicts its own
name, and nothing in the reference distinguishes a faithful reading of retail from a slip in transcription. The
project's rule allows porting an unreversed dispatch through the routine or field it reaches; it does not allow
choosing between two readings of a body by taste, so the command stays out with this note rather than being
given whichever behaviour looked more sensible.

Coverage is 94.07% of 360,439 instructions over 739 distinct opcodes. The reversed-command census is down to
twenty-nine, worth about fifty instructions between them; they are the camera attachment family, the speech
context commands and the remote-control models, each needing host machinery this port has no equivalent of yet.

## Where this reference's ceiling is, measured

With the reversed-command census nearly spent, it is worth knowing what is left and why. Every instruction of
the script was classified by what the reference says about its command:

| Share | Instructions | Opcodes | Status |
|---|---|---|---|
| 94.07% | 339,056 | 739 | handled here |
| 5.01% | 18,052 | 611 | the reference never registers or names the command |
| 0.90% | 3,229 | 72 | registration commented out |
| 0.02% | 74 | 29 | reversed and still to port |
| 0.01% | 28 | 4 | the reference calls it unimplemented |

The five per cent is almost all the task constructors, and it is not a matter of effort. Searching the whole
reference for `TaskGoStraightToCoord`, `TaskPlayAnim`, `TaskPause`, `TaskAchieveHeading` and the rest returns
nothing at all: no class, no enum entry, no stub. Their operand meanings cannot be had from this source, and the
project's rule does not allow inventing them, so they are the ceiling rather than a backlog.

The commented-out group is thinner than it looks: of 106 such registrations only five have a function body that
is not itself commented out. What several do have is a documentation block naming every operand by type. Four of
those reach routines this runtime already goes through, so they went in here on the same footing as the seated
creation already ported: CREATE_CHAR_AS_PASSENGER is the seated creation with the seat the script names,
CREATE_RANDOM_CHAR is the same creation with a model the game picks, and CLEAR_LOOK_AT and IS_GROUP_MEMBER are a
ped's look task and its group membership. That is 585 instructions the earlier sweeps had passed over because
they filtered commented registrations out wholesale.

Coverage is 94.23% over 743 distinct opcodes. The realistic ceiling against this reference is about 95%, and
reaching past it needs a second source for the task constructors rather than more reading of this one.

## The documentation blocks are a source in their own right

The ceiling measurement said 0.90% of the script sits behind commands whose registration the reference comments
out. Of those, only five keep a live function body, which is why earlier sweeps skipped the whole group. But the
reference also carries a documentation block above each command, naming every operand by type and saying
whether it returns one, and those blocks are present whether the registration is live or not. Thirty of them
name commands the script uses and this runtime had not ported.

Each was checked before it went in: the operand count our own table gives has to equal the documented inputs,
counting a Vector as three and a Vector2D as two, plus one for a return. Thirty-two of thirty-four agreed.
Two did not, and the difference mattered:

- GET_CLOSEST_CHAR_NODE carries six operands against four documented, because its return is a point and the
  block only says "value". Three in and three out is the only division that fits, so it went in.
- GET_SEQUENCE_PROGRESS_RECURSIVE carries three against two documented, so one operand has no meaning in this
  source. It stays out, unlike its plain twin which agrees exactly.

That check is the difference between reading documentation and guessing from a name, and it is worth running on
anything else ported this way.

Coverage is 94.41% of 360,439 instructions over 772 distinct opcodes.

## The ceiling was wrong: this project already had a second source

Two sections above, the remaining five per cent was called a ceiling because the task constructors appear
nowhere in gta-reversed, "and reaching past it needs a second source for the task constructors rather than more
reading of this one". That second source was already here.

`src/assets/scmCommands.ts` says so in its own first line: it is generated from the Sanny Builder Library's
`sa/sa.json`, pinned to commit d595b7e0 with SHA-256 `141e23c8…`, and `docs/research/NATIVE_SCRIPT_INITIALIZATION.md`
records the same pin. The generator kept only command ids, names and operand modes. The schema itself names and
types every operand of all 3,704 commands, tasks included.

Fetching that exact pinned file again and checking its hash against the one already recorded here gives, for
example, TASK_GO_STRAIGHT_TO_COORD as `handle: Char, x: float, y: float, z: float, speed: MoveState, time: int`.
Checked against our own opcode table across every command the script uses and this runtime had not ported, the
schema agrees on all 20,136 instructions, disagrees on none and is silent on none. So the operand meanings were
never missing; only the generator's filter stood in the way.

Thirteen task commands and the two route commands went in on that footing, which is 4,300 instructions at once.
A handle of -1 still records into the open sequence rather than reaching a ped, which is the runtime's own rule
and applies to every task alike.

Coverage is 95.84% of 360,439 instructions over 786 distinct opcodes, past the ceiling this document claimed one
section earlier. The lesson is worth more than the percentage: the note said a second source was needed, and the
second source was named in the first line of a file this runtime has read from the beginning.

## The cutscene block, and the intro plays through

With the schema as a second source, the cutscene family went in: load, wait, start, wait, clear, with the skip
pair and the offset and time the script reads. The special-character slots went in beside it, counted from one
as the loading command's own operand shows, along with the mission's two reports and the counters and timers it
clears by number.

The browser plays no cutscenes and streams its world by where the player is rather than by name, so its host
answers those questions at once: a requested cutscene counts as loaded, a started one as finished, a requested
model as in. That keeps the script's wait loops turning instead of holding a thread forever on a question
nothing here will ever answer, and the snapshot counts what was asked for so the difference stays visible.

With that, INTRO plays both its cutscenes, asks the streamer for nine models, clears an area and runs on. The
clock the snapshot reports moves from eight o'clock to half past six, which is not a regression: half past six
is one of the fifty times the script sets with SET_TIME_OF_DAY, and nothing outside the script touches that
clock.

Two handlers written in this batch were wrong in the same way, and the project's own tests caught both.
SKIP_CUTSCENE_START and, earlier, CLEAR_ALL_CONVERSATIONS are already in the native-nop list, which PC 1.0
parses and does nothing with; the game-state test that checks handled families do not overlap that list failed
on the first and the conversation test on the second. Two commands the schema names, the pair asking whether a
cutscene is running, are absent from our own opcode table, so they are not commands this script can contain and
adding handlers for them broke the command map until they were removed.

Coverage is 96.36% of 360,439 instructions over 803 distinct opcodes.

## Nineteen twentieths and past it

Twenty-nine more commands from the schema: the eight remaining tasks the script hands its peds, the six vehicle
setters, the object carried by a car with its own offset and rotations, the particle kill and the explosion, the
ped's facial talk and the weapon a scripted cutscene hides, the group member, the entry-exit mark, the
decision-maker response, the patrol route with an animation at each point, the mission-passed tune and the two
message questions.

Three are the runtime's own rather than a host's: the wanted multiplier is CWanted's own scale, whether a
special character is loaded reads the slot table already here, and whether a thread has had its death-or-arrest
reset is a flag the scheduler already sets when it does one.

Coverage is 97.50% of 360,439 instructions over 833 distinct opcodes, from 76.0% when this runtime was first
wired into the published game and 91.47% when this session's work began.

## Past forty-nine fiftieths

Thirty-two more from the schema: the checkpoints a script places, with a type, the point they stand at, the
point they aim at and a radius, in a table of thirty-two wrapped in the same script-thing handle as every other
table here; the last six tasks; the vehicle questions and the explode and driver commands; the ped's weapon
skill, kept task and gang-safe move; the decision-maker response with one chance for each of the four ways a ped
may feel about another; the object slide and health; the particle play, the one-off sound, the HUD colour and
the onscreen timer.

Four are the runtime's own: the vehicle models the script keeps out of traffic, the two gang-visibility
switches, and the respect a mission awards.

Two tests in this batch failed first on float32 rounding rather than on logic: the four decision chances and the
slide's speed are floats in the script, so they come back near rather than exactly equal, and the assertions say
so now.

Coverage is 98.16% of 360,439 instructions over 864 distinct opcodes.

## The last of the tasks, and the world settings

Thirty-six more from the schema, which takes the runtime past ninety-eight and a half per cent. The seven
remaining tasks, the pick-up among them, which carries an offset, a bone, an orientation and an animation of its
own. Ten vehicle commands, from the siren to the train's cruise speed. Six object commands, including the
question that names both what counts as smashed and what counts as damaged, either of which may answer it. The
particle creation by name at a point, the gang-size limits, the patrol flush and the road node marked against
wandering, and the radio, radar, near clip, time scale and onscreen counter.

LOCATE_OBJECT_3D needed no adapter at all: the objects are the runtime's own and the box test is the one the
locate helpers already use.

Coverage is 98.64% of 360,439 instructions over 899 distinct opcodes.

## Ninety-nine hundredths

Thirty-nine more from the schema: ten tasks, the helicopters with their band of altitude rather than one height,
eleven vehicle commands, the ped and object questions, the two decision-maker commands, and the world switches
with the pad's two analogue sticks.

Two needed nothing outside the runtime. IS_MINIGAME_IN_PROGRESS reads a flag already kept here, and
IS_INT_LVAR_EQUAL_TO_INT_VAR is a late comparison between a local and a global whose twin at opcode sixty the
thread has always run; the schema gives it two ints and a condition, which is all it needs.

IS_CAR_IN_AREA_2D sorts its own corners, as the explosion box does, so the script may give them either way
round, and IS_CAR_HEALTH_GREATER compares with greater or equal exactly as the ped question does.

Coverage is 99.01% of 360,439 instructions over 938 distinct opcodes.

## The arithmetic, the groups and the particles

Forty-five more from the schema. Three of them are pure arithmetic with no world behind them at all, so the
runtime does them itself: the square root, the heading a two-dimensional vector points along, and whether two
rectangles given by a centre and a size each overlap. The heading is measured from north the way every heading
in this game is, and comes back between nothing and a full turn; the rectangle test counts touching edges as a
collision, which its inclusive comparison gives.

The rest are six more tasks, fourteen vehicle and boat and train commands, the four group commands, the four
particle commands with the object animation, and nine world settings and questions.

Coverage is 99.26% of 360,439 instructions over 978 distinct opcodes.

## The searchlights, the menus and the long tail

Fifty more from the schema: the searchlights, which take a point, the point they sweep to and two radii, and
hang on three objects at once, its tower, its housing and its bulb; the menus, whose column command names a
title and twelve rows in one instruction; six more tasks including the slide that carries a whole animation
beside its point and heading; the rope grab that gives back three handles at once, whichever of them is holding
on; and the rest of the vehicle, group and world commands.

Coverage is 99.48% of 360,439 instructions over 1,027 distinct opcodes. The script's own opcode count is 1,455,
so this runtime now answers seven in ten of the distinct commands the file contains and all but half a per cent
of what it actually runs.

## The last arithmetic, and the tail of the tail

Sixty more from the schema. Two are arithmetic the runtime does itself: the angle between two vectors, in
degrees and never negative, where a vector of no length gives no angle rather than a NaN; and the angle limiter,
which brings a value back into a single turn whichever way it ran out.

The rest are the tail: twenty vehicle, plane and train commands, six objects, eight peds and groups, the
searchlight aimed at a ped, the line of sight with the five things it may be stopped by named one by one, and
the audio, marker and debug commands. Two more tasks, and TASK_EVERYONE_LEAVE_CAR, which names a car rather than
a ped and so is given to no ped in particular.

Coverage is 99.62% of 360,439 instructions over 1,077 distinct opcodes.

## Three quarters of a per cent left

Seventy more from the schema, the streamed-script request among them, which the script names by its own index
and the registry translates the same way the loaded question already did.

One more piece of arithmetic went into the runtime: where two lines cross. Parallel lines never cross, and
rather than dividing by nothing the command leaves the script's two variables exactly as it found them, which
the test checks by writing values into them first.

The rest are the last of the vehicles and aircraft, the searchlight mounted on a car and the camera hung on one,
the three model questions, the world switches and nine more tasks.

Coverage is 99.74% of 360,439 instructions over 1,122 distinct opcodes. Two thousand unit tests and the browser
spec pass, and the published game still runs the script's whole opening with twenty-five threads live.

## Under a fifth of a per cent

Eighty more from the schema: the three path-node lookups, which give back a point and, for one of them, the
heading to face along it; a model's own bounds as two opposite corners; the group size, which reports both how
many follow and who leads; the occupied question, which names five kinds of thing that may be standing in the
box exactly as the line of sight does; and the rest of the vehicles, boats, helicopters, objects, menus and
markers, with the last three tasks.

GET_CAR_COLOURS reads the first two of the four colours the vehicle already reports to its extra-colours twin,
so it needed no new adapter, only the right two fields.

Coverage is 99.83% of 360,439 instructions over 1,178 distinct opcodes. Two thousand and ten unit tests pass.

## Every instruction

The runtime now handles every one of the 360,439 instructions in MAIN.SCM, across all 1,455 distinct opcodes.
The coverage test no longer carries a floor; it asserts that nothing is missing.

The last 277 commands were generated rather than hand-written, and the reason is worth stating. Their operands
are named and typed by the pinned Sanny Builder schema, so the mapping from a command to its handler follows one
rule with no judgement in it: a float operand reads a float, a bool reads a bool, a string reads a string, a
model reads a model and anything else reads an integer; a command the schema marks as a condition sets the
compare flag, and one with outputs writes them into the operands after its inputs. Writing 277 of those by hand
would have been 277 chances to mistype an index.

Three of them could not be generated, and finding that out was the point of trying. GET_NAME_OF_ZONE,
GET_NAME_OF_ENTRY_EXIT_CHAR_USED and GET_LOADED_SHOP hand back a name rather than a number, and this runtime
had no way to write a text label into a script variable. Adding one finished them: the label's width is its own
operand's, eight bytes for a short one and sixteen for a long one, and the script uses both. A first attempt
fixed the width at eight, which would have written half of every long label and left the rest of it standing.
The bytes are padded with nothing after the name, so a name that fills the label needs no terminator and one
longer than the label is cut to it.

What this does and does not mean: every command the script can execute now reaches a handler with its operands
read correctly. Many of those handlers hand the work to a host that the browser has not implemented, and each
such call is an explicit adapter rather than a silent no-op, so what is still missing is visible in the type
rather than hidden in the behaviour.

## Nothing gives up

With every command handled and the browser answering the tag counts and the gang territory from its own
managers, the published game's opening runs its whole thread set with no thread giving up at all. The browser
spec no longer waits for a thread to stop; it waits for the twenty-sixth to start, and asserts that the give-up
list is empty.

One thing changed in how that spec reads the game. The clock it checks moves as the intro plays, so a snapshot
taken as soon as the threads are up sees eight o'clock and one taken later sees half past six, both of them
times the script sets itself. Rather than pick whichever the machine happened to reach, the test now waits for
the intro's two cutscenes first, which is the milestone that precedes the change, and then reads one settled
moment. Three runs in a row agree.

## The cars a script makes

The script's `CREATE_CAR` returns a handle and the very next instruction uses it — sets a heading, locks the
doors, marks the car as no longer needed. `CCarCtrl::CreateCarForScript` can do that because the model is
already in memory. The browser cannot: `WorldFleet.spawnTrafficCar` has to stream the model, load the car's
assets and re-cast the ground under it, and only then does a car exist.

`ScmVehiclePool` sits between the two. The handle is allocated at once and the spawn runs behind it. Anything
the script says in the meantime is remembered against the handle: a position, a heading, a deletion. When the
car arrives, a deletion removes it before it is ever seen, and a move or a turn is applied to it; a car nobody
touched keeps the placement its own spawning chose, because that placement is the one settled on the ground and
lifted off the model's base, which is what the original does and the raw point the script named is not.

Reading back before the car arrives gives what the script itself last set, which is what a synchronous engine
would have given, rather than a hole. Reading back after gives the car's own position, so a car that has been
driven answers where it is. A spawn that produces nothing — a model that does not exist, a spot with no ground
under it — makes the handle stop existing, which is the answer the original gives for a car it could not make.

Nine unit tests pin this against a fake host whose spawns settle only when the test says so, so the orderings
that matter — set before arrival, delete before arrival, delete after arrival, failure, reclaim — are each
exercised deliberately rather than whenever a promise happened to resolve.

## The peds a script makes

The same gap sits in front of `CREATE_CHAR`, and wider: `CPopulation::AddPed` builds the ped inside the
command, so the script's next instruction sets its health, its accuracy, where it stands and which way it looks.
So the deferral itself moved into `ScmEntityPool`, which holds a handle, runs whatever the script says against
it in order when the entity turns up, refuses one deleted before it arrived and lets a failed making mean the
handle stops existing. The car pool and the ped pool both sit on it; what is left in each is the part that is
actually a car's or a ped's.

Two rules came out of the reference rather than out of convenience. `CPed::CanBeDeleted` refuses to let the
population manager remove a ped a script made, so a scripted ped carries that flag and the browser's own
culling pass leaves it alone until `MARK_CHAR_AS_NO_LONGER_NEEDED` hands it back — which it does even when the
ped is still being loaded, because the handing back is kept with everything else the script said and runs when
the ped arrives. Without that, a ped let go before it existed would have stayed the script's for ever.

The second is `SET_CHAR_PROOFS`. `CPhysical`'s damage response decides by the weapon's class: melee, bullet,
explosion and fire each have a proof, a spray can damages whatever it hits, and collision proof belongs to the
brass knuckles, the golf club and the shovel, which this browser already counts as melee — so that one proof
guards nothing of its own yet, and says so where it is stored. The four that do are checked at each of the
browser's damage sites, so a proofed ped's health does not move.

`SET_CHAR_ONLY_DAMAGED_BY_PLAYER` sets `physicalFlags.bInvulnerable`, and the only ped damage gta-reversed reads
that flag for is a fire spreading from something that is not the player. Every ped damage the browser deals is
the player's, so the flag is stored and honoured by being irrelevant, which is recorded rather than dressed up.

Script handles start at 1024. The browser hands the player handle 1 and the car he is driving handle 1, and the
script asks after all of them with the same commands, so the pools number their own above that.

## What a scripted ped can be asked

The commands that only read a ped now answer for the script's own peds as well as the player's. Three of them
are the browser's to decide and were taken from the routine rather than guessed: `IS_CHAR_STOPPED` is
`CTheScripts::IsPedStopped`, which for a ped on foot wants it standing in place, on the ground, not landing and
not shifting; `IS_CHAR_IN_WATER` is `physicalFlags.bSubmergedInWater`, which `CPed::ProcessBuoyancy` sets with
the water six tenths of a unit over the ped's origin — the same test the drowning pass already makes, so it is
now one method both use; `IS_CHAR_ON_SCREEN` is the visibility the population pass already computes.

Two are the script's own word and need no browser at all. `GET_CHAR_PED_TYPE` is the ePedType the script named
in `CREATE_CHAR`, so the pool keeps it, and `IS_CHAR_MALE` is `!IsPedTypeFemale` of that — every type but
`PED_TYPE_CIVFEMALE` and `PED_TYPE_PROSTITUTE`, the two the enum's own helper names.

A handle whose ped is still being loaded gives the asking thread up rather than inventing an answer, which is
the same rule the rest of the runtime follows: the questions that can be answered from what the script itself
said are answered from it, and the ones that need a ped wait for one.

## What a scripted car can be asked

Only twenty-two vehicle commands have a reversed body, so this batch is what those bodies and the documented
fields actually support, and no more. `GET_CAR_SPEED` is `m_vecMoveSpeed` times fifty, which for a body the
browser moves in units a second is its own speed. `IS_CAR_STOPPED` is `CTheScripts::IsVehicleStopped`, a time
step's hundredth of a unit a frame. `GET_CAR_MODEL` needs no car at all: the model is the one the script asked
for, which the pool already keeps, so it answers even while the car is still being built.

`SET_CAR_PROOFS` sets the same five `physicalFlags` a ped's does, and the browser's two kinds of vehicle damage
— a shot and a blast — are refused by the bullet proof and the explosion proof. `SET_VEHICLE_CAN_BE_DAMAGED` is
separate and stronger: `CAutomobile::BlowUpCar_Impl` returns at the top without `vehicleFlags.bCanBeDamaged`, so
a car that cannot be damaged cannot be exploded either, by a weapon or by `EXPLODE_CAR`. That reading came from
the routine after a first guess put the explosion proof there instead, which the routine does not do.

Both decisions are pure functions next to the entities they belong to, so a test pins them without building a
car or a ped: which proof stops which blow, that a spray can is stopped by none of them, and that collision
proof guards nothing while its weapons are counted as melee.

## The tasks a script gives a ped

A scripted task is a CTask the original pushes onto the ped's intelligence, and the union the runtime already
decodes has about seventy of them. Only some are reversed at all, and only some of those describe something
this browser's pedestrians already do, so the translation is that intersection and nothing else. A task outside
it turns into nothing, and the runtime gives the asking thread up — which is the same answer an unported
command gets, and better than leaving a ped standing about as though it had obeyed.

What is carried across: `CTaskSimpleStandStill` with its time in milliseconds, and its looped form, which ends
only when something aborts it; `CTaskSimplePause`, which for a ped with nothing else to do is the same stand;
`TASK_STAY_IN_SAME_PLACE`, which is `CTaskComplexBeStill` while set and wandering again when cleared;
`CTaskSimpleAchieveHeading`, at the half heading rate and 0.2 radian tolerance its own defaults name, whether
the script gives the heading, a point or another ped; `CTaskComplexWanderStandard`, which is what a street ped
does unasked, so it is the absence of an order rather than an order; `CTaskComplexDie`; and the two smart
flights, whose constructors name the point, the safe distance and the time, onto the flee the browser's own
jacking and fright already use.

A turn towards a point or a ped goes through `CVector2D::Heading`, which is `atan2(-x, y)` — north is nothing
and east is two hundred and seventy — rather than the `atan2` a renderer would reach for. A handle naming no
ped cannot be turned towards, so that gives the thread up too.

`TASK_DIE` kills a ped whatever it is proof against, because the task is not damage and does not go through the
damage response; the browser's damage entry now takes that as an explicit argument rather than the scripted
death quietly clearing the ped's flags first.

The translation itself is a pure function with no world in it, so the whole mapping — times, the -1 that means
for ever, the headings, and the tasks that deliberately return nothing — is pinned by a test that builds no ped.

## The script's own car is not a traffic car

Wiring `CREATE_CAR` to the browser's traffic spawn looked right and was wrong, and the test that drives the
pools the way the script drives them is what showed it: every car the script asked for settled without ever
arriving. `WorldFleet.spawnTrafficCar` is ambient population — it casts for ground, refuses a slope, and
refuses a spot a box already occupies, because a passing car has no business appearing inside a wall.
`CCarCtrl::CreateCarForScript` does none of that. It sets the car down exactly where the script says, drops to
the ground only when the z is at or under the map's low limit of −100, lifts it off the base of its model, locks
it, turns the engine off and abandons it, and then clears the space around it rather than declining to make it.
So the script's cars now go through their own spawn, which does that, and their own removal, which takes a car
the streamer never owned out of the world.

The ped side had a plainer bug with the same shape. Ped models are loaded by name, and the cache folded the
name's case while the archive lookup did not — so every name a script gives, which is upper case, missed. The
original matches model names without case, so the lookup folds too, and one of the pools' first real uses stops
being a silent failure.

A browser test now does what the script does: makes a car and a ped beside the player, uses both handles on the
next line the way the original's commands do, waits for the models to stream, gives the ped an achieve-heading
task and watches it turn to the heading and stop inside the task's own tolerance without walking off, and then
deletes both and finds the handles empty.

## A scripted task is the ped's task, not a suggestion

Wiring the orders in was the easy half; making them stick was the half that found a bug. The achieve-heading
order kept failing to finish in the browser, and a trace showed why: the ped was turning *away*. With the order
holding the ped still, the wander's own arrival test — is my target within reach? — was true every frame, so it
chose a new target and began a road crossing, and `stepCrossing` turned the ped at its own rate while the order
tried to turn it back.

The original does not have this problem because pushing a scripted task replaces the ped's primary task: the
wander is gone while the task runs. So the browser now does the same. Giving an order leaves any attractor the
ped had queued for and ends any crossing it had begun, and while an order is in force the wander's arrival, its
stuck-and-scratch, the attractor step and the crossing step are all held off. Street peds are untouched, since
they never carry an order.

The turn itself is now a pure function, `achieveHeadingStep`, which is what `CTaskSimpleAchieveHeading` does in
one frame: turn toward the heading at half the ped's pedstats rate, never overshooting, and be done once what
it has reached is inside the 0.2 radian tolerance — the test after the turn, not before. A unit test pins the
rate, the clamp, the short way round the circle and both sides of the tolerance.

The browser test cannot pin the tolerance itself and says so. The task ends on the frame the ped arrives, and
`CPed::UpdateHeading` starts turning it toward its next wander point on the very next frame at the full rate —
twice the task's — so the nearest reading anything outside the frame loop can take is the tolerance plus one of
those frames. That is what it asserts, with the exact claim left to the unit test.

Alongside: `GIVE_WEAPON_TO_CHAR` gives the type and the ammo at once, because the script asks after them on its
next instruction, and the held model catches up when it loads. Ammo a script set is spent a round at a time and
an empty weapon stops the ped firing; ammo the browser never set stays uncounted, so its own armed peds and
police crews reload without end as the original's do.

## Filling adapters by what the script actually asks

Which adapter to write next was guesswork, so it was measured instead. Every command handler names the world
adapters it reaches; every opcode has a count in the original script. Joined, that ranks the unimplemented
adapters by how many instructions of MAIN.SCM are waiting on each one. Twenty-two thousand instructions are
waiting on the 716 that are missing, and they are not evenly spread: `SET_CHAR_DECISION_MAKER` alone accounts
for 1,684, task sequences for 1,458, `FindGroundZForCoord` for 958.

This batch took the ones the browser can answer outright. The ground query is the browser's own downward cast,
with `CWorld::FindGroundZForCoord`'s answer of twenty where the world has no ground under the point. The
decision maker is a field the browser's peds already carry and already act on. `SET_CHAR_NEVER_TARGETTED` is
`bNeverEverTargetThisPed`, so the ped drops out of the lock-on list the weapon system draws its targets from.
`CLEAR_LOOK_AT` ends the head-look. A vehicle's matrix is its rotation's three rows and its position, turned
into the script's own axes. Freezing a car is `bDontApplySpeed`, the same flag the ped's freeze sets.

`SET_CHAR_HEALTH` turned out to have a rule worth having: a ped whose maximum is still the default hundred takes
the new health as its maximum too, and one whose maximum a script already set keeps it. That is the pool's own
bookkeeping, needing no browser, and it is pinned by a test.

`SET_CHAR_SHOOT_RATE` is left out on purpose. Its handler is commented out in the reference — the command is
not reversed at all — so there is nothing to port and a guess would be invention.

## Sequences

`PERFORM_SEQUENCE_TASK` is the second-most-waited-on adapter in the script, and it is the same tasks again with
an order to them. `CTaskComplexSequence` holds its tasks in an array of eight, runs them by index, and either
stops at the last or starts again at the first — so the browser's sequence takes the first eight, runs them in
turn, and loops when told to. The single-task form is now a sequence of one, so both go down the same path.

Three details fell out of it. A task that is over the moment it starts — a death, a flight, a wander — does not
stall the sequence: the next one begins in the same breath, with the array's own eight steps as the budget so a
repeating sequence of nothing else cannot spin. Wandering ends the sequence rather than joining it, because
wandering is what a ped does with no task at all. And a sequence is refused whole if any task in it is one the
browser does not run, because a sequence with a hole in it is not the sequence the script asked for.

`GET_SCRIPT_TASK_STATUS` is left out, despite being third on the list at 624 instructions. Its handler is
commented out in the reference and the schema names the return type without giving its values, so neither
source says what the numbers mean. Guessing them would put a wrong answer where the script branches on it.

## Peds a script can hide, move and hand back

The next slice down the frequency list. `SET_CHAR_AREA_VISIBLE` is `CEntity::m_nAreaCode`: a ped that belongs
to an area is drawn only while the camera is in it, and a ped with no area of its own belongs wherever it
stands, as a street ped does. That, and the `bIsVisible` a script can clear, are now written on the ped every
frame before its view steps — so the character's own vehicle poses can still override them, which is the order
the original resolves them in too.

`WARP_CHAR_FROM_CAR_TO_COORD` flushes the ped's tasks, drops the point to the ground and sets the ped down;
a ped a script made in this browser is never in a car, so there is nothing to climb out of first, and the
comment says so rather than implying a seat was involved. `REMOVE_CHAR_ELEGANTLY` hands a mission ped on foot
back to the game rather than taking it out of the world — the same handing-back `MARK_CHAR_AS_NO_LONGER_NEEDED`
does — and for the same reason that is the whole of it here.

`PLAYER_CAMERA_STATE` asks `FindPlayerVehicle` and whether the ped is in `ENTER_CAR`, `CARJACK`, `OPEN_DOOR` or
`EXIT_CAR`. The browser's entry sequence is still on foot while the player walks to the door, and its door work
— align, open, pull out, get in, close, shuffle — is where those three states begin; the exit states run to the
ped standing up again.

## How one ped regards a type

`SET_CHAR_RELATIONSHIP` has no reversed handler, but what it reaches does: `CAcquaintance` is five bitmasks
over the thirty-two ped types — respect, like, ignore, dislike, hate — and `SetAsAcquaintance` is the routine
that makes them a table rather than five independent sets. Putting a type in one list takes it out of the other
four, so a ped cannot both like and hate the same type. That routine, its clearing counterpart and the
per-acquaintance clear are ported as written, and a test covers the move, the no-op when a type is already in
that list, the multi-type masks the command's own bit numbers produce, and the top bit.

A relationship a script sets now answers before the ped.dat table its ped type came with: respect and like read
as a friend, dislike and hate as a threat, ignore as neutral, and a type in no list at all falls through to the
table. The bridge between the two is that peds.ide names a ped's type with exactly the enum's name minus its
`PED_TYPE_` prefix, so the thirty-two names are the map.

`IS_CHAR_IN_ZONE` is the navigation zone lookup by label and then `PointLiesWithinZone` — not "which zone is
the ped in", which would answer differently where zones nest. A label no zone carries can hold nobody, which is
what the lookup's own failure gives.

## The bits a script sets on a ped

`SET_CHAR_SUFFERS_CRITICAL_HITS` is `bNoCriticalHits = !value`, and the flag has exactly one reader in the
reference: `CWeapon::FireInstantHit`, where a player's shot from inside a unit, with anything but a shotgun,
deals a hundred and fifty instead of the weapon's own damage. The browser already ports that rule, so the flag
now travels with the ped into the target list the weapon system reads, and a ped spared critical hits takes the
ordinary damage from a point-blank shot.

The rest of the ped bits a script sets are now held by name rather than scattered. Two of them do something
already: `bDoesntDropWeaponsWhenDead` keeps the body's weapon out of the world, and `bDrownsInWater`, cleared,
leaves a ped in deep water instead of running the drown clip. The others are held as the command gives them —
the source stores three of the four inverted, and this is the side of that inversion the command speaks in.

`GET_CHAR_ANIM_CURRENT_TIME`'s companion reads how far through its own length the ped's reaction has played,
and answers nothing when the ped is playing something else, which is what the ped having no such animation
means.

## A ped the script makes inside a car

`CREATE_CHAR_INSIDE_CAR` was the largest adapter the script was still waiting on, and it is a different kind of
ped: `CPopulation::AddPedInCar` builds one in a seat rather than on the ground. It never walks, it goes where
the car goes, and `GET_CHAR_COORDINATES` gives the car's position for it.

So a rider is what the pool builds for it — a handle, a model, a car and a seat — and the occupant renderer
draws it with the same `CAR_sit` pose the browser's own NPC drivers use. The pool keeps the ride against the
handle, so `IS_CHAR_SITTING_IN_CAR`, `IS_CHAR_SITTING_IN_ANY_CAR`, `IS_CHAR_ON_FOOT` and `STORE_CAR_CHAR_IS_IN`
all answer from it rather than from a ped that is not standing anywhere.

The consequence worth stating is what a rider cannot be told. Everything a script says about where a ped stands,
how it walks, what it looks at or which task it runs has nowhere to land on a ped that is riding, so the host
now asks for the walking ped behind a handle and lets those commands fall away when there is none, rather than
reaching into an object that has no legs. Health, accuracy, the kill and the removal do apply, because a rider
has those.

One limit is the browser's, and it is drawn rather than hidden: a car carries a seat point on each side, so a
driver and a front passenger are drawn where they sit, and a ped a script seats further back rides unseen until
the models carry rear seat points. It is in the car for every question the script asks; it is only not drawn.

## Riding, warping and the rest of the batch

`TASK_WARP_CHAR_INTO_CAR` is the same rider again, arriving by a different door: a ped that was walking stops
and rides, keeping the handle the script already holds. That needed the pool to be able to swap what a handle
names — the old entity goes, the handle stays, the new one arrives the same way the first did — which is a
small addition and exactly what the original does when a ped's own task puts it in a seat. The random forms
take the occupation `CPopulation::ChooseCivilianOccupationForVehicle` would have picked for that car, which is
the model the browser's occupant renderer already assigns it, so a random driver looks like the driver that car
would have had anyway.

`SET_CAR_CAN_BURST_TYRES` is `vehicleFlags.bTyresDontBurst` inverted, and the browser's tyre burst now refuses
on it the same way it already refuses for the Rhino and a wrecked car. `ADD_EXPLOSION` is
`CExplosion::AddExplosion`, which the weapon system already runs for its own blasts, so the script's explosions
are the same explosions. `HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE` takes the held model out of sight and leaves
the ped holding the weapon.

The speech trio — the scripted-speech gate and the facial talk a script starts and stops — are held as the CPed
bits the commands set and no more, because the depot carries no speech banks: nothing in this browser speaks or
moves a jaw. They are in because a thousand instructions of the script pass through them, and a thread that
gates and ungates speech should carry on rather than stop on a question nothing here can answer. The comment at
the adapter says that plainly rather than implying someone is talking.

## Who last hurt this ped, and who is allowed to

`CPed::m_pLastEntityDamage` is now kept: the player when the blow came through the browser's own damage entry,
which everything the player does goes through, and the ped when one ped strikes or shoots another. The command
names it back in the script's own handles, so the pools are asked which handle holds that ped or that car — and
something the script never made has no handle to give, so it names nothing rather than inventing one.

`SET_CAR_ONLY_DAMAGED_BY_PLAYER` is a car's `physicalFlags.bInvulnerable`, and unlike the ped's version it has
a reader here: a ped's gunfire damages cars, so a car set that way now shrugs off shots from anyone but the
player. `IS_MESSAGE_BEING_DISPLAYED` is the browser's own HUD answering whether a message the script put up is
still on screen.

### The browser suite under load

A handful of specs fail under full parallel load and pass on their own. That was checked against an unmodified
tree, where the same specs fail the same way, so it is the suite's own load sensitivity and not something this
work introduced — but "the suite passes" was the wrong thing to say about it, because the summary line that
said so had counted retries.

The gang hangout is fixed, and its failure was the test's own. It waited for any ped with a hangout and then
asserted the party had three members; under load the models stream in one at a time, so it could catch the
moment a party existed with two. It now waits for the party its assertions describe.

The Rhino's drive-in wreck is not fixed, and what it was doing is worth writing down: it read `wrecked` off a
car that was not there, which surfaced as a `TypeError` rather than as the thing that was wrong. The starter
Greenwood is sometimes gone from the fleet by the time the run-up begins, and it is not the tank's
clear-space — parking the car twice as far away changes nothing. The test now waits for the car and says so
when it never comes, which turns a confusing crash into the plain statement that the car disappeared. Why it
disappears is still open.

The rest — the local timecycle, the street-lamp coronas, the lens flare, the skidmarks and the headlight
beams — are rendering specs that pass on their own and want their own look.

## Groups

`CPedGroupMembership` is small enough to port whole, and the group commands are a few hundred instructions of
the script between them. Eight member slots; the last of them, index seven, is the leader's, and a follower
takes the first free slot below it. A ped already in the group is not added again, and when the slots are full
the ped is simply not added rather than displacing anyone. Making a follower the leader moves it rather than
leaving it in two slots. The dead leave the group, and a group left with followers and no leader appoints the
first one still in a slot. A freed slot is used again before the ones above it, which is what the array does
and what a test pins.

The groups are held by the handle the script uses, and a command naming a group the script never created gets
one made for it, because `CPedGroups` is an array where every slot is already a group. The player's own is
handle zero and is always there.

## The middle of the list

`CREATE_RANDOM_CHAR` asks the game to pick the model, and the game's answer is the zone roster's own: the same
civilian the street would have produced there, chosen the way the population pass chooses. A zone that has not
streamed a model yet cannot supply one, so that gives the thread up rather than reaching for a fallback the
zone would never have used.

`FindGroundZFor3DCoord` looks down from the point itself rather than from a thousand above, which is the
difference between it and the two-coordinate form already in. The freeze that also waits for collision is the
plain freeze here, because a ped the browser built stands on ground it has already loaded and has nothing to
wait for. The ped ranges and the remaining CPed bits are held by name beside the others.

One answer is about this browser rather than the original. `CHud`'s help box is its own panel there; here there
is one line for the text a script prints and no separate help box, so no help message is ever up on its own and
a thread waiting for one to clear carries on at once. A thread waiting for one to *appear* would wait forever,
which is the cost of that answer and the reason it is written down next to it.

## The script's objects become visible

`ScmObjects` has always held everything `CObject` carries for the script — position, heading, the full
rotation, the scale, the proofs, whether it uses collision — and its own comment said a host would mirror each
record into the world it draws. Nothing was drawing them. The opening alone makes seventy-five.

So the browser draws them now. The IDE associations the world source already reads say which dff and txd each
model id stands for, which is the one thing the runtime's records do not carry, and the models load the same
way pickups' do. The renderer owns nothing of its own: every frame it is handed the runtime's records and puts
each object where they say, in the renderer's axes rather than the script's. An object whose model the archive
does not carry draws nothing and still exists for every question the script asks about it, which is what
`CStreaming` does for a model it cannot load.

The cost was measured rather than assumed, and the first version was wrong. Copying the pickups' habit of
turning frustum culling off cost 0.56 ms a frame of render time for those seventy-five objects. Pickups do that
because they are small spinning things you are meant to see; a script's objects are world props standing where
it put them, and most of them are behind the camera at any moment. Leaving culling on gives 0.17 ms a frame
instead — the same objects drawn, two thirds of the cost returned.

## What an object carries

With the objects drawn, the questions about them can be answered. `CObject::m_fHealth` starts at the thousand
`CObject::Init` gives it, never falls below nothing, and counts as damage only when something is taken from it
— raising it leaves the object undamaged. `GET_OBJECT_SPEED` is the move speed a frame carries times fifty,
the same reading `GET_CAR_SPEED` takes of its own. `CEntity::bIsVisible` now reaches the drawing, alongside the
area code that was already there.

Two of them are the world's rather than the record's, and go through a point rather than an object:
`CEntity::GetIsOnScreen` is the same visibility test the population pass makes, and
`physicalFlags.bSubmergedInWater` is the same water test `CPed::ProcessBuoyancy` makes for a ped. Both take a
point in the script's own coordinates, so they serve anything the script asks about a place.

### Drawing them for nothing

Putting seventy-five objects where the records say they are, every frame, meant building a transform for each
of them every frame — three new quaternions and a vector apiece, and a matrix update behind them. A script's
objects mostly stand exactly where it put them and never move again, so almost all of that work was rebuilding
a transform nobody had changed.

The view now keeps the eight numbers its transform was built from — the position, the heading, the three
rotation angles and the scale — in a row of its own, and rebuilds only when one of them differs. The
quaternions are reused rather than made, so a frame in which nothing moved allocates nothing and touches no
matrices at all. Measured the same way as before: 3.80 ms a frame of render against 3.78 with no script
objects drawn at all, where the first version cost 3.95. The same objects are on screen; the per-frame work
has gone back into the noise.

## Decision makers a script writes itself

`ADD_CHAR_DECISION_MAKER_EVENT_RESPONSE` and its group form write one of the six choices a decision file holds
for an event — a task, four chances, and whether it is allowed in a car and on foot — and the clearing forms
empty that event's row. Those rows are exactly what the browser's own chooser already reads, so a decision
maker a script builds at run time is answered by the same `CDecisionMakerTypes::MakeDecision` port the file-fed
ones go through, and it answers first, which is what wearing that maker means. The decision files themselves
this port does not publish, so for a ped wearing a script-built maker these rows may be all there is.

There is a disagreement between the two sources about what the four chances are called, and it is left
unsettled on purpose. The schema names the command's four floats respect, hate, like and dislike; the file
reader, after gtamods, calls the four columns friend, threat, player and neutral. Both are third-party labels
for the same four positions in the same order, and nothing in the port depends on which naming is right: the
four chances go into the four slots in the order the command gives them. Saying so is better than picking one
and quietly building on it.

A row holds six choices because a decision file's row does; the seventh has nowhere to go.

## Things that hang from other things

`ATTACH_OBJECT_TO_CAR`, `_TO_CHAR` and `_TO_OBJECT` give `CEntity` an attachment: an offset in the host's own
axes and three rotations. Now that the script's objects are drawn, an attached one follows what it hangs from
on screen as well as in the records.

The offset is in the host's axes, so the world point is the host's position plus its right, forward and up
scaled by the three components. A car gives all three through the matrix command already ported. A ped, and an
object a script has placed, only ever turn about the up axis, so their axes come from the heading — and the
heading convention is `CVector2D::Heading` again, where nothing faces north and the right hand is east. A host
that has gone leaves the object where it last was rather than dragging it to nowhere.

One part is deliberately not there. `DETACH_OBJECT` gives the object a push, with a pitch, a heading, a
strength and a turning force. The browser runs no physics for a script's objects, so the object is let go where
it hangs and does not fly; the command's own operands are named at the adapter so the gap is visible rather
than implied.

## A ped that hangs from a car

`ATTACH_PED_TO_CAR` puts a ped on a car rather than in it, at an offset in the car's own axes — the gunner on
the running board rather than the passenger in the seat. The rider the pool already builds for a seated ped is
the same thing with the seat point replaced by the offset the script gave, and the offsets line up without
conversion because the browser's occupant poses are already in the car's native axes, which is what the command
speaks. `DETACH_PED_FROM_CAR` puts it back on the ground where the car had got to, walking again — the handle
the script holds survives both changes, as it does for the warp into a seat.

Two operands are not taken, and the adapter says so: the angle limit and the weapon belong to a ped that can
aim from where it hangs, and this browser's riders do not aim yet.

## How much of the waiting is over

The ranking that started this run of work measured 22,685 instructions of the original script waiting on an
adapter that was not there. It is now 9,367. What is left is mostly long tails — particle systems, patrol
routes, searchlights, ropes, trains and aircraft, a few hundred instructions each — rather than the few large
items the first measurement found. The largest single one, at 624, is still `GET_SCRIPT_TASK_STATUS`, and it is
still the one command in the list that neither source describes well enough to port.

## The particle systems a script makes

`CREATE_FX_SYSTEM` and its five entity forms were the largest group left, and the browser already runs
`Fx_c`'s own manager for its explosions, skids and glass. So the script's systems are that manager's systems:
the same blueprints out of effects.fxp, played, stopped and killed by the same routines.

The one thing that needed care is which matrix goes where. `FxSystem_c` keeps a local matrix and a parent, and
multiplies them. A system standing at a point wants the placement as its local and no parent; one hanging from
a car wants an identity local and the car's matrix as its parent, because `SetMatrix` replaces the parent and
is what keeps it with the car. Passing the same matrix for both — which is what the first version did — would
have squared the transform, putting the system somewhere no command asked for.

An attached system is given its host's matrix again each step, beside the objects that hang from things. A
system with a direction points along it, built on the same rule `CVector2D::Normalise` sets for a vector of no
length, which the angled-area port already follows. A handle naming no system gives the asking thread up rather
than quietly doing nothing.

## The blips the script sets

`CRadar`'s table has been the script's all along — a hundred and seventy-five traces with colours, sprites,
sizes and display flags — and, like the objects, nothing was drawing it. The browser's own radar already draws
a list of live blips, so the script's table becomes that list: a coord blip carries its own point, an entity
blip follows the car, ped or object it names through the pools the script made it from, and a blip whose
display does not include the radar, or whose entity has gone, is not drawn at all.

The colours are `CRadar::GetRadarTraceColour`, which is reversed, over `CHudColours`' own fifteen. A bright
blip takes the lighter of its pair and a dull one the darker; a threat blip is blue when it is friendly and red
when it is not, whatever its brightness; a destination blip is cream however it is asked for. The two duplicate
entries in `eBlipColour` are the same colours as the ones they copy, which the enum's own note admits. A colour
outside the enum is not an index at all but a packed colour, and the routine returns it as it stands — so the
browser unpacks it the way `CRGBA::ToInt` packed it, from the low byte up.

## The camera the script takes

`ScmCamera` was the third table the runtime had been keeping with nothing acting on it. `CCamera`'s fixed mode
is a source and a point it looks at, and the restores hand the camera back and choose the mode from what the
player is doing — all of which was already ported and none of which reached the screen.

Now it does: while the script holds the camera, the browser puts its own where the script says and looks where
the script says; when the script restores it, the browser takes it back. The one thing that needed care is that
the browser fixes its camera for its own reasons too — a stunt jump, above all — so the script's camera is only
taken away again if it is still the one the script set. Anything else the browser had fixed is left alone.

The camera a script reads back is the browser's own, whether the script is holding it or not, which is what
`TheCamera`'s source and front are; the debug camera reads the same, because this browser has no separate one
to ask and saying so is better than answering with a camera that does not exist.

## The fires the script starts

A fourth table the runtime had been keeping with nothing acting on it, and this one had a browser counterpart
waiting for it: `NativeFireManager`'s own fires already carry a script flag, because `CFireManager` keeps the
script's fires in the same array as everyone else's and will not reclaim a slot holding one.

So the browser keeps one fire for each of the script's, at the place its record says, and lets it go when the
record does. A record that changes strength asks the effect to be rebuilt, as `CreateFxSysForStrength` would. A
script fire burns until its record says otherwise rather than on a timer of the browser's own, which is what
`START_SCRIPT_FIRE` means and `REMOVE_SCRIPT_FIRE` ends. And a fire the world put out — a water jet, most
likely — is made again while the record still says it should burn, rather than leaving a hole in the mirror.

That is four of these now: the objects, the radar, the camera and the fires. Each was a table the runtime kept
faithfully and nothing looked at, and each took a small bridge rather than a port. Worth saying plainly,
because looking for the next one is better work than taking the next item off the frequency list.

## The pickups the script makes

The fifth. `CPickups` holds the script's pickups in the same array as the world's own, and the browser has a
pickup world already — so the script's records go into it, and a pickup the browser reports collected is
collected for the script, which is what `HAS_PICKUP_BEEN_COLLECTED` asks after. A pickup the script removes
comes back out of the world.

The one thing the script's record does not carry is which dff and txd its model id stands for, and the IDE
associations the object drawing already reads have it. A model the archive has no entry for cannot be drawn
and is left out, as `CStreaming` leaves out what it cannot load.

Two candidates were looked at and left alone, for reasons worth keeping. The script's text messages are a
complete table, but there is no GXT reader here, so the keys have no strings behind them and there is nothing
to show yet. Checkpoints have a bespoke renderer in the original — a tube, and a flag sprite for the finish —
rather than the marker cone this browser draws, and putting a cone where a tube belongs would be inventing the
look of something the reference describes exactly. Both wait for the thing they actually need.

## Paint, and the HUD's own colours

`CHANGE_CAR_COLOUR` takes the two paint slots to the palette entries the script names and leaves the other two
as the car's own variation chose them; a slot the palette does not carry is left alone, which is what the
loader's own unresolved paint comes to. The car is already built by then, so this is the paint binding being
told new colours rather than the model being loaded again.

`GET_HUD_COLOUR` is the table ported for the radar's blips, read directly. It is the same fifteen colours, so
a script asking after one gets what `CHudColours` holds and the blips are drawn with.

`SET_ALL_CHARS_SPEECH_DISABLED` joins its per-ped counterpart as a gate with nothing behind it: the depot
carries no speech banks, so no ped speaks and there is nothing to silence. It is held so a script that closes
and opens it carries on, and the comment says which of those two things is true.

## The generators the script places

The sixth table, and the one with the most already in it: the opening's own `CREATE_CAR_GENERATOR` calls had
made two hundred and eight generators that nothing was spawning from. `CTheCarGenerators` holds them in the
same array as the ones the IPLs placed, and the browser's fleet takes a list of that shape, so the script's go
in beside the world's. The record already carries the angle packed the way `CCarGenerator` keeps it, and the
two flags the world's own record packs into a word. The list only changes when the script makes one, so it is
rebuilt then rather than every frame.

`SUPPRESS_CAR_MODEL` is the other half: a model the script suppresses is one `CStreaming` will not bring in, so
the traffic draw passes over it. That had to reach the gang-car draw as well as the civilian one — a suppressed
model is not in memory for either — which the test found by drawing a model that turned out to be a gang car
and seeing it come back suppressed. The fallback trio the browser falls back on is filtered too, and falls back
to itself rather than to nothing if a script were to suppress all three.

## One restart table, not two

`CRestart` is a single table in the original. Here it had become two: the browser's respawn was built from the
restart points read statically out of the script's bytes before the runtime existed, and the script's own
commands ran against a second instance the game never looked at. So a mission that overrode the next restart,
or set a respawn point for its duration, or an extra hospital point, changed nothing about where the player
actually came back.

The game's table now follows the script's: both lists, the override the next restart consumes, the mission base
point, the two extra points and the two fade flags — everything in `CRestart` a script can set, and nothing
else, because nothing else is settable. It is a copy rather than a shared reference, which a test pins by
changing the script's table afterwards and finding the game's unmoved.

This is the same shape as the other bridges but worth naming separately, because the gap was not a table with
no reader — it was a table with the *wrong* reader, kept in step with a static pre-parse that could not see
anything the script did after it started. Two of the earlier bridges replaced pre-parses of the same kind: the
radar blips and the pickups were both read ahead of time because nothing was running the script. Something is
now.

## The zone the population reads

`CTheZones`' info records — the population type, the ten gang strengths, the dealer strength, the no-cops flag
and the race mask — decide which cars and which people a place produces. The browser was reading a copy taken
out of the script's bytes before anything ran them: a new game's profile, correct at the start and unable to
change afterwards. The runtime has been keeping the live table all along, and the fleet now reads that, falling
back to the read-ahead copy only where the live one has no record.

The check is in two halves, and the first half is the interesting one: at the start the two agree — the same
population type, the same gang strengths, the same no-cops flag for Grove Street — which is what running the
opening ought to produce, and the bridge would not be worth making if the run landed somewhere else. The second
half changes a zone after the script has started and watches the fleet see it, which the read-ahead copy could
never have done.

That is the third pre-parse the running script has now replaced, after the radar blips and the pickups, and the
first where the two could be compared directly rather than simply swapped.

## The jumps the script added

`CStuntJumpManager`'s list is built by the script's own `ADD_STUNT_JUMP`, so the manager's jumps are whatever
the running script has put in it. The browser's were read out of the script's bytes ahead of time; they are now
the live ones.

The two agree: seventy jumps either way, the same first and the same last. They agree on identity as well as
count, because a jump's save key is the offset of the command that added it — which is what lets the found and
done sets carry across the swap rather than a player's completed jumps coming undone.

That is the fourth pre-parse the running script has replaced.

## The set pieces the script added

The fifth pre-parse, and the same story again: `CSetPieces`' table is filled by `ADD_SET_PIECE` and emptied by
`Init`, so it is the script's. Two hundred and nine either way, the same first and the same last, and every
area sorted as `AddOne` sorts its corners — left never past right, bottom never past top.

The one difference between the two records is how the area is held: the runtime keeps `CRect`'s four named
edges, and the browser's read-ahead record keeps the same four numbers in the order it wrote them. The
conversion is a reordering and nothing more, which is worth saying because it would be easy to assume two
four-number areas meant the same order and get a rectangle inside out.

## The entrances the script switches

The sixth, and the one whose gap was written down in the code itself. `SET_CLOSEST_ENTRY_EXIT_FLAG` and
`ENABLE_ENTRY_EXIT` were adapters that did nothing, with a comment saying the world's own switches were already
applied from the file and the script's calls were only being counted so the two could be compared. That was
true when nothing ran the script. Now something does, and the calls reach `CEntryExitManager`'s entrances —
the same ones the read-ahead applied at load, and whatever the script changes later, which the read-ahead could
not see.

`SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE` stays a no-op and now says why: it wants the object pool this
browser does not keep for the world's own props, and the script's own objects answer `SET_OBJECT_VISIBLE`
instead. A no-op with a reason is a different thing from a no-op with a stale comment beside it.

## Making the player safe

`MAKE_PLAYER_SAFE_FOR_CUTSCENE` was another adapter doing nothing, and `CPlayerInfo::MakePlayerSafe` is
reversed in full. Two of the things it does have somewhere to land here: it clears
`CPlayerData::m_bCanBeDamaged` and sets all six `physicalFlags` proofs, which together mean the player takes
nothing from anything, and it sets `CWanted::m_bEverybodyBackOff`, which means a crime raises no wanted level
while it is on. Both are now real, and a test pins each — damage that bypasses armour still does not land, and
the law starts counting again the moment the flag comes off.

The rest of the routine has nothing here to reach: stopping the pads shaking, clearing the player's adrenaline,
making every car in the world undamageable. The law enforcers it also stops are the adapter beside it, which is
still a no-op for the reason already written there. Saying which parts landed and which did not is the point:
"make the player safe" sounds total, and here it is two of five things.

## Swinging the camera behind

`SET_CAMERA_BEHIND_PLAYER` was a no-op beside the two that place the player, left over from when the browser
had already put him somewhere by the time the script ran. Placing him is still the browser's; pointing the
camera is not. `CCamera::SetCameraDirectlyBehindForFollowPed_CamOnAString` sets a flag and records the ped's
facing, and the string camera takes it on the next update, which is what the browser now does — the flag is
set, consumed on the next frame and cleared, and the look timer is reset with it so the follow camera does not
immediately ease back off the angle it was just given.

Which angle that is took reading rather than guessing. The browser places its camera *along* its own direction
from the ped, so behind him is his facing turned half round — the same angle the first-person entry and the
vehicle view already use, and the opposite of what the arithmetic suggests at a glance. The in-front
counterpart is the other side of it, and both are checked by swinging the camera away first and watching it
come back.

## Turning the player

`SET_CHAR_HEADING` on the player was routed to an adapter that did nothing, again from when the browser had
already placed him. Placing is one thing and turning is another: `SetCharHeading` returns early for a ped in a
vehicle and otherwise sets both the aiming rotation and the current one, so the player now turns where the
script says and is left alone while he is driving.

The same command for a ped that is not the player was being dropped on the floor. It now reaches the pool,
which has been able to turn a ped since the peds went in — a gap left by the adapter having been written when
there was only one ped to turn.

## The adapters that stayed narrow

Following the heading command's second gap turned up four more of the same kind: adapters written when the
player was the only ped and the only car in the world, which answered his handle and gave every other one up.
The area code, the active weapon and whether a ped is shooting now answer for a ped the script made; a script's
vehicle answers the appearance and the train question for itself.

Two of those answers are about this browser rather than the original, and are written as such. A browser ped
carries one weapon, so its active weapon is the one it has — the catalog says whether that is a melee one. And
the browser builds a car for every vehicle a script makes, so one of those is an automobile and never a train;
the player's own is still whatever he is riding.

This is the fourth kind of staleness this run has turned up, and the hardest to find, because it looks like
working code: a conditional that was right when it was written and narrowed nothing at the time.

## Clearing an area, and why it is not called

`CWorld::ClearExcitingStuffFromArea` is ported: the peds in a radius that `CPed::CanBeDeleted` allows and that
are not following the player, the cars that are not the player's, not locked and not a script's own, and the
fires in the radius with the car fires among them. Every piece had a browser counterpart, several ported
already for other reasons — the mission flag on a ped, the lock on a car, the fire manager's extinguish by
point. The projectiles, shadows and explosions it also clears have nothing here to clear.

It is deliberately not wired to `CLEAR_AREA`, and the reason is an ordering difference rather than a missing
piece. In the original the script runs at game start and the opening's clear finds an empty world. This browser
builds and populates its world first and starts MAIN.SCM when that world is ready, so the same clear arrives
seconds late and sweeps away a street the original had not put there yet.

That was found the hard way: wiring it up broke thirty-nine browser specs at once, all of them specs that stand
a ped or park a car beside the player and then test something about it. The specs were not wrong — the world
really was being cleared out from under them, two seconds after it had been filled. A faithful routine applied
at an unfaithful moment is less faithful than not applying it. The routine stays, ready for a mission that
clears an area while it runs, or for the day the script starts before the population does.

### And a regression that went out before it was caught

`SET_CHAR_HEADING` on the player was turned on in the same run, and it moved the spawn: the opening sets CJ's
heading, and honouring it faced him somewhere else, which moved everything the specs place relative to him. It
was committed and pushed before the suite was run, and the suite is what found it. The player's facing is part
of the placement this browser owns — from its own start, a restart point or a save — so the heading the script
sets him is recorded and not applied, which is what the adapter now says. Turning a ped the script made, which
was the real gap in that command, stays.

## Seeing, and the fields a car keeps for later

`CPed::OurPedCanSeeThisEntity` splits cleanly into a part that needs no world and a part that needs nothing
else. In front of the ped and inside forty units is arithmetic, and a test pins it: behind is out however
close, exactly abreast is not behind, and forty units is itself out because the routine's comparison is strict.
What is left is the line of sight, cast against the world's own fixed collision, at a point a unit above the
other ped — its head, which is the raise the routine makes for a ped and not for anything else.

`CStreaming`'s random vehicle model in memory is the model the browser's own traffic draw would produce, with
the class it belongs to; a model with no class has none to give and the thread gives up rather than inventing
one.

Three `CAutoPilot` fields — the cruise speed, the driving style and whether the car loads collision round
itself — are held on the car and no more, because nothing drives a script's car here yet. They are written down
as held rather than done, which is the distinction this document keeps coming back to: a field a script sets
and nothing reads is not the same as a field a script sets and something acts on, and the comment beside each
says which it is.

## Three more, and what the suite's noise looks like

`SET_BLIP_ENTRY_EXIT` gives a blip the entry-exit nearest the point it names, by the manager's own lookup.
`IS_CHAR_RESPONDING_TO_EVENT` reads what a browser ped already keeps — the one event it is answering, and
whether it still is — which is what `CPedIntelligence`'s event group holds; the command's own dispatch is not
reversed, so that reading is written down as a reading. `EXTEND_PATROL_ROUTE` builds the route
`CTaskComplexFollowPatrolRoute` walks, and since that task is not one this browser runs, the points are kept in
the order the script gave them and nothing walks them yet.

`SLIDE_OBJECT` was looked at and left. Neither source says how the slide steps — whether the speeds are a
frame's or a second's, and whether it stops at the point or passes it — and a motion invented from the operand
names would look right and be wrong.

One thing worth recording about the browser suite, since this run measured it several times over: with retries
off it fails between six and thirteen specs, and the set moves between runs. The same range appears on an
unmodified tree. Those numbers are the noise band, not a result, and a change is only suspect when a spec fails
that the band does not contain — which is how the clear-area regression was caught, at thirty-nine.

## Making the browser suite cost less

The suite's own load sensitivity was measured rather than guessed, by running the parallel project at three,
four and five workers: seven failures at 440% CPU, nine at 592%, ten at 738%, taking 6:10, 4:54 and 4:08. The
failure count tracks the worker count, which is what a timing miss looks like and what a wrong answer does not.

Two things follow from that. The default is now three workers — about a minute slower, a quarter less CPU, and
two fewer spurious failures — with PW_WORKERS to raise it on a machine with cores to spare. And the ten specs
that kept coming back at every worker count joined the eight already listed as load-sensitive, so they run in
the quiet project with the machine to themselves rather than missing their window and being retried.

One of them was not load-sensitive at all and is fixed instead: the skidmark spec required the street to have
laid no marks before the handbrake, which is only true when no traffic has braked nearby yet. What it is about
is the marks the handbrake lays, so it counts from whatever is already down.

### Something to look at, not yet chased

In a plain run of the whole suite the quiet project reports "did not run" — its specs are being skipped, and
were before this change too, when the list was eight. Running it directly (`--project=quiet`) runs its
dependency and then all of it, 261 passed. So the specs work and the dependency works; something about the
default invocation is leaving them out. That is worth finding, because a spec that silently does not run is
worse than one that fails.

## What the engine actually costs

Measured with one page and nothing else running: thirty frames a second, a 33.4 ms budget, and 7 ms of work in
it. Render takes 3.9 of that (3.1 of it the draw itself, over about nine hundred calls), the simulation steps
2.4 — of which the named parts, peds, player and traffic, are 0.9, so most of the rest is the physics step —
and the frame's own housekeeping 0.7. The engine is idle four fifths of every frame. The machine getting hot
was the browser test suite, which runs several pages at once for minutes at a time; the game is not the
expensive thing in this repository.

That said, the bridges added this run were building rubbish. Every frame they were rebuilding the script's two
hundred and nine car generators and two hundred and nine set pieces into fresh objects, copying six arrays of
restart points, and walking the pickup and fire tables — all to discover that nothing had changed. Counting is
cheap and building is not, so each now asks a count first, and the restart table carries a revision the script's
own commands bump. Roughly four hundred objects a frame stopped being made.

One of those optimisations was wrong and the tests said so. Reusing one array for the radar blips and the fires
saves a single allocation out of however many records go in it, and costs any caller that holds two results the
ability to tell them apart — the blip spec compares the list before and after moving a car, and with a shared
array those two lists were the same list. Both went back to a fresh array, with the reason written where the
next person will reach for the same trick.

## Work that was there and never showed

The look-at chain had been ported, tested and reviewed, and no head had ever turned on screen. Native frames are
drawn from their matrix — `ModelObjects` turns `matrixAutoUpdate` off and the clips compose `matrix` directly — but
the chain read and wrote the head's `quaternion` field, which nothing reads. Its spec measured that same field, so
it passed. It now decomposes and composes the matrix, starts from the animated pose rather than identity, and the
spec measures the rendered matrix; a control run with no look task shows the released head exactly on its clip.
An audit of every transform write on a native frame found one more of the kind: the jetpack's two thrusters, whose
`RenderJetPack` swivel went to the same unread fields, with a rest position copied from an unfilled `.position`.

With the chain working, `CTaskSimpleUseGun::AimGun`'s two remaining pieces went in: the priority-3 `LookAt` at the
aim point once the aim clip is past 0.98 (speed 0.25, 250 ms blend, renewed each frame, blended out over 250 ms by
`AbortIK`), which takes the chain from CJ's random glances, and `CPedIK::RotateTorsoForArm`. The neck's half of that
turn is gated on `bRotateWithNeck`, a bool in the executable's data; the Android build does not test it, so the
neck always turns here.

## The zone name

`CPlaceName::Process` now runs every frame, on the smallest navigation zone at the player, and its text label goes
through a GXT table. No GXT file is in the depot and noclip does not host one, so the English text is transcribed
from Sanny Builder's zone list and checked against SA-MP's GXT-derived names; every label in the shipped `info.zon`
has an entry and a unit test holds that. Grove Street reads Ganton. Vehicle names are the same kind of text and stay
browser names: no SA text dump was found, and the tables that exist (gta-reversed's spawner, SA-MP's) disambiguate
names the game shows identically.

## Specs that had not run

The load-sensitive specs had been reported "did not run" in every full browser run: Playwright skips a dependent
project when any test of its dependency fails, and the parallel pass always has a few timing misses. They now run
as a second pass with one worker (`npm run test:browser`). Of the twenty, six had rotted: two found a real bug (a
recruited Families member kept his gang party — and a party still loading its members enlisted anyone recruited in
the meantime — so the homie hung out with his old gang instead of following or boarding), and four were spec
problems, mostly the same one: the car hooks move whichever car is nearest CJ, and the script's parked car
generators now put cars nearer to where the specs stood him. `native-melee-combo` misses its third blow about half
the time even at the commit that last touched it; that is the spec's timing, not a regression.

## Reading the ports against the reference, line by line

This round set review agents to read a port beside the reversed routine it names and report only behaviour that
differs. Every finding was checked against the reference before anything changed; the ones that held:

- **Wanted level.** The script's wanted commands drove a CWanted of their own that nothing read, so a mission's
  stars never showed and its maximum and multiplier never applied; the player's CWanted is now the script's. A
  back-off (police, garage or everybody) zeroes the cops, cars, roadblocks and helicopters wanted and is recomputed
  when it changes, where the port had instead thrown the player's crimes away. SetWantedLevel clamps to the
  maximum; a gang war zeroes a crime's chaos; only the player's own vehicle can be the elusive one (a police
  helicopter anywhere had frozen decay) and an interior is an elusive zone; helicopters count toward presence by
  3D distance; death keeps the level until resurrection. The good-citizen bonus pays $50 for hurting a ped the
  police are chasing while clean.
- **Weapons.** Bullets on a ped report DAMAGED_PED and DAMAGE_CAR at once and only queue the cop variant, where
  the port forced two stars for shooting a cop; the flamethrower reports nothing; sniper rounds no longer push cars
  and hit props by CBulletInfo's own rule; flame and spray shots pass walls as CShotInfo moves them; a reload
  survives a weapon switch; an empty clip refills on the press; fast reload works; the camera spends film; a thrown
  satchel hands over the detonator, which is spent; photos mark what they catch for the script; non-police peds use
  the standard skill row.
- **Car damage.** Undamageable and collision-proof cars take nothing from crashes or their roof (one could burn
  forever below 250 and refuse to blow up); the Securicar, RC and Rhino multipliers; ramming a manned police car is
  a star; the roof-speed test for panels; the reset to 1 health only for a car that had health; a sinking car does
  not burn; a van's back doors; a locked car keeps its side doors; doors only swing open on driven, unlocked cars,
  from any impact; the crashed windscreen flies off rather than shattering; a wreck drops a wheel; a torn-off bonnet
  launches as ProcessOpenDoor sends it.

Two of the review claims were set aside: the reference's photograph test for objects is inverted against the peds'
(a refactor's, most likely), so both use the peds' reading; and the forbidden-territory stars cannot fire while this
browser runs with every city unlocked.

Alongside, two rendering mistakes of the kind that look implemented but never show: a ped first drawn solid could
never fade, because three compiles an opaque material with its alpha forced to 1 and does not recompile when
`transparent` flips; and the hidden volumetric clouds piled up buffer update ranges every frame.

## The intro that cannot finish

MAIN.SCM launches INTRO on a new game, and in this browser that mission stops for good at its first
`HAS_CAR_RECORDING_BEEN_LOADED` loop: no host reads carrec.img, so recordings 706 and 707 never arrive. Everything
the intro sets before that point stays set, and everything it would undo later never happens. Three settings pass
through that window:

- **The clock** — the intro's `SET_TIME_OF_DAY 6 30` is honoured. CClock is one clock for the script and the world,
  so the world picks it up and runs on from there. A new game in the original also comes out of the intro in the
  morning.
- **Zone names** — MAIN.SCM turns them off before launching INTRO, and only the intro's end turns them back on.
  Honouring `DISPLAY_ZONE_NAMES` would hide the area name for the whole of free roam, so the script's switch is
  recorded but not applied. The plane gate CHud::DrawAfterFade also has still applies.
- **Forced weather** — INTRO forces weather 14 (SUNNY_COUNTRYSIDE) and releases it only at its end. The script's
  FORCE_WEATHER, FORCE_WEATHER_NOW and RELEASE_WEATHER therefore stay on the script's own CWeather copy and do not
  reach the rendered weather. Handing the world's weather to the script would freeze free roam on the intro's sky.

- **Fades.** MAIN runs `DO_FADE 0 0` (instant black) before launching INTRO, and only the intro's end fades back in.
  - The script therefore keeps its own fade until the INTRO thread has run and gone.
  - From then on, DO_FADE shares TheCamera's single fade with the game logic, the entry exits and the restarts, and is drawn.
  - Before this change, the script's fade was a separate copy that nothing drew, and its fade checks could not see the game's fades.

Once car recordings load and the intro can play through, the zone names and the weather should be handed over as the clock was; the fade already is.

carrec.img is now published and read (`src/assets/carRecordings.ts`, with CVehicleRecording's playback in
`src/engine/carRecordingPlayback.ts`). The host still does not hand recordings to the script. Marking 706 and 707
loaded in the browser lets INTRO past its wait (after a CLEAR_CUTSCENE and the special-character loads). It then
stops for good at `PRELOAD_BEAT_TRACK` (no adapter) and the thread is retired. Wiring the recordings would only move
the stall and retire the thread, so it waits until the intro's later commands have adapters. Letting the intro
take over Explore is a decision in its own right. The retail file stores steering, gas and brake as signed bytes,
although the reversed header declares them unsigned.

## Vehicles, restart, doors, garages and cheats

A further round of per-subsystem reviews against gta-reversed. Where the reference code is only a stub (the bike's
ProcessControl, FlyingControl, CPlane/CHeli::ProcessControl, most of CGarage::Update), the port's model stays its
own and was not "corrected"; what the reference does settle was fixed:

- **Cars.** The speed-sensitive steering lock reads tarmac grip from surface.dat (4.5, not 1); the coast brake
  (fWheelFriction 0.9 over the mass) runs off the throttle; a slow car with no gas comes to rest; a car balanced on
  one side is tipped back onto its wheels; gear changes lift the nose; a drowning car loses its gas; a car is held
  while the script has the controls; only the player's car gets the player's steering and grip rules.
- **Bikes and boats.** Knock-offs take the collision impulse; the BMX, Chopper and Mountain Bike bunny-hop; boats
  steer by their handling lock with the stick eased and negated, reverse at 0.3 of an eased brake, square each hull
  point's depth, run their drive out of the water, get their wall and post-collision flags, burn out rather than
  exploding on impact, and sink when wrecked.
- **Aircraft.** Leaving a drifting aircraft slows it until the pilot can step out; a burning aircraft crashes and
  burns; the rotor is read on its native scale.
- **Restart and doors.** The script's restart table is the game's; resurrection restores max health, counts its
  stats, ends a gang war and, from indoors, restarts near the door entered and streams the outside world back;
  doors are found through the manager's quadtree leaves, hide while the script holds the controls, and hold CJ
  through a warp.
- **Garages.** The fifty named grge rows load for the script, and its garage commands follow CGarages' door states.
- **Cheats.** The monster truck, HESOYAM's maxima, the wanted ceiling, the orange sky, the vehicle skills and the
  script's car-cheat test follow CCheat.

Left as they were, on purpose: the port's 9.81 m/s² gravity (boats and planes scale their buoyancy to it, and the
authored bike and flight models are balanced on it); the plane drag coefficient (the authored thrust it balances is
not reversed); every city unlocked; doors defined on building models (a separate job: their 2dfx is not parsed).

## Drops, food, fires, pickups and the police response

Another round of per-subsystem reviews against gta-reversed, each claim read on both sides before it was changed:

- **What bodies leave.** CPed::CreateDeadPedWeaponPickups drops every weapon a ped carries but fists and the detonator,
  a gun with up to twice AmmoForWeapon_OnStreet and a melee weapon even without ammo (a street cop leaves the pistol
  with 60 rounds and the nightstick). Same-weapon drops within 5 units merge, drops time out instead of vanishing
  when the player walks off, and SET_DEATH_WEAPONS_PERSIST keeps a script ped's. Script peds drop only the money
  SET_CHAR_MONEY gave them. Stealth kills report CRIME_STAB_PED whoever the victim is, and CEventDeadPed reaches cops
  and peds above or below, but not a body under water.
- **Food and the body.** Eating heals through the health stat and turns the rest into fat; after 48 game hours
  without food the player loses fat, then muscle, then health (WorkOutEnergyFromHunger). The one-time vehicle
  freebies (ambulance, taxi, Enforcer, hot dog van, Caddy, police car) are paid. AR_STATS.DAT is published and grows
  stamina and bike skill; bike skill reaches the knock-off force.
- **Fires and wrecks.** Hosed fires steam; any Rhino blows up what it rams; the blast sits off-centre; burning
  aircraft blow up after 5 s; wrecks are lit scorched (0.18 grey ambient, no reflection) rather than repainted.
- **Pickups.** Bribes from any vehicle, money without a pulse, the briefcase's turn, the jetpack's weapon refusal,
  $100,000 a snapshot, script street pickups regenerating and HAS_PICKUP_BEEN_COLLECTED answering once.
- **Police.** Roadblocks come from ROADBLOX.DAT nodes rolling m_nChanceOnRoadBlock within 90 units; police
  helicopters follow NumOfHelisRequired and SWITCH_POLICE_HELIS; a sniper shot through the pilot downs one.
- **Script commands that stopped missions** and now do what the reference does: SET_CHAR_MONEY,
  SWITCH_EMERGENCY_SERVICES, SET_UPSIDEDOWN_CAR_NOT_DAMAGED, SET_ALL_CARS_CAN_BE_DAMAGED, UPDATE_PICKUP_MONEY_PER_DAY,
  SET_DEATH_WEAPONS_PERSIST, SWITCH_POLICE_HELIS, CREATE_SCRIPT_ROADBLOCK and CLEAR_ALL_SCRIPT_ROADBLOCKS; the food
  stats no longer throw.

Left as they are, on purpose or for want of a reference:

- **Emergency services.** No ambulances, medics, fire trucks or firemen exist. The crews' tasks are reversed, but
  CCarCtrl::GenerateEmergencyServicesCar is not, so when, where and how many would all be invented.
- **Roadblock pairs.** The reversed GenerateRoadBlocks makes a roadblock at a node without a path width only with a
  partner node, and Los Santos has about a dozen such pairs. Its loop also holds an unreachable block that reads like
  a lone-node fallback placed inside the loop by mistake; the port follows the code as written.
  CreateRoadBlockBetween2Points is a stub, so the cars and crew are the port's own.
- **Hunger without food.** Restaurants are scripts, which do not run past the intro, so after 48 game hours the only
  meals are the hot dog van's freebie, a save or a restart.
- **The body.** CClothes::RebuildPlayer and GetFatAndMuscleModifier are stubs: the fat and muscle stats move but CJ's
  shape and walk do not, and the sprint scale stays the port's own.
- **Cop bikes and pursuit blocking.** The bike's share of cop cars and the handbrake-stop pursuit are not ported.
- **Property.** For-sale properties are bought by walking into them; the scripts that sell them in the original do
  not run.

## Ped decisions from the retail files

- **The decision makers ship.** The eight default files (data/Decision/Allowed: GangMbr, Cop, R_Norm, R_Tough,
  R_Weak, Fireman, m_empty, Indoors) are published from the depot, so every event that asks a decision maker now
  draws from the retail rows rather than the authored stand-ins. The stand-in tables for dead peds and jackings match
  those rows and stay as the fallback. Each event draws with its own random source.
- **Gang sight.** CPedIntelligence gives gang members 40 units of sight and hearing, so a gang member sees a gun
  aimed at him from 40 units (15 for everyone else).
- **Low aircraft.** CAutomobile::DoHeliDustEffect raises CEventDanger (priority 20) every 20th frame while a
  helicopter with its rotor turning (or the Hydra hovering) is within 50 units of the camera and less than 20 units
  (30 for the Hydra) over the ground or water. Street peds within that radius across the ground smart-flee the
  aircraft for good; gang members and cops have no answer in their files. CHeli::ProcessControl and the plane code
  that call it are not reversed, so which planes besides the Hydra call it is not known.
- **No duck from a sniper.** CEventGunShotWhizzedBy's only answer is a duck, and none of the default decision files
  has a row for it (event 49), so street peds do not answer it.
- **A dead gunman.** CTaskComplexSmartFleeEntity keeps fleeing from a ped who has died, as long as that ped still
  exists, and gives up once it is removed. It no longer turns the flee on the player.
- **Attractors ask too.** CEventAttractor is made with no task of its own, so once AffectsPed's rolls pass, the ped's
  decision maker answers it (event 27, neutral column). R_Norm uses the effect or passes it by, half and half (its
  look answer is an avoided task). R_Weak uses it two times in three. Tough peds and gang members have no row and
  never use one.

## Audio zones and the script's conversations

- **CAudioZones.** Audiozon.ipl's `auzo` rows (152 boxes and the three script spheres AWARDS, BEACH and LOWRIDE,
  all off) now load into the game state, with box corners kept to an eighth of a unit as CompressedBox keeps them.
  SWITCH_AUDIO_ZONE switches them by name without case, so a script calling it no longer stops. Update lists the
  active zones around the camera every 16th frame or after 20 units of travel. Nothing plays from the lists yet:
  CAEAmbienceTrackManager::UpdateAmbienceTrackAndVolume is not reversed and the ambience streams are not published.
- **Conversations.** CLEAR_CONVERSATION_FOR_CHAR frees the ped's slot and leaves its status and enabled flag.
  ENABLE_CONVERSATION only touches a conversation the ped already has. IS_CONVERSATION_AT_NODE compares the whole name
  with the six characters stored, so a longer name never matches. The status values are the source's four;
  DoneSettingUpConversation and CConversationForPed::Update are not reversed, so a conversation sits at its first
  node with its status untouched until something moves it.

## The quad and the monster trucks

- **Quad rider lean.** CQuadBike::ProcessAI leans only the rider: LeanAngle = d^ts × LeanAngle − FullAnimLean × steer
  / steer lock × (1 − d^ts), with the QUADBIKE bike row's desLean 0.88 and full anim lean 43°. The quad's body stays
  level, and the rider's quad_left/quad_right now play from that angle. The quad still drives on the bike controller,
  not CAutomobile's suspension, so it does not pitch or roll with the ground; that is a larger port.
- **Monster trucks.** The Monster, Dumper and Dune are CMonsterTruck, a CAutomobile, but the loader only took `car`
  types, so the monster truck cheat built nothing and said nothing. They are now built as cars on their handling
  lines. CMonsterTruck's own ProcessSuspension, SetupSuspensionLines and ExtendSuspension are not reversed, so the
  suspension is the car's. Traffic and parked-car generators still leave them out.
- **Dead code.** WorldBike's wheel spin, wheelie and stoppie values were computed and never read; they are gone.

## The game's own text

- **AMERICAN.GXT is published.** noclip does not host `text/`, so the file comes from a GitHub mirror of a PC install
  (ElechugasCheraxxx/GTA_SA_MODDED). It is the stock PC 1.0 file: its MD5, 6791e6e0ffa6317af8a0dff648c9633d, is
  the value Multi Theft Auto's MTADiag expects for `text\american.gxt`. The other copies found were a mod's (renamed
  vehicles, its own credits) and a 16-bit mobile build.
- **CText.** `src/assets/gxt.ts` reads it as CText::Load does (TABL, then MAIN's TKEY and TDAT; mission tables on
  demand), looks keys up by CKeyGen's JAM CRC of the upper-cased key, returns "" for a missing or blank key, and
  turns the font codes into text with GxtCharToUTF8's table.
- **First uses.** The HUD's vehicle name is TheText.Get of the model's game name (MONSTA reads "Monster"). The
  transcribed zone names are checked against the GXT, which corrected EBAY to "Easter Bay Chemicals".
- **The lines the game shows by key.** The gang war messages (GW_*), the stunt jump bonus (USJ, USJ_ALL, REWARD),
  the hunger help (NOTEAT), the tag counts (TAG_ONE, TAG_ALL), the collectible counts (HO_, OY_, SN_ONE and _ALL) and
  the property's not-enough-cash line (PROP_1) now come from TheText, with CMessages::InsertNumberInString filling
  the ~1~s. The browser's HUD draws plain text, so ~n~ breaks the line, colour tokens drop, and a ~k~ control shows
  the browser key where there is one. The port's old wording stays only as the stand-in until the GXT has loaded;
  the collectible lines no longer add a reward that the original's message does not show.
- **The good citizen bonus has no text.** CCrime::ReportCrime shows TheText.Get("GOODBOY"), which the PC GXT does not
  carry, so the big message is blank; the $50 still comes. A locked property shows its own label or PROP_4.
- **Weapon swaps stay automatic.** CPickup::Update makes a weapon pickup wait for the collect button (PU_CF1) when
  the player's slot already holds another weapon, and hands shotgun, SMG and rifle ammo straight over. The port's
  inventory has no slots (every weapon keeps its own ammo, and the arsenal starts full), so pickups still give the
  weapon at once.

## Props that come loose

- **Hydrants, parking meters and fences.** When a prop comes loose, CPhysical::ApplyCollision's static-object branch
  and CWorld::TriggerExplosionSectorList now apply the special cases. A fire hydrant bursts: Fx_c::TriggerWaterHydrant
  is unreversed, so the water_hydrant system plays at its base, pointing up. A parking meter hit loose drops
  CreateSomeMoney(rand % 100). Any other prop that does not cause explosions is marked exploded, and all of these
  happen once, on bIsExploded. An explosion always frees bar_barrier10 and bar_barrier12 (MI_FENCE, MI_FENCE2),
  whatever their uproot limit.
- **Props that explode.** CObject::TryToExplode and Explode now apply in full. The blast goes half a unit above
  the prop. A breakable prop then takes ObjectDamage(10000); any other with mass under 99998 jumps 0.5 units a frame
  upward and up to 0.0256 across, coming loose if it was fixed. CObject::ProcessControl then hides the prop on a
  1-in-32 roll each step.
- **Bikes and props.** Bikes now go through the same static-object branch as cars (shared in
  `vehiclePropContacts.ts`), with CVehicle::IsSubBike's triple object damage, so they smash and uproot OBJECT.DAT
  props rather than treating each as a wall.
- **Wrecked bikes and boats explode.** The main loop called their afterStep twice a step. The first call took the
  pending BlowUpCar and threw it away, so a wrecked bike or boat never set off its explosion.
- **Fallen lamp posts.** A loose lamp post (CObject::Init's bIsLampPost: the street and traffic light models and
  anything that sways in the wind) that leans past GetUp().z < 0.66 no longer meets cars in the solver, as
  CObject::ProcessEntityCollision ignores vehicles then. Peds still meet it: their character controllers query the
  collider directly.
- **Loose props still take damage.** A prop already knocked loose is damaged when a car or bike hits it with an
  impact over 20, as CPhysical::ProcessCollisionSectorList does after the general branch. The solver has already
  resolved that collision, so its contact impulse (kg·m/s over 50) is the damage intensity.
- **Still open from the object audit:** the flat ObjectDamage(50) for a smashable prop a vehicle rides over (it
  needs the prop's bounds); fallen props that cannot be smashed are still solid to
  cars; 
  settled props never freeze again.
- **A parachute for a high bail-out.** CPlayerInfo::StreamParachuteWeapon's timer runs while the player sits in a
  plane or helicopter. It is re-armed for 5000 ms each time it runs out while the aircraft is more than 50 units up,
  and held once he is out. GivePlayerParachute's caller is not reversed, so the host hands the parachute over, as the
  current weapon, as he leaves the aircraft with the timer running.
- **Stat updates in the help box.** CStats::DisplayScriptStatUpdateMessage now draws a stat's GXT name (STATnnn),
  "+" or "-" and a bar out of 1000 in the top-left help box, for the stats its reversed switch lists moving by more
  than 1 (total respect for any change). It does not show while the widescreen borders are up or another help line
  is showing, nor for a capped stat already at 1000. Callers: the running, sprinting and motorbike AR_STATS
  increments (bike skill is in the switch's second group, with flying, lung capacity, cycling and luck, so the
  riding increment shows), hunger's fat and muscle losses, and the script's
  SET, REGISTER, INCREMENT and DECREMENT stat commands (the _NO_MESSAGE forms stay quiet). CHud::DrawHelpText is
  not reversed, so the box's look is authored.
- **Change-model damage.** The props OBJECT.DAT gives the change-model effect (fire_hydrant, bin1, postbox1,
  vendmach, parkingmeter and the like) carry a single atomic, so there is no damaged model to swap to; the effect's
  state is kept and nothing else changes on screen.
- **Help lines in the help box, briefs as subtitles.** The lines the original gives CHud::SetHelpMessage (hunger's
  NOTEAT, USJ_ALL, the gang attack's GW_ATK, the property's PROP_1 and PROP_4) now show in the top-left help box
  rather than the bottom prompt. The gang war lines, CMessages::AddMessageQ briefs of 4500 ms, show as bottom
  subtitles rather than big messages.

## Lights and weapon sounds

- **Coronas behind props.** CRegisteredCorona::Update's line-of-sight test checks buildings only, so fences, signs
  and the lamp's own post no longer hide a corona.
- **Damaged lights go dark.** ProcessLightsForEntity and DisplayActualLight skip an entity with m_bRenderDamaged,
  so a lamp or signal that has been hit (or smashed away) stops lighting. A signal tipped past 0.96 also loses its
  walk sign.
- **Train-crossing and bridge flashes.** FLASH_TRAINCROSSING needs bTrainCrossEnabled, which only trains set, and
  FLASH_UNUSED needs CBridge's flashing; the port has neither, so those lights stay off, as they would.
- **Explosion volume.** CExplosion::AddExplosion's sound goes with its FX: -36 dB for a molotov, nothing for a
  molotov landing in water or for a grenade blast with a victim.
- **Gunshot tails indoors** lose 1 dB an update when CGame::CanSeeOutSideFromCurrArea is false. **The flamethrower's
  gas loop** stops while the player swims.
- **Checked:** the camera shutter's flag 0x10 is m_IsUnpausable in CAESound's bitfield even though the enum names it
  SOUND_IS_PAUSABLE, so the port's "unpausable" matches.
- **Not portable:** the vehicle head, tail, brake and reverse coronas (CAutomobile::PreRender, DoHeadLightEffect,
  DoTailLightEffect) and every point light are unreversed.
- **Corona textures.** The world coronas draw with coronastar and pool with shad_exp rather than reading each
  effect's own names. A survey of the lights in four regions (Ganton, downtown LS, SF, LV; 4,264 placements) found
  only coronastar with shad_exp, so the two agree.
- **Sun glare.** ProcessLightsForEntity's EFFECT_SUN_GLARE branch is ported: a coronastar where the sun would glint
  towards the camera, sized √distance × SunGlare / 2 and coloured (sun core + 510) × √alignment × SunGlare / 3, range
  120. The same four-region survey found no world placement carrying one, so it rarely shows.
- **One weapon audio entity per ped.** Each NPC gunman keeps its own CAEPedWeaponAudioEntity, following the ped,
  so the 25 ms repeat limit and the minigun and flamethrower states carry from shot to shot. Before, every NPC shot
  made a fresh entity at the muzzle.
- **Fire sounds retrigger on the crackle.** CAEFireAudioEntity starts a new crackle and low-loop pair only once
  m_SoundLeft (the crackle) has stopped, rather than whenever the low loop had faded, which stacked crackles.

## The scripts stop when the player drives

- **The bug.** Getting into a car stopped the whole script runtime within seconds. HJ (the stunt bonuses) and TRAINSL
  asked IS_CHAR_IN_MODEL of the player's car, whose handle (PLAYER_VEHICLE_HANDLE) the script-car pool does not hold.
  That threw an ordinary error rather than UnsupportedScmCommand, which ScmMission treats as fatal to every thread.
- **The fix, in two parts.**
  - The player's own car now answers through its handle: its model, position, heading and existence, and (through
    the host's playerVehicleEntity) every command the script's own cars answer. A bike, boat or aircraft answers
    its position, heading, matrix and uprightness through playerVehiclePose.
  - Any other failure inside a thread's command retires that thread alone, recorded in gaveUp with the command,
    offset and message, as an unsupported command already did. MAIN and the rest keep running.
- **HJ's commands.**
  - IS_CAR_IN_AIR_PROPER is ported: no building or vehicle among the colliding entities.
  - IS_CAR_UPRIGHT (handler unreversed) answers from the up axis.
  - GET_WHEELIE_STATS and the wheelie and stoppie questions read zeros, because CPlayerInfo's counters are kept by
    unreversed code the port does not measure.
  - RANDOM_PASSENGER_SAY is silent, because the speech banks are not published.

## Gangs and passers-by on foot

- **The party's walk ends at a node.** CTaskComplexGangLeader ends the walk only once its 0-15 s timer is out and
  the leader stands within √2 of his next or last path node. It then hands the group to the RANDOM allocator, a stub,
  so the port lets the party part there, as before.
- **The leader talks while he walks.** ControlSubTask runs the leader's 5% looks and talk clips whatever his
  subtask, except while he runs or sprints. A new talk clip waits while ShouldLoadGangAnims keeps the block out,
  with the player driving past faster than 0.02 units a frame. Followers still keep still, because GangFollower is
  not reversed.
- **Walking into a ped asks the decision maker.** CEventPotentialWalkIntoPed (event 13) now goes to the ped's
  decision maker: the avoid task or no response, drawn once for each ped met. A tough ped facing a neutral one
  sidesteps half the time, as R_Tough's row says.
- **Not ported (unverifiable).** LookForChatPartners, LookForGangMembers, LookForSexyCars, the Partner tasks and
  GangFollower are stubs upstream. The gang leader's cigarettes and beer, and the greet/deal group responses, sit
  behind hooks gta-reversed ships disabled, or behind RANDOM.grp and a stubbed MakeDecision.

## Damage that should not land, and the push that should

- **Friendly fire.** CEventDamage::AffectsPed turns away damage to CJ from a ped in his own group (his recruits)
  unless it is an explosion. It also turns away a Grove Street Families member's grenade-or-heavier weapon unless
  that ped's kill task is on CJ.
- **Proofs.** MAKE_PLAYER_FIRE_PROOF now stops molotov and flamethrower damage (and burning, which CFire deals as
  the flamethrower). CHEAT_NO_ONE_CAN_STOP_US (the AK recruit cheat) spares CJ every weapon, while explosions and
  cars still hurt: ComputeWillKillPed returns early for weapon types below WEAPON_LAST_WEAPON.
- **Knockback on CJ.** ComputeDeathAnim's and ComputeDamageAnim's ApplyMoveForce now reach the player: a floored or
  killed CJ is pushed away from the source (force × 50 / 70 m/s) and lifted by the vertical 5, as street peds were.
- **Kills register as CDarkel does.** A kill counts only when the player made it (CEventHandler::RegisterKill sends
  others to RegisterKillNotByPlayer). The port's own respect and mission kill counts no longer rise when a recruit or
  a rival gang kills someone. CDarkel::RegisterKillByPlayer's stats are ported: +1.5 respect for a cop or dealer; a
  Grove Street member costs 5 respect and counts as a friendly (and, when in CJ's group, a recruited) gang member
  killed; any other gangster gives +0.75 and counts as an enemy gang member killed. Street peds shooting street peds
  now report their kills.
- **Choking.** A spray can, extinguisher or teargas hit gives a street ped CTaskSimpleChoking: GAS_CWR in place of
  the hit clip, held 1-2 s (UpdateChoke's range), then the personality response. ProcessPed is not reversed, so
  holding still is the stand-in for what the task does in between.
- **Time on the ground.** A floored street ped now follows CTaskComplexFallAndGetUp: the fall clip, then the lie
  time, then the get-up clip. The lie time is 1000 / (m_nWeaponShootingRate / 40) ms (1 s at the default rate of
  40) for a weapon's knockdown, and 1000 ms for a car, being run over or a fall. It used to be a flat 3.5 s whatever
  the clip.

## Waves on the water

- **The swell:** the water near the camera is displaced with CWaterLevel::CalculateWavesOnlyForCoordinate. It uses three sines, the WATER.DAT big and small wave strengths, CWeather::Wavyness and SYNC_WATER's time offset.
  - It covers the camera ±48 units, as SetCameraRange does, on a 2-unit grid. Water outside that range stays flat.
  - The per-cell multipliers faWaveMultipliersX/Y are data in the exe, not in the source. They are set to 1.0 here.
- **Gameplay height:** CWaterLevel::GetWaterLevel adds the waves through AddWaveToResult, which is not reversed. The stand-in in src/world/waterLevel.ts adds the same drawn swell, so swimmers, boats, drowning checks and the underwater camera ride the surface on screen. `levelNoWaves` keeps the flat GetWaterLevelNoWaves height.
  - Unlike the drawing, gameplay adds the waves at any distance from the camera, as GetWaterLevel calls AddWaveToResult unconditionally.

## The player's shadow

CPed::PreRenderAfterTest decides when a ped gets a real-time shadow, and the port follows it for the player:
- **Kept** on a BMX, bike or quad.
- **Dropped** in any other vehicle, and from the moment he sets off for a car's door as its driver.
- **Dropped** when touching water, since CPed::ProcessBuoyancy marks him submerged.
- **Dropped** while lying down, unless ducking. Lying means his position is more than 0.2 above BONE_SPINE1; the drawn ped's root stands in for that position.

A dropped shadow fades at the real-time shadow's ±3 steps per frame; it used to be hidden outright in any vehicle.

## Headlight pools

- **Behind the camera:** StoreCarLightShadow drops a pool that lies more than 7 units behind the camera, measured along its 2D front. That 7 is DoHeadLightReflection*'s maxViewAngleCosine. The port now drops them too.
- **Bikes:** motorbikes now light the road. DoHeadLightReflectionSingle gives bikes and the quad a fixed lightSize of 1.25. CBike::PreRender and DoVehicleLights are not reversed, so the lamps are authored:
  - a motorbike lights one lamp (the right, single pool);
  - the quad lights both (the twin pool);
  - BMX, Chopper and Mountain Bike (CBmx) light none.
- **Not ported:** the exemption from the distance cull and fade in top-down cameras and cutscenes.

## Shadows under passers-by

**Ped blob shadows.** Every drawn ped except the player now casts CPed::PreRenderAfterTest's dummy shadow, via CShadows::StoreShadowForPedObject:
- **Shape and blend:** the `shad_ped` blob, SHADOW_DEFAULT (SRCALPHA, INVSRCALPHA), 4 units deep.
- **Placement:** at BONE_ROOT, shifted away from the sun by CalcPedShadowValues' displacement.
- **Strength:** the timecycle's shadow strength, full to 7.5 units from the camera and gone at 15.
- **Why only NPCs:** this is the FX quality in which only the player has a real-time shadow.
- **Not ported:** the IsSphereVisible(2) cull. The renderer clips instead.

**UV fix for light pools.** projectShadowReceiver already hands back 0..1 texture coordinates across the footprint. The pool shader remapped them again (uv·0.5+0.5), so every stored and static shadow sampled only one quadrant of its raster: street-lamp pools, traffic-light glows and headlight pools alike. They now sample the whole raster.

**Scorch marks.** Every CExplosion::AddExplosion ends with CShadows::AddPermanentShadow, which leaves a scorch:
- **Look:** black SHADOW_DEFAULT `shad_heli`, half-size 8, intensity 200, zDistance 10.
- **Lifetime:** 30 s, in a table of 48.
- **Authored:** AddPermanentShadow and UpdatePermanentShadows are not reversed. The port holds each mark at full strength for three quarters of its life, then fades it out.
- **Not yet:** CObject::ObjectFireDamage's smaller scorch (half-size 3) under props burnt to their damaged model. Fire damage to props is not ported.

**Script shadows.** DRAW_SHADOW (016F) is ported in ScmGameCommands, but, like DRAW_CORONA and DRAW_SPHERE, no host draws it yet. It belongs to the mission-command gap.

**Fire glow.** The tail of CFireManager::Update is ported:
- **Grouping:** fires are grouped around the strongest one not yet visited. Any fire within 6 units (2D) joins its group.
- **Ground glow (group strength above 4):** an additive `shad_exp` static shadow 5 units above the strongest fire.
  - Colour is (40, 32, 20) × a random 0.6 to 1, redrawn every frame, so it flickers.
  - Half-size is 1.2 × min(7, strength − 3); zDistance 10; visible to 40 units.
- **Coronas (group strength above 6):** four headlight coronas in a ⊥ shape, 70 units range. The reversed source computes their position from `point` inside `point`'s own initialiser. The port starts 2.6 units above the fire and pulls 3.5 units toward the camera.

**Missile glow.** CEntity::PreRender gives a missile in flight (rockets and heat-seekers):
- a flickering additive `shad_exp` pool (half-size 8, zDistance 20);
- a shinystar corona out to 300 units.

Its CPointLights light is not ported, as with every other point light.

**Pickup effects, corrected attribution.** DoCollectableEffects runs only for MI_COLLECTABLE1. That model is `package1`, which SA never places. The collectables' 4096 ms turn therefore comes from the unreversed DoPickUpEffects, and is marked authored.
- **Not drawn:** the briefcase's DoMineEffects red torus corona and glow. The torus sprite (`coronaringb`) needs a second corona texture.

**The player's car under street lamps.** CShadows::RenderExtraPlayerShadows is ported:
- **Source:** every shadow-casting point light the player's car is inside. These are the PLTYPE_POINTLIGHTs that ProcessLightsForEntity adds for lit 2d effects with a range; the port now collects them, though it still does not light the world with them.
- **Shadow:** a black `shad_car` cast away from the light, half the bounding box in size, zDistance 4.5.
- **Strength:** CalculateShadowStrength(distance, radius, 5/8 of the timecycle's).
- **Excluded:** the RC Bandit. Bikes, boats and planes never reach it.
- **Not yet:** helicopters, which the reference allows.

## What the follow camera bumps into

CCamera's follow modes, Process_FollowPed_SA and Process_FollowCar_SA, are not reversed. The collision rules around them are, and the port now follows them.

**The cone cast (CCollision::BuildCacheOfCameraCollision)**
- **Tests:** buildings, vehicles and objects only. Peds never pull the camera in.
- **Entering a car:** the car being climbed into is ignored (CTaskComplexEnterCar::GetCameraAvoidVehicle), from the door opening until the ped is seated, and during get-out and drag-out.
- **In a slow vehicle** (at most 0.2 units a frame): cars whose speed relative to the player's is at least √0.1 units a frame pass through (CameraVehicleModeSpecialCases). Objects still block.
- **In a fast vehicle:** that threshold becomes 1 unit a frame, and objects (placed props, loose props, debris) stop blocking.

**Peds at the camera (CCollision::CheckCameraCollisionPeds)**
- **Rule:** a ped whose bound centre is within 1 unit of the camera, and which reaches the near clip, is made invisible for that frame. This applies on foot always, and in a vehicle only while it is slow.
- **Authored:** the ped hit colmodel's 12 spheres are replaced by five spheres of radius 0.25 up the ped's axis.

**Car zoom**
- **V in a vehicle:** now steps the three car zooms instead of the on-foot distance.
- **Authored:** their distances are in the unreversed FollowCar code. The port scales its chase distance by 0.75 / 1 / 1.35.

## Unique stunt jumps: messages, camera and pool

CStuntJumpManager::Update already matches the reference. The pieces around it now do too.

**Messages**
- The title goes through AddBigMessageQ(USJ, 5000). It waits for a big message already showing.
- The reward is its own AddBigMessageWithNumber(REWARD, 6000), which outlasts the title by a second.

**The HUD's message clock**
- The HUD times the messages CMessages and CHud own on game time, as CTimer::GetTimeInMS does, so they stand still while the game is paused. These are big messages, the white middle message, help and stat updates.
- The port's own prompts stay on the wall clock.

**Camera**
- CCam::Process_Fixed forces FOV 70 whatever mode the player was in, including aiming and first person.
- The jump hands back only the camera it took, never a script camera set in the meantime.

**The pool**
- CStuntJumpManager::AddOne takes any values. With all 256 slots used, nothing is added and no error is raised.

**Not yet**
- Wheelie, stoppie and two-wheels bonuses still never fire. CPlayerInfo::Process, which counts them, is not reversed, and neither is GET_WHEELIE_STATS.
- (Since drawn: the HUD now shows the script's CMessages queues; see "GXT text sweep".)

## Breakable glass

**Fixed**
- **Frame timing:** CGlass::Update and the falling panes now step once per native 30 fps frame with CTimer's 50/30 step.
  - Before, they stepped every 60 Hz tick with a step of 1, where CTimer's is 50 a second, so panes drifted 1.2× too fast and dropped 1.44× too fast.
  - The per-frame tumble, which the timestep does not scale, ran twice as often, so pieces spun too fast.
- **Glint blending:** the glints draw ONE/ONE with the colour carrying the alpha, as CGlass::Render sets it. Three's additive blending had squared their brightness.
- **Landing sound:** a landing pane always reports AE_GLASS_HIT_GROUND.
- **What can break:** only CObjects (models with an OBJECT.DAT entry), per CGlass::IsObjectGlass. A glass-flagged building never breaks.
- **Explosions:** they reach glass only through TriggerExplosionSectorList. The window must be static and inside the blast radius, and the explosion's force must beat its uproot limit. Before, every explosion cracked everything within 30 units.

**Not changed**
- In the reversed code, type-1 glass objects are hidden (CPopulation's dummy conversion and PreRenderForGlassWindow) and nothing draws them. How that maps onto the port's dummy and object handling needs checking before any window is hidden.

## Game frames versus the 60 Hz step

The PC game runs one game frame per rendered frame at its 30 fps frame limiter, with CTimer's step at 50/30. The port simulates on a fixed 60 Hz step.

**The rule**
- Native code that runs once a frame and is not scaled by the timestep must run once per 30 fps game frame in the port, not once per step. That covers random rolls per call, `+= n` counters, `% n` cadences, `x *= k` easings and `EachFrames` tests.
- Timestep-scaled code takes 50 × seconds, never 60.
- **Two ways to write it:** either a `for(clock += step; clock >= 1/30; clock -= 1/30)` accumulator with a step of 50/30, or a frame flag such as WorldPedestrians' `frameDue`.
- **Easing:** a per-frame easing `k` applied per step becomes `k^(dt·30)`.
- **Counters:** frame-counted waits count game frames from game time (`gameTimeExact`), not render frames.

**Already converted**
- Physics and effects: glass, car and ped fades, CWeather::Update, the water cannon, CFireManager::Update, the break pieces, the birds and the set pieces.
- Peds: the look-ats, gang chatter, stare talk, on-fire screams and the zone roster's 45-frame check.
- Vehicles: the exit easing, boat sinking and braking, door damping and the burning aircraft roll.
- Player: drowning damage and the jetpack flame.
- Counters and timers: the parachute and stat counters, the collision loops, the car generators' start window, the audio zones, the health and wanted blinks, and game time itself.

## The sky: moon, lightning and underwater

**The moon**
- **What draws:** CClouds::Render_MaybeRenderMoon's `coronamoon` sprite, added over the sky at the far clip, at the camera + (0, −100, 15).
- **Size and colour:** half-size MoonSize × 2 + 4 (MoonSize defaults to 3). Blue is 220 − |minutes − 220|; red and green are that blue faded by max(Foggyness, CloudCoverage).
- **Which hours:** the reversed code shows it from 00:00 to 07:20, although the source comment says 20:20 to 03:40. The code is followed until the exe settles it.
- **Left out:** the phase mask, which is drawn with vertex alpha 0 and so changes nothing on screen, and shooting the moon.

**Lightning:** CWeather::LightningFlash whitens the sky top, sky bottom and fog (DoRWStuffStartOfFrame_Horizon) and both ambient lights.

**Underwater:** the below-horizon band blends by the camera's UnderWaterness.

## Cull zones

CCullZones now loads the IPL `cull` rows the way CFileLoader::LoadCullZone reads them. The published IPLs give 1,180 attribute zones (1,109 of them no-rain, 6 military), 36 tunnel zones and 65 mirror zones.

**How zones work**
- CZoneDef keeps its geometry as int16 and tests points with IsPointWithin.
- Update refreshes the camera's flags on game frames where `frame & 7 == 2`, and the player's where it is 6.

**What uses them now**
- **Rain:** it stops in no-rain zones at the camera or the player (CamNoRain, PlayerNoRain). That covers the streaks, the screen grain, the splashes, the moving fog and the rain sound.
- **Tunnels:** ConstructRenderList's switches from FindTunnelAttributesForCoors hide tunnel entities (IPL instance bit 0x800) outside tunnel zones, and the outside world inside them. Transition entities (0x1000) always draw.
- **Military zones:** a live player in one gets five stars (SetWantedLevelNoDrop), unless SET_DISABLE_MILITARY_ZONES is set.

- **Extra air resistance:** in the 29 zones along the main roads and freeways (flag 0x4000), CPhysical::ApplyAirResistance multiplies every automobile's drag by CVehicle::m_fAirResistanceMult. That is 2.5, an exe value that plugin-sdk records. It applies while the *player* is in a zone, so it covers all traffic at once. The port's bikes have no native drag step to scale.
- **Fewer peds:** in the 16 fewer-peds zones, FindPedDensityMultiplierCullZone gives 0.6. Its only reversed caller is the bench count. AddToPopulation, which caps the street population, is not reversed, so the port scales its own ped caps by 0.6 (truncated) as a stand-in.

**Not wired**
- **Fewer cars:** the IPLs use it in 15 zones, but nothing reversed reads CCullZones::FewerCars.
- **No police and police abandon cars:** their readers are in CCarAI and the pursuit task, but no published zone sets either flag.
- **The rest:** the camera flags (close-in, stairs, first person) and the mirrors.

## Newly streamed models fade in

CBaseModelInfo::m_nAlpha is ported per model. A model streamed in with a later terrain window starts at 0. The first window loads like CStreaming's loading scene, at 255.

- **Fade-in:** the model gains 16 per game frame while any instance of it is drawn (IncreaseAlpha).
- **Off screen:** it snaps to 255 when no instance is on screen (SetupEntityVisibility).
- **Combined alpha:** an entity's fade alpha is the model alpha times the distance fade.
- **The LOD:** below 255 the model counts as fading, so its LOD keeps drawing under it (AddLodChildrenRendered waits for 255).

A window swap now fades its new buildings in over about half a second instead of popping them in.

## Player input

- **Controls off:** CPad::DisablePlayerControls (SET_PLAYER_CONTROL off) now also stops the player on foot. Every pad query answers 0: walking, jumping, crouching, firing, weapon cycling and the exit button. In a car the steering is 0 as well as the pedals.
- **Exit wait:** while the driver waits to slow down, is dragged out or holds exit, ProcessControlInputs' automaticallyHandBrake makes the gas 0 and the brake full, not just the handbrake.
- **Stale presses:** a press nobody consumed is dropped on a paused or menu frame, since CPad's "just down" lasts one frame. A key pressed while paused no longer acts on resume.
- **Rear-wheel steering:** the handbrake lerp and decay (HbRearwheelSteer) run once per 30 fps game frame.

**Open questions and gaps**
- **Default keys:** the PC defaults bind jump to Left Shift and sprint to Space, the reverse of the port. The keys are left as they are for now.
- **Script pad reads:** the script now reads CPad. Each frame the held keys become controller actions through the port's bindings. CControllerConfigManager's reversed mappings then fill the pad: the driving one at the wheel with the controls on, else first or third person. CheckAndSetStick zeroes a stick when both directions are down, and CheckAndSetPad toggles the d-pad pair.
  - IS_BUTTON_PRESSED and GET_PAD_STATE read that state, and JustOutOfFrontEnd holds for the first frame after a pause.
  - Not fed: mouse-wheel presses (the port consumes them before the script runs), GET_PC_MOUSE_MOVEMENT's mouse movement, and actions the port has no key for (answer phone, the conversation keys, the alternate fire).
- **Run blend:** PlayerControlZelda's blend is stick length / 60, which gives 2.13 for one key and 3.02 for a diagonal. The port uses a fixed 1.8 for running. Mapping 3.02 needs SetRealMoveAnim, which is not reversed.

## Parked cars stop simulating (fake physics)

CAutomobile::ProcessControl gives an abandoned or wrecked car "fake physics" (m_nFakePhysics, SkipPhysics).

**The rule**
- **When it applies:** its move and turn speeds, averaged into m_vecForce and m_vecTorque, stay within 0.003 and 0.0009 units a frame times the timestep, and its speed stays under 0.005, for more than 10 game frames. Wrecked cars use 0.006, 0.0015 and 0.015.
- **What happens:** physics stops. The speeds are reset and the car stays where it stands.

**In the port**
- **Which cars:** every unoccupied car without an autopilot (parked and vacated cars are STATUS_ABANDONED).
- **How:** the Rapier body sleeps and the raycast suspension is skipped. A touch, impulse or explosion wakes it, and a car being entered or driven wakes it too.
- **Cost:** per-frame physics went from 2.55 to 2.20 ms standing at Grove and from 3.17 to 2.53 ms driving.

## 3D markers and radar cones

- **All marker types:** C3dMarkers::PlaceMarker now handles cylinders, tubes, tori and second arrows, not only arrows and cones.
  - A cylinder sits size/20 below the ground under it. It reads the ground once per map square (UpdateZCoordinate), or floats on flat water above it.
  - A tube with the z check follows the ground.
  - A torus keeps its first height and stands along its normal (CMatrix::WithUp).
  - A full marker array refuses the types it cannot reuse.
  - The renderer clones C3dMarkers::Init's `cylinder` and `hoop` as well as `diamond_3`, stretches tubes 20 times along z, and draws cylinders two-sided.
- **Radar markers:** CRadar::Draw3dMarkers is ported.
  - Blips shown as markers put a cone over their car, ped, object or pickup, in the blip's colour.
  - Contact points put up the red cylinder while the player is off a mission. It is red in the original: the GXT says "Walk into the red marker"; yellow markers are the entry-exit cones.
  - An object's cone rises from its origin, because its box top is unknown before it streams.
- **In free roam:** the stalled INTRO leaves the mission flag set, so no contact-point cylinder shows yet.
- **Checkpoints:** CCheckpoints is ported.
  - Each script checkpoint is placed with AddScriptCheckpoint's colour: red, alpha 32 for tubes and 96 for tori.
  - Update turns, sweeps and bobs the ring types once per 30 fps frame.
  - Render places each one as a C3dMarkers tube (1.5 times its size, snapping to the ground or floating on water) or torus every frame, and a plain tube puts a direction arrow 3 units above itself. The arrow is diamond_3 drawn black, then in its colour at 0.8 of that size.
  - SET_CHECKPOINT_COORDS and _HEADING (handlers unreversed) go to UpdatePos and SetHeading by the handle.
  - The end tube's chequered flag sprite is not drawn.
- **Not ported:** the script spheres. ADD_SPHERE's command handler is not reversed, and gta-reversed's AddScriptSphere hands out an effect-system handle.

## World effects audit (clouds, birds, rainbow, bullet traces)

- **Rainbow:** it draws only where the outside can be seen, as CClouds::Render requires. CalcScreenCoors now scales it by the live FOV.
- **Volumetric clouds:** VolumetricCloudsRender runs once per 30 fps frame. Creation and the wind drift are per frame; the fader is per time step.
  - m_fVolumetricCloudWindMoveFactor is 0.1, as plugin-sdk's CClouds.h records it. The drift was off before.
  - The mesh keeps its last geometry between game frames, which halves the per-render work.
- **Birds:** ClockHoursInRange(5, 22) is strict, so birds appear from 06:00, not 05:00. CalcScreenCoors' near-plane test skips a bird within a unit of the near clip.
- **Bullet fly-bys:** TheCamera.GetMatrix().GetRight() is CrossProduct(up, front), which points to the screen's left (re3 comments it "actually Left"). The port now passes that vector, so PlayFrontEndSoundForTrace picks the same side events as the original.
- **Trace time:** a trace is stamped with the time of the shot, not of the last update.
- **Not ported (unreversed in gta-reversed):** CRubbish, the fluffy clouds and the CWeather::Rainbow formula.
- **Escalators:** the steps are still visual only. CEscalator's moving CObjects with collision are a larger job.

## Gang wars, riots and busted audit

- **Defending group:** CreateDefendingGroup gathers at the car node nearest PointOfAttack (within 400). It refuses while the player is within 40 of that node.
  - Each ped stands at the node plus (sin, cos)(angle) × a random 0 to 3, plus 2 on both axes.
  - The gang cars face away from that node.
  - The pickup lands within 2 units of the node, 0.75 above the ground. It is health one time in two (GetRandomNumberInRange(0, 2) == 1), armour otherwise; the port had health one time in three.
- **Byte arithmetic:** GangStrength and MakePlayerGainInfluenceInZone's enemy total are uint8s and wrap, as does FillZonesWithGangColours' `clamp<uint8>(sum * 3, 55, 120)`.
- **Radar overlay:** it draws the contested zone only where a war can start.
- **Riots:** CGameLogic::LaRiotsActiveHere is ported. The riot cheat (below z 950), or SET_LA_RIOTS inside the two Los Santos rectangles, turns the car lights green and makes the visible lights flash.
- **Busted audio:** no bust line is picked while the player is on a mission.
- **The stalled INTRO:** it no longer counts as a mission for free roam's IsPlayerOnAMission checks, consistent with its zone names and weather.
- **Ped groups:** script groups are processed every frame (CPedGroups::Process): the dead leave, a new leader is appointed, followers beyond the separation range leave, and empty groups are removed.
- **Still open:** G-recruits are not in the script's player group. The crew-size respect is the port's own, because STAT_TOTAL_RESPECT comes from the unreversed CStats::UpdateRespectStat.

## Projectiles and plane trails audit

- **Throw line of sight:** a throw now runs FireProjectile's line-of-sight test against buildings, vehicles and objects. It runs from the origin projected back onto the thrower's plane to the origin, 0.6 further forward when the origin is above his centre.
  - When the test is blocked, a grenade or satchel is put down a unit behind him, but only if the peds-only sphere test there touches someone.
  - Otherwise the throw is spent and nothing flies. CProjectileInfo::RemoveNotAdd is unreversed, so its effect is not reproduced. Before, a grenade thrown into a wall spawned beyond it.
- **Heat-seeker:** with no target picked, it flies as a plain rocket (projType WEAPON_ROCKET).
- **IS_PROJECTILE_IN_AREA:** it counts only grenades, tear gas, molotovs and rockets; satchels are skipped.
- **Plane trails:** CMovingThings::Update runs indoors too, so a trail no longer jumps after an interior.
- **Unverifiable:** every other CProjectileInfo function is unreversed. The port's fuse, speed, drag and bounce numbers are its own. Trains and rope physics are not ported.

## Post effects, coronas and grass audit

- **Night vision:** the switch-on flash never draws. NightVision lowers the count to min(count − step, 0) before its loop, so the loop runs zero times. The port used to brighten the first goggles frame.
- **Infrared:** it ends with SetFilterMainColour: the frame copy in m_InfraredVisionMainCol (255, 200, 0), added. The blend is ONE / DESTALPHA, and the PC back buffer has no alpha, so the destination alpha reads 1.
- **Underwater ripple:** rows are spaced by SCREEN_STRETCH_Y (height / 448, not / 480). The colour uses s_WaterGreen from before the frame's step; only the sway takes the new value.
- **Once per 30 fps game frame:** these used to step every render at 60 fps, twice as fast:
  - the rain grain's ramp toward Rain × 128, and its redrawn raster (which also halves the CPU cost);
  - the coronas' change-brightness-immediately countdown (three game frames);
  - m_FogReduction;
  - CPlantMgr::Update.
- **Grass mask:** CPlantMgr's triangle mask is the int8 nLocTriSkipCounter % 8. For half its cycle it is negative, and then only phase-0 triangles change.
- **Underwater timecycle:** CalcColoursForPoint now blends toward the UNDERWATER weather (20) by CWeather::UnderWaterness. The port's UnderWaterness is 0 or 1, from the camera being under water.
- **Extra colours:** SET_EXTRA_COLOURS and CLEAR_EXTRA_COLOURS work; before, their adapters were missing and a script calling them gave up. StartExtraColour picks hour row colour % 8 of extra weather colour / 8 + 21. m_ExtraColourInter ramps by TimeStep / 120 a game frame. The blend comes after the boxes and before underwater, keeping the sky when the extra row's sky top is black (ShouldIgnoreSky).
- **Goggles:** SetConstantParametersForPostFX's overrides apply. Night vision zeroes the shadows and turns the ambients to (0, 0.4, 0) and the sky to (0, 128, 0). Infrared zeroes the ground lights too, with blue (0, 0, 1) ambients and a (0, 0, 128) sky.
- **Still open:**
  - the tunnel blend (InTunnelness comes from the unreversed CWeather::Update);
  - the Fog, CCTV and DarknessFilter post effects. They are reversed, but only SET_DARKNESS_EFFECT and the CCTV switch (mission script commands) turn the last two on, and nothing reversed sets m_bFog.

## Camera audit

- **Not in the reference:** gta-reversed leaves Process_FollowPed_SA, Process_FollowCar_SA, Process_AimWeapon, CCam::Process and CCamera::Process unreversed. The zoom tables, the look-behind, the swing-behind and the smoothing therefore stay the port's own.
- **First-person look (Process_Rocket):** pitch now turns at 0.8 of the yaw rate at any FOV (4 × 0.0015 against 3 × 0.0025). It was 0.56. The absolute rate is still the port's own.
- **Camera behind / in front:** SET_CAMERA_BEHIND_PLAYER and _IN_FRONT_OF_PLAYER keep the ped's heading from when the command ran (m_fPedOrientForBehindOrInFront), not the next render's.
- **Fades:** see "The intro that cannot finish".
- **Camera shake:** the camera never moves with CamShake, because the code that applies m_fCamShakeForce is unreversed. The positional CamShake callers are therefore not wired either.

## Car generators audit

- **CheckForBlockage:** a parked car does not spawn onto a vehicle or ped. The test is FindObjectsKindaColliding's 2D sphere reach plus a height overlap within a unit. Instead, the generator tries again 4 ms later once the player has been far away. The wait-until-far flag also survives a spawn now.
- **Script generators:**
  - A special plate (CUSTOM_PLATE_FOR_NEXT_CAR) reaches the car.
  - The generate count is never decremented: the original compares the unsigned count with a signed −1, so the decrement never runs.
- **The night limit:** 10 parked cars at night. gta-reversed writes `ClockHoursInRange(21, 7)`, which never wraps, but the original's clock range wraps midnight. The same reading is used for the plane lights.
- **Port budgets kept:**
  - the cap of 14 fleet vehicles and 9 cars (a device budget; the parked limit of 5 or 10 still applies inside it);
  - one spawn every 500 ms, not one generator every 4 frames;
  - bikes, boats and aircraft coming from the port's own spawners.
- **Random-model generators:**
  - a fresh pick longer than 8 units (the bounding box's y extent) is dropped, to be picked again next time;
  - the first car's colours are kept with the model for the later cars, until the player takes one;
  - a fresh pick starts from colours −1, whatever the IPL row says.
- **Not ported:** the tractor, combine and hot-dog behaviours.

## World objects audit

- **Heavy props:** a mass of 99998 or more makes a prop bCollidable, which covers 63 OBJECT.DAT props (pumps, vending machines, ATMs, smashbars). ProcessCollisionSectorList resolves them with ApplyCollisionAlt: the car keeps a wall's response, and the prop takes one ObjectDamage with the greatest intensity over 20, with no bike ×3. They used to go through the lighter props' static branch.
- **Second damage:** when a lighter prop holds or comes loose (ApplyCollision returns true), the prop is damaged again with the entity's intensity over 20. A change-then-smash prop now changes and smashes in the same hit.
- **Lamp posts:** a vehicle's collision normal against a lamp post has its up component zeroed, without renormalising.
- **Explode FX:** CObject::Explode ends by playing a play-on-destroyed object's FX (the petrol pumps' and barrels' explosion_medium) at its rotated offset. ObjectDamage leaves that FX to it.
- **Exploded props:** they vanish on a 1-in-32 roll once per 30 fps game frame, no longer every 60 Hz step.
- **Settling:** a loose prop settles static again. CObject::ProcessControl averages its move and turn speed each game frame; after more than 10 frames under TimeStep × 0.003 it becomes a fixed body at rest. Its uproot limit then holds against the next hit.
- **Not ported:**
  - the wind-sway centre of mass;
  - buoyancy from OBJECT.DAT's percent submerged;
  - ApplyFriction and ApplySpringDampening (props use Rapier's).

## Ped attractors audit

- **The queue's facing:** CPedAttractor::ComputeAttractHeading's bQueue branch overwrites m_UseDir with the queue direction. Once a queued slot's heading has been computed, later heads face down the queue; the port now keeps that.
- **Not ported, unreversed:**
  - PARK attractors: the sunbather's CTaskComplexSunbathe.
  - Scripted and trigger-script attractors: the script-brain attractors.
  - The go-to-attractor time limits.
  - The shelter displacement.
- **Unverifiable:** GeneratePedsAtAttractors' `break` only leaves the inner loop, which would allow up to 12 peds per call. The exe likely leaves both loops, so the port creates one. BroadcastDeparture's reversal erases from the wrong vector, so its old-index positions are not copied.

## Buoyancy audit

- **Boats:**
  - bOnWater compares the native buoyancy force with 0.0008 × mass a step, unscaled. The force is native; only its application is scaled to browser gravity. Before, the threshold was halved.
  - A boat keeps bTouchingWater, as CBoat's constructor sets it and nothing clears it.
  - With no water polygon under the boat at all, ProcessBoatControl stops before the drive.
  - The point speed for the wave power is measured from the centre of mass (CPhysical::GetSpeed).
  - The wake follows ProcessBoatControl's gate: upright (up.z > −0.6), on the water, and moving over 0.05, which the gas pedal past 0.05 also counts as. Its intensity is the 3D speed × 100 cast to a uint8, and a boat not the player's keeps 15 points.
- **Cars:**
  - Only a plane (IsSubPlane) diving in faster than a unit a frame blows up. Before, any car did.
  - A buoyancy ratio between 0.6 and 1 drowns a car only while a wheel is off the ground (IsAnyWheelNotMakingContactWithGround).
- **Boats against the world:** ProcessBoatControl passes GetHasHitWall as ProcessBuoyancyBoat's last argument, which that function names bUnderwater. A hull touching fixed geometry applies no per-point turn forces; the drive instead turns 0.4 of the whole buoyancy force at the turn point (0x6DBF0A). Before, the port always applied the point forces and never the 0.4 turn.
- **The Vortex on water:** the player's Vortex that is upright (up over 0.3) and not already drowning returns from ProcessBuoyancy before the drowning code, so its speed is not clamped and its buoyancy not bled. The water damping skips it unless it is drowning. Before, the port let the drowning code run and cleared the flag afterwards.
- **Heavy cars:** SET_CAR_HEAVY now sets physicalFlags.bMakeMassTwiceAsBig, the only thing that could set it; its handler is unreversed. It had no adapter, so a thread reaching it gave up. The flag:
  - multiplies the water's drag by 1.5 for cars and aircraft;
  - scales the suspension spring's damping limit by 0.75 and doubles its damping; the ported suspension already honoured this, but nothing set it.
  - The doubled mass in collision responses (ApplySoftCollision and friends) is not ported: contacts are Rapier's.
- **Still open:**
  - batched turn forces and stale speed reads in the drive;
- **Not ported:** ped and object buoyancy forces.
- **Unverifiable:** GetWaterLevelNoWaves, AddWaveToResult and the boat volume tables are unreversed or exe data.

## Tags, shiny texts and the camera snapshot audit

- **Snapshot:** after a photo, CSpecialFX's snapshot runs for 20 frames. The game stands still (SetTimeScale(0)). Frames 1 to 9 add a white quad of 255 − 255 × frame / 10 over the screen (ONE / ONE). ResetTimeScale then puts the time scale back to 1, which also ends a cheat's slow or fast motion, as it does natively. The camera's alpha and beta speeds are not zeroed, because the follow camera is unreversed.
- **Shiny texts:** they blend ONE / ONE, so the handman texture's alpha no longer dims them, and at most 32 are drawn a frame (MAX_SHINYTEXTS).
- **Tags:** SET_TAG_STATUS_IN_AREA (SetAlphaInArea) skips tags whose entity is not streamed in.
- **Spray shots:** a spray-can shot that reaches a tag loses its motion along the tag's forward axis and doubles, as CShotInfo::Update does with SprayPaintWorld's outDir. Tags now carry their placement's forward axis.
- **Road signs:** a sign shows only while its placement does, since CEntity::Render draws it. A placement the visibility pass hides (out of range, off screen, occluded) hides its signs.
- **Still open:**
  - photos are not kept at all: the port has no gallery, so CWeapon::TakePhotograph's save (behind the menu's save-photos option) has nothing to write to.

## Player weapons audit

- **Held weapons:** the inventory tracks the weapons the player holds (CPed::m_aWeapons). Explore starts with the whole arsenal, a port choice. Busted or Wasted leaves only fists, and the saved game keeps what is held.
- **Cycling:** the weapon wheel walks the held weapons in slot order. Before, it walked every weapon in the game, so a busted player could still pick a katana. The switch rules themselves (ProcessWeaponSwitch) are unreversed.
- **CPed::GiveWeapon:** a weapon not held takes its slot. Whatever else sat there is dropped, and its total ammo carries over for the shotgun, SMG and rifle slots. Topping up a held weapon reloads its clip at once (CWeapon::Reload).
- **Millisecond counters:** the climb's give-up timer and the jump's forward push count GetTimeStepInMS truncated once a 30 fps frame (33, or 990 a second). They used to count per 60 Hz step (16, or 960).
- **Cops and gunshots:** CEventGunShot excludes cops only while they pursue. The published Cop.ped has no EVENT_SHOT_FIRED row, though, so a cop that heard would do nothing. The port's exclusion stays, since the fallback would make it flee.
- **Still open:**
  - the sniper's whizzed-by duck;
  - a jump keeping the speed of what the ped stood on (the port does not carry the player on moving ground).

## Animation blending audit

- **AddAnimation:** a new synchronised clip starts at the phase of the newest synchronised clip on the ped (AddAnimationToClump). WALK re-added under a running RUN or SPRINT now stays in step with it, for the walk/run clips and the gun-move clips alike.
- **BlendAnimation:** a new clip fades in from 0 only when another clip was faded out; otherwise it starts at full blend.
- **The gun's stand branch:** TaskSimpleUseGun walks {Bwd, L, R, Bwd}, so GUNMOVE_FWD is never stopped and animates on as it fades. The port keeps that.
- **Not ported:** the native pose blend's translation pull toward the bind pose when the blends sum below 1. SetRealMoveAnim and ControlButtonSprint are unreversed.

## Vehicle audio audit

- **Police helicopters:** one flying on autopilot is STATUS_PHYSICS, so ProcessAIHeli plays its cop-heli sound. Before, it fell into the dummy helicopter path, which is silent unless the player's engine bank is loaded.
- **Flat tyres:** the flat-tyre sound plays for any burst tyre touching the ground. The reference compares the damage status with WHEEL_STATE_SPINNING's value, not the wheel's physics state.
- **Drowning cars:** they drown audibly: the −6 dB, 0.7× engine and the damaged-engine sound.
- **Extra air resistance:** in these cull zones the player's engine drops to cruise and does not change up, as CCullZones::DoExtraAirResistanceForPlayer makes AEVehicleAudioEntity do.
- **Horn pattern 0:** now matches HornPattern exactly.
- **Collision reports:** each collider pair reports at most once per 30 fps game frame, as the native's single report a frame does. A contact spanning the browser's two physics steps is a one-shot, not a scrape loop.
- **Special vehicles:** the Caddy, the trailers, the Vortex and the RC toys are AE_SPECIAL, which the port gave no entity. ProcessSpecialVehicle now runs for them:
  - trailers play their road noise and rain;
  - the Caddy plays road noise, skids, flat tyre, horn, rain and engine damage, and its golf-cart loop (ProcessDummyGolfCart) whoever drives it;
  - the Vortex plays rain and horn only, because ProcessDummyHovercraft is unreversed;
  - the RC toys play nothing, because the port has no RC driving.
- **Horn early returns:** a horn that is pressed but cannot start returns from PlayHornOrSiren before the sirens are processed that frame, as the reference does. This covers banks not loaded, the old horn still sounding, or a horn type that is neither car nor bike.
- **Nitro:** a burning nitro now sounds, following ProcessNitro:
  - the AE_NITRO_IGNITION shot plays once as the burn starts;
  - two loops play, the weapons bank's gas loop and vehicle_gen sound 26;
  - both loops are pitched and raised by the pad's accelerate, which is zero for an AI car;
  - the eased nitro ratio is kept but unused, as in the reference.

## Ped types, stats and crosshairs audit

- **Relationships:** each ped's acquaintance table is a copy of its ped type's ped.dat lists, as CPed's constructor copies it; the copy is made on first use. SET_, CLEAR_ and CLEAR_ALL_CHAR_RELATIONSHIPS edit that copy. Before, clearing a relationship a ped had only from ped.dat did nothing.
- **Unknown stat names:** a stat name pedstats.dat does not list falls back to STAT_SENSIBLE_GUY (CPedStats::GetPedStatType), not the port's authored numbers.
- **Not done:**
  - A script-created ped's decision maker should be −1 (SetPedDefaultDecisionMaker). The port's "no decision" fallbacks would make such a ped flee, so every fallback needs gating first.
  - SET_RELATIONSHIP between ped types is recorded but not applied; its handler is unreversed.
  - The lock-on and heat-seeker target markers are not drawn. MarkTarget's data is reversed, but CWeaponEffects::Render is not.

## Weapon audio and surface flags audit

- **CAEWeaponAudioEntity:** the port matches the reference, checked field by field:
  - WeaponFire's sound table, WeaponReload, PlayGunSounds (with its categories: AE_FRONTEND_PICKUP_WEAPON and PICKUP_MONEY for the minigun, SELECT for tails);
  - the flamethrower, minigun, chainsaw, goggle and camera sounds;
  - UpdateParameters.
  - The camera sound's SOUND_IS_PAUSABLE is the port's 0x10 bit.
  - PlayMiniGunStopSound's plane branch (speed 1.8, roll-off 0.7937 × 2/3) never runs, because no plane reaches the minigun path here.
- **Shoot-through surfaces:** every CWeapon line test passes doShootThroughCheck:
  - it covers FireInstantHit, CBulletInfo::Update, the camera's target line, drive-bys and aircraft guns;
  - the test skips faces whose SURFINFO row is shoot-through: METAL_CHAIN_FENCE, SCAFFOLD_POLE and TRANSPARENT_CLOTH.
  - The port's bullet ray now steps past such faces. Before, a chain-link fence stopped every shot.
- **Not ported:**
  - **Car dirt:** CVehicle::m_fDirtLevel (0 to 14 at creation; MakeDirty and MakeClean by SURFINFO's car-dirt columns). SetDirtTextures swaps the 16 levels CCarFXRenderer::InitialiseDirtTexture builds from vehiclegrunge256, and that builder is unreversed.
  - **Controller rumble:** the road-roughness and suspension pad shake (CPad::StartShake); the port drives no rumble.
  - **Other SURFINFO flags:** the see-through test in the camera and ped line of sight, the wheel particle columns, and soft landing, which nothing reversed reads.

## Weather audio and ped speech audit

- **City noise (CAEWeatherAudioEntity):**
  - The side probe answers only the first frame a new entity turns up in it. lastEntity changes only then. Before, the port rebuilt the hit each frame, so every frame counted as new, and a miss cleared the memory.
  - UpdateSound's ramp adds the target volume on each step, so a whoosh jumps straight to its level. The level goes through AudioLog10's −100 floor, not −Infinity.
  - A new entity passing too slowly makes no update that frame.
- **Kept as the port had them:**
  - The reversed probe subtracts the hit entity's position, not its velocity, from the car's. The port's probe sees only fixed geometry, where that term is zero.
  - The reversed lambda measures both sides from pov + camRight.
  - Both city-noise loops start; see the comment in NativeWeatherAudio.
  - The wind-gust offset and the wind pitch floor stay the port's reconstructions of the bool/float offset statics.
- **Ped speech:** the port's stub (combat-bank samples in place of the speech banks, which are not published) now:
  - plays at AE_SPEECH_PED's volume (event 52; the stub read event 110);
  - rolls off at 2, or 3 while the player's radio vehicle sets s_pVehicleAudioSettingsForRadio, with REQUEST_UPDATES and the uncancellable bit;
  - takes native coordinates. The callers passed renderer ones, which swapped height and north.
  - is spaced by gSpeechContextLookup's repeat times plus 1 to 1000 ms: pain per ped (m_NextTimeCanSayPain), 2000 ms; fleeing and abuse 7000 ms; joining a gang 1500 ms, once for everyone.
- **Not ported:** the voice, bank and phrase choice (the speech banks are not published), speech slots, conversations, facial talk and police scanner speech.

## Ped audio and groups audit

- **Landings:** the player's landing (TaskComplexInAirAndLand's AE_PED_LAND_ON_FEET_AFTER_FALL or COLLAPSE_AFTER_FALL) is its own sound event at touchdown. With the native character the touchdown step had no foot contact yet, so the thud and the fall collapse never sounded. The land clip's contacts still play the two steps, and a landing no longer adds one.
- **Swimming:** CTaskSimpleSwim::ProcessEffects now runs once a game frame. Its particles and sounds existed, but nothing called them:
  - sprinting leaves a wake 0.4 ahead of the swimmer at the water height, with the wake loop;
  - the crawl's hands and feet splash (water_swim and the stroke sound) when one is within 0.05 of the swimmer's origin height;
  - a dive throws one big splash with the dive sound.
- **The wake loop:** it is tied to the ped and requests updates. It rises 0.6 dB an update while it was triggered in the last 100 ms, and otherwise sinks 0.6 dB an update and stops at default − 20. The reversed rise lacks its plain step; its fall mirrors it, so the rise is kept.
- **Swim splashes:** they play physically and unduckable. The reversed m_nSfxId + 1 runs past the bank, so the sample stays the port's pick.
- **Armed group members shoot at the threat:** TaskAllocatorKillThreatsBasic gives each member CTaskComplexKillPedOnFoot on the leader's attacker.
  - Before, an armed homie defending CJ aimed and fired at CJ; the shots did no harm, and he never fought the attacker.
  - A retaliating armed street or gang ped did the same.
  - Now the gun follows the ped's live foe, and a follower never aims at the player.
- **Gunshots within a group:** CEventGunShot::AffectsPed ignores a shot fired by a member of the ped's own group, not only the player's. A gang party no longer scatters at its own mate's shots.
- **SET_PLAYER_GROUP_RECRUITMENT:** turning it off (m_bGroupStuffDisabled) now stops the G recruit.
- **Not ported:**
  - **Formation:** the formation slots and the follow speeds (CTaskComplexFollowLeaderInFormation's ms_offsets are unreversed).
  - **Moving CJ's group:** SET_CHAR_COORDINATES taking his group along (CPedGroup::Teleport places the followers at those offsets), and whole-gang fights through KillPedGroupOnFoot, whose choice comes from group decision-maker data.
  - **Burning car:** the members' flee from a burning car as the leader gets out.
  - **Sounds:** the jetpack sounds, NPC landing sounds and the bone crunch of a fatal fall.

## Bicycles and quad audit

- **Bicycles don't explode:** CBmx overrides BlowUpCar with a NOP, so the BMX, Chopper and Mountain Bike survive damage, fire and the blow-up-cars cheat. The port blew them up with their rider. Only motorbikes and the quad burn and explode now.
- **Lean matrix:** CBike::CalculateLeanMatrix is GetMatrix() × RotateY(lean) × RotateX(−0.05·|lean|), so a leaning bike dips its nose a twentieth of its lean. The port rolled it only.
- **Bunny hop:**
  - **Launch delay:** on release the hop clip jumps to (0.2 − t)/0.2 × (T − 0.2) + 0.2 and plays at 1.5, so the launch comes (T − 0.2) × charge/25 / 1.5 after release: a tap hops at once, a full charge about 0.09 s later with the published 1/3 s clips. The port waited a flat 0.3 s.
  - **Disabled controls:** a press is refused and the charge dropped.
- **Disabled controls:** a bike's gas is cut and its brakes held, as CAutomobile::ProcessControlInputs does for the quad.
- **Not ported:**
  - **Pedalling:** sprint-tap pedalling (CPlayerPed::ControlButtonSprint is unreversed) and the pedal sway lean.
  - **Quad control:** the quad's forward lean and airborne roll control (CQuadBike::ProcessControlInputs and ProcessAI's lean forces, reversed but tied to the unported quad chassis), and its handlebar and axle animation.
  - **Rider lean:** the quad rider's lean from the eased steer angle.

## Foot cops, player ped and go-to audit

- **Pursuit and fast cars:** CTaskComplexPolicePursuit::SetPursuit skips a player in a vehicle when distSq × speedSq ≥ 16 (native units and units a frame, the reversed `*`): at 20 units, a car above 10 u/s. The task then finishes, and CTaskComplexWanderCop tries again after 3000 ms. Before, every nearby cop pursued and pistol cops fired at a passing car.
- **Drawing weapons:** CCopPed::SetWeapon runs only in the pursuit task's ControlSubTask, so only pursuing cops draw. Before, every cop did once CJ was wanted.
- **The scope-fail click:** CPlayerPed::ProcessControl on WeaponJustDown. The sniper rifle, or a rocket launcher, pressed outside its camera weapon mode or out of ammo in it, and not swimming, plays AE_FRONTEND_FIRE_FAIL_SNIPERRIFFLE (frontend sound 10) or _ROCKET (11).
- **The minigun barrel:** CPlayerPed::ProcessControl spins it 0.025 a time step, up to 0.45, while the use-gun task runs (aiming or firing), and winds it down 0.003 a step without the task. CPed::PreRenderAfterTest turns the held gun's minigun2 frame about its X axis by TimeStep × spin. Spinning without a shot reports AE_WEAPON_FIRE_MINIGUN_NO_AMMO each frame, the dry spin loop.
- **The save disk:** CPickup::Update takes it only when CPlayerPed::CanPlayerStartMission allows. The port reads that as: the game playing, the player alive and not arrested, grounded, no knockdown, and not climbing, swimming, on the jetpack, entering a car, aiming or mid-attack. The disk is tried each frame, so the save opens once he is free.
- **Walking to an attractor slot:** it still finishes only within the slot's arrive range. CTaskSimpleGoToPoint also finishes on overshooting or circling its point (HasCircledTarget), but CTaskComplexGoToAttractor's subtasks are unreversed. Applying those rules left heads standing short of the stop, so they are not used here. The circling they would cure came from the spawn race below.
- **Not ported:**
  - **Bikes and boats:** cops dragging CJ off a bike (CTaskComplexDragPedFromCar is unreversed), and drawing a gun on a boat.
  - **Cops and other criminals:** cops answering other criminals' gunfire and damage (CTaskComplexKillCriminal's subtasks are unreversed), and partners sharing criminals.
  - **Upright cars:** the door-opening arrest of CJ in an upright car. Cops still shoot into it.
  - **Arrest lines:** the arrest speech (the speech banks are not published).
  - **Special cops:** SWAT, FBI and army at one star, where SetCurrentWeapon(PISTOL) finds no pistol; the port keeps its nightstick stand-in.
  - **Player ped:** the radar arrow dimmed while IsHidden, and the sniper scope dropped on catching fire.
- **Attractor spawn race:** GeneratePedsAtAttractors picked the queue and slot before awaiting the model load, then wrote that queue back. A queue that emptied during the load, or one a passer-by began, was replaced and its users orphaned: a ped stood at the stop outside the queue, and two could share a slot. The queue and slot are now read after the load, as the native reads them in one go. The attractor-queue spec also drives the generator itself once the street cap fills, since its loop never ticks walkers away.

## Aircraft and ped damage audit

- **Helicopter rotor speed:** CHeli::m_fHeliRotorSpeed now runs on its own, up to 0.22 while the engine runs.
  - It spins up at 0.1 a second while the engine runs and winds down at 0.04 a second after. These rates are authored: CHeli::ProcessControl is unreversed.
  - A heli the game flies is made already flying, rotor at speed.
  - The rotor-wash dust (0.1125), the water branch (0.15), the rotor audio and the drawn blades read it. Before, the rotor speed was throttle × 0.22: a hovering heli sat near 0.10, so it raised no dust, played half its rotor sound, floated in water, and stopped dead when left.
  - Lift keeps the port's collective, gated by the rotor.
- **Kill credit (CEventHandler::RegisterKill):**
  - A run-over is registered to the car, never the player ped: his own car only counts STAT_PEOPLE_YOUVE_WASTED, and no respect, gang-war provocation or mission kill.
  - A fire death goes to whoever started the fire, and a blast to whoever caused it.
  - Every kill the player makes counts STAT_PEOPLE_YOUVE_WASTED, as CDarkel::RegisterKillByPlayer does; the port never counted it.
- **Hits on a floored ped:** ComputeDamageAnim's KO_SKID + direction now reaches the ped. The event handler's new CTaskComplexFallAndGetUp replaces his old one, so his time down starts again. Before, the hit was dropped (hit() returned for a ped already down); a landing's own fall damage still leaves its knockdown alone.
- **Dying while down:** the floor-hit death picks FLOOR_HIT_F for a ped lying on his front (the fall clip's ANIMATION_IS_FRONT). A ped past half his get-up clip counts as standing and takes an ordinary death clip.
- **Run-over gates:** CTaskSimpleKillPedWithCar goes through AffectsPed, so a ped only the player may hurt, or a collision-proof one, survives the car kill.
- **Not verifiable, left as authored:** the flight model (FlyingControl, CHeli and CPlane control are unreversed), headshot kills, the body-part multipliers and armour (ComputeDamageResponse and its helpers are unreversed).
- **Not ported:**
  - **Aircraft:** blade collisions (DoBladeCollision is reversed, its callers are not), weather wind on aircraft, the Hydra's nozzle swing, and per-model flying handling.
  - **Death during a fall:** a still-playing fall clip kept as the death clip (the port's view cannot extend a clip mid-play).

## Jetpack and radio audit

- **Take-off lean:** standing with the stick pushed, ProcessControlInput's pad branch sets m_ThrustAngle = THRUST_MAX_ANGLE × padMoveMag × −0.3515625 (−0.98 for W alone). A take-off now starts tipped forward and barely climbs; before, it began level and rose about 2 m.
- **Jet-ball pitch:** RenderJetPack reads m_fAimingRotation (the camera's heading in flight, the walk's on the ground) against the heading of the last frame, once a 30 fps frame. Before, the flight heading went stale on the ground, pinning the balls at ±90° after a turn, and the swivel shrank at higher render rates.
- **Height cap:** TheCamera.CalculateGroundHeight(ENTITY_BB_TOP) is a line down from z = 1000 at the camera's x, y, cached until the camera moves 20 units, a miss keeping the last height. The port takes the hit point where the native takes the hit model's bounding-box top. Before, it looked under the player, and a miss let him climb forever.
- **Weapons:** CTaskSimpleJetPack::ProcessPed calls RemoveWeaponWhenEnteringVehicle(true):
  - weapon changes are locked while the pack is on;
  - the Uzi or Tec-9 with ammo is taken up, else the handgun slot if the pistol or sawn-off has ammo, else the weapon's model is removed;
  - only an instant-hit weapon aimed with the arm fires;
  - the saved weapon comes back as the pack comes off.
- **Radio:**
  - A driver who dies or is arrested at the wheel turns it off at once (Service's PlayerAboutToExitVehicleAsDriver). Before, it played on for 4 s.
  - The radio follows the vehicle rather than its model, so stepping between two cars of one model restarts it, and it starts once the native engine has loaded.
  - Speech rolls off at 3 in any vehicle the player drives: TurnOnRadioForVehicle sets s_pVehicleAudioSettingsForRadio for every vehicle.
- **Not ported:**
  - **Jetpack:** the jetpack's air resistance (CPed::ProcessControl is unreversed), walking with the pack on (CPed::UpdatePosition is unreversed), and the lock-on push.
  - **Radio:** the retune events and static (the frontend handler and CheckForStationRetune are unreversed), SET_RADIO_TO_PLAYERS_FAVOURITE_STATION and SET/GET_RADIO_CHANNEL, and the per-vehicle bass.

## Hydraulics and kill stats audit

- **Hydraulics (CAutomobile::HydraulicControl):**
  - **Timing:** it runs once a 30 fps frame, so m_wMiscComponentAngle counts at the native rate: the squat at a stop takes 2 s, not 1. A horn press is still taken on the step it comes.
  - **The horn:** only the extended toggle ends the control there (suspensionTriggered). Back to normal, it falls through into the stick block, as the reference does.
  - **The jump:** GetHydraulicJump (ShockButtonR, TOGGLE_SUBMISSIONS in a car: the '2' key or numpad plus) lifts every corner at once in place of the stick.
  - **Sounds:** the line movement's maxDelta against the extended-to-normal lower limit sounds the pump or the clunk with the reference thresholds. AE_SUSPENSION_HYDRAULIC (vehicle_gen 0x26, −6 dB, not restarted while playing), _TRIGGER and _ON (0x2C) and _OFF (0x26) now reach the car's audio entity; before, every hydraulic sound was dropped.
  - **Suspension:** under 0.15 units a frame forward, a car with hydraulics damps at no more than 0.1, and one with hydraulic geometry too springs half as hard again: the lowrider bounce.
  - **Not ported:** the sideways-stick roll damping, the STATUS_PHYSICS mission branch and the four hydraulics script commands (their handlers are unreversed), fitting hydraulics at a mod shop, and setPrevRatio.
- **Kill and wreck stats (CDarkel):**
  - A player kill also counts STAT_KILLS_SINCE_LAST_CHECKPOINT, which a save moves into STAT_TOTAL_LEGITIMATE_KILLS.
  - Everyone else's kills now run RegisterKillNotByPlayer: STAT_PEOPLE_WASTED_BY_OTHERS, a recruit of the player's group costing 2 respect and counting STAT_RECRUITED_GANG_MEMBERS_KILLED, and a gangster's friendly or enemy count.
  - RegisterCarBlownUpByPlayer's STAT_ROAD_VEHICLES_DESTROYED and STAT_BOATS_DESTROYED count every car, motorbike and boat blow-up, whoever caused it. The plane's BlowUpCar is unreversed.
  - **Not ported:** the headshot stat (the port has no headshot flag); the per-model kill table, whose script commands still give up (ZERO5 resets it); PedsKilledOfThisType; and the kill frenzy itself, which no SA script starts.

## Melee audit

- **The R key:** a melee weapon no longer swings on R. The untargeted attack is MeleeAttackJustDown(false), the fire button alone, and SA has no reload control.
- **Unverifiable:** every CTaskSimpleFight routine (ControlFight, FightStrike, FightHitPed, GetStrikeDamage, the combo choice) is a plugin call. The combo windows, the hit reach and angle, the per-move damage scaling and the stat effects stay the port's reading of melee.dat, whose numbers match the published file.
- **Not ported:**
  - **Targeted moves:** the targeted block (target + jump, fight command 2) and the alternate attack (target + enter, command 12). The inputs are dropped, because what the stubbed task does with them is unknown.
  - **Gym styles:** GIVE_MELEE_ATTACK_TO_CHAR, whose adapter is missing, and the boxing, kung-fu and knee-head combos; CJ keeps UNARMED_1.
  - **Facing check:** CTaskSimpleFightingControl::CalcMoveCommand's unwrapped attack-angle difference. The port's heading has another origin, so the seam would land elsewhere.

## Cover points

- CCover is reversed, and the port reads the cover 2d effects. Its one reversed user is CTaskComplexKillPedOnFootArmed::CreateFirstSubTask: 50% of the time, with the target 30 away (or 6 away and not melee), the ped reserves a cover point and runs to it ducked.
- Without FIX_BUGS, that routine never calls FindCoordinatesCoverPoint. The coordinates it runs to are left uninitialised in the original, so the retail cover-seeking is effectively broken, and the port leaves it out.


## Ped event scanner audit

- **Unverifiable:** CEventScanner::ScanForEvents, the vehicle-collision scanner, CEntityScanner::ScanForEntitiesInRange and the attractor scanner are plugin calls. Their scan intervals, ranges and the acquaintance scan are unknown, so the authored 12-unit gang hostility stands.
- **Cops dodge cars:** CEventPotentialGetRunOver::AffectsPed asks only for a live, unattached ped out of a vehicle, and a vehicle that is not a boat. A beat cop now steps, dives, raises his hands or faces the car as a civilian does. ComputeVehiclePotentialCollisionResponse's `!IsCop()` keeps him out of the horn flee.
- **Run-over event priority:** CEventPotentialGetRunOver is priority 51. It displaces a gun aimed at the ped (50), so a ped with its hands up still dives, and the car response clears the gun reaction. It does not displace CEventDamage (65), so a ped fleeing a punch or a shot no longer rolls car reactions. HandleEvents drops a repeat of the current event type, so a ped fleeing a horn rolls no new horn reaction. That makes the response's own "already responding" test unreachable, and it is passed as false.
- **Horn reactions:** a flee, fist-shake or face-the-car reaction to the player's horn needs IsCreatedBy(PED_GAME), so script peds no longer take them.
- **Crowd stand-still:** TaskComplexAvoidOtherPedWhileWandering stands the ped still for 0.5-2.5 s once m_AnotherStaticCounter passes 30. That is a second at 30 fps, measured as staying within a quarter unit, and it is checked before the height, distance and timer quits. It had been 0.6 s of moving under a fifth of the intended speed. Standing is not a go-to task, so the counter restarts. ProcessStaticCounter also asks for a touch within four frames; that is not modelled.
- **Not changed:** CEventDeadPed has no time limit, but the scanner that raises it is unreversed. The port still raises it once, at the stealth kill.
- **Not changed:** a cop chasing a criminal still runs the alarm and stolen-cop-car scans that ScanForStuff runs only inside the wander. Other wandering cops scan anyway, so the difference is hardly visible.

## Seated poses

- CCarEnterExit::AddInCarAnim seats the driver of a low vehicle (handling's m_bIsLow, model flag 0x4: the lowriders, hot rods and some sports cars) in CAR_LSIT and a passenger in CAR_SITPLO. It uses CAR_SIT and CAR_SITP otherwise. NPC drivers, riding recruits, gang drive-by crews, police crews and script riders now follow it. A rider a script attached at an offset keeps CAR_SIT.
- **Steering and look-back:** CVehicle::ProcessDrivingAnims is reversed. The player's Drive_L/R and CAR_LB are partial, auto-removed clips (AnimAssocDescriptions). BlendAnimation starts each from its first frame at blend 0, delta 4, and fades every other running partial at its amount × −4 (at least 0.05 a second). A running steering clip then takes |steer / 0.61| directly, and straight ahead fades them all at −4. The port now steps these rules for each clip (src/simulation/nativeDrivingAnims.ts). Changing between forward and reverse cross-fades instead of popping, and the clips play their 0.13–0.23 s once before holding, instead of showing only their last frame. Nothing runs until the idle has fully blended in.
- **Still missing:** the drive-by pose (CTaskSimpleGangDriveBy::ProcessPed is unreversed), which would fade the steering; the CAR_tune_radio reach, whose caller is unreversed; the first-person look-behind cut; and the NPC drivers' head and arm bopping and TriggerIK look-at, which run from the unreversed CTaskSimpleCarDrive::ProcessPed.

## Player motion group

- **Choice:** CClothes::GetPlayerMotionGroupToLoad (reversed) picks the fat group past 500 fat that outweighs the muscle, else the muscular group past 500 muscle, else the player group. RequestMotionGroupAnims loads the matching IFP block when the player is rebuilt. CClothes::RebuildPlayerIfNeeded rebuilds when the stats differ from the last build, on a restart (CGameLogic) and at the end of an entry-exit transfer, and ConstructPedModel runs at load.
- **Port:** the player now walks, runs, sprints, idles and starts walking with fat.ifp's fat* or muscular.ifp's muscle* clips (aFatAnimations, aMuscularAnimations) from the next rebuild. Each running move keeps its blend and restarts the new clip, as ReApplyMoveAnims does.
- **Unverifiable:** the switch itself runs in CPlayerPed::ProcessAnimGroups (0x6098F0), which is unreversed. So does the weapon-held movement (playerrocket, player2armed, playerBBBat, playercsaw and their f/m variants), which the port does not have.
- **Not ported:** the body shape. CClothesBuilder's fat and muscle blend of the skin is not ported, so a fat CJ keeps the slim mesh. LoadCutsceneData's rebuild is wired; BuildCutscenePlayer's needs cutscenes that play.

## Stat update messages

- DisplayScriptStatUpdateMessage has a second group that the port had left out: flying skill, lung capacity, bike skill, cycling skill and luck, each shown on a change above 1. The motorbike's +25 bike skill now shows its box.
- Girlfriend progress (Denise to Millie) shows whatever the change, on a bar out of 100. The pimping level uses a bar out of 10, and gang strength one out of the group's size: FindMaxNumberOfGroupMembers, at most the script's limit.
- **Skill stats:** STAT_DRIVING_SKILL (160, an int stat) and the weapon skills (69–78; GetSkillStatIndex maps the pistol 22 to the M4 31, and the Tec-9 shares the machine pistol's) are now the port's persisted driving skill and weapon practice, bound into the stat table. The ride sets and aiming read what the driving school, Ammu-Nation and SET_*_STAT write, and scripts read the skills the game built up. The rifle skill (79) has no weapon in GetSkillStatIndex and stays in the table.
- **Cutscene load:** CCutsceneMgr::LoadCutsceneData calls ResetSprintEnergy, and the stamina is now refilled there.
- **Still authored:** UpdateStatsWhenDriving, UpdateStatsWhenWeaponHit, UpdateStatsWhenCycling, Swimming and Flying, and UpdateFatAndMuscleStats are retail stubs. The port's driving gain (+1 per 25 m) and weapon gain (AR_STATS' increment per hit) stay authored. Cycling skill, flying skill and lung capacity never rise. The tired band below zero energy (HandleSprintEnergy sprints on to −150) is not modelled, and neither is IncrementStat's energy-to-fat reaction.

## CWanted audit

- **Matches:** the chaos thresholds and the cops, cars and roadblock chance per level; the maximum wanted level; SetWantedLevel; the ReportCrimeNow chaos table and multipliers; CCrime::ReportCrime's ranges and witness rules; the 16-slot queue (500 ms, 10 s); the once-a-second decay; and the helicopter count. CWanted keeps its time in milliseconds, so nothing here needed rescaling from frames.
- **Stats:** UpdateWantedLevel adds the new level minus the old to STAT_TOTAL_NUMBER_OF_WANTED_STARS_ATTAINED (131). IncrementStat ignores a drop's negative amount. Losing the last star counts STAT_..._EVADED (132). Update times a chase at five stars or more in whole seconds, then writes it with SetNewRecordStat and SetStatValue over it, so the stat holds the last chase's time. All three now count.
- **Update while dead:** CPlayerPed::ProcessControl calls CWanted::Update before its dead or dying return. The queue and decay now carry on through the wasted sequence.
- **Cutscenes:** both cutscene loads call ClearQdCrimes, and a crime still waiting to be reported is now dropped.
- **Cops diving:** CTaskSimpleEvasiveDive::StartAnim registers CRIME_VEHICLE_DAMAGE and CRIME_SPEEDING at once (RegisterCrime_Immediately) when a cop dives from a car the player drives.
- **Efficiency:** the police presence within 18 units is now asked only on the once-a-second decay step, not on every step.
- **Not ported:**
  - **Parole:** ClearWantedLevelAndGoOnParole and its 20-second restore. Its only callers are the clothes and haircut purchases, which have no counterpart here.
  - **Kill frenzy:** the ×0.3 during a frenzy; there are no rampages.
  - **Cop-car hijack:** ComputeCopCarBeingStolenResponse's one star when the player takes a police car with its crew aboard.
- **Unverifiable:** CHeli::UpdateHelis and CreateRoadBlockBetween2Points. AddCrimeToQ's reversed return value looks inverted, so the port keeps the III/VC reading.

## Radio audit

- **Names:** DisplayRadioStationName reads each station's name from the GXT: FEA_R{id − 1}, or FEA_NON for off. The HUD now shows "K Rose", "Master Sounds 98.3" and "RADIO OFF" as the original does, not the port's own spellings.
- **Matches:** the per-model station and radio type table (all 232 models), StartRadio's emergency channel, no radio for non-civilian types, the one-minute and five-hour auto-retune, no retuning in an emergency vehicle, and the name's 2.5 s display with its pause and widescreen waits.
- **Unverifiable (plugin calls):** the track queue and its choices, the play-time bookkeeping, UpdateRadioVolumes (only a commented sketch exists: −12 dB in widescreen, a duck under mission audio), StopRadio (whether it saves the emergency channel) and the in-game retune. The port's station beds stand in for the music, as recorded at the top of this file.

## Boat drivers

- CCarEnterExit::AddInCarAnim seats a boat's driver in DRIVE_BOAT when the handling has m_bSitInBoat (model flag 0x400). As reversed, it gives CAR_SIT otherwise, and ProcessDrivingAnims then blends DRIVE_BOAT in over it (the "idle not found while CAR_SIT runs" branch). A sit-in-boat boat's car ride set is never found, so its driver keeps DRIVE_BOAT without steering. A boat without the flag runs aDriveAnimIdsBoat: DRIVE_BOAT_L and _R on the steer and DRIVE_BOAT_back on reverse, stepped by the same NativeDrivingAnims as the car.
- The player now shows in the boat at its ped_frontseat dummy, mirrored to the driver's side. He was hidden before.

## GXT text sweep

- **Cheats:** CCheat::AddToCheatString shows CHEAT1 or CHEAT8 in the help box (CHud::SetHelpMessage), and the port now reads both from the GXT into the help box. STAT_TIMES_CHEATED (137) is bound to the cheats' own count.
- **Asset revenue:** CPickup::Update refuses a till under $10 silently, and collecting pays with the money sound and no text. The port's own "No revenue yet." and "Asset revenue" lines are gone.
- **Script text:** CMessages::Process now runs once a game frame, so a message's time runs out and the queue closes up. Display hands each queue's front to the HUD: the brief to the subtitle line, STYLE_MIDDLE and STYLE_WHITE_MIDDLE to their big messages (the other styles use the middle one), and CHud's help message to the help box. The text is the label's GXT line, with its ~1~ numbers and ~a~ string inserted. Before this, nothing a script printed reached the screen. Limit: the help box only picks up a change of label, because DrawHelpText, which consumes the message, is unreversed.
- **Kept as is:**
  - **Wasted and busted:** these stay lowercase. The GXT has "Wasted" and "Busted", but SA's gothic font 0 draws them as the lowercase "wasted" and "busted" players know.
  - **Property:** walk-in property buying (a recorded decision) keeps its text. The original shows PROP_3 with the price and buys through the script on the action key, which the port binds to its arsenal.
- **Not shown:**
  - **Interior names:** CEntryExit::TransitionFinished, which would call SetZoneName with the entry-exit's name, is unreversed. Its commented sketch and GetEntryExitToDisplayNameOf's area checks don't settle when the name shows.
  - **Weapon pickups:** the PU_CF help for a weapon pickup of a type already held is not shown.

## Vehicle lights

- **Rule:** CVehicle::GetVehicleLightsStatus (0x6D55C0) is reversed, and the port now decides lights per car with it (`simulation/nativeVehicleLights.ts`). The global 20:30/06:30 switch is gone.
  - Lights are on from 21:00 to 05:59.
  - Over hour 20 they switch on from minute seed % 64, and over hour 6 they stay on until that minute. Traffic lights up car by car.
  - Fog or wet roads past seed / 50000 turn them on by day. m_nRandomSeed is CGeneral::GetRandomNumber's 0–32767.
  - A dark contact surface (under 0.05) under a no-rain cull zone turns them on in tunnels and covered places.
  - A gang driver with an odd seed never lights up in a gang area, where the player's zone's gang strengths sum over 20.
- **Who lights up:** only cars with a driver (the player, an autopilot, a script driver), and ridden motorbikes. CAutomobile::PreRender, which sets bLightsOn, is a retail stub, and generated cars start with it off, so parked cars stay dark (authored gate). The lamp materials, the road pools and the beams all follow the rule.
- **Bikes and boats:** setLighting had never been called for them, so they missed the object ambient and the prelight night blend, and a bike's lamp sprites never lit. Both now light like the other vehicles.
- **Boat paint:** boats spawned without paint and showed the raw primary colour code (60, 255, 0) as neon green. Boats and aircraft now take ChooseVehicleColour's paint through the model's colour rotation.
- **Smashed lamps:** a lamp the damage manager has broken stays unlit. DoVehicleLights is a stub, but its VEHICLE_LIGHTS_IGNORE_DAMAGE flag implies damage normally puts a lamp out.
- **Lit lamps:** SetEditableMaterialsCB puts ms_pLightsOnTexture (vehicle.txd's vehiclelightson128) on a lit lamp slot, with gLightSurfProps (ambient 5, specular 0, diffuse 1, as a mobile port's source records it). Lamps now swap to that texture and surface instead of tinting the unlit one. The front slots follow the headlights, and the rears the brake.
- **Not done:**
  - The FORCE_CAR_LIGHTS, FORCE_ALL_VEHICLE_LIGHTS_OFF, SET_TAXI_LIGHTS and SWITCH_CAR_SIREN world adapters, which are mission support.

## NPC gunfire audit

- **First burst:** CTaskSimpleGunControl starts with m_nextAtkTimeMs at 0, so each engagement opens with a burst at once. The port had waited a burst pause first, and kept a pause left over from an earlier engagement.
- **Reload:** a reload in the middle of a burst drops the rest of it. Back in FIREBURST the last command was RELOAD, so the attack timer restarts and a fresh pause follows the reload. The port had finished the old burst straight after reloading.
- **Shotguns:** SetUpPelletCol is reversed and does not depend on the shooter, so an NPC shotgun now sends fifteen pellet lines. Each pellet on the first line's victim adds the weapon's damage, as the player's shotgun does. FireInstantHit, which would confirm the pellet count for AI shooters, is unreversed; it only declares SHOTGUN_NUM_PELLETS = 15.
- **Matches:** burst length, the pause formula, each cop class's accuracy and rate, the default rate 40 and accuracy 60, the COP/STD skill rows, the ammo rule and the engage/disengage rules.
- **Authored:** the AI aim spread (FireInstantHit is unreversed; the class multipliers are the port's own). The same goes for DEFAULT_GUN_ATTACK_PERIOD's 1000 ms and the drive-by fire rate (CTaskSimpleGangDriveBy::ProcessPed is unreversed).

## AI drivers when something goes wrong

- **Jam recovery:** CAutomobile::ProcessEntityCollision records a collision for any contact point or grounded wheel, so a car standing on the road has always "just collided". CCarAI's jam timer is held only while the car is airborne. The port had counted body contact only, so a car stopped behind a parked or stalled car sat until the 20 s removal. Now it waits 500 × (seed mod 16) + 40 ms, reverses for 750 ms, honks, and takes the obstacle on DRIVINGSTYLE_AVOID_CARS. canJumpOut's recent-collision test reads the same record.
- **Dying driver:** PreparePedVehicleForPedDeath sets TEMPACT_HANDBRAKESTRAIGHT for 2000 ms, so the car skids straight on the handbrake. What the action does is VC's, since the SA steerer is a stub. It also keeps the jam check off while the driver dies.
- **Flipped cars:** a car with up.z at or under −0.7 keeps TEMPACT_REVERSE for 1000 ms, refreshed every frame.
- **Two rules on one frame:** when the jam and the one-in-eight 30 s rule fire on the same frame, the 30 s rule's 400 ms reverse replaces the 750 ms one. The horn has already sounded.
- **Horn counter:** the counter and the siren chirp now count down once a 30 fps game frame, not inside the audio frame. Without sound, a honking car had kept its counter at 45 forever.
- **Not done:**
  - TEMPACT_HEADON_COLLISION (4000 ms after a hard front-on hit, from VehicleDamage). What it does is in the unreversed SteerAICarWithPhysics.
  - The police temp actions around the player: REVERSE after a ram, WAIT and BOOST ahead of him, and HANDBRAKETURN head-on.

## Insane stunt bonus (HJ)

- **Where it lives:** SA scores insane stunts in main.scm's HJ thread, which the port runs.
- **In the air:** IS_CAR_IN_AIR_PROPER returns false while any colliding entity is a building or a vehicle. AddCollisionRecord takes the entity a wheel line rests on, and the road is a building. The port had looked only at the car body's contacts, and the body never rests on anything, so driving counted as flying. The first crash then paid a spurious INSANE STUNT BONUS, and real jumps that landed on their wheels were never scored. A grounded wheel (a car's contact wheels, a bike's wheels) now keeps the car on the ground.
- **Metres and feet:** ARE_MEASUREMENTS_IN_METRES, CONVERT_METRES_TO_FEET and _INT had no world adapter, so HJ died after its first bonus.
  - They now answer "feet", since CLocalisation::Metric() is false for the American language the port reads.
  - They convert at 3.28, the opcode's documented factor (authored, because the handler is unreversed). HJ then prints HJSTATF and keeps running.
- **Not changed:** bikes can't flip here, because the arcade bike's angular velocity is held, so a bike never earns the flips criterion. IS_CAR_UPRIGHT's threshold is unreversed.

## Car dirt

- CVehicle's constructor sets m_fDirtLevel to CGeneral::GetRandomNumber() % 15. CVehicle::Render then calls CVehicleModelInfo::SetDirtTextures, which puts CCarFXRenderer's dirt texture for that level on the model's dirt materials (the ones drawn with vehicle.txd's vehiclegrunge256).
- InitialiseDirtTexture, which builds the sixteen textures, is unreversed. Its known reimplementation fades each texel toward white: texel / 16 × level + (4080 − level × 255) / 16. The port applies mix(white, texel, level / 16) in those materials' shaders (`render/nativeCarDirt.ts`). Cars now range from clean to grimy, where before every car showed the full grunge texture. Bikes, boats and aircraft are CVehicles too, and take their own random level.
- **Not done:** MakeDirty (dirtier on dirt surfaces, cleaner in rain, water or on clean surfaces) is reversed, but its callers are not, so a car's dirt stays at its spawn level.

## Street peds' ambient behaviour

- **Rain:** CPopulation::ChooseCivilianOccupation passes over a sunbather (the BEACH_GUY and BEACH_GIRL pedstats) while CWeather::Rain is at 0.1 or more. The port now does the same, so no swimsuits walk the beach in a storm.
- **Not ported:**
  - **Chewing gum:** CTaskComplexFacial, fully reversed. 30% of peds chew: FACGUM for 5 s, then a 5 s rest, with FACTALK during IDLE_CHAT. The port has no facial clips on its peds yet.
  - **Stuck counter:** the counter's collision requirement, which only counts within four frames of a collision.
  - **Unreversed wander:** the dead-end, all-blocked and invalid-node sequences inside CTaskComplexWander::CreateNextSubTask.
- **Unverifiable:** the ambient partner chat (LookForChatPartners and CTaskComplexPartner are stubs), mobile phones (the task file is empty), sunbathing (CTaskComplexSunbathe is unreversed), and standing idles other than the group's IDLE clip, which is the only one street peds play.

## Player vehicle control extras

- **Mid-air control:** CAutomobile::ProcessAI's player branch (reversed) turns a car with no wheel on the ground: ApplyTurnForce(dir × stick × k × timestep, CoM + lever), with k = 0.0007 (0.0025 for a monster truck) × min(1, 3000 / turnMass) × turnMass. The driving-skill modifier is a stub and is taken as 1.
  - The handbrake with left/right yaws the car.
  - Left/right with the gas off rolls it.
  - Steer up/down with the gas off pitches it.
  - Each push stops past 0.02 a frame of turn the same way.
  - The port had none, so a car could not be levelled or spun after a jump. On the PC, steer up/down are the arrow keys and GetAccelerate is W. The port's arrows also drive, so in the air the gas test reads W alone.
- **Once-a-frame forces:** two forces are applied once a 30 fps game frame with no timestep: the burnout's rear-axle turn force, and the push that tips a car on its side back onto its wheels. They now take each 60 Hz step's share of a frame. They had been applied on every step, twice as strong.
- **Not done:**
  - The two-wheel balance: steering shifts the centre of mass once m_nCarLess3WheelCounter passes 500, but that counter is kept in the unreversed CPlayerInfo::Process.
  - The mouse's mid-air fallback.

## Game frames versus the 60 Hz step, second sweep

These native steps run once a 30 fps game frame with no timestep. Each 60 Hz step now takes its share of a frame (timeStep × 30 / 50), or runs only on frame steps:
- **Car spin damping:** CPhysical::ApplyAirResistance's vehicle turn damping, m_vecTurnSpeed × 0.99. Every car's spins and rolls had died out twice as fast (55% left after a second instead of 74%).
- **Boat roll:** ProcessBoatControl's 1 / (1000x² + 1) roll factor.
- **Boat waves:** ProcessBoatControl measures the change in depth over a frame and pushes once. A step's change is scaled up to a frame's, which sets both the > 200 hit test and AE_BOAT_HIT_WAVE's volume, and the push takes the step's share.
- **Wheels:** ProcessCarWheelPair's airborne wheel spin-up and spin-down (−0.1, +0.05, × 0.95).
- **Flamethrower:** CShotInfo::Update's SetCarsOnFire every fourth frame and SetWorldOnFire every frame.
- **Peds and cars:** the potential-run-over scan and its random responses, now once a frame (the scanner itself is unreversed; its timer's interval of −1 suggests every frame).
- **Swim speed:** ProcessSwimmingResistance treats the stroke clip's shift over a 30 fps frame as a move speed in units per 1/50 s. At the game's frame rate CJ therefore swims 50/30 of the clip's own speed; this is the "slower swimming at high frame rates" quirk. The port had swum at the clip's speed, 60% of the game's. The stroke is now scaled by 50/30 (breaststroke about 3.9 units a second, `tests/browser/swim-speed.spec.ts`).

## Collision audio audit

- **Frame numbers:** the once-a-frame dedupe and the scrape easing had keyed on `floor(time × 30 / 1000)` of the rounded millisecond clock, which skips every third frame number. One audio frame in three lost its reports, and the scrape eased on a third of the frames. Both now count serviced audio frames. The scrape's stop test also reads this frame's clock, where it had read the previous frame's.
- **Car into car:** CPhysical::ApplyCollision's physical-against-physical branches report both ways. The second report finds the pair's one-shot and turns it into the metal scrape tail. The port had reported only from the moving car.
- **Glass:** ReportGlassCollisionEvent plays at GetDefaultVolume of the glass event itself (eventvol.dat: −5 dB for a hit, crack or break, −22 dB for a pane landing), not the general collision's −3.
- **Car into ped:** car colliders have no solver contact with peds, so the strike reports its own collision sound both ways. The car's report is its intensity over its mass, the ped's over 70. The car-body impact now plays alongside AE_PED_CRUNCH.
- **Fall deaths:** CTaskComplexDie::SayDeathSample raises AE_PED_CRUNCH on a ped killed by a fall. That plays collision sound 29 and a gore splat (47 to 49) as AE_PED_KNOCK_DOWN, each unless one is already playing.
- **Faithful as is:** UpdateLoopingCollisionSound's step_to runs from the target toward the current speed, so a scrape settles at 0.65. That is the reference's own argument order.
- **Not done:** reports from bikes, boats, planes, peds and loose props (only cars report here); resting contacts along a wall; and objects counting as buildings for the rubber sound.

## Frontend audio audit

- **Plain pickups:** a keycard, briefcase, clothes or other plain model from a ONCE-type pickup (types 3, 4, 5 and 22) plays AE_FRONTEND_PICKUP_WEAPON. That is CPickup::Update's `mi != MI_PICKUP_SAVEGAME` branch, which runs after GivePlayerGoodiesWithPickUpMI declines the model. On-street copies stay silent. The port had played nothing for these.
- **Matches:** the event ids, the banks and slots, every sample pair, the five-frame retrigger guards at 30 Hz, and the health, armour, adrenaline, bribe, money, weapon, collectable, stunt-jump and tag call sites.
- **Mission support, not done:**
  - DISPLAY_ONSCREEN_TIMER, SET_TIMER_BEEP_COUNTDOWN_TIME and ADD_ONE_OFF_SOUND have no world adapter, so a mission using them stops; the timer's beep goes with them.
  - The mission-audio events (shop purchases, race countdowns) are recorded but not played, since ProcessMissionAudioEvent is unreversed.
- **Unverifiable:** the help-text bleep (CHud::DrawHelpText is unreversed), the garage sounds (CGarage::Update is not hooked), and the bullet whizz's front-to-rear movement (UpdateParameters is unreversed).

## The player being hurt

- **After a car:** CTaskComplexFallAndGetUp lies the player down 500 ms after WEAPON_RAMMEDBYCAR, RUNOVERBYCAR or FALL; a street ped lies 1000 ms. The port had used 1 s for CJ too.
- **Explosions he survives:** TriggerExplosionSectorList pushes CJ as any ped: min(mass/1400 · falloff · force, mass/4) along the blast, and 4 more up if he stands. WEAPON_EXPLOSION takes ComputeDamageAnim's ordinary branch (past WEAPON_CHAINSAW, no fight, so no fall). That branch plays HIT_FRONT plus the direction, or HIT_WALK past 20 damage. The port had floored him with a knockout clip where he stood.
- **Burning:** CTaskSimplePlayerOnFire's ComputeFireDamage lowers health with no CEventDamage until the burn is fatal. CJ no longer flinches every 2.5 s while he burns.
- **Not done:**
  - CJ's pain lines (ComputeWillKillPed's PAIN_LOW/HIGH and PAIN_CJ_DROWNING). The port has no CJ speech bank; its stand-in samples are street peds'.
  - Teargas choking (CWorld::SetPedsChoking's CTaskSimpleChoking).
  - A new hit cutting a get-up short.

## Car reflections (CCustomCarEnvMapPipeline)

- **Env textures were never loaded:** decodeModelTextures only decoded each material's own texture, never its MatFX env texture. So no vehicle and no model reflected at all. The env textures (xvehicleenv128, vehicleenvmap128 and the like) now load with the model.
- **The PC car pipeline, reversed in full, now shades every vehicle model.** It reads SA's reflection material block (0x253F2FC: scale, translation scale, shininess) and ignores the MatFX coefficient (`assets/nativeCarEnvMap.ts`).
  - A material reflects only with non-zero shininess and an env texture.
  - **SHINE_CAM** (textures such as vehicleenvmap128): the camera-space normal is projected through (sx·nx + u·nz, sy·ny + v·nz, nz), with u, v = −fmod(position, 50·transScl) / (50·transScl), and the reflection is added at min(255, shininess × specIntensity × 254) / 255.
  - **SHINE_WAVE** (texture names starting with 'x', on a second UV set): the second UV set is shifted by (−OffsetU, v). OffsetU slides with the car's travel along its forward (the 0x5D8590 zigzag), and v = clamp(up.x + up.y, 0, 0.1), or 1 − v upside down. The reflection is blended over the texel at alpha min(255, specIntensity × 24) / 255.
  - **specIntensity** is gSpecIntensity × 1.85, from SetupLightingForEntity's multiplier. For a car that is the port's own contact lighting, so reflections dim in shade, in tunnels and at night.
  - **Stand-ins:** bikes, boats and planes keep no contact lighting, so the object ambient's mean with a contact brightness of 0.5 stands in (authored). Blown-up vehicles lose the reflection.
- **Specular:** a material with SA's specular block (0x253F2F6: a level and a named spec texture) gets D3D fixed-function per-vertex specular from the extra directional light along the sun (Specular 0.65, non-local viewer): spec = min(1, specIntensity·level·2), power = level·100. It is added before the fog. The same light's 0.25 diffuse and 0.75 ambient on these materials are not added.
- **Far model:** the far `_vlo` model (ATOMIC_PIPE_NO_EXTRA_PASSES_LOD) draws without the reflection. Specular stays, as at high FX quality.
- **Not done:**
  - The point-light factor of gSpecIntensity (GenerateLightsAffectingObject is unreversed).

## Building-pipeline reflections (CCustomBuildingPipeline)

- The six env-mapped models on building pipeline 0x53F2009C (casroyale01–04_lvs, flamingo04/05_lvs, env texture
  carfx1) reflect as CustomPipeMaterialSetup (0x5D7DB0) and CustomPipeRenderCB (0x5D77D0) do:
  - on when SA's reflection-plugin shininess is non-zero (1 without the plugin), whatever the MatFX coefficient;
  - multiply-added at a white TFACTOR, so at full strength (the shininess goes only into TFACTOR's alpha, which
    the colour op never reads);
  - at uv = the raw camera-space normal (TCI_CAMERASPACENORMAL, no texture transform), on a wrapping texture.
- The eleven unpiped env props keep RW MatFX's (0.5 + 0.5·n.x, 0.5 − 0.5·n.y) × coefficient.
- The building copy no longer serialises the env texture through `Material.copy`'s JSON round trip of userData.
- Open: the day/night building pipeline's env handling (0x5D6480, 0x5D7120) is unreversed. No published env model
  uses it.

## Stat update messages, second pass

- **HelpMessageDisplayed:** this is m_nHelpMessageState, which only the drawn help box sets. The port's check
  compared `now <= helpUntil` with both at 0, so at game time 0 it reported a help box that was not there. As a
  result, the opening `SET_FLOAT_STAT 165 800` showed "Energy +" on some starts and not others.
- **Several stat sets in one frame:** HelpMessageDisplayed only counts a box a frame has drawn, so each set
  replaces the last. Main.scm's opening sets (energy, muscle, fat) leave "Fat +", as CHud would. The port used to
  keep the first.
- **SetHelpMessageStatUpdate:** it takes the help buffers (`ScmHelpMessage.setStatUpdate`).
  - It bails like SetHelpMessage: a mission title, a garage message, a replay or a cutscene.
  - A permanent help (state 1) refuses it.
  - The help line and the stat box are one box, so each replaces the other.
- **Note:** explore mode does not draw the intro's own fade. Natively the box sits under that fade (DrawHelpText is
  not in DrawAfterFade), so the "Fat +" at the start is visible only in the port.

## Shops (CShopping), the player's purse and parole

- **CShopping** is ported from data/shopping.dat (now published) as `ScmShopping`. The shop scripts' commands no
  longer stop the script: LOAD_PRICES, LOAD_SHOP, GET_NUMBER_OF_ITEMS_IN_SHOP, GET_ITEM_IN_SHOP, GET_PRICE_OF_ITEM,
  GET_SHOPPING_EXTRA_INFO, GET_NAME_OF_ITEM, BUY_ITEM, GET_LOADED_SHOP, CLEAR_LOADED_SHOP, ADD/REMOVE_PRICE_MODIFIER
  and HAS_PLAYER_BOUGHT_ITEM.
  - **Keys:** a texture's CKeyGen key for clothes, haircuts and tattoos, the weapon type for weapons, else the IDE
    model index. Food, for instance, is keyed by its burger-tray models.
  - **LoadPrices:** its count steps on comment and blank lines too, so those take price slots of their own.
  - **Buy:**
    - takes the price from the purse and applies the item's two stat changes (respect and appearance ×10);
    - adds to the budgets;
    - for clothes and haircuts, takes the old item's stats back and dresses the player by key;
    - arms the player, or fills his armour to the maximum;
    - puts the player on parole for torso, legs, head, glasses and hats, and for every haircut.
  - **Entering a door** loads the shop its name names, as TransitionFinished's reconstruction does, and marks the
    linked door as the reward side, which unloads it on the way out.
  - **Not checkable:** gPriceMultipliers is exe data the reference does not hold; each is taken as 1.
  - **Not reachable yet:** gta_int.img is not published, so no shop interior can be entered. Car mods need
    AddVehicleUpgrade, which the port lacks, so a mod shop lists nothing.
- **The purse:** CPlayerInfo::m_nMoney is one value. The score commands (ADD_SCORE, STORE_SCORE, IS_SCORE_GREATER)
  used to move a script-only number the HUD never showed. They now move the player's own money.
- **Parole** (CWanted::ClearWantedLevelAndGoOnParole):
  - The level and chaos are cleared and remembered.
  - For 20 s, a new crime restores at least the old chaos, and SetWantedLevelNoDrop restores the old level.
- **GIVE_WEAPON_TO_CHAR and SET_CURRENT_CHAR_WEAPON on the player** arm and switch CJ. They used to stop the script
  (the first) or do nothing (the second).

## Building pipes and the day/night prelight (CCustomBuildingRenderer, CCustomBuildingDNPipeline)

- **Which atomics are buildings:** CCustomBuildingRenderer::IsCBPCPipelineAttached (0x5D7F40) accepts an explicit
  building pipeline ID (0x53F2009C, 0x53F20098), or else a geometry with both a night colour set and prelight.
  AtomicSetup (0x5D7F00) then picks the day/night pipe whenever both sets are there, and the plain pipe otherwise,
  whatever ID was stored. Both routines are unreversed in gta-reversed. The jte/GTASA decompilation and aap's
  librwgta (`isBuildingPipeAttached`, `setupBuildingPipe`: "pc: if two sets -> DN, else -> regular") agree.
  - Of the published archive's atomics, 11,723 have both sets and no pipeline plugin. Only 6 carry the DN ID and 8
    the plain one. The port used to key the building pass on the ID alone, so nearly every building drew as a lit
    object: the sun's directional light and the object ambient on top of a CPU-blended prelight.
  - A building never gets m_bLightObject (CEntity::CreateRwObject), so CEntity::SetupLighting returns false and
    RemoveLighting leaves the world ambient with the directional off. Buildings now draw without the sun's shading.
  - A geometry with a night set but no prelight (the nightlights and lanitewin models) is no building, and the port
    no longer shows its night colours as vertex colours.
- **Alpha:** NVCPipelineProcess blends all four bytes, alpha included, by the balance. The port had taken alpha
  from the night set, moving to the day set with a wetness input that nothing set. That rule is the PS2 one. 18 of
  the archive's day/night geometries have different day and night alpha (road_sfe, lod_nw_bit and others).
- **When the prelight changes (PreRenderUpdate, 0x5D7200):** each geometry keeps the balance it was last blended at.
  - Once a game frame, CEntity::PreRender runs it for each model the renderer reaches: the drawn ones and the
    off-screen lit ones in range.
  - A change of 0.01 or less is dropped. One of 0.3 or less waits for the atomic's turn: address / 0x70 mod 16
    against CCustomBuildingRenderer::Update's counter, advanced once a CGame::Process, with s_Magic2 cleared there.
    The address is a heap pointer, so a hash of the model's name stands in.
  - A model created (CEntity::CreateRwObject) blends at the current balance at once.
  - The blend truncates each byte, `to * t + from * (1 - t)`.
  - The port had blended every vertex of every model on the CPU on every frame, continuously. The blend now runs in
    the building shader by the geometry's stored balance, so no colour buffer is rewritten or re-uploaded.
- **Cost:** the per-frame prelight work fell from 7.8% of the frame's CPU samples to 0.2% in a Grove Street
  profile. The day/night geometries no longer keep a float colour copy.
- **Not done:**
  - The PC render callbacks themselves (0x5D6480 DN, 0x5D77D0 plain) are unreversed. The base pass stays the
    SkyGFX PS2 order, whose 255/128 colour scale also scales the ambient term.
  - Nine environment-mapped props with both colour sets (aprtree01_lvs, flamingo01_lvs, visagesign04 and others)
    now take the building pipe's reflection. The day/night pipe's env setup (0x5D7120) is unreversed.

## Pickup frame slices (CPickups::Update)

- **Streaming:** each game frame, CPickups::Update reaches one thirty-second of its 620 slots: `620 · (frame mod 32)
  / 32` up to the next thirty-second. There IsVisible (2D, within 100 units of the camera) sets bVisible, gives a
  visible, enabled pickup its object and takes a far one's away. The port had streamed every pickup on every
  drawn frame.
- **Collection:** the same frame, one sixth of the slots runs CPickup::Update, and only the pickups flagged visible.
  So a pickup is taken, regenerates or times out at most once every six game frames, and never beyond 100 units of
  the camera. The port had checked every pickup on every 60 Hz step.
- **Slots:** the script's pickups take the slots in creation order, and a pickup made during play takes the first
  free one (GenerateNewOne's search; that routine is unreversed).
- A regenerating pickup gets its object back at once, as CPickup::Update calls GiveUsAPickUpObject.

## Climb settle speed at the 60 Hz step

- In CTaskSimpleClimb::ProcessPed's settle branch the offset to the hold is under 0.317 and becomes a speed:
  offset / time step. At the original 30 fps step (1.67) that never passes 0.19. At the port's 60 Hz step (0.83) it
  reached 0.38, past the −0.375 a landing reads as a fall.
- gta-reversed 25f72a7 added a reversible fix (CTaskSimpleClimb_ProcessPed_SettleSpeedFrameRate) that bounds the
  settle speed at 0.2, as the coarse step above it is bounded. The port now does the same. At the original step the
  bound never applies, so the 30 fps result is kept.

## Bike and boat generators (CCarGenerator::DoInternalProcessing)

- **What changed:** the map's car generators include 33 bikes (BMX, mountain bikes, Choppers, Sanchez, quads,
  NRG-500s) and 73 boats (Dinghies, Speeders, Reefers, Marquis, Squalos and others). The port had spawned only the
  car and aircraft records. In their place it invented one bike on flat ground near the player (BMX first) and one
  boat on the nearest water, which the original never does. Both inventions are gone. The generators now make their
  own bikes and boats:
  - A boat sits at the record's height, or on the ground below when the record is below the map (baseZ).
  - A bike stands on the ground ProcessVerticalLine finds from a unit above the record, or from 1000 when the record
    is below the map.
  - Both turn to the record's angle in 256ths of a circle.
  - A spot CheckForBlockage finds taken waits four more milliseconds, far from the player.
  - They count toward NumParkedCars' 5 by day and 10 at night.
- **Random-model generators (CLoadedCarGroup::PickRandomCar(true, true)):**
  - Up to ten draws, weighted by the vehicles.ide frequency: a draw in [0, sum) walks the list and takes the first
    model whose frequency reaches what is left.
  - Only the normal, poor family, rich family and motorbike classes take part. A suppressed model, or one already
    in the world three times, is drawn again.
  - The port had drawn every car of the popcycle groups with equal chance, and never a motorbike. A motorbike drawn
    now parks as a bike.
  - m_AppropriateLoadedCars is what CStreaming holds for the zone. The popcycle membership stands in for it.
- **Not done:** CBike::ProcessControl is unreversed, so a generated bike stands upright rather than leaning on its
  side stand (bOnSideStand).

## Mission clock and counters (COnscreenTimer)

- **Before:** DISPLAY_ONSCREEN_TIMER, DISPLAY_ONSCREEN_TIMER_WITH_STRING, the counter commands, FREEZE_ONSCREEN_TIMER,
  SET_TIMER_BEEP_COUNTDOWN_TIME and SET_ONSCREEN_COUNTER_FLASH_WHEN_FIRST_DISPLAYED went to world adapters that did
  not exist, so a mission that used them stopped: 71 timed and 89 counted uses across the campaign. The clear
  commands kept the variable's value instead of clearing by the variable.
- **Now:** COnscreenTimer, COnscreenTimerEntry and COnscreenCounterEntry are ported (`engine/ScmOnscreenTimer.ts`).
  - The commands name the global variable itself. The entries keep its byte offset and read or write it directly.
  - Once a game frame, after the scripts (CUserDisplay::Process), the clock moves its variable by the frame's whole
    milliseconds, and is left alone while frozen.
  - A countdown under its beep seconds (12 by default) reports AE_FRONTEND_TIMER_COUNT unless widescreen is on. One
    that runs out stops at 0 and frees the clock.
  - The display text is "%02d:%02d" of minutes (mod 100) and seconds. A counter shows "%d", clamped at 0, or
    "%d / %d".
  - A new counter is light blue and flashes when first shown. Only a free slot takes one, and only a free clock
    takes a clock.
- **The Nth counter index is one-based:** the plain counter is slot 0. The two missions that show a plain counter
  beside Nth ones number the Nth ones from 2 (ANR_37 with 2 and 3, TX_TOTL with 3), and the Blood Bowl pair uses 1
  and 2.
- **Timer count audio:** frontend sounds 4 and 5, left and right. A report that finds them already playing only
  refreshes m_nLatestTimerCount; UpdateParameters stops them 100 ms after the last report. This follows the
  commented decompilation, as the port's other frontend events do.
- **Not done:**
  - CHud::DrawMissionTimers is unreversed. The rows' placement, font and the first-shown flash are authored: under
    the wanted level, label left and value right, a bar counter filled out of 100, in its HUD colour.
- **ADD_ONE_OFF_SOUND** (67 uses) no longer stops a mission. Its operands are an AE_SCRIPT_* event (1052
  AMMUNATION_BUY_WEAPON, 1058 PART_MISSION_COMPLETE, ...) and a point, so it goes to ReportMissionAudioEvent like
  REPORT_MISSION_AUDIO_EVENT_AT_POSITION. The command's own dispatch is unreversed. Nothing plays the reports yet
  (ProcessMissionAudioEvent is unreversed). Only the latest 64 are kept; the list had grown for the whole session.

## Script task status (CPedScriptedTaskRecord)

- **Before:** GET_SCRIPT_TASK_STATUS (624 uses in 72 missions) went to a world adapter that did not exist, so the
  thread stopped.
- **Now:** a task given to a script's ped keeps a record, as CPedScriptedTaskRecordData::Set does.
  - It is EVENT_ASSOCIATED (0) until the next CPedScriptedTaskRecord::Process, run once a game frame after the
    scripts, and TASK_ASSOCIATED (1) while the ped still holds its order or sequence.
  - The record is flushed once the order is over, the ped is gone, or CLEAR_CHAR_TASKS clears it.
  - GetStatus(ped, opcode) answers from a record whose opcode matches, or −1. The command reports −1 as 7
    (FINISHED_TASK), the value the missions compare against. The command's own dispatch is unreversed.
  - A wander task never finishes, so its record stays until it is replaced.
- **Simplified:** the port holds one scripted order per ped, so each ped has one record, not one per task slot.
  The PRIMARY and SECONDARY states (a task held but not active) do not arise.

## Mission world adapters, first batch

Of the 777 world adapters the command handlers call, 535 had no implementation in the live mission world. A thread
that reached one was retired, which stops the campaign well before its content does. By the missions that use them,
the first ones now implemented:

- **SET_CHAR_SHOOT_RATE** (237 uses, 40 missions): CPed::m_nWeaponShootingRate, a byte. It sets the burst length
  and pause of a script ped's gun (CTaskSimpleGunControl, already ported for street peds).
- **SET_RADIO_CHANNEL** (34 missions): CAudioEngine::RetuneRadio. User tracks with none loaded mean off. The port
  has no beat tracks to hold the retune back.
- **WARP_CHAR_INTO_CAR_AS_PASSENGER** (30 missions): the seat operand is the one CREATE_CHAR_AS_PASSENGER takes.
- **GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS** (21 missions): a ped's matrix is its heading's turn about the vertical,
  at its position. The player's heading now reaches the script.
- **REMOVE_WEAPON_FROM_CHAR** (19 missions) and **REMOVE_ALL_CHAR_WEAPONS** (8): CPed::ClearWeapon and ClearWeapons.
  - A weapon goes only if its slot holds it, and a held one leaves the ped unarmed.
  - The goggles come off with their weapon (RemoveGogglesModel).

## Decision makers a script picks or copies

- **Bug fixed:** SET_CHAR_DECISION_MAKER stored the script's handle on the ped. Handles carry the slot's
  reference in their high half (0x2000A, say), while the script's own decisions are kept by slot, and the default
  makers by index. So no decision maker a script built or named ever answered for its ped. SetCharDecisionMaker
  (reversed) passes CTheScripts::GetActualScriptThingIndex: the slot (the handle's low half), or −1 when a script
  slot's reference no longer matches. The ped now wears that index.
- **COPY_CHAR_DECISION_MAKER and COPY_SHARED_CHAR_DECISION_MAKER** (24 missions) no longer stop the thread.
  - They take a new slot as a load does, and the slot is filled with the source's decisions from the published
    default files: 0x10002 R_Norm, 0x10003 R_Tough, 0x10006 m_empty and 0x10007 Indoors are the ones the missions
    copy.
  - The script's own ADD_CHAR_DECISION_MAKER_EVENT_RESPONSE rows then add to those.
  - CDecisionMakerTypes' copy is not in the reference. A source of −1 gives an empty maker.

## Mission world adapters, second batch

- **IS_POINT_ON_SCREEN** (20 missions, and MAIN; reversed): CCamera::IsSphereVisible against the camera frustum. A
  point below the map takes the ground height first.
- **GET_CAR_CHAR_IS_USING** (10 missions, MAIN; reversed): the car the ped sits in, else −1. The car the player is
  walking to enter is not handed to the script.
- **SHUT_CHAR_UP, DISABLE_CHAR_SPEECH and ENABLE_CHAR_SPEECH** (11 missions each, MAIN; reversed):
  CPed::DisablePedSpeech and EnablePedSpeech.
  - The switch these and SHUT_CHAR_UP_FOR_SCRIPTED_SPEECH set was never read. A ped's pain, flee and threat lines
    now keep quiet while it is off, as AddSayEvent does.
  - The browser keeps one switch for both of the original's.

## Mission world adapters, third batch

- **IS_CAR_IN_WATER** (17 missions, MAIN): the vehicle's in-water flag from its buoyancy, as Vice City's handler
  reads bIsInWater. SA's handler is unreversed.
- **GET_POSITION_OF_ANALOGUE_STICKS** (15 missions, MAIN): CPad::NewState's four stick axes, read straight from the
  script's pad state (−128 to 128). It no longer needs the host.
- **SLIDE_OBJECT** (73 uses, 14 missions, MAIN): Vice City's handler, since SA's is unreversed.
  - Each axis moves toward the target by its speed × the frame's timestep, stopping at the target.
  - The compare flag is set once all three axes have arrived.
  - With the collision check, a move the host reports blocked is not made. The browser host does not report
    collisions for script objects yet, so they slide through.
- **LOAD_TEXTURE_DICTIONARY and REMOVE_TEXTURE_DICTIONARY** (13 missions, MAIN): the script's texture slot. The
  loaded name is the script's own state, like LOAD_SPRITE's names. Drawing CTheScripts::IntroRectangles is not
  done: the host draws none of the script's sprites and rectangles yet.
- **IS_CHAR_TALKING** (9 missions, MAIN): false. The browser plays no speech lines for a script's peds (the speech
  banks are not published), so none is ever mid-line. A mission waiting on a conversation moves on.
- **IS_CAR_PASSENGER_SEAT_FREE** (7 missions, MAIN): no live script ped sits in that seat of the car. A ped
  attached to the roof takes no seat.
- **PLAY_MISSION_PASSED_TUNE** (141 uses, 117 missions, MAIN): it used to need a host adapter, and without one it
  retired the mission thread at the moment of its pass, before REGISTER_MISSION_PASSED and the rewards ran. SA's
  handler is unreversed, and the tune is a stream track (CAECutsceneTrackManager, m_bPlayingMissionCompleteTrack)
  that the port does not package. The command now records the tune number in the game state, calls the host's player
  if one exists, and the script carries on.
- **GET_DRIVER_OF_CAR** (67 uses, 15 missions): m_pDriver's handle, or -1 with nobody driving. It used to write 0,
  which is a live pool index. A script car's driver is the live script ped in its driving seat. The player drives
  the car it is in.
- **IS_CAR_UPSIDEDOWN** (12 missions): CVehicle::IsUpsideDown (0x6D1D90), the up axis's z at or below -0.9. The
  script handler itself is unreversed.
- **ADD_ARMOUR_TO_CHAR** (12 missions): m_fArmour plus the amount, clamped to 0 and to CPlayerInfo::m_nMaxArmour for
  the player (as the armour pickup does) or 100 for other peds. The handler is unreversed. A script ped keeps the
  figure in its pool record, but the browser's ped damage does not spend ped armour yet.
- **SWITCH_CAR_SIREN** (11 missions): vehicleFlags.bSirenOrAlarm on the car. The siren lights and the siren sound
  already read that flag.
- **SET_CAR_CAN_BE_VISIBLY_DAMAGED** (10 missions): autoFlags.bCanBeVisiblyDamaged. CDamageManager::ApplyDamage
  (0x6C24B0) returns at once without it, so collisions and weapons leave panels, doors, wheels and lights as they
  are while the car still loses health.
- **SET_TIME_SCALE** (10 missions): CTimer::ms_fTimeScale, the same value the speed cheats and the stunt-jump slow
  motion write.
- **SET_CHAR_COLLISION** (44 uses, 17 missions): CEntity::SetUsesCollision (CharacterCommands SetCharCollision).
  - A script ped without collision has its capsule taken out of the query pipeline. Nothing touches it and no line of
    sight meets it, which matches CWorld::ProcessLineOfSight skipping entities without m_bUsesCollision.
  - The player's capsule stays enabled, since the rest of the port reads an enabled capsule as "on foot". Instead its
    collision and solver groups go to 0. Contacts ignore it, but lines of sight still meet it.
  - Either way the ped's own movement query ignores these groups, so it still stands on the ground. The original
    ped would fall through the map unless the script also froze it, which the missions do.
- **OPEN_CAR_DOOR and OPEN_CAR_DOOR_A_BIT** (18 missions): CAutomobile::OpenDoor with no ped and the sound on, to a
  ratio of 1 or to the script's ratio. The door index is eDoors (bonnet, boot, LF, RF, LR, RR). CAutomobile::OpenDoor
  now also returns at once when the model lacks the door's car node (m_aCarNodes[nodeIdx] null). The port used to
  move and report a door that had no frame to move.
- **Script peds stand still by default.** CPed's constructor sets a looped CTaskSimpleStandStill as
  TASK_PRIMARY_DEFAULT (Ped.cpp). Only CPopulation::AddPed with makeWander replaces it with the wander. A ped
  CREATE_CHAR makes therefore stands where it was put, both before its first task and between tasks.
  - Before this change the port's script peds wandered the path nodes whenever no task was running.
  - The default stand is not a script task: GET_SCRIPT_TASK_STATUS reports FINISHED for it.
  - CLEAR_CHAR_TASKS leaves the default stand.
  - TASK_WANDER_STANDARD is a primary task, so the ped keeps wandering.
  - MARK_CHAR_AS_NO_LONGER_NEEDED follows CTheScripts::CleanUpThisPed on foot: a wandering ped carries on, and any
    other primary task gives way to the wander.
- **TASK_GO_STRAIGHT_TO_COORD** (957 uses, 86 missions, MAIN): CTaskComplexGoToPointAndStandStill, or its Timed form
  when the time is not negative.
  - SelectMoveState: a runner walks inside the move-state radius, and a sprinter also runs inside 10 units.
  - CTaskSimpleGoToPoint arrives inside the radius when the height is within 2 units, or when the next step would
    carry the ped past the point.
  - The Timed form puts a ped that is not yet standing on the point when its time runs out, on the ground
    CPedPlacement::FindZCoorForPed finds (the higher of two vertical probes).
  - The script handler is unreversed. The target radius is taken as 0.5 and the move-state radius as the
    constructor's 2.
  - A z at or below MAP_Z_LOW_LIMIT means the ground, so no height check is made.
  - An event response (a flight, a retaliation) moves the ped at its own speed while it lasts.
- **TASK_KILL_CHAR_ON_FOOT** (754 uses, 68 missions), with its ducking and timed forms: CTaskComplexKillPedOnFoot,
  whose control is unreversed. The ped fights its target with the port's own armed and melee retaliation combat.
  - The task is over once the target is dead or gone, the player's death included, or once the timed form's time
    runs out. The retaliation ends with it, so the ped does not turn on the player afterwards, and it goes back to
    its default stand.
  - The attack-style flags, the action delay and chance, and the must-be-on-foot bit are not modelled.
- Script tasks can now name the player (handle 1) as their target. TASK_TURN_CHAR_TO_FACE_CHAR, TASK_SMART_FLEE_CHAR
  and TASK_KILL_CHAR_ON_FOOT aimed at the player used to give up, because the player is no pool ped.
- **TASK_PLAY_ANIM and TASK_PLAY_ANIM_NON_INTERRUPTABLE** (923 + 325 uses, 77 + 38 missions): CTaskSimpleRunNamedAnim.
  - A PED clip comes from ped.ifp. Any other block is its own .ifp from the archive, read once. Name-only tracks are
    resolved through ped.ifp's skeleton.
  - A looped clip wraps; a one-shot clip ends the task at its end. With keep-last-frame the pose holds until the
    ped's next task or CLEAR_CHAR_TASKS.
  - The script's time, when it gives one, ends the task, looped clips included.
  - A fall or hit that takes the ped's pose also ends the task. A missing block or clip ends it at once.
  - IS_CHAR_PLAYING_ANIM and GET_CHAR_ANIM_CURRENT_TIME read it. The current time is now the clip-relative
    m_fCurrentTime over the total time, wrapping for a looped clip.
  - The blend delta, the X/Y root locks and the interruptable bit are not modelled: the clip replaces the pose at
    once and the ped stays in place.
- **Script tasks on the player's own ped** (scplayer): 49 missions run sequences on him, 40 play clips, 38 walk him
  to a mark and 21 turn him to face someone. These used to give the thread up, because the player is no pool ped.
  - PlayerScriptTasks runs stand-still, achieve-heading (at STAT_PLAYER's heading change of 9), go-to-point
    (walk/run/sprint by SelectMoveState, the Timed placement included) and named clips.
  - Sequences of those run too. Anything else still gives the thread up.
  - While a task runs on foot it speaks for the pad, whatever SET_PLAYER_CONTROL says: the stick points at the mark,
    or the player is held facing the task's heading. CPedIntelligence's primary task replaces
    CTaskSimplePlayerOnFoot the same way.
  - GET_SCRIPT_TASK_STATUS and CLEAR_CHAR_TASKS work for the player.
  - The player's own handle can be a task's self as well as its target.
- **TASK_LOOK_AT_CHAR** (164 uses, 43 missions; 27 on the player): CTaskSimpleTriggerLookAt, which starts
  g_ikChainMan's look and is over at once, so a sequence goes straight on. A script ped's head follows the ped (or
  the player) through the port's CTaskSimpleIKChain blend for the task's time. The player's own look uses his
  existing glance chain.
- **TASK_ENTER_CAR_AS_DRIVER and TASK_ENTER_CAR_AS_PASSENGER** (44 and 39 missions), on a car the script made:
  CTaskComplexEnterCarAs…Timed.
  - The ped runs to the seat's door as CTaskComplexGoToCarDoorAndStandStill does: PEDMOVE_RUN, 0.5 target radius,
    walking inside 4 units, giving up after 30 s of seeking. The door point is GetPositionToOpenCarDoor's, from
    ped_frontseat or ped_backseat and the car's get-in clip, and is re-read each frame as the car moves.
  - There it is set in the seat. The open-door, get-in and close-door clips are not played for script peds.
  - The Timed form's CTaskSimpleCarSetPedInAs… sets a ped still on its way in when its time runs out.
  - A passenger seat of -1 takes the first free one. A rear seat needs the model's ped_backseat, and a seat a
    script ped holds is not free. A taken driving seat is not jacked.
  - The player's own car is not boardable by script peds yet, so those tasks still give the thread up.
  - Setting a ped in swaps its body for a rider's, so it waits until the frame is done. Doing it inside the ped
    loop freed a Rapier body mid-iteration and broke the physics world.
- GET_SCRIPT_TASK_STATUS counts a ped riding in a car as holding none of the on-foot tasks. It used to report
  such a ped's task as running for ever.
- **TASK_LEAVE_CAR, TASK_LEAVE_ANY_CAR and TASK_LEAVE_CAR_IMMEDIATELY** (40, 38 and 9 missions) for a script ped
  riding a script car.
  - The ped is set down on foot at its seat's door point (GetPositionToOpenCarDoor), on the ground there.
  - The get-out clips are not played.
  - A ped on foot, or in a car other than the one named, has nothing to do, and the task is over at once.
  - The player's own exit through these tasks still gives the thread up.
- **TASK_CAR_DRIVE_TO_COORD** (324 uses, 55 missions), for a script ped at the wheel of a script car:
  CTaskComplexDriveToPoint through ScriptCarMissions.
  - Modes: CCarAI::GetCarToGoToCoors (mode 0), …Accurate (1) and …StraightLine (2). The racing mode (3) drives as
    mode 0.
  - The task's speed and driving style become the autopilot's.
  - UpdateCarAI's reversed switching (CarAI.cpp) is followed: GOTOCOORDINATES turns straight inside
    m_nStraightLineDistance (default 20), and the straight mission clears inside 3 units (1 when accurate). Past
    the distance + 5 it rejoins the road every eighth frame.
  - JoinCarWithRoadSystemGotoCoors (unreversed; Vice City's rule) drives straight when there is no road route.
  - The road following, the red-light stops for STOP_FOR_CARS and SLOW_DOWN_FOR_CARS, and the stuck recovery are
    the police units'. Traffic avoidance is not modelled.
  - The task is over when the car's mission clears. MISSION_NONE holds the brakes.
  - CLEAR_CHAR_TASKS on the driver, or the driver leaving, clears the mission.
  - A driver not yet at that car's wheel still gives the thread up: CTaskComplexCarDrive would put it in first.
  - The car path nodes are read the first time a script drives.
- **SET_CAR_STRAIGHT_LINE_DISTANCE** (19 missions): CAutoPilot::m_nStraightLineDistance, which the coordinate missions
  switch on.
- **TASK_CAR_TEMP_ACTION** (76 uses, 29 missions) for a script driver: CAutoPilot's temporary action for the task's
  time, over whatever mission the car has; the task is over when the action is. SA's steerer is a stub, so:
  - wait, reverse, the handbrake turns, the turns and go-forward follow Vice City;
  - the SA-only reverses use the wheel full left, full right or straight;
  - TEMPACT_BRAKE is a full brake.
  HANDBRAKESTRAIGHT (6) is 50 of the scripts' 76 uses. The player's own car is not driven by it yet.
- **TASK_CAR_DRIVE_WANDER** (22 missions): MISSION_CRUISE along the roads, one continuation picked at random at each
  node (PickNextNodeRandomly), at the task's speed and style. It keeps running until it is cleared.
- **The player and the script's cars and coordinates.** Several common commands did nothing, or gave the thread
  up, for scplayer (handle 1), which the ped pool does not hold:
  - **SET_CHAR_COORDINATES** (642 uses, 116 missions), and its NO_OFFSET and DONT_WARP_GANG forms, now follow
    CRunningScript::SetCharCoordinates: PutToGroundIfTooLow, then the player's vehicle is teleported with him in it
    (its centre of mass GetDistanceFromCentreOfMassToBaseOfModel above the point), or he is. Before, they silently
    did nothing for the player. The group teleport is not modelled.
  - **WARP_CHAR_INTO_CAR** (47 missions) seats the player through CTaskSimpleCarSetPedInAsDriver without the entry
    tasks (CarEntry.warpIn).
  - **WARP_CHAR_FROM_CAR_TO_COORD** (59 missions) sets him out on foot at the point.
  - A player on a bike, boat or plane, or already in another car, still gives the thread up for these.
  - **IS_CHAR_IN_CAR, IS_CHAR_SITTING_IN_CAR, STORE_CAR_CHAR_IS_IN, GET_CAR_CHAR_IS_USING and GET_DRIVER_OF_CAR** now
    name a car the script made by the script's own handle while the player is in it. Before, they always answered
    PLAYER_VEHICLE_HANDLE, so a mission waiting for CJ to get into its car never went on.
- **TASK_FOLLOW_POINT_ROUTE** (120 uses, 21 missions): CTaskComplexFollowPointRoute with its constructor defaults.
  - The task copies the CPointRoute as it stands when the task is made, including inside a sequence.
  - Each point is a CTaskSimpleGoToPoint at a 0.5 radius, with no stand at the last.
  - The modes follow GetSubTaskType: once, there and back (RETURN), back and forth for ever, or round again for ever.
  - EXTEND_ROUTE now stops at CPointRoute's eight points (Route::AddUnlessFull); it used to grow without bound.
  - This works for script peds and for the player.
- **TASK_GOTO_CHAR** (8 missions): CTaskComplexSeekEntity to within the radius of a ped or the player, running and
  walking inside 2 units.
  - Once there it turns to face the target (bFaceEntityWhenDone) and is over.
  - It also ends when the time runs out or the target is gone.
  - The node route it takes over longer distances is a straight line here.
- **TASK_GO_TO_COORD_ANY_MEANS** (17 missions) on foot as the go-to-point task. The vehicle
  CTaskComplexGoToPointAnyMeans would take for a long way is not modelled.
- **TASK_KILL_CHAR_ON_FOOT_TIMED** (14 missions): the kill task with its time.
- **TASK_SCRATCH_HEAD** (15 missions): XPRESSscratch once.
- **TASK_HANDS_UP** (8 missions): HANDSUP held for the task's time, then let go.
- **More of the ped commands a script gives the player.** These used to give the thread up for scplayer, or did
  nothing:
  - GET_CHAR_HEADING (13 missions) reads his heading.
  - SET_CHAR_HEADING (117 missions) now turns him on foot, through CPed::SetHeading's current and aiming rotation.
    Before, it was a no-op kept from when the script never moved the player. MAIN's own SET_CHAR_HEADING 262 after
    CREATE_PLAYER now faces him as the original does at the start.
  - SET_CHAR_AMMO and ADD_AMMO_TO_CHAR are CPed::SetAmmo and GrantAmmo on the weapons he holds.
  - HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE (34 missions) hides his held weapon.
  - FREEZE_CHAR_POSITION (17 missions) holds him still on the pad.
  - IS_CHAR_IN_WATER, IS_CHAR_IN_AIR and IS_CHAR_PLAYING_ANIM answer for him.
  - SET_CHAR_AREA_VISIBLE (30 missions) keeps his area code; the browser draws him in any area.
  - SHUT_CHAR_UP_FOR_SCRIPTED_SPEECH (33 missions) and the facial-talk pair (28 missions) have nothing to act on,
    since his speech lines are not played.
- **SET_CHAR_PROOFS on the player** (16 missions): physicalFlags' five proofs, applied through CPhysical::
  CanPhysicalBeDamaged's reversed mapping (combat/nativePhysicalProofs.ts):
  - the melee weapons fall to melee proofing;
  - the bombs, rockets, satchels and WEAPON_EXPLOSION to explosion proofing;
  - the molotov and flamethrower to fire proofing;
  - the guns and WEAPON_UZI_DRIVEBY to bullet proofing;
  - a car ramming or running him over, and falls (WEAPON_FALL), to collision proofing;
  - tear gas, the spray can and drowning always get through.
  Before, the command gave the thread up.
- **POINT_CAMERA_AT_CAR and POINT_CAMERA_AT_CHAR** (18 and 11 missions): CCamera::TakeControl on the entity.
  - A request from the script yields to a cutscene's unless the cinema camera is on.
  - MODE_NONE means the entity's own follow or on-a-string camera.
  - The restores and TakeControlNoEntity drop the entity.
  - In fixed mode (56 of the scripts' 58 uses) the camera stays at SET_FIXED_CAMERA_POSITION and looks at the
    entity where it is each frame.
  - The two on-a-string uses get a chase point behind and above the entity in place of CCam's follow mode.
- **CLEAR_AREA inside a mission** now clears (CWorld::ClearExcitingStuffFromArea through the host). MAIN's own sweeps
  are still only counted, for the ordering reason noted above: a thread knows it is a mission by its mission
  cleanup.
- **CLEAR_AREA_OF_CARS and CLEAR_AREA_OF_CHARS** (10 and 8 missions): CWorld::ClearCarsFromArea and
  ClearPedsFromArea over the box.
  - The deletable cars and peds go: not the player's car, not locked, not a mission car; not a mission ped or a
    member of the crew.
  - Script cars are now marked as mission cars (VehicleCreatedBy MISSION_VEHICLE). Before, only being locked kept
    them out of the clears, and a script that unlocked its car could have it swept away.
- **MARK_CAR_AS_NO_LONGER_NEEDED** follows CTheScripts::CleanUpThisVehicle: the car is a random, unlocked one again,
  off its script mission.
- **SET_CAR_TEMP_ACTION** (13 missions): the temporary action on a script car for its time.
- **EXPLODE_CHAR_HEAD** (8 missions): the reversed handler's CEventDamage with WEAPON_SNIPERRIFLE on PED_PIECE_HEAD,
  1000 through the damage response, from no one. It kills the ped whatever its health.
- These now keep their state rather than giving the thread up, though nothing in the browser reads it yet:
  - SET_PLAYER_GROUP_TO_FOLLOW_ALWAYS (15 missions; CPlayerPed::ForceGroupToAlwaysFollow);
  - SET_CHAR_IS_TARGET_PRIORITY (13) and SET_CHAR_CAN_BE_KNOCKED_OFF_BIKE (14), as the ped's flags;
  - SET_HELI_BLADES_FULL_SPEED (15), SET_CAR_STATUS (10) and SET_CAR_TRACTION (9) on the car. CAutomobile's
    m_fCarTraction is only read for STATUS_PHYSICS cars, and gta-reversed's reading of that line is doubtful.
- **TASK_USE_MOBILE_PHONE** (56 uses, 23 missions and MAIN; 17 of them on the player): CTaskComplexUseMobilePhone,
  a secondary task, so it takes neither the primary task nor the task record. The task is unreversed, so this is
  what it shows:
  - the ped.ifp PHONE_IN clip on the upper body, with the cellphone model (330) in the right hand;
  - PHONE_TALK looped while the call lasts, coming back after anything that takes the upper body for a moment;
  - PHONE_OUT when the script puts it away, after which the phone goes.
  The legs keep walking meanwhile. The player's held weapon is hidden while the phone is out. Script peds carry
  one the same way.
- **TASK_TOGGLE_DUCK and TASK_DUCK** (34 and 15 missions): CTaskSimpleDuckToggle crouches or stands the ped and is
  over at once. CTaskSimpleDuck holds it ducked where it stands for the task's time.
  - Street and script peds now carry CTaskSimpleDuck's ped.ifp clips (WEAPON_crouch and GunCrouchFwd), so a ducked
    ped shows the crouch.
  - On the player the toggle is his own crouch.
- **CLEAR_AREA from the INTRO mission** is counted like MAIN's, not acted on. MAIN launches INTRO with the new game,
  and it clears 500 units round Grove Street. Acting on it emptied the street the browser had already populated
  (a fleeing ped vanished mid-run), which is the same ordering difference as MAIN's own opening sweep.
- **The setter tasks**, each of which sets something on the ped and is over at once, so a sequence goes straight on:
  - TASK_LOOK_AT_COORD (11 missions): CTaskSimpleTriggerLookAt at a point.
  - TASK_TOGGLE_PED_THREAT_SCANNER (11): its three switches are kept on the ped; the threat scan itself is not
    modelled.
  - TASK_SET_CHAR_DECISION_MAKER (9): the decision maker's actual index, as SET_CHAR_DECISION_MAKER gives it.
  - TASK_KINDA_STAY_IN_SAME_PLACE (8): the ped's bKindaStayInSamePlace.
- **TASK_SHOOT_AT_COORD, TASK_AIM_GUN_AT_COORD, TASK_AIM_GUN_AT_CHAR and TASK_SHOOT_AT_CHAR** (26, 9, 13 and 8
  missions): CTaskSimpleGunControl for the task's time.
  - The ped stands, faces the point or ped (the player included) and aims.
  - The shoot tasks fire through the port's own ped gun: the weapon's rate, reloads, dispersion and ammo count.
  - It ends with its time or when its target is dead or gone. An unarmed ped has no gun to control, so the task is
    over at once.

### TASK_GO_TO_COORD_WHILE_SHOOTING (CTaskComplexGoToPointShooting)

- The ped walks (or runs, by the script's move state) to the point and stops inside the stop radius. Meanwhile its gun
  is on the target ped and it fires by its weapon's own rate. Its heading stays on the path: no strafing, since the
  body faces where it walks and the arms aim.
- The task ends at the point. GET_SCRIPT_TASK_STATUS then reads FINISHED_TASK (7). If the target dies on the way, the
  ped stops firing and keeps walking.

### TASK_FOLLOW_PATH_NODES_TO_COORD (CTaskComplexFollowNodeRoute)

- The script's form uses the constructor defaults: target tolerance 0.5, slow-down distance 3, height-change threshold
  2 and blending on. With blending on, CalcGoToTaskType never runs, so the ped does not slow for corners. The port
  models none, which matches.
- ComputePathNodes:
  - The target is put a unit above the ground under it.
  - A target within 30 units (CPedIntelligence::m_FollowNodeThresholdDistance) with a clear wander path is walked
    straight at. Otherwise the route is CPathFind::ComputeRoute over the ped nodes, eight nodes at most.
  - The route is dropped when its first node lies 3 units past the target (50 when the heights differ by 2 or more).
  - The route is cut at the first node (raised a unit) from which the target is straight and clear.
- The unreversed pieces have stand-ins:
  - ComputeRoute: a Dijkstra search by link length between the ped nodes nearest each end, in the same flood-fill group.
  - IsWanderPathClear: no fixed geometry across the line, and ground found at four steps, each within the height
    change of the last.
- Legs between nodes are CTaskSimpleGoToPoint (radius 0.5, the task's move state). The last leg to the target is
  CTaskComplexGoToPointAndStandStill, walking inside the slow-down distance.
- When eight nodes fill the route, the target does not fit. Reaching the last node plans the next stretch (SetTarget
  with bForce).
- A timed task that runs out teleports the ped onto the target, and the task ends.
- A MAP_Z_LOW_LIMIT target has its ground looked for from above the ped.

### TASK_CHAT_WITH_CHAR (CTaskComplexChat)

- The script handler is unreversed. The command is taken to build CTaskComplexChat from its lead-speaker flag and its
  last operand as the stage (every mission passes 1), with no speech context, so nothing is said.
- CreateFirstSubTask: the listener stands (CTaskSimpleStandStill, 999999 ms). The lead speaker chats (CTaskSimpleChat:
  IDLE_chat looped for the same time).
- ControlSubTask, as reversed:
  - A partner that is gone ends the task.
  - Either ped finishes when the partner's chat is at an earlier stage, or when the partner has the same part and has
    not finished.
  - A lead speaker who is not talking finishes both chats at once when the partner listens. Otherwise it gives up after
    fifty silent frames.
- Script peds play no speech, so a chat between two of them ends a frame after both have it, and the mission's
  sequence moves on (the rap loops in the lowrider meeting).
- With the player as the partner (he holds no chat task), the speaker gives up after its silent frames, and a listener
  keeps listening.

### MAIN's query batch: hydraulics, low riders, dirt, taxis, jetpack, penalties, decision makers, object models

- DOES_CAR_HAVE_HYDRAULICS reads handlingFlags.bHydraulicInst. SET_CAR_HYDRAULICS fits the upgrade, or removes it and
  puts the suspension lines back where the handling set them (RemoveVehicleUpgrade is unreversed).
- IS_CAR_LOW_RIDER reads handlingFlags.bLowRider (0x2000000), as handling.cfg sets it for the Voodoo, Savanna, Broadway
  and the rest.
- SET_VEHICLE_DIRT_LEVEL sets m_fDirtLevel, clamped to the 0-15 the dirt blend reads.
- IS_CHAR_IN_TAXI compares the model of the car the ped is in (the player's own included) with the Cabbie and the Taxi.
- IS_PLAYER_USING_JETPACK reports whether the player has the jetpack on.
- SWITCH_DEATH_PENALTIES and SWITCH_ARREST_PENALTIES set CGameLogic's bPenaltyForDeathApplies and
  bPenaltyForArrestApplies.
- DOES_DECISION_MAKER_EXIST and GET_OBJECT_MODEL are answered from the runtime's own pools. A named model reads back as
  the script's negative used-object id, which is what the script compares it with.
