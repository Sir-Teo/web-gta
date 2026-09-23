import {requireAsset} from '../assets/binary';
/** CBike lean (CBike::CalculateLeanMatrix is reversed; the LeanAngle dynamics in
 * ProcessRiderAnims are not, so targets/rates are authored while caps and the
 * matrix application follow the source). Lean is a roll about the forward axis
 * in radians; positive leans right. BIKEH angles are degrees. */
export function bikeLeanTarget(steer:number,speed:number,maxLeanDeg:number){
 requireAsset(Number.isFinite(steer)&&Number.isFinite(speed)&&Number.isFinite(maxLeanDeg)&&maxLeanDeg>=0,'Invalid bike lean input.');
 const grip=Math.max(0,Math.min(1,speed/6));
 return Math.max(-1,Math.min(1,steer))*grip*maxLeanDeg*Math.PI/180;
}
/** Authored DesLean mapping: lower values lean faster, per the handling guide. */
export function approachBikeLean(current:number,target:number,desLean:number,dt:number){
 requireAsset([current,target,desLean,dt].every(Number.isFinite)&&dt>=0,'Invalid bike lean approach.');
 const rate=Math.max(0,(1-desLean)*20),u=Math.min(1,rate*dt);
 return current+(target-current)*u;
}
/** CalculateLeanMatrix position term: Up * (1-cos(lean)) * bbox minimum
 * (native min.z, negative at the bottom). */
export function bikeLeanDrop(lean:number,boundsMin:number){
 requireAsset(Number.isFinite(lean)&&Number.isFinite(boundsMin),'Invalid bike lean drop.');
 return (1-Math.cos(lean))*boundsMin;
}
/** Rider anim blend toward the FullAnimLean cap. */
export function bikeRiderLean(lean:number,fullAnimLeanDeg:number){
 requireAsset(Number.isFinite(lean)&&Number.isFinite(fullAnimLeanDeg)&&fullAnimLeanDeg>0,'Invalid rider lean input.');
 return Math.min(1,Math.abs(lean)/(fullAnimLeanDeg*Math.PI/180));
}
/** CQuadBike::ProcessAI's rider lean: LeanAngle = d^ts × LeanAngle − FullAnimLean × steer angle / steer lock × (1 − d^ts),
 * d being the bike handling's desLean and ts the timestep in 50 Hz frames. `steer` is the port's (+1 right); native
 * steering to the left is positive, so a right turn leans the rider right (positive). */
export function quadRiderLean(current:number,steer:number,fullAnimLeanDeg:number,desLean:number,dt:number){
 const d=desLean**(dt*50);
 return d*current-fullAnimLeanDeg*Math.PI/180*-Math.max(-1,Math.min(1,steer))*(1-d);
}
