import {expect,test} from 'vitest';
import {ZonePedRoster,TOTAL_LOADED_PEDS,PED_STREAM_INTERVAL_FRAMES} from '../src/simulation/nativePedRoster';
import {readPopcycleGroups,POPCYCLE_GROUP_NAMES} from '../src/assets/pedGroups';

const groups=[[['w1','w2','w3'],['sw1','sw2'],['vw1']],[['b1','b2'],['b1','b2'],['b1','b2']]];
const weights=(a:number,b:number)=>{const g=Array(18).fill(0);g[0]=a;g[1]=b;return g;};

test('a new zone fills at least four slots from its weighted groups without repeating a model',()=>{
 let seed=1;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const roster=new ZonePedRoster(groups,random);
 roster.update({zoneType:3,city:0,groups:weights(50,50)},1,()=>0);
 expect(roster.loaded.length).toBe(4);expect(new Set(roster.loaded).size).toBe(4);
 for(const name of roster.loaded)expect([...groups[0][0],...groups[1][0]]).toContain(name);
});
test('the city picks the group variant and a slot is swapped only after 300 frames and only when unused',()=>{
 const roster=new ZonePedRoster(groups,()=>0.1);
 roster.update({zoneType:3,city:1,groups:weights(100,0)},1,()=>0);
 expect(roster.loaded.every(n=>n.startsWith('sw'))).toBe(true);
 // Both San Fierro workers are resident; nothing else is available for a swap, so the slots stay.
 const before=[...roster.slots];
 roster.update({zoneType:3,city:1,groups:weights(100,0)},PED_STREAM_INTERVAL_FRAMES+1,()=>0);
 expect(roster.slots).toEqual(before);
 // In Los Santos a third worker exists: after the interval the first unused slot takes it.
 const ls=new ZonePedRoster(groups,()=>0.1);
 ls.update({zoneType:3,city:0,groups:weights(100,0)},1,()=>0);
 ls.update({zoneType:3,city:0,groups:weights(100,0)},200,()=>0);
 const early=[...ls.slots];expect(ls.slots).toEqual(early);
 ls.update({zoneType:3,city:0,groups:weights(100,0)},200,name=>name==='w1'||name==='w2'?1:0);
 expect(ls.loaded.length).toBeLessThanOrEqual(TOTAL_LOADED_PEDS);
});
test('choose takes the resident model with the fewest living peds',()=>{
 const roster=new ZonePedRoster(groups,()=>0.9);
 roster.update({zoneType:0,city:0,groups:weights(0,100)},1,()=>0);
 const counts:Record<string,number>={b1:2,b2:0};
 expect(roster.choose(name=>counts[name]??0)).toBe('b2');
 expect(new ZonePedRoster(groups).choose(()=>0)).toBeUndefined();
});
test('readPopcycleGroups pairs each popcycle group with its three cities in file order',()=>{
 const text=['A, B # POPCYCLE_GROUP_WORKERS','C # POPCYCLE_GROUP_WORKERS (SF)','D # POPCYCLE_GROUP_WORKERS (VEGAS)',...POPCYCLE_GROUP_NAMES.slice(1).map(n=>`X_${n} # POPCYCLE_GROUP_${n}`),'G1 # Gang 1'].join('\n');
 const parsed=readPopcycleGroups(text);
 expect(parsed.length).toBe(18);expect(parsed[0]).toEqual([['a','b'],['c'],['d']]);expect(parsed[3]).toEqual([['x_farmers'],['x_farmers'],['x_farmers']]);
});
