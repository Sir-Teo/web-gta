import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readIpl} from '../src/assets/ipl';
import {NativeAudioZones} from '../src/audio/nativeAudioZones';

const zones=readIpl(readFileSync('public/play/world/files/ipl/Audiozon.ipl')).audioZones!;

test('Audiozon.ipl carries 152 boxes and the three script spheres, all switched off',()=>{
 expect(zones.filter(z=>z.box).length).toBe(152);
 expect(zones.filter(z=>z.sphere).map(z=>[z.name,z.id,z.active])).toEqual([['AWARDS',10,false],['BEACH',5,false],['LOWRIDE',13,false]]);
 // "Fdpiza , 44": LoadLine turns commas to spaces, so the stray space is harmless.
 expect(zones.find(z=>z.name==='Fdpiza')?.id).toBe(44);
});

test('CAudioZones::Update lists the active zones round the point every 16th frame or after 20 units of travel',()=>{
 const a=new NativeAudioZones();a.load(zones);
 const beach=a.spheres.find(s=>s.name==='BEACH')!;
 a.update(true,[beach.center[0],beach.center[1],beach.center[2]],0);expect(a.activeIds).toEqual([]);
 a.switch('beach',true);
 // Not forced, frame 5, the same point: no update.
 a.update(false,[beach.center[0],beach.center[1],beach.center[2]],5);expect(a.activeIds).toEqual([]);
 a.update(false,[beach.center[0],beach.center[1],beach.center[2]],6);expect(a.activeIds).toEqual([5]);
 // 89.48 units of radius: just outside, but 20 units of travel make it look again.
 a.update(false,[beach.center[0]+89.5,beach.center[1],beach.center[2]],7);expect(a.activeIds).toEqual([]);
 // The OTB box, its corners kept to an eighth of a unit (truncated).
 const otb=a.boxes.find(b=>b.name==='OTB')!;expect(otb.min[0]).toBe(817);expect(otb.min[1]).toBe(-2.75);
 a.update(true,[820,0,1005],0);expect(a.activeIds).toEqual([24]);
});
