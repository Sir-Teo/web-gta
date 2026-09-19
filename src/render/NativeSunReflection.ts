import * as THREE from 'three';
import type {SunReflectionStrip} from '../world/nativeSunReflection';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// The vertex colour modulates the raster in display space; additive (ONE, ONE), no fog.
const fragmentShader=`uniform sampler2D raster;uniform vec3 tint;varying vec2 vUv;
void main(){vec3 c=texture2D(raster,vUv).rgb*tint;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,0.);
 #include <colorspace_fragment>
}`;
/** CCoronas::RenderSunReflection's strip, drawn in RenderScene after the rain streaks and before the water: depth
 * tested without depth writes, additive, unculled and unfogged. */
export class NativeSunReflection {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private positions=new Float32Array(44*3);
 visible=false;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(44*2),2).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(126),1));
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{raster:{value:null},tint:{value:new THREE.Vector3()}},vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,
   side:THREE.DoubleSide,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor}));
  // Before the water (render order 0), which blends over it.
  this.mesh.name='Native sun reflection';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=-1;
  scene.add(this.mesh);
 }
 frame(strip:SunReflectionStrip|undefined,raster:THREE.Texture|undefined){
  this.visible=this.mesh.visible=!!strip&&!!raster&&strip.color.some(c=>c>0);
  if(!this.visible||!strip)return;
  const geometry=this.mesh.geometry,p=strip.positions;
  // Native (x, y, z) is the renderer's (x, z, -y).
  for(let i=0;i<p.length;i+=3){this.positions[i]=p[i];this.positions[i+1]=p[i+2];this.positions[i+2]=-p[i+1];}
  (geometry.getAttribute('uv') as THREE.BufferAttribute).set(strip.uvs);
  geometry.getIndex()!.set(strip.indices);
  for(const name of ['position','uv'])geometry.getAttribute(name).needsUpdate=true;
  geometry.getIndex()!.needsUpdate=true;
  this.mesh.material.uniforms.raster.value=raster;
  (this.mesh.material.uniforms.tint.value as THREE.Vector3).set(strip.color[0]/255,strip.color[1]/255,strip.color[2]/255);
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
