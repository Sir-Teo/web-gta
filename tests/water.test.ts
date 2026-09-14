import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readWater,waterGeometry} from '../src/assets/water';
const vertex=(x:number,y:number,z=3)=>`${x} ${y} ${z} .25 -.5 .199 .241`;
test('water retains source elevations, flow, waves, flags and triangle/quad ordering',()=>{
 const water=readWater(`processed\n${vertex(0,0)} ${vertex(8,0)} ${vertex(0,8,5)} ${vertex(8,8,5)} 3\n${vertex(10,0)} ${vertex(18,0)} ${vertex(10,8)}\n`);
 expect(water.processed).toBe(true);expect(water.polygons.map(p=>p.flags)).toEqual([3,0]);
 expect(water.polygons[0].vertices[2]).toEqual({position:[0,8,5],flow:[.25,-.5],bigWaves:.199,smallWaves:.241});
 const mesh=waterGeometry(water.polygons);expect([...mesh.indices]).toEqual([0,1,2,2,1,3,4,5,6]);expect([...mesh.positions.slice(6,9)]).toEqual([0,5,-8]);
});
test('invalid water rows fail instead of silently losing coastline geometry',()=>{
 for(const text of ['', 'processed', '0 0 0', `${vertex(0,0)} ${vertex(1,0)} ${vertex(0,1)} -1`,`${vertex(0,0)} ${vertex(1,0)} ${vertex(0,1)} NaN`])expect(()=>readWater(text)).toThrow();
});
test.runIf(!!process.env.GTA_CONTENT_DIR)('public water data decodes into bounded complete geometry',()=>{
 const water=readWater(readFileSync(`${process.env.GTA_CONTENT_DIR}/water.dat`,'utf8')),geometry=waterGeometry(water.polygons);
 expect(water.polygons.length).toBeGreaterThan(250);expect(geometry.positions.every(Number.isFinite)).toBe(true);
 expect(Math.max(...geometry.indices)).toBe(geometry.positions.length/3-1);
 expect(water.polygons.some(p=>p.vertices.some(v=>v.position[2]>100))).toBe(true);
});
