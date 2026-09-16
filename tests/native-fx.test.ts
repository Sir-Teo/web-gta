import {readFile} from 'node:fs/promises';
import {expect,test} from 'vitest';
import {readFxProject} from '../src/assets/fxProject';
import {FX_KILL,FX_PARTICLE_POOL,NativeFxManager,fxPrtMult,type FxVec} from '../src/simulation/fx/NativeFx';
import {EXPLOSION,NativeFxEffects,fxMatFromVec} from '../src/simulation/fx/nativeFxEffects';
const seeded=(seed=7)=>()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const blueprints=async()=>readFxProject(await readFile('public/play/world/files/models/effects.fxp','utf8'));
const run=(fx:NativeFxManager,camera:FxVec,seconds:number,step=1/60)=>{for(let t=0;t<seconds;t+=step)fx.update(camera,step);};
test('a PlayAndKill explosion emits its burst, lets particles expire and destroys itself',async()=>{
 const fx=new NativeFxManager(await blueprints(),{random:seeded()}),effects=new NativeFxEffects(fx,()=>[0,-30,0]);
 expect(effects.explosion(EXPLOSION.aircraft,[0,0,0])).toBe('explosion_large');
 const system=fx.systems.find(s=>s.name==='explosion_large')!;
 run(fx,[0,-30,0],.3);
 const burst=FX_PARTICLE_POOL-fx.freeParticles;
 // Integrated RATE curves: ~7 smoke, 12 debris and ~77 fireballs (whole particles per 60 Hz frame).
 expect(burst).toBeGreaterThan(80);expect(burst).toBeLessThan(100);
 const smoke=fx.prims.find(p=>p.system.name==='explosion_large'&&p.bp.textures[0]==='bullethitsmoke')!;
 expect(smoke.particles.length).toBeGreaterThanOrEqual(4);
 // Smoke rises (FORCE Z 22) against friction 0.88 per native step.
 expect(Math.max(...smoke.particles.map(p=>p.pos[2]))).toBeGreaterThan(0);
 run(fx,[0,-30,0],3.2);
 expect(system.killStatus===FX_KILL.waiting||system.killStatus===FX_KILL.killed).toBe(true);
 expect(fx.systems.includes(system)).toBe(true);
 run(fx,[0,-30,0],6);
 expect(fx.systems.includes(system)).toBe(false);
 // Static prt_ systems stay alive and hold no particles.
 expect(fx.freeParticles).toBe(FX_PARTICLE_POOL);
 expect(fx.systems.length).toBe(17);
});
test('the 1000-particle pool caps emission and distant systems skip emission through LOD and cull distance',async()=>{
 const fx=new NativeFxManager(await blueprints(),{random:seeded(3)});
 for(let i=0;i<40;i++)fx.create('explosion_large',[i*.1,0,0])?.playAndKill();
 run(fx,[0,-20,0],.2);
 expect(fx.freeParticles).toBe(0);
 expect(fx.snapshot().particles).toBe(FX_PARTICLE_POOL);
 const far=new NativeFxManager(await blueprints(),{random:seeded(4)});
 far.create('fire',[0,0,0])?.play();
 run(far,[0,-100,0],1);
 expect(far.freeParticles).toBe(FX_PARTICLE_POOL);
 run(far,[0,-5,0],1);
 expect(far.freeParticles).toBeLessThan(FX_PARTICLE_POOL);
});
test('overheat smoke uses constant time from health and stops at 250 or above 650',async()=>{
 const fx=new NativeFxManager(await blueprints(),{random:seeded(5)}),effects=new NativeFxEffects(fx,()=>[0,-5,0]),modelling=fxMatFromVec([10,0,0],[0,1,0]);
 let system=effects.overheat(undefined,700,false,[0,2,.5],modelling,[0,0,0],false);expect(system).toBeUndefined();
 system=effects.overheat(undefined,450,false,[0,2,.5],modelling,[0,0,0],false)!;
 expect(system.constTime).toBe(.5);
 run(fx,[10,-5,0],1);
 const prim0=fx.prims.find(p=>p.system.name==='overheat_car'&&p.particles.length)!;
 // RATE peaks at 60/s for constant time 0.5; particles start at the engine dummy in the car's modelling space.
 expect(prim0.particles.length).toBeGreaterThan(10);
 expect(prim0.particles.every(p=>Math.abs(p.pos[0]-10)<1.5)).toBe(true);
 expect(effects.overheat(system,200,false,[0,2,.5],modelling,[0,0,0],false)).toBeUndefined();
 expect(system.killStatus).toBe(FX_KILL.killed);
});
test('static AddParticle systems keep the supplied velocity and fall under the blueprint force',async()=>{
 const fx=new NativeFxManager(await blueprints(),{random:seeded(9)}),effects=new NativeFxEffects(fx,()=>[0,-5,0]);
 effects.statics.prt_blood!.addParticle([0,0,1],[0,0,3],0,fxPrtMult(.5,0,0,1,1,1,1),-1,.3,.6);
 const prt=fx.prims.find(p=>p.system.name==='prt_blood')!.particles[0];
 expect(prt.vel).toEqual([0,0,3]);
 // A dark surface (0.3 < 0.6) lowers brightness to 1 - 0.6 + 0.3.
 expect(prt.brightness).toBe(.7);
 expect(prt.multColor).toEqual([127,0,0,255]);
 run(fx,[0,-5,0],.2);
 expect(prt.vel[2]).toBeLessThan(1.2);
 effects.blood([0,0,1],[1,0,0],8,1);
 expect(fx.prims.find(p=>p.system.name==='prt_blood')!.particles.length).toBe(9);
});
test('weapon effects follow the muzzle matrix and killed loops wait for their particles',async()=>{
 const fx=new NativeFxManager(await blueprints(),{random:seeded(11)}),effects=new NativeFxEffects(fx,()=>[0,-2,1]);
 let flame=effects.weaponEffect(undefined,37,[0,0,1],[0,1,0]);
 expect(flame?.name).toBe('flamethrower');expect(flame?.mustCreate).toBe(true);
 run(fx,[0,-2,1],.5);
 const moving=fx.prims.filter(p=>p.system.name==='flamethrower').flatMap(p=>p.particles);
 expect(moving.length).toBeGreaterThan(0);
 // Emission runs along +Y (the muzzle direction) for the burning prim.
 expect(moving.filter(p=>p.vel[1]>0).length).toBeGreaterThan(moving.length/2);
 flame=effects.weaponEffect(flame,0,[0,0,1],[0,1,0]);
 expect(flame).toBeUndefined();
 const system=fx.systems.find(s=>s.name==='flamethrower')!;
 expect(system.killStatus).not.toBe(FX_KILL.alive);
 run(fx,[0,-2,1],4);
 expect(fx.systems.some(s=>s.name==='flamethrower')).toBe(false);
});
