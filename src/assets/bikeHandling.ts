import {requireAsset} from './binary';
import type {HandlingSupplement} from './handling';
export interface BikeHandlingData {
 id:string;line:number;leanFwdCOM:number;leanFwdForce:number;leanBakCOM:number;leanBackForce:number;maxLean:number;
 fullAnimLean:number;desLean:number;speedSteer:number;slipSteer:number;noPlayerCOMz:number;wheelieAng:number;
 stoppieAng:number;wheelieSteer:number;wheelieStabMult:number;stoppieStabMult:number;
}
/** tBikeHandlingData::InitFromData column order (ID plus 15 floats): COM/force pairs, lean caps, steering, wheelie/stoppie. */
export function readBikeHandling(supplements:readonly HandlingSupplement[]){
 const rows=new Map<string,BikeHandlingData>();
 for(const row of supplements){
  if(row.kind!=='bike')continue;
  const [id,...tokens]=row.tokens,label=`Bike handling line ${row.line}`;
  requireAsset(id.length>0&&id.length<=31&&tokens.length===15&&tokens.every(t=>/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t)),`${label}: expected an ID and 15 values.`);
  const v=tokens.map(Number);
  requireAsset(v.every(n=>Number.isFinite(n)&&Number.isFinite(Math.fround(n))),`${label}: nonfinite bike handling value.`);
  requireAsset(!rows.has(id),`${label}: duplicate bike handling ID.`);
  rows.set(id,{id,line:row.line,leanFwdCOM:v[0],leanFwdForce:v[1],leanBakCOM:v[2],leanBackForce:v[3],maxLean:v[4],
   fullAnimLean:v[5],desLean:v[6],speedSteer:v[7],slipSteer:v[8],noPlayerCOMz:v[9],wheelieAng:v[10],stoppieAng:v[11],
   wheelieSteer:v[12],wheelieStabMult:v[13],stoppieStabMult:v[14]});
 }
 return rows;
}
