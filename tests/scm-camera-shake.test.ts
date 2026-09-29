import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmCamera} from '../src/engine/ScmCamera';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState,world?:Partial<ScmWorldCommands>,now=0){
 const adapter={fade(){},groundZForCoord:()=>5,isSphereVisible:()=>true,loadSceneInDirection(){},...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:adapter};
 const thread=new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
 return {thread,now};
}
const runOne=(thread:ScmThread,now=0)=>{try{thread.run(now,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 const found=blocks.flat().find(i=>i.name===name&&i.parameters.every(p=>[1,4,5,6].includes(p.type)));
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('camera shake, the running queries and the directional scene load',()=>{
 test('a weaker shake does not take over from what is left of the last one',()=>{
  const camera=new ScmCamera();
  camera.camShakeNoPos(1.5,1000);
  expect(camera.camShakeForce).toBe(1.5);
  expect(camera.camShakeStart).toBe(1000);
  // Half a second later a shake of one is weaker than the second still left, so it is ignored.
  camera.camShakeNoPos(1,1500);
  expect(camera.camShakeForce).toBe(1.5);
  // A second later only half is left, so the same shake takes over.
  camera.camShakeNoPos(1,2000);
  expect(camera.camShakeForce).toBe(1);
  expect(camera.camShakeStart).toBe(2000);
 });

 // CCamera::CamShake: 0.35 of the strength, less by the distance (nothing from 100 units), against what is left
 // of the current shake at that distance; shakeLeft reads the force less a unit a second, between nothing and two.
 test('a positioned shake is scaled by 0.35 and fades with distance',()=>{
  const camera=new ScmCamera();
  camera.camShake(2,0,1000);
  expect(camera.camShakeForce).toBeCloseTo(.7,9);expect(camera.shakeLeft(1200)).toBeCloseTo(.5,9);
  // Fifty units off: half the force, against half of what is left of the last (0.5 x 0.5), which it beats.
  camera.camShake(2,50,1200);expect(camera.camShakeForce).toBeCloseTo(.35,9);expect(camera.camShakeStart).toBe(1200);
  camera.camShake(1,50,1200);expect(camera.camShakeForce).toBeCloseTo(.35,9);
  camera.camShake(6,50,1200);expect(camera.camShakeForce).toBeCloseTo(1.05,9);
  // A hundred units off: nothing.
  camera.camShake(9,100,1300);expect(camera.camShakeForce).toBeCloseTo(1.05,9);
  expect(camera.shakeLeft(5000)).toBe(0);
 });

 test('the script’s own SHAKE_CAM divides its strength by a thousand',()=>{
  const {bytes,instruction}=find('SHAKE_CAM'),game=new ScmGameState();
  const {thread}=threadAt(bytes,instruction.offset,game);
  runOne(thread,4000);
  expect(game.camera.camShakeForce).toBeCloseTo((instruction.parameters[0].value as number)/1000,6);
  expect(game.camera.camShakeStart).toBe(4000);
 });

 test('a simple shake keeps its own intensity, type and span',()=>{
  const camera=new ScmCamera();
  camera.addShakeSimple(750,3,0.4,2000);
  expect(camera.shakeIntensity).toBeCloseTo(0.4,6);
  expect(camera.shakeType).toBe(3);
  expect(camera.startShakeTime).toBe(2000);
  expect(camera.endShakeTime).toBe(2750);
  camera.initialiseScriptableComponents();
  expect(camera.startShakeTime).toBe(-1);
  expect(camera.endShakeTime).toBe(-1);
 });

 test('the running queries answer until the clock passes the end of the move',()=>{
  const camera=new ScmCamera();
  expect(camera.vectorMoveRunning(0)).toBe(false);
  camera.moveLinearEndTime=5000;camera.trackLinearEndTime=3000;
  expect(camera.vectorMoveRunning(4999)).toBe(true);
  expect(camera.vectorMoveRunning(5000)).toBe(true);
  expect(camera.vectorMoveRunning(5001)).toBe(false);
  expect(camera.vectorTrackRunning(2999)).toBe(true);
  expect(camera.vectorTrackRunning(3001)).toBe(false);
 });

 test('a point below the map floor is tested at the ground under it',()=>{
  // IS_POINT_ON_SCREEN with three float operands and a radius, assembled to carry the sentinel height.
  const bytes=new Uint8Array(2+4*5);
  const view=new DataView(bytes.buffer);
  view.setUint16(0,0xc2,true);
  [12,34,ScmCamera.MAP_Z_LOW_LIMIT-1,2].forEach((value,k)=>{bytes[2+k*5]=6;view.setFloat32(3+k*5,value,true);});
  const game=new ScmGameState();
  const asked:{x:number;y:number;z:number}[]=[];
  const {thread}=threadAt(bytes,0,game,{groundZForCoord:()=>77,isSphereVisible:point=>{asked.push({...point});return true;}});
  runOne(thread);
  expect(asked).toEqual([{x:12,y:34,z:77}]);
  expect(thread.condition).toBe(true);
 });
});
