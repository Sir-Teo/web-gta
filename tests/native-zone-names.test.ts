import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {findZone,prepareWorldZones,readZones} from '../src/assets/worldZones';
import {ZONE_TEXT,zoneText} from '../src/ui/nativeZoneText';
import {NativePlaceName} from '../src/ui/nativePlaceName';

const zones=prepareWorldZones(readZones(readFileSync('public/play/world/files/zones/info.zon','utf8'),'info.zon'));
describe('zone names',()=>{
 it('has GXT text for every text label in the shipped info.zon',()=>{
  const missing=[...new Set(zones.navigation.map(z=>z.textLabel))].filter(label=>!ZONE_TEXT[label]);
  expect(missing).toEqual([]);
 });
 it('names Grove Street Ganton, the Downtown towers Downtown Los Santos and the open sea south of Los Santos San Andreas',()=>{
  const place=new NativePlaceName();
  // Grove Street, where the game starts (native axes: x east, y north, z up).
  expect(place.process(zones,[2495,-1687,13],false)).toBe('Ganton');
  expect(place.process(zones,[1545,-1350,30],false)).toBe('Downtown Los Santos');
  expect(place.process(zones,[2900,-2900,0],false)).toBe('San Andreas');
  // Inside an interior the last outside place stands.
  expect(place.process(zones,[0,0,1000],true)).toBe('San Andreas');
 });
 it('keeps a label TheText has no entry for',()=>{expect(zoneText('NOPE')).toBe('NOPE');});
 it('finds a zone by its text label in every part it is split into, and by its own name for the info type',()=>{
  const parts=zones.navigation.filter(z=>z.textLabel==='OCEAF'&&z.infoLabel!=='OCEAF');
  expect(parts.length).toBeGreaterThan(1);
  for(const part of parts){
   const centre=part.min.map((v,i)=>(v+part.max[i])/2) as [number,number,number];
   expect(findZone(zones,centre,'oceaf','navi')).toBe(true);
   expect(findZone(zones,centre,part.infoLabel,'info')).toBe(true);
   expect(findZone(zones,centre,'OCEAF','info')).toBe(zones.navigation.some(z=>z.infoLabel==='OCEAF'&&centre.every((v,i)=>v>=z.min[i]&&v<=z.max[i])));
  }
  // Grove Street is Ganton by its text label, and nowhere near the sea.
  expect(findZone(zones,[2495,-1687,13],'GAN','navi')).toBe(true);
  expect(findZone(zones,[2495,-1687,13],'OCEAF','navi')).toBe(false);
 });
});
