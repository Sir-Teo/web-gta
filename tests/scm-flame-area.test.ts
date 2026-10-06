import {expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===6)view.setFloat32(0,value,true);else view.setInt32(0,value,true);out.push(type,...bytes);}
 return out;
}
const f=(v:number)=>[6,v] as const,int=(v:number)=>[1,v] as const;
function asks(world:Partial<ScmWorldCommands>){
 const game=new ScmGameState(),space=new Uint8Array(512);
 // The strip from (0, 0) to (10, 0), 4 wide: IS_FLAME_IN_ANGLED_AREA_2D without the highlight.
 space.set(instruction(scmOpcode('IS_FLAME_IN_ANGLED_AREA_2D'),[f(0),f(0),f(10),f(0),f(4),int(0)]),0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread.condition;
}

test('IS_FLAME_IN_ANGLED_AREA_2D asks the flamethrower\'s shots, not the fires (iOS 0x1001deb00)',()=>{
 // The width is laid off to the left of the way from the first corner to the second: north here.
 expect(asks({flamethrowerShots:()=>[{x:5,y:2,z:3}]})).toBe(true);
 expect(asks({flamethrowerShots:()=>[{x:5,y:-2,z:3}]})).toBe(false);
 expect(asks({flamethrowerShots:()=>[{x:11,y:2,z:0}]})).toBe(false);
 expect(asks({})).toBe(false);
});
