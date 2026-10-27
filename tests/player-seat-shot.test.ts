import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {playerBikeHit,playerSeatHeadHit} from '../src/vehicle/playerSeatShot';
import {ScmMission} from '../src/simulation/ScmMission';

const seat={body:{handle:12},head:{x:0,y:1,z:-8},canBeShot:true},from={x:0,y:1.1,z:0},direction={x:0,y:0,z:-1};
test('CJ uses the native head handoff only after his own vehicle is the first body hit',()=>{
 expect(playerSeatHeadHit(seat,from,direction,10,{handle:12},{handle:13})?.t).toBeCloseTo(7.8,8);
 expect(playerSeatHeadHit(seat,from,direction,10,{handle:99},{handle:13})).toBeUndefined();
 expect(playerSeatHeadHit(seat,from,direction,10,undefined,{handle:13})).toBeUndefined();
 expect(playerSeatHeadHit(seat,from,direction,7.7,{handle:12},{handle:13})).toBeUndefined();
});
test('shot protection, a missed head, an absent player seat and the shooter’s own vehicle prevent the handoff',()=>{
 expect(playerSeatHeadHit({...seat,canBeShot:false},from,direction,10,{handle:12},{handle:13})).toBeUndefined();
 expect(playerSeatHeadHit(seat,{...from,y:3},direction,10,{handle:12},{handle:13})).toBeUndefined();
 expect(playerSeatHeadHit(undefined,from,direction,10,{handle:12},{handle:13})).toBeUndefined();
 expect(playerSeatHeadHit(seat,from,direction,10,{handle:12},{handle:12})).toBeUndefined();
 expect(playerSeatHeadHit(seat,from,direction,10,{handle:12},{car:{body:{handle:12}}})).toBeUndefined();
});
test('CJ’s direct bike collision uses the nearest animated piece before cover, including a limb shielding the head',()=>{
 const spheres=vi.fn(()=>[{center:{x:0,y:1.1,z:-8},radius:.15,piece:9},{center:{x:0,y:1.1,z:-7},radius:.14,piece:5}]),target={body:seat.body,canBeShot:true,spheres};
 const hit=playerBikeHit(target,from,direction,10,{handle:13});expect(hit?.piece).toBe(5);expect(hit?.t).toBeCloseTo(6.86,8);
 expect(playerBikeHit(target,from,direction,6.8,{handle:13})).toBeUndefined();
 expect(playerBikeHit(target,{...from,x:.3},direction,10,{handle:13})).toBeUndefined();
});
test('protected, absent and own-bike targets do not sample the player skeleton',()=>{
 const spheres=vi.fn(()=>[]),target={body:seat.body,canBeShot:true,spheres};
 expect(playerBikeHit(undefined,from,direction,10,{handle:13})).toBeUndefined();
 expect(playerBikeHit({...target,canBeShot:false},from,direction,10,{handle:13})).toBeUndefined();
 expect(playerBikeHit(target,from,direction,10,{handle:12})).toBeUndefined();
 expect(playerBikeHit(target,from,direction,10,{car:{body:{handle:12}}})).toBeUndefined();
 expect(spheres).not.toHaveBeenCalled();
});
test('SET_CHAR_CAN_BE_SHOT_IN_VEHICLE on CJ uses the player flag without looking in the NPC pool',()=>{
 const setFlag=vi.fn(),m=new ScmMission(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),{infoLabels:['TEST'],population:[]} as any,{setScriptPedFlag:setFlag} as any),world=m.runtime.world!;
 expect(m.playerCanBeShotInVehicle).toBe(true);
 const int=(n:number)=>[1,n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255],code=new Uint8Array([0x4a,5,...int(1),...int(0),0x4e,0]);
 const thread=m.runtime.start(0,[],{space:code,mission:true}).thread;thread.usesMissionCleanup=false;thread.run(1000,100,1);
 expect(m.playerCanBeShotInVehicle).toBe(false);expect(setFlag).not.toHaveBeenCalled();
 world.setPedCanBeShotInVehicle!(1,true);expect(m.playerCanBeShotInVehicle).toBe(true);
 const npc={};vi.spyOn(m.peds,'entity').mockImplementation(h=>h===17?npc:undefined);world.setPedCanBeShotInVehicle!(17,false);expect(setFlag).toHaveBeenCalledExactlyOnceWith(npc,'canBeShotInVehicle',false);
});
