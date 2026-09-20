import * as THREE from 'three';
import {colourFilterFactor,postFxPasses,type PostFxColour} from '../world/nativePostEffects';
/** CPostEffects::ColourFilter as one full-screen quad drawn last: its colour is a1 c1 + a2 c2 and the blend takes
 * the destination colour times that plus the destination once (DST_COLOR / ONE), which is the two native passes of
 * front buffer x colour x alpha added to the frame. No depth, no fog, before the rain grain and the vision passes. */
export class NativeColourFilter {
 readonly mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 private factor=new THREE.Vector3();
 /** CPostEffects::m_bColorEnable. */
 enabled=true;
 constructor(scene?:THREE.Scene){
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{factor:{value:this.factor}},transparent:true,depthTest:false,depthWrite:false,fog:false,
   blending:THREE.CustomBlending,blendSrc:THREE.DstColorFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,
   vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:'uniform vec3 factor;void main(){gl_FragColor=vec4(factor,1.);}'}));
  this.mesh.name='Native colour filter';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=999;this.mesh.matrixAutoUpdate=false;
  scene?.add(this.mesh);
 }
 /** The frame's passes from the timecycle post-effect colours (bytes), the vision state and the extra multiplier. */
 update(pass1:PostFxColour|undefined,pass2:PostFxColour|undefined,options:{vision?:boolean;laRiotsLightMult?:number;extraMult?:number}={}){
  if(!this.enabled||!pass1||!pass2){this.mesh.visible=false;this.factor.set(0,0,0);return;}
  const [p1,p2]=postFxPasses(pass1,pass2,options),f=colourFilterFactor(p1,p2);
  // A replacement timecycle without post-effect columns yields no filter rather than a NaN that blacks the frame.
  if(!f.every(Number.isFinite)){this.mesh.visible=false;this.factor.set(0,0,0);return;}
  this.factor.set(f[0],f[1],f[2]);
  this.mesh.visible=f[0]>0||f[1]>0||f[2]>0;
 }
 snapshot(){return {enabled:this.enabled,visible:this.mesh.visible,factor:[+this.factor.x.toFixed(4),+this.factor.y.toFixed(4),+this.factor.z.toFixed(4)]};}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
