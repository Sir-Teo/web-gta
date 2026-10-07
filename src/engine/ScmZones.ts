import {requireAsset} from '../assets/binary';
/* CTheZones' info zones as the script sees them, pinned gta-reversed ead3051 (`ZoneCommands.cpp`, which is
 * reversed, over `CTheZones::FindZoneByLabel` 0x572C40, `InitZonesPopulationSettings` 0x5720D0 and the CZoneInfo
 * fields each command reaches). One record per info label, as the browser's world zones are indexed. */
/** eZonePopulationType::RESIDENTIAL_AVERAGE, the population type a fresh CZoneInfo carries. */
export const ZONE_POP_RESIDENTIAL_AVERAGE=5;
/** eZonePopulationType::COUNT: the field is five bits wide. */
export const ZONE_POP_TYPE_COUNT=20;
/** CZoneInfo::PopRaces defaults to every ePedRace bit set. */
export const ZONE_RACES_ALL=0b1111;
/** CZoneInfo::GangStrength holds ten gangs. */
export const ZONE_GANG_COUNT=10;
export interface ScmZoneInfo {
 gangStrength:number[];dealerStrength:number;
 /** CZoneInfo's bitfield: five bits of population type, two of radar mode, one no-cops flag and four race bits. */
 popType:number;radarMode:number;noCops:boolean;races:number;
 colour:[number,number,number,number];
}
/** A fresh CZoneInfo, which is what InitZonesPopulationSettings fills the array with. */
export function zoneInfoDefaults():ScmZoneInfo{
 return {gangStrength:Array(ZONE_GANG_COUNT).fill(0),dealerStrength:0,popType:ZONE_POP_RESIDENTIAL_AVERAGE,radarMode:0,noCops:false,races:ZONE_RACES_ALL,colour:[0,0,0,0]};
}
/** The info zones. A command naming a label no zone carries does nothing at all, as every handler works through
 * a lookup that returns nothing; the browser keeps those labels so a caller can see what the script asked for. */
export class ScmZones {
 private labels:string[]=[];
 private infos:ScmZoneInfo[]=[];
 /** Labels the script named that no zone carries, in the order it named them. */
 readonly unresolved:string[]=[];
 /** The world's info zone labels, in the order the browser indexes them. `shared`: the records the rest of the
  * world reads (the street population, the gang wars), taken over as they stand so there is one CZoneInfo array,
  * CTheZones::ZoneInfoArray, as in the game: what a script sets the streets and the wars see, and what a war moves
  * the script reads back (CRASH4 waits on GET_ZONE_GANG_STRENGTH for Glen Park's Ballas to be gone). */
 load(labels:readonly string[],shared?:readonly Partial<ScmZoneInfo>[]){
  requireAsset(labels.length>0,'Zone labels are empty.');
  this.labels=[...labels];this.unresolved.length=0;
  this.infos=shared&&shared.length===labels.length?shared.map(record=>{for(const [key,value] of Object.entries(zoneInfoDefaults()))if(!(key in record))(record as Record<string,unknown>)[key]=value;return record as ScmZoneInfo;}):labels.map(()=>zoneInfoDefaults());
 }
 get loaded(){return this.labels.length>0;}
 get count(){return this.labels.length;}
 get all():readonly ScmZoneInfo[]{return this.infos;}
 /** CTheZones::FindZoneByLabel for ZONE_TYPE_INFO: the first zone with that label, or -1. */
 findZoneByLabel(label:string){return this.labels.indexOf(label);}
 /** CTheZones::GetZoneInfo through a label, or nothing when the label names no zone. */
 info(label:string){
  const index=this.findZoneByLabel(label);
  if(index<0){this.unresolved.push(label);return undefined;}
  return this.infos[index];
 }
 at(index:number){
  requireAsset(Number.isInteger(index)&&index>=0&&index<this.infos.length,'Zone index out of range.');
  return this.infos[index];
 }
 /** CTheZones::InitZonesPopulationSettings (0x5720D0): every record back to a fresh CZoneInfo. */
 initZonesPopulationSettings(){for(const info of this.infos)Object.assign(info,zoneInfoDefaults());this.unresolved.length=0;}
 setPopulationType(label:string,popType:number){
  requireAsset(Number.isInteger(popType)&&popType>=0&&popType<ZONE_POP_TYPE_COUNT,'Invalid zone population type.');
  const info=this.info(label);if(info)info.popType=popType;
 }
 setDealerStrength(label:string,strength:number){const info=this.info(label);if(info)info.dealerStrength=strength&255;}
 /** The native getter reads through the same lookup and has no answer for a label it cannot find. */
 dealerStrength(label:string){const info=this.info(label);requireAsset(info,`No info zone labelled ${label}.`);return info!.dealerStrength;}
 setGangStrength(label:string,gang:number,strength:number){
  requireAsset(Number.isInteger(gang)&&gang>=0&&gang<ZONE_GANG_COUNT,'Invalid gang identifier.');
  const info=this.info(label);if(info)info.gangStrength[gang]=strength&255;
 }
 gangStrength(label:string,gang:number){
  requireAsset(Number.isInteger(gang)&&gang>=0&&gang<ZONE_GANG_COUNT,'Invalid gang identifier.');
  const info=this.info(label);requireAsset(info,`No info zone labelled ${label}.`);return info!.gangStrength[gang];
 }
 /** SET_ZONE_POPULATION_RACE: the four race bits. */
 setPopulationRace(label:string,races:number){
  requireAsset(Number.isInteger(races)&&races>=0&&races<=ZONE_RACES_ALL,'Invalid zone race mask.');
  const info=this.info(label);if(info)info.races=races;
 }
 setNoCops(label:string,noCops:boolean){const info=this.info(label);if(info)info.noCops=noCops;}
}
