import {describe,expect,test} from 'vitest';
import {NativeHudBigMessages,STYLE_BOTTOM_RIGHT,STYLE_LIGHT_BLUE_TOP,STYLE_MIDDLE_SMALLER,STYLE_MIDDLE_SMALLER_HIGHER,STYLE_WHITE_MIDDLE_SMALLER} from '../src/ui/nativeHudBigMessages';

/** Runs frames of `stepMs` with the queue's front `text` in `style` handed over each frame, as CMessages::Display does. */
function run(h:NativeHudBigMessages,frames:number,stepMs:number,feed:Partial<Record<number,string>>,width=640,starts?:{n:number}){
 let last;
 for(let i=0;i<frames;i++){
  for(const [style,text] of Object.entries(feed))h.set(Number(style),text??'');
  last=h.draw(stepMs,width,true,()=>{if(starts)starts.n++;});
 }
 return last!;
}

describe('CHud::DrawMissionTitle',()=>{
 test('the first frame starts the clock and draws nothing; the title then holds past its queue time and fades',()=>{
  const h=new NativeHudBigMessages(),starts={n:0};
  expect(run(h,1,20,{[STYLE_BOTTOM_RIGHT]:'SKIP'},640,starts).missionTitle).toBeUndefined();
  expect(starts.n).toBe(1);expect(h.missionTitleShowing).toBe(true);
  // The queue empties at once: SetBigMessage leaves the running title alone.
  let d=run(h,1,20,{[STYLE_BOTTOM_RIGHT]:''});
  expect(d.missionTitle).toEqual({text:'SKIP',alpha:255});
  // From -60 to 620 at 0.3 a millisecond: 2266.7 ms of 20 ms frames, the first frame's 20 ms already counted.
  d=run(h,113,20,{[STYLE_BOTTOM_RIGHT]:''});expect(h.inUse[STYLE_BOTTOM_RIGHT]).toBeCloseTo(-60+114*6,5);
  // 120 steps of a fiftieth of a second from 1, then 255 ms of fading.
  d=run(h,1,20,{});expect(h.x[STYLE_BOTTOM_RIGHT]).toBe(2);
  d=run(h,118,20,{});expect(h.x[STYLE_BOTTOM_RIGHT]).toBe(120);expect(d.missionTitle?.alpha).toBe(235);
  d=run(h,11,20,{});expect(d.missionTitle?.alpha).toBe(15);
  d=run(h,1,20,{});expect(d.missionTitle).toBeUndefined();expect(h.missionTitleShowing).toBe(false);expect(starts.n).toBe(1);
 });
 test('a wider screen holds the title longer',()=>{
  const narrow=new NativeHudBigMessages(),wide=new NativeHudBigMessages();
  run(narrow,200,20,{[STYLE_BOTTOM_RIGHT]:'T'},640);run(wide,200,20,{[STYLE_BOTTOM_RIGHT]:'T'},1920);
  expect(narrow.x[STYLE_BOTTOM_RIGHT]).toBeGreaterThan(1);expect(wide.x[STYLE_BOTTOM_RIGHT]).toBe(1);
 });
 test('ClearThisPrintBigNow ends it at once',()=>{
  const h=new NativeHudBigMessages();run(h,3,20,{[STYLE_BOTTOM_RIGHT]:'T'});
  h.clear(STYLE_BOTTOM_RIGHT);expect(run(h,1,20,{}).missionTitle).toBeUndefined();expect(h.missionTitleShowing).toBe(false);
 });
});

describe('CHud::DrawOddJobMessage',()=>{
 test('the plain styles show while queued; the odd-job title and result give way to a mission title',()=>{
  const h=new NativeHudBigMessages();
  let d=run(h,1,20,{[STYLE_LIGHT_BLUE_TOP]:'A',[STYLE_MIDDLE_SMALLER]:'B',[STYLE_MIDDLE_SMALLER_HIGHER]:'C',[STYLE_WHITE_MIDDLE_SMALLER]:'D'});
  expect(d).toMatchObject({lightBlueTop:'A',middleSmaller:'B',oddJobTitle:{text:'C',afterFade:false}});
  d=run(h,2,40,{[STYLE_MIDDLE_SMALLER_HIGHER]:'C',[STYLE_WHITE_MIDDLE_SMALLER]:'D'});expect(d.whiteMiddleSmaller).toBe('D');
  d=run(h,1,20,{[STYLE_BOTTOM_RIGHT]:'T',[STYLE_MIDDLE_SMALLER_HIGHER]:'C',[STYLE_WHITE_MIDDLE_SMALLER]:'D'});
  expect(d.oddJobTitle).toBeUndefined();expect(d.whiteMiddleSmaller).toBeUndefined();
  expect(run(h,1,20,{[STYLE_LIGHT_BLUE_TOP]:''}).lightBlueTop).toBeUndefined();
 });
 test('DRAW_ODDJOB_TITLE_BEFORE_FADE off draws the odd-job title after the fade',()=>{
  const h=new NativeHudBigMessages();h.set(STYLE_MIDDLE_SMALLER_HIGHER,'C');
  expect(h.draw(20,640,false).oddJobTitle).toEqual({text:'C',afterFade:true});
 });
 test('the result slides in, holds 1.5 s, slides out and stays off 5 s; a new text starts again',()=>{
  const h=new NativeHudBigMessages(),frame=1000/30,feed={[STYLE_WHITE_MIDDLE_SMALLER]:'R'};
  run(h,1,frame,feed);expect(h.oddJob2On).toBe(1);expect(h.oddJob2XOffset).toBe(380);
  let frames=1;while(h.oddJob2On===1){run(h,1,frame,feed);frames++;}
  expect(h.oddJob2On).toBe(2);expect(frames).toBeGreaterThan(20);
  while(h.oddJob2On===2)run(h,1,frame,feed);
  while(h.oddJob2On===3)expect(run(h,1,frame,feed).whiteMiddleSmaller).toBe('R');
  expect(h.oddJob2OffTimer).toBe(5000);
  expect(run(h,1,frame,feed).whiteMiddleSmaller).toBeUndefined();
  expect(run(h,140,frame,feed).whiteMiddleSmaller).toBeUndefined();
  expect(run(h,10,frame,feed).whiteMiddleSmaller).toBe('R');
  // Another text resets the cycle while it is off.
  run(h,3,frame,feed);h.oddJob2OffTimer=3000;
  run(h,1,frame,{[STYLE_WHITE_MIDDLE_SMALLER]:'S'});expect(h.oddJob2On).toBe(1);expect(h.oddJob2OffTimer).toBe(0);
 });
});
