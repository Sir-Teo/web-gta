# Script boat anchor release and propeller water effects

An unoccupied script boat already received physics controls and engine speed,
but holdAnchor still cleared the constructor's anchor only for CJ. Native
CBoat::ProcessControl (PC `0x6F1770`, gta-reversed
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) clears bLockedToXY and the saved
heading in both STATUS_PLAYER and STATUS_PHYSICS. Physics-controlled boats now
retain their computed horizontal movement rather than having it zeroed at the
tail. Stopped physics boats follow that branch even with the engine flag off;
wrecked and abandoned hulls keep their own status handling.

CBoat::PreRender (`0x6F1180`) lazily creates boat_prop at each supplied static
propeller frame. It keeps the entity modelling basis, uses the actual frame's
world origin, enables local particles and copies the parent matrix. The effect
plays while physicalFlags.bSubmergedInWater is set and stops otherwise.
Constant time is min(1, native movement magnitude times two), independently of
engine speed, CJ occupancy or wrecked state. Only stopped systems are restarted;
paused systems retain their state. A dry existing system retains its last
matrix until the next submerged update. CreateFxSystem's ordinary bounds gate
remains enabled. The destructor kills and clears owned systems.

WorldBoat exposes the existing force-threshold submersion decision, rather
than substituting any weak hull-water contact. Its component binding supplies
primary/secondary world origins without collapsing missing slots. The model
hierarchy is updated before reading origins, including manually changed
ancestor transforms. WorldFx owns two independent copied-matrix slots per hull,
reuses each native system and releases both when the boat leaves or the world
is disposed. Hidden hulls do not create or update the prerender effects.

The published effects.fxp boat_prop blueprint has two emitters, play mode 2,
a 20-unit cull distance and its original effectsPC.txd textures. The existing
native FX manager retains its constant-time quantization, emission, local
particle transforms, culling and retirement behavior.

## Verification

Six initial effect checks fail because no systems are created. Two new anchor
checks expose the horizontal clamp on physics boats with engine on or off.
All 191 focused checks now pass, including actual blueprint particle emission,
owned matrix isolation, dry/paused/restart states, weak-water rejection,
creation retry, missing frames, hidden hulls and destruction. A hierarchy test
also exposes stale world matrices and passes after the origin query updates
the hierarchy explicitly.

The live fixture creates a native Speeder, sends it through its public script
navigation path and steps real boat buoyancy, physics, render components and
FX. Without CJ aboard, it releases the anchor and travels about 21 metres in
three simulated seconds. Two local effects emit 24 particles at the sampled
frame. Lifting the hull dry stops them; returning to water restarts the same
two objects. BOAT_STOP disables the engine while the submerged effects still
play. Removing the hull retires its systems and particles; all scene children
and diagnostic GPU geometries release. The ten-model component regression
passes too, without page errors. All 6,417 unit tests pass (51 skipped),
together with the final build and TypeScript check. Normal production smoke
passes saved-game return, movement, car entry, map/waypoint, pause/resume,
Rustler takeoff and gear with no page errors, failed requests or development
inspection hook.

This verifies the known physics-status branch and propeller effect lifecycle.
Complete AI status transitions/recovery, campaign boat routes, exact original
PC timing/captures and the wider water/render pipeline remain separate work.
