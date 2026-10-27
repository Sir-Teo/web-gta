const f=Math.fround;
export interface JumpAssociations {run?:number;sprint?:number}
/** Selected Launch (0x100417418): float32 ped.ifp association coefficients, in native units/frame.
 * The body modifier scales the resulting speed before velocity selection. */
export function nativeJumpGroundSpeed(associations:JumpAssociations,modifier=1){
 const base=associations.sprint!==undefined?f(f(.17)+f(f(f(.22)-f(.17))*f(associations.sprint))):associations.run!==undefined?f(f(.1)+f(f(f(.17)-f(.1))*f(associations.run))):f(.1);
 return f(base*f(modifier));
}
/** Jump body arithmetic and actual ApplyMoveForce's reciprocal-mass multiplication, with ped mass 70.
 * These are requested forward speed and vertical velocity increment, before gravity/collision.
 * Existing velocity retention and platform carry belong to the task/physics caller. */
export function nativeJumpStatLaunch(input:JumpAssociations&{modifier:number;megaJump?:boolean;climbJump?:boolean;player?:boolean;highJump?:boolean}){
 const player=input.player??true,modifier=player?f(input.modifier):1;
 let force=f((player||input.highJump?8.5:4.5)*modifier);
 if(player&&input.megaJump)force=f(force*10);
 return {force,upVelocity:f(force*f(1/70)),forwardSpeed:input.climbJump?0:nativeJumpGroundSpeed(input,modifier)};
}
