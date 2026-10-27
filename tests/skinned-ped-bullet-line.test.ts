import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {pedSphereHit} from '../src/combat/nativePedHitSpheres';
import {skinnedPedBulletLine,pedBulletBoxHit,type SkinnedPedBulletTarget} from '../src/weapons/skinnedPedBulletLine';
import type {BulletLineOptions} from '../src/weapons/bulletLine';

beforeAll(async()=>RAPIER.init());
function fixture(){
 const world=new RAPIER.World({x:0,y:0,z:0}),body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5)),collider=world.createCollider(RAPIER.ColliderDesc.capsule(.7,.3),body);world.step();
 const spheres=vi.fn(()=>[{center:{x:0,y:1,z:-5},radius:.2,piece:3},{center:{x:0,y:1.7,z:-5},radius:.15,piece:9},{center:{x:.7,y:1,z:-5},radius:.14,piece:5}]);
 const bounds=vi.fn(()=>({center:{x:0,y:1,z:-5},rotation:{x:0,y:0,z:0,w:1}})),target:SkinnedPedBulletTarget={body,collider,bounds,hitSpheres:spheres};
 const from={x:0,y:1,z:0},direction={x:0,y:0,z:-1},trace=(options:BulletLineOptions={},source=from,targets=[target])=>skinnedPedBulletLine(world,source,direction,20,options,targets);
 return {world,body,collider,target,spheres,bounds,from,direction,trace,dispose:()=>world.free()};
}
test('a bullet reaches the native torso sphere beyond the front of its movement capsule',()=>{
 const f=fixture();try{const raw=f.world.castRay(new RAPIER.Ray(f.from,f.direction),20,true)!,hit=f.trace()!;expect(raw.timeOfImpact).toBeCloseTo(4.7);expect(hit.timeOfImpact).toBeCloseTo(4.8);expect(hit.pedPiece).toBe(3);expect(hit.normal).toMatchObject({x:0,y:0,z:1});expect(f.world.castRay(new RAPIER.Ray(f.from,f.direction),20,true)!.timeOfImpact).toBe(raw.timeOfImpact);}finally{f.dispose();}
});
test('an exposed arm outside the capsule is hittable',()=>{
 const f=fixture();try{const from={x:.7,y:1,z:0};expect(f.world.castRay(new RAPIER.Ray(from,f.direction),20,true)).toBeNull();expect(f.trace({},from)).toMatchObject({pedPiece:5,timeOfImpact:expect.closeTo(4.86,5)});}finally{f.dispose();}
});
test('a gap between animated pieces does not fall back to a capsule hit',()=>{
 const f=fixture();try{const from={x:0,y:1.4,z:0};expect(f.world.castRay(new RAPIER.Ray(from,f.direction),20,true)).not.toBeNull();expect(f.trace({},from)).toBeNull();}finally{f.dispose();}
});
test.each(['body','collider','filter'])('the shooting actor and passed actors are excluded by %s',kind=>{
 const f=fixture();try{const options=kind==='body'?{excludeBody:f.body}:kind==='collider'?{excludeCollider:f.collider}:{filter:(c:RAPIER.Collider)=>c.handle!==f.collider.handle};expect(f.trace(options)).toBeNull();expect(f.bounds).not.toHaveBeenCalled();expect(f.spheres).not.toHaveBeenCalled();}finally{f.dispose();}
});
test.each(['sensor','disabled body','disabled collider'])('native targets retain the physical trace exclusion for %s',kind=>{
 const f=fixture();try{if(kind==='sensor')f.collider.setSensor(true);else if(kind==='disabled body')f.body.setEnabled(false);else f.collider.setEnabled(false);f.world.step();expect(f.trace()).toBeNull();expect(f.spheres).not.toHaveBeenCalled();}finally{f.dispose();}
});
test.each([false,true])('opaque cover stops native pieces; shoot-through surfaces preserve them (through=%s)',through=>{
 const f=fixture();try{const wall=f.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,.1).setTranslation(0,1,-2));f.world.step();const hit=f.trace({isShootThrough:h=>through&&h.collider.handle===wall.handle})!;expect(hit.collider.handle).toBe(through?f.collider.handle:wall.handle);expect(f.spheres).toHaveBeenCalledTimes(through?1:0);}finally{f.dispose();}
});
test('the nearest native actor wins independently of candidate order',()=>{
 const f=fixture();try{const body=f.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-8)),collider=f.world.createCollider(RAPIER.ColliderDesc.capsule(.7,.3),body),far:SkinnedPedBulletTarget={body,collider,bounds:()=>({center:{x:0,y:1,z:-8},rotation:{x:0,y:0,z:0,w:1}}),hitSpheres:()=>[{center:{x:0,y:1,z:-8},radius:.2,piece:7}]};f.world.step();expect(f.trace({},f.from,[far,f.target])).toMatchObject({collider:f.collider,pedPiece:3});}finally{f.dispose();}
});
test('unsupported actors retain their physical collider',()=>{
 const f=fixture();try{expect(f.trace({},f.from,[])!.timeOfImpact).toBeCloseTo(4.7);expect(f.spheres).not.toHaveBeenCalled();}finally{f.dispose();}
});
test('the animated bound box rejects an outside line before reading collision bones',()=>{
 const f=fixture();try{expect(f.trace({},{x:0,y:2.5,z:0})).toBeNull();expect(f.spheres).not.toHaveBeenCalled();}finally{f.dispose();}
});
test('the native bound box uses the character axes and admits a rotated corner',()=>{
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/4),line={x:1.5,y:1,z:0},direction={x:0,y:0,z:-1};
 expect(pedBulletBoxHit(line,direction,10,{center:{x:0,y:1,z:-5},rotation})).toBe(true);
 expect(pedBulletBoxHit(line,direction,10,{center:{x:0,y:1,z:-5},rotation:new Quaternion()})).toBe(false);
 expect(pedBulletBoxHit({x:0,y:1,z:0},direction,2,{center:{x:0,y:1,z:-5},rotation})).toBe(false);
});
test('native sphere collision ignores starting inside/on a piece and an entry at the range endpoint',()=>{
 const sphere={center:{x:0,y:0,z:-5},radius:.25,piece:9},direction={x:0,y:0,z:-1};
 expect(pedSphereHit(sphere.center,direction,10,[sphere])).toBeUndefined();
 expect(pedSphereHit({x:0,y:0,z:-4.75},direction,10,[sphere])).toBeUndefined();
 expect(pedSphereHit({x:0,y:0,z:0},direction,4.75,[sphere])).toBeUndefined();
 expect(pedSphereHit({x:0,y:0,z:0},direction,4.751,[sphere])).toMatchObject({piece:9,t:4.75});
});
