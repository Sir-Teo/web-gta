import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {MAX_SET_PIECES,ScmSetPieces} from '../src/engine/ScmSetPieces';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:{fade(){}} as ScmWorldCommands};
 return new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(1234,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 const found=blocks.flat().find(i=>i.name===name&&i.parameters.every(p=>[1,4,5,6].includes(p.type)));
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('set pieces and the camera’s scriptable components',()=>{
 test('an added set piece keeps its area as a rectangle, whichever corners it was given',()=>{
  const pieces=new ScmSetPieces();
  expect(pieces.addOne(3,{x:10,y:20},{x:-5,y:4},{x:1,y:1},{x:2,y:2},{x:3,y:3},{x:4,y:4})).toBe(true);
  const piece=pieces.pieces[0];
  expect(piece.type).toBe(3);
  expect(piece.area).toEqual({left:-5,bottom:4,right:10,top:20});
  expect(piece.spawn2).toEqual({x:3,y:3});
  pieces.init();
  expect(pieces.count).toBe(0);
 });

 test('a full table drops the next one without a word',()=>{
  const pieces=new ScmSetPieces();
  for(let i=0;i<MAX_SET_PIECES;i++)expect(pieces.addOne(1,{x:i,y:0},{x:i+1,y:1},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0})).toBe(true);
  expect(pieces.addOne(1,{x:0,y:0},{x:1,y:1},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0})).toBe(false);
  expect(pieces.count).toBe(MAX_SET_PIECES);
 });

 test('the script’s own ADD_SET_PIECE fills a slot with its twelve coordinates',()=>{
  const {bytes,instruction}=find('ADD_SET_PIECE'),game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.setPieces.count).toBe(1);
  const values=instruction.parameters.map(p=>p.value as number),piece=game.setPieces.pieces[0];
  expect(piece.type).toBe(values[0]);
  expect(piece.area.left).toBeCloseTo(Math.min(values[1],values[3]),3);
  expect(piece.area.top).toBeCloseTo(Math.max(values[2],values[4]),3);
  expect(piece.target2.y).toBeCloseTo(values[12],3);
 });

 test('resetting the scriptable components puts the zoom and track fields back',()=>{
  const game=new ScmGameState();
  game.camera.lerpFOV(1,2,500,true,1000);
  expect(game.camera.startZoomTime).toBe(1000);
  expect(game.camera.endZoomTime).toBe(1500);
  game.camera.cameraPersistTrack=true;game.camera.blockZoom=true;
  game.camera.initialiseScriptableComponents();
  expect(game.camera.startZoomTime).toBe(-1);
  expect(game.camera.endZoomTime).toBe(-1);
  expect(game.camera.zoomInFactor).toBe(0);
  expect(game.camera.zoomMode).toBe(1);
  expect(game.camera.cameraPersistTrack).toBe(false);
  expect(game.camera.blockZoom).toBe(false);
 });

 test('the persist and cinema switches are plain flags the script sets',()=>{
  const game=new ScmGameState();
  expect(game.camera.cameraPersistPosition).toBe(false);
  game.camera.cameraPersistPosition=true;game.camera.cinemaCamera=true;
  expect(game.camera.cinemaCamera).toBe(true);
  game.camera.initialiseScriptableComponents();
  // The cinema switch is not one of the fields the reset touches.
  expect(game.camera.cameraPersistPosition).toBe(false);
  expect(game.camera.cinemaCamera).toBe(true);
 });
});
