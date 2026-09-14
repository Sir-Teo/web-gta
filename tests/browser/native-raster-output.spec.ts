import {test,expect} from '@playwright/test';
test('native modulation reaches the game framebuffer as original byte RGB with fog and alpha intact',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/nativeMaterial.ts','/src/assets/nativeTexture.ts','/src/assets/buildingMaterial.ts','/src/assets/nativeRasterOutput.ts','/src/render/nativeGrassMaterial.ts'];
  const [{THREE:T},{nativeLitMaterial,nativeAmbientState},{nativeTexture},{buildingMaterial,buildingLightingState},{nativeRasterOutput},{nativeGrassMaterial}]=await Promise.all(paths.map(p=>import(p)));
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true,alpha:true});renderer.setSize(32,32);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;renderer.setClearColor(0,0);
  const errors:string[]=[];renderer.debug.onShaderError=()=>errors.push('shader compile');
  const camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;const scene=new T.Scene();
  const texture=nativeTexture({name:'byte-probe',filter:1,addressU:1,addressV:1,hasAlpha:false,mips:[{width:1,height:1,data:new Uint8Array([200,160,120,255])}]});
  const ambient=nativeAmbientState();ambient.enabled.value=true;ambient.color.value.setScalar(.5);
  const parameters={map:texture,color:new T.Color().setRGB(64/255,96/255,128/255),opacity:.5};
  const material=nativeLitMaterial(parameters,[1,0,0],ambient),geometry=new T.PlaneGeometry(2,2);const mesh=new T.Mesh(geometry,material);scene.add(mesh);
  const capture=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),p=new Uint8Array(4);gl.readPixels(16,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];};
  const lit=capture();material.transparent=true;material.needsUpdate=true;renderer.setClearColor(new T.Color().setRGB(20/255,40/255,60/255,T.SRGBColorSpace),1);const blended=capture();material.transparent=false;material.needsUpdate=true;
  scene.fog=new T.Fog(new T.Color().setRGB(80/255,100/255,140/255,T.SRGBColorSpace),0,4);const fogged=capture();scene.fog=null;
  const basic=new T.MeshBasicMaterial(parameters),state=buildingLightingState();state.ambient.value.setScalar(0);
  const count=geometry.getAttribute('position').count;geometry.setAttribute('nativeDay',new T.Float32BufferAttribute(Array.from({length:count},()=>[.5,.5,.5,1]).flat(),4));geometry.setAttribute('nativeNight',new T.Float32BufferAttribute(Array.from({length:count},()=>[.5,.5,.5,1]).flat(),4));
  const building=buildingMaterial(basic,1,state,false,false);building.transparent=false;mesh.material=building;const built=capture();
  const unlitMaterial=nativeRasterOutput(new T.MeshBasicMaterial(parameters));mesh.material=unlitMaterial;const unlit=capture();
  const grassMaterial=nativeGrassMaterial(texture);mesh.material=grassMaterial;const grass=capture();
  unlitMaterial.dispose();grassMaterial.dispose();geometry.dispose();material.dispose();building.dispose();basic.dispose();texture.dispose();renderer.dispose();return {lit,blended,fogged,built,unlit,grass,errors};
 });
 const rgb=[64*200/255*.5,96*160/255*.5,128*120/255*.5];
 for(let i=0;i<3;i++){expect(result.lit[i]).toBeCloseTo(Math.round(rgb[i]),0);expect(result.built[i]).toBeCloseTo(Math.round(rgb[i]),0);expect(result.blended[i]).toBeCloseTo(Math.round(rgb[i]*.5+[20,40,60][i]*.5),0);expect(result.fogged[i]).toBeCloseTo(Math.round((rgb[i]+[80,100,140][i])*.5),0);}
 for(let i=0;i<3;i++){expect(result.unlit[i]).toBeCloseTo(Math.round(rgb[i]*2),0);expect(result.grass[i]).toBe([200,160,120][i]);}
 expect(result.errors).toEqual([]);
});
