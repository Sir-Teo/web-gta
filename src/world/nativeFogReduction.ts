/* CTimeCycle::m_FogReduction (gta-reversed TimeCycle.cpp, CalcColoursForPoint 0x5603D0): a 0–64 count stepped once
 * per colour calculation, up while the camera looks nearly straight down (forward z under -0.9) or, unless the
 * script forces rain, while the player or camera is in a no-rain cull zone or a cutscene runs; down otherwise. It
 * floors the far clip at FogReduction × 10.15625 before the timecycle boxes, and CWeather::RenderRainStreaks scales
 * the streak target by (64 − FogReduction) / 64. */
export const FOG_REDUCTION_MAX=64,FOG_REDUCTION_FAR_CLIP=10.15625;
export function stepFogReduction(current:number,o:{cameraForwardZ:number;noRain:boolean;cutscene?:boolean;scriptsForceRain?:boolean}){
 return o.cameraForwardZ< -0.9||!o.scriptsForceRain&&(o.noRain||!!o.cutscene)?Math.min(current+1,FOG_REDUCTION_MAX):Math.max(current-1,0);
}
