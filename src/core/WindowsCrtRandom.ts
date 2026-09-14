/** Windows CRT's 32-bit recurrence and 15-bit output. Compatibility algorithm;
 * callers own state lifetime and consumption order. No implicit global seed. */
export class WindowsCrtRandom {
 private state:number;
 constructor(seed:number){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('CRT seed must be uint32.');this.state=seed;
 }
 next(){this.state=(Math.imul(this.state,214013)+2531011)>>>0;return (this.state>>>16)&32767;}
 /** CGeneral's float sample uses a float32 reciprocal and includes 1. */
 nextUnit(){return Math.fround(this.next()*Math.fround(1/32767));}
 /** Compose affine recurrences by squaring, avoiding O(index) replay for each
  * instanced draw. Arithmetic is modulo 2^32 throughout. */
 advance(count:number){
  if(!Number.isInteger(count)||count<0||count>0xffffffff)throw new Error('CRT advance must be uint32.');
  let multiplier=214013,increment=2531011;
  while(count){
   if(count%2)this.state=(Math.imul(this.state,multiplier)+increment)>>>0;
   increment=Math.imul(increment,(multiplier+1)>>>0)>>>0;multiplier=Math.imul(multiplier,multiplier)>>>0;count=Math.floor(count/2);
  }
 }
}
