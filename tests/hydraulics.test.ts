import {expect,test} from 'vitest';
import {HANDLING_HYDRAULIC_GEOM,NativeHydraulics,hydraulicLimits} from '../src/vehicle/nativeHydraulics';

// A lowrider's handling travel 0.1 up, -0.15 down, a body 0.3 under the wheel line, a 0.35 wheel radius.
const limits=hydraulicLimits(.1,-.15,HANDLING_HYDRAULIC_GEOM,-.3,0,.35);
const idle={player:true,hornJustDown:false,stick:{leftRight:0,upDown:0},prevSpeed:0,gas:0};

test('HydraulicControl works out the stances: normal travel half again, extended 0.4 lower, idle the middle 70%',()=>{
 expect(limits.normalLower).toBeCloseTo(-.15,6);expect(limits.normalUpper).toBeCloseTo(.225,6);
 expect(limits.extendedUpper).toBeCloseTo(-.175,6);expect(limits.extendedLower).toBeCloseTo(-.55,6);
 expect(limits.idleUpper).toBeCloseTo(.225-.05625,6);expect(limits.idleLower).toBeCloseTo(-.15+.05625,6);
 // Plain geometry drops 0.2, and the extended stance never sinks the line under the body.
 const plain=hydraulicLimits(.1,-.15,0,-.3,0,.35);expect(plain.extendedUpper).toBeCloseTo(-.1,6);
 expect(hydraulicLimits(.1,-.15,HANDLING_HYDRAULIC_GEOM,-.1,0,.35).extendedUpper).toBeCloseTo(-.1,6);
});

test('the car squats at rest, rises as it drives off, and the horn throws it to the extended stance and back',()=>{
 const h=new NativeHydraulics(limits);
 const rest=h.step(idle);expect(h.angle).toBe(0);expect(rest.lines!.frontLeft.upper).toBeCloseTo(limits.idleUpper,6);
 const off=h.step({...idle,prevSpeed:.05,gas:1});expect(h.angle).toBe(20);expect(off.sounds).toEqual(['suspensionOn']);expect(off.lines!.frontLeft.upper).toBeCloseTo(limits.normalUpper,6);
 const up=h.step({...idle,hornJustDown:true});expect(h.angle).toBe(500);expect(up.lines!.rearRight.upper).toBeCloseTo(limits.extendedUpper,6);expect(up.sounds).toEqual(['suspensionTrigger']);
 const down=h.step({...idle,hornJustDown:true});expect(h.angle).toBe(60);expect(down.lines!.rearRight.upper).toBeCloseTo(limits.normalUpper,6);
 // Stopped, it counts back down to idle and says so at 1.
 const sounds:string[]=[];for(let i=0;i<70;i++)sounds.push(...h.step(idle).sounds);
 expect(h.angle).toBe(0);expect(sounds).toEqual(['suspensionOff']);
});

test('the stick lifts the corners it points at: forward right raises the front right hardest',()=>{
 const h=new NativeHydraulics(limits);h.angle=60;
 const out=h.step({...idle,stick:{leftRight:128,upDown:0}});
 // atan2(128, 0) - 45 degrees: the right side goes up, the left stays down.
 expect(out.lines!.frontRight.upper).toBeLessThan(limits.normalUpper);expect(out.lines!.rearRight.upper).toBeLessThan(limits.normalUpper);
 expect(out.lines!.frontLeft.upper).toBeCloseTo(limits.normalUpper,6);expect(out.lines!.rearLeft.upper).toBeCloseTo(limits.normalUpper,6);
 expect(new NativeHydraulics(limits).step({...idle,player:false}).lines).toBeUndefined();
});

test('the hydraulic jump lifts every corner at once, and moving the lines sounds the pump',()=>{
 const h=new NativeHydraulics(limits,.35);
 h.step({...idle,prevSpeed:.05,gas:1});
 const jumped=h.step({...idle,prevSpeed:.05,gas:1,jump:true});
 for(const w of ['frontLeft','rearLeft','frontRight','rearRight'] as const)expect(jumped.lines![w].upper).toBeCloseTo(limits.extendedUpper,6);
 // The lines dropped from normal to extended: maxDelta against the extended-to-normal lower limit rings the pump.
 expect(jumped.sounds).toContain('suspensionHydraulic');
 // Held still, nothing moves and nothing sounds.
 expect(h.step({...idle,prevSpeed:.05,gas:1,jump:true}).sounds).toEqual([]);
});
test('a horn press back to the normal stance falls through into the stick, while the extended toggle stops there',()=>{
 const h=new NativeHydraulics(limits,.35);
 h.step({...idle,prevSpeed:.05,gas:1});
 const up=h.step({...idle,prevSpeed:.05,gas:1,hornJustDown:true});expect(h.angle).toBe(500);expect(up.sounds).toContain('suspensionTrigger');
 // Back to normal with the stick pushed forward: the stick's corner lift is in the same step's lines.
 const back=h.step({...idle,prevSpeed:.05,gas:1,hornJustDown:true,stick:{leftRight:0,upDown:-128}});
 expect(h.angle).toBe(60);expect(back.sounds[0]).toBe('suspensionHydraulic');
 expect(back.lines!.frontLeft.upper).not.toBeCloseTo(limits.normalUpper,3);
});

test('a mission car an AI drives takes its corners from the script, and a car with none set squats',()=>{
 const h=new NativeHydraulics(limits);
 const ai={...idle,player:false};
 // Neither the player's nor scripted: HydraulicControl does not run.
 expect(h.step(ai).lines).toBeUndefined();
 // All four at nothing, at rest: the idle stance.
 const none={frontLeft:0,rearLeft:0,frontRight:0,rearRight:0};
 expect(h.step({...ai,scripted:none}).lines!.frontLeft.upper).toBeCloseTo(limits.idleUpper,6);
 // The left side up: those corners go to the extended line, the right ones stay at the normal travel; the horn is
 // the player's alone.
 const raise={frontLeft:1,rearLeft:1,frontRight:0,rearRight:0};
 // Out of the idle stance the first step only wakes the pump (the change is dropped and the angle goes to 60).
 expect(h.step({...ai,scripted:raise}).lines!.frontLeft.upper).toBeCloseTo(limits.normalUpper,6);expect(h.angle).toBe(60);
 const left=h.step({...ai,hornJustDown:true,scripted:raise});
 expect(h.angle).toBe(60);
 expect(left.lines!.frontLeft.upper).toBeCloseTo(limits.extendedUpper,6);expect(left.lines!.rearLeft.upper).toBeCloseTo(limits.extendedUpper,6);
 expect(left.lines!.frontRight.upper).toBeCloseTo(limits.normalUpper,6);
 // Half way: the line between the two.
 const half=h.step({...ai,scripted:{frontLeft:.5,rearLeft:0,frontRight:0,rearRight:0}});
 expect(half.lines!.frontLeft.upper).toBeCloseTo((limits.extendedUpper+limits.normalUpper)/2,6);
});
