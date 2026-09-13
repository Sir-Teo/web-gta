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
