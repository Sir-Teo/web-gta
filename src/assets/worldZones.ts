import {requireAsset} from './binary';
type Point=[number,number,number];
export interface ZoneRecord {infoLabel:string;textLabel:string;type:0|1|3;min:Point;max:Point;level:number;line:number;source:string}
export interface WorldZone extends ZoneRecord {zoneInfoIndex:number}
export interface WorldZones {population?:import('./scmZonePopulation').ZonePopulation[];navigation:WorldZone[];map:WorldZone[];infoLabels:string[]}
export function readZones(text:string,source:string):ZoneRecord[]{
 requireAsset(text.length<=1024*1024&&!text.includes('\0'),'Invalid zone resource.');
 const zones:ZoneRecord[]=[];let section=false;
 for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const line=raw.split('#')[0].trim();if(!line)continue;
  if(line==='zone'){requireAsset(!section,'Nested zone section.');section=true;continue;}
  if(line==='end'){requireAsset(section,'Unexpected zone section end.');section=false;continue;}
  requireAsset(section,'Zone record outside zone section.');const fields=line.replace(/,/g,' ').split(/\s+/);
  requireAsset(fields.length===10&&[fields[0],fields[9]].every(s=>/^[a-z0-9_]{1,7}$/i.test(s)),'Invalid zone fields or label.');
  requireAsset(/^[013]$/.test(fields[1])&&/^[0-3]$/.test(fields[8]),'Unsupported zone type or level.');
  const coords=fields.slice(2,8).map(s=>{requireAsset(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s),'Invalid zone coordinate.');const n=Math.fround(Number(s));requireAsset(Number.isFinite(n)&&n>=-32768&&n<=32767,'Zone coordinate exceeds native int16 range.');return n;});
  zones.push({infoLabel:fields[0],textLabel:fields[9],type:Number(fields[1]) as ZoneRecord['type'],min:coords.slice(0,3) as Point,max:coords.slice(3) as Point,level:Number(fields[8]),source,line:index+1});requireAsset(zones.length<=418,'Too many source zones.');
 }
 requireAsset(!section,'Unterminated zone section.');return zones;
}
/** Preserve source coordinates separately. CTheZones::CreateZone truncates to
 * signed int16, orders endpoints, uppercases labels and shares info by label. */
export function prepareWorldZones(records:readonly ZoneRecord[]):WorldZones{
 const root=(infoLabel:string,type:0|3):WorldZone=>({infoLabel,textLabel:infoLabel,type,min:[-3000,-3000,-2000],max:[3000,3000,2000],level:0,line:0,source:'CTheZones::Init',zoneInfoIndex:0});
 const navigation=[root('SAN_AND',0)],map=[root('THEMAP',3)],infoLabels=['SAN_AND'];
 for(const r of records){
  const min=r.min.map((v,i)=>Math.min(Math.trunc(v),Math.trunc(r.max[i]))) as Point,max=r.max.map((v,i)=>Math.max(Math.trunc(v),Math.trunc(r.min[i]))) as Point,infoLabel=r.infoLabel.toUpperCase();
  let zoneInfoIndex=0;
  if(r.type!==3){zoneInfoIndex=infoLabels.indexOf(infoLabel);if(zoneInfoIndex<0){zoneInfoIndex=infoLabels.length;infoLabels.push(infoLabel);}}
  const target=r.type===3?map:navigation;requireAsset(target.length<(r.type===3?39:380),'Native zone capacity exceeded.');
  target.push({...r,min,max,infoLabel,textLabel:r.textLabel.toUpperCase(),zoneInfoIndex});
 }
 return {navigation,map,infoLabels};
}
const inside=(zone:WorldZone,p:Point)=>p.every((v,i)=>v>=zone.min[i]&&v<=zone.max[i]);
/** CTheZones::FindZone (reversed): whether any navigation zone whose label is `name` holds the point. The info type
 * compares the zone's own name (GetInfoLabel), the navigation type its text label (GetNaviLabel), which a zone
 * split in parts shares: OCEAF1, OCEAF2 and OCEAF3 are all OCEAF. */
export function findZone(zones:WorldZones,p:Point,name:string,type:'info'|'navi'){
 validatePoint(p);const wanted=name.toUpperCase();
 return zones.navigation.some(zone=>(type==='info'?zone.infoLabel:zone.textLabel)===wanted&&inside(zone,p));
}
const size=(zone:WorldZone)=>zone.max[0]-zone.min[0]+zone.max[1]-zone.min[1];
function validatePoint(p:Point){requireAsset(p.length===3&&p.every(Number.isFinite),'Invalid native zone query point.');}
/** Native axes: x east, y north, z up. Ties retain earlier source order. */
export function worldZoneAt(zones:WorldZones,p:Point,navigationOnly=false){
 validatePoint(p);let best=zones.navigation[0];requireAsset(best?.infoLabel==='SAN_AND','Missing native navigation fallback.');let bestSize=size(best);
 for(const zone of zones.navigation){if(navigationOnly&&zone.type!==0||!inside(zone,p))continue;const next=size(zone);if(next<bestSize){best=zone;bestSize=next;}}
 return best;
}
export function worldLevelAt(zones:WorldZones,p:Point){validatePoint(p);requireAsset(zones.map[0]?.infoLabel==='THEMAP','Missing native map fallback.');return zones.map.slice(1).find(zone=>inside(zone,p))?.level??zones.map[0].level;}
