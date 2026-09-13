/** Source-level sprite metrics. `view` is the native camera's transformed point,
 * NOT a Three camera-space position (native camera matrix conventions differ). */
export function nativeSpriteMetrics(
  view:{x:number;y:number;z:number},
  viewport:{width:number;height:number;fov:number;near:number;far:number},
  checkNear=true,checkFar=true,
) {
  const {width,height,fov,near,far}=viewport;
  if(![view.x,view.y,view.z,width,height,fov,near,far].every(Number.isFinite)||width<=0||height<=0||fov<=0||near<0||far<=near)throw new Error('Invalid native sprite projection input.');
  if((checkNear&&view.z<=near+1)||(checkFar&&view.z>=far))return undefined;
  // Native code divides by zero if clipping is bypassed; reject that unsupported input.
  if(view.z===0)throw new Error('Native sprite projection requires nonzero depth.');
  const reciprocalDepth=1/view.z;
  return {x:width*reciprocalDepth*view.x,y:height*reciprocalDepth*view.y,depth:view.z,
    widthScale:width*reciprocalDepth/fov*70,heightScale:height*reciprocalDepth/fov*70};
}

export interface CoronaFadeInput {
  intensity:number;
  targetAlpha:number;
  registered:boolean;
  justCreated:boolean;
  offScreen:boolean;
  blocked:boolean;
  changeImmediately:boolean;
  /** CTimer units, where one unit is 20 ms before the engine's timestep clamp. */
  timeStep:number;
  fadeSpeed:number;
}

/** Unattached corona fade stage. Obstruction/cloud/only-from-below checks are
 * resolved by the caller; offScreen is the flag from the preceding render. */
export function stepCoronaFade(input:CoronaFadeInput) {
  const {intensity,targetAlpha,timeStep,fadeSpeed}=input;
  if(![intensity,targetAlpha].every(v=>Number.isInteger(v)&&v>=0&&v<=255)||!Number.isFinite(timeStep)||timeStep<0||!Number.isFinite(fadeSpeed)||fadeSpeed<0)throw new Error('Invalid corona fade input.');
  const step=timeStep*fadeSpeed,target=input.registered?targetAlpha:0;
  let next:number;
  if(input.blocked||input.offScreen)next=Math.max(0,intensity-step);
  else {
    next=intensity<target?Math.min(target,intensity+step):Math.max(target,intensity-step);
    if(input.changeImmediately)next=target;
  }
  next=Math.trunc(next);
  return {intensity:next,expired:next===0&&!input.justCreated};
}

/** The source starts distance attenuation at half the registered range. */
export function coronaDistanceIntensity(depth:number,farClip:number) {
  if(!Number.isFinite(depth)||!Number.isFinite(farClip)||farClip<=0)throw new Error('Invalid corona distance input.');
  return Math.max(0,Math.min(1,(farClip-depth)/(farClip*.5)));
}
