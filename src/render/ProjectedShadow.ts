import {BufferAttribute,BufferGeometry,CustomBlending,DoubleSide,DynamicDrawUsage,Mesh,OneFactor,OneMinusSrcColorFactor,ShaderMaterial,ZeroFactor,type Texture} from 'three';
import type {projectShadowReceiver} from './projectShadowReceiver';
type Receiver=ReturnType<typeof projectShadowReceiver>;
/** Separate inverse-color shadow pass over clipped collision surfaces. The texture
 * is a borrowed intensity raster: black leaves destination unchanged, white darkens.
 * Native real-time shadow texture generation and projection orientation are separate. */
export class ProjectedShadow {
 readonly mesh:Mesh<BufferGeometry,ShaderMaterial>;
 private disposed=false;
 private positions:Float32Array;private uvs:Float32Array;private lights:Uint8Array;
 constructor(readonly capacity=65535){
  if(!Number.isInteger(capacity)||capacity<3||capacity>1000000)throw new Error('Invalid projected shadow capacity.');
  this.positions=new Float32Array(capacity*3);this.uvs=new Float32Array(capacity*2);this.lights=new Uint8Array(capacity);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(this.positions,3).setUsage(DynamicDrawUsage));geometry.setAttribute('uv',new BufferAttribute(this.uvs,2).setUsage(DynamicDrawUsage));geometry.setAttribute('receiverLight',new BufferAttribute(this.lights,1).setUsage(DynamicDrawUsage));geometry.setDrawRange(0,0);
  const material=new ShaderMaterial({
   uniforms:{shadowTexture:{value:null},shadowStrength:{value:0},nightBalance:{value:0}},
   vertexShader:`attribute float receiverLight; uniform float shadowStrength; uniform float nightBalance;
    varying vec2 shadowUv; varying float shadowColor;
    void main(){
     float day=mod(receiverLight,16.0)/30.0;
     float night=floor(receiverLight/16.0)/30.0;
     float light=min(0.4+0.6*(1.0-nightBalance),0.3+0.7*mix(day,night,nightBalance));
     shadowColor=floor(shadowStrength*light)/255.0; shadowUv=uv;
     gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }`,
   fragmentShader:`uniform sampler2D shadowTexture; varying vec2 shadowUv; varying float shadowColor;
    void main(){gl_FragColor=vec4(texture2D(shadowTexture,shadowUv).rgb*shadowColor,1.0);}`,
   transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:DoubleSide,forceSinglePass:true,
   blending:CustomBlending,blendSrc:ZeroFactor,blendDst:OneMinusSrcColorFactor,
   // Preserve browser canvas coverage; the native backbuffer alpha is not composited.
   blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor,
   // Browser depth bias; native z-bias magnitude still requires calibration.
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  });
  this.mesh=new Mesh(geometry,material);this.mesh.name='Projected native character shadow';this.mesh.frustumCulled=false;this.mesh.renderOrder=10000;this.mesh.visible=false;
 }
 update(receivers:readonly Receiver[],texture:Texture|undefined,strength:number,night:number){
  if(this.disposed)throw new Error('Projected shadow is disposed.');
  if(!Number.isInteger(strength)||strength<0||strength>255||!Number.isFinite(night)||night<0||night>1)throw new Error('Invalid projected shadow lighting.');
  let count=0;
  for(const receiver of receivers){
   const vertices=receiver.positions.length/3;
   if(!Number.isInteger(vertices)||vertices%3||receiver.uvs.length!==vertices*2||receiver.lights.length!==vertices||receiver.faces.length!==vertices)throw new Error('Invalid projected shadow receiver.');
   count+=vertices;
  }
  if(count>this.capacity)throw new Error('Projected shadow capacity exceeded.');
  let offset=0;
  for(const receiver of receivers){this.positions.set(receiver.positions,offset*3);this.uvs.set(receiver.uvs,offset*2);this.lights.set(receiver.lights,offset);offset+=receiver.lights.length;}
  const geometry=this.mesh.geometry;
  for(const name of ['position','uv','receiverLight']){
   const attribute=geometry.getAttribute(name) as BufferAttribute;attribute.clearUpdateRanges();
   if(count){attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;}
  }
  geometry.setDrawRange(0,count);
  const uniforms=this.mesh.material.uniforms;uniforms.shadowTexture.value=texture??null;uniforms.shadowStrength.value=strength;uniforms.nightBalance.value=night;
  this.mesh.visible=!!texture&&strength>0&&count>0;
 }
 clear(){if(this.disposed)return;this.mesh.visible=false;this.mesh.geometry.setDrawRange(0,0);this.mesh.material.uniforms.shadowTexture.value=null;}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
