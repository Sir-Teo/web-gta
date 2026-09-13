import {requireAsset} from './binary';
export interface VehicleIdeRecord {
  id:number;model:string;dictionary:string;type:string;handling:string;gameName:string;animation:string;vehicleClass:string;
  frequency:number;flags:number;components:number;misc?:number;frontWheelSize?:number;rearWheelSize?:number;wheelUpgradeClass?:number;
  line:number;issues:string[];
}
/** Preserve cars-section definitions in source units, including optional fields.
 * Missing wheel sizes stay missing; no uninitialized/native-fix defaults are invented. */
export function readVehicleIde(text:string){
  requireAsset(text.length<=4*1024*1024,'Vehicle IDE exceeds the 4 MiB text limit.');
  const records:VehicleIdeRecord[]=[];let section='';
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const line=raw.split('#')[0].replace(/[\x01-\x20,]/g,' ').trim();if(!line)continue;
    if(line.toLowerCase()==='end'){section='';continue;}
    if(!section){section=line.toLowerCase();continue;}if(section!=='cars')continue;
    const t=line.split(/\s+/),label=`Vehicle IDE line ${index+1}`;
    requireAsset(!line.includes('\0')&&t.length>=11&&t.length<=15,`${label}: expected 11–15 columns.`);
    const integer=(i:number)=>{const n=Number(t[i]);requireAsset(/^[+-]?\d+$/.test(t[i])&&Number.isInteger(n)&&n>=-2147483648&&n<=2147483647,`${label}: invalid integer column ${i+1}.`);return n;};
    const id=integer(0);requireAsset(id>=0&&id<=65535,`${label}: unsupported model ID.`);
    for(const [i,max] of [[1,23],[2,23],[3,7],[4,15],[5,31],[6,15],[7,15]])requireAsset(t[i].length<=max&&!/[\\/.:]/.test(t[i]),`${label}: invalid name column ${i+1}.`);
    requireAsset(/^(?:0x)?[0-9a-f]{1,8}$/i.test(t[10]),`${label}: invalid hexadecimal components.`);
    const r:VehicleIdeRecord={id,model:t[1],dictionary:t[2],type:t[3],handling:t[4],gameName:t[5],animation:t[6],vehicleClass:t[7],frequency:integer(8),flags:integer(9),components:parseInt(t[10].replace(/^0x/i,''),16),line:index+1,issues:[]};
    if(t.length>11)r.misc=integer(11);
    for(const [i,key] of [[12,'frontWheelSize'],[13,'rearWheelSize']] as const)if(t.length>i){
      const value=Number(t[i]);requireAsset(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t[i])&&Number.isFinite(Math.fround(value)),`${label}: invalid wheel size.`);r[key]=value;
      if(value<=0)r.issues.push(`${key} is not positive.`);
    }
    if(t.length>14)r.wheelUpgradeClass=integer(14);
    const regular=['car','mtruck','quad','heli','plane','trailer','bike','bmx'];
    if(regular.includes(r.type)&&t.length<14)r.issues.push('Vehicle type requires both wheel sizes for native setup.');
    else if(r.type==='f_plane'&&r.misc===undefined)r.issues.push('Flying-plane type requires the misc column.');
    else if(!regular.includes(r.type)&&!['f_plane','f_heli','boat','train'].includes(r.type))r.issues.push(`Unrecognized vehicle type ${r.type}.`);
    records.push(r);requireAsset(records.length<=50000,'Vehicle IDE exceeds the 50,000 record limit.');
  }
  return {records};
}
export function indexVehicleIde(records:readonly VehicleIdeRecord[]){return new Map(records.map(record=>[record.id,record]));}
