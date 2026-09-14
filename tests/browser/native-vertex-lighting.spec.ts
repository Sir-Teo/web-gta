import {test,expect} from '@playwright/test';

test('generic native lighting clamps and shades vertices before triangle interpolation',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/nativeMaterial.ts'];
  const [{THREE},{nativeAmbientState,nativeLitMaterial}]=await Promise.all(paths.map(p=>import(p)));
  const renderer=new THREE.WebGLRenderer();renderer.setSize(128,128);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const failures:string[]=[];renderer.debug.onShaderError=()=>failures.push('shader compilation');
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
  const target=new THREE.WebGLRenderTarget(128,128),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,0,1,0],3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,1,0,0,0,1,0],3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute([1,1,1,0,0,0,0,0,0],3));
  const ambient=nativeAmbientState();ambient.enabled.value=true;ambient.color.value.setScalar(.2);
  let material=nativeLitMaterial({vertexColors:true},[1,0,0],ambient);
  const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  const sun=new THREE.DirectionalLight(0xffffff,1);sun.position.set(0,0,2);scene.add(sun);
  // Compile all scene-light paths, even when their intensity is initially zero.
  const point=new THREE.PointLight(0xffffff,0),spot=new THREE.SpotLight(0xffffff,0),hemi=new THREE.HemisphereLight(0xffffff,0xffffff,0);
  point.position.set(0,0,2);spot.position.set(0,0,2);scene.add(point,spot,hemi);
  const capture=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,64,64,1,1,pixel);return [...pixel];};
  const clamped=capture();
  const normals=geometry.getAttribute('normal');const savedNormals=normals.array.slice();
  normals.array.fill(0);normals.needsUpdate=true;geometry.getAttribute('color').array.fill(0);geometry.getAttribute('color').needsUpdate=true;
  const zeroNormals=capture();normals.array.set(savedNormals);normals.needsUpdate=true;
  geometry.getAttribute('color').array.fill(0);geometry.getAttribute('color').needsUpdate=true;ambient.color.value.setScalar(0);
  material.dispose();material=nativeLitMaterial({vertexColors:true},[1,0,1],ambient);mesh.material=material;
  const directional=capture();
  sun.intensity=0;point.intensity=1;spot.intensity=1;const local=capture();
  mesh.removeFromParent();material.dispose();geometry.dispose();target.dispose();renderer.dispose();
  return {clamped,zeroNormals,directional,local,failures};
 });
 // At this pixel the first vertex's barycentric weight is 0.244140625.
 expect(result.clamped[0]).toBeCloseTo(101,0);
 expect(result.zeroNormals[0]).toBeCloseTo(51,0);
 expect(result.directional[0]).toBeCloseTo(62,0);
 expect(result.local[0]).toBeGreaterThan(0);expect(result.failures).toEqual([]);
});
