/* The HUD radar, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Radar.cpp, Hud.cpp),
 * fully reversed upstream.
 * - CRadar::DrawMap: the radar shows `m_radarRange` world units from its centre to its edge: 180 on
 *   foot, and in a vehicle 180 below 0.3 units per frame, 350 from 0.9, linear between. Planes other
 *   than the Vortex scale with altitude instead.
 * - CRadar::CalculateCachedSinCos: the map turns with the camera heading, so the view is up.
 * - CRadar::TransformRealWorldPointToRadarSpace divides by the range and rotates; LimitRadarPoint keeps
 *   blips inside the unit circle, which puts the north blip, drawn at the range times the square root
 *   of 2 due north, on the rim.
 * - CRadar::TransformRadarPointToScreenSpace: the radar fills 94 by 76 of the 640 by 448 frame, its left
 *   edge 40 in and its bottom 28 up; CHud::DrawRadar's four RADAR_DISC quarters rim it 4 wider.
 * Browser ground frame: x east, z south; headings follow atan2(dx, dz). */

export const RADAR_MIN_RANGE=180,RADAR_MAX_RANGE=350,RADAR_MIN_SPEED=.3,RADAR_MAX_SPEED=.9;
/** CRadar::DrawMap's range. `speed` is the vehicle's move speed in units per frame, `altitude` native z. */
export function radarRange(o:{inVehicle:boolean;speed?:number;plane?:boolean;altitude?:number}){
 if(!o.inVehicle)return RADAR_MIN_RANGE;
 if(o.plane){
  const z=(o.altitude??0)/200;
  return z<RADAR_MIN_SPEED?RADAR_MAX_RANGE-10:z<RADAR_MAX_SPEED?(z-RADAR_MIN_SPEED)/60+(RADAR_MAX_RANGE-10):RADAR_MAX_RANGE;
 }
 const s=o.speed??0;
 if(s<RADAR_MIN_SPEED)return RADAR_MIN_RANGE;
 if(s>=RADAR_MAX_SPEED)return RADAR_MAX_RANGE;
 return (s-RADAR_MIN_SPEED)*(850/(RADAR_MIN_SPEED*10))+RADAR_MIN_RANGE;
}
/** Radar space for a ground offset from the radar centre: u right, v up (the camera's view direction),
 * 1 at the rim. `viewHeading` is where the camera looks. */
export function radarPoint(d:{x:number;z:number},viewHeading:number,range:number){
 const f={x:Math.sin(viewHeading),z:Math.cos(viewHeading)},r={x:-f.z,z:f.x};
 return {u:(d.x*r.x+d.z*r.z)/range,v:(d.x*f.x+d.z*f.z)/range};
}
/** CRadar::LimitRadarPoint. */
export function limitRadarPoint(p:{u:number;v:number}){const m=Math.hypot(p.u,p.v);return m>1?{u:p.u/m,v:p.v/m}:p;}
/** Where the north blip sits: due north at the range times the square root of 2, limited to the rim. */
export function radarNorth(viewHeading:number,range:number){return limitRadarPoint(radarPoint({x:0,z:-range*Math.SQRT2},viewHeading,range));}
