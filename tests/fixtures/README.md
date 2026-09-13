# Native asset fixtures

All texture pixels and archive contents here are original diagnostic data, not extracted GTA assets.

`native-assets.ts` writes small adversarial and channel-calibration files for reader tests. `dragonff-diagnostic.txd` was generated independently by DragonFF's texture exporter at commit `5a7c2f18d6ff9ac4e3424d552cfe404c931d039d` from the original byte patterns in `scripts/generate-texture-reference.py`. It exercises the PC Direct3D 9 container with one ARGB8888 texture and one DXT1 texture. The generator accepts an external DragonFF checkout; DragonFF source is not bundled in this project.

To reproduce the binary from the repository root:

```sh
python3 scripts/generate-texture-reference.py /path/to/DragonFF
```

Exporter reference: [DragonFF gtaLib/txd.py](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/txd.py).

These fixtures verify defined format cases and independent exporter interoperability. They do not establish compatibility with a retail installation, every modded dictionary or console/mobile variants.
