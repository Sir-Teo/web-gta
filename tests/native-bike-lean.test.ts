import {expect,test} from 'vitest';
import {bikeLeanTarget,approachBikeLean,bikeLeanDrop,bikeRiderLean,quadRiderLean} from '../src/simulation/nativeBikeLean';
import {knockOffForce,knocksOffRider} from '../src/simulation/nativeBikeKnockOff';

test('lean leans into the turn with speed and caps at MaxLean',()=>{
 // BMX MaxLean 48°: full right lock at speed.
 expect(bikeLeanTarget(1,10,48)).toBeCloseTo(48*Math.PI/180,10);
 expect(bikeLeanTarget(-1,10,48)).toBeCloseTo(-48*Math.PI/180,10);
 // Standing still cannot lean; half speed halves the target.
 expect(bikeLeanTarget(1,0,48)).toBe(0);
 expect(bikeLeanTarget(1,3,48)).toBeCloseTo(24*Math.PI/180,10);
 // Steering clamps to full lock.
 expect(bikeLeanTarget(2,10,48)).toBe(bikeLeanTarget(1,10,48));
 expect(()=>bikeLeanTarget(1,10,-1)).toThrow();
});

test('lean approaches at the DesLean rate and drops the body by (1-cos)',()=>{
 // BMX DesLean .92 leans faster than the Wayfarer .945.
 const fast=approachBikeLean(0,1,.92,1/60),slow=approachBikeLean(0,1,.945,1/60);
 expect(fast).toBeGreaterThan(slow);expect(fast).toBeLessThanOrEqual(1);
 expect(approachBikeLean(0,1,.92,10)).toBe(1);
 // (1-cos(48°)) * BMX min.y ≈ -.33 * -.94.
 expect(bikeLeanDrop(48*Math.PI/180,-.94)).toBeCloseTo((1-Math.cos(48*Math.PI/180))*-.94,10);
 expect(bikeLeanDrop(0,-.94)).toBeCloseTo(0,10);
 expect(bikeRiderLean(48*Math.PI/180,43)).toBe(1);
 expect(bikeRiderLean(0,43)).toBe(0);
});

test('knock-off force follows DamageKnockOffRider',()=>{
 const headOn={intensity:16,mass:100,player:true,skill:0,dir:{fwd:-1,up:0,right:0},upZ:1,sanchez:false,quad:false};
 // 16/100*800*.75 = 96; |fwd|*fwdWeight .6 → 57.6: a bump, not a knock-off.
 expect(knockOffForce(headOn)).toBeCloseTo(57.6,6);
 expect(knocksOffRider(knockOffForce(headOn))).toBe(false);
 // A 22 m/s wall stop clears 75.
 expect(knocksOffRider(knockOffForce({...headOn,intensity:22}))).toBe(true);
 // The Sanchez resists (.65 fwd weight); the early-out zeroes small hits.
 expect(knockOffForce({...headOn,intensity:22,sanchez:true})).toBeLessThan(knockOffForce({...headOn,intensity:22}));
 expect(knockOffForce({...headOn,intensity:1})).toBe(0);
 expect(knocksOffRider(75)).toBe(false);expect(knocksOffRider(75.01)).toBe(true);
 // Upside down (up.z<0) weights the impact at 5.
 expect(knockOffForce({...headOn,intensity:16,upZ:-1})).toBeCloseTo(96*5,6);
});

test('CQuadBike::ProcessAI eases the rider toward the full anim lean on the steered side, the body staying level',()=>{
 // QUAD's bike handling: full anim lean 43 degrees, desLean 0.88 (the value is kept each frame).
 let lean=0;for(let i=0;i<500;i++)lean=quadRiderLean(lean,1,43,.88,1/50);
 expect(lean).toBeCloseTo(43*Math.PI/180,6);
 // One frame from rest moves 12% of the way; steering left leans left.
 expect(quadRiderLean(0,-1,43,.88,1/50)).toBeCloseTo(-.12*43*Math.PI/180,9);
 // Hands off, it decays by 0.88 a frame.
 expect(quadRiderLean(.5,0,43,.88,1/50)).toBeCloseTo(.44,9);
});
test('a head-on impact coming steeply from above weights the forward axis by its world z (CBike::DamageKnockOffRider)',()=>{
 // A nose-down bike meeting the ground: the impact runs along the bike's forward axis but points nearly straight up.
 const steep={intensity:16,mass:100,player:true,skill:0,dir:{fwd:-.95,up:.3,right:0},upZ:.3,sanchez:false,quad:false};
 // 96 × (0.95 × 0.6 + 0.3 × 0.05) against 96 × (0.95 × (7 × 0.95² + 0.6) + 0.3 × 0.05).
 expect(knockOffForce(steep)).toBeCloseTo(96*(.95*.6+.3*.05),6);
 expect(knockOffForce({...steep,worldZ:.95})).toBeCloseTo(96*(.95*(7*.95*.95+.6)+.3*.05),6);
 expect(knocksOffRider(knockOffForce(steep))).toBe(false);
 expect(knocksOffRider(knockOffForce({...steep,worldZ:.95}))).toBe(true);
});
