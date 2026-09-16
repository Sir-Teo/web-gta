import {openStaticWorld} from './staticWorldArchive';
import {readIfp,type NativeAnimation} from './ifp';
import {readImgEntry} from './img';
import {requireAsset} from './binary';
import {VEHICLE_ANIM_GROUP_TABLES,vehicleAnimation,type VehicleAnimGroupData} from './vehicleAnimGroups';
type Block=Map<string,NativeAnimation>;
/** ped.ifp plus the streamed IFP blocks named by car anim groups, with clips keyed by lower-case name. */
export class VehicleAnimationLibrary {
 private source?:ReturnType<typeof openStaticWorld>;
 private pending=new Map<string,Promise<Block>>();
 private blocks=new Map<string,Block>();
 error?:string;
 constructor(private base:string){}
 private open(){return this.source??=openStaticWorld(this.base);}
 block(file:string){
  const key=file.toLowerCase();let promise=this.pending.get(key);
  if(!promise){
   promise=(async()=>{
    const source=await this.open();let bytes:Uint8Array;
    if(key==='ped'){const resource=source.manifest.resources.find(r=>r.path==='animations/ped.ifp');requireAsset(resource,'Missing pedestrian animations.');bytes=new Uint8Array(await (await source.resource(resource!)).arrayBuffer());}
    else{const entry=source.entries.find(e=>e.name.toLowerCase()===`${key}.ifp`);requireAsset(entry,`Missing ${key}.ifp.`);bytes=await readImgEntry(source.file,entry!);}
    const block=new Map(readIfp(bytes).animations.map(clip=>[clip.name.toLowerCase(),clip]));this.blocks.set(key,block);return block;
   })();
   promise.catch(error=>{this.error=String(error);this.pending.delete(key);});
   this.pending.set(key,promise);
  }
  return promise;
 }
 /** Loads ped.ifp and both IFP blocks a vehicle anim group can resolve to. */
 async load(data:VehicleAnimGroupData){await Promise.all(['ped',...new Set([data.first,data.second].map(group=>VEHICLE_ANIM_GROUP_TABLES[group]?.file).filter((f):f is string=>!!f))].map(file=>this.block(file)));}
 loaded(data:VehicleAnimGroupData){return this.blocks.has('ped')&&[data.first,data.second].every(group=>{const file=VEHICLE_ANIM_GROUP_TABLES[group]?.file;return !file||this.blocks.has(file);});}
 /** The loaded clip for a slot through the group selection, or undefined when the group has no such animation. */
 slot(data:VehicleAnimGroupData,slot:number){
  const resolved=vehicleAnimation(data,slot);if(!resolved)return undefined;
  const clip=this.blocks.get(resolved.file)?.get(resolved.name.toLowerCase());
  return clip?{...resolved,key:resolved.name.toLowerCase(),clip}:undefined;
 }
 /** A ped.ifp clip such as CAR_sit or Drive_L_weak. */
 ped(name:string){return this.blocks.get('ped')?.get(name.toLowerCase());}
 /** A loaded clip from any block, starting that block's load when absent. */
 peek(file:string,name:string){
  const hit=this.blocks.get(file.toLowerCase())?.get(name.toLowerCase());
  if(!hit)void this.block(file).catch(()=>{});
  return hit;
 }
}
