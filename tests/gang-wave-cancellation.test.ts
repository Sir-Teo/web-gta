import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function deferred(){let resolve!:(value:any)=>void,reject!:(reason:any)=>void;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(){
 const defaults:any={character:{},characterSpeeds:{walk:1,run:2,sprint:3},characterStats:{attack:1,defend:1},armedWith:{weapon:22}},catalog:any={gangs:[['BALLAS1']]};
 for(const [name,value] of Object.entries(defaults))catalog[name]=vi.fn(async()=>value);
 const people:any[]=[],createPed=vi.fn((o:any)=>{const ped={...o,health:100};people.push(ped);return ped;});
 const host:any=Object.assign(Object.create(WorldPedestrians.prototype),{people,catalog,disposed:false,attackWaveGeneration:0,nearestNode:()=>({position:[0,0,0]}),sim:{world:{castRay:()=>({timeOfImpact:1})}},createPed,chooseTarget:vi.fn()});
 const spawn=(count=2,defenders=false)=>host.spawnAttackWave(0,count,{x:0,y:0,z:0},60,defenders);return {host,catalog,defaults,people,createPed,spawn};
}
test.each(['character','characterSpeeds','characterStats','armedWith'])('release during %s loading prevents late attackers',async stage=>{
 const {host,catalog,defaults,createPed,spawn}=fixture(),held=deferred();catalog[stage].mockImplementation(()=>held.promise);const pending=spawn();
 await vi.waitFor(()=>expect(catalog[stage]).toHaveBeenCalled());expect(host.releaseAttackWave(true)).toBe(0);held.resolve(defaults[stage]);expect(await pending).toBe(0);expect(createPed).not.toHaveBeenCalled();if(stage!=='armedWith')expect(catalog.armedWith).not.toHaveBeenCalled();
});
test('a partial wave releases its existing members and cannot finish the remaining load',async()=>{
 const {host,catalog,defaults,people,createPed,spawn}=fixture(),held=deferred();catalog.character.mockImplementationOnce(async()=>defaults.character).mockImplementationOnce(()=>held.promise);const pending=spawn(3);
 await vi.waitFor(()=>expect(catalog.character).toHaveBeenCalledTimes(2));expect(createPed).toHaveBeenCalledOnce();expect(host.releaseAttackWave(true)).toBe(1);expect(people[0]).toMatchObject({attackWave:false,retaliate:0});held.resolve(defaults.character);expect(await pending).toBe(1);expect(createPed).toHaveBeenCalledOnce();
});
test('a new wave can finish while an old generation is still loading',async()=>{
 const {host,catalog,defaults,people,spawn}=fixture(),held=deferred();catalog.character.mockImplementationOnce(()=>held.promise);const old=spawn();host.releaseAttackWave(false);expect(await spawn()).toBe(2);held.resolve(defaults.character);expect(await old).toBe(0);expect(people).toHaveLength(2);expect(people.every(p=>p.attackWave)).toBe(true);
});
test('a rejected old load cannot resume the remaining attackers',async()=>{
 const {host,catalog,createPed,spawn}=fixture(),held=deferred();catalog.character.mockImplementationOnce(()=>held.promise);const old=spawn(3);host.releaseAttackWave(false);held.reject(Error('old model unavailable'));expect(await old).toBe(0);expect(catalog.character).toHaveBeenCalledOnce();expect(createPed).not.toHaveBeenCalled();
});
test('the same release barrier cancels delayed defenders',async()=>{
 const {host,catalog,defaults,createPed,spawn}=fixture(),held=deferred();catalog.armedWith.mockImplementationOnce(()=>held.promise);const pending=spawn(3,true);await vi.waitFor(()=>expect(catalog.armedWith).toHaveBeenCalled());host.releaseAttackWave(false);held.resolve(defaults.armedWith);expect(await pending).toBe(0);expect(createPed).not.toHaveBeenCalled();
});
