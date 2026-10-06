import {test,expect} from 'vitest';
import {readWater} from '../src/assets/water';
import {DetailedWaterBuilder,calculateWavesOnlyForCoordinate,waterCameraRange,waterSurface,waterWavePhases} from '../src/world/waterWaves';
const vertex=(x:number,y:number,big:number,small:number,z=0)=>`${x} ${y} ${z} 0 0 ${big} ${small}`;
test('CalculateWavesOnlyForCoordinate sums the three native sines over |x|,|y|',()=>{
 // faWaveMultipliersX/Y (iOS 0x100596730, 0x100596750) by (|x| >> 1) & 7 and (|y| >> 1) & 7.
 const MX=[1,.85,.73,.77,.75,.8,.73,.8].map(Math.fround),MY=[.75,.9,.95,.82,.7,.75,.9,1].map(Math.fround);
 const mult=(ax:number,ay:number)=>MX[(ax>>1)&7]*MY[(ay>>1)&7];
 // t=0: phases are purely spatial. Big wave at x=16,y=0: sin(2π·16/64)=1, amplitude 2·big, times X[0]·Y[0].
 expect(calculateWavesOnlyForCoordinate(16,0,1,0,0)).toBeCloseTo(2*mult(16,0),6);
 // Small waves at x=0,y=5: sin(2π·5/52)+.5·sin(2π·5/20), times X[0]·Y[2].
 expect(calculateWavesOnlyForCoordinate(0,5,0,1,0)).toBeCloseTo((Math.sin(2*Math.PI*5/52)+.5)*mult(0,5),6);
 const reference=(x:number,y:number,big:number,small:number,t:number)=>{const ax=Math.abs(Math.trunc(x)),ay=Math.abs(Math.trunc(y));
  return (Math.sin(t%5000*2*Math.PI/5000+2*Math.PI*(ax/64+ay/64))*2*big+Math.sin(t%3500*2*Math.PI/3500+2*Math.PI*(ax/26+ay/52))*small+Math.sin(t%3000*2*Math.PI/3000+2*Math.PI*ay/20)*.5*small)*mult(ax,ay);};
 for(const [x,y,t] of [[400,-2000,12345],[-2830.7,1296.2,99999],[3,7,4999]])expect(calculateWavesOnlyForCoordinate(x,y,.199,.241,t)).toBeCloseTo(reference(x,y,.199,.241,t),6);
 // abs() mirrors the field; CWeather::Wavyness scales it; zero amplitudes are calm.
 expect(calculateWavesOnlyForCoordinate(-37,-81,.5,.3,777)).toBeCloseTo(calculateWavesOnlyForCoordinate(37,81,.5,.3,777),9);
 expect(calculateWavesOnlyForCoordinate(37,81,.5,.3,777,0,.3)).toBeCloseTo(.3*calculateWavesOnlyForCoordinate(37,81,.5,.3,777),9);
 expect(calculateWavesOnlyForCoordinate(37,81,0,0,777)).toBe(0);
 // The time part repeats with each period (LCM 105 s) and SyncWater's offset restarts it.
 expect(calculateWavesOnlyForCoordinate(37,81,.5,.3,777+105000)).toBeCloseTo(calculateWavesOnlyForCoordinate(37,81,.5,.3,777),9);
 expect(calculateWavesOnlyForCoordinate(37,81,.5,.3,50777,50000)).toBeCloseTo(calculateWavesOnlyForCoordinate(37,81,.5,.3,777),9);
 // uint32 subtraction: a time before the offset wraps like GetTimeInMS() - m_nWaterTimeOffset.
 expect(waterWavePhases(0,1)[0]).toBeCloseTo((0xffffffff%5000)*2*Math.PI/5000,9);
});
test('SetCameraRange spans ±48 rounded out to even units',()=>{
 expect(waterCameraRange(400.5,-2000.3)).toEqual({minX:352,maxX:450,minY:-2050,maxY:-1952});
 expect(waterCameraRange(100,100)).toEqual({minX:52,maxX:148,minY:52,maxY:148});
});
test('quads interpolate CRenPar bilinearly across the detailed grid',()=>{
 const [polygon]=readWater(`${vertex(0,0,0,0,1)} ${vertex(200,0,1,.4,1)} ${vertex(0,200,0,0,3)} ${vertex(200,200,1,.4,3)} 1`).polygons,surface=waterSurface(polygon)!,out=[0,0,0];
 surface.sample(50,100,out);expect(out.map(v=>+v.toFixed(6))).toEqual([2,.25,.1]);
 const b=new DetailedWaterBuilder().build([surface],waterCameraRange(100,100));
 // 96 units → 48 cells a side: 49² shared vertices on the 2-unit grid.
 expect(b.vertexCount).toBe(49*49);expect(b.indexCount).toBe(48*48*6);
 for(let v=0;v<b.vertexCount;v++){
  const x=b.positions[v*3],y=-b.positions[v*3+2];expect(x%2).toBe(0);expect(y%2).toBe(0);expect(x).toBeGreaterThanOrEqual(52);expect(x).toBeLessThanOrEqual(148);
  expect(b.waves[v*2]).toBeCloseTo(x/200,5);expect(b.waves[v*2+1]).toBeCloseTo(.4*x/200,5);expect(b.positions[v*3+1]).toBeCloseTo(1+2*y/200,5);
 }
 // Polygons outside the range are left to the flat surface; a partial overlap is clipped to the range.
 expect(new DetailedWaterBuilder().build([surface],waterCameraRange(400,400)).vertexCount).toBe(0);
 const edge=new DetailedWaterBuilder().build([surface],waterCameraRange(190,10));let maxX=-Infinity,minY=Infinity;
 for(let v=0;v<edge.vertexCount;v++){maxX=Math.max(maxX,edge.positions[v*3]);minY=Math.min(minY,-edge.positions[v*3+2]);}
 expect([maxX,minY]).toEqual([200,0]);
});
test('triangles subdivide exactly along their hypotenuse with planar wave amplitudes',()=>{
 const [polygon]=readWater(`${vertex(0,0,0,0)} ${vertex(20,0,1,0)} ${vertex(0,20,0,1)} 1`).polygons,surface=waterSurface(polygon)!;
 const b=new DetailedWaterBuilder().build([surface],waterCameraRange(10,10));let area=0;
 for(let i=0;i<b.indexCount;i+=3){
  const p=[0,1,2].map(k=>b.indices[i+k]).map(v=>[b.positions[v*3],-b.positions[v*3+2]]);
  area+=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]))/2;
 }
 expect(area).toBeCloseTo(200,6);
 for(let v=0;v<b.vertexCount;v++){const x=b.positions[v*3],y=-b.positions[v*3+2];expect(x+y).toBeLessThanOrEqual(20+1e-9);expect(b.waves[v*2]).toBeCloseTo(x/20,6);expect(b.waves[v*2+1]).toBeCloseTo(y/20,6);}
});
test('builder buffers grow and are reused',()=>{
 const [polygon]=readWater(`${vertex(-3000,-3000,1,1)} ${vertex(3000,-3000,1,1)} ${vertex(-3000,3000,1,1)} ${vertex(3000,3000,1,1)} 1`).polygons,surface=waterSurface(polygon)!,b=new DetailedWaterBuilder();
 b.build([surface],waterCameraRange(0,0));expect(b.grown).toBe(true);expect(b.positions.length).toBeGreaterThanOrEqual(b.vertexCount*3);
 b.build([surface],waterCameraRange(2,2));expect(b.grown).toBe(false);expect(b.vertexCount).toBe(49*49);
});

import {WaterLevelIndex,gameplayWaveAt} from '../src/world/waterLevel';
const waterVertex=(x:number,y:number,z=1,big=.8,small=.4)=>({position:[x,y,z] as [number,number,number],flow:[0,0] as [number,number],bigWaves:big,smallWaves:small});
const poly=(vertices:ReturnType<typeof waterVertex>[],flags=0)=>({vertices,flags,line:0}) as never;
test('GetWaterLevel adds AddWaveToResult: the 2-unit cell triangle\'s corners through the sin table; NoWaves stays flat',()=>{
 const index=new WaterLevelIndex([poly([waterVertex(-100,-100),waterVertex(100,-100),waterVertex(-100,100),waterVertex(100,100)])]);
 expect(index.level(3.3,5.1)).toBe(1);
 Object.assign(index.waves,{timeMs:12345,waterTimeOffset:0,wavyness:.7});
 expect(index.levelNoWaves(3.3,5.1)).toBe(1);
 const w=(x:number,y:number)=>gameplayWaveAt(x,y,Math.fround(.8),Math.fround(.4),12345,0,.7);
 expect(index.level(4,6)).toBeCloseTo(1+w(4,6),6);
 // Inside a cell: the lower-left triangle of (2,4)-(4,6) mixes its three corners.
 expect(index.level(2.5,4.5)).toBeCloseTo(1+w(2,4)+.25*(w(4,4)-w(2,4))+.25*(w(2,6)-w(2,4)),6);
 expect(index.level(3.5,5.5)).toBeCloseTo(1+w(4,6)+.25*(w(2,6)-w(4,6))+.25*(w(4,4)-w(4,6)),6);
 expect(index.level(500,500)).toBeUndefined();
 // The table's sine is within a step of the true one: the swell differs from Math.sin's by little.
 expect(Math.abs(w(4,6)-calculateWavesOnlyForCoordinate(4,6,.8,.4,12345,0,.7))).toBeLessThan(.06);
});

test('GetWaterLevelNoWaves takes the first polygon that passes, quads before triangles, and the z window',()=>{
 // A limited-depth pool at 50 above the sea at 0, listed first.
 const pool=poly([waterVertex(0,0,50,0,0),waterVertex(20,0,50,0,0),waterVertex(0,20,50,0,0),waterVertex(20,20,50,0,0)],2);
 const sea=poly([waterVertex(-200,-200,0,0,0),waterVertex(200,-200,0,0,0),waterVertex(-200,200,0,0,0),waterVertex(200,200,0,0,0)]);
 const index=new WaterLevelIndex([pool,sea]);
 // First listed wins, not the highest; without a z there is no window.
 expect(index.level(10,10)).toBe(50);expect(new WaterLevelIndex([sea,pool]).level(10,10)).toBe(0);
 // Under the limited-depth pool by more than 6, its water is not there: the sea below it is.
 expect(index.level(10,10,49)).toBe(50);expect(index.level(10,10,10)).toBe(0);expect(index.level(10,10,43)).toBeUndefined();
 // Water more than 20 under the point does not count.
 expect(index.level(50,50,21)).toBeUndefined();expect(index.level(50,50,19)).toBe(0);
 // Not touching the water: a surface more than 3 over the point is none.
 expect(index.level(50,50,-4,false)).toBeUndefined();expect(index.level(50,50,-4)).toBe(0);
 // An outside NoWaves caller skips a quad's window (the executable's quirk).
 expect(index.levelNoWaves(10,10,0)).toBe(50);
 // Beyond ±3000: open sea at 0.
 expect(index.level(3100,0)).toBe(0);
});

test('a quad is two planes split along (maxX,minY)–(minX,maxY), not bilinear',()=>{
 const index=new WaterLevelIndex([poly([waterVertex(0,0,0,0,0),waterVertex(10,0,0,0,0),waterVertex(0,10,0,0,0),waterVertex(10,10,10,0,0)])]);
 // Bilinear would give 2.5 at the centre; the planes give 0 there (u + t = 1 is the lower triangle) and z of v3's plane beyond.
 expect(index.level(5,5)).toBe(0);
 expect(index.level(7.5,7.5)).toBeCloseTo(5,6);
});
