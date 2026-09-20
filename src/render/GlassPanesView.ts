import {AdditiveBlending,BufferAttribute,BufferGeometry,DoubleSide,DynamicDrawUsage,Mesh,MeshBasicMaterial,NormalBlending,type Scene,type Texture} from 'three';
import {MAX_PANES,paneHighlightAlpha,paneShatterAlpha,type GlassPane,type GlassPanes,type Vec3} from '../simulation/nativeGlass';
import {PANE_POLY_POSITIONS} from '../simulation/nativeGlass';

/** CGlass::Render: every falling pane draws a highlight triangle (ONE/ONE with the shad_exp pool texture at a fixed
 * corner of it, its alpha the reflection highlight ramping up over 500 ms) and, for shattering windows, a cracked
 * glass triangle (SRCALPHA/INVSRCALPHA with wincrack_32, uv the piece corners × size × 4, alpha 140 fading past
 * 30 units). No depth write; fog on. Native (x, y, z) becomes the scene's (x, z, -y). */
export class GlassPanesView {
 private highlight:Mesh<BufferGeometry,MeshBasicMaterial>;private shatter:Mesh<BufferGeometry,MeshBasicMaterial>;
 constructor(private scene:Scene){
  const make=(blending:typeof AdditiveBlending|typeof NormalBlending)=>{
   const g=new BufferGeometry(),n=MAX_PANES*3;
   g.setAttribute('position',new BufferAttribute(new Float32Array(n*3),3).setUsage(DynamicDrawUsage));
   g.setAttribute('uv',new BufferAttribute(new Float32Array(n*2),2).setUsage(DynamicDrawUsage));
   g.setAttribute('color',new BufferAttribute(new Float32Array(n*4),4).setUsage(DynamicDrawUsage));
   g.setDrawRange(0,0);
   const m=new MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:DoubleSide,blending,fog:true});
   const mesh=new Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=20;mesh.visible=false;scene.add(mesh);return mesh;
  };
  this.highlight=make(AdditiveBlending);this.shatter=make(NormalBlending);
 }
 setTextures(pool:Texture|undefined,cracked:Texture|undefined){
  this.highlight.material.map=pool??null;this.highlight.material.needsUpdate=true;
  this.shatter.material.map=cracked??null;this.shatter.material.needsUpdate=true;
 }
 /** Rebuild both meshes from the live panes. `cameraForward` and `camera` are native-space. */
 update(panes:GlassPanes,nowMs:number,cameraForward:Vec3,camera:Vec3){
  const hp=this.highlight.geometry.getAttribute('position') as BufferAttribute,huv=this.highlight.geometry.getAttribute('uv') as BufferAttribute,hc=this.highlight.geometry.getAttribute('color') as BufferAttribute;
  const sp=this.shatter.geometry.getAttribute('position') as BufferAttribute,suv=this.shatter.geometry.getAttribute('uv') as BufferAttribute,sc=this.shatter.geometry.getAttribute('color') as BufferAttribute;
  let h=0,s=0;
  const HUV=[[0.5,0.5],[0.5,0.6],[0.6,0.6]];
  for(const p of panes.panes){
   if(nowMs<p.createdTime)continue;
   const corners=panes.corners(p);
   const alpha=paneHighlightAlpha(p,nowMs,cameraForward)/255;
   for(let i=0;i<3;i++){const c=corners[i];hp.setXYZ(h+i,c[0],c[2],-c[1]);huv.setXY(h+i,HUV[i][0],HUV[i][1]);hc.setXYZW(h+i,alpha,alpha,alpha,alpha);}
   h+=3;
   if(p.renderShatter&&s<MAX_PANES*3){
    const a=paneShatterAlpha(p,camera)/255,poly=PANE_POLY_POSITIONS[p.piece];
    for(let i=0;i<3;i++){const c=corners[i];sp.setXYZ(s+i,c[0],c[2],-c[1]);suv.setXY(s+i,poly[i][0]*p.size*4,poly[i][1]*p.size*4);sc.setXYZW(s+i,a,a,a,a);}
    s+=3;
   }
  }
  for(const attr of [hp,huv,hc])attr.needsUpdate=true;for(const attr of [sp,suv,sc])attr.needsUpdate=true;
  this.highlight.geometry.setDrawRange(0,h);this.shatter.geometry.setDrawRange(0,s);
  this.highlight.visible=h>0;this.shatter.visible=s>0;
 }
 dispose(){for(const m of [this.highlight,this.shatter]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}}
}
export type {GlassPane};
