import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

test('boarding and rebuilding a follower preserves independent protection state and rejects a live bullet afterward',async()=>{
 const proofs={bullet:true,fire:false,explosion:true,collision:false,melee:false},ped={id:7,modelRef:'FAM1',health:75,armour:35,weapon:undefined,defendMult:2,pedType:'GANG2',gang:1,follow:true,followSlot:2,proofs,onlyDamagedByPlayer:true,bulletProofVest:true,flags:{canBeShotInVehicle:true}};
 const restored:any={id:8,health:100,defendMult:1,collider:{handle:12},flags:{},view:{installReactions:vi.fn()}};
 const host:any=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],nextId:9,disposed:false,remove:vi.fn(),nearestNode:()=>({}),
  catalog:{character:async()=>({}),characterSpeeds:async()=>({walk:1,run:2,sprint:3}),characterStats:async()=>({attack:1,defend:1}),gangClips:{}},
  createPed(){this.people.push(restored);return restored;},setFlag(p:any,key:string,value:boolean){p.flags[key]=value;}});
 const rider=host.boardPassenger(7);expect(host.people).toEqual([]);expect(host.remove).toHaveBeenCalledOnce();
 expect(rider.keep).toMatchObject({health:75,armour:35,proofs,onlyDamagedByPlayer:true,bulletProofVest:true,canBeShotInVehicle:true});expect(rider.keep.proofs).not.toBe(proofs);
 proofs.bullet=false;
 expect(await host.spawnPassenger(rider.modelRef,{x:0,y:0,z:0},0,rider.follow,rider.keep)).toBe(true);
 expect(restored).toMatchObject({id:7,health:75,armour:35,follow:true,followSlot:2,proofs:{bullet:true,explosion:true},onlyDamagedByPlayer:true,bulletProofVest:true,flags:{canBeShotInVehicle:true}});
 expect(restored.proofs).not.toBe(rider.keep.proofs);
 expect(host.npcBulletHit(12,1000,38,{x:0,z:1},{x:0,y:1,z:0},9)).toBe(false);expect(restored.health).toBe(75);expect(restored.armour).toBe(35);
});
