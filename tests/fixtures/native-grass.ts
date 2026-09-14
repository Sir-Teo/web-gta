import {Scene,PerspectiveCamera,WebGLRenderer} from 'three';
import {readNativeGrassAssets} from '../../src/assets/nativeGrassAssets';
import {readPlants} from '../../src/assets/vegetation';
import {initializeNativePlants,nativePlantCounts} from '../../src/world/nativeVegetation';
import {nativePlantTriangle} from '../../src/world/nativePlantTriangle';
import {NativePlantPool} from '../../src/world/NativePlantPool';
import {NativeGrassPass} from '../../src/render/NativeGrassPass';

(window as any).grassProbe=(input:Record<string,number[]>)=>{
 const assets=readNativeGrassAssets(new Map(Object.entries(input).map(([name,bytes])=>[name,new Uint8Array(bytes)])));
 const surfaces=initializeNativePlants(readPlants('GRASS_SHORT_LUSH 0 0 0 0 220 210 165 255 0 255 1 1 0 0 1 0 2'));
 const [surface,settings]=surfaces.entries().next().value!;
 const triangle=nativePlantTriangle([-3,-3,0],[3,-3,0],[0,3,0]);
 const pool=new NativePlantPool({randomSample:()=>.5,addObjects:()=>false,removeObjects:()=>{}});
 pool.updateEntity('terrain',[5,-7,4],[{index:0,surface,lighting:0xff,triangle,counts:nativePlantCounts(triangle.area,settings),createsPlants:true,createsObjects:false,slot:0}]);
 let sampled=0;
 const pass=new NativeGrassPass(assets,surfaces,(_tri,_cover,index)=>{sampled++;return [((index*17)%41)/41,((index*11)%43)/43,.5,.5,.5];});
 const scene=new Scene();scene.add(pass.root);
 const camera=new PerspectiveCamera(45,1,0.1,100);camera.position.set(5,4,7);camera.lookAt(0,.5,0);
 const renderer=new WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setClearColor(0);document.body.append(renderer.domElement);
 const frame={camera:[5,-7,4] as const,night:0,wind:0,quality:'high' as const,visible:()=>true};
 const capture=(wind:number,quality:'high'|'low'='high')=>{
  pass.update(pool.triangles(),{...frame,wind,quality});renderer.render(scene,camera);
  const pixels=new Uint8Array(512*512*4);renderer.getContext().readPixels(0,0,512,512,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);return pixels;
 };
 const first=capture(0),repeat=capture(0),bent=capture(.4),hidden=capture(0,'low');
 const changed=(a:Uint8Array,b:Uint8Array)=>a.reduce((n,v,i)=>n+(i%4!==3&&v!==b[i]?1:0),0);
 const lit=(a:Uint8Array)=>a.reduce((n,v,i)=>n+(i%4!==3&&v>0?1:0),0);
 const result={lit:lit(first),repeatChanges:changed(first,repeat),windChanges:changed(first,bent),hiddenLit:lit(hidden),sampled,drawCount:pool.triangles()[0].candidate.counts!.draw[0]};
 capture(0);(window as any).disposeGrassProbe=()=>{pass.dispose();renderer.dispose();};return result;
};
