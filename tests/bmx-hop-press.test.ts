import {expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';

// CBmx::ProcessBunnyHop starts a charge on IsLeftShoulder1Pressed (a fresh press) with m_fControlJump at zero; a
// button still held from the last hop charges nothing. LaunchBunnyHopCB needs a front wheel and a rear wheel down.
const bmx=()=>{
 const wheels={front:true,rear:true};let launched=0;
 const self=Object.assign(Object.create(WorldBike.prototype),{modelId:481,occupied:true,controlJump:0,hopLaunch:undefined,hopHeld:false,throttle:1,
  body:{rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0}),setLinvel(){launched++;}},wheelsDown:(along:number)=>along>0?wheels.front:wheels.rear});
 return {self,wheels,launched:()=>launched,hop:(held:boolean,disabled=false)=>(WorldBike.prototype as any).bunnyHop.call(self,1/50,held,disabled)};
};
test('a held button charges from a fresh press only, and a launch needs both wheels down',()=>{
 const b=bmx();
 b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(2);expect(b.self.throttle).toBe(0);
 b.hop(false);expect(b.self.hopLaunch).toBeGreaterThan(0);
 for(let i=0;i<20&&b.self.hopLaunch!==undefined;i++)b.hop(false);
 expect(b.launched()).toBe(1);expect(b.self.controlJump).toBe(0);
 // The button held from before the mount (the charge is dropped off the bike) charges nothing until pressed again.
 b.self.occupied=false;b.hop(true);b.self.occupied=true;b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(0);
 b.hop(false);b.hop(true);expect(b.self.controlJump).toBe(1);
 // Only the rear wheel down at the launch: nothing.
 b.hop(false);b.wheels.front=false;for(let i=0;i<20&&b.self.hopLaunch!==undefined;i++)b.hop(false);
 expect(b.launched()).toBe(1);
});
test('a press under DisablePlayerControls is refused, and a charge it drops needs a new press',()=>{
 const b=bmx();b.hop(true,true);b.hop(true,true);expect(b.self.controlJump).toBe(0);
 b.hop(false);b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(2);
 b.hop(true,true);expect(b.self.controlJump).toBe(0);
 b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(0);
 b.hop(false);b.hop(true);expect(b.self.controlJump).toBe(1);
});
