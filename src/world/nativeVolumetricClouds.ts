/* CClouds' volumetric clouds (gta-reversed ead3051): the puffy clouds an aircraft flies through. Each cloud is three
 * axis-aligned quads (18 vertices, two triangles each) of the `cloudhigh` raster scaled by the cloud's size, their
 * alphas the absolute dot of the camera-to-cloud direction with each quad's normal, so the cloud looks solid from
 * every side. VolumetricCloudsRender keeps at most MAX_VOLUMETRIC_CLOUDS (180) scaled by the FX quality density
 * (1 high, 1/3 medium, 1/2 low); the draw distance is the far clip capped at 600, with a fade beginning 100 short
 * of it and creation 200 past it. Whenever the camera or the player has moved since the last frame, five more
 * clouds appear ahead of the player's vehicle (or the camera) at the creation distance, jittered by a random
 * 1..5 scale, with random sizes and alphas 36..128; each frame every cloud drifts with the wind, and one further
 * than the draw distance goes unless it was only just created. With the height switch on, a camera under 220 units
 * raises a fader by four a time step until it reaches 255 and the pass is skipped altogether, and a camera above
 * lowers it again; the fader is subtracted from every cloud's alpha. The grey is the six sky top and bottom
 * channels averaged plus 64, capped at 255. Native axes (x east, y north, z up). */
export const MAX_VOLUMETRIC_CLOUDS=180;
export const VOLUMETRIC_CLOUD_HEIGHT_SWITCH_Z=220,VOLUMETRIC_CLOUD_FADER_RATE=4,VOLUMETRIC_CLOUD_FADER_MAX=255;
export const VOLUMETRIC_CLOUD_MAX_DISTANCE_CAP=600,VOLUMETRIC_CLOUD_FADE_BEGIN_BACK=100,VOLUMETRIC_CLOUD_CREATE_AHEAD=200;
export const VOLUMETRIC_CLOUD_ALPHA_MIN=36,VOLUMETRIC_CLOUD_ALPHA_MAX=128,VOLUMETRIC_CLOUDS_PER_CREATE=5;
/** The creation jitter around the point ahead of the player. */
export const VOLUMETRIC_CLOUD_SPAWN_SPREAD:readonly [number,number,number]=[200,200,50];
export type Vec3=readonly [number,number,number];
/** The three quads' normals, in the model's own order. */
export const VOLUMETRIC_QUAD_NORMALS:readonly Vec3[]=[[0,1,0],[0,0,1],[1,0,0]];
/** VolumetricCloudsInit's 18 model vertices: three quads of two triangles, the second triangle repeating two corners. */
export const VOLUMETRIC_CLOUD_MODEL:readonly {x:number;y:number;z:number;u:number;v:number}[]=[
 {x:-.5,y:0,z:.5,u:0,v:0},{x:.5,y:0,z:.5,u:1,v:0},{x:-.5,y:0,z:-.5,u:0,v:1},
 {x:.5,y:0,z:.5,u:1,v:0},{x:.5,y:0,z:-.5,u:1,v:1},{x:-.5,y:0,z:-.5,u:0,v:1},
 {x:-.5,y:.5,z:0,u:0,v:0},{x:.5,y:.5,z:0,u:1,v:0},{x:-.5,y:-.5,z:0,u:0,v:1},
 {x:.5,y:.5,z:0,u:1,v:0},{x:.5,y:-.5,z:0,u:1,v:1},{x:-.5,y:-.5,z:0,u:0,v:1},
 {x:0,y:-.5,z:.5,u:0,v:0},{x:0,y:.5,z:.5,u:1,v:0},{x:0,y:-.5,z:-.5,u:0,v:1},
 {x:0,y:.5,z:.5,u:1,v:0},{x:0,y:.5,z:-.5,u:1,v:1},{x:0,y:-.5,z:-.5,u:0,v:1},
];
/** g_fx FX quality: the share of the 180 slots used. */
export function volumetricCloudDensity(quality:'low'|'medium'|'high'|'veryHigh'){return quality==='low'?.5:quality==='medium'?1/3:1;}
/** VolumetricCloudsGetMaxDistance: the far clip capped at 600. */
export function volumetricCloudsMaxDistance(farClip:number){return Math.min(farClip,VOLUMETRIC_CLOUD_MAX_DISTANCE_CAP);}
/** m_VolumetricCloudsUsedNum: the density over the 180 slots. */
export function volumetricCloudsUsedNum(density:number){return Math.trunc(MAX_VOLUMETRIC_CLOUDS*Math.min(1,Math.max(0,density)));}
/** The grey every cloud takes: the six sky channels over six, plus 64, capped at 255. */
export function volumetricCloudColour(skyTop:Vec3,skyBottom:Vec3){
 return Math.min(Math.trunc((skyTop[0]+skyTop[1]+skyTop[2]+skyBottom[0]+skyBottom[1]+skyBottom[2])/6)+64,255);
}
/** The height fader after a frame: `skip` once it has reached 255 under the switch height. */
export function volumetricCloudFader(previous:number,cameraZ:number,timeStep:number,heightSwitch=true){
 if(!heightSwitch)return {fader:0,skip:false};
 const delta=timeStep*VOLUMETRIC_CLOUD_FADER_RATE;
 if(cameraZ<VOLUMETRIC_CLOUD_HEIGHT_SWITCH_Z){
  const fader=previous+delta;
  if(fader>=VOLUMETRIC_CLOUD_FADER_MAX)return {fader:VOLUMETRIC_CLOUD_FADER_MAX,skip:true};
  return {fader,skip:false};
 }
 return {fader:Math.max(0,previous-delta),skip:false};
}
/** A cloud's alpha this frame, or 0 when it is faded out or past the draw distance. */
export function volumetricCloudAlpha(cloudAlpha:number,fader:number,distance:number,maxDistance:number){
 const fadeOutBegin=maxDistance-VOLUMETRIC_CLOUD_FADE_BEGIN_BACK;
 let alpha=Math.max(0,cloudAlpha-Math.trunc(fader));
 if(distance<=fadeOutBegin)return alpha;
 if(!alpha||distance>maxDistance)return 0;
 const distAlpha=Math.max(0,Math.trunc((maxDistance-fadeOutBegin-(distance-fadeOutBegin))*alpha/VOLUMETRIC_CLOUD_FADE_BEGIN_BACK));
 return Math.min(alpha,distAlpha);
}
export interface VolumetricCloud {used:boolean;justCreated:boolean;alpha:number;pos:[number,number,number];size:[number,number,number]}
/** A cloud to draw: its centre, its size and the three quads' alphas. */
export interface VolumetricCloudDraw {pos:Vec3;size:Vec3;quadAlpha:[number,number,number]}
export interface VolumetricCloudFrame {
 cameraPos:Vec3;playerPos:Vec3;
 /** The player's vehicle, or the camera, whose front the new clouds appear ahead of. */
 anchorPos:Vec3;anchorForward:Vec3;
 skyTop:Vec3;skyBottom:Vec3;
 /** CWeather::WindDir's x and y. */
 windDir:readonly [number,number];
 timeStep:number;farClip:number;
 quality?:'low'|'medium'|'high'|'veryHigh';
 heightSwitch?:boolean;
 /** m_fVolumetricCloudWindMoveFactor: its value is not in the reference, so the drift is off by default. */
 windMoveFactor?:number;
 /** CGame::CanSeeOutSideFromCurrArea. */
 outside?:boolean;
}
/** CClouds::ms_vc with VolumetricClouds_Create, _Delete and the state half of VolumetricCloudsRender. */
export class VolumetricCloudField {
 readonly clouds:VolumetricCloud[]=Array.from({length:MAX_VOLUMETRIC_CLOUDS},()=>({used:false,justCreated:false,alpha:0,pos:[0,0,0],size:[0,0,0]}));
 usedNum=0;fader=0;maxDistance=VOLUMETRIC_CLOUD_MAX_DISTANCE_CAP;colour=0;
 private lastCamera?:Vec3;private lastPlayer?:Vec3;
 constructor(private random:()=>number=Math.random){}
 private range(min:number,max:number){return min+(max-min)*Math.min(1,Math.max(0,this.random()));}
 private rangeInt(min:number,max:number,inclusive=false){return Math.trunc(this.range(min,inclusive?max:max-1));}
 reset(){for(const c of this.clouds){c.used=false;c.justCreated=false;}this.fader=0;this.lastCamera=undefined;this.lastPlayer=undefined;}
 /** VolumetricClouds_GetFirstFreeSlot: the first unused slot inside the used count. */
 firstFreeSlot(){for(let i=0;i<this.usedNum;i++)if(!this.clouds[i].used)return i;return -1;}
 private add(index:number,pos:Vec3,sizes:{minXYZ:number;maxXY:number;maxZ:number}){
  const c=this.clouds[index];
  c.used=true;c.justCreated=true;c.alpha=this.rangeInt(VOLUMETRIC_CLOUD_ALPHA_MIN,VOLUMETRIC_CLOUD_ALPHA_MAX);
  c.size=[this.range(sizes.minXYZ,sizes.maxXY),this.range(sizes.minXYZ,sizes.maxXY),this.range(sizes.minXYZ,sizes.maxZ)];
  c.pos=[pos[0],pos[1],pos[2]];
 }
 /** VolumetricClouds_Create with a point: five clouds walking away from it by a random offset each time. */
 createAt(posn:[number,number,number]){
  const scale=this.range(1,5),sizes={minXYZ:scale*20,maxXY:scale*100,maxZ:scale*40},spread=scale*3;
  for(let i=0;i<VOLUMETRIC_CLOUDS_PER_CREATE;i++){
   const index=this.firstFreeSlot();if(index===-1)return;
   posn[0]+=this.range(-spread,spread);posn[1]+=this.range(-spread,spread);posn[2]+=this.range(-spread,spread);
   this.add(index,posn,sizes);
  }
 }
 /** VolumetricClouds_Create without a point: every slot filled around the camera. */
 createAround(cameraPos:Vec3,maxDistance:number){
  const scale=this.range(1,5),sizes={minXYZ:scale*20,maxXY:scale*100,maxZ:scale*40};
  for(let i=0;i<MAX_VOLUMETRIC_CLOUDS;i++)this.add(i,[cameraPos[0]+this.range(-maxDistance,maxDistance),cameraPos[1]+this.range(-maxDistance,maxDistance),cameraPos[2]+this.range(-maxDistance*.25,maxDistance*.25)],sizes);
 }
 /** VolumetricCloudsRender's state half: the clouds to draw this frame, in slot order. */
 update(frame:VolumetricCloudFrame):VolumetricCloudDraw[]{
  const draws:VolumetricCloudDraw[]=[];
  if(frame.outside===false)return draws;
  this.usedNum=volumetricCloudsUsedNum(volumetricCloudDensity(frame.quality??'high'));
  if(!this.usedNum)return draws;
  this.maxDistance=volumetricCloudsMaxDistance(frame.farClip);
  const fadeOutDist=this.maxDistance+VOLUMETRIC_CLOUD_CREATE_AHEAD;
  const fade=volumetricCloudFader(this.fader,frame.cameraPos[2],frame.timeStep,frame.heightSwitch??true);
  this.fader=fade.fader;if(fade.skip)return draws;
  const same=(a:Vec3|undefined,b:Vec3)=>!!a&&a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
  const moved=!same(this.lastCamera,frame.cameraPos)||!same(this.lastPlayer,frame.playerPos);
  this.lastCamera=[...frame.cameraPos] as Vec3;this.lastPlayer=[...frame.playerPos] as Vec3;
  if(moved){
   const spread=VOLUMETRIC_CLOUD_SPAWN_SPREAD;
   this.createAt([
    frame.anchorPos[0]+frame.anchorForward[0]*fadeOutDist+this.range(-spread[0],spread[0]),
    frame.anchorPos[1]+frame.anchorForward[1]*fadeOutDist+this.range(-spread[1],spread[1]),
    frame.anchorPos[2]+frame.anchorForward[2]*fadeOutDist+this.range(-spread[2],spread[2]),
   ]);
  }
  this.colour=volumetricCloudColour(frame.skyTop,frame.skyBottom);
  const drift=frame.windMoveFactor??0;
  for(let i=0;i<this.usedNum;i++){
   const c=this.clouds[i];if(!c.used)continue;
   const distance=Math.hypot(frame.cameraPos[0]-c.pos[0],frame.cameraPos[1]-c.pos[1],frame.cameraPos[2]-c.pos[2]);
   c.pos[0]+=drift*frame.windDir[0];c.pos[1]+=drift*frame.windDir[1];
   if(!c.justCreated&&distance>this.maxDistance){c.used=false;c.justCreated=false;continue;}
   if(distance<=this.maxDistance||fadeOutDist<=distance)c.justCreated=false;
   const alpha=volumetricCloudAlpha(c.alpha,this.fader,distance,this.maxDistance);
   if(!alpha)continue;
   const dx=c.pos[0]-frame.cameraPos[0],dy=c.pos[1]-frame.cameraPos[1],dz=c.pos[2]-frame.cameraPos[2],length=Math.hypot(dx,dy,dz)||1;
   const dir:Vec3=[dx/length,dy/length,dz/length];
   const quadAlpha=VOLUMETRIC_QUAD_NORMALS.map(n=>Math.trunc(Math.abs(dir[0]*n[0]+dir[1]*n[1]+dir[2]*n[2])*alpha)) as [number,number,number];
   draws.push({pos:[c.pos[0],c.pos[1],c.pos[2]],size:[c.size[0],c.size[1],c.size[2]],quadAlpha});
  }
  return draws;
 }
 snapshot(){return {used:this.clouds.filter(c=>c.used).length,usedNum:this.usedNum,fader:+this.fader.toFixed(1),maxDistance:this.maxDistance,colour:this.colour};}
}
