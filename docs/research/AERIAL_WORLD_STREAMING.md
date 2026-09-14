# Aerial world streaming

Flight now selects nearby detailed scenery within 180 metres and terminal native
big-building/LOD models out to 1,000 metres. The latter retain original geometry,
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
expands collision support. Entering/leaving an aircraft changes the distant radius
through the same matched-request commit protocol. The smaller detailed window can
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
