import {expect,test} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {readIpl} from '../src/assets/ipl';
import {readWorldIplLoadList} from '../src/assets/worldLoadList';
import {readWorldEntryExits} from '../src/assets/worldEntryExits';
import {readInitialEntryExitSwitches} from '../src/assets/scmEntryExits';
import {ENEX,EntryExitManager,entryExitPosition,findValidTeleportPoint,isInEntryExitArea,isTimeInRange} from '../src/world/nativeEntryExits';

const root='public/play/world/files';
function worldRows(){
 const ipls=new Map<string,Uint8Array>();
 const walk=(dir:string)=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(path.toLowerCase().endsWith('.ipl'))ipls.set(relative(root,path).toLowerCase(),new Uint8Array(readFileSync(path)));}};
 walk(join(root,'ipl'));
 return readWorldEntryExits(readWorldIplLoadList(readFileSync(join(root,'gta.dat'),'utf8')),ipls);
}
const scm=()=>new Uint8Array(readFileSync(join(root,'scripts/main.scm')));

test('IPL enex rows keep CFileLoader::LoadEntryExit fields', () => {
 const data=readIpl(new TextEncoder().encode('enex\n2232.87, -1159.71, 24.9416, 0, 1.4, 1.4, 8, 2229.02, -1159.8, 24.9416, 90, 0, 4, "MOTEL1", 0, 2, 0, 24\n-1, 2, 3, 0, 1, 1, 8, 0, 0, 0, 0, 0, 0, "", 0, 2, 0, 24\nend'));
 expect(data.warnings).toEqual([]);
 const [motel,unnamed]=data.entryExits;
 expect(motel).toMatchObject({name:'MOTEL1',size:[Math.fround(1.4),Math.fround(1.4)],exitAngle:90,area:0,flags:4,skyColor:0,pedCount:2,timeOn:0,timeOff:24});
 expect(motel.position[0]).toBeCloseTo(2232.87,3);expect(motel.exit[1]).toBeCloseTo(-1159.8,3);
 expect(unnamed.name).toBe('');
 expect(()=>readIpl(new TextEncoder().encode('enex\n1, 2, 3\nend'))).toThrow('18 fields');
});

test('the world has 376 entry exits and pairs link to the first same-named record without the pair flag', () => {
 const rows=worldRows();expect(rows).toHaveLength(376);
 const enex=new EntryExitManager(rows,()=>.9);
 const pairs=enex.pool.filter(e=>e.flags&ENEX.CREATE_LINKED_PAIR);
 expect(pairs).toHaveLength(230);
 // Only DESHOUS (twice) and STUDRAN have no partner.
 expect(pairs.filter(e=>!e.link).map(e=>e.name).sort()).toEqual(['DESHOUS','DESHOUS','STUDRAN']);
 const motel=pairs.find(e=>e.name==='MOTEL1')!;
 expect(motel.link!.area).toBe(15);expect(motel.link!.flags&ENEX.CREATE_LINKED_PAIR).toBe(0);
 // LinkEntryExit leaves the interior side unlinked until it is used, and opens it all day.
 expect(motel.link!.link).toBeUndefined();expect([motel.link!.timeOn,motel.link!.timeOff]).toEqual([0,24]);
 // Every Ammu-Nation door leads into the first AMMUN1 interior.
 const ammo=pairs.filter(e=>e.name==='AMMUN1');expect(ammo.length).toBeGreaterThan(1);expect(new Set(ammo.map(e=>e.link)).size).toBe(1);
 // Burglary houses stay shut until burglary is enabled.
 const burglary=enex.pool.filter(e=>e.flags&ENEX.BURGLARY_ACCESS);
 expect(burglary.length).toBeGreaterThan(30);expect(burglary.every(e=>!(e.flags&ENEX.ENABLE_ACCESS)&&e.timeOn===0&&e.timeOff===24)).toBe(true);
});

test('INITIAL shuts the safehouses for sale, the date restaurants and the girlfriends\' houses', () => {
 const switches=readInitialEntryExitSwitches(scm());
 expect(switches.filter(s=>s.kind==='closest')).toHaveLength(30);
 expect(switches.filter(s=>s.kind==='switch').map(s=>s.kind==='switch'&&s.name)).toEqual(['FDREST1','REST2','DINER1','DINER2','TSDINER','GF1','GF2','GF3','GF4','GF5','GF6']);
 const enex=new EntryExitManager(worldRows(),()=>.9);enex.applyScript(switches);
 const closed=enex.pool.filter(e=>!(e.flags&ENEX.ENABLE_ACCESS)&&!(e.flags&ENEX.BURGLARY_ACCESS));
 // SVLASM, Willowfield's safehouse, sits 5 units from 2483.02, -2001.07.
 expect(closed.some(e=>e.name==='SVLASM'&&e.area===0)).toBe(true);
 expect(enex.pool.filter(e=>e.name==='DINER2').every(e=>!(e.flags&ENEX.ENABLE_ACCESS))).toBe(true);
 expect(enex.pool.filter(e=>e.name==='FDPIZA').every(e=>e.flags&ENEX.ENABLE_ACCESS)).toBe(true);
 // Thirty different doors: FindNearestEntryExit takes the airstrip's area-10 DESHOUS record, 6.3 units off, over its
 // outside one.
 const switched=['FDREST1','REST2','DINER1','DINER2','TSDINER','GF1','GF2','GF3','GF4','GF5','GF6'];
 expect(closed.filter(e=>!switched.includes(e.name))).toHaveLength(30);
 expect(closed.some(e=>e.name==='DESHOUS'&&e.area===10)).toBe(true);
});

test('IsInArea tests the entrance rect within 1 unit of m_fEntranceZ, rotated about its centre', () => {
 const enex=new EntryExitManager([
  {position:[10,20,5],angle:0,size:[2,1],exit:[100,100,1000],exitAngle:90,area:3,flags:0,name:'A',skyColor:0,pedCount:0,timeOn:0,timeOff:24},
  {position:[0,0,0],angle:90,size:[4,1],exit:[0,0,0],exitAngle:0,area:0,flags:0,name:'B',skyColor:0,pedCount:0,timeOn:0,timeOff:24},
 ]);
 const [a,b]=enex.pool;
 expect(entryExitPosition(a)).toEqual([10,20,6]);expect(a.exit).toEqual([100,100,1001]);
 expect(isInEntryExitArea(a,[10.9,20.4,6.9])).toBe(true);
 expect(isInEntryExitArea(a,[10.9,20.6,6])).toBe(false);
 expect(isInEntryExitArea(a,[10,20,7])).toBe(false);
 // A 4 × 1 rect turned 90°: the point is rotated into the rect's frame.
 expect(isInEntryExitArea(b,[0,1.8,1])).toBe(true);
 expect(isInEntryExitArea(b,[1.8,0,1])).toBe(false);
 expect(b.bounds.map(v=>+v.toFixed(3))).toEqual([-0.5,-2,0.5,2]);
 expect(isTimeInRange(23,20,6)).toBe(true);expect(isTimeInRange(12,20,6)).toBe(false);expect(isTimeInRange(0,0,0)).toBe(false);
});

test('TransitionStarted warps a far spawn point and links the interior back to the door used', () => {
 const enex=new EntryExitManager(worldRows(),()=>.9);
 const motel=enex.pool.find(e=>e.name==='MOTEL1'&&e.area===0)!,inside=motel.link!,door=entryExitPosition(motel);
 const ped=(position:readonly [number,number,number],extra={})=>({position,canStartMission:true,...extra});
 expect(enex.update(ped([door[0],door[1],door[2]+1.5]),12)).toBeUndefined();
 expect(enex.update(ped(door,{vehicle:{type:'automobile',big:false}}),12)).toBeUndefined();
 expect(enex.update(ped(door,{canStartMission:false}),12)).toBeUndefined();
 const started=enex.update(ped(door),12)!;
 expect(started.spawn).toBe(inside);expect(started.warping).toBe(true);expect(started.walk).toBeUndefined();
 expect(inside.link).toBe(motel);expect(motel.flags&ENEX.UNKNOWN_PAIRING).toBeTruthy();
 // TransitionFinished: 0.5 s to black, then the teleport once the fade ends.
 expect(enex.finishStep(false)).toEqual({fade:.5});
 expect(enex.finishStep(true)).toBeUndefined();
 expect(enex.finishStep(false)).toBe('teleport');
 enex.arrived();expect(enex.stack).toEqual([inside]);
 // Standing on the arrival exit keeps the entrances shut until the player steps off every marker.
 expect(enex.markers([0,0,0],[0,1],15,12,()=>true)).toEqual([]);
 enex.update(ped(inside.exit),12);expect(enex.state).toBe(4);
 enex.update(ped(inside.exit),12);expect(enex.state).toBe(0);
 // Leaving through the interior door returns to the outside exit.
 const out=enex.update(ped(entryExitPosition(inside)),12)!;
 expect(out.spawn).toBe(motel);expect(out.warping).toBe(true);
 enex.finishStep(false);enex.finishStep(false);enex.arrived();expect(enex.stack).toEqual([]);
});

test('the atrium walk-in fades over 1 s behind a 4-unit door walk', () => {
 const enex=new EntryExitManager(worldRows(),()=>.9);
 const atrium=enex.pool.find(e=>e.name==='ATRIUMX'&&e.area===0)!;
 const started=enex.update({position:entryExitPosition(atrium),canStartMission:true},12)!;
 expect(started.warping).toBe(false);expect(started.walk).toBeDefined();
 const p=entryExitPosition(atrium);expect(Math.hypot(started.walk![0]-p[0],started.walk![1]-p[1],started.walk![2]-p[2])).toBeCloseTo(4);
 expect(enex.finishStep(false)).toBeUndefined();expect(enex.state).toBe(1);
 expect(enex.finishStep(false)).toEqual({fade:1});
});

test('markers show enabled doors leading out of the current area within 40 units of the camera', () => {
 const enex=new EntryExitManager(worldRows(),()=>.9);
 const motel=enex.pool.find(e=>e.name==='MOTEL1'&&e.area===0)!,p=entryExitPosition(motel);
 const camera:[number,number,number]=[p[0],p[1]-20,p[2]+2];
 const shown=enex.markers(camera,[0,1],0,12,()=>true);
 expect(shown.find(m=>m.enex===motel)?.position).toEqual([p[0],p[1],p[2]+1]);
 // Looking away, the 60-unit query square behind the camera still lands in the door's 375-unit quadtree leaf, so
 // only TheCamera.IsSphereVisible hides the marker.
 expect(enex.markers(camera,[0,-1],0,12,()=>true).some(m=>m.enex===motel)).toBe(true);
 expect(enex.markers(camera,[0,-1],0,12,()=>false).some(m=>m.enex===motel)).toBe(false);
 expect(enex.markers(camera,[0,1],15,12,()=>true).some(m=>m.enex===motel)).toBe(false);
});

test('FindValidTeleportPoint tries the exit, then two 8-point rings', () => {
 const exit:[number,number,number]=[0,0,10];
 expect(findValidTeleportPoint(exit,()=>false,()=>true)).toEqual(exit);
 const p=findValidTeleportPoint(exit,q=>q[1]<1,()=>true);
 expect(p[0]).toBeCloseTo(0);expect(p[1]).toBeCloseTo(1.25);
 expect(findValidTeleportPoint(exit,()=>true,()=>true)).toEqual(exit);
});

test('doors into an area that cannot stream neither show nor start', () => {
 const enex=new EntryExitManager(worldRows(),()=>.9,area=>area===0);
 const motel=enex.pool.find(e=>e.name==='MOTEL1'&&e.area===0)!,p=entryExitPosition(motel);
 expect(enex.markers([p[0],p[1]-20,p[2]+2],[0,1],0,12,()=>true).some(m=>m.enex===motel)).toBe(false);
 expect(enex.update({position:p,canStartMission:true},12)).toBeUndefined();
 expect(motel.link!.link).toBeUndefined();
});

test('a door is found by the quadtree leaf it is filed in and entered by IsInArea alone, whatever its angle',()=>{
 // A 4 x 4 door turned 45 degrees: its two rotated corners share an x, so its bounds are a vertical line.
 const row={...worldRows()[0],position:[100,100,10] as [number,number,number],size:[4,4] as [number,number],angle:45,flags:0};
 const enex=new EntryExitManager([row],()=>.9);const door=enex.pool[0];
 expect(door.bounds[2]-door.bounds[0]).toBeCloseTo(0,5);
 // Standing inside the turned square but off that line, the player is still in the door's leaf and in its area.
 const inside:[number,number,number]=[101.2,100,11];
 expect(isInEntryExitArea(door,inside)).toBe(true);
 enex.update({position:inside,canStartMission:true},12);
 expect(enex.active?.enex).toBe(door);
 // FindNearestEntryExit takes anything under twice the range whose leaf the range square touches.
 expect(new EntryExitManager([row],()=>.9).findNearest(115,100,10)).toBeDefined();
});
