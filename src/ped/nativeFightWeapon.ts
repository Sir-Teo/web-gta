/** CPed::GiveWeaponAtStartOfFight (0x5E8AB0): a ped not made by a mission, unarmed, draws by m_nRandomSeed % 1024:
 * a gang member (PED_TYPE_GANG1 to GANG10) a pistol under 400 (39 in 100); a dealer, criminal or prostitute a knife
 * under 200, else a pistol under 400. Anyone else stays as they are. The weapon comes with 50 rounds
 * (GiveDelayedWeapon). The ped type is peds.ide's name without its PED_TYPE_ prefix. */
export const WEAPON_PISTOL=22,WEAPON_KNIFE=4;
export function weaponAtStartOfFight(pedType:string|undefined,seed:number):number|undefined{
 if(!pedType)return undefined;
 const roll=((Math.trunc(seed)%1024)+1024)%1024;
 if(/^GANG([1-9]|10)$/.test(pedType))return roll<400?WEAPON_PISTOL:undefined;
 if(pedType==='DEALER'||pedType==='CRIMINAL'||pedType==='PROSTITUTE'){
  if(roll<200)return WEAPON_KNIFE;
  return roll<400?WEAPON_PISTOL:undefined;
 }
 return undefined;
}
