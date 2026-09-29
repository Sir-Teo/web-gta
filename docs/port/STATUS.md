# Port status

Census 2026-09-29 (gta-reversed `4b38d8a486`); sweep 2026-09-29, 600 s a mission.

Per mission: what the static census flags, and what the headless sweep saw. **Reached** is the furthest instruction the mission thread was seen at, as a share of its block; **Stopped** names a command the port gave up on or a page error; **Waiting** is where the autopilot could not take it further (a chase, a fight, a menu). See [the census](CENSUS.md) for every command and [README](README.md) for the pipeline.

| # | Mission | Authored | Silent | Stops | Swept | Reached | Ended | Stopped | Waiting on |
|---|---|---|---|---|---|---|---|---|---|
| MAIN | MAIN | 134 | 85 | 27 |  |  |  |  |  |
| 0 | INITIAL | 47 | 0 | 0 |  |  |  |  |  |
| 1 | INITIL2 | 1 | 0 | 0 |  |  |  |  |  |
| 2 | INTRO | 26 | 6 | 0 |  |  |  |  |  |
| 3 | NONE | 1 | 1 | 0 |  |  |  |  |  |
| 4 | DUAL | 2 | 1 | 0 |  |  |  |  |  |
| 5 | SHTR | 2 | 2 | 0 |  |  |  |  |  |
| 6 | GRAV | 2 | 2 | 0 |  |  |  |  |  |
| 7 | OTB | 1 | 1 | 3 |  |  |  |  |  |
| 8 | POOL2 | 86 | 3 | 16 |  |  |  |  |  |
| 9 | LOWR | 131 | 3 | 0 |  |  |  |  |  |
| 10 | ZERO5 | 13 | 1 | 10 |  |  |  |  |  |
| 11 | INTRO1 | 162 | 30 | 0 | yes | 51.2% | no |  | 11567 IS_INT_LVAR_EQUAL_TO_NUMBER, IS_INT_LVAR_EQUAL_TO_NUMBER, IS_INT_LVAR_EQUAL_TO_NUMBER, LOCATE_CHAR_ANY_MEANS_3D |
| 12 | INTRO2 | 100 | 29 | 0 |  |  |  |  |  |
| 13 | SWEET1 | 108 | 32 | 0 |  |  |  |  |  |
| 14 | SWEET1B | 156 | 38 | 0 |  |  |  |  |  |
| 15 | SWEET3 | 116 | 47 | 0 |  |  |  |  |  |
| 16 | SWEET2 | 184 | 43 | 0 |  |  |  |  |  |
| 17 | SWEET4 | 161 | 6 | 0 |  |  |  |  |  |
| 18 | HOODS5 | 57 | 12 | 0 |  |  |  |  |  |
| 19 | SWEET6 | 144 | 22 | 0 |  |  |  |  |  |
| 20 | SWEET7 | 268 | 9 | 0 |  |  |  |  |  |
| 21 | CRASH4 | 24 | 8 | 0 |  |  |  |  |  |
| 22 | CRASH1 | 80 | 14 | 1 |  |  |  |  |  |
| 23 | DRUGS3 | 143 | 12 | 0 |  |  |  |  |  |
| 24 | GUNS1 | 146 | 96 | 5 |  |  |  |  |  |
| 25 | RYDER3 | 162 | 33 | 3 |  |  |  |  |  |
| 26 | RYDER2 | 156 | 86 | 2 |  |  |  |  |  |
| 27 | TWAR7 | 80 | 64 | 13 |  |  |  |  |  |
| 28 | SMOKE2 | 57 | 24 | 0 |  |  |  |  |  |
| 29 | SMOKE3 | 132 | 68 | 2 |  |  |  |  |  |
| 30 | DRUGS1 | 316 | 67 | 26 |  |  |  |  |  |
| 31 | MUSIC1 | 76 | 8 | 8 |  |  |  |  |  |
| 32 | MUSIC2 | 49 | 25 | 3 |  |  |  |  |  |
| 33 | MUSIC3 | 190 | 39 | 20 |  |  |  |  |  |
| 34 | MUSIC5 | 104 | 21 | 0 |  |  |  |  |  |
| 35 | CPRACE | 11 | 7 | 21 |  |  |  |  |  |
| 36 | CESAR1 | 23 | 4 | 0 |  |  |  |  |  |
| 37 | DRUGS4 | 388 | 121 | 59 |  |  |  |  |  |
| 38 | LA1FIN2 | 84 | 13 | 0 |  |  |  |  |  |
| 39 | BCRASH1 | 94 | 1 | 1 |  |  |  |  |  |
| 40 | CATALIN | 12 | 4 | 0 |  |  |  |  |  |
| 41 | CAT1 | 101 | 138 | 1 |  |  |  |  |  |
| 42 | CAT2 | 138 | 14 | 5 |  |  |  |  |  |
| 43 | CAT3 | 94 | 13 | 5 |  |  |  |  |  |
| 44 | CAT4 | 93 | 87 | 1 |  |  |  |  |  |
| 45 | CATCUT | 2 | 6 | 0 |  |  |  |  |  |
| 46 | TRUTH1 | 107 | 41 | 0 |  |  |  |  |  |
| 47 | TRUTH2 | 17 | 31 | 16 |  |  |  |  |  |
| 48 | BCESAR4 | 12 | 0 | 2 |  |  |  |  |  |
| 49 | GARAG1 | 99 | 26 | 5 |  |  |  |  |  |
| 50 | DECON | 52 | 32 | 13 |  |  |  |  |  |
| 51 | SCRASH3 | 76 | 18 | 11 |  |  |  |  |  |
| 52 | SCRASH2 | 43 | 1 | 5 |  |  |  |  |  |
| 53 | WUZI1 | 122 | 18 | 3 |  |  |  |  |  |
| 54 | FARLIE4 | 38 | 8 | 1 |  |  |  |  |  |
| 55 | DRIV6 | 56 | 9 | 8 |  |  |  |  |  |
| 56 | WUZI2 | 62 | 1 | 29 |  |  |  |  |  |
| 57 | WUZI5 | 155 | 45 | 7 |  |  |  |  |  |
| 58 | SYN1 | 57 | 9 | 1 |  |  |  |  |  |
| 59 | SYN2 | 114 | 90 | 0 |  |  |  |  |  |
| 60 | SYN3 | 86 | 17 | 1 |  |  |  |  |  |
| 61 | SYND4 | 98 | 14 | 5 |  |  |  |  |  |
| 62 | SYN6 | 42 | 8 | 5 |  |  |  |  |  |
| 63 | SYN7 | 79 | 46 | 3 |  |  |  |  |  |
| 64 | SYN5 | 185 | 35 | 14 |  |  |  |  |  |
| 65 | DRIV2 | 65 | 1 | 4 |  |  |  |  |  |
| 66 | DRIV3 | 64 | 56 | 2 |  |  |  |  |  |
| 67 | STEAL1 | 34 | 8 | 1 |  |  |  |  |  |
| 68 | STEAL2 | 55 | 25 | 14 |  |  |  |  |  |
| 69 | STEAL4 | 225 | 36 | 66 |  |  |  |  |  |
| 70 | STEAL5 | 31 | 20 | 1 |  |  |  |  |  |
| 71 | DSKOOL | 43 | 11 | 2 |  |  |  |  |  |
| 72 | ZERO1 | 64 | 75 | 21 |  |  |  |  |  |
| 73 | ZERO2 | 36 | 53 | 14 |  |  |  |  |  |
| 74 | ZERO4 | 34 | 34 | 22 |  |  |  |  |  |
| 75 | TORENO1 | 26 | 13 | 0 |  |  |  |  |  |
| 76 | TORENO2 | 32 | 37 | 18 |  |  |  |  |  |
| 77 | DES3 | 106 | 41 | 25 |  |  |  |  |  |
| 78 | DESERT4 | 1 | 0 | 0 |  |  |  |  |  |
| 79 | DESERT6 | 15 | 11 | 4 |  |  |  |  |  |
| 80 | DESERT9 | 93 | 19 | 18 |  |  |  |  |  |
| 81 | MAF4 | 39 | 39 | 50 |  |  |  |  |  |
| 82 | DES10 | 8 | 7 | 3 |  |  |  |  |  |
| 83 | DESERT5 | 22 | 15 | 16 |  |  |  |  |  |
| 84 | CASINO1 | 33 | 16 | 1 |  |  |  |  |  |
| 85 | CASINO2 | 114 | 19 | 3 |  |  |  |  |  |
| 86 | CASINO3 | 99 | 15 | 1 |  |  |  |  |  |
| 87 | CASINO7 | 3 | 0 | 0 |  |  |  |  |  |
| 88 | CASINO4 | 198 | 78 | 7 |  |  |  |  |  |
| 89 | CASINO5 | 57 | 2 | 1 |  |  |  |  |  |
| 90 | CASINO6 | 116 | 6 | 19 |  |  |  |  |  |
| 91 | CASINO9 | 35 | 10 | 10 |  |  |  |  |  |
| 92 | CASIN10 | 105 | 46 | 8 |  |  |  |  |  |
| 93 | VCRASH1 | 7 | 1 | 2 |  |  |  |  |  |
| 94 | VCR2 | 8 | 13 | 0 |  |  |  |  |  |
| 95 | DOC2 | 69 | 48 | 3 |  |  |  |  |  |
| 96 | HEIST1 | 183 | 54 | 3 |  |  |  |  |  |
| 97 | HEIST3 | 90 | 43 | 0 |  |  |  |  |  |
| 98 | HEIST2 | 38 | 22 | 3 |  |  |  |  |  |
| 99 | HEIST4 | 90 | 13 | 5 |  |  |  |  |  |
| 100 | HEIST5 | 103 | 51 | 20 |  |  |  |  |  |
| 101 | HEIST9 | 345 | 126 | 15 |  |  |  |  |  |
| 102 | MANSIO1 | 99 | 14 | 3 |  |  |  |  |  |
| 103 | MANSIO2 | 115 | 17 | 26 |  |  |  |  |  |
| 104 | MANSIO3 | 59 | 21 | 0 |  |  |  |  |  |
| 105 | MANSON5 | 47 | 6 | 0 |  |  |  |  |  |
| 106 | GROVE1 | 128 | 104 | 0 |  |  |  |  |  |
| 107 | GROVE2 | 20 | 20 | 0 |  |  |  |  |  |
| 108 | RIOT1 | 15 | 23 | 1 |  |  |  |  |  |
| 109 | RIOT2 | 227 | 43 | 3 |  |  |  |  |  |
| 110 | FINALEA | 184 | 14 | 5 |  |  |  |  |  |
| 111 | FINALEB | 110 | 3 | 3 |  |  |  |  |  |
| 112 | FINALEC | 311 | 12 | 7 |  |  |  |  |  |
| 113 | SHRANGE | 46 | 3 | 0 |  |  |  |  |  |
| 114 | GYMLS | 44 | 32 | 0 |  |  |  |  |  |
| 115 | GYMSF | 35 | 32 | 0 |  |  |  |  |  |
| 116 | GYMLV | 34 | 32 | 0 |  |  |  |  |  |
| 117 | TRUCK | 12 | 1 | 6 |  |  |  |  |  |
| 118 | QUARRY | 75 | 20 | 19 |  |  |  |  |  |
| 119 | BOAT | 36 | 15 | 17 |  |  |  |  |  |
| 120 | BSKOOL | 16 | 6 | 2 |  |  |  |  |  |
| 121 | TAXIODD | 23 | 1 | 7 |  |  |  |  |  |
| 122 | AMBULAN | 26 | 1 | 5 |  |  |  |  |  |
| 123 | FIRETRU | 34 | 2 | 13 |  |  |  |  |  |
| 124 | COPCAR | 46 | 1 | 24 |  |  |  |  |  |
| 125 | BURGJB | 26 | 1 | 6 |  |  |  |  |  |
| 126 | FREIGHT | 10 | 3 | 0 |  |  |  |  |  |
| 127 | PIMP | 61 | 5 | 2 |  |  |  |  |  |
| 128 | BLOOD | 84 | 5 | 3 |  |  |  |  |  |
| 129 | KICKSTA | 19 | 20 | 5 |  |  |  |  |  |
| 130 | TRIA | 14 | 1 | 8 |  |  |  |  |  |
| 131 | BCOUR | 41 | 11 | 0 |  |  |  |  |  |
| 132 | MTBIKER | 22 | 4 | 4 |  |  |  |  |  |
| 133 | STUNT | 3 | 3 | 3 |  |  |  |  |  |
| 134 | BUYPRO1 | 17 | 1 | 0 |  |  |  |  |  |

## Next up

The first commands of the census queue that gta-reversed has a reversed handler for (port the function named), then the first with none (research or keep the stand-in):

- **IS_CHAR_DEAD** (authored, 7700 sites, first in MAIN): `CharacterCommands.cpp:1462` IsCharDead. adapter comments name an authored stand-in (pedExists)
- **SET_PLAYER_CONTROL** (authored, 1236 sites, first in MAIN): `PlayerCommands.cpp:177` SetPlayerControl. adapter comments name an authored stand-in (setPlayerControl)
- **LOAD_MISSION_AUDIO** (silent, 951 sites, first in MAIN): `ScriptCommands.cpp:48` LoadMissionAudio. adapter lacks loadMissionAudio
- **PLAY_MISSION_AUDIO** (silent, 637 sites, first in MAIN): `ScriptCommands.cpp:64` PlayMissionAudio. adapter lacks playMissionAudio
- **CREATE_OBJECT** (authored, 526 sites, first in MAIN): `ObjectCommands.cpp:20` CreateObject. adapter comments name an authored stand-in (modelBaseOffset)
- **DOES_CHAR_EXIST** (authored, 220 sites, first in MAIN): `CharacterCommands.cpp:2686` DoesCharExist. adapter comments name an authored stand-in (pedExists)
- **SET_OBJECT_COLLISION** (authored, 198 sites, first in MAIN): `ObjectCommands.cpp:101` SetObjectCollision. handler comments name an authored stand-in
- **GET_RID_OF_PLAYER_PROSTITUTE** (stops, 1 sites, first in MAIN): `GameCommands.cpp:63` GetRidOfPlayerProstitute. adapter lacks getRidOfPlayerProstitute (the thread gives up)
- **CAMERA_SET_VECTOR_MOVE** (authored, 189 sites, first in INTRO): `CameraCommands.cpp:237` CameraSetVectorMove. handler comments name an authored stand-in
- **LOAD_SCENE_IN_DIRECTION** (authored, 119 sites, first in INTRO): `ScriptCommands.cpp:41` LoadSceneInDirection. adapter comments name an authored stand-in (loadSceneInDirection)
- **GET_CHAR_HEALTH** (authored, 63 sites, first in POOL2): `CharacterCommands.cpp:1643` GetCharHealth. adapter comments name an authored stand-in (pedHealth)
- **GET_DEBUG_CAMERA_COORDINATES** (authored, 3 sites, first in POOL2): `CameraCommands.cpp:107` GetDebugCameraCoordinates. adapter comments name an authored stand-in (debugCameraSource)
- **GET_DEBUG_CAMERA_POINT_AT** (authored, 2 sites, first in POOL2): `CameraCommands.cpp:112` GetDebugCameraPointAt. adapter comments name an authored stand-in (debugCameraSource)
- **IS_CHAR_MODEL** (stops, 1 sites, first in POOL2): `CharacterCommands.cpp:1835` IsCharModel. adapter lacks pedModelId (the thread gives up)
- **POINT_CAMERA_AT_CAR** (authored, 44 sites, first in ZERO5): `CameraCommands.cpp:50` PointCameraAtCar. handler comments name an authored stand-in

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
