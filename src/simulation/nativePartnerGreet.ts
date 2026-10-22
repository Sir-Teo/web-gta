import type {ScriptedPedOrder} from './nativeScriptedPedTasks';
type Point={x:number;y:number;z:number};
const f=Math.fround;
function distance2D(a:Point,b:Point){const x=f(f(a.x)-f(b.x)),y=f(f(a.y)-f(b.y));return f(Math.sqrt(f(f(x*x)+f(y*y))));}
/** CTaskComplexPartner::ComputeTargetPositions, iOS 10042012c. Its bounded centre corrections can abort. */
export function nativeGreetingTargets(a:Point,b:Point,bias:number):readonly [Point,Point]|undefined{
 const d={x:f(f(b.x)-f(a.x)),y:f(f(b.y)-f(a.y)),z:f(f(b.z)-f(a.z))},weight=f(bias),centre={x:f(f(a.x)+f(weight*d.x)),y:f(f(a.y)+f(weight*d.y)),z:f(f(a.z)+f(weight*d.z))};
 const square=f(f(f(d.x*d.x)+f(d.y*d.y))+f(d.z*d.z)),inverse=square>0?f(1/f(Math.sqrt(square))):1;
 if(square>0){d.x=f(d.x*inverse);d.y=f(d.y*inverse);d.z=f(d.z*inverse);}else d.x=1;
 let settled=false;
 for(let i=0;i<11;i++){
  let changed=false;const first=distance2D(centre,a);
  if(first<f(.7)){const shift=f(f(.75)-first);centre.x=f(centre.x+f(shift*d.x));centre.y=f(centre.y+f(shift*d.y));centre.z=f(centre.z+f(shift*d.z));changed=true;}
  const second=distance2D(centre,b);if(second<f(.7)){const shift=f(f(.75)-second);centre.x=f(centre.x-f(shift*d.x));centre.y=f(centre.y-f(shift*d.y));centre.z=f(centre.z-f(shift*d.z));changed=true;}
  if(!changed){settled=true;break;}
 }if(!settled)return undefined;
 const half={x:f(d.x*.5),y:f(d.y*.5),z:f(d.z*.5)};
 return [{x:f(centre.x-half.x),y:f(centre.y-half.y),z:f(centre.z-half.z)},{x:f(centre.x+half.x),y:f(centre.y+half.y),z:f(centre.z+half.z)}];
}
/** CTaskComplexPartnerGreet::GetPartnerSequence, iOS 100420bc0. Only the C variant has distinct partner clips. */
export function nativeGreetingClips(style:number):readonly [string,string]|undefined{
 const name=['hndshkaa','hndshkba','hndshkca','hndshkda','hndshkea','hndshkfa'][style];return name?[name,style===2?'hndshkcb':name]:undefined;
}
export function nativeGreetingPostlude(leader:boolean,random16:()=>number):ScriptedPedOrder[]{
 const delay=()=>3000+Math.trunc(f(f((random16()&0xffff)*f(1/65536))*4000)),a=delay(),b=delay(),c=delay(),d=delay(),again=(random16()&1)!==0;
 const stand=(ms:number):ScriptedPedOrder=>({kind:'standStill',seconds:ms/1000}),chat=(ms:number):ScriptedPedOrder=>({kind:'playAnim',file:'PED',name:'IDLE_CHAT',loop:true,keepLastFrame:false,seconds:ms/1000});
 // Native DoHandSignal and its finger-model ownership are separate; the SYN5 mission ped types have no signal.
 return [stand(1000),...(leader?[stand(a),chat(b)]:[chat(a),stand(b)]),...(again?[stand(c),chat(d)]:[])];
}
