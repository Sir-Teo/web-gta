import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WEAPON_FLAG} from '../src/weapons/weaponData';

// CWeapon::FireInstantHit's third-person free aim (iOS 0x1004951c0): the first shot is exact, then the end of the
// 3 × range line moves round a circle of radius 5 / accuracy × min(15 / range, 1) × 0.75 × m_fAttackButtonCounter,
// swept once a second; each shot adds damage / 25.
const info={type:31,fire:'instant',flags:WEAPON_FLAG.canAim,accuracy:.8,weaponRange:90,damage:30} as any;
const weapons=(nowMs:number,crouched=false)=>({attackButtonCounter:0,nowMs,gunTaskUntilMs:-Infinity,sim:{player:{crouched}}} as any);
const spread=(w:any,i=info)=>(WeaponSystem.prototype as any).aimSpread.call(w,{x:0,y:0,z:-1},i);
const angleOff=(d:{x:number;y:number;z:number})=>Math.acos(-d.z/Math.hypot(d.x,d.y,d.z));

test('the first shot goes down the crosshair line, later ones round a growing circle',()=>{
 const w=weapons(0);
 expect(spread(w)).toEqual({x:0,y:0,z:-1});expect(w.attackButtonCounter).toBeCloseTo(30/25,6);
 const second=spread(w),radius=Math.fround(5/.8)*Math.min(15/90,1)*.75*1.2;
 expect(Math.tan(angleOff(second))).toBeCloseTo(radius/270,6);
 expect(w.attackButtonCounter).toBeCloseTo(2.4,6);
 // A quarter of a second on, the offset has turned a quarter of the way round.
 const a=weapons(0),b=weapons(250);a.attackButtonCounter=b.attackButtonCounter=1;
 const da=spread(a),db=spread(b);
 expect(Math.abs(da.x)).toBeLessThan(1e-9);expect(Math.abs(db.y)).toBeLessThan(1e-6);expect(Math.abs(db.x)).toBeGreaterThan(0);
 // Ducking halves it; a shotgun and a gun that cannot aim take none, and only aimable guns count shots.
 const duck=weapons(100,true),stand=weapons(100);duck.attackButtonCounter=stand.attackButtonCounter=1;
 expect(Math.tan(angleOff(spread(duck)))).toBeCloseTo(Math.tan(angleOff(spread(stand)))/2,6);
 const shotgun=weapons(0);shotgun.attackButtonCounter=3;expect(spread(shotgun,{...info,type:25})).toEqual({x:0,y:0,z:-1});expect(shotgun.attackButtonCounter).toBe(3);
});
