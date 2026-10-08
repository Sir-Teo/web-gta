import {requireAsset} from './binary';
export interface PopulationCycleRow {
 line:number;zoneType:number;weekType:0|1;timeIndex:number;
 maxPeds:number;maxCars:number;dealers:number;gangs:number;cops:number;other:number;
 groups:number[];
}
/** Original file order: zone, weekday/weekend, twelve two-hour periods. */
export function readPopulationCycle(text:string):PopulationCycleRow[]{
 requireAsset(text.length<=2*1024*1024&&!text.includes('\0'),'Invalid population cycle resource.');
 const rows:PopulationCycleRow[]=[];
 for(const [line,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const body=raw.split('//')[0].trim();if(!body||body.startsWith('/'))continue;
  const fields=body.replace(/,/g,' ').split(/\s+/);
  requireAsset(fields.length===24&&fields.every(t=>/^\d+$/.test(t)&&Number(t)<=255),`Population cycle line ${line+1}: expected 24 byte values.`);
  requireAsset(rows.length<480,'Too many population cycle rows.');
  const values=fields.map(Number),index=rows.length;
  rows.push({line:line+1,zoneType:Math.floor(index/24),weekType:Math.floor(index/12)%2 as 0|1,timeIndex:index%12,maxPeds:values[0],maxCars:values[1],dealers:values[2],gangs:values[3],cops:values[4],other:values[5],groups:values.slice(6)});
 }
 requireAsset(rows.length===480,'Expected all 480 population cycle rows.');return rows;
}
/** Pinned non-FIX_BUGS initialization: scale only totals below 100, using
 * integer truncation. The result can still total less than 100. Keep raw rows. */
export function preparePopulationCycle(rows:readonly PopulationCycleRow[]){
 requireAsset(rows.length===480,'Expected all 480 population cycle rows.');
 return rows.map((row,index)=>{
  requireAsset(row.zoneType===Math.floor(index/24)&&row.weekType===Math.floor(index/12)%2&&row.timeIndex===index%12&&row.groups.length===18&&row.groups.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'Invalid population cycle layout.');
  const total=row.groups.reduce((a,b)=>a+b,0);requireAsset(total>0,`Population cycle line ${row.line} has zero group weight.`);
  return {...row,groups:total<100?row.groups.map(v=>Math.floor(v*100/total)):row.groups.slice()};
 });
}
/** CPopCycle::Update uses the native day numbering, including 0/7 Sunday. */
export function populationTimeSlot(day:number,hour:number){
 requireAsset(Number.isInteger(day)&&day>=0&&day<=7&&Number.isInteger(hour)&&hour>=0&&hour<24,'Invalid native population day or hour.');
 const weekend=day===0||day===7||day===1&&hour<20||day===6&&hour>=20;
 return {weekType:weekend?1 as const:0 as const,timeIndex:Math.floor(hour/2)};
}
export function populationCycleAt(rows:readonly PopulationCycleRow[],zoneType:number,day:number,hour:number){
 requireAsset(Number.isInteger(zoneType)&&zoneType>=0&&zoneType<20&&rows.length===480,'Invalid population zone type or table.');
 const {weekType,timeIndex}=populationTimeSlot(day,hour),row=rows[zoneType*24+weekType*12+timeIndex];
 requireAsset(row.zoneType===zoneType&&row.weekType===weekType&&row.timeIndex===timeIndex,'Population cycle row identity mismatch.');return row;
}
/** Civilian population-group membership used by streaming. Gang strengths,
 * cheats and actual loaded-model membership are separate native inputs. */
export function populationCarModels(row:PopulationCycleRow,groups:readonly {index:number;models:readonly number[]}[]){
 requireAsset(row.groups.length===18&&groups.length===34,'Incomplete population car groups.');
 const models=new Set<number>();
 for(let index=0;index<18;index++){
  requireAsset(groups[index].index===index&&Number.isInteger(row.groups[index])&&row.groups[index]>=0,'Invalid population group identity or weight.');
  if(row.groups[index]!==0)for(const model of groups[index].models)models.add(model);
 }
 return models;
}

/** CStreaming::LoadZoneVehicle and CCarCtrl::ChooseCarModelToLoad: the car groups the zone streams and spawns from are
 * drawn by their popcycle percentage (CPopCycle::PickARandomGroupOfOtherPeds), then a random model of that group,
 * sixteen tries for one the caller accepts (the original: one not already loaded). Undefined when nothing fits. */
export function pickPopulationCarModel(row:PopulationCycleRow,groups:readonly {index:number;models:readonly number[]}[],random:()=>number,eligible:(model:number)=>boolean){
 requireAsset(row.groups.length===18&&groups.length>=18,'Incomplete population car groups.');
 const total=row.groups.reduce((a,b)=>a+b,0);if(total<=0)return undefined;
 for(let tries=0;tries<16;tries++){
  let r=random()*total,group=17;for(let i=0;i<18;i++){r-=row.groups[i];if(r<0){group=i;break;}}
  const models=groups[group].models;if(!models.length)continue;
  const model=models[Math.min(models.length-1,Math.floor(random()*models.length))];
  if(eligible(model))return model;
 }
 return undefined;
}

/** CPopCycle::UpdatePercentages: the zone's dealer, gang, cop and other fractions. Dealers are the zone's dealer
 * strength over 100 (at least a tenth), gangs the summed gang strength over 100 (at most a half), cops 0.3 less the
 * gang fraction (at least 0.03) where gangs reach 0.15 and the gang fraction (at least 0.02) otherwise, then
 * raised to a tenth in RESIDENTIAL_RICH, SHOPPING_POSH and AIRPORT zones, to a twentieth in RESIDENTIAL_AVERAGE, and
 * dropped to nothing on the BEACH and the GOLF_CLUB; the rest is other, or all four are normalised past one. */
export function zonePercentages(zoneType:number,gangStrengths:readonly number[]|undefined,dealerStrength=0){
 const dealers=Math.max(0.1,dealerStrength/100);
 const gangs=Math.min(0.5,(gangStrengths??[]).reduce((a,b)=>a+b,0)/100);
 let cops=gangs>=0.15?Math.max(0.03,0.3-gangs):Math.max(0.02,gangs);
 switch(zoneType){
  case 4:case 14:case 16:cops=Math.max(0.1,cops);break;
  case 5:cops=Math.max(0.05,cops);break;
  case 8:case 17:cops=0;break;
 }
 const sum=dealers+gangs+cops;
 if(sum<=1)return {dealers,gangs,cops,other:1-sum};
 return {dealers:dealers/sum,gangs:gangs/sum,cops:cops/sum,other:0};
}
/** CPopCycle::Update: the gang share of the zone's cars is the popcycle row's gang column scaled by the zone's
 * gang fraction (m_NumGangs_Cars over the car maximum). */
export function gangCarShare(row:PopulationCycleRow,gangStrengths:readonly number[]|undefined,zoneType=-1,dealerStrength=0){
 if(!gangStrengths?.length)return 0;
 return Math.max(0,Math.min(1,row.gangs/100*zonePercentages(zoneType,gangStrengths,dealerStrength).gangs));
}
/** CPopCycle::Update: the police share of the zone's cars, the row's cop column scaled by the zone's cop fraction
 * (m_NumCops_Cars over the car maximum). */
export function copCarShare(row:PopulationCycleRow,zoneType:number,gangStrengths:readonly number[]|undefined,dealerStrength=0){
 return Math.max(0,Math.min(1,row.cops/100*zonePercentages(zoneType,gangStrengths,dealerStrength).cops));
}
/** CPopCycle::PickGangToCreateMembersOf: the gang with the greatest strength in the zone, -1 when none. */
export function dominantGang(gangStrengths:readonly number[]|undefined){
 if(!gangStrengths?.length)return -1;
 let gang=-1,strength=0;
 gangStrengths.forEach((value,index)=>{if(value>strength){strength=value;gang=index;}});
 return gang;
}

/** CPopCycle::Update's Process for peds: how many dealers, gang members, cops and other civilians the zone wants
 * (m_NumDealers_Peds and friends): the popcycle maximum times the row's column for the type times the zone's
 * fraction for it; the other civilians' column is applied twice, the second time damped by rain
 * (GetCurrentPercOther_Peds: 1 less 0.8 times the square root of the rain). */
export interface PopulationTargets {dealers:number;gangs:number;cops:number;other:number}
export function populationTargets(row:PopulationCycleRow,zoneType:number,gangStrengths:readonly number[]|undefined,dealerStrength=0,rain=0,maxPeds=row.maxPeds):PopulationTargets{
 const pct=zonePercentages(zoneType,gangStrengths,dealerStrength);
 const percOther=row.other*(1-Math.sqrt(Math.max(0,Math.min(1,rain)))*0.8);
 return {
  dealers:maxPeds*(row.dealers/100*pct.dealers),
  gangs:maxPeds*(row.gangs/100*pct.gangs),
  cops:maxPeds*(row.cops/100*pct.cops),
  other:maxPeds*(row.other/100*(pct.other*percOther/100)),
 };
}
export type NewPedType='civilian'|'cop'|'dealer'|'gang';
/** CPopCycle::FindNewPedType: each type's chance is its target less its living count (a chance under two is scaled
 * by a random fraction; refused types get -10), and the types are tried from the highest chance down while one is
 * positive. Returns that order; the caller takes the first it can produce.
 *
 * CPopulation::m_bOnlyCreateRandomGangMembers (`onlyGangs`, SET_ONLY_CREATE_GANG_MEMBERS) makes the gangs' chance 50,
 * though refusing them still wins, and a gang that cannot be made then makes nobody rather than the next type. */
export function newPedTypeOrder(targets:PopulationTargets,living:{civilians:number;cops:number;dealers:number;gangs:number},random:()=>number,refuse:{gangs?:boolean;cops?:boolean;dealers?:boolean;onlyGangs?:boolean}={}):NewPedType[]{
 const chances:[NewPedType,number][]=[
  ['civilian',targets.other-living.civilians],
  ['cop',refuse.cops?-10:targets.cops-living.cops],
  ['dealer',refuse.dealers?-10:targets.dealers-living.dealers],
  ['gang',refuse.gangs?-10:refuse.onlyGangs?50:targets.gangs-living.gangs],
 ];
 for(const entry of chances)if(entry[1]<2)entry[1]*=random();
 const order=chances.filter(([,chance])=>chance>0).sort((a,b)=>b[1]-a[1]).map(([type])=>type);
 const gang=order.indexOf('gang');
 return refuse.onlyGangs&&gang>=0?order.slice(0,gang+1):order;
}
/** CPopCycle::PickGangToCreateMembersOf: the gang whose share of the zone's strength exceeds its share of the living
 * gang members by the most; -1 without any strength. */
export function gangToCreateMembersOf(gangStrengths:readonly number[]|undefined,living:readonly number[],targetGangs:number){
 if(!gangStrengths?.length)return -1;
 const sum=gangStrengths.reduce((a,b)=>a+b,0);if(sum<=0)return -1;
 let best=-1,bestScore=-Infinity;
 gangStrengths.forEach((strength,gang)=>{
  const score=strength/sum-(targetGangs>0?(living[gang]??0)/targetGangs:0);
  if(score>bestScore){bestScore=score;best=gang;}
 });
 return best;
}
/** CPopulation::PedDensityMultiplier (SET_PED_DENSITY_MULTIPLIER), 1 at Initialise: FindNumberOfPedsWeCanPlaceOnBenches
 * scales the peds the street may hold by it (AddToPopulation's own use is unreversed), so the targets and the caps
 * scale together. */
export function scalePedTargets<T extends PopulationTargets>(targets:T,multiplier:number):T{
 if(multiplier===1)return targets;
 return {...targets,dealers:targets.dealers*multiplier,gangs:targets.gangs*multiplier,cops:targets.cops*multiplier,other:targets.other*multiplier};
}
export function scalePedLimits<T extends {civilians:number;total:number}>(limits:T|undefined,multiplier:number){
 if(!limits||multiplier===1)return limits;
 return {...limits,civilians:Math.floor(limits.civilians*multiplier),total:Math.floor(limits.total*multiplier)};
}
