import {requireAsset} from './binary';
import type {HandlingSupplement} from './handling';
export interface BoatHandlingData {
 id:string;line:number;thrustY:number;thrustZ:number;thrustAppZ:number;aqPlaneForce:number;aqPlaneLimit:number;
 aqPlaneOffset:number;waveAudioMult:number;moveRes:[number,number,number];turnRes:[number,number,number];lookBehindCamHeight:number;
}
/** tBoatHandlingData::InitFromData column order: ID plus 14 floats. */
export function readBoatHandling(supplements:readonly HandlingSupplement[]){
 const rows=new Map<string,BoatHandlingData>();
 for(const row of supplements){
  if(row.kind!=='boat')continue;
  const [id,...tokens]=row.tokens,label=`Boat handling line ${row.line}`;
  requireAsset(id.length>0&&id.length<=31&&tokens.length===14&&tokens.every(t=>/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t)),`${label}: expected an ID and 14 values.`);
  const v=tokens.map(Number);
  requireAsset(v.every(n=>Number.isFinite(n)&&Number.isFinite(Math.fround(n))),`${label}: nonfinite boat handling value.`);
  requireAsset(!rows.has(id),`${label}: duplicate boat handling ID.`);
  rows.set(id,{id,line:row.line,thrustY:v[0],thrustZ:v[1],thrustAppZ:v[2],aqPlaneForce:v[3],aqPlaneLimit:v[4],aqPlaneOffset:v[5],waveAudioMult:v[6],moveRes:[v[7],v[8],v[9]],turnRes:[v[10],v[11],v[12]],lookBehindCamHeight:v[13]});
 }
 return rows;
}
