import {expect,test} from 'vitest';
import {CarEntry} from '../src/simulation/CarEntry';

// The driver leaves through the passenger's door only when nobody sits in the front passenger seat.
test('the passenger door is no way out past a recruit in the front seat',()=>{
  const car={},free=(passengers:{seat:number}[])=>(CarEntry.prototype as any).rightDoorFree.call({car,passengers},car);
  expect(free([])).toBe(true);
  expect(free([{seat:2}])).toBe(true);
  expect(free([{seat:1}])).toBe(false);
});
