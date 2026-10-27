import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {Scene,PerspectiveCamera} from 'three';
import {readFxProject} from '../src/assets/fxProject';
import {FX_PLAY,FX_KILL,NativeFxManager} from '../src/simulation/fx/NativeFx';
import {NativeFxEffects} from '../src/simulation/fx/nativeFxEffects';
import {WorldFx} from '../src/simulation/fx/WorldFx';
const project=readFxProject(readFileSync('public/play/world/files/models/effects.fxp','utf8'));
function fixture(){
 const manager=new NativeFxManager(project,{random:()=>.5}),effects=new NativeFxEffects(manager,()=>[0,-5,0]),scene=new Scene(),host=new WorldFx(scene,{} as any,new PerspectiveCamera());host.manager=manager;host.effects=effects;
 const boat:any={root:{visible:true},splashes:[],assets:{collision:{bounds:{min:[-1,-3,-1],max:[1,3,1]}}},body:{translation:()=>({x:10,y:2,z:20}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:-12.5})},health:1000,wrecked:false,onFire:false,inWater:true,submergedInWater:true,propellerPositions:()=>[{x:9,y:1,z:23},{x:11,y:1,z:23}]};
 return {manager,effects,host,boat,update:(boats:any[]=[boat])=>(host as any).updateBoats(boats),props:()=>manager.systems.filter(s=>s.name==='boat_prop')};
}
test('a submerged hull lazily creates two local propeller systems at actual frame origins',()=>{
 const f=fixture();f.update();const systems=f.props();expect(systems).toHaveLength(2);
 for(const [i,s] of systems.entries()){expect(s.playStatus).toBe(FX_PLAY.playing);expect(s.createLocal).toBe(true);expect(s.useConstTime).toBe(true);expect(s.constTime).toBe(.5);expect(Array.from(s.parent!).slice(9)).toEqual([i?11:9,-23,1]);expect(Array.from(s.parent!).slice(0,9)).toEqual([1,-0,0,0,1,0,0,-0,1]);}
 f.update();expect(f.props()).toEqual(systems);
});
test('dry and paused propeller systems retain their native stop/restart semantics',()=>{
 const f=fixture();f.update();const [first,second]=f.props();first.pause();f.boat.submergedInWater=false;f.update();expect(first.playStatus).toBe(FX_PLAY.paused);expect(second.playStatus).toBe(FX_PLAY.stopped);
 f.boat.submergedInWater=true;f.update();expect(first.playStatus).toBe(FX_PLAY.paused);expect(second.playStatus).toBe(FX_PLAY.playing);
});
test('a dry hull allocates stopped systems, and a weak water contact does not substitute for native submersion',()=>{
 const f=fixture();f.boat.inWater=true;f.boat.submergedInWater=false;f.update();expect(f.props()).toHaveLength(2);expect(f.props().every(s=>s.playStatus===FX_PLAY.stopped)).toBe(true);
});
test('each propeller retains its own copied modelling matrix as the hull moves',()=>{
 const f=fixture();f.update();const [a,b]=f.props(),before=Array.from(a.parent!);expect(a.parent).not.toBe(b.parent);
 f.boat.propellerPositions=()=>[{x:19,y:2,z:33},{x:21,y:2,z:33}];expect(Array.from(a.parent!)).toEqual(before);f.update();expect(Array.from(a.parent!).slice(9)).toEqual([19,-33,2]);expect(Array.from(b.parent!).slice(9)).toEqual([21,-33,2]);
});
test('speed selects a capped constant time independently of engine and wrecked flags',()=>{
 const f=fixture();f.boat.wrecked=true;f.boat.health=0;f.boat.body.linvel=()=>({x:0,y:0,z:-50});f.update();expect(f.props()).toHaveLength(2);expect(f.props().every(s=>s.playStatus===FX_PLAY.playing&&s.constTime===1)).toBe(true);
 f.boat.body.linvel=()=>({x:0,y:0,z:0});f.update();expect(f.props().every(s=>s.constTime===0)).toBe(true);
});
test('missing propeller frames and hidden hulls do not fabricate effects',()=>{
 const f=fixture();f.boat.propellerPositions=()=>[undefined,{x:11,y:1,z:23}];f.update();expect(f.props()).toHaveLength(1);f.update();expect(f.props()).toHaveLength(1);
 const hidden=fixture();hidden.boat.root.visible=false;hidden.update();expect(hidden.props()).toHaveLength(0);
});
test('retiring a hull and disposing the world kill its owned propeller systems',()=>{
 const f=fixture();f.update();const systems=f.props();expect(systems).toHaveLength(2);f.update([]);expect(systems.every(s=>s.killStatus===FX_KILL.killed)).toBe(true);
 const g=fixture();g.update();const others=g.props();expect(others).toHaveLength(2);g.host.dispose();expect(others.every(s=>s.destroyed||s.killStatus===FX_KILL.killed)).toBe(true);
});

test('a culled creation retries on the next visible frame without using the must-create override',()=>{
 const f=fixture(),create=vi.spyOn(f.manager,'create');create.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);f.update();expect(f.props()).toHaveLength(0);expect(create.mock.calls.every(c=>c[3]!==true)).toBe(true);f.update();expect(f.props()).toHaveLength(2);
});
test('native boat_prop blueprints emit local particles and retire them after hull removal',()=>{
 const f=fixture();f.update();const systems=f.props();expect(systems).toHaveLength(2);
 for(let i=0;i<30;i++)f.manager.update([10,-23,1],1/60);
 const particles=f.manager.prims.flatMap(p=>p.particles).filter(p=>systems.includes(p.system));expect(particles.length).toBeGreaterThan(0);expect(particles.every(p=>p.system.createLocal)).toBe(true);expect(particles.some(p=>Math.hypot(...p.pos)<4)).toBe(true);
 f.update([]);for(let i=0;i<180;i++)f.manager.update([10,-23,1],1/60);expect(f.props()).toHaveLength(0);
});
