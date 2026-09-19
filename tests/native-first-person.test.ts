import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readWeaponData,nativeWeaponInfo} from '../src/weapons/weaponData';
import {FirstPersonZoom,firstPersonAlphaRange,firstPersonLookScale,firstPersonMode,firstPersonSourceOffset,wellBufferMe} from '../src/weapons/nativeFirstPerson';

const data=readWeaponData(new TextDecoder('windows-1252').decode(readFileSync('public/play/world/files/data/weapon.dat')));
const mode=(type:number)=>firstPersonMode(type,nativeWeaponInfo(data,type,1));

test('weapon.dat flags the sniper rifle, both rocket launchers and the camera as first-person weapons',()=>{
 expect([34,35,36,43].map(mode)).toEqual(['sniper','rocket','rocketHs','camera']);
 for(const type of [22,24,25,29,30,31,33,37,38,41])expect(mode(type)).toBeUndefined();
});

test('WellBufferMe accelerates toward the target speed and never overshoots it',()=>{
 const v={current:70,speed:0};
 wellBufferMe(60,v,.5,.25,1);
 // Target speed −5; a quarter of the way there in one frame.
 expect(v.speed).toBeCloseTo(-1.25,6);expect(v.current).toBeCloseTo(68.75,6);
 const big={current:70,speed:0};wellBufferMe(60,big,.5,.25,10);
 expect(big.speed).toBe(-5);expect(big.current).toBe(20);
});

test('Process_Sniper zooms by wheel notches and held keys between 15 (camera 3) and 70; rockets stay at 70',()=>{
 const zoom=new FirstPersonZoom(),frame=50/30;
 expect(zoom.fov).toBe(70);
 zoom.update('sniper',frame,1);expect(zoom.target).toBe(60);expect(zoom.fov).toBeLessThan(70);
 for(let i=0;i<60;i++)zoom.update('sniper',frame);
 expect(Math.abs(zoom.fov-60)).toBeLessThanOrEqual(.5);
 // Notches past the limit leave the target beyond it; the FOV stops at 15.
 for(let i=0;i<10;i++){zoom.update('sniper',frame,1);for(let j=0;j<20;j++)zoom.update('sniper',frame);}
 expect(zoom.fov).toBe(15);
 // Held zoom out scales by (255 × TimeStep + 10000) / 10000 each frame.
 zoom.update('sniper',frame,0,-1);expect(zoom.fov).toBeCloseTo(15*(255*frame+10000)/10000,6);
 for(let i=0;i<200;i++)zoom.update('sniper',frame,0,-1);expect(zoom.fov).toBe(70);
 for(let i=0;i<400;i++)zoom.update('camera',frame,0,1);expect(zoom.fov).toBe(3);
 expect(zoom.update('rocket',frame,1)).toBe(70);
 zoom.reset();expect(zoom.fov).toBe(70);
});

test('first-person camera sources, angle limits and mouse rates follow Process_Rocket and Process_Sniper',()=>{
 expect(firstPersonSourceOffset('rocket',false)).toEqual({up:.1,forward:0,right:0});
 expect(firstPersonSourceOffset('sniper',false)).toEqual({up:.1,forward:-.19,right:0});
 expect(firstPersonSourceOffset('camera',true)).toEqual({up:.1,forward:-.5,right:-.18});
 expect(firstPersonAlphaRange('rocketHs').min).toBeCloseTo(-85.5*Math.PI/180,9);
 expect(firstPersonAlphaRange('sniper').min).toBeCloseTo(-89.5*Math.PI/180,9);
 expect(firstPersonAlphaRange('sniper').max).toBeCloseTo(60*Math.PI/180,9);
 const scale=firstPersonLookScale(35);expect(scale.yaw).toBeCloseTo(.6,9);expect(scale.pitch).toBeCloseTo(.5,9);
});
