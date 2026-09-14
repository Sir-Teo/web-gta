import {requireAsset} from './binary';
import type {VehicleIdeRecord} from './vehicleIde';
export interface CarGroup {index:number;line:number;names:string[];comment:string}
/** Keep row order and repeated names. Group IDs are positional, not comments. */
export function readCarGroups(text:string):CarGroup[]{
 requireAsset(text.length<=1024*1024&&!text.includes('\0'),'Invalid car group resource.');
 const groups:CarGroup[]=[];
 for(const [line,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const [body,...comment]=raw.split('#'),tokens=body.replace(/,/g,' ').trim().split(/\s+/).filter(Boolean);if(!tokens.length)continue;
  requireAsset(tokens.length<=256&&tokens.every(t=>/^[a-z0-9_]{1,23}$/i.test(t)),`Invalid car group names on line ${line+1}.`);
  groups.push({index:groups.length,line:line+1,names:tokens,comment:comment.join('#').trim()});requireAsset(groups.length<=34,'Too many native car groups.');
 }
 requireAsset(groups.length===34,'Expected all 34 native car groups.');return groups;
}
/** Native LoadGroup admits up to 23 resolved models, retaining duplicate entries.
 * Unresolved names and ignored tail entries remain visible for audit. */
export function resolveCarGroups(groups:readonly CarGroup[],vehicles:readonly VehicleIdeRecord[]){
 const byName=new Map<string,number>();
 for(const vehicle of vehicles){const name=vehicle.model.toLowerCase();requireAsset(!byName.has(name),`Ambiguous vehicle name: ${name}`);byName.set(name,vehicle.id);}
 return groups.map(group=>{
  const models:number[]=[],unresolved:string[]=[],ignored:string[]=[];
  for(const name of group.names){if(models.length===23){ignored.push(name);continue;}const model=byName.get(name.toLowerCase());if(model===undefined)unresolved.push(name);else models.push(model);}
  requireAsset(models.length>0,`Car group ${group.index} has no resolved models; refusing to shift later group IDs.`);
  return {...group,models,unresolved,ignored};
 });
}
