import {expect,test} from 'vitest';
import {BLIP_CAR,BLIP_CHAR,BLIP_COORD,BLIP_DISPLAY_BLIPONLY,BLIP_DISPLAY_BOTH,BLIP_FLAG_THREAT,BLIP_PICKUP,MAX_RADAR_TRACES,ScmRadar} from '../src/engine/ScmRadar';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {scmOpcode} from '../src/engine/scmOpcodes';

const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const global=(n:number)=>[2,n&255,n>>8];
const op=(name:string|number,...args:number[][])=>{const n=typeof name==='number'?name:scmOpcode(name);return [n&255,n>>8,...args.flat()];};

test('blip handles encode slot and counter, go stale on clear and wrap the counter before 0xFFFF',()=>{
 const radar=new ScmRadar();
 const a=radar.setCoordBlip(BLIP_COORD,{x:1,y:2,z:3},BLIP_DISPLAY_BOTH);
 expect(a).toBe(0x10000);expect(radar.index(a)).toBe(0);
 expect(radar.traces[0]).toMatchObject({position:{x:1,y:2,z:3},display:3,type:BLIP_COORD,colour:8,tracking:true,blipSize:1,sprite:0,bright:true});
 radar.clearBlip(a);expect(radar.index(a)).toBe(-1);expect(radar.traces[0].tracking).toBe(false);expect(radar.traces[0].counter).toBe(1);
 const b=radar.setEntityBlip(BLIP_CHAR,77,BLIP_DISPLAY_BOTH);
 expect(b).toBe(0x20000);expect(radar.index(a)).toBe(-1);expect(radar.index(b)).toBe(0);
 expect(radar.traces[0]).toMatchObject({colour:7,entityHandle:77,type:BLIP_CHAR});
 expect(radar.setEntityBlip(BLIP_PICKUP,5,BLIP_DISPLAY_BLIPONLY)).toBe(0x10001);expect(radar.traces[1].colour).toBe(1);
 radar.traces[2].counter=0xfffe;expect(radar.setCoordBlip(BLIP_COORD,{x:0,y:0,z:0},1)).toBe(0x10002);
 expect(radar.index(-1)).toBe(-1);expect(()=>radar.index(0x10000|200)).toThrow('past');
});

test('the table holds 175 traces and attribute changes ignore stale handles',()=>{
 const radar=new ScmRadar();const handles:number[]=[];
 for(let i=0;i<MAX_RADAR_TRACES;i++)handles.push(radar.setCoordBlip(BLIP_COORD,{x:i,y:0,z:0},BLIP_DISPLAY_BOTH));
 expect(radar.tracked).toBe(MAX_RADAR_TRACES);expect(radar.setCoordBlip(BLIP_COORD,{x:0,y:0,z:0},3)).toBe(-1);
 expect(radar.setShortRangeCoordBlip(BLIP_COORD,{x:0,y:0,z:0},3)).toBe(-1);
 radar.clearBlip(handles[10]);
 const short=radar.setShortRangeCoordBlip(BLIP_COORD,{x:9,y:9,z:9},BLIP_DISPLAY_BLIPONLY);
 expect(short&0xffff).toBe(10);expect(radar.traces[10]).toMatchObject({shortRange:true,display:2,counter:2});
 radar.changeColour(handles[10],4);radar.changeScale(handles[10],3);radar.changeDisplay(handles[10],0);radar.setFriendly(handles[10],true);
 expect(radar.traces[10]).toMatchObject({colour:8,blipSize:1,display:2,friendly:false});
 radar.changeColour(short,4);radar.changeScale(short,3);radar.changeBrightness(short,0);radar.setSprite(short,25);radar.setAlwaysDisplayInZoom(short,true);radar.setFriendly(short,true);radar.setFade(short,true);
 expect(radar.traces[10]).toMatchObject({colour:4,blipSize:3,bright:false,sprite:25,remain:true,friendly:true,fade:true});
 radar.isDrawingMap=()=>true;radar.changeScale(short,5);expect(radar.traces[10].blipSize).toBe(1);
 radar.setCoordBlipAppearance(short,BLIP_FLAG_THREAT);expect(radar.traces[10].appearance).toBe(0);
 const car=radar.setEntityBlip(BLIP_CAR,4,3);
 expect(car).toBe(-1); // full again
 // Coordinate blips carry entity handle 0, so a type/handle sweep clears every one of them.
 radar.clearBlipForEntity(BLIP_CHAR,0);expect(radar.tracked).toBe(MAX_RADAR_TRACES);
 radar.clearBlipForEntity(BLIP_COORD,0);expect(radar.tracked).toBe(0);
 const carBlip=radar.setEntityBlip(BLIP_CAR,4,3);radar.setCoordBlipAppearance(carBlip,BLIP_FLAG_THREAT);expect(radar.traces[0].appearance).toBe(1);
 radar.setCoordBlipAppearance(carBlip,9);expect(radar.traces[0].appearance).toBe(1);
});

test('blip commands allocate, adjust, test and remove traces through script handles',()=>{
 const space=new Uint8Array(1024),globals=new DataView(space.buffer);
 space.set([...op('ADD_BLIP_FOR_COORD',float(10),float(20),float(30),global(8)),...op('ADD_SHORT_RANGE_SPRITE_BLIP_FOR_COORD',float(1),float(2),float(3),int(52),global(12)),
  ...op('ADD_BLIP_FOR_CHAR',int(1234),global(16)),...op('CHANGE_BLIP_DISPLAY',global(8),int(2)),...op('CHANGE_BLIP_SCALE',global(8),int(4)),...op('CHANGE_BLIP_COLOUR',global(16),int(3)),
  ...op('SET_BLIP_AS_FRIENDLY',global(16),int(1)),...op('SET_BLIP_ALWAYS_DISPLAY_ON_ZOOMED_RADAR',global(12),int(1)),...op('DOES_BLIP_EXIST',global(12)),...op('REMOVE_BLIP',global(12)),
  ...op(scmOpcode('DOES_BLIP_EXIST')|0x8000,global(12)),...op('ADD_BLIP_FOR_PICKUP',int(9),global(12)),...op('SHOW_BLIPS_ON_ALL_LEVELS',int(1)),...op('HIDE_ALL_FRONTEND_BLIPS',int(1)),0x4e,0],128);
 const runtime=new ScmRuntime(space),{thread}=runtime.start(128);runtime.process(0,20);
 const {radar}=runtime.game;
 expect([globals.getInt32(8,true),globals.getInt32(16,true)]).toEqual([0x10000,0x10002]);
 expect(radar.traces[0]).toMatchObject({position:{x:10,y:20,z:30},display:2,blipSize:4,type:BLIP_COORD});
 expect(radar.traces[1]).toMatchObject({tracking:true,type:BLIP_PICKUP,entityHandle:9,colour:1,counter:2,shortRange:false,sprite:0,remain:false});
 expect(radar.traces[2]).toMatchObject({type:BLIP_CHAR,entityHandle:1234,colour:3,friendly:true,display:3});
 expect(globals.getInt32(12,true)).toBe(0x20001);expect(thread.condition).toBe(true); // NOT DOES_BLIP_EXIST after removal
 expect([runtime.game.radarShowBlipOnAllLevels,runtime.game.hideAllFrontEndMapBlips]).toEqual([true,true]);
});
