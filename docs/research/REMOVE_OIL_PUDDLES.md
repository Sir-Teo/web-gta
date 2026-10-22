# Oil-puddle removal

Native research, October 21, 2026. REMOVE_OIL_PUDDLES_IN_AREA (07DF) now reaches the existing permanent-shadow pool. ZERO4 clears its miniature arena with this command.

Evidence uses the same hash-verified ARM64 executable as [remote control](REMOTE_CONTROL.md#evidence), plus
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`, `source/game_sa/Shadows.cpp` and `Shadows.h`.

- The 2000-range dispatcher uses table 0x1001fd234. Entry 15 reaches handler 0x1001fb904.
- The four SCM floats are x1, y1, x2, y2. The handler's FCSEL pairs normalize the corners and call
  CShadows::RemoveOilInArea(minX, maxX, minY, maxY), iOS 0x10038cee0.
- The routine scans 48 permanent-shadow slots at 0x10089bf80, each 0x40 bytes. Only type 4 (SHADOW_OIL_1)
  and type 8 (SHADOW_OIL_5) can be cleared; the type byte at +0x3a becomes 0 (SHADOW_NONE).
- Position x/y are the first two floats in each slot. Native comparisons are **strict**:
  minX < x < maxX and minY < y < maxY. Exact edges and zero-width/height rectangles leave entries alone.
  z is not tested. The ARM64 code uses FCMP/FCCMP with GT followed by B.PL; this differs from the reversed
  CRect::IsPointInside helper's inclusive boundary check and must not be replaced with that helper's result.
- Burning oil (5), other oil stages (6/7), ordinary scorch marks (1) and other shadow types remain.

The browser's NativePermanentShadows owns the 48-slot scorch pool. It now carries an optional shadow type (defaulting to ordinary scorch behavior), and selectively removes types 4/8 at native float32 coordinates. The SCM adapter normalizes corners before the host calls that pool. The pool's authored lifetime/fade, oil creation,
ignition and per-type rendering are separate behaviors; implementing removal does not establish those.


Unit checks cover reversed input corners, oil types 4/8, burning and other shadow types, z independence, strict
edges, zero-area rectangles, float32 boundary rounding, preserved scorch marks and capacity released by removal.
Oil creation/ignition and per-type drawing remain outside this change; ordinary explosion scorch rendering and its
existing authored lifetime/fade remain unchanged.
