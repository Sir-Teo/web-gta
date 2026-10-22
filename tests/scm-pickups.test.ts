import {readFile} from 'node:fs/promises';
import {expect,test} from 'vitest';
import {readIdeAssociations} from '../src/assets/ide';
import {INTERIOR_HEIGHT,PICKUP_TYPE,readInitialPickups} from '../src/assets/scmPickups';
const definitions=async()=>(await Promise.all(['data/default.ide','ide/generic/dynamic.ide','ide/generic/multiobj.ide','ide/interior/propext.ide','ide/leveldes/levelxre.ide'].map(async p=>readIdeAssociations(await readFile(`public/play/world/files/${p}`,'utf8'))))).flat();
test('new-game pickups come from MAIN initialization, INITIAL and INITIL2 with resolved models and positions',async()=>{
 const {pickups,skipped}=readInitialPickups(new Uint8Array(await readFile('public/play/world/files/scripts/main.scm')),await definitions());
 const count=(category:string)=>pickups.filter(p=>p.category===category).length;
 console.log(JSON.stringify({total:pickups.length,skipped:skipped.length,categories:Object.fromEntries([...new Set(pickups.map(p=>p.category))].map(c=>[c,count(c)]))}));
 console.log(JSON.stringify(skipped));expect(skipped).toEqual([]);
 expect(count('horseshoe')).toBe(50);expect(count('oyster')).toBe(50);expect(count('snapshot')).toBe(50);expect(count('bribe')).toBe(49);
 expect(pickups.filter(p=>p.category==='weapon'&&p.type===PICKUP_TYPE.onStreetSlow).length).toBeGreaterThan(200);
 const pistol=pickups.find(p=>p.category==='weapon'&&p.model==='colt45');expect(pistol).toBeDefined();
 const armour=pickups.find(p=>p.category==='armour');expect(armour?.modelId).toBe(1242);expect(armour?.dictionary).toBe('icons7');
 expect(pickups.filter(p=>p.category==='save'&&p.position[2]<INTERIOR_HEIGHT).map(p=>p.position.map(v=>Math.round(v)))).toEqual([[417,2539,10]]);
 const verdant=pickups.find(p=>p.category==='save'&&p.position[2]<INTERIOR_HEIGHT)!;expect(verdant.position).toEqual([416.875,2538.75,9.5]);expect(verdant.id).toBe('1277:417.0,2538.8,9.5');
 expect(pickups.find(p=>p.category==='propertyForSale')?.price).toBeGreaterThan(0);
 expect(new Set(pickups.map(p=>p.id)).size).toBe(pickups.length);
});
