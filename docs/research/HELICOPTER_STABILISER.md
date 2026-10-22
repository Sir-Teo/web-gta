# Helicopter stabiliser

Native research, October 21, 2026. SET_HELI_STABILISER (04DF) writes vehicleFlags.bHeliMinimumTilt; this is a
flight-controller change, not a frozen orientation or an autopilot mode. ZERO4 and DES3 call it.

Evidence uses gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`,
[CVehicle::FlyingControl](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Vehicle.cpp),
checked against the ARM64 executable identified in [remote control](REMOTE_CONTROL.md#evidence).

- Script handler 0x1001e33a8 reads the vehicle and boolean, sets or clears bit 28 in the 64-bit flags at +0x568
  (byte +0x56b, bit 4), then joins the common handler tail at 0x1001e36a0.
- FlyingControl at 0x10047a638 branches on that bit. Enabled, 0x10047a800–0x10047a83c changes the rotor lift axis
  from U to [sin(4 asin(Ux)), sin(4 asin(Uy)), cos(4 acos(Uz))]. It does not normalize the result. The ordinary
  axis is the body's up vector, or the Hydra nozzle axis when the flag is clear.
- At 0x10047b220–0x10047b24c, enabled, pitch and roll inputs are multiplied by
  sin(0.25 asin(fPitch / fAttackLift)) × fAttackLift / fPitch. Both axes use the pitch ratio. Yaw is unchanged.
- Self-leveling, wind, ceiling, side-slip and the common resistance tail remain the normal heli flight controller.

ScmMission now writes the native flag, and WorldPlane passes it into ordinary/RC heli flight and the Hydra hover branch. The pure controller checks the changed lift axis and both reduced stick axes, including unchanged yaw; an adapter test checks that the script switch sets and clears the flag without entering remote mode. The live `script-heli-stabiliser.spec.ts` check also passes: the script flag reduces both actual Goblin flight responses, leaves yaw alone and restores the original response when cleared. Its final ratio includes the common nonlinear angular-resistance tail. Existing Maverick and Hydra touch-flight checks pass.
