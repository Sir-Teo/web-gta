import * as THREE from 'three';
import type {SunCoronaState} from './SunCoronas';
import {projectCorona} from './coronaProjection';

/** Provisional screen quads around source-projected corona centers. Native rotated
 * sprite extents/depth precision remain unverified; see research/SUN.md. */
export class TexturedSun {
  private geometry=new THREE.PlaneGeometry(2,2);
  private meshes=[2.7335,6].map(multiplier=>{
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,
      blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
      uniforms:{raster:{value:null},center:{value:new THREE.Vector3()},extent:{value:new THREE.Vector2()},tint:{value:new THREE.Color()},strength:{value:0}},
      vertexShader:'uniform vec3 center; uniform vec2 extent; varying vec2 texCoord; void main(){ texCoord=uv; gl_Position=vec4(center.xy+position.xy*extent,center.z,1.); }',
      fragmentShader:'uniform sampler2D raster; uniform vec3 tint; uniform float strength; varying vec2 texCoord; void main(){ gl_FragColor=vec4(texture2D(raster,texCoord).rgb*tint*strength,0.); }',
    });
    const mesh=new THREE.Mesh(this.geometry,material);mesh.frustumCulled=false;mesh.renderOrder=10000;mesh.visible=false;
    return {mesh,multiplier};
  });
  constructor(scene:THREE.Scene){for(const {mesh} of this.meshes)scene.add(mesh);}
  update(camera:THREE.PerspectiveCamera,texture:THREE.Texture|undefined,core:SunCoronaState|undefined,corona:SunCoronaState|undefined){
    for(const [i,{mesh,multiplier}] of this.meshes.entries()){
      const state=[core,corona][i];mesh.visible=false;mesh.material.uniforms.raster.value=texture??null;
      if(!texture||!state||state.intensity===0||state.size<=0)continue;
      const position=state.position.clone().addScaledVector(state.direction,-1.5);
      // Size FOV 70 is an explicit provisional scalar; the current browser camera
      // uses a separate vertical FOV. This must not be presented as retail parity.
      const projected=projectCorona(camera,position,1,1,70);if(!projected)continue;
      const clip=position.clone().project(camera),u=mesh.material.uniforms;
      u.center.value.copy(clip);u.extent.value.set(projected.widthScale*state.size*multiplier*2,projected.heightScale*state.size*multiplier*2);
      new THREE.Color(...state.color).getRGB(u.tint.value,THREE.SRGBColorSpace);u.strength.value=state.intensity/255;
      mesh.visible=true;
    }
  }
  dispose(){for(const {mesh} of this.meshes){mesh.removeFromParent();mesh.material.dispose();}this.geometry.dispose();}
}
