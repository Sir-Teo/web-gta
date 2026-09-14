import * as THREE from 'three';
import {nativeStreak} from '../world/nativeStreak';

/** Native streak path with browser line rasterization and far-plane depth adaptation. */
export class NativeStreak {
  private cameraPosition=new THREE.Vector3();
  private positions=new THREE.Float32BufferAttribute(6,3);
  readonly line:THREE.Line<THREE.BufferGeometry,THREE.ShaderMaterial>;
  constructor(scene:THREE.Scene){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',this.positions);
    geometry.setAttribute('opacity',new THREE.Float32BufferAttribute([225/255,0],1));
    const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,
      blending:THREE.NormalBlending,
      vertexShader:'attribute float opacity; varying float strength; void main(){strength=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
      fragmentShader:'varying float strength; void main(){gl_FragColor=vec4(vec3(1.),strength);}',
    });
    this.line=new THREE.Line(geometry,material);this.line.name='Native shooting star';this.line.frustumCulled=false;this.line.renderOrder=-7;this.line.visible=false;scene.add(this.line);
  }
  update(camera:THREE.PerspectiveCamera,minutes:number,timeMs:number,enabled:boolean){
    const streak=nativeStreak(minutes,timeMs,enabled);this.line.visible=!!streak;if(!streak)return;
    camera.getWorldPosition(this.cameraPosition);this.line.position.copy(this.cameraPosition);
    this.positions.setXYZ(0,streak.head.x,streak.head.y,streak.head.z);this.positions.setXYZ(1,streak.tail.x,streak.tail.y,streak.tail.z);this.positions.needsUpdate=true;
  }
  dispose(){this.line.removeFromParent();this.line.geometry.dispose();this.line.material.dispose();}
}
