import {expect,test} from 'vitest';
import {nativeSuspensionLine} from '../src/simulation/nativeSuspension';
import {stepTrailerLegGrip,stepTrailerSupportExtension,trailerSupportLines,TRAILER_SUPPORT_EXTENSION_RATE,type TrailerLegWheel} from '../src/simulation/nativeTrailerSupport';

test('CTrailer::SetupSuspensionLines puts the legs at the front corners of the bounds, reaching below the wheels',()=>{
 // PETROTR's rear axles (wheel_lf at y -2.64, wheel_lb at -3.78, z -1.45), handling limits and its 1.12 wheels.
 const line=(x:number,y:number)=>nativeSuspensionLine({x,y,z:-1.45},.1,-.25,1.12);
 const wheels={frontLeft:line(-1.13,-2.64),rearLeft:line(-1.13,-3.78),frontRight:line(1.13,-2.64),rearRight:line(1.13,-3.78)};
 const bounds={min:[-1.3,-5,-2.2],max:[1.3,7,2.4]};
 const [left,right]=trailerSupportLines(wheels,bounds,1.2,1.12);
 expect(left.start).toEqual({x:Math.fround(-1.3),y:7,z:Math.fround(2.4)});expect(right.start.x).toBe(Math.fround(1.3));
 expect(left.end.x).toBe(left.start.x);expect(left.end.y).toBe(left.start.y);expect(right.end.z).toBe(left.end.z);
 // The foot is low enough to meet the road the wheels stand on, so the legs carry the front.
 expect(left.end.z).toBeLessThan(wheels.frontLeft.end.z);
});

test('ProcessControl: the legs come out untowed (slowly while under a tenth) and go in towed',()=>{
 expect(stepTrailerSupportExtension(.5,false,1)).toBeCloseTo(.5+TRAILER_SUPPORT_EXTENSION_RATE,6);
 expect(stepTrailerSupportExtension(.05,false,1)).toBeCloseTo(.0505,6);
 expect(stepTrailerSupportExtension(1,false,10)).toBe(1);
 expect(stepTrailerSupportExtension(.001,true,1)).toBe(0);
 expect(stepTrailerSupportExtension(.5,true,1)).toBeCloseTo(.498,6);
});

const road={adhesiveLimit:.9,wetMultiplier:1,offRoad:false,burst:false};
const legWheel=(o:Partial<TrailerLegWheel>={}):TrailerLegWheel=>({counted:true,normal:{x:0,y:0,z:1},surface:road,state:'normal',...o});
const grip=(o:Partial<Parameters<typeof stepTrailerLegGrip>[0]>={})=>stepTrailerLegGrip({forward:{x:0,y:1,z:0},linear:{x:.05,y:0,z:0},angular:{x:0,y:0,z:0},centerOfMass:{x:0,y:0,z:0},
 mass:5000,turnMass:40000,timeStep:1,reach:1,contacts:[{share:.9,point:{x:-1.7,y:7.9,z:-2.1},normal:{x:0,y:0,z:1}},{share:.9,point:{x:1.7,y:7.9,z:-2.1},normal:{x:0,y:0,z:1}}],
 wheels:[legWheel(),legWheel()],contactWheels:4,alreadySkidding:false,handling:{tractionMultiplier:.8,brakeBias:.5,tractionBias:.5,tractionLoss:.8,suspensionAntiDive:0,handlingFlags:0},...o});
test('a free trailer\'s legs drag like a braked pair of wheels with a quarter of its traction',()=>{
 // Sliding sideways at 0.05 a step: each leg takes at most its adhesion, 0.9 × 0.8 × 0.004 × 0.25 a step.
 const r=grip();
 expect(r.motions).toHaveLength(2);
 const adhesion=Math.fround(.9*Math.fround(Math.fround(.8*.004)*.25));
 for(const m of r.motions){expect(m.linear.x).toBeLessThan(0);expect(Math.hypot(m.linear.x,m.linear.y)).toBeLessThanOrEqual(adhesion*.8+1e-7);}
 // Over the adhesion the wheel state turns to a skid, as the native writes into the borrowed wheels.
 expect(r.states).toEqual(['skidding','skidding']);
 // Barely moving, the brake holds it outright: all of the leg's share of the slide (over four contact wheels).
 const slow=grip({linear:{x:.0001,y:0,z:0}});
 expect(slow.states).toEqual(['normal','normal']);
 expect(slow.motions[0].linear.x).toBeCloseTo(-.0001/4,9);
});
test('the grip needs the leg on the ground within its reach and the borrowed wheel\'s ground; towed there is none',()=>{
 expect(grip({contacts:[undefined,undefined]}).motions).toHaveLength(0);
 expect(grip({reach:.9}).motions).toHaveLength(0);
 expect(grip({wheels:[legWheel({counted:false}),legWheel({surface:undefined})]}).motions).toHaveLength(0);
 expect(grip({contactWheels:0}).motions).toHaveLength(0);
});
