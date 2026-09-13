import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {Scene,Skeleton} from 'three';
import {readDff} from '../src/assets/dff';
import {modelObject,placedModelObjects} from '../src/assets/ModelObjects';
import {TexturePool} from '../src/assets/TexturePool';
import {decodeModelTextures} from '../src/assets/modelTextures';
import {readIpl} from '../src/assets/ipl';
import {textureFixture,txdFixture} from './fixtures/native-assets';
const placements=()=>readIpl(new TextEncoder().encode('inst\n1 test 0 0 0 0 0 0 0 1 -1\n1 test 0 10 0 0 0 0 0 1 -1\nend')).instances;
const model=(name='dragonff-model')=>readDff(new Uint8Array(readFileSync(`tests/fixtures/${name}.dff`)));
function brokenPlacements(){
 const rows=placements();Object.defineProperty(rows[1],'rotation',{get(){throw new Error('Interrupted placement transform');}});return rows;
}
test('a later placement failure releases shared raster references without destroying another owner',()=>{
 const data=model(),textures=decodeModelTextures(data,txdFixture(textureFixture())),pool=new TexturePool();
 const existing=modelObject(data,textures,undefined,pool);
 const raster=pool.acquire(textures[0]);pool.release(textures[0]);let disposed=0;raster.addEventListener('dispose',()=>disposed++);
 expect(()=>placedModelObjects(data,textures,brokenPlacements(),pool)).toThrow('Interrupted placement transform');
 expect(disposed).toBe(0);existing.dispose();expect(disposed).toBe(1);
 const recovered=placedModelObjects(data,textures,placements(),pool),scene=new Scene();scene.add(recovered.root);
 expect(recovered.root.children).toHaveLength(2);recovered.dispose();recovered.dispose();expect(scene.children).toHaveLength(0);
});
test('a later placement failure disposes the source skeleton and every clone exactly once',()=>{
 const disposed:Skeleton[]=[];const original=Skeleton.prototype.dispose;
 const spy=vi.spyOn(Skeleton.prototype,'dispose').mockImplementation(function(this:Skeleton){disposed.push(this);original.call(this);});
 try{
  expect(()=>placedModelObjects(model('dragonff-skin'),[],brokenPlacements())).toThrow('Interrupted placement transform');
  expect(disposed).toHaveLength(3);expect(new Set(disposed).size).toBe(3);
 }finally{spy.mockRestore();}
});
