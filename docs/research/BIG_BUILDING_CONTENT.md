# Native big-building classification and the Verdant Meadows gap

Checked 2026-09-14 against the unmodified acquired map depot. The missing
`lod_airstrm_med_` collision dependency is explained by a native entity rule
now implemented in the browser collision planner. Original placement files
remain unchanged; Verdant Meadows no longer needs the optional link repair.

## Source behavior

At reversed-source revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [`LinkLods`, FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp#L1992)
  calls `SetupBigBuilding` when an entity has LOD children **or** its model's
  draw distance multiplied by the camera LOD multiplier is strictly above 300.
- [`CEntity::SetupBigBuilding`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp#L866)
  disables collision, marks the entity as a big building and prevents streaming
  deletion. This condition does not depend on the model name or whether a COL
  record exists.
- [`Camera.h`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Camera.h#L180)
  initializes the multiplier to 1. The audit makes this parameter explicit;
  it does not claim all retail settings/platforms always use that value.

The depot's `ide/country/counxref.ide` defines model 3347,
`lod_airstrm_med_`, with draw distance 400. At multiplier 1, the unlinked
static `countn2.ipl` placement 161 therefore meets this non-collision rule.
At multiplier .75 it is exactly 300 and does **not** meet the distance condition.
The native cache-loading branch and retail execution have not been independently
validated by this audit.

The [GTA Stuff collision index](https://gtastuff.com/models/data/collisions.min.json)
also returned no record for 3347 in this pass. Model 3175, `sm_airstrm_med_`,
has a COL3 record attributed to `gta3.img/counxref.col`. This corroborates the
content inventory; absence from another index alone would not justify disabling
collision.

## Measured effect on current selections

The audit assembles all nine regions with the same native folder planner and
readers used by the browser, including Santa Maria supplements. It starts from
a linked-target-only baseline, then
reports the additional distance-qualified placements. The audit is read-only. It separately records runtime counts and confirms that
the implemented default rule matches its prediction.

| Region | Linked-target-only placements | After distance rule at multiplier 1 | Additional exclusions |
|---|---:|---:|---:|
| Grove Street | 461 | 459 | 2 |
| Mount Chiliad | 131 | 131 | 0 |
| Verdant Meadows | 107 | 106 | 1 |
| Doherty | 128 | 124 | 4 |
| Las Venturas | 302 | 301 | 1 |
| Chiliad east | 303 | 297 | 6 |
| Gant Bridge | 485 | 484 | 1 |
| Santa Maria | 1,396 | 1,382 | 14 |
| Sherman Dam | 117 | 117 | 0 |

These are placement counts, not collider counts. All selections have zero
omitted placements. The distance rule accounts for the only currently missing
collision model across the nine selections, reducing that diagnostic to zero
at multiplier 1.

The other 28 affected placements already have collision data. Examples include
San Fierro rail LODs, Chiliad's `xoverlaymap07`/`xoverlaymap07b`, the Gant bridge
LOD, and coastal night-light models. Thus this is also an authenticity issue
for existing collision, not solely a way to enable the desert region.

## Reproduction and runtime validation

```sh
node scripts/content/audit-big-buildings.mjs /absolute/depot /absolute/report.json
GTA_CONTENT_DIR=/absolute/depot node --test scripts/content/audit-big-buildings.test.mjs
```

An optional final argument selects the LOD multiplier. The report includes each
affected model, draw distance, native collision availability, placement transform
and source reference. Local measured report:
`$GTA_CONTENT_DIR/big-buildings.json`.

The runtime fixes the load-time camera LOD multiplier at the native default 1.
The separate timecycle low-LOD render multiplier never changes collision as the
player crosses a weather box. This project does not yet expose a configurable
native camera LOD-distance setting. Classification rounds IDE draw distances to
float32 before the strict comparison, matching the native model field.

All collision consumers share `planSceneCollision`: scene assembly diagnostics,
walk eligibility, installation, spawn/support queries and streaming catalogs.
The existing rendering classification now uses the same distance helper. Visual
instances, native meshes, COL records and IPL links remain intact. Changing a
placement's classification during replacement retires its old colliders instead
of transferring them into the next scene.

Validation passed:

- Unit suite and native reference cases, including the strict float threshold,
  physical-to-visual replacement cleanup and original trailer pair. The detailed
  model at `(540.6171875,2360.984375,29.859375)` retains installed collision;
  its source `lodIndex` remains -1 and the matching LOD has no installed collider.
- Fourteen browser cases: unmodified Verdant Meadows assembly and grounded
  walking, the other manual region samples, folder loading, background following,
  slow-loading boundary pause and overlapping scene replacement.
- Both content audit regressions and production build/smoke checks.

Inspected `artifacts/native-verdant-meadows-walking.png`: textured desert ground,
trailer, control tower and mountain backdrop render. The capture uses the authored
placeholder character and is not evidence of pixel parity. Logs are under
`/tmp/web-gta-big-building-{unit,reference,trailer,browser,audit,production}.log`.

The optional IPL repair remains historical, separately identified reconstruction.
It is no longer needed for the default native collision policy. Full retail
cache behavior and other camera LOD settings remain outside this validation.
