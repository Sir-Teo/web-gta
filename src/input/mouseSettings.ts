/** The frontend's mouse options: CCamera::m_fMouseAccelHorzntl (the sensitivity slider) and CMenuManager::bInvertMouseY.
 * The slider moves the horizontal rate by (1/200)/15 a step between 1/3200 and 1/200, 0.0025 by default
 * (CMenuManager::SetDefaultPreferences). The retail camera keeps m_fMouseAccelVertical at 0.0015 whatever the slider
 * says (CCamera::Init; only the FIX_BUGS build ties it to the horizontal rate), so the slider turns the view
 * sideways only. */
export const MOUSE_ACCEL_DEFAULT=.0025,MOUSE_ACCEL_MIN=1/3200,MOUSE_ACCEL_MAX=1/200,MOUSE_ACCEL_STEP=(1/200)/15;
export interface MouseSettings {accel:number;invertY:boolean}
const KEY='grove-mouse-v1';
export function parseMouseSettings(value:unknown):MouseSettings{
 const v=value as Partial<MouseSettings>|null;
 const accel=typeof v?.accel==='number'&&Number.isFinite(v.accel)?Math.min(MOUSE_ACCEL_MAX,Math.max(MOUSE_ACCEL_MIN,v.accel)):MOUSE_ACCEL_DEFAULT;
 return {accel,invertY:v?.invertY===true};
}
export function readMouseSettings():MouseSettings{try{return parseMouseSettings(JSON.parse(localStorage.getItem(KEY)??'null'));}catch{return parseMouseSettings(null);}}
export function saveMouseSettings(settings:MouseSettings){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{/* The session keeps its settings. */}}
/** How much the look turns sideways against the default slider position. */
export const mouseYawScale=(settings:MouseSettings)=>settings.accel/MOUSE_ACCEL_DEFAULT;
