# Native particle effects (effects.fxp)

The playable world loads `models/effects.fxp` and `models/effectsPC.txd` from the packaged world resources and runs the San Andreas FX system on them: 82 systems, 161 emitter prims and 36 rasters.

## Transcribed from the reversed game

Source: gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`, `source/game_sa/Fx`.

- **Loading** (`src/assets/fxProject.ts`): `FxManager_c::LoadFxProject`, `FxSystemBP_c::Load` (version 109 fields, cull distance in 256ths, bounding sphere), `FxPrimBP_c::Load` (buffered prim matrix in int16 32767ths, four texture slots, blend IDs), `FxEmitterBP_c::Load` (LOD start/end in 64ths) and `FxInfoManager_c::Load` (TIMEMODEPRT only after emission infos). Each info uses its constructor's channel count and key storage: float keys, int16 thousandths (`FxInterpInfo32_c`), uint16 256ths (`FxInterpInfoU255_c`) or int16 128ths (`FxInterpInfo255_c`). Key times are uint16 256ths. Every channel rewrites the shared time array, so the last channel's times win.
- **Info evaluation**: every `FxInfo*_c::GetValue`, including time-mode-particle selection (`currentTime / length` otherwise), emission rate integration with the loop wrap, friction `pow(f, dt * 50)`, wind through `SetWindData`, jitter, noise, force, attract point and line.
- **Systems**: `FxSystem_c::Play`, `PlayAndKill` (only play mode 0), `Stop`, `Kill`, `Pause`, `SetConstTime`, `SetRateMult`/`SetTimeMult` (thousandths), `SetVelAdd`, `CopyParentMatrix`, `GetCompositeMatrix` and `AddParticle` (surface lighting below 0.6 lowers brightness to `1 - 0.6 + light`).
- **Emission**: `FxEmitter_c::CreateParticles` (LOD visibility, rate multiplier, wind/rain ranges, whole particles with sub-frame time, accumulator cleared afterwards) and `FxEmitter_c::CreateParticle` (life bias, box or sphere position, cone direction via `RotateVecIntoVec`, velocity override, `VelAdd`), plus the 1000-particle pool and `FreeUpParticle` for must-create systems.
- **Triggers**: `Fx_c::InitStaticSystems`, `CExplosion::AddExplosion` system selection and the four fuel bursts during the first 200 ms, `CFire::CreateFxSysForStrength`, `CWeapon::DoWeaponEffect` (`CreateMatFromVec`, copied parent, must-create, constant time 1), `CWeapon::AddGunshell`, `CVehicle::AddDamagedVehicleParticles` (650–250 health, constant time from health), `CAutomobile::ProcessCarOnFireAndExplode` fire at the engine dummy, `CVehicle::AddExhaustParticles`, `CAutomobile::DoHeliDustEffect`, damaged-aircraft overheat smoke and fire (authored bands at 65%/25% of the 800-health pool through the same car systems, fuselage-centre anchor; plane smoke ejectors are not reversed), and `cBuoyancy::AddSplashParticles` for aircraft and cars in water (`SimpleCalcBuoyancy`'s splash edges, where both footprint samples have the water line between half height and the top of the adjusted bounds, including the original's +X edge that reads the +Y row; `prt_watersplash` particles every half unit along the edge, pushed out from the body at the move speed capped to 0.1 units per frame and thrown up at 120 times the fall speed, `FxPrtMult_c(1, 1, 1, 0.1, 0.5, 1, 0.2)`, at the native 30 fps frame rate).

## Reconstructed (not reversed upstream)

These addresses are still `plugin::Call` in gta-reversed; the browser behaviour is a documented reconstruction that feeds the native blueprints:

- `FxSystem_c::Update` (0x4AAF70): time advance, one-shot stop/kill, loop wrap with the loop interval, cull distance, and the kill handshake implied by `FxEmitterBP_c::Update` (killed → waiting; destroyed once no particle resets it).
- `FxEmitterBP_c::UpdateParticle` (0x4A21D0): life, movement infos, Euler integration, ROTSPEED per-particle direction and speed, float (clamp to water) and underwater (die when crossing the surface) handling. Ground collision reflects with BOUNCE, SPEEDMULT and BOUNCEERROR; the reversed body does not type-check dimensionally.
- `FxEmitterBP_c::Render` (0x4A2C40): screen-aligned quads rotated by the particle angle, SPRITERECT corners in size units, DIR/velocity-aligned quads, velocity trails (world trails read TRAILTIME as native frames, screen trails as milliseconds), FLAT quads, ANIMTEX raster slots, COLOURRANGE per channel random, COLOURBRIGHT symmetric brightness bias, size bias with one shared random, and non-self-lit particles scaled by `FxManager_c::Render`'s `(1 - DN balance) * 0.6 + 0.4`. Heat haze prims draw only as faint quads, their alpha capped at 26 (`src/render/NativeFxRenderer.ts`); the distortion pass is not implemented.
- `FxInterpInfo*_c::GetVal` integer variants (same piecewise-linear search as the float version) and `FxInterpInfoFloat_c::GetVal(attrib, time, delta)` as the rate integral.
- `Fx_c::AddBlood`, `AddSparks`, `AddBulletImpact`, `AddDebris` and `TriggerGunshot`: particle counts, colours and speeds are reconstructions; surfaces pick their `SURFINFO.DAT` BULLET_FX column.

Known gaps: the heat-haze distortion (`CPostEffects::HeatHazeFX` is not drawn), wading feet emitting `water_splsh_sml` on an authored stride cadence because `TriggerFootSplash` is not reversed, wake particles, wood shatter and the prt_smoke render path (no SMOKE infos exist in the PC file). Boats are drivable now, with their spray, stern splashes and wake ribbon ([playable boats](PLAYABLE_BOATS.md)); glass shards come from the `CGlass` port (`src/simulation/nativeGlass.ts`); and `CWeather`'s wind and rain (`src/world/nativeWeather.ts`) reach the FX manager through `WorldFx.weather`.

## Verification

- `tests/fx-project.test.ts`: all 82 systems and 161 prims parse; quantized keys, info offsets, bounding spheres and prim matrices match the native storage.
- `tests/native-fx.test.ts`: one-shot explosion burst and self-destruction, pool cap, LOD/cull, overheat constant time, AddParticle brightness and colour storage, flamethrower emission direction and kill handshake.
- `tests/browser/native-fx.spec.ts` renders a car explosion with fuel bursts, flamethrower and blood through WebGL (`artifacts/native-fx.png`).
- In-game probes: rocket and molotov explosions, M4 impacts and shells, car overheat smoke → fire at the engine dummy → explosion_medium, flamethrower, extinguisher and spray can mists, and exhaust puffs while driving.
