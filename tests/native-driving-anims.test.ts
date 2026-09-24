import {expect,test} from 'vitest';
import {NativeDrivingAnims} from '../src/simulation/nativeDrivingAnims';

const ride={left:'Drive_L',right:'Drive_R',back:'CAR_LB'};
const lengths:Record<string,number>={drive_l:.133,drive_r:.133,car_lb:.233};
const input=(o:{steer?:number;reversing?:boolean;idleFull?:boolean})=>({steer:o.steer??0,reversing:!!o.reversing,idleFull:o.idleFull??true,ride,duration:(n:string)=>lengths[n.toLowerCase()]});
const dt=1/30;

test('a steering clip blends in from its first frame, then takes the steer weight and plays once',()=>{
 const d=new NativeDrivingAnims();
 d.step(dt,input({steer:.305}));
 // BlendAnimation starts it at 0 with delta 4; UpdateBlend moves it 4/30 this frame.
 expect(d.clips.get('drive_l')).toMatchObject({time:dt});expect(d.clips.get('drive_l')!.amount).toBeCloseTo(4/30);
 d.step(dt,input({steer:.305}));
 expect(d.clips.get('drive_l')!.amount).toBeCloseTo(.5);
 for(let i=0;i<10;i++)d.step(dt,input({steer:.305}));
 expect(d.clips.get('drive_l')!.time).toBeCloseTo(.133);
 expect(d.overlays()).toEqual([{clip:'drive_l',amount:.5,seconds:.133}]);
});
test('the idle must be fully in before any steering clip starts',()=>{
 const d=new NativeDrivingAnims();d.step(dt,input({steer:.3,idleFull:false}));expect(d.clips.size).toBe(0);
});
test('reversing cross-fades the steering out as the look back fades in, and back again',()=>{
 const d=new NativeDrivingAnims();
 for(let i=0;i<3;i++)d.step(dt,input({steer:-.61}));
 expect(d.clips.get('drive_r')!.amount).toBe(1);
 d.step(dt,input({steer:-.61,reversing:true}));
 // The running partial fades at its amount × −4, not cut.
 expect(d.clips.get('drive_r')!.amount).toBeCloseTo(1-4/30);expect(d.clips.get('car_lb')!.amount).toBeCloseTo(4/30);
 for(let i=0;i<12;i++)d.step(dt,input({steer:-.61,reversing:true}));
 expect(d.clips.has('drive_r')).toBe(false);expect(d.clips.get('car_lb')!.amount).toBe(1);
 // Forward again: the look back fades at −4 while the steering blends back in.
 d.step(dt,input({steer:-.61}));
 expect(d.clips.get('car_lb')!.amount).toBeCloseTo(1-4/30);expect(d.clips.get('drive_r')!.amount).toBeCloseTo(4/30);expect(d.clips.get('drive_r')!.time).toBeCloseTo(dt);
});
test('straight ahead fades both steering clips out and removes them',()=>{
 const d=new NativeDrivingAnims();
 for(let i=0;i<3;i++)d.step(dt,input({steer:.61}));
 d.step(dt,input({steer:-.61}));
 // Steering the other way zeroes the first clip, and blending in the second (delta −1 on a clip at 0) removes it.
 expect(d.clips.has('drive_l')).toBe(false);expect(d.clips.get('drive_r')!.amount).toBeCloseTo(4/30);
 for(let i=0;i<10;i++)d.step(dt,input({}));
 expect(d.clips.size).toBe(0);
});
