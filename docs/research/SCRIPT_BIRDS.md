# Scripted birds

`CREATE_BIRDS` (0876) now reaches the existing `NativeBirds` simulation and `NativeBirdsMesh` renderer. It uses the
same six slots as ambient birds, takes the first free slots, and returns when the pool is full. Script creation
has no day, area, camera-distance or water gate and does not check obstacles. The usual update removes birds
beyond their biome's distance, checking one slot each frame; rendering and gunshot interaction are shared.

## Native evidence

The hash-verified iOS executable is the one identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Its 2100-command table at `0x1001fef54` maps 2166 to `0x1001fe744`. After collecting eight operands, instructions
`0x1001fe758–0x1001fe780` load the first six words into scalar registers and execute **SCVTF** on each. These are
integer-to-float conversions of the collected bits, rather than floating-point loads alone. Quantity and biome
are loaded as integers; `w2 = 0` disables obstacle checks before calling `CBirds::CreateNumberOfBirds` at
`0x1003721f4`.

The browser uses `readInt` followed by `Math.fround` for those coordinates. Both actual SYND4 sites encode floats:

| SCM offset | Start | Target | Count / biome |
|---|---|---|---|
| 1622013 | (2682.4202, 1420.2371, 28) | (-2630.3650, 1411.6986, 28) | 3 / water |
| 1631820 | (-2616.1086, 1408.6289, 6.5) | (-2618.4976, 1415.8663, 6.5) | 3 / water |

Consequently the iOS handler puts these birds hundreds of millions of units away. This quirk is preserved;
connecting the command does not make these particular mission flocks visible near San Fierro. This is based on
static executable instructions and the packaged SCM operands, not a capture of the original mission running.

The existing bird model follows the pinned reversed `Birds.cpp` (PC `0x711ef0`): water biome 0 has distance 45,
desert biome 1 has distance 80, and all other values use the normal biome with distance 40. The iOS creation
routine confirms six `0x44`-byte slots at `0x10086aed0`, the disabled obstacle branch at `0x1003723c8`, and float32
formation-coordinate additions starting at `0x100372470`. Those additions now round to float32, which matters
for the huge converted script positions. Direction normalization follows iOS `CVector::Normalise` at
`0x1002cb4c4`, including its `{1,0,0}` fallback for a zero vector.

## Verification and limits

Unit tests execute both original SYND4 instructions and check every forwarded value. They also cover integer
coordinates, float32 conversion, raw count/biome values, pool saturation, negative counts, obstacle bypass and
zero-direction behavior. The browser check creates an integer-coordinate flock at night and observes drawing,
then executes both original instructions, observes six shared slots and waits for distance culling. The existing
ambient-flight, visibility and shooting browser check also passes.

The native random stream is not synchronized with the original executable. The existing bird update uses the
port's 30 Hz world cadence and JavaScript arithmetic; this work does not establish frame-by-frame original
trajectories or a complete SYND4 mission pass.
