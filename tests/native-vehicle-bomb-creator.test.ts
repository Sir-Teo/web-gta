import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import fixture from './fixtures/native-vehicle-bomb-creator.json';
import {stepBombTimer} from '../src/vehicle/nativeCarBomb';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {WorldPlane} from '../src/simulation/WorldPlane';
import {NativeClumpAlpha} from '../src/simulation/nativeClumpAlpha';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';

beforeAll(async()=>{await RAPIER.init();});
for(const [index,row]of fixture.ticks.entries())test(`captured delayed explosion ${index}: ${JSON.stringify(row.input)}`,()=>{
 const target={bombTimerMs:row.input.timer};expect(stepBombTimer(target,row.input.timeStep)).toBe(!!row.blowUp);expect(target.bombTimerMs).toBe(row.timer);
});
for(const [name,Vehicle]of [['bike',WorldBike],['boat',WorldBoat],['aircraft',WorldPlane]]as const){
 for(const row of fixture.creation)test(`${name} native timer and creator: ${row.source}, rand ${row.random}`,()=>{
  const byPlayer=row.source==='player'||row.source==='playerVehicle',target={health:1,occupied:false,wrecked:false,modelId:487,bombTimerMs:0,bombDetonatedByPlayer:!byPlayer}as any;
  const random=vi.spyOn(Math,'random').mockReturnValue(row.random/32768);
  try{if(Vehicle===WorldPlane)WorldPlane.prototype.damage.call(target,2,51,byPlayer);else(Vehicle.prototype.damage as any).call(target,2,undefined,true,undefined,{weapon:51,byPlayer});expect(target.bombTimerMs).toBe(row.timer);expect(target.bombDetonatedByPlayer).toBe(byPlayer);}finally{random.mockRestore();}
 });
 for(const byPlayer of[false,true])test(`${name} hands its expired timer's creator to the pending explosion: ${byPlayer}`,()=>{
  const target={health:0,occupied:false,wrecked:false,modelId:487,motorbike:true,throttle:1,bombTimerMs:16,bombDetonatedByPlayer:byPlayer,explosionByPlayer:!byPlayer,stepDt:1/50,frozen:false,sim:{worldFocus:{x:0,y:0,z:0}},root:{visible:true},body:{translation:()=>({x:400,y:0,z:0}),setEnabled(){},isEnabled:()=>false,linvel:()=>({x:0,y:0,z:0}),setLinvel(){}},clumpAlpha:new NativeClumpAlpha(()=>{}),scorch(){},collisionDamage(){},collisionKnockOff(){},impactVelocity:new Vector3(),burn:()=>false}as any;
  if(Vehicle===WorldPlane){target.destroyed=(WorldPlane.prototype as any).destroyed;expect(WorldPlane.prototype.afterStep.call(target)).toBe(true);}else{
   target.blowUp=(Vehicle.prototype as any).blowUp;(Vehicle.prototype.beforeStep as any).call(target,1/50);expect((Vehicle.prototype.afterStep as any).call(target)).toBe(true);
  }
  expect(target.bombTimerMs).toBe(0);expect(target.explosionByPlayer).toBe(byPlayer);
 });
}
for(const kind of['bike','boat','aircraft']as const)for(const byPlayer of[false,true])test(`${kind} blast and follow-up rockets retain player attribution ${byPlayer}`,()=>{
 const sim=new Simulation(),at={x:0,y:100,z:0},body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(1,100,0)),damage=vi.fn(()=>false),boat={body,wrecked:false,occupied:false,damage};
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],boats:[boat]}as any)),explosion=vi.fn();weapons.onExplosion=explosion;
 const random=vi.spyOn(Math,'random').mockReturnValue(0);
 try{
  (weapons.vehicleExplosion as any)(at,kind,()=>at,byPlayer);expect(explosion).toHaveBeenCalled();expect(explosion.mock.calls.every(c=>c[2]===byPlayer)).toBe(true);expect(damage.mock.calls.every(c=>(c as any[])[4].byPlayer===byPlayer)).toBe(true);
  if(kind==='aircraft'){const count=explosion.mock.calls.length;weapons.tick(.05);expect(explosion.mock.calls.length).toBeGreaterThan(count);expect(explosion.mock.calls.every(c=>c[2]===byPlayer)).toBe(true);}
 }finally{random.mockRestore();weapons.dispose();sim.dispose();}
});
