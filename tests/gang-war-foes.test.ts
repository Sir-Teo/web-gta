import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// CGangWars::TellGangMembersTo(false) gives the gangsters in the pool at that moment a kill task at the player, once;
// a gangster made later, or a war lost or abandoned, turns nobody else hostile.
test('a gang war turns only the gangsters there at its start on the player',()=>{
  const ballas={gang:0,retaliate:0} as any,grove={gang:1,retaliate:0} as any,civilian={retaliate:0} as any;
  const self={people:[ballas,grove,civilian],clearStreets:true} as any;
  (WorldPedestrians.prototype as any).tellGangMembersTo.call(self,false);
  expect(ballas.warFoe).toBe(true);expect(grove.warFoe).toBeUndefined();expect(civilian.warFoe).toBeUndefined();
  const later={gang:2,retaliate:0} as any;self.people.push(later);
  expect(later.warFoe).toBeUndefined();
  (WorldPedestrians.prototype as any).tellGangMembersTo.call(self,true);
  expect(ballas.warFoe).toBe(false);expect(self.clearStreets).toBe(false);
});
