import {expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function run(game:ScmGameState,name:string,ints:number[],world:Partial<ScmWorldCommands>={}){
 const opcode=scmOpcode(name),out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const v of ints){const b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,v,true);out.push(1,...b);}
 // A trailing local variable for a command that writes an answer.
 out.push(3,0,0);
 const space=new Uint8Array(256);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}

test('the engine’s own switches take the script’s word',()=>{
 const g=new ScmGameState();
 run(g,'SWITCH_AMBIENT_PLANES',[0]);expect(g.ambientPlanes).toBe(false);
 run(g,'SWITCH_STREAMING',[0]);expect(g.disableStreaming).toBe(true);
 run(g,'SET_AREA51_SAM_SITE',[0]);expect(g.area51SamSite).toBe(false);
 run(g,'CAN_TRIGGER_GANG_WAR_WHEN_ON_A_MISSION',[1]);expect(g.canTriggerGangWarWhenOnAMission).toBe(true);
 run(g,'SET_MESSAGE_FORMATTING',[1,20,300]);expect(g.messageFormatting).toEqual({on:true,margin:20,width:300});
});
test('STORE_WANTED_LEVEL reads the player’s wanted level',()=>{
 const g=new ScmGameState();g.wanted.setWantedLevel(3);
 const thread=run(g,'STORE_WANTED_LEVEL',[0]);
 expect(new DataView(thread.locals.buffer).getInt32(0,true)).toBe(3);
});
test('GET_GROUP_SIZE writes the leader count, then the members besides',()=>{
 const g=new ScmGameState();
 const opcode=scmOpcode('GET_GROUP_SIZE'),bytes=[opcode&0xff,opcode>>8&0xff,1,5,0,0,0,3,0,0,3,1,0];
 const space=new Uint8Array(64);space.set(bytes,0);
 const host:ScmThreadHost={startScript(){},game:g,world:{fade(){},groupSize:()=>({leader:1,members:3})} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(thread.locals.buffer);
 expect([view.getInt32(0,true),view.getInt32(4,true)]).toEqual([1,3]);
});
