# Local PC asset reader — September 13, 2026

The local texture library at `/assets.html` is the first implemented component of the original-file route in the design. It reads local files in a dedicated worker and previews native texture pixels. It does not yet bind imported materials to the game, persist files, convert models or load an original district.

## Source evidence

- The [gta-reversed directory structure](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Directory.h) and [directory reader](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Directory.cpp) establish the archive directory fields: sector offset, two 16-bit size fields and a 24-byte name. Our reader targets uncompressed `VER2` archives with 2048-byte sectors. [DragonFF’s IMG reader](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/img.py) independently identifies `VER2` and multiplies archive offsets by 2048. Our reader reads the header and directory first, then slices only the selected dictionary. Packed entries are reported as unsupported.
- [librw's Direct3D 9 native texture reader](https://github.com/aap/librw/blob/master/src/d3d/d3d9.cpp), especially `readNativeTexture`, establishes the platform-specific header, filter/address bits, names, raster/D3D formats, dimensions, mip count, flags, palette and length-prefixed mip payloads. [Its shared raster conversion](https://github.com/aap/librw/blob/master/src/d3d/d3d.cpp) confirms RGBA palette ordering. This project has an independent TypeScript reader; it does not link or bundle librw.
- [Microsoft's block-compression documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d10/d3d10-graphics-programming-guide-resources-block-compression) describes BC1/2/3 (D3D9 DXT1/3/5), endpoint interpolation, alpha modes and block padding for small mip levels. The decoder preserves the source mip chain and emits RGBA only for the selected preview.
- A diagnostic TXD generated with [DragonFF's exporter](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/txd.py) verifies interoperability independently of our fixture writer. Pixel data are authored for this project. Reproduction and provenance are in `tests/fixtures/README.md`.

## Current format boundary

Direct3D 9 only: DXT1, DXT3, DXT5; RGB888, ARGB8888, XRGB8888, RGB565, XRGB1555, ARGB1555, ARGB4444; PAL8 RGBA palettes. Console/mobile/Definitive Edition containers, D3D8, cube textures, PAL4, luminance formats and packed IMG entries fail explicitly. An unsupported native texture currently rejects its dictionary; partial-dictionary recovery is not implemented.

Limits are explicit: 200,000 archive directory records, 64 MiB per dictionary, 4,096 textures per dictionary, and dimensions no larger than 4,096 × 4,096. A selected texture can allocate up to 64 MiB of RGBA in addition to retained source data and canvas storage. This is an inspection fallback; compressed GPU upload, source-hash caching and measured streaming budgets remain work. Clearing/replacing a file terminates its worker. Request IDs suppress stale asynchronous results within an archive.

## Verification and remaining fidelity work

Tests cover exact channel/alpha values, all three supported DXT modes, partial blocks, mip preservation, malformed chunks, unsupported variants, directory bounds, duplicate/overlapping entries, selective file reads and an independent exporter fixture. Browser checks exercise file input, worker decoding, dictionary search/selection, bad-data recovery, cancellation, replacement, mip selection and a 390-pixel layout. Production verification opens the workshop from the game menu and decodes the independent fixture with the emitted worker bundle.

No retail game file or original gameplay capture has been checked. Therefore this is a format foundation, not proof of original-asset compatibility or pixel parity. The [static DFF preview](MODEL_FORMATS.md) now implements geometry, hierarchy and a tested basis conversion. Gameplay material assignment, animated DFF support, IDE/IPL/COL/IFP import, skinning, vertex lighting, source sampling semantics in the 3D renderer and installation-scale compatibility remain required.
