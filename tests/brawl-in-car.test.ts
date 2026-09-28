import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// A ped's fists land only on the player's collision, which is off while he sits in a car, boat or aircraft.
test('the player seated in a car is out of a brawler\'s reach',()=>{
  const onFoot=(collider:boolean,bike?:boolean)=>(WorldPedestrians.prototype as any).playerOnFoot.call({sim:{playerCollider:{isEnabled:()=>collider},playerBody:{isEnabled:()=>true}},playerRide:()=>bike===undefined?undefined:{bike}});
  expect(onFoot(true)).toBe(true);
  expect(onFoot(false,false)).toBe(false);
  // A bike's rider is still exposed.
  expect(onFoot(false,true)).toBe(true);
});
