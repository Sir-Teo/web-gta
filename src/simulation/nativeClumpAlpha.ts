/** CVehicle::UpdateClumpAlpha, iOS 0x10047e780: signed int32 state, +16 normally or -8 while fading out.
 * Values at/above 255 are retained by this executable, unlike the reversed PC helper's final return 255. */
export function nextVehicleClumpAlpha(alpha:number,fadeOut=false){
 alpha|=0;return fadeOut?Math.max(0,(alpha-8)|0):alpha<255?Math.min(255,(alpha+16)|0):alpha;
}
/** Clump alpha advanced at the port's 30 Hz native-world cadence, independently of the 60 Hz rigid-body step. */
export class NativeClumpAlpha {
 value=255;private clock=0;
 constructor(private readonly apply:(alpha:number)=>void){}
 set(value:number){this.value=value|0;this.clock=0;this.apply(this.value/255);}
 step(seconds:number,fadeOut=false){
  if(!fadeOut&&this.value>=255){this.clock=0;return;}
  this.clock+=seconds;const frames=Math.floor((this.clock+1e-10)*30);if(!frames)return;this.clock-=frames/30;
  const before=this.value;for(let i=0;i<frames;i++)this.value=nextVehicleClumpAlpha(this.value,fadeOut);
  if(this.value!==before)this.apply(this.value/255);
 }
}
