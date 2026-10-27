const f=Math.fround;
export interface BumperGroundInput {previous:number;upZ:number;sourceZ:number;reset?:boolean}
/** Process_1stPerson's world-Z guard, including CVehicle::IsUpsideDown.
 * One invocation is one camera update; lifecycle and pause ownership stay with the caller. */
export function nativeBumperGround(input:BumperGroundInput){
 const previous=input.reset?0:f(input.previous);
 const state=f(input.upZ)<=f(-.9)?previous>=.5?.5:f(previous+f(.03)):previous>=0?0:f(previous-f(.03));
 return {state,sourceZ:f(f(input.sourceZ)+state)};
}
