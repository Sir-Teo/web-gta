import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';

// A heli at (0, 30, 0) facing -z (identity): its pilot seat is (-0.43, 31.5, -1.49) in the browser frame.
const heli=()=>{const h:any={health:1000,body:{handle:7,rotation:()=>({x:0,y:0,z:0,w:1}),translation:()=>({x:0,y:30,z:0})},damage(n:number){h.health-=n;return h.health<=0;}};return h;};
const fake=(h:any)=>{const out:any={crimes:[] as number[],explosions:0,policeHelis:()=>[h],onCrime:(type:number)=>out.crimes.push(type),explode:()=>{out.explosions++;}};return out;};
const test_=(self:any,from:any,to:any)=>(WeaponSystem.prototype as any).testSniperCollision.call(self,from,to);

test('CHeli::TestSniperCollision: a level sniper bullet through the pilot seat downs a police helicopter',()=>{
 const h=heli(),self=fake(h);
 test_(self,{x:-50,y:31.5,z:-1.49},{x:50,y:31.5,z:-1.49});
 expect(h.health).toBe(0);expect(self.explosions).toBe(1);expect(self.crimes.length).toBe(1);
});

test('a bullet 0.8 off the seat, or rising more steeply than 30 degrees, does nothing',()=>{
 const miss=heli(),a=fake(miss);test_(a,{x:-50,y:31.5,z:-2.3},{x:50,y:31.5,z:-2.3});expect(miss.health).toBe(1000);
 // Straight up through the seat: the rise is over half the length.
 const steep=heli(),b=fake(steep);test_(b,{x:-.43,y:0,z:-1.49},{x:-.43,y:60,z:-1.49});expect(steep.health).toBe(1000);
});
