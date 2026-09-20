/** CStreaming::StreamZoneModels and CPopCycle::PickPedMIToStreamInForCurrentZone (gta-reversed ead3051), the
 * civilian roster the original keeps resident for the zone the player is in: eight ped model slots filled from the
 * popcycle groups active for the zone type and hour (each group's weight is its popcycle percentage), every group
 * cycled round-robin (`ms_NextPedToLoadFromGroup`), a model never loaded twice; the roster is rebuilt when the zone
 * type changes (at least four models) and otherwise swaps one unused slot every 300 frames.
 * `CPopulation::ChooseCivilianOccupation` then takes a resident model for each new civilian; its slot rule reads a
 * model's reference count against its slot index, which spreads spawns over the slots, so this picks the resident
 * model with the fewest living peds. */
export interface PedZoneGroups {
 /** Popcycle zone type (0-19) and the player's city (0 Los Santos, 1 San Fierro, 2 Las Venturas). */
 zoneType:number;city:0|1|2;
 /** The eighteen popcycle group percentages for the zone type, week type and hour. */
 groups:readonly number[];
}
export const TOTAL_LOADED_PEDS=8,PED_STREAM_INTERVAL_FRAMES=300;
export class ZonePedRoster {
 readonly slots:(string|undefined)[]=Array(TOTAL_LOADED_PEDS).fill(undefined);
 private zoneType=-1;private timer=0;
 private nextPedToLoad:number[];
 /** `groupModels[group][city]` lists the model names of a popcycle group for a city (pedgrp.dat). */
 constructor(private groupModels:readonly (readonly (readonly string[])[])[],private random:()=>number=Math.random){this.nextPedToLoad=groupModels.map(()=>0);}
 get loaded(){return this.slots.filter((s):s is string=>!!s);}
 /** CPopCycle::PickARandomGroupOfOtherPeds: a group drawn by its percentage. */
 private pickGroup(groups:readonly number[]){
  const total=groups.reduce((a,b)=>a+b,0);if(total<=0)return -1;
  let r=this.random()*total;
  for(let i=0;i<groups.length;i++){r-=groups[i];if(r<0)return i;}
  return groups.length-1;
 }
 /** CPopCycle::PickPedMIToStreamInForCurrentZone: ten tries at a weighted group, cycling its models past the loaded ones. */
 private pick(zone:PedZoneGroups){
  for(let tries=0;tries<10;tries++){
   const group=this.pickGroup(zone.groups);if(group<0||!this.groupModels[group])continue;
   const models=this.groupModels[group][zone.city]??this.groupModels[group][0];if(!models?.length)continue;
   for(let p=0;p<models.length;p++){
    this.nextPedToLoad[group]=(this.nextPedToLoad[group]+1)%models.length;
    const name=models[this.nextPedToLoad[group]];
    if(!this.slots.includes(name))return name;
   }
  }
  return undefined;
 }
 /** One streaming update over `frames` game frames; `inUse` counts the living peds wearing a model. */
 update(zone:PedZoneGroups|undefined,frames:number,inUse:(name:string)=>number){
  if(!zone)return;
  if(zone.zoneType!==this.zoneType){
   const count=Math.max(this.loaded.length,4);
   this.slots.fill(undefined);this.zoneType=zone.zoneType;
   for(let i=0;i<Math.min(count,TOTAL_LOADED_PEDS);i++){const name=this.pick(zone);if(name)this.slots[i]=name;}
   this.timer=PED_STREAM_INTERVAL_FRAMES;return;
  }
  this.timer-=frames;if(this.timer>=0)return;
  const slot=this.slots.findIndex(s=>s===undefined||inUse(s)===0);
  if(slot<0)return;
  const name=this.pick(zone);
  if(name&&name!==this.slots[slot]){this.slots[slot]=name;this.timer=PED_STREAM_INTERVAL_FRAMES;}
 }
 /** The resident model for a new civilian: the one with the fewest living peds, earliest slot first. */
 choose(inUse:(name:string)=>number){
  let best:string|undefined,fewest=Infinity;
  for(const name of this.slots)if(name){const n=inUse(name);if(n<fewest){fewest=n;best=name;}}
  return best;
 }
}

export const GANG_STREAM_INTERVAL_FRAMES=550,GANG_MEMBER_CYCLE=21;
/** The gang half of CStreaming::StreamZoneModels: every gang with INITIAL strength in the player's zone keeps two of
 * its pedgrp.dat models resident, the pair at `CurrentGangMemberToLoad` and the next one; every 550 frames the
 * cursor advances (modulo 21) so the pair slides one model on; gangs the zone no longer names lose their models.
 * CGangs::ChooseGangPedModel then dresses each new member in a random resident model of its gang. */
export class GangPedRoster {
 /** Bit mask of gangs whose models are resident (`ms_loadedGangs`). */
 loaded=0;
 private current=0;private timer=0;
 /** `gangs[gang]` lists the pedgrp.dat models of gang 1 to 10 (index 0 to 9). */
 constructor(private gangs:readonly (readonly string[])[],private random:()=>number=Math.random){}
 /** The resident models of a gang; empty when the zone does not name it. */
 resident(gang:number){
  if(!(this.loaded&(1<<gang)))return [];
  const models=this.gangs[gang];if(!models?.length)return [];
  const n=models.length,first=models[this.current%n],second=models[(this.current+1)%n];
  return first===second?[first]:[first,second];
 }
 /** One streaming update over `frames` game frames for the gangs the zone needs (bit mask). */
 update(needed:number,frames:number){
  this.loaded=needed&0x3ff;
  this.timer-=frames;
  if(this.timer<0){this.timer=GANG_STREAM_INTERVAL_FRAMES;this.current=(this.current+1)%GANG_MEMBER_CYCLE;}
 }
 /** A random resident model of the gang, or undefined while none is resident. */
 choose(gang:number){
  const models=this.resident(gang);
  return models.length?models[Math.floor(this.random()*models.length)]:undefined;
 }
}
