import {expect,test} from 'vitest';
import {maximumPassengersFromDoors} from '../src/simulation/nativeVehiclePassengers';
import {getATanOfXY} from '../src/simulation/ScmMission';

const car=(modelId:number,doors:number,extra:object={})=>({modelId,type:'car',doors,tandemSeats:false,rearSeat:false,...extra});
test('GetMaximumNumberOfPassengersFromNumberOfDoors',()=>{
 // A four-door saloon seats three passengers, a two-door one.
 expect(maximumPassengersFromDoors(car(400,4))).toBe(3);
 expect(maximumPassengersFromDoors(car(411,2))).toBe(1);
 // Firetruck and Journey count two doors, the Hunter one, whatever their frames; buses and coaches take eight.
 expect(maximumPassengersFromDoors(car(407,4))).toBe(1);
 expect(maximumPassengersFromDoors(car(425,0,{type:'heli'}))).toBe(0);
 expect(maximumPassengersFromDoors(car(431,2))).toBe(8);
 // Tandem seats: half the doors past two.
 expect(maximumPassengersFromDoors(car(1,4,{tandemSeats:true}))).toBe(1);
 expect(maximumPassengersFromDoors(car(1,2,{tandemSeats:true}))).toBe(0);
 // No doors: a bike or quad by its rear seat, the RC cars none, anything else one.
 expect(maximumPassengersFromDoors(car(522,0,{type:'bike',rearSeat:true}))).toBe(1);
 expect(maximumPassengersFromDoors(car(509,0,{type:'bmx'}))).toBe(0);
 expect(maximumPassengersFromDoors(car(441,0))).toBe(0);
 expect(maximumPassengersFromDoors(car(568,0))).toBe(1);
 // Boats and trailers never.
 expect(maximumPassengersFromDoors(car(430,2,{type:'boat'}))).toBe(0);
 expect(maximumPassengersFromDoors(car(435,0,{type:'trailer'}))).toBe(0);
});

test('CGeneral::GetATanOfXY runs from nought to a turn',()=>{
 expect(getATanOfXY(0,0)).toBe(0);
 expect(getATanOfXY(1,0)).toBe(0);
 expect(getATanOfXY(0,1)).toBeCloseTo(Math.PI/2,6);
 expect(getATanOfXY(0,-1)).toBeCloseTo(3*Math.PI/2,6);
});
