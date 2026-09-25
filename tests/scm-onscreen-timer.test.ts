import {expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';
import {COUNTER_DOUBLE,COUNTER_LINE,HUD_COLOUR_LIGHT_BLUE,TIMER_DECREASE,TIMER_INCREASE} from '../src/engine/ScmOnscreenTimer';

function instruction(opcode:number,operands:readonly (readonly [number,number]|string)[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const operand of operands){
  // A text label is the eight-byte short string (type 9) the missions use.
  if(typeof operand==='string'){out.push(9,...[...operand.padEnd(8,'\0')].map(c=>c.charCodeAt(0)));continue;}
  const [type,value]=operand;
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const,global=(offset:number)=>[2,offset] as const,op=scmOpcode;
function run(game:ScmGameState,space:Uint8Array,...instructions:number[][]){
 space.fill(0,0,1024);space.set(instructions.flat(),0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
}

test('the timer commands name the global itself, and the clock counts it down a game frame at a time',()=>{
 const game=new ScmGameState(),space=new Uint8Array(2048),globals=new DataView(space.buffer);
 globals.setInt32(1024,15500,true);globals.setInt32(1028,7,true);globals.setInt32(1032,-3,true);
 run(game,space,
  instruction(op('DISPLAY_ONSCREEN_TIMER_WITH_STRING'),[global(1024),int(TIMER_DECREASE),'BB_19']),
  instruction(op('DISPLAY_NTH_ONSCREEN_COUNTER_WITH_STRING'),[global(1028),int(COUNTER_LINE),int(2),'BB_14']),
  instruction(op('DISPLAY_ONSCREEN_COUNTER_WITH_STRING'),[global(1032),int(COUNTER_DOUBLE),'ZER2_43']),
  instruction(op('SET_TIMER_BEEP_COUNTDOWN_TIME'),[global(1024),int(15)]));
 const timer=game.onscreenTimer;
 expect(timer.clock).toMatchObject({varId:1024,textKey:'BB_19',direction:TIMER_DECREASE,beepCountdownSecs:15});
 // The Nth counter is one-based; the plain one is slot 0.
 expect(timer.counters[1]).toMatchObject({varId:1028,type:COUNTER_LINE,textKey:'BB_14',flashWhenFirstDisplayed:true,colourId:HUD_COLOUR_LIGHT_BLUE});
 expect(timer.counters[0].varId).toBe(1032);
 timer.processForDisplay(globals);
 expect(timer.clock.displayed).toBe('00:15');expect(timer.counters[1].displayed).toBe('7');expect(timer.counters[0].displayed).toBe('0 / -3');
 // 33 whole milliseconds a 30 fps frame; under the beep seconds a frame reports the count, unless widescreen is on.
 let beeps=0;
 timer.process(globals,33.3,false,()=>beeps++);expect(globals.getInt32(1024,true)).toBe(15467);expect(beeps).toBe(0);
 globals.setInt32(1024,14999,true);timer.process(globals,33.3,false,()=>beeps++);expect(beeps).toBe(1);
 timer.process(globals,33.3,true,()=>beeps++);expect(beeps).toBe(1);
 // Frozen, it does not move.
 run(game,space,instruction(op('FREEZE_ONSCREEN_TIMER'),[int(1)]));
 const frozen=globals.getInt32(1024,true);timer.process(globals,33,false,()=>{});expect(globals.getInt32(1024,true)).toBe(frozen);
 run(game,space,instruction(op('FREEZE_ONSCREEN_TIMER'),[int(0)]));
 // Running out leaves the variable at 0 and frees the clock.
 globals.setInt32(1024,20,true);timer.process(globals,33,false,()=>{});
 expect(globals.getInt32(1024,true)).toBe(0);expect(timer.clock.varId).toBe(0);
 // A counting-up clock, then the clears by variable.
 run(game,space,instruction(op('DISPLAY_ONSCREEN_TIMER'),[global(1024),int(TIMER_INCREASE)]));
 timer.process(globals,50,false,()=>{});expect(globals.getInt32(1024,true)).toBe(50);
 run(game,space,instruction(op('CLEAR_ONSCREEN_TIMER'),[global(1024)]),instruction(op('CLEAR_ONSCREEN_COUNTER'),[global(1028)]));
 expect(timer.clock.varId).toBe(0);expect(timer.counters[1].varId).toBe(0);expect(timer.counters[0].varId).toBe(1032);
 timer.processForDisplay(globals);expect(timer.display).toBe(true);
 run(game,space,instruction(op('CLEAR_ONSCREEN_COUNTER'),[global(1032)]));timer.processForDisplay(globals);expect(timer.display).toBe(false);
});
