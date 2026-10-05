/* TheCamera.m_fLODDistMultiplier's draw distance share. Every map model is drawn out to its IDE draw distance times the
 * multiplier (CRenderer::SetupMapEntityVisibility, capped at the far clip), and procedural objects the same. The game
 * draws at a multiplier of one; on a touch screen the iOS port's Draw Distance setting scales it.
 *
 * The port (its executable's settings table): Draw Distance (MOB_DD) is a slider from 0 to 100, 70 by default, and sets
 * CRenderer::ms_lodDistScale to 0.875 + 0.875 × value / 100; CCamera::Process then takes m_fLODDistMultiplier as
 * 70 / FOV × ms_lodDistScale × 0.8. The game's one stands for the port's default, so the slider scales it by its share
 * of that default's scale: from 0.59 at 0 to 1.18 at 100, as the port's runs from 0.7 to 1.4 about its 1.19. */
export const DRAW_DISTANCE_DEFAULT=70;
/** CRenderer::ms_lodDistScale for the port's slider value (its float arithmetic). */
export function portLodDistScale(value:number){
 const f=Math.fround,v=Math.min(100,Math.max(0,Math.round(value)));
 return f(f(f(f(v)*.875)*f(.01))+.875);
}
/** The multiplier for a slider value: its scale over the default's. */
export const drawDistanceMultiplier=(value:number)=>portLodDistScale(value)/portLodDistScale(DRAW_DISTANCE_DEFAULT);
let multiplier=1;
export const lodDistMultiplier=()=>multiplier;
export function setDrawDistance(value:number){multiplier=drawDistanceMultiplier(value);}
/** NOT THE PORT'S: the far view's share on a weak phone. The port's Draw Distance only scales the LOD distances, and
 * from the air (or along a long road) the far clip bounds what is drawn instead, so its Low preset spares a weak device
 * little where it needs it most. On the touch Low preset the timecycle's fog and far clip are drawn in by this share,
 * from 0.6 at Draw Distance 20 to all of it at 100 (0.5 + Draw Distance / 200), the world fading into the horizon's
 * colour sooner (the far clip keeping at least 300 units plus 1.2 times the camera's height, so the ground below stays in
 * view from the air); every other preset keeps the view the timecycle gives. */
let viewShare=1;
export const viewDistanceShare=()=>viewShare;
export function setViewDistance(lowPreset:boolean,drawDistance:number){
 viewShare=lowPreset?Math.min(1,.5+Math.min(100,Math.max(0,drawDistance))/200):1;
}

