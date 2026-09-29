# Port status

Census 2026-09-29 (gta-reversed `4b38d8a486`); sweep 2026-09-29, 900 s a mission.

Per mission: what the static census flags, and what the headless sweep saw. **Reached** is the furthest instruction the mission thread was seen at, as a share of its block; **Stopped** names a command the port gave up on or a page error; **Waiting** is where the autopilot could not take it further (a chase, a fight, a menu). See [the census](CENSUS.md) for every command and [README](README.md) for the pipeline.

| # | Mission | Authored | Silent | Stops | Swept | Reached | Ended | Stopped | Waiting on |
|---|---|---|---|---|---|---|---|---|---|
| MAIN | MAIN | 22 | 85 | 27 |  |  |  |  |  |
| 0 | INITIAL | 28 | 0 | 0 |  |  |  |  |  |
| 1 | INITIL2 | 0 | 0 | 0 |  |  |  |  |  |
| 2 | INTRO | 22 | 6 | 0 | yes | 91.8% | yes |  |  |
| 3 | NONE | 0 | 1 | 0 |  |  |  |  |  |
| 4 | DUAL | 0 | 1 | 0 |  |  |  |  |  |
| 5 | SHTR | 0 | 2 | 0 |  |  |  |  |  |
| 6 | GRAV | 0 | 2 | 0 |  |  |  |  |  |
| 7 | OTB | 0 | 1 | 3 |  |  |  |  |  |
| 8 | POOL2 | 14 | 3 | 16 |  |  |  |  |  |
| 9 | LOWR | 2 | 3 | 0 |  |  |  |  |  |
| 10 | ZERO5 | 1 | 1 | 10 |  |  |  |  |  |
| 11 | INTRO1 | 12 | 30 | 0 | yes | 80.2% | yes |  |  |
| 12 | INTRO2 | 6 | 29 | 0 | yes | 20% | no |  | 3357 IS_CAR_DEAD, PRINT_NOW, IS_CHAR_DEAD, PRINT_NOW |
| 13 | SWEET1 | 7 | 32 | 0 |  |  |  |  |  |
| 14 | SWEET1B | 2 | 38 | 0 |  |  |  |  |  |
| 15 | SWEET3 | 8 | 47 | 0 |  |  |  |  |  |
| 16 | SWEET2 | 3 | 43 | 0 |  |  |  |  |  |
| 17 | SWEET4 | 1 | 6 | 0 |  |  |  |  |  |
| 18 | HOODS5 | 0 | 12 | 0 |  |  |  |  |  |
| 19 | SWEET6 | 6 | 22 | 0 |  |  |  |  |  |
| 20 | SWEET7 | 0 | 9 | 0 |  |  |  |  |  |
| 21 | CRASH4 | 7 | 8 | 0 |  |  |  |  |  |
| 22 | CRASH1 | 5 | 14 | 1 |  |  |  |  |  |
| 23 | DRUGS3 | 3 | 12 | 0 |  |  |  |  |  |
| 24 | GUNS1 | 12 | 96 | 5 |  |  |  |  |  |
| 25 | RYDER3 | 14 | 33 | 3 |  |  |  |  |  |
| 26 | RYDER2 | 26 | 86 | 2 |  |  |  |  |  |
| 27 | TWAR7 | 5 | 64 | 13 |  |  |  |  |  |
| 28 | SMOKE2 | 2 | 24 | 0 |  |  |  |  |  |
| 29 | SMOKE3 | 5 | 68 | 2 |  |  |  |  |  |
| 30 | DRUGS1 | 4 | 67 | 26 |  |  |  |  |  |
| 31 | MUSIC1 | 7 | 8 | 8 |  |  |  |  |  |
| 32 | MUSIC2 | 4 | 25 | 3 |  |  |  |  |  |
| 33 | MUSIC3 | 27 | 39 | 20 |  |  |  |  |  |
| 34 | MUSIC5 | 6 | 21 | 0 |  |  |  |  |  |
| 35 | CPRACE | 2 | 7 | 21 |  |  |  |  |  |
| 36 | CESAR1 | 0 | 4 | 0 |  |  |  |  |  |
| 37 | DRUGS4 | 8 | 121 | 59 |  |  |  |  |  |
| 38 | LA1FIN2 | 4 | 13 | 0 |  |  |  |  |  |
| 39 | BCRASH1 | 0 | 1 | 1 |  |  |  |  |  |
| 40 | CATALIN | 0 | 4 | 0 |  |  |  |  |  |
| 41 | CAT1 | 1 | 138 | 1 |  |  |  |  |  |
| 42 | CAT2 | 10 | 14 | 5 |  |  |  |  |  |
| 43 | CAT3 | 4 | 13 | 5 |  |  |  |  |  |
| 44 | CAT4 | 2 | 87 | 1 |  |  |  |  |  |
| 45 | CATCUT | 0 | 6 | 0 |  |  |  |  |  |
| 46 | TRUTH1 | 3 | 41 | 0 |  |  |  |  |  |
| 47 | TRUTH2 | 2 | 31 | 16 |  |  |  |  |  |
| 48 | BCESAR4 | 1 | 0 | 2 |  |  |  |  |  |
| 49 | GARAG1 | 11 | 26 | 5 |  |  |  |  |  |
| 50 | DECON | 5 | 32 | 13 |  |  |  |  |  |
| 51 | SCRASH3 | 5 | 18 | 11 |  |  |  |  |  |
| 52 | SCRASH2 | 0 | 1 | 5 |  |  |  |  |  |
| 53 | WUZI1 | 2 | 18 | 3 |  |  |  |  |  |
| 54 | FARLIE4 | 3 | 8 | 1 |  |  |  |  |  |
| 55 | DRIV6 | 2 | 9 | 8 |  |  |  |  |  |
| 56 | WUZI2 | 9 | 1 | 29 |  |  |  |  |  |
| 57 | WUZI5 | 10 | 45 | 7 |  |  |  |  |  |
| 58 | SYN1 | 1 | 9 | 1 |  |  |  |  |  |
| 59 | SYN2 | 2 | 90 | 0 |  |  |  |  |  |
| 60 | SYN3 | 3 | 17 | 1 |  |  |  |  |  |
| 61 | SYND4 | 1 | 14 | 5 |  |  |  |  |  |
| 62 | SYN6 | 4 | 8 | 5 |  |  |  |  |  |
| 63 | SYN7 | 4 | 46 | 3 |  |  |  |  |  |
| 64 | SYN5 | 5 | 35 | 14 |  |  |  |  |  |
| 65 | DRIV2 | 13 | 1 | 4 |  |  |  |  |  |
| 66 | DRIV3 | 2 | 56 | 2 |  |  |  |  |  |
| 67 | STEAL1 | 13 | 8 | 1 |  |  |  |  |  |
| 68 | STEAL2 | 12 | 25 | 14 |  |  |  |  |  |
| 69 | STEAL4 | 9 | 36 | 66 |  |  |  |  |  |
| 70 | STEAL5 | 12 | 20 | 1 |  |  |  |  |  |
| 71 | DSKOOL | 15 | 11 | 2 |  |  |  |  |  |
| 72 | ZERO1 | 7 | 75 | 21 |  |  |  |  |  |
| 73 | ZERO2 | 4 | 53 | 14 |  |  |  |  |  |
| 74 | ZERO4 | 18 | 34 | 22 |  |  |  |  |  |
| 75 | TORENO1 | 3 | 13 | 0 |  |  |  |  |  |
| 76 | TORENO2 | 7 | 37 | 18 |  |  |  |  |  |
| 77 | DES3 | 10 | 41 | 25 |  |  |  |  |  |
| 78 | DESERT4 | 0 | 0 | 0 |  |  |  |  |  |
| 79 | DESERT6 | 1 | 11 | 4 |  |  |  |  |  |
| 80 | DESERT9 | 7 | 19 | 18 |  |  |  |  |  |
| 81 | MAF4 | 10 | 39 | 50 |  |  |  |  |  |
| 82 | DES10 | 1 | 7 | 3 |  |  |  |  |  |
| 83 | DESERT5 | 11 | 15 | 16 |  |  |  |  |  |
| 84 | CASINO1 | 1 | 16 | 1 |  |  |  |  |  |
| 85 | CASINO2 | 22 | 19 | 3 |  |  |  |  |  |
| 86 | CASINO3 | 11 | 15 | 1 |  |  |  |  |  |
| 87 | CASINO7 | 1 | 0 | 0 |  |  |  |  |  |
| 88 | CASINO4 | 5 | 78 | 7 |  |  |  |  |  |
| 89 | CASINO5 | 2 | 2 | 1 |  |  |  |  |  |
| 90 | CASINO6 | 10 | 6 | 19 |  |  |  |  |  |
| 91 | CASINO9 | 7 | 10 | 10 |  |  |  |  |  |
| 92 | CASIN10 | 8 | 46 | 8 |  |  |  |  |  |
| 93 | VCRASH1 | 0 | 1 | 2 |  |  |  |  |  |
| 94 | VCR2 | 2 | 13 | 0 |  |  |  |  |  |
| 95 | DOC2 | 2 | 48 | 3 |  |  |  |  |  |
| 96 | HEIST1 | 1 | 54 | 3 |  |  |  |  |  |
| 97 | HEIST3 | 7 | 43 | 0 |  |  |  |  |  |
| 98 | HEIST2 | 5 | 22 | 3 |  |  |  |  |  |
| 99 | HEIST4 | 1 | 13 | 5 |  |  |  |  |  |
| 100 | HEIST5 | 2 | 51 | 20 |  |  |  |  |  |
| 101 | HEIST9 | 10 | 126 | 15 |  |  |  |  |  |
| 102 | MANSIO1 | 14 | 14 | 3 |  |  |  |  |  |
| 103 | MANSIO2 | 4 | 17 | 26 |  |  |  |  |  |
| 104 | MANSIO3 | 5 | 21 | 0 |  |  |  |  |  |
| 105 | MANSON5 | 3 | 6 | 0 |  |  |  |  |  |
| 106 | GROVE1 | 3 | 104 | 0 |  |  |  |  |  |
| 107 | GROVE2 | 0 | 20 | 0 |  |  |  |  |  |
| 108 | RIOT1 | 2 | 23 | 1 |  |  |  |  |  |
| 109 | RIOT2 | 10 | 43 | 3 |  |  |  |  |  |
| 110 | FINALEA | 2 | 14 | 5 |  |  |  |  |  |
| 111 | FINALEB | 32 | 3 | 3 |  |  |  |  |  |
| 112 | FINALEC | 146 | 12 | 7 |  |  |  |  |  |
| 113 | SHRANGE | 11 | 3 | 0 |  |  |  |  |  |
| 114 | GYMLS | 0 | 32 | 0 |  |  |  |  |  |
| 115 | GYMSF | 0 | 32 | 0 |  |  |  |  |  |
| 116 | GYMLV | 0 | 32 | 0 |  |  |  |  |  |
| 117 | TRUCK | 1 | 1 | 6 |  |  |  |  |  |
| 118 | QUARRY | 12 | 20 | 19 |  |  |  |  |  |
| 119 | BOAT | 9 | 15 | 17 |  |  |  |  |  |
| 120 | BSKOOL | 10 | 6 | 2 |  |  |  |  |  |
| 121 | TAXIODD | 4 | 1 | 7 |  |  |  |  |  |
| 122 | AMBULAN | 0 | 1 | 5 |  |  |  |  |  |
| 123 | FIRETRU | 3 | 2 | 13 |  |  |  |  |  |
| 124 | COPCAR | 0 | 1 | 24 |  |  |  |  |  |
| 125 | BURGJB | 14 | 1 | 6 |  |  |  |  |  |
| 126 | FREIGHT | 0 | 3 | 0 |  |  |  |  |  |
| 127 | PIMP | 0 | 5 | 2 |  |  |  |  |  |
| 128 | BLOOD | 5 | 5 | 3 |  |  |  |  |  |
| 129 | KICKSTA | 2 | 20 | 5 |  |  |  |  |  |
| 130 | TRIA | 0 | 1 | 8 |  |  |  |  |  |
| 131 | BCOUR | 9 | 11 | 0 |  |  |  |  |  |
| 132 | MTBIKER | 0 | 4 | 4 |  |  |  |  |  |
| 133 | STUNT | 0 | 3 | 3 |  |  |  |  |  |
| 134 | BUYPRO1 | 15 | 1 | 0 |  |  |  |  |  |

## Next up

The first commands of the census queue that gta-reversed has a reversed handler for (port the function named), then the first with none (research or keep the stand-in):

- **LOAD_MISSION_AUDIO** (silent, 951 sites, first in MAIN): `ScriptCommands.cpp:48` LoadMissionAudio. adapter lacks loadMissionAudio
- **PLAY_MISSION_AUDIO** (silent, 637 sites, first in MAIN): `ScriptCommands.cpp:64` PlayMissionAudio. adapter lacks playMissionAudio
- **SET_OBJECT_COLLISION** (authored, 198 sites, first in MAIN): `ObjectCommands.cpp:101` SetObjectCollision. handler comments name an authored stand-in
- **GET_RID_OF_PLAYER_PROSTITUTE** (stops, 1 sites, first in MAIN): `GameCommands.cpp:63` GetRidOfPlayerProstitute. adapter lacks getRidOfPlayerProstitute (the thread gives up)
- **CAMERA_SET_VECTOR_MOVE** (authored, 189 sites, first in INTRO): `CameraCommands.cpp:237` CameraSetVectorMove. handler comments name an authored stand-in
- **LOAD_SCENE_IN_DIRECTION** (authored, 119 sites, first in INTRO): `ScriptCommands.cpp:41` LoadSceneInDirection. adapter comments name an authored stand-in (loadSceneInDirection)
- **GET_DEBUG_CAMERA_COORDINATES** (authored, 3 sites, first in POOL2): `CameraCommands.cpp:107` GetDebugCameraCoordinates. adapter comments name an authored stand-in (debugCameraSource)
- **GET_DEBUG_CAMERA_POINT_AT** (authored, 2 sites, first in POOL2): `CameraCommands.cpp:112` GetDebugCameraPointAt. adapter comments name an authored stand-in (debugCameraSource)
- **IS_CHAR_MODEL** (stops, 1 sites, first in POOL2): `CharacterCommands.cpp:1835` IsCharModel. adapter lacks pedModelId (the thread gives up)
- **POINT_CAMERA_AT_CAR** (authored, 44 sites, first in ZERO5): `CameraCommands.cpp:50` PointCameraAtCar. handler comments name an authored stand-in
- **REMOVE_RC_BUGGY** (stops, 14 sites, first in ZERO5): `VehicleCommands.cpp:23` RemoveRCBuggy. adapter lacks removeRCBuggy (the thread gives up)
- **GIVE_REMOTE_CONTROLLED_MODEL_TO_PLAYER** (stops, 2 sites, first in ZERO5): `PlayerCommands.cpp:260` GiveRemoteControlledModelToPlayer. adapter lacks giveRemoteControlledModelToPlayer (the thread gives up)
- **IS_PLAYER_IN_REMOTE_MODE** (stops, 1 sites, first in ZERO5): `PlayerCommands.cpp:203` IsPlayerInRemoteMode. adapter lacks isPlayerInRemoteMode (the thread gives up)
- **SET_CAR_ALWAYS_CREATE_SKIDS** (stops, 4 sites, first in TWAR7): `VehicleCommands.cpp:125` SetCarAlwaysCreateSkids. adapter lacks setVehicleAlwaysCreateSkids (the thread gives up)
- **GET_CLOSEST_CHAR_NODE** (stops, 3 sites, first in TWAR7): `CharacterCommands.cpp:1704` GetClosestCharNode. adapter lacks closestPedNode (the thread gives up)

- CLEAR_MISSION_AUDIO (silent, 1406 sites, first in MAIN; reference absent). adapter lacks clearMissionAudio
- PLAY_MISSION_PASSED_TUNE (silent, 141 sites, first in MAIN; reference absent). dispatch unreversed; follows the routines it reaches; adapter lacks playMissionPassedTune
- SLIDE_OBJECT (silent, 73 sites, first in MAIN; reference absent). dispatch unreversed; follows the routines it reaches; adapter lacks objectBlockedAt
- STREAM_SCRIPT (silent, 69 sites, first in MAIN; reference absent). adapter lacks requestStreamedScript
- LOCATE_OBJECT_3D (silent, 49 sites, first in MAIN; reference absent). adapter lacks highlightArea
- ACTIVATE_GARAGE (authored, 27 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- CLOSE_GARAGE (authored, 24 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- CHANGE_GARAGE_TYPE (authored, 20 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- IS_GARAGE_OPEN (authored, 18 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- GRAB_ENTITY_ON_ROPE_FOR_OBJECT (stops, 15 sites, first in MAIN; reference absent). adapter lacks grabEntityOnRopeForObject (the thread gives up)
- SET_OBJECT_COORDINATES_AND_VELOCITY (stops, 12 sites, first in MAIN; reference absent). adapter lacks setObjectCoordinatesAndVelocity (the thread gives up)
- SET_ROPE_HEIGHT_FOR_OBJECT (stops, 8 sites, first in MAIN; reference absent). adapter lacks setRopeHeightForObject (the thread gives up)
- ARE_MEASUREMENTS_IN_METRES (authored, 6 sites, first in MAIN; reference absent). adapter comments name an authored stand-in (measurementsAreInMetres)
- FORCE_BIG_MESSAGE_AND_COUNTER (stops, 6 sites, first in MAIN; reference absent). adapter lacks forceBigMessageAndCounter (the thread gives up)
- RELEASE_ENTITY_FROM_ROPE_FOR_OBJECT (stops, 6 sites, first in MAIN; reference absent). adapter lacks releaseEntityFromRopeForObject (the thread gives up)
