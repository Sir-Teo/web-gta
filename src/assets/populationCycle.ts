import {requireAsset} from './binary';
export const POPULATION_ZONE_TYPES=['BUSINESS','DESERT','ENTERTAINMENT','COUNTRYSIDE','RESIDENTIAL_RICH','RESIDENTIAL_AVERAGE','RESIDENTIAL_POOR','GANGLAND','BEACH','SHOPPING','PARK','INDUSTRY','ENTERTAINMENT_BUSY','SHOPPING_BUSY','SHOPPING_POSH','RESIDENTIAL_RICH_SECLUDED','AIRPORT','GOLF_CLUB','OUT_OF_TOWN_FACTORY','AIRPORT_RUNWAY'] as const;
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
