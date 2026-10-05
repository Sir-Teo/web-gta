import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {NativeBankLoader} from '../src/audio/native/NativeBankLoader';
import {NativeAudioEngine,type NativeAudioFrame} from '../src/audio/native/NativeAudioEngine';
import {SCANNER_AREAS,SCANNER_COLOURS,SCANNER_CRIMES,SCANNER_OPENINGS,SCANNER_VEHICLES} from '../src/audio/native/scannerTables';
import {SCANNER_BANK,VEHICLE_AUDIO_TYPE_FOR_NAME,type ScannerCrimeScene} from '../src/audio/native/NativePoliceScanner';
import {VEHICLE_AUDIO_SETTINGS} from '../src/audio/native/vehicleAudioSettings';
import {AE_FRONTEND} from '../src/audio/native/NativeFrontendAudio';
import {CRIME,NativeWanted} from '../src/simulation/nativeWanted';
import {prepareWorldZones,readZones,worldZoneAt} from '../src/assets/worldZones';

const zones=prepareWorldZones(['map.zon','info.zon'].flatMap(name=>readZones(readFileSync(`public/play/world/files/zones/${name}`,'latin1'),name)));
/** The scene AddAudioEvent reads at a point: the smallest type-0 navigation zone, and the player. */
function scene(x:number,y:number,player?:ScannerCrimeScene['player']):ScannerCrimeScene{
 const zone=worldZoneAt(zones,[x,y,13],true);
 return {point:{x,y},zone:{textKey:zone.textLabel,min:[zone.min[0],zone.min[1]],max:[zone.max[0],zone.max[1]]},player};
}
const onFoot={inVehicle:false,swimming:false,jetPack:false};
const seconds=(s:number)=>({samples:new Float32Array(Math.round(22050*s)),sampleRate:22050,headroom:0,loopStart:-1});
/** An engine whose banks and single sounds load at once; the scanner's words are a second long each. */
function engine(random=()=>0){
 const loader=new NativeBankLoader({version:1,packageSha256:'',banks:[]},async()=>new Uint8Array());
 const loaded:[number,number][]=[];
 loader.otherBanks=async()=>Array.from({length:60},()=>seconds(.2));
 loader.otherSound=async(bank,sound)=>{loaded.push([bank,sound]);return seconds(1);};
 return {audio:new NativeAudioEngine(loader,undefined,random),loader,loaded};
}
const frame:NativeAudioFrame={camera:{position:{x:0,y:0,z:0},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},firstPerson:false,justSwitched:false},vehicles:[]};
/** Runs the engine for `ms` of audio frames, letting the loads resolve between them. */
async function run(audio:NativeAudioEngine,ms:number,input:NativeAudioFrame=frame){
 for(let t=0;t<ms;t+=1000/30){audio.frame(1000/30,()=>input);await new Promise(r=>setTimeout(r,0));}
}
const slot=(bank:number,sound:number)=>[bank,sound];
const none=[-1,-1];

describe('the scanner’s tables, from the iOS executable',()=>{
 test('every sound is one its bank has',()=>{
  const script=JSON.parse(readFileSync('public/play/audio/script/script.json','utf8')) as {banks:{id:number;sounds:number}[]};
  const sounds=(bank:number)=>script.banks.find(b=>b.id===bank)!.sounds;
  const within=(values:readonly number[],bank:number)=>values.every(v=>v===-1||v>=0&&v<sounds(bank));
  expect(within(SCANNER_OPENINGS,SCANNER_BANK.instructions)&&within(SCANNER_CRIMES,SCANNER_BANK.numbers)&&within(SCANNER_VEHICLES,SCANNER_BANK.vehicles)&&within(SCANNER_COLOURS,SCANNER_BANK.colours)).toBe(true);
  expect(within(SCANNER_AREAS.map(a=>a[1]),SCANNER_BANK.areas)).toBe(true);
  expect(sounds(SCANNER_BANK.areas)).toBe(164);expect(SCANNER_AREAS).toHaveLength(194);
 });
 test('all but nine of the PC’s navigation zone names have an area to say',()=>{
  const keys=new Set(zones.navigation.slice(1).filter(z=>z.type===0).map(z=>z.textLabel));
  const silent=[...keys].filter(key=>!SCANNER_AREAS.some(([k,sound])=>k===key&&sound>=0)).sort();
  expect(silent).toEqual(['CHINA','CREE','JEF','LST','PILL','REST','ROBINT','SHACA','WESTP']);
 });
 test('the vehicle types match vehicleAudioSettings’ names',()=>{
  for(const row of VEHICLE_AUDIO_SETTINGS)if(row[8]!=='NONE')expect(VEHICLE_AUDIO_TYPE_FOR_NAME.indexOf(row[8] as never)).toBeGreaterThanOrEqual(0);
  expect(VEHICLE_AUDIO_TYPE_FOR_NAME).toHaveLength(46);expect(SCANNER_VEHICLES).toHaveLength(46);
 });
});

describe('AddAudioEvent’s report',()=>{
 test('an opening, the crime’s ten-code, the zone’s direction and its area',()=>{
  const {audio}=engine(()=>.5);
  // Grove Street is in Ganton's middle half both ways: "central".
  audio.crimeReported(CRIME.damagedCop,scene(2495,-1687,onFoot));
  const s=audio.policeScanner.snapshot();
  expect(s.state).toBe(2);
  expect(s.first).toEqual([slot(150,SCANNER_OPENINGS[1]),slot(151,SCANNER_CRIMES[CRIME.damagedCop]),none,slot(149,0),slot(147,51)]);
  expect(s.second).toEqual([slot(150,7),none,none,none,slot(150,4)]);
 });
 test('north or south, then east or west, beyond the zone’s middle half',()=>{
  const east=engine();east.audio.crimeReported(CRIME.carSteal,scene(2600,-1660,onFoot));
  expect(east.audio.policeScanner.snapshot().first.slice(2)).toEqual([none,slot(149,1),slot(147,51)]);
  const northWest=engine();northWest.audio.crimeReported(CRIME.carSteal,scene(2240,-1640,onFoot));
  expect(northWest.audio.policeScanner.snapshot().first.slice(2)).toEqual([slot(149,2),slot(149,4),slot(147,51)]);
  // Pershing Square's area is said with no direction.
  const square=engine();square.audio.crimeReported(CRIME.carSteal,scene(1500,-1700,onFoot));
  expect(square.audio.policeScanner.snapshot().first.slice(2)).toEqual([none,none,slot(147,86)]);
 });
 test('the vehicle: its colour where the type has one said, then its kind; “on a” a bike',()=>{
  const fourDoor=VEHICLE_AUDIO_TYPE_FOR_NAME.indexOf('FOUR_DOOR'),bike=VEHICLE_AUDIO_TYPE_FOR_NAME.indexOf('BIKE');
  const car=engine();car.audio.crimeReported(CRIME.runRedLight,scene(2495,-1687,{inVehicle:true,swimming:false,jetPack:false,vehicle:{typeForName:fourDoor,remapped:false,primaryColour:3}}));
  expect(car.audio.policeScanner.snapshot().second).toEqual([slot(150,7),slot(150,1),none,slot(148,SCANNER_COLOURS[3]),slot(152,SCANNER_VEHICLES[fourDoor])]);
  const motorbike=engine();motorbike.audio.crimeReported(CRIME.runRedLight,scene(2495,-1687,{inVehicle:true,swimming:false,jetPack:false,vehicle:{typeForName:bike,remapped:true,primaryColour:3}}));
  expect(motorbike.audio.policeScanner.snapshot().second).toEqual([slot(150,7),slot(150,3),none,slot(148,4),slot(152,SCANNER_VEHICLES[bike])]);
  // A police car's colour goes unsaid, as do colours 0, 6 and 127.
  const police=VEHICLE_AUDIO_TYPE_FOR_NAME.indexOf('POLICE_CAR'),cop=engine();
  cop.audio.crimeReported(CRIME.runRedLight,scene(2495,-1687,{inVehicle:true,swimming:false,jetPack:false,vehicle:{typeForName:police,remapped:false,primaryColour:3}}));
  expect(cop.audio.policeScanner.snapshot().second[3]).toEqual(none);
  const sixth=engine();sixth.audio.crimeReported(CRIME.runRedLight,scene(2495,-1687,{inVehicle:true,swimming:false,jetPack:false,vehicle:{typeForName:fourDoor,remapped:false,primaryColour:6}}));
  expect(sixth.audio.policeScanner.snapshot().second[3]).toEqual(none);
 });
 test('a sedan, a jetpack or a zone with no name leaves part or all of it out; only crime types 2 to 22 count',()=>{
  const sedan=engine();sedan.audio.crimeReported(CRIME.carSteal,scene(2495,-1687,{inVehicle:true,swimming:false,jetPack:false,vehicle:{typeForName:5,remapped:false,primaryColour:3}}));
  expect(sedan.audio.policeScanner.snapshot().second).toEqual([none,none,none,none,none]);
  const flying=engine();flying.audio.crimeReported(CRIME.carSteal,scene(2495,-1687,{inVehicle:false,swimming:false,jetPack:true}));
  expect(flying.audio.policeScanner.snapshot().second).toEqual([none,none,none,none,none]);
  const swimming=engine();swimming.audio.crimeReported(CRIME.carSteal,scene(2495,-1687,{inVehicle:false,swimming:true,jetPack:false}));
  expect(swimming.audio.policeScanner.snapshot().second[4]).toEqual(slot(150,2));
  const nameless=engine();nameless.audio.crimeReported(CRIME.carSteal,{point:{x:0,y:0},zone:{textKey:'SAN_AND',min:[-3000,-3000],max:[3000,3000]},player:onFoot});
  expect(nameless.audio.policeScanner.snapshot().state).toBe(0);
  for(const type of [CRIME.fireWeapon,23]){const e=engine();e.audio.crimeReported(type,scene(2495,-1687,onFoot));expect(e.audio.policeScanner.snapshot().state).toBe(0);}
 });
});

describe('the report plays',()=>{
 test('2 s on, a click and the static, then each word in its slot, the second list after the first',async()=>{
  const {audio,loaded}=engine();
  await run(audio,100);// the frontend bank
  audio.crimeReported(CRIME.damagedCop,scene(2495,-1687,onFoot));
  await run(audio,200);
  expect(loaded).toEqual([[150,0],[151,7],[149,0],[147,51]]);
  expect(audio.policeScanner.snapshot().state).toBe(4);
  const playing=()=>audio.manager.sounds.filter(s=>s.inUse).map(s=>[s.slot,s.event]);
  await run(audio,1800);
  // The click (49) and the static (47), from the frontend bank's slot 0.
  expect(playing()).toEqual(expect.arrayContaining([[0,AE_FRONTEND.scannerClick],[0,AE_FRONTEND.scannerNoiseStart]]));
  await run(audio,400);
  expect(playing()).toContainEqual([33,164]);
  // Each word starts 40 ms before the last ends: four words of a second.
  await run(audio,3000);expect(playing()).toContainEqual([37,164]);
  await run(audio,1500);
  // The second list: "suspect last seen" ... "on foot".
  expect(loaded.slice(4)).toEqual([[150,7],[150,4]]);
  await run(audio,3000);
  const s=audio.policeScanner.snapshot();
  expect(s.reportsPlayed).toBe(1);expect(s.state).toBe(0);
  expect(playing().some(([,event])=>event===AE_FRONTEND.scannerNoiseStart)).toBe(false);
 });
 test('the next report waits 10 s; widescreen stops one',async()=>{
  const {audio}=engine();
  await run(audio,100);
  audio.crimeReported(CRIME.damagedCop,scene(2495,-1687,onFoot));
  await run(audio,300);
  await run(audio,300,{...frame,widescreen:true});
  expect(audio.policeScanner.snapshot().state).toBe(0);
  audio.crimeReported(CRIME.damagedCop,scene(2495,-1687,onFoot));expect(audio.policeScanner.snapshot().state).toBe(0);
  await run(audio,10000);
  audio.crimeReported(CRIME.damagedCop,scene(2495,-1687,onFoot));expect(audio.policeScanner.snapshot().state).toBe(2);
 });
});

describe('CWanted hands the scanner a crime that raised the level',()=>{
 test('with where it was committed, a queued crime keeping its place',()=>{
  const w=new NativeWanted(),heard:[number,{x:number}|undefined][]=[];
  let at={x:1,y:2,z:3};w.crimePosition=()=>at;w.onLevelRaisedByCrime=(type,position)=>heard.push([type,position]);
  w.reportCrime(CRIME.damageCar,'ped1',()=>0);at={x:9,y:9,z:9};w.update(.6,true,false,false);
  expect(heard).toEqual([]);// 30 chaos: no star yet
  w.reportCrime(CRIME.damageCar,'ped2',()=>0);at={x:5,y:5,z:5};w.update(.6,true,false,false);
  expect(heard).toEqual([[CRIME.damageCar,{x:9,y:9,z:9}]]);
  w.reportCrime(CRIME.damageCar,'ped3',()=>0);w.update(.6,true,false,false);expect(heard).toHaveLength(1);// still one star
 });
});

describe('LoadSound',()=>{
 test('a slot holding one sound answers for that sound alone',async()=>{
  const loader=new NativeBankLoader({version:1,packageSha256:'',banks:[]},async()=>new Uint8Array());
  loader.otherSound=async()=>seconds(.1);
  loader.loadSound(147,51,37);expect(loader.isSoundLoaded(147,51,37)).toBe(false);
  await new Promise(r=>setTimeout(r,0));
  expect(loader.isSoundLoaded(147,51,37)).toBe(true);expect(loader.isSoundBankLoaded(147,37)).toBe(true);
  expect(loader.sound(37,51)).toBeDefined();expect(loader.sound(37,50)).toBeUndefined();
  loader.otherSound=async()=>undefined;loader.loadSound(147,52,37);await new Promise(r=>setTimeout(r,0));
  expect(loader.isSoundLoaded(147,51,37)).toBe(true);// a sound that cannot be had leaves the slot as it was
 });
});
