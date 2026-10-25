# Pedestrian bullet blood after damage

On-foot bullet effects previously supplied head=false and dead=false before
applying damage. Head shots used the ordinary eight-particle effect, rejected
instant-hit damage still drew blood, and corpses missing from the living target
list could produce a surface effect. Vehicle-to-head transfers also omitted
blood in the ordinary handheld and flying-sniper paths.

The PC reference distinguishes two routines:

- CWeapon::DoBulletImpact (0x73B550) emits blood only when GenerateDamageEvent
  accepts the hit. It samples health after that call: a head hit emits 16
  particles for a survivor or 32 for a dead victim. Other pieces emit eight,
  or four for an accumulated shotgun hit (incrementalHit is negative).
- CBulletInfo::Update (0x7360D0) emits eight particles for every ped piece,
  independently of GenerateDamageEvent's result. Bullet-proof victims and
  corpses therefore retain this effect for the flying sniper path.

GenerateDamageEvent (0x73A530) returns true for an already dead ped, including
while its death task is running. The corpse's floor-hit animation gates are
separate from this blood decision.

Sources at revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp),
[BulletInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/BulletInfo.cpp).

WorldPedestrians now exposes bullet-impact state for living and dead actors,
using the same damage-piece selector as its damage calculation. WeaponSystem
retains object/audio notifications before damage, but defers the ped's visual
effect until afterward. Instant-hit rejection suppresses living-ped blood;
sniper hits keep their independent eight-particle rule. Ordinary and sniper
vehicle-to-head transfers emit the corresponding blood effect too. The direct
biker shotgun path now supplies four particles for body pieces and respects a
rejected instant-hit damage result. Damage still executes when FX is absent.

This changes effect timing/classification in these WeaponSystem paths. The
later [animated on-foot trace](SKINNED_PED_BULLETS.md) supplies native collision
pieces to these effects; melee and legacy adapters retain their fallback.
The later [NPC impact adapter](NPC_BULLET_IMPACTS.md) covers ordinary foot,
drive-by and mounted physical hits. The [NPC seated adapter](NPC_SEATED_BULLET_EFFECTS.md)
adds CJ, mission-rider and recruited-passenger effects. Native contact
brightness, localisation, corpse/task acceptance and original PC render captures
remain separate work.

Units drive actual weapon rays through Rapier and through WorldFx's blood
selection. They verify surviving/fatal head hits, shotgun accumulation,
rejection, corpses, sniper proof behavior, vehicle-to-head transfer and absent
FX, including notification/damage/blood order. The live regression forwards the
actual NativeFxEffects.blood call while recording particle count and victim
health across seven cases.

All seven live cases pass without page errors. Direct bike-rider, mounted
player-gun, on-foot crime and seated-sniper regressions also pass. The sniper
fixture waits for its one-second bullet lifetime on the simulated weapon clock,
with a bounded wall-clock wait, so terrain-loading holds do not masquerade as
projectiles that failed to expire.
