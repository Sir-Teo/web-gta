# Player bullet contact audio on seated pedestrians

Player instant-hit, mounted and flying-sniper seated branches emitted blood
without calling the pedestrian contact audio hook. They now report SURFACE_PED
contacts through the existing native collision audio host, including direct
biker body pieces and a vehicle's transferred head.

CWeapon::DoBulletImpact (PC 0x73B550) calls DoBulletHitFx before the accepted
damage calculation. For the primary/accumulated hit, its contact sound requires
dot(normalized shot direction, hit normal) < 0, with asin(-dot) in degrees.
CBulletInfo::Update (PC 0x7360D0) reports a flying sniper contact after damage
and blood, using the same facing condition. Its blood rule remains eight
particles regardless of head piece or damage acceptance.

The seated paths share the facing/angle reporter; ordinary and mounted hits
call it before damage, and the two sniper branches call it after blood.
Transferred-head geometry is captured before a fatal callback can remove the
occupant from the live seat list. The existing NPC seated helper also uses
the facing condition. Tangent/back-facing contacts retain their damage/blood
behavior without a contact sound. Proof rejection still produces ordinary
contact sound because DoBulletHitFx precedes GenerateDamageEvent; the NPC
same-type exclusion remains earlier and silent.

Pinned sources:
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp),
[BulletInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/BulletInfo.cpp).

Units drive actual Rapier contacts and check audio/damage/blood order, protected
hits, mounted head/body angles, and facing rejection. Eight live original-car
and motorcycle cases use the public player weapon API with controlled muzzle
and spread, recording actual blood and contact callbacks for pistol/sniper,
protected/unprotected heads and body pieces. Sniper cleanup waits on the native
weapon clock. Each measured seated hit preserves vehicle health. The live
mounted, NPC type/impact, kill and crime regressions check the shared routing.

This closes contact reporting in these seated branches. Timing of the existing
physical-collider sniper audio adapter, complete native contact lighting,
sound mixing/localisation and matched retail audio/render captures remain
separate acceptance work. The controlled-muzzle fixture is not a complete
player-input recording or an auditory comparison with retail.
