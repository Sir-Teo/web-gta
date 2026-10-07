import {afterEach,expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {CHEATS} from '../src/simulation/nativeCheats';

// CPopulation::AddPed's cheat weapons, through the crowd's helper with its giveWeapon recorded.
const arm=(pedType:string,officer=false)=>{
 const given:[number,number][]=[];
 const self=Object.assign(Object.create(WorldPedestrians.prototype),{giveWeapon:(_p:unknown,type:number,ammo:number)=>{given.push([type,ammo]);}});
 (WorldPedestrians.prototype as any).armForCheats.call(self,{pedType,officer});
 return given;
};
afterEach(()=>{CHEATS.reset();});

test('everyone armed gives a civilian one of five weapons with 25001 rounds, and nobody else anything',()=>{
 expect(arm('CIVMALE')).toEqual([]);
 CHEATS.enable('everyoneArmed');
 for(let i=0;i<20;i++){const [[type,ammo]]=arm(i%2?'CIVMALE':'CIVFEMALE');expect([22,5,25,31,35]).toContain(type);expect(ammo).toBe(25001);}
 expect(arm('GANG1')).toEqual([]);expect(arm('PROSTITUTE')).toEqual([]);expect(arm('CIVMALE',true)).toEqual([]);
});

test('the golf club cheat arms civilians the same way',()=>{
 CHEATS.enable('pedsAttackOther');
 const [[type]]=arm('CIVFEMALE');expect([22,5,25,31,35]).toContain(type);
});

test('the slut magnet gives a prostitute a dildo or a vibrator with one round',()=>{
 expect(arm('PROSTITUTE')).toEqual([]);
 CHEATS.enable('loveConquersAll');
 for(let i=0;i<10;i++){const [[type,ammo]]=arm('PROSTITUTE');expect([10,11,12,13]).toContain(type);expect(ammo).toBe(1);}
 expect(arm('CIVMALE')).toEqual([]);
});
