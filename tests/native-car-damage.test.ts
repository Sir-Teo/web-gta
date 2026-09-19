import {expect,test} from 'vitest';
import {COLLISION_COMPONENT,COMPONENT,DAMSTATE,applyCollisionComponents,applyComponentDamage,collisionHealthLoss,createCarDamage,progressDoor,progressPanel} from '../src/simulation/nativeCarDamage';
test('panels and doors follow CDamageManager progression and random fall-off gates',()=>{
 const d=createCarDamage();expect(progressPanel(d,5,()=>0)).toBe(true);expect(d.panels[5]).toBe(DAMSTATE.opened);progressPanel(d,5,()=>0);expect(d.panels[5]).toBe(DAMSTATE.damaged);
 expect(progressPanel(d,5,()=>.5)).toBe(false);expect(progressPanel(d,5,()=>0)).toBe(true);expect(d.panels[5]).toBe(DAMSTATE.openedDamaged);expect(progressPanel(d,5,()=>0)).toBe(false);
 expect(progressDoor(d,2,()=>.9)).toBe(true);expect(d.doors[2]).toBe(DAMSTATE.damaged);progressDoor(d,2,()=>.9);expect(d.doors[2]).toBe(DAMSTATE.openedDamaged);expect(progressDoor(d,2,()=>.9)).toBe(false);expect(progressDoor(d,2,()=>0)).toBe(true);expect(d.doors[2]).toBe(DAMSTATE.notPresent);
});
test('ApplyDamage uses native group multipliers, the windscreen factor and the 150 threshold',()=>{
 const d=createCarDamage();expect(applyComponentDamage(d,COMPONENT.bumpFront,60,()=>0)).toBeUndefined();expect(applyComponentDamage(d,COMPONENT.bumpFront,61,()=>0)).toEqual({kind:'panel',index:5,state:1});
 // The windscreen is a panel (×2.5, then ×0.6): past intensity 100, and no light smashes.
 expect(applyComponentDamage(d,COMPONENT.windscreen,100,()=>0)).toBeUndefined();expect(applyComponentDamage(d,COMPONENT.windscreen,101,()=>0)).toEqual({kind:'panel',index:4,state:1});expect(d.lights).toEqual([false,false,false,false]);
 expect(applyComponentDamage(d,COMPONENT.doorRR,47,()=>0)).toEqual({kind:'door',index:5,state:DAMSTATE.damaged});expect(applyComponentDamage(d,COMPONENT.bonnet,107,()=>0)).toBeUndefined();
});
test('front bumper hits spread to wings and bonnet like VehicleDamage, and health loss uses native divisors',()=>{
 const d=createCarDamage();d.panels[5]=DAMSTATE.damaged;const changes=applyCollisionComponents(d,COLLISION_COMPONENT.bumpFront,700,1600,{localDir:.8,dirDotRight:0},()=>0);
 expect(changes.map(c=>`${c.kind}:${c.index}`)).toEqual(['panel:5','panel:1','door:0','panel:4']);
 expect(collisionHealthLoss({intensity:26,mass:1600,collisionDamageMultiplier:.5,playerVehicle:false,hitByPlayerVehicle:false})).toBe(0);
 const base=(500-1600/1500*25)*.5*.6;expect(collisionHealthLoss({intensity:500,mass:1600,collisionDamageMultiplier:.5,playerVehicle:true,hitByPlayerVehicle:false})).toBeCloseTo(base/2,5);
 expect(collisionHealthLoss({intensity:500,mass:1600,collisionDamageMultiplier:.5,playerVehicle:false,hitByPlayerVehicle:true})).toBeCloseTo(base/1.5,5);expect(collisionHealthLoss({intensity:500,mass:1600,collisionDamageMultiplier:.5,playerVehicle:false,hitByPlayerVehicle:false})).toBeCloseTo(base/4,5);
});
