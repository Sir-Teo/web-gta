import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {nativeSaveEffects,readInitialSavePoints} from '../src/assets/scmSavePoints';

test('the INITIAL mission supplies the thirteen save points active in a new game',()=>{
 const points=readInitialSavePoints(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')));
 expect(points).toHaveLength(13);
 expect(points.map(p=>p.slot)).toEqual([...Array(13).keys()]);
 // Verdant Meadows is the only one outside an interior (interiors sit above 900).
 const outside=points.filter(p=>p.pickup[2]<900);
 expect(outside).toHaveLength(1);
 expect(outside[0].slot).toBe(2);
 expect(outside[0].pickup.map(v=>+v.toFixed(3))).toEqual([416.955,2538.813,9.508]);
 expect(outside[0].respawn.map(v=>+v.toFixed(3))).toEqual([418.076,2536.771,9.008]);
 expect(+outside[0].heading.toFixed(3)).toBe(269.289);
 expect(points.every(p=>Math.hypot(p.respawn[0]-p.pickup[0],p.respawn[1]-p.pickup[1])<6)).toBe(true);
});

test('saving restores health, clears the wanted level and passes six hours',()=>{
 expect(nativeSaveEffects({health:12,maxHealth:100,timeMinutes:22*60+30})).toEqual({health:100,timeMinutes:4*60+30,passedMinutes:360,wanted:0,stamina:100});
 // The native cap is 200 even for a raised maximum.
 expect(nativeSaveEffects({health:100,maxHealth:569,timeMinutes:0}).health).toBe(200);
});
