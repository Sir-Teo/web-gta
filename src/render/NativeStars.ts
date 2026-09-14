import * as THREE from 'three';
import {random} from '../core/math';
import {NATIVE_STARS,nativeStarLevel,nativeStarTwinkle} from '../world/nativeStars';
import {projectCorona} from './coronaProjection';

/** Source constellation with shared optional coronastar raster. Browser RNG and fallback
 * disc are provisional; sprite-buffer/depth details need original-platform comparison. */
export class NativeStars {
  private geometry=new THREE.PlaneGeometry(2,2);
  private position=new THREE.Vector3();
  private cameraPosition=new THREE.Vector3();
  private random=random(1992);
  private twinkle=NATIVE_STARS.map((_,i)=>nativeStarTwinkle(i,0));
  readonly meshes=NATIVE_STARS.map((_,index)=>{
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,
      blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
      uniforms:{raster:{value:null},textured:{value:false},center:{value:new THREE.Vector2()},extent:{value:new THREE.Vector2()},strength:{value:0}},
      vertexShader:'uniform vec2 center; uniform vec2 extent; varying vec2 texCoord; void main(){texCoord=vec2(uv.x,1.-uv.y);gl_Position=vec4(center+position.xy*extent,1.,1.);}',
      fragmentShader:'uniform sampler2D raster; uniform bool textured; uniform float strength; varying vec2 texCoord; void main(){vec3 value=textured?texture2D(raster,texCoord).rgb:vec3(1.-smoothstep(.2,.5,length(texCoord-.5)));gl_FragColor=vec4(value*strength,0.);}',
    });
    const mesh=new THREE.Mesh(this.geometry,material);mesh.name=`Native star ${index}`;mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=-9;return mesh;
  });
  constructor(scene:THREE.Scene){scene.add(...this.meshes);}
  update(camera:THREE.PerspectiveCamera,minutes:number,enabled:boolean,texture:THREE.Texture|undefined,sourceFov:number,advance:boolean){
    const level=nativeStarLevel(minutes);camera.getWorldPosition(this.cameraPosition);
    for(const [i,mesh] of this.meshes.entries()){
      const u=mesh.material.uniforms;mesh.visible=false;u.raster.value=texture??null;u.textured.value=!!texture;
      if(!enabled||level===0)continue;
      const star=NATIVE_STARS[i];this.position.copy(this.cameraPosition).add(star);
      const projected=projectCorona(camera,this.position,1,1,sourceFov,false);if(!projected)continue;
      if(advance)this.twinkle[i]=nativeStarTwinkle(i,Math.floor(this.random()*0x80000000));
      u.strength.value=Math.trunc(level*this.twinkle[i])/255;
      u.center.value.set(projected.x*2-1,1-projected.y*2);
      u.extent.value.set(projected.widthScale*star.size*2,projected.heightScale*star.size*2);
      mesh.visible=true;
    }
  }
  dispose(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.material.dispose();}this.geometry.dispose();}
}
