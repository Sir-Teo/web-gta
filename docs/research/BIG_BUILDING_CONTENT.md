# Native big-building classification and the Verdant Meadows gap

Checked 2026-09-14 against the unmodified acquired map depot. The missing
`lod_airstrm_med_` collision dependency is explained by a native entity rule
that the browser collision planner does not yet implement. This is stronger
evidence than repairing the coincident trailer's placement link.

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
the current collision plan, which already excludes linked LOD targets, then
reports the additional distance-qualified placements. No source files, LOD
links, collision shapes or runtime rules are changed.

| Region | Current physical placements | After distance rule at multiplier 1 | Additional exclusions |
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

## Reproduction and next implementation

```sh
node scripts/content/audit-big-buildings.mjs /absolute/depot /absolute/report.json
GTA_CONTENT_DIR=/absolute/depot node --test scripts/content/audit-big-buildings.test.mjs
```

An optional final argument selects the LOD multiplier. The report includes each
affected model, draw distance, native collision availability, placement transform
and source reference. Local measured report:
`/Users/teo/Developer/web-gta-content/big-buildings.json`.

Next, implement the original classification consistently in collision planning,
spawn checks and streaming ownership, with a defined multiplier policy. Verify
unmodified Verdant Meadows walking and the affected mountain/coastal regions.
Keep visuals and original placement links intact. The optional IPL repair remains
a separately identified reconstruction; it should not be required to reproduce
the native big-building collision rule.
