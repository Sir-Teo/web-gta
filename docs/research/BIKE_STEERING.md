# Native motorcycle and bicycle fork steering

The thirteen supported motorcycles and bicycles now turn their imported front
fork around the model's steering axis. The wheel stays parented to the fork;
its rolling matrix composes beneath the steering transform. The quad remains
on its separate automobile path.

CFileLoader::LoadVehicleObject, PC 0x5B6F30, interprets vehicles.ide's integer misc
column as m_fBikeSteerAngle for BIKE and BMX models. It is a rake angle in degrees,
not a wheel model index for those types. The shipped models use 16 or 23 degrees.
Source: [FileLoader.cpp at the pinned PC reference](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/FileLoader.cpp).

The fork slice in ARM64 CBike::PreRender, 0x100455604–0x1004556f4, converts that
rake to radians and builds axis (0, sin(rake), -cos(rake)). It builds a quaternion
around this axis with angle -m_fSteerAngle, resets the fork matrix to identity,
applies the rotation and restores its original XYZ translation. This replaces
the imported rest orientation, including the six-degree resting rotation on
the Faggio and Pizzaboy forks. The host interpolates the previous and current
physics steering fractions and applies the handling steering lock.

Evidence uses the same pinned, hash-checked executable as the wheel-roll audit.
[The instruction and constant capture](bike-steering-capture.json) can be reproduced:

```
node scripts/content/capture-bike-steering.mjs [path-to-pinned-executable]
```

The live regression reproduced static fork matrices before this change. It now
loads all thirteen native models, supplies actual steering input, checks the
fork against its source rake/steering rotation, keeps its mounting translation
and wheel hierarchy, resets its native neutral basis, and checks interpolation
without repeated-update drift. Focused units cover the limiting upright and
horizontal axes, both steering directions, the real rake values, hierarchy and
mounting-point preservation. Existing wheel, riding, jump, knock-off and water
checks run alongside it.

This is the fork-transform integration. Native handlebar placement through the
rider's hand tasks, front/rear suspension articulation, mudguards, pedal cranks,
quad steering geometry and original bike dynamics remain outside this change.
There are no matched retail PC steering captures yet.

The final full unit run passes 5,389 tests with 51 skipped. All nine live fleet,
slope parking, pick-up, player/NPC boarding, pillion and warp-out regressions pass,
and the production build passes. Logs: `artifacts/native-bike-final-unit.log`,
`artifacts/bike-animation-regressions.log`, `artifacts/bike-steering-build.log`.
The standard Playwright configuration also passes the full native-model fork
and wheel checks with `PW_CHROMIUM_EXECUTABLE=/usr/bin/chromium`, without a
separate cloud configuration (`artifacts/standard-browser-config.log`).
