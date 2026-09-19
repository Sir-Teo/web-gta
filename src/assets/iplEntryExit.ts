import {requireAsset} from './binary';
/** One IPL `enex` row as CFileLoader::LoadEntryExit (0x5B8030) scans it: `%f %f %f %f %f %f %f %f %f %f %f %d %d %s %d %d
 * %d %d` after LoadLine turns commas into spaces. Angles stay in degrees, positions in native world units. */
export interface IplEntryExit {
 /** Entrance centre. */
 position:[number,number,number];
 /** Entrance rect rotation, degrees. */
 angle:number;
 /** Entrance rect size on native X/Y (the third range value is read and unused). */
 size:[number,number];
 exit:[number,number,number];exitAngle:number;
 /** eAreaCodes the spawn point puts CGame::currArea in. */
 area:number;
 /** CEntryExit::eFlags. */
 flags:number;
 /** m_szName: the quoted name with its quotes removed; empty when unnamed. */
 name:string;
 skyColor:number;pedCount:number;timeOn:number;timeOff:number;
}
export function readTextEntryExit(fields:string[]):IplEntryExit{
 requireAsset(fields.length===18,'IPL entry exit requires 18 fields.');
 const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i,integer=/^[+-]?\d+$/;
 requireAsset(fields.slice(0,11).every(s=>numeric.test(s))&&[11,12,14,15,16,17].every(i=>integer.test(fields[i])),'Invalid IPL entry exit number.');
 // strrchr(name, '"') cuts at the last quote and skips the first character.
 const raw=fields[13],quote=raw.lastIndexOf('"'),name=quote>=0?raw.slice(1,quote):raw;
 requireAsset(name.length<8,'IPL entry exit name exceeds m_szName.');
 const n=fields.map(Number),f=Math.fround;
 const value:IplEntryExit={position:[f(n[0]),f(n[1]),f(n[2])],angle:f(n[3]),size:[f(n[4]),f(n[5])],exit:[f(n[7]),f(n[8]),f(n[9])],exitAngle:f(n[10]),
  area:n[11],flags:n[12],name,skyColor:n[14],pedCount:n[15],timeOn:n[16],timeOff:n[17]};
 requireAsset([...value.position,...value.exit].every(v=>Math.abs(v)<=1e7)&&value.size.every(v=>v>=0),'Invalid IPL entry exit geometry.');
 requireAsset(value.area>=0&&value.area<=255&&value.flags>=0&&value.flags<=0xffff,'Invalid IPL entry exit area or flags.');
 return value;
}
