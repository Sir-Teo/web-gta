import type {WeaponInventory} from './Inventory';
/* AUTHORED, not the original: a new game in San Andreas starts CJ with nothing and INTRO clears his weapons again as
 * it ends (REMOVE_ALL_CHAR_WEAPONS after its $350). Here a new game hands him the whole arsenal, every clip full
 * with its reserve (the arsenal's own refill), and full body armour, and INTRO's closing clear-out gives it back. */
export const STARTING_LOADOUT=true;
/** The mission whose REMOVE_ALL_CHAR_WEAPONS on the player is followed by the loadout again. */
export const OPENING_MISSION='INTRO';
export function grantStartingLoadout(inventory:WeaponInventory,player:{armour:number},maxArmour=100){
 inventory.refill();
 player.armour=Math.max(player.armour,maxArmour);
}
