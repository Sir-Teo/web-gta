import * as THREE from 'three';
import {MOON_OFFSET,nativeMoon} from '../world/nativeMoon';
import {projectCorona} from './coronaProjection';

/** CClouds' moon: the `coronamoon` raster added over the sky at the far clip (behind the world), like the stars. */
export class NativeMoon {
 private geometry=new THREE.PlaneGeometry(2,2);private position=new THREE.Vector3();
 readonly mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 constructor(scene:THREE.Scene){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
   uniforms:{raster:{value:null},center:{value:new THREE.Vector2()},extent:{value:new THREE.Vector2()},colour:{value:new THREE.Vector3()}},
   vertexShader:'uniform vec2 center; uniform vec2 extent; varying vec2 texCoord; void main(){texCoord=vec2(uv.x,1.-uv.y);gl_Position=vec4(center+position.xy*extent,1.,1.);}',
   fragmentShader:'uniform sampler2D raster; uniform vec3 colour; varying vec2 texCoord; void main(){vec3 c=texture2D(raster,texCoord).rgb*colour;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}'});
  this.mesh=new THREE.Mesh(this.geometry,material);this.mesh.name='Native moon';this.mesh.visible=false;this.mesh.frustumCulled=false;this.mesh.renderOrder=-9.5;scene.add(this.mesh);
 }
 update(camera:THREE.PerspectiveCamera,minutes:number,enabled:boolean,texture:THREE.Texture|undefined,sourceFov:number,colorBalance:number){
  this.mesh.visible=false;
  const moon=enabled&&texture?nativeMoon(((minutes%1440)+1440)%1440,colorBalance):undefined;if(!moon)return;
  // Native (x, y, z) is the renderer's (x, z, -y).
  camera.getWorldPosition(this.position);this.position.x+=MOON_OFFSET[0];this.position.y+=MOON_OFFSET[2];this.position.z-=MOON_OFFSET[1];
  const projected=projectCorona(camera,this.position,1,1,sourceFov,false);if(!projected)return;
  const u=this.mesh.material.uniforms;u.raster.value=texture;u.colour.value.set(moon.color[0]/255,moon.color[1]/255,moon.color[2]/255);
  u.center.value.set(projected.x*2-1,1-projected.y*2);u.extent.value.set(projected.widthScale*moon.halfSize*2,projected.heightScale*moon.halfSize*2);
  this.mesh.visible=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.material.dispose();this.geometry.dispose();}
}
