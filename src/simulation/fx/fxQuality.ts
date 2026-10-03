/* g_fx's FX quality (Fx_c::m_FxQuality, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166): the PC's Visual FX
 * Quality and the mobile ports' Visual Effects. Below high, FxSystem_c::AddParticle drops a share of its particles,
 * CGrassRenderer draws its plants half as far and CPlantMgr::Render none at low, CClouds keeps fewer volumetric clouds,
 * and CRealTimeShadowManager casts no real-time shadow (the player gets the peds' blob). The game runs at high unless a
 * touch screen's settings lower it. */
export type FxQuality='low'|'medium'|'high'|'veryHigh';
let quality:FxQuality='high';
export const fxQuality=()=>quality;
export function setFxQuality(next:FxQuality){quality=next;}
/** FxSystem_c's CanAddParticle: CGeneral::RandomBool(50) at low, (75) at medium, every particle above. */
export function canAddParticle(random:()=>number){return quality==='low'?Math.trunc(random()*100)<50:quality==='medium'?Math.trunc(random()*100)<75:true;}
/** CRealTimeShadowManager::DoShadowThisFrame: the player's real-time shadow at high and very high only. */
export const playerRealTimeShadow=()=>quality==='high'||quality==='veryHigh';
