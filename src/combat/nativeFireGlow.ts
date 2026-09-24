/* The glow of fires on the ground and in the air, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: the tail
 * of CFireManager::Update (FireManager.cpp). Fires are grouped around the strongest one not yet visited (fires within
 * 6 units 2D join it). A group stronger than 4 stores an additive `shad_exp` static shadow 5 units above the strongest
 * fire, colour (40, 32, 20) × a random 0.6 to 1; one stronger than 6 also registers four headlight coronas in a ⊥ that
 * faces the camera. Native coordinates. */
import type {LightPool} from '../world/nativeEntityLights';
import type {CoronaRegistration} from '../world/nativeCoronas';

type V3={x:number;y:number;z:number};
const BASE=[40,32,20] as const;
/** Corona ids for fires, clear of the entity ids (CFireManager uses the fire's address). */
export const FIRE_CORONA_ID_BASE=0x7f000000;
export function fireGlow(fires:readonly {active:boolean;strength:number;position:V3}[],camera:readonly [number,number,number],cameraRight:{x:number;y:number},random:()=>number=Math.random){
 const pools:LightPool[]=[],coronas:CoronaRegistration[]=[];
 const visited=new Array<boolean>(fires.length).fill(false);
 let left=fires.filter(f=>f.active).length;
 while(left>0){
  let strongest=-1;
  for(let i=0;i<fires.length;i++){if(visited[i]||!fires[i].active)continue;if(strongest<0||fires[strongest].strength<fires[i].strength)strongest=i;}
  const s=fires[strongest];let combined=0,ceil=0;
  for(let i=0;i<fires.length;i++){
   const f=fires[i];if(visited[i]||!f.active)continue;
   if(Math.hypot(f.position.x-s.position.x,f.position.y-s.position.y)<6){combined+=f.strength;ceil+=Math.ceil(f.strength);left--;visited[i]=true;}
  }
  if(!(combined>4&&ceil))continue;
  const dir=Math.min(7,combined-6+3),mult=.6+random()*.4,color=BASE.map(c=>Math.trunc(c*mult)) as [number,number,number];
  pools.push({id:-(strongest+1),position:[s.position.x,s.position.y,s.position.z+5],size:0,color,intensity:0,maxHeight:10,front:[dir*-1.2,0],side:[0,dir*1.2],maxDistance:40});
  if(combined>6){
   // The reversed source reads `point` in its own initialiser; the point 2.6 above the fire, pulled 3.5 toward the camera.
   const up={x:s.position.x,y:s.position.y,z:s.position.z+2.6},to=[camera[0]-up.x,camera[1]-up.y,camera[2]-up.z],l=Math.hypot(...to)||1;
   const p:[number,number,number]=[up.x+to[0]/l*3.5,up.y+to[1]/l*3.5,up.z+to[2]/l*3.5];
   const rl=Math.hypot(cameraRight.x,cameraRight.y)||1,right=[cameraRight.x/rl,cameraRight.y/rl];
   const tint=BASE.map(c=>Math.trunc(c*mult*.8)) as [number,number,number],id=FIRE_CORONA_ID_BASE+strongest*4;
   const corona=(k:number,position:[number,number,number],flareType=0):CoronaRegistration=>({id:id+k,color:tint,intensity:255,position,size:dir*.5,range:70,flareType,pullTowardsCamera:1.5,fadeSpeed:15});
   coronas.push(corona(0,p,2),corona(1,[p[0],p[1],p[2]+2]),corona(2,[p[0]+right[0]*2,p[1]+right[1]*2,p[2]]),corona(3,[p[0]-right[0]*2,p[1]-right[1]*2,p[2]]));
  }
 }
 return {pools,coronas};
}
