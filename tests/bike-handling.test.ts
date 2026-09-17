import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readHandling} from '../src/assets/handling';
import {readBikeHandling} from '../src/assets/bikeHandling';

test('bike handling rows parse in InitFromData column order',()=>{
 const handling=readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8'));
 const rows=readBikeHandling(handling.supplements);
 expect(rows.size).toBe(13);
 const bmx=rows.get('BMX')!;
 expect([bmx.leanFwdCOM,bmx.leanFwdForce,bmx.leanBakCOM,bmx.leanBackForce]).toEqual([.35,.5,.3,.09]);
 expect([bmx.maxLean,bmx.fullAnimLean,bmx.desLean]).toEqual([48,43,.92]);
 expect([bmx.speedSteer,bmx.slipSteer,bmx.noPlayerCOMz]).toEqual([.6,1,.1]);
 expect([bmx.wheelieAng,bmx.stoppieAng,bmx.wheelieSteer]).toEqual([45,-35,-.007]);
 expect([bmx.wheelieStabMult,bmx.stoppieStabMult]).toEqual([1,.5]);
 for(const id of ['BIKE','MOPED','DIRTBIKE','FCR900','NRG500','HPV1000','BF400','WAYFARER','QUADBIKE','CHOPPERB','MTB','FREEWAY'])expect(rows.has(id)).toBe(true);
 expect(()=>readBikeHandling([{kind:'bike',line:1,tokens:['X','1']}])).toThrow();
 expect(()=>readBikeHandling([{kind:'bike',line:1,tokens:['X',...Array(15).fill('0'),'extra']}])).toThrow();
});
