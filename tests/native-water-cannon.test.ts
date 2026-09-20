import {expect,test} from 'vitest';
import {stepFireTruckAim,cannonDirection,cannonEmission,waterCannonPedSpeed,WaterCannon,initialCannonAim} from '../src/simulation/nativeWaterCannon';
const rad=(d:number)=>d*Math.PI/180;
test('the nozzle follows the camera at a twentieth of a step in yaw and a second in pitch, lifted 15° (22° S.W.A.T.) and clamped',()=>{
 let t=initialCannonAim();
 t=stepFireTruckAim(t,{x:-1,y:0,z:0},1,false);expect(t.yaw).toBeCloseTo(.05,9);expect(t.pitch).toBeCloseTo(.02,9);
 for(let i=0;i<40;i++)t=stepFireTruckAim(t,{x:-1,y:0,z:0},1,false);
 expect(Math.abs(t.yaw-Math.PI/2)).toBeLessThan(.051);
 for(let i=0;i<40;i++)t=stepFireTruckAim(t,{x:0,y:1,z:0},1,false);expect(Math.abs(t.pitch-rad(15))).toBeLessThan(.021);
 for(let i=0;i<60;i++)t=stepFireTruckAim(t,{x:0,y:1,z:3},1,false);expect(t.pitch).toBeCloseTo(rad(20),9);
 for(let i=0;i<120;i++)t=stepFireTruckAim(t,{x:0,y:1,z:-3},1,false);expect(t.pitch).toBeCloseTo(rad(-20),9);
 let s=initialCannonAim();for(let i=0;i<80;i++)s=stepFireTruckAim(s,{x:0,y:1,z:3},1,true);expect(s.pitch).toBeCloseTo(rad(35),9);
 for(let i=0;i<120;i++)s=stepFireTruckAim(s,{x:0,y:1,z:-3},1,true);expect(s.pitch).toBeCloseTo(rad(-10),9);
 // Yaw wraps through ±π when the camera swings behind.
 let w={yaw:3.1,pitch:0};w=stepFireTruckAim(w,{x:0.01,y:-1,z:0},1,false);expect(w.yaw).toBeLessThan(-3.05);
 const d=cannonDirection({yaw:Math.PI/2,pitch:.3});expect(d.x).toBeCloseTo(-Math.cos(.3),9);expect(d.y).toBeCloseTo(0,9);expect(d.z).toBeCloseTo(Math.sin(.3),9);
});
test('a section leaves 1.2 units past the misc_a node carried by the node speed, at the car speed plus half the direction',()=>{
 const e=cannonEmission({direction:{x:0,y:1,z:0},nozzle:{x:0,y:3,z:2},fromNode:true,carPosition:{x:0,y:0,z:0},moveSpeed:{x:0,y:.2,z:.1},turnSpeed:{x:0,y:0,z:.1},timeStep:1,swat:false,randomInt:15});
 // Start: node + 1.2 forward = (0, 4.2, 2); the turn speed (0,0,0.1) × offset (0,4.2,2) adds (−0.42, 0, 0) to (0,0.2,0.1).
 expect(e.start.x).toBeCloseTo(-.42,9);expect(e.start.y).toBeCloseTo(4.4,9);expect(e.start.z).toBeCloseTo(2.1,9);
 expect(e.end.x).toBeCloseTo(0,9);expect(e.end.y).toBeCloseTo(.2+.5,9);expect(e.end.z).toBeCloseTo(.03+.015*.5,9);
 const s=cannonEmission({direction:{x:0,y:1,z:0},nozzle:{x:0,y:1.5,z:1.8},fromNode:false,carPosition:{x:0,y:0,z:0},moveSpeed:{x:0,y:0,z:0},turnSpeed:{x:0,y:0,z:0},timeStep:1,swat:true,randomInt:0});
 expect(s.start).toEqual({x:0,y:1.5,z:1.8});expect(s.end.y).toBeCloseTo(.4,9);
});
test('the ring advances after 150 ms, sections fall at 1/250 a step and put out fires, peds push every fourth frame, and the cannon frees itself',()=>{
 const c=new WaterCannon();
 c.newInput(7,1000,{x:0,y:0,z:5},{x:0,y:1,z:0});
 expect(c.id).toBe(7);expect(c.sectionsCount).toBe(0);
 const put:number[]=[];
 expect(c.update(1100,1,0,0,p=>put.push(p.y))).toBe(true);
 expect(c.sectionsCount).toBe(0);expect(c.points[0]).toEqual({x:0,y:1,z:5-1/250});expect(put).toEqual([1]);
 expect(c.update(1200,1,1,0)).toBe(false);
 expect(c.sectionsCount).toBe(1);expect(c.used[1]).toBe(false);expect(c.points[0].y).toBeCloseTo(2,9);
 c.newInput(7,1200,{x:0,y:0,z:5},{x:0,y:1,z:0});expect(c.used[1]).toBe(true);
 expect(c.update(1300,1,2,2)).toBe(true);
 for(let i=0;i<40;i++)c.update(1300+i*20,1,3+i,0);
 expect(c.id).toBe(0);
 // A new vehicle id starts a fresh ring.
 c.newInput(9,5000,{x:1,y:1,z:1},{x:0,y:0,z:0});expect(c.id).toBe(9);expect(c.creationTime).toBe(5000);expect(c.sectionsCount).toBe(0);
});
test('a ped in the water is pulled toward 0.6 of its speed, capped at 0.2 a step',()=>{
 const r=waterCannonPedSpeed({x:0,y:0},{x:0,y:.5,z:0});
 // PushPeds: applyable (0.05 − 0)/10 = 0.005 → 0.505; response (0.3 + 0.505)/2 = 0.4025 → capped to 0.2.
 expect(r.x).toBeCloseTo(0,9);expect(r.y).toBeCloseTo(.2,9);
 const g=waterCannonPedSpeed({x:.1,y:0},{x:-.1,y:0,z:0});
 // Applyable (−0.01 − 0.1)/10 = −0.011 shares the water's sign: −0.111, then (−0.06 − 0.111)/2.
 expect(g.x).toBeCloseTo(-.0855,9);
});
test('render geometry draws three crossed quads per close pair with fading alpha and stops at a blocked pair',()=>{
 const c=new WaterCannon();
 for(let i=0;i<4;i++){c.newInput(1,0,{x:0,y:i,z:2},{x:0,y:0,z:0});c.update(200,0,i,0);}
 const g=c.renderGeometry({cameraForward:{x:1,y:0,z:0},random:()=>.5,lineOfSight:()=>undefined});
 // Four sections, three consecutive pairs: 18 vertices each.
 expect(g.positions.length).toBe(3*18*3);expect(g.colors.length).toBe(3*18*4);
 // The write slot (4) is empty and the walk keeps it as the next pair's partner, so the first drawn pair is
 // i = 2 (sections 2 and 3): alpha 64 × (1 − 2/32) = 60, then 58.
 expect(g.colors.slice(0,4)).toEqual([200,200,255,60]);expect(g.colors[18*4+3]).toBe(58);
 expect(g.splash).toBeUndefined();
 const blocked=c.renderGeometry({cameraForward:{x:1,y:0,z:0},random:()=>.5,lineOfSight:(a,b)=>b.y<=1?{point:b,normal:{x:0,y:0,z:1}}:undefined});
 expect(blocked.positions.length).toBe(2*18*3);expect(blocked.splash?.point.y).toBe(1);
});
