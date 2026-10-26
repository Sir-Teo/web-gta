# Bullet kill accounting for mission riders

Mission riders' bullet callback set health to zero and diedInSeat without
reporting the kill to the shared pedestrian handler. The rider was dead to the
script and renderer, but the normal kill/respect/group counters were omitted.

scriptRiderShot now accepts a death-transition callback. It runs only after an
accepted living-to-dead hit, with health zero and diedInSeat set. Protected or
surviving hits do not invoke it; subsequent corpse contacts remain accepted
without another callback. Both the NPC seated bridge and player seated damage
host connect it to the existing pedestrian kill handler.

The event retains CREATE_CHAR_INSIDE_CAR's actual ped type through
pedTypeInfo, independently of the model. Its recruit flag comes from the live
seated target's script-group membership. Player-ped, CJ-driven vehicle and
remote/NPC creators use the shared accounting branches established by the
[seated-creator fix](SEATED_BULLET_CREATORS.md).

Source: CEventHandler::RegisterKill (PC 0x4B9340),
CDarkel::RegisterKillByPlayer (0x43DCD0) and RegisterKillNotByPlayer (0x43D210).
CWeapon::GenerateDamageEvent (0x73A530) accepts an already dead victim without
a new live event. Pinned source:
[EventHandler.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventHandler.cpp),
[Darkel.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Darkel.cpp),
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp).

Units verify callback timing and once-only reporting across proof rejection,
surviving damage, fatal damage and repeated corpse contacts. Live mission
riders in civilian bodies cover civilian, COP and GANG1/GANG2 types, player
group membership, player-ped/vehicle/remote/NPC sources, protection, death as
seen by the script, blood and repeat accounting. Mounted sources use the public
scripted Hunter-gun path with fixture source metadata; the player-ped case
isolates the existing seated damage adapter. These are not matched retail
captures or a complete player-input recording.

This routes seated bullet deaths through the host's existing basic kill,
respect, checkpoint, group and gang counters. Full Darkel coverage, native event
dispatch timing, other death/damage entry points, complete damage/armour/forced
death, opaque NPC shooter/group identities and matched PC captures remain open.
