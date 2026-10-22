# Script smoke particle

`ADD_SMOKE_PARTICLE` (095C) now submits to the existing native FX engine. WUZI5 (mission 57) calls it at SCM
1525159 after its car explosion. Locals 144–146 are a randomized point around the car; 147–149 are velocity;
150–152 are zero RGB; 153 is float32 0.2 alpha; size and lifetime multipliers 154/155 are both 1.

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1002019a4` collects twelve values and copies position/velocity without axis or color conversion.
It constructs FxPrtMult_c at `0x100285788` with the supplied RGBA, size, rotation multiplier 1 and supplied
lifetime. It calls FxSystem_c::AddParticle (`0x100284a10`) with elapsed time 0, rotation angle -1, float32
brightness 1.2, float32 brightness limit 0.6 and local-particle creation false.

The system pointer is `0x100805bb8`, offset 0x40 from Fx_c at `0x100805b78`. In the static-system layout
(reversed Fx.h / Fx_c::InitStaticSystems, PC 49E660), this is `m_SmokeHuge`, the `prt_smoke_huge` blueprint.
The nearby smaller expanding-smoke system is a different field. There is no script-side ground substitution,
camera-distance test, RGB scaling or extra clamping.

The adapter forwards native tuples to WorldFx and NativeFxEffects. The shared AddParticle implementation
continues to apply FX-quality thinning, blueprint emission/forces/lifetime, rendering and the particle budget.
The trigger itself is source-backed; the existing particle engine's documented numerical, random and rendering
limits remain. Effects requested before the asynchronous FX package is ready retain the existing host behavior.

## Checks

The unit adapter check executes the original twelve-local WUZI5 instruction. The FX check verifies all native
arguments and uses the actual blueprint to check velocity, color, rotation multiplier, motion and expiry while
the static system remains alive. The browser check runs the original instruction through the live mission host,
checks large-smoke particles with black RGB/51 alpha and drawn quads, stops the thread and waits for expiry.
The existing FX pixel regression covers the shared explosion/fire/blood renderer. Full WUZI5 completion is
unverified.
