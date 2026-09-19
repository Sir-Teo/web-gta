import {expect,test} from 'vitest';
import {CRIME,NativeWanted} from '../src/simulation/nativeWanted';
import {WEATHER_REGION,nativeWeatherRegion} from '../src/world/weatherRegion';
const none=()=>0,cops=()=>1;
test('queued crimes report after 500 ms and add CWanted::ReportCrimeNow chaos',()=>{
 const w=new NativeWanted();w.reportCrime(CRIME.damageCar,'ped1',none);expect(w.chaos).toBe(0);
 w.update(.3,true,false,false);expect(w.chaos).toBe(0);w.update(.9,true,false,false);expect(w.chaos).toBe(30);expect(w.level).toBe(0);
 w.reportCrime(CRIME.damageCar,'ped1',none);w.update(1.1,true,false,false);expect(w.chaos).toBe(30);
 w.reportCrime(CRIME.damageCar,'ped2',none);w.update(1.1,true,false,false);expect(w.chaos).toBe(60);expect(w.level).toBe(1);expect(w.maxCopsInPursuit).toBe(1);
});
test('a crime witnessed by police reports at once and sets at least one star; attacks on cops escalate',()=>{
 const w=new NativeWanted();w.reportCrime(CRIME.fireWeapon,'player',cops);expect(w.level).toBe(1);expect(w.chaos).toBe(70);
 const c=new NativeWanted();c.reportCrime(CRIME.damageCopCar,'cop',none);expect(c.level).toBe(2);expect(c.chaos).toBe(200);
 c.reportCrime(CRIME.destroyHeli,'heli',cops);expect(c.chaos).toBe(600);expect(c.level).toBe(3);expect(c.chanceOnRoadBlock).toBe(12);
 const criminal=new NativeWanted();criminal.reportCrime(CRIME.stabPed,'gang',cops,true);expect(criminal.chaos).toBe(70);
 // Unwitnessed, the "police don't really care" divisor leaves 35/3 → 11.
 const quiet=new NativeWanted();quiet.reportCrime(CRIME.stabPed,'gang',none,true);quiet.update(1.1,true,false,false);expect(quiet.chaos).toBe(11);
});
test('chaos decays one point a second without police within 18 units, two in rural regions, and not while flying elsewhere',()=>{
 const w=new NativeWanted();w.setWantedLevel(1);for(let i=0;i<20*60;i++)w.update(1/60,false,false,false);expect(w.level).toBe(1);for(let i=0;i<2*60;i++)w.update(1/60,false,false,false);expect(w.level).toBe(0);
 const rural=new NativeWanted();rural.setWantedLevel(2);for(let i=0;i<12*60;i++)rural.update(1/60,false,true,false);expect(rural.level).toBe(1);
 const flying=new NativeWanted();flying.setWantedLevel(2);for(let i=0;i<30*60;i++)flying.update(1/60,false,true,true);expect(flying.chaos).toBe(200);
 const watched=new NativeWanted();watched.setWantedLevel(3);for(let i=0;i<10*60;i++)watched.update(1/60,true,false,false);expect(watched.chaos).toBe(570);expect(watched.helisRequired).toBe(1);
});
test('CWeather::FindWeatherRegion bounds',()=>{
 expect(nativeWeatherRegion(2495,-1687)).toBe(WEATHER_REGION.la);expect(nativeWeatherRegion(-2000,500)).toBe(WEATHER_REGION.sf);expect(nativeWeatherRegion(2000,1500)).toBe(WEATHER_REGION.lv);expect(nativeWeatherRegion(400,2500)).toBe(WEATHER_REGION.desert);expect(nativeWeatherRegion(0,0)).toBe(WEATHER_REGION.default);
});
import {CHEAT_HASHES,NativeCheats as NativeCheatString,nativeKey} from '../src/simulation/nativeCheats';
test('CCheat::AddToCheatString hashes the newest keys first with CKeyGen::GetKey',()=>{
 expect(nativeKey('TAEHEHTPUNRUT')).toBe(CHEAT_HASHES.wantedLevelUp);expect(nativeKey('MAYOSEH')).toBe(CHEAT_HASHES.moneyArmourHealth);
 const cheats=new NativeCheatString();let found:string|undefined;for(const key of 'WASDTURNUPTHEHEAT')found=cheats.add(key)??found;expect(found).toBe('wantedLevelUp');
 expect([...'HESOYA'].map(k=>cheats.add(k)).filter(Boolean)).toEqual([]);expect(cheats.add('M')).toBe('moneyArmourHealth');
});
