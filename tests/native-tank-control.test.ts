import {expect,test} from 'vitest';
import {initialTankTurret,stepTankTurret,tankShotDirection,tankDefaultMuzzle,TANK_PITCH_MAX,TANK_PITCH_MIN} from '../src/simulation/nativeTankControl';
test('the turret turns toward the camera front at 0.015 a step in yaw and 0.005 in pitch, wrapping and clamping',()=>{
 let t=initialTankTurret();expect(t).toEqual({yaw:0,pitch:0.05});
 // Camera looking left (native −x) and level: the yaw target is +π/2, reached in steps of 0.015.
 t=stepTankTurret(t,{x:-1,y:0,z:0},1);expect(t.yaw).toBeCloseTo(0.015,6);
 for(let i=0;i<200;i++)t=stepTankTurret(t,{x:-1,y:0,z:0},1);
 expect(Math.abs(t.yaw-Math.PI/2)).toBeLessThan(0.016);
 // Level ahead: pitch settles at the 15° lift; looking up caps at 35°, down floors at −7°.
 for(let i=0;i<200;i++)t=stepTankTurret(t,{x:0,y:1,z:0},1);expect(t.pitch).toBeCloseTo(15*Math.PI/180,3);
 for(let i=0;i<400;i++)t=stepTankTurret(t,{x:0,y:1,z:3},1);expect(t.pitch).toBeCloseTo(TANK_PITCH_MAX,6);
 for(let i=0;i<400;i++)t=stepTankTurret(t,{x:0,y:1,z:-3},1);expect(t.pitch).toBeCloseTo(TANK_PITCH_MIN,6);
 // Facing backwards the floor rises to −3° (1.3 × cos π is under −1, so the interpolation is skipped); at yaw
 // 120° it is −7° − 1.3 × cos(120°) × 4° = −4.4°.
 for(let i=0;i<300;i++)t=stepTankTurret(t,{x:0,y:-1,z:-3},1);expect(Math.abs(Math.abs(t.yaw)-Math.PI)).toBeLessThan(0.016);
 expect(t.pitch).toBeCloseTo(-3*Math.PI/180,3);
 const back=stepTankTurret({yaw:120*Math.PI/180,pitch:-.3},{x:0,y:1,z:-3},0);
 expect(back.pitch).toBeCloseTo(TANK_PITCH_MIN-1.3*Math.cos(120*Math.PI/180)*(-3*Math.PI/180-TANK_PITCH_MIN),6);
});
test('the shot leaves along (sin −yaw, cos yaw, sin pitch); the default muzzle swings the doom point round the yaw',()=>{
 expect(tankShotDirection({yaw:0,pitch:0})).toEqual({x:-0,y:1,z:0});
 const d=tankShotDirection({yaw:Math.PI/2,pitch:.2});expect(d.x).toBeCloseTo(-1,6);expect(d.z).toBeCloseTo(Math.sin(.2),6);
 const m=tankDefaultMuzzle({yaw:0,pitch:0});expect(m).toEqual({x:0,y:2.95,z:2.97-1});
 const r=tankDefaultMuzzle({yaw:Math.PI/2,pitch:0});expect(r.x).toBeCloseTo(-(2.95+1.394),3);expect(r.y).toBeCloseTo(-1.394,3);
});
import {stepTankTurretPad} from '../src/simulation/nativeTankControl';
// Off the camera's string (any mode but MODE_CAM_ON_A_STRING) the car-gun stick turns the turret at the same rates.
test('off the camera string the stick turns the turret: yaw −0.015 and pitch +0.005 a step at full deflection',()=>{
 let t=initialTankTurret();
 t=stepTankTurretPad(t,{leftRight:128,upDown:0},1);expect(t.yaw).toBeCloseTo(-0.015,6);
 t=stepTankTurretPad(t,{leftRight:-64,upDown:128},2);expect(t.yaw).toBeCloseTo(0,6);expect(t.pitch).toBeCloseTo(0.06,6);
 // The same limits: pitch caps at 35°.
 for(let i=0;i<400;i++)t=stepTankTurretPad(t,{leftRight:0,upDown:128},1);expect(t.pitch).toBeCloseTo(TANK_PITCH_MAX,6);
});
