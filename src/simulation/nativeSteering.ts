import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite native steering.');return value;};
export interface NativeSteeringInput {
  angle:number;secondAngle:number;forwardSpeed:number;rightSpeed:number;
  playerStatus:boolean;frontLeftContact:number;rearLeftContact:number;handbrake:boolean;
  /** Source uses WHEELBASE/TARMAC adhesion for the steering limit, not the road hit. */
  tarmacAdhesion:number;traction:number;steeringLockDegrees:number;handlingFlags:number;
}
/** Automobile steering attenuation and axle routing. Unsteered axles use zero
 * instead of exposing the source's -999 sentinel to trigonometric calculations. */
export function nativeSteering(input:NativeSteeringInput){
  const angle=f(input.angle),second=f(input.secondAngle),forward=f(input.forwardSpeed),right=f(input.rightSpeed);
  const front=f(input.frontLeftContact),rear=f(input.rearLeftContact),adhesion=f(input.tarmacAdhesion),traction=f(input.traction),lock=f(input.steeringLockDegrees),flags=input.handlingFlags;
  requireAsset(front>=0&&front<=4&&rear>=0&&rear<=4&&adhesion>=0&&traction>=0&&lock>0&&lock<=180,'Invalid steering contact or grip inputs.');
  requireAsset(Number.isInteger(flags)&&flags>=0&&flags<=0xffffffff,'Invalid steering handling flags.');
  let factor=1;
  if(forward>f(.01)&&(front>0||rear>0)&&input.playerStatus){
    const limit=Math.min(f(f(f(f(adhesion*traction)*4)*4)/f(forward*forward)),1);
    const radians=f(lock*f(Math.PI/180));factor=f(f(Math.asin(limit))/radians);
    if(angle<0&&right>f(.05)||angle>0&&right<f(-.05)||input.handbrake||factor>1)factor=1;
  }
  const limited=f(angle*factor),rearSteer=(flags&0x20)!==0;
  return {angle:limited,factor,frontAngle:rearSteer?0:limited,rearAngle:rearSteer?f(-limited):(flags&0x40)!==0?second:0};
}
