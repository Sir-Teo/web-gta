import {expect,test} from 'vitest';
import {AttractorQueue,attractorParams,attractorHeading} from '../src/simulation/nativeAttractors';
import {PED_ATTRACTOR} from '../src/assets/twoDEffect';

const stop={key:'k',type:PED_ATTRACTOR.stop,position:[10,20,3] as const,queueDir:[0,1,0] as const,useDir:[-1,0,0] as const,forwardDir:[-1,0,0] as const};

test('ATMs and bus stops queue five peds, seats one; slots step back along the queue direction with a jitter behind the head',()=>{
 expect(attractorParams(PED_ATTRACTOR.atm).maxPeds).toBe(5);expect(attractorParams(PED_ATTRACTOR.seat)).toEqual({maxPeds:1,spacing:1,arriveRange:0.125,deltaPos:0.1,deltaHeading:0.1});
 const q=new AttractorQueue(stop,()=>1);
 expect(q.slotPosition(0)).toEqual([10,20,3]);
 expect(q.slotPosition(2)).toEqual([10.1,18.1,3]);
 expect(q.slotHeading(0)).toBeCloseTo(attractorHeading([-1,0,0]));
 expect(q.slotHeading(1)).toBeCloseTo(attractorHeading([0,1,0])+0.1);
 // ComputeAttractHeading overwrote m_UseDir with the queue direction: from now on the head faces down the queue.
 expect(q.slotHeading(0)).toBeCloseTo(attractorHeading([0,1,0]));
});
test('peds register into successive slots until full and departures shuffle the rest up two seconds a slot',()=>{
 const q=new AttractorQueue(stop);
 expect([1,2,3,4,5].map(id=>q.register(id))).toEqual([0,1,2,3,4]);
 expect(q.register(6)).toBe(-1);expect(q.register(3)).toBe(-1);expect(q.hasEmptySlot).toBe(false);
 // BroadcastDeparture stands each 2 s for every place it had: ped 3 was at 2, so 4 s.
 expect(q.depart(2)).toEqual([{ped:3,slot:1,delaySeconds:4},{ped:4,slot:2,delaySeconds:6},{ped:5,slot:3,delaySeconds:8}]);
 expect(q.peds).toEqual([1,3,4,5]);expect(q.slotOf(4)).toBe(2);
 expect(q.depart(1)).toEqual([{ped:3,slot:0,delaySeconds:2},{ped:4,slot:1,delaySeconds:4},{ped:5,slot:2,delaySeconds:6}]);
 expect(q.depart(99)).toEqual([]);
 const seat=new AttractorQueue({...stop,type:PED_ATTRACTOR.seat});
 expect(seat.register(1)).toBe(0);expect(seat.register(2)).toBe(-1);
});
test('the browser heading of a native direction faces +z for native -y',()=>{
 expect(attractorHeading([0,-1,0])).toBeCloseTo(0);
 expect(attractorHeading([0,1,0])).toBeCloseTo(Math.PI);
 expect(attractorHeading([1,0,0])).toBeCloseTo(Math.PI/2);
});

test('a shelter takes five, all at the head of the queue and facing any way (CPedShelterAttractor)',()=>{
 let r=0;const q=new AttractorQueue({...stop,type:PED_ATTRACTOR.shelter},()=>(r=(r+.37)%1));
 expect([1,2,3,4,5,6].map(id=>q.register(id))).toEqual([0,1,2,3,4,-1]);
 expect([0,3].map(slot=>q.atHead(slot))).toEqual([true,true]);
 expect(q.params.arriveRange).toBe(.5);
 const headings=[q.slotHeading(0),q.slotHeading(2)];expect(headings[0]).not.toBeCloseTo(headings[1]);
 expect(new AttractorQueue(stop).atHead(1)).toBe(false);
});
