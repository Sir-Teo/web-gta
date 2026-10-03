import type {Matrix4,Vector3} from 'three';
/** Copies native data (a model's frame matrix, a grass instance's, a collision sphere's centre) into three.js objects
 * through a loop of its own rather than three.js's fromArray. Arrays a worker posts arrive as structured clones, which
 * V8 makes holey and generic; once one is read at a load site three.js shares with its own matrices (Matrix4.fromArray,
 * Vector3.fromArray, which reads matrix columns), the optimised code converts each matrix array it reads there to that
 * same generic kind, and from then on every number stored into any matrix is a new heap object: every Object3D's world
 * matrix in the scene, and tens of megabytes of garbage a few seconds that a phone's collector has to sweep. Read here,
 * those arrays never reach three.js's sites; a missing entry reads as NaN, as it would have computed. */
export function matrixFromNative(target:Matrix4,source:ArrayLike<number>,offset=0){
 const e=target.elements;
 for(let i=0;i<16;i++)e[i]=+source[offset+i];
 return target;
}
export function vectorFromNative(target:Vector3,source:ArrayLike<number>,offset=0){
 return target.set(+source[offset],+source[offset+1],+source[offset+2]);
}
