import {requireAsset} from '../assets/binary';
export interface LoadedCarChoice {
 modelId:number;frequency:number;vehicleClass:string;references:number;
 suppressed:boolean;scriptBlocked:boolean;phasingOut:boolean;
}
const normalClasses=new Set(['normal','poorfamily','richfamily','motorbike']);
/** CLoadedCarGroup::PickRandomCar's active-model path. The caller owns loaded
 * membership, native class/frequency/refcount state and random-number sequence.
 * No region, streaming state or script flags are fabricated here. */
export function pickNativeLoadedCar(models:readonly LoadedCarChoice[],policy:{notTooMany:boolean;normalOnly:boolean},draw:(exclusiveUpper:number)=>number):number{
 requireAsset(models.length<=23,'Loaded car group exceeds 23 slots.');
 for(const m of models)requireAsset(Number.isInteger(m.modelId)&&m.modelId>=0&&m.modelId<=32767&&Number.isInteger(m.frequency)&&m.frequency>=0&&m.frequency<=255&&Number.isInteger(m.references)&&m.references>=0&&m.references<=65535&&[m.suppressed,m.scriptBlocked,m.phasingOut].every(v=>typeof v==='boolean'),'Invalid loaded car choice.');
 const choices=policy.normalOnly?models.filter(m=>normalClasses.has(m.vehicleClass)):models;
 if(!choices.length)return -1;
 const sum=choices.reduce((n,m)=>n+m.frequency,0);requireAsset(sum>0,'Loaded car group has no positive frequency.');
 for(let attempt=0;attempt<10;attempt++){
  let weight=draw(sum);requireAsset(Number.isInteger(weight)&&weight>=0&&weight<sum,'Random car weight is outside the requested range.');
  // The original comparison is >=, not >. Preserve its boundary behavior,
  // including selection of a leading zero-frequency entry when weight is zero.
  const chosen=choices.find(m=>{if(m.frequency>=weight)return true;weight-=m.frequency;return false;})!;
  if(!chosen.suppressed&&!chosen.scriptBlocked&&!chosen.phasingOut&&(!policy.notTooMany||chosen.references<=2))return chosen.modelId;
 }
 return -1;
}
