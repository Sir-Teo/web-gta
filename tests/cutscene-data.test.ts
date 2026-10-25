import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readCutsceneFile,readCutsceneCameraPaths} from '../src/assets/cutscene';
import {readIfp} from '../src/assets/ifp';
import {writeAnp3,compressedOnLoad} from '../src/assets/ifpWrite';
import {FlyByCamera} from '../src/engine/nativeFlyByCamera';
import {findCutsceneAudioTrackId} from '../src/engine/ScmCutsceneTrack';
import {encodeCutsceneBundle,decodeCutsceneBundle} from '../src/assets/cutsceneBundle';
const published=(name:string)=>readFileSync(`public/play/cuts/${name}`);
const manifest=JSON.parse(published('manifest.json').toString()) as {cutscenes:Record<string,{bundle:{file:string;sha256:string;expandedBytes:number};track?:number}>};
/** A published cutscene's files, out of its bundle. */
const files=(name:string)=>{const b=decodeCutsceneBundle(gunzipSync(published(`${name}.csb`)));return {cut:Buffer.from(b.cut).toString('latin1'),dat:Buffer.from(b.dat).toString('latin1'),anp3:b.anp3};};

describe('the published cutscenes',()=>{
 test('are every scene in cuts.img but CUTTEST, each the file the manifest names with its stream track',()=>{
  const lock=JSON.parse(readFileSync('scripts/content/cutscene-sources.json','utf8')) as {published:string[]};
  expect(Object.keys(manifest.cutscenes)).toEqual(lock.published);
  expect(lock.published).toHaveLength(147);expect(lock.published).not.toContain('cuttest');
  // The dates share two tracks, each girlfriend's scene the same lines: 137 tracks for 147 scenes.
  expect(new Set(Object.values(manifest.cutscenes).map(c=>c.track)).size).toBe(137);
  for(const [name,c] of Object.entries(manifest.cutscenes)){
   expect(createHash('sha256').update(published(c.bundle.file)).digest('hex'),c.bundle.file).toBe(c.bundle.sha256);
   expect(gunzipSync(published(c.bundle.file)).length).toBe(c.bundle.expandedBytes);
   expect(c.track).toBe(findCutsceneAudioTrackId(name));
  }
  const streams=JSON.parse(readFileSync('public/play/audio/streams/streams.json','utf8')) as {tracks:{id:number}[]};
  for(const c of Object.values(manifest.cutscenes))expect(streams.tracks.some(t=>t.id===c.track)).toBe(true);
 });
 test('INTRO1A plays in CJ\'s house with Big Smoke, under extra colour 12, with fifteen lines',()=>{
  const d=readCutsceneFile(files('intro1a').cut);
  expect(d.offset).toEqual({x:2496.72998046875,y:-1691.6700439453125,z:1013.760009765625});
  expect(d.cast.map(c=>c.model)).toEqual(['csbat','csframe','csmomchair','csplay','cssmoke']);
  expect(d.cast.every(c=>!c.repeat&&c.anim===c.model)).toBe(true);
  expect(d.texts).toHaveLength(15);expect(d.texts[0]).toEqual({start:19580,duration:4026,key:'INT1A17'});
  expect(d.extraColour).toBe(11);expect(d.uncompressed).toEqual([]);
 });
 test('PROLOG1 keeps its travelling cast uncompressed, and each model line is its own object, under extra colour 3',()=>{
  const d=readCutsceneFile(files('prolog1').cut);
  expect(d.cast.map(c=>[c.model,c.anim])).toEqual([['cssuitcase','cssuitcase-1'],['cssuitcase','cssuitcase-2'],['csplay','csplay'],['csstew','csstew'],['cstaxi92','cstaxi92'],['csbogman','csbogman']]);
  expect(d.uncompressed).toEqual(['cssuitcase-1','cssuitcase-2','csplay','cstaxi92','csbogman']);
  expect(d.extraColour).toBe(2);
 });
 // Decodes all 147 native bundles; constrained runners can exceed Vitest's five-second default.
 test('every clip the cast plays is in its package, compressed unless listed',{timeout:15000},()=>{
  for(const name of Object.keys(manifest.cutscenes)){
   const f=files(name),d=readCutsceneFile(f.cut),pkg=readIfp(f.anp3);
   expect(pkg.format).toBe('ANP3');
   for(const member of d.cast){
    const clip=pkg.animations.find(a=>a.name.toLowerCase()===member.anim)!;expect(clip,`${name} ${member.anim}`).toBeDefined();
    expect(clip.tracks[0].frameType>=3,`${name} ${member.anim}`).toBe(compressedOnLoad(clip,d.uncompressed));
   }
  }
 });
 test('a camera file is four paths: field of view and roll at four floats a key, source and target at ten',()=>{
  const p=readCutsceneCameraPaths(files('intro1a').dat);
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
  const d=readCutsceneFile(files('intro1a').cut),cam=new FlyByCamera(readCutsceneCameraPaths(files('intro1a').dat),d.offset);
  let frames=0;while(cam.positionAlongSpline<1&&frames<10000){cam.process(50/30);frames++;
   expect(Math.hypot(cam.source.x-d.offset.x,cam.source.y-d.offset.y)).toBeLessThan(20);expect(Math.abs(cam.source.z-d.offset.z)).toBeLessThan(3);}
  expect(cam.finishTime).toBe(100700);expect(frames).toBe(3023);
 });
});

describe('the fly-by camera at its end',()=>{
 test('INTRO1A\'s field of view, read a key past its end on the finishing frame, keeps its last value',()=>{
  const d=readCutsceneFile(files('intro1a').cut),cam=new FlyByCamera(readCutsceneCameraPaths(files('intro1a').dat),d.offset);
  cam.process(0);
  // To exactly the finish time: the last FOV segment is 0.3 ms, and its marker steps off the array.
  cam.process(100699/20);expect(cam.positionAlongSpline).toBeLessThan(1);
  cam.process(1/20);expect(cam.positionAlongSpline).toBe(1);expect(Number.isFinite(cam.fov)).toBe(true);
  for(let i=0;i<5;i++){cam.process(0);expect(cam.fov).toBeCloseTo(65.015,2);expect(Number.isFinite(cam.source.x+cam.up.z)).toBe(true);}
 });
});

describe('a cutscene bundle',()=>{
 test('gives back its files and clips bit for bit, compressed and float tracks alike',()=>{
  const pkg={format:'ANPK' as const,name:'test',animations:[
   {name:'Packed',flags:0,duration:1,tracks:[{name:'root',boneId:0,frameType:2,times:new Float32Array([0,.5,1]),rotations:new Float32Array([0,0,0,1, .5,.5,.5,.5, -.9,.1,.2,.3]),translations:new Float32Array([0,0,0, 31.9,-31.9,1, -2,4,8])}]},
   {name:'Floats',flags:0,duration:2,tracks:[{name:'arm',boneId:22,frameType:1,times:new Float32Array([0,2]),rotations:new Float32Array([0,0,0,1, 0,1,0,0])}]}]};
  const anp3=writeAnp3(pkg,a=>a.name==='Packed'),cut=new TextEncoder().encode('info\noffset 1 2 3\nend\n'),dat=new TextEncoder().encode('1,\n0.0f,70,70,70,\n;\n');
  const back=decodeCutsceneBundle(encodeCutsceneBundle(cut,dat,anp3));
  expect(Buffer.from(back.anp3).equals(Buffer.from(anp3))).toBe(true);
  expect(Buffer.from(back.cut).equals(Buffer.from(cut))).toBe(true);expect(Buffer.from(back.dat).equals(Buffer.from(dat))).toBe(true);
 });
 test('refuses a truncated or padded bundle',()=>{
  const anp3=writeAnp3({format:'ANPK',name:'t',animations:[{name:'a',flags:0,duration:0,tracks:[{name:'r',boneId:0,frameType:1,times:new Float32Array([0]),rotations:new Float32Array([0,0,0,1])}]}]},()=>true);
  const bundle=encodeCutsceneBundle(new Uint8Array(),new Uint8Array(),anp3);
  expect(()=>decodeCutsceneBundle(bundle.subarray(0,bundle.length-1))).toThrow();
  const padded=new Uint8Array(bundle.length+1);padded.set(bundle);expect(()=>decodeCutsceneBundle(padded)).toThrow('Unexpected data');
 });
});
