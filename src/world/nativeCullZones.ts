/* CCullZones (CullZones.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: the IPL `cull` zones.
 * AddCullZone (0x72DF70) files a zone with a tunnel flag among the tunnel zones and the rest (flags without the tunnel
 * bits) among the attribute zones; fourteen-field rows are mirror zones. CZoneDef stores its corner, axes and heights
 * as int16. Update (0x72DEC0) refreshes the camera's flags on game frames with (frame & 7) == 2 and the player's on
 * frames with == 6, where a player in a military zone gets five stars unless the script disabled them. Native
 * coordinates. */
import type {IplCullZone} from '../assets/ipl';

export const ZONE={camCloseIn:0x1,stairs:0x2,firstPerson:0x4,noRain:0x8,noPolice:0x10,loadCollision:0x40,tunnelTransition:0x80,
 policeAbandonCars:0x100,inRoomForAudio:0x200,fewerPeds:0x400,tunnel:0x800,militaryZone:0x1000,extraAirResistance:0x4000,fewerCars:0x8000} as const;
type V3=readonly [number,number,number];
const i16=(v:number)=>{const t=Math.trunc(v)&0xffff;return t>=0x8000?t-0x10000:t;};
/** CZoneDef: int16 corner, doubled axes and heights. */
export class CullZoneDef {
 readonly cornerX:number;readonly cornerY:number;readonly vec1X:number;readonly vec1Y:number;readonly vec2X:number;readonly vec2Y:number;readonly minZ:number;readonly maxZ:number;
 constructor(z:Pick<IplCullZone,'center'|'vec1'|'vec2'|'minZ'|'maxZ'>){
  this.cornerX=i16(z.center[0]-z.vec1[0]-z.vec2[0]);this.cornerY=i16(z.center[1]-z.vec1[1]-z.vec2[1]);
  this.vec1X=i16(z.vec1[0]*2);this.vec1Y=i16(z.vec1[1]*2);this.vec2X=i16(z.vec2[0]*2);this.vec2Y=i16(z.vec2[1]*2);
  this.minZ=i16(z.minZ);this.maxZ=i16(z.maxZ);
 }
 /** CZoneDef::IsPointWithin (0x72D850). */
 contains(p:V3){
  if(this.minZ>=p[2]||this.maxZ<=p[2])return false;
  const dx=p[0]-this.cornerX,dy=p[1]-this.cornerY;
  const a=this.vec1X*dx+this.vec1Y*dy;if(a<0||a>this.vec1Y**2+this.vec1X**2)return false;
  const b=this.vec2X*dx+this.vec2Y*dy;if(b<0||b>this.vec2Y**2+this.vec2X**2)return false;
  return true;
 }
}
export class NativeCullZones {
 readonly attributeZones:{def:CullZoneDef;flags:number}[]=[];readonly tunnelZones:{def:CullZoneDef;flags:number}[]=[];readonly mirrorZones:{def:CullZoneDef;flags:number}[]=[];
 /** CurrentFlags_Camera and CurrentFlags_Player. */
 camera=0;player=0;
 load(rows:readonly IplCullZone[]){
  for(const row of rows){
   const def=new CullZoneDef(row);
   if(row.mirror){this.mirrorZones.push({def,flags:row.flags&0xff});continue;}
   let flags=row.flags&0xffff;
   if(flags&(ZONE.tunnelTransition|ZONE.tunnel)){this.tunnelZones.push({def,flags});flags&=~(ZONE.tunnelTransition|ZONE.tunnel);}
   if(flags)this.attributeZones.push({def,flags});
  }
 }
 /** FindAttributesForCoors (0x72D970): every attribute zone holding the point, flags OR'd. */
 attributesAt(p:V3){let flags=0;for(const z of this.attributeZones)if(z.def.contains(p))flags|=z.flags;return flags;}
 /** FindTunnelAttributesForCoors (0x72D9F0). */
 tunnelAttributesAt(p:V3){let flags=0;for(const z of this.tunnelZones)if(z.def.contains(p))flags|=z.flags;return flags;}
 /** CCullZones::Update for one game frame. `militaryZone` is called when the player stands in one and they are not
  * disabled (SetWantedLevelNoDrop(WANTED_LEVEL_5) for a live player). */
 update(frame:number,camera:V3,player:V3,militaryZonesDisabled:boolean,militaryZone?:()=>void){
  if((frame&7)===2){this.camera=this.attributesAt(camera);return;}
  if((frame&7)===6){this.player=this.attributesAt(player);if(!militaryZonesDisabled&&this.player&ZONE.militaryZone)militaryZone?.();}
 }
 get camNoRain(){return !!(this.camera&ZONE.noRain);}
 get playerNoRain(){return !!(this.player&ZONE.noRain);}
 /** CRenderer::ConstructRenderList's tunnel switches for the camera position. */
 renderTunnels(camera:V3){
  const flags=this.tunnelAttributesAt(camera);
  return {tunnels:(flags&(ZONE.tunnel|ZONE.tunnelTransition))!==0,outside:(flags&ZONE.tunnelTransition)!==0||!(flags&ZONE.tunnel)};
 }
}
