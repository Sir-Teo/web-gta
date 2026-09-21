/* CVehicleModelInfo's extra components (gta-reversed ead3051): the bull bars, roof racks, loads and spoilers a
 * vehicle model carries as `extra1`..`extra6` frames. PreprocessHierarchy lifts those atomics out of the clump into
 * `m_apExtras` in name order, so none of them renders by default, and `CreateInstance` adds back at most two:
 * `ChooseComponent` for the first and `ChooseSecondComponent` for the second. Both read the model's comps value,
 * the vehicles.ide hexadecimal column, as two halves of sixteen bits: twelve bits of three four-bit component
 * indices (0xF for none) and a four-bit rule. A rule of ALLOW_ALWAYS (1) or ONLY_WHEN_RAINING (2) picks one of the
 * listed components at random; MAYBE_HIDE (3) picks one or nothing; FULL_RANDOM (4) picks any of the first five
 * slots. ONLY_WHEN_RAINING counts as no rule at all unless the old or new weather is a rainy one, which sends the
 * choice to the fallback: two frames in three, one of the components no rule lists. The second component runs the
 * B rule the same way, and falls back only when the A rule was valid, again two frames in three. */
export const NUM_VEHICLE_EXTRAS=6,COMP_RULE_NONE=0xf;
export const COMPONENT_RULE={allowAlways:1,onlyWhenRaining:2,maybeHide:3,fullRandom:4} as const;
export interface VehicleComps {extraARule:number;extraAComp:number;extraBRule:number;extraBComp:number}
/** The vehicles.ide comps column split into the A and B halves. */
export function decodeVehicleComps(comps:number):VehicleComps{
 const value=comps>>>0;
 return {extraAComp:value&0xfff,extraARule:value>>>12&0xf,extraBComp:value>>>16&0xfff,extraBRule:value>>>28&0xf};
}
/** CountCompsInRule: the four-bit component slots of a twelve-bit half that are not 0xF. */
export function countCompsInRule(comps:number){
 let result=0,rest=comps>>>0;
 while(rest){if((rest&0xf)!==COMP_RULE_NONE)result++;rest=Math.floor(rest/16);}
 return result;
}
/** IsValidCompRule: every rule holds except ONLY_WHEN_RAINING out of the rain. */
export function isValidCompRule(rule:number,raining:boolean){return rule!==COMPONENT_RULE.onlyWhenRaining||raining;}
/** CGeneral::GetRandomNumberInRange for integers: [min, max) as the original's exclusive form. */
const randomInRange=(random:()=>number,min:number,max:number)=>Math.trunc(min+(max-1-min)*Math.min(1,Math.max(0,random())));
/** The global ChooseComponent: a component of the rule's list, or none. */
export function chooseComponentByRule(rule:number,comps:number,random:()=>number){
 if(rule===COMPONENT_RULE.allowAlways||rule===COMPONENT_RULE.onlyWhenRaining){
  const count=countCompsInRule(comps);if(!count)return -1;
  return comps>>>4*randomInRange(random,0,count)&0xf;
 }
 if(rule===COMPONENT_RULE.maybeHide){
  const count=countCompsInRule(comps),pick=randomInRange(random,-1,count);
  if(pick===-1)return -1;
  return comps>>>4*pick&0xf;
 }
 if(rule===COMPONENT_RULE.fullRandom)return randomInRange(random,0,5);
 return -1;
}
/** GetListOfComponentsNotUsedByRules: the model's extras that neither rule names (empty under FULL_RANDOM). */
export function componentsNotUsedByRules(comps:VehicleComps,numExtras:number,raining:boolean){
 const used=[0,1,2,3,4,5];
 const strike=(half:number)=>{for(let i=0;i<3;i++){const slot=half>>>i*4&0xf;if(slot!==COMP_RULE_NONE&&slot<used.length)used[slot]=COMP_RULE_NONE;}};
 if(comps.extraARule&&isValidCompRule(comps.extraARule,raining)){
  if(comps.extraARule===COMPONENT_RULE.fullRandom)return [];
  strike(comps.extraAComp);
 }
 if(comps.extraBRule&&isValidCompRule(comps.extraBRule,raining))strike(comps.extraBComp);
 const out:number[]=[];
 for(let i=0;i<numExtras;i++)if(used[i]!==COMP_RULE_NONE)out.push(i);
 return out;
}
/** CVehicleModelInfo::ChooseComponent: the first extra of an instance. */
export function chooseFirstExtra(comps:VehicleComps,numExtras:number,random:()=>number,raining:boolean){
 if(comps.extraARule&&isValidCompRule(comps.extraARule,raining))return chooseComponentByRule(comps.extraARule,comps.extraAComp,random);
 if(randomInRange(random,0,3)<2){
  const free=componentsNotUsedByRules(comps,numExtras,raining);
  if(free.length)return free[randomInRange(random,0,free.length)];
 }
 return -1;
}
/** CVehicleModelInfo::ChooseSecondComponent: the second extra, only with a B rule or after a valid A rule. */
export function chooseSecondExtra(comps:VehicleComps,numExtras:number,random:()=>number,raining:boolean){
 if(comps.extraBRule&&isValidCompRule(comps.extraBRule,raining))return chooseComponentByRule(comps.extraBRule,comps.extraBComp,random);
 if(comps.extraARule&&isValidCompRule(comps.extraARule,raining)&&randomInRange(random,0,3)<2){
  const free=componentsNotUsedByRules(comps,numExtras,raining);
  if(free.length)return free[randomInRange(random,0,free.length)];
 }
 return -1;
}
/** CreateInstance's pair of extras for one vehicle, as indices into the model's extras in name order. */
export function chooseVehicleExtras(comps:number,numExtras:number,random:()=>number=Math.random,raining=false){
 if(!numExtras)return [] as number[];
 const decoded=decodeVehicleComps(comps);
 const first=chooseFirstExtra(decoded,numExtras,random,raining);
 const second=chooseSecondExtra(decoded,numExtras,random,raining);
 return [first,second].filter(index=>index>=0&&index<numExtras);
}
/** The model's `extra1`..`extra6` frames in name order, as PreprocessHierarchy collects them. */
export function vehicleExtraFrames(frames:readonly {name:string}[]){
 const found:number[]=[];
 for(let n=1;n<=NUM_VEHICLE_EXTRAS;n++){
  const index=frames.findIndex(f=>f.name.trim().toLowerCase()===`extra${n}`);
  if(index>=0)found.push(index);
 }
 return found;
}
