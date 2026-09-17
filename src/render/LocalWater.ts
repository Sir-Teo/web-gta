import * as THREE from 'three';
import {readWater,visibleWaterPolygons,waterGeometry} from '../assets/water';
import type {ImportedLighting} from '../world/LocalTimecycle';
import {WaterLevelIndex} from '../world/waterLevel';
/** Native water surfaces with vertex waves and timecycle color; gameplay heights come from WATER.DAT. */
export class LocalWater {
  private meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]=[];
  private material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false});
  private waveTime?:{value:number};
  private disposed=false;
  name='';counts=[0,0];
  /** Native water heights for gameplay queries (all polygons, including invisible surfaces). */
  levels?:WaterLevelIndex;
  constructor(private scene:THREE.Scene){
    // Native rasters carry display-space bytes. Modulate there, then return to
    // linear space for Three's fog/output stages; never mutate a borrowed texture.
    this.material.onBeforeCompile=shader=>{
      const map=THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`
        vec3 displayWater = sRGBTransferOETF(vec4(diffuseColor.rgb,1.0)).rgb;
        diffuseColor.rgb = sRGBTransferEOTF(vec4(displayWater * sampledDiffuseColor.rgb,1.0)).rgb;
        diffuseColor.a *= sampledDiffuseColor.a;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',map);
      // CWaterLevel waves: two sine swells over world XZ (±0.2 visual; gameplay heights stay on WATER.DAT).
      shader.uniforms.uWaveTime={value:0};
      this.waveTime=shader.uniforms.uWaveTime as {value:number};
      shader.vertexShader=`uniform float uWaveTime;\n`+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.y += sin(position.x*0.08+uWaveTime*1.2)*0.12+sin(position.z*0.06-uWaveTime*0.9)*0.1;`);
    };
    this.material.customProgramCacheKey=()=>'native-water-display-modulation-v2';
  }
  load(text:string,name:string){
    if(this.disposed)throw new Error('Water owner is disposed.');
    const water=readWater(text),next:typeof this.meshes=[];
    try{
      for(const interior of [false,true]){
        const polygons=visibleWaterPolygons(water.polygons,interior),data=waterGeometry(polygons),geometry=new THREE.BufferGeometry();
        const mesh=new THREE.Mesh(geometry,this.material);next.push(mesh);
        geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
        const uv=new Float32Array(data.positions.length/3*2);for(let i=0;i<data.positions.length/3;i++){uv[i*2]=data.positions[i*3]/25;uv[i*2+1]=-data.positions[i*3+2]/25;}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
        mesh.name=interior?'Imported interior water':'Imported exterior water';mesh.visible=false;mesh.userData.polygons=polygons.length;
      }
    }catch(error){for(const mesh of next)mesh.geometry.dispose();throw error;}
    this.clear();this.meshes=next;this.name=name;this.counts=next.map(m=>m.userData.polygons);this.levels=new WaterLevelIndex(water.polygons);this.scene.add(...next);
  }
  update(area:number,source:ImportedLighting['water'],texture?:THREE.Texture,seconds=0){
    if(this.material.map!==(texture??null)){this.material.map=texture??null;this.material.needsUpdate=true;}
    if(this.waveTime)this.waveTime.value=seconds;
    for(const [i,mesh]of this.meshes.entries())mesh.visible=!!source&&source.opacity>0&&i===(area===0?0:1)&&mesh.userData.polygons>0;
    if(source){this.material.color.setRGB(...source.color);this.material.opacity=source.opacity;}
  }
  clear(){for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();}this.meshes=[];this.name='';this.counts=[0,0];this.levels=undefined;}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.material.dispose();}
}
