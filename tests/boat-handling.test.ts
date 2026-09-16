import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readHandling} from '../src/assets/handling';
import {readBoatHandling} from '../src/assets/boatHandling';

test('boat handling rows parse in InitFromData column order',()=>{
 const handling=readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8'));
 const rows=readBoatHandling(handling.supplements);
 expect(rows.size).toBe(12);
 const predator=rows.get('PREDATOR')!;
 expect([predator.thrustY,predator.thrustZ,predator.thrustAppZ]).toEqual([.79,.5,.6]);
 expect([predator.aqPlaneForce,predator.aqPlaneLimit,predator.aqPlaneOffset]).toEqual([7,.6,-1.9]);
 expect(predator.waveAudioMult).toBe(4);
 expect(predator.moveRes).toEqual([.8,.998,.998]);
 expect(predator.turnRes).toEqual([.85,.98,.97]);
 expect(predator.lookBehindCamHeight).toBe(4);
 for(const id of ['SQUALO','SPEEDER','REEFER','TROPIC','COASTGRD','DINGHY','MARQUIS','CUPBOAT','LAUNCH'])expect(rows.has(id)).toBe(true);
 expect(()=>readBoatHandling([{kind:'boat',line:1,tokens:['X','1']}])).toThrow();
 expect(()=>readBoatHandling([{kind:'boat',line:1,tokens:['X',...Array(14).fill('0'),'extra']}])).toThrow();
});
