import {expect,test} from 'vitest';
import {sweepLiteralDestination,sweepEntranceForDestination} from './browser/missionSweepTargets';
const instruction=(name:string,coordinates:number[])=>({name,parameters:[{type:2,value:12},...coordinates.map(value=>({type:6,value})),{type:4,value:0}]});

test('sweep boxes use the correct two/three-dimensional corner layout',()=>{
 expect(sweepLiteralDestination(instruction('IS_CHAR_IN_AREA_2D',[10,20,30,40]))).toEqual({x:20,y:30});
 expect(sweepLiteralDestination(instruction('IS_CHAR_IN_AREA_3D',[10,20,800,30,40,900]))).toEqual({x:20,y:30,z:850});
 expect(sweepLiteralDestination(instruction('LOCATE_CHAR_ANY_MEANS_3D',[-2661,1415,921,20,20,20]))).toEqual({x:-2661,y:1415,z:921});
 expect(sweepLiteralDestination(instruction('LOCATE_STOPPED_CHAR_ON_FOOT_2D',[10,20,2,2]))).toEqual({x:10,y:20});
});

test('a variable position does not turn literal locate radii into a destination',()=>{
 const i=instruction('LOCATE_CHAR_ANY_MEANS_3D',[10,20,30,2,2,2]);i.parameters[3]={type:3,value:40};expect(sweepLiteralDestination(i)).toBeUndefined();
});

const roof={area:0,rect:[-2663.35,1422.39,-2659.35,1426.39],entranceZ:24.0043,flags:1<<14,link:{area:3,exit:[-2661.01,1415.74,923.306]}};
const front={area:0,rect:[-2627,1412,-2624,1413],entranceZ:7.13148,flags:1<<14,link:{area:3,exit:[-2637.45,1404.63,906.458]}};
test('SYND4’s high interior destination routes through the nearest enabled PDOMES entrance',()=>{
 expect(sweepEntranceForDestination({x:-2661.01,y:1415.38,z:921.195},0,[front,roof])).toEqual({x:-2661.35,y:1424.39,z:24.0043});
 expect(sweepEntranceForDestination({x:-2661.01,y:1415.38,z:921.195},0,[{...roof,flags:0}])).toBeUndefined();
});

test('ordinary outside points, current-area targets and two-dimensional checks do not trigger an interior warp',()=>{
 expect(sweepEntranceForDestination({x:-2661,y:1415,z:23},0,[roof])).toBeUndefined();
 expect(sweepEntranceForDestination({x:-2661,y:1415,z:921},3,[roof])).toBeUndefined();
 expect(sweepEntranceForDestination({x:-2661,y:1415},0,[roof])).toBeUndefined();
});
