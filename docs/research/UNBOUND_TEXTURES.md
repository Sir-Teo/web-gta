# Unresolved native texture bindings

The two Santa Maria bindings have been traced to the supplied assets rather than
a missing global texture search in the browser loader. The pinned
[CTxdStore::TxdStoreFindCB source](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TxdStore.cpp)
searches the current dictionary and then its parents; its load callback returns
null. It does not search unrelated loaded dictionaries. The browser's child-first
dictionary chain follows this lookup rule.
The freshly downloaded pinned file matched the inspected local source;
SHA-256 `93ac78741258053306748b1f4a42b4d941685b64bb76d092b80c14eef88f3dae`.

## Santa Maria findings

| Model | Assigned dictionary | Unresolved name | Archive evidence |
|---|---|---|---|
| kb_canopy_test | canopy.txd | kb_canopy128 | No matching texture name in any of the 2,750 archived TXDs. |
| lodcanal_floor3 | canalsg_law.txd | bevgrnd03b_lawLOD | One match in lod_a_law.txd: 32×64 DXT1, one mip. This dictionary is outside the loaded chain. |

The public GTA Stuff copies of
[canopy.txd](https://gtastuff.com/api/file?name=canopy.txd),
[kb_canopy_test.dff](https://gtastuff.com/api/file?name=kb_canopy_test.dff),
[canalsg_law.txd](https://gtastuff.com/api/file?name=canalsg_law.txd) and
[lodcanal_floor3.dff](https://gtastuff.com/api/file?name=lodcanal_floor3.dff)
all returned HTTP 200. Their complete bytes equal the corresponding Noclip
archive entries, including length. This establishes consistency between those
public copies, not independently certified retail identity.

| File | Bytes | SHA-256 |
|---|---:|---|
| canopy.txd | 51,200 | a290550b7cfb1ba513f137bf85303edff581f5f4e03d01d2649bcfa93a5d414d |
| kb_canopy_test.dff | 10,240 | 3c588fd12b1bc720339d4a5ea345bb7b1c74c2460e1f9f75a9d9d0fa5f48a25f |
| canalsg_law.txd | 319,488 | fec46ba0e58c22bd64a2d9f75050f92ef46b06ff5891f9a8c62fdb64ac6d3a84 |
| lodcanal_floor3.dff | 2,048 | 8830fb0777ca166ce55beeb235a2c297f43659c036c886c48ab7b502fa6faa1b |

`canopy.txd` contains `wood02`, `weathered wood2 64HV` and `kb_canopybse64`.
The last name is different from the requested canopy texture; it is not evidence
for renaming or substituting that raster. The canal candidate's containing
archive entry SHA-256 is
`62f204ed1e24d13a9acdca65646a07af73f77bd59d0f09a711f570596393e27b`.

## Reproducible local audit

Run the world audit first so its placement/dictionary report reflects current
presets and assets, then classify the reported unresolved bindings:

```sh
node scripts/content/audit-world.mjs /absolute/depot/gta3.img /absolute/depot
node scripts/content/audit-texture-bindings.mjs /absolute/depot
```

The second command re-reads the affected DFFs and assigned/parent TXDs using the
runtime readers, scans all archived TXDs for unresolved names and validates
positive name matches with the native TXD parser. It writes `texture-bindings.json`
in the depot. Candidate metadata includes native dimensions, format, mip count
and containing-entry hash. Parse failures produce an incomplete classification
and nonzero exit rather than claiming a name is absent.

The current nine presets yield **10 bindings: 4 absent from the world archive,
6 outside their loaded chains**, with no scan errors. Besides Santa Maria:

| Region | Model | Name | Classification / candidate TXDs |
|---|---|---|---|
| Doherty | lodsion_09_sfs | ws_whitewall2_bottom | Outside chain / 26 |
| Doherty | lodvingschlgrg_sfs | ASJMSFSE2 | Absent from world archive |
| Doherty | lod_03b_sfse | pierplanks_128 | Outside chain / 5 |
| Doherty | sub_floodlite | striplights02 | Absent from world archive |
| Gant Bridge | bussign1 | chrome | Absent from world archive |
| Gant Bridge | lodpstairssfn02 | greyground256128 | Outside chain / 36 |
| Gant Bridge | lod_land2_sfn09 | sf_pave6 | Outside chain / 32 |
| Gant Bridge | lod_land2_sfn09a01 | ws_trans_concr | Outside chain / 13 |

“Absent” is limited to this `gta3.img`; it does not cover every external game
dictionary, release or platform. A shared texture name does not establish that
all matching candidates have identical pixels. The report classifies unresolved
bindings from the selected scenes, not every model in the archive.

The content regression checks all 2,750 scanned dictionaries, the 4/6 split and
the Santa Maria chains/candidate dimensions against a temporary depot. Logs:
`/tmp/web-gta-texture-bindings-audit.log` and
`/tmp/web-gta-texture-bindings-regression.log`.

No native assets, assignments or renderer fallback rules were changed. Remaining
work is to inspect external dictionaries and reference-game appearance, then
apply any evidence-backed asset correction explicitly. A speculative global
name fallback would depart from the inspected native lookup behavior.
