import {expect,test} from 'vitest';
import {launchVelocity,projectileTuning,stepProjectile,stepRocketVelocity} from '../src/weapons/nativeProjectile';
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
