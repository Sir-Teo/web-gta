# Vehicle clump alpha

`SET_VEHICLE_TO_FADE_IN` (0594) writes the vehicle's clump alpha. Despite the command name, the second operand
is a raw signed integer, not a Boolean or duration. Both CASINO4 sites pass 0 after creating a random civilian
car (SCM offsets 2125937 and 2126115). They use local 289 for the vehicle.

## Native evidence

The pinned iOS executable is the hash-verified slice identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
The 1400-command processor subtracts 1403 before its table at `0x1001e80e0`. Entry 1428 dispatches to
`0x1001e6994`: collect two operands, resolve the vehicle, load its RpClump at +0x20, then pass the second word to
`CVisibilityPlugins::SetClumpAlpha` at `0x1003a0cec`. That routine writes the full 32-bit word to plugin storage.

`CVehicle::UpdateClumpAlpha` at `0x10047e780` reads the current value and advances it by 16 toward 255. Values
already at or above 255 remain unchanged in this executable. With the vehicle fade-out bit set, it subtracts 8
and clamps at zero instead. These integer changes do not depend on the physics timestep. Direct calls appear
in automobile control at `0x100442940`, bike control at `0x100451838` and boat control at `0x10045c1a0`.
The latter follows the same 4,500 ms boat-talk timer branch as the reversed `CBoat::ProcessControl`.

Trains differ: the reversed `CTrain::ProcessControl` does not update clump alpha, and the iOS train routines have
no call to this helper or the clump-alpha accessors. Assigning a train's alpha changes its rendering and leaves
the value in place until another assignment.

## Integration

`NativeClumpAlpha` retains signed script values and advances the supported control paths at the port's 30 Hz
world cadence. A normal zero-alpha fade takes sixteen such frames to reach 255. Car generators and traffic
continue to use this same state, now with discrete 16-unit steps rather than interpolated half-steps.

Each car, aircraft, bike, boat and train exposes the clump assignment. Materials keep their original opacity,
including glass, and restore their original transparency flag when the clump returns to full opacity. The
renderer clamps the multiplier to 0–1; the stored script value remains raw. Existing car component and upgrade
materials continue to use the car assembler's alpha binding. Collision, visibility flags, position and velocities
are independent of this assignment.

This does not reproduce variable-frame native scheduling or all native translucent-atomic sorting. The fade-out
arithmetic is available in the helper; this command does not set or clear the vehicle's fade-out flag.

## Verification

Unit checks cover raw signed storage, the iOS boundary above 255, fade arithmetic, discrete frame timing,
opacity/transparency restoration, later materials and both original CASINO4 instructions. The live browser
executes those instructions across a car, Hunter, bike, Squalo and freight train. All five receive zero alpha
without changing their collision body or pose; the first four return to 255, while the train stays at zero until
another script assignment. Materials restore their original values. The existing script car-generator browser
check also passes. Full CASINO4 completion remains unverified.
