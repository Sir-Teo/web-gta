# Native procedural vegetation content

Acquired and validated 2026-09-14. Native terrain requires two additional systems:
`plants.dat` describes grass cover on collision surfaces, while `procobj.dat`
describes generated objects such as bushes, cacti, rubble and underwater props.
These records are not ordinary IPL placements. Rendering either system remains
unfinished; this step supplies verified content and raw table readers.

## Public files now in the depot

| Resource | Inspected contents |
|---|---|
| [plants.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/plants.dat) | 9,887 bytes; 68 cover records across 42 native surface names; 18 columns per record |
| [procobj.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/procobj.dat) | 10,019 bytes; 95 rules across 17 surfaces and 56 model names; 14 columns per record |
| [plant1.txd](https://z.noclip.website/GrandTheftAutoSanAndreas/models/grass/plant1.txd) | 42,152 bytes; eight 64×64 `txgrass0_0`–`txgrass1_3` rasters and one 128×64 `gras07Si`; all have one mip |
| [grass0_1.dff](https://z.noclip.website/GrandTheftAutoSanAndreas/models/grass/grass0_1.dff) through `grass0_4.dff`, plus [grass1_1.dff](https://z.noclip.website/GrandTheftAutoSanAndreas/models/grass/grass1_1.dff) through `grass1_4.dff` | Eight valid DFFs, each with one geometry containing 32 vertices and 30 triangles |

All eleven files total **76,375 bytes**. URLs, sizes and SHA-256 hashes are pinned
in `scripts/content/world-sources.json`; `acquire-world.mjs` now reproduces them.
The local depot is `/Users/teo/Developer/web-gta-content`, with tables at its root
and grass assets under `models/grass/`. All **127** locked world files pass offline
verification. Native binaries remain outside the repository and normal build.

All 56 procedural model names resolve through the existing 55 IDE sources; their
DFFs and assigned base TXDs exist in `gta3.img`. This is dependency availability,
not a claim that every material/parent chain has been rendered. Every surface
label in both tables resolves to one of the 179 native surface IDs.

The four `grass1_*` files are byte-identical in this public dataset. Preserve that
finding rather than inventing variants. Public provenance does not certify an
unmodified retail edition.

## Source contracts that affect accuracy

Pinned reversed source: `0076f9017b4aeef7433957ac2bd8b6988e9df166`. Local copies of
the following four files were compared with the pinned public files and match:

- [`ProcObjectMan.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcObjectMan.cpp)
  reads fourteen fields, preserving multiple object rules per surface.
- [`ProcSurfaceInfo.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcSurfaceInfo.cpp)
  clamps minimum distance to at least 80, uses `1 / (spacing * spacing)`, and
  converts degree rotations to radians. File values such as distance 60 must not
  be applied directly as the initialized runtime state.
- [`PlantSurfPropMgr.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PlantSurfPropMgr.cpp)
  reads eighteen fields, ends at `;the end`, and stores cover, slot/model/texture,
  color/intensity, scale variation, wind and density values. Parsed raw values
  are distinct from native byte casts and cover-index normalization.
- [`PlantMgr.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PlantMgr.cpp)
  loads `plant1.txd` into the **slot named** `grass_pc`; `grass_pc.txd` is not the
  file path. It sets linear filtering/wrap, loads the eight grass DFFs, replaces
  their material textures, and later selects `txgrass` rasters from cover records.
  Raw DFF names such as `fuzzygrass2` and `veg_leaf` are therefore not sufficient
  to reconstruct the grass pass. The source's model-table setup assigns table 0
  to all four renderer slots; validate that behavior before assuming distinct
  model sets per slot. Rendering also applies collision lighting and triangle
  seeds/counts, alpha blending, fog and wind, and disables depth writes.

## Readers and validation

`src/assets/vegetation.ts` provides `readPlants` and `readProcObjects`. Records
retain line numbers, surface/model names and named raw fields. They preserve
low alpha values, repeated rules and reversed offset ranges (the actual data
includes -2.4 to -3.4); they do not silently reorder or clamp them. Numeric syntax,
integer fields, finite float32 range, record count and file size are checked.

```sh
node scripts/content/acquire-world.mjs /absolute/depot
node scripts/content/acquire-world.mjs /absolute/depot --verify-only
GTA_CONTENT_DIR=/absolute/depot npx vitest run tests/vegetation.test.ts
```

The native-content test verifies all eleven hashes, both table counts/surface
labels, all eight decoded models, every texture mip, grass texture selection and
the 56 procedural models' base dependencies. Next work is native initialization,
surface eligibility, triangle selection/seeding and a dedicated grass render
path. Sprinkling generic grass over every visible terrain mesh would not match
these source rules.
