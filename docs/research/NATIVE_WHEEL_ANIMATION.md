# Native wheel animation

The playable Greenwood now animates the four imported wheel frames from the car's native contact and steering solution. Its original wheel atomic is reused; no primitive replacement or texture substitution is introduced.

## Source-backed motion

Pinned reference: gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`.

- [CVehicle::ProcessWheelRotation, 0x6D1230](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Vehicle.cpp): spinning returns -1.1; fixed returns zero; other states return negative projected native velocity divided by wheel radius.
- [CAutomobile::ProcessCarWheelPair](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Automobile.cpp): no-contact drive wheels adjust rotational speed by the original asymmetric -0.1/+0.05 branch; other airborne wheels multiply speed by 0.95. Rotation integrates native timestep times speed. The unusual source bounds are preserved.
- Existing native steering resolves front/rear angles, including rear-wheel steering flags. The visual reads those same resolved angles.
- Suspension geometry supplies the local upper endpoint and spring travel; wheel-center height follows upper Z minus travel times compression. This is the adapter's geometric mapping from the ray/spring solution.

The native Greenwood wheel geometry itself spans approximately -0.35 to +0.35 in local Y/Z, matching its IDE diameter 0.7 and collision radius 0.35. It must not receive an extra diameter scale. All four source wheel dummy bases are identity with their own axle positions; source geometry and frame scales remain unchanged.

## Explicit adapter boundary

The inspected CAutomobile::UpdateWheelMatrix (0x6AA290) is still an executable call, not a complete reconstruction. Our view adapter composes Z-axis steering and X-axis rolling around each imported wheel center, preserving the original basis, scale and X/Y placement. Contact velocity comes from the current native tire solution; it is not claimed to match the retail PreRender sampling schedule. Wheel poses interpolate between fixed simulation steps without cumulative matrix multiplication. Vehicle-specific matrix flags, camber, damaged/burst visual deformation, axle-specific special rendering and exact retail frame parity remain unfinished.

Tests cover forward/reverse/spinning/fixed rotation, half-timestep integration, airborne speed evolution, steering, independent suspension height, preserved original frame scale/centers, interpolation without drift, and rejection before partial matrix writes. The original Greenwood driving test still verifies all four wheel centers against the ground at 30 and 60 Hz, and now also checks rolling and front-only steering. The browser game verifies wheel state changes while driving and remains unchanged while paused.
