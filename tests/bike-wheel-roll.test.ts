import {expect,test} from 'vitest';
import {Group,Vector3} from 'three';
import {stepBikeWheelRoll} from '../src/simulation/bikeWheelRoll';
import {bindBikeWheelRoll} from '../src/render/bikeWheelRoll';

test('native bike contact rotation follows wheel radius, reverse, rear lock and wheelspin',()=>{
 const zero={rotation:0,speed:0};
 expect(stepBikeWheelRoll(zero,'normal',.3,.3,true,1)).toEqual({rotation:-1,speed:-1});
 expect(stepBikeWheelRoll(zero,'normal',-.3,.3,true,1)).toEqual({rotation:1,speed:1});
 expect(stepBikeWheelRoll({rotation:2,speed:-1},'fixed',.3,.3,true,1)).toEqual({rotation:2,speed:0});
 const spin=stepBikeWheelRoll(zero,'spinning',0,.3,true,.5);expect(spin.speed).toBe(Math.fround(-1.1));expect(spin.rotation).toBe(Math.fround(-.55));
});
test('the bike contact gate preserves the axle off the ground and advances by the native timestep',()=>{
 const previous={rotation:2,speed:-1};expect(stepBikeWheelRoll(previous,'normal',.6,.3,false,1)).toBe(previous);
 const full=stepBikeWheelRoll(previous,'normal',.3,.3,true,1),half=stepBikeWheelRoll(stepBikeWheelRoll(previous,'normal',.3,.3,true,.5),'normal',.3,.3,true,.5);expect(half).toEqual(full);
});
test.each([1,2])('native wheel frames retain their centers, scale and parents with %s wheel(s) per axle',perAxle=>{
 const root=new Group(),fork=new Group();root.add(fork);fork.matrixAutoUpdate=false;fork.matrix.makeRotationZ(.2).setPosition(1,2,3);
 const front:number[]=[],rear:number[]=[];
 for(let i=0;i<perAxle*2;i++){
  const wheel=new Group();wheel.matrixAutoUpdate=false;wheel.userData.nativeFrame=i;wheel.matrix.makeScale(1,2,3).setPosition(i,i+1,i+2);(i<perAxle?fork:root).add(wheel);(i<perAxle?front:rear).push(i);
 }
 const frames:any[]=[];root.traverse(f=>{if(f.userData.nativeFrame!==undefined)frames.push(f);});const parents=frames.map(f=>f.parent),bases=frames.map(f=>f.matrix.clone());
 const binding=bindBikeWheelRoll(root,{front,rear});binding.update(frames.map(()=>0),frames.map(()=>-2),.5);const first=frames.map(f=>[...f.matrix.elements]);binding.update(frames.map(()=>0),frames.map(()=>-2),.5);expect(frames.map(f=>[...f.matrix.elements])).toEqual(first);
 frames.forEach((frame,i)=>{expect(frame.parent).toBe(parents[i]);expect(frame.matrix.elements.slice(12,15)).toEqual(bases[i].elements.slice(12,15));const scale=new Vector3().setFromMatrixScale(frame.matrix);expect(scale.x).toBeCloseTo(1);expect(scale.y).toBeCloseTo(2);expect(scale.z).toBeCloseTo(3);});
 expect(()=>binding.update(frames.map(()=>0),frames.map((_,i)=>i===0?NaN:0),.5)).toThrow();expect(frames.map(f=>[...f.matrix.elements])).toEqual(first);
 binding.update(frames.map(()=>0),frames.map(()=>0),1);expect(frames.map(f=>f.matrix.equals(bases[frames.indexOf(f)]))).toEqual(frames.map(()=>true));
});
