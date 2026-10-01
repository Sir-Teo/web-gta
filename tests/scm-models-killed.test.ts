import {expect,test} from 'vitest';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {scmOpcode} from '../src/engine/scmOpcodes';

function ask(game:ScmGameState,model:number,reset=false){
 const int=(v:number)=>{const b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,v,true);return [1,...b];};
 const get=scmOpcode('GET_NUM_OF_MODELS_KILLED_BY_PLAYER'),res=scmOpcode('RESET_NUM_OF_MODELS_KILLED_BY_PLAYER');
 // The count lands in global variable 8 (type 2 is a global, by byte offset).
 const code=[...(reset?[res&0xff,res>>8&0xff,...int(0)]:[]),get&0xff,get>>8&0xff,...int(0),...int(model),2,8,0];
 const space=new Uint8Array(256);space.set(code,64);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,64,0,undefined,host);
 try{thread.run(0,reset?2:1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return new DataView(space.buffer).getInt32(8,true);
}

test('CDarkel counts each model the player kills or blows up, until the script resets the count',()=>{
 const game=new ScmGameState();
 expect(ask(game,459)).toBe(0);
 game.registerKill(459);game.registerKill(459);game.registerKill(400);
 expect(ask(game,459)).toBe(2);expect(ask(game,400)).toBe(1);
 // CDarkel::FindTotalPedsKilledByPlayer sums every model (GET_TOTAL_NUMBER_OF_PEDS_KILLED_BY_PLAYER).
 expect(game.totalPedsKilledByPlayer()).toBe(3);
 expect(ask(game,459,true)).toBe(0);
 expect(game.totalPedsKilledByPlayer()).toBe(0);
});

test('SWITCH_CAR_GENERATOR on a slot nothing set up changes an unused generator and fails nothing',()=>{
 const game=new ScmGameState();
 expect(game.carGenerators.at(42).used).toBe(false);
 expect(()=>game.carGenerators.switch(42,101,0)).not.toThrow();
 expect(()=>game.carGenerators.at(500)).toThrow(/out of range/);
});
