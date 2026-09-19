/* CSkidmarks and CSkidmark, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Skidmarks.cpp,
 * Skidmark.cpp), both fully reversed. A mark is a strip of up to 15 segments behind one wheel: RegisterOne
 * adds a point at most every 100 ms (moving the newest point in between), CSkidmarks::Update fades marks
 * that were not continued, and Render draws each segment as a quad 0.1 above the contact points.
 *
 * - The reversed Update adds the fade times to the old ones (`m_fadeBeginMs += now + low`). Its Vice City
 *   ancestor (reVC CSkidmarks::Update) assigns them, which the fixed timings require, so they are assigned here.
 * - The mark width comes from CVehicle::AddSingleWheelParticles, a retail stub. Vice City's RegisterOne uses a
 *   half-width of 0.125 × (1 + |turn|), which is SA's `length / 2 × (1 + |turn|)` with a length of 0.25.
 * Positions are native (x, y, z) with z up; times are CTimer milliseconds. */

export const SKIDMARKS_COUNT=32,SKIDMARK_NUM_PARTS=16;
/** VC's width: see the note above. */
export const SKIDMARK_LENGTH=.25;
export const SKIDMARK_TYPE={DEFAULT:0,SANDY:1,MUDDY:2,BLOODY:3} as const;
export type SkidmarkType=typeof SKIDMARK_TYPE[keyof typeof SKIDMARK_TYPE];
export const SKIDMARK_STATE={INACTIVE:0,JUST_UPDATED:1,DISAPPEARING:2} as const;
type V3={x:number;y:number;z:number};

export interface NativeSkidmark {
 /** m_vPosn, three floats per part. */
 positions:Float32Array;dirX:Float32Array;dirY:Float32Array;
 id:number;lastUpdate:number;fadeBegin:number;disappearAt:number;type:SkidmarkType;parts:number;state:number;active:boolean;
}
const skidmark=():NativeSkidmark=>({positions:new Float32Array(SKIDMARK_NUM_PARTS*3),dirX:new Float32Array(SKIDMARK_NUM_PARTS),dirY:new Float32Array(SKIDMARK_NUM_PARTS),
 id:-1,lastUpdate:0,fadeBegin:0,disappearAt:0,type:SKIDMARK_TYPE.DEFAULT,parts:0,state:SKIDMARK_STATE.INACTIVE,active:false});

/** CVector2D::Normalise: a zero vector becomes (1, y). */
function normalise(v:{x:number;y:number}){const m=Math.hypot(v.x,v.y);if(m>0){v.x/=m;v.y/=m;}else v.x=1;return v;}
const setPart=(mark:NativeSkidmark,part:number,p:V3)=>{mark.positions[part*3]=p.x;mark.positions[part*3+1]=p.y;mark.positions[part*3+2]=p.z;};
const part=(mark:NativeSkidmark,i:number):V3=>({x:mark.positions[i*3],y:mark.positions[i*3+1],z:mark.positions[i*3+2]});

/** CSkidmark::GetBoundingSphere: the first and last points' midpoint and half their distance. */
export function skidmarkSphere(mark:NativeSkidmark){
 const a=part(mark,0),b=part(mark,mark.parts),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};
 return {center,radius:Math.hypot(b.x-center.x,b.y-center.y,b.z-center.z)};
}
const BASE_COLOURS:readonly (readonly [number,number,number])[]=[[0,0,0],[45,31,4],[69,69,61],[32,0,0]];
/** CSkidmark::GetColor: the type's colour times CCustomBuildingDNPipeline's (1 − balance) × 0.6 + 0.4, and an
 * alpha that falls from 255 at the fade start to 0 when the mark disappears. */
export function skidmarkColour(mark:NativeSkidmark,now:number,dayNightBalance:number):[number,number,number,number]{
 const balance=(1-dayNightBalance)*.6+.4,[r,g,b]=BASE_COLOURS[mark.type];
 const alpha=mark.state===SKIDMARK_STATE.JUST_UPDATED||now<mark.fadeBegin?255:Math.max(0,Math.floor(255*(mark.disappearAt-now)/(mark.disappearAt-mark.fadeBegin)));
 return [Math.floor(r*balance),Math.floor(g*balance),Math.floor(b*balance),alpha];
}
/** CSkidmark::Render's per-point alpha: none at the first point and at the end of a fading mark, half elsewhere. */
export function skidmarkPartAlpha(mark:NativeSkidmark,index:number,alpha:number){
 if(index===0)return 0;
 if(index===mark.parts&&mark.state===SKIDMARK_STATE.DISAPPEARING)return 0;
 return Math.floor(alpha*128/256);
}

export class NativeSkidmarks {
 readonly marks=Array.from({length:SKIDMARKS_COUNT},skidmark);
 /** CSkidmarks::Clear. */
 clear(){for(const mark of this.marks){mark.state=SKIDMARK_STATE.INACTIVE;mark.active=false;}}
 /** CSkidmarks::Update → CSkidmark::Update: a mark not continued since the last update starts fading, over
  * 2.5–5 s when short, 10–20 s from nine segments and 5–10 s in between. */
 update(now:number){
  for(const mark of this.marks){
   if(mark.state===SKIDMARK_STATE.JUST_UPDATED&&!mark.active){
    mark.state=SKIDMARK_STATE.DISAPPEARING;
    const [low,high]=mark.parts<4?[2500,5000]:mark.parts>=9?[10000,20000]:[5000,10000];
    mark.fadeBegin=now+low;mark.disappearAt=now+high;
   }else if(mark.state===SKIDMARK_STATE.DISAPPEARING&&now>mark.disappearAt)mark.state=SKIDMARK_STATE.INACTIVE;
   mark.active=false;
  }
 }
 /** CSkidmarks::RegisterOne for one wheel. `bloody` is the wheel's blood state (the `bool*` the original
  * clears when a blood trail ends); the new value is returned. `visible` is TheCamera.IsSphereVisible. */
 registerOne(o:{id:number;position:V3;dirX:number;dirY:number;type:SkidmarkType;bloody:boolean;length?:number;now:number;visible:(center:V3,radius:number)=>boolean}):boolean{
  const found=this.marks.find(mark=>mark.state===SKIDMARK_STATE.JUST_UPDATED&&mark.id===o.id);
  if(found)return this.registerNewPart(found,o.position,{x:o.dirX,y:o.dirY},o.length??SKIDMARK_LENGTH,o.bloody,o.now);
  const free=this.nextFree(o.visible);
  if(free){
   // CSkidmark::Init.
   free.id=o.id;setPart(free,0,o.position);free.dirX[0]=0;free.dirY[0]=0;free.active=true;free.state=SKIDMARK_STATE.JUST_UPDATED;
   free.parts=0;free.type=o.bloody?SKIDMARK_TYPE.BLOODY:o.type;free.lastUpdate=o.now-1000;
  }
  return o.bloody;
 }
 /** CSkidmarks::GetNextFree(true): a free mark, or else the longest-unextended mark off screen. */
 private nextFree(visible:(center:V3,radius:number)=>boolean){
  const free=this.marks.find(mark=>mark.state===SKIDMARK_STATE.INACTIVE);if(free)return free;
  let oldest:NativeSkidmark|undefined,oldestTime=Infinity;
  for(const mark of this.marks){
   if(mark.active||mark.lastUpdate>=oldestTime)continue;
   const sphere=skidmarkSphere(mark);if(!visible(sphere.center,sphere.radius)){oldest=mark;oldestTime=mark.lastUpdate;}
  }
  return oldest;
 }
 /** CSkidmark::RegisterNewPart. */
 private registerNewPart(mark:NativeSkidmark,position:V3,dir:{x:number;y:number},length:number,bloody:boolean,now:number){
  if((mark.type===SKIDMARK_TYPE.BLOODY)!==bloody){
   // The blood state changed: end this mark.
   mark.state=SKIDMARK_STATE.DISAPPEARING;mark.fadeBegin=now+10000;mark.disappearAt=now+20000;return bloody;
  }
  mark.active=true;
  if(now-mark.lastUpdate<=100){setPart(mark,mark.parts,position);return bloody;}
  mark.lastUpdate=now;
  if(mark.parts>=SKIDMARK_NUM_PARTS-1){
   mark.state=SKIDMARK_STATE.DISAPPEARING;mark.fadeBegin=now+10000;mark.disappearAt=now+20000;return false;
  }
  mark.parts++;setPart(mark,mark.parts,position);
  const previous=part(mark,mark.parts-1);
  // Swapped on purpose in the original: the perpendicular of the step from the previous point.
  const side=normalise({x:position.y-previous.y,y:previous.x-position.x}),forward=normalise({...dir});
  const scale=(1+Math.abs(side.x*forward.x+side.y*forward.y))*length/2;
  mark.dirX[mark.parts]=scale*side.x;mark.dirY[mark.parts]=scale*side.y;
  if(mark.parts===1){mark.dirX[0]=mark.dirX[1];mark.dirY[0]=mark.dirY[1];}
  return mark.parts>8?false:bloody;
 }
}

/** CAutomobile::PreRender's skidmark rule (a retail stub in SA; reVC CAutomobile::PreRender): a wheel on the
 * ground and off water lays a mark while it spins or is locked, while it skids if it or the other rear wheel is
 * a rear wheel skidding, and in any state on a muddy surface or with blood on the tyre. */
export function wheelLaysSkidmark(o:{state:'normal'|'spinning'|'skidding'|'fixed';rear:boolean;rearSkidding:boolean;muddy:boolean;bloody:boolean}){
 switch(o.state){
  case 'spinning':case 'fixed':return true;
  case 'skidding':return o.rear||o.rearSkidding;
  default:return o.bloody||o.muddy;
 }
}
