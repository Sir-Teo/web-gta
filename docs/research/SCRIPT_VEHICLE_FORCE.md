# Script force on every vehicle family

New Model Army places both original plank bridges, then its bomb pickup can call
APPLY_FORCE_TO_CAR to lift the RC helicopter clear of intersecting geometry. The
host accepted only automobiles and gave up on that original helicopter call
(SCM offset 221289). Baseline:
`artifacts/zero4-cargo-before-vehicle-force.json` is an explicitly labelled
failure excerpt transcribed from the original tool output, rather than a full
raw timeline. The failed-run log is preserved separately.

The shared vehicle-force path now serves automobiles, bicycles/motorbikes,
boats and aircraft. It also corrects the automobile's earlier mass-only scaling
and application point. The native force vector and offset are world-aligned;
the offset is relative to the transformed centre of mass. Effective mass is
`1 / (1/mass + |lever × normalizedForce|²/turnMass)`. The scaled force then
enters CPhysical::ApplyForce, which updates linear and angular velocity.
A central push of 0.1 native units per frame adds five units per second.

The pure kernel uses float32 transforms, normalization, effective mass, cross
products and velocity accumulation. Body bindings convert between native
per-frame speed and Rapier's per-second speed. Boats use their already-adjusted
turn mass. The retained raw quaternion basis is used when the existing script
quaternion adapter carries one.

## Native evidence

`scripts/research/native-script-vehicle-force.py` verifies SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78` and executes
the valid-vehicle handler at `0x1001fbc48` and complete CPhysical::ApplyForce at
`0x100248404` in Unicorn 2.1.4. Only CollectParameters is intercepted. Native
matrix transforms, force normalization, effective mass, cross products and
velocity writes execute. Effective mass is observed from its native register;
execution stops after ApplyForce returns to the handler.

The 120 cases vary mass/turn mass, basis, COM, force and offset, including a zero
force. Flag cases cover disabled turn/move/Z, infinite mass, their combinations
and bDontApplySpeed. The handler resolves the ordinary vehicle pool without an
appearance or subclass gate.

Every captured effective mass and resulting linear/angular velocity matches.
Eight additional tests bind central/off-centre captures to real Rapier bodies
through all four vehicle classes. A frozen-body check retains the host's
kinematic-position ownership. All 5,190 unit tests pass (51 skipped), and the
build passes.

The kernel flag coverage does not establish every vehicle's native flag/state
binding or full movement integration. Frozen host controllers retain their
position rules; instantaneous velocity-query parity on a frozen kinematic body
is not established. Existing bike/boat/aircraft integrators and native solver
parity remain separate work.

Live checks pass for a car, BMX, motorbike, boat and helicopter, with atomic
before/command/after velocity reads. The existing off-centre car spin and
lowrider hydraulics check also passes without changing its thresholds. ZERO4's
permanent cargo regression places both bridges and reaches the original bomb
explosion and zero tank health with no skipped commands or give-ups. See
[mission evidence and limits](ZERO4_VALIDATION.md).
