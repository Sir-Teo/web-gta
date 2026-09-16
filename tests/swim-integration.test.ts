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
  sim.player.swimState=0;
  character.step(1/60,{...controls,y:0},sim);
  expect(character.snapshot().action).toBe('swimTread');
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
  // Servo holds feet near the waterline minus breast submerge (0.95 at full blend).
  expect(sim.player.position.y).toBeGreaterThan(-1.1);
  expect(sim.player.position.y).toBeLessThan(-.8);
  // Dive states descend on the authored progress rate instead of the servo.
  sim.player.swimState=3;sim.player.swimDiveTime=10;sim.player.swimDiveDuration=1;
  const diving=sim.player.position.y;
  for(let i=0;i<30;i++)sim.step(1/60,{...controls,swimWater:0,animationMotion:{x:0,z:0},animationMotionSpace:'world'});
  expect(sim.player.position.y).toBeLessThan(diving);
 }finally{sim.dispose();}
});
