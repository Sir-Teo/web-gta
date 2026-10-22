# Delayed vehicle explosion creators

Bikes, boats and aircraft previously kept the delayed explosion timer without
its creator. Their main-loop blast therefore ran as non-player damage even when
CJ's blast destroyed the vehicle. Aircraft follow-up rockets also lost the
creator supplied to their initial explosion.

These vehicles now keep player attribution when arming the timer, pass it through
timer expiry and expose it with the pending explosion. The main loop supplies it
to the weapon system; the existing aircraft follow-up path retains it too.
Immediate motorbike/boat weapon destruction uses the same pending-explosion
field. Scripted destruction without a creator defaults to non-player damage.

The timer creator is separate from the last damage entity. InflictDamage always
writes its supplied creator to the bomb field, including null; it must not reuse
a previous attacker retained by a later source-less hit. The host currently
preserves the player/non-player distinction, without introducing full native
entity-reference registration for NPC creators.

`scripts/research/native-vehicle-bomb-creator.py` captures the pinned iOS executable
in Unicorn 2.1.4, verifying SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`:

- Twenty cases execute InflictDamage's timer/creator fragment at
  `0x1004787c4`–`0x10047880c`, supplying only rand and reference registration.
  They cover null, player, player vehicle and another creator, with five random
  values. The native timer is `(rand & 0x7ff) + 1000`; a null creator replaces
  the old pointer without registering a reference.
- Fifty-two cases execute all of ProcessDelayedExplosion at `0x1004788f8`.
  Only the virtual BlowUpCar call is intercepted. Native arithmetic, the timer
  store and creator passed to destruction all execute. Cases include zero and
  expired timers, fractional steps, boundary rounding and negative/large steps.
- The timer uses a float32 step and scale, a float32 product and unsigned
  truncation. The shared helper now follows those operations. For example,
  step 0.06 subtracts zero, whereas the old double calculation subtracted one;
  a negative step cannot increase the timer.
- The pinned PC ProcessDelayedExplosion also passes m_pWhoDetonatedMe to
  BlowUpCar. Explosion.cpp's aircraft follow-up branch explicitly passes the
  original m_pCreator to the new rocket explosion.

Seventy-seven regression cases failed before the change. All 124 new cases now
pass, including live-class timer/destruction handoff and actual blast damage
callbacks with both creator types. All 4,382 unit tests pass (51 skipped) and
the build passes. `tests/browser/delayed-vehicle-blast.spec.ts` passes all six
live cases: a PCJ-600 motorbike (model 461), Tropic and Maverick, each with
player and non-player creators. Controlled rocket blasts arm the real timers;
the normal main loop emits the secondary explosions with the same creator type
and a zero timer. The test preserves the original explosion callback and records
its observations in `artifacts/delayed-vehicle-blast.json`. These are controlled
blast fixtures, separate from the actual RPG input/collision check in SYN6.

General fire-creator ownership, NPC identity/reference lifetimes and other
aircraft destruction paths retain their existing coverage. This change does not
establish a complete mission play-through. See also the captured
[weapon damage gates](VEHICLE_DAMAGE_GATES.md) and the later
[destruction immunity/status captures](VEHICLE_DESTRUCTION_GATES.md). The latter
cover protected timer expiry and destruction after nearby-fire cleanup restores
health, while retaining the creator handoff described here.
