# Bringing in the rest of the missions

Where the port stands, and a plan for making every story mission playable from start to Mission Passed. The
numbers come from the census (`npm run port -- census`, [CENSUS.md](CENSUS.md)) and the sweep
([STATUS.md](STATUS.md)).

## Where it stands

- The script already runs: all 1,455 commands of `main.scm` dispatch, 1,010 of them as the reversed source does.
- **244 commands used to stop a mission.** Their handler needs a world member the adapter does not have yet, so the
  mission thread gave up the moment it reached one (searchlights, cranes, ropes, helicopter and plane autopilots, car
  attachments, races). Only 37 of them have a reversed handler in gta-reversed; 189 are absent there.
- 23 commands are authored stand-ins and 8 do nothing yet. They let a mission go on, but it may play differently. The 244 are now skipped instead (step 1).
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

   After each wave, run `npm run port -- all story` so the census and sweep confirm what moved.
4. **Unblock by data, not code.** Cutscenes (`anim/cuts.img`), mission dialogue (`AUDIO/SFX/SCRIPT`) and the
   music and beat tracks (`AUDIO/STREAMS`) are not in the published depot. The workshops (`models.html`,
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
