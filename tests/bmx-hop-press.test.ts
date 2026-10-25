import {afterEach,expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';

afterEach(()=>{WorldBike.hopClipSeconds=undefined;});
const bmx=()=>{
 const wheels={front:true,rear:true};let launched=0;WorldBike.hopClipSeconds=()=>1;
 const self=Object.assign(Object.create(WorldBike.prototype),{modelId:481,occupied:true,controlJump:0,hopHeld:false,throttle:1,
  body:{rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0}),setLinvel(){launched++;}},wheelsDown:(along:number)=>along>0?wheels.front:wheels.rear});
 return {self,wheels,launched:()=>launched,hop:(held:boolean,disabled=false)=>(WorldBike.prototype as any).bunnyHop.call(self,1/50,held,disabled)};
};
test('a fresh press charges through the native branches; launch needs both axles and rearming follows the clip fade',()=>{
 const b=bmx();b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(3);expect(b.self.throttle).toBe(1);
 for(let i=0;i<3;i++)b.hop(true);expect(b.self.throttle).toBe(0);
 b.hop(false);expect(b.self.hopLaunch).toBeGreaterThan(0);
 for(let i=0;i<50&&b.self.hopLaunch!==undefined;i++)b.hop(false);
 expect(b.launched()).toBe(1);expect(b.self.controlJump).toBeGreaterThan(0);
 for(let i=0;i<16;i++)b.hop(false);expect(b.self.controlJump).toBe(0);
 // A button held before mounting is no fresh press.
 b.self.occupied=false;b.hop(true);b.self.occupied=true;b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(0);
 b.hop(false);b.hop(true);expect(b.self.controlJump).toBe(2);
 b.hop(false);b.wheels.front=false;for(let i=0;i<30;i++)b.hop(false);expect(b.launched()).toBe(1);
});
test('a press under DisablePlayerControls is refused, and an interrupted charge requires a fresh press',()=>{
 const b=bmx();b.hop(true,true);b.hop(true,true);expect(b.self.controlJump).toBe(0);
 b.hop(false);b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(3);
 b.hop(true,true);expect(b.self.controlJump).toBe(0);
 b.hop(true);b.hop(true);expect(b.self.controlJump).toBe(0);
 b.hop(false);b.hop(true);expect(b.self.controlJump).toBe(2);
});
test('another bicycle cannot block a fresh press or accelerate a different bicycle cooldown',()=>{
 const first=bmx(),second=bmx();first.hop(true);first.hop(false);
 second.hop(true);expect(second.self.controlJump).toBe(2);expect(first.self.controlJump).toBe(2);
});
