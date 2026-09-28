import {expect,test} from 'vitest';
import {deadPedMoney,moneyWads,pedMoneyCount} from '../src/simulation/MoneyDrops';
import {readPedGroups} from '../src/assets/pedGroups';
import {readFileSync} from 'node:fs';

const sequence=(...values:number[])=>{let i=0;return ()=>values[i++%values.length];};
test('m_nMoneyCount: 3% carry 400, business and rich peds 20–69, others 0–24',()=>{
 expect(pedMoneyCount(sequence(.01),false)).toBe(400);
 expect(pedMoneyCount(sequence(.5,0),true)).toBe(20);expect(pedMoneyCount(sequence(.5,.99999),true)).toBe(0xffff%50+20);
 expect(pedMoneyCount(sequence(.5,.99999),false)).toBe(0xffff%25);
});
test('CreateDeadPedMoney skips cops, medics, firemen and small change',()=>{
 expect(deadPedMoney({money:40,pedType:'CIVMALE'})).toBe(40);
 expect(deadPedMoney({money:10,pedType:'CIVMALE'})).toBe(0);
 // A script's ped drops only money SET_CHAR_MONEY gave it (bMoneyHasBeenGivenByScript).
 expect(deadPedMoney({money:40,pedType:'CIVMALE',mission:true})).toBe(0);
 expect(deadPedMoney({money:500,pedType:'CIVMALE',mission:true,moneyByScript:true})).toBe(500);
 expect(deadPedMoney({money:400,officer:true})).toBe(0);
 expect(deadPedMoney({money:400,pedType:'MEDIC'})).toBe(0);expect(deadPedMoney({money:400,pedType:'FIREMAN'})).toBe(0);
});
test('CreateSomeMoney splits into at most seven wads 1.5 apart',()=>{
 const wads=moneyWads({x:0,y:0,z:0},400,sequence(.25,0,0));
 expect(wads).toHaveLength(7);expect(wads.every(w=>w.value>=57&&w.value<=60)).toBe(true);
 expect(moneyWads({x:0,y:0,z:0},35,Math.random)).toHaveLength(2);
 // Each step takes the sine of one random angle across x and the cosine of another across y (native y is browser −z).
 expect(wads[0].position.x).toBeCloseTo(1.5);expect(wads[0].position.z).toBeCloseTo(-1.5);
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('pedgrp.dat marks the business and casual-rich models',()=>{
 const groups=readPedGroups(readFileSync(`${process.env.GTA_CONTENT_DIR}/data/pedgrp.dat`,'latin1'));
 expect(groups.rich.has('bmyri')).toBe(true);expect(groups.rich.has('wmybu')).toBe(true);expect(groups.rich.has('bmydj')).toBe(false);
});
test('clearing an area removes the cash in it, and passed time ages the rest out',async()=>{
 const {MoneyDrops}=await import('../src/simulation/MoneyDrops');
 const money=new MoneyDrops({add(){}},'money-test:',()=>0,sequence(.25,0,0));
 money.drop({x:0,y:0,z:0},40);money.drop({x:60,y:0,z:0},40);
 const far=money.snapshot().filter(w=>w.position.x>30).length;
 money.removeInSphere({x:0,y:0,z:0},10);
 expect(money.snapshot()).toHaveLength(far);
 money.passTime(360);money.step(0,{position:{x:0,y:0,z:100},alive:true,onFoot:true});
 expect(money.snapshot()).toEqual([]);
});
