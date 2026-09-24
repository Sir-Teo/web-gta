/** e3dMarkerType. */
export const MARKER3D={arrow:0,cylinder:1,tube:2,arrow2:3,torus:4,cone:5,coneNoCollision:6} as const;
const NONE=-1,NO_ROOF=65535;
/** m_aMarkerArray's 32 slots. */
export const MAX_3D_MARKERS=32;

/** One C3dMarker slot (3dMarker.h). `position` and `heading` stand for m_Mat; `hasAtomic` for m_Atomic. */
export interface Marker3d {
 id:number;type:number;inUse:boolean;active:boolean;hasAtomic:boolean;
 position:[number,number,number];heading:number;
 color:[number,number,number,number];
 pulsePeriod:number;pulseFraction:number;rotateRate:number;
 startTime:number;onScreenTestTime:number;
 stdSize:number;size:number;distToCam2D:number;
 roofHeight:number;
 /** m_LastMapReadX / Y: the point UpdateZCoordinate last snapped to the ground, as uint16s. Creation sets X to 30000. */
 lastMapReadX:number;lastMapReadY:number;
 /** m_Normal: the axis a torus or second arrow stands along. */
 normal:[number,number,number];
}
/** What a placement reads from the world. */
export interface Marker3dContext {
 /** FindPlayerCentreOfWorld. */
 player:readonly [number,number,number];
 /** CTimer::GetTimeInMS and GetTimeStep. */
 timeMs:number;timeStep:number;
 /** CWorld::ProcessLineOfSight against buildings: the hit's z, if any. */
 roofAt:(from:readonly [number,number,number],to:readonly [number,number,number])=>number|undefined;
 /** RpAtomicGetBoundingSphere(diamond_3)->radius. */
 radius:number;
 /** CWorld::FindGroundZFor3DCoord: the ground below a point, if any. */
 groundZ?:(x:number,y:number,z:number)=>number|undefined;
 /** CColStore::HasCollisionLoaded for the normal world. */
 collisionLoaded?:(x:number,y:number)=>boolean;
 /** CWaterLevel::GetWaterLevelNoWaves: the flat water level at a point, if there is water. */
 waterNoWaves?:(x:number,y:number)=>number|undefined;
}
const blank=():Marker3d=>({id:0,type:NONE,inUse:false,active:false,hasAtomic:false,position:[0,0,0],heading:0,color:[255,255,255,255],pulsePeriod:1024,pulseFraction:.25,rotateRate:5,
 startTime:0,onScreenTestTime:0,stdSize:1,size:1,distToCam2D:0,roofHeight:NO_ROOF,lastMapReadX:30000,lastMapReadY:30000,normal:[0,0,0]});
const coneType=(t:number)=>t===MARKER3D.cone||t===MARKER3D.coneNoCollision;
/** The types whose size shrinks near the player; also the ones a full array may replace (IsReusableType). */
const scaledType=(t:number)=>t===MARKER3D.arrow||t===MARKER3D.arrow2||coneType(t);
const validType=(t:number)=>Number.isInteger(t)&&t>=MARKER3D.arrow&&t<=MARKER3D.coneNoCollision;
const DEG=Math.PI/180;
/** A float cast to uint16, as m_LastMapReadX compares. */
const u16=(v:number)=>Math.trunc(v)&0xffff;

/** C3dMarkers (3dMarkers.cpp): the 32 marker slots, PlaceMarker's reuse, bobbing, distance scaling and fading,
 * cylinders and tubes snapping to the ground or the water (C3dMarker::UpdateZCoordinate), Update and the render
 * pass's bookkeeping. */
export class Native3dMarkers {
 readonly markers:Marker3d[]=Array.from({length:MAX_3D_MARKERS},blank);
 /** m_angleDiamondDeg. */
 angleDiamondDeg=0;
 /** m_colDiamond (0x8D5D8B): the alpha PlaceMarkerCone passes. */
 colDiamond=255;
 /** IgnoreRenderLimit. */
 ignoreRenderLimit=false;
 numActiveMarkers=0;
 /** s_SavedAlpha (0x8D5E44). Its initial value is exe data; 0 stands in. */
 private savedAlpha=0;
 /** C3dMarkers::PlaceMarkerCone (0x726D40): not within 1.6 units of the camera. The alpha passed is replaced by
  * m_colDiamond and the rotate rate by 0. */
 placeMarkerCone(id:number,point:readonly [number,number,number],size:number,red:number,green:number,blue:number,_alpha:number,pulsePeriod:number,pulseFraction:number,_rotateRate:number,collision:boolean,
  camera:readonly [number,number,number],ctx:Marker3dContext){
  if((point[0]-camera[0])**2+(point[1]-camera[1])**2+(point[2]-camera[2])**2<1.6**2)return undefined;
  return this.placeMarker(id,collision?MARKER3D.cone:MARKER3D.coneNoCollision,point,size,red,green,blue,this.colDiamond,pulsePeriod,pulseFraction,0,ctx);
 }
 /** C3dMarkers::PlaceMarkerSet (0x725BA0): a third of the alpha, rotate rate 1, no normal and no z check. */
 placeMarkerSet(id:number,type:number,point:readonly [number,number,number],size:number,red:number,green:number,blue:number,alpha:number,pulsePeriod:number,pulseFraction:number,ctx:Marker3dContext){
  return this.placeMarker(id,type,point,size,red,green,blue,Math.trunc(alpha/3),pulsePeriod,pulseFraction,1,ctx);
 }
 /** C3dMarkers::PlaceMarker (0x725120). */
 placeMarker(id:number,type:number,point:readonly [number,number,number],size:number,red:number,green:number,blue:number,alpha:number,pulsePeriod:number,pulseFraction:number,rotateRate:number,ctx:Marker3dContext,
  normal:readonly [number,number,number]=[0,0,0],zCheck=false){
  if(!id)throw new Error('3D markers need a non-zero id.');
  if(!validType(type))return undefined;
  let dist=Math.hypot(point[0]-ctx.player[0],point[1]-ctx.player[1]);
  if(type===MARKER3D.tube)dist*=.25;
  let m=this.markers.find(a=>!a.inUse&&a.id===id)??this.markers.find(a=>a.type===NONE);
  if(!m){
   // A full array gives an arrow or cone the reusable marker furthest from the player; the other types go without.
   if(!scaledType(type))return undefined;
   for(const v of this.markers)if(scaledType(v.type)&&(!m||v.distToCam2D>m.distToCam2D))m=v;
   if(m)m.type=NONE;
  }
  if(!m)return undefined;
  m.distToCam2D=dist;
  const pos:[number,number,number]=[point[0],point[1],point[2]];
  if(m.id===id&&m.type===type){
   if(type===MARKER3D.cone||type===MARKER3D.arrow){
    // m_LastPosition stays zero, so the roof test repeats every 2 s from 1.5 units below the point.
    if(ctx.timeMs-m.onScreenTestTime>=2000&&!(pos[0]===0&&pos[1]===0&&pos[2]===0)){
     m.onScreenTestTime=ctx.timeMs;
     m.roofHeight=ctx.roofAt([pos[0],pos[1],pos[2]-1.5],pos)??NO_ROOF;
    }
    if(m.roofHeight<NO_ROOF){size*=.5;pos[2]=m.roofHeight-ctx.radius*.1;}
   }
   if(coneType(type))pos[2]+=Math.sin(this.angleDiamondDeg*DEG)*(m.roofHeight<NO_ROOF?.15:.3);
   if(scaledType(type))m.stdSize=size*(1-.3*(25-Math.min(Math.max(dist,5),25))/20);
   // gta-reversed's pulse term is sin(0).
   m.size=m.stdSize;
   if(m.rotateRate)m.heading+=m.rotateRate*ctx.timeStep*DEG;
   if(type===MARKER3D.arrow||type===MARKER3D.cylinder||coneType(type)){
    m.position[0]=pos[0];m.position[1]=pos[1];
    if(m.lastMapReadX!==u16(pos[0])||m.lastMapReadY!==u16(pos[1]))m.position[2]=pos[2];
   }
   if(type===MARKER3D.torus||type===MARKER3D.tube){
    // A torus keeps the height it was made at; a tube with the z check follows the point and snaps to the ground.
    m.position[0]=pos[0];m.position[1]=pos[1];
    if(type===MARKER3D.tube&&zCheck){
     if(m.lastMapReadX!==u16(pos[0])||m.lastMapReadY!==u16(pos[1]))m.position[2]=pos[2];
     this.updateZCoordinate(m,pos,10,ctx);
    }
   }else if(type===MARKER3D.cylinder)this.cylinderZ(m,pos,size,ctx);
  }else{
   if(m.id)this.deleteMarkerObject(m);
   m.lastMapReadX=30000;
   // NOTE/BUG kept: the first frame's bob scales the angle, not the sine.
   if(coneType(type))pos[2]+=Math.sin(this.angleDiamondDeg*DEG*.3);
   m.position=pos;m.heading=0;
   // C3dMarker::AddMarker (0x722230).
   Object.assign(m,{hasAtomic:true,id,size,stdSize:size,color:[red,green,blue,alpha],pulsePeriod,pulseFraction,rotateRate,startTime:ctx.timeMs,onScreenTestTime:ctx.timeMs,type,roofHeight:NO_ROOF});
   if(type===MARKER3D.cylinder)this.cylinderZ(m,pos,size,ctx);
   if(scaledType(type))m.stdSize=size*(1-.3*(25-Math.min(Math.max(dist,5),25))/20);
  }
  if(type!==MARKER3D.arrow2){
   m.color[3]=size+12<=dist?alpha:size+1>=dist?Math.trunc(alpha*.65):Math.trunc(alpha*(1-(size+12-dist)*.35/11));
  }
  m.normal=[normal[0],normal[1],normal[2]];
  m.inUse=true;
  return m;
 }
 /** PlaceMarker's cylinder height (0x7258C2): the flat water level when the water is above the marker, else the ground. */
 private cylinderZ(m:Marker3d,pos:readonly [number,number,number],size:number,ctx:Marker3dContext){
  const water=ctx.waterNoWaves?.(m.position[0],m.position[1]);
  if(water===undefined||water<m.position[2])this.updateZCoordinate(m,pos,size,ctx);
  else m.position[2]=water;
 }
 /** C3dMarker::UpdateZCoordinate (0x724D40): once per uint16 x/y, within 100 units of the point and with the collision
  * loaded, the marker sits zDistance/20 below the ground under it. */
 private updateZCoordinate(m:Marker3d,point:readonly [number,number,number],zDistance:number,ctx:Marker3dContext){
  const [x,y]=m.position;
  if(m.lastMapReadX===u16(x)&&m.lastMapReadY===u16(y))return;
  if((x-point[0])**2+(y-point[1])**2>=100**2)return;
  if(!(ctx.collisionLoaded?.(x,y)??true))return;
  const ground=ctx.groundZ?.(x,y,m.position[2]+1);
  if(ground!==undefined)m.position[2]=ground-zDistance/20;
  m.lastMapReadX=u16(x);m.lastMapReadY=u16(y);
 }
 /** C3dMarkers::Update (0x7227B0): the diamond angle turns 5° a time step; placed markers become active. */
 update(timeStep:number){
  this.angleDiamondDeg+=timeStep*5;
  for(const m of this.markers)if(m.inUse)m.active=true;
 }
 /** C3dMarkers::Render3dMarkers: the active markers drawn this frame (within 150 units of the player in 2D and
  * `visible`, TheCamera.IsSphereVisible(position, 2)), each with the colour C3dMarker::Render sets. Every marker is
  * freed for the next placement; markers not placed this frame lose their object. */
 render(visible:(position:readonly [number,number,number],radius:number)=>boolean){
  const drawn:{marker:Marker3d;color:[number,number,number,number]}[]=[];
  this.numActiveMarkers=0;
  for(const m of this.markers){
   if(m.active){
    if(visible(m.position,2)&&(m.distToCam2D<150||this.ignoreRenderLimit||m.type===MARKER3D.torus)){
     // C3dMarker::Render: arrows and cones draw opaque; the same alpha twice in a row is nudged by one.
     if(m.type===MARKER3D.arrow||coneType(m.type))m.color[3]=255;
     if(m.color[3]===this.savedAlpha)m.color[3]+=m.color[3]<128?1:-1;
     this.savedAlpha=m.color[3];
     drawn.push({marker:m,color:[m.color[0],m.color[1],m.color[2],m.color[3]]});
    }
    m.inUse=false;m.active=false;this.numActiveMarkers++;
   }else if(m.hasAtomic)this.deleteMarkerObject(m);
  }
  return drawn;
 }
 /** C3dMarker::DeleteMarkerObject (0x722390). */
 private deleteMarkerObject(m:Marker3d){m.id=0;m.startTime=0;m.inUse=false;m.active=false;m.type=NONE;m.hasAtomic=false;}
}
