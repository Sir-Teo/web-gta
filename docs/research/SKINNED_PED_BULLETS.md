# Animated pedestrian bullet collision

On-foot bullets previously hit the movement capsule and inferred the body piece
from height and side. A raised arm or even a torso sphere above 1.45 metres
could therefore count as a head shot. Capsule gaps registered hits, and exposed
limbs beyond that capsule could be missed.

CWorld::ProcessLineOfSightSectorList selects AnimatePedColModelSkinned for an
eligible pedestrian. The model supplies the twelve captured spheres described
in [BIKER_BULLET_COLLISION.md](BIKER_BULLET_COLLISION.md). Each sphere follows
its current animation bone and carries its native body-piece ID.

AnimatePedColModelSkinned (PC 0x4C6F70) updates its bound box to 1.2 units on each
local axis around BONE_SPINE1 (bone 3). CCollision::ProcessLineOfSight transforms
the ray into entity space, tests that box, then tests the spheres. Its bound
sphere is not a rejection gate in this routine. ProcessLineSphere (0x412AA0)
ignores a line starting inside/on a sphere and requires an intersection before
the current closest distance. The native-ped helper now follows those gates.

Sources at revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:
[World.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/World.cpp),
[PedModelInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Models/PedModelInfo.cpp),
[Collision.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Collision/Collision.cpp).

The shared trace replaces eligible ped capsules for bullet queries and compares
native sphere entries with the physical world's first opaque hit. Existing
shoot-through, own-body, passed-victim, disabled-collider and sensor exclusions
apply. Bone spheres are read only after the animated bound box intersects the
remaining ray. A loaded clump must have a sampled world pose and all required
bones before it supplies native collision; other actors retain the physical
fallback. Movement continues through the character controller.
Newly created peds receive their world pose before entering native queries;
that initial sampling preserves their locomotion clock and randomized phase.

WeaponSystem's handheld, flying-sniper and mounted queries, foot NPC guns and
their shotgun pellets, scripted drive-bys and gang-car shooters use this trace.
CJ contributes his drawn skeleton while his on-foot collider is enabled. The
existing bike/body and car/head transfer still handle seated occupants.
Gang-car rounds intercepted by another ped now reach the shared NPC damage
adapter as well.

The native piece reaches vest protection, critical-death selection, pedestrian
damage reactions, player damage events and blood classification. Melee and
legacy adapters without a supplied piece retain their existing selector.

Verification uses actual Rapier rays, original models and actual weapon firing.
MALE01, LAPD1 and FAM1 take measured torso, arm and leg shots in idle and hands-up
poses, preserve capsule gaps and cover, take sniper damage once and die to an
exposed head shot. Raised arms at 1.49–1.54 metres take ordinary damage. CJ's
torso/arm/leg/head receive mounted rounds with the correct damage-event piece
and armour loss; proof flags, cover and gaps stop damage, and a real cop's muzzle
ray hits his native torso. Units also cover rotated bounds, nearest victims,
shoot-through surfaces, lazy bone queries, sphere boundary gates, vest/critical
piece precedence and scripted drive-by propagation.

This ports collision and piece propagation in these paths. Native eligibility
flags and task scheduling still use the host's adapters. Complete damage
calculators, shotgun spread/col-model expansion, area/projectile geometry,
automatic-aim selection, native contact lighting/audio and matched retail PC
captures remain open. Table provenance and platform limitations remain those
documented with the sphere capture.
