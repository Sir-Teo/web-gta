import {expect,test} from 'vitest';
import {NearestWater} from '../src/world/nearestWater';
import type {WaterPolygon} from '../src/assets/water';

/** A water.dat quad (or triangle) of corners at height z with the given waves. */
function polygon(corners:[number,number][],z=0,waves:[number,number]=[1,1]):WaterPolygon{
 return {vertices:corners.map(([x,y])=>({position:[x,y,z],flow:[0,0],bigWaves:waves[0],smallWaves:waves[1]})),flags:1,line:0};
}
const square=(x0:number,y0:number,x1:number,y1:number,z=0,waves:[number,number]=[1,1])=>polygon([[x1,y1],[x0,y0],[x1,y0],[x0,y1]],z,waves);

test('the camera is as far from the nearest quad with waves as from its rectangle, at its first corner’s height',()=>{
 const w=new NearestWater([square(0,0,100,100,2),square(300,0,400,100,7)]);
 expect(w.find(50,50)).toEqual({distance:0,height:2});
 expect(w.find(130,50)).toEqual({distance:30,height:2});
 expect(w.find(240,140)).toEqual({distance:Math.fround(Math.hypot(60,40)),height:7});
});

test('a pool without waves, and a triangle, are not the sea; with none it is 1e7 away',()=>{
 const w=new NearestWater([square(0,0,10,10,20,[0,0]),polygon([[100,0],[200,0],[100,100]],0)]);
 expect(w.find(5,5)).toEqual({distance:1e7,height:0});
});

test('a corner past ±2999 is the open sea’s, waves and all, and a corner already added keeps its settings',()=>{
 // The calm quad's far corners are moved to 3000 with big waves, so it counts.
 const edge=new NearestWater([square(2900,0,3100,100,5,[0,0])]);
 expect(edge.find(2950,50).distance).toBe(0);
 // The second quad's corners at the first's places and height are the first's calm ones.
 const shared=new NearestWater([square(0,0,10,10,0,[0,0]),square(0,0,10,10,0,[1,1])]);
 expect(shared.find(5,5).distance).toBe(1e7);
});

test('off the map the camera is on the open sea',()=>{
 const w=new NearestWater([square(0,0,10,10)]);
 expect(w.find(3000,0)).toEqual({distance:0,height:0});
 expect(w.find(0,-3000)).toEqual({distance:0,height:0});
});
