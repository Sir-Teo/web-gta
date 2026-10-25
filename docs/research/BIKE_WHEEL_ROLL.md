# Motorcycle, bicycle and quad wheel motion

The original imported wheels no longer stay static while the bike moves. Wheel
frames roll about native X, retain their original local positions, scale and
parents, and interpolate physics angles without accumulating matrix drift.
Bikes have one wheel per axle and the quad has two.

The shared scalar is CVehicle::ProcessWheelRotation, PC 0x6D1230: NORMAL and
SKIDDING return negative projected velocity divided by radius; SPINNING returns
-1.1 and FIXED returns zero. Source: [Vehicle.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Vehicle.cpp).

CBike::PreRender is an executable wrapper in that PC reference. Its ARM64 body
was inspected at 0x100454ee0 using the pinned executable and address mapper in
`scripts/content/lib/ios-executable.mjs`. SHA-256:
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The wheel slice at 0x1004554b4–0x100455600 advances an axle only when one of its
contact counts is positive. The front always passes NORMAL, the rear its own
wheel state. Each radius is half the model's vehicles.ide wheel diameter; the
returned speed is multiplied by the native timestep and added to the stored
angle. The ordinary non-burst wheel matrices use SetRotateX with those angles
at 0x10045589c and 0x100455978. Burst-wheel wobble remains outside this change.

The capture is inspectable in [bike-wheel-roll-capture.json](bike-wheel-roll-capture.json).
Reproduce its hash and instruction guards with:

```
node scripts/content/capture-bike-wheel-roll.mjs [path-to-pinned-executable]
```

WorldBike supplies its existing front/rear ground probes and projected body
velocity. The quad uses the existing automobile wheel-animation step, including
its driven airborne branch. Braking holds rear wheel angles while the front
continues to roll. Frozen vehicles hold their current pose. Playback and script
vehicles use their body's movement without acquiring player controls.

This is a wheel-rendering integration, not complete native suspension or
contact simulation. Body velocity stands in for the original per-contact point
velocity, and the quad shares an axle probe between its left and right wheels.
Steering forks, handlebars, pedal cranks, burst wobble and suspension articulation
remain separate work. The existing authored bike dynamics remain unchanged.

The real-model browser regression failed before the fix because all wheel
matrices stayed static. It now checks all fourteen supported motorcycle, bicycle and quad models for
wheel rotation,
center preservation, repeatable interpolation and rear braking. Five existing
bike riding/knock-off/water/jump checks and two passenger cases pass alongside it.
Unit checks cover native forward/reverse/state/contact/timestep behavior and
matrix scale, hierarchy and center preservation for both two and four wheels.
Evidence: `artifacts/bike-wheel-before.log`, `artifacts/bike-wheel-browser.log`,
`artifacts/bike-wheel-motion.json`, `artifacts/bike-wheel-unit.log` and
`artifacts/all-bike-wheels-browser.log`.

The full post-change unit run passes 5,387 tests with 51 skipped; the production
build passes. Logs: `artifacts/wheel-regression-unit.log` and
`artifacts/bike-wheel-build.log`.
