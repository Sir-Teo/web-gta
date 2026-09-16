import {expect,test,beforeAll} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPickups,PICKUP_REACH} from '../src/simulation/WorldPickups';
import {readInitialSavePoints} from '../src/assets/scmSavePoints';

beforeAll(async()=>{await RAPIER.init();});

function disc(){
  const points=readInitialSavePoints(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')));
  const outside=points.filter(p=>p.pickup[2]<900);
  expect(outside).toHaveLength(1);
  return outside[0];
}

function setup(onSave:(id:string)=>void){
  const sim=new Simulation(),scene=new Scene();
  const pickups=new WorldPickups(sim,scene,'save-disc-test:',{
    weaponForModel:()=>undefined,giveWeapon:()=>false,
    wantedLevel:()=>0,setWantedLevel:()=>{},armour:()=>0,setArmour:()=>{},onSave:()=>onSave('save-disc'),
  });
  return {sim,pickups,scene};
}

/** The Verdant Meadows disc (slot 2) sits ~6 m below the streamed airstrip ground, so its
 * native 1-unit reach is never entered in the running world. The save flow itself works;
 * the fix is terrain/interior streaming around the disc, not a larger reach. */
test('verdant save disc collects at script height but not from the streamed strip',()=>{
  const point=disc();
  expect(point.pickup.map(v=>+v.toFixed(3))).toEqual([416.955,2538.813,9.508]);
  // The native reach is unchanged: enlarging it would save through floors elsewhere.
  expect(PICKUP_REACH.height).toBe(2);
  expect(PICKUP_REACH.radius).toBeCloseTo(Math.sqrt(1.8),10);

  const saves:string[]=[],{sim,pickups}=setup(id=>saves.push(id));
  try{
    pickups.setPickups([{id:'save-disc',command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId:1277,model:'pickupsave',dictionary:'pickupsave',type:3,category:'save',ammo:0,position:point.pickup}]);
    // Feet at the script height: |dz| = |(9.508+1) - 9.508| < 2, xy = 0.
    sim.player.position={x:point.pickup[0],y:point.pickup[2],z:-point.pickup[1]};
    pickups.step(1/60);
    expect(saves).toEqual(['save-disc']);
  }finally{pickups.dispose();sim.dispose();}

  const dry:string[]=[],second=setup(id=>dry.push(id));
  try{
    second.pickups.setPickups([{id:'save-disc',command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId:1277,model:'pickupsave',dictionary:'pickupsave',type:3,category:'save',ammo:0,position:point.pickup}]);
    // Feet on the streamed strip ~6 m above: dz ~7 > 2, so no save fires.
    second.sim.player.position={x:point.pickup[0],y:15.56,z:-point.pickup[1]};
    second.pickups.step(1/60);
    expect(dry).toEqual([]);
  }finally{second.pickups.dispose();second.sim.dispose();}
});
