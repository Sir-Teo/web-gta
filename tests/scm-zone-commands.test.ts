import {describe,expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {ScmThread,UnsupportedScmCommand,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ZONE_POP_RESIDENTIAL_AVERAGE,ZONE_RACES_ALL} from '../src/engine/ScmZones';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {readInitialZonePopulation} from '../src/assets/scmZonePopulation';
import {readZones,prepareWorldZones} from '../src/assets/worldZones';

const script=async()=>new Uint8Array(await readFile('public/play/world/files/scripts/main.scm'));
const worldZones=async()=>prepareWorldZones((await Promise.all(['map.zon','info.zon'].map(async n=>readZones(await readFile('public/play/world/files/zones/'+n,'utf8'),n)))).flat());
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState,world?:Partial<ScmWorldCommands>){
 const adapter={fade(){},...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:adapter};
 return new ScmThread(bytes,offset,0,undefined,host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};

describe('CTheZones script commands',()=>{
 test('a fresh info zone carries the population type and races CZoneInfo starts with',async()=>{
  const game=new ScmGameState();
  game.zones.load((await worldZones()).infoLabels);
  expect(game.zones.count).toBeGreaterThan(100);
  const first=game.zones.at(0);
  expect(first.popType).toBe(ZONE_POP_RESIDENTIAL_AVERAGE);
  expect(first.popRaces).toBe(ZONE_RACES_ALL);
  expect(first.gangStrength).toHaveLength(10);
  expect(first.dealerStrength).toBe(0);
  expect(first.noCops).toBe(false);
 });

 test('running INITIAL’s zone block leaves every zone as the static reader reads it',async()=>{
  const bytes=await script(),zones=await worldZones(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const start=code.find(i=>i.name==='INIT_ZONE_POPULATION_SETTINGS')!;
  expect(start).toBeDefined();
  const game=new ScmGameState();
  game.zones.load(zones.infoLabels);
  const thread=threadAt(bytes,start.offset,game);
  // The block runs to its end and stops at the first command after it the runtime has not ported.
  expect(()=>thread.run(0,2000)).toThrow(UnsupportedScmCommand);
  const expected=readInitialZonePopulation(bytes,zones);
  expect(expected.unresolved).toEqual([]);
  expect(game.zones.unresolved).toEqual([]);
  const mine=game.zones.all.map(info=>({popType:info.popType,gangStrength:info.gangStrength,dealerStrength:info.dealerStrength,races:info.popRaces,noCops:info.noCops}));
  expect(mine).toEqual(expected.population);
 });

 test('a label no zone carries changes nothing, and the runtime keeps it as a diagnostic',async()=>{
  const bytes=await script(),zones=await worldZones(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const start=code.find(i=>i.name==='INIT_ZONE_POPULATION_SETTINGS')!;
  const game=new ScmGameState();
  game.zones.load(zones.infoLabels.filter(label=>label!=='VERO2'));
  const thread=threadAt(bytes,start.offset,game);
  expect(()=>thread.run(0,2000)).toThrow(UnsupportedScmCommand);
  expect([...new Set(game.zones.unresolved)]).toEqual(['VERO2']);
 });

 test('the gang war zone statics take the labelled zones and clear together',async()=>{
  const bytes=await script(),zones=await worldZones(),header=readScmHeader(bytes);
  const blocks=header.missions.map(m=>{try{return decodeScmInstructions(bytes,m.start,m.end);}catch{return [];}}).flat();
  const training=blocks.find(i=>i.name==='SET_ZONE_FOR_GANG_WARS_TRAINING');
  const specific=blocks.find(i=>i.name==='SET_SPECIFIC_ZONE_TO_TRIGGER_GANG_WAR');
  const clear=blocks.find(i=>i.name==='CLEAR_SPECIFIC_ZONES_TO_TRIGGER_GANG_WAR');
  expect(training&&specific&&clear).toBeTruthy();
  const game=new ScmGameState();
  game.zones.load(zones.infoLabels);
  runOne(threadAt(bytes,training!.offset,game));
  expect(game.gangWarTrainingZone).toBe(zones.infoLabels.indexOf(training!.parameters[0].value as string));
  expect(game.gangWarTrainingZone).toBeGreaterThanOrEqual(0);
  runOne(threadAt(bytes,specific!.offset,game));
  expect(game.specificGangWarZones).toHaveLength(1);
  runOne(threadAt(bytes,clear!.offset,game));
  expect(game.specificGangWarZones).toHaveLength(0);
 });

 test('INIT_ZONE_POPULATION_SETTINGS puts every zone back to a fresh record',async()=>{
  const game=new ScmGameState(),labels=(await worldZones()).infoLabels,label=labels[0];
  game.zones.load(labels);
  game.zones.setPopulationType(label,7);
  game.zones.setGangStrength(label,2,60);
  game.zones.setDealerStrength(label,15);
  game.zones.setNoCops(label,true);
  expect(game.zones.dealerStrength(label)).toBe(15);
  expect(game.zones.gangStrength(label,2)).toBe(60);
  game.zones.initZonesPopulationSettings();
  expect(game.zones.dealerStrength(label)).toBe(0);
  expect(game.zones.gangStrength(label,2)).toBe(0);
  const gan=game.zones.at(game.zones.findZoneByLabel(label));
  expect(gan.popType).toBe(ZONE_POP_RESIDENTIAL_AVERAGE);
  expect(gan.noCops).toBe(false);
 });
});
