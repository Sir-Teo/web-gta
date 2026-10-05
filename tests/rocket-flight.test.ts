import {expect,test} from 'vitest';
import {bounceVelocity,launchVelocity,projectileTuning,settledElasticity,stepProjectile,stepRocketVelocity} from '../src/weapons/nativeProjectile';
// CProjectileInfo's rockets and heat-seekers, as the iOS executable's AddProjectile and Update fly them.
test('a rocket leaves at 0.4 units a frame, gains 0.008 a frame along its launch line, and lives 3 s',()=>{
 expect(projectileTuning('rocket').fuse).toBe(3);expect(projectileTuning('guided').fuse).toBe(10);
 const p={position:{x:0,y:1,z:0},velocity:launchVelocity('rocket',{x:0,y:0,z:-1}),fuse:3};
 expect(p.velocity.z).toBeCloseTo(-20,9);
 // Fifty frames at the game's rate: 20 units a second faster, along the line, with no fall.
 for(let i=0;i<50;i++)stepProjectile(p,'rocket',1/50);
 expect(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)).toBeCloseTo(40*Math.pow(.99999,50),2);
 expect(p.position.y).toBeCloseTo(1,6);expect(p.position.x).toBeCloseTo(0,6);
 // About 20 + 20/2 units in the first second.
 expect(-p.position.z).toBeGreaterThan(29);expect(-p.position.z).toBeLessThan(31);
 // It keeps its matrix's forward even if knocked off its line: the thrust stays along the launch.
 const q={position:{x:0,y:0,z:0},velocity:{x:5,y:0,z:-20},forward:{x:0,y:0,z:-1}};
 stepRocketVelocity(q,'rocket',1/50);expect(q.velocity.x).toBeCloseTo(5,3);expect(q.velocity.z).toBeCloseTo(-20.4,3);
 // Held to 9.9 units a frame.
 const fast={position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:-600},forward:{x:0,y:0,z:-1}};
 stepRocketVelocity(fast,'rocket',1/50);expect(Math.hypot(fast.velocity.x,fast.velocity.y,fast.velocity.z)).toBeCloseTo(495,1);
});
test('a heat-seeker turns toward where its target will be, harder against a fast one, hardest at a plane',()=>{
 const launch=()=>({position:{x:0,y:0,z:0},velocity:launchVelocity('guided',{x:0,y:0,z:-1})});
 expect(launch().velocity.z).toBeCloseTo(-10,9);
 // A still target off to the side: the player's turns by 0.0117 a frame toward it, another's by 0.009.
 const still={position:{x:100,y:0,z:-100},velocity:{x:0,y:0,z:0},plane:false};
 const mine=launch();stepRocketVelocity(mine,'guided',1/50,still,true);
 const theirs=launch();stepRocketVelocity(theirs,'guided',1/50,still,false);
 expect(mine.velocity.x).toBeGreaterThan(theirs.velocity.x);expect(mine.velocity.x/theirs.velocity.x).toBeCloseTo(.0117/.009,2);
 // Without a target it flies on unturned.
 const blind=launch();stepRocketVelocity(blind,'guided',1/50);expect(blind.velocity.x).toBe(0);
 // A target behind: the backward part of the way to it is dropped, so it turns across, not back.
 const behind=launch();stepRocketVelocity(behind,'guided',1/50,{position:{x:10,y:0,z:100},velocity:{x:0,y:0,z:0},plane:false},true);
 expect(behind.velocity.z).toBeCloseTo(-10*Math.pow(.99999,1),3);expect(behind.velocity.x).toBeGreaterThan(0);
 // A target faster than 0.8 a frame (40 units a second) draws a fifth more turn.
 const slow=launch(),quick=launch();
 stepRocketVelocity(slow,'guided',1/50,{position:{x:100,y:0,z:-100},velocity:{x:0,y:30,z:0},plane:false},true);
 stepRocketVelocity(quick,'guided',1/50,{position:{x:100,y:0,z:-100},velocity:{x:0,y:45,z:0},plane:false},true);
 const turned=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z+10*Math.pow(.99999,1));
 expect(turned(quick.velocity)/turned(slow.velocity)).toBeCloseTo(1.2,1);
 // The player's at a plane: 0.95 of its speed kept a frame and a turn of 0.15, the plane's own course barely led.
 const atPlane=launch();stepRocketVelocity(atPlane,'guided',1/50,{position:{x:100,y:0,z:-100},velocity:{x:0,y:0,z:0},plane:true},true);
 expect(atPlane.velocity.x).toBeCloseTo(.15*50*Math.SQRT1_2*Math.pow(.99999,1),2);
 expect(atPlane.velocity.z).toBeCloseTo((-10*.95-.15*50*Math.SQRT1_2)*Math.pow(.99999,1),2);
});
test("thrown weapons go along the thrower's heading at the throw's force, fall at CPhysical's gravity and settle",()=>{
 // Aimed up and to the side: only the level heading counts.
 const aim={x:.6,y:.8,z:0};
 // A grenade of no force: 0.15 units a frame level and 0.4 of that rising; of force 1, 0.37 and 0.8 of that.
 const soft=launchVelocity('grenade',aim,0),hard=launchVelocity('grenade',aim,1);
 expect([soft.x,soft.y,soft.z].map(v=>+v.toFixed(4))).toEqual([7.5,3,0]);
 expect([hard.x,hard.y,hard.z].map(v=>+v.toFixed(4))).toEqual([18.5,14.8,0]);
 // A satchel at half the speed; a molotov at least 0.2 a frame, rising at 0.4 + 0.2 x the force; tear gas as a grenade.
 expect(launchVelocity('satchel',aim,1).x).toBeCloseTo(9.25,6);
 const molotov=launchVelocity('molotov',aim,0);expect(molotov.x).toBeCloseTo(10,9);expect(molotov.y).toBeCloseTo(4,9);
 expect(launchVelocity('molotov',aim,1).y).toBeCloseTo(.37*50*.6,6);
 expect(launchVelocity('gas',aim,.5)).toEqual(launchVelocity('grenade',aim,.5));
 // Fuses: a grenade and a molotov 2 s, tear gas 20, a satchel none.
 expect(['grenade','molotov','gas','satchel'].map(k=>projectileTuning(k).fuse)).toEqual([2,2,20,Infinity]);
 // A second of flight falls 20 units a second faster.
 const p={position:{x:0,y:0,z:0},velocity:{...hard},fuse:2};for(let i=0;i<50;i++)stepProjectile(p,'grenade',1/50);
 // (CProjectile's 0.99999 a frame of air resistance takes its sliver.)
 expect(p.velocity.y).toBeCloseTo(14.8-20,1);expect(p.velocity.x).toBeCloseTo(18.5*Math.pow(.99999,50),6);
 // A bounce returns the part into the surface at the elasticity and keeps the rest.
 expect(bounceVelocity({x:4,y:-10,z:0},{x:0,y:1,z:0},.5)).toEqual({x:4,y:5,z:0});
 expect(bounceVelocity({x:4,y:10,z:0},{x:0,y:1,z:0},.5)).toEqual({x:4,y:10,z:0});
 // Under 0.05 a frame each way, a grenade, tear gas or satchel stops bouncing (0.03); a molotov does not.
 expect(settledElasticity('grenade',{x:2,y:-2,z:1},.5)).toBe(.03);expect(settledElasticity('grenade',{x:3,y:0,z:0},.5)).toBe(.5);
 expect(settledElasticity('molotov',{x:0,y:0,z:0},.75)).toBe(.75);
});
