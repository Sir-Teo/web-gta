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

## Player input and swimming corrections

- Reproduced a dry-land jump failure through the production game entry screen: the swim task unconditionally cleared `controls.jump`. It now preserves the command outside swimming. The new browser check passes, and existing heavy-weapon/aiming jump restrictions still pass. Inspected the airborne screenshot.
- Corrected the grounded swim timeout from seconds to native time units using `CPed::ProcessBuoyancy` and `CTaskSimpleSwim::ProcessPed`.
- Replaced constant swim breath consumption with the source association-dependent formula. Corrected capacity overshoot and integer drowning-event damage in `CPlayerPed::HandlePlayerBreath`.
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
- The chainsaw keeps its authored cut: melee.dat's CHAINSAW row (50/60/100 at
  frames 14/14/13) is not yet driven, and its cadence while held is in the
  stubbed `ProcessPed`.

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
- The decision-maker files are not in the depot, so the reaction goes to peds
  on the rand_norm and rand_weak makers. rand_tough peds are left alone.
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
- Affected peds still flee, because their real answer lives in the missing
  decision-maker files.
- Verification: a new browser test checks that a shot 50 units away is not
  heard, and that a silenced shot scares a ped facing it but not one behind.
  The weapons, lock-on, combat audio, gang, wanted and street life tests pass.

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
  - The radar tiles come from the prepared San Andreas image, and the blip
    sprites are drawn shapes because `hud.txd` is not in the depot.
  - Only the north, player and waypoint blips are drawn.
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
  - Cars far from the player are not driven on rails (`STATUS_SIMPLE`).
    Beyond 100 units they are suspended, as before.
  - Traffic sees vehicles and pedestrians only: a static obstacle is driven
    into, as in the original. The authored recovery still removes a car
    stalled off screen.
- Verification: unit tests cover lane points, the steering and speed rules,
  the node choice, the slow-downs, cruise speeds and the siren yield.
  Browser tests cover lane keeping, stopping behind a parked car, slowing
  and honking for a pedestrian, the siren swerve, and the Grove Street and
  native-road traffic. A live run shows cars holding their lanes at their
  class cruise speeds and stopping at lights.

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
  plays HIT_GUN_BUTT through the ported ComputeAnim. No round is spent.
  - The browser places the victim's head 0.75 above its body centre instead of
    reading the head bone.
- The crosshair sits where `CCamera::m_f3rdPersonCHairMultX/Y` put it: 0.53 of
  the width and 0.4 of the height. `CHud::DrawCrossHairs` sizes it at
  64 × `GetWeaponRadiusOnScreen` in the 640 × 448 frame, with a dot only at
  the 0.2 minimum. `Find3rdPersonCamTargetVector` fires through that point.
  The sniper scope still aims down the middle.
  - The browser draws a white ring rather than the four siteM16 quarters.
  - The authored green "locked" tint is gone.
- Holding the target button blocks jumping. `PlayerControlZelda` jumps only
  while `GetTarget` is off, and `PlayerControlZeldaWeapon` never jumps.

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
  - A blocked jump (`CTaskSimpleHitHead`) does not launch but plays no
    clip. The climb jump shows the glide clip rather than CLIMB_jump.
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
    contact point. With no SURFINFO.DAT loaded, every surface counts as
    climbable.
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
