import {readFile} from 'node:fs/promises';
import {expect,test} from 'vitest';
import {FX_INFO,fxIntegrate,fxInterpolate,readFxProject} from '../src/assets/fxProject';
const project=async()=>readFxProject(await readFile('public/play/world/files/models/effects.fxp','utf8'));
test('effects.fxp loads all 82 systems with native field order and quantized keys',async()=>{
 const systems=await project();
 expect(systems).toHaveLength(82);
 expect(systems.reduce((n,s)=>n+s.prims.length,0)).toBe(161);
 const blood=systems.find(s=>s.name==='prt_blood')!;
 expect(blood).toMatchObject({length:1,playMode:2,cullDistance:50*256,boundingSphere:undefined});
 const prim=blood.prims[0];
 expect(prim).toMatchObject({textures:['sphere',undefined,undefined,undefined],alphaOn:true,srcBlend:4,dstBlend:5,lodStart:30*64,lodEnd:50*64,matrix:undefined});
 expect(prim.infos.map(i=>i.type).slice(0,4)).toEqual([FX_INFO.emSpeed,FX_INFO.emDir,FX_INFO.emLife,FX_INFO.emRate]);
 // Emission infos precede movement and render infos, which FxInfoManager_c processes by offset.
 expect(prim.infos.slice(0,prim.movementOffset).every(i=>i.type<0x2000)).toBe(true);
 expect(prim.infos.slice(prim.renderOffset).every(i=>i.type>=0x4000)).toBe(true);
 const life=prim.infos.find(i=>i.type===FX_INFO.emLife)!;
 // FxInterpInfoU255_c stores 0.7 as uint16(179.2)/256.
 expect(life.interp.keys[0][0]).toBe(179/256);
 const speed=prim.infos.find(i=>i.type===FX_INFO.emSpeed)!;
 expect(speed.interp.keys).toEqual([[2],[.5]]);expect(speed.timeModeParticle).toBe(true);
 const force=prim.infos.find(i=>i.type===FX_INFO.force)!;expect(force.timeModeParticle).toBe(true);expect(force.interp.keys[2][0]).toBe(-10);
 const explosion=systems.find(s=>s.name==='explosion_large')!;
 expect(explosion.playMode).toBe(0);expect(explosion.prims.map(p=>p.textures[0])).toEqual(['bullethitsmoke','cardebris_01','fireball6']);
 const fire=systems.find(s=>s.name==='fire')!;expect(fire.prims[0].hasHeatHaze).toBe(true);expect(fire.prims[1].hasHeatHaze).toBe(false);
 expect(systems.filter(s=>s.boundingSphere).length).toBe(82-25);
 const tilted=systems.flatMap(s=>s.prims).find(p=>p.matrix)!;expect(tilted.matrix![0]).toBe(Math.trunc(Math.fround(Math.fround(.998)*32767))/32767);
});
test('key interpolation holds, extrapolates and integrates emission rates',()=>{
 const interp={looped:false,times:[.3,1],keys:[[.5,5]]};
 expect(fxInterpolate(interp,1.5,[])[0]).toBe(5);
 expect(fxInterpolate(interp,.3,[])[0]).toBeCloseTo(.5);
 expect(fxInterpolate(interp,0,[])[0]).toBeCloseTo(.5-4.5*(.3/.7));
 const burst={looped:false,times:[0,.1,.10156],keys:[[1200,1200,0]]};
 expect(fxIntegrate(burst,0,.05,.05)).toBeCloseTo(60);
 expect(fxIntegrate(burst,0,.5,.1)).toBe(0);
 expect(fxIntegrate({looped:false,times:[0],keys:[[3]]},0,2,.5)).toBeCloseTo(1.5);
 expect(fxInterpolate({looped:true,times:[0,1],keys:[[0,10]]},2.5,[])[0]).toBeCloseTo(5);
});
