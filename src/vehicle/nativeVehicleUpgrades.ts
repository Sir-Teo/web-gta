/** CVehicleModelInfo::LoadVehicleUpgrades (0x5B65A0, reversed): carmods.dat's three sections. `link` pairs the
 * upgrades that come as a left and right pair (ms_linkedUpgrades), `mods` gives each vehicle model the upgrades a mod
 * shop can fit it with (m_anUpgrades, 18 places), every list ending with the hydraulics and the stereo, and `wheel`
 * the three wheel sets the shops offer (ms_upgradeWheels). Names are kept as the file spells them, lowercased. */
export interface CarMods {
 links:readonly (readonly [string,string])[];
 mods:ReadonlyMap<string,readonly string[]>;
 wheels:ReadonlyMap<number,readonly string[]>;
}
/** m_anUpgrades' size. */
export const VEHICLE_UPGRADE_SLOTS=18;
export function readCarMods(text:string):CarMods{
 const links:[string,string][]=[],mods=new Map<string,string[]>(),wheels=new Map<number,string[]>();
 let section:'link'|'mods'|'wheel'|undefined;
 for(const raw of text.split(/\r?\n/)){
  // CFileLoader::LoadLine: leading blanks dropped; an empty line or one starting # is skipped.
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  if(!section){
   if(line.startsWith('link'))section='link';else if(line.startsWith('mods'))section='mods';else if(line.startsWith('wheel'))section='wheel';
   continue;
  }
  if(line.startsWith('end')){section=undefined;continue;}
  const tokens=line.split(/[ \t,]+/).filter(Boolean).map(t=>t.toLowerCase());
  if(section==='link'){if(tokens.length>=2)links.push([tokens[0],tokens[1]]);}
  else if(section==='mods'){if(tokens.length)mods.set(tokens[0],[...tokens.slice(1),'hydralics','stereo'].slice(0,VEHICLE_UPGRADE_SLOTS));}
  else{const set=Number.parseInt(tokens[0],10);if(Number.isInteger(set))wheels.set(set,[...(wheels.get(set)??[]),...tokens.slice(1)]);}
 }
 return {links,mods,wheels};
}
/** CAtomicModelInfo::SetupVehicleUpgradeFlags (reversed): an upgrade's place from its name. A chassis part (bonnet,
 * its left and right halves, spoiler, the two wings, the front and rear bull bars, lamps, roof, nitro, hydraulics,
 * stereo) is fitted at one of the car's upgrade positions; a dummy part (chassis, wheel, exhaust, the two bumpers and
 * the three misc places) stands in for one of the car's own components (bUsesVehDummy). `place` is CarMod. */
export function vehicleUpgradePlace(name:string):{place:number;dummy:boolean}|undefined{
 const n=name.toLowerCase();
 for(const [prefix,place] of CHASSIS_PARTS)if(n.startsWith(prefix))return {place,dummy:false};
 for(const [prefix,place] of DUMMY_PARTS)if(n.startsWith(prefix))return {place,dummy:true};
 return undefined;
}
const CHASSIS_PARTS:readonly (readonly [string,number])[]=[['bnt_',0x0],['bntl_',0x1],['bntr_',0x2],['spl_',0x6],['wg_l_',0x8],['wg_r',0x9],['fbb_',0xA],['bbb_',0xB],['lgt_',0xC],['rf_',0xE],['nto_',0xF],['hydralics',0x10],['stereo',0x11]];
const DUMMY_PARTS:readonly (readonly [string,number])[]=[['chss_',0x1],['wheel_',0x2],['exh_',0x13],['fbmp_',0xC],['rbmp_',0xD],['misc_a_',0x14],['misc_b_',0x15],['misc_c_',0x16]];
/** CLinkedUpgradeList::FindOtherUpgrade: the other half of a linked pair, or undefined. */
export function otherLinkedUpgrade(mods:CarMods,name:string){
 const n=name.toLowerCase();
 for(const [a,b] of mods.links){if(a===n)return b;if(b===n)return a;}
 return undefined;
}
/** GET_VEHICLE_MOD_TYPE's answer (the iOS handler, 0x1001f21c0, absent from gta-reversed): eVehicleModSlot from an
 * upgrade's CarMod. A chassis part: bonnet 0, its halves the vents 1, spoiler 2, wings the side skirts 3, the bull bars
 * 4 and 5, lamps 6, roof 7, nitro 8, hydraulics 9, stereo 10. A dummy part: chassis 11, wheels 12, exhaust 13, the
 * bumpers 14 and 15, the misc parts 16. A model that is no upgrade (CarMod 0, no dummy) answers 0. */
export function vehicleModSlot(place:{place:number;dummy:boolean}|undefined){
 if(!place)return 0;
 return (place.dummy?DUMMY_SLOTS:CHASSIS_SLOTS)[place.place]??0;
}
const CHASSIS_SLOTS:Readonly<Record<number,number>>={0:0,1:1,2:1,6:2,8:3,9:3,10:4,11:5,12:6,14:7,15:8,16:9,17:10};
const DUMMY_SLOTS:Readonly<Record<number,number>>={1:11,2:12,12:14,13:15,19:13,20:16,21:16,22:16};
/** CVehicleModelInfo::AssignRemapTxd (reversed): a texture dictionary named a vehicle model's name and digits is one of
 * its paintjobs (AddRemap), in the archive's order, four at most. */
export function vehicleRemaps(archiveNames:Iterable<string>,vehicleModels:ReadonlySet<string>){
 const remaps=new Map<string,string[]>();
 for(const entry of archiveNames){
  const match=/^(.*?)(\d+)\.txd$/i.exec(entry);if(!match||!vehicleModels.has(match[1].toLowerCase()))continue;
  const list=remaps.get(match[1].toLowerCase())??[];if(list.length<4){list.push(entry.slice(0,-4).toLowerCase());remaps.set(match[1].toLowerCase(),list);}
 }
 return remaps;
}
