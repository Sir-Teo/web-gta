import {expect,test} from 'vitest';
import {samSiteStep} from '../src/simulation/nativeSamSite';

const site=(o:Partial<{position:{x:number;y:number;z:number};heading:number;broken:boolean}>={})=>({position:{x:200,y:1900,z:20},heading:0,broken:false,...o});
const on={area51:true,carrier:true};

test('a site turns toward the player a twentieth of a radian a step, and fires only lined up, in range and on a 4 s mark',()=>{
 // Facing north (heading 0: forward (0, 1)); the player due east, level and 100 off.
 const east={x:300,y:1900,z:60};
 const turned=samSiteStep(site(),east,on,1,4010,3990);
 expect(turned.heading).toBeCloseTo(-.05,6);expect(turned.fire).toBeUndefined();
 // Lined up (facing east is heading -π/2) on the mark: a rocket from 2 along and 4 up, along forward and up.
 const fired=samSiteStep(site({heading:-Math.PI/2}),east,on,1,4010,3990);
 expect(fired.fire?.origin.x).toBeCloseTo(202,5);expect(fired.fire?.origin.z).toBe(24);
 expect(fired.fire?.direction.x).toBeCloseTo(1,5);expect(fired.fire?.direction.z).toBe(1);
 // Not on a 4-second mark, or past 120 across: no rocket.
 expect(samSiteStep(site({heading:-Math.PI/2}),east,on,1,4500,4480).fire).toBeUndefined();
 expect(samSiteStep(site({heading:-Math.PI/2}),{x:330,y:1900,z:60},on,1,4010,3990).fire).toBeUndefined();
});

test('switched off, broken, or with nothing it may aim at, it holds or sweeps',()=>{
 const east={x:300,y:1900,z:60};
 expect(samSiteStep(site(),east,{area51:false,carrier:true},1,4010,3990)).toEqual({heading:0});
 expect(samSiteStep(site({broken:true}),east,on,1,4010,3990)).toEqual({heading:0});
 // The carrier's (west of x = -1000) answers to its own switch.
 expect(samSiteStep(site({position:{x:-1400,y:500,z:20}}),{x:-1350,y:500,z:60},{area51:true,carrier:false},1,4010,3990)).toEqual({heading:0});
 // North of y 2100, or 2 below it: it sweeps round a two-hundredth of a radian.
 expect(samSiteStep(site(),{x:300,y:2200,z:60},on,1,4010,3990).heading).toBeCloseTo(.005,6);
 expect(samSiteStep(site(),{x:300,y:1900,z:17},on,1,4010,3990).heading).toBeCloseTo(.005,6);
 expect(samSiteStep(site(),undefined,on,2,4010,3990).heading).toBeCloseTo(.01,6);
});
