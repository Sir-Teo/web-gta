import type {BreakableInfo} from '../assets/breakable';

/* BreakObject_c and BreakManager_c (gta-reversed 0076f901, 0x59D170-0x59E9B0):
 * a broken object's breakable triangles fly apart in groups, tumble, settle on the
 * ground found below the object, and fade out. Native Z-up units; `timeStep` is
 * CTimer::ms_fTimeStep, 1 per 1/50 s. */

type V3=[number,number,number];
/** RwMatrix rows: right 0-2, up 3-5, at 6-8, pos 9-11 (row-vector convention). */
export type RwMatrix=Float64Array;
export const rwMatrix=(right:V3,up:V3,at:V3,pos:V3):RwMatrix=>Float64Array.from([...right,...up,...at,...pos]);
const dot=(a:ArrayLike<number>,b:ArrayLike<number>)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=(v:V3):V3=>{const l=Math.hypot(...v);return l>0?[v[0]/l,v[1]/l,v[2]/l]:v;};
const row=(m:RwMatrix,i:number):V3=>[m[i*3],m[i*3+1],m[i*3+2]];
/** RwV3dTransformVector. */
export const transformVector=(m:RwMatrix,v:ArrayLike<number>):V3=>[0,1,2].map(k=>v[0]*m[k]+v[1]*m[3+k]+v[2]*m[6+k]) as V3;
/** RwV3dTransformPoints for one point. */
export const transformPoint=(m:RwMatrix,v:ArrayLike<number>):V3=>{const t=transformVector(m,v);return [t[0]+m[9],t[1]+m[10],t[2]+m[11]];};
/** Right-handed rotation of `v` about unit `axis` by `radians`. */
const rotate=(v:V3,axis:V3,radians:number):V3=>{
 const c=Math.cos(radians),s=Math.sin(radians),d=dot(axis,v)*(1-c);
 return [v[0]*c+(axis[1]*v[2]-axis[2]*v[1])*s+axis[0]*d,v[1]*c+(axis[2]*v[0]-axis[0]*v[2])*s+axis[1]*d,v[2]*c+(axis[0]*v[1]-axis[1]*v[0])*s+axis[2]*d];
};
/** RwMatrixRotate. PRECONCAT spins the basis about a local axis and keeps the
 * position; POSTCONCAT rotates the basis (and position) about a world axis. */
function rwMatrixRotate(m:RwMatrix,axis:V3,degrees:number,post:boolean){
 const radians=degrees*Math.PI/180;
 if(post){for(let i=0;i<4;i++){const r=rotate(row(m,i),axis,radians);m.set(r,i*3);}return;}
 // Local axis a = sum(a_i * basis_i); rotating the basis about it keeps local coordinates fixed.
 const world=norm(transformVector(m,axis));
 for(let i=0;i<3;i++)m.set(rotate(row(m,i),world,radians),i*3);
}

export const BREAK_GROUP_TYPE={right:0,up:1,at:2} as const;
export interface BreakTriangle {
 /** Group-local vertex positions, 3 x xyz. */
 positions:Float32Array;uvs:Float32Array;
 /** Prelit RGB bytes per vertex; alpha comes from the frames left. */
 colors:Uint8Array;
}
export interface BreakGroup {
 matrix:RwMatrix;velocity:V3;stoppedMoving:boolean;triangles:BreakTriangle[];texture?:string;
 type:number;boundingSize:number;rotationSpeed:number;rotationAxis:V3;framesToLive:number;
}
/** Particles BreakObject_c asks Fx_c for when a piece hits the ground. */
export interface BreakFx {
 /** g_fx.m_SmokeII3expand->AddParticle with FxPrtMult_c(1,1,1,0.1,0.3,0,0.15). */
 smoke(position:V3,velocity:V3):void;
 /** g_fx.AddSparks(position, (0,0,1), 2, amount, 0, SPARK, 0.4, 1). */
 sparks(position:V3,amount:number):void;
}
export interface BreakInit {
 info:BreakableInfo;
 /** The object atomic's LTM (its placement matrix). */
 ltm:RwMatrix;
 /** OBJECT.DAT break velocity (units per frame) and its random spread. */
 velocity?:V3;velocityRandom:number;
 /** CObject::ObjectDamage: damage x multiplier above smash multiplier x 150 throws single faces. */
 justFaces:boolean;sparks:boolean;drawLast?:boolean;
 /** The collision model's bounding box in object space. */
 bounds:{min:V3;max:V3};
 /** AmbientLightColourForFrame x 255 when no vision FX is active. */
 ambient:V3;
 /** CWorld::ProcessVerticalLine(origin, -1000) against buildings. */
 ground:(origin:V3)=>{z:number;normal:V3}|undefined;
 /** rand() / RAND_MAX. */
 random:()=>number;
}

export class NativeBreakObject {
 justFaces=false;active=false;addSparks=false;drawLast=false;framesActive=0;groundZ=-1000;normal:V3=[0,0,1];
 /** Bumped by every Init so a renderer can tell a reused slot apart. */
 serial=0;
 groups:BreakGroup[]=[];
 private random:()=>number=Math.random;
 private range(min:number,max:number){return min+(max-min)*this.random();}
 /** Integer GetRandomNumberInRange: exclusive of `max`. */
 private rangeInt(min:number,max:number){return Math.trunc(min+(max-1-min)*this.random());}
 /** BreakObject_c::Init (0x59E750). */
 init(o:BreakInit){
  this.random=o.random;this.serial++;
  this.setBreakInfo(o.info,o.justFaces,o.ambient);
  this.setGroupData(o.ltm,o.velocity,o.velocityRandom);
  this.justFaces=o.justFaces;this.active=true;this.framesActive=0;this.addSparks=o.sparks;this.drawLast=!!o.drawLast;
  let origin:V3;
  if(o.info.positionRule!==0){const c:V3=[(o.bounds.min[0]+o.bounds.max[0])/2,(o.bounds.min[1]+o.bounds.max[1])/2,(o.bounds.min[2]+o.bounds.max[2])/2+.25];origin=transformPoint(o.ltm,c);}
  else origin=[o.ltm[9],o.ltm[10],o.ltm[11]+o.bounds.min[2]+.25];
  const hit=o.ground(origin);
  if(hit){this.groundZ=hit.z;this.normal=Math.abs(hit.normal[0])<.01&&Math.abs(hit.normal[1])<.01&&Math.abs(hit.normal[2])<.01?[0,0,1]:[...hit.normal];}
  else{this.groundZ=-1000;this.normal=[0,0,1];}
  return true;
 }
 /** BreakObject_c::SetBreakInfo (0x59D7F0). */
 private setBreakInfo(info:BreakableInfo,justFaces:boolean,ambient:V3){
  const triangles=info.triangles.length/3,count=justFaces?triangles:info.textures.length;
  this.groups=Array.from({length:count},()=>({matrix:new Float64Array(12),velocity:[0,0,0] as V3,stoppedMoving:false,triangles:[] as BreakTriangle[],type:0,boundingSize:0,rotationSpeed:0,rotationAxis:[0,0,1] as V3,framesToLive:256+this.rangeInt(0,32)}));
  for(let i=0;i<triangles;i++){
   const material=info.materialIds[i],group=this.groups[justFaces?i:material];
   const positions=new Float32Array(9),uvs=new Float32Array(6),colors=new Uint8Array(9);
   for(let k=0;k<3;k++){
    const v=info.triangles[i*3+k];
    positions.set(info.positions.subarray(v*3,v*3+3),k*3);uvs.set(info.uvs.subarray(v*2,v*2+2),k*2);
    for(let c=0;c<3;c++)colors[k*3+c]=Math.trunc(Math.min(255,info.colors[v*4+c]*info.materialColors[material*3+c]+ambient[c]));
   }
   group.texture=info.textures[material];
   group.triangles.push({positions,uvs,colors});
  }
 }
 /** BreakObject_c::CalcGroupCenter (0x59D190). */
 private calcGroupCenter(group:BreakGroup){
  const min=[9999999,9999999,9999999],max=[-9999999,-9999999,-9999999];
  for(const t of group.triangles)for(let i=0;i<9;i++){min[i%3]=Math.min(min[i%3],t.positions[i]);max[i%3]=Math.max(max[i%3],t.positions[i]);}
  const center:V3=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2];
  for(const t of group.triangles)for(let i=0;i<9;i++)t.positions[i]-=center[i%3];
  const shift=transformVector(group.matrix,center);for(let k=0;k<3;k++)group.matrix[9+k]+=shift[k];
  const width=max[0]-min[0],length=max[1]-min[1],height=max[2]-min[2];
  if(width<=length&&width<=height){group.type=BREAK_GROUP_TYPE.right;group.boundingSize=width/2;}
  else if(length<=width&&length<=height){group.type=BREAK_GROUP_TYPE.up;group.boundingSize=length/2;}
  else if(height<=length&&height<=width){group.type=BREAK_GROUP_TYPE.at;group.boundingSize=height/2;}
 }
 /** BreakObject_c::SetGroupData (0x59D570). */
 private setGroupData(matrix:RwMatrix,velocity:V3|undefined,velocityRandom:number){
  for(const group of this.groups){
   group.matrix.set(matrix);
   this.calcGroupCenter(group);
   if(velocity){
    group.velocity=[...velocity];
    if(velocityRandom!==0)for(let k=0;k<3;k++)group.velocity[k]+=this.range(-velocityRandom,velocityRandom);
   }else group.velocity=[0,1,2].map(()=>this.range(-velocityRandom,velocityRandom)) as V3;
   group.rotationSpeed=this.range(3,6);
   group.rotationAxis=norm([this.range(-1,1),this.range(-1,1),this.range(-1,1)]);
   group.stoppedMoving=false;
  }
 }
 /** BreakObject_c::DoCollisionResponse (0x59DE40). */
 private doCollisionResponse(group:BreakGroup,timeStep:number,normal:V3,groundZ:number,fx?:BreakFx){
  const bounce=dot(group.velocity,normal)*.85;
  let next:V3=[group.velocity[0]-normal[0]*bounce*2,group.velocity[1]-normal[1]*bounce*2,group.velocity[2]-normal[2]*bounce*2];
  const jitter=norm([this.range(-1,1),this.range(-1,1),this.range(-1,1)]).map(v=>v*timeStep*.05) as V3;
  const speed=Math.hypot(...next);
  next=norm([next[0]+jitter[0],next[1]+jitter[1],next[2]+jitter[2]]).map(v=>v*speed*.8) as V3;
  group.rotationSpeed=0;group.velocity=next;group.matrix[11]=groundZ+group.boundingSize;
  if(speed>=.05){if(this.justFaces)return;}
  else{group.stoppedMoving=true;if(this.justFaces){group.framesToLive=32+this.rangeInt(0,32);return;}}
  const pos:V3=[group.matrix[9],group.matrix[10],group.matrix[11]];
  for(let i=0;i<4;i++){
   const at:V3=[pos[0]+this.range(-.5,.5),pos[1]+this.range(-.5,.5),pos[2]];
   fx?.smoke(at,[this.range(-.15,.15),this.range(-.15,.15),0]);
  }
  if(this.addSparks)fx?.sparks(pos,Math.trunc(Math.hypot(...group.velocity)*100));
 }
 /** BreakObject_c::Update (0x59E220). Returns false once every group faded out. */
 update(timeStep:number,fx?:BreakFx){
  if(!this.active)return false;
  if(this.groups.length<=0){this.active=false;this.framesActive++;return false;}
  let remove=true;
  for(const group of this.groups){
   if(!group.stoppedMoving){
    group.velocity[2]-=timeStep/125;
    for(let k=0;k<3;k++)group.matrix[9+k]+=group.velocity[k]*timeStep;
    if(this.framesActive>=5){
     // Settle: turn the thinnest axis toward the ground normal about their cross product.
     const facing=row(group.matrix,group.type===BREAK_GROUP_TYPE.up?1:group.type===BREAK_GROUP_TYPE.at?2:0);
     const angle=Math.acos(Math.max(-1,Math.min(1,dot(this.normal,facing))));
     if(Math.abs(angle)>.01){
      const axis=norm([facing[1]*this.normal[2]-facing[2]*this.normal[1],facing[2]*this.normal[0]-facing[0]*this.normal[2],facing[0]*this.normal[1]-facing[1]*this.normal[0]]);
      const saved=group.matrix.slice(9,12);
      rwMatrixRotate(group.matrix,axis,angle*180/Math.PI*timeStep/20,true);
      group.matrix.set(saved,9);
     }
    }else rwMatrixRotate(group.matrix,group.rotationAxis,timeStep*group.rotationSpeed,false);
    if(group.matrix[11]-group.boundingSize<this.groundZ)this.doCollisionResponse(group,timeStep,this.normal,this.groundZ,fx);
   }
   group.framesToLive--;
   if(group.framesToLive<=0)group.framesToLive=0;else remove=false;
  }
  if(remove)this.active=false;
  this.framesActive++;
  return this.active;
 }
 /** Render alpha: frames left x 8 for single faces, x 2 for material groups, at most 255. */
 alpha(group:BreakGroup){return Math.min(255,group.framesToLive*(this.justFaces?8:2));}
}

/** BreakManager_c (0xBB4240): 64 slots; Add fails when every slot is busy. */
export class NativeBreakManager {
 readonly objects=Array.from({length:64},()=>new NativeBreakObject());
 add(init:BreakInit){const slot=this.objects.find(o=>!o.active);return slot&&slot.init(init)?slot:undefined;}
 update(timeStep:number,fx?:BreakFx){for(const o of this.objects)if(o.active)o.update(timeStep,fx);}
 get activeCount(){return this.objects.filter(o=>o.active).length;}
 resetAll(){for(const o of this.objects)o.active=false;}
}
