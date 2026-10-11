import {expect,test} from 'vitest';
import {MISSION_PLANE_FLYINDIRECTION,MISSION_PLANE_FLYTOCOORS,newPlaneAI,planeGroundAhead,planeSearchDue,steerAIPlane,type PlaneAIBody,type PlanePilot} from '../src/simulation/nativePlaneAI';

/** A plane flying north at 0.8 a step, level, over open sea. */
const body=(o:Partial<PlaneAIBody>={}):PlaneAIBody=>({position:[0,0,100],moveSpeed:[0,.8,0],right:[1,0,0],forward:[0,1,0],up:[0,0,1],onGround:false,...o});
const pilot=(o:Partial<PlanePilot>={}):PlanePilot=>({mission:MISSION_PLANE_FLYTOCOORS,destination:[-500,0,100],tempAction:0,rc:false,...o});
const open={lineOfSight:()=>undefined};

test('the search runs once a second, staggered by the seed',()=>{
 expect(planeSearchDue(2010,1990,0)).toBe(true);
 expect(planeSearchDue(2010,1995,500)).toBe(false);
 expect(planeSearchDue(2510,2495,500)).toBe(true);
});

test('with the way clear it takes the heading to its point and the higher of its altitudes; banks into the turn',()=>{
 const ai=newPlaneAI(Math.PI/2);ai.minAltitude=20;ai.maxAltitude=80;
 // Flying long since off the ground, the point due west (to its left).
 steerAIPlane(ai,body(),pilot(),open,100000,true,1);
 // It looks first between the point and the way it faces: 15 degrees toward north is clear, taken 1.1 times over.
 expect(ai.heading).toBeCloseTo(Math.PI,5);expect(ai.headingPrev).toBeCloseTo(Math.PI-.2617994*1.1,5);
 expect(ai.altitude).toBe(80);
 expect(ai.gearUp).toBe(true);
 // The rudder left, the roll toward the left (FlyingControl's roll negative), the throttle the constructor's full.
 expect(ai.rudder).toBeLessThan(0);expect(ai.roll).toBeLessThan(0);expect(ai.accel).toBe(1);
});

test('with every way ahead blocked it turns back and climbs to 500',()=>{
 const ai=newPlaneAI(0);
 steerAIPlane(ai,body(),pilot(),{lineOfSight:(_from,to)=>to},100000,true,1);
 expect(ai.headingPrev).toBeCloseTo(Math.PI*2,5);expect(ai.altitude).toBe(500);
 expect(planeGroundAhead(body(),{lineOfSight:()=>[0,0,70]},0)).toBe(100000);
});

test('on its wheels it holds the heading it was made with by the rudder and lifts the nose above lift-off speed',()=>{
 const ai=newPlaneAI(Math.PI/2+.05);
 steerAIPlane(ai,body({onGround:true,moveSpeed:[0,.3,0]}),pilot({mission:MISSION_PLANE_FLYINDIRECTION}),open,100000,false,1);
 expect(ai.pitch).toBe(0);expect(ai.roll).toBe(0);expect(ai.rudder).toBeCloseTo(-.5,5);
 steerAIPlane(ai,body({onGround:true,moveSpeed:[0,.6,0]}),pilot({mission:MISSION_PLANE_FLYINDIRECTION}),open,100100,false,1);
 expect(ai.pitch).toBeCloseTo(.4,5);
 // Still on its wheels' 4 seconds after they lift.
 steerAIPlane(ai,body({moveSpeed:[0,.6,0]}),pilot({mission:MISSION_PLANE_FLYINDIRECTION}),open,103000,false,1);
 expect(ai.gearUp).toBe(false);
 expect(steerAIPlane(ai,body(),pilot({mission:0}),open,103000,false,1)).toBe(false);
});

test('following an entity it heads for it at the entity\'s height, and does nothing once the entity has gone',()=>{
 const ai=newPlaneAI(0);
 expect(steerAIPlane(ai,body(),pilot({mission:37}),open,100000,true,1,[0,500,240])).toBe(true);
 expect(ai.heading).toBeCloseTo(Math.PI/2,5);expect(ai.maxAltitude).toBe(240);expect(ai.altitude).toBe(240);
 expect(steerAIPlane(ai,body(),pilot({mission:37}),open,100000,true,1,undefined)).toBe(false);
});

test('attacking the player it heads for where he will be, at his height',()=>{
 const ai=newPlaneAI(0);
 expect(steerAIPlane(ai,body(),pilot({mission:35}),open,100000,true,1,[-300,300,15])).toBe(true);
 expect(ai.heading).toBeCloseTo(Math.PI*3/4,5);expect(ai.maxAltitude).toBe(15);
 expect(steerAIPlane(ai,body(),pilot({mission:59}),open,100000,true,1,[0,300,15])).toBe(true);
 expect(ai.heading).toBeCloseTo(Math.PI/2,5);
});
