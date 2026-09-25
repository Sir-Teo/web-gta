import {describe,expect,test} from 'vitest';
import {NativeGameLogic,SKIP_AFTER_MISSION,SKIP_AVAILABLE,SKIP_FADING_OUT,SKIP_IN_PROGRESS,SKIP_NONE,SKIP_WAITING_SCRIPT,type SkipWorld} from '../src/simulation/nativeGameLogic';
import {NativeRestart} from '../src/simulation/nativeRestart';

function world(extra:Partial<SkipWorld>={}){
 const log:unknown[]=[];let pressed=false;
 const car={};
 const w:SkipWorld={canSeeOutside:()=>true,isFading:()=>false,playerRoadVehicle:()=>car,playerSwimming:()=>false,playerLeavingCar:()=>false,
  skipButtonJustPressed:()=>{const p=pressed;pressed=false;return p;},setPadCamera:held=>{log.push(['camera',held]);},fade:(d,s)=>{log.push(['fade',d,s]);},
  showSkipMessage:()=>{log.push(['SKIP']);},clearHudMessage:()=>{log.push(['clear']);},teleportForSkip:(p,h)=>{log.push(['teleport',[...p],h]);},
  playerPosition:()=>[0,0,0],passTime:m=>{log.push(['pass',m]);},...extra};
 return {w,log,press:()=>{pressed=true;},car};
}
const logic=()=>new NativeGameLogic(new NativeRestart());

describe('CGameLogic’s trip skip',()=>{
 test('pressing the button fades out, and 3 s on the car is moved, time passes and the screen fades back',()=>{
  const g=logic(),{w,log,press}=world();
  g.setUpSkip([400,0,10],90,false,undefined,false,0,w);
  expect(g.skipState).toBe(SKIP_AVAILABLE);expect(g.skipCanBeActivated(w)).toBe(true);
  g.updateSkip(100,w);expect(g.skipState).toBe(SKIP_AVAILABLE);
  press();g.updateSkip(200,w);
  expect(g.skipState).toBe(SKIP_IN_PROGRESS);
  g.updateSkip(3199,w);expect(g.skipState).toBe(SKIP_IN_PROGRESS);
  g.updateSkip(3200,w);expect(g.skipState).toBe(SKIP_FADING_OUT);
  // 400 units away: 400 / 20 + 23 minutes.
  expect(log).toContainEqual(['teleport',[400,0,10],90]);expect(log).toContainEqual(['pass',43]);
  g.updateSkip(4700,w);expect(g.skipState).toBe(SKIP_FADING_OUT);
  g.updateSkip(4701,w);expect(g.skipState).toBe(SKIP_NONE);
  expect(log.filter(e=>(e as unknown[])[0]==='fade')).toEqual([['fade',0,2.5],['fade',1,1.5]]);
 });

 test('a skip lapses near its point or 35 s after it was set up',()=>{
  const g=logic(),{w}=world({playerPosition:()=>[390,10,0]});
  g.setUpSkip([400,0,10],0,false,undefined,false,0,w);g.updateSkip(1,w);expect(g.skipState).toBe(SKIP_NONE);
  const h=logic(),far=world();h.setUpSkip([400,0,10],0,false,undefined,false,0,far.w);
  h.updateSkip(35000,far.w);expect(h.skipState).toBe(SKIP_AVAILABLE);
  h.updateSkip(35001,far.w);expect(h.skipState).toBe(SKIP_NONE);
 });

 test('a skip for a named vehicle is only for that vehicle; after a mission a swimmer may skip',()=>{
  const g=logic(),{w}=world();
  g.setUpSkip([400,0,0],0,false,{},false,0,w);expect(g.skipCanBeActivated(w)).toBe(false);
  const onFoot=world({playerRoadVehicle:()=>undefined,playerSwimming:()=>true});
  g.setUpSkip([400,0,0],0,true,undefined,false,0,onFoot.w);expect(g.skipState).toBe(SKIP_AFTER_MISSION);expect(g.skipCanBeActivated(onFoot.w)).toBe(true);
  g.setUpSkip([400,0,0],0,false,undefined,false,0,onFoot.w);expect(g.skipCanBeActivated(onFoot.w)).toBe(false);
  // Indoors, or while the screen fades, there is no skip.
  expect(g.skipCanBeActivated(world({canSeeOutside:()=>false}).w)).toBe(false);
 });

 test('finished by the script: the skip waits, and the script’s question takes it back to none once',()=>{
  const g=logic(),{w,press}=world();
  g.setUpSkip([400,0,0],0,false,undefined,true,0,w);press();g.updateSkip(1,w);g.updateSkip(3001,w);
  expect(g.skipState).toBe(SKIP_WAITING_SCRIPT);
  expect(g.isSkipWaitingForScriptToFadeIn()).toBe(true);expect(g.isSkipWaitingForScriptToFadeIn()).toBe(false);
 });

 test('ClearSkip keeps an after-mission skip when the mission’s end clears it, and fades back one in progress',()=>{
  const g=logic(),{w,log,press}=world();
  g.setUpSkip([400,0,0],0,true,undefined,false,0,w);g.clearSkip(true,w);expect(g.skipState).toBe(SKIP_AFTER_MISSION);
  press();g.updateSkip(1,w);expect(g.skipState).toBe(SKIP_IN_PROGRESS);
  g.clearSkip(false,w);expect(g.skipState).toBe(SKIP_NONE);expect(log).toContainEqual(['fade',1,.5]);
 });
});
