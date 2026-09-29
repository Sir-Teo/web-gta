import {expect,test} from 'vitest';
import {launchVelocity,stepProjectile} from '../src/weapons/nativeProjectile';
test('a rocket keeps its speed and its line for as long as it flies',()=>{
 const p={position:{x:0,y:1,z:0},velocity:launchVelocity('rocket',{x:0,y:0,z:-1}),fuse:8};
 const start=Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z);
 for(let i=0;i<120;i++)stepProjectile(p,'rocket',1/60);
 expect(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)).toBeCloseTo(start,6);
 expect(p.position.y).toBeCloseTo(1,6);expect(p.position.z).toBeCloseTo(-start*2,3);
});
