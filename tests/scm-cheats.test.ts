import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {CAR_CHEATS,CHEAT_ALL_TAXIS_NITRO,CHEAT_BOATS_FLY,CHEAT_CARS_ON_WATER,CHEAT_PERFECT_HANDLING,
 CHEAT_PROSTITUTES_PAY_YOU,TOTAL_CHEATS} from '../src/engine/ScmCheats';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** One instruction, with int32 operands, run over a fresh script space. */
function run(opcode:number,values:number[],game:ScmGameState,nowMs=0){
 const bytes=[opcode&0xff,opcode>>8&0xff];
 for(const value of values){
  const operand=new Uint8Array(4);new DataView(operand.buffer).setInt32(0,value,true);
  bytes.push(1,...operand);
 }
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(new Uint8Array(bytes),0,0,undefined,host);
 try{thread.run(nowMs,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}

describe('the cheat flags a script switches and asks about',()=>{
 test('the two cheats the script owns are entries of the one table',()=>{
  const game=new ScmGameState();
  run(scmOpcode('SET_ALL_TAXIS_HAVE_NITRO'),[1],game);
  run(scmOpcode('ACTIVATE_PIMP_CHEAT'),[1],game);
  expect(game.cheats.isActive(CHEAT_ALL_TAXIS_NITRO)).toBe(true);
  expect(game.cheats.isActive(CHEAT_PROSTITUTES_PAY_YOU)).toBe(true);
  expect(game.cheats.count).toBe(2);
  run(scmOpcode('SET_ALL_TAXIS_HAVE_NITRO'),[0],game);
  expect(game.cheats.isActive(CHEAT_ALL_TAXIS_NITRO)).toBe(false);
  expect(game.cheats.isActive(CHEAT_PROSTITUTES_PAY_YOU)).toBe(true);
 });

 test('the car-cheat question answers for three cheats and no others',()=>{
  const game=new ScmGameState();
  expect(run(scmOpcode('ARE_ANY_CAR_CHEATS_ACTIVATED'),[],game).condition).toBe(false);
  game.cheats.set(CHEAT_ALL_TAXIS_NITRO,true);
  expect(run(scmOpcode('ARE_ANY_CAR_CHEATS_ACTIVATED'),[],game).condition).toBe(false);
  for(const cheat of CAR_CHEATS){
   const one=new ScmGameState();one.cheats.set(cheat,true);
   expect(run(scmOpcode('ARE_ANY_CAR_CHEATS_ACTIVATED'),[],one).condition).toBe(true);
  }
  expect([...CAR_CHEATS]).toEqual([CHEAT_PERFECT_HANDLING,CHEAT_CARS_ON_WATER,CHEAT_BOATS_FLY]);
 });

 test('a toggle flips and a disable clears, and a cheat outside the table is refused',()=>{
  const game=new ScmGameState();
  game.cheats.toggle(CHEAT_BOATS_FLY);
  expect(game.cheats.isActive(CHEAT_BOATS_FLY)).toBe(true);
  game.cheats.toggle(CHEAT_BOATS_FLY);
  expect(game.cheats.isActive(CHEAT_BOATS_FLY)).toBe(false);
  game.cheats.set(CHEAT_BOATS_FLY,true);game.cheats.disable(CHEAT_BOATS_FLY);
  expect(game.cheats.isActive(CHEAT_BOATS_FLY)).toBe(false);
  expect(()=>game.cheats.isActive(TOTAL_CHEATS)).toThrow(/range/);
 });

 test('the version question is false and the debug command only counts itself',()=>{
  const game=new ScmGameState();
  expect(run(scmOpcode('IS_XBOX_VERSION'),[],game).condition).toBe(false);
  expect(run(scmOpcode('IS_XBOX_VERSION')|0x8000,[],game).condition).toBe(true);
  run(scmOpcode('DO_DEBUG_STUFF'),[],game);
  run(scmOpcode('DO_DEBUG_STUFF'),[],game);
  expect(game.debugStuff).toBe(2);
 });
});

describe('the pad shake a script asks for',()=>{
 test('a shake is only taken up while one is already running, as the source leaves it',()=>{
  const game=new ScmGameState();
  run(scmOpcode('SHAKE_PAD'),[0,300,200],game,1000);
  expect(game.pads.shake[0]).toMatchObject({duration:0,frequency:0,noShakeBefore:1000,noShakeFrequency:200});
  game.pads.shake[0].duration=1;
  run(scmOpcode('SHAKE_PAD'),[0,300,200],game,2000);
  expect(game.pads.shake[0]).toMatchObject({duration:300,frequency:200});
 });

 test('a weaker shake inside the delay is dropped and a stronger one gets through',()=>{
  const game=new ScmGameState();
  game.pads.shake[0]={duration:1,frequency:0,noShakeBefore:5000,noShakeFrequency:100};
  run(scmOpcode('SHAKE_PAD'),[0,300,80],game,1000);
  expect(game.pads.shake[0].frequency).toBe(0);
  run(scmOpcode('SHAKE_PAD'),[0,300,150],game,1000);
  expect(game.pads.shake[0]).toMatchObject({duration:300,frequency:150,noShakeFrequency:150});
 });

 test('a shake of no strength stops the pad, and vibration off or a cutscene stops all of it',()=>{
  const game=new ScmGameState();
  game.pads.shake[0]={duration:200,frequency:100,noShakeBefore:0,noShakeFrequency:0};
  run(scmOpcode('SHAKE_PAD'),[0,0,0],game,1000);
  expect(game.pads.shake[0]).toMatchObject({duration:0,frequency:0});
  for(const off of ['useVibration','cutsceneRunning'] as const){
   const quiet=new ScmGameState();
   quiet.pads.shake[0].duration=1;
   quiet.pads[off==='useVibration'?'useVibration':'cutsceneRunning']=off!=='useVibration';
   run(scmOpcode('SHAKE_PAD'),[0,300,200],quiet,1000);
   expect(quiet.pads.shake[0]).toMatchObject({duration:1,frequency:0,noShakeBefore:0});
  }
 });

 test('the second pad shakes on its own, and a pad outside the two is refused',()=>{
  const game=new ScmGameState();
  game.pads.shake[1].duration=1;
  run(scmOpcode('SHAKE_PAD'),[1,120,90],game,500);
  expect(game.pads.shake[1]).toMatchObject({duration:120,frequency:90});
  expect(game.pads.shake[0].frequency).toBe(0);
  expect(()=>game.pads.startShake(2,120,90,0,500)).toThrow(/range/);
 });
});

test('eCheats places the car cheats at 28, 34 and 35, and a typed one counts for the script',async()=>{
 expect([CHEAT_PERFECT_HANDLING,CHEAT_CARS_ON_WATER,CHEAT_BOATS_FLY]).toEqual([28,34,35]);
 const {CHEATS}=await import('../src/simulation/nativeCheats');
 const {ScmCheats}=await import('../src/engine/ScmCheats');
 const table=new ScmCheats();expect(table.anyCarCheatsActivated).toBe(false);
 CHEATS.enable('perfectHandling');try{expect(table.anyCarCheatsActivated).toBe(true);}finally{CHEATS.reset();}
});
