import type {WorldCar} from '../simulation/WorldCar';
import type {CoronaRegistration} from '../world/nativeCoronas';
import type {EntityPointLight} from '../world/nativeEntityLights';
/** CAutomobile::PreRender's siren lights, unreversed in gta-reversed and read from the iOS executable (0x10044927c to
 * 0x100449770, with the FBI Rancher's at 0x10044921c). While bSirenOrAlarm is on, a fire engine, an ambulance, the
 * Enforcer and the four police cars light four coronas spread evenly across a bar in the model's frame. Each lamp
 * steps through a 1024 ms cycle of four 256 ms phases, 64 ms behind the lamp to its right: red in the first phase,
 * the model's second colour in the third, dark (left to fade) in the other two. One point light two units above
 * the car follows the halves of a 512 ms swing. Other siren vehicles light nothing here. */
export interface SirenBarLayout {
 /** The bar's ends across the car (the first lamp at `from`, the fourth at `to`), how far forward and how high. */
 from:number;to:number;y:number;z:number;
 /** The third phase's colour (the first's is red). */
 second:readonly [number,number,number];
}
const POLICE:SirenBarLayout={from:-.7,to:.7,y:-.4,z:1,second:[0,0,255]};
export const SIREN_BAR_LAYOUTS:ReadonlyMap<number,SirenBarLayout>=new Map([
 [407,{from:-.9,to:.9,y:3.2,z:1.3,second:[255,255,0]}],
 [416,{from:-.6,to:.6,y:.9,z:1.2,second:[255,255,255]}],
 [427,{from:-.55,to:.55,y:1.1,z:1.4,second:[0,0,255]}],
 [596,POLICE],[597,POLICE],[598,POLICE],
 [599,{from:-.7,to:.7,y:-.1,z:1.2,second:[0,0,255]}],
]);
/** The FBI Rancher's dashboard lamp: blue in every other 256 ms, seen only from in front of the car. */
export const MODEL_FBIRANCH=490;
const FBI_LAMP={x:0,y:1.2,z:.5};
const RED:readonly [number,number,number]=[255,0,0];
const f=Math.fround,THIRD=f(1/3);
/** Lamp `i` (0 to 3) of a bar: (to × i + from × (3 − i)) / 3 across, in float32 as the executable sums it. */
export function sirenLampPosition(layout:SirenBarLayout,i:number){
 const k=f(i),rest=f(3-k);
 const at=(a:number,b:number)=>f(f(f(f(a)*k)+f(f(b)*rest))*THIRD);
 return {x:at(layout.to,layout.from),y:at(layout.y,layout.y),z:at(layout.z,layout.z)};
}
/** Which colour lamp `i` shows at a game time: ((time + 64 i) >> 8) & 3 is 0 for red, 2 for the second colour. */
export function sirenLampPhase(timeMs:number,i:number):'red'|'second'|undefined{
 const phase=((timeMs+64*i)>>>8)&3;return phase===0?'red':phase===2?'second':undefined;
}
/** The point light's colour (before AddLight's division by 200): a sixth of red while bit 9 of the time is clear, a
 * sixth of the second colour while it is set, eased in over the first 100 ms of each 512 and out over the last 99. */
export function sirenPointLightColour(layout:SirenBarLayout,timeMs:number):[number,number,number]{
 const second=(timeMs&0x200)!==0;
 let c:[number,number,number]=second?[Math.trunc(layout.second[0]/6),Math.trunc(layout.second[1]/6),Math.trunc(layout.second[2]/6)]:[Math.trunc(255/6),0,0];
 let s=timeMs&0x1ff;
 if(s>99&&s<413)return c;
 if(s>=413)s=512-s;
 const scale=f(s/100);c=c.map(v=>Math.trunc(f(v*scale))) as [number,number,number];
 return c;
}
/** The coronas' colour: each channel times CTimeCycle::m_CurrentColours.m_fSpriteBrightness / 10, truncated. */
export function sirenCoronaColour(c:readonly [number,number,number],spriteBrightness:number):[number,number,number]{
 const k=f(spriteBrightness/10);return [Math.trunc(f(c[0]*k)),Math.trunc(f(c[1]*k)),Math.trunc(f(c[2]*k))];
}
export interface SirenFrame {
 /** CTimer::m_snTimeInMilliseconds. */
 timeMs:number;
 /** CTimeCycle::m_CurrentColours.m_fSpriteBrightness, the timecycle's raw value. */
 spriteBrightness:number;
 /** TheCamera.m_fLODDistMultiplier: the coronas reach 150 times it. */
 lodMultiplier:number;
 /** TheCamera's forward, native axes. */
 cameraForward:readonly [number,number,number];
}
/** The siren coronas and point lights of the cars whose sirens sound. */
export class SirenLights {
 private live=new Set<number>();
 private disposed=false;
 /** A point of the car's model frame in native world axes. */
 private static world(car:WorldCar,p:{x:number;y:number;z:number}):[number,number,number]{const w=car.worldPoint(p);return [w.x,-w.z,w.y];}
 update(cars:Iterable<WorldCar>,frame:SirenFrame){
  const coronas:CoronaRegistration[]=[],pointLights:EntityPointLight[]=[];
  this.live.clear();
  if(this.disposed)return {coronas,pointLights};
  const time=frame.timeMs>>>0,range=150*frame.lodMultiplier;
  for(const car of cars){
   if(car.wrecked||car.disposed||!car.siren)continue;
   const handle=car.car.body.handle;
   // An id per car and lamp no other CCoronas user shares (the executable's is the vehicle's address + 21 + i).
   const id=(i:number)=>0x51000000+handle*4+i;
   const corona=(i:number,color:readonly [number,number,number],at:{x:number;y:number;z:number}):CoronaRegistration=>({id:id(i),color,intensity:255,
    position:SirenLights.world(car,at),size:.4,range,pullTowardsCamera:1.5,fadeSpeed:15});
   if(car.modelId===MODEL_FBIRANCH){
    this.live.add(handle);
    if(!((time>>>8)&1))continue;
    // Only while the camera looks against the car's heading, at its front.
    const o=SirenLights.world(car,{x:0,y:0,z:0}),ahead=SirenLights.world(car,{x:0,y:1,z:0}),c=frame.cameraForward;
    if(c[0]*(ahead[0]-o[0])+c[1]*(ahead[1]-o[1])+c[2]*(ahead[2]-o[2])>=0)continue;
    coronas.push(corona(0,[0,0,255],FBI_LAMP));continue;
   }
   const layout=SIREN_BAR_LAYOUTS.get(car.modelId);if(!layout)continue;
   this.live.add(handle);
   // CPointLights::AddLight(PLTYPE_POINTLIGHT, the car's position + 2 × its up, radius 10, colour / 200, shadows on).
   const light=sirenPointLightColour(layout,time);
   pointLights.push({position:SirenLights.world(car,{x:0,y:0,z:2}),radius:10,color:[light[0]/200,light[1]/200,light[2]/200]});
   const red=sirenCoronaColour(RED,frame.spriteBrightness),second=sirenCoronaColour(layout.second,frame.spriteBrightness);
   for(let i=0;i<4;i++){
    const phase=sirenLampPhase(time,i);if(!phase)continue;
    coronas.push(corona(i,phase==='red'?red:second,sirenLampPosition(layout,i)));
   }
  }
  return {coronas,pointLights};
 }
 snapshot(){return {cars:this.live.size};}
 dispose(){this.disposed=true;this.live.clear();}
}
