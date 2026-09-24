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

/* CPostEffects::NightVision and InfraredVision. Night vision: while off, m_fNightVisionSwitchOnFXCount sits at
 * m_fNightVisionSwitchOnFXTime (50). On the first lit frame the count is positive, so it becomes min(count - step, 0)
 * and the ONE / ONE (8, 8, 8) draw-buffer adds run int() of that new count times, which is never more than zero: the
 * switch-on flash never draws. Then a ZERO / SRCCOLOR quad of (32, 255, 32) tints the frame and Grain(48)
 * follows. Infrared: the draw buffer is added four times in (255, 60, 40) over quads grown by
 * m_fInfraredVisionFilterRadius x 100 (0.3 px) per step, a ZERO / SRCCOLOR quad of (255, 64, 255) tints the frame
 * and Grain(64) follows. Grain draws a 64 x 64 random byte raster, white with the strength as alpha, stretched
 * 1.5 x SCREEN_STRETCH_X across the width. */
export const NIGHT_VISION_SWITCH_ON_FX_TIME=50,NIGHT_VISION_FLASH_STEP=8,NIGHT_VISION_TINT:readonly [number,number,number]=[32,255,32],NIGHT_VISION_GRAIN=48;
/** m_InfraredVisionMainCol (0x8D50D0): (255, 200, 0, 100). SetFilterMainColour adds the frame copy in it with ONE /
 * DESTALPHA; the PC back buffer has no alpha channel (X8R8G8B8), so the destination alpha reads 1 and the pass adds. */
export const INFRARED_MAIN_COLOUR:readonly [number,number,number]=[255,200,0];
export const INFRARED_FILTER_RADIUS=0.003,INFRARED_COLOUR:readonly [number,number,number]=[255,60,40],INFRARED_TINT:readonly [number,number,number]=[255,64,255],INFRARED_GRAIN=64;
/** The switch-on flash this frame: how many draw-buffer adds (the loop counts the lowered count, so none), and the
 * count left. */
export function nightVisionFlash(count:number,timeStep:number){
 if(!(count>0))return {draws:0,next:count};
 const next=Math.min(count-timeStep,0);
 return {draws:Math.max(0,Math.trunc(next)),next};
}
/** InfraredVision's four quad expansions in pixels: j x radius x 100 for j 1..4. */
export function infraredExpansions(){return [1,2,3,4].map(j=>j*INFRARED_FILTER_RADIUS*100);}

/* CPostEffects::Render's underwater pass: while CWeather::UnderWaterness is at least m_fWaterFXStartUnderWaterness
 * (0.535) or m_waterEnable is set, s_WaterGreen climbs by the time step to 24 (and resets to 0 above water), the
 * colour is m_waterCol (64, 64, 64) with 184 added to every channel and s_WaterGreen to green (each capped at 255),
 * scaled by 1 - min(CWeather::WaterDepth, 90) / 90 when m_bWaterDepthDarkness is on (it is), and
 * UnderWaterRipple redraws the front buffer as a triangle strip of rows every SCREEN_STRETCH_Y(24) pixels whose
 * texture coordinates sway by sin(0.04 y + 0.0015 t) x xoffset, xoffset being SCREEN_STRETCH_X(4) x
 * s_WaterGreen / 24, with the colour at alpha 255 (so the frame is replaced by the tinted, rippled copy).
 * CWeather::Update, which sets UnderWaterness and WaterDepth, is a raw call in the reference. */
export const WATER_FX_START_UNDERWATERNESS=0.535,WATER_GREEN_MAX=24,WATER_FULL_DARKNESS_DEPTH=90,WATER_X_OFFSET=4,WATER_Y_OFFSET=24,WATER_STRENGTH=64,WATER_SPEED=0.0015,WATER_FREQ=0.04;
export const WATER_COLOUR:readonly [number,number,number]=[64,64,64];
/** s_WaterGreen after a frame of `timeStep` steps under water, or 0 above it. */
export function waterGreen(previous:number,underWater:boolean,timeStep:number){return underWater?Math.min(previous+timeStep,WATER_GREEN_MAX):0;}
/** The pass colour (bytes): m_waterCol plus 184 (plus s_WaterGreen on green), scaled by the depth darkness. */
export function underWaterColour(green:number,waterDepth:number,depthDarkness=true):[number,number,number]{
 const r=Math.min(WATER_COLOUR[0]+184,255),g=Math.min(WATER_COLOUR[1]+green+184,255),b=Math.min(WATER_COLOUR[2]+184,255);
 const darkness=depthDarkness?1-Math.min(Math.max(0,waterDepth),WATER_FULL_DARKNESS_DEPTH)/WATER_FULL_DARKNESS_DEPTH:0;
 return [byte(r*darkness),byte(g*darkness),byte(b*darkness)];
}
/** UnderWaterRipple's sway for a row `y` pixels down at `timeMs`, in pixels. */
export function underWaterWave(y:number,timeMs:number,xoffset:number){return Math.sin(WATER_FREQ*y+WATER_SPEED*timeMs)*xoffset;}
/** The ripple's horizontal amplitude in pixels for the screen width: SCREEN_STRETCH_X(4) x s_WaterGreen / 24. */
export function underWaterXOffset(green:number,screenWidth:number){return screenWidth/640*WATER_X_OFFSET*(green/WATER_GREEN_MAX);}
