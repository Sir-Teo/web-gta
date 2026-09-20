/* CPostEffects::Render's colour filter (gta-reversed ead3051). Each frame the front buffer is copied and, with the
 * colour filter enabled (m_bColorEnable, true by default), drawn back over itself twice with SRCALPHA/ONE blending
 * modulated by the timecycle's two post-effect colours (CTimeCycle::GetPostFxColors, the interpolated postfx1 and
 * postfx2 bytes with their alphas): every pass adds colour x alpha x screen to the screen. Night vision or infrared
 * force both colours to 64, 64, 64; pass 1 is scaled by gfLaRiotsLightMult; and both are scaled by a multiplier
 * driven by the player's lighting from the collision surface (CPhysical::GetLightingFromCol): s_ExtraMult moves
 * toward that lighting by SCREEN_EXTRA_MULT_CHANGE_RATE (0.0005) a time step, capped at SCREEN_EXTRA_MULT_BASE_CAP
 * (0.35), and the multiplier is 1 + (1 - s_ExtraMult / 0.35) x SCREEN_EXTRA_MULT_BASE_MULT (1). The lighting is the
 * ambient (before brightness, so the timecycle ambient) averaged over its channels plus the contact surface
 * brightness (1 until a surface sets it); the byte scaling wraps like the uint8 cast; outdoors the original scales that by the post-effect colour sums through
 * TEST_ADD_AMBIENT_LIGHT_FRAC, a float at 0x8CD7B8 the reference does not give, so the exterior scale is a
 * parameter that defaults to none. */
export const SCREEN_EXTRA_MULT_CHANGE_RATE=0.0005,SCREEN_EXTRA_MULT_BASE_CAP=0.35,SCREEN_EXTRA_MULT_BASE_MULT=1,SCREEN_EXTRA_MULT_INITIAL=0.35;
export const VISION_POSTFX_GREY=64,DEFAULT_CONTACT_SURFACE_BRIGHTNESS=1;
export interface PostFxColour {r:number;g:number;b:number;a:number}
/** CRGBA::ScaleRGB stores (uint8)(channel x mult): no clamp, a byte wrap. */
const byte=(v:number)=>((Math.trunc(v)%256)+256)%256;
/** CPhysical::GetLightingFromCol: the ambient channels averaged plus the contact surface brightness; outdoors the
 * post-effect sums scale it by `ambientFrac` (TEST_ADD_AMBIENT_LIGHT_FRAC), which the reference does not give. */
export function lightingFromCol(ambient:readonly [number,number,number],contactBrightness:number,interior:boolean,postFxSums?:{sum1:number;sum2:number},ambientFrac=0){
 let lighting=(ambient[0]+ambient[1]+ambient[2])/3+contactBrightness;
 if(!interior&&postFxSums&&ambientFrac>0)lighting*=(postFxSums.sum1/765*ambientFrac+1-ambientFrac)+postFxSums.sum2/765*ambientFrac;
 return lighting;
}
/** s_ExtraMult after a frame of `timeStep` native steps: toward the lighting by the change rate, capped at 0.35. */
export function screenExtraMult(previous:number,lightFromCol:number,timeStep:number){
 const step=timeStep*SCREEN_EXTRA_MULT_CHANGE_RATE;let light=lightFromCol;
 if(Math.abs(light-previous)>=step)light=light<=previous?previous-step:previous+step;
 return Math.min(light,SCREEN_EXTRA_MULT_BASE_CAP);
}
/** The colour multiplier for both passes: 1 + (1 - extra / 0.35) x 1. */
export function colourMultFactor(extraMult:number){return 1+(1-extraMult/SCREEN_EXTRA_MULT_BASE_CAP)*SCREEN_EXTRA_MULT_BASE_MULT;}
/** The two pass colours CPostEffects::Render hands ColourFilter (bytes). */
export function postFxPasses(pass1:PostFxColour,pass2:PostFxColour,options:{vision?:boolean;laRiotsLightMult?:number;extraMult?:number}={}):[PostFxColour,PostFxColour]{
 let p1={...pass1},p2={...pass2};
 if(options.vision){p1={...p1,r:VISION_POSTFX_GREY,g:VISION_POSTFX_GREY,b:VISION_POSTFX_GREY};p2={...p2,r:VISION_POSTFX_GREY,g:VISION_POSTFX_GREY,b:VISION_POSTFX_GREY};}
 const riots=options.laRiotsLightMult??1;p1={...p1,r:byte(p1.r*riots),g:byte(p1.g*riots),b:byte(p1.b*riots)};
 const factor=colourMultFactor(options.extraMult??SCREEN_EXTRA_MULT_BASE_CAP);
 p1={...p1,r:byte(p1.r*factor),g:byte(p1.g*factor),b:byte(p1.b*factor)};p2={...p2,r:byte(p2.r*factor),g:byte(p2.g*factor),b:byte(p2.b*factor)};
 return [p1,p2];
}
/** ColourFilter's two additive passes as one multiplier of the screen: the screen gains pass colour x alpha x screen
 * per pass, so the frame becomes screen x (1 + a1 c1 + a2 c2) per channel (unit colours, the sum capped at 1 as a
 * byte render target clips it). */
export function colourFilterFactor(pass1:PostFxColour,pass2:PostFxColour):[number,number,number]{
 const term=(c:number,a:number)=>c/255*(a/255);
 return [Math.min(1,term(pass1.r,pass1.a)+term(pass2.r,pass2.a)),Math.min(1,term(pass1.g,pass1.a)+term(pass2.g,pass2.a)),Math.min(1,term(pass1.b,pass1.a)+term(pass2.b,pass2.a))];
}
