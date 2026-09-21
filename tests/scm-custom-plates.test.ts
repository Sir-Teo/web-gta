import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {scmOpcode} from '../src/engine/scmOpcodes';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function run(bytes:Uint8Array,game:ScmGameState){
 const header=readScmHeader(file());
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands,objectNames:header.objectNames};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
function plateCommand(opcode:number,model:number,text?:string,design?:number){
 const tail=text===undefined?5:2+text.length;
 const bytes=new Uint8Array(2+5+tail);
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 bytes[2]=1;view.setInt32(3,model,true);
 if(text===undefined){bytes[7]=1;view.setInt32(8,design!,true);}
 else{bytes[7]=14;bytes[8]=text.length;for(let i=0;i<text.length;i++)bytes[9+i]=text.charCodeAt(i);}
 return bytes;
}

describe('the plates a script puts on the next car',()=>{
 test('the plate text is cut to the eight characters the field holds',()=>{
  const game=new ScmGameState();
  run(plateCommand(scmOpcode('CUSTOM_PLATE_FOR_NEXT_CAR'),400,'SANANDREAS'),game);
  expect(game.customPlates.get(400)?.text).toBe('SANANDRE');
 });

 test('a short plate is kept as it is, and the design sits beside it',()=>{
  const game=new ScmGameState();
  run(plateCommand(scmOpcode('CUSTOM_PLATE_FOR_NEXT_CAR'),401,'CJ1'),game);
  run(plateCommand(scmOpcode('CUSTOM_PLATE_DESIGN_FOR_NEXT_CAR'),401,undefined,2),game);
  expect(game.customPlates.get(401)).toEqual({text:'CJ1',design:2});
 });

 test('each model keeps its own plate',()=>{
  const game=new ScmGameState();
  run(plateCommand(scmOpcode('CUSTOM_PLATE_FOR_NEXT_CAR'),400,'ONE'),game);
  run(plateCommand(scmOpcode('CUSTOM_PLATE_FOR_NEXT_CAR'),401,'TWO'),game);
  expect(game.customPlates.get(400)?.text).toBe('ONE');
  expect(game.customPlates.get(401)?.text).toBe('TWO');
  expect(game.customPlates.size).toBe(2);
 });
});
