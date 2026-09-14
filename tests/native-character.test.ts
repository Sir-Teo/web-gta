import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { NativeCharacter, type CharacterSource } from '../src/render/NativeCharacter';
import { readDff } from '../src/assets/dff';
import { readIfp } from '../src/assets/ifp';
import {Mesh} from 'three';
import {Matrix4,Object3D} from 'three';
import {readPlayerBaseBody,PLAYER_CLASSIC_FILES} from '../src/assets/readPlayerBaseBody';
import {playerShoulderMatrix} from '../src/animation/playerShoulders';
import { Simulation } from '../src/simulation/Simulation';
let sim: Simulation, character: NativeCharacter;
beforeAll(async () => RAPIER.init()); afterEach(() => { character?.dispose(); sim?.dispose(); });
const source = (): CharacterSource => ({model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),textures:[],clip:readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0],track:0});
const controls = { x:0,y:1,cameraYaw:Math.PI,sprint:false,jump:false,handbrake:false };
function setup() { sim=new Simulation(true); sim.player.grounded=true; character=new NativeCharacter(source()); }
test('native player correction requires an explicit marker, native coordinates and the actual shoulder bones',()=>{
 const data=source();
 expect(()=>new NativeCharacter({...data,playerBody:'yes' as any})).toThrow('Invalid player body marker');
 expect(()=>new NativeCharacter({...data,playerBody:true})).toThrow('San Andreas pedestrian coordinates');
 expect(()=>new NativeCharacter({...data,playerBody:true,convention:'san-andreas-ped'})).toThrow('shoulder bone');
 character=new NativeCharacter(data);expect(character.snapshot().playerBody).toBe(false);
});
test.skipIf(!process.env.GTA_CONTENT_DIR||!process.env.GTA_REFERENCE_DIR)('player shoulders follow blended walking, running and idle poses in the gameplay adapter',()=>{
 const files=new Map(PLAYER_CLASSIC_FILES.map(n=>[n,new Uint8Array(readFileSync(`${process.env.GTA_CONTENT_DIR}/player/${n}`))]));
 const body=readPlayerBaseBody(files,'fat','classic');
 const pack=readIfp(new Uint8Array(readFileSync(`${process.env.GTA_REFERENCE_DIR}/fat.ifp`)));
 const clip=(name:string)=>pack.animations.find(a=>a.name===name)!;
 sim=new Simulation(true);sim.player.grounded=true;
 character=new NativeCharacter({...body,convention:'san-andreas-ped',clip:clip('FatWalk'),track:0,idle:{clip:clip('FatIdle')},run:{clip:clip('FatRun'),track:0}});
 const bones=new Map<number,Object3D>();character.root.traverse(o=>{const frame=body.model.frames[o.userData.nativeFrame];if(frame?.hanim)bones.set(frame.hanim.id,o);});
 for(const input of [{...controls,y:1},{...controls,y:1,sprint:true},{...controls,y:0}])for(let frame=0;frame<20;frame++){
  character.step(1/60,input,sim);character.update(sim,.5);character.root.updateMatrixWorld(true);
  for(const [helper,arm,clavicle] of [[301,22,21],[302,32,31]]){
   const expected=playerShoulderMatrix(bones.get(clavicle)!.matrixWorld,bones.get(arm)!.matrixWorld,new Matrix4());
   bones.get(helper)!.matrixWorld.elements.forEach((n,i)=>expect(n).toBeCloseTo(expected.elements[i],6));
  }
 }
 expect(character.snapshot().playerBody).toBe(true);expect(character.snapshot().action).toBe('idle');
});
test('only native player characters adopt the strict player alpha and depth policy',()=>{
 sim=new Simulation(true);
 for(const convention of ['feet','san-andreas-ped'] as const){
  const data=source();data.convention=convention;data.model.geometries.forEach(g=>g.materials.forEach(m=>{m.color[3]=128;}));
  character=new NativeCharacter(data);let count=0;
  character.root.traverse(o=>{if(o instanceof Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
   count++;expect(material.depthWrite).toBe(convention==='san-andreas-ped');expect(material.transparent).toBe(true);expect(material.opacity).toBe(128/255);
   if(convention==='san-andreas-ped')expect(material.alphaTest).toBe(1/255);
  }});
  expect(count).toBeGreaterThan(0);character.dispose();
 }
});
test('native clock advances on simulation steps and render updates cannot advance it', () => {
  setup(); const input=character.step(1,controls,sim); expect(input.animationMotion!.x).toBeCloseTo(.91); expect(input.animationMotion!.z).toBeCloseTo(1.82);
  character.update(sim,.5);const interpolatedRevision=character.shadowPoseRevision;
  character.update(sim,1);const finalRevision=character.shadowPoseRevision;expect(finalRevision).toBeGreaterThan(interpolatedRevision);
  for(let i=0;i<100;i++)character.update(sim,1);expect(character.shadowPoseRevision).toBe(finalRevision);
  expect(character.snapshot().seconds).toBe(1); expect(character.root.visible).toBe(true);
  const stopped=character.step(1,{...controls,y:0},sim); expect(stopped.animationMotion!.x).toBeCloseTo(.09); expect(stopped.animationMotion!.z).toBeCloseTo(.18); expect(character.snapshot().seconds).toBe(0);
});
test('candidate shadow sphere transforms from native model coordinates and keeps a stable padded radius',()=>{
 sim=new Simulation(true);
 const data=source();data.convention='san-andreas-ped';data.model.geometries[0].morphBounds=[{center:[1,2,3],radius:2}];
 character=new NativeCharacter(data);character.root.position.set(10,20,30);character.root.rotation.y=Math.PI/2;
 const sphere=character.shadowSphere()!;expect(sphere.radius).toBeCloseTo(2.2);expect(sphere.center.x).toBeCloseTo(8);expect(sphere.center.y).toBeCloseTo(23);expect(sphere.center.z).toBeCloseTo(29);
 sphere.center.set(0,0,0);expect(character.shadowSphere()!.center.y).toBeCloseTo(23);
});
test('shadow distance anchor follows the posed native root bone and falls back to entity position',()=>{
 sim=new Simulation(true);
 const data=source(),frame=data.model.frames.findIndex(f=>f.hanim);
 const original=data.model.frames[frame].hanim!.id;
 data.model.frames[frame].hanim!.id=0;
 data.model.frames.forEach(f=>f.hanim?.nodes.forEach(node=>{if(node.id===original)node.id=0;}));
 data.clip.tracks.forEach(t=>{if(t.boneId===original)t.boneId=0;});
 character=new NativeCharacter(data);
 let bone:any;character.root.traverse(o=>{if(o.userData.nativeFrame===frame)bone=o;});
 character.root.position.set(10,20,30);
 for(let parent=bone.parent;parent?.userData.nativeFrame!==undefined;parent=parent.parent)parent.matrix.identity();
 bone.matrixAutoUpdate=false;bone.matrix.makeTranslation(1,2,3);
 const position=character.shadowPosition();expect(position.x).toBeCloseTo(11);expect(position.y).toBeCloseTo(23);expect(position.z).toBeCloseTo(28);
 position.set(0,0,0);expect(character.shadowPosition().distanceTo({x:11,y:23,z:28} as any)).toBeLessThan(1e-10);
 character.dispose();data.model.frames.forEach(f=>{if(f.hanim?.id===0)f.hanim.id=1000;});
 data.model.frames.forEach(f=>f.hanim?.nodes.forEach(node=>{if(node.id===0)node.id=1000;}));
 data.clip.tracks.forEach(t=>{if(t.boneId===0)t.boneId=1000;});
 character=new NativeCharacter(data);character.root.position.set(10,20,30);expect(character.shadowPosition().toArray()).toEqual([10,20,30]);
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
test('native ped origin stays one unit above interpolated feet, including crouching', () => {
  sim=new Simulation(true); character=new NativeCharacter({...source(),convention:'san-andreas-ped'});
  sim.player.previous={x:0,y:1,z:2};sim.player.position={x:2,y:3,z:4};
  character.update(sim,.5);expect(character.root.position.toArray()).toEqual([1,3,3]);
  sim.player.crouched=true;character.update(sim,.5);expect(character.root.position.toArray()).toEqual([1,3,3]);
  expect(()=>new NativeCharacter({...source(),convention:'unknown' as any})).toThrow('Unknown character coordinates');
});
test('native positive-Y animation and visible forward follow all four input headings', () => {
  sim=new Simulation(true);sim.player.grounded=true;
  const data=source(), track=data.clip.tracks[data.track];
  // A native forward stride, with no lateral drift, independently of the rig fixture's motion.
  track.translations=new Float32Array(track.times.length*3);
  track.times.forEach((time,i)=>{track.translations![i*3+1]=time;});
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    character=new NativeCharacter({...data,convention:'san-andreas-ped'});
    const expected={x:-Math.sin(yaw),z:-Math.cos(yaw)};
    sim.player.heading=Math.atan2(expected.x,expected.z);sim.player.grounded=true;
    sim.step(1/60,character.step(1/60,{...controls,cameraYaw:yaw},sim));
    const motion=sim.animationMovement!.requested;
    expect(motion.x*expected.x+motion.z*expected.z).toBeGreaterThan(0);
    expect(motion.x*expected.z-motion.z*expected.x).toBeCloseTo(0);
    sim.player.heading=Math.atan2(expected.x,expected.z);character.update(sim,1);
    // ModelObjects maps native +Y to -Z before the actor heading is applied.
    expect(-Math.sin(character.root.rotation.y)).toBeCloseTo(expected.x);
    expect(-Math.cos(character.root.rotation.y)).toBeCloseTo(expected.z);
    character.dispose();
  }
});

function roles() {
  setup(); character.dispose(); const data=source();
  const [idle,walk,run]=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-roles.ifp'))).animations;
  data.clip=walk;data.idle={clip:idle,track:0};data.run={clip:run,track:0};character=new NativeCharacter(data);
}
test('assigned idle loops without moving and walk/run use their own root speeds', () => {
  roles(); const idle=character.step(.5,{...controls,y:0},sim);
  expect(character.snapshot()).toMatchObject({action:'idle',seconds:.5});expect(idle.animationMotion).toEqual({x:0,z:0});
  const walk=character.step(1,controls,sim);expect(walk.animationMotion!.z).toBeCloseTo(1.82);expect(character.snapshot().action).toBe('walk');
  const run=character.step(.1,{...controls,sprint:true},sim);expect(run.animationMotion!.z).toBeCloseTo(.2 + .01/.18);expect(run.sprint).toBe(true);
  expect(character.snapshot()).toMatchObject({action:'run'});expect(character.snapshot().seconds).toBeCloseTo(.6);
  const back=character.step(.1,controls,sim);expect(back.animationMotion!.z).toBeGreaterThan(.2); expect(back.animationMotion!.z).toBeLessThan(.4);expect(character.snapshot().seconds).toBeCloseTo(1.3);
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

test('blended locomotion and stopping remain constrained by capsule collision', () => {
  roles();sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,3,.1).setTranslation(0,3,1.5));sim.world.step();
  for(let i=0;i<180;i++)sim.step(1/60,character.step(1/60,{...controls,sprint:true},sim));
  expect(sim.player.position.z).toBeGreaterThan(.9);expect(sim.player.position.z).toBeLessThan(1.11);
  for(let i=0;i<30;i++)sim.step(1/60,character.step(1/60,{...controls,y:0},sim));
  expect(sim.player.position.z).toBeLessThan(1.11);expect(sim.animationMovement!.requested).toEqual({x:0,z:0});
});

test('native character receives day and night palette changes without mutating source colors', () => {
  setup();character.dispose();const data=source();data.model.geometries[0].nightColors=new Uint8Array(24).fill(0);character=new NativeCharacter(data);
  let color:any;character.root.traverse(o=>{if((o as any).geometry)color=(o as any).geometry.getAttribute('color');});
  const day=color.getX(0);character.setNight(1);expect(color.getX(0)).toBe(0);character.setNight(.5);expect(color.getX(0)).toBeCloseTo(day/2);character.setNight(0);expect(color.getX(0)).toBe(day);
});

test('native crouch roles keep the rig visible, use their own pace and prevent sprinting', () => {
  setup();character.dispose();const data=source();const [idle,walk]=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-crouch.ifp'))).animations;
  data.crouchIdle={clip:idle,track:0};data.crouchWalk={clip:walk,track:0};character=new NativeCharacter(data);
  sim.player.crouched=true;character.step(.2,{...controls,y:0},sim);character.update(sim,1);
  expect(character.snapshot()).toMatchObject({action:'crouchIdle',visible:true});
  let tip:any;character.root.traverse(o=>{if(o.name==='Tip')tip=o;});expect(tip.matrix.elements[14]).toBeCloseTo(.45,2);
  const start=character.step(.2,{...controls,sprint:true},sim);expect(start.sprint).toBe(false);expect(character.snapshot().action).toBe('crouchWalk');
  expect(character.step(.1,{...controls,sprint:true},sim).animationMotion!.z).toBeCloseTo(.1);
  sim.player.crouched=false;character.step(.2,controls,sim);character.update(sim,1);expect(character.snapshot()).toMatchObject({action:'walk',visible:true});expect(tip.matrix.elements[14]).toBeCloseTo(1);
});
test('partial crouch assignments fail before allocating a replacement character', () => {
  setup();const data=source();expect(()=>new NativeCharacter({...data,crouchIdle:{clip:data.clip,track:0}})).toThrow('both crouched');
  expect(()=>new NativeCharacter({...data,crouchWalk:{clip:data.clip,track:0}})).toThrow('both crouched');
});

test('airborne clip starts at takeoff, clamps at its end and does not add root translation', () => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,airborne:{clip:data.clip,track:0}});
  const jump={...controls,jump:true};expect(character.step(.1,jump,sim)).toBe(jump);expect(character.snapshot().action).toBe('airborne');
  sim.player.grounded=false;character.step(3,controls,sim);character.update(sim,1);expect(character.snapshot()).toMatchObject({action:'airborne',seconds:2,visible:true});
  let root:any;character.root.traverse(o=>{if(o.name==='Root')root=o;});expect(root.matrix.elements.slice(12,15)).toEqual([0,0,0]);
  const end=[...root.matrix.elements];character.step(1,controls,sim);character.update(sim,1);expect(root.matrix.elements).toEqual(end);
  sim.player.grounded=true;character.step(.2,{...controls,y:0},sim);expect(character.snapshot()).toMatchObject({action:'idle',seconds:0});
});
test('airborne animation leaves the physical jump trajectory under simulation control', () => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,airborne:{clip:data.clip,track:0}});
  sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));sim.world.step();
  for(let i=0;i<30;i++)sim.step(1/60,{...controls,y:0});
  let peak=0,airborne=false;
  for(let i=0;i<100;i++){sim.step(1/60,character.step(1/60,{...controls,y:0,jump:i===0},sim));character.update(sim,1);peak=Math.max(peak,sim.player.position.y);airborne ||= character.snapshot().action==='airborne';}
  expect(airborne).toBe(true);expect(peak).toBeGreaterThan(.9);expect(peak).toBeLessThan(1.2);expect(sim.player.grounded).toBe(true);expect(character.snapshot().action).toBe('idle');
});


test('landing plays once after flight, blocks a repeat jump and resumes movement at phase zero', () => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,landing:{clip:data.clip,track:0}});
  character.step(.1,controls,sim);sim.player.grounded=false;character.step(.1,controls,sim);
  sim.player.grounded=true;
  const input=character.step(.2,{...controls,jump:true,sprint:true},sim);
  expect(input).toMatchObject({x:0,y:0,jump:false,sprint:false,animationMotion:{x:0,z:0}});
  expect(character.snapshot()).toMatchObject({action:'landing',seconds:.2});
  character.step(3,controls,sim);character.update(sim,1);
  expect(character.snapshot()).toMatchObject({action:'landing',seconds:2,visible:true});
  let root:any;character.root.traverse(o=>{if(o.name==='Root')root=o;});expect(root.matrix.elements.slice(12,15)).toEqual([0,0,0]);
  character.step(.1,controls,sim);expect(character.snapshot()).toMatchObject({action:'walk',seconds:.1});
  character.step(.1,controls,sim);expect(character.snapshot().action).toBe('walk');
});
test('initial placement does not land, and death cancels an active landing', () => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,landing:{clip:data.clip,track:0}});
  sim.player.grounded=false;character.step(.1,controls,sim);sim.player.grounded=true;character.step(.1,controls,sim);
  expect(character.snapshot().action).toBe('walk');
  sim.player.grounded=false;character.step(.1,controls,sim);sim.player.grounded=true;character.step(.1,controls,sim);
  expect(character.snapshot().action).toBe('landing');
  sim.player.health=0;expect(character.step(.1,controls,sim)).toBe(controls);character.update(sim,1);
  expect(character.snapshot()).toMatchObject({action:'idle',visible:false});
  sim.player.health=100;character.step(.1,controls,sim);expect(character.snapshot().action).toBe('walk');
});


test('launch completes before emitting exactly one physical jump request', () => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,launch:{clip:data.clip,track:0},airborne:{clip:data.clip,track:0}});
  expect(character.step(.5,{...controls,jump:true},sim)).toMatchObject({jump:false,animationMotion:{x:0,z:0}});
  expect(character.snapshot()).toMatchObject({action:'launch',seconds:.5});
  character.update(sim,1);for(let i=0;i<10;i++)character.update(sim,.5);expect(character.snapshot().seconds).toBe(.5);
  expect(character.step(1.5,controls,sim).jump).toBe(false);
  expect(character.snapshot()).toMatchObject({action:'launch',seconds:2});
  expect(character.step(.1,controls,sim).jump).toBe(true);expect(character.snapshot().action).toBe('airborne');
  sim.player.grounded=false;expect(character.step(.1,controls,sim).jump).toBe(false);
});
test.each(['death','crouch','lost ground'] as const)('interrupted launch cannot issue a delayed jump after %s', reason => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,launch:{clip:data.clip,track:0}});
  character.step(.2,{...controls,jump:true},sim);
  if(reason==='death')sim.player.health=0;else if(reason==='crouch')sim.player.crouched=true;else sim.player.grounded=false;
  expect(character.step(3,controls,sim).jump).toBe(false);expect(character.snapshot().action).not.toBe('launch');
  sim.player.health=100;sim.player.crouched=false;sim.player.grounded=true;
  expect(character.step(3,controls,sim).jump).toBe(false);
});


test.each([[.1,'launch'],[.2658,'launch'],[.266,'launchRight'],[.4,'launchRight'],[1.266,'launchRight'],[1.2662,'launch'],[1.4,'launch'],[2.4,'launchRight']] as const)('launch side follows wrapped locomotion phase at %s seconds', (seconds,expected) => {
  setup();character.dispose();const data=source();character=new NativeCharacter({...data,launch:{clip:data.clip,track:0},launchRight:{clip:data.clip,track:0}});
  character.step(seconds,controls,sim);character.step(.1,{...controls,jump:true},sim);
  expect(character.snapshot()).toMatchObject({action:expected,seconds:.1});
  character.step(.5,{...controls,y:0},sim);expect(character.snapshot().action).toBe(expected);
  character.step(2,controls,sim);expect(character.step(.1,controls,sim).jump).toBe(true);
});
test('stationary launch uses the base clip and an orphan right variant is rejected', () => {
  setup();character.dispose();const data=source();expect(()=>new NativeCharacter({...data,launchRight:{clip:data.clip,track:0}})).toThrow('base launch');
  character=new NativeCharacter({...data,launch:{clip:data.clip,track:0},launchRight:{clip:data.clip,track:0}});
  character.step(1,{...controls,y:0},sim);character.step(.1,{...controls,y:0,jump:true},sim);
  expect(character.snapshot().action).toBe('launch');
});

test('native forward stride turns with the actor instead of sliding toward the target heading',()=>{
  sim=new Simulation(true);sim.player.grounded=true;sim.player.heading=0;
  const data=source(),track=data.clip.tracks[data.track];
  track.translations=new Float32Array(track.times.length*3);
  track.times.forEach((time,i)=>{track.translations![i*3+1]=time;});
  character=new NativeCharacter({...data,convention:'san-andreas-ped'});
  const input={...controls,x:1,y:0,cameraYaw:0};
  sim.step(1/60,character.step(1/60,input,sim));character.update(sim,1);
  const move=sim.animationMovement!.requested,heading=sim.player.heading;
  expect(heading).toBeGreaterThan(0);expect(heading).toBeLessThan(Math.PI/2);
  expect(move.x/Math.hypot(move.x,move.z)).toBeCloseTo(Math.sin(heading));
  expect(move.z/Math.hypot(move.x,move.z)).toBeCloseTo(Math.cos(heading));
  expect(-Math.sin(character.root.rotation.y)).toBeCloseTo(Math.sin(heading));
});

test('native ambient updates shared material uniforms and clears without rebuilding the character',()=>{
 sim=new Simulation(true);
 const data=source();data.model.geometries.forEach(g=>g.flags|=0x20);character=new NativeCharacter(data);
 const uniforms:any[]=[];
 character.root.traverse((object:any)=>{
  for(const material of object.material ? Array.isArray(object.material)?object.material:[object.material] : []){
   if(material.type!=='MeshLambertMaterial')continue;
   const shader={uniforms:{},fragmentShader:'',vertexShader:''};material.onBeforeCompile(shader,{});uniforms.push(shader.uniforms);
  }
 });
 expect(uniforms.length).toBeGreaterThan(0);
 character.setAmbient([.2,.4,.6],.5);
 for(const u of uniforms){expect(u.nativeAmbientEnabled.value).toBe(true);expect(u.nativeAmbientColor.value.toArray()).toEqual([.1,.2,.3]);}
 expect(()=>character.setAmbient([NaN,0,0])).toThrow('finite');
 expect(uniforms[0].nativeAmbientColor.value.toArray()).toEqual([.1,.2,.3]);
 character.setAmbient();for(const u of uniforms)expect(u.nativeAmbientEnabled.value).toBe(false);
});

test('three native gaits separate running from stamina-consuming sprint and recover to run',()=>{
 setup();character.dispose();const data=source();
 const [idle,walk,run]=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-roles.ifp'))).animations;
 const sprint=structuredClone(run);sprint.name='Sprint';sprint.tracks[0].translations!.forEach((v,i,a)=>{a[i]=v*2;});
 character=new NativeCharacter({...data,clip:walk,idle:{clip:idle},run:{clip:run,track:0},sprint:{clip:sprint,track:0}});
 expect(character.step(.2,controls,sim).sprint).toBe(false);expect(character.snapshot().action).toBe('run');
 const running=character.step(.2,controls,sim).animationMotion!;
 expect(character.step(.2,{...controls,walk:true},sim).sprint).toBe(false);expect(character.snapshot().action).toBe('walk');
 expect(character.step(.2,{...controls,sprint:true},sim).sprint).toBe(true);expect(character.snapshot().action).toBe('sprint');
 const sprinting=character.step(.2,{...controls,sprint:true},sim).animationMotion!;
 expect(Math.hypot(sprinting.x,sprinting.z)).toBeGreaterThan(Math.hypot(running.x,running.z));
 sim.player.stamina=0;sim.player.sprintExhausted=true;
 expect(character.step(.2,{...controls,sprint:true},sim).sprint).toBe(false);expect(character.snapshot().action).toBe('run');
 sim.player.stamina=19;character.step(.2,{...controls,sprint:true},sim);expect(character.snapshot().action).toBe('run');
 sim.player.stamina=20;character.step(.2,{...controls,sprint:true},sim);expect(character.snapshot().action).toBe('sprint');
 expect(()=>new NativeCharacter({...data,sprint:{clip:sprint,track:0}})).toThrow('run clip before sprint');
});

test('bones animated only by sprint blend continuously on entry and restore on exit',()=>{
 setup();character.dispose();const data=source(),sprint=structuredClone(data.clip);
 const locomotion=structuredClone(data.clip);locomotion.tracks=locomotion.tracks.slice(0,1);
 character=new NativeCharacter({...data,clip:locomotion,run:{clip:locomotion,track:0},sprint:{clip:sprint,track:0}});
 let tip:any;character.root.traverse(o=>{if(o.name==='Tip')tip=o;});
 character.step(.7,controls,sim);character.update(sim,1);const rest=tip.matrix.clone();
 character.step(.01,{...controls,sprint:true},sim);character.update(sim,0);
 tip.matrix.elements.forEach((v:number,i:number)=>expect(v).toBeCloseTo(rest.elements[i],6));
 character.step(.18,{...controls,sprint:true},sim);character.update(sim,1);const posed=tip.matrix.clone();
 expect(posed.equals(rest)).toBe(false);
 character.step(.01,controls,sim);character.update(sim,0);
 tip.matrix.elements.forEach((v:number,i:number)=>expect(v).toBeCloseTo(posed.elements[i],6));
 character.step(.18,controls,sim);character.update(sim,1);
 tip.matrix.elements.forEach((v:number,i:number)=>expect(v).toBeCloseTo(rest.elements[i],6));
});

for(const mode of ['running','walking','released'] as const)test(`moving landing selection respects ${mode} input and stays latched`,()=>{
 setup();character.dispose();const data=source();
 character=new NativeCharacter({...data,airborne:{clip:data.clip,track:0},landing:{clip:data.clip,track:0},landingMoving:{clip:data.clip,track:0}});
 const input={...controls,walk:mode==='walking'};
 character.step(.7,input,sim);sim.player.grounded=false;character.step(.1,input,sim);
 sim.player.grounded=true;character.step(.01,mode==='released'?{...input,y:0}:input,sim);
 const expected=mode==='running'?'landingMoving':'landing';
 expect(character.snapshot().action).toBe(expected);
 character.step(.1,{...input,y:mode==='running'?0:1},sim);
 expect(character.snapshot().action).toBe(expected);
 expect(()=>new NativeCharacter({...data,landingMoving:{clip:data.clip,track:0}})).toThrow('base landing');
});

test('native landing extracts forward displacement once, preserving lateral and vertical pose motion',()=>{
 setup();character.dispose();const data=source(),landing=structuredClone(data.clip);
 const root=landing.tracks[0];root.translations!.forEach((_,i,a)=>{const time=root.times[Math.floor(i/3)];a[i]=time*(i%3===0?2:i%3===1?.5:1);});
 character=new NativeCharacter({...data,convention:'san-andreas-ped',landing:{clip:landing,track:0,forwardMotion:true}});
 character.step(.1,controls,sim);sim.player.grounded=false;character.step(.1,controls,sim);sim.player.grounded=true;
 const result=character.step(3,{...controls,y:0},sim);
 expect(result.animationMotion!.x).toBeCloseTo(0);expect(Math.abs(result.animationMotion!.z)).toBeCloseTo(1);
 expect(result).toMatchObject({x:0,y:0,jump:false,sprint:false});
 character.update(sim,1);let bone:any;character.root.traverse(o=>{if(o.name==='Root')bone=o;});
 expect(bone.matrix.elements[12]).toBeCloseTo(4);expect(bone.matrix.elements[13]).toBeCloseTo(0);expect(bone.matrix.elements[14]).toBeCloseTo(2);
 expect(character.step(.1,{...controls,y:0},sim).animationMotion).toEqual({x:0,z:0});
 expect(()=>new NativeCharacter({...data,landing:{clip:landing,track:0,forwardMotion:true}})).toThrow('native pedestrian');
});

for(const mode of ['run','sprint','released'] as const)test(`native landing speed uses ${mode} state at contact and stays latched`,()=>{
 setup();character.dispose();const data=source(),landing=structuredClone(data.clip);
 const root=landing.tracks[0];root.translations!.forEach((_,i,a)=>{a[i]=i%3===1?root.times[Math.floor(i/3)]*.5:0;});
 character=new NativeCharacter({...data,convention:'san-andreas-ped',run:{clip:data.clip,track:0},sprint:{clip:data.clip,track:0},airborne:{clip:data.clip,track:0},landing:{clip:landing,track:0,forwardMotion:true}});
 const moving={...controls,sprint:mode!=='run'};
 character.step(.7,moving,sim);sim.player.grounded=false;character.step(.1,moving,sim);sim.player.grounded=true;
 const contact={...moving,sprint:mode==='sprint'};
 const result=character.step(.1,contact,sim),speed=mode==='sprint'?2:1;
 expect(character.snapshot()).toMatchObject({action:'landing',playbackSpeed:speed,seconds:.1*speed});
 expect(Math.hypot(result.animationMotion!.x,result.animationMotion!.z)).toBeCloseTo(.05*speed);
 const end=character.step(3,{...contact,sprint:!contact.sprint},sim);
 expect(character.snapshot()).toMatchObject({playbackSpeed:speed,seconds:2});
 expect(Math.hypot(result.animationMotion!.x+end.animationMotion!.x,result.animationMotion!.z+end.animationMotion!.z)).toBeCloseTo(1);
 character.step(.1,{...controls,y:0},sim);expect(character.snapshot()).toMatchObject({action:'idle',playbackSpeed:1});
});

test('native landing uses the source blend-in rate instead of the ordinary movement transition',()=>{
 setup();character.dispose();const data=source();character=new NativeCharacter({...data,convention:'san-andreas-ped',landing:{clip:data.clip,track:0}});
 character.step(.2,controls,sim);sim.player.grounded=false;character.step(.1,controls,sim);sim.player.grounded=true;
 character.step(.005,controls,sim);expect(character.snapshot()).toMatchObject({action:'landing',transition:.5});
 character.step(.005,controls,sim);expect(character.snapshot().transition).toBe(1);
});
