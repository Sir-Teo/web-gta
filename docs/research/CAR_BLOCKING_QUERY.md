# Stored car obstruction query

`GET_CAR_BLOCKING_CAR` (0987) now returns the traffic controller's stored obstructing vehicle, or -1. It does not
perform a new distance or overlap search when called. The packaged script uses it in valet.scm and SCRASH3
(mission 51, instruction SCM 1404763, input global 7468 and output global 43004).

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1002030a8` resolves the input vehicle and reads its pointer at +0x558, CAutoPilot::m_ObstructingEntity.
It returns -1 for null or an entity whose low three type bits are not 2 (vehicle). Otherwise it converts the
pointer to the vehicle pool's checked handle and writes the output. There is no mission-ownership change.

SlowCarDownForOtherCar writes the other vehicle into this field at `0x100194d74` and registers its reference
at `0x100194d7c`, after accepting the moving-rectangle proximity. Each accepted vehicle replaces it: this is
the last accepted vehicle in scan order, even if an earlier one imposed the lowest allowed speed.
SteerAICarWithPhysics clears the field at `0x100198534`, before mission dispatch. FindMaximumSpeedForThisCarInTraffic
does not clear it; cars on rails can retain the previous reference between their less frequent scans.

## Integration and limits

The existing script-car, civilian-traffic and police traffic scans now retain their vehicle identity alongside
the speed result. Physics steering clears the previous reference; the existing rails path preserves it. The
script host rejects disposed targets, matching deletion of an entity reference. A street vehicle first returned
to the script gets an adopted handle which stays stable on repeated queries; it is not made a mission vehicle.

The query uses the existing scan's order, bounds, steering scheduling and vehicle coverage. Those engine paths
retain their documented approximations; native sector-list ordering is not reproduced. This change does not
establish a full valet or SCRASH3 mission pass.

Unit checks execute SCRASH3's original instruction and verify stable adoption and the -1 output. Controller
checks use two candidate vehicles to distinguish last accepted from nearest, retain the stored reference before
the next frame, clear it when the next scan sees none, and clear it when switching to an avoidance style.
