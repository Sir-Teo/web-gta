/* CAudioZones (Audio/AudioZones.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: the named boxes
 * and spheres of Audiozon.ipl's `auzo` section, the script's SwitchAudioZone and the per-frame Update that lists the
 * active ones around the camera, which the ambience tracks read (audio/NativeAmbienceTracks.ts). Native coordinates. */
import type {IplAudioZone} from '../assets/ipl';

export const NUM_AUDIO_BOXES=158,NUM_AUDIO_SPHERES=3,MAX_ACTIVE_AUDIO_ZONES=10;
type V3=readonly [number,number,number];
interface Zone {name:string;id:number;active:boolean}
interface Box extends Zone {min:V3;max:V3}
interface Sphere extends Zone {center:V3;radius:number}
/** CompressedLargeVector: an int16 of the value × 8, truncated. */
const compress=(v:number)=>Math.trunc(v*8)/8;

export class NativeAudioZones {
 readonly boxes:Box[]=[];readonly spheres:Sphere[]=[];
 /** m_aActiveBoxes and m_aActiveSpheres: indices into the tables. */
 activeBoxes:number[]=[];activeSpheres:number[]=[];
 private last:V3=[0,0,0];
 /** CFileLoader::LoadAudioZone's RegisterAudioBox and RegisterAudioSphere; the tables hold 158 boxes and 3 spheres.
  * The name is a char[8]. */
 load(rows:readonly IplAudioZone[]){
  for(const row of rows){
   const zone={name:row.name.slice(0,7),id:row.id,active:row.active};
   if(row.box&&this.boxes.length<NUM_AUDIO_BOXES)this.boxes.push({...zone,min:row.box.min.map(compress) as unknown as V3,max:row.box.max.map(compress) as unknown as V3});
   else if(row.sphere&&this.spheres.length<NUM_AUDIO_SPHERES)this.spheres.push({...zone,center:row.sphere.center,radius:row.sphere.radius});
  }
 }
 /** CAudioZones::SwitchAudioZone (0x508320): every sphere and box of that name, compared without case. */
 switch(name:string,enable:boolean){
  const key=name.toLowerCase();
  for(const zone of [...this.spheres,...this.boxes])if(zone.name.toLowerCase()===key)zone.active=enable;
 }
 /** CAudioZones::Update (0x5083C0): at most every 16th frame (frame % 16 == 6) unless forced or the point has moved
  * 20 units; up to ten active spheres the point is within and ten active boxes it is inside. */
 update(force:boolean,point:V3,frame:number){
  if(!force&&frame%16!==6&&Math.hypot(point[0]-this.last[0],point[1]-this.last[1],point[2]-this.last[2])<20)return;
  this.last=[...point];this.activeSpheres=[];this.activeBoxes=[];
  for(const [i,s] of this.spheres.entries()){
   if(this.activeSpheres.length>=MAX_ACTIVE_AUDIO_ZONES)break;
   if(s.active&&(point[0]-s.center[0])**2+(point[1]-s.center[1])**2+(point[2]-s.center[2])**2<=s.radius**2)this.activeSpheres.push(i);
  }
  for(const [i,b] of this.boxes.entries()){
   if(this.activeBoxes.length>=MAX_ACTIVE_AUDIO_ZONES)break;
   if(b.active&&[0,1,2].every(k=>point[k]>=b.min[k]&&point[k]<=b.max[k]))this.activeBoxes.push(i);
  }
 }
 /** The audio zone ids around the point at the last update, spheres first. */
 get activeIds(){return [...this.activeSpheres.map(i=>this.spheres[i].id),...this.activeBoxes.map(i=>this.boxes[i].id)];}
 /** What CAEAmbienceTrackManager reads: the first active sphere (with its centre), else the first active box. */
 get firstActive():{id:number;center?:V3}|undefined{
  const sphere=this.spheres[this.activeSpheres[0]];if(sphere)return {id:sphere.id,center:sphere.center};
  const box=this.boxes[this.activeBoxes[0]];return box&&{id:box.id};
 }
}
