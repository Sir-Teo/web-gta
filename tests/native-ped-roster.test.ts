import {expect,test} from 'vitest';
import {ZonePedRoster,GangPedRoster,GangCarRoster,GANG_CAR_GROUP_BASE,pedRace,raceAllowed,TOTAL_LOADED_PEDS,PED_STREAM_INTERVAL_FRAMES,GANG_STREAM_INTERVAL_FRAMES} from '../src/simulation/nativePedRoster';
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
test('an active gang keeps two of its three models resident and slides the pair every 550 frames',()=>{
 const gangs=[['ballas1','ballas2','ballas3'],['fam1','fam2','fam3']];
 const roster=new GangPedRoster(gangs,()=>0.99);
 expect(roster.resident(1)).toEqual([]);
 roster.update(0b10,1);
 // The first update spends the zeroed timer, so the cursor already sits on the second model.
 expect(roster.resident(1)).toEqual(['fam2','fam3']);expect(roster.resident(0)).toEqual([]);
 expect(roster.choose(1)).toBe('fam3');expect(roster.choose(0)).toBeUndefined();
 roster.update(0b10,GANG_STREAM_INTERVAL_FRAMES);
 expect(roster.resident(1)).toEqual(['fam2','fam3']);
 roster.update(0b11,1);
 expect(roster.resident(1)).toEqual(['fam3','fam1']);expect(roster.resident(0)).toEqual(['ballas3','ballas1']);
 roster.update(0b01,1);
 expect(roster.resident(1)).toEqual([]);expect(roster.loaded).toBe(1);
});
test('each active gang keeps one random eligible car model until the zone drops it',()=>{
 const carGroups=Array.from({length:34},(_,i)=>({models:i===GANG_CAR_GROUP_BASE+1?[492,516,412]:i===GANG_CAR_GROUP_BASE?[517,566]:[400]}));
 const roster=new GangCarRoster(carGroups,()=>0.6,id=>id!==516);
 roster.update(0b11);
 expect(roster.model(1)).toBe(412);expect(roster.model(0)).toBe(566);expect(roster.model(2)).toBeUndefined();
 roster.update(0b10);
 expect(roster.model(0)).toBeUndefined();expect(roster.model(1)).toBe(412);
 expect(roster.loaded).toEqual([[1,412]]);
});
test('a ped model\'s race comes from its first two letters and the zone race mask filters streaming and spawns',()=>{
 expect(pedRace('bmybu')).toBe(1);expect(pedRace('wmych')).toBe(2);expect(pedRace('omyst')).toBe(3);expect(pedRace('imylabo')).toBe(3);expect(pedRace('hmyri')).toBe(4);
 expect(pedRace('sbmocd')).toBe(1);expect(pedRace('vwmycd')).toBe(2);expect(pedRace('cwfyfr')).toBe(2);expect(pedRace('dnfolc1')).toBe(0);expect(pedRace('')).toBe(0);
 expect(raceAllowed('bmybu',0b0100)).toBe(false);expect(raceAllowed('omyst',0b0100)).toBe(true);expect(raceAllowed('dnfolc1',0b0100)).toBe(true);expect(raceAllowed('bmybu',undefined)).toBe(true);
 // Chinatown: only oriental models of the workers group stream, even though the group holds every race.
 const chinatown=[[['bmyst','omyst','wmyst','omykara'],['bmyst','omyst','wmyst','omykara'],['bmyst','omyst','wmyst','omykara']]];
 const roster=new ZonePedRoster(chinatown,()=>0.1);
 roster.update({zoneType:3,city:0,groups:[100],races:0b0100},1,()=>0);
 expect(roster.loaded.length).toBe(2);expect(roster.loaded.every(n=>n.startsWith('o'))).toBe(true);
 expect(roster.choose(()=>0)).toBeDefined();
 // The mask changing without a zone type change hides the resident models it no longer admits from spawns.
 roster.update({zoneType:3,city:0,groups:[100],races:0b0001},1,()=>0);
 expect(roster.choose(()=>0)).toBeUndefined();expect(roster.acceptable('omyst')).toBe(false);
});
