import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CarEntry} from '../src/simulation/CarEntry';
import {VehicleAnimationLibrary} from '../src/assets/vehicleAnimations';
import {pedEnteredVehicleLeaveDelay} from '../src/simulation/nativePedEnteredVehicle';

beforeAll(async()=>{await RAPIER.init();});

// ComputePedEnteredVehicleResponse (iOS 0x10029f874): a passenger left aboard waits (rand() & 0xffff) / 65536 × 300
// + 300 ms before his leave task, sitting on with the door shut.
test('an NPC get-out with a wait starts only once the wait has run',()=>{
 expect([pedEnteredVehicleLeaveDelay(0),pedEnteredVehicleLeaveDelay(0xffff)]).toEqual([.3,.599]);
 const entry=new CarEntry(new Simulation(),new VehicleAnimationLibrary('wait-test:')) as any;
 const npc={car:{disposed:false},clip:{clip:{duration:1}},time:0,kind:'getOut',done:false,seat:1,wait:.35};
 entry.npcs.push(npc);let steps=0;entry.stepOneNpc=()=>{steps++;};
 for(let i=0;i<4;i++)entry.stepNpc(.1);
 expect(steps).toBe(0);
 entry.stepNpc(.1);expect(steps).toBe(1);
 // No wait: the clip steps at once, as a dragged-out or evicted ped's does.
 entry.npcs.length=0;entry.npcs.push({...npc,wait:0});entry.stepNpc(.1);expect(steps).toBe(2);
});
