# Script boat propeller and engine audio

Script-driven boats already used CAutoPilot steering and native boat drive,
but WorldBoat advanced propeller speed only with CJ aboard. The vehicle-audio
adapter also forced every unoccupied boat to abandoned status with its engine
off. A moving mission boat consequently retained zero propeller speed and
never started the existing native engine loop.

In gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`,
CBoat::ProcessControl (PC `0x6F1770`) applies its propeller update to
STATUS_PLAYER, STATUS_REMOTE_CONTROLLED and STATUS_PHYSICS. Other statuses
decay a positive speed by 0.95. CAEVehicleAudioEntity::ProcessBoatEngine
(`0x5003A0`) checks the vehicle's engine-on flag and wrecked state; it does
not require CJ to be the driver. Player occupancy only selects pad inputs.

WorldBoat now includes its existing script physics status in the propeller
branch. Engine-off physics boats still approach the pedal's target, as that
branch is independent of the engine flag. The audio adapter passes physics
status and the pilot's engine flag, retaining player/wrecked precedence and
separate pad inputs. Existing propeller constants, float arithmetic, update
cadence, bank/volume/frequency formulas and navigation behavior are retained.

The script-side go/stop state already follows the inspected iOS handlers:
BOAT_GOTO_COORDS `0x1001d5f30` and BOAT_STOP `0x1001d5f80`. Navigation enables
the engine, stop disables it, and both select physics status. Stopping sets
cruise speed zero; a later navigation call raises it to one, rather than
restoring the initial ten. This repair keeps those transitions.

## Checks

Twelve new propeller/audio-adapter cases initially expose six failures. They
cover forward/reverse/idle physics boats, stopped engine-off physics boats,
abandoned/nonphysical/wrecked decay, script audio flags, stopped/wrecked
silence and player precedence. A native sound-engine integration also fails
before repair at zero propeller speed. It now starts the actual engine loop,
raises its frequency, and ends it on BOAT_STOP with CJ absent. All 66 focused
checks and the build pass.

The live fixture uses the real SCM CREATE_CAR, BOAT_GOTO_COORDS and BOAT_STOP
adapters with a Speeder (452). Both its native bank 21 and sound type 2 are
observed. CJ remains outside and the audio entity reports no player driver:

| State | Propeller speed | Engine loop | Script engine flag |
| --- | ---: | --- | --- |
| Parked | 0 | Off | No pilot |
| Navigating | 0.2452 | On | On |
| Stopped | 0.0883 | Off | Off |
| Restarted | 0.1864 | On | On |
| Stopped again | 0.0662 | Off | Off |

All five states pass without page errors. The existing player-driven engine
and water-skimming regression passes too. All 6,260 unit tests pass (51
skipped), together with final TypeScript validation and the build. Normal
production smoke passes saved-game return, walking, car entry, map/waypoint,
pause/resume, Rustler takeoff and gear with zero page errors or failed
requests and no development inspection hook.

This establishes the status/flag wiring and real engine lifecycle. It does
not establish exact PC captures, complete native boat dynamics, AI temporary
actions/recovery, complete engine ownership after every entry/exit, drowning
or all passenger/audio behavior. Retained propeller arithmetic and browser
cadence remain separate compatibility work.
