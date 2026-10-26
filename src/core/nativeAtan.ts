const f=Math.fround,PI=f(Math.PI),HALF_PI=f(Math.PI/2),THREE_HALF_PI=f(Math.PI*1.5),TWO_PI=f(Math.PI*2);
const atan=(ratio:number)=>f(Math.atan(f(ratio)));
/** CGeneral::GetATanOfXY (PC 0x53CC70, selected iOS 0x10023f3dc).
 * Its quadrant operations use floats and return 0..2PI, including 2PI on positive X; the zero vector returns 0.
 * This range matters when a caller's wrap retains both -PI and +PI. */
export function nativeAtanOfXY(x:number,y:number){
 x=f(x);y=f(y);if(x===0&&y===0)return 0;
 if(Math.abs(x)<Math.abs(y)){
  if(y>0)return x>0?f(HALF_PI-atan(f(x/y))):f(HALF_PI+atan(f(-x/y)));
  return x>0?f(THREE_HALF_PI+atan(f(x/-y))):f(THREE_HALF_PI-atan(f(-x/-y)));
 }
 if(y>0)return x>0?atan(f(y/x)):f(PI-atan(f(y/-x)));
 return x>0?f(TWO_PI-atan(f(-y/x))):f(PI+atan(f(y/x)));
}
