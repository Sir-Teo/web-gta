/* CGangs (gta-reversed ead3051): each gang's three weapon choices. CGangs::Initialise sets the defaults; the script's
 * SET_GANG_WEAPONS overrides them (main.scm's MAIN gives the Families a Desert Eagle, an MP5 and a knife as the reward
 * for spraying all hundred tags; RYDER2 hands them a pistol and a Tec-9). CPopulation::AddPed hands a third of the gang members it spawns a random one of
 * the choices that are not unarmed (CGangInfo::GetRandomWeapon). Weapon ids are eWeaponType. */
export const WEAPON_UNARMED=0;
/** By eGangID: Ballas, Grove (Families), Vagos, Rifa, Da Nang Boys, Mafia, Triad, Aztecas, two unused. */
export const DEFAULT_GANG_WEAPONS:readonly (readonly [number,number,number])[]=[
 // CGangs::Initialise never sets Rifa (3), which stays unarmed.
 [22,28,0],[22,0,0],[22,0,0],[0,0,0],[22,28,0],[24,0,0],[22,30,0],[22,28,0],[0,0,0],[0,0,0],
];
export const GANG_WEAPON_CHANCE=33;
/** CGangs::Gang[].m_nGangWeapons: the defaults until the script changes a gang's. */
const table:[number,number,number][]=DEFAULT_GANG_WEAPONS.map(w=>[w[0],w[1],w[2]]);
export function gangWeapons(gang:number):readonly [number,number,number]{return table[gang]??[0,0,0];}
/** CGangs::SetGangWeapons (SET_GANG_WEAPONS). */
export function setGangWeapons(gang:number,first:number,second:number,third:number){
 if(!Number.isInteger(gang)||gang<0||gang>=table.length)throw new Error(`No gang ${gang}.`);
 table[gang]=[first,second,third];
}
/** CGangs::Initialise, for a new game. */
export function resetGangWeapons(){DEFAULT_GANG_WEAPONS.forEach((w,i)=>{table[i]=[w[0],w[1],w[2]];});}
/** CGangInfo::GetRandomWeapon(skipUnarmed): a uniform pick among the choices that are not unarmed; unarmed when none. */
export function randomGangWeapon(gang:number,random:()=>number){
 const choices=gangWeapons(gang).filter(w=>w!==WEAPON_UNARMED);
 if(!choices.length)return WEAPON_UNARMED;
 return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
/** CPopulation::AddPed's CGeneral::RandomBool(33): whether a spawned gang member draws a weapon at all. */
export function gangMemberArmed(random:()=>number){return random()*100<GANG_WEAPON_CHANCE;}
