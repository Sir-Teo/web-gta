import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {BUTTON,BUTTON_ORDER,CONTROLLER_JOYPAD,ScmPads} from '../src/engine/ScmPads';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:{fade(){}} as ScmWorldCommands};
 return new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 const found=blocks.flat().find(i=>i.name===name&&i.parameters.every(p=>[1,4,5,6].includes(p.type)));
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('the pad a script reads',()=>{
 test('every button id indexes the field GetPadState switches to',()=>{
  expect(BUTTON_ORDER).toHaveLength(20);
  expect(BUTTON_ORDER[BUTTON.leftStickX]).toBe('leftStickX');
  expect(BUTTON_ORDER[BUTTON.cross]).toBe('cross');
  expect(BUTTON_ORDER[BUTTON.rightShock]).toBe('rightShock');
  const pads=new ScmPads();
  pads.set(0,'circle',255);
  expect(pads.state(0,BUTTON.circle)).toBe(255);
  expect(pads.state(0,BUTTON.cross)).toBe(0);
  // An id past the end falls through the switch and reads as nothing.
  expect(pads.state(0,99)).toBe(0);
 });

 test('a button held while the menu closed does not count as pressed',()=>{
  const pads=new ScmPads();
  pads.set(0,'start',255);
  expect(pads.isPressed(0,BUTTON.start)).toBe(true);
  pads.justOutOfFrontEnd=true;
  expect(pads.isPressed(0,BUTTON.start)).toBe(false);
  expect(pads.state(0,BUTTON.start)).toBe(255);
 });

 test('the two pads keep their own state',()=>{
  const pads=new ScmPads();
  pads.set(1,'leftStickX',-128);
  expect(pads.state(1,BUTTON.leftStickX)).toBe(-128);
  expect(pads.state(0,BUTTON.leftStickX)).toBe(0);
  pads.clear(1);
  expect(pads.state(1,BUTTON.leftStickX)).toBe(0);
  expect(()=>pads.state(2,0)).toThrow('Pad index');
 });

 test('the script’s own IS_BUTTON_PRESSED reads the button it names',()=>{
  const {bytes,instruction}=find('IS_BUTTON_PRESSED'),game=new ScmGameState();
  const pad=instruction.parameters[0].value as number,button=instruction.parameters[1].value as number;
  const negated=(instruction.opcode&0x8000)!==0;
  const quiet=threadAt(bytes,instruction.offset,game);runOne(quiet);
  expect(quiet.condition).toBe(negated);
  game.pads.set(pad,BUTTON_ORDER[button],255);
  const pressed=threadAt(bytes,instruction.offset,game);runOne(pressed);
  expect(pressed.condition).toBe(!negated);
 });

 test('the options the script can ask about answer from the pad state',()=>{
  const game=new ScmGameState();
  expect(game.pads.controlMethod).not.toBe(CONTROLLER_JOYPAD);
  game.pads.controlMethod=CONTROLLER_JOYPAD;
  game.pads.invertMouseY=true;
  game.pads.mouseMoved={x:3,y:-4};
  expect(game.pads.controlMethod).toBe(CONTROLLER_JOYPAD);
  expect(game.pads.invertMouseY).toBe(true);
  expect(game.pads.mouseMoved).toEqual({x:3,y:-4});
 });
});
