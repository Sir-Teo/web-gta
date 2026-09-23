import * as THREE from 'three';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {NATIVE_LIGHT_DIRECTION} from '../world/sun';
import {MAX_3D_MARKERS,type Marker3d} from '../world/native3dMarkers';

/** C3dMarkers::Render (0x725040) for cones and arrows: C3dMarkers::Init's `diamond_3` (gta3.img, TXD `diamond`),
 * one instance per slot, scaled by the marker's size with its colour as the material colour
 * (rpGEOMETRYMODULATEMATERIALCOLOR). SetBrightMarkerColours lights it: ambient 0.6 and a white directional light
 * along the scene's light direction. Drawn after the effects with depth writes off and back faces culled. */
export class Native3dMarkersMesh {
 private slots:{holder:THREE.Group;materials:THREE.MeshLambertMaterial[];dispose:()=>void}[]=[];
 private light=nativeAmbientState();
 /** diamond_3's bounding sphere radius (RpAtomicGetBoundingSphere). */
 radius=0;
 drawn=0;
 /** The NDC centre of the first marker drawn last frame. */
 firstCenter:[number,number]|null=null;
 error?:string;
 constructor(private scene:THREE.Scene){
  this.light.enabled.value=true;this.light.color.value.set(.6,.6,.6);
  this.light.direct.value=1;this.light.direction.value.set(NATIVE_LIGHT_DIRECTION.x,NATIVE_LIGHT_DIRECTION.y,NATIVE_LIGHT_DIRECTION.z);
 }
 get ready(){return this.slots.length>0;}
 async load(base:string){
  try{
   const source=await openStaticWorld(base),find=(name:string)=>source.entry(name);
   const entry=find('diamond_3.dff');if(!entry)throw new Error('Missing diamond_3.dff.');
   const {model,textures}=await readModel({file:source.file,entry,textureEntry:find('diamond.txd')},new ModelReadCache(source.file,source.entries));
   this.radius=model.geometries[0]?.morphBounds?.[0]?.radius??0;
   for(let i=0;i<MAX_3D_MARKERS;i++){
    const object=modelObject(model,textures,undefined,undefined,{worldLighting:true,ambient:this.light}),holder=new THREE.Group();
    const materials=object.materialBindings.map(b=>b.material as THREE.MeshLambertMaterial);
    for(const material of materials){material.transparent=true;material.depthWrite=false;material.side=THREE.FrontSide;}
    object.root.traverse(o=>{o.frustumCulled=false;o.renderOrder=6.5;});
    holder.add(object.root);holder.visible=false;holder.name=`Native 3D marker ${i}`;this.scene.add(holder);
    this.slots.push({holder,materials,dispose:object.dispose});
   }
  }catch(error){this.error=String(error);}
 }
 /** The markers C3dMarkers::Render3dMarkers draws this frame. */
 frame(drawn:readonly {marker:Marker3d;color:readonly [number,number,number,number]}[],camera:THREE.Camera){
  this.drawn=Math.min(drawn.length,this.slots.length);
  const first=this.drawn?drawn[0].marker.position:undefined;
  this.firstCenter=first?(({x,y})=>[x,y] as [number,number])(new THREE.Vector3(first[0],first[2],-first[1]).project(camera)):null;
  this.slots.forEach((slot,i)=>{
   const d=drawn[i];slot.holder.visible=!!d;if(!d)return;
   const p=d.marker.position;
   // Native (x, y, z) is the renderer's (x, z, -y); CMatrix::Scale scales the rotation.
   slot.holder.position.set(p[0],p[2],-p[1]);slot.holder.rotation.set(0,d.marker.heading,0);slot.holder.scale.setScalar(d.marker.size);
   for(const material of slot.materials){material.color.setRGB(d.color[0]/255,d.color[1]/255,d.color[2]/255);material.opacity=d.color[3]/255;}
  });
 }
 dispose(){for(const slot of this.slots){slot.holder.removeFromParent();slot.dispose();}this.slots=[];}
}
