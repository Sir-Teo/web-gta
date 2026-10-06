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
/** CVehicleModelInfo's upgrade positions (eVehicleUpgradePosn), each read by PreprocessHierarchy from the model's frame
 * of this name (ms_vehicleDescs; the iOS strings at 0x58020e): a chassis part's CarMod indexes it. A model lacking the
 * frame has no such position (IsUpgradeAvailable). The _dam ones are where a damaged copy goes. */
export const UPGRADE_POSITION_FRAMES=['ug_bonnet','ug_bonnet_left','ug_bonnet_right','ug_bonnet_dam','ug_bonnet_left_dam','ug_bonnet_right_dam','ug_spoiler','ug_spoiler_dam','ug_wing_left','ug_wing_right','ug_frontbullbar','ug_backbullbar','ug_lights','ug_lights_dam','ug_roof','ug_nitro'] as const;
/** CVehicle::AddVehicleUpgrade (iOS 0x100480908): which upgrades CVehicle::AddUpgrade (0x100480f70) draws at an
 * upgrade position. Hydraulics and the stereo are taken by the special-upgrade routine (0x100480b9c) and have no model
 * drawn; nitro is too, but goes on to be drawn when the car has a nitro position; a dummy part replaces a component
 * instead (0x100480d44). */
export function upgradePositionFrame(place:{place:number;dummy:boolean}|undefined){
 if(!place||place.dummy||place.place===0x10||place.place===0x11)return undefined;
 return UPGRADE_POSITION_FRAMES[place.place];
}
/** The component a dummy part replaces (its CarMod is an eCarNodes id; CClumpModelInfo::GetFrameFromId finds the
 * frame carIds names for it): the chassis, the two bumpers, the exhaust and the three misc nodes. The wheels (2) are
 * all four wheel frames and are not here. */
export const REPLACED_COMPONENT_FRAMES:Readonly<Record<number,string>>={1:'chassis',12:'bump_front_dummy',13:'bump_rear_dummy',19:'exhaust_ok',20:'misc_a',21:'misc_b',22:'misc_c'};
/** The eCarNodes id a wheel set's CarMod names: CVehicle::AddVehicleUpgrade replaces the wheel on the four wheel
 * frames (CAR_WHEEL_RF 2, LF 5, RB 4, LB 7; a six-wheeler's middle ones keep theirs). */
export const WHEEL_NODE=2;
/** The eCarNodes id of the exhaust, which a double-exhaust model's (DOUBLE_EXHAUST) replacement gets twice. */
export const EXHAUST_NODE=19;
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
/** IsValidModForVehicle (iOS 0x10020b390; unreversed in gta-reversed at 0x49B010), which CShopping asks of each car mod
 * it would list: a wheel is valid when the car's model's wheel set (vehicles.ide's wheel upgrade class) holds it, any
 * other upgrade but the stereo when the model's m_anUpgrades does. AUTHORED: the stereo is always valid here; the
 * executable also turns it away by two fields of the car's audio entity (one of them its bass setting) that the port's
 * vehicle audio does not carry. */
export function isValidModForVehicle(model:number,place:{place:number;dummy:boolean}|undefined,modelUpgrades:readonly number[],wheelSet:readonly number[]|undefined){
 if(place&&!place.dummy&&place.place===0x11)return true;
 if(place&&place.dummy&&place.place===2)return !!wheelSet&&wheelSet.includes(model);
 return modelUpgrades.includes(model);
}
/** The nitro an automobile gets from a nitro upgrade (the iOS special-upgrade routine, 0x100480b9c): the large bottle
 * (nto_b_l) five boosts, the twin bottles (nto_b_tw) ten, the small one two. */
export const nitroBoostsFor=(name:string|undefined)=>name==='nto_b_l'?5:name==='nto_b_tw'?10:2;
