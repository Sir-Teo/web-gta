# Bringing in the rest of the missions

Where the port stands, and a plan for making every story mission playable from start to Mission Passed. The
numbers come from the census (`npm run port -- census`, [CENSUS.md](CENSUS.md)) and the sweep
([STATUS.md](STATUS.md)).

## Where it stands

- The script runs live: MAIN.SCM, its missions and streamed scripts use 1,570 distinct commands. The static census
  classifies 1,318 as faithful to their cited source (2026-10-21); this is a source classification, not proof of playability.
- 53 commands are skipped: their engine side is not ported (remote control, some attractor tasks, movable vehicle
  parts and other mission-specific features), so the command does nothing and the mission goes on (step 1). One command
  still stops its thread, TASK_USE_CLOSEST_MAP_ATTRACTOR, and only in the interior attractor brains, which the port
  does not start yet.
- 18 commands are authored stand-ins and 1 does nothing yet. They let a mission go on, but it may play differently.
- The headless sweep teleports CJ to whatever point the mission waits for. Until now it also moved the homies and
  their bikes and cars, which hid missions a player could not finish because an NPC never drove or rode to the
  point. `SWEEP_PLAYER_ONLY=1` now moves CJ alone, so those missions show up as waiting.

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
   ([source and limits](../research/AIRCRAFT_DOGFIGHT.md)); AI aircraft guns and missiles still need integration.
   Use the refreshed census queue for the remaining commands: remote-control vehicles are the next concentrated
   group (ZERO2, ZERO4 and ZERO5), followed by the interior attractor tasks and movable vehicle parts. The list
   above records the original wave plan, rather than commands still skipped.

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
