import {expect,test} from 'vitest';
import {NativeHunger} from '../src/simulation/nativeHunger';
import {ScmStats,STAT_CALORIES} from '../src/engine/ScmGameState';
import {removeDriverFreebie,setDriverFreebie} from '../src/vehicle/nativeFreebies';

const body=(fat=0,muscle=0)=>{
 const log:string[]=[],state={fat,muscle,health:100};
 return {log,state,player:{fat:()=>state.fat,muscle:()=>state.muscle,decrementFat:(v:number)=>{state.fat=Math.max(0,state.fat-v);log.push('fat');},
  decrementMuscle:(v:number)=>{state.muscle=Math.max(0,state.muscle-v);log.push('muscle');},hurt:(v:number)=>{state.health-=v;log.push('hurt');},
  rumble:()=>log.push('rumble'),helpMessage:()=>log.push('NOTEAT')}};
};
const hours=(hunger:NativeHunger,from:number,count:number,player:any,never=false,blocked=false)=>{for(let h=from;h<from+count;h++)for(let f=0;f<3;f++)hunger.update(h%24,never,blocked,player);};

test('WorkOutEnergyFromHunger: 48 hours are free, then NOTEAT, then fat, then muscle a day later, then health',()=>{
 const hunger=new NativeHunger(),{log,state,player}=body(50,50);
 hours(hunger,0,49,player);
 expect(hunger.hoursDidntEat).toBe(48);expect(log).toEqual([]);
 hours(hunger,49,1,player);expect(log).toEqual(['rumble','NOTEAT']);
 log.length=0;hours(hunger,50,2,player);
 // Fat goes first, and muscle is spared until 24 hours after the first fat loss.
 expect(log).toEqual(['rumble','fat','rumble','fat']);expect(state.fat).toBe(0);
 log.length=0;hours(hunger,52,23,player);expect(log.filter(e=>e==='muscle')).toEqual([]);expect(state.health).toBe(100-2*23);
 log.length=0;hours(hunger,75,2,player);expect(log).toEqual(['rumble','muscle','rumble','muscle']);expect(state.muscle).toBe(0);
 log.length=0;hours(hunger,77,1,player);expect(log).toEqual(['rumble','hurt']);
});

test('the never-hungry cheat and a blocked frame count no hours',()=>{
 const hunger=new NativeHunger(),{player}=body();
 hours(hunger,0,10,player,true);expect(hunger.hoursDidntEat).toBe(0);
 hours(hunger,0,10,player,false,true);expect(hunger.hoursDidntEat).toBe(0);
});

test('food heals through the health stat, the rest turns to half as much fat, and a full meal ends hunger',()=>{
 const stats=new ScmStats(),player={health:70,max:100,ate:0};
 stats.player={health:()=>player.health,maxHealth:()=>player.max,addHealth:v=>{player.health=Math.min(player.max,player.health+v);},ateEnough:()=>{player.ate++;}};
 stats.increment(STAT_CALORIES,40);
 expect(player.health).toBe(100);expect(stats.get(21)).toBe(5);expect(player.ate).toBe(1);
 player.health=20;stats.increment(STAT_CALORIES,40);
 expect(player.health).toBe(60);expect(stats.get(21)).toBe(5);expect(player.ate).toBe(1);
});

test('CVehicle::SetDriver pays each freebie once, and the police car\'s shotgun comes as the player gets out',()=>{
 const taxi={modelId:420,freebies:true};
 expect(setDriverFreebie(taxi)).toEqual({kind:'money',amount:12});expect(setDriverFreebie(taxi)).toBeUndefined();
 expect(setDriverFreebie({modelId:416,freebies:true})).toEqual({kind:'health',amount:20});
 expect(setDriverFreebie({modelId:427,freebies:true})).toEqual({kind:'armour'});
 expect(setDriverFreebie({modelId:588,freebies:true})).toEqual({kind:'calories',amount:40});
 const cop={modelId:596,freebies:true};
 expect(setDriverFreebie(cop)).toBeUndefined();expect(removeDriverFreebie(cop)).toEqual({weapon:25,ammo:5});
 setDriverFreebie(cop);expect(removeDriverFreebie(cop)).toBeUndefined();
 const caddy={modelId:457,freebies:true};
 expect(removeDriverFreebie(caddy)).toBeUndefined();setDriverFreebie(caddy);expect(removeDriverFreebie(caddy)).toEqual({weapon:2,ammo:1});
 const plain={modelId:400,freebies:true};expect(setDriverFreebie(plain)).toBeUndefined();expect(plain.freebies).toBe(false);
});
