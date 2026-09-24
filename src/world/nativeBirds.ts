/** CBirds (gta-reversed 0076f901, Birds.cpp 0x711EC0-0x712E40): up to six birds flying past the camera by day. All
 * positions are native world units. */
export type BirdBiome='water'|'desert'|'normal';
export interface NativeBird {
 created:boolean;position:[number,number,number];currentVelocity:[number,number,number];targetVelocity:[number,number,number];
 /** m_fAngle: atan2 of the target velocity's x over y. */
 angle:number;
 /** m_nWingStillness: the wing beat period in ms (1,000,000 for a desert glider). */
 wingStillness:number;size:number;maxDistance:number;
 bodyColor:[number,number,number];wingsColor:[number,number,number];mustDoCurves:boolean;
}
/** CBirds::faCreationCoors: the flock's formation offsets. */
const CREATION_X=[0,-1,2,-3,1,-2],CREATION_Y=[0,-1,-2,1,1,-2],CREATION_Z=[0,.5,1,.7,2,1.2];
export const MAX_BIRDS=6;
/** GetMaxDistance: past this 2D distance from the camera a bird is removed; its render alpha fades over the last 30%. */
export const birdMaxDistance=(biome:BirdBiome)=>biome==='water'?45:biome==='desert'?80:40;

/** What CBirds::Update reads of the world each frame. */
export interface BirdWorld {
 camera:[number,number,number];
 /** TheCamera's forward, native. */
 forward:[number,number,number];
 /** CGame::currArea. */
 area:number;
 /** CClock hours. */
 hour:number;
 /** TheCamera.m_fDistanceToWater. */
 distanceToWater:number;
 /** CWeather::WeatherRegion is WEATHER_REGION_DESERT. */
 desert:boolean;
 /** CWaterLevel::GetWaterLevelNoWaves, or undefined off the water. */
 waterLevel(x:number,y:number):number|undefined;
 /** CWorld::GetIsLineOfSightClear against buildings only. */
 lineOfSightClear(from:[number,number,number],to:[number,number,number]):boolean;
}

/** `rand` gives CGeneral::GetRandomNumber's 0..32767. */
export class NativeBirds {
 readonly birds:NativeBird[]=Array.from({length:MAX_BIRDS},()=>({created:false,position:[0,0,0],currentVelocity:[0,0,0],targetVelocity:[0,0,0],angle:0,wingStillness:500,size:.5,maxDistance:40,bodyColor:[0,0,0],wingsColor:[0,0,0],mustDoCurves:false}));
 /** uiNumberOfBirds. */
 count=0;
 /** bHasBirdBeenShot and vecBirdShotAt. */
 shot?:[number,number,number];
 constructor(private rand:()=>number=()=>Math.floor(Math.random()*32768)){}
 /** CGeneral::GetRandomNumberInRange(float, float). */
 private rangeF(min:number,max:number){return min+(max-min)*(this.rand()/32767);}
 /** CGeneral::GetRandomNumberInRange(int, int): max exclusive. */
 private rangeI(min:number,max:number){return Math.trunc(this.rangeF(min,max-1));}
 /** CBirds::CreateNumberOfBirds (0x711EF0). */
 createNumberOfBirds(start:[number,number,number],target:[number,number,number],count:number,biome:BirdBiome,checkObstacles:boolean,world?:Pick<BirdWorld,'lineOfSightClear'>){
  const maxDistance=birdMaxDistance(biome);
  for(let i=0;i<count;i++){
   const bird=this.birds.find(b=>!b.created);if(!bird)return;
   const d=[target[0]-start[0],target[1]-start[1],target[2]-start[2]],length=Math.hypot(...d)||1,dir=d.map(v=>v/length) as [number,number,number];
   const check:[number,number,number]=[start[0]+dir[0]*maxDistance*2.4,start[1]+dir[1]*maxDistance*2.4,start[2]+dir[2]*maxDistance*2.4];
   if(checkObstacles&&world&&!world.lineOfSightClear(start,check))continue;
   this.count++;bird.created=true;bird.maxDistance=maxDistance;bird.mustDoCurves=false;
   bird.angle=Math.atan2(dir[0],dir[1]);
   bird.position=[start[0]+CREATION_X[i],start[1]+CREATION_Y[i],start[2]+CREATION_Z[i]];
   const speedRand=this.rand()%31;let speed:number;
   if(biome==='water'){
    speed=speedRand/50+4;
    const body=this.rand()%64+80,wings=(this.rand()%64-76)&255;
    bird.bodyColor=[body,body,body];bird.wingsColor=[wings,wings,wings];
    bird.size=this.rangeF(.8,1.2);bird.wingStillness=1000-12*speedRand;
   }else if(biome==='desert'){
    speed=speedRand/50+3;
    bird.bodyColor=[30,15,10];bird.wingsColor=[80,15,10];
    bird.size=this.rangeF(2,2.5);bird.wingStillness=12*(125-speedRand);
    if(this.rand()&4)bird.wingStillness=1_000_000;
    if(this.rand()&8)bird.mustDoCurves=true;
   }else{
    speed=speedRand/50+5;
    const body=this.rangeI(128,256),wings=this.rangeI(128,256);
    bird.bodyColor=[body,body,body];bird.wingsColor=[wings,wings,wings];
    bird.size=this.rangeF(.5,.6);bird.wingStillness=500-6*speedRand;
   }
   bird.targetVelocity=[dir[0]*speed,dir[1]*speed,dir[2]*speed];bird.currentVelocity=[...bird.targetVelocity];
  }
 }
 /** CBirds::Update (0x712330) for one frame: `frame` is CTimer's frame counter, `timeStep` the frame's seconds. */
 update(world:BirdWorld,frame:number,timeStep:number){
  const cam=world.camera;
  if(world.area===0&&this.count<MAX_BIRDS&&world.hour>5&&world.hour<22&&frame%512===MAX_BIRDS){
   let toCreate=this.rangeI(0,MAX_BIRDS-this.count)+1,biome:BirdBiome='water';
   if(world.distanceToWater>30){
    if(world.desert){biome='desert';toCreate=Math.min(toCreate,this.count);}
    else biome='normal';
   }
   if(toCreate>0){
    this.rand();this.rand();
    const distance=birdMaxDistance(biome),height=biome==='water'?this.rangeF(4,13):biome==='desert'?this.rangeF(15,25):this.rangeF(2,10);
    const z=height+cam[2];
    if(z>5){
     let angle:number;
     if(this.rand()%2)angle=(this.rand()%256)*.024531251;
     else{
      let fx=world.forward[0];const fy=world.forward[1];if(fx===0)fx=.01;
      const l=Math.hypot(fx,fy)||1,offset=((this.rand()%256)-128)&255;
      angle=offset/256+Math.atan2(fx/l,fy/l);
     }
     const spawn:[number,number,number]=[Math.sin(angle)*distance+cam[0],Math.cos(angle)*distance+cam[1],z];
     const water=world.waterLevel(spawn[0],spawn[1]);
     if(water===undefined||water+4<z){
      const l=Math.hypot(world.forward[0],world.forward[1])||1;
      const target:[number,number,number]=[cam[0]+world.forward[0]/l*8,cam[1]+world.forward[1]/l*8,z];
      this.createNumberOfBirds(spawn,target,toCreate,biome,true,world);
     }
    }
   }
  }
  const checked=this.birds[frame%MAX_BIRDS];
  if(checked.created&&Math.hypot(cam[0]-checked.position[0],cam[1]-checked.position[1])>checked.maxDistance){checked.created=false;this.count--;}
  for(const bird of this.birds){
   if(!bird.created)continue;
   if(bird.mustDoCurves){
    const a=timeStep/10,[tx,ty]=bird.targetVelocity,s=Math.sin(a),c=Math.cos(a);
    bird.targetVelocity[0]=c*tx+s*ty;bird.targetVelocity[1]=c*ty-s*tx;
   }
   const t=Math.min(timeStep/2,1);
   for(let k=0;k<3;k++){bird.currentVelocity[k]+=(bird.targetVelocity[k]-bird.currentVelocity[k])*t;bird.position[k]+=timeStep*bird.currentVelocity[k];}
   bird.angle=Math.atan2(bird.targetVelocity[0],bird.targetVelocity[1]);
  }
 }
 /** CBirds::HandleGunShot (0x712E40): a bullet line through a bird's 0.5 sphere kills it. */
 handleGunShot(a:readonly [number,number,number],b:readonly [number,number,number]){
  for(const bird of this.birds){
   if(!bird.created||!lineHitsSphere(a,b,bird.position,.5))continue;
   this.shot=[...bird.position];bird.created=false;this.count--;
  }
 }
}
/** CCollision::TestLineSphere for a segment. */
export function lineHitsSphere(a:readonly number[],b:readonly number[],center:readonly number[],radius:number){
 const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],f=[a[0]-center[0],a[1]-center[1],a[2]-center[2]];
 const dd=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];if(dd===0)return f[0]*f[0]+f[1]*f[1]+f[2]*f[2]<=radius*radius;
 const t=Math.max(0,Math.min(1,-(f[0]*d[0]+f[1]*d[1]+f[2]*d[2])/dd)),p=[f[0]+d[0]*t,f[1]+d[1]*t,f[2]+d[2]*t];
 return p[0]*p[0]+p[1]*p[1]+p[2]*p[2]<=radius*radius;
}

/** CBirds::Render's vertices for one bird (0x712810): eight on one side, then the mirror at 0.8 of the colour. Returns
 * native positions, RGBA bytes and UVs for 16 vertices; `slot` is the bird's index (100 ms of wing phase each). */
export function birdVertices(bird:NativeBird,slot:number,timeMs:number,camera:readonly [number,number,number]){
 const RENDER_U=[0,1,0,1,0,1,1,.5],RENDER_V=[.5,.5,.75,.75,1,1,1,.5],POS_Y=[.25,-.25,.25,-.25,0,-.25,-.35,-.35];
 const time=(timeMs+slot*100)>>>0,still=bird.wingStillness,tau=Math.PI*2;
 const px=bird.position[0],py=bird.position[1],pz=bird.position[2]+Math.sin((time%still)*(tau/still))*.1;
 const cs=Math.cos(bird.angle)*bird.size,sn=Math.sin(bird.angle)*bird.size;
 const sin1=-Math.sin(((time+Math.trunc(still/6))%still)*tau/still),sin2=-Math.sin(((time+still)%still)*tau/still);
 const sizeUsed=Math.max(1,bird.size),f1=sin1/sizeUsed,f2=sin2/sizeUsed;
 const offX1=Math.cos(f1)*.5,offZ1=Math.sin(f1)*.5,offX2=Math.cos(f2)*.5,offZ2=Math.sin(f2)*.5;
 const distance=Math.hypot(camera[0]-bird.position[0],camera[1]-bird.position[1],camera[2]-bird.position[2]),cutoff=bird.maxDistance*.7;
 const alpha=distance>cutoff?Math.trunc(Math.max(0,1-(distance-cutoff)/(bird.maxDistance-cutoff))*255):255;
 const positions=new Float32Array(48),colors=new Uint8Array(64),uvs=new Float32Array(32);
 for(let i=0;i<8;i++){
  const [x,z]=i===2||i===3?[offX1,offZ1]:i===4||i===5?[offX1+offX2,offZ1+offZ2]:i===6?[.1,0]:[0,0],y=POS_Y[i];
  const color=i===4||i===5?bird.wingsColor:bird.bodyColor;
  for(const [side,sx] of [[0,1],[1,-1]] as const){
   const lx=x*sx,v=i+side*8;
   // TransformPoint with right (cos, −sin, 0)·size, forward (sin, cos, 0)·size and up (0, 0, size).
   positions.set([px+cs*lx+sn*y,py-sn*lx+cs*y,pz+bird.size*z],v*3);
   const scale=side?.8:1;colors.set([Math.trunc(color[0]*scale),Math.trunc(color[1]*scale),Math.trunc(color[2]*scale),alpha],v*4);
   uvs.set([RENDER_U[i],RENDER_V[i]],v*2);
  }
 }
 return {positions,colors,uvs};
}
/** CBirds::auRenderIndices, then the same triangles on the mirrored eight. */
export const BIRD_INDICES=[0,3,1,0,2,3,2,4,5,2,5,3,0,1,3,0,3,2,2,5,4,2,3,5,0,6,7,0,7,6];

/** TheCamera.m_fDistanceToWater comes from CWaterLevel::FindNearestWaterAndItsFlow, a retail stub. Birds only ask
 * whether it exceeds 30, so this samples water.dat on rings of 10, 20 and 30 units (16 directions) and returns the
 * first ring with water, 0 over water, or Infinity. */
export function sampledDistanceToWater(level:(x:number,y:number)=>number|undefined,x:number,y:number){
 if(level(x,y)!==undefined)return 0;
 for(const r of [10,20,30])for(let i=0;i<16;i++){const a=i*Math.PI/8;if(level(x+Math.cos(a)*r,y+Math.sin(a)*r)!==undefined)return r;}
 return Infinity;
}
