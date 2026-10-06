/** What CVehicle::InflictDamage asks of the game beyond the car:
 * - whether CStats::GetPercentageProgress has reached 100, which takes the player's own car's share of the damage
 *   from 0.95 to 0.42;
 * - the name of the head of CTheScripts::pActiveScripts (STRAP3 quarters it again);
 * - STAT_COST_OF_PROPERTY_DAMAGED, which the player's harm adds to.
 * The host sets them. */
export const carDamageHost={fullCompletion:():boolean=>false,headScriptName:():string|undefined=>undefined,addPropertyDamage:(_dollars:number)=>{}};
