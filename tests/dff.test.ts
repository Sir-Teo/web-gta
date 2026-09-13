import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { readDff } from '../src/assets/dff';
import { modelObject } from '../src/assets/ModelPreview';
const fixture = (name = 'dragonff-model.dff') => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
function section(data: Uint8Array, type: number, start = 0, end = data.length): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let at = start; at + 12 <= end;) {
    const id = view.getUint32(at, true), next = at + 12 + view.getUint32(at + 4, true);
    if (id === type) return at;
    if ([0x10, 0xe, 0x1a, 0xf, 3, 7, 8, 0x14].includes(id)) { const found = section(data, type, at + 12, next); if (found >= 0) return found; }
    at = next;
  }
  return -1;
}
test('independent DFF preserves triangle winding, hierarchy, UVs, materials and night colors', () => {
  const model = readDff(fixture()), g = model.geometries[0];
  expect(model.frames.map(f => f.name)).toEqual(['diagnostic_root', 'rotated_pyramid']);
  expect([...g.normals!.slice(0, 3)]).toEqual([0, 0, 1]);
  expect(model.frames[1].parent).toBe(0); expect([...g.indices.slice(0, 3)]).toEqual([0, 1, 4]);
  expect([...g.uvs[0].slice(-2)]).toEqual([0.5, 0.5]); expect([...g.nightColors!.slice(0, 4)]).toEqual([30, 45, 95, 255]);
  expect(g.materials[0].texture).toBe('calibration_grid'); expect(g.materials[0].addressU).toBe(1);
  expect(g.materials[1].color).toEqual([255, 140, 60, 255]); expect([...g.materialIds]).toEqual([0, 0, 0, 0, 1, 1]);
});
test('a single basis transform preserves world positions, scale, winding and color interpolation', () => {
  const model = readDff(fixture()), visual = modelObject(model);
  try {
    const center = new THREE.Box3().setFromObject(visual.root).getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(4); expect(center.y).toBeCloseTo(8.5); expect(center.z).toBeCloseTo(-4);
    const frame = visual.root.getObjectByName('rotated_pyramid')!;
    const top = frame.localToWorld(new THREE.Vector3(0, 0, 3));
    expect(top.x).toBeCloseTo(4); expect(top.y).toBeCloseTo(10); expect(top.z).toBeCloseTo(-4);
    expect(frame.matrixWorld.determinant()).toBeCloseTo(1);
    const mesh = frame.children[0] as THREE.Mesh<THREE.BufferGeometry>;
    expect(mesh.geometry.groups.map(g => [g.count, g.materialIndex])).toEqual([[12, 0], [6, 1]]);
    visual.setNight(0.5); expect(mesh.geometry.getAttribute('color').getX(0)).toBeCloseTo(105 / 255);
    visual.setNight(1); expect(mesh.geometry.getAttribute('color').getZ(4)).toBeCloseTo(95 / 255);
  } finally { visual.dispose(); }
});
test('independently exported triangle strips retain all faces and outward orientation', () => {
  const a = readDff(fixture()).geometries[0], b = readDff(fixture('dragonff-model-strips.dff')).geometries[0];
  const faces = (indices: Uint32Array) => {
    const out: string[] = [];
    for (let i = 0; i < indices.length; i += 3) { const v = [...indices.slice(i, i + 3)]; while (v[0] !== Math.min(...v)) v.push(v.shift()!); out.push(v.join(',')); }
    return out.sort();
  };
  expect(faces(b.indices)).toEqual(faces(a.indices));
});
test('model reader rejects truncation, invalid indices, cyclic frames, native data and malformed skin payloads', () => {
  const bytes = fixture();
  for (const length of [0, 11, 50, bytes.length - 1]) expect(() => readDff(bytes.slice(0, length))).toThrow();
  for (const mutate of [
    (b: Uint8Array, v: DataView) => v.setInt32(section(b, 0xe) + 12 + 12 + 4 + 48, 1, true),
    (b: Uint8Array, v: DataView) => v.setUint32(section(b, 0xf) + 24, 0x01000000, true),
    (b: Uint8Array, v: DataView) => v.setUint16(section(b, 0xf) + 24 + 16 + 20 + 40, 65000, true),
    (b: Uint8Array, v: DataView) => v.setUint32(section(b, 0x50e), 0x116, true),
    (b: Uint8Array, v: DataView) => v.setFloat32(section(b, 0xe) + 28, NaN, true),
  ]) { const b = bytes.slice(); mutate(b, new DataView(b.buffer)); expect(() => readDff(b)).toThrow(); }
});


test('preview refuses extreme composed world bounds before drawing', () => {
  const model = readDff(fixture()); model.frames[0].matrix[12] = 1e20;
  expect(() => modelObject(model)).toThrow('coordinate limit');
});

test('atomic Pipeline Set identifiers survive decoding and object creation without claiming custom shading', async () => {
  const { atomicPipelineFixture } = await import('./fixtures/native-assets');
  const payload = new Uint8Array(4); new DataView(payload.buffer).setUint32(0,0x53f20098,true);
  const model = readDff(atomicPipelineFixture(fixture(),[payload]));
  expect(model.atomics.every(a=>a.pipeline===0x53f20098)).toBe(true);
  expect(model.warnings).toContain('Atomic pipeline 0x53f20098 is retained; inspection uses fallback materials; playable building support is partial.');
  const visual=modelObject(model);const ids:number[]=[];visual.root.traverse(o=>{if(o instanceof THREE.Mesh)ids.push(o.userData.nativePipeline);});
  expect(ids.length).toBeGreaterThan(0);expect(ids.every(id=>id===0x53f20098)).toBe(true);visual.dispose();
  expect(readDff(fixture()).atomics.every(a=>a.pipeline===undefined)).toBe(true);
});
test('atomic pipelines reject truncated, oversized and repeated identifiers', async () => {
  const { atomicPipelineFixture } = await import('./fixtures/native-assets');
  for(const size of [0,3,5,8])expect(()=>readDff(atomicPipelineFixture(fixture(),[new Uint8Array(size)]))).toThrow('one identifier');
  expect(()=>readDff(atomicPipelineFixture(fixture(),[new Uint8Array(4),new Uint8Array(4)]))).toThrow('Repeated atomic pipeline');
});

test('explicit static building atomics opt into a separate material while sharing immutable geometry', async () => {
  const { buildingLightingState } = await import('../src/assets/buildingMaterial');
  const model=readDff(fixture('walk-floor-building.dff'));
  model.atomics.push({...model.atomics[0],pipeline:undefined});
  const original=model.geometries[0].colors?.slice(), state=buildingLightingState();
  const visual=modelObject(model,[],undefined,undefined,{buildingLighting:state});const meshes:THREE.Mesh[]=[];visual.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  expect(meshes).toHaveLength(2);expect(meshes[0].geometry).toBe(meshes[1].geometry);expect(meshes[0].material).not.toBe(meshes[1].material);
  const material=(meshes[0].material as THREE.Material[])[0];expect(material.customProgramCacheKey()).toContain('native-building-base');
  let disposed=0;material.addEventListener('dispose',()=>disposed++);visual.setNight(1);expect(model.geometries[0].colors).toEqual(original);visual.dispose();visual.dispose();expect(disposed).toBe(1);
  const preview=modelObject(model);const previewMeshes:THREE.Mesh[]=[];preview.root.traverse(o=>{if(o instanceof THREE.Mesh)previewMeshes.push(o);});
  expect((previewMeshes[0].material as THREE.Material[])[0].customProgramCacheKey()).not.toContain('native-building-base');preview.dispose();
});

test('single-color building pipeline ignores unused extra-color alpha for its render policy', async () => {
  const { buildingLightingState, BUILDING_PIPELINE } = await import('../src/assets/buildingMaterial');
  const model=readDff(fixture('walk-floor-building.dff')),g=model.geometries[0];
  g.colors=new Uint8Array(g.positions.length/3*4).fill(255);g.nightColors=new Uint8Array(g.colors.length).fill(64);
  model.atomics.push({...model.atomics[0],pipeline:BUILDING_PIPELINE});
  const visual=modelObject(model,[],undefined,undefined,{buildingLighting:buildingLightingState()});const meshes:THREE.Mesh[]=[];visual.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  const dn=(meshes[0].material as THREE.Material[])[0],single=(meshes[1].material as THREE.Material[])[0];
  expect(dn.transparent).toBe(true);expect(single.transparent).toBe(false);expect(single.depthWrite).toBe(true);visual.dispose();
});

test('building material alpha is isolated to each material vertex span', async () => {
  const { buildingLightingState } = await import('../src/assets/buildingMaterial');
  const model=readDff(fixture('walk-floor-building.dff')),g=model.geometries[0];
  g.positions=new Float32Array([0,0,0, 1,0,0, 0,1,0, 2,0,0, 3,0,0, 2,1,0]);
  g.meshes=undefined;g.normals=undefined;g.uvs=[];g.indices=new Uint32Array([0,1,2,3,4,5]);g.materialIds=new Uint16Array([0,1]);
  g.materials=[g.materials[0],structuredClone(g.materials[0]),structuredClone(g.materials[0])];
  g.materials.forEach(m=>{m.texture='';m.color[3]=255;});
  g.colors=new Uint8Array(24).fill(255);g.nightColors=new Uint8Array(24).fill(255);g.nightColors[3]=64;
  const visual=modelObject(model,[],undefined,undefined,{buildingLighting:buildingLightingState()});let mesh:THREE.Mesh|undefined;
  visual.root.traverse(o=>{if(o instanceof THREE.Mesh)mesh=o;});
  const materials=mesh!.material as THREE.Material[];
  expect(materials.map(m=>m.transparent)).toEqual([true,false,false]);
  expect(materials.map(m=>m.depthWrite)).toEqual([false,true,true]);
  visual.dispose();
});

test('Bin Mesh partitions override face order and preserve separate draws sharing a material', async()=>{
  const {geometryPluginFixture,binMeshPayload}=await import('./fixtures/native-assets');
  const {buildingLightingState,BUILDING_DN_PIPELINE}=await import('../src/assets/buildingMaterial');
  const groups=[{material:0,indices:[0,1,2]},{material:1,indices:[0,2,3]},{material:0,indices:[2,3,4]}];
  const model=readDff(geometryPluginFixture(fixture(),0x50e,[binMeshPayload(groups)])),g=model.geometries[0];
  expect([...g.indices]).toEqual(groups.flatMap(g=>g.indices));
  expect(g.meshes).toEqual([{start:0,count:3,material:0,min:0,max:2},{start:3,count:3,material:1,min:0,max:3},{start:6,count:3,material:0,min:2,max:4}]);
  model.atomics.forEach(a=>a.pipeline=BUILDING_DN_PIPELINE);g.colors=new Uint8Array(20).fill(255);g.nightColors=g.colors.slice();g.nightColors[3]=64;
  const visual=modelObject(model,[],undefined,undefined,{buildingLighting:buildingLightingState()});let mesh:THREE.Mesh|undefined;visual.root.traverse(o=>{if(o instanceof THREE.Mesh)mesh=o;});
  expect(mesh!.geometry.groups.map(g=>[g.start,g.count,g.materialIndex])).toEqual([[0,3,0],[3,3,1],[6,3,2]]);
  const materials=mesh!.material as THREE.Material[];expect(materials[0]).not.toBe(materials[2]);expect(materials.map(m=>m.transparent)).toEqual([true,true,false]);
  const disposed=new Set<THREE.Material>();materials.forEach(m=>m.addEventListener('dispose',()=>disposed.add(m)));visual.dispose();expect(disposed.size).toBe(3);
});

test('Bin Mesh strip spans retain connector vertices and reject malformed or repeated plugins',async()=>{
  const {geometryPluginFixture,binMeshPayload,concat}=await import('./fixtures/native-assets');
  const payload=binMeshPayload([{material:0,indices:[4,4,0,0,1,2]},{material:0,indices:[]}],true);
  const g=readDff(geometryPluginFixture(fixture(),0x50e,[payload])).geometries[0];
  expect([...g.indices]).toEqual([1,0,2]);expect(g.meshes).toEqual([{start:0,count:3,material:0,min:0,max:4},{start:3,count:0,material:0,min:Infinity,max:-1}]);
  for(const payloads of [[payload,payload],[concat(payload,new Uint8Array(4))],[binMeshPayload([{material:0,indices:[99,99,99]}],true)],[binMeshPayload([{material:0,indices:[0,1]}])]])expect(()=>readDff(geometryPluginFixture(fixture(),0x50e,payloads))).toThrow();
});

test('GPU-only building geometry avoids mutable float palettes while mixed and preview paths keep them',async()=>{
  const {buildingLightingState}=await import('../src/assets/buildingMaterial');
  const model=readDff(fixture('walk-floor-building.dff')),g=model.geometries[0];
  g.colors=new Uint8Array(g.positions.length/3*4).fill(64);g.nightColors=new Uint8Array(g.colors.length).fill(192);
  const meshes=(root:THREE.Object3D)=>{const out:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)out.push(o);});return out;};
  const gpu=modelObject(model,[],undefined,undefined,{buildingLighting:buildingLightingState()}),mesh=meshes(gpu.root)[0];
  expect(mesh.geometry.hasAttribute('color')).toBe(false);expect((mesh.material as THREE.MeshBasicMaterial[])[0].vertexColors).toBe(false);
  const day=mesh.geometry.getAttribute('nativeDay') as THREE.BufferAttribute,night=mesh.geometry.getAttribute('nativeNight') as THREE.BufferAttribute;
  expect(day.array).toBe(g.colors);expect(night.array).toBe(g.nightColors);
  for(let i=0;i<=60;i++)gpu.setNight(i/60);
  expect(day.version).toBe(0);expect(night.version).toBe(0);expect(g.colors[0]).toBe(64);gpu.dispose();
  model.atomics.push({...model.atomics[0],pipeline:undefined});
  const mixed=modelObject(model,[],undefined,undefined,{buildingLighting:buildingLightingState()}),both=meshes(mixed.root);
  expect(both[0].geometry).toBe(both[1].geometry);mixed.setNight(.5);
  expect(both[1].geometry.getAttribute('color').getX(0)).toBeCloseTo(128/255);
  expect((both[1].material as THREE.MeshBasicMaterial[])[0].vertexColors).toBe(true);mixed.dispose();
  const preview=modelObject(model);preview.setNight(1);expect(meshes(preview.root)[0].geometry.getAttribute('color').getX(0)).toBeCloseTo(192/255);preview.dispose();
});

test('clump light and camera frame structs are distinct from the clump header', async () => {
  const {chunk,concat}=await import('./fixtures/native-assets');
  const source=fixture(), rootSize=new DataView(source.buffer,source.byteOffset,source.byteLength).getUint32(4,true);
  const body=source.slice(12,12+rootSize);const headerSize=new DataView(body.buffer).getUint32(4,true);
  const header=new Uint8Array(12), hv=new DataView(header.buffer);hv.setUint32(0,1,true);hv.setUint32(4,1,true);hv.setUint32(8,1,true);
  const frame=new Uint8Array(4);new DataView(frame.buffer).setUint32(0,1,true);
  const object=chunk(1,new Uint8Array(16));
  const build=(h=header,f=frame)=>chunk(0x10,concat(chunk(1,h),body.slice(12+headerSize),chunk(1,f),chunk(0x12,object),chunk(1,f),chunk(5,object)));
  const parsed=readDff(build());
  expect(parsed.attachments?.map(a=>[a.kind,a.frame])).toEqual([['light',1],['camera',1]]);
  expect(parsed.geometries[0].positions).toEqual(readDff(source).geometries[0].positions);
  expect(parsed.warnings).toContain('Embedded lights and cameras are not previewed.');
  const badFrame=new Uint8Array(4);new DataView(badFrame.buffer).setUint32(0,100,true);
  expect(()=>readDff(build(header,badFrame))).toThrow('Invalid clump attachment frame.');
  const badCount=header.slice();new DataView(badCount.buffer).setUint32(4,0,true);
  expect(()=>readDff(build(badCount))).toThrow('Clump attachment count mismatch');
  expect(()=>readDff(chunk(0x10,concat(body,chunk(1,frame))))).toThrow('Invalid clump attachment frame section');
});
