import {expect,test} from 'vitest';
import {SWIM} from '../src/simulation/nativeSwim';
import {updatePlayerSwim,type SwimPlayer} from '../src/simulation/playerSwim';

const player=(over:Partial<SwimPlayer>={}):SwimPlayer=>({position:{x:0,y:0,z:0},health:100,grounded:false,swimming:false,swimState:0,swimBlend:0,breath:100,swimStopTime:0,swimDiveTime:0,swimDiveDuration:1,swimVel:{x:0,z:0},...over});
const input={moveMag:0,sprint:false,jump:false,dive:false};

test('swimming starts deep, refuses the shallows and dry land',()=>{
 const dry=player();updatePlayerSwim(dry,input,undefined,1/60,undefined);
 expect(dry.swimming).toBe(false);
 const shallow=player({position:{x:0,y:9.5,z:0}});
 updatePlayerSwim(shallow,input,10,1/60,undefined);
 expect(shallow.swimming).toBe(false);
 const p=player({position:{x:0,y:9.3,z:0}});
 updatePlayerSwim(p,input,10,1/60,undefined);
 expect(p.swimming).toBe(true);expect(p.swimState).toBe(SWIM.tread);
});

test('strand exits: dry, shallow standing, or fifteen grounded seconds',()=>{
 const swimming=player({swimming:true,position:{x:0,y:9,z:0}});
 updatePlayerSwim(swimming,input,undefined,1/60,undefined);
 expect(swimming.swimming).toBe(false);
 const shallow=player({swimming:true,grounded:true,position:{x:0,y:9.5,z:0}});
 updatePlayerSwim(shallow,input,10,1/60,undefined);
 expect(shallow.swimming).toBe(false);
 const beached=player({swimming:true,grounded:true,swimStopTime:14.9,position:{x:0,y:5,z:0}});
 updatePlayerSwim(beached,input,10,1/60,undefined);
 expect(beached.swimming).toBe(true);
 updatePlayerSwim(beached,input,10,.2,undefined);
 expect(beached.swimming).toBe(false);
});

test('surface states, dive timing and surfacing',()=>{
 const p=player({swimming:true,position:{x:0,y:5,z:0}});
 updatePlayerSwim(p,{...input,moveMag:1},10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.tread);
 for(let i=0;i<30;i++)updatePlayerSwim(p,{...input,moveMag:1},10,1/60,undefined);
 expect(p.swimBlend).toBeGreaterThan(.5);expect(p.swimState).toBe(SWIM.sprint);
 updatePlayerSwim(p,{...input,moveMag:1,sprint:true},10,1/60,undefined);
 expect(p.swimState).toBe(SWIM.sprinting);
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
