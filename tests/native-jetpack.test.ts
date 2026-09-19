import {expect,test} from 'vitest';
import {JET_PACK,NativeJetPack,limitRadianAngle} from '../src/simulation/nativeJetPack';

const input=(over:Partial<Parameters<NativeJetPack['processControlInput']>[0]>={})=>({walkUpDown:0,walkLeftRight:0,accelerate:false,brake:false,cameraHeading:0,...over});

test('the jetpack tilts toward the walk axis and strafes with the side keys', () => {
 const pack=new NativeJetPack();
 // Forward on the pad is −128, so holding it leans the thrust toward −75°, a tenth of the way in one frame.
 pack.processControlInput(input({walkUpDown:-128,accelerate:true}),false,1);
 expect(pack.thrustAngle).toBeCloseTo(-JET_PACK.maxAngle*.1,5);
 expect(pack.thrustFwd).toBe(1);
 for(let i=0;i<200;i++)pack.processControlInput(input({walkUpDown:-128,accelerate:true}),false,1);
 expect(pack.thrustAngle).toBeCloseTo(-JET_PACK.maxAngle,4);
 // Braking halves the lift and leans back.
 pack.processControlInput(input({walkUpDown:128,brake:true}),false,1);
 expect(pack.thrustFwd).toBe(-1);
 // Holding right gains 0.1 a frame and loses the 0.05 decay; letting go loses both.
 const strafing=new NativeJetPack();
 strafing.processControlInput(input({walkLeftRight:128}),false,1);
 expect(strafing.thrustStrafe).toBeCloseTo(.05,6);
 strafing.processControlInput(input(),false,1);
 expect(strafing.thrustStrafe).toBeCloseTo(0,6);
 // It never passes 1 while held.
 for(let i=0;i<100;i++)strafing.processControlInput(input({walkLeftRight:128}),false,1);
 expect(strafing.thrustStrafe).toBeCloseTo(.95,6);
 // The camera aims the flight in the air; on the ground the walk keeps the heading.
 const aimed=new NativeJetPack(1);
 aimed.processControlInput(input({cameraHeading:2}),false,1);
 expect(aimed.heading).toBe(2);
 aimed.processControlInput(input({cameraHeading:3}),true,1);
 expect(aimed.heading).toBe(2);
 // Standing still, the exit-vehicle button drops the pack.
 expect(aimed.processControlInput(input({exitVehicle:true}),true,1)).toBe('drop');
 expect(aimed.processControlInput(input({exitVehicle:true,walkUpDown:-128}),true,1)).toBe(undefined);
 expect(limitRadianAngle(Math.PI*3)).toBeCloseTo(-Math.PI,6);
});

test('the jetpack lifts on its nominal thrust and climbs only under power', () => {
 const pack=new NativeJetPack();
 const fly=(velocity:{x:number;y:number;z:number},frames:number,position={x:0,y:0,z:5})=>{
  for(let i=0;i<frames;i++){
   velocity.z-=.008;
   pack.processThrust(velocity,position,0,false,false,1);
   position.z+=velocity.z;
  }
  return {velocity,position};
 };
 // Hovering: the nominal 0.8 lift is under gravity, so the flier sinks.
 const hover=fly({x:0,y:0,z:0},50);
 expect(hover.velocity.z).toBeLessThan(0);
 expect(hover.velocity.z).toBeGreaterThan(-.1);
 // Under power with no tilt the thrust beats gravity and the flier climbs.
 const climbing=new NativeJetPack();climbing.thrustFwd=1;
 const up={x:0,y:0,z:0};
 up.z-=.008;climbing.processThrust(up,{x:0,y:0,z:5},0,false,false,1);
 expect(up.z).toBeCloseTo(-.008+.008*(JET_PACK.nominal+JET_PACK.full),5);
 // At the full 75° lean the lift almost exactly carries the flier's weight, so he flies forward on the level
 // (native forward at heading 0 is +y).
 const powered=new NativeJetPack();
 powered.thrustFwd=1;powered.thrustAngle=-JET_PACK.maxAngle;
 const flight={x:0,y:0,z:0},position={x:0,y:0,z:5};
 for(let i=0;i<50;i++){flight.z-=.008;powered.processThrust(flight,position,0,false,false,1);position.z+=flight.z;position.y+=flight.y;}
 expect(flight.y).toBeGreaterThan(.05);
 expect(Math.abs(flight.z)).toBeLessThan(.03);
 // The move damping settles the flight at about 24 metres a second.
 for(let i=0;i<2000;i++){flight.z-=.008;powered.processThrust(flight,position,0,false,false,1);position.z+=flight.z;position.y+=flight.y;}
 expect(flight.y*50).toBeGreaterThan(20);expect(flight.y*50).toBeLessThan(26);
 // A hundred units over the ground the climb fades out, and it is gone by two hundred: only the nominal lift is
 // left, less the move damping.
 const high={x:0,y:0,z:0};
 powered.processThrust(high,{x:0,y:0,z:250},0,false,false,1);
 expect(high.z).toBeCloseTo(.008*JET_PACK.nominal,5);
 // Strafing pushes along the ped's right.
 const sideways=new NativeJetPack();sideways.thrustStrafe=1;
 const side={x:0,y:0,z:0};
 sideways.processThrust(side,{x:0,y:0,z:5},0,false,false,1);
 expect(side.x).toBeCloseTo(.008*JET_PACK.strafe,5);
 // The legs swing with the thrust and settle back under it.
 expect(Math.abs(powered.legSwingFwd)).toBeGreaterThan(0);
 expect(Math.abs(powered.legSwingFwd)).toBeLessThanOrEqual(JET_PACK.legSwingMax);
 // The thrust lifts the ped off the ground; coasting leaves him standing.
 expect(powered.lifts()).toBe(true);
 expect(new NativeJetPack().lifts()).toBe(false);
});

test('the thruster flame fades in with the thrust', () => {
 const pack=new NativeJetPack();
 expect(pack.updateEffect()).toBe(0);
 pack.thrustFwd=1;
 for(let i=0;i<5;i++)pack.updateEffect();
 expect(pack.fxKeyTime).toBeCloseTo(.5,6);
 for(let i=0;i<10;i++)pack.updateEffect();
 expect(pack.fxKeyTime).toBe(1);
 pack.thrustFwd=0;
 for(let i=0;i<20;i++)pack.updateEffect();
 expect(pack.fxKeyTime).toBe(0);
 // The jet balls swivel with the strafe, one to each side.
 pack.thrustStrafe=1;
 expect(pack.ballRotation(.5,true,0)).toEqual([.5,Math.PI/4]);
 expect(pack.ballRotation(.5,false,0)).toEqual([.5,0]);
 // The pack pitches with the thrust angle, less ten times the heading the flier turned through.
 const turning=new NativeJetPack(0);turning.thrustAngle=.5;turning.heading=.1;
 expect(turning.packPitch(.1)).toBeCloseTo(.5-1,6);
});

test('a dead flier spins out on the pack', () => {
 const pack=new NativeJetPack(1);
 pack.thrustFwd=1;pack.thrustAngle=-1;pack.thrustStrafe=.5;
 // The thrust cuts out, the strafe goes hard over one way or the other and the heading wobbles on a 2 s sine.
 pack.dying(1000,1,()=>true,()=>1);
 expect(pack.thrustFwd).toBe(0);expect(pack.thrustAngle).toBe(0);
 expect(pack.thrustStrafe).toBe(-.5);
 expect(pack.heading).toBeCloseTo(1+Math.sin(1000*.0015707964)*JET_PACK.turnRate,6);
 // It piles up to the ±3 limit.
 for(let i=0;i<10;i++)pack.dying(0,1,()=>false,()=>0);
 expect(pack.thrustStrafe).toBe(3);
 for(let i=0;i<10;i++)pack.dying(0,1,()=>true,()=>0);
 expect(pack.thrustStrafe).toBe(-3);
 expect(pack.moveBlend).toBe(0);
});
