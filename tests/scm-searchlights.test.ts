import {expect,test} from 'vitest';
import {ScmSearchlights,isPointWithinSearchlight,searchlightCone} from '../src/engine/ScmSearchlights';

// A flat ground at z 0 the line of sight strikes.
const ground=(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>{
 if(from.z>0===to.z>0)return undefined;const t=from.z/(from.z-to.z);return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:0};
};

test('the cone meets the ground in an ellipse round where its line of sight strikes',()=>{
 // Straight down from 20 up, 5 wide 100 along and nothing at the bulb: a circle of 1 at the ground.
 const down=searchlightCone({x:0,y:0,z:20},{x:0,y:0,z:0},5,0,ground);
 expect(down.spot).toEqual({x:0,y:0,z:0});
 expect(Math.hypot(down.axisA.x,down.axisA.y)).toBeCloseTo(1,5);expect(Math.hypot(down.axisB.x,down.axisB.y)).toBeCloseTo(1,5);
 expect(down.near).toHaveLength(41);
 expect(isPointWithinSearchlight(down,{x:.9,y:0,z:0})).toBe(true);expect(isPointWithinSearchlight(down,{x:0,y:-1.1,z:3})).toBe(false);
 // Aimed down at 45 degrees: the lit patch draws out along the beam.
 const slant=searchlightCone({x:0,y:0,z:20},{x:20,y:0,z:0},10,0,ground);
 expect(slant.spot.x).toBeCloseTo(20,4);
 const along=Math.hypot(slant.axisA.x,slant.axisA.y),across=Math.hypot(slant.axisB.x,slant.axisB.y);
 expect(along).toBeGreaterThan(across);
});

test('script searchlights: handles, moving between two points, after an entity, to a point and stop',()=>{
 const lights=new ScmSearchlights();
 const h=lights.add({x:0,y:0,z:20},undefined,{x:0,y:0,z:0},5,.2);
 expect(lights.exists(h)).toBe(true);expect(h>>>16).toBe(1);
 // Starts toward the nearer point, 2 a frame.
 lights.moveBetween(h,{x:10,y:0,z:0},{x:-4,y:0,z:0},2);
 const light=lights.lights[h&0xffff];expect(light.state).toBe(2);
 lights.process(()=>undefined);expect(light.target.x).toBeCloseTo(-2);
 lights.process(()=>undefined);expect(light.target.x).toBeCloseTo(-4);expect(light.state).toBe(1);
 for(let i=0;i<7;i++)lights.process(()=>undefined);expect(light.target.x).toBeCloseTo(10);expect(light.state).toBe(2);
 // After a ped.
 lights.pointAt(h,{kind:'ped',handle:7},100);lights.process(()=>({x:3,y:4,z:0}));expect(light.target).toEqual({x:3,y:4,z:0});
 // To a point, then stopped there.
 lights.pointAtCoord(h,{x:0,y:1,z:0},100);lights.process(()=>undefined);
 expect(light.target).toEqual({x:0,y:1,z:0});expect(light.state).toBe(0);expect(light.pathSpeed).toBe(0);
 // Deleted: the handle names nothing, and the slot's next handle is a new one.
 lights.remove(h);expect(lights.exists(h)).toBe(false);
 const again=lights.add({x:0,y:0,z:0},undefined,{x:0,y:0,z:-1},1,1);expect(again&0xffff).toBe(h&0xffff);expect(again).not.toBe(h);
 Object.assign(lights.lights[again&0xffff],searchlightCone({x:0,y:0,z:20},{x:0,y:0,z:0},5,0,ground));
 expect(lights.anyLighting({x:.5,y:.5,z:0})).toBe(again);expect(lights.anyLighting({x:5,y:5,z:0})).toBe(-1);
 expect(lights.lighting(again,{x:.5,y:.5,z:0})).toBe(true);
});

test('ADD_BLIP_FOR_SEARCHLIGHT is a spotlight blip on the searchlight, which the radar puts at its target',async()=>{
 const {ScmRadar,BLIP_SPOTLIGHT,BLIP_DISPLAY_BOTH}=await import('../src/engine/ScmRadar');
 const lights=new ScmSearchlights(),radar=new ScmRadar();
 const h=lights.add({x:0,y:0,z:20},undefined,{x:5,y:6,z:0},5,.2);
 const blip=radar.setEntityBlip(BLIP_SPOTLIGHT,h,BLIP_DISPLAY_BOTH);
 const trace=radar.traces[radar.index(blip)];expect(trace.type).toBe(BLIP_SPOTLIGHT);expect(trace.entityHandle).toBe(h);
 expect(lights.lights[lights.slotOf(trace.entityHandle)].target).toEqual({x:5,y:6,z:0});
});
