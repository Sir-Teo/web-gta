import type {TouchWidgetArt} from './touchWidgetArt';
/* The attack widget's picture (widget_attack, CTouchInterface's widget 1). Its update (iOS arm64 0x1004b0e68) reads the
 * player's weapon in hand, m_aWeapons[m_nActiveWeaponSlot].m_eWeaponType, and for a type up to 46 whose bit is set in
 * 0x77a00007ffff takes the texture the table at 0x1005c2f00 names for it; anything else, a gun, the rocket launchers,
 * the minigun, the camera or no player, draws "shoot". The HUD's weapon icon is not it. */
const THROW='hud_throw' as const;
/** The table at 0x1005c2f00, by weapon type: the fist, each melee weapon's own, "hud_throw" for the thrown ones. The
 * guns stand at "hud_throw" too, but the mask never lets the update read them. */
const BY_WEAPON:readonly TouchWidgetArt[]=['punch','brassknuckle','hud_golfclub','hud_nightstick','hud_knife','hud_bat','shovel',
 'hud_poolcue','hud_katana','hud_chainsaw','hud_dildo1','hud_dildo1','hud_dildo2','hud_dildo2','hud_flowers','hud_cane',
 THROW,'hud_teargas',...Array<TouchWidgetArt>(19).fill(THROW),'flamethrower',THROW,THROW,'hud_detonator','hud_spraycan',
 'hud_extinguisher',THROW,'goggles','goggles','punch'];
/** The weapon types the update reads the table for: 0 to 18 (the fist, the melee weapons, grenade, tear gas,
 * molotov), 37 (flamethrower), 39 to 42 (satchel, detonator, spraycan, extinguisher) and 44 to 46 (the goggles and the
 * parachute). */
const TABLE_MASK=0x77a00007ffffn;
/** The attack widget's picture for the weapon type in the player's hand, or for no player. */
export function attackWidgetArt(weaponType:number|undefined):TouchWidgetArt{
 if(weaponType===undefined||!Number.isInteger(weaponType)||weaponType<0||weaponType>=BY_WEAPON.length)return 'shoot';
 return (TABLE_MASK>>BigInt(weaponType))&1n?BY_WEAPON[weaponType]:'shoot';
}
