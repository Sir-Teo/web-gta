import {expect,test} from 'vitest';
import {GAMELOGIC_STATE_BUSTED,GAMELOGIC_STATE_PLAYING,GAMELOGIC_STATE_WASTED,NativeGameLogic,passTime,type GameLogicWorld} from '../src/simulation/nativeGameLogic';
import {LEVEL_COUNTRYSIDE,NativeRestart} from '../src/simulation/nativeRestart';

const countryside=()=>LEVEL_COUNTRYSIDE;
function fixture(){
 const calls:unknown[][]=[];
 const state={dead:false,arrested:false,fading:false,wanted:0,samples:[20000]};
 const hospital={position:[10,20,30] as [number,number,number],heading:90,townId:0};
 const station={position:[40,50,60] as [number,number,number],heading:180,townId:0};
 const restart=new NativeRestart({hospitals:[hospital],police:[station]});
 const world:GameLogicWorld={
  isPlayerDead:()=>state.dead,isPlayerArrested:()=>state.arrested,playerPosition:()=>[0,0,0],
  wantedLevel:()=>state.wanted,isFading:()=>state.fading,
  fade(direction,seconds){calls.push(['fade',direction,seconds]);state.fading=true;},
  clearCrossHairs(){calls.push(['crosshairs']);},clearMessages(){calls.push(['messages']);},
  punish(fee){calls.push(['punish',fee]);},incrementStat(stat,value){calls.push(['stat',stat,value]);},endGangWar(){calls.push(['endGangWar']);},
  showWastedMessage(){calls.push(['wasted']);},showBustedMessage(){calls.push(['busted']);},resetWastedText(){calls.push(['resetWasted']);},passTime(minutes){calls.push(['passTime',minutes]);},
  resurrect(result){calls.push(['resurrect',result.position,result.heading]);},
  nextRandom:()=>state.samples.shift()??0,
 };
 const logic=new NativeGameLogic(restart);
 const step=(now:number,previous:number)=>logic.update(now,previous,world,0,countryside);
 return {logic,world,state,calls,step,
  named:(name:string)=>calls.filter(c=>c[0]===name)};
}

test('the wasted sequence waits three seconds, fades once, then charges and respawns at the hospital',()=>{
 const f=fixture();
 f.state.dead=true;
 expect(f.step(1000,980)).toBe(GAMELOGIC_STATE_WASTED);
 expect(f.named('stat')).toEqual([['stat',135,1]]);expect(f.named('wasted')).toHaveLength(1);
 expect(f.named('fade')).toEqual([]);
 // Still inside the three second hold.
 expect(f.step(4000,3980)).toBe(GAMELOGIC_STATE_WASTED);expect(f.named('fade')).toEqual([]);
 // First frame past the hold starts the fade to black, and the fade blocks progress.
 expect(f.step(4001,3999)).toBe(GAMELOGIC_STATE_WASTED);
 expect(f.named('fade')).toEqual([['fade',0,2]]);expect(f.named('punish')).toEqual([]);
 expect(f.step(5000,4900)).toBe(GAMELOGIC_STATE_WASTED);expect(f.named('punish')).toEqual([]);
 f.state.fading=false;f.state.dead=false;
 expect(f.step(6000,5900)).toBe(GAMELOGIC_STATE_PLAYING);
 expect(f.named('punish')).toEqual([['punish',100]]);
 expect(f.named('passTime')).toEqual([['passTime',720]]);
 expect(f.named('resurrect')).toEqual([['resurrect',[10,20,30],90]]);
 expect(f.calls.at(-1)).toEqual(['fade',1,3]);
 // RestorePlayerStuffDuringResurrection clears the big message with CHud::ResetWastedText.
 expect(f.named('resetWasted')).toHaveLength(1);
 // The fade to black is raised exactly once even though the window is re-entered.
 expect(f.named('fade')).toEqual([['fade',0,2],['fade',1,3]]);
});

test('the busted sequence holds four seconds and scales the fee with the wanted level',()=>{
 const f=fixture();
 f.state.arrested=true;f.state.wanted=4;
 expect(f.step(0,0)).toBe(GAMELOGIC_STATE_BUSTED);
 expect(f.named('stat')).toEqual([['stat',133,1]]);expect(f.named('busted')).toHaveLength(1);expect(f.named('wasted')).toEqual([]);
 // Three of four samples select the generic bust line.
 expect(f.logic.bustedAudioStatus).toBe(2);expect(f.logic.lastBustMessageNumber).toBe(0);
 expect(f.step(3001,2999)).toBe(GAMELOGIC_STATE_BUSTED);
 expect(f.named('fade')).toEqual([['fade',0,2]]);
 f.state.fading=false;
 // The fade has finished but the four second hold has not elapsed.
 expect(f.step(3900,3800)).toBe(GAMELOGIC_STATE_BUSTED);expect(f.named('punish')).toEqual([]);
 f.state.arrested=false;
 expect(f.step(4000,3900)).toBe(GAMELOGIC_STATE_PLAYING);
 expect(f.named('punish')).toEqual([['punish',600]]);
 expect(f.named('resurrect')).toEqual([['resurrect',[40,50,60],180]]);
});

test('a zero sample picks a numbered bust line and cycles it within twenty-eight',()=>{
 const f=fixture();
 f.state.arrested=true;f.state.samples=[0];
 f.step(0,0);
 expect([f.logic.bustedAudioStatus,f.logic.lastBustMessageNumber]).toEqual([1,1]);
 f.logic.bustedAudioStatus=0;f.logic.lastBustMessageNumber=28;f.state.samples=[0];
 f.step(1,1);
 expect(f.logic.lastBustMessageNumber).toBe(1);
});

test('the free healthcare and jail-free flags absorb one penalty each',()=>{
 const f=fixture();
 f.logic.freeHealthCare=true;f.state.dead=true;
 f.step(0,0);f.step(4000,2000);f.state.fading=false;f.state.dead=false;
 f.step(5000,4900);
 expect(f.named('punish')).toEqual([]);expect(f.logic.freeHealthCare).toBe(false);
 const g=fixture();
 g.logic.penaltyForDeathApplies=false;g.state.dead=true;
 g.step(0,0);g.step(4000,2000);g.state.fading=false;g.state.dead=false;
 g.step(5000,4900);
 expect(g.named('punish')).toEqual([]);
 const h=fixture();
 h.logic.getOutOfJailFree=true;h.state.arrested=true;h.state.wanted=6;
 h.step(0,0);h.step(3500,3400);h.state.fading=false;h.state.arrested=false;
 h.step(5000,4900);
 expect(h.named('punish')).toEqual([]);expect(h.logic.getOutOfJailFree).toBe(false);
});

test('PassTime carries minutes into hours and days and wraps the weekday to one',()=>{
 expect(passTime({hours:8,minutes:30,weekDay:4},720)).toEqual({hours:20,minutes:30,weekDay:4,daysPassed:0});
 expect(passTime({hours:20,minutes:30,weekDay:4},720)).toEqual({hours:8,minutes:30,weekDay:5,daysPassed:1});
 expect(passTime({hours:23,minutes:59,weekDay:7},1)).toEqual({hours:0,minutes:0,weekDay:1,daysPassed:1});
 expect(passTime({hours:0,minutes:0,weekDay:1},60*24*3)).toEqual({hours:0,minutes:0,weekDay:4,daysPassed:3});
 expect(()=>passTime({hours:0,minutes:0,weekDay:1},1.5)).toThrow('whole minutes');
});

test('the wanted level is validated before a fee is charged',()=>{
 const f=fixture();
 f.state.arrested=true;f.state.wanted=7;
 f.step(0,0);f.step(3500,3400);f.state.fading=false;
 expect(()=>f.step(5000,4900)).toThrow('0..6');
});

test('KillPlayer and ArrestPlayer each end a gang war in progress and count their stat once',()=>{
 const dead=fixture();dead.state.dead=true;dead.step(1000,980);dead.step(1100,1000);
 expect(dead.named('endGangWar')).toHaveLength(1);expect(dead.named('stat')).toEqual([['stat',135,1]]);
 const busted=fixture();busted.state.arrested=true;busted.state.wanted=2;busted.step(1000,980);
 expect(busted.named('endGangWar')).toHaveLength(1);expect(busted.named('stat')).toEqual([['stat',133,1]]);
});

test('a resurrection clears any trip skip, after-mission ones too, and lets the pad go',()=>{
 const f=fixture(),held:boolean[]=[];f.world.setPadCamera=h=>{held.push(h);};
 f.logic.setUpSkip([1,2,3],0,true,undefined,false,0);
 f.state.dead=true;f.step(1000,980);f.step(4001,3999);f.state.fading=false;f.state.dead=false;
 expect(f.step(6000,5900)).toBe(GAMELOGIC_STATE_PLAYING);
 expect(f.logic.canPlayerTripSkip()).toBe(false);expect(held).toEqual([false]);
});
