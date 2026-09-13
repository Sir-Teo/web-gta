"""Generate an original diagnostic TXD using an independent DragonFF checkout.
Usage: python3 scripts/generate-texture-reference.py /path/to/DragonFF
Validated with DragonFF commit 5a7c2f18d6ff9ac4e3424d552cfe404c931d039d.
The supplied pixel data are authored here; no original GTA files are needed.
"""
import sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
from gtaLib.txd import TextureNative, txd

textures = []
for name, fmt, pixels in [
    ('independent_rgba', 21, bytes([30, 20, 10, 255, 60, 50, 40, 128, 90, 80, 70, 64, 120, 110, 100, 0]) * 4),
    ('independent_dxt1', 0x31545844, bytes([0, 248, 224, 7, 228, 228, 228, 228])),
]:
    texture = TextureNative()
    texture.platform_id = 9
    texture.filter_mode = 2
    texture.uv_addressing = 0x12
    texture.name = name
    texture.raster_format_flags = 0x500
    texture.d3d_format = fmt
    texture.width = texture.height = 4
    texture.depth = 32 if fmt == 21 else 16
    texture.raster_type = 4
    texture.num_levels = 1
    texture.platform_properties = SimpleNamespace(alpha=True, compressed=fmt != 21)
    texture.pixels = [pixels]
    textures.append(texture)
dictionary = txd()
dictionary.device_id = 2
dictionary.native_textures = textures
output = Path(__file__).resolve().parents[1] / 'tests/fixtures/dragonff-diagnostic.txd'
output.write_bytes(dictionary.write_memory(0x36003))
print(output)

# Companion dictionary for the independent model, with asymmetric quadrants and a full mip chain.
companion = TextureNative()
companion.platform_id = 9; companion.name = 'calibration_grid'
companion.filter_mode = 6; companion.uv_addressing = 0x11
companion.raster_format_flags = 0x8500; companion.d3d_format = 21
companion.width = companion.height = 4; companion.depth = 32; companion.raster_type = 4; companion.num_levels = 3
companion.platform_properties = SimpleNamespace(alpha=False, compressed=False)
quadrants = [(0, 0, 255, 255), (0, 255, 0, 255), (255, 0, 0, 255), (255, 255, 255, 255)]
companion.pixels = [bytes(channel for y in range(4) for x in range(4) for channel in quadrants[(y // 2) * 2 + x // 2]), bytes(channel for color in quadrants for channel in color), bytes([128, 128, 128, 255])]
dictionary.native_textures = [companion]
output = output.with_name('dragonff-model-textures.txd')
output.write_bytes(dictionary.write_memory(0x36003)); print(output)
