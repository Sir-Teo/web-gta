import {expect,test} from 'vitest';
import {NativeMoveAnims,type MoveClip} from '../src/animation/nativeMoveAnims';

// ped.ifp lengths and forward root travel: IDLE_stance, WALK_start, WALK_player, run_player, sprint_civi, Run_stop, Run_stopR.
const CLIPS:Record<MoveClip,{duration:number;travel:number}>={idle:{duration:1.5,travel:0},walkStart:{duration:.267,travel:.471},walk:{duration:1.2,travel:1.867},run:{duration:.733,travel:4.185},sprint:{duration:.533,travel:5.1},runStop:{duration:.867,travel:1.979},runStopR:{duration:.8,travel:1.979}};
/** PlayerControlZelda: stick / 60 with a keyboard's 128, 0.07 × TimeStep per frame, straight to 0 on release. */
function drive(anims:NativeMoveAnims,frames:number,stick:number,sprint:boolean,state={ratio:0,travel:0}){
 const dt=1/60;
 for(let i=0;i<frames;i++){
  for(const s of anims.update(dt)){const c=CLIPS[s.clip];state.travel+=s.blend*c.travel*((s.wrapped?s.to+c.duration:s.to)-s.from)/c.duration;}
  const target=stick*128/60;state.ratio=target===0?0:state.ratio+Math.max(-.07*50*dt,Math.min(.07*50*dt,target-state.ratio));
  anims.setRealMoveAnim(state.ratio,sprint);
 }
 return state;
}
const blend=(a:NativeMoveAnims,c:MoveClip)=>a.assocs.get(c)?.blend??0;

test('starting off plays WALK_start alone, then walks and blends into the run',()=>{
 const anims=new NativeMoveAnims(CLIPS),state=drive(anims,1,1,false);
 expect(anims.assocs.has('idle')).toBe(false);expect(blend(anims,'walkStart')).toBe(1);expect(blend(anims,'walk')).toBe(0);
 drive(anims,18,1,false,state);
 // WALK_start ends after 0.267 s (UpdateTime stops it on the following update); the ratio is past 1 by then.
 expect(anims.assocs.has('walkStart')).toBe(false);expect(blend(anims,'walk')+blend(anims,'run')).toBeCloseTo(1);
 drive(anims,60,1,false,state);
 expect(state.ratio).toBeCloseTo(128/60);expect(blend(anims,'run')).toBe(1);expect(blend(anims,'walk')).toBe(0);expect(anims.moveState).toBe('run');
});
test('a steady run covers run_player root travel at its own rate',()=>{
 const anims=new NativeMoveAnims(CLIPS),state=drive(anims,120,1,false);
 const before=state.travel;drive(anims,60,1,false,state);
 expect(state.travel-before).toBeCloseTo(4.185/.733,1);
});
test('halfway between walk and run the synchronised clips share one phase rate',()=>{
 const anims=new NativeMoveAnims(CLIPS);
 drive(anims,30,1,false);
 anims.setRealMoveAnim(1.5,false);
 const walk=anims.assocs.get('walk')!,run=anims.assocs.get('run')!;
 const w0=walk.time/1.2,r0=run.time/.733;anims.update(1/60);
 expect(walk.time/1.2-w0).toBeCloseTo(run.time/.733-r0,6);
 // Σ blend / Σ blend × length = 1 / 0.9665 per second.
 expect(walk.time/1.2-w0).toBeCloseTo(1/60/(.5*1.2+.5*.733),6);
});
test('sprint blends in over half a second and letting go fades it over a second',()=>{
 const anims=new NativeMoveAnims(CLIPS),state=drive(anims,90,1,false);
 drive(anims,15,1,true,state);expect(blend(anims,'sprint')).toBeCloseTo(.5,1);expect(blend(anims,'run')).toBeCloseTo(.5,1);
 drive(anims,30,1,true,state);expect(blend(anims,'sprint')).toBe(1);
 drive(anims,30,1,false,state);expect(blend(anims,'sprint')).toBeCloseTo(.5,1);
 drive(anims,40,1,false,state);expect(anims.assocs.has('sprint')).toBe(false);expect(blend(anims,'run')).toBe(1);
});
test('stopping from a sprint plays a run stop to its end, then the idle blends in',()=>{
 const anims=new NativeMoveAnims(CLIPS),state=drive(anims,90,1,false);drive(anims,60,1,true,state);
 drive(anims,1,0,false,state);
 const stop=anims.assocs.get('runStop')??anims.assocs.get('runStopR');
 expect(stop?.blend).toBe(1);expect(anims.headingLocked).toBe(true);expect(anims.assocs.has('sprint')).toBe(false);
 const before=state.travel;drive(anims,50,1,false,state);
 // Input during the stop changes nothing: it runs out and slides about two units.
 expect(anims.assocs.has('walkStart')).toBe(false);expect(state.travel-before).toBeGreaterThan(1.7);
 drive(anims,10,0,false,state);
 expect(anims.headingLocked).toBe(false);expect(blend(anims,'idle')).toBeGreaterThan(.5);
});
test('stopping from a run blends the idle in at 4 and fades walk and run out',()=>{
 const anims=new NativeMoveAnims(CLIPS),state=drive(anims,90,1,false);
 const before=state.travel;drive(anims,9,0,false,state);
 expect(blend(anims,'idle')).toBeCloseTo(8/60*4,1);// RUN fades linearly at −4 per second: about 0.6 units more.
 expect(state.travel-before).toBeGreaterThan(.5);expect(state.travel-before).toBeLessThan(.7);
 drive(anims,30,0,false,state);expect(anims.assocs.has('run')).toBe(false);expect(blend(anims,'idle')).toBe(1);expect(anims.moveState).toBe('still');
});
