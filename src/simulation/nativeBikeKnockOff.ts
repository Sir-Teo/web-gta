import {requireAsset} from '../assets/binary';
export interface BikeKnockOffInput {
 intensity:number;mass:number;player:boolean;skill:number;
 /** Unit impact direction in bike space (forward/up/right components). */
 dir:{fwd:number;up:number;right:number};upZ:number;sanchez:boolean;quad:boolean;
}
/** CBike::DamageKnockOffRider force. The stair exemption and NEVER/ALWAYS flags
 * are skipped (no stair cull zones or knock-off flags exist here); skill covers
 * STAT_BIKE_SKILL/1000 once the bike stat is tracked (0 until then). */
export function knockOffForce(o:BikeKnockOffInput){
 requireAsset(o.intensity>=0&&o.mass>0&&o.skill>=0&&o.skill<=1&&Number.isFinite(o.intensity+o.mass+o.skill+o.dir.fwd+o.dir.up+o.dir.right+o.upZ),'Invalid knock-off input.');
 let force=o.intensity/o.mass*800;
 force*=o.player?.75*(1-o.skill*.5):1-o.skill*.6;
 // Early-out: no riding driver comes off below this (driver presence/driving always hold here).
 if(force<=10)return 0;
 let fwdW=.6;
 if(Math.abs(o.dir.fwd)>.85){const vertical=o.dir.up<.85?0:o.dir.up;fwdW=7*vertical*vertical+.6;}
 if(o.upZ<0)fwdW=5;
 let backW=1.5,upW=.05;
 if(o.sanchez){fwdW*=.65;upW*=.75;}
 else if(o.quad){backW=3;fwdW*=.65;upW*=.75;}
 if(o.dir.fwd>0)fwdW*=1-o.skill*.6;
 force*=Math.abs(o.dir.fwd)*fwdW+Math.max(o.dir.up,0)*upW+Math.abs(o.dir.right)*.45-Math.min(o.dir.up,0)*backW;
 return force;
}
/** Final threshold: 75 normally (20 for ALWAYS_HARD peds, none of which exist here). */
export function knocksOffRider(force:number){
 requireAsset(Number.isFinite(force)&&force>=0,'Invalid knock-off force.');
 return force>75;
}
