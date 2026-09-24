import * as THREE from 'three';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {NATIVE_LIGHT_DIRECTION} from '../world/sun';
import {MARKER3D,MAX_3D_MARKERS,type Marker3d} from '../world/native3dMarkers';

/** C3dMarkers::Init's clumps (gta3.img): `diamond_3` (TXD `diamond`) for arrows and cones, `cylinder` for cylinders and
 * tubes and `hoop` for tori (TXD `ingame`). */
const MODELS=[{dff:'diamond_3.dff',txd:'diamond.txd'},{dff:'cylinder.dff',txd:'ingame.txd'},{dff:'hoop.dff',txd:'ingame.txd'}] as const;
/** GetAtomicForMarkerType: the clump index each marker type clones. */
const modelFor=(type:number)=>type===MARKER3D.cylinder||type===MARKER3D.tube?1:type===MARKER3D.torus?2:0;
interface Variant {holder:THREE.Group;materials:THREE.MeshLambertMaterial[];dispose:()=>void}

/** C3dMarkers::Render (0x725040) and C3dMarker::Render (0x7223D0): one instance of each clump per slot, the marker's
 * colour as the material colour (rpGEOMETRYMODULATEMATERIALCOLOR), lit by SetBrightMarkerColours (ambient 0.6 and a
 * white directional light along the scene's light direction), depth writes off. A cylinder draws both faces, a tube is
 * the cylinder stretched 20 times along z, and a torus or second arrow stands along its normal (CMatrix::WithUp). */
export class Native3dMarkersMesh {
 private slots:Variant[][]=[];
 private light=nativeAmbientState();
 /** diamond_3's bounding sphere radius (RpAtomicGetBoundingSphere). */
 radius=0;
 drawn=0;
 /** The NDC centre of the first marker drawn last frame. */
 firstCenter:[number,number]|null=null;
 error?:string;
 private basis=new THREE.Matrix4();private withUp=new THREE.Matrix4();private scale=new THREE.Matrix4();private right=new THREE.Vector3();private forward=new THREE.Vector3();private up=new THREE.Vector3();
 constructor(private scene:THREE.Scene){
  this.light.enabled.value=true;this.light.color.value.set(.6,.6,.6);
  this.light.direct.value=1;this.light.direction.value.set(NATIVE_LIGHT_DIRECTION.x,NATIVE_LIGHT_DIRECTION.y,NATIVE_LIGHT_DIRECTION.z);
 }
 get ready(){return this.slots.length>0;}
 async load(base:string){
  try{
   const source=await openStaticWorld(base),find=(name:string)=>source.entry(name),cache=new ModelReadCache(source.file,source.entries);
   const models=await Promise.all(MODELS.map(async({dff,txd})=>{
    const entry=find(dff);if(!entry)throw new Error(`Missing ${dff}.`);
    return readModel({file:source.file,entry,textureEntry:find(txd)},cache);
   }));
   this.radius=models[0].model.geometries[0]?.morphBounds?.[0]?.radius??0;
   for(let i=0;i<MAX_3D_MARKERS;i++){
    this.slots.push(models.map(({model,textures},kind)=>{
     const object=modelObject(model,textures,undefined,undefined,{worldLighting:true,ambient:this.light}),holder=new THREE.Group();
     // The holder carries the marker's whole matrix.
     holder.matrixAutoUpdate=false;
     const materials=object.materialBindings.map(b=>b.material as THREE.MeshLambertMaterial);
     for(const material of materials){material.transparent=true;material.depthWrite=false;material.side=kind===1?THREE.DoubleSide:THREE.FrontSide;}
     object.root.traverse(o=>{o.frustumCulled=false;o.renderOrder=6.5;});
     holder.add(object.root);holder.visible=false;holder.name=`Native 3D marker ${i} ${MODELS[kind].dff}`;this.scene.add(holder);
     return {holder,materials,dispose:object.dispose};
    }));
   }
  }catch(error){this.error=String(error);}
 }
 /** The markers C3dMarkers::Render3dMarkers draws this frame. */
 frame(drawn:readonly {marker:Marker3d;color:readonly [number,number,number,number]}[],camera:THREE.Camera){
  this.drawn=Math.min(drawn.length,this.slots.length);
  const first=this.drawn?drawn[0].marker.position:undefined;
  this.firstCenter=first?(({x,y})=>[x,y] as [number,number])(new THREE.Vector3(first[0],first[2],-first[1]).project(camera)):null;
  this.slots.forEach((variants,i)=>{
   const d=drawn[i],kind=d?modelFor(d.marker.type):-1;
   variants.forEach((v,k)=>{v.holder.visible=k===kind;});
   if(!d)return;
   const {holder,materials}=variants[kind],m=d.marker,p=m.position,s=m.size;
   // The matrix in native axes: heading about z, then WithUp(normal) for a torus or second arrow, then the scale.
   const c=Math.cos(m.heading),sn=Math.sin(m.heading);
   this.basis.set(c,-sn,0,0, sn,c,0,0, 0,0,1,0, 0,0,0,1);
   const n=m.normal;
   if((m.type===MARKER3D.torus||m.type===MARKER3D.arrow2)&&!(n[0]===0&&n[1]===0&&n[2]===1)){
    // CMatrix::WithUp: right = z × up (not normalised), forward = up × right.
    this.up.set(n[0],n[1],n[2]);this.right.set(-n[1],n[0],0);this.forward.crossVectors(this.up,this.right);
    this.basis.multiply(this.withUp.makeBasis(this.right,this.forward,this.up));
   }
   this.basis.multiply(this.scale.makeScale(s,s,m.type===MARKER3D.tube?s*20:s));
   // Native (x, y, z) is the renderer's (x, z, -y).
   const e=this.basis.elements;
   holder.matrix.set(
    e[0],e[4],e[8],p[0],
    e[2],e[6],e[10],p[2],
    -e[1],-e[5],-e[9],-p[1],
    0,0,0,1);
   holder.matrix.multiply(TO_NATIVE);holder.matrixWorldNeedsUpdate=true;
   // rwCULLMODECULLNONE for cylinders and second arrows; a side change recompiles, so only on a change.
   const side=m.type===MARKER3D.cylinder||m.type===MARKER3D.arrow2?THREE.DoubleSide:THREE.FrontSide;
   for(const material of materials){material.color.setRGB(d.color[0]/255,d.color[1]/255,d.color[2]/255);material.opacity=d.color[3]/255;
    if(material.side!==side){material.side=side;material.needsUpdate=true;}}
  });
 }
 dispose(){for(const slot of this.slots)for(const v of slot){v.holder.removeFromParent();v.dispose();}this.slots=[];}
}
/** Model space is native (x, y, z); this maps a renderer-space model back to it so the native matrix applies. */
const TO_NATIVE=new THREE.Matrix4().set(1,0,0,0, 0,0,-1,0, 0,1,0,0, 0,0,0,1);
