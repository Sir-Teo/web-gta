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
test('arrest is one event that keeps the level for the fee and blocks crimes until respawn, bribes lower the level and death keeps it',()=>{
 const law=new WantedSystem();let arrests=0;law.onArrest=()=>arrests++;law.setLevel(3);law.arrest();law.arrest();expect(arrests).toBe(1);
 const chaos=law.native.chaos;law.crime(CRIME.stabCop,'ped:1');expect(law.level).toBe(3);expect(law.native.chaos).toBe(chaos);expect(law.arrested).toBe(true);
 law.clear();expect(law.arrested).toBe(false);expect(law.level).toBe(0);
 law.tick(3);law.setLevel(4);law.setLevel(law.level-1);expect(law.native.chaos).toBe(570);
 // Death leaves the level to RestorePlayerStuffDuringResurrection (the host's clear).
 law.tick(.1,false);expect(law.level).toBe(3);law.clear();expect(law.level).toBe(0);
});

test('setLevelNoDrop only raises the level and marks a fresh sighting (CWanted::SetWantedLevelNoDrop)', () => {
  const law = new WantedSystem(); law.position = () => ({ x: 5, y: 0, z: 7 });
  law.setLevelNoDrop(1);
  expect(law.level).toBe(1); expect(law.unseen).toBe(0); expect(law.lastKnown).toEqual({ x: 5, y: 0, z: 7 });
  law.setLevel(3); law.setLevelNoDrop(1);
  expect(law.level).toBe(3);
});

test('while the law backs off, crimes still count but no cops, cop cars, roadblocks or helicopters are wanted',()=>{
 const wanted=new WantedSystem();
 wanted.presence=()=>4;
 wanted.setLevel(3);
 expect(wanted.native.maxCopsInPursuit).toBeGreaterThan(0);expect(wanted.native.helisRequired).toBe(1);
 // CWanted::PoliceBackOff (MakePlayerSafe's m_bEverybodyBackOff here): CWanted::Update recomputes on the change.
 wanted.native.everybodyBackOff=true;wanted.tick(.02);
 expect([wanted.native.maxCopsInPursuit,wanted.native.maxCopCarsInPursuit,wanted.native.chanceOnRoadBlock,wanted.native.helisRequired]).toEqual([0,0,0,0]);
 // CCrime::ReportCrime does not look at the flag: a witnessed crime still adds chaos.
 const chaos=wanted.native.chaos;wanted.crime(CRIME.damagedCop,'ped:1');
 expect(wanted.native.chaos).toBeGreaterThan(chaos);
 wanted.native.everybodyBackOff=false;wanted.tick(.02);
 expect(wanted.native.maxCopsInPursuit).toBeGreaterThan(0);
});

test('a gang war zeroes the chaos a crime adds, and the level never passes the script maximum',()=>{
 const wanted=new WantedSystem();wanted.presence=()=>4;
 wanted.native.gangWarFighting=()=>true;
 wanted.crime(CRIME.damagedPed,'ped:1');
 // SetWantedLevelNoDrop(1) still applies for a witnessed crime; ReportCrimeNow itself adds nothing.
 expect(wanted.native.chaos).toBe(70);
 wanted.native.gangWarFighting=()=>false;
 wanted.native.setMaximumWantedLevel(2);wanted.setLevel(5);
 expect(wanted.level).toBe(2);expect(wanted.native.maximumChaos).toBe(365);
});

test('hurting a ped the police are chasing while clean pays the good citizen bonus instead of a crime (CCrime::ReportCrime)',()=>{
 const law=new WantedSystem();law.presence=()=>4;let bonus=0;law.onGoodCitizen=()=>bonus++;
 law.chasedByPolice=victim=>victim==='ped:7'?{alive:true}:victim==='ped:8'?{alive:false}:undefined;
 law.crime(CRIME.damagedPed,'ped:7');expect(bonus).toBe(1);expect(law.level).toBe(0);expect(law.native.chaos).toBe(0);
 // A dying victim: still no crime, but no bonus either.
 law.crime(CRIME.damagedPed,'ped:8');expect(bonus).toBe(1);expect(law.level).toBe(0);
 // Anyone else is a crime as usual.
 law.crime(CRIME.damagedPed,'ped:9');expect(law.level).toBe(1);
 // With stars, the chased ped is a victim like any other.
 law.crime(CRIME.damagedPed,'ped:7');expect(bonus).toBe(1);
});
