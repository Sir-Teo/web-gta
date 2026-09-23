import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions,type ScmInstruction,type ScmParameter} from './scm';
import type {IdeAssociation} from './ide';
/** ePickupType. */
export const PICKUP_TYPE={none:0,inShop:1,onStreet:2,once:3,onceTimeout:4,onceTimeoutSlow:5,collectable1:6,money:8,onStreetSlow:15,assetRevenue:16,propertyLocked:17,propertyForSale:18,moneyDoesntDisappear:19,snapshot:20,onceForMission:22} as const;
export type PickupCategory='weapon'|'health'|'armour'|'bribe'|'info'|'save'|'snapshot'|'horseshoe'|'oyster'|'propertyLocked'|'propertyForSale'|'revenue'|'keycard'|'briefcase'|'clothes'|'adrenaline'|'money'|'jetpack'|'other';
export interface ScmPickup {
 /** Stable save key: model and rounded native position. */
 id:string;command:string;section:string;offset:number;
 modelId:number;model:string;dictionary:string;type:number;category:PickupCategory;
 /** Explicit CREATE_PICKUP_WITH_AMMO count, or 0 for AmmoForWeapon_OnStreet. */
 ammo:number;price?:number;text?:string;revenueLimit?:number;revenueRate?:number;
 position:[number,number,number];
}
/** The pickup kind a model stands for: a weapon model, or one of the MI_PICKUP_* models by name. */
export const pickupCategory=(definition:{section:string;model:string}):PickupCategory=>definition.section==='weap'?'weapon':CATEGORY[definition.model.toLowerCase()]??'other';
const CATEGORY:Record<string,PickupCategory>={health:'health',bodyarmour:'armour',bribe:'bribe',info:'info',pickupsave:'save',camerapickup:'snapshot',cj_horse_shoe:'horseshoe',cj_oyster:'oyster',property_locked:'propertyLocked',property_fsale:'propertyForSale',bigdollar:'revenue',keycard:'keycard',briefcase:'briefcase',clothesp:'clothes',adrenaline:'adrenaline',money:'money'};
/** Operand layouts; commands without a model operand imply their model and pickup type (handlers not reversed). */
const LAYOUT:Record<string,{fields:readonly string[];model?:string;type?:number}>={
 CREATE_PICKUP:{fields:['model','type','x','y','z']},
 CREATE_PICKUP_WITH_AMMO:{fields:['model','type','ammo','x','y','z']},
 CREATE_PROTECTION_PICKUP:{fields:['x','y','z','revenueLimit','revenueRate'],model:'bigdollar',type:PICKUP_TYPE.assetRevenue},
 CREATE_LOCKED_PROPERTY_PICKUP:{fields:['x','y','z','text'],model:'property_locked',type:PICKUP_TYPE.propertyLocked},
 CREATE_FORSALE_PROPERTY_PICKUP:{fields:['x','y','z','price','text'],model:'property_fsale',type:PICKUP_TYPE.propertyForSale},
 CREATE_SNAPSHOT_PICKUP:{fields:['x','y','z'],model:'camerapickup',type:PICKUP_TYPE.snapshot},
 CREATE_HORSESHOE_PICKUP:{fields:['x','y','z'],model:'cj_horse_Shoe',type:PICKUP_TYPE.once},
 CREATE_OYSTER_PICKUP:{fields:['x','y','z'],model:'CJ_OYSTER',type:PICKUP_TYPE.once},
};
/** CPopulation::PopulateInterior treats heights of 900 and above as interior space. */
export const INTERIOR_HEIGHT=900;
/** New-game pickups: MAIN's initialization block up to its first START_NEW_SCRIPT, then the INITIAL and INITIL2 missions.
 * Instructions are read in order with straight-line literal global writes resolved; no branches run. */
export function readInitialPickups(bytes:Uint8Array,definitions:readonly IdeAssociation[]){
 const header=readScmHeader(bytes),byId=new Map(definitions.map(d=>[d.id,d])),byName=new Map(definitions.map(d=>[d.model.toLowerCase(),d]));
 const main=decodeScmInstructions(bytes,header.entry,header.mainSize),fanOut=main.findIndex(i=>i.name==='START_NEW_SCRIPT');
 requireAsset(fanOut>0,'Missing MAIN script fan-out.');
 const sections:{name:string;code:ScmInstruction[]}[]=[{name:'MAIN',code:main.slice(0,fanOut)}];
 for(const index of [0,1]){const mission=header.missions[index];requireAsset(mission,`Missing initialization mission ${index}.`);const code=decodeScmInstructions(bytes,mission.start,mission.end);const name=code[0]?.name==='SCRIPT_NAME'?String(code[0].parameters[0]?.value):'';requireAsset(name===(index?'INITIL2':'INITIAL'),'Unexpected initialization mission name.');sections.push({name,code});}
 const globals=new Map<number,number>(),pickups=new Map<string,ScmPickup>(),skipped:{section:string;offset:number;command:string;reason:string}[]=[];
 // MAIN launches INITIAL before its own property pickups, so a global read before any straight-line write
 // falls back to its single literal value across the three initialization sections.
 const writes=new Map<number,Set<number>>();
 for(const {code} of sections)for(const i of code)if((i.name==='SET_VAR_INT'||i.name==='SET_VAR_FLOAT')&&i.parameters[0]?.type===2&&[1,4,5,6].includes(i.parameters[1]?.type??0)){const key=i.parameters[0].value as number;if(!writes.has(key))writes.set(key,new Set());writes.get(key)!.add(i.parameters[1].value as number);}
 const unique=(key:number)=>{const values=writes.get(key);return values?.size===1?[...values][0]:undefined;};
 const literal=(p:ScmParameter|undefined)=>p&&[1,4,5,6].includes(p.type)&&typeof p.value==='number'?p.value:p?.type===2&&typeof p.value==='number'?globals.get(p.value)??unique(p.value):undefined;
 for(const {name,code} of sections)for(const instruction of code){
  if((instruction.name==='SET_VAR_INT'||instruction.name==='SET_VAR_FLOAT')&&instruction.parameters[0]?.type===2){const value=literal(instruction.parameters[1]);if(value!==undefined)globals.set(instruction.parameters[0].value as number,value);else globals.delete(instruction.parameters[0].value as number);continue;}
  const layout=LAYOUT[instruction.name];if(!layout)continue;
  const skip=(reason:string)=>{skipped.push({section:name,offset:instruction.offset,command:instruction.name,reason});};
  const field=(key:string)=>instruction.parameters[layout.fields.indexOf(key)];
  const x=literal(field('x')),y=literal(field('y')),z=literal(field('z'));if(x===undefined||y===undefined||z===undefined){skip('unresolved position');continue;}
  let definition:IdeAssociation|undefined;
  if(layout.model)definition=byName.get(layout.model.toLowerCase());
  else{const model=literal(field('model'));if(model===undefined){skip('unresolved model');continue;}definition=model<0?byName.get((header.objectNames[-model]??'').toLowerCase()):byId.get(model);}
  if(!definition){skip('unknown model');continue;}
  const type=layout.type??literal(field('type'));if(type===undefined){skip('unresolved type');continue;}
  const category=pickupCategory(definition);
  const position:[number,number,number]=[Math.fround(x),Math.fround(y),Math.fround(z)];
  const id=`${definition.id}:${position.map(v=>v.toFixed(1)).join(',')}`;
  const text=field('text'),record:ScmPickup={id,command:instruction.name,section:name,offset:instruction.offset,modelId:definition.id,model:definition.model,dictionary:definition.dictionary,type,category,ammo:literal(field('ammo'))??0,position};
  const price=literal(field('price')),revenueLimit=literal(field('revenueLimit')),revenueRate=literal(field('revenueRate'));
  if(price!==undefined)record.price=price;if(typeof text?.value==='string')record.text=text.value;if(revenueLimit!==undefined)record.revenueLimit=revenueLimit;if(revenueRate!==undefined)record.revenueRate=revenueRate;
  // Several code paths create the same placement; the later one replaces the earlier handle.
  pickups.set(id,record);
 }
 return {pickups:[...pickups.values()],skipped};
}
