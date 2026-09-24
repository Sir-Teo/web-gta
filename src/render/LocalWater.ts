import * as THREE from 'three';
import {readWater,visibleWaterPolygons,waterGeometry} from '../assets/water';
import type {ImportedLighting} from '../world/LocalTimecycle';
import {WaterLevelIndex} from '../world/waterLevel';
import {DETAILED_WATER_DIST,DetailedWaterBuilder,WAVE_MULTIPLIERS_X,WAVE_MULTIPLIERS_Y,waterCameraRange,waterSurface,waterWavePhases,type WaterCameraRange,type WaterSurface} from '../world/waterWaves';
/** Native water surfaces with timecycle color; gameplay heights come from WATER.DAT (no waves).
 * CWaterLevel::RenderWater's split (see waterWaves.ts): polygons render flat outside the camera range (SetCameraRange,
 * ±48 units) and, inside it, as a 2-unit grid displaced by CalculateWavesOnlyForCoordinate in the vertex shader.
 * The flat meshes discard their fragments inside the range, which the detailed mesh covers instead. */
export class LocalWater {
  private meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]=[];
  private uniforms={uDetailRange:{value:new THREE.Vector4(1,1,0,0)},uWavePhase:{value:new THREE.Vector3()},uWavyness:{value:0},uWaveMultX:{value:[...WAVE_MULTIPLIERS_X]},uWaveMultY:{value:[...WAVE_MULTIPLIERS_Y]}};
  private material=this.waterMaterial(false);
  private detailMaterial=this.waterMaterial(true);
  private detail=new THREE.Mesh(new THREE.BufferGeometry(),this.detailMaterial);
  private builder=new DetailedWaterBuilder();
  private surfaces:WaterSurface[][]=[[],[]];
  private range:WaterCameraRange={minX:0,maxX:0,minY:0,maxY:0};private built?:WaterCameraRange&{area:number};private phases=[0,0,0];private timeMs=0;
  private disposed=false;
  name='';counts=[0,0];
  /** CWaterLevel::m_nWaterTimeOffset, set by syncWater. */
  waterTimeOffset=0;
  /** CWeather::Wavyness, fed from the weather each frame. */
  wavyness=0;
  /** Native water heights for gameplay queries (all polygons, including invisible surfaces). */
  levels?:WaterLevelIndex;
  constructor(private scene:THREE.Scene){this.detail.name='Imported detailed water';this.detail.frustumCulled=false;this.detail.visible=false;}
  private waterMaterial(detail:boolean){
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false}),u=this.uniforms;
    // Native rasters carry display-space bytes. Modulate there, then return to
    // linear space for Three's fog/output stages; never mutate a borrowed texture.
    material.onBeforeCompile=shader=>{
      const map=THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`
        vec3 displayWater = sRGBTransferOETF(vec4(diffuseColor.rgb,1.0)).rgb;
        diffuseColor.rgb = sRGBTransferEOTF(vec4(displayWater * sampledDiffuseColor.rgb,1.0)).rgb;
        diffuseColor.a *= sampledDiffuseColor.a;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',map);
      if(!detail){
        // RenderFlatWater*: everything outside the camera range; native (x,y) = (x,-z).
        Object.assign(shader.uniforms,{uDetailRange:u.uDetailRange});
        shader.vertexShader=`varying vec2 vWaterXY;\n`+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vWaterXY = vec2(position.x,-position.z);`);
        shader.fragmentShader=`uniform vec4 uDetailRange;\nvarying vec2 vWaterXY;\n`+shader.fragmentShader.replace('void main() {',`void main() {
        if(vWaterXY.x>uDetailRange.x&&vWaterXY.x<uDetailRange.z&&vWaterXY.y>uDetailRange.y&&vWaterXY.y<uDetailRange.w)discard;`);
        return;
      }
      // CalculateWavesOnlyForCoordinate over the integer |x|,|y|; spatial phases reduced by each wave's period.
      Object.assign(shader.uniforms,{uWavePhase:u.uWavePhase,uWavyness:u.uWavyness,uWaveMultX:u.uWaveMultX,uWaveMultY:u.uWaveMultY});
      shader.vertexShader=`attribute vec2 aWaves;\nuniform vec3 uWavePhase;\nuniform float uWavyness;\nuniform float uWaveMultX[8];\nuniform float uWaveMultY[8];\n`+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec2 waveXY = abs(trunc(vec2(position.x,-position.z)));
      float waveMult = uWaveMultX[int(mod(floor(waveXY.x*0.5),8.0))]*uWaveMultY[int(mod(floor(waveXY.y*0.5),8.0))]*uWavyness;
      transformed.y += waveMult*(sin(uWavePhase.x+6.28318531*(mod(waveXY.x,64.0)/64.0+mod(waveXY.y,64.0)/64.0))*2.0*aWaves.x
        +sin(uWavePhase.y+6.28318531*(mod(waveXY.x,26.0)/26.0+mod(waveXY.y,52.0)/52.0))*aWaves.y
        +sin(uWavePhase.z+6.28318531*mod(waveXY.y,20.0)/20.0)*0.5*aWaves.y);`);
    };
    material.customProgramCacheKey=()=>detail?'native-water-detailed-waves-v1':'native-water-flat-v3';
    return material;
  }
  load(text:string,name:string){
    if(this.disposed)throw new Error('Water owner is disposed.');
    const water=readWater(text),next:typeof this.meshes=[],surfaces:WaterSurface[][]=[];
    try{
      for(const interior of [false,true]){
        const polygons=visibleWaterPolygons(water.polygons,interior),data=waterGeometry(polygons),geometry=new THREE.BufferGeometry();
        const mesh=new THREE.Mesh(geometry,this.material);next.push(mesh);surfaces.push(polygons.map(waterSurface).filter(s=>!!s));
        geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
        const uv=new Float32Array(data.positions.length/3*2);for(let i=0;i<data.positions.length/3;i++){uv[i*2]=data.positions[i*3]/25;uv[i*2+1]=-data.positions[i*3+2]/25;}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
        mesh.name=interior?'Imported interior water':'Imported exterior water';mesh.visible=false;mesh.userData.polygons=polygons.length;
      }
    }catch(error){for(const mesh of next)mesh.geometry.dispose();throw error;}
    this.clear();this.meshes=next;this.surfaces=surfaces;this.name=name;this.counts=next.map(m=>m.userData.polygons);this.levels=new WaterLevelIndex(water.polygons);this.scene.add(...next);
  }
  /** `timeMs` is CTimer::GetTimeInMS; `camera` is the browser-space camera position (native x = x, y = -z). */
  update(area:number,source:ImportedLighting['water'],texture?:THREE.Texture,timeMs=0,camera?:{x:number;z:number}){
    if(this.material.map!==(texture??null)){for(const material of [this.material,this.detailMaterial]){material.map=texture??null;material.needsUpdate=true;}}
    this.timeMs=timeMs;if(this.levels)Object.assign(this.levels.waves,{timeMs,waterTimeOffset:this.waterTimeOffset,wavyness:this.wavyness});const phases=waterWavePhases(timeMs,this.waterTimeOffset,this.phases);this.uniforms.uWavePhase.value.set(phases[0],phases[1],phases[2]);this.uniforms.uWavyness.value=this.wavyness;
    for(const [i,mesh]of this.meshes.entries())mesh.visible=!!source&&source.opacity>0&&i===(area===0?0:1)&&mesh.userData.polygons>0;
    if(source)for(const material of [this.material,this.detailMaterial]){material.color.setRGB(...source.color);material.opacity=source.opacity;}
    // Rebuilt only when SetCameraRange's even-rounded box moves (every 2 units of camera travel) or the area changes.
    const active=area===0?0:1,parent=this.meshes[active],on=!!camera&&!!parent?.visible,r=this.range,b=this.built;
    if(on)waterCameraRange(camera.x,-camera.z,DETAILED_WATER_DIST,r);
    if(on?!b||b.area!==active||b.minX!==r.minX||b.maxX!==r.maxX||b.minY!==r.minY||b.maxY!==r.maxY:!!b){
      if(on){this.built={area:active,...r};this.builder.build(this.surfaces[active],r);this.uploadDetail();if(this.detail.parent!==parent)parent.add(this.detail);this.uniforms.uDetailRange.value.set(r.minX,r.minY,r.maxX,r.maxY);}
      else{this.built=undefined;this.uniforms.uDetailRange.value.set(1,1,0,0);}
    }
    this.detail.visible=on&&this.builder.indexCount>0;
  }
  /** CWaterLevel::SyncWater (SYNC_WATER): restart the wave cycle at the current time. */
  syncWater(){this.waterTimeOffset=this.timeMs;}
  private uploadDetail(){
    const b=this.builder;let geometry=this.detail.geometry;
    if(b.grown||!geometry.index){
      geometry.dispose();geometry=this.detail.geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(b.positions,3));geometry.setAttribute('aWaves',new THREE.BufferAttribute(b.waves,2));geometry.setAttribute('uv',new THREE.BufferAttribute(b.uvs,2));geometry.setIndex(new THREE.BufferAttribute(b.indices,1));
    }else{
      for(const name of ['position','aWaves','uv']){const attribute=geometry.getAttribute(name) as THREE.BufferAttribute;attribute.clearUpdateRanges();attribute.addUpdateRange(0,b.vertexCount*attribute.itemSize);attribute.needsUpdate=true;}
      const index=geometry.index;index.clearUpdateRanges();index.addUpdateRange(0,b.indexCount);index.needsUpdate=true;
    }
    geometry.setDrawRange(0,b.indexCount);
  }
  clear(){this.detail.removeFromParent();this.detail.visible=false;this.built=undefined;this.uniforms.uDetailRange.value.set(1,1,0,0);this.surfaces=[[],[]];for(const mesh of this.meshes){mesh.removeFromParent();mesh.geometry.dispose();}this.meshes=[];this.name='';this.counts=[0,0];this.levels=undefined;}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.material.dispose();this.detail.geometry.dispose();this.detailMaterial.dispose();}
}
