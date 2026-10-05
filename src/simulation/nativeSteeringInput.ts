import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite steering input.');return r;};
export interface NativeSteeringState {raw:number;secondAngle:number;lastInput:'keyboard'|'mouse'}
/** CPad::GetSteeringLeftRight's units for an analog deflection (−1 to 1): the pad's whole numbers, −128 to 128. A touch
 * stick, tilt steering and a controller's stick give fractions, which stepNativeSteeringInput refuses (the original reads
 * the pad's int16); the keys give whole numbers already. Nonfinite or out-of-range deflections steer straight or at
 * full lock. */
export function padSteeringAxis(deflection:number){
  if(!Number.isFinite(deflection))return 0;
  const axis=Math.round(Math.max(-128,Math.min(128,deflection*128)));
  return Object.is(axis,-0)?0:axis;
}
export interface NativeSteeringControl {
  steeringAxis:number;mouseDeltaX:number;mouseThirdPerson:boolean;mouseSteeringEnabled:boolean;vehicleMouseLook:boolean;
  timeStep:number;steeringLockDegrees:number;rearHandbrakeSteering:boolean;handbrake:boolean;
}
/** ProcessControlInputs steering subset. Input axis uses native pad units; angles
 * use radians. Pause must skip this call, since mouse and rear smoothing are per-call. */
export function stepNativeSteeringInput(previous:NativeSteeringState,input:NativeSteeringControl){
  let raw=f(previous.raw),lastInput=previous.lastInput;const second=f(previous.secondAngle),axis=f(input.steeringAxis),mouse=f(input.mouseDeltaX),dt=f(input.timeStep),lock=f(input.steeringLockDegrees);
  requireAsset(raw>=-1&&raw<=1&&axis>=-128&&axis<=128&&Number.isInteger(axis)&&dt>=0&&dt<=3&&lock>0&&lock<=180,'Invalid steering input range.');
  requireAsset(lastInput==='keyboard'||lastInput==='mouse','Invalid steering input history.');
  if(!input.mouseThirdPerson||!input.mouseSteeringEnabled||mouse===0&&(lastInput!=='mouse'||axis!==0)){
    raw=f(raw+f(f(f(f(-axis/128)-raw)/5)*dt));lastInput='keyboard';
  }else if(mouse!==0||raw!==0){
    raw=input.vehicleMouseLook?f(raw*f(Math.pow(f(.975),dt))):f(raw-f(mouse*f(.0035)));
    lastInput='mouse';
  }
  raw=Math.max(-1,Math.min(1,raw));
  const square=f(raw*raw),signed=raw<0||Object.is(raw,-0)?-square:square;
  const angle=f(f(lock*signed)*f(Math.PI/180));
  // The rear-wheel lerp and decay are applied once per game frame (30 fps), unscaled: `frames` of them this call.
  const frames=dt*30/50;
  const secondAngle=input.rearHandbrakeSteering?(input.handbrake?f(-angle+(second+angle)*Math.pow(.1,frames)):f(second*Math.pow(.9,frames))):second;
  return {state:{raw,secondAngle,lastInput},angle};
}
