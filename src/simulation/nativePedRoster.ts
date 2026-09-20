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
