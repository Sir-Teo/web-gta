import {expect,test} from 'vitest';
import {SWIM} from '../src/simulation/nativeSwim';
import {updatePlayerSwim,type SwimPlayer} from '../src/simulation/playerSwim';

const player=(over:Partial<SwimPlayer>={}):SwimPlayer=>({position:{x:0,y:0,z:0},health:100,grounded:false,swimming:false,swimState:0,swimBlend:0,breath:100,swimStopTime:0,swimDiveTime:0,swimDiveDuration:1,swimVel:{x:0,z:0},...over});
const input={moveMag:0,sprint:false,jump:false,dive:false};

test('swimming starts deep, refuses the shallows and dry land',()=>{
 const dry=player();updatePlayerSwim(dry,input,undefined,1/60,undefined);
 expect(dry.swimming).toBe(false);
 // Feet 1.5 under: the origin is only 0.5 under, so CJ still wades.
 const shallow=player({position:{x:0,y:8.5,z:0}});
 updatePlayerSwim(shallow,input,10,1/60,undefined);
 expect(shallow.swimming).toBe(false);
 const p=player({position:{x:0,y:8.3,z:0}});
 updatePlayerSwim(p,input,10,1/60,undefined);
 expect(p.swimming).toBe(true);expect(p.swimState).toBe(SWIM.tread);
 // Dropped in with the origin 2 under: straight to underwater sprinting.
 const deep=player({position:{x:0,y:6.9,z:0}});
 updatePlayerSwim(deep,input,10,1/60,undefined);
 expect(deep.swimming).toBe(true);expect(deep.swimState).toBe(SWIM.underwaterSprinting);
});

test('strand exits: no water at once, standing in the shallows after fifteen native time units, never on a deep floor',()=>{
 const swimming=player({swimming:true,position:{x:0,y:9,z:0}});
 updatePlayerSwim(swimming,input,undefined,1/60,undefined);
 expect(swimming.swimming).toBe(false);
 const beached=player({swimming:true,grounded:true,position:{x:0,y:8.5,z:0}});
 // 15 frames at 50 Hz consume exactly the native threshold; comparison is strict >.
 for(let i=0;i<15;i++)updatePlayerSwim(beached,input,10,1/50,undefined);
 expect(beached.swimming).toBe(true);
 expect(beached.swimStopTime).toBe(15);
 updatePlayerSwim(beached,input,10,1/50,undefined);
 expect(beached.swimming).toBe(false);
 // Touching a sea floor with the origin 0.6 under does not count as standing (ProcessBuoyancy clears bIsStanding).
 const floor=player({swimming:true,grounded:true,position:{x:0,y:5,z:0}});
 for(let i=0;i<40;i++)updatePlayerSwim(floor,input,10,1/50,undefined);
 expect(floor.swimming).toBe(true);expect(floor.swimStopTime).toBe(0);
});

test('player breath uses the supplied stroke, surface recovery uses the default rate',()=>{
 const p=player({swimming:true,swimState:SWIM.underwaterSprinting,position:{x:0,y:5,z:0},breath:10});
 updatePlayerSwim(p,{...input,underwaterStroke:{speed:1.2,blend:.5}},10,1/50,undefined);
 expect(p.breath).toBeCloseTo(8.4);
 p.swimState=SWIM.tread;
 updatePlayerSwim(p,{...input,underwaterStroke:{speed:1.2,blend:1}},10,1/50,undefined);
 expect(p.breath).toBeCloseTo(10.4);
});

test('surface states, dive timing and surfacing',()=>{
 const p=player({swimming:true,position:{x:0,y:5,z:0}});
 updatePlayerSwim(p,{...input,moveMag:1},10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.tread);
 for(let i=0;i<30;i++)updatePlayerSwim(p,{...input,moveMag:1},10,1/60,undefined);
 expect(p.swimBlend).toBeGreaterThan(.5);expect(p.swimState).toBe(SWIM.sprint);
 updatePlayerSwim(p,{...input,moveMag:1,sprint:true},10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.sprinting);
 // From the crawl a jump does nothing (ProcessControlInput dives and jumps only below SWIM_SPRINTING).
 updatePlayerSwim(p,{...input,jump:true,moveMag:1,sprint:true},10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.sprinting);
 p.swimState=SWIM.tread;
 updatePlayerSwim(p,{...input,jump:true},10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.backToSurface);
 p.swimState=SWIM.tread;
 updatePlayerSwim(p,{...input,dive:true},10,1/60,1);
 expect(p.swimState).toBe(SWIM.diveUnderwater);
 updatePlayerSwim(p,input,10,.5,1);
 expect(p.swimState).toBe(SWIM.diveUnderwater);
 updatePlayerSwim(p,input,10,.6,1);
 expect(p.swimState).toBe(SWIM.underwaterSprinting);
 p.swimState=SWIM.backToSurface;p.position.y=9.8;
 updatePlayerSwim(p,input,10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.tread);
});

test('underwater sprinting drains breath and drowns empty lungs',()=>{
 const p=player({swimming:true,swimState:SWIM.underwaterSprinting,position:{x:0,y:5,z:0},breath:10});
 const first=updatePlayerSwim(p,input,10,1/60,undefined);
 expect(first.damage).toBe(0);expect(p.breath).toBeLessThan(10);
 p.breath=0;
 const second=updatePlayerSwim(p,input,10,1/60,undefined);
 expect(second.damage).toBeGreaterThan(0);
 const surface=player({swimming:true,swimState:SWIM.tread,position:{x:0,y:9,z:0},breath:50});
 updatePlayerSwim(surface,input,10,1/60,undefined);
 expect(surface.breath).toBeGreaterThan(50);
});

test('underwater, a swimmer pitched up past 45 degrees within 0.65 of the surface treads again',()=>{
 const p=player({swimming:true,position:{x:0,y:8,z:0}});p.swimState=SWIM.underwaterSprinting;
 // Origin (a unit above the feet) 1 under a surface at 10: deep enough to stay under whatever the pitch.
 p.swimPitch=1;updatePlayerSwim(p,input,10,1/60,undefined);expect(p.swimState).toBe(SWIM.underwaterSprinting);
 // Origin 0.5 under, pitched level: still under.
 p.position.y=8.5;p.swimPitch=0;updatePlayerSwim(p,input,10,1/60,undefined);expect(p.swimState).toBe(SWIM.underwaterSprinting);
 p.swimPitch=1;updatePlayerSwim(p,input,10,1/60,undefined);expect(p.swimState).toBe(SWIM.tread);
});
