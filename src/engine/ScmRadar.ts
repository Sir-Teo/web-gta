import {requireAsset} from '../assets/binary';

/* CRadar blip table (ms_RadarTrace) from the pinned gta-reversed checkout
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166, Radar.cpp. Drawing, legend and
 * airstrip blips are not reproduced. Entity handles are opaque integers
 * supplied by the world adapter. */

export const MAX_RADAR_TRACES=175;
export const BLIP_NONE=0,BLIP_CAR=1,BLIP_CHAR=2,BLIP_OBJECT=3,BLIP_COORD=4,BLIP_CONTACT_POINT=5,BLIP_SPOTLIGHT=6,BLIP_PICKUP=7,BLIP_AIRSTRIP=8;
export const BLIP_DISPLAY_NEITHER=0,BLIP_DISPLAY_MARKERONLY=1,BLIP_DISPLAY_BLIPONLY=2,BLIP_DISPLAY_BOTH=3;
export const BLIP_COLOUR_GREEN=1,BLIP_COLOUR_THREAT=7,BLIP_COLOUR_DESTINATION=8;
export const RADAR_SPRITE_NONE=0;
export const BLIP_FLAG_FRIEND=0,BLIP_FLAG_THREAT=1,BLIP_FLAG_UNK=2;

export interface ScmRadarTrace {
 colour:number;entityHandle:number;position:{x:number;y:number;z:number};counter:number;sphereRadius:number;blipSize:number;
 entryExit:number|null;sprite:number;bright:boolean;tracking:boolean;shortRange:boolean;friendly:boolean;remain:boolean;fade:boolean;
 coordAppearance:number;display:number;type:number;appearance:number;
}

function cleared():ScmRadarTrace{
 return {colour:0,entityHandle:0,position:{x:0,y:0,z:0},counter:0,sphereRadius:1,blipSize:1,entryExit:null,sprite:RADAR_SPRITE_NONE,bright:true,tracking:false,shortRange:false,friendly:false,remain:false,fade:false,coordAppearance:BLIP_FLAG_FRIEND,display:BLIP_DISPLAY_NEITHER,type:BLIP_NONE,appearance:0};
}

export class ScmRadar {
 readonly traces:ScmRadarTrace[]=Array.from({length:MAX_RADAR_TRACES},cleared);
 /** FrontEndMenuManager.m_bDrawingMap: scale changes collapse to 1 while the map is open. */
 isDrawingMap?:()=>boolean;
 /** CRadar::ClearActualBlip: the unique counter survives, as in the source. */
 private static clear(trace:ScmRadarTrace){
  const {counter,colour,entityHandle,position,appearance}=trace;
  Object.assign(trace,cleared(),{counter,colour,entityHandle,position,appearance});
 }
 /** CRadar::GetNewUniqueBlipIndex (0x582820): counters wrap back to 1 before 0xFFFF. */
 private newHandle(index:number){
  const trace=this.traces[index];
  trace.counter=trace.counter>=0xfffe?1:trace.counter+1;
  return (index|trace.counter<<16)>>>0;
 }
 /** CRadar::GetActualBlipArrayIndex (0x582870): -1 for stale or untracked handles. */
 index(blip:number){
  if(blip===-1||blip===0xffffffff)return -1;
  const index=blip&0xffff,counter=blip>>>16&0xffff;
  requireAsset(index<MAX_RADAR_TRACES,'Blip handle indexes past ms_RadarTrace.');
  const trace=this.traces[index];
  return counter!==trace.counter||!trace.tracking?-1:index;
 }
 private free(){return this.traces.findIndex(trace=>!trace.tracking);}
 /** CRadar::SetCoordBlip (0x583820). The colour argument is ignored: coordinate
  * blips always start as BLIP_COLOUR_DESTINATION. Returns -1 when the table is full. */
 setCoordBlip(type:number,position:{x:number;y:number;z:number},display:number){
  const index=this.free();if(index<0)return -1;
  const t=this.traces[index];
  t.position={...position};t.display=display&3;t.type=type&15;t.colour=BLIP_COLOUR_DESTINATION;t.sphereRadius=1;t.entityHandle=0;t.blipSize=1;t.sprite=RADAR_SPRITE_NONE;t.bright=true;t.tracking=true;t.entryExit=null;
  return this.newHandle(index);
 }
 /** CRadar::SetShortRangeCoordBlip (0x583920). */
 setShortRangeCoordBlip(type:number,position:{x:number;y:number;z:number},display:number){
  const blip=this.setCoordBlip(type,position,display);
  if(blip!==-1)this.traces[this.index(blip)].shortRange=true;
  return blip;
 }
 /** CRadar::SetEntityBlip (0x5839A0): chars and cars are threat-coloured, everything else green. */
 setEntityBlip(type:number,entityHandle:number,display:number){
  const index=this.free();if(index<0)return -1;
  const t=this.traces[index];
  t.display=display&3;t.colour=type===BLIP_CHAR||type===BLIP_CAR?BLIP_COLOUR_THREAT:BLIP_COLOUR_GREEN;t.entityHandle=entityHandle;t.sphereRadius=1;t.blipSize=1;t.type=type&15;t.sprite=RADAR_SPRITE_NONE;t.bright=true;t.tracking=true;t.entryExit=null;
  return this.newHandle(index);
 }
 private trace(blip:number){const index=this.index(blip);return index<0?undefined:this.traces[index];}
 changeColour(blip:number,colour:number){const t=this.trace(blip);if(t)t.colour=colour>>>0;}
 changeBrightness(blip:number,brightness:number){const t=this.trace(blip);if(t)t.bright=brightness===1;}
 changeScale(blip:number,size:number){const t=this.trace(blip);if(t)t.blipSize=this.isDrawingMap?.()?1:size&0xffff;}
 changeDisplay(blip:number,display:number){const t=this.trace(blip);if(t)t.display=display&3;}
 setSprite(blip:number,sprite:number){const t=this.trace(blip);if(t&&t.tracking)t.sprite=sprite;}
 setAlwaysDisplayInZoom(blip:number,display:boolean){const t=this.trace(blip);if(t&&t.tracking)t.remain=display;}
 setFade(blip:number,fade:boolean){const t=this.trace(blip);if(t)t.fade=fade;}
 /** CRadar::SetCoordBlipAppearance (0x583E50): only car blips accept an appearance. */
 setCoordBlipAppearance(blip:number,appearance:number){
  const t=this.trace(blip);if(!t||t.type!==BLIP_CAR)return;
  if(appearance===BLIP_FLAG_FRIEND||appearance===BLIP_FLAG_THREAT||appearance===BLIP_FLAG_UNK)t.appearance=appearance;
 }
 setFriendly(blip:number,friendly:boolean){const t=this.trace(blip);if(t)t.friendly=friendly;}
 setEntryExit(blip:number,entryExit:number|null){const t=this.trace(blip);if(t&&t.tracking)t.entryExit=entryExit;}
 /** CRadar::ClearBlip (0x587CE0). */
 clearBlip(blip:number){const index=this.index(blip);if(index>=0)ScmRadar.clear(this.traces[index]);}
 /** CRadar::ClearBlipForEntity: every trace of that type bound to the handle. */
 clearBlipForEntity(type:number,entityHandle:number){for(const t of this.traces)if(t.type===type&&t.entityHandle===entityHandle)ScmRadar.clear(t);}
 get tracked(){return this.traces.filter(t=>t.tracking).length;}
}
