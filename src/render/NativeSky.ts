import * as THREE from 'three';
import { belowHorizonColor, type NativeSkyColors, type SkyWeather } from '../world/nativeSkyColors';
import { proceduralSkySun } from './proceduralSkySun';

/** Five source sky quads, centered on the world camera and rotated only around vertical. */
export class NativeSky {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private forward = new THREE.Vector3();
  private colors = new Float32Array(60);
  constructor(scene: THREE.Scene, sunUniforms: Record<string, THREE.IUniform>) {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [], indices: number[] = [];
    const quad = (topY: number, bottomY: number, bottomZ = -30) => {
      const start = positions.length / 3;
      positions.push(-42,topY,-30, 42,topY,-30, -42,bottomY,bottomZ, 42,bottomY,bottomZ);
      indices.push(start,start+2,start+1, start+1,start+2,start+3);
    };
    quad(15,0);quad(0,-3);quad(-3,-9);quad(15,15,30);quad(-9,-9,30);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors,3));geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      uniforms: sunUniforms, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
      vertexShader: `attribute vec3 color; varying vec3 skyColor; varying vec3 skyDirection;
        void main(){ skyColor=color; skyDirection=(modelMatrix*vec4(position,0.0)).xyz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w; }`,
      fragmentShader: `varying vec3 skyColor; varying vec3 skyDirection; ${proceduralSkySun}
        void main(){
          vec3 linearColor=mix(skyColor/12.92,pow((skyColor+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),skyColor));
          gl_FragColor=vec4(linearColor+skySun(normalize(skyDirection)),1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geometry,material);this.mesh.name='Native sky bands';
    this.mesh.frustumCulled=false;this.mesh.renderOrder=-10;this.mesh.visible=false;scene.add(this.mesh);
  }
  update(camera: THREE.PerspectiveCamera, source: NativeSkyColors | undefined, minutes: number, weather: SkyWeather) {
    this.mesh.visible=!!source;if(!source)return;
    camera.getWorldPosition(this.mesh.position);camera.getWorldDirection(this.forward);
    if(Math.hypot(this.forward.x,this.forward.z)>1e-7)
      this.mesh.rotation.y=Math.atan2(-this.forward.x,-this.forward.z);
    const below=belowHorizonColor(minutes,this.mesh.position.y,source.bottom,weather);
    const rows=[source.top,source.bottom,source.bottom,source.bottom,source.bottom,below,source.top,source.top,below,below];
    rows.forEach((rgb,row)=>{for(let vertex=0;vertex<2;vertex++)for(let c=0;c<3;c++)this.colors[row*6+vertex*3+c]=rgb[c]/255;});
    this.mesh.geometry.getAttribute('color').needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
