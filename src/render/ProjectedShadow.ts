import {BufferAttribute,BufferGeometry,CustomBlending,DoubleSide,DynamicDrawUsage,Matrix4,Mesh,OneFactor,OneMinusSrcColorFactor,PerspectiveCamera,ShaderMaterial,Vector3,WebGLCoordinateSystem,ZeroFactor,type Texture} from 'three';
import {nativeShadowNearClip} from './nativeShadowDepth';
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
   uniforms:{shadowTexture:{value:null},shadowStrength:{value:0},nightBalance:{value:0},shadowDepthProjection:{value:new Matrix4()},useShadowDepthProjection:{value:false}},
   vertexShader:`attribute float receiverLight; uniform float shadowStrength; uniform float nightBalance;
    varying vec2 shadowUv; varying float shadowColor;
    uniform mat4 shadowDepthProjection; uniform bool useShadowDepthProjection;
    void main(){
     float day=mod(receiverLight,16.0)/30.0;
     float night=floor(receiverLight/16.0)/30.0;
     float light=min(0.4+0.6*(1.0-nightBalance),0.3+0.7*mix(day,night,nightBalance));
     shadowColor=floor(shadowStrength*light)/255.0; shadowUv=uv;
     vec4 eye=modelViewMatrix*vec4(position,1.0);
     gl_Position=useShadowDepthProjection?shadowDepthProjection*eye:projectionMatrix*eye;
    }`,
   fragmentShader:`uniform sampler2D shadowTexture; varying vec2 shadowUv; varying float shadowColor;
    void main(){
     if(any(lessThan(shadowUv,vec2(0.0)))||any(greaterThan(shadowUv,vec2(1.0))))discard;
     gl_FragColor=vec4(texture2D(shadowTexture,shadowUv).rgb*shadowColor,1.0);
    }`,
   transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:DoubleSide,forceSinglePass:true,
   blending:CustomBlending,blendSrc:ZeroFactor,blendDst:OneMinusSrcColorFactor,
   // Preserve browser canvas coverage; the native backbuffer alpha is not composited.
   blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor,
   // Orthographic diagnostic fallback; perspective draws use the native clip bias.
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  });
  const direction=new Vector3();
  material.onBeforeRender=(_renderer,_scene,camera)=>{
   const supported=camera instanceof PerspectiveCamera&&camera.coordinateSystem===WebGLCoordinateSystem&&!camera.reversedDepth;
   material.uniforms.useShadowDepthProjection.value=supported;material.polygonOffset=!supported;
   if(!supported)return;
   const near=nativeShadowNearClip(camera.near,camera.far,camera.getWorldDirection(direction).y),far=camera.far;
   const matrix=material.uniforms.shadowDepthProjection.value as Matrix4;matrix.copy(camera.projectionMatrix);
   // Preserve view offsets, aspect and jitter. Only perspective depth coefficients
   // change, and the borrowed camera/projection remain untouched for later draws.
   matrix.elements[10]=-(far+near)/(far-near);matrix.elements[14]=-2*far*near/(far-near);
  };
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
