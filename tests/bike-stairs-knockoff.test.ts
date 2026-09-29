import {afterEach,expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';
import {readCullZoneLine} from '../src/assets/ipl';
import {NativeCullZones,ZONE} from '../src/world/nativeCullZones';

// CBike::DamageKnockOffRider zeroes the force for the player while CCullZones::CamStairsForPlayer and
// FindZoneWithStairsAttributeForPlayer both hold, so a crash on stairs never throws him.
afterEach(()=>{WorldBike.playerOnStairs=undefined;});
const crash=()=>{
 let knocked=0;
 const self=Object.assign(Object.create(WorldBike.prototype),{stepVelocity:{x:0,y:0,z:-30},occupied:true,wrecked:false,modelId:461,health:1000,
  body:{isEnabled:()=>true,linvel:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})},assets:{handling:{values:{mass:500,collisionDamageMultiplier:1}},vehicle:{type:'bike'}},
  knockOff(){knocked++;}});
 (WorldBike.prototype as any).collisionKnockOff.call(self);
 return knocked;
};
test('the head-on crash throws the rider off the stairs zone and not on it',()=>{
 expect(crash()).toBe(1);
 WorldBike.playerOnStairs=()=>true;expect(crash()).toBe(0);
});
test('the zone test wants the player flags and a stairs zone holding the point now',()=>{
 const zones=new NativeCullZones();zones.load([readCullZoneLine('0, 0, 0, 10, 0, -5, 0, 10, 20, 2, 0')!]);
 expect(zones.attributeZones[0].flags).toBe(ZONE.stairs);
 expect(zones.playerOnStairs([3,3,1])).toBe(false);
 zones.player=ZONE.stairs;expect(zones.playerOnStairs([3,3,1])).toBe(true);expect(zones.playerOnStairs([30,3,1])).toBe(false);
});
// CAutomobile::VehicleDamage for the quad returns as soon as CBike::DamageKnockOffRider throws the rider, before the
// health loss; a crash that keeps him on comes out of the quad's health.
const quadCrash=(dz:number)=>{
 let knocked=0;
 const self=Object.assign(Object.create(WorldBike.prototype),{stepVelocity:{x:0,y:0,z:dz},occupied:true,wrecked:false,modelId:471,health:1000,lastCollisionSeconds:Infinity,
  body:{isEnabled:()=>true,linvel:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})},assets:{handling:{values:{mass:400,collisionDamageMultiplier:1}},vehicle:{type:'quad'}},
  knockOff(){knocked++;}});
 (WorldBike.prototype as any).collisionKnockOff.call(self);
 return {knocked,health:self.health,since:self.lastCollisionSeconds};
};
test('a quad crash that throws the rider costs the quad no health; one that keeps him on does',()=>{
 const thrown=quadCrash(-30);expect(thrown.knocked).toBe(1);expect(thrown.health).toBe(1000);expect(thrown.since).toBe(0);
 const kept=quadCrash(-1.2);expect(kept.knocked).toBe(0);expect(kept.health).toBeLessThan(1000);
});
