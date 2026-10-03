import {expect,test} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {matrixFromNative,vectorFromNative} from '../src/core/nativeArrays';

test('native arrays copy into matrices and vectors as fromArray does, a worker\'s structured clone included',()=>{
 const frame=structuredClone([1,0,0,0,0,.5,0,0,0,0,2,0,3.25,-4,5,1]);
 const m=matrixFromNative(new Matrix4(),frame);
 expect(m.elements).toEqual(new Matrix4().fromArray(frame).elements);
 // An offset reads further in, as a skin's packed inverse matrices are.
 const packed=new Float32Array([...new Array(16).fill(9),...frame]);
 expect(matrixFromNative(new Matrix4(),packed,16).elements).toEqual(m.elements);
 expect(vectorFromNative(new Vector3(),frame,12).toArray()).toEqual([3.25,-4,5]);
 // A short array leaves NaN, which is what a computation with the missing entry would have made of it.
 expect(Number.isNaN(matrixFromNative(new Matrix4(),[1,2,3]).elements[15])).toBe(true);
 // The target's own array is written in place, not replaced.
 const target=new Matrix4(),elements=target.elements;matrixFromNative(target,frame);expect(target.elements).toBe(elements);
});
