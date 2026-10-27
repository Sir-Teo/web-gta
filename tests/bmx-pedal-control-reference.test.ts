import {expect,test} from 'vitest';
import reference from './fixtures/bmx-pedal-control-reference.json';
import {stepBmxPedalControl} from '../src/simulation/nativeBmxPedalControl';
for(const [index,row] of reference.cases.entries())test(`native BMX player pedal/control/energy decision ${index}`,()=>{
 const i=row.input,state={energy:i.energy,buttonSpeed:i.buttonSpeed,steer:i.steer,gas:i.gas,brake:i.brake,boost:i.boost,coefficient:i.coefficient};
 const boost=stepBmxPedalControl(state,{accelerate:i.accelerate,acceleratePressed:i.acceleratePressed,held:i.held,justPressed:i.justPressed,fastBlend:i.fastBlend??undefined,capacity:450,neverTired:i.neverTired,adrenaline:i.adrenaline,sprintDisabled:i.disabled},i.ts);
 expect(state).toEqual({energy:row.energy,buttonSpeed:row.buttonSpeed,steer:row.steer,gas:row.gas,brake:row.brake,boost:row.boost,coefficient:row.coefficient});expect(boost).toBe(row.cycling[0].boost);
});
