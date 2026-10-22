# Captured pickup position storage

CPickups::GenerateNewOne at iOS `0x1001c1be4` stores each coordinate in a signed
16-bit field at eight units per integer. Float32 input is scaled by eight and
truncated toward zero with FCVTZS, saturated to int32, then narrowed by STRH.
Reading the signed short and multiplying by 0.125 recovers the world coordinate.
The pinned reference identifies this field as `CompressedLargeVector<int16, 8>`.

`scripts/research/native-pickup-position.py` executes the native allocation,
conversion, writes and handle generation in Unicorn 2.1.4. It checks executable
SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The only intercepted call is the optional nearby render-object factory, which
returns no object. Sixteen fixtures cover fractions, signed zero, float32
boundaries, actual world/interior points, signed-short wrapping and int32
saturation. Native slot allocation is exercised by the capture but is not
reimplemented by this position correction.

Runtime script records and the initial pickup extraction now use this storage
rule. WorldPickups also applies it when deriving positions for drawing and reach,
covering host-created pickups. Existing persistent collection IDs still use the
source coordinates, preserving saved collection keys across this correction.
For example, Verdant's source point (416.9548, 2538.8127, 9.5077) becomes
(416.875, 2538.75, 9.5), while its existing collection ID remains unchanged.

Sixteen capture tests check both the helper and runtime pickup records. The
initial-data test checks Verdant's position and legacy ID. A live collection
boundary test distinguishes source coordinates from the compressed coordinates.
All 3,712 unit tests pass (51 skipped), the build passes and four pickup browsers
pass: drawing/collection/rewards/regeneration, repeated save-disc reporting,
coordinate/dead-ped drop queries, and collection reporting to a script.

This does not resolve Verdant's six-unit save-height discrepancy. Native
CREATE_PICKUP at `0x1001d45c0` only substitutes ground height when Z <= −100;
the supplied Z=9.5077 survives that branch and compresses to 9.5. The broader
pickup allocation/merge behavior is separate from this storage change. The later
[standard-command ground correction](PICKUP_GROUND.md) covers CREATE_PICKUP and
WITH_AMMO. Census classifications are unchanged.
