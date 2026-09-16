import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readWeaponData,nativeWeaponInfo,nativeWeaponReloadMs} from '../src/weapons/weaponData';
import {stepNpcGun,type NpcGunState} from '../src/simulation/npcGun';
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
test('NPC shots cross native fire markers, consume magazines and pause for reload',()=>{
 const info=nativeWeaponInfo(data,22,3)!,state:NpcGunState={time:0,rounds:2,reload:0,active:false};
 const reload=nativeWeaponReloadMs(data,info)/1000;let shots=0,first=0;
 for(let i=0;i<300&&!state.reload;i++)if(stepNpcGun(state,info,reload,1/60,true)){shots++;first ||= (i+1)/60;}
 expect(shots).toBe(2);expect(first).toBeGreaterThanOrEqual(info.loop.fire);expect(first).toBeLessThan(info.loop.fire+1/60+.00001);
 expect(state.rounds).toBe(0);expect(state.reload).toBe(reload);
 expect(stepNpcGun(state,info,reload,reload,true)).toBe(false);expect(state.rounds).toBe(info.clip);
});
test('loss of target cancels the fire marker; weapon loops retain different cadence',()=>{
 const count=(id:number)=>{const info=nativeWeaponInfo(data,id,3)??nativeWeaponInfo(data,id)!;const state={time:0,rounds:10000,reload:0,active:false};let shots=0;
 for(let i=0;i<120;i++)shots+=Number(stepNpcGun(state,info,1,1/60,true));return shots;};
 expect(count(28)).toBeGreaterThan(count(22));
 const info=nativeWeaponInfo(data,22,3)!,state={time:info.loop.fire-.01,rounds:17,reload:0,active:true};
 expect(stepNpcGun(state,info,1,.02,false)).toBe(false);expect(state.time).toBe(0);expect(state.rounds).toBe(17);
});
