# Script vehicle quaternion assignment

Native research, October 22, 2026. SET_VEHICLE_QUATERNION (07C6) now assigns a vehicle's orientation without
resetting its position or linear/angular velocity. DECON uses the command at main.scm offset 1394919 with
(-0.0448, 0.0178, 1.003, -0.0611), stored as SCM float32 values. That quaternion is not unit length.

Evidence uses the hash-verified ARM64 executable described in [remote control](REMOTE_CONTROL.md#evidence), plus
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`, `Core/Quaternion.cpp`, `Core/Matrix.cpp` and
`Entity/Physical.cpp`.

- The 1900-range table is 0x1001fa150; entry 90 reaches 0x1001f9538. Five parameters are collected and the vehicle
  pool is resolved. The shared tail at 0x1001f9b8c copies the quaternion components directly to CQuaternion::Get
  (0x1002cb070), builds a CMatrix, calls SetMatrix (0x100253148), and restores the previous position.
  Neither velocity is cleared.
- CQuaternion::Get expands the four input floats directly into right/forward/up axes. It does **not** normalize
  the input. For example (0,0,1,1) produces right (-1,2,0), forward (-2,-1,0), up (0,0,1). Normalizing that quaternion
  first would instead produce a 90-degree rotation, which is a different result.
- Physical processing calls CMatrix::Reorthogonalise (PC 0x59B6A0, reversed): normalize right x forward as up;
  normalize forward x up as right; compute up x right as forward. This produces the rigid orientation used by the
  browser body. It is derived from the raw matrix, rather than from a normalized copy of the original quaternion.

The adapter waits for the live vehicle body and accepts both script handles and the player-vehicle alias. The
host keeps the raw basis for script matrix queries until the next fixed physical pass, including the player's
vehicle pose. A subsequent body rotation invalidates that raw basis immediately. Position and both velocities
are preserved; kinematic bodies also receive the next rotation. Native axes convert to renderer axes once.

This remains **authored/partial integration** in the census. Rapier requires a rigid transform, so its body receives
that reorthogonalized orientation immediately. Non-rigid collision, drawing and ApplySpeed behavior between native
SetMatrix and Reorthogonalise are not reproduced. Queries in the command's frame see the raw axes, while physical
rotation uses the rigid result. The cache clears at the next fixed pass, including for frozen bodies; exact native
frozen-body timing is unverified. A complete DECON mission pass is not established.

Unit checks cover raw non-unit/zero quaternion expansion, native cross-product orthogonalization, axis conversion,
DECON's exact operand values, pending bodies and the player alias. The live test runs actual 07C6 bytecode, checks
same-frame raw axes and preserved position/velocities, waits for the rigid matrix, replaces the heading and checks
the player-vehicle alias. The production build passes.
