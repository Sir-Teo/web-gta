import {readFileSync} from 'node:fs';
import {readWeaponData} from '../src/weapons/weaponData';
import {expect,test,beforeAll} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {CRIME} from '../src/simulation/nativeWanted';
import type {WorldCar} from '../src/simulation/WorldCar';

beforeAll(async()=>{await RAPIER.init();});

function setup(){
  const sim=new Simulation();
  const weapons=new WeaponSystem(sim,()=>undefined,()=>undefined);
  const crimes:number[]=[];
  weapons.onCrime=(type)=>{crimes.push(type);};
  // A real (collider-less) body so ray exclusion takes a genuine rigid body.
  const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0));
  const car={occupied:true,wrecked:false,modelId:492,car:{body},assets:{collision:{bounds:{max:[1.8,1.5,4.5],min:[-1.8,0,-4.5]}}}} as unknown as WorldCar;
  return {sim,weapons,crimes,car,body};
}

const camera={origin:{x:-10,y:2.2,z:0},direction:{x:1,y:-0.05,z:0}};

test('drive-by fires the SMG slot\'s weapon from the camera-side window',()=>{
  const {sim,weapons,crimes,car}=setup();
  try{
    weapons.inventory.give(28,50);
    expect(weapons.inventory.selected).toBe(28);
    const clip=weapons.inventory.snapshot().clip;
    expect(weapons.fireDriveby(car,camera)).toBe(true);
    // Fired from the +x window (camera looks along +x at the car's right side).
    expect(weapons.inventory.snapshot().clip).toBe(clip-1);
    expect(weapons.effects.some(e=>e.kind==='tracer')).toBe(true);
    expect(crimes).toContain(CRIME.fireWeapon);
    // Cooldown blocks an immediate second shot; ticking restores it.
    expect(weapons.fireDriveby(car,camera)).toBe(false);
    weapons.tick(1);
    expect(weapons.fireDriveby(car,camera)).toBe(true);
  }finally{sim.dispose();}
});

test('drive-by refuses unoccupied cars and every weapon but the SMGs',()=>{
  const {sim,weapons,car}=setup();
  try{
    weapons.inventory.give(32,50);
    (car as {occupied:boolean}).occupied=false;
    expect(weapons.fireDriveby(car,camera)).toBe(false);
    (car as {occupied:boolean}).occupied=true;
    // RemoveWeaponWhenEnteringVehicle takes up only the SMG slot: a driver's pistol, Desert Eagle or sawn-off stays quiet.
    for(const id of [22,24,26]){weapons.inventory.give(id,20);weapons.inventory.select(id);expect(weapons.fireDriveby(car,camera)).toBe(false);}
    weapons.inventory.give(31,30);weapons.inventory.select(31);
    expect(weapons.fireDriveby(car,camera)).toBe(false);
    weapons.inventory.select(4);
    expect(weapons.fireDriveby(car,camera)).toBe(false);
  }finally{sim.dispose();}
});

test('drive-by fires over the gunwale of an occupied boat',()=>{
  const {sim,weapons,crimes}=setup();
  try{
    const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0));
    const boat={occupied:true,wrecked:false,modelId:430,body,assets:{collision:{bounds:{max:[2.4,4.7,3],min:[-2.4,-4.7,-.8]}}}} as unknown as import('../src/simulation/WorldBoat').WorldBoat;
    weapons.inventory.give(28,50);
    expect(weapons.inventory.selected).toBe(28);
    expect(weapons.fireDrivebyBoat(boat,camera)).toBe(true);
    expect(weapons.effects.some(e=>e.kind==='tracer')).toBe(true);
    expect(crimes).toContain(CRIME.fireWeapon);
    (boat as {wrecked:boolean}).wrecked=true;
    weapons.tick(1);
    expect(weapons.fireDrivebyBoat(boat,camera)).toBe(false);
  }finally{sim.dispose();}
});

test('loaded player car drive-bys fire left/right from the hand despite an unrelated camera direction',()=>{
 const {sim,weapons,car}=setup();try{
  weapons.installNative(readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')));weapons.inventory.select(28);weapons.inventory.setTotalAmmo(28,100);
  weapons.vehicleFirePose=()=>({handMatrix:[[1,0,0],[0,1,0],[0,0,1],[0,0,1]],owner:[0,0,1]});weapons.driveByRandom=()=>128;
  for(const x of [-10,10])sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setTranslation(x,1,0));sim.world.step();
  for(const [index,look] of (['left','right'] as const).entries()){
   weapons.tick(.1,undefined,100+index*100);weapons.inventory.prepareDriveBy(100+index*100,true);
   expect(weapons.fireDriveby(car,{origin:{x:0,y:4,z:0},direction:{x:0,y:1,z:0}},look)).toBe(true);const ray=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;expect(ray.to.x).toBeCloseTo(look==='left'?-9.5:9.5,4);
  }
  expect(weapons.inventory.shots).toBe(2);expect(weapons.inventory.cooldown).toBe(.07);
 }finally{sim.dispose();}
});
