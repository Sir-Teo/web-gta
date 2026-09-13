import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { NativeCharacter, type CharacterSource } from '../src/render/NativeCharacter';
import { readDff } from '../src/assets/dff';
import { readIfp } from '../src/assets/ifp';
import { Simulation } from '../src/simulation/Simulation';
let sim: Simulation, character: NativeCharacter;
beforeAll(async () => RAPIER.init()); afterEach(() => { character?.dispose(); sim?.dispose(); });
const source = (): CharacterSource => ({model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),textures:[],clip:readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0],track:0});
const controls = { x:0,y:1,cameraYaw:Math.PI,sprint:false,jump:false,handbrake:false };
function setup() { sim=new Simulation(true); sim.player.grounded=true; character=new NativeCharacter(source()); }
test('native clock advances on simulation steps and render updates cannot advance it', () => {
  setup(); const input=character.step(1,controls,sim); expect(input.animationMotion!.x).toBeCloseTo(1); expect(input.animationMotion!.z).toBeCloseTo(2);
  character.update(sim,.5); for(let i=0;i<100;i++)character.update(sim,1);
  expect(character.snapshot().seconds).toBe(1); expect(character.root.visible).toBe(true);
  const stopped=character.step(1,{...controls,y:0},sim); expect(stopped.animationMotion).toEqual({x:0,z:0}); expect(character.snapshot().seconds).toBe(0);
});
test('loop crossing and opposite input produce continuous transformed displacement', () => {
  setup(); character.step(1.9,controls,sim); const crossing=character.step(.2,controls,sim);
  expect(crossing.animationMotion!.x).toBeCloseTo(.2); expect(crossing.animationMotion!.z).toBeCloseTo(.4);
  const backwards=character.step(.1,{...controls,y:-1},sim); expect(backwards.animationMotion!.x).toBeCloseTo(-.1); expect(backwards.animationMotion!.z).toBeCloseTo(-.2);
});
test('unsupported actions return ordinary controls and hide the native rig', () => {
  setup(); sim.player.crouched=true; expect(character.step(.1,controls,sim)).toBe(controls); character.update(sim,1); expect(character.root.visible).toBe(false);
  sim.player.crouched=false; sim.player.health=0; expect(character.step(.1,controls,sim)).toBe(controls);
  sim.player.health=100; sim.player.grounded=false; expect(character.step(.1,controls,sim)).toBe(controls);
});
test('installs at the interpolated actor position and releases GPU resources once', () => {
  setup(); sim.player.previous={x:0,y:1,z:2};sim.player.position={x:2,y:3,z:4};character.update(sim,.5);expect(character.root.position.toArray()).toEqual([1,2,3]);
  const disposals: ReturnType<typeof vi.fn>[]=[];character.root.traverse(o=>{const geometry=(o as any).geometry;if(geometry){const spy=vi.spyOn(geometry,'dispose');disposals.push(spy);}});
  character.dispose();character.dispose();expect(disposals.length).toBeGreaterThan(0);disposals.forEach(spy=>expect(spy).toHaveBeenCalledTimes(1));
});
test('rejects animated extraction ancestors before installing the rig', () => {
  setup();
  const data=source();data.track=1;data.clip.tracks[1].translations=new Float32Array([0,0,0,1,0,0,2,0,0]);
  expect(()=>new NativeCharacter(data)).toThrow('animated parent');
  const invalid=source();invalid.clip.duration=0;expect(()=>new NativeCharacter(invalid)).toThrow('nonzero-duration');
});

function roles() {
  setup(); character.dispose(); const data=source();
  const [idle,walk,run]=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-roles.ifp'))).animations;
  data.clip=walk;data.idle={clip:idle,track:0};data.run={clip:run,track:0};character=new NativeCharacter(data);
}
test('assigned idle loops without moving and walk/run use their own root speeds', () => {
  roles(); const idle=character.step(.5,{...controls,y:0},sim);
  expect(character.snapshot()).toMatchObject({action:'idle',seconds:.5});expect(idle.animationMotion).toEqual({x:0,z:0});
  const walk=character.step(1,controls,sim);expect(walk.animationMotion!.z).toBeCloseTo(2);expect(character.snapshot().action).toBe('walk');
  const run=character.step(.1,{...controls,sprint:true},sim);expect(run.animationMotion!.z).toBeCloseTo(.4);expect(run.sprint).toBe(true);
  expect(character.snapshot()).toMatchObject({action:'run'});expect(character.snapshot().seconds).toBeCloseTo(.6);
  const back=character.step(.1,controls,sim);expect(back.animationMotion!.z).toBeCloseTo(.2);expect(character.snapshot().seconds).toBeCloseTo(1.3);
});
test('exhaustion gates running until recovery and missing run never drains sprint stamina', () => {
  roles(); sim.player.stamina=0;
  expect(character.step(.1,{...controls,sprint:true},sim).sprint).toBe(false);expect(character.snapshot().action).toBe('walk');
  sim.player.stamina=19;sim.player.sprintExhausted=true;character.step(.1,{...controls,sprint:true},sim);expect(character.snapshot().action).toBe('walk');
  sim.player.stamina=20;character.step(.1,{...controls,sprint:true},sim);expect(character.snapshot().action).toBe('run');
  character.dispose();character=new NativeCharacter(source());
  expect(character.step(.1,{...controls,sprint:true},sim).sprint).toBe(false);
});
test('role changes restore bones that the next clip does not animate', () => {
  roles(); character.step(.5,{...controls,sprint:true},sim);character.update(sim,1);
  const data=source(); const idle=structuredClone(data.clip); idle.tracks=idle.tracks.slice(0,1);
  character.dispose();character=new NativeCharacter({...data,idle:{clip:idle,track:0}});
  character.step(1,controls,sim);character.update(sim,1);
  let tip:any;character.root.traverse(o=>{if(o.name==='Tip')tip=o;});expect(Math.abs(tip.matrix.elements[0])).toBeLessThan(.01);
  character.step(.2,{...controls,y:0},sim);character.update(sim,1);expect(tip.matrix.elements[0]).toBeCloseTo(1);
});

test('pose transitions are continuous when interrupted and independent of render cadence', () => {
  setup(); character.step(.7,controls,sim);character.update(sim,1);
  let tip:any;character.root.traverse(o=>{if(o.name==='Tip')tip=o;});const before=[...tip.matrix.elements];
  character.step(.06,{...controls,y:0},sim);character.update(sim,0);expect(tip.matrix.elements).toEqual(before);
  character.update(sim,1);const partial=[...tip.matrix.elements];
  character.step(.03,controls,sim);character.update(sim,0);expect(tip.matrix.elements).toEqual(partial);
  character.update(sim,1);const final=[...tip.matrix.elements];
  for(const alpha of [.2,.8,.1,.9,1])character.update(sim,alpha);
  expect(tip.matrix.elements).toEqual(final);expect(character.snapshot().transition).toBeCloseTo(.03/.18);
});
