type Vec3={x:number;y:number;z:number};
/** AE_FRONTEND_BULLET_PASS_LEFT_REAR, _LEFT_FRONT, _RIGHT_REAR and _RIGHT_FRONT. */
export const BULLET_PASS={leftRear:27,leftFront:28,rightRear:29,rightFront:30} as const;
/** CBulletTrace. Times are CTimer::GetTimeInMS. */
export interface BulletTrace {start:Vec3;end:Vec3;exists:boolean;creation:number;lifetime:number;radius:number;alpha:number}
/** TheCamera's matrix: position and its right, forward and up axes. Any right-handed frame works. */
export interface TraceCamera {position:Vec3;right:Vec3;forward:Vec3;up:Vec3}
const sub=(a:Vec3,b:Vec3)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vec3,b:Vec3)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const scale=(a:Vec3,s:number)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const add=(a:Vec3,b:Vec3)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const normalized=(a:Vec3)=>{const l=Math.hypot(a.x,a.y,a.z)||1;return scale(a,1/l);};

/** PlayFrontEndSoundForTrace: a trace crossing the camera plane within 2 units of the camera whizzes past, on the side
 * and from the end it passes. The volume change is log10(1 − distance / 2), as the original passes it. */
export function bulletPass(from:Vec3,to:Vec3,camera:TraceCamera){
 const a=sub(from,camera.position),b=sub(to,camera.position),fy=dot(a,camera.forward),ty=dot(b,camera.forward);
 // Both ends on one side of the camera plane (the sign bits match).
 if((fy<0)===(ty<0))return undefined;
 const t=Math.abs(fy)/(Math.abs(fy)+Math.abs(ty));
 const x=dot(a,camera.right)+(dot(b,camera.right)-dot(a,camera.right))*t,z=dot(a,camera.up)+(dot(b,camera.up)-dot(a,camera.up))*t;
 const distance=Math.hypot(z,x);if(distance>=2)return undefined;
 const factor=1-distance*.5,behind=fy<=0;
 return {event:x>=0?behind?BULLET_PASS.rightRear:BULLET_PASS.rightFront:behind?BULLET_PASS.leftRear:BULLET_PASS.leftFront,volumeChange:factor===0?-100:Math.log10(factor)};
}

/** CBulletTraces (BulletTraces.cpp, reversed): 16 fading streaks. */
export class NativeBulletTraces {
 readonly traces:BulletTrace[]=Array.from({length:16},()=>({start:{x:0,y:0,z:0},end:{x:0,y:0,z:0},exists:false,creation:0,lifetime:0,radius:0,alpha:0}));
 now=0;
 /** CTimer::GetTimeInMS when a trace is added, which can be later than the last update; `now` stands in without it. */
 clock?:()=>number;
 constructor(private camera:()=>TraceCamera|undefined=()=>undefined,private onPass?:(event:number,volumeChange:number)=>void){}
 /** CBulletTraces::Update (0x723FB0) at time `now`. */
 update(now:number){this.now=now>>>0;for(const t of this.traces)if(t.exists&&this.now-t.creation>=t.lifetime)t.exists=false;}
 /** CBulletTraces::AddTrace (0x723750): later slots live half and a quarter as long, so a burst still shows. */
 addTrace(from:Vec3,to:Vec3,radius:number,disappearTime:number,alpha:number){
  const i=this.traces.findIndex(t=>!t.exists);
  if(i>=0){
   Object.assign(this.traces[i],{start:{...from},end:{...to},creation:this.clock?this.clock()>>>0:this.now,alpha,exists:true,radius,
    lifetime:Math.trunc(i<10?i<5?disappearTime:disappearTime/2:disappearTime/4)});
  }
  const camera=this.camera(),pass=camera&&bulletPass(from,to,camera);
  if(pass)this.onPass?.(pass.event,pass.volumeChange);
 }
 /** CBulletTraces::AddTrace (0x726AF0) for a weapon: a 2 to 5 unit streak at a random point of the bullet's line, 0.01
  * wide for 300 ms at alpha 70. The player's shots in the first-person camera modes leave none while he stands still. */
 addWeaponTrace(muzzle:Vec3,hit:Vec3,random:()=>number,suppress=false){
  if(suppress)return;
  const line=sub(hit,muzzle),length=Math.hypot(line.x,line.y,line.z),dir=normalized(line);
  const at=random()*length,size=Math.min(2+random()*3,length-at);
  const from=add(muzzle,scale(dir,at));
  this.addTrace(from,add(from,scale(dir,size)),.01,300,70);
 }
 /** CBulletTraces::Render (0x723C10): each trace shrinks toward its end as it ages, a thin diamond facing the camera,
  * pale yellow (255, 255, 128) and opaque only at the end vertex. Triangles in the traces' own frame, and RGBA bytes. */
 geometry(cameraPosition:Vec3){
  const positions:number[]=[],colors:number[]=[];
  for(const trace of this.traces){
   if(!trace.exists)continue;
   const t=1-(this.now-trace.creation)/trace.lifetime,dir=sub(trace.end,trace.start);
   const up=normalized(cross(normalized(sub(trace.start,cameraPosition)),normalized(dir))),size=scale(up,trace.radius*t);
   const current=sub(trace.end,scale(dir,t));
   const v=[current,add(current,size),sub(current,size),trace.end,add(trace.end,size),sub(trace.end,size)];
   const alpha=Math.trunc(trace.alpha*t)&255;
   for(const i of [4,1,3,1,0,3,0,2,3,3,2,5]){positions.push(v[i].x,v[i].y,v[i].z);colors.push(255,255,128,i===3?alpha:0);}
  }
  return {positions,colors};
 }
}
