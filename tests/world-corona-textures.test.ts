import {expect,test} from 'vitest';
import {Scene,PerspectiveCamera,Texture,type Mesh,type BufferGeometry,type ShaderMaterial} from 'three';
import {NativeCoronas,CORONA_TEXTURE_NAMES} from '../src/world/nativeCoronas';
import {NativeWorldCoronas} from '../src/render/NativeWorldCoronas';

test('corona rendering selects native rasters, combines adjacent star draws and skips empty texture entries',()=>{
 const scene=new Scene(),draw=new NativeWorldCoronas(scene),coronas=new NativeCoronas(),camera=new PerspectiveCamera(70,1,.1,500);camera.updateMatrixWorld(true);
 const textures=new Map(['coronastar','coronamoon','coronareflect','coronaheadlightline','coronaringb'].map(name=>{const t=new Texture();t.name=name;return [name,t] as const;}));
 try{
  for(const [k,type] of [0,1,2,0,3,4,9,5].entries()){coronas.register({id:k+1,color:[0,255,0],intensity:255,position:[0,20,0],size:1,range:150,coronaType:type},[0,0,0]);coronas.coronas[k].faded=255;}
  draw.frame(camera,coronas,textures.get('coronastar'),0,70,type=>textures.get(CORONA_TEXTURE_NAMES[type]));
  expect(draw.drawnTypes).toEqual([0,1,2,0,3,4,9]);expect(draw.drawn).toBe(7);
  const mesh=scene.getObjectByName('Native coronas') as Mesh<BufferGeometry,ShaderMaterial[]>;expect(mesh.geometry.groups.map(g=>[g.start,g.count,g.materialIndex])).toEqual([[0,12,0],[12,6,2],[18,6,0],[24,6,3],[30,6,4],[36,6,9]]);
  for(const type of [0,2,3,4,9])expect(mesh.material[type].uniforms.raster.value).toBe(textures.get(CORONA_TEXTURE_NAMES[type]));
 }finally{draw.dispose();for(const texture of textures.values())texture.dispose();}
});
