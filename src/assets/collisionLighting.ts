const f=Math.fround;
/** tColLighting::GetCurrentLighting with its default scale of 0.5. */
export function nativeContactBrightness(light:number,night:number){
 if(!Number.isInteger(light)||light<0||light>255||!Number.isFinite(night)||night<0||night>1)throw new Error('Invalid native contact lighting.');
 const day=f(f((light&15)*.5)/15),dark=f(f((light>>>4)*.5)/15),blend=f(night);
 return f(f(day*f(1-blend))+f(dark*blend));
}
