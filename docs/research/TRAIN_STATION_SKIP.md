# Train station skipping and initialization

Native research, October 22, 2026. SKIP_TO_NEXT_ALLOWED_STATION (0A07) now follows the supplied carriage to its
engine, searches for an unlocked station, changes the rail distance and speed, and advances the game clock.

Evidence uses the hash-verified ARM64 executable described in [remote control](REMOTE_CONTROL.md#evidence) and
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`, `Entity/Vehicle/Train.cpp`.

- Dispatcher table 0x100206d74, entry 67 (base 2500), reaches 0x100205d2c. Its vehicle-pool lookup continues at
  0x1002068f4 and calls CTrain::SkipToNextAllowedStation, 0x1004752d8–0x1004754f0.
- The routine follows previous-carriage pointers (+0x790) to the engine. It uses the same directional candidate
  search as IsNextStationAllowed (0x10047518c), including the strict 100-unit own-station exclusion and wraparound.
  A station is allowed when GetLevelFromPosition is at most STAT_CITY_UNLOCKED (181) + 1. Locked stations advance
  the search using their rail distance.
- The engine receives StationDist minus 20 clockwise, plus 20 anticlockwise, and signed float32 speed 0.1.
  Cruise speed, stop flags and carriage matrices are preserved; trailing carriages follow on ProcessControl.
- Native LoadScene and LoadAllRequestedModels precede PassTime. Minutes are trunc(float32(23 + XY distance / 20)),
  measured from the engine's old world position to the station, ignoring z. The adapter uses the existing PassTime
  integration for the clock, day statistics and pickup timers.

The live destination check exposed an initialization omission predating this command. ReadAndInterpretTrackFile
(0x100470de8) replaces the initial station coordinate table with track 0's nonzero fourth-column marks
(0x100471080–0x1004710ac). The marked nodes are 58, 106, 330, 370, 596 and 822, in file order. Their raw positions
are stored as floats; their track-node positions are quantized to signed eighths. The loader measures 2D joins
between those **quantized** nodes and accumulates distances in float32 (0x1004710f8–0x10047118c). Both behaviors
are now represented. The previous initial station table and unquantized distance sums gave incorrect destinations.
InitTrains then finds each station's nearest node across all tracks and reads that index from track 0
(0x1004712a4–0x100471530); all six initialized marks select track 0 in the shipped data.

The shipped post-initialization station coordinates are retained in TRAIN_STATIONS and checked against the
original tracks.dat marks. Custom track packs that change those marks need corresponding coordinate integration.
The existing train factory still assumes the nearest node across all tracks; its native creation routine remains
unreversed. Station stopping, passenger boarding, player train driving and derailment remain separate work.
The main host's LOAD_SCENE remains a no-op; this change does not provide native synchronous destination streaming.
Invalid custom unlock state with no allowed stations returns unsupported rather than reproducing a native endless
search. None of these checks establishes a complete train activity play-through.

Unit checks cover both directions, locked stations, strict exclusion boundaries, wrapping, caboose-to-engine
resolution, deferred formation updates, initialization, adapter ordering and pending tracks. The focused browser
check exercises the native SF marked point to the unlocked Los Santos station, clock advancement and formation.
