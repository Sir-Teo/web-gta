import { beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Progression } from '../src/simulation/Progression';
import { Simulation } from '../src/simulation/Simulation';
import { WeaponInventory } from '../src/weapons/Inventory';
beforeAll(async () => { await RAPIER.init(); });
function setup() {
 const sim = new Simulation(), inv = new WeaponInventory();
 const p = new Progression(inv, sim);
 sim.player.position = { x: 8, y: 0, z: -25 };
 return { sim, inv, p };
}
test('mission chain unlocks sequentially with reach, kill, drive, hit and collect objectives', () => {
 const { sim, p } = setup();
 try {
  expect(p.currentMission()?.id).toBe('grove-intro');
  p.missionUpdate();
  expect(p.currentMission()?.id).toBe('grove-defense');
  // Wrong gang, or none (a civilian or a cop), does not count; rivals do.
  p.recordKill(1); p.recordKill(5); p.recordKill(); p.recordKill(undefined);
  expect(p.missionProgress()).toEqual({ done: 0, total: 3 });
  p.recordKill(0); p.recordKill(0); p.recordKill(2);
  p.missionUpdate();
  expect(p.currentMission()?.id).toBe('wheelman');
  // Drive objective measures from unlock (shuttle near the marker).
  let dir = 1;
  for (let i = 0; i < 1600; i++) { sim.player.position.x += dir; if (i % 25 === 24) dir = -dir; p.tick(1 / 60, true, 0, false); }
  expect(p.currentMission()?.id).toBe('marksman');
  for (let i = 0; i < 15; i++) p.hit(30);
  p.missionUpdate();
  expect(p.currentMission()?.id).toBe('collector');
  for (let i = 0; i < 5; i++) p.recordCollect('horseshoe');
  p.missionUpdate();
  expect(p.currentMission()).toBeUndefined();
  expect(p.missions.every(m => m.done)).toBe(true);
 } finally { sim.dispose(); }
});
test('mission progress requires standing at the marker', () => {
 const { sim, p } = setup();
 try {
  sim.player.position = { x: 500, y: 0, z: 500 };
  p.recordKill(0); p.recordKill(0); p.recordKill(0);
  p.missionUpdate(); // intro not reached
  expect(p.currentMission()?.id).toBe('grove-intro');
 } finally { sim.dispose(); }
});

test('a mission under way keeps its progress across a reload, and its drive counts from its unlock',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 sim.player.position={x:8,y:0,z:-25};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);
  // A kilometre driven before the drive objective unlocks.
  p.distances.drive=1000;
  p.missionUpdate();p.recordKill(0);p.recordKill(2);p.recordKill(0);p.missionUpdate();
  expect(p.currentMission()?.id).toBe('wheelman');expect(p.missionProgress()).toEqual({done:0,total:1500});
  p.save();
  const restored=new Progression(new WeaponInventory(),sim,storage);
  expect(restored.currentMission()?.id).toBe('wheelman');expect(restored.missionProgress()).toEqual({done:0,total:1500});
  // The marksman's hits so far come back too.
  for(const m of restored.missions)if(m.id==='wheelman')m.done=true;
  for(let i=0;i<7;i++)restored.hit(30);restored.save();
  expect(new Progression(new WeaponInventory(),sim,storage).missionProgress()).toEqual({done:7,total:15});
 }finally{sim.dispose();}
});
