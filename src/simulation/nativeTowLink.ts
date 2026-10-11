import type {Vec3} from '../core/math';
import type {NativeVelocityDelta} from './nativeWheelMotion';
/* A trailer's tow link (CVehicle::UpdateTrailerLink and UpdateTractorLink, unreversed in gta-reversed; iOS 0x100481eb4
 * and 0x100482240). Each step a towed trailer's CAutomobile::ProcessControl (iOS 0x1004440dc) gives the tractor and the
 * trailer an impulse each at the tow bar and the hitch: while either moves, the tractor half the speed between the two
 * points, weighted by the trailer's share of their mass, then the trailer all of it; then a second pass pulls the two
 * points together, the trailer by 0.3 and the tractor by 0.1 of their distance a step. Each impulse is the one that
 * stops the point's speed along its direction (1 / (1/m + |r × n|²/I), as ApplyForce takes it). The link breaks when
 * the points are further apart than max(timestep, 0.7), when the two point more than about 114° apart (forward·forward
 * under -0.4), or when one rolls over the other (up·up under 0). The baggage trailers' links carry nothing vertical.
 * Hitching (CTrailer::ScanForTowLink, SetTowLink, GetTowHitchPos, GetTowBarPos and CAutomobile::GetTowBarPos) is
 * reversed. */
export const TOW_LINK_BREAK_DISTANCE=.7,TOW_LINK_MIN_FORWARD_DOT=-.4;
export const TRAILER_LINK_PULL=.3,TRACTOR_LINK_PULL=.1;
/** ProcessControl runs the tractor's half only while one of the two moves: the tractor at all, the trailer by |v|² over this. */
export const TOWED_MOVING_SPEED_SQ=.01;
/** BAGGAGE_TRAILER_TOWED_RATIO: m_fTrailerTowedRatio of the trailers without legs. */
export const BAGGAGE_TRAILER_TOWED_RATIO=-1000;
/** TRAILER_TOWED_MINRATIO: while towed the legs' reach stays at least this. */
export const TRAILER_TOWED_MINRATIO=.9;
/** CTrailer::ScanForTowLink: a tow bar within these of the hitch (across, and up or down) takes the trailer. */
export const RELINK_TRAILER_DIFF_LIMIT_XY=.4,RELINK_TRAILER_DIFF_LIMIT_Z=1,TOW_LINK_SCAN_RANGE=10;
/** TRAILER_TOWBAR_OFFSET_Y: a baggage trailer's own tow bar, this far behind its bounds. */
export const TRAILER_TOWBAR_OFFSET_Y=-.05;
export const MODEL={linerun:403,baggage:485,petro:514,rdtrain:515,towtruck:525,tractor:531,utility:552,tug:583,artict3:591,
 bagboxa:606,bagboxb:607,tugstair:608,farmtr1:610,utiltr1:611} as const;

const f=Math.fround;
const add=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x+b.x),y:f(a.y+b.y),z:f(a.z+b.z)});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
const scale=(a:Vec3,k:number):Vec3=>({x:f(a.x*k),y:f(a.y*k),z:f(a.z*k)});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
/** CVector::Normalise: a zero vector becomes (1, 0, 0). */
const normalise=(a:Vec3):Vec3=>{const sq=dot(a,a);return sq>0?scale(a,f(1/Math.sqrt(sq))):{x:1,y:0,z:0};};

/** One vehicle as the link reads it, in world-aligned native axes: its origin, axes, move and turn speed (units and
 * radians a 50th of a second), centre of mass (an offset from the origin), mass and turn mass. */
export interface TowBody {position:Vec3;forward:Vec3;up:Vec3;linear:Vec3;angular:Vec3;centerOfMass:Vec3;mass:number;turnMass:number}
/** CPhysical::GetSpeed: the speed of a point (an offset from the origin). */
export function pointSpeed(body:TowBody,point:Vec3){return add(body.linear,cross(body.angular,sub(point,body.centerOfMass)));}
/** The impulse that stops `speed` at `point`, applied by CPhysical::ApplyForce with the turn: the velocity changes. */
function linkImpulse(body:TowBody,point:Vec3,speed:Vec3):NativeVelocityDelta{
 const lever=sub(point,body.centerOfMass),c=cross(lever,normalise(speed));
 const k=f(1/f(f(1/body.mass)+f(dot(c,c)/body.turnMass))),force=scale(speed,k);
 return {linear:scale(force,f(1/body.mass)),angular:scale(cross(lever,force),f(1/body.turnMass))};
}
export interface TowLinkPair {
 trailer:TowBody;tractor:TowBody;
 /** The trailer's hitch and the tractor's tow bar, world positions. */
 hitch:Vec3;bar:Vec3;
 /** A CTrailer whose m_fTrailerTowedRatio is BAGGAGE_TRAILER_TOWED_RATIO: the link pulls only across it. */
 baggage:boolean;
 timeStep:number;
}
/** Drops the part along a baggage trailer's up axis. */
const flatten=(pair:TowLinkPair,v:Vec3)=>pair.baggage?sub(v,scale(pair.trailer.up,dot(v,pair.trailer.up))):v;
/** UpdateTrailerLink's checks: whether the link holds. */
export function towLinkHolds(pair:TowLinkPair){
 const d=sub(pair.bar,pair.hitch);
 if(Math.sqrt(dot(d,d))>Math.max(pair.timeStep,TOW_LINK_BREAK_DISTANCE))return false;
 if(dot(pair.tractor.forward,pair.trailer.forward)<TOW_LINK_MIN_FORWARD_DOT)return false;
 return dot(pair.tractor.up,pair.trailer.up)>=0;
}
/** CVehicle::UpdateTrailerLink on the trailer (after towLinkHolds): its velocity change at the hitch. `match` (the first
 * argument) and `pull` (the second) as the native's: neither matches the bar's speed, pull alone closes the gap. */
export function trailerLinkImpulse(pair:TowLinkPair,match:boolean,pull:boolean){
 const hitch=sub(pair.hitch,pair.trailer.position),bar=sub(pair.bar,pair.tractor.position);
 const speed=!match&&pull?scale(sub(pair.bar,pair.hitch),f(TRAILER_LINK_PULL/Math.max(pair.timeStep,1)))
  :sub(pointSpeed(pair.tractor,bar),pointSpeed(pair.trailer,hitch));
 return linkImpulse(pair.trailer,hitch,flatten(pair,speed));
}
/** CVehicle::UpdateTractorLink on the tractor: its velocity change at the tow bar. With neither argument it takes half
 * the speed between the points times the trailer's share of the two masses; with `match`, all of it. */
export function tractorLinkImpulse(pair:TowLinkPair,match:boolean,pull:boolean){
 const hitch=sub(pair.hitch,pair.trailer.position),bar=sub(pair.bar,pair.tractor.position);
 let speed=sub(pointSpeed(pair.trailer,hitch),pointSpeed(pair.tractor,bar));
 if(!match){
  if(pull)speed=scale(sub(pair.hitch,pair.bar),f(TRACTOR_LINK_PULL/Math.max(pair.timeStep,1)));
  else speed=scale(speed,f(f(1-f(pair.tractor.mass/f(pair.tractor.mass+pair.trailer.mass)))*.5));
 }
 return linkImpulse(pair.tractor,bar,flatten(pair,speed));
}
/** CTrailer::ScanForTowLink's test of a tow bar against the hitch. */
export function towBarReachesHitch(bar:Vec3,hitch:Vec3){
 return Math.hypot(bar.x-hitch.x,bar.y-hitch.y)<RELINK_TRAILER_DIFF_LIMIT_XY&&Math.abs(hitch.z-bar.z)<RELINK_TRAILER_DIFF_LIMIT_Z;
}
/** What a vehicle's tow points are made from (model space, native axes). */
export interface TowModel {
 model:number;trailer:boolean;boundsMin:readonly number[];boundsMax:readonly number[];frontHeightAboveRoad:number;
 /** The DUMMY_TRAILER_ATTACH ("hookup") dummy, and the misc_a frame, in the model's space. */
 hookup?:Vec3;miscA?:Vec3;
}
/** GetTowHitchPos in model space: CTrailer's (its hookup dummy, else a unit ahead of its bounds), CAutomobile's (half
 * a unit inside its front). None for a tow truck's trailer, or without `checkModelInfo` where the model has nothing. */
export function towHitchPoint(self:TowModel,checkModelInfo:boolean,other?:TowModel):Vec3|undefined{
 if(self.trailer){
  if(other?.model===MODEL.towtruck)return undefined;
  const h=self.hookup;
  if(h&&(h.x!==0||h.y!==0||h.z!==0))return h;
  return checkModelInfo?{x:0,y:f(self.boundsMax[1]+1),z:f(.5-self.frontHeightAboveRoad)}:undefined;
 }
 return checkModelInfo?{x:0,y:f(self.boundsMax[1]-.5),z:f(.5-self.frontHeightAboveRoad)}:undefined;
}
/** GetTowBarPos in model space. A trailer's own only on the baggage trailers (or any with `checkModelInfo`); a tow truck's
 * or tractor's behind it at the hoist's height (the hoist is not modelled: down); the misc_a frame on the rigs (PETRO,
 * RDTRAIN, LINERUN, ARTICT3), on the Utility Van for its trailer and on the airport tugs for their carts and stairs;
 * otherwise the hitch's point. */
export function towBarPoint(self:TowModel,checkModelInfo:boolean,other?:TowModel):Vec3|undefined{
 if(self.trailer){
  if(!checkModelInfo&&self.model!==MODEL.bagboxa&&self.model!==MODEL.bagboxb)return undefined;
  return {x:0,y:f(self.boundsMin[1]-TRAILER_TOWBAR_OFFSET_Y),z:f(.5-self.frontHeightAboveRoad)};
 }
 if(self.model===MODEL.towtruck||self.model===MODEL.tractor){
  if(self.model===MODEL.tractor?other?.trailer&&other.model!==MODEL.farmtr1:other?.trailer)return undefined;
  // TOWTRUCK_HOIST_DOWN_LIMIT's (1 - 0) / 2 + 0.5 with the hoist down.
  return {x:0,y:f((self.model===MODEL.tractor?-.6:-1.05)+self.boundsMin[1]),z:f(1-self.frontHeightAboveRoad)};
 }
 if(self.miscA){
  const m=self.model,o=other?.model;
  if(m===MODEL.petro||m===MODEL.rdtrain||m===MODEL.linerun||m===MODEL.artict3)return self.miscA;
  if(m===MODEL.utility&&o===MODEL.utiltr1)return self.miscA;
  if((m===MODEL.baggage||m===MODEL.tug||m===MODEL.bagboxa||m===MODEL.bagboxb)&&(o===MODEL.bagboxa||o===MODEL.bagboxb||o===MODEL.tugstair))return self.miscA;
 }
 return towHitchPoint(self,checkModelInfo,other);
}
/** CTrailer::ProcessControl's leg reach (m_fTrailerTowedRatio2): the legs' extension, but at least 0.9 while towed. */
export function trailerLegReach(extension:number,towed:boolean){return towed&&extension<TRAILER_TOWED_MINRATIO?TRAILER_TOWED_MINRATIO:extension;}
