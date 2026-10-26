import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import reference from './fixtures/native-vehicle-damage-gates.json';
import {WorldCar} from '../src/simulation/WorldCar';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {WorldPlane} from '../src/simulation/WorldPlane';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
beforeAll(async()=>RAPIER.init());
const previous={none:undefined,player:{player:true as const},other:{ped:{id:9}}};
for(const [name,Vehicle] of [['car',WorldCar],['bike',WorldBike],['boat',WorldBoat],['aircraft',WorldPlane]] as const){
 const make=(extra:object={})=>({health:1000,occupied:false,canBeDamaged:true,onlyDamagedByPlayer:false,wrecked:false,modelId:487,lastWeaponDamage:17,lastDamagedBy:previous.player,...extra}) as any;
 const damage=(target:any,by:any)=>Vehicle===WorldPlane?(Vehicle.prototype.damage as any).call(target,20,31,false,by):(Vehicle.prototype.damage as any).call(target,20,undefined,false,undefined,{weapon:31,byPlayer:false,by});
 for(const row of reference.storage.filter(r=>r.source==='none'))test(`${name} preserves the captured null-attacker reference after ${row.previousSource}`,()=>{
  const target=make({lastDamagedBy:previous[row.previousSource as keyof typeof previous]});damage(target,null);expect(target.lastDamagedBy).toBe(previous[row.lastSource as keyof typeof previous]);expect(target.lastWeaponDamage).toBe(row.lastWeapon);expect(target.health).toBeLessThan(1000);
 });
 test(`${name} keeps null, unknown non-player and known entity attribution distinct`,()=>{
  const target=make(),original=target.lastDamagedBy;damage(target,null);expect(target.lastDamagedBy).toBe(original);damage(target,undefined);expect(target.lastDamagedBy).toBeUndefined();damage(target,previous.other);expect(target.lastDamagedBy).toBe(previous.other);
 });
 for(const protection of [{onlyDamagedByPlayer:true},{proofs:{bullet:true}},{health:0}])test(`${name} rejects protected/dead anonymous wounds without overwriting history: ${JSON.stringify(protection)}`,()=>{
  const target=make(protection),health=target.health,source=target.lastDamagedBy;damage(target,null);expect(target.health).toBe(health);expect(target.lastDamagedBy).toBe(source);expect(target.lastWeaponDamage).toBe(17);
 });
}
test('the actual anonymous-round backend preserves an earlier player damager while recording its new weapon',()=>{
 const sim=new Simulation();sim.playerCollider.setEnabled(false);const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5),body);
 const boat=Object.assign(Object.create(WorldBoat.prototype),{body,modelId:452,health:1000,occupied:false,canBeDamaged:true,onlyDamagedByPlayer:false,wrecked:false,lastWeaponDamage:-1}),weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:new Set(),boats:new Set([boat])}));
 try{boat.damage(1,undefined,false,undefined,{weapon:22,byPlayer:true});const source=boat.lastDamagedBy,health=boat.health;sim.world.step();weapons.fireInstantHitRound({x:0,y:1,z:0},{x:0,y:1,z:-10},15);expect(boat.health).toBe(health-15);expect(boat.lastWeaponDamage).toBe(28);expect(boat.lastDamagedBy).toBe(source);}finally{weapons.dispose();sim.dispose();}
});
