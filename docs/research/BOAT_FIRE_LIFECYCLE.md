# Boat fire lifecycle

Boat fire previously used the generic car effect path: it ended at 250 health,
looked for an engine/exhaust frame or a hull-bound fallback, inherited engine
particle velocity and requested car overheat smoke. CBoat has its own fire
ownership, model offsets and recovery boundary. WorldBoat and WorldFx now
follow those rules.

## Source and profile

The pinned gta-reversed revision is
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`. CBoat::ProcessControl, PC
`0x6F1770`, clears its timer and kills/clears its fire above 460 health or when
wrecked. Otherwise, each horizontal displacement from the actual camera must
have magnitude strictly below 200. Altitude does not gate burning. Inside that
square, health below 250 lazily creates and plays `fire_car`, with the clump's
modelling matrix and the ordinary false ignore-bounds flag. Native creation
also raises CEventVehicleOnFire.

Once created, the fire persists through partial repairs to 250–460 and through
camera movement out of the square. The timer only advances below 250 and
inside the camera square. It retains its value through partial repairs and
out-of-range intervals, resets above 460 or on wrecking, and explodes strictly
past 5000 ms. The PC source adds timestep × 20 to a float millisecond timer.
The host now preserves those float operations while retaining its public
seconds-valued burnTimer. Main supplies the current render camera; the
standalone adapter defaults to its player position when no camera is supplied.

The PC model-local offsets are:

| Model | Native XYZ |
| --- | --- |
| Speeder 452 | (0.4, −2.4, 0.8) |
| Reefer 453 | (2, −1, 0.5) |
| Other boats | (−1.5, −0.5, 1.2) |

These are explicit CBoat positions, independent of model engine/exhaust frames.
The ordinary boat path does not call AddDamagedVehicleParticles, nor does it
add vehicle velocity to the owned fire system. Its native fire blueprint
supplies its own flame/smoke particles. Ordinary car effects remain separate.

## Executable captures and differences

The selected iOS CBoat::ProcessControl is `0x10045c034`. The optional
`scripts/research/emulate-boat-fire.py` executes its fire branch
`0x10045c540..0x10045c6e4`, including the creation path at
`0x10045c870..0x10045c8cc`, with Unicorn 2.1.4. It requires the existing pinned
14,226,544-byte binary, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

External FX/event/explosion calls are logged stubs. The health/status/camera
branches, model position stores and timer arithmetic execute unchanged in the
native instructions. The 37 captured cases cover model selection, creation
failure, partial repairs, exact recovery boundaries, both camera axes and
signs, diagonal/altitude behavior, wrecking and strict explosion timing.
The real native creation call names `fire_car` and passes false for the
ignore-bounds flag. Regeneration is byte-identical; there is no new application
dependency or binary download.

Two differences stay explicit: iOS adds one unit to all three model fire Z
offsets, and truncates each added millisecond interval. This port keeps the PC
source positions and fractional float timer. The tests compare shared captured
ownership/gating behavior, and separately check the PC positions and timer;
they do not present the PC offsets or fractional timer as iOS capture matches.
Native event audience delivery is not implemented by these visual/timer
adapters. The capture's logged event calls do not establish NPC task parity.

## Integration checks

Fourteen new checks fail against the previous car routing. The repaired
focused suite passes the 37 captured ownership gates in WorldFx and the 37
camera/timer gates in WorldBoat, plus PC model points, camera boundaries,
particle velocity, partial-repair identity, creation retry and removal cleanup.
The existing boat fire/wake routing assertion now checks the boat-specific
path instead of requiring the old car behavior.

Browser validation loads the actual painted/textured Predator, Speeder and
Reefer through WorldBoat/WorldFx. Each stays fire-free beyond 200, creates
inside the diagonal square, emits the original fire particles at its PC offset,
retains the same system through health 300 and 460, resets at 461, starts a
fresh system when damaged again and clears it on destruction/removal. Timers
hold during partial repairs. No car overheat system is created; the native
fire has zero added vehicle velocity. All diagnostic GPU geometries and scene
children release, and no page errors occur.

Marquis hinge rendering, propeller-water effects, moored boarding/driving and
the whole-game SCM boat engine/audio lifecycle also pass their browser
regressions. Full original PC captures, event audience/occupant reactions,
complete status transitions and campaign recovery remain separate work.

All 242 focused checks, 6,774 unit tests (51 skipped) and final TypeScript/build
validation pass. Existing delayed-bomb attribution checks exposed an eager
camera-default evaluation before ProcessDelayedExplosion; camera lookup now
stays on the fire path and the full rerun passes.

Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, Rustler takeoff and landing gear, with no page
errors, failed requests or development inspection hook.
