# Bringing in the rest of the missions

Pool balls consume the original table coordinates, retain staged shots, collide, rebound
and enter pockets. The normal bar flow now accepts a mouse-driven shot and the opponent
responds, live pockets are scored, and the player can acknowledge the result, place
the cue ball after a foul and aim again. A complete single-player match now reaches
its result, rematch wager and refunded quit ([coverage](../research/POOL_MATCH.md)).
Multiplayer remains skipped. See [pool evidence](../research/POOL_BALLS.md) and
[input/shot coverage](../research/SCRIPT_MOUSE_MOVEMENT.md).

Where the port stands, and a plan for making every story mission playable from start to Mission Passed. The
numbers come from the census (`npm run port -- census`, [CENSUS.md](CENSUS.md)) and the sweep
([STATUS.md](STATUS.md)).

## Where it stands

- The script runs live: MAIN.SCM, its missions and streamed scripts use 1,570 distinct commands. The static census
  classifies 1,343 as faithful to their cited source (2026-10-22); this is a source classification, not proof of playability.
- 7 commands are skipped: their engine side is not ported (some attractor tasks and other mission-specific features), so the command does nothing and the mission goes on (step 1). No original command is classified as stopping its thread. Named map-attractor handoffs now approach a
  published effect and start its registered brain; procedural interior population remains partial.
  Object-brain map identities now survive streamed placement reordering, with source-key
  lookup for hide/take operations ([contract](../research/OBJECT_BRAIN_STREAMING.md)).
- 40 commands have authored or partial coverage and 1 does nothing yet. They let a mission go on, but it may play differently.
- The headless sweep teleports CJ to whatever point the mission waits for. Until now it also moved the homies and
  their bikes and cars, which hid missions a player could not finish because an NPC never drove or rode to the
  point. `SWEEP_PLAYER_ONLY=1` now moves CJ alone, so those missions show up as waiting.

Script text now uses the packaged PC atlases and captured ASCII layout rules, and script sprites draw their native
artwork. All 21 referenced main/streamed dictionaries are published. OTB has a complete keyboard-driven bet/race/exit
regression with checked payout and statistics ([source and limits](../research/SCRIPT_SPRITES.md)); that minigame
flow does not establish full casino coverage or campaign completion.

## The plan, in order of payoff

1. **Stop no mission outright (one change, all missions; done).** Replace "the thread gives up" with "the command is
   skipped and logged". An action command with no output becomes a no-op. A condition gets a fixed answer chosen per
   command (for example, `DOES_SEARCHLIGHT_EXIST` answers false). A command that returns a handle or value writes
   `-1` or `0` into its output variables. The output parameters come from the Sanny Builder library, which the census
   already downloads; `node scripts/port/signatures.mjs` turns it into `src/engine/scmCommandSignatures.ts`. The
   census now reports these commands as `skipped` instead of `stops`, and the sweep lists what each mission skipped.
   Missions run on to their end with the skipped features missing, instead of stopping at the first one. This is the
   one step that brings in every mission at once; the steps below fill in what is skipped.
2. **Make the sweep play like a player.** With `SWEEP_PLAYER_ONLY=1`, a mission that waits on an NPC's car, bike or
   foot task shows up as stuck at that task. The next step is to drive CJ's own vehicle with the port's car AI
   (`ScriptCarMissions.gotoCoords` on the player's car) instead of teleporting him. Chases and escorts then get
   exercised the way a player's would, and the sweep's "reached" column becomes a real playability score.
3. **Port the command families in waves, by how many missions each unblocks.** The census groups them. Each
   family is small, self-contained and testable, so it suits parallel agents, one family and its spec per agent:
   - searchlights (CREATE_SEARCHLIGHT, ATTACH_…, POINT_…, MOVE_…, DELETE_…; 7 commands, DRUGS4, WUZI2 and more)
   - helicopter and plane autopilots (HELI_GOTO_COORDS, PLANE_GOTO_COORDS, HELI_FOLLOW_ENTITY, SET_PLANE_THROTTLE,
     PLANE_STARTS_IN_AIR, SET_PLANE_UNDERCARRIAGE_UP; 12+ missions)
   - vehicle attachment (ATTACH_CAR_TO_CAR, DETACH_CAR, IS_TRAILER_ATTACHED_TO_CAB, MARK_CAR_AS_CONVOY_CAR)
   - cranes and ropes (ENABLE_CRANE_CONTROLS, GRAB_/RELEASE_ENTITY_ON_ROPE, SET_ROPE_HEIGHT)
   - races and records (REGISTER_FASTEST_TIME, SET_BOAT_CRUISE_SPEED, CPRACE's checkpoint commands)
   - camera attachments (ATTACH_CAMERA_TO_VEHICLE…, which gta-reversed has reversed)

   These families now have engine implementations, including searchlights, aircraft navigation and pursuit,
   vehicle attachments, crane ropes and helicopter winches. MANSIO2's dogfight steering was added on October 21
   ([source and limits](../research/AIRCRAFT_DOGFIGHT.md)); AI plane guns and missiles are now integrated ([source and limits](../research/AIRCRAFT_WEAPONS.md));
   helicopter attack guns and unguided rockets now have native captures and a
   controlled live flight check ([scope](../research/HELICOPTER_AI_WEAPONS.md)).
   Interdiction's original passenger warp now seats CJ in its recorded Cargobob,
   preserves AI/playback and follows the aircraft without assigning pilot controls.
   Seat queries, cleanup and the aircraft passenger camera have controlled live
   coverage ([scope](../research/AIRCRAFT_PASSENGERS.md)).
   Complete aircraft combat missions and police-specific helicopter weapons still need work.
   Remote-control acquisition, separate input/camera/streaming focus, delayed hand-back and detonation switches
   are now integrated ([source and checks](../research/REMOTE_CONTROL.md)). ZERO2 has no skipped commands in the
   census; its opening, native roof placement and RC input handoff pass a focused browser check.
   A controlled RC-gun regression now kills all five original couriers and reaches the original $5,000 reward
   and delayed cleanup; uninterrupted flight and complete NPC combat parity remain unverified
   ([coverage](../research/ZERO2_VALIDATION.md)). Bike/boat collision follows remote focus
   ([scope](../research/REMOTE_VEHICLE_FOCUS.md)). SET_HELI_STABILISER reaches the native flight controller
   ([evidence](../research/HELICOPTER_STABILISER.md)).
   Population loading and retirement now share the remote world centre. A live
   return check retains released vehicles and ordinary traffic/peds near the RC
   focus, then retires the vehicles after hand-back
   ([evidence](../research/REMOTE_POPULATION_FOCUS.md)).

   Air Raid's original defence now reaches `ZERO_1`, its $3,000 reward and cleanup
   with controlled minigun aim and its full native timer. Player shooting and
   reciprocal partner conversations cover the two exposed result-sequence gaps
   ([coverage and limits](../research/ZERO1_VALIDATION.md)).

   ZERO4 now has a current-pose COL query ([contract](../research/OBJECT_WORLD_INTERSECTION.md)) and oil-puddle
   removal in the permanent-shadow pool ([native checks](../research/REMOVE_OIL_PUDDLES.md)). It has no static
   skipped commands. Its doorless arena now loads with native floor collision, and the original magnet
   picks up, carries and drops its barrel through real physics
   ([evidence](../research/ZERO4_VALIDATION.md)). Controlled original plank placement
   sets both bridge flags, and the original bomb explosion reduces a tank to zero
   health. The extended controlled fixture now reaches the original Bandit goal,
   ZERO_4, $7,000 and a grounded, visible return outside Zero's shop. Manual/
   uninterrupted flight and complete enemy-AI parity remain unverified.
   APPLY_FORCE_TO_CAR now reaches every vehicle family with captured native
   effective-mass/COM math ([scope](../research/SCRIPT_VEHICLE_FORCE.md)).

   Train station skipping applies directional selection, city locks and clock advancement; track initialization
   also uses native station marks and quantized distances ([evidence](../research/TRAIN_STATION_SKIP.md)). ZERO5's
   forced model reaches civilian traffic and resets with mission cleanup ([evidence](../research/FORCED_RANDOM_CAR_MODEL.md)).

   Movable loader parts have native angle and COL transforms on four car models, with partial family coverage kept
   in the authored queue ([scope](../research/MOVABLE_VEHICLE_PARTS.md)). The cement mixer and fire ladder have their
   component drawing; scripts can also create Andromada and control its cargo ramp. DECON's quaternion setter handles its
   non-unit input with explicit physical integration limits ([details](../research/VEHICLE_QUATERNION.md)).
   FINALEC's raw door-angle query now reads the fire ladder's swinging state and its native pitch/sway drawing
   ([evidence](../research/DOOR_ANGLE_AND_LADDER.md)). Use the refreshed queue for the remaining interior attractor
   tasks and vehicle-specific features. The list above records the original wave plan rather than commands still skipped.

   SYND4's skylight entrance and club cutscene pass a focused check using the real ENEX transition
   ([evidence](../research/SYND4_VALIDATION.md)); its full chase remains unverified. STUNT's script shadow is
   drawn with partial shared-slot integration ([scope](../research/SCRIPT_SHADOWS.md)), and WUZI5's scripted
   large-smoke particles reach the existing native FX system ([evidence](../research/SCRIPT_SMOKE_PARTICLE.md)).
   MAF4 and DES10 now give CJ a scripted jetpack with task status and native script-interruption rules; NPC
   coverage remains unported and the command stays authored ([scope](../research/SCRIPT_JETPACK.md)).
   RIOT2's gunshot override now changes mission-ped hearing and restores each ped's ordinary sense range;
   ambient hearing retains its native radius ([evidence](../research/RIOT2_GUNSHOT_RANGE.md)).
   BURGJB can query liftable objects in the live script table, with native distance and buffer rules; full
   world-sector coverage remains partial ([scope](../research/CLOSEST_STEALABLE_OBJECT.md)).
   TWAR7's group-sequence setter now preserves the native resolved-slot contract; the native group routine does
   not issue the recorded sequence from that field ([trace](../research/GROUP_SEQUENCE.md)).
   QUARRY's scorched-object flag selects fixed ambient lighting for both live objects and adopted map placements,
   with independent materials and fade restoration ([evidence](../research/OBJECT_SCORCHED.md)).
   CASINO6's scripted resurrection now restores CJ in place and advances twelve hours through the shared
   restoration path; population/reference integration remains partial ([scope](../research/RESURRECTION_RESET.md)).
   HEIST2's ATM task now records into its repeating guard sequence and plays the default clip once, with shared
   animation-runner limits retained ([evidence](../research/SCRIPT_USE_ATM.md)).
   CASINO6's scripted-attractor query now follows arrival and task ownership in the existing authored use path;
   general registration and ambient-user coverage remain partial ([scope](../research/SCRIPT_ATTRACTOR_QUERY.md)).
   POOL2's object draw-last flag now selects the later sorted render pass with native alpha/depth policy,
   retaining fade and scorched state; shared-list coverage remains partial ([scope](../research/OBJECT_DRAW_LAST.md)).
   Vehicle deaths now carry scorched lighting through player, script-occupant and street-corpse rendering and clear
   it on revival; event/death-task integration remains partial ([scope](../research/PED_SCORCHED.md)).
   SYN6's vehicle targeting flag now gates occupant selection through the touch picker, independently of bullets
   and heat-seeking missiles; full native target scanning remains partial ([scope](../research/VEHICLE_PED_TARGETING.md)).
   Scripted weapon immunity and last-attacker storage now reach bikes, boats and aircraft as well as cars;
   native captures and live shots cover those gates ([evidence](../research/VEHICLE_DAMAGE_GATES.md)).
   Scripted NPC attacks now resolve those non-car bodies, test sight against the actual target and dispatch
   ordinary NPC bullet damage with its creator; complete task behavior remains partial
   ([coverage](../research/SCRIPT_VEHICLE_ATTACK_TARGETS.md)).
   Whole-pool damage toggles, player-safety restoration and nearby vehicle fire cleanup now reach every
   supported vehicle class ([coverage](../research/GLOBAL_VEHICLE_DAMAGE.md)).
   Delayed motorbike, boat and aircraft destruction now respects immunity and clears recovered health on
   accepted destruction; aircraft death queries retain native wrecked status independently of health
   ([captured behavior](../research/VEHICLE_DESTRUCTION_GATES.md)).
   SYN6's original combat, crash stage, mission-passed registration, $18,000 reward and cleanup pass a
   controlled checkpoint browser regression; its uninterrupted drive and chase remain unverified
   ([coverage](../research/SYN6_VALIDATION.md)). Scripted dives now use the installed root-motion
   curve for CJ and NPCs, with the player's initial turn and post-pause turn ([scope](../research/SCRIPT_DIVE_MOTION.md)).
   CASINO1's attachment dive now turns an NPC aboard, detaches at its offset and runs its ten-second dive/recovery
   task. Player and object-attachment cases remain unsupported ([scope](../research/ATTACHED_DIVE.md)).
   Its die-and-detach path also keeps the corpse allocated and dead through the browser's body rebuild, including
   explosion scorch state; full native corpse/animation state remains partial ([scope](../research/SCRIPT_PED_DEATH_REBUILD.md)).

   Corpse hits follow the death clip's actual completion even when medical treatment refreshes removal time;
   full native death-task state remains partial ([scope](../research/CORPSE_HIT_CLOCK.md)).
   DECON's excavation swaps now replace the selected IPL building's model and COL, support restoration and retain
   text-IPL changes through streaming; native resource and save/undo behavior remain partial ([scope](../research/BUILDING_MODEL_SWAPS.md)).

   OTB and POOL2 now measure script text with native font metrics, current text style, resolved control names and
   inserted numbers ([scope](../research/SCRIPT_TEXT_WIDTH.md)). Script text also draws the published PC atlas masks
   with those same advances; exact native UVs, complete formatting and icon/language paths remain partial
   ([assets, pixel checks and limits](../research/PC_SCRIPT_FONTS.md)).

   Attached CJ can now fire while his collider is disabled. Ordinary player instant hits apply the native carrier
   exclusion and wheel filtering; full NPC/path coverage remains partial ([scope](../research/ATTACHED_PLAYER_GUNFIRE.md)).

   Frozen cars, bikes, boats and aircraft now hold motion with collision retained and restore their prior body mode
   on release. Both freeze adapters are classified partial until their complete native flags are covered ([scope](../research/FROZEN_VEHICLES.md)).

   MANSIO2's dead-body sight checks now query cached nearest-ped scans with death-animation phases, direction,
   range and world obstruction. Full native task states and occupant coverage remain partial ([scope](../research/DEAD_BODY_SIGHT.md)).

   DESERT9/CASINO2 NPCs can now approach an object's COL box, turn, lift and carry through later sequence tasks.
   Player/occupant forms and complete native physical/task ownership remain partial ([scope](../research/COMPLEX_OBJECT_PICKUP.md)).

   SYN5's paired NPC greeting now coordinates approach, handshake clips and the speaker/listener chat postlude.
   Complete native partner tasks, alignment and hand signals remain partial ([scope](../research/PARTNER_GREET.md)).

   After each wave, run `npm run port -- all story` so the census and sweep confirm what moved.
4. **Unblock by data, not code.** Cutscenes (`anim/cuts.img`) and the music and beat tracks (`AUDIO/STREAMS`) are
   not in the published depot. Mission dialogue and the beat tracks now come from the iOS port's bundle
   (github.com/Google61/gta3sa.app: `SCRIPT.osw`, `BEATS.osw`), which also has `cutscene.img`, `CUTSCENE.osw` and
   the radio stations' packs. The workshops (`models.html`,
   `assets.html`) already read a local copy of the game in the browser. The same folder picker could hand the game
   these archives from the player's own install for the session, without anything being uploaded or published. That
   brings cutscenes and voiced dialogue back for players who own the game, and leaves the published site as it is.
5. **Keep a per-mission play-test.** For each mission, record a scripted play-through as a browser spec: a list of
   player actions (go to, enter car, drive to, shoot at) that `SWEEP_PLAYER_ONLY` has shown to be enough. The spec
   runs that list and asserts Mission Passed. Once a mission passes, its spec keeps it passing.

## What will not come from a translation

gta-reversed is a DLL that hooks the retail executable, and 715 script commands and many engine routines are still
calls into that executable. There is no complete source to translate mechanically. Steps 1 to 3 are how the missing
pieces get filled in: step 1 stops them from blocking, and step 3 replaces them one family at a time.

## Tools for playing and checking like a player

Three tools came out of taking INTRO1 from "passes with teleports" to playable.

- **The objective bot** (`SWEEP_BOT=1`, `npm run port -- sweep 11 --bot`, `tests/browser/missionBot.ts`). SA tells the
  player what to do through the radar. A friendly car blip means get in, a friendly char blip means follow, a
  hostile char blip means kill, and a coordinate blip means go there. The bot reads the script's own blip table each
  tick and does that at a player's pace, moving nobody but CJ. A mission it cannot finish is one a player cannot
  finish either. `SWEEP_WATCH=65,66,67` logs the mission's characters (where they are, what they ride, their drive
  mission, route, recovery and pedals) to show which NPC is not doing its part.
  - First result: with the homies left to ride for themselves, INTRO1 stalled at 32%. The old sweep's "passed" had
    come from teleporting them. The bot runs then found three real faults: a disposed police car read through a
    freed physics body (which froze the whole game; see `rapierTombstones.ts`), homies' BMXs wedging at kerbs and
    against each other through every recovery mode, and bikes beyond the streamed world freezing.
- **The engine census** (`npm run port -- engine`, [ENGINE_CENSUS.md](ENGINE_CENSUS.md)). It is the script census
  for engine code: every function gta-reversed hooks, class by class, how many are reversed there, and which ones
  this port cites by address or `Class::Function`. It is the ranked list for making basic play faithful. The
  gameplay classes (CPed, CTask*, CAutomobile, CPhysical, CWeapon, CCamera, CPad) come first.
- **The gameplay fuzzer** (`FUZZ=1`, `tests/browser/gameplay-fuzz.spec.ts`). It plays random but plausible
  episodes at places across Los Santos: walking, sprint-jumps, crouching, shooting, punching, spawning and driving,
  jacking, falls, grenades and a wanted level. Every second it checks the game's invariants
  (`gameInvariants.ts`): finite positions, nothing under the world, no physics blow-ups, CJ not stuck under a push,
  ped views on their bodies. It also records page errors, subsystem faults and stale physics bodies. Each finding
  comes with its actions and a screenshot, ready to become a spec. This is how edge cases get found without waiting
  for a bug report.

The loop for each mission: run the bot, and when it stalls, read the watch line. Fix the engine fault it points at,
never the bot, then add a spec for the fault and run the bot again.

### INTRO1, played through

INTRO1 now **passes** under the bot (`M_PASSR`, twenty-five minutes headless) with no teleports of anyone but by the
script itself. The bot drives CJ with the game's own `TASK_CAR_DRIVE_TO_COORD`, the task INTRO1 gives the homies,
and backs up with `TASK_CAR_TEMP_ACTION` when wedged. Every stall on the way was an engine fault, fixed where it
lived:

| What the bot saw | The fault | Fix |
|---|---|---|
| A homie dead at the cemetery, health 2000 to 0 at once | A car strike set health to 0 past the kill intensity; `CTaskSimpleKillPedWithCar` deals 1000 | `carStrikesPed` applies the damage; a ped with more gets up |
| CJ never moved on his BMX | The player's scripted drive tasks only looked for a car | `startCarTask` takes the bike he rides |
| Homies' bikes stuck for good, full throttle | A knock left the body rolled; bikes rode on their side | A ridden bike's roll is taken out (`uprightRollRate`) |
| Every bike stopped east of Market Station | A 0.15-0.2 sliver where two collision meshes meet; ball wheels cannot climb what suspension lines ride over | `WorldBike.stepUp` lifts a ridden bike onto a step up to 0.35 |
| Ryder's bike under the world | The collision check under a bike looked 500 units down and found a structure below an unstreamed road | Forty units, every tenth of a second while moving |
| A homie's bike set down into the void | The unstick put cars on lane points outside the streamed window | Only onto loaded collision, looked for from just over the road |
| CJ fell through the hills after a teleport | `SET_CHAR_COORDINATES` to the ground found no collision yet (FindGroundZForCoord's 20) | The ground is found again when the window arrives |
| (fuzzer) The script's teleport gave up with CJ on a bike | Only cars and on foot were handled | Bikes, boats and aircraft move with him |
| (script) `EXPLODE_CAR_IN_CUTSCENE` | Ran the full `BlowUpCar` blast | `BlowUpCarCutSceneNoExtras`: a molotov's fire, no blast |

Three things made these findable: the sweep's watch line (position, vehicle, drive mission, route, recovery,
pedals and tilt of each mission character), the **HURT** trace (a watched ped's health field records the call
stack of every drop, so a death names the code that dealt it), and `SWEEP_SHOTS=1` screenshots. The status table
now has an **Outcome** column read from the mission's own M_PASS/M_FAIL message.

### SWEET1, played through

SWEET1 now **passes** under the bot (`M_PASSS`, twenty minutes headless): Sweet sprays the first wall, CJ sprays his
four, the drive to the Ballas' walls and the drive home. The bot sprays tags (a dev hook lists tags near a point),
drives `STOP_FOR_CARS`, goes round a car left in its lane, and gets out at a place it has sat at for four seconds.

| What the bot saw | The fault | Fix |
|---|---|---|
| Sweet's Greenwood wedged in the side yard at the start | `CREATE_CAR` did not clear its space; the switched-off generator's Greenwood stood where the mission's was made | `CreateCarForScript`'s `ClearSpaceForMissionEntity`; a generator car still loading onto the spot is dropped |
| Sweet stood at the wall for good | The body built when he got out of the car had no weapon, so `TASK_SHOOT_AT_COORD` ended at once | The ped pool keeps `GIVE_WEAPON_TO_CHAR`'s weapon through getting in and out |
| The Greenwood pinned against walls by police cars, no stars | Ambient patrols were never joined to the roads (their paths load only for a dispatch) and drove at the player | `JoinCarWithRoadSystem` for a unit with no link; patrols stop for cars ahead; a car on switched-off road may go on over it |
| The Greenwood ploughed into stopped traffic and burned | Script cars took their cruise speed as the traffic speed in every driving style | `FindMaximumSpeedForThisCarInTraffic` under the stop-for-cars styles |
| The Greenwood reversed away from a red light | The stuck recovery counted a car held on its brake as stuck | Only a car asking for gas can be stuck |

### INTRO2: passes under the bot

INTRO2 drives Ryder to the barber's under the bot (two faults fixed on the way: a vehicle's collision mesh rested on
the road's mesh, which `CCollision::ProcessColModels` never tests triangle against triangle, and Ryder's generator
put a second Picador inside the mission one). Once `gta_int.img` was published (`public/play/world/int/`, see
"Interiors are published" in `docs/FIDELITY_AUDIT.md`) the barber's interior opened, and the 2026-10-01 sweep ran it
to its pass ([STATUS.md](STATUS.md)). CJ's clothes (`player.img`, 66 MB) are still not published, so the haircut and
the clothes and tattoo shops change nothing on him (`docs/GAPS_CHECKLIST.md`).
