/* COcclusion, COccluder, CActiveOccluder and CEntity::IsEntityOccluded (gta-reversed ead3051): the IPL `occl`
 * volumes that hide what stands behind them. AddOne floors the absolute dimensions (an all-zero box is dropped),
 * adds 180 degrees to each limited rotation, and links map occluders into a far-away list; interior occluders
 * (files ending in int.ipl) sit apart. Each frame ProcessBeforeRendering, when the area can see outside, walks at
 * most sixteen far-away occluders into the nearby list (NearCamera: distance to the centre less the longer of
 * length and width over two under 250), projects every nearby occluder (ProcessOneOccluder: the eight box corners,
 * or a flat quad, through CalcScreenCoors; the outline lines that separate on-screen from off-screen faces, each
 * turned to keep the projected centre on its inside, clipped against the screen; the outline at least 15 % of the
 * width and 10 % of the height, 10 % and 7 % for a flat one; the visible faces' normals and offsets), moves the ones
 * no longer near back, adds the interior ones, and drops an active occluder that hides entirely behind a nearer one.
 * IsPositionOccluded tests a sphere: on screen with radius scaled by the larger screen scale, depth past the
 * occluder's, inside every outline line and behind every face. IsEntityOccluded tests an entity's bound centre with
 * 0.9 of its radius, then its centre alone and four bounding box corners, and two more for a box over 60 wide or
 * long and over 30 tall. Native axes throughout (x east, y north, z up); the screen has (0, 0) top-left. */
export const MAX_MAP_OCCLUDERS=1000,MAX_INTERIOR_OCCLUDERS=40,MAX_ACTIVE_OCCLUDERS=28,OCCLUDER_NEAR_DISTANCE=250,FAR_AWAY_WALK=16;
export type Vec3=readonly [number,number,number];
export interface OccluderInput {centerX:number;centerY:number;bottomZ:number;width:number;length:number;height:number;rotZ:number;rotY:number;rotX:number;flags:number;interior:boolean}
export interface Occluder {center:Vec3;length:number;width:number;height:number;rotZ:number;rotY:number;rotX:number;dontStream:boolean;next:number}
interface Line {ox:number;oy:number;dx:number;dy:number;length:number}
export interface ActiveOccluder {lines:Line[];distToCam:number;faceNormals:Vec3[];faceOffsets:number[]}
/** The camera as CalcScreenCoors needs it: the position, the view transform (right, up, depth) and the screen. */
export interface OcclusionCamera {
 position:Vec3;
 /** Camera space for a world point: x right, y up, z the depth along the view. */
 view(p:Vec3):{x:number;y:number;z:number};
 /** tan of half the horizontal and vertical fields of view. */
 tanHalfWidth:number;tanHalfHeight:number;
 width:number;height:number;
 /** CDraw::ms_fFOV, the native field of view in degrees (70 at rest). */
 fov:number;
}
const limitAngle=(a:number)=>{while(a>=180)a-=360;while(a<-180)a+=360;return a;};
const rad=(d:number)=>d*Math.PI/180;
/** CMatrix::SetRotate(x, y, z): the right, forward and up rows of the rotation. */
export function setRotate(x:number,y:number,z:number):[Vec3,Vec3,Vec3]{
 const sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
 return [[cz*cy-sz*sx*sy,cz*sx*sy+sz*cy,-(sy*cx)],[-(sz*cx),cz*cx,sx],[cz*sy+sz*sx*cy,sz*sy-cz*sx*cy,cy*cx]];
}
const transformPoint=(m:[Vec3,Vec3,Vec3],p:Vec3):Vec3=>[m[0][0]*p[0]+m[1][0]*p[1]+m[2][0]*p[2],m[0][1]*p[0]+m[1][1]*p[1]+m[2][1]*p[2],m[0][2]*p[0]+m[1][2]*p[1]+m[2][2]*p[2]];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const neg=(a:Vec3):Vec3=>[-a[0],-a[1],-a[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mag=(a:Vec3)=>Math.hypot(a[0],a[1],a[2]);
const normalized=(a:Vec3):Vec3=>{const l=mag(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
/** DistAlongPerpRightLine2D: the point's distance along the line direction's right-hand perpendicular. */
export const distAlongPerpRight=(ox:number,oy:number,dx:number,dy:number,px:number,py:number)=>(px-ox)*dy-(py-oy)*dx;
export const isPointInsideLine=(ox:number,oy:number,dx:number,dy:number,px:number,py:number,radius:number)=>distAlongPerpRight(ox,oy,dx,dy,px,py)>=radius;
const crossesFinite=(ax:number,ay:number,bx:number,by:number,ox:number,oy:number,dx:number,dy:number)=>distAlongPerpRight(ox,oy,dx,dy,ax,ay)*distAlongPerpRight(ox,oy,dx,dy,bx,by)<0;
/** DoesInfiniteLineTouchScreen: the origin on screen, or the line crossing one of its four edges. */
export function doesInfiniteLineTouchScreen(ox:number,oy:number,dx:number,dy:number,width:number,height:number){
 if(ox>=0&&ox<=width&&oy>=0&&oy<=height)return true;
 return crossesFinite(0,0,width,0,ox,oy,dx,dy)||crossesFinite(0,0,0,height,ox,oy,dx,dy)||crossesFinite(width,0,width,height,ox,oy,dx,dy)||crossesFinite(0,height,width,height,ox,oy,dx,dy);
}
/** CalcScreenCoors: screen pixels and the depth, none once the depth is 1 or less. */
export function calcScreenCoors(camera:OcclusionCamera,p:Vec3):{x:number;y:number;z:number}|undefined{
 const v=camera.view(p);
 if(v.z<=1)return undefined;
 const r=1/v.z;
 return {x:(0.5+0.5*v.x*r/camera.tanHalfWidth)*camera.width,y:(0.5-0.5*v.y*r/camera.tanHalfHeight)*camera.height,z:v.z};
}
/** The four-argument CalcScreenCoors: the screen scales, SCREEN_WIDTH and SCREEN_HEIGHT over the depth by 70 over the field of view. */
export function screenScales(camera:OcclusionCamera,depth:number){const r=1/depth/camera.fov*70;return {scaleX:camera.width*r,scaleY:camera.height*r};}
export function activeIsPointWithinArea(o:ActiveOccluder,x:number,y:number,radius=0){for(const l of o.lines)if(!isPointInsideLine(l.ox,l.oy,l.dx,l.dy,x,y,radius))return false;return true;}
export function activeIsPointBehind(o:ActiveOccluder,cam:Vec3,p:Vec3,radius=0){
 for(let i=0;i<o.faceNormals.length;i++){
  const n=o.faceNormals[i],offset=o.faceOffsets[i],ptToNormal=dot(p,n)-offset,camToNormal=dot(cam,n)-offset;
  if(camToNormal*ptToNormal>=0||Math.abs(ptToNormal)<radius)return false;
 }
 return true;
}
/** COcclusion::OccluderHidesBehind: every line end of `first` lies inside every line of `second`. */
export function occluderHidesBehind(first:ActiveOccluder,second:ActiveOccluder){
 if(!first.lines.length)return second.lines.length===0;
 for(const a of first.lines)for(const b of second.lines){
  if(!isPointInsideLine(b.ox,b.oy,b.dx,b.dy,a.ox,a.oy,0))return false;
  if(!isPointInsideLine(b.ox,b.oy,b.dx,b.dy,a.ox+a.dx*a.length,a.oy+a.dy*a.length,0))return false;
 }
 return true;
}
const uint16=(v:number)=>((Math.trunc(v)%65536)+65536)%65536;
/** COccluder::ProcessOneOccluder: the active occluder for this frame's camera, or none. */
export function processOneOccluder(o:Occluder,camera:OcclusionCamera):ActiveOccluder|undefined{
 const centerOnScreen=calcScreenCoors(camera,o.center);
 if(!centerOnScreen||centerOnScreen.z<-150||centerOnScreen.z>300)return undefined;
 const size:Vec3=[o.width,o.length,o.height],out:ActiveOccluder={lines:[],distToCam:uint16(centerOnScreen.z-mag(size)),faceNormals:[],faceOffsets:[]};
 const transform=setRotate(o.rotX,o.rotY,o.rotZ);
 let minX=999999.88,minY=999999.88,maxX=-999999.88,maxY=-999999.88;
 const coors:Vec3[]=[],coorsOnScreen:({x:number;y:number;z:number}|undefined)[]=[];
 // ProcessLineSegment: false when the line was taken, true when the outline fails.
 const processLineSegment=(from:number,to:number)=>{
  if(!coorsOnScreen[from]&&!coorsOnScreen[to])return true;
  const screenOf=(i:number,other:number)=>{
   if(coorsOnScreen[i])return coorsOnScreen[i];
   const zA=Math.abs(camera.view(coors[i]).z-1.1),zB=Math.abs(camera.view(coors[other]).z-1.1),t=zB/(zA+zB);
   const pt:Vec3=[coors[other][0]+(coors[i][0]-coors[other][0])*t,coors[other][1]+(coors[i][1]-coors[other][1])*t,coors[other][2]+(coors[i][2]-coors[other][2])*t];
   return calcScreenCoors(camera,pt);
  };
  const a=screenOf(from,to);if(!a)return true;
  const b=screenOf(to,from);if(!b)return true;
  minX=Math.min(minX,a.x,b.x);maxX=Math.max(maxX,a.x,b.x);minY=Math.min(minY,a.y,b.y);maxY=Math.max(maxY,a.y,b.y);
  let ox=a.x,oy=a.y,dx=b.x-a.x,dy=b.y-a.y;
  if(!isPointInsideLine(ox,oy,dx,dy,centerOnScreen.x,centerOnScreen.y,0)){ox=b.x;oy=b.y;dx=-dx;dy=-dy;}
  const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
  if(!doesInfiniteLineTouchScreen(ox,oy,dx,dy,camera.width,camera.height))return !isPointInsideLine(ox,oy,dx,dy,camera.width*.5,camera.height*.5,0);
  out.lines.push({ox,oy,dx,dy,length});
  return false;
 };
 if(size[0]!==0&&size[1]!==0&&size[2]!==0){
  const right=transformPoint(transform,[size[0]/2,0,0]),up=transformPoint(transform,[0,size[1]/2,0]),forward=transformPoint(transform,[0,0,size[2]/2]);
  const directions:Vec3[]=[up,neg(up),right,neg(right),forward,neg(forward)];
  const onScreen=directions.map(d=>dot(sub(add(o.center,d),camera.position),d)<0);
  const [UP,BOTTOM,RIGHT,LEFT,BACK,FRONT]=[0,1,2,3,4,5];
  coors[0]=add(add(add(o.center,directions[UP]),directions[RIGHT]),directions[BACK]);
  coors[1]=add(add(add(o.center,directions[BOTTOM]),directions[RIGHT]),directions[BACK]);
  coors[2]=add(add(add(o.center,directions[UP]),directions[LEFT]),directions[BACK]);
  coors[3]=add(add(add(o.center,directions[BOTTOM]),directions[LEFT]),directions[BACK]);
  coors[4]=add(add(add(o.center,directions[UP]),directions[RIGHT]),directions[FRONT]);
  coors[5]=add(add(add(o.center,directions[BOTTOM]),directions[RIGHT]),directions[FRONT]);
  coors[6]=add(add(add(o.center,directions[UP]),directions[LEFT]),directions[FRONT]);
  coors[7]=add(add(add(o.center,directions[BOTTOM]),directions[LEFT]),directions[FRONT]);
  for(let i=0;i<8;i++)coorsOnScreen[i]=calcScreenCoors(camera,coors[i]);
  const edges:[number,number,number,number][]=[[UP,RIGHT,0,4],[UP,LEFT,2,6],[UP,BACK,0,2],[UP,FRONT,4,6],[BOTTOM,RIGHT,1,5],[BOTTOM,LEFT,3,7],[BOTTOM,BACK,1,3],[BOTTOM,FRONT,5,7],[RIGHT,BACK,0,1],[LEFT,BACK,2,3],[LEFT,FRONT,6,7],[RIGHT,FRONT,4,5]];
  for(const [a,b,from,to] of edges){if(onScreen[a]!==onScreen[b]&&processLineSegment(from,to))return undefined;}
  if(camera.width*.15>maxX-minX||camera.height*.1>maxY-minY)return undefined;
  for(let i=0;i<6;i++){if(!onScreen[i])continue;const dir=normalized(directions[i]);out.faceNormals.push(dir);out.faceOffsets.push(dot(add(o.center,dir),dir));}
  return out;
 }
 let right:Vec3=[0,0,0],up:Vec3=[0,0,0];
 if(size[1]===0){right=[size[0],0,0];up=[0,0,size[2]];}
 else if(size[0]===0){right=[0,size[1],0];up=[0,0,size[2]];}
 else if(size[2]===0){right=[0,size[1],0];up=[size[0],0,0];}
 right=transformPoint(transform,[right[0]/2,right[1]/2,right[2]/2]);up=transformPoint(transform,[up[0]/2,up[1]/2,up[2]/2]);
 coors[0]=add(add(o.center,right),up);coors[1]=add(sub(o.center,right),up);coors[2]=sub(sub(o.center,right),up);coors[3]=sub(add(o.center,right),up);
 for(let i=0;i<4;i++)coorsOnScreen[i]=calcScreenCoors(camera,coors[i]);
 if(processLineSegment(0,1)||processLineSegment(1,2)||processLineSegment(2,3)||processLineSegment(3,0))return undefined;
 if(maxX-minX<camera.width*.1||maxY-minY<camera.height*.07)return undefined;
 const normal:Vec3=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
 out.faceNormals.push(normal);out.faceOffsets.push(dot(normal,o.center));
 return out;
}
export class NativeOcclusion {
 readonly occluders:Occluder[]=[];
 readonly interiorOccluders:Occluder[]=[];
 active:ActiveOccluder[]=[];
 private farAwayList=-1;private nearbyList=-1;private listWalkThroughFA=-1;private previousListWalkThroughFA=-1;
 /** The camera of the last ProcessBeforeRendering, for the entity tests that follow it in the frame. */
 camera?:OcclusionCamera;
 /** COcclusion::Init then AddOne for every record (the IPL bottom z plus half the height is the centre). */
 setOccluders(records:readonly OccluderInput[]){
  this.occluders.length=0;this.interiorOccluders.length=0;this.active=[];this.farAwayList=this.nearbyList=this.listWalkThroughFA=this.previousListWalkThroughFA=-1;
  for(const r of records)this.addOne(r.centerX,r.centerY,r.height*.5+r.bottomZ,r.width,r.length,r.height,r.rotZ,r.rotY,r.rotX,r.flags,r.interior);
 }
 addOne(centerX:number,centerY:number,centerZ:number,width:number,length:number,height:number,rotZ:number,rotY:number,rotX:number,flags:number,interior:boolean){
  const l=Math.floor(Math.abs(length)),w=Math.floor(Math.abs(width)),h=Math.floor(Math.abs(height));
  if(l===0&&w===0&&h===0)return false;
  if(interior?this.interiorOccluders.length>=MAX_INTERIOR_OCCLUDERS:this.occluders.length>=MAX_MAP_OCCLUDERS)return false;
  const o:Occluder={center:[centerX,centerY,centerZ],length:l,width:w,height:h,rotZ:rad(limitAngle(rotZ)+180),rotY:rad(limitAngle(rotY)+180),rotX:rad(limitAngle(rotX)+180),dontStream:flags!==0,next:-1};
  if(interior){this.interiorOccluders.push(o);return true;}
  this.occluders.push(o);o.next=this.farAwayList;this.farAwayList=this.occluders.length-1;return true;
 }
 private nearCamera(o:Occluder,cam:Vec3){return mag(sub(o.center,cam))-Math.max(o.length,o.width)/2<OCCLUDER_NEAR_DISTANCE;}
 /** COcclusion::ProcessBeforeRendering. */
 processBeforeRendering(camera:OcclusionCamera,canSeeOutside=true){
  this.camera=camera;const active:ActiveOccluder[]=[];const occluders=this.occluders,cam=camera.position;
  if(canSeeOutside){
   const updateFarAwayList=()=>{
    for(let size=0;size<FAR_AWAY_WALK&&this.listWalkThroughFA!==-1;size++){
     const o=occluders[this.listWalkThroughFA];
     if(this.nearCamera(o,cam)){
      if(this.previousListWalkThroughFA===-1)this.farAwayList=o.next;else occluders[this.previousListWalkThroughFA].next=o.next;
      const old=o.next;o.next=this.nearbyList;this.nearbyList=this.listWalkThroughFA;this.listWalkThroughFA=old;
     }else{this.previousListWalkThroughFA=this.listWalkThroughFA;this.listWalkThroughFA=o.next;}
    }
   };
   const updateNearbyList=()=>{
    for(let i=this.nearbyList,prev=-1;i!==-1;){
     const o=occluders[i];
     if(active.length<MAX_ACTIVE_OCCLUDERS){const a=processOneOccluder(o,camera);if(a)active.push(a);}
     if(!this.nearCamera(o,cam)){
      if(prev===-1)this.nearbyList=o.next;else occluders[prev].next=o.next;
      const old=o.next;o.next=this.farAwayList;this.farAwayList=i;i=old;
     }else{prev=i;i=o.next;}
    }
   };
   if(this.listWalkThroughFA===-1){
    this.previousListWalkThroughFA=-1;this.listWalkThroughFA=this.farAwayList;
    if(this.farAwayList===-1)updateNearbyList();else{updateFarAwayList();updateNearbyList();}
   }else{updateNearbyList();updateFarAwayList();}
  }
  for(const o of this.interiorOccluders){if(active.length>MAX_ACTIVE_OCCLUDERS)break;const a=processOneOccluder(o,camera);if(a)active.push(a);}
  this.active=active.filter(o=>!active.some(i=>i!==o&&i.distToCam<o.distToCam&&occluderHidesBehind(o,i)));
  return this.active.length;
 }
 /** COcclusion::IsPositionOccluded for a sphere. */
 isPositionOccluded(camera:OcclusionCamera,pos:Vec3,radius:number){
  if(!this.active.length)return false;
  const scr=calcScreenCoors(camera,pos);if(!scr)return false;
  const {scaleX,scaleY}=screenScales(camera,scr.z),screenRadius=radius*Math.max(scaleX,scaleY),screenDepth=scr.z-radius;
  return this.active.some(o=>o.distToCam<=screenDepth&&activeIsPointWithinArea(o,scr.x,scr.y,screenRadius)&&activeIsPointBehind(o,camera.position,pos,radius));
 }
 /** CEntity::IsEntityOccluded: the bound centre with 0.9 of the radius, then the centre and the box corners. */
 isEntityOccluded(camera:OcclusionCamera,center:Vec3,boundRadius:number,box:{min:Vec3;max:Vec3;toWorld:(p:Vec3)=>Vec3}){
  if(!this.active.length)return false;
  const scr=calcScreenCoors(camera,center);if(!scr)return false;
  const {scaleX,scaleY}=screenScales(camera,scr.z),occlusionRadius=boundRadius*Math.max(scaleX,scaleY)*.9;
  const point=(p:Vec3)=>{const ws=box.toWorld(p);return {ws,scr:calcScreenCoors(camera,ws)};};
  const {min,max}=box;
  let firstFour:{ws:Vec3;scr?:{x:number;y:number;z:number}}[]|undefined,lastTwo:typeof firstFour;
  const cam=camera.position;
  return this.active.some(o=>{
   if(o.distToCam>=scr.z-boundRadius)return false;
   if(activeIsPointWithinArea(o,scr.x,scr.y,occlusionRadius)&&activeIsPointBehind(o,cam,center,boundRadius))return true;
   if(!activeIsPointWithinArea(o,scr.x,scr.y))return false;
   firstFour??=[point(min),point(max),point([min[0],max[1],max[2]]),point([max[0],min[1],min[2]])];
   const check=(p:{ws:Vec3;scr?:{x:number;y:number;z:number}})=>!!p.scr&&activeIsPointWithinArea(o,p.scr.x,p.scr.y)&&activeIsPointBehind(o,cam,p.ws);
   for(const p of firstFour)if(!check(p))return false;
   const width=max[0]-min[0],length=max[1]-min[1],height=max[2]-min[2];
   if(width<=60&&length<=60||height<=30)return true;
   lastTwo??=[point([min[0],min[1],max[2]]),point([max[0],min[1],max[2]])];
   for(const p of lastTwo)if(!check(p))return false;
   return true;
  });
 }
 /** The entity test against the last frame's camera (none set, or no active occluder: not occluded). */
 entityOccluded(center:Vec3,boundRadius:number,box:{min:Vec3;max:Vec3;toWorld:(p:Vec3)=>Vec3}){return !!this.camera&&this.active.length>0&&this.isEntityOccluded(this.camera,center,boundRadius,box);}
 positionOccluded(pos:Vec3,radius:number){return !!this.camera&&this.active.length>0&&this.isPositionOccluded(this.camera,pos,radius);}
 snapshot(){return {occluders:this.occluders.length,interior:this.interiorOccluders.length,active:this.active.length,nearby:this.countList(this.nearbyList),farAway:this.countList(this.farAwayList)};}
 private countList(head:number){let n=0;for(let i=head;i!==-1&&n<=this.occluders.length;i=this.occluders[i].next)n++;return n;}
}
