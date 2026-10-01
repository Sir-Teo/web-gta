import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmScriptSpheres,MAX_NUM_SCRIPT_SPHERES} from '../src/engine/ScmScriptSpheres';
import {scmOpcode} from '../src/engine/scmOpcodes';

const SPACE=512,VAR=400;
function run(code:Uint8Array,game:ScmGameState,world?:Partial<ScmWorldCommands>,globals:Record<number,number>={}){
 const space=new Uint8Array(SPACE);space.set(code,0);
 const view=new DataView(space.buffer);for(const [at,value] of Object.entries(globals))view.setInt32(+at,value,true);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {global:(at:number)=>view.getInt32(at,true)};
}
function build(opcode:number,parts:{type:number;value:number}[]){
 const size=(type:number)=>type===2?3:5;
 const bytes=new Uint8Array(2+parts.reduce((n,part)=>n+size(part.type),0)),view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 let at=2;for(const part of parts){bytes[at]=part.type;if(part.type===2)view.setUint16(at+1,part.value,true);else if(part.type===6)view.setFloat32(at+1,part.value,true);else view.setInt32(at+1,part.value,true);at+=size(part.type);}
 return bytes;
}
const float=(value:number)=>({type:6,value}),gvar=(offset:number)=>({type:2,value:offset});

describe('CTheScripts\' script spheres',()=>{
 test('AddScriptSphere takes the first free slot and hands back its unique id above it; RemoveScriptSphere frees only a live handle',()=>{
  const spheres=new ScmScriptSpheres();
  const a=spheres.add(100,{x:1,y:2,z:3},4),b=spheres.add(100,{x:5,y:6,z:7},2);
  expect([a&0xffff,a>>>16,b&0xffff,b>>>16]).toEqual([0,2,1,2]);
  expect(spheres.active.map(s=>[s.id,s.radius])).toEqual([[100,4],[101,2]]);
  spheres.remove(a);expect(spheres.active.map(s=>s.radius)).toEqual([2]);
  // The freed slot is taken again under a new unique id; the old handle names nothing now.
  const c=spheres.add(100,{x:0,y:0,z:0},1);expect([c&0xffff,c>>>16]).toEqual([0,3]);
  spheres.remove(a);expect(spheres.active.length).toBe(2);
  spheres.remove(-1);expect(spheres.index(-1)).toBe(-1);
 });
 test('sixteen slots, and a seventeenth is refused',()=>{
  const spheres=new ScmScriptSpheres();
  for(let i=0;i<MAX_NUM_SCRIPT_SPHERES;i++)spheres.add(0,{x:i,y:0,z:0},1);
  expect(()=>spheres.add(0,{x:0,y:0,z:0},1)).toThrow();
 });
 test('ADD_SPHERE writes the handle and REMOVE_SPHERE frees it',()=>{
  const game=new ScmGameState();
  const {global}=run(build(scmOpcode('ADD_SPHERE'),[float(2468.8),float(-1278.2),float(29.1),float(1.2),gvar(VAR)]),game);
  const handle=global(VAR);expect(game.scriptSpheres.index(handle)).toBe(0);
  expect(game.scriptSpheres.active[0]).toMatchObject({position:{x:expect.closeTo(2468.8,3),y:expect.closeTo(-1278.2,3),z:expect.closeTo(29.1,3)},radius:expect.closeTo(1.2,5)});
  run(build(scmOpcode('REMOVE_SPHERE'),[gvar(VAR)]),game,undefined,{[VAR]:handle});
  expect(game.scriptSpheres.active).toEqual([]);
 });
 test('DRAW_SPHERE hands the world a marker keyed by thread and instruction, with its point and radius',()=>{
  const game=new ScmGameState(),drawn:number[][]=[];
  run(build(scmOpcode('DRAW_SPHERE'),[float(1),float(2),float(3),float(1.5)]),game,{drawSphere:(id,x,y,z,r)=>{drawn.push([id,x,y,z,r]);}});
  expect(drawn).toHaveLength(1);expect(drawn[0][0]).toBeGreaterThan(0);expect(drawn[0].slice(1)).toEqual([1,2,3,1.5]);
 });
});
