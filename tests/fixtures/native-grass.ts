import {Scene,PerspectiveCamera,WebGLRenderer,OrthographicCamera,PlaneGeometry,Mesh,Color,LinearSRGBColorSpace} from 'three';
import {readNativeGrassAssets} from '../../src/assets/nativeGrassAssets';
import {readPlants} from '../../src/assets/vegetation';
import {initializeNativePlants,nativePlantCounts} from '../../src/world/nativeVegetation';
import {nativePlantTriangle} from '../../src/world/nativePlantTriangle';
import {NativePlantPool} from '../../src/world/NativePlantPool';
import {NativeGrassPass} from '../../src/render/NativeGrassPass';
import {nativeTexture} from '../../src/assets/nativeTexture';
import {nativeGrassMaterial} from '../../src/render/nativeGrassMaterial';

(window as any).grassAlphaProbe=(input:Record<string,number[]>)=>{
 const assets=readNativeGrassAssets(new Map(Object.entries(input).map(([name,bytes])=>[name,new Uint8Array(bytes)])));
 const renderer=new WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.outputColorSpace=LinearSRGBColorSpace;
 const background=[64,96,128];renderer.setClearColor(new Color().setRGB(...background.map(v=>v/255) as [number,number,number]));
 const camera=new OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=1;
 const scene=new Scene(),geometry=new PlaneGeometry(2,2),results=[];
 try{for(const source of assets.textures){
  const {width,height,data}=source.mips[0],texture=nativeTexture(source),material=nativeGrassMaterial(texture),mesh=new Mesh(geometry,material);scene.add(mesh);
  let zero=0,partial=0,opaque=0;for(let i=3;i<data.length;i+=4){if(!data[i])zero++;else if(data[i]===255)opaque++;else partial++;}
  for(const layout of [{name:'base',u:0,v:0,repeatU:1,repeatV:1},{name:'native-wrap-range',u:-4,v:-4,repeatU:10,repeatV:6}]){
   const uv=geometry.getAttribute('uv');
   for(let i=0;i<uv.count;i++)uv.setXY(i,layout.u+(i%2)*layout.repeatU,layout.v+(i<2?1:0)*layout.repeatV);
   uv.needsUpdate=true;const renderWidth=width*layout.repeatU,renderHeight=height*layout.repeatV;renderer.setSize(renderWidth,renderHeight);
   for(const alpha of [255,40]){
    material.opacity=alpha/255;renderer.render(scene,camera);const pixels=new Uint8Array(renderWidth*renderHeight*4),gl=renderer.getContext();gl.readPixels(0,0,renderWidth,renderHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let maxError=0,transparentChanges=0;
    for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++){
     // Integer UV offsets and one framebuffer pixel per texel make the repeat
     // oracle independent of the renderer sampler: each source tile must recur.
     const pixel=i/4,sourceIndex=((Math.floor(pixel/renderWidth)%height)*width+(pixel%renderWidth)%width)*4;
     const a=data[sourceIndex+3]/255*alpha/255,expected=Math.round(data[sourceIndex+c]*a+background[c]*(1-a));maxError=Math.max(maxError,Math.abs(pixels[i+c]-expected));
     if(data[sourceIndex+3]===0&&pixels[i+c]!==background[c])transparentChanges++;
    }
    results.push({name:source.name,layout:layout.name,alpha,zero,partial,opaque,maxError,transparentChanges});
   }
  }
  mesh.removeFromParent();material.dispose();texture.dispose();
 }}finally{geometry.dispose();renderer.dispose();}
 return results;
};

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
