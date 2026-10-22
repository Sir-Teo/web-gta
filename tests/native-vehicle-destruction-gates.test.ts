import {expect,test,vi} from 'vitest';
import {Vector3} from 'three';
import fixture from './fixtures/native-vehicle-destruction-gates.json';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {WorldPlane} from '../src/simulation/WorldPlane';
import {NativeClumpAlpha} from '../src/simulation/nativeClumpAlpha';

function vehicle(name:string,extra:object={}){
 const target={health:300,canBeDamaged:true,bombTimerMs:1234,occupied:false,wrecked:false,motorbike:true,modelId:487,throttle:1,explosionByPlayer:false,pendingExplosion:false,body:{translation:()=>({x:400,y:0,z:0}),isEnabled:()=>false,setEnabled(){},linvel:()=>({x:0,y:0,z:0}),setLinvel(){}},sim:{worldFocus:{x:0,y:0,z:0},cameraExcludedBody:'before',playerCollider:{setEnabled:vi.fn()},vehicleOccupantDied:vi.fn()},scorch(){},...extra}as any;
 target.destroyed=(WorldPlane.prototype as any).destroyed;target.blowUp=name==='bike'?WorldBike.prototype.blowUp:WorldBoat.prototype.blowUp;return target;
}
function destroy(name:string,target:any){if(name==='plane'||name==='helicopter')return target.destroyed(true);return target.blowUp(true);}
for(const [index,row]of fixture.gates.entries())test(`captured destruction gate ${index}: ${row.vehicle} ${JSON.stringify(row.input)}`,()=>{
 const target=vehicle(row.vehicle,{health:row.input.health,canBeDamaged:row.input.canBeDamaged,occupied:row.input.status===2}),before={health:target.health,timer:target.bombTimerMs,occupied:target.occupied,throttle:target.throttle};destroy(row.vehicle,target);
 const entered=row.vehicle==='plane'||row.vehicle==='helicopter'?target.throttle===0:target.pendingExplosion;
 expect(entered).toBe(row.entered);
 if(!row.entered){expect({health:target.health,timer:target.bombTimerMs,occupied:target.occupied,throttle:target.throttle}).toEqual(before);expect(target.sim.vehicleOccupantDied).not.toHaveBeenCalled();expect(target.explosionByPlayer).toBe(false);}
});
for(const [index,row]of fixture.stores.entries())test(`captured destruction stores ${index}: ${row.vehicle}, health ${row.input.health}, timer ${row.input.timer}`,()=>{
 const target=vehicle(row.vehicle,{health:row.input.health,bombTimerMs:row.input.timer});destroy(row.vehicle,target);expect(target.health).toBe(row.health);expect(target.bombTimerMs).toBe(row.timer);
});
for(const [name,Vehicle]of [['bike',WorldBike],['boat',WorldBoat],['plane',WorldPlane]]as const)for(const protectedNow of[false,true])test(`${name}: a healed armed vehicle ${protectedNow?'refuses':'completes'} destruction at timer expiry`,()=>{
 const target=vehicle(name,{health:300,bombTimerMs:16,canBeDamaged:!protectedNow,bombDetonatedByPlayer:true,stepDt:1/50,frozen:false,root:{visible:true},clumpAlpha:new NativeClumpAlpha(()=>{}),collisionDamage(){},collisionKnockOff(){},impactVelocity:new Vector3(),burn:()=>false});
 let exploded:boolean;if(Vehicle===WorldPlane)exploded=WorldPlane.prototype.afterStep.call(target);else{(Vehicle.prototype.beforeStep as any).call(target,1/50);exploded=(Vehicle.prototype.afterStep as any).call(target);}
 expect(target.bombTimerMs).toBe(0);expect(exploded).toBe(!protectedNow);expect(target.health).toBe(protectedNow?300:0);expect(target.explosionByPlayer).toBe(!protectedNow);
});
