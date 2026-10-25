import {expect,test} from 'vitest';
import {WorldPolice} from '../src/simulation/WorldPolice';

test('an Enforcer crew uses the same van transform for rendering and seated bullet targets',()=>{
 const car={animGroup:{id:13},modelFlags:0,car:{nativeFramePosition:(name:string)=>({x:.8,y:name==='ped_backseat'?-1.2:1,z:.4})}};
 const unit={car,seats:[true,true,true,true],deadSeats:[false,false,false,false],leaving:[],entering:[],member:{model:'swat'}},police={units:[unit]};
 const targets=WorldPolice.prototype.crewSeats.call(police as any),poses=WorldPolice.prototype.poses.call(police as any);
 const expected=[{local:{x:-.8,y:1,z:.4},headingOffset:0},{local:{x:.8,y:1,z:.4},headingOffset:0},
  {local:{x:-.8,y:-.6,z:.4},headingOffset:-Math.PI/2},{local:{x:.8,y:-1.2,z:.4},headingOffset:Math.PI/2}];
 expect(targets.map(({local,headingOffset})=>({local,headingOffset}))).toEqual(expected);
 expect(poses.map(({local,headingOffset})=>({local,headingOffset}))).toEqual(expected);
 unit.deadSeats[2]=true;expect(WorldPolice.prototype.crewSeats.call(police as any).map(t=>t.seat)).toEqual([0,1,3]);
 expect(WorldPolice.prototype.poses.call(police as any)[2]).toMatchObject({clip:'car_dead_rhs',headingOffset:-Math.PI/2,seconds:1e6});
});
