# Native asset fixtures

All texture pixels and archive contents here are original diagnostic data, not extracted GTA assets.

`native-assets.ts` writes small adversarial and channel-calibration files for reader tests. `dragonff-diagnostic.txd` was generated independently by DragonFF's texture exporter at commit `5a7c2f18d6ff9ac4e3424d552cfe404c931d039d` from the original byte patterns in `scripts/generate-texture-reference.py`. It exercises the PC Direct3D 9 container with one ARGB8888 texture and one DXT1 texture. The generator accepts an external DragonFF checkout; DragonFF source is not bundled in this project.

To reproduce the binary from the repository root:

```sh
python3 scripts/generate-texture-reference.py /path/to/DragonFF
```

Exporter reference: [DragonFF gtaLib/txd.py](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/txd.py).

These fixtures verify defined format cases and independent exporter interoperability. They do not establish compatibility with a retail installation, every modded dictionary or console/mobile variants.

The two `dragonff-model*.dff` files are an original five-vertex pyramid with a translated/rotated frame hierarchy, two materials, normals, a UV layer, day/night vertex colors and a diagnostic texture name. One contains geometry faces; the other uses Bin Mesh triangle strips. Generate both with `python3 scripts/generate-model-reference.py /path/to/DragonFF`, using the same exporter revision above. The geometry is not derived from any GTA model.

`dragonff-model-textures.txd`, reproduced by `scripts/generate-texture-reference.py`, is the independently exported companion to the pyramid. It contains original red/green/blue/white quadrants and three mip levels, with the texture name referenced by the DFF. No retail textures are used.

`dragonff-collision-v2.col` and `dragonff-collision-v3.col` contain original diagnostic sphere/box/plane shapes and distinct surface bytes, plus a COL3 shadow triangle. Generate them with `python3 scripts/generate-collision-reference.py /path/to/DragonFF` using the same pinned revision. These are independent exporter fixtures, not retail collision assets.
