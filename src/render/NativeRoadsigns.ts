import * as THREE from 'three';
import type {DffModel} from '../assets/dff';
import {roadsignNumLines,roadsignNumLetters,roadsignPalette,type ModelRoadsignEffect} from '../assets/twoDEffect';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';
import {roadsignAlpha,roadsignLineQuad,roadsignLineRaster,ROADSIGN_ALPHA_TEST,ROADSIGN_FADE_END,ROADSIGN_PALETTE,type RoadsignFont} from '../world/nativeRoadsigns';
/** CCustomRoadsignMgr over the installed scene's placements. CEntity::CreateEffects builds the sign atomic on a
 * frame of its own that is never parented to the entity, and CEntity::Render draws it through RenderRoadsignAtomic
 * with that frame as it stands, so a roadsign effect's position and rotation are world space (the sign models are
 * world-anchored); the meshes live in one world-space group in native axes, one per effect per placement instance,
 * going when their instance leaves the scene. Line textures and geometry are shared by text, letters and palette;
 * each sign owns its materials for RenderRoadsignAtomic's distance fade (opaque within 40 units, gone at 500). */
export class NativeRoadsigns {
 private font?:RoadsignFont;
 private textures=new Map<string,THREE.DataTexture>();
 private geometries=new Map<string,THREE.BufferGeometry>();
 private pending:{model:DffModel;instances:THREE.Object3D[]}[]=[];
 private attached=new WeakSet<THREE.Object3D>();
 private signs:{mesh:THREE.Mesh;instance:THREE.Object3D;materials:THREE.MeshBasicMaterial[]}[]=[];
 readonly group=new THREE.Group();
 constructor(scene?:THREE.Scene){
  this.group.name='Native roadsigns';this.group.rotation.x=-Math.PI/2;this.group.matrixAutoUpdate=false;this.group.updateMatrix();
  scene?.add(this.group);
 }
 /** The `roadsignfont` raster (RGBA, 32 x 512) from particle.txd; attachments made before it wait for it. */
 setFont(font:RoadsignFont){
  this.font=font;
  const pending=this.pending.splice(0);for(const p of pending)this.attach(p.model,p.instances);
 }
 get ready(){return !!this.font;}
 get count(){return this.signs.length;}
 /** CEntity::CreateEffects for the roadsign effects of `model`, once per placement instance. */
 attach(model:DffModel,instances:readonly THREE.Object3D[]){
  const effects:{effect:ModelRoadsignEffect;position:[number,number,number];index:number}[]=[];
  model.atomics.forEach((atomic,a)=>{if(!(atomic.flags&4))return;const list=model.geometries[atomic.geometry]?.effects;if(!list)return;
   list.forEach((effect,e)=>{if(effect.roadsign)effects.push({effect:effect.roadsign,position:effect.position,index:a*4096+e});});});
  if(!effects.length)return 0;
  const fresh=instances.filter(i=>!this.attached.has(i));if(!fresh.length)return 0;
  if(!this.font){this.pending.push({model,instances:fresh});return 0;}
  let made=0;
  for(const instance of fresh){
   this.attached.add(instance);
   for(const sign of effects){
    const {mesh,materials}=this.mesh(model,sign.effect,sign.position,sign.index);
    this.group.add(mesh);this.signs.push({mesh,instance,materials});made++;
   }
  }
  return made;
 }
 /** RenderRoadsignAtomic each frame: the alpha by distance, nothing past 500 units; signs whose placement left the
  * scene go with it. CEntity::Render draws the sign, so it shows only while its entity does: a placement the visibility
  * pass hid (out of range, off screen, occluded) hides its signs. `cameraPosition` is in renderer space. */
 update(cameraPosition:{x:number;y:number;z:number}){
  const cx=cameraPosition.x,cy=-cameraPosition.z,cz=cameraPosition.y;
  for(let i=this.signs.length-1;i>=0;i--){
   const sign=this.signs[i];
   let alive=false,shown=true;for(let o:THREE.Object3D|null=sign.instance;o;o=o.parent){if(!o.visible)shown=false;if((o as THREE.Scene).isScene){alive=true;break;}}
   if(!alive){this.group.remove(sign.mesh);sign.materials.forEach(m=>m.dispose());this.signs.splice(i,1);continue;}
   const e=sign.mesh.matrix.elements,d=Math.hypot(e[12]-cx,e[13]-cy,e[14]-cz);
   if(!shown||d>ROADSIGN_FADE_END){sign.mesh.visible=false;continue;}
   const alpha=roadsignAlpha(d)/255;sign.mesh.visible=alpha>0;
   for(const m of sign.materials)if(m.opacity!==alpha)m.opacity=alpha;
  }
 }
 private mesh(model:DffModel,effect:ModelRoadsignEffect,position:[number,number,number],index:number){
  const numLines=roadsignNumLines(effect.flags),letters=roadsignNumLetters(effect.flags),palette=roadsignPalette(effect.flags);
  const key=`${model.frames.length}:${index}:${effect.size}:${effect.flags}`;
  let geometry=this.geometries.get(key);
  if(!geometry){
   geometry=new THREE.BufferGeometry();const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
   for(let line=0;line<numLines;line++){const q=roadsignLineQuad(effect.size[0],effect.size[1],numLines,line),base=line*4;positions.push(...q.positions);uvs.push(...q.uvs);indices.push(...q.indices.map(i=>i+base));geometry.addGroup(line*6,6,line);}
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
   this.geometries.set(key,geometry);
  }
  const rgb=ROADSIGN_PALETTE[palette]??ROADSIGN_PALETTE[0];
  const materials=effect.lines.slice(0,numLines).map(text=>nativeRasterOutput(new THREE.MeshBasicMaterial({map:this.texture(text,letters),color:new THREE.Color().setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255),transparent:true,alphaTest:ROADSIGN_ALPHA_TEST,side:THREE.FrontSide})));
  const mesh=new THREE.Mesh(geometry,materials);mesh.name='Native roadsign';mesh.matrixAutoUpdate=false;
  // RwFrameRotate about Z (replace), X and Y (post-concatenated), then RwFrameTranslate to the effect position.
  const [rx,ry,rz]=effect.rotation.map(d=>d*Math.PI/180);
  mesh.matrix.makeTranslation(position[0],position[1],position[2]).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(rx)).multiply(new THREE.Matrix4().makeRotationZ(rz));
  mesh.matrixWorldNeedsUpdate=true;
  return {mesh,materials};
 }
 private texture(text:string,letters:number){
  const key=`${letters}:${text}`;let texture=this.textures.get(key);
  if(texture)return texture;
  const raster=roadsignLineRaster(text,letters,this.font!);
  texture=new THREE.DataTexture(raster.data,raster.width,raster.height,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  this.textures.set(key,texture);return texture;
 }
 snapshot(){return {ready:!!this.font,signs:this.signs.length,visible:this.signs.filter(s=>s.mesh.visible).length,textures:this.textures.size,pending:this.pending.length};}
 dispose(){
  this.group.removeFromParent();for(const s of this.signs)s.materials.forEach(m=>m.dispose());this.signs.length=0;
  for(const t of this.textures.values())t.dispose();for(const g of this.geometries.values())g.dispose();this.textures.clear();this.geometries.clear();this.pending.length=0;
 }
}
