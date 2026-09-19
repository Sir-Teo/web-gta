/** A crouched ped's move clip: GUNCROUCHFWD/BWD, CROUCH_ROLL_L/R, or none. */
export type DuckMoveClip='fwd'|'bwd'|'rollL'|'rollR'|'stop';

/** CTaskSimpleDuck's move command, m_MoveCmd: `y` below 0 crouch-walks forward and above 0 back, `x` of ±1 rolls. */
export class NativeDuckMove {
 x=0;y=0;
 /** CTaskSimpleDuck::ControlDuckMove (0x6923F0): a roll in progress ignores the pad; `y` follows at 0.07 per frame,
  * and a push almost purely sideways (|y| under 0.1, |x| at least 0.9) starts a roll. `timeStep` is in 1/50 s frames. */
 control(moveX:number,moveY:number,timeStep:number){
  if(Math.abs(this.x)===1)return;
  const max=timeStep*.07,delta=moveY-this.y;
  if(delta>max)this.y+=max;else if(delta<-max)this.y-=max;else this.y=moveY;
  if(Math.abs(moveY)<.1&&Math.abs(moveX)>=.9){this.y=0;this.x=moveX<=0?-1:1;}
 }
 /** CTaskSimpleDuck::SetMoveAnim (0x6939F0): the clip, played at max(0.6, |y|) for the crouch walks. */
 get clip():DuckMoveClip{return this.x!==0?this.x>0?'rollR':'rollL':this.y>0?'bwd':this.y<0?'fwd':'stop';}
 get speed(){return Math.max(.6,Math.abs(this.y));}
 /** A roll cannot be aborted (MakeAbortable), and CTaskSimpleDuck::StopFireGun holds the gun meanwhile. */
 get rolling(){return this.x!==0;}
 /** DeleteDuckAnimCB when a roll clip ends. */
 rollFinished(){this.x=0;}
 reset(){this.x=0;this.y=0;}
}

/** CTaskSimplePlayerOnFoot::PlayerControlDucked (reversed): the pad's walk axes (−1..1, up negative) become the duck's
 * move. Aiming a gun passes them straight on; otherwise the ped turns to the stick and only walks forward at its
 * blend ratio. */
export function playerDuckMove(padX:number,padY:number,aimingGun:boolean){
 if(aimingGun)return {x:padX,y:padY};
 return {x:0,y:-Math.min(1,Math.hypot(padX,padY))};
}
