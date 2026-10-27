# Quad and motorbike training ownership

WorldBike.motorbike distinguishes pedal bicycles from motor-driven rides in
the host. It also returns true for the quad. Using that property alone to
call UpdateStatsWhenOnMotorBike incorrectly trains bike skill 229 while
riding a native automobile quad.

The live regression exposes this before repair: a real model-471 ride with W
invokes motorbike training 45 times. Seeding only its award counter to 180001
makes the ordinary task award bike skill 0→25. Evidence is
`artifacts/motorbike-training-dispatch-471-before.json` and
`artifacts/motorbike-training-dispatch-before.log`.

## Source and independent routing capture

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
declares CQuadBike as a CAutomobile. CVehicle::GetVehicleAppearance
(PC `0x6D1080`) selects appearance from handling model flags. Packaged
QUADBIKE flags are `0x281300`, BIKE `0x1002000` and BMX `0x41000000`.
The harness verifies those values against handling.cfg and records its hash.

The selected CPlayerInfo routing block (`0x100254df8` through its original
continuation `0x100254770`) and actual GetVehicleAppearance
(`0x100476ec0`) execute unchanged. The three training callees are logged
stubs; no appearance, speed or routing arithmetic is stubbed. A valid current
vehicle/player context is declared. The pinned 14,226,544-byte binary has
SHA256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

Eighteen captured profiles cover stopped/moving quad, motorbike, BMX, automobile
and train contexts, including signed/directional and float32-underflow
motorbike speed inputs. The moving quad routes to driving, the motorbike to
motorbike training, and the BMX/train contexts skip these callees in this
block. Cycling has its own caller. Zero native speed skips all three here.
This is a routing-block capture, not complete CPlayerInfo::Process or an
independent original-PC execution.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-vehicle-training-dispatch.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/vehicle-training-dispatch-regenerated.json
cmp tests/fixtures/vehicle-training-dispatch-reference.json artifacts/vehicle-training-dispatch-regenerated.json
```

## Host repair and validation

The motorbike-training branch now excludes WorldBike.quad. The broad host
motorbike property retains its other uses. Quad driving-skill training
continues through the captured automobile counter; the native motorbike
counter and caller were initially otherwise unchanged. Subsequent
[captured motorbike training](MOTORBIKE_STAT_TRAINING.md) now ports the
counter precision, exact-zero gate, four-point contact mapping and saved
skill ownership.

All 368 focused stat/training/progression/ride checks and TypeScript validation
pass. The new browser checks use real original vehicle creation/driver warp
and W acceleration. They compare owner selection with the independent native
fixture; only threshold counters are seeded, never stat results. The quad
check now records no motorbike calls or bike-skill gain. The existing car/quad
driving award/save/reload check passes too.
The positive PCJ-600 check still receives the normal 25-point motorbike
award through the actual caller. All three browser checks pass (1.6 minutes),
without page errors. Evidence is
`artifacts/motorbike-training-dispatch-browser.log` and the per-model JSON
traces. The preceding complete unit baseline is 9,215 passed/51 skipped;
this single-condition caller change uses the focused and live regressions.
Final TypeScript validation, production build and production smoke pass.
Smoke verifies save resume, walking, car entry, map waypoint, pause/resume,
aircraft takeoff and landing gear without page errors or failed requests.

Full CPlayerInfo scheduling, all appearance/owner cases and original-PC
matching remain separate work. These checks do not establish complete native
motorbike training arithmetic or complete vehicle physics.
