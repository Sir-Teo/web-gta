# Weapon-shop corona

`DRAW_WEAPONSHOP_CORONA` (04D5) now registers a corona through the shared world renderer. DES10's site at SCM
2038484 supplies global coordinates 292/296/300, size from local 110, texture type 2, flare type 2 and green
`{0,255,0}`. The requested raster is `coronamoon`; its flares use the headlight definitions.

## Native source

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
The command handler at `0x1001e3aec` collects nine parameters and calls the texture-type overload of
`CCoronas::RegisterCorona` at `0x100376918`. It uses these arguments:

| Argument | Native value |
|---|---|
| Identity | Thread pointer + current instruction pointer, truncated to the corona ID |
| Attachment | None |
| Position / size | Script floats; at z <= -100, find ground from x/y |
| RGB / texture / flare | Script values narrowed to bytes |
| Intensity | 255 |
| Range | 150 (`0x1005908dc`) |
| Reflection | On |
| Obstacles, trails, neon fade, full-bright start, below-only, white core | Off |
| Normal angle | 0 |
| Camera pull | float32 0.2 (`0x10058ca0c`) |
| Fade speed | 15 |

The ground sentinel is -100 at `0x10058e8cc`. The texture-type overload indexes the corona texture array at
`0x10086cd58`, then calls the main registration routine. The reversed reference's `aCoronaSpriteNames`
(PC `0x8d4950`) maps types 0/1 to `coronastar`, 2 to `coronamoon`, 3 to `coronareflect`, 4 to
`coronaheadlightline`, 5–8 to empty entries and 9 to `coronaringb`.

## Integration

Both script-corona commands now get stable IDs scoped to the thread and instruction. Browser IDs map these
identities; they do not attempt to reproduce native pointer values. The weapon-shop variant supplies its own
range and camera pull to the shared queue; ordinary `DRAW_CORONA` retains its existing range of 450.

World corona slots retain their texture type. The renderer groups adjacent quads with the same raster while
preserving slot order; empty/missing rasters do not become star coronas. The particle dictionary now also
supplies `coronaringb`, with the existing owner handling replacement and disposal.

World coronas with sun or headlight flare types use the existing reversed flare definitions and additive
renderer. The flare line to the camera tests dynamic vehicle/ped collision and excludes imported placements
and script objects. The buffer accommodates the shared corona pool plus the separately held sun. Wet-road
reflections and ordinary corona fading continue through their existing paths.

## Checks and limits

Unit checks execute the original DES10 instruction, verify repeated-call and separate-thread IDs, byte
narrowing, ground fallback and all available raster selections. The browser check runs the original instruction
in a loop and inspects registration, moon-raster drawing, headlight-flare generation and fade-out after the
thread stops. Street-lamp and sun-flare regressions check the shared rendering paths.

The existing renderer, native random-stream differences, ground query and 30 Hz world scheduling retain their
documented coverage limits. A focused corona check does not establish full DES10 completion.
