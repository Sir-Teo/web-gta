# Native vehicle generators in the continuous world

Source reference: gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [CFileCarGenerator layout](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/CarGenerator.h): 48-byte record, position and radians heading, model, two colors, flags, alarm/lock chances and delays.
- [Generator loading and spawn behavior](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/CarGenerator.cpp): fixed model lookup, negative/random model selection, byte heading, ground query, paint-pair override and population scheduling.
- [Native handling IDs](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.h): explicit table IDs rather than arithmetic on model IDs.
- [Spawn height](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp): `GetDistanceFromCentreOfMassToBaseOfModel` returns minus the collision bounding-box minimum Z.

## Imported content

The existing static native archive and companion IPLs contain **1,043 vehicle generators**. Text `cars` and binary IPL records now preserve every field, signed sentinel and source identity. External IPL basenames override archive entries using the same precedence as world placements. Bounds, overlapping binary regions, counts, numeric syntax and duplicate external names are checked before use.

Eight Las Venturas records contain model IDs 2, 4, 5 or 9, absent from the vehicle IDE catalog. They remain unresolved. No guessed `+400` correction is applied. Random model `-1` records remain distinct from these invalid fixed IDs. The complete source audit writes `/tmp/gta-car-generators.json` when `GTA_CONTENT_DIR` is provided.

The world worker returns the complete index at initialization and the matching records with each streamed terrain window. No additional map package, map selection screen or backend is introduced.

## Playable fixed cars

`WorldFleet` resolves nearby ordinary-car records against the published native vehicle catalog. It installs original DFF geometry, TXDs, embedded COL, native handling table IDs, paint, suspension and animated wheels. Native elevation guides the ground ray so elevated floors do not default to the highest roof. Occupied-car terrain replacement validates candidate wheel support before retiring old terrain, preserving vehicle pose and ownership. Spawn height uses the native collision bound; native Z heading becomes browser Y rotation. Explicit paint overrides require both primary and secondary colors, matching the source condition.

The native corpus has **129 fixed ordinary-car spawn records**, referencing 46 model IDs. Every one of those records passes the resource and original paint-override audit. The compatible handling catalog also includes Greenwood and Glendale: all **48 assemblies** pass the browser resource/physics installation audit, with no unresolved textures or failed assemblies. A Buffalo spawned on its original San Fierro terrain, accepted entry and drove about 18 metres during the controlled browser integration test.

This is a bounded browser lifecycle, not full retail generator parity:

- Load within 75 metres; keep at most six active cars including the starter. Retire unoccupied generated cars beyond 140 metres. Occupied cars remain with the player.
- Use each generator once per browser session. Streaming windows do not duplicate cars. Native respawn timers, population caps and save persistence remain unfinished.
- Unspecified colors select the first original CARCOLS variation. Native RNG and population groups are not simulated.
- Force-spawn and ignore-population-limit flags are preserved but not acted upon yet. Door locks roll the record's `doorLockChance` percentage at spawn; locked cars refuse entry and trip an 8 s alarm horn (break-in beyond the horn, including any police response, is unfinished).
- Coordinate compression and exact float32/byte heading conversion are not claimed bit-identical. Spawn heading is quantized to the native 256 directions.
- Special equipment, trailers, boats, bikes and aircraft are not passed through the ordinary-car controller. Aircraft resources and spawn records are imported; flight is still unfinished.
- Collision response uses the existing Rapier adapter; source-based tire/suspension algorithms do not imply complete retail vehicle physics parity.

## Navigation

The original radar image still covers the same continuous 6 km coordinate span. The minimap/full map now show multiple currently loaded parked cars. The destination selector sets waypoints for Grove Street, Verdant Meadows and the three city airports. These are geographic destinations, not separate maps or teleport controls. Distance remains straight-line; road routing is unfinished.
