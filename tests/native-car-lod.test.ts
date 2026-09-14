import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readDff} from '../src/assets/dff';
import {modelObject} from '../src/assets/ModelObjects';
import {nativeCarLod,bindNativeCarLod} from '../src/render/nativeCarLod';
import type {CarWheel} from '../src/simulation/nativeDriveContacts';
test('native squared-distance thresholds use generation scaling and exact boundary ownership',()=>{
 expect(nativeCarLod(9799,1)).toEqual({detail:'high',highLimit:9800,visibleLimit:45000});
 expect(nativeCarLod(9800,1).detail).toBe('low');expect(nativeCarLod(45000,1).detail).toBe('low');expect(nativeCarLod(45001,1).detail).toBe('culled');
 expect(nativeCarLod(39200,2)).toEqual({detail:'low',highLimit:39200,visibleLimit:180000});
 for(const [distance,multiplier] of [[-1,1],[1,-1],[NaN,1],[0,Infinity],[0,1e30]])expect(()=>nativeCarLod(distance,multiplier)).toThrow();
});
test('body meshes switch independently of parent frames while wheels retain their callback visibility',()=>{
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')));
 const rootFrame=model.atomics[0].frame;
 model.frames[rootFrame].name='chassis_vlo';
 const frame=(name:string,parent:number)=>{model.frames.push({...model.frames[rootFrame],name,parent,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]});return model.frames.length-1;};
 const high=frame('chassis',rootFrame),wheel=frame('wheel',high);
 const atomic={...model.atomics[0]};model.atomics=[atomic,{...atomic,frame:high},{...atomic,frame:wheel}];
 const wheels={frontLeft:wheel,frontRight:frame('rf',high),rearLeft:frame('lb',high),rearRight:frame('rb',high)} as Record<CarWheel,number>;
 const visual=modelObject(model);
 try{
  const lod=bindNativeCarLod(visual.root,model,wheels),meshes:any[]=[];visual.root.traverse(node=>{if(node.userData.nativeAtomic!==undefined)meshes[node.userData.nativeAtomic]=node;});
  expect(meshes.map(m=>m.visible)).toEqual([false,true,true]);expect(visual.root.getObjectByName('chassis_vlo')!.visible).toBe(true);
  lod.update(9800,1);expect(meshes.map(m=>m.visible)).toEqual([true,false,true]);
  lod.update(45001,1);expect(meshes.map(m=>m.visible)).toEqual([false,false,false]);
  lod.update(0,1);expect(meshes.map(m=>m.visible)).toEqual([false,true,true]);
  expect(()=>lod.update(NaN,1)).toThrow();expect(meshes.map(m=>m.visible)).toEqual([false,true,true]);
 }finally{visual.dispose();}
});
