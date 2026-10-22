# Script shadow drawing

`DRAW_SHADOW` (016F) now projects its requested particle-dictionary raster onto the loaded collision receivers.
STUNT's single instruction at SCM 3072885 uses texture 2, angle 0, half-size 1, intensity 150 and black RGB.
Its position comes from local arrays 127/147/167 indexed by local 56.

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
The command handler at `0x1001d2770` collects ten parameters. Its tail at `0x1001d2f58` computes sin/cos of the
angle in radians, multiplies by length, and passes front `{-sin*length, cos*length}` and side
`{cos*length, sin*length}`. Angle zero has a direct path. Texture/RGB narrow to bytes and intensity to int16.
There is no ground-sentinel substitution.

The texture overload at `0x100388264` accepts types 1–6, rejects a full 48-slot table, and stores depth 15,
scale 1, no water and no draw-on-buildings flag. Its switch and the reversed `CShadows::Init`/texture overload
(PC 706CD0/707930) establish these raster and blend pairs:

| Type | Raster | Blend |
|---|---|---|
| 1 | shad_car | SRCALPHA / INVSRCALPHA |
| 2 | shad_ped | SRCALPHA / INVSRCALPHA |
| 3 | shad_exp | ONE / ONE |
| 4 | shad_heli | SRCALPHA / INVSRCALPHA |
| 5 | headlight | ONE / ONE |
| 6 | bloodpool_64 | SRCALPHA / INVSRCALPHA |

## Integration and limits

The adapter queues the float32 geometry and narrowed arguments. The renderer uses existing projected receiver
cuts, clamped linear rasters, depth testing without depth writes and first-occurrence raster/type batching.
The particle texture owner now includes bloodpool_64. A world frame's shadows persist across faster render
frames and disappear on the next world frame unless the script submits them again.

This command remains **authored** in the census: script draws share 48 slots with one another, while existing
ped/car shadow paths still have separate render pools instead of competing for the native shared table.
The existing collision projection and receiver filtering also retain their documented limits. This change
does not establish full STUNT completion.

Unit checks execute STUNT's original array-based instruction, float32 orientation and byte/int16 conversion,
capacity/reset, and all six raster/blend/batch paths. The browser check executes the original instruction in
a loop, checks projected drawing across render frames, and verifies removal after thread termination.
