# Native spatial zones

The original GTA.DAT load list references MAP.ZON before INFO.ZON. Both resources
are now packaged in the static world manifest and source acquisition lock:

- [MAP.ZON](https://z.noclip.website/GrandTheftAutoSanAndreas/data/map.zon): 436 bytes, SHA-256 `4f78672e3ee70a1f5e09cd9acebe23f0597a39e275bf493a1f1c29ccfd268775`.
- [INFO.ZON](https://z.noclip.website/GrandTheftAutoSanAndreas/data/info.zon): 28,139 bytes, SHA-256 `9396cf9b7bec5a797fa4614ee7ab578d910ed5cdd9d475adfb35801612ec8058`.
- [GTA.DAT load order](https://z.noclip.website/GrandTheftAutoSanAndreas/data/gta.dat).

The source files contain six map regions and 378 navigation zones. Preparation
adds the native THEMAP and SAN_AND fallback entries, producing 7 and 379 runtime
entries respectively. It preserves raw float32 coordinates and source lines,
then separately truncates coordinates to signed int16, orders endpoints and
uppercases labels. Navigation entries with matching information labels share
one zone-info index. Information and display labels remain separate.

Evidence is pinned to gta-reversed `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [TheZones.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TheZones.cpp): initialization, zone creation, shared information indices, smallest-zone lookup and map-level lookup.
- [Zone.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Zone.h): native labels, bounds and zone types.
- [Box.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Collision/Box.cpp): inclusive point containment.
- [ZoneCommands.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Scripts/Commands/ZoneCommands.cpp): `SET_ZONE_POPULATION_TYPE` (0x0767) updates zone information by label.

Navigation lookup uses inclusive XYZ bounds and minimizes width plus depth,
not area or volume. Equal-size overlaps keep the earlier source entry. An
out-of-world point returns SAN_AND. Map level uses the first containing map
region after THEMAP, independently of navigation zone metadata.

Verified native points:

| Native XYZ | Information label | Map level |
| --- | --- | --- |
| 2495, -1687, 13 | GAN1 | Los Santos (1) |
| 400, 2500, 30 | MEAD | Countryside (0) |
| -2493, 379, 28 | WESTP2 | San Fierro (2) |

The terrain worker supplies the complete prepared index once. The running
fleet tracks the player's zone using browser `(x,y,z)` → native `(x,-z,y)`;
its development observation state exposes the actual identifiers. These codes
are not substituted for translated game UI names.

Spatial bounds do not provide population types. The game sets those through
script commands, along with gang/dealer and other zone state. No geographic
heuristic or universal residential-average value has been substituted. A public
[MAIN.SCM resource](https://z.noclip.website/GrandTheftAutoSanAndreas/data/script/main.scm)
was retrieved for the next stage (3,079,744 bytes; currently local research input
at `/tmp/gta-native-main.scm`, SHA-256 `c06162725bbc5429f7a871a29633ae5faa5b1f6a23ddbaa42c8d2fed70021b3e`). Its script headers/control flow and population
assignment commands still need structured decoding; raw byte-pattern matches
would not establish initialization behavior.
