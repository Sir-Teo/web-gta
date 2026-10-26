import {expect,test} from 'vitest';
import reference from './fixtures/player-sprint-reference.json';
import {controlNativeSprint,handleNativeSprintEnergy,nativeButtonSprintResult,nativeSprintCapacity,type SprintMode} from '../src/simulation/nativePlayerSprint';
for(const [i,row] of reference.cases.entries())test(`captured native sprint controls ${i}`,()=>{
 const r=row.input,state={energy:r.energy,buttonSpeed:r.buttonSpeed};
 const factor=controlNativeSprint(state,r.mode as SprintMode,{held:r.held,justPressed:r.justPressed,moving:r.axisX!==0||r.axisY!==0,inVehicle:r.vehicle,neverTired:r.neverTired,adrenaline:r.adrenaline,sprintDisabled:r.disabled},r.timeStep);
 expect({factor,...state}).toEqual({factor:row.factor,energy:row.energy,buttonSpeed:row.buttonSpeed});
});
for(const row of reference.capacities)test(`captured native sprint capacity and reset for stamina ${row.stamina}`,()=>{
 expect(nativeSprintCapacity(row.stamina)).toBe(row.capacity);expect(nativeSprintCapacity(row.stamina)).toBe(row.reset);
});
for(const [i,row] of reference.energyCases.entries())test(`captured native sprint energy ${i}`,()=>{
 const r=row.input,state={energy:r.energy};expect(handleNativeSprintEnergy(state,r.sprint,r.multiplier,r.timeStep,r.capacity)).toBe(row.allowed);expect(state.energy).toBe(row.energy);
});
for(const [i,row] of reference.results.entries())test(`captured native sprint animation result ${i}`,()=>{
 expect(nativeButtonSprintResult(row.buttonSpeed,row.mode as SprintMode)).toBe(row.result);
});
