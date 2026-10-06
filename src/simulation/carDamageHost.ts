/** What CVehicle::InflictDamage asks of the game beyond the car: CStats::GetPercentageProgress reaching 100, which takes
 * the player's own car's share of the damage from 0.95 to 0.42. The host sets it. */
export const carDamageHost={fullCompletion:():boolean=>false};
