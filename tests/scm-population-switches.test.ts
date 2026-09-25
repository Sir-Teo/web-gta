import {expect,test} from 'vitest';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {scmOpcode} from '../src/engine/scmOpcodes';
import {newPedTypeOrder} from '../src/assets/populationCycle';

function run(game:ScmGameState,...calls:[string,number][]){
 const out:number[]=[];
 for(const [name,value] of calls){const op=scmOpcode(name),b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,value,true);out.push(op&0xff,op>>8&0xff,1,...b);}
 const space=new Uint8Array(128);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,calls.length);}catch(error){if(!String(error).includes('watchdog'))throw error;}
}

test('the random-creation switches are the engine’s own, off meaning don’t',()=>{
 const game=new ScmGameState();
 expect(game.population).toEqual({dontCreateRandomGangMembers:false,dontCreateRandomCops:false,onlyCreateRandomGangMembers:false});
 run(game,['SET_CREATE_RANDOM_GANG_MEMBERS',0],['SET_CREATE_RANDOM_COPS',0],['SWITCH_RANDOM_TRAINS',0],['SET_ONLY_CREATE_GANG_MEMBERS',1],['SET_GANG_WARS_TRAINING_MISSION',1]);
 expect(game.population).toEqual({dontCreateRandomGangMembers:true,dontCreateRandomCops:true,onlyCreateRandomGangMembers:true});
 expect(game.gangWarsTrainingMission).toBe(true);
 expect(game.disableRandomTrains).toBe(true);
 run(game,['SET_CREATE_RANDOM_GANG_MEMBERS',1],['SWITCH_RANDOM_TRAINS',1]);
 expect(game.population.dontCreateRandomGangMembers).toBe(false);expect(game.disableRandomTrains).toBe(false);
});

test('FindNewPedType gives gangs a chance of -10 while they are not to be created',()=>{
 const targets={other:5,cops:0,dealers:0,gangs:10} as any,living={civilians:0,cops:0,dealers:0,gangs:0};
 expect(newPedTypeOrder(targets,living,()=>1)[0]).toBe('gang');
 expect(newPedTypeOrder(targets,living,()=>1,{gangs:true})).not.toContain('gang');
});

test('only gang members: the gangs\' chance is 50, refusing them still wins, and a failed gang makes nobody',()=>{
 const targets={other:30,cops:0,dealers:0,gangs:0} as any,living={civilians:0,cops:0,dealers:0,gangs:5};
 expect(newPedTypeOrder(targets,living,()=>1)).toEqual(['civilian']);
 expect(newPedTypeOrder(targets,living,()=>1,{onlyGangs:true})).toEqual(['gang']);
 expect(newPedTypeOrder(targets,living,()=>1,{onlyGangs:true,gangs:true})).toEqual(['civilian']);
 // A civilian chance past 50 still comes first, and the gang is the last one tried.
 expect(newPedTypeOrder({other:60,cops:0,dealers:3,gangs:0} as any,{civilians:0,cops:0,dealers:0,gangs:0},()=>1,{onlyGangs:true})).toEqual(['civilian','gang']);
});
