import {expect,test} from 'vitest';
import {NativeGunMoveAnims,type GunMoveClip} from '../src/animation/nativeGunMoveAnims';

// ped.ifp Gun_stand, IDLE_stance and the GunMove clips with their forward/side root travel.
const CLIPS:Record<GunMoveClip,{duration:number}>={stand:{duration:.033},idle:{duration:1.5},fwd:{duration:1},bwd:{duration:1.033},left:{duration:1},right:{duration:1}};
const TRAVEL:Record<string,{x:number;y:number}>={fwd:{x:0,y:1.854},bwd:{x:0,y:-1.914},left:{x:-1.803,y:0},right:{x:1.803,y:0}};
function run(anims:NativeGunMoveAnims,frames:number,stick:{x:number;y:number},o={aimWithArm:false,moveFire:true,firing:false,moveSpeed:1}){
 const dt=1/60,moved={x:0,y:0};
 for(let i=0;i<frames;i++){
  for(const s of anims.update(dt)){const c=CLIPS[s.clip],t=TRAVEL[s.clip],span=((s.wrapped?s.to+c.duration:s.to)-s.from)/c.duration;moved.x+=s.blend*t.x*span;moved.y+=s.blend*t.y*span;}
  anims.controlGunMove(stick,dt*50);anims.setMoveAnim(o,dt*50);
 }
 return moved;
}
const blend=(a:NativeGunMoveAnims,c:GunMoveClip)=>a.assocs.get(c)?.blend??0;

test('a two-handed gun strafes on the GunMove clips once GUN_STAND fades',()=>{
 const anims=new NativeGunMoveAnims(CLIPS);anims.start(false);
 run(anims,60,{x:1,y:0});
 expect(blend(anims,'stand')).toBe(0);expect(blend(anims,'right')).toBeCloseTo(1);
 const moved=run(anims,60,{x:1,y:0});
 // GunMove_R's 1.803 a second at weapon.dat move speed 1.
 expect(moved.x).toBeCloseTo(1.803,1);expect(Math.abs(moved.y)).toBeLessThan(.01);
});
test('weapon.dat move speed scales the strafe and diagonals split the blend',()=>{
 const anims=new NativeGunMoveAnims(CLIPS);anims.start(false);
 const o={aimWithArm:false,moveFire:true,firing:false,moveSpeed:1.5};
 run(anims,60,{x:0,y:-1},o);const moved=run(anims,60,{x:0,y:-1},o);
 expect(moved.y).toBeCloseTo(1.854*1.5,1);
 run(anims,60,{x:Math.SQRT1_2,y:-Math.SQRT1_2},o);
 expect(blend(anims,'fwd')).toBeCloseTo(.5,2);expect(blend(anims,'right')).toBeCloseTo(.5,2);
});
test('firing without bMoveFire stops the strafe; letting go blends GUN_STAND back',()=>{
 const anims=new NativeGunMoveAnims(CLIPS);anims.start(false);
 run(anims,60,{x:0,y:-1});
 const held=run(anims,30,{x:0,y:-1},{aimWithArm:false,moveFire:false,firing:true,moveSpeed:1});
 expect(blend(anims,'stand')).toBeGreaterThan(.9);expect(held.y).toBeLessThan(.3);
 // BlendAnimation each frame fades the move clips by blend × −8: exponentially.
 run(anims,40,{x:0,y:0});expect(blend(anims,'fwd')).toBeLessThan(.05);
});
test('an arm-aimed gun takes the dominant direction clip at blend 8',()=>{
 const anims=new NativeGunMoveAnims(CLIPS);anims.start(true);
 run(anims,30,{x:-1,y:0},{aimWithArm:true,moveFire:true,firing:false,moveSpeed:1});
 expect(blend(anims,'left')).toBeGreaterThan(.85);expect(blend(anims,'idle')).toBeLessThan(.15);
});
