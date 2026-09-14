# Native aircraft flight reconstruction

## Verified data boundary

Pinned primary reference: gta-reversed/gta-reversed commit
`0076f9017b4aeef7433957ac2bd8b6988e9df166`.

- [tFlyingHandlingData](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/tFlyingHandlingData.h): 0x58-byte structure, native ID plus 21 float fields.
- [InitFromData](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.cpp): writes the 21 fields directly with float conversion. The original RCRAIDER wind field is `0.1s`; the loader explicitly skips the suffix character. Our parser preserves the source row, reports that accepted quirk and rejects other malformed numeric suffixes.
- [Native handling IDs](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.h): IDs 186–209. Source file names SEASPAR/POLMAV correspond to enum labels VT_SEASPARROW/VT_POLICEMAV; model IDs must never be substituted for these native handling IDs.
- [Plane gear endpoints](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Plane.cpp): SetGearUp (0x6CAC20), SetGearDown (0x6CAC70). Base resistance is dragMultiplier / 1000 / 2; retraction additionally multiplies GearUpR, sets gear status to 1 and all wheels missing. Extension restores status 0 and wheels OK. These immediate operations do not reconstruct the animated gear transition.

The locked `handling.cfg` contains all 24 expected profiles. All 13 plane-type and 11 helicopter-type vehicle definitions resolve one matching profile. Vortex is a plane-type hovercraft in the source classification. `staticWorldVehicles.ts` now returns prepared flight fields alongside original model, texture, collision, base handling and raw supplements. Float preparation is independent of car-unit conversion.

## Remaining flight implementation

The inspected [CVehicle::FlyingControl](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Vehicle.cpp) delegates to executable address 0x6D85F0. The partial body after that early return only resolves some input; it is explicitly unfinished. CPlane::ProcessControlInputs and ProcessFlyingCarStuff also delegate to the executable. That source is insufficient evidence for complete San Andreas thrust, lift, stall, angular response, control smoothing or special aircraft behavior.

Reverse-engineered GTA III/Vice City flight routines surfaced in research but cannot establish San Andreas behavior. No such routine has been silently substituted. Next steps are obtaining a sufficiently complete San Andreas reference/trace, implementing separate flight-state and force boundaries, native landing-gear/contact integration, rendered control surfaces/propellers, and aircraft-speed terrain/LOD streaming. The current live game still has the native Greenwood and on-foot exploration; aircraft are not yet flyable.
