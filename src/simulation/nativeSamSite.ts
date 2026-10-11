import type {Vec3} from '../core/math';
/* CObject::ProcessSamSiteBehaviour (0x5A07D0, reversed): the SAM sites at Area 69 (mil_samsite) and on the San Fierro
 * aircraft carrier (samsite_SFXRF), map objects CPopulation makes real within 750 of the player (FindDummyDistForModel,
 * reversed, against 80 for everything else). One east of x = -1000 obeys SET_AREA51_SAM_SITE, one west of it
 * SET_AIRCRAFT_CARRIER_SAM_SITE (off until MANSIO2 turns it on). A site turns toward the player while he flies or
 * sails (not in a car or on a bike, unless on the jetpack) as long as he is no more than 2 under it and south of
 * y = 2100, a twentieth of a radian a time step; lined up within 0.1 and within 120 of him across, it fires a
 * heat-seeking rocket at him each time the clock passes a 4-second mark, from 2 along and 4 up its own axes, along its
 * forward and up together. With nothing to watch it sweeps round a two-hundredth of a radian a time step. A broken
 * site does nothing. */
export const SAM_SITE_MODELS=['mil_samsite','samsite_sfxrf'] as const;
export const SAM_SITE_DUMMY_DISTANCE=750;
/** The x west of which a site is the carrier's. */
const CARRIER_WEST_OF=-1000;
const SAM_RANGE=120,SAM_LINED_UP=.1,SAM_FIRE_PERIOD_MS=4000,SAM_TURN=1/20,SAM_SWEEP=1/200,SAM_TARGET_CEILING=2100,SAM_BELOW=2;

const wrap=(a:number)=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
/** CGeneral::GetATanOfXY. */
const atanOfXY=(x:number,y:number)=>x===0&&y===0?0:Math.atan2(y,x);

/** A step of one site. `heading` is the object's CPlaceable heading (its forward is (-sin, cos, 0)); `target` the
 * player's aircraft, boat or jetpack, if any. Returns the heading to set and the rocket to fire, if one. */
export function samSiteStep(site:{position:Vec3;heading:number;broken:boolean},target:Vec3|undefined,
 enabled:{area51:boolean;carrier:boolean},ts:number,nowMs:number,previousMs:number):{heading:number;fire?:{origin:Vec3;direction:Vec3}}{
 if(site.broken)return {heading:site.heading};
 const p=site.position;
 if(!(p.x>=CARRIER_WEST_OF?enabled.area51:enabled.carrier))return {heading:site.heading};
 // GetATanOfXY of its forward: the heading plus a quarter turn.
 const facing=site.heading+Math.PI/2;
 if(target&&p.z<=target.z+SAM_BELOW&&target.y<=SAM_TARGET_CEILING){
  const wanted=atanOfXY(target.x-p.x,target.y-p.y),diff=wrap(wanted-facing),step=ts*SAM_TURN;
  const turned=Math.abs(diff)<=step?wanted:diff<0?facing-step:facing+step;
  const heading=turned-Math.PI/2;
  if(Math.hypot(p.x-target.x,p.y-target.y)>=SAM_RANGE)return {heading};
  if(Math.abs(diff)>=SAM_LINED_UP||Math.floor(nowMs/SAM_FIRE_PERIOD_MS)===Math.floor(previousMs/SAM_FIRE_PERIOD_MS))return {heading};
  // Its matrix as just turned: forward (-sin, cos, 0), up (0, 0, 1).
  const f={x:-Math.sin(heading),y:Math.cos(heading),z:0};
  return {heading,fire:{origin:{x:p.x+f.x*2,y:p.y+f.y*2,z:p.z+4},direction:{x:f.x,y:f.y,z:1}}};
 }
 return {heading:facing+ts*SAM_SWEEP-Math.PI/2};
}
