# Native world texture sampling investigation

Inspected 2026-09-14, prompted by visible fence and foliage aliasing in
`artifacts/native-cj-normal-idle.png`. The acquired dataset is pinned in
`scripts/content/world-sources.json`. This investigation identifies a concrete
sampling limitation in the input assets; it does not claim to explain every
visible artifact or certify retail appearance.

## Reproduce the inventory

```sh
node scripts/content/audit-texture-sampling.mjs /absolute/gta3.img /absolute/report.json
```

The script uses the game's IMG and TXD readers. It records each dictionary's
SHA-256, each texture's sampler, format, raster flags, dimensions and actual
stored mip sizes. It writes the report even when a dictionary fails and returns
a failing exit status if any dictionary is unreadable. No pixels are modified.

Actual full-archive result (includes unplaced textures and non-world assets):

| Measurement | Count |
|---|---:|
| TXD dictionaries parsed | 2,750 |
| Unreadable dictionaries | 0 |
| Textures | 25,995 |
| Textures marked alpha | 2,026 |
| Textures with only one stored level | 19,917 |
| Mip-filter requests with only one stored level | 15,025 |
| Nearest-filter textures with only one stored level | 1,641 |
| Multi-level chains ending before 1×1 | 0 |
| Empty stored levels | 8,906 |

Empty tiny DXT levels are a separate known condition handled by the decoder's
reconstruction path. Their count is levels, not textures; it must not be added
to the texture counts. A missing stored mip chain alone does not establish a
corrupt or modified retail asset.

## Concrete Grove Street inputs

| Dictionary / texture | Stored sampler | Stored levels |
|---|---|---|
| `gta_tree_palm.txd` / `planta256` | 1: nearest | 128×128 only |
| `gta_tree_boak.txd` / `newtreeleaves128` | 1: nearest | 128×128 only |
| `break_fen_mesh.txd` / `Gen_Meshfencing` | 6: linear mip-linear | 128×128 only |
| `hub_alpha.txd` / `Upt_Fence_Mesh` | 6: linear mip-linear | 256×256 only |
| `eastlstr_lae2.txd` / `compfence4_LAe` | 6: linear mip-linear | 256×256 only |

`nativeTexture.ts` preserves supplied pixels and mip chains. It maps native
sampler modes to their Three.js equivalents; when only one level exists it
uses the corresponding magnification filter for minification. Thus the listed
leaves use nearest sampling and the listed fences use linear sampling, without
invented lower-resolution levels. Seven existing texture tests pass, including
source row order, mip preservation, sampler mapping and shared ownership.

The [librw D3D9 reader](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/d3d/d3d9.cpp#L704)
reads the stored sampler and mip count separately. Its compressed texture path
uses the raster mip flag when deciding allocation. A mip-filter request is
therefore not evidence that a file contains lower-resolution images.

Runtime overrides must be checked in their actual scope. The inspected reversed
[PlantMgr](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PlantMgr.cpp)
sets linear filtering on its loaded `grass_pc` textures; that does not establish
a global override for the palm/oak dictionaries. The
[custom building material setup](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Pipelines/CustomBuilding/CustomBuildingPipeline.cpp#L67)
sets linear filtering on an environment-map texture, not every diffuse texture.
No applicable universal override was established by this inspection.

## Independent public-host comparison

Downloaded six dictionaries through the public
[GTA Stuff file endpoint](https://gtastuff.com/api/file?name=gta_tree_palm.txd):
`gta_tree_palm.txd`, `gta_tree_boak.txd`, `badlands.txd`, `hub_alpha.txd`,
`eastlstr_lae2.txd`, and `break_fen_mesh.txd`. All returned HTTP 200 and all six
SHA-256 hashes match their sector-padded archive entries exactly. This comparison
establishes identical public copies, not independent retail provenance.

Reports remain external at
`/Users/teo/Developer/web-gta-content/texture-sampling.json` and
`/Users/teo/Developer/web-gta-content/texture-sampling-comparison.json`;
comparison files are in `comparison/sampling/` and are not automatically loaded.

## Consequence for fidelity work

Replacing the archive copies with those six public downloads cannot improve
sampling: their bytes are identical. Preserve the inspected baseline. Next,
compare a fixed fence/foliage camera against an original-game capture with
known platform, resolution, time and filtering settings, and inspect any
applicable native draw-time sampler state. Generated mips or anisotropic
filtering should be evaluated as explicit rendering variants; simply making
the image smoother is not evidence of original-game parity.
