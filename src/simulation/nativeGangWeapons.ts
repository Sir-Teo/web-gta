/* CGangs (gta-reversed ead3051): each gang's three weapon choices. CGangs::Initialise sets the defaults; the script's
 * SET_GANG_WEAPONS overrides them (main.scm's MAIN thread gives the Families a Desert Eagle, an MP5 and a knife;
 * later missions change them). CPopulation::AddPed hands a third of the gang members it spawns a random one of
 * the choices that are not unarmed (CGangInfo::GetRandomWeapon). Weapon ids are eWeaponType. */
export const WEAPON_UNARMED=0;
/** By eGangID: Ballas, Grove (Families), Vagos, Rifa, Da Nang Boys, Mafia, Triad, Aztecas, two unused. */
export const DEFAULT_GANG_WEAPONS:readonly (readonly [number,number,number])[]=[
 [22,28,0],[22,0,0],[22,0,0],[22,28,0],[24,0,0],[22,30,0],[22,28,0],[0,0,0],[0,0,0],[0,0,0],
];
/** main.scm MAIN: SET_GANG_WEAPONS 1 24 29 4 (the Families' Desert Eagle, MP5 and knife). */
export const SCRIPT_GANG_WEAPONS:Readonly<Record<number,readonly [number,number,number]>>={1:[24,29,4]};
export const GANG_WEAPON_CHANCE=33;
export function gangWeapons(gang:number):readonly [number,number,number]{return SCRIPT_GANG_WEAPONS[gang]??DEFAULT_GANG_WEAPONS[gang]??[0,0,0];}
/** CGangInfo::GetRandomWeapon(skipUnarmed): a uniform pick among the choices that are not unarmed; unarmed when none. */
export function randomGangWeapon(gang:number,random:()=>number){
 const choices=gangWeapons(gang).filter(w=>w!==WEAPON_UNARMED);
 if(!choices.length)return WEAPON_UNARMED;
 return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
/** CPopulation::AddPed's CGeneral::RandomBool(33): whether a spawned gang member draws a weapon at all. */
export function gangMemberArmed(random:()=>number){return random()*100<GANG_WEAPON_CHANCE;}
