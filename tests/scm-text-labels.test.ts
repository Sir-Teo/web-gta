import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else if(type===6){view.setFloat32(0,value,true);out.push(6,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
/** A short text-label variable, which is the kind the script really passes to these three commands. */
const label8=(offset:number)=>[10,offset] as const;
/** The long form, sixteen bytes, which one of the three uses. */
const label16=(offset:number)=>[16,offset] as const;
function run(world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,8);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,label:(offset:number)=>{
  const bytes=space.subarray(offset,offset+8),zero=bytes.indexOf(0);
  return String.fromCharCode(...(zero<0?bytes:bytes.subarray(0,zero)));
 },raw:(offset:number)=>[...space.subarray(offset,offset+8)]};
}
const op=scmOpcode;

describe('the three names the game hands back as text labels',()=>{
 test('a zone name is written into the variable as an eight-character label',()=>{
  const asked:number[][]=[];
  const {label}=run({getNameOfZone:(x:number,y:number,z:number)=>{asked.push([x,y,z]);return 'LAN';}},
   instruction(op('GET_NAME_OF_ZONE'),[float(10),float(20),float(3),label8(40)]));
  expect(asked).toEqual([[10,20,3]]);
  expect(label(40)).toBe('LAN');
 });

 test('a name shorter than the label is padded with nothing, not left as it was',()=>{
  const space=run({getNameOfZone:()=>'AB'},
   instruction(op('GET_NAME_OF_ZONE'),[float(0),float(0),float(0),label8(40)]));
  expect(space.raw(40)).toEqual([65,66,0,0,0,0,0,0]);
 });

 test('a name of the full width fills the label and needs no terminator',()=>{
  const {raw,label}=run({getNameOfZone:()=>'ABCDEFGH'},
   instruction(op('GET_NAME_OF_ZONE'),[float(0),float(0),float(0),label8(40)]));
  expect(raw(40)).toEqual([65,66,67,68,69,70,71,72]);
  expect(label(40)).toBe('ABCDEFGH');
 });

 test('a name longer than the label is cut to it',()=>{
  const {raw}=run({getNameOfZone:()=>'ABCDEFGHIJ'},
   instruction(op('GET_NAME_OF_ZONE'),[float(0),float(0),float(0),label8(40)]));
  expect(raw(40)).toEqual([65,66,67,68,69,70,71,72]);
 });

 test('the entry-exit and the loaded shop write their own names',()=>{
  const entry=run({getNameOfEntryExitCharUsed:()=>'AMMU'},
   instruction(op('GET_NAME_OF_ENTRY_EXIT_CHAR_USED'),[int(7),label16(40)]));
  expect(entry.label(40)).toBe('AMMU');
  const shop=run({getLoadedShop:()=>'BINCO'},instruction(op('GET_LOADED_SHOP'),[label8(40)]));
  expect(shop.label(40)).toBe('BINCO');
 });
});
