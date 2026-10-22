import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import fixture from './fixtures/native-pickup-position.json';
import {nativePickupCoordinate} from '../src/assets/nativePickupPosition';
import {ScmPickups} from '../src/engine/ScmPickups';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPickups} from '../src/simulation/WorldPickups';

for(const row of fixture.cases)test(`captured pickup coordinate storage: ${row.name}`,()=>{
 expect(row.input.map(nativePickupCoordinate)).toEqual(row.position);
 const pickups=new ScmPickups(),[x,y,z]=row.input,handle=pickups.createPickup(1277,3,{x,y,z});expect(pickups.at(handle)!.position).toEqual({x:row.position[0],y:row.position[1],z:row.position[2]});
});
beforeAll(async()=>{await RAPIER.init();});
test('pickup collection uses its compressed position at the native reach boundary',()=>{
 const sim=new Simulation();let collected=0;const pickups=new WorldPickups(sim,new Scene(),'https://game.test/',{weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel(){},armour:()=>0,setArmour(){},onCollect(){collected++;}});
 try{
  pickups.setPickups([{id:'health-reach',command:'CREATE_PICKUP',section:'test',offset:0,modelId:1240,model:'health',dictionary:'icons5',type:3,category:'health',ammo:0,position:[.12499,0,0]}]);
  sim.player.health=10;sim.player.position={x:1.4,y:-1,z:0};pickups.step(1/60);expect(collected).toBe(0);expect(sim.player.health).toBe(10);
  sim.player.position.x=1.3;pickups.step(1/60);expect(collected).toBe(1);expect(sim.player.health).toBe(100);
 }finally{pickups.dispose();sim.dispose();}
});
