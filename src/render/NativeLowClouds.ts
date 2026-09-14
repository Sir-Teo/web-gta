import * as THREE from 'three';
import {projectCorona} from './coronaProjection';
import type {ImportedLighting} from '../world/LocalTimecycle';
const offsets=[[1,0,0],[.7,-.7,1],[0,-1,.5],[-.7,-.7,0],[-1,0,1],[-.7,.7,.3],[0,1,.9],[.7,.7,.4],[.8,.4,1.3],[-.8,.4,1.4],[.4,-.8,1.2],[-.4,-.8,1.7]];
export const LOW_CLOUD_POSITIONS=offsets.map(([x,y,z])=>({x:x*800,y:z*60+40,z:-y*800}));

/** Source placements and color modulation; sprite roll/rasterization are browser adaptations. */
export class NativeLowClouds {
  private geometry=new THREE.PlaneGeometry(2,2);
  private cameraPosition=new THREE.Vector3();
  private position=new THREE.Vector3();
  readonly meshes=LOW_CLOUD_POSITIONS.map((_,index)=>{
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,
      blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
      uniforms:{raster:{value:null},center:{value:new THREE.Vector2()},extent:{value:new THREE.Vector2()},rotation:{value:new THREE.Vector2(1,0)},aspect:{value:1},tint:{value:new THREE.Vector3()}},
      vertexShader:`uniform vec2 center;uniform vec2 extent;uniform vec2 rotation;uniform float aspect;varying vec2 texCoord;
        void main(){texCoord=vec2(uv.x,1.-uv.y);vec2 p=position.xy*extent;
          p=vec2(rotation.x*p.x-rotation.y*p.y/aspect,rotation.y*p.x*aspect+rotation.x*p.y);
          gl_Position=vec4(center+p,1.,1.);}`,
      fragmentShader:'uniform sampler2D raster;uniform vec3 tint;varying vec2 texCoord;void main(){gl_FragColor=vec4(texture2D(raster,texCoord).rgb*tint,0.);}',
    });
    const mesh=new THREE.Mesh(this.geometry,material);mesh.name=`Native low cloud ${index}`;mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=-8;return mesh;
  });
  constructor(scene:THREE.Scene){scene.add(...this.meshes);}
  update(camera:THREE.PerspectiveCamera,source:ImportedLighting['lowClouds'],texture:THREE.Texture|undefined,sourceFov:number){
    camera.getWorldPosition(this.cameraPosition);
    const matrix=camera.matrixWorld.elements,roll=-Math.atan2(matrix[1],matrix[5]);
    for(const [i,mesh] of this.meshes.entries()){
      const u=mesh.material.uniforms;mesh.visible=false;u.raster.value=texture??null;
      if(!source||!texture||source.visibility<=0||source.color.every(c=>c===0))continue;
      const offset=LOW_CLOUD_POSITIONS[i];this.position.set(this.cameraPosition.x+offset.x,offset.y,this.cameraPosition.z+offset.z);
      const projected=projectCorona(camera,this.position,1,1,sourceFov,false);if(!projected)continue;
      u.center.value.set(projected.x*2-1,1-projected.y*2);
      u.extent.value.set(projected.widthScale*320*2,projected.heightScale*40*2);
      u.rotation.value.set(Math.cos(roll),Math.sin(roll));u.aspect.value=camera.aspect;
      u.tint.value.set(...source.color.map(c=>Math.trunc(c*source.visibility)/255) as [number,number,number]);mesh.visible=true;
    }
  }
  dispose(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.material.dispose();}this.geometry.dispose();}
}
