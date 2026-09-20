import {BinaryReader,readChunk,requireAsset} from './binary';
/* RpUVAnim: animated texture coordinates on materials (waterfalls, neon signs, scrolling billboards, the night
 * casino blocks). Layout after librw's clean-room uvanim.cpp / anim.cpp (RenderWare's rpuvanim.c):
 * - rwID_UVANIMDICT (0x2B) ahead of the clump: STRUCT { numAnims }, then one rwID_ANIMANIMATION (0x1B) per
 *   animation: version 0x100, interpolator type (0x1C0 linear, 0x1C1 param), numFrames, flags, duration, custom data
 *   (int, name[32], nodeToUVChannel[8]) and numFrames × { time, uv[6], prevFrame }.
 * - rwID_UVANIMPLUGIN (0x135) in a material's extension: STRUCT { mask } then a 32-byte animation name per set bit,
 *   one slot per interpolator (8 at most).
 * - CEntity::PreRender adds CTimer::GetTimeStepInSeconds() to every material animation once per frame and applies
 *   the update (MaterialUpdateUVAnimCB): each node's interpolated keyframe becomes a matrix that pre-concatenates
 *   into the material's UV transform for the node's channel. */
export const UV_ANIMATION_DICTIONARY=0x2b,UV_ANIMATION_PLUGIN=0x135,ANIM_ANIMATION=0x1b,UV_ANIMATION_LINEAR=0x1c0,UV_ANIMATION_PARAM=0x1c1;
export interface UvAnimationFrame {time:number;uv:[number,number,number,number,number,number];prev:number}
export interface UvAnimation {name:string;type:number;flags:number;duration:number;nodeToUvChannel:number[];frames:UvAnimationFrame[]}
/** A material's animation slots: the animation name for each of the 8 interpolators that is set. */
export interface UvAnimationSlot {slot:number;name:string}
/** A 2D affine in RenderWare's row-vector layout: right (a, b), up (c, d), pos (tx, ty); u' = a·u + c·v + tx, v' = b·u + d·v + ty. */
export type UvAffine=[number,number,number,number,number,number];
const IDENTITY:UvAffine=[1,0,0,1,0,0];
function readAnimation(bytes:Uint8Array):UvAnimation{
 const r=new BinaryReader(bytes);
 requireAsset(r.i32()===0x100,'Unsupported UV animation version.');
 const type=r.i32(),numFrames=r.i32(),flags=r.i32(),duration=r.f32();
 requireAsset(type===UV_ANIMATION_LINEAR||type===UV_ANIMATION_PARAM,`Unsupported UV animation interpolator 0x${type.toString(16)}.`);
 requireAsset(numFrames>0&&numFrames<=65536&&Number.isFinite(duration)&&duration>=0,'Invalid UV animation.');
 r.i32();const name=r.name(32),nodeToUvChannel=[...Array.from({length:8},()=>r.i32())];
 const frames:UvAnimationFrame[]=[];
 for(let i=0;i<numFrames;i++){
  const time=r.f32(),uv=[...r.floats(6)] as UvAnimationFrame['uv'],stored=r.i32();
  requireAsset(Number.isFinite(time)&&uv.every(Number.isFinite),'Invalid UV animation keyframe.');
  // The shipped files keep a stale pointer in a leading keyframe's prev field (retail ltseld01_lawn, vgsn_scrollsgn01);
  // later keyframes hold the index of the node's previous keyframe. Anything out of range means "the node's first".
  const prev=stored>=0&&stored<i?stored:i;
  frames.push({time,uv,prev});
 }
 return {name,type,flags,duration,nodeToUvChannel,frames};
}
/** The animations of one rwID_UVANIMDICT chunk (its payload). */
export function readUvAnimationDictionary(bytes:Uint8Array):UvAnimation[]{
 const r=new BinaryReader(bytes),header=readChunk(r);
 requireAsset(header.type===1&&header.bytes.length>=4,'UV animation dictionary lacks its header.');
 const count=new BinaryReader(header.bytes).i32();requireAsset(count>=0&&count<=4096,'Invalid UV animation count.');
 const animations:UvAnimation[]=[];
 while(animations.length<count&&r.position+12<=bytes.length){
  const chunk=readChunk(r);
  if(chunk.type!==ANIM_ANIMATION)continue;
  animations.push(readAnimation(chunk.bytes));
 }
 requireAsset(animations.length===count,'UV animation dictionary is short of animations.');
 return animations;
}
/** The animation slots of one material's rwID_UVANIMPLUGIN chunk (its payload). */
export function readUvAnimationPlugin(bytes:Uint8Array):UvAnimationSlot[]{
 const r=new BinaryReader(bytes),header=readChunk(r);
 requireAsset(header.type===1&&header.bytes.length>=4,'UV animation plugin lacks its header.');
 const body=new BinaryReader(header.bytes),mask=body.u32(),slots:UvAnimationSlot[]=[];
 for(let slot=0;slot<8;slot++)if(mask&(1<<slot))slots.push({slot,name:body.name(32)});
 return slots;
}
/** A then B, both in RenderWare's row-vector layout (Matrix::transform with COMBINEPOSTCONCAT). */
export function composeUvAffine(a:UvAffine,b:UvAffine):UvAffine{
 return [a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];
}
/** Transforms a texture coordinate by an affine in this layout. */
export function applyUvAffine(m:UvAffine,u:number,v:number):[number,number]{return [m[0]*u+m[2]*v+m[4],m[1]*u+m[3]*v+m[5]];}
/** The keyframes of each node: the leading keyframes at time 0 start a node each, later ones join their prev's node. */
export function uvAnimationNodes(anim:UvAnimation){
 const nodeOf:number[]=[],nodes:UvAnimationFrame[][]=[];
 anim.frames.forEach((frame,i)=>{
  const leading=i===nodes.length&&frame.time===0;
  const node=leading?nodes.length:frame.prev<i?nodeOf[frame.prev]??0:0;
  if(leading)nodes.push([]);
  nodeOf[i]=node;(nodes[node]??=[]).push(frame);
 });
 for(const list of nodes)list.sort((a,b)=>a.time-b.time);
 return nodes;
}
/** uvAnimLinearApplyCB / uvAnimParamApplyCB: an interpolated keyframe as the node's UV matrix. */
export function uvKeyframeMatrix(type:number,uv:UvAnimationFrame['uv']):UvAffine{
 if(type===UV_ANIMATION_PARAM){
  const [theta,s0,s1,skew,x,y]=uv,cos=Math.cos(theta),sin=Math.sin(theta);
  // Scale/skew and position, then a rotation about the texture's centre: translate(−½,−½), rotate(θ), translate(½,½), all post-concatenated.
  return composeUvAffine(composeUvAffine(composeUvAffine([s0,skew,0,s1,x,y],[1,0,0,1,-.5,-.5]),[cos,sin,-sin,cos,0,0]),[1,0,0,1,.5,.5]);
 }
 return [uv[0],uv[1],uv[2],uv[3],uv[4],uv[5]];
}
/** The interpolated keyframe of one node at `time` (uvAnimLinearInterpCB / uvAnimParamInterpCB; the param angle takes the short way round). */
export function sampleUvNode(anim:UvAnimation,keyframes:UvAnimationFrame[],time:number):UvAnimationFrame['uv']{
 let first=keyframes[0],second=first;
 for(const frame of keyframes){if(frame.time<=time){first=frame;second=frame;}else{second=frame;break;}}
 if(second===first)return [...first.uv] as UvAnimationFrame['uv'];
 const f=(time-first.time)/(second.time-first.time),out=first.uv.map((value,i)=>(second.uv[i]-value)*f+value) as UvAnimationFrame['uv'];
 if(anim.type===UV_ANIMATION_PARAM){let a=second.uv[0]-first.uv[0];while(a<-Math.PI)a+=2*Math.PI;while(a>Math.PI)a-=2*Math.PI;out[0]=a*f+first.uv[0];}
 return out;
}
/** One material's animations: RpMaterialUVAnimAddAnimTime and RpMaterialUVAnimApplyUpdate. */
export class UvAnimationPlayer{
 private readonly nodes:UvAnimationFrame[][][];
 readonly times:number[];
 constructor(readonly animations:UvAnimation[]){this.nodes=animations.map(uvAnimationNodes);this.times=animations.map(()=>0);}
 /** AnimInterpolator::addTime: past the duration the animation starts over from zero. */
 addTime(seconds:number){
  if(!(seconds>0))return;
  this.animations.forEach((anim,i)=>{this.times[i]+=seconds;if(this.times[i]>anim.duration)this.times[i]=0;});
 }
 /** UVAnim::applyUpdate for one channel: each node's matrix pre-concatenated in slot order. */
 channelMatrix(channel:number):UvAffine{
  let out=IDENTITY;
  this.animations.forEach((anim,i)=>{
   this.nodes[i].forEach((keyframes,node)=>{
    if(anim.nodeToUvChannel[node]!==channel)return;
    out=composeUvAffine(uvKeyframeMatrix(anim.type,sampleUvNode(anim,keyframes,this.times[i])),out);
   });
  });
  return out;
 }
}
