import {readFileSync} from 'node:fs';
import {afterEach,expect,test} from 'vitest';
import {NativeText,gxtHudText,gxtKeyHash,readGxt,setControlNaming,setTouchText,useTouchControlNames} from '../src/assets/gxt';
import {TOUCH_GXT_TEXT} from '../src/assets/touchGxtText';
afterEach(()=>{useTouchControlNames(false);setControlNaming({pad:undefined,keys:false});setTouchText(undefined);});
const pc=readGxt(readFileSync('public/play/world/files/text/american.gxt'));
test('the iOS port\'s wording keeps each PC string\'s controls and asks for no gesture the touch controls lack',()=>{
 const controls=(t:string)=>[...t.matchAll(/~k~~([A-Z0-9_]+)~/g)].map(m=>m[1]).sort();
 let checked=0;
 for(const [table,keys] of Object.entries(TOUCH_GXT_TEXT)){
  expect(pc.missions.has(table)||table==='MAIN').toBe(true);
  for(const [hash,text] of Object.entries(keys)){
   expect(text).not.toMatch(/~m~|double tap|swipe across|drag (?:your|the)/i);
   if(table==='MAIN'){expect(controls(text)).toEqual(controls(pc.main.get(Number(hash))!));checked++;}
  }
 }
 expect(checked).toBeGreaterThan(100);
});
test('a touch screen reads the reworded help while the HUD names the touch buttons, and the PC\'s otherwise',()=>{
 const [hash,ios]=Object.entries(TOUCH_GXT_TEXT.MAIN).find(([,t])=>t==='Tap ~k~~VEHICLE_ENTER_EXIT~ to use this machine.')!;
 const original=pc.main.get(Number(hash))!;expect(original).toMatch(/^Press ~k~~VEHICLE_ENTER_EXIT~/);
 // A table with one key at that hash, and a mission table's reworded key beside it.
 const key='TCHTEST',[mission,missionKeys]=Object.entries(TOUCH_GXT_TEXT).find(([name])=>name!=='MAIN')!;
 const missionKey='TCHMISS',[missionHash,missionText]=Object.entries(missionKeys)[0];
 const text=new NativeText({main:new Map([[gxtKeyHash(key),original]]),missions:new Map(),bytes:new Uint8Array()});
 (text as unknown as {mission:{name:string;table:Map<number,string>}}).mission={name:mission,table:new Map([[gxtKeyHash(missionKey),'PC words']])};
 setTouchText({MAIN:{[gxtKeyHash(key)]:ios},[mission]:{[gxtKeyHash(missionKey)]:missionText}});void missionHash;
 expect(text.get(key)).toBe(original);
 useTouchControlNames(true);
 expect(gxtHudText(text.get(key))).toBe('Tap ENTER to use this machine.');expect(text.get(missionKey)).toBe(missionText);
 // A tablet's keyboard played, or a game controller: the keys' or the pad's words again.
 setControlNaming({keys:true});expect(text.get(key)).toBe(original);setControlNaming({keys:false});
 setControlNaming({pad:'xbox'});expect(text.get(key)).toBe(original);
});
