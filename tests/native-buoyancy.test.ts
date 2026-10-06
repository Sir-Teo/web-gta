import {expect,test} from 'vitest';
import {WaterLevelIndex} from '../src/world/waterLevel';
import {applyNativeBikeBuoyancy,applyNativeBuoyancy,nativeBuoyancySplashEdges,nativeSplashParticles,processNativeBuoyancy,type NativeBuoyancyBody} from '../src/simulation/nativeBuoyancy';
const vertex=(x:number,y:number,z:number)=>({position:[x,y,z] as [number,number,number],flow:[0,0] as [number,number],bigWaves:0,smallWaves:0});
test('water heights interpolate native quads and triangles, the first listed polygon winning (iOS GetWaterLevelNoWaves)',()=>{
 const index=new WaterLevelIndex([{vertices:[vertex(0,0,0),vertex(100,0,2),vertex(0,100,0),vertex(100,100,2)],flags:1,line:1},{vertices:[vertex(300,0,5),vertex(400,0,5),vertex(300,100,7)],flags:1,line:2},{vertices:[vertex(40,40,9),vertex(60,40,9),vertex(40,60,9),vertex(60,60,9)],flags:0,line:3}]);
 expect(index.level(50,10)).toBeCloseTo(1,5);expect(index.level(50,50)).toBeCloseTo(1,5);expect(new WaterLevelIndex([{vertices:[vertex(40,40,9),vertex(60,40,9),vertex(40,60,9),vertex(60,60,9)],flags:0,line:3}] as never).level(50,50)).toBe(9);expect(index.level(310,10)).toBeCloseTo(5.2,5);expect(index.level(399,99)).toBeUndefined();expect(index.level(200,50)).toBeUndefined();
});
const flat=(level:number)=>(x:number,y:number)=>Math.abs(x)<500&&Math.abs(y)<500?level:undefined;
const body=(z:number,extra:Partial<NativeBuoyancyBody>={}):NativeBuoyancyBody=>({position:[0,0,z],right:[1,0,0],forward:[0,1,0],up:[0,0,1],boundsMin:[-2,-4,-1],boundsMax:[2,4,1],modelId:400,heli:false,touchingWater:false,mass:1500,turnMass:3000,centerOfMass:[0,0,0],buoyancyConstant:1500*.8/75,moveSpeed:[0,0,0],turnSpeed:[0,0,0],...extra});
test('SimpleCalcBuoyancy immersion follows the nine-point footprint and ignores bodies above water',()=>{
 expect(processNativeBuoyancy(body(5),flat(0))).toBeUndefined();
 expect(processNativeBuoyancy(body(0),flat(0))!.immersion).toBeCloseTo(.5,5);
 expect(processNativeBuoyancy(body(-.5),flat(0))!.immersion).toBeCloseTo(.75,5);
 const tilted=body(0,{forward:[0,Math.cos(.3),Math.sin(.3)],up:[0,-Math.sin(.3),Math.cos(.3)]});expect(processNativeBuoyancy(tilted,flat(0))!.turnPoint[1]).toBeLessThan(0);
});
test('amphibious helicopters settle where buoyancy balances 0.008-per-step gravity; cars and helicopters drown',()=>{
 const floater=body(2,{modelId:447,heli:true}),state={rotorSpeed:0,initialBuoyancy:floater.buoyancyConstant};
 for(let i=0;i<3000;i++){floater.moveSpeed[2]-=.008;applyNativeBuoyancy(floater,flat(0),1,state);floater.position[2]+=floater.moveSpeed[2];}
 const settled=processNativeBuoyancy(floater,flat(0))!;expect(Math.abs(floater.moveSpeed[2])).toBeLessThan(.002);// Water damping multiplies the gravity step by max(0.5, 1 - ratio / 20), so equilibrium lands at 20/21 of it.
 expect(settled.immersion*floater.buoyancyConstant).toBeCloseTo(floater.mass*.008*20/21,1);
 const seasparrow=body(-.2,{modelId:447,heli:true}),rotor={rotorSpeed:.5,initialBuoyancy:seasparrow.buoyancyConstant};
 const amphibious=applyNativeBuoyancy(seasparrow,flat(0),1,rotor);expect(amphibious.drowning).toBe(false);expect(rotor.rotorSpeed).toBe(.5);
 const maverick=body(-.9,{modelId:487,heli:true}),spinning={rotorSpeed:.5,initialBuoyancy:maverick.buoyancyConstant};
 const sinking=applyNativeBuoyancy(maverick,flat(0),1,spinning);expect(sinking.rotorKilled).toBe(true);expect(sinking.drowning).toBe(true);expect(spinning.rotorSpeed).toBe(0);
 const car=body(0),carState={rotorSpeed:0,initialBuoyancy:car.buoyancyConstant};let drowned=false;for(let i=0;i<600;i++){car.moveSpeed[2]-=.008;drowned=applyNativeBuoyancy(car,flat(0),1,carState).drowning||drowned;car.position[2]+=car.moveSpeed[2];}expect(drowned).toBe(true);expect(car.buoyancyConstant).toBeLessThan(carState.initialBuoyancy);expect(car.position[2]).toBeLessThan(-.5);
 // A plane (IsSubPlane) diving in faster than a unit a frame blows up; a car does not.
 const diving=body(.2,{moveSpeed:[0,0,-1.2],plane:true});expect(applyNativeBuoyancy(diving,flat(0),1,{rotorSpeed:0,initialBuoyancy:diving.buoyancyConstant}).blowUp).toBe(true);
 const plunging=body(.2,{moveSpeed:[0,0,-1.2]});expect(applyNativeBuoyancy(plunging,flat(0),1,{rotorSpeed:0,initialBuoyancy:plunging.buoyancyConstant}).blowUp).toBe(false);
});
test('SimpleCalcBuoyancy splashes from edges with the water line in the upper half, and AddSplashParticles follows the move speed',()=>{
 // Body z 0, bounds z −1..1: water at 0.5 puts every sample 0.5 above the base (the upper half) but under the top.
 const wading=processNativeBuoyancy(body(0),flat(.5))!;
 expect(wading.points[1][1]).toEqual([0,0,.5]);
 // Eight edge checks; the +X edge reuses the +Y row, so that row splashes twice.
 const edges=nativeBuoyancySplashEdges(wading);expect(edges).toHaveLength(8);
 expect(edges.filter(e=>e.from[1]===4&&e.to[1]===4)).toHaveLength(4);
 // Under half height (water at −0.2) nothing splashes; above the top (fully under water) neither.
 expect(nativeBuoyancySplashEdges(processNativeBuoyancy(body(0),flat(-.2))!)).toEqual([]);
 expect(nativeBuoyancySplashEdges(processNativeBuoyancy(body(0),flat(3))!)).toEqual([]);
 const edge=edges[0],still=body(0);expect(nativeSplashParticles(still,edge.from,edge.to)).toBeUndefined();
 // Falling at 0.3 units per frame is capped to 0.1: 60 × 0.1 outward, 120 × 0.1 upward. The 2-unit edge from (−2, −4) to (0, −4) gives four particles.
 const falling=body(0,{moveSpeed:[0,0,-.3]}),particles=nativeSplashParticles(falling,edge.from,edge.to,()=>0)!;
 expect(edge).toEqual({from:[-2,-4,.5],to:[0,-4,.5]});expect(particles).toHaveLength(4);
 const first=particles[0],outward=[-2/Math.hypot(2,4),-4/Math.hypot(2,4)];
 expect(first.position).toEqual([-2,-4,.5]);expect(first.velocity[0]).toBeCloseTo(outward[0]*6,5);expect(first.velocity[1]).toBeCloseTo(outward[1]*6,5);expect(first.velocity[2]).toBeCloseTo(12,5);
 // The random push moves each particle up to half a unit further out.
 const pushed=nativeSplashParticles(falling,edge.from,edge.to,()=>1)![0];expect(pushed.position[0]).toBeCloseTo(-2+outward[0]*.5,5);
});

test('a heavy car (bMakeMassTwiceAsBig) takes the water drag half as hard again',()=>{
 const run=(heavy:boolean)=>{const b=body(0,{heavy,moveSpeed:[.1,0,0]});applyNativeBuoyancy(b,flat(0),1,{rotorSpeed:0,initialBuoyancy:b.buoyancyConstant});return b.moveSpeed[0];};
 const light=run(false),heavy=run(true);
 // max(0.5, 1 − ratio/20) with the ratio ×1.5.
 expect(1-heavy/.1).toBeCloseTo((1-light/.1)*1.5,5);
});
test("the player's upright Vortex rides the water without drowning unless it was already drowning",()=>{
 const sunk=(drowning:boolean)=>{const b=body(-1.5,{modelId:539,hovers:true,drowning});const before=b.buoyancyConstant;
  const r=applyNativeBuoyancy(b,flat(0),1,{rotorSpeed:0,initialBuoyancy:before});return {r,kept:b.buoyancyConstant===before};};
 const riding=sunk(false);expect(riding.r.drowning).toBe(false);expect(riding.kept).toBe(true);
 expect(sunk(true).r.drowning).toBe(true);
});
test('CBike::ProcessBuoyancy drowns past 0.8, or 0.4 off its wheels, and keeps its buoyancy constant',()=>{
 const bike=(z:number,extra:Partial<NativeBuoyancyBody>={})=>body(z,{mass:500,turnMass:200,buoyancyConstant:500*.8/103,boundsMin:[-.5,-1,-.6],boundsMax:[.5,1,.6],...extra});
 // Water halfway up: a ratio between 0.4 and 0.8 drowns only a bike with a wheel off the ground.
 const wading=bike(0,{anyWheelOffGround:false}),state={};const shallow=applyNativeBikeBuoyancy(wading,flat(0),1,state);
 expect(shallow.ratio).toBeGreaterThan(.4);expect(shallow.ratio).toBeLessThan(.8);expect(shallow.drowning).toBe(false);
 expect(applyNativeBikeBuoyancy(bike(0,{anyWheelOffGround:true}),flat(0),1,{}).drowning).toBe(true);
 const sunk=bike(-2,{moveSpeed:[0,0,-.5]}),constant=sunk.buoyancyConstant,deep=applyNativeBikeBuoyancy(sunk,flat(0),1,{});
 expect(deep.drowning).toBe(true);expect(sunk.moveSpeed[2]).toBeGreaterThanOrEqual(-.1);expect(sunk.buoyancyConstant).toBe(constant);
 expect(applyNativeBikeBuoyancy(bike(5),flat(0),1,{}).inWater).toBe(false);
});
