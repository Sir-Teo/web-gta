import {expect,test} from 'vitest';
import reference from './fixtures/ground-sprint-playback-reference.json';
import {NativeMoveAnims,type MoveClip} from '../src/animation/nativeMoveAnims';

const clips:Record<MoveClip,{duration:number}>={idle:{duration:1.5},walkStart:{duration:.267},walk:{duration:1.2},run:{duration:.733},sprint:{duration:.533},runStop:{duration:.867},runStopR:{duration:.8}};
function established(){
 const anims=new NativeMoveAnims(clips);
 for(let i=0;i<120;i++){anims.update(1/60);anims.setRealMoveAnim(128/60,true);}
 return anims;
}
for(const [i,row] of reference.cases.entries())test(`captured established sprint playback ${i}: button ${row.input.buttonSpeed}, camera ${row.input.cameraMode}, delta ${row.input.sprintDelta}`,()=>{
 const anims=established(),sprint=anims.assocs.get('sprint')!;sprint.delta=row.input.sprintDelta;
 anims.setRealMoveAnim(128/60,true,{buttonSpeed:row.input.buttonSpeed,fixedCamera:row.input.cameraMode===15});
 expect(sprint.speed).toBe(row.speed);expect(sprint.delta).toBe(row.delta);
});
test('synchronised run and sprint use the playback-adjusted weighted duration',()=>{
 const anims=established(),sprint=anims.assocs.get('sprint')!,run=anims.assocs.get('run')!;
 sprint.blend=.5;run.blend=.5;sprint.delta=run.delta=0;
 anims.setRealMoveAnim(128/60,true,{buttonSpeed:10});
 const s0=sprint.time/clips.sprint.duration,r0=run.time/clips.run.duration;
 anims.update(1/600);
 const expected=(1/600)/(.5*clips.sprint.duration/sprint.speed+.5*clips.run.duration/run.speed);
 expect(sprint.time/clips.sprint.duration-s0).toBeCloseTo(expected,10);
 expect(run.time/clips.run.duration-r0).toBeCloseTo(expected,10);
});
test('full tapping increases actual extracting sprint travel by its captured playback factor',()=>{
 const normal=established(),tapped=established();
 normal.setRealMoveAnim(128/60,true,{buttonSpeed:1});tapped.setRealMoveAnim(128/60,true,{buttonSpeed:10});
 const travel=(a:NativeMoveAnims)=>a.update(1/600).filter(s=>s.clip==='sprint').reduce((sum,s)=>sum+s.blend*(s.to+(s.wrapped?clips.sprint.duration:0)-s.from),0);
 expect(travel(tapped)/travel(normal)).toBeCloseTo(Math.fround(1.3),10);
});
