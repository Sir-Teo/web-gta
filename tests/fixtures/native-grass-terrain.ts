import {Scene,PerspectiveCamera,WebGLRenderer,Frustum,Matrix4,Sphere,Vector3} from 'three';
import {planWorldFolder} from '../../src/assets/worldFolder';
import {readScene} from '../../src/assets/scene';
import {placedModelObjects} from '../../src/assets/ModelObjects';
import {readNativeVegetationFolder} from '../../src/assets/nativeVegetationFolder';
import {nativeScenePlantEntities} from '../../src/world/nativeScenePlants';
import {NativeVegetationScene} from '../../src/world/NativeVegetationScene';
import {sceneVisibility} from '../../src/render/sceneVisibility';

(window as any).grassTerrainProbe=async()=>{
 const files=[...(document.querySelector<HTMLInputElement>('#files')!.files??[])];
 const folder=files.map(file=>({path:file.webkitRelativePath,file}));
 const request=await planWorldFolder(folder,'chiliad-east'),loaded=await readScene(request);
 if(!request.environment.vegetation)throw Error('Missing vegetation handoff.');
 const {grass:assets,surfaces:plants,surfaceInfo:info,objects}=await readNativeVegetationFolder(request.environment.vegetation);
 const entities=nativeScenePlantEntities(loaded.scene,info,objects,0);
 // Explicit test samples and scene insertion order; neither claims retail parity.
 const vegetation=new NativeVegetationScene(entities,assets,plants,info,{randomSample:()=>.5,addObjects:()=>false,removeObjects:()=>{}},(_tri,_cover,index)=>[((index*17)%41)/41,((index*11)%43)/43,.5,.5,.5]);
 vegetation.simulate([-1750,-1450,35]);const initial={entities:vegetation.entityCount,cached:vegetation.cachedEntityCount,triangles:vegetation.allocations().length};
 const target=vegetation.allocations().filter(t=>t.candidate.createsPlants).sort((a,b)=>new Vector3(...a.candidate.triangle.center).distanceToSquared(new Vector3(-1750,-1450,35))-new Vector3(...b.candidate.triangle.center).distanceToSquared(new Vector3(-1750,-1450,35)))[0].candidate.triangle.center;
 const position=[target[0],target[1]-8,target[2]+5] as const;
 vegetation.simulate(position);
 const scene=new Scene(),visuals=loaded.scene.map(part=>placedModelObjects(part.model,part.textures,part.placements));
 for(const visual of visuals){scene.add(visual.root);visual.setNight(0);}scene.add(vegetation.root);
 const camera=new PerspectiveCamera(50,1.5,.1,1500);camera.position.set(position[0],position[2],-position[1]);camera.lookAt(target[0],target[2],-target[1]);camera.updateMatrixWorld();
 const terrainVisibility=sceneVisibility(loaded.scene,visuals.map(visual=>visual.root));terrainVisibility.update(camera);
 const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const renderer=new WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(900,600);renderer.setClearColor(0x809baa);document.body.append(renderer.domElement);
 const frame={camera:position,night:0,wind:0,quality:'high' as const,visible:(tri:any)=>{const [x,y,z]=tri.candidate.triangle.center;return frustum.intersectsSphere(new Sphere(new Vector3(x,z,-y),tri.candidate.triangle.radius));}};
 const capture=(quality:'high'|'low')=>{
  vegetation.render({...frame,quality});renderer.render(scene,camera);const pixels=new Uint8Array(900*600*4),gl=renderer.getContext();gl.readPixels(0,0,900,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
 };
 const bare=capture('low'),grass=capture('high'),repeat=capture('high');
 const changed=(a:Uint8Array,b:Uint8Array)=>a.reduce((sum,value,i)=>sum+(i%4!==3&&value!==b[i]?1:0),0);
 const result={initial,grassChanges:changed(bare,grass),repeatChanges:changed(grass,repeat),batches:vegetation.root.children.length,triangles:vegetation.allocations().length};
 (window as any).disposeGrassTerrainProbe=()=>{vegetation.dispose();terrainVisibility.dispose();for(const visual of visuals)visual.dispose();renderer.dispose();return {entities:vegetation.entityCount,cached:vegetation.cachedEntityCount,triangles:vegetation.allocations().length,children:vegetation.root.children.length};};return result;
};
