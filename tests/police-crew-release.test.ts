import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// CPed::CanBeDeleted holds back only a ped in a vehicle, in the player's group or the script's: once the police drop a
// unit (its car stolen or culled), its officers on foot are ordinary peds the population manager may remove.
test('a dropped police unit releases its crew on foot',()=>{
  const unit={},other={},mine={crew:{unit,seat:0}} as any,theirs={crew:{unit:other,seat:1}} as any;
  (WorldPedestrians.prototype as any).releaseCrew.call({people:[mine,theirs]},unit);
  expect(mine.crew).toBeUndefined();
  expect(theirs.crew?.unit).toBe(other);
});
