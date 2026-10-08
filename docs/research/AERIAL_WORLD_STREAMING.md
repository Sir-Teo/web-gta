# Aerial world streaming

Every exterior world request now selects nearby detailed scenery within 180 metres
and terminal native big-building/LOD models out to 1,000 metres (`radius: 180,
lodRadius: 1000` in `src/main.ts`, flying or not); flight introduced this. The latter retain original geometry,
placement, material sampling and draw-distance culling. Selection is further
bounded by each model's draw distance plus the next prefetch displacement and a
40-metre camera allowance. Intersecting source collision bounds and nearby LOD
ancestry remain included. These radii and allowances are browser streaming policy,
not a reconstruction of the original game's streaming scheduler.

A 400-metre all-detail window already exceeded 512 model types at Grove Street.
The new scene allowance retains a maximum of 512 non-big-building model types,
with up to 1,024 total types including distant scenery. Decoded scene data still
has the 128 MiB, two-million-triangle, 100,000-node and 4,096-placement limits.
Distant-only models use existing source mip levels at most 128 pixels per axis
when available. No raster pixels are resampled; nearby models retain full mip
chains, and texture-pool keys distinguish the different chains. The 128 MiB cap
measures retained scene arrays, not total browser or transient decode memory.

The collision safety window remains 180 metres. The follower requests after 40%
of that radius and pauses pending loads at 75%. Expanding distant scenery never
expands collision support. Entering or leaving an aircraft no longer changes the
distant radius: the follower always keeps 180/1,000 (`setRadius(180,1000)` in
`src/main.ts`), and interiors request 100 metres without distant LODs. The smaller detailed window can
require more frequent loads during flight; asynchronous decoding, distant-model
residency and native aerial streaming policy remain open performance work.

## Original active IPL list

The runtime now reads the hash-verified original
[GTA.DAT](https://z.noclip.website/GrandTheftAutoSanAndreas/data/gta.dat), 3,776 bytes,
SHA-256 `391881940700b84d9d4a263374a9543e04ec816f3f76f54fdbcabe533f094c01`.
Only map IPLs declared by active directives participate in runtime discovery and
car-generator import. Explicit folder-workshop selections remain separate.

This fixes an aerial Las Venturas load failure caused by `vegaxref.ipl`, an unused
source file absent from the original load list. It contains a `casinostairs1` row
whose model is absent from the archive. Loading that source file merely because
it exists was incorrect. The complete supplied files remain available for audit;
the runtime follows active declarations. All 1,043 imported car-generator records
remain present after this filtering.

## Verification

- 865 unit tests pass; five optional asset checks are skipped.
- Real worker comparisons preserve every nearby source placement and the exact
  collision-placement set while adding 188 distant placements at Meadows, 601
  near Grove Street, 477 in San Fierro and 731 in Las Venturas.
- Every resulting scene installs/disposes through the real native scene adapter.
  The archive's retained chunk cache stays below 64 MiB at all four locations.
- Rustler takeoff, streamed terrain replacement, gear operation and airborne exit
  rejection pass; all seven aircraft assemble and their wheel frames animate;
  Dodo landing/braking/exit passes.
- Screenshot review shows continuous original landscape beyond the former
  airfield cutoff. This verifies that view, not every heading/altitude/weather
  combination or complete retail visual parity.

## Geometry residency

The static-world worker now retains decoded DFF geometry across region requests in
an archive-scoped 32 MiB least-recently-used cache. Keys include the archive entry
range or external File identity and the selected clump. Invalid decodes leave no
resident/pending entry; models larger than the budget decode without residency.
Payload accounting includes unique backing buffers and estimated metadata storage;
it is not an exact browser-heap measurement. Cache statistics are returned with
worker terrain diagnostics. Textures, placement state and GPU resources are not
stored by this cache; scene texture decoding remains per request.

The airfield browser regression verified identical geometry hashes across repeated
requests, with all 212 initial decodes reused. Moving the window 75 metres reused
204 models and decoded 17 new ones, retaining 3,156,782 estimated bytes. One run
measured 1.65 seconds for the cold window and 0.97 seconds for its repeat; this also
includes network/other-cache effects and is not an isolated DFF speed benchmark.
869 unit tests pass (five optional checks skipped), five streaming/aircraft browser
checks pass, the production build passes, and the flight screenshot retains the
same continuous distant landscape.
