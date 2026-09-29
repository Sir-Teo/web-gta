import {NATIVE_SIREN_MODELS} from '../audio/native/nativeHornInput';
import type {WorldCar} from '../simulation/WorldCar';
import type {CoronaRegistration} from '../world/nativeCoronas';
import type {LightPool} from '../world/nativeEntityLights';
/** Authored siren-light approximation (CAutomobile::PreRender, which registers the siren coronas, is not reversed):
 * the two ends of the model's light bar flash red and blue in turn through CCoronas, the game's own glowing star
 * sprites, and each flash throws a coloured pool on the ground round the car. */
export const SIREN_HALF_PERIOD_MS=280;
export function sirenPhase(timeMs:number){return Math.floor(timeMs/SIREN_HALF_PERIOD_MS)%2===0?'left' as const:'right' as const;}
/** A light bar's two lamps in the model's own frame (x right, y forward, z up). */
export interface SirenBar {left:{x:number;y:number;z:number};right:{x:number;y:number;z:number}}
type Frame={name:string;parent:number;matrix:ArrayLike<number>};
type Geometry={positions:ArrayLike<number>};
/** The light bar of a siren model, read off its chassis: the vertices within 0.12 units of the chassis' highest point.
 * On a police car that cluster is the bar itself, a short strip across the roof; on a model whose top is a flat roof
 * (the ambulance, the fire engine, the S.W.A.T. van) the lamps go at the roof's front corners. Without a chassis, the
 * collision box's top. */
export function sirenBar(model:{frames:readonly Frame[];geometries:readonly Geometry[];atomics:readonly {frame:number;geometry:number}[]}|undefined,bounds?:{max:ArrayLike<number>;min:ArrayLike<number>}):SirenBar{
 const fallback=():SirenBar=>{const top=(bounds?.max[2]??1.5)-.05,y=bounds?(bounds.max[1]+bounds.min[1])/2:0;return {left:{x:-.45,y,z:top},right:{x:.45,y,z:top}};};
 if(!model)return fallback();
 const index=model.frames.findIndex(f=>f.name.toLowerCase()==='chassis');
 const atomic=index<0?undefined:model.atomics.find(a=>a.frame===index);
 const positions=atomic&&model.geometries[atomic.geometry]?.positions;
 if(!positions||positions.length<3)return fallback();
 // The chassis frame's place in the model: its translations up the hierarchy (vehicle frames carry no rotation there).
 let ox=0,oy=0,oz=0;
 for(let k=index,guard=0;k>=0&&guard<64;k=model.frames[k].parent,guard++){const m=model.frames[k].matrix;ox+=m[12];oy+=m[13];oz+=m[14];}
 let top=-Infinity;for(let i=2;i<positions.length;i+=3)top=Math.max(top,positions[i]);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<positions.length;i+=3)if(positions[i+2]>top-.12){minX=Math.min(minX,positions[i]);maxX=Math.max(maxX,positions[i]);minY=Math.min(minY,positions[i+1]);maxY=Math.max(maxY,positions[i+1]);}
 if(!Number.isFinite(minX))return fallback();
 const z=top+oz-.04,half=Math.max(.2,Math.min(.8,(maxX-minX)/2)-.2),cx=(minX+maxX)/2+ox;
 // A strip no deeper than a unit is the bar; a deeper top is a roof, lit at its front edge.
 const y=(maxY-minY<=1?(minY+maxY)/2:maxY-.25)+oy;
 return {left:{x:cx-half,y,z},right:{x:cx+half,y,z}};
}
/** The siren coronas and ground pools of the cars whose sirens sound. */
export class SirenLights {
 private bars=new Map<number,SirenBar>();
 private live=new Set<number>();
 private disposed=false;
 private bar(car:WorldCar){
  let bar=this.bars.get(car.modelId);
  if(!bar){bar=sirenBar(car.assets.model as never,car.assets.collision?.bounds);this.bars.set(car.modelId,bar);}
  return bar;
 }
 /** A lamp's place in the renderer's frame. */
 static anchor(car:WorldCar,side:-1|1,bar?:SirenBar){
  const lamp=bar?(side<0?bar.left:bar.right):sirenBar(undefined,car.assets.collision?.bounds)[side<0?'left':'right'];
  const w=car.worldPoint(lamp);return {x:w.x,y:w.y,z:w.z};
 }
 /** This frame's siren coronas and pools, native world units. The lit lamp is at full strength, the other just
  * glowing, so the bar reads as one light moving from side to side. */
 update(cars:Iterable<WorldCar>,timeMs:number){
  const coronas:CoronaRegistration[]=[],pools:LightPool[]=[];
  this.live.clear();
  if(this.disposed)return {coronas,pools};
  const phase=sirenPhase(timeMs);
  for(const car of cars){
   if(car.wrecked||car.disposed||!NATIVE_SIREN_MODELS.has(car.modelId)||!car.siren)continue;
   const handle=car.car.body.handle;this.live.add(handle);
   const bar=this.bar(car);
   for(const side of [-1,1] as const){
    const on=(side<0)===(phase==='left'),at=SirenLights.anchor(car,side,bar),color:[number,number,number]=side<0?[255,0,0]:[0,0,255];
    const position:[number,number,number]=[at.x,-at.z,at.y];
    // A corona id no CCoronas user shares: the body handle with the side in the low bit and a tag above.
    coronas.push({id:0x51000000+handle*2+(side<0?0:1),color,intensity:on?255:40,position,size:on?.9:.35,range:80,fadeSpeed:255,reflection:true,pullTowardsCamera:1});
    // One pool per car, under whichever lamp is lit, so its ground cut is kept from flash to flash.
    if(on)pools.push({id:0x52000000+handle,position:[position[0],position[1],position[2]],size:3.5,color:side<0?[100,0,0]:[0,0,170],intensity:128,maxHeight:3.5});
   }
  }
  return {coronas,pools};
 }
 snapshot(){return {cars:this.live.size};}
 dispose(){this.disposed=true;this.bars.clear();this.live.clear();}
}
