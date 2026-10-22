# Corpse hits use the death animation clock

The browser previously decided that a corpse had finished dying by comparing its removal age
with the current animation's nominal duration. CTaskComplexTreatAccident refreshes that removal
time while a medic treats the body. A completed corpse could therefore stop reacting to bullets
or blows. Conversely, a paused or slowed death animation could receive FLOOR_HIT before it ended.

The reversed CWeapon::GenerateDamageEvent (`0x73A530`) selects FLOOR_HIT or FLOOR_HIT_F only
when the simplest active task is TASK_SIMPLE_DEAD, with blood and kicking-when-down enabled.
It restarts the association and holds its last frame without another damage response. A dying
ped does not take this path. CTaskSimpleDie uses an animation finish callback; the elapsed
m_nDeathTimeMS value does not establish animation completion. CTaskComplexTreatAccident resets
that value in its control path to postpone corpse removal, without restarting the death task.
Reference: gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`, `Weapon.cpp`,
`Tasks/TaskTypes/TaskSimpleDie.cpp` and `TaskComplexTreatAccident.cpp`.

WorldPedestrians now uses NativeCharacter's actual reaction completion, including script speed,
playing and current-time edits. Once the first corpse hit is allowed, readiness remains latched
while FLOOR_HIT itself restarts. A fatal FLOOR_HIT must finish before that first corpse hit,
so the animation name alone cannot bypass the dying phase. Revival and a rebuilt death pose
clear readiness; ordinary living updates also clear it before a later death.

This corrects the existing authored death-task integration. The flag is not a complete native
CTaskSimpleDead/PEDSTATE implementation. Full association/event scheduling, localization
switches, prior corpse-pose transfer and all weapon/source combinations remain incomplete.

Four unit checks use real NativeCharacter animation clocks to cover stopped/slowed dying clips,
medical timer refreshes, repeated corpse hits, a fatal floor-hit clip and revival. The live browser
uses script animation-playing/current-time controls and the real medical hold function, verifies
the actual installed FLOOR_HIT_F reaction restarts, and confirms zero health and money are unchanged.
