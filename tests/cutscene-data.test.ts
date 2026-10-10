import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readCutsceneFile,readCutsceneCameraPaths} from '../src/assets/cutscene';
import {readIfp} from '../src/assets/ifp';
import {writeAnp3,compressedOnLoad} from '../src/assets/ifpWrite';
import {FlyByCamera} from '../src/engine/nativeFlyByCamera';
import {findCutsceneAudioTrackId} from '../src/engine/ScmCutsceneTrack';
const published=(name:string)=>readFileSync(`public/play/cuts/${name}`);
const manifest=JSON.parse(published('manifest.json').toString()) as {cutscenes:Record<string,{cut:{file:string;sha256:string};dat:{file:string;sha256:string};ifp:{file:string;sha256:string};track?:number}>};

describe('the published cutscenes',()=>{
 test('are the files the manifest names, the opening five with their stream tracks',()=>{
  expect(Object.keys(manifest.cutscenes)).toEqual(['prolog1','prolog3','intro1a','intro1b','intro2a']);
  for(const [name,c] of Object.entries(manifest.cutscenes)){
   for(const f of [c.cut,c.dat,c.ifp])expect(createHash('sha256').update(published(f.file)).digest('hex'),f.file).toBe(f.sha256);
   expect(c.track).toBe(findCutsceneAudioTrackId(name));
  }
  const streams=JSON.parse(readFileSync('public/play/audio/streams/streams.json','utf8')) as {tracks:{id:number}[]};
  for(const c of Object.values(manifest.cutscenes))expect(streams.tracks.some(t=>t.id===c.track)).toBe(true);
 });
 test('INTRO1A plays in CJ\'s house with Big Smoke, under extra colour 12, with fifteen lines',()=>{
  const d=readCutsceneFile(published('intro1a.cut').toString('latin1'));
  expect(d.offset).toEqual({x:2496.72998046875,y:-1691.6700439453125,z:1013.760009765625});
  expect(d.cast.map(c=>c.model)).toEqual(['csbat','csframe','csmomchair','csplay','cssmoke']);
  expect(d.cast.every(c=>!c.repeat&&c.anim===c.model)).toBe(true);
  expect(d.texts).toHaveLength(15);expect(d.texts[0]).toEqual({start:19580,duration:4026,key:'INT1A17'});
  expect(d.extraColour).toBe(11);expect(d.uncompressed).toEqual([]);
 });
 test('PROLOG1 keeps its travelling cast uncompressed, and each model line is its own object, under extra colour 3',()=>{
  const d=readCutsceneFile(published('prolog1.cut').toString('latin1'));
  expect(d.cast.map(c=>[c.model,c.anim])).toEqual([['cssuitcase','cssuitcase-1'],['cssuitcase','cssuitcase-2'],['csplay','csplay'],['csstew','csstew'],['cstaxi92','cstaxi92'],['csbogman','csbogman']]);
  expect(d.uncompressed).toEqual(['cssuitcase-1','cssuitcase-2','csplay','cstaxi92','csbogman']);
  expect(d.extraColour).toBe(2);
 });
 test('every clip the cast plays is in its package, compressed unless listed',()=>{
  for(const name of Object.keys(manifest.cutscenes)){
   const d=readCutsceneFile(published(`${name}.cut`).toString('latin1')),pkg=readIfp(gunzipSync(published(`${name}.ifp.gz`)));
   expect(pkg.format).toBe('ANP3');
   for(const member of d.cast){
    const clip=pkg.animations.find(a=>a.name.toLowerCase()===member.anim)!;expect(clip,`${name} ${member.anim}`).toBeDefined();
    expect(clip.tracks[0].frameType>=3,`${name} ${member.anim}`).toBe(compressedOnLoad(clip,d.uncompressed));
   }
  }
 });
 test('a camera file is four paths: field of view and roll at four floats a key, source and target at ten',()=>{
  const p=readCutsceneCameraPaths(published('intro1a.dat').toString('latin1'));
  expect([p.fov[0],p.roll[0],p.position[0],p.target[0]]).toEqual([49,20,54,54]);
  expect([p.fov.length,p.roll.length,p.position.length,p.target.length]).toEqual([197,81,541,541]);
  expect([...p.fov.subarray(1,5)]).toEqual([0,85,85,85]);
  expect(p.position[10*54-9]).toBeCloseTo(100.700005,5);
 });
});

describe('the cutscene clips as the loader holds them',()=>{
 const pkg={format:'ANPK' as const,name:'test',animations:[{name:'Prop',flags:0,duration:1,tracks:[{name:'root',boneId:0,frameType:2,
  times:new Float32Array([0,0.0166,1]),rotations:new Float32Array([0,0,0,1, 0.5,0.5,0.5,0.5, 0.1,0.2,0.3,0.927]),translations:new Float32Array([0,0,0, 1.5,-2.25,0.0009, 40,-40,31.9])}]}]};
 test('a compressed key truncates its rotation (×4096) and translation (×1024) and rounds its time (×60)',()=>{
  const back=readIfp(writeAnp3(pkg,()=>true)).animations[0].tracks[0];
  expect(back.frameType).toBe(4);
  expect([...back.times]).toEqual([0,1/60,1].map(Math.fround));
  expect(back.rotations[11]).toBeCloseTo(Math.trunc(0.927*4096)/4096,6);
  expect(back.translations![5]).toBe(0);expect(back.translations![3]).toBe(1.5);
 });
 test('a translation past the 16 bits wraps, as the executable\'s store does',()=>{
  const back=readIfp(writeAnp3(pkg,()=>true)).animations[0].tracks[0];
  expect(back.translations![6]).toBe(-24);expect(back.translations![7]).toBe(24);expect(back.translations![8]).toBeCloseTo(31.9,2);
 });
 test('an uncompressed clip keeps its floats, and the "uncompress" list is matched without case',()=>{
  const back=readIfp(writeAnp3(pkg,a=>compressedOnLoad(a,['PROP']))).animations[0].tracks[0];
  expect(back.frameType).toBe(2);expect(back.translations![6]).toBe(40);expect(back.times[1]).toBe(Math.fround(0.0166));
 });
});

describe('the fly-by camera',()=>{
 /** Two position and target keys 1 s apart (linear: the out handle is the point), fov 40 to 80, no roll. */
 const key=(t:number,x:number,y:number,z:number)=>[t,x,y,z,x,y,z,x,y,z];
 const paths=(extra:number[][]=[])=>({
  fov:new Float32Array([2,0,40,40,40,1,80,80,80]),roll:new Float32Array([2,0,0,0,0,1,0,0,0]),
  position:new Float32Array([2+extra.length,...key(0,0,0,0),...extra.flat(),...key(1,10,0,0)]),
  target:new Float32Array([2,...key(0,0,10,0),...key(1,10,10,0)]),
 });
 test('reads the paths at its own clock, offset, and ends once past the last source key',()=>{
  const cam=new FlyByCamera(paths(),{x:100,y:200,z:5});
  cam.process(1);expect(cam.finishTime).toBe(1000);expect(cam.source).toEqual({x:100,y:200,z:5});expect(cam.fov).toBe(40);
  cam.process(25);// 500 ms
  expect(cam.source.x).toBeCloseTo(105,5);expect(cam.fov).toBeCloseTo(60,5);expect(cam.positionAlongSpline).toBeCloseTo(.5,5);
  expect(cam.front.y).toBeCloseTo(1,5);expect(cam.up.z).toBeCloseTo(1,5);
  cam.process(25);expect(cam.positionAlongSpline).toBe(1);expect(cam.source.x).toBeCloseTo(110,5);
 });
 test('a segment of 32 ms or less is a cut it steps over',()=>{
  // A cut at 0.5 s: the source jumps from x 0 to x 50 within 20 ms; the reader never shows the jump's middle.
  const cam=new FlyByCamera(paths([key(0.5,5,0,0),key(0.52,50,0,0)]),{x:0,y:0,z:0});
  cam.process(0);cam.process(25.25);// 505 ms
  expect(cam.source.x).toBeCloseTo(50,3);
 });
 test('a roll tilts the up vector, square to the view',()=>{
  const p=paths();p.roll.set([2,0,90,90,90,1,90,90,90]);
  const cam=new FlyByCamera(p,{x:0,y:0,z:0});cam.process(0);
  expect(cam.up.x).toBeCloseTo(-1,5);expect(cam.up.y).toBeCloseTo(0,5);expect(cam.up.z).toBeCloseTo(0,5);
 });
 test('INTRO1A runs 100.7 s, inside CJ\'s house',()=>{
  const d=readCutsceneFile(published('intro1a.cut').toString('latin1')),cam=new FlyByCamera(readCutsceneCameraPaths(published('intro1a.dat').toString('latin1')),d.offset);
  let frames=0;while(cam.positionAlongSpline<1&&frames<10000){cam.process(50/30);frames++;
   expect(Math.hypot(cam.source.x-d.offset.x,cam.source.y-d.offset.y)).toBeLessThan(20);expect(Math.abs(cam.source.z-d.offset.z)).toBeLessThan(3);}
  expect(cam.finishTime).toBe(100700);expect(frames).toBe(3023);
 });
});
