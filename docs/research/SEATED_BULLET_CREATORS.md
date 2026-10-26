# Seated bullet creators: protection, scaling and recruit kills

WeaponSystem already distinguished player-ped, CJ-driven vehicle and remote
vehicle creators for crime reporting. Its seated damage callback dropped that
distinction, treating every player-attributed mounted round as a player ped.
That let remote guns bypass only-damaged-by-player protection and incorrectly
gave vehicle rounds the follower-friendly damage reduction and full player-ped
recruit kill accounting.

The callback now carries its creator alongside the native body piece.
Mission-rider protection resolves an only-player source for a player ped or a
vehicle driven by CJ; a remote vehicle cannot satisfy it. Recruited passengers
keep the same protection rule, but their friendly damage reduction applies only
to a raw player-ped creator. Vehicle and remote wounds retain victim weakness
without the 0.1/cap-12.5 group reduction. Physical bullet proof remains separate
and blocks all three sources.

Fatal recruited-passenger hits carry this creator into the existing kill
handler. A player-ped kill uses the existing Darkel player path; a CJ-driven
vehicle increments only STAT_PEOPLE_YOUVE_WASTED; a remote source uses the
existing nonplayer path. Repeated hits cannot recount the retained death.
Legacy callback callers without creator metadata keep their existing ped/NPC
classification.

Source and limits:

- CEventDamage::GetSourceEntity (PC 0x4ADA70) unwraps a vehicle's driver.
  AffectsPed (0x4B35A0) uses that resolved source for bInvulnerable. IsCriminalEvent
  separately admits a vehicle driven by CJ.
- CEventHandler::RegisterKill (PC 0x4B9340) distinguishes a player ped, the
  player's vehicle, and all other sources. CDarkel::RegisterKillNotByPlayer
  (0x43D210) handles the nonplayer recruit and gang counters.
- AccountForPedDamageStats remains an executable wrapper at PC 0x4AD430.
  The existing iOS reference's 0x10028a070 multiplies victim weakness first,
  checks the raw creator's entity type at 0x10028a14c–0x10028a15c, and skips
  the ped group reduction for a vehicle. Its reduction at 0x10028a18c is
  float32 0.1 with a 12.5 cap. This is explicit mobile evidence, not a matched
  retail PC damage-calculator capture.

Pinned PC sources:
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp),
[EventHandler.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventHandler.cpp),
[Darkel.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Darkel.cpp).

Units verify creator propagation from ordinary, sniper, driven and remote
mounted fire; protected/unprotected recruit health; and once-only fatal
callbacks. Live real-aircraft and public scripted-gun cases exercise routing
and blood. A separate live damage-adapter fixture isolates the three creator
classes and checks health, respect, player/other kills, checkpoint kills and
recruit/gang counters before and after a repeated fatal call. The isolated
adapter fixture supplies source metadata directly; it is not an end-to-end
player-ped firing/input capture.

This closes the named creator distinctions in these seated bullet adapters.
Full native calculator/armour/critical-death behavior, mission-rider kill-stat
coverage, opaque NPC shooter/group identities, other damage paths, lighting
and matched PC captures remain open.
