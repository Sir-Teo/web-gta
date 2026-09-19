import {afterEach,expect,test} from 'vitest';
import {CHEATS,CHEAT_HASHES,NativeCheats,nativeKey,type CheatName} from '../src/simulation/nativeCheats';
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
