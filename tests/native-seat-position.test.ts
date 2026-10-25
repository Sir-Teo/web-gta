import {expect,test} from 'vitest';
import {nativeSeatPosition,nativeCarSeatPose} from '../src/vehicle/nativeSeatPosition';

// GetSeatPositionInVehicle (iOS 0x10032bd40): +0x5a0 driver, +0x5a8/+0x5b0/+0x5b8 passengers 0..2.
const front={x:.458,y:1.624,z:-.089},back={x:-.019,y:-4.291,z:.474};

test('an aircraft\'s pilot sits at the front seat mirrored left and its first passenger at the front seat beside him',()=>{
 expect(nativeSeatPosition({front},'driver')).toEqual({x:-.458,y:1.624,z:-.089});
 expect(nativeSeatPosition({front},0)).toEqual(front);
});

test('a boat\'s driver keeps the front seat as it is, and so does its first passenger',()=>{
 expect(nativeSeatPosition({front,boat:true},'driver')).toEqual(front);
 expect(nativeSeatPosition({front,back,boat:true},0)).toEqual(front);
});

test('the back seat, mirrored for passenger 1, and the origin where the model has none',()=>{
 expect(nativeSeatPosition({front,back,boat:true},1)).toEqual({x:.019,y:-4.291,z:.474});
 expect(nativeSeatPosition({front,back,boat:true},2)).toEqual(back);
 expect(nativeSeatPosition({front},2)).toEqual({x:0,y:0,z:0});
 expect(nativeSeatPosition({front,back,bike:true},0)).toEqual(back);
 expect(nativeSeatPosition({front,back},5)).toEqual(front);
});

test('SetPedPositionInCar turns van rear passengers across the vehicle, moving only the left seat forward',()=>{
 const left={x:-.8,y:-1.2,z:.4},right={x:.8,y:-1.2,z:.4};
 expect(nativeCarSeatPose(left,1,13)).toEqual({local:{x:-.8,y:-.6,z:.4},headingOffset:-Math.PI/2});
 expect(nativeCarSeatPose(right,2,13)).toEqual({local:right,headingOffset:Math.PI/2});
 expect(left).toEqual({x:-.8,y:-1.2,z:.4});
 for(const seat of ['driver',0,3] as const)expect(nativeCarSeatPose(front,seat,13)).toEqual({local:front,headingOffset:0});
 for(const group of [0,1,2,12,14])expect(nativeCarSeatPose(left,1,group)).toEqual({local:left,headingOffset:0});
});
