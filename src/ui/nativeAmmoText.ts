/* CHud::DrawAmmo (0x5893B0, Hud.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 * The ammo readout under the weapon icon: the rounds outside the clip, a dash and the rounds
 * in it, in light blue with a one-pixel black edge. A weapon whose clip is 1 or 1000 or more
 * shows its total alone; the flamethrower counts in tens. Nothing is drawn for fists, the
 * detonator, the gifts, the cane, the parachute, USE weapons, slot 0 and 1 (melee) weapons,
 * or 9999 rounds and more outside the clip. */

/** eWeaponType values DrawAmmo skips outright. */
const NO_AMMO_TYPES=new Set([0,40,10,11,12,13,14,15,46]);
const MAX_CLIP=9999,FLAMETHROWER=37;
export function hudAmmoText(o:{type:number;clipSize:number;inClip:number;total:number;fire?:string;slot?:number}){
 const outside=o.total-o.inClip;
 if(outside>=MAX_CLIP||NO_AMMO_TYPES.has(o.type)||o.fire==='use'||o.slot!==undefined&&o.slot<=1)return undefined;
 if(o.clipSize<=1||o.clipSize>=1000)return String(o.total);
 if(o.type===FLAMETHROWER)return `${Math.min(MAX_CLIP,Math.trunc(outside/10))}-${Math.trunc(o.inClip/10)}`;
 return `${Math.min(MAX_CLIP,outside)}-${o.inClip}`;
}
