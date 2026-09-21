import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {NUM_PATH_MAP_AREAS,ScmNodeSwitches,switchArea} from '../src/engine/ScmNodeSwitches';
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
const box=(min:number,max:number)=>switchArea({x:min,y:min,z:min},{x:max,y:max,z:max});

describe('road and pedestrian path switches',()=>{
 test('corners in either order make the same box',()=>{
  expect(switchArea({x:10,y:-2,z:5},{x:-3,y:4,z:1})).toEqual({xMin:-3,xMax:10,yMin:-2,yMax:4,zMin:1,zMax:5});
 });

 test('switching off an area keeps it, and the back-to-original form does not',()=>{
  const switches=new ScmNodeSwitches();
  switches.switchRoadsOffInArea(box(0,10),true,true,false);
  expect(switches.switches).toHaveLength(1);
  expect(switches.switches[0]).toMatchObject({isOff:true,isCars:true,xMin:0,xMax:10});
  switches.switchRoadsOffInArea(box(0,10),false,true,true);
  expect(switches.switches).toHaveLength(0);
 });

 test('a new area swallows the switches inside it, and retail\u2019s shift takes the far one with them',()=>{
  const switches=new ScmNodeSwitches();
  switches.switchRoadsOffInArea(box(1,2),true,true,false);
  switches.switchRoadsOffInArea(box(3,4),true,true,false);
  switches.switchRoadsOffInArea(box(100,200),true,true,false);
  expect(switches.switches).toHaveLength(3);
  switches.switchRoadsOffInArea(box(0,10),true,true,false);
  // Removing an entry copies only the one after it and drops the last slot, so the area far outside is lost
  // along with the two inside. The reference marks that as an R* bug; retail is what the script ran against.
  expect(switches.switches.map(s=>s.xMin)).toEqual([0]);
 });

 test('a switch outside the new area survives when nothing is removed before it',()=>{
  const switches=new ScmNodeSwitches();
  switches.switchRoadsOffInArea(box(100,200),true,true,false);
  switches.switchRoadsOffInArea(box(1,2),true,true,false);
  switches.switchRoadsOffInArea(box(0,10),true,true,false);
  expect(switches.switches.map(s=>s.xMin)).toEqual([100,0]);
 });

 test('the list stops at the sixty-four areas the path map has',()=>{
  const switches=new ScmNodeSwitches();
  for(let i=0;i<NUM_PATH_MAP_AREAS;i++)switches.switchRoadsOffInArea(box(i*10,i*10+1),true,true,false);
  expect(switches.switches).toHaveLength(NUM_PATH_MAP_AREAS);
  switches.switchRoadsOffInArea(box(1000,1001),true,true,false);
  expect(switches.switches).toHaveLength(NUM_PATH_MAP_AREAS);
 });

 test('a pedestrian switch over the same box replaces the car one, since the removal ignores the kind',()=>{
  const switches=new ScmNodeSwitches();
  switches.switchRoadsOffInArea(box(0,10),true,true,false);
  switches.switchPedRoadsOffInArea(box(0,10),true,false);
  expect(switches.switches).toHaveLength(1);
  expect(switches.switches[0].isCars).toBe(false);
  expect(switches.at({x:5,y:5,z:5},false)).toHaveLength(1);
  expect(switches.at({x:5,y:5,z:5},true)).toHaveLength(0);
  // A point outside every box is in none of them.
  expect(switches.at({x:50,y:5,z:5},false)).toHaveLength(0);
 });

 test('switches of both kinds sit side by side when their boxes differ',()=>{
  const switches=new ScmNodeSwitches();
  switches.switchRoadsOffInArea(box(0,10),true,true,false);
  switches.switchPedRoadsOffInArea(box(20,30),true,false);
  expect(switches.switches).toHaveLength(2);
  expect(switches.at({x:5,y:5,z:5},true)).toHaveLength(1);
  expect(switches.at({x:25,y:25,z:25},false)).toHaveLength(1);
 });

 test('the script’s own SWITCH_ROADS_OFF records the area it names',()=>{
  const {bytes,instruction}=find('SWITCH_ROADS_OFF'),game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.nodeSwitches.switches).toHaveLength(1);
  const values=instruction.parameters.map(p=>p.value as number),area=game.nodeSwitches.switches[0];
  expect(area.isOff).toBe(true);
  expect(area.isCars).toBe(true);
  expect(area.xMin).toBeCloseTo(Math.min(values[0],values[3]),3);
  expect(area.zMax).toBeCloseTo(Math.max(values[2],values[5]),3);
 });
});
