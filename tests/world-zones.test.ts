import {test,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {readZones,prepareWorldZones,worldZoneAt,worldLevelAt,type ZoneRecord} from '../src/assets/worldZones';
test('native zone corpus locates Grove, Meadows and San Fierro in one world',async()=>{
 const records=(await Promise.all(['map.zon','info.zon'].map(async name=>readZones(await readFile('public/play/world/files/zones/'+name,'utf8'),name)))).flat(),zones=prepareWorldZones(records);
 expect(records).toHaveLength(384);expect(zones.navigation).toHaveLength(379);expect(zones.map).toHaveLength(7);
 const points:[number,number,number][]=[[2495,-1687,13],[400,2500,30],[-2493,379,28]];
 const locations=points.map(p=>({label:worldZoneAt(zones,p).infoLabel,level:worldLevelAt(zones,p)}));console.log(locations);
 expect(locations[0]).toEqual({label:'GAN1',level:1});expect(locations[1]).toEqual({label:'MEAD',level:0});expect(locations[2]).toEqual({label:'WESTP2',level:2});
 expect(worldZoneAt(zones,[1e6,1e6,1e6]).infoLabel).toBe('SAN_AND');
});
const record=(label:string,min:[number,number,number],max:[number,number,number],type:0|1|3=0):ZoneRecord=>({infoLabel:label,textLabel:label,type,min,max,level:1,line:1,source:'test'});
test('zone selection uses truncated coordinates, width plus depth, altitude, inclusive edges and stable ties',()=>{
 const raw=[record('thin',[0,0,0],[1,100,100]),record('square',[0,0,0],[20,20,10]),record('TIE',[0,0,0],[20,20,10]),record('float',[30.9,40.9,0],[20.9,30.9,10])],zones=prepareWorldZones(raw);
 expect(worldZoneAt(zones,[.5,10,5]).infoLabel).toBe('SQUARE'); // THIN has smaller area but larger width+depth.
 expect(worldZoneAt(zones,[.5,10,11]).infoLabel).toBe('THIN');
 expect(worldZoneAt(zones,[20,20,10]).infoLabel).toBe('SQUARE');
 expect(zones.navigation[4]).toMatchObject({min:[20,30,0],max:[30,40,10],infoLabel:'FLOAT'});expect(raw[3].min[0]).toBe(30.9);
 const shared=prepareWorldZones([record('same',[0,0,0],[10,10,10]),record('SAME',[20,20,0],[30,30,10])]);expect(shared.navigation[1].zoneInfoIndex).toBe(shared.navigation[2].zoneInfoIndex);
 expect(()=>worldZoneAt(zones,[NaN,0,0])).toThrow('point');
});
test('map level uses first matching source region, while malformed records are rejected',()=>{
 const zones=prepareWorldZones([record('map1',[0,0,0],[100,100,100],3),{...record('map2',[0,0,0],[10,10,10],3),level:2}]);expect(worldLevelAt(zones,[5,5,5])).toBe(1);expect(worldLevelAt(zones,[-5,5,5])).toBe(0);
 for(const text of ['zone\nBAD,2,0,0,0,1,1,1,0,BAD\nend','zone\nBAD,0,0,0,0,32768,1,1,0,BAD\nend','zone\nend\nstray'])expect(()=>readZones(text,'test')).toThrow();
 expect(()=>readZones('zone','test')).toThrow('Unterminated');
});
