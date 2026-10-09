import {expect,test} from 'vitest';
import {WorldBoat} from '../src/simulation/WorldBoat';

// GetSeatPositionInVehicle (iOS 0x10032bdd0) leaves a boat's ped_frontseat unmirrored: the Squalo's driver stands at
// the wheel on the right, the Jetmax's on the left, the Dinghy's on the centre line.
const seat=(x:number,y:number,z:number)=>{
 const boat:any=Object.create(WorldBoat.prototype);
 const matrix=new Array(16).fill(0);matrix[12]=x;matrix[13]=y;matrix[14]=z;
 boat.assets={model:{frames:[{name:'chassis',matrix:new Array(16).fill(0)},{name:'ped_frontseat',matrix}]}};
 return boat.seat();
};

test('a boat driver stands at the model\'s own front seat, on whichever side it is',()=>{
 expect(seat(.688,.246,1.066)).toEqual({x:.688,y:.246,z:1.066});
 expect(seat(-.672,.598,.903)).toEqual({x:-.672,y:.598,z:.903});
 expect(seat(0,.585,.89)).toEqual({x:0,y:.585,z:.89});
});
