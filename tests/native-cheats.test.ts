import {afterEach,expect,test} from 'vitest';
import {CHEATS,CHEAT_HASHES,NativeCheats,nativeKey,megaPunchBlow,type CheatName} from '../src/simulation/nativeCheats';
import {nativeTrafficLights,TRAFFIC_LIGHT} from '../src/world/nativeTrafficLights';
import {chooseVehicleColors,readCarColors} from '../src/assets/carColors';
import {NativeWanted} from '../src/simulation/nativeWanted';
import {WeaponInventory} from '../src/weapons/Inventory';
import {handlePlayerBreath} from '../src/simulation/playerBreath';

afterEach(()=>CHEATS.reset());
const type=(cheats:NativeCheats,text:string)=>{let found:CheatName|undefined;for(const key of text)found=cheats.add(key)??found;return found;};

test('CCheat::AddToCheatString finds the PC codes by their reversed-string hashes, inside other typing', () => {
 const cheats=new NativeCheats();
 const codes:[string,CheatName][]=[['HESOYAM','moneyArmourHealth'],['BAGUVIX','infiniteHealth'],['AEZAKMI','neverWanted'],['JUMPJET','hydra'],['OHDUDE','hunter'],
  ['XJVSNAJ','alwaysMidnight'],['OFVIAC','orangeSky'],['ZEIIVG','greenLights'],['KANGAROO','megaJump'],['AIWPRTON','rhino'],['BIFBUZZ','gangLand'],['AGBDLCID','monsterTruck']];
 for(const [code,name] of codes){expect(nativeKey([...code].reverse().join(''))).toBe(CHEAT_HASHES[name]);expect(type(cheats,`WASD${code}`)).toBe(name);}
 // The Rancher's code hashes to 0, the value the table holds for it.
 expect(nativeKey('HMDTNQJ')).toBe(0);expect(type(cheats,'JQNTDMH')).toBe('rancher');
 expect(cheats.timesCheated).toBe(codes.length+1);
 // Fewer than six keys never match, and a match clears the string.
 expect(type(new NativeCheats(),'OHDUD')).toBeUndefined();
 // Hashes are unique apart from nothing else sharing the Rancher's 0.
 expect(new Set(Object.values(CHEAT_HASHES)).size).toBe(Object.keys(CHEAT_HASHES).length);
});

test('a toggled cheat reports CHEAT8 when typed again', () => {
 const cheats=new NativeCheats();
 type(cheats,'ZEIIVG');expect(cheats.wasActive).toBe(false);cheats.toggle('greenLights');
 type(cheats,'ZEIIVG');expect(cheats.wasActive).toBe(true);cheats.toggle('greenLights');expect(cheats.isActive('greenLights')).toBe(false);
});

test('the cheats the original reads in place: green lights, black and pink traffic, never wanted, infinite ammo and oxygen', () => {
 // Phase 6000 ms is red for north-south until the green lights cheat.
 expect(nativeTrafficLights(12000).cars[0]).toBe(TRAFFIC_LIGHT.red);
 CHEATS.enable('greenLights');expect(nativeTrafficLights(12000).cars).toEqual([TRAFFIC_LIGHT.green,TRAFFIC_LIGHT.green]);
 const colors=readCarColors('col\n0,0,0\n'+Array.from({length:126},(_,i)=>`${i},0,0`).join('\n')+'\n255,0,255\nend\ncar\ncar_a,1,2\nend');
 CHEATS.enable('pinkTraffic');expect(chooseVehicleColors(colors,'car_a',0).indices).toEqual([126,126,126,126]);
 // Black wins over pink, as ChooseVehicleColour tests it first; models without colours stay black.
 CHEATS.enable('blackTraffic');expect(chooseVehicleColors(colors,'car_a',0).indices).toEqual([0,0,0,0]);
 CHEATS.reset();expect(chooseVehicleColors(colors,'car_a',0).indices).toEqual([1,2,0,0]);
 const wanted=new NativeWanted();CHEATS.enable('neverWanted');
 wanted.setWantedLevel(3);expect(wanted.level).toBe(0);expect(wanted.reportCrimeNow(1,false)).toBe(false);expect(wanted.chaos).toBe(0);
 CHEATS.reset();wanted.setWantedLevel(3);expect(wanted.level).toBe(3);
 const inventory=new WeaponInventory();inventory.select(31);const clip=inventory.ammo.get(31)!.clip;
 CHEATS.enable('infiniteAmmo');inventory.fire();expect(inventory.ammo.get(31)!.clip).toBe(clip);
 const breath={breath:50,requireHandleBreath:false};
 CHEATS.enable('infiniteOxygen');handlePlayerBreath(breath,true,1,1);expect(breath.breath).toBe(52);
});

test('the mega punch takes all the health from fist, knuckle and parachute blows, CJ included, armour or not',async()=>{
 const RAPIER=(await import('@dimforge/rapier3d-compat')).default;await RAPIER.init();
 const {Simulation}=await import('../src/simulation/Simulation');
 expect(megaPunchBlow(0)).toBe(false);
 CHEATS.enable('megaPunch');
 expect([0,1,46,2,22].map(megaPunchBlow)).toEqual([true,true,true,false,false]);
 // A street ped's fist (CPedDamageResponseCalculator::ComputeWillKillPed): armour absorbs first, then the health goes.
 const sim=new Simulation();sim.player.armour=50;
 sim.damagePlayer(3,false,{weapon:0});
 expect(sim.player.health).toBe(0);
 sim.dispose();
});

test('CGameLogic::PassTime carries minutes into the next day and rolls the weekday, past Sunday straight to Monday',async()=>{
 const RAPIER=(await import('@dimforge/rapier3d-compat')).default;await RAPIER.init();
 const {Simulation}=await import('../src/simulation/Simulation');
 const sim=new Simulation();sim.timeMinutes=23*60;sim.weekDay=7;
 sim.passTime(12*60);expect([sim.timeMinutes,sim.weekDay]).toEqual([11*60,1]);
 // Friday (5) and two days is Sunday (7); Saturday (6) and three days passes seven and lands on Monday (1), where
 // counting by seven would give Tuesday.
 sim.weekDay=5;sim.passTime(48*60);expect(sim.weekDay).toBe(7);
 sim.weekDay=6;sim.passTime(72*60);expect(sim.weekDay).toBe(1);
 sim.dispose();
});
