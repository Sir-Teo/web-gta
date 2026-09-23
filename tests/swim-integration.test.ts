import {beforeAll,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {NativeCharacter,type CharacterSource} from '../src/render/NativeCharacter';
import {readDff} from '../src/assets/dff';
import {readIfp} from '../src/assets/ifp';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});
const source=():CharacterSource=>({model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),textures:[],clip:readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0],track:0});
const controls={x:0,y:1,cameraYaw:Math.PI,sprint:false,jump:false};

test('swim roles install once and select by swim state',()=>{
 const sim=new Simulation(),character=new NativeCharacter(source());
 try{
  const clip=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0];
  character.installSwim({tread:{clip},breast:{clip,track:0},crawl:{clip,track:0},under:{clip,track:0},glide:{clip},dive:{clip}});
  character.installSwim({tread:{clip}});
  sim.player.swimming=true;sim.player.swimBlend=1;
  sim.player.swimState=1;
  const stroke=character.step(1/60,controls,sim);
  expect(character.snapshot().action).toBe('swimBreast');
  expect(stroke.animationMotion).toBeDefined();
  expect(character.swimUnderAssociation()).toBeUndefined();
  sim.player.swimState=4;
  character.step(1/60,controls,sim);
  const blending=character.swimUnderAssociation()!;
  expect(blending.speed).toBe(.8);expect(blending.blend).toBeGreaterThan(0);expect(blending.blend).toBeLessThan(1);
  for(let i=0;i<20;i++)character.step(1/60,{...controls,sprint:true},sim);
  expect(character.swimUnderAssociation()).toEqual({speed:1.2,blend:1});
  sim.player.swimState=0;
  character.step(1/60,{...controls,y:0},sim);
  expect(character.snapshot().action).toBe('swimTread');
  expect(character.swimUnderAssociation()).toBeUndefined();
  sim.player.swimming=false;
  character.step(1/60,controls,sim);
  expect(character.snapshot().action).not.toMatch(/^swim/);
 }finally{character.dispose();sim.dispose();}
});

test('swimming blends strokes, servos to the waterline and dives on clip vertical',()=>{
 const sim=new Simulation();
 try{
  sim.player.swimming=true;sim.player.swimState=1;sim.player.swimBlend=1;
  sim.playerBody.setTranslation({x:0,y:.4,z:0},true);
  sim.playerBody.setNextKinematicTranslation({x:0,y:.4,z:0});
  const stroke={x:0,z:.1};
  for(let i=0;i<120;i++)sim.step(1/60,{...controls,swimWater:0,animationMotion:{...stroke},animationMotionSpace:'world'});
  // Sustained strokes converge near stroke speed with resistance blending.
  expect(sim.player.speed).toBeGreaterThan(3);
  // Servo holds the ped origin (a unit above the feet) at the waterline minus the breaststroke submerge (0.4 at
  // full blend): feet near -1.4.
  expect(sim.player.position.y).toBeGreaterThan(-1.55);
  expect(sim.player.position.y).toBeLessThan(-1.25);
  // Dive states descend on the authored progress rate instead of the servo.
  sim.player.swimState=3;sim.player.swimDiveTime=10;sim.player.swimDiveDuration=1;
  const diving=sim.player.position.y;
  for(let i=0;i<30;i++)sim.step(1/60,{...controls,swimWater:0,animationMotion:{x:0,z:0},animationMotionSpace:'world'});
  expect(sim.player.position.y).toBeLessThan(diving);
 }finally{sim.dispose();}
});

test('underwater, no input glides, and the swimmer rises along its pitch with a slow drift (ProcessSwimmingResistance)',()=>{
 const sim=new Simulation(),character=new NativeCharacter(source());
 try{
  const clip=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0];
  character.installSwim({tread:{clip},breast:{clip,track:0},crawl:{clip,track:0},under:{clip,track:0},glide:{clip},dive:{clip}});
  sim.player.swimming=true;sim.player.swimState=4;
  character.step(1/60,{...controls,y:0},sim);
  expect(character.snapshot().action).toBe('swimGlide');
  // Ten metres under a surface at 20, looking level: the drift alone lifts him a little.
  sim.respawn={x:0,y:10,z:0};sim.resetPlayer();sim.player.swimming=true;sim.player.swimState=4;sim.player.swimPitch=0;
  const level=()=>{const y0=sim.player.position.y;for(let i=0;i<60;i++)sim.step(1/60,{...controls,x:0,y:0,swimWater:20,cameraPitch:0} as any);return sim.player.position.y-y0;};
  const drift=level();
  expect(drift).toBeGreaterThan(0);expect(drift).toBeLessThan(.6);
  // Looking up, the pitch climbs toward the camera's.
  for(let i=0;i<60;i++)sim.step(1/60,{...controls,x:0,y:0,swimWater:20,cameraPitch:1.2} as any);
  expect(sim.player.swimPitch).toBeGreaterThan(.9);
 }finally{character.dispose();sim.dispose();}
});

test('a jump out of the water rises at 8 / mass units a frame and falls back under 0.7 of gravity (SWIM_JUMPOUT)',()=>{
 const sim=new Simulation();
 try{
  sim.respawn={x:0,y:18,z:0};sim.resetPlayer();sim.player.swimming=true;sim.player.swimState=5;
  sim.step(1/60,{...controls,x:0,y:0,swimWater:20} as any);
  const start=sim.player.verticalSpeed;
  expect(start).toBeCloseTo(8/70*50,5);
  for(let i=0;i<30;i++)sim.step(1/60,{...controls,x:0,y:0,swimWater:20} as any);
  expect(sim.player.verticalSpeed).toBeLessThan(start);expect(sim.player.position.y).toBeGreaterThan(18);
 }finally{sim.dispose();}
});

test('falling into the water carries CJ under before he bobs back up (ProcessSwimmingResistance keeps the move speed)',()=>{
 const sim=new Simulation();
 try{
  // Feet at 19.45: the origin (a unit higher) sits at the surface float depth of 0.55 under 21.
  sim.respawn={x:0,y:19.45,z:0};sim.resetPlayer();sim.player.swimming=true;sim.player.swimState=0;sim.player.verticalSpeed=-15;
  let lowest=sim.player.position.y;
  for(let i=0;i<120;i++){sim.step(1/60,{...controls,x:0,y:0,swimWater:21} as any);lowest=Math.min(lowest,sim.player.position.y);}
  expect(lowest).toBeLessThan(19.45-.5);
  expect(Math.abs(sim.player.position.y-19.45)).toBeLessThan(.2);
 }finally{sim.dispose();}
});
