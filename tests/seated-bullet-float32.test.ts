import {expect,test,vi} from 'vitest';
import {scriptRiderShot} from '../src/vehicle/scriptRiderShot';
import {CarEntry} from '../src/simulation/CarEntry';
import type {PhysicalProofs} from '../src/combat/nativePhysicalProofs';

function fixture(role:string,health:number,armour:number){
 const killed=vi.fn(),state={health,armour,defendMult:1.1,invulnerable:false,proofs:undefined as PhysicalProofs|undefined};
 if(role==='script')return {state:()=>state,kill:killed,hit:(friendly=false,force=false)=>scriptRiderShot(state,25,22,friendly,killed,{friendlyFire:friendly,forceDeath:force})};
 const car={disposed:false,wrecked:false,modelFlags:0,maximumPassengers:3,animGroup:{},assets:{handling:{values:{seatOffset:.3}}},car:{body:{handle:10,translation:()=>({x:0,y:2,z:0}),linvel:()=>({x:0,y:0,z:5})},nativeFramePosition:(name:string)=>({x:.5,y:name==='ped_backseat'?-1:1,z:.2})},seat:()=>({x:.5,y:1,z:.2}),worldPoint:(p:any)=>({x:p.x,y:p.z,z:-p.y}),heading:()=>0,canStepOut:()=>false,speed2D:()=>0};
 const entry=new CarEntry({world:{castRay:()=>null},playerCollider:{}} as any,{slot:()=>undefined} as any),rider={modelRef:'MALE01',seat:2 as const,follow:true,keep:state};entry.crowd={followers:()=>[],boardPassenger:()=>undefined,spawnPassenger:()=>true};entry.onPassengerKilled=killed;entry.car=car as any;entry.phase='seated';entry.passengers.push(rider);entry.stepPassengers(0);
 return {state:()=>rider.keep,kill:killed,hit:(friendly=false,force=false)=>entry.passengerShot(car as any,2,25,friendly,force,{weapon:22,piece:force?9:3,creator:friendly?'ped':'remote'})};
}
for(const role of ['script','recruit']){
 test(`${role} retains exactly one HP after native weakness`,()=>{const f=fixture(role,28.5,0);expect(f.hit()).toBe('hit');expect(f.state().health).toBe(1);expect(f.kill).not.toHaveBeenCalled();});
 test(`${role} armour retains its native float remainder`,()=>{const f=fixture(role,100,40);expect(f.hit()).toBe('hit');expect(f.state().health).toBe(100);expect(f.state().armour).toBe(12.5);});
 test(`${role} partial armour crosses to exactly one HP`,()=>{const f=fixture(role,1.5,27);expect(f.hit()).toBe('hit');expect(f.state().health).toBe(1);expect(f.state().armour).toBe(0);});
 test(`${role} native player friendly scaling retains one HP`,()=>{const f=fixture(role,3.75,0);expect(f.hit(true)).toBe('hit');expect(f.state().health).toBe(1);expect(f.kill).not.toHaveBeenCalled();});
 test(`${role} below-one damage still kills once`,()=>{const f=fixture(role,28,0);expect(f.hit()).toBe('killed');expect(f.state().health).toBe(0);f.hit();expect(f.kill).toHaveBeenCalledOnce();});
 test(`${role} forced head death retains native armour spending`,()=>{const f=fixture(role,5000,40);expect(f.hit(false,true)).toBe('killed');expect(f.state().health).toBe(0);expect(f.state().armour).toBe(12.5);expect(f.kill).toHaveBeenCalledOnce();});
 test(`${role} proof rejection precedes native arithmetic`,()=>{const f=fixture(role,28.5,40);f.state().proofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};expect(f.hit()).toBeUndefined();expect(f.state().health).toBe(28.5);expect(f.state().armour).toBe(40);expect(f.kill).not.toHaveBeenCalled();});
}
