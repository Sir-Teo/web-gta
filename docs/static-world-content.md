# Continuous San Andreas content

The default game now starts in Grove Street and requests new native terrain as
CJ moves through the world. One static source retains original coordinates and
IPL/LOD references across Los Santos, San Fierro, Las Venturas and the countryside.
The game has one San Andreas entry. Its initial Grove Street window bootstraps
from `world-start.scene.bin`; separate district choices and public packages have been removed.

The imported public dataset contains:

- All 16,297 entries from the verified 937,680,896-byte IMG archive.
- 9,315 static and 36,569 streamed placement records, including LODs and interiors.
- 212 vehicle definitions with an available model and texture dictionary for each.
- 144 car-type, 13 plane-type and 11 helicopter-type definitions, plus bikes,
  boats, trains, trailers and other native types. Native type classification
  includes unusual cases such as the Vortex in the plane category.
- The original environment, collision, vegetation, path data and companion files
  available in the locked depot, plus CJ's current body and animation package.

Archive contents are stored in 235 independently compressed static chunks
(543,482,301 bytes total). The manifest maps each original IMG entry to its chunk,
without changing native bytes or archive offsets. Chunks preserve source sector
padding. The published directory is checked against every manifest range before
use; downloads have exact length and SHA-256 checks. The decoded chunk cache
retains at most 64 MiB. This does not bound all renderer, model, texture or worker
memory to 64 MiB. The initial Grove package avoids requiring the archive download
before play; metadata and nearby chunks load independently through a worker.

Rebuild after acquiring the locked content:

```sh
GTA_PUBLISH_WORLD=1 GTA_CONTENT_DIR=/absolute/content-depot npx vitest run tests/build-static-world.test.ts --maxWorkers=1
```

The builder verifies the complete source archive and locked companion files,
then writes `public/play/world`. Source URLs and hashes remain in the manifest.
The browser uses GitHub Pages only, with no runtime dependency on Noclip or a
backend. Worker-local lazy File views must not be structured-cloned; the worker
constructs its source directly from the manifest.

Current playability includes walking and a native Greenwood near the initial spawn.
The runtime prefetches after movement through 40% of its 180-unit window and
pauses inside the old boundary if loading is slow. The original 144 radar textures
supply a minimap and full map, with player heading, car marker and click waypoint.

This is not yet aircraft-speed streaming or a verified end-to-end traversal of
every location. The Greenwood uses native ordinary-car mechanics and dry native
road adhesion, with immediate entry/exit. Driver animation, vehicle sound,
damage, other playable vehicles, aircraft flight, traffic and missions remain
unfinished. Long-distance LOD coverage and native weather transitions also remain
unfinished. Full vehicle catalog availability is not full vehicle gameplay.

`staticWorldVehicles.ts` resolves original model, texture, embedded collision,
base handling and specialized handling rows through the same source. It does
not coerce aircraft through the car controller or infer native handling enum
indices from vehicle IDs.

The complete vehicle decode audit resolves 208 of 212 definitions, each with all
referenced textures and embedded collision. Four original resources remain
unresolved: Caddy (457), Buccaneer (518) and Petrol Trailer (584) contain
non-finite geometry values; RC Cam (594) has an unrecognized embedded collision
payload. Their original bytes remain in the source package. No synthetic
replacement or silent repair is applied. See `static-world-vehicle-audit.json`
for the complete per-model result. All plane-type and helicopter-type models
decode, including their specialized handling rows; this does not implement
flying.

## Native parked cars

The runtime now imports 1,043 original IPL vehicle-generator records from this
same archive and its companion files. Nearby fixed ordinary-car spawns become
drivable using the native resource catalog; the minimap shows loaded parked
cars. Eight fixed model references are invalid in the original data and remain
unresolved. Random population and aircraft controls remain unfinished. See
[native generator integration](research/NATIVE_VEHICLE_GENERATORS.md) for the
bounded browser spawn policy, source evidence and validation.
