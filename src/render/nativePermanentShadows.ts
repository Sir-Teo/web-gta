/* CShadows' permanent shadows, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: aPermanentShadows holds
 * MAX_PERMANENT_SHADOWS (48). AddPermanentShadow (0x706F60) and UpdatePermanentShadows (0x70C950) are not reversed;
 * the reversed callers give the arguments. The port keeps a shadow at full intensity for three quarters of its time
 * and fades it linearly over the last quarter (AUTHORED, so a scorch mark does not pop), and a full table takes no more.
 * Native coordinates. */
import type {LightPool} from '../world/nativeEntityLights';

export const MAX_PERMANENT_SHADOWS=48;
export interface PermanentShadow {position:[number,number,number];front:[number,number];side:[number,number];intensity:number;color:[number,number,number];zDistance:number;durationMs:number;
 /** eShadowType; existing scorch callers use SHADOW_DEFAULT (1). Oil removal selects 4 and 8 only. */
 type?:number}
/** CExplosion::AddExplosion's scorch: SHADOW_DEFAULT `shad_heli`, half-size 8, intensity 200, black, zDistance 10, 30 s. */
export const explosionScorch=(position:[number,number,number]):PermanentShadow=>({position,front:[8,0],side:[0,-8],intensity:200,color:[0,0,0],zDistance:10,durationMs:30000});
export class NativePermanentShadows {
 private shadows:(PermanentShadow&{created:number;id:number})[]=[];private next=0;
 get count(){return this.shadows.length;}
 add(shadow:PermanentShadow,nowMs:number){if(this.shadows.length>=MAX_PERMANENT_SHADOWS)return false;this.shadows.push({...shadow,created:nowMs,id:this.next++});return true;}
 clear(){this.shadows=[];}
 /** CShadows::RemoveOilInArea (iOS 0x10038cee0): strict XY interior, independent of z; burning oil stays. */
 removeOilInArea(minX:number,maxX:number,minY:number,maxY:number){
  const f=Math.fround;minX=f(minX);maxX=f(maxX);minY=f(minY);maxY=f(maxY);
  this.shadows=this.shadows.filter(s=>!((s.type===4||s.type===8)&&f(s.position[0])>minX&&f(s.position[0])<maxX&&f(s.position[1])>minY&&f(s.position[1])<maxY));
 }
 /** The shadows still alive at `nowMs`, as pools to draw. */
 pools(nowMs:number):LightPool[]{
  this.shadows=this.shadows.filter(s=>nowMs-s.created<s.durationMs);
  return this.shadows.map(s=>{
   const age=nowMs-s.created,fadeFrom=s.durationMs*3/4,t=age<=fadeFrom?1:1-(age-fadeFrom)/(s.durationMs-fadeFrom);
   return {id:s.id,position:s.position,size:0,color:s.color,intensity:Math.trunc(s.intensity*t),maxHeight:s.zDistance,front:s.front,side:s.side,maxDistance:Infinity};
  });
 }
}
