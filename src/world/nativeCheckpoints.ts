/* CCheckpoints and CCheckpoint (Checkpoints.cpp, Checkpoint.cpp), pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166: the 32 race and mission checkpoints. PlaceMarker (0x722C40) files one,
 * Update (0x7229C0) turns, sweeps and bobs the ring types once a game frame, and Render (0x726060) places each used
 * one as a C3dMarkers tube or torus every frame, with a direction arrow ahead of a plain tube. Native coordinates. */
import {MARKER3D,type Marker3dContext,type Native3dMarkers} from './native3dMarkers';

/** eCheckpointType. */
export const CHECKPOINT={tube:0,endTube:1,emptyTube:2,torus:3,torusNoFade:4,torusRot:5,torusThrough:6,torusUpDown:7,torusDown:8,na:0x101} as const;
export const MAX_CHECKPOINTS=32;
type V3=[number,number,number];
export interface Checkpoint {
 type:number;used:boolean;rotFlag:boolean;id:number;
 colour:[number,number,number,number];pulsePeriod:number;rotateRate:number;
 pos:V3;fwd:V3;pulseFraction:number;size:number;distToCam2D:number;multiSize:number;
}
const blank=():Checkpoint=>({type:CHECKPOINT.na,used:false,rotFlag:true,id:0,colour:[255,255,255,255],pulsePeriod:1024,rotateRate:5,
 pos:[0,0,0],fwd:[0,0,0],pulseFraction:.25,size:1,distToCam2D:0,multiSize:0});
const normalise=(v:V3):V3=>{const l=Math.hypot(v[0],v[1],v[2]);return l?[v[0]/l,v[1]/l,v[2]/l]:[0,0,0];};
const tubeType=(t:number)=>t===CHECKPOINT.tube||t===CHECKPOINT.endTube||t===CHECKPOINT.emptyTube;

export class NativeCheckpoints {
 readonly checkpoints:Checkpoint[]=Array.from({length:MAX_CHECKPOINTS},blank);
 /** FindPlayerCentreOfWorld and FindPlayerCoors (the same point on foot). */
 player:()=>V3=()=>[0,0,0];
 private findById(id:number){return this.checkpoints.find(c=>c.id===id);}
 /** CCheckpoints::PlaceMarker (0x722C40). A torus the player stands within 2 units of turns into the fly-through or
  * the falling kind. With no slot free, the one furthest beyond the new one's distance is taken, used or not. */
 placeMarker(id:number,type:number,pos:readonly [number,number,number],direction:readonly [number,number,number],size:number,colour:readonly [number,number,number,number],pulsePeriod:number,pulseFraction:number,rotateRate:number){
  const player=this.player(),dist=Math.hypot(pos[0]-player[0],pos[1]-player[1]);
  let cp=this.findById(id);
  if(cp){
   if((type===CHECKPOINT.torus||type===CHECKPOINT.torusRot||type===CHECKPOINT.torusUpDown)&&(pos[0]-player[0])**2+(pos[1]-player[1])**2<=4)
    type=type===CHECKPOINT.torusUpDown?CHECKPOINT.torusDown:CHECKPOINT.torusThrough;
  }else{
   cp=this.checkpoints.find(c=>c.type===CHECKPOINT.na);
   if(!cp)for(const v of this.checkpoints)if(dist<v.distToCam2D&&(!cp||v.distToCam2D>cp.distToCam2D))cp=v;
  }
  if(!cp)return undefined;
  Object.assign(cp,{distToCam2D:dist,colour:[...colour],size,rotateRate,pos:[pos[0],pos[1],pos[2]],
   fwd:normalise([direction[0]-pos[0],direction[1]-pos[1],direction[2]-pos[2]]),id,type,pulsePeriod,used:true,pulseFraction});
  return cp;
 }
 /** CCheckpoints::UpdatePos (0x722900): a rising ring keeps its bob on top of the new height; a falling one keeps its z. */
 updatePos(id:number,pos:readonly [number,number,number]){
  const cp=this.findById(id);if(!cp)return;
  cp.pos[0]=pos[0];cp.pos[1]=pos[1];
  if(cp.type===CHECKPOINT.torusUpDown)cp.pos[2]=cp.multiSize+pos[2];else if(cp.type!==CHECKPOINT.torusDown)cp.pos[2]=pos[2];
 }
 /** CCheckpoints::SetHeading (0x722970): the pointing direction turns to the heading, keeping its z. */
 setHeading(id:number,headingDeg:number){
  const cp=this.findById(id);if(!cp)return;
  const a=headingDeg*Math.PI/180;cp.fwd=normalise([Math.cos(a),Math.sin(a),cp.fwd[2]]);
 }
 /** CCheckpoints::DeleteCP (0x722FC0). */
 deleteCP(id:number,type:number){for(const cp of this.checkpoints)if(cp.used&&cp.id===id&&cp.type===type)Object.assign(cp,{used:false,type:CHECKPOINT.na,id:0});}
 /** CCheckpoints::Update (0x7229C0), once a game frame (its steps are per frame, not per time step). */
 update(){
  const player=this.player();
  for(const cp of this.checkpoints){
   const flag=(max:number,min:number)=>{if(cp.multiSize>max)cp.rotFlag=false;else if(cp.multiSize<min)cp.rotFlag=true;};
   if(cp.type===CHECKPOINT.torusRot){
    flag(.5,-.5);cp.multiSize=cp.rotFlag?.1:-.1;
    cp.fwd=normalise([cp.fwd[0]+cp.multiSize,cp.fwd[1]+cp.multiSize,cp.fwd[2]+cp.multiSize]);
   }
   if(cp.type===CHECKPOINT.torusThrough){
    flag(.75,0);cp.multiSize+=cp.rotFlag?.1:-.1;
    if(cp.multiSize<0)cp.type=CHECKPOINT.na;
   }
   const near2=(cp.pos[0]-player[0])**2+(cp.pos[1]-player[1])**2;
   if(cp.type===CHECKPOINT.torusUpDown){
    if(near2<cp.size**2){cp.type=CHECKPOINT.torusDown;cp.multiSize=-.1;}
    else{flag(.2,-.2);cp.multiSize+=cp.rotFlag?.02:-.02;cp.pos[2]+=cp.multiSize;}
   }
   if(cp.type===CHECKPOINT.torusDown){
    if(near2>cp.size**2){cp.type=CHECKPOINT.torusUpDown;cp.rotFlag=true;cp.multiSize=.02;}
    if(player[2]-.75<cp.pos[2])cp.pos[2]+=cp.multiSize;
   }
  }
 }
 /** CCheckpoints::Render (0x726060) with CCheckpoint::Render (0x725C00): each used checkpoint as markers.
  * `waterNoWaves` is CWaterLevel::GetWaterLevelNoWaves. The end tube's chequered flag sprite is not drawn. */
 render(markers:Native3dMarkers,ctx:Marker3dContext,waterNoWaves:(x:number,y:number)=>number|undefined){
  const player=this.player();
  for(const cp of this.checkpoints){
   if(!cp.used)continue;
   const [r,g,b,a]=cp.colour;
   if(tubeType(cp.type)){
    // A tube under water rises to the flat water level, and then skips the ground snap.
    const water=waterNoWaves(cp.pos[0],cp.pos[1]),under=water!==undefined&&water>=cp.pos[2];
    if(under)cp.pos[2]=water!;
    markers.placeMarker(cp.id,MARKER3D.tube,cp.pos,cp.size*1.5,r,g,b,128,cp.pulsePeriod,cp.pulseFraction,1,ctx,[0,0,0],!under);
    if(cp.type===CHECKPOINT.tube)markers.directionArrowSet(cp.pos,cp.size*.625,255,64,64,255,[-cp.fwd[0],-cp.fwd[1],-cp.fwd[2]]);
   }else if(cp.type===CHECKPOINT.torusThrough){
    // Three fading rings ahead along the direction, then the ring itself; the alpha wraps as a uint8.
    for(const i of [1,2,3,0]){
     const p:V3=[cp.pos[0]+cp.fwd[0]*i*cp.multiSize,cp.pos[1]+cp.fwd[1]*i*cp.multiSize,cp.pos[2]+cp.fwd[2]*i*cp.multiSize];
     markers.placeMarker(cp.id,MARKER3D.torus,p,cp.size,r,g,b,a-16*i&255,cp.pulsePeriod,cp.pulseFraction,cp.rotateRate,ctx,cp.fwd);
    }
   }else if(cp.type!==CHECKPOINT.na){
    // A fading torus disappears once the player is within twice its size.
    if(cp.type===CHECKPOINT.torus&&(cp.size*2)**2>=(cp.pos[0]-player[0])**2+(cp.pos[1]-player[1])**2+(cp.pos[2]-player[2])**2)continue;
    markers.placeMarker(cp.id,MARKER3D.torus,cp.pos,cp.size,r,g,b,a,cp.pulsePeriod,cp.pulseFraction,cp.rotateRate,ctx,cp.fwd);
   }
  }
 }
}
