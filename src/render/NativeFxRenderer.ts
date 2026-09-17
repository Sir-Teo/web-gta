import * as THREE from 'three';
import {FX_INFO} from '../assets/fxProject';
import {RENDER_COLOUR,fxTransformPoint,fxTransformVector,type FxParticle,type NativeFxManager,type NativeFxPrim,type RenderInfo} from '../simulation/fx/NativeFx';
/** RwBlendFunction order used by the FX blend IDs. */
const BLEND=[THREE.ZeroFactor,THREE.OneFactor,THREE.SrcColorFactor,THREE.OneMinusSrcColorFactor,THREE.SrcAlphaFactor,THREE.OneMinusSrcAlphaFactor,THREE.DstAlphaFactor,THREE.OneMinusDstAlphaFactor,THREE.DstColorFactor,THREE.OneMinusDstColorFactor,THREE.SrcAlphaSaturateFactor] as const;
const vertexShader=`attribute vec4 fxColor;
varying vec4 vColor;
varying vec2 vUv;
#include <fog_pars_vertex>
void main(){
 vColor=fxColor;vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
/** RW modulates the raster by prelit vertex colour in display space; fog and output conversion then follow the scene. */
const fragmentShader=`uniform sampler2D raster;
uniform bool textured;
varying vec4 vColor;
varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
 vec4 c=vColor*(textured?texture2D(raster,vUv):vec4(1.));
 if(c.a<=0.)discard;
 c.rgb=mix(pow((c.rgb+.055)/1.055,vec3(2.4)),c.rgb/12.92,step(c.rgb,vec3(.04045)));
 gl_FragColor=c;
 #include <fog_fragment>
 #include <colorspace_fragment>
}`;
interface PrimView {mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial[]>;capacity:number;position:Float32Array;uv:Float32Array;color:Float32Array;}
const info:RenderInfo={color1:[0,0,0,0],color2:[0,0,0,0],colorType:0,sizeX:0,sizeY:0,sizeXBias:0,sizeYBias:0,spriteTop:0,spriteBottom:0,spriteLeft:0,spriteRight:0,trailMode:0,trailTime:0,animTextures:false,texture:0,heatHaze:false,selfLit:false,hasDir:false,useVel:false,direction:[0,0,0],smokeType:-1};
/** FxEmitterBP_c::Render port (0x4A2C40): camera-facing, directional, trail and flat quads per prim blueprint, plus the heat-haze shimmer pass. */
export class NativeFxRenderer {
 private views=new Map<NativeFxPrim,PrimView>();
 private right=new THREE.Vector3();private up=new THREE.Vector3();private forward=new THREE.Vector3();private cameraPosition=new THREE.Vector3();
 quads=0;
 constructor(private scene:THREE.Scene,private fx:NativeFxManager,private textures:ReadonlyMap<string,THREE.Texture>){}
 private view(prim:NativeFxPrim,count:number){
  let view=this.views.get(prim);
  if(view&&view.capacity>=count)return view;
  const capacity=Math.max(16,2**Math.ceil(Math.log2(count)));
  if(view){view.mesh.geometry.dispose();}
  const geometry=new THREE.BufferGeometry(),position=new Float32Array(capacity*12),uv=new Float32Array(capacity*8),color=new Float32Array(capacity*16),index=new Uint32Array(capacity*6);
  for(let q=0;q<capacity;q++){const v=q*4;index.set([v,v+2,v+1,v+1,v+2,v+3],q*6);}
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('fxColor',new THREE.BufferAttribute(color,4).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(new THREE.BufferAttribute(index,1));
  if(view){view.mesh.geometry=geometry;Object.assign(view,{capacity,position,uv,color});return view;}
  const bp=prim.bp,materials=[0,1,2,3].map(slot=>{
   const name=bp.textures[slot],texture=name?this.textures.get(name.toLowerCase()):undefined;
   return new THREE.ShaderMaterial({uniforms:{raster:{value:texture??null},textured:{value:!!texture},...THREE.UniformsUtils.clone(THREE.UniformsLib.fog)},vertexShader,fragmentShader,fog:true,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
    blending:THREE.CustomBlending,blendSrc:bp.alphaOn?BLEND[bp.srcBlend]??THREE.SrcAlphaFactor:THREE.OneFactor,blendDst:bp.alphaOn?(BLEND[bp.dstBlend]??THREE.OneMinusSrcAlphaFactor) as THREE.BlendingDstFactor:THREE.ZeroFactor});
  });
  const mesh=new THREE.Mesh(geometry,materials);mesh.name=`FX ${prim.system.name}/${bp.textures[0]}`;mesh.frustumCulled=false;mesh.renderOrder=5;this.scene.add(mesh);
  view={mesh,capacity,position,uv,color};this.views.set(prim,view);return view;
 }
 /** `dayNightBalance` is CCustomBuildingDNPipeline::m_fDNBalanceParam (1 at night). */
 update(camera:THREE.Camera,dayNightBalance:number){
  camera.updateMatrixWorld();const e=camera.matrixWorld.elements;
  this.right.set(e[0],e[1],e[2]).normalize();this.up.set(e[4],e[5],e[6]).normalize();this.forward.set(-e[8],-e[9],-e[10]).normalize();this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  // FxManager_c::Render passes (1 - balance) * 0.6 + 0.4 to every prim.
  const lighting=(1-Math.min(1,Math.max(0,dayNightBalance)))*.6+.4;
  this.quads=0;
  for(const prim of this.fx.prims){
   const existing=this.views.get(prim);
   if(!prim.particles.length){if(existing)existing.mesh.visible=false;continue;}
   // HeatHazeFX pass: heat-haze prims render as a faint shimmer (distortion
   // without a refraction target) instead of being hidden.
   const view=this.view(prim,prim.particles.length),geometry=view.mesh.geometry,animated=prim.bp.infos.some(i=>i.type===FX_INFO.animTex);
   geometry.clearGroups();let written=0;
   // FX_INFO_ANIMTEX selects one of the four prim rasters per particle; each raster draws as its own group.
   for(let slot=0;slot<(animated?4:1);slot++){
    const start=written;
    for(const prt of prim.particles){prim.renderInfo(prt,info);if(animated&&Math.min(3,Math.max(0,info.texture))!==slot)continue;if(this.quad(prt,view,written,lighting))written++;}
    if(written>start)geometry.addGroup(start*6,(written-start)*6,slot);
   }
   for(const name of ['position','uv','fxColor'])geometry.getAttribute(name).needsUpdate=true;
   view.mesh.visible=written>0;this.quads+=written;
  }
 }
 private quad(prt:FxParticle,view:PrimView,q:number,lighting:number){
  const system=prt.system;
  let native=prt.pos;
  const composite=prt.local||info.flat||info.hasDir&&!info.useVel?system.composite():undefined;
  if(prt.local)native=fxTransformPoint(composite!,...prt.pos);
  const px=native[0],py=native[2],pz=-native[1];
  // Colour: range and bright variants use the particle's random bytes; lit particles follow the day/night balance.
  let [r,g,b,a]=info.color1;
  if(info.colorType===RENDER_COLOUR.range){r+=(info.color2[0]-r)*prt.randR/255;g+=(info.color2[1]-g)*prt.randG/255;b+=(info.color2[2]-b)*prt.randB/255;}
  else if(info.colorType===RENDER_COLOUR.bright){const offset=(prt.randR/255*2-1)*info.color2[3];r+=offset;g+=offset;b+=offset;}
  const light=info.selfLit?1:lighting*Math.min(1,prt.brightness);
  const clamp=(v:number)=>Math.min(255,Math.max(0,v));
  r=clamp(r)*prt.multColor[0]/255*light;g=clamp(g)*prt.multColor[1]/255*light;b=clamp(b)*prt.multColor[2]/255*light;a=clamp(a)*prt.multColor[3]/255;
  if(info.heatHaze)a=Math.min(a,26);
  if(a<=0)return false;
  const bias=prt.randG/255*2-1,sx=(info.sizeX+info.sizeXBias*bias)*prt.multSize,sy=(info.sizeY+info.sizeYBias*bias)*prt.multSize;
  if(!(Math.abs(sx)>0||Math.abs(sy)>0))return false;
  let ax:number,ay:number,az:number,bx:number,by:number,bz:number,left=info.spriteLeft*sx,right=info.spriteRight*sx,top=info.spriteTop*sy,bottom=info.spriteBottom*sy;
  const axisFrom=(nx:number,ny:number,nz:number)=>{const x=nx,y=nz,z=-ny,l=Math.hypot(x,y,z);return l>1e-6?[x/l,y/l,z/l]:undefined;};
  const side=(d:number[])=>{const f=this.forward,x=d[1]*f.z-d[2]*f.y,y=d[2]*f.x-d[0]*f.z,z=d[0]*f.y-d[1]*f.x,l=Math.hypot(x,y,z);return l>1e-6?[x/l,y/l,z/l]:undefined;};
  if(info.flat){
   const m=composite!,rv=fxTransformVector(m,info.flat[0],info.flat[1],info.flat[2]),uv=fxTransformVector(m,info.flat[3],info.flat[4],info.flat[5]);
   const rx=axisFrom(...rv)??[1,0,0],ux=axisFrom(...uv)??[0,0,-1];ax=rx[0];ay=rx[1];az=rx[2];bx=ux[0];by=ux[1];bz=ux[2];
  }else if(info.trailMode){
   // Trail length: world-space trails read TRAILTIME in native frames, screen-space trails in milliseconds.
   const seconds=info.trailMode===2?info.trailTime/1000:info.trailTime/50,d=axisFrom(prt.vel[0],prt.vel[1],prt.vel[2]),s=d&&side(d),length=Math.hypot(...prt.vel)*seconds;
   if(!d||!s)return false;
   ax=s[0];ay=s[1];az=s[2];bx=d[0];by=d[1];bz=d[2];left=.5*sx;right=-.5*sx;top=0;bottom=-length;
  }else if(info.hasDir){
   const dir=info.useVel?prt.vel:fxTransformVector(composite!,...info.direction),d=axisFrom(dir[0],dir[1],dir[2]),s=d&&side(d);
   if(d&&s){ax=s[0];ay=s[1];az=s[2];bx=d[0];by=d[1];bz=d[2];}
   else{ax=this.right.x;ay=this.right.y;az=this.right.z;bx=this.up.x;by=this.up.y;bz=this.up.z;}
  }else{
   const angle=prt.rotation*prt.multRot*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),R=this.right,U=this.up;
   ax=R.x*c+U.x*s;ay=R.y*c+U.y*s;az=R.z*c+U.z*s;bx=-R.x*s+U.x*c;by=-R.y*s+U.y*c;bz=-R.z*s+U.z*c;
  }
  const p=view.position,o=q*12;
  const corner=(i:number,x:number,y:number)=>{p[o+i*3]=px+ax*x+bx*y;p[o+i*3+1]=py+ay*x+by*y;p[o+i*3+2]=pz+az*x+bz*y;};
  corner(0,left,top);corner(1,right,top);corner(2,left,bottom);corner(3,right,bottom);
  view.uv.set([0,0,1,0,0,1,1,1],q*8);
  const colour=[r/255,g/255,b/255,a/255];for(let i=0;i<4;i++)view.color.set(colour,q*16+i*4);
  return true;
 }
 snapshot(){return {quads:this.quads,meshes:this.views.size};}
 dispose(){for(const view of this.views.values()){view.mesh.removeFromParent();view.mesh.geometry.dispose();for(const m of view.mesh.material)m.dispose();}this.views.clear();}
}
