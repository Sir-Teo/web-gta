import {expect,test} from 'vitest';
import {CRIME,WantedSystem} from '../src/simulation/WantedSystem';
const point={x:0,y:0,z:0};
test('player crimes use native CWanted chaos: unwitnessed shots queue, a witness raises one star at once',()=>{
 const law=new WantedSystem();law.position=()=>point;
 law.crime(CRIME.fireWeapon,'player');law.tick(1);expect(law.level).toBe(0);
 law.presence=radius=>radius>=14?1:0;law.crime(CRIME.fireWeapon,'player');expect(law.level).toBe(1);expect(law.lastKnown).toEqual(point);
 law.presence=()=>0;law.crime(CRIME.damageCopCar,'ped:1');expect(law.level).toBe(2);expect(law.snapshot().maxCopCars).toBe(2);
});
test('queued event crimes report after half a second and stars decay without nearby police',()=>{
 const law=new WantedSystem();law.registerCrime(CRIME.damageCar,'ped:1');law.registerCrime(CRIME.damageCar,'ped:2');law.tick(.4);expect(law.level).toBe(0);law.tick(1.2);expect(law.native.chaos).toBe(60);expect(law.level).toBe(1);
 for(let i=0;i<12;i++)law.tick(1.01);expect(law.level).toBe(0);expect(law.lastKnown).toBeUndefined();
});
test('arrest is one event that keeps the level for the fee and blocks crimes until respawn, bribes lower the level and death clears it',()=>{
 const law=new WantedSystem();let arrests=0;law.onArrest=()=>arrests++;law.setLevel(3);law.arrest();law.arrest();expect(arrests).toBe(1);
 const chaos=law.native.chaos;law.crime(CRIME.stabCop,'ped:1');expect(law.level).toBe(3);expect(law.native.chaos).toBe(chaos);expect(law.arrested).toBe(true);
 law.clear();expect(law.arrested).toBe(false);expect(law.level).toBe(0);
 law.tick(3);law.setLevel(4);law.setLevel(law.level-1);expect(law.native.chaos).toBe(570);law.tick(.1,false);expect(law.level).toBe(0);
});

test('setLevelNoDrop only raises the level and marks a fresh sighting (CWanted::SetWantedLevelNoDrop)', () => {
  const law = new WantedSystem(); law.position = () => ({ x: 5, y: 0, z: 7 });
  law.setLevelNoDrop(1);
  expect(law.level).toBe(1); expect(law.unseen).toBe(0); expect(law.lastKnown).toEqual({ x: 5, y: 0, z: 7 });
  law.setLevel(3); law.setLevelNoDrop(1);
  expect(law.level).toBe(3);
});

test('while everybody backs off, a crime raises nothing at all',()=>{
 const wanted=new WantedSystem();
 wanted.presence=()=>4;
 wanted.crime(CRIME.carSteal,'car:1');
 expect(wanted.level).toBeGreaterThan(0);
 const raised=wanted.level;
 // CPlayerInfo::MakePlayerSafe sets m_bEverybodyBackOff; nothing the player does reaches the law while it is on.
 wanted.native.everybodyBackOff=true;
 wanted.crime(CRIME.damagedCop,'ped:1');
 wanted.registerCrime(CRIME.damagedCop,'ped:2');
 expect(wanted.level).toBe(raised);
 // And it starts counting again once it is off.
 wanted.native.everybodyBackOff=false;
 wanted.crime(CRIME.damagedCop,'ped:3');
 expect(wanted.level).toBeGreaterThanOrEqual(raised);
});
