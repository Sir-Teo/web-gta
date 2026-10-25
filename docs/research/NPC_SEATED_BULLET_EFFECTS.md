# NPC bullet effects on seated pedestrians

The shared NPC seated-shot adapter now emits the pedestrian impact after its
damage callback reports an accepted hit. This covers CJ, mission riders, and
recruited passengers reached by foot guns, scripted/gang drive-bys, or mounted
NPC guns. Cars, boats and aircraft use the existing vehicle-to-head handoff;
exposed bike riders retain the animated sphere's body piece and normal.

CWeapon::DoBulletImpact (PC 0x73B550) calls DoBulletHitFx before
GenerateDamageEvent, then emits blood only for accepted damage. The head rule
is 16 particles while alive and 32 after death; body hits use eight, or four for
accumulated shotgun damage. The contact normal for a vehicle handoff is the ray
entry point relative to the lifted head sphere, as in the existing player path.
Source: [Weapon.cpp at the pinned reverse-engineering revision](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp).
See [the on-foot impact work](NPC_BULLET_IMPACTS.md) and
[native bike collision](BIKER_BULLET_COLLISION.md) for the existing routing.

WeaponSystem.hitNpcSeatedBullet performs the pedestrian contact audio callback,
applies damage, then forwards accepted blood through WorldFx. It leaves player
crime, weapon practice, and building-shot callbacks alone. The same callback
still applies damage without FX assets. Simulation's acceptance result now
passes through the foot shooter's player-damage callback, preserving its
friendly-fire checks. A script rider marked only-damaged-by-player returns a
rejection for an NPC source rather than the previous misleading hit result.

The host's existing seat death tasks and callbacks still own health and death
handling. Contact preparation stores geometry before those callbacks can remove
an occupant from the live seat list. Direct bike pieces stay distinct from a
transferred car head; the passenger head-death predicate explicitly requires
piece 9.

Unit verification checks native head/body/shotgun counts, rejection, contact
audio before damage, blood afterward, and actual CJ armour/fatal/proof/safe
damage. Live fixtures use the public scripted Hunter-gun command through real
drawn car and motorcycle occupants, including protected mission riders and CJ.
The existing real-cop, recruit death/exit, and player car/bike tests check that
the routing preserves the existing health, collision and death behavior.

Full damage calculator and force-death parity, persistent script-rider physical
proof flags, NPC damage to ambient traffic/police/drive-by crews, same-type and
group identity for opaque creators, contact brightness, localisation, and
matched retail PC captures remain open. This does not establish full native
occupant combat or task parity.
