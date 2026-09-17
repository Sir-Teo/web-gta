import {FX_INFO,fxIntegrate,fxInterpolate,type FxInfoBlueprint,type FxPrimBlueprint,type FxSystemBlueprint} from '../../assets/fxProject';
/** RwMatrix in native Z-up space: right (0-2), up (3-5), at (6-8), pos (9-11). */
export type FxMatrix=Float64Array;
export type FxVec=[number,number,number];
export const fxIdentity=():FxMatrix=>Float64Array.of(1,0,0,0,1,0,0,0,1,0,0,0);
export function fxTranslation(x:number,y:number,z:number){const m=fxIdentity();m[9]=x;m[10]=y;m[11]=z;return m;}
/** RwMatrixMultiply(out, a, b): transform by `a`, then by `b`. */
export function fxMultiply(a:FxMatrix,b:FxMatrix,out:FxMatrix=new Float64Array(12)){
 const r=new Float64Array(12);
 for(let row=0;row<4;row++){const x=a[row*3],y=a[row*3+1],z=a[row*3+2],w=row===3?1:0;for(let c=0;c<3;c++)r[row*3+c]=x*b[c]+y*b[3+c]+z*b[6+c]+w*b[9+c];}
 out.set(r);return out;
}
export const fxTransformPoint=(m:FxMatrix,x:number,y:number,z:number):FxVec=>[x*m[0]+y*m[3]+z*m[6]+m[9],x*m[1]+y*m[4]+z*m[7]+m[10],x*m[2]+y*m[5]+z*m[8]+m[11]];
export const fxTransformVector=(m:FxMatrix,x:number,y:number,z:number):FxVec=>[x*m[0]+y*m[3]+z*m[6],x*m[1]+y*m[4]+z*m[7],x*m[2]+y*m[5]+z*m[8]];
/** FxPrtMult_c: colour (0-1), size, rotation and life multipliers. */
export interface FxPrtMult {r:number;g:number;b:number;a:number;size:number;rot:number;life:number;}
export const FX_PRT_MULT:FxPrtMult={r:1,g:1,b:1,a:1,size:1,rot:1,life:1};
export const fxPrtMult=(r:number,g:number,b:number,a:number,size:number,rot:number,life:number):FxPrtMult=>({r,g,b,a,size,rot,life});
/** FxEmitterPrt_c. */
export interface FxParticle {
 system:NativeFxSystem;totalLife:number;currentLife:number;pos:FxVec;vel:FxVec;
 /** CRGBA bytes. */multColor:[number,number,number,number];multSize:number;multRot:number;
 randR:number;randG:number;randB:number;brightness:number;rotZ:number;local:boolean;rotation:number;
 /** Browser particle side of the water surface when it was created (UNDERWATER info). */underwater:boolean;
}
/** Emission, movement and weather hooks the FX runtime reads from the game. */
export interface FxWorld {
 random():number;
 /** CWorld::ProcessVerticalLine for FX_INFO_GROUNDCOLLIDE: highest ground at or below `top` down to `bottom`. */
 ground?(x:number,y:number,top:number,bottom:number):{z:number;normal:FxVec}|undefined;
 /** CWaterLevel::GetWaterLevelNoWaves for float/underwater particles. */
 waterLevel?(x:number,y:number):number|undefined;
 /** Camera frustum test used by FxManager_c::ShouldCreate (native space). */
 sphereVisible?(x:number,y:number,z:number,radius:number):boolean;
}
export interface EmissionInfo {count:number;radius:number;sizeMin:FxVec;sizeMax:FxVec;speed:number;speedBias:number;direction:FxVec;angleMin:number;angleMax:number;life:number;lifeBias:number;pos:FxVec;rotationMin:number;rotationMax:number;minWind:number;maxWind:number;minRain:number;maxRain:number;}
export interface MovementInfo {pos:FxVec;vel:FxVec;rot:[number,number,number,number];float:boolean;underwater:boolean;}
export const RENDER_COLOUR={normal:0,range:1,bright:2} as const;
export interface RenderInfo {
 color1:[number,number,number,number];color2:[number,number,number,number];colorType:number;
 sizeX:number;sizeY:number;sizeXBias:number;sizeYBias:number;
 spriteTop:number;spriteBottom:number;spriteLeft:number;spriteRight:number;
 trailMode:number;trailTime:number;animTextures:boolean;texture:number;heatHaze:boolean;selfLit:boolean;
 flat?:FxMatrix;hasDir:boolean;useVel:boolean;direction:FxVec;smokeType:number;
}
export const FX_PARTICLE_POOL=1000;
const uint8=(v:number)=>((Math.trunc(v)%256)+256)%256;
const uint16=(v:number)=>((Math.trunc(v)%65536)+65536)%65536;
const values:number[]=[];
/** FxInfoManager_c::ProcessEmissionInfo. */
export function processEmission(prim:FxPrimBlueprint,currentTime:number,mult:number,totalTime:number,useConst:boolean):EmissionInfo{
 const e:EmissionInfo={count:mult*10,radius:0,sizeMin:[0,0,0],sizeMax:[0,0,0],speed:0,speedBias:0,direction:[0,0,1],angleMin:0,angleMax:0,life:1,lifeBias:0,pos:[0,0,0],rotationMin:0,rotationMax:0,minWind:0,maxWind:2,minRain:0,maxRain:2};
 for(let i=0;i<prim.movementOffset;i++){
  const info=prim.infos[i];if(!(info.type&0x1000))continue;
  const v=fxInterpolate(info.interp,currentTime,values);
  switch(info.type){
   case FX_INFO.emRate:{const before=currentTime-mult;e.count=useConst?v[0]*mult:before>=0?fxIntegrate(info.interp,0,currentTime,mult):fxIntegrate(info.interp,0,totalTime,-before)+fxIntegrate(info.interp,0,currentTime,before+mult);break;}
   case FX_INFO.emSize:e.radius=v[0];e.sizeMin=[v[1],v[3],v[5]];e.sizeMax=[v[2],v[4],v[6]];break;
   case FX_INFO.emSpeed:e.speed=v[0];e.speedBias=v[1];break;
   case FX_INFO.emDir:e.direction=[v[0],v[1],v[2]];break;
   case FX_INFO.emAngle:e.angleMin=v[0];e.angleMax=v[1];break;
   case FX_INFO.emLife:e.life=v[0];e.lifeBias=v[1];break;
   case FX_INFO.emPos:e.pos=[v[0],v[1],v[2]];break;
   case FX_INFO.emWeather:e.minWind=v[0];e.maxWind=v[1];e.minRain=v[2];e.maxRain=v[3];break;
   case FX_INFO.emRotation:e.rotationMin=v[0];e.rotationMax=v[1];break;
  }
 }
 return e;
}
const infoTime=(info:FxInfoBlueprint,currentTime:number,mult:number,length:number)=>info.timeModeParticle?mult:currentTime/length;
/** A random unit-ish vector from CGeneral::GetRandomNumber() % 10000 / 5000 - 1 per axis, normalised. */
function randomDirection(world:FxWorld):FxVec{const v:FxVec=[world.random()*2-1,world.random()*2-1,world.random()*2-1],l=Math.hypot(...v);return l>0?[v[0]/l,v[1]/l,v[2]/l]:[0,0,0];}
export class NativeFxPrim {
 readonly particles:FxParticle[]=[];
 constructor(readonly bp:FxPrimBlueprint,readonly system:FxSystemBlueprint,readonly manager:NativeFxManager){}
 /** FxEmitterBP_c::Update. */
 update(dt:number){
  for(let i=0;i<this.particles.length;i++){
   const prt=this.particles[i],system=prt.system;
   if(system.killStatus===FX_KILL.waiting)system.killStatus=FX_KILL.killed;
   if(system.playStatus!==FX_PLAY.paused&&this.updateParticle(dt,prt)){this.particles.splice(i--,1);this.manager.returnParticle();}
  }
 }
 /** FxEmitterBP_c::UpdateParticle port (0x4A21D0): life, movement infos and integration. */
 updateParticle(deltaTime:number,prt:FxParticle){
  const system=prt.system,dt=deltaTime*system.timeMult,world=this.manager.world;
  prt.currentLife+=dt;
  if(prt.currentLife>=prt.totalLife)return true;
  const mult=prt.currentLife/prt.totalLife,length=system.bp.length;
  const m:MovementInfo={pos:prt.pos,vel:prt.vel,rot:[0,0,0,0],float:false,underwater:false};
  for(let i=this.bp.movementOffset;i<this.bp.renderOffset;i++){
   const info=this.bp.infos[i];if(!(info.type&0x2000))continue;
   const v=fxInterpolate(info.interp,infoTime(info,system.currentTime,mult,length),values);
   switch(info.type){
    case FX_INFO.noise:{const speed=Math.hypot(...m.vel),r=randomDirection(world),s=v[0]*dt;for(let k=0;k<3;k++)m.vel[k]+=r[k]*s;const l=Math.hypot(...m.vel);if(l>0)for(let k=0;k<3;k++)m.vel[k]*=speed/l;break;}
    case FX_INFO.force:for(let k=0;k<3;k++)m.vel[k]+=v[k]*dt;break;
    case FX_INFO.friction:{const s=Math.pow(v[0],dt*50);for(let k=0;k<3;k++)m.vel[k]*=s;break;}
    case FX_INFO.attractPoint:{const d:FxVec=[v[0]-m.pos[0],v[1]-m.pos[1],v[2]-m.pos[2]],l=Math.hypot(...d);if(l>.1)for(let k=0;k<3;k++)m.vel[k]+=d[k]/l*v[3]*dt;break;}
    case FX_INFO.attractLine:{
     const a:FxVec=[v[0],v[1],v[2]],b:FxVec=[v[3],v[4],v[5]],ab:FxVec=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ap:FxVec=[m.pos[0]-a[0],m.pos[1]-a[1],m.pos[2]-a[2]];
     const len2=ab[0]**2+ab[1]**2+ab[2]**2,t=len2>0?Math.min(1,Math.max(0,(ap[0]*ab[0]+ap[1]*ab[1]+ap[2]*ab[2])/len2)):0;
     const d:FxVec=[a[0]+ab[0]*t-m.pos[0],a[1]+ab[1]*t-m.pos[1],a[2]+ab[2]*t-m.pos[2]],l=Math.hypot(...d);if(l>.1)for(let k=0;k<3;k++)m.vel[k]+=d[k]/l*v[6]*dt;break;
    }
    case FX_INFO.groundCollide:{
     const next=m.pos[2]+m.vel[2]*dt,hit=m.vel[2]<0?world.ground?.(m.pos[0],m.pos[1],m.pos[2],next):undefined;
     if(hit&&next<hit.z){
      const n=hit.normal,dot=m.vel[0]*n[0]+m.vel[1]*n[1]+m.vel[2]*n[2],r=randomDirection(world),error=v[2]*dt*5;
      const out:FxVec=[m.vel[0]-n[0]*dot*(1+v[0])+r[0]*error,m.vel[1]-n[1]*dot*(1+v[0])+r[1]*error,m.vel[2]-n[2]*dot*(1+v[0])+r[2]*error];
      m.pos[2]=hit.z;for(let k=0;k<3;k++)m.vel[k]=out[k]*v[1];
     }
     break;
    }
    case FX_INFO.wind:{const s=v[0]*this.manager.windSpeed*dt;for(let k=0;k<3;k++)m.vel[k]+=this.manager.windDir[k]*s;break;}
    case FX_INFO.jitter:{const r=randomDirection(world),s=v[0]*dt;for(let k=0;k<3;k++)m.pos[k]+=r[k]*s;break;}
    case FX_INFO.rotSpeed:m.rot=[v[0],v[1],v[2],v[3]];break;
    case FX_INFO.float:m.float=true;break;
    case FX_INFO.underwater:m.underwater=true;break;
   }
  }
  for(let k=0;k<3;k++)prt.pos[k]=m.pos[k]+m.vel[k]*dt;
  // ROTSPEED: MINCW, MAXCW, MINCCW, MAXCCW degrees per second, chosen per particle.
  if(m.rot.some(r=>r!==0)){const t=prt.randG/255,speed=prt.randB&1?-(m.rot[2]+(m.rot[3]-m.rot[2])*t):m.rot[0]+(m.rot[1]-m.rot[0])*t;prt.rotation+=speed*dt;}
  if((m.float||m.underwater)&&!prt.local){
   const level=world.waterLevel?.(prt.pos[0],prt.pos[1]);
   if(m.float&&level!==undefined&&prt.pos[2]<level){prt.pos[2]=level;if(prt.vel[2]<0)prt.vel[2]=0;}
   if(m.underwater&&(level===undefined?prt.underwater:(prt.pos[2]<level)!==prt.underwater))return true;
  }
  return false;
 }
 /** FxInfoManager_c::ProcessRenderInfo for one particle, as FxEmitterBP_c::Render evaluates it. */
 renderInfo(prt:FxParticle,out:RenderInfo){
  const system=prt.system,mult=prt.currentLife/prt.totalLife,length=system.bp.length;
  out.color1=[255,255,255,255];out.color2=[0,0,0,0];out.colorType=RENDER_COLOUR.normal;out.sizeX=.1;out.sizeY=.1;out.sizeXBias=0;out.sizeYBias=0;
  out.spriteTop=.5;out.spriteBottom=-.5;out.spriteLeft=.5;out.spriteRight=-.5;out.heatHaze=false;out.selfLit=false;out.flat=undefined;out.animTextures=false;out.texture=0;
  out.trailMode=0;out.trailTime=0;out.hasDir=false;out.useVel=false;out.smokeType=-1;
  for(let i=this.bp.renderOffset;i<this.bp.infos.length;i++){
   const info=this.bp.infos[i];if(!(info.type&0xc000))continue;
   const v=fxInterpolate(info.interp,infoTime(info,system.currentTime,mult,length),values);
   switch(info.type){
    case FX_INFO.colour:out.color1=[uint8(v[0]),uint8(v[1]),uint8(v[2]),uint8(v[3])];break;
    case FX_INFO.size:out.sizeX=v[0];out.sizeY=v[1];out.sizeXBias=info.interp.keys.length===4?v[2]:0;out.sizeYBias=info.interp.keys.length===4?v[3]:0;break;
    case FX_INFO.spriteRect:out.spriteTop=v[0];out.spriteBottom=v[1];out.spriteLeft=v[2];out.spriteRight=v[3];break;
    case FX_INFO.heatHaze:out.heatHaze=true;break;
    case FX_INFO.trail:out.trailTime=v[0];out.trailMode=v[1]>.1?2:1;break;
    case FX_INFO.flat:out.flat=Float64Array.of(v[0],v[1],v[2],v[3],v[4],v[5],v[6],v[7],v[8],0,0,0);break;
    case FX_INFO.dir:out.hasDir=true;out.direction=[v[0],v[1],v[2]];if(Math.hypot(v[0],v[1],v[2])<.001)out.useVel=true;break;
    case FX_INFO.animTex:out.animTextures=true;out.texture=Math.trunc(v[0]);break;
    case FX_INFO.colourRange:out.color1=[uint8(v[0]),uint8(v[2]),uint8(v[4]),uint8(v[6])];out.color2=[uint8(v[1]),uint8(v[3]),uint8(v[5]),0];out.colorType=RENDER_COLOUR.range;break;
    case FX_INFO.selfLit:out.selfLit=true;break;
    case FX_INFO.colourBright:out.color1=[uint8(v[0]),uint8(v[1]),uint8(v[2]),uint8(v[3])];out.color2[3]=uint8(v[4]);out.colorType=RENDER_COLOUR.bright;break;
    case FX_INFO.smoke:out.smokeType=Math.trunc(v[0]);break;
   }
  }
  return out;
 }
}
export const FX_PLAY={playing:0,stopped:1,paused:2} as const;
export const FX_KILL={alive:0,playAndKill:1,killed:2,waiting:3} as const;
/** FxEmitter_c: per-system emission accumulator for one prim blueprint. */
interface Emitter {prim:NativeFxPrim;enabled:boolean;intensity:number;}
export class NativeFxSystem {
 parent?:FxMatrix;local:FxMatrix;
 playStatus:number=FX_PLAY.stopped;killStatus:number=FX_KILL.alive;
 useConstTime=false;currentTime=0;cameraDistance=0;constTime=0;rateMult=1;timeMult=1;
 createLocal=false;mustCreate=false;stopCreation=false;loopInterval=0;velAdd:FxVec=[0,0,0];
 readonly emitters:Emitter[];
 destroyed=false;
 constructor(readonly manager:NativeFxManager,readonly bp:FxSystemBlueprint,prims:NativeFxPrim[],local:FxMatrix,parent?:FxMatrix){
  this.local=Float64Array.from(local);this.parent=parent;this.emitters=prims.map(prim=>({prim,enabled:true,intensity:0}));
 }
 get name(){return this.bp.name;}
 /** FxSystem_c::Play. */
 play(){
  if(this.playStatus!==FX_PLAY.paused){this.currentTime=0;for(const e of this.emitters)e.intensity=0;}
  this.killStatus=FX_KILL.alive;this.playStatus=FX_PLAY.playing;this.stopCreation=false;
  this.loopInterval=Math.trunc(this.manager.world.random()*10000)/10000*(this.bp.loopLength-this.bp.loopIntervalMin)+this.bp.loopIntervalMin;
  return this;
 }
 /** FxSystem_c::PlayAndKill: only one-shot (play mode 0) systems destroy themselves when finished. */
 playAndKill(){this.play();if(this.bp.playMode===0)this.killStatus=FX_KILL.playAndKill;return this;}
 stop(){this.playStatus=FX_PLAY.stopped;this.currentTime=0;for(const e of this.emitters)e.intensity=0;}
 kill(){this.stop();this.killStatus=FX_KILL.killed;}
 pause(){if(this.playStatus===FX_PLAY.stopped)return;this.playStatus=this.playStatus===FX_PLAY.paused?FX_PLAY.playing:FX_PLAY.paused;}
 enablePrim(index:number,enabled:boolean){if(this.emitters[index])this.emitters[index].enabled=enabled;}
 setOffsetPos(x:number,y:number,z:number){this.local[9]=x;this.local[10]=y;this.local[11]=z;}
 /** FxSystem_c::SetMatrix: a copied parent keeps its own storage. */
 setMatrix(matrix:FxMatrix){if(this.ownsParent&&this.parent)this.parent.set(matrix);else this.parent=matrix;}
 private ownsParent=false;
 copyParentMatrix(){if(this.parent){this.parent=Float64Array.from(this.parent);this.ownsParent=true;}}
 setConstTime(on:boolean,time:number){this.useConstTime=on;this.constTime=uint16(Math.fround(time*256))/256;}
 setRateMult(mult:number){this.rateMult=uint16(Math.fround(mult*1000))/1000;}
 setTimeMult(mult:number){this.timeMult=uint16(Math.fround(mult*1000))/1000;}
 setVelAdd(x:number,y:number,z:number){this.velAdd=[x,y,z];}
 setLocalParticles(enabled:boolean){this.createLocal=enabled;}
 setMustCreatePrts(enabled:boolean){this.mustCreate=enabled;}
 composite(out:FxMatrix=new Float64Array(12)){return this.parent?fxMultiply(this.local,this.parent,out):(out.set(this.local),out);}
 /** FxSystem_c::AddParticle: surface lighting below the limit darkens the particle. */
 addParticle(pos:FxVec,vel:FxVec,timeSince:number,mult:FxPrtMult=FX_PRT_MULT,rotZ=-1,lightMult=1.2,lightMultLimit=.6,createLocal=false){
  const brightness=lightMult<lightMultLimit?1-lightMultLimit+lightMult:1;
  for(const emitter of this.emitters)if(emitter.enabled)this.addEmitterParticle(emitter,pos,vel,timeSince,mult,rotZ,brightness,createLocal);
 }
 /** FxEmitter_c::AddParticle (position overload). */
 private addEmitterParticle(emitter:Emitter,pos:FxVec,vel:FxVec,timeSince:number,mult:FxPrtMult,rotZ:number,brightness:number,createLocal:boolean){
  const emission=processEmission(emitter.prim.bp,0,0,this.bp.length,this.useConstTime);
  let matrix=fxTranslation(...pos);if(this.parent)matrix=fxMultiply(matrix,this.parent);
  const world=emitter.prim.bp.matrix?fxMultiply(primMatrix(emitter.prim.bp),matrix):matrix;
  const particle=this.manager.createParticle(emitter.prim,this,emission,world,vel,timeSince,mult,brightness,createLocal);
  if(particle&&rotZ>=0)particle.rotZ=rotZ;
 }
 /** FxEmitter_c::CreateParticles: LOD-scaled emission accumulates and is spent in whole particles. */
 private emit(emitter:Emitter,currentTime:number,dt:number){
  const prim=emitter.prim.bp,emission=processEmission(prim,currentTime,dt,this.bp.length,this.useConstTime);
  const lodStart=prim.lodStart/64,lodEnd=prim.lodEnd/64;
  const visibility=this.cameraDistance<lodStart?1:this.cameraDistance<=lodEnd?1-(this.cameraDistance-lodStart)/(lodEnd-lodStart):0;
  emitter.intensity+=emission.count*(Number.isFinite(visibility)?visibility:0)*this.rateMult;
  const m=this.manager;
  if(!(m.wind>=emission.minWind&&m.wind<=emission.maxWind&&m.rain>=emission.minRain&&m.rain<=emission.maxRain&&emitter.intensity>=1))return;
  const system=this.composite(),world=prim.matrix?fxMultiply(primMatrix(prim),system):system;
  const count=Math.trunc(emitter.intensity);
  for(let step=0;step<count;step++)m.createParticle(emitter.prim,this,emission,world,undefined,step/emitter.intensity*dt,FX_PRT_MULT,1.2,this.createLocal);
  // The native accumulator is cleared rather than keeping the fractional particle.
  emitter.intensity=0;
 }
 /** FxSystem_c::Update port (0x4AAF70): time, looping, culling, emission and kill bookkeeping. */
 update(camera:FxVec,dt:number){
  const composite=this.composite(),scaled=dt*this.timeMult;
  this.cameraDistance=Math.hypot(composite[9]-camera[0],composite[10]-camera[1],composite[11]-camera[2]);
  if(this.playStatus===FX_PLAY.playing){
   if(this.useConstTime)this.currentTime=this.constTime;
   else this.currentTime+=scaled;
   let emitting=!this.stopCreation;
   if(!this.useConstTime&&this.currentTime>this.bp.length){
    if(this.bp.playMode===0){if(this.killStatus===FX_KILL.playAndKill)this.kill();else this.stop();emitting=false;}
    else if(this.currentTime>this.bp.length+this.loopInterval){this.currentTime-=this.bp.length+this.loopInterval;this.loopInterval=Math.trunc(this.manager.world.random()*10000)/10000*(this.bp.loopLength-this.bp.loopIntervalMin)+this.bp.loopIntervalMin;}
    else emitting=false;
   }
   if(this.playStatus===FX_PLAY.playing&&emitting&&this.cameraDistance<=this.bp.cullDistance/256)
    for(const emitter of this.emitters)if(emitter.enabled)this.emit(emitter,this.currentTime,scaled);
  }
  if(this.killStatus===FX_KILL.killed){this.killStatus=FX_KILL.waiting;return false;}
  return this.killStatus===FX_KILL.waiting;
 }
}
const primMatrices=new WeakMap<FxPrimBlueprint,FxMatrix>();
function primMatrix(prim:FxPrimBlueprint){let m=primMatrices.get(prim);if(!m){m=prim.matrix?Float64Array.from(prim.matrix):fxIdentity();primMatrices.set(prim,m);}return m;}
/** RotateVecIntoVec: a vector about +Y rotated so +Y follows `align`. */
function rotateIntoVector(vec:FxVec,align:FxVec):FxVec{
 const ref=[3/Math.sqrt(50),4/Math.sqrt(50),5/Math.sqrt(50)];
 let right:FxVec=[align[1]*ref[2]-align[2]*ref[1],align[2]*ref[0]-align[0]*ref[2],align[0]*ref[1]-align[1]*ref[0]];const l=Math.hypot(...right);if(l>0)right=[right[0]/l,right[1]/l,right[2]/l];
 const at:FxVec=[align[1]*right[2]-align[2]*right[1],align[2]*right[0]-align[0]*right[2],align[0]*right[1]-align[1]*right[0]];
 return [vec[0]*right[0]+vec[1]*align[0]+vec[2]*at[0],vec[0]*right[1]+vec[1]*align[1]+vec[2]*at[1],vec[0]*right[2]+vec[1]*align[2]+vec[2]*at[2]];
}
/** FxManager_c with its blueprint list, systems and the 1000-particle emitter pool. */
export class NativeFxManager {
 readonly prims:NativeFxPrim[]=[];
 readonly systems:NativeFxSystem[]=[];
 private blueprints=new Map<string,{bp:FxSystemBlueprint;prims:NativeFxPrim[]}>();
 private free=FX_PARTICLE_POOL;
 /** CWeather::WindDir and CWeather::Wind via FxManager_c::SetWindData. */
 windDir:FxVec=[0,0,0];windSpeed=0;
 /** CWeather::Wind and CWeather::Rain for FX_INFO_EMWEATHER ranges. */
 wind=0;rain=0;
 constructor(blueprints:FxSystemBlueprint[],readonly world:FxWorld){
  for(const bp of blueprints){const prims=bp.prims.map(p=>new NativeFxPrim(p,bp,this));this.prims.push(...prims);this.blueprints.set(bp.name.toLowerCase(),{bp,prims});}
 }
 get freeParticles(){return this.free;}
 has(name:string){return this.blueprints.has(name.toLowerCase());}
 /** FxManager_c::CreateFxSystem with ShouldCreate's bounding-sphere frustum test. */
 create(name:string,transform:FxMatrix|FxVec,parent?:FxMatrix,ignoreBounding=false){
  const entry=this.blueprints.get(name.toLowerCase());if(!entry)return undefined;
  const local=transform.length===3?fxTranslation(...(transform as FxVec)):transform as FxMatrix;
  const sphere=entry.bp.boundingSphere;
  if(!ignoreBounding&&sphere&&this.world.sphereVisible){const m=parent?fxMultiply(local,parent):local,c=fxTransformPoint(m,sphere.x,sphere.y,sphere.z);if(!this.world.sphereVisible(c[0],c[1],c[2],sphere.radius))return undefined;}
  const system=new NativeFxSystem(this,entry.bp,entry.prims,local,parent);this.systems.push(system);return system;
 }
 /** FxManager_c::GetParticle / FreeUpParticle. */
 private takeParticle(system:NativeFxSystem){
  if(this.free>0){this.free--;return true;}
  if(!system.mustCreate)return false;
  const candidates=this.systems.filter(s=>!s.mustCreate&&this.prims.some(p=>p.particles.some(q=>q.system===s)));
  if(!candidates.length)return false;
  const victim=candidates[Math.trunc(this.world.random()*candidates.length)];
  for(const prim of this.prims){const index=prim.particles.findIndex(p=>p.system===victim);if(index>=0){prim.particles.splice(index,1);return true;}}
  return false;
 }
 returnParticle(){this.free=Math.min(FX_PARTICLE_POOL,this.free+1);}
 /** FxEmitter_c::CreateParticle. */
 createParticle(prim:NativeFxPrim,system:NativeFxSystem,emission:EmissionInfo,matrix:FxMatrix,velOverride:FxVec|undefined,timeSince:number,mult:FxPrtMult,brightness:number,createLocal:boolean){
  if(!this.takeParticle(system))return undefined;
  const random=()=>this.world.random(),wld=createLocal?Float64Array.from(primMatrix(prim.bp)):matrix;
  const particle:FxParticle={system,currentLife:0,totalLife:((Math.trunc(random()*10000))/5000-1)*emission.lifeBias*1+emission.life,pos:[0,0,0],vel:[0,0,0],
   multColor:[uint8(mult.r*255),uint8(mult.g*255),uint8(mult.b*255),uint8(mult.a*255)],multSize:uint8(mult.size*255)/255,multRot:uint8(mult.rot*255)/255,
   randR:Math.trunc(random()*256),randG:Math.trunc(random()*256),randB:Math.trunc(random()*256),brightness:uint8(brightness*100)/100,rotZ:-1,local:createLocal,
   rotation:random()*(emission.rotationMax-emission.rotationMin)+emission.rotationMin,underwater:false};
  particle.totalLife*=mult.life;
  let offset:FxVec;
  if(Math.abs(emission.radius)<.001)offset=[0,1,2].map(k=>random()*(emission.sizeMax[k]-emission.sizeMin[k])+emission.sizeMin[k]) as FxVec;
  else{const v:FxVec=[random()*2-1,random()*2-1,random()*2-1],inv=1/(Math.hypot(...v)||1),r=emission.radius<0?inv*emission.radius:inv*random()*emission.radius;offset=[v[0]*r,v[1]*r,v[2]*r];}
  particle.pos=fxTransformPoint(wld,offset[0]+emission.pos[0],offset[1]+emission.pos[1],offset[2]+emission.pos[2]);
  if(velOverride)particle.vel=[...velOverride];
  else{
   const around=random()*Math.PI*2,cone=(emission.angleMin+(emission.angleMax-emission.angleMin)*random())*Math.PI/180;
   const local:FxVec=[Math.cos(around)*Math.sin(cone),Math.cos(cone),Math.sin(around)*Math.sin(cone)];
   let dir:FxVec;if(emission.direction[0]<=10){const l=Math.hypot(...emission.direction)||1;dir=[emission.direction[0]/l,emission.direction[1]/l,emission.direction[2]/l];}else dir=[...particle.pos];
   const aligned=rotateIntoVector(local,fxTransformVector(wld,...dir)),speed=(random()*2-1)*emission.speedBias+emission.speed;
   particle.vel=[aligned[0]*speed,aligned[1]*speed,aligned[2]*speed];
  }
  for(let k=0;k<3;k++)particle.vel[k]+=system.velAdd[k];
  const level=createLocal?undefined:this.world.waterLevel?.(particle.pos[0],particle.pos[1]);particle.underwater=level!==undefined&&particle.pos[2]<level;
  prim.updateParticle(timeSince,particle);
  prim.particles.push(particle);
  return particle;
 }
 /** FxManager_c::Update: blueprint particles first, then systems (which may be destroyed). */
 update(camera:FxVec,dt:number){
  for(const prim of this.prims)if(prim.particles.length)prim.update(dt);
  for(let i=0;i<this.systems.length;i++){const system=this.systems[i];if(system.update(camera,dt)){this.destroy(system);i--;}}
 }
 /** FxManager_c::DestroyFxSystem: its particles return to the pool immediately. */
 destroy(system:NativeFxSystem){
  const index=this.systems.indexOf(system);if(index<0)return;
  for(const prim of this.prims)for(let i=0;i<prim.particles.length;i++)if(prim.particles[i].system===system){prim.particles.splice(i--,1);this.returnParticle();}
  this.systems.splice(index,1);system.destroyed=true;
 }
 snapshot(){return {systems:this.systems.length,particles:FX_PARTICLE_POOL-this.free,active:[...new Set(this.systems.map(s=>s.name))].sort(),byPrim:this.prims.filter(p=>p.particles.length).map(p=>`${p.system.name}/${p.bp.textures[0]}:${p.particles.length}`)};}
 clear(){for(const s of [...this.systems])this.destroy(s);}
}
