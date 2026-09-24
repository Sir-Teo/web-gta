import {readBinaryCarGenerator,readTextCarGenerator,type IplCarGenerator} from './iplCarGenerator';
import {readTimecycleBox,type TimecycleBox} from './timecycleBoxes';
import {readTextEntryExit,type IplEntryExit} from './iplEntryExit';
import { BinaryReader, requireAsset } from './binary';
export interface IplInstance {
  modelId: number; modelName: string | null; instanceType: number; interior: number;
  position: [number, number, number]; rotation: [number, number, number, number]; lodIndex: number;
}
export interface IplData { format: 'text' | 'binary'; instances: IplInstance[]; timecycleBoxes:TimecycleBox[]; carGenerators:IplCarGenerator[]; entryExits:IplEntryExit[]; warnings: string[];   /** The `occl` section: CFileLoader::LoadOcclusionVolume records (text IPLs only). */
  occluders:IplOccluder[];
  /** The `grge` section: CFileLoader::LoadGarage records (text IPLs only). */
  garages:IplGarage[];
  /** The `auzo` section: CFileLoader::LoadAudioZone records (text IPLs only). */
  audioZones?:IplAudioZone[];
  /** The `cull` section: CFileLoader::LoadCullZone records (text IPLs only). */
  cullZones?:IplCullZone[];
}
/** One `cull` row as CFileLoader::LoadCullZone (0x5B4B40) scans it: a centre, the two half-axes (vec1, vec2), the
 * bottom and top, and the eZoneAttributes flags; fourteen fields make a mirror zone (its flags are eMirrorFlags). */
export interface IplCullZone {center:[number,number,number];vec1:[number,number];minZ:number;vec2:[number,number];maxZ:number;flags:number;mirror?:{normal:[number,number,number];v:number}}
export function readCullZoneLine(line:string):IplCullZone|undefined{
  const f=line.replace(/,/g,' ').trim().split(/\s+/),v=f.map(Number);
  if(f.length<11||!v.slice(0,9).every(Number.isFinite)||!/^-?\d+$/.test(f[9]))return;
  const zone:IplCullZone={center:[v[0],v[1],v[2]],vec1:[v[3],v[4]],minZ:v[5],vec2:[v[6],v[7]],maxZ:v[8],flags:Number.parseInt(f[9],10)};
  if(f.length>=14&&v.slice(10,14).every(Number.isFinite))zone.mirror={normal:[v[10],v[11],v[12]],v:v[13]};
  return zone;
}
/** A `grge` line as CFileLoader::LoadGarage scans it: a corner, the door's front direction, the far corner, the door
 * flags, the eGarageType and the name the script addresses it by. */
/** One `auzo` row: a box (nine fields) or a sphere (seven), active when its flags are 1. */
export interface IplAudioZone {name:string;id:number;active:boolean;box?:{min:[number,number,number];max:[number,number,number]};sphere?:{center:[number,number,number];radius:number}}
/** CFileLoader::LoadAudioZone (0x5B4D70): "%s %d %d" then six floats for a box, or four for a sphere. */
export function readAudioZoneLine(line:string):IplAudioZone|undefined{
  const f=line.replace(/,/g,' ').trim().split(/\s+/);if(f.length<7)return;
  const name=f[0],id=Number.parseInt(f[1],10),flags=Number.parseInt(f[2],10),v=f.slice(3).map(Number);
  if(!Number.isInteger(id)||!Number.isInteger(flags))return;
  if(v.length>=6&&v.slice(0,6).every(Number.isFinite))return {name,id,active:flags===1,box:{min:[v[0],v[1],v[2]],max:[v[3],v[4],v[5]]}};
  if(v.slice(0,4).every(Number.isFinite))return {name,id,active:flags===1,sphere:{center:[v[0],v[1],v[2]],radius:v[3]}};
}
export interface IplGarage {corner:[number,number,number];front:[number,number];far:[number,number,number];flags:number;type:number;name:string}
const limit = 200000;
function validate(instance: IplInstance): IplInstance {
  requireAsset(Number.isInteger(instance.modelId) && instance.modelId >= 0 && instance.modelId <= 65535, 'Invalid IPL model ID.');
  requireAsset(Number.isInteger(instance.instanceType) && instance.instanceType >= 0 && instance.instanceType <= 0xffffffff, 'Invalid IPL instance flags.');
  requireAsset(Number.isInteger(instance.lodIndex) && instance.lodIndex >= -1 && instance.lodIndex <= 0x7fffffff, 'Invalid IPL LOD reference.');
  requireAsset(instance.position.every(n => Number.isFinite(n) && Math.abs(n) <= 1e7), 'IPL position exceeds the coordinate limit.');
  requireAsset(instance.rotation.every(Number.isFinite) && Math.abs(Math.hypot(...instance.rotation) - 1) <= 0.01, 'IPL rotation must be a unit quaternion.');
  instance.interior = instance.instanceType & 255;
  return instance;
}
export function readIpl(bytes: Uint8Array): IplData {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'IPL exceeds the 64 MiB source limit.');
  if (bytes.length >= 4 && bytes[0] === 98 && bytes[1] === 110 && bytes[2] === 114 && bytes[3] === 121) return readBinary(bytes);
  let end = bytes.length; while (end > 0 && bytes[end - 1] === 0) end--;
  return readText(new TextDecoder('windows-1252').decode(bytes.subarray(0, end)));
}
function readBinary(bytes: Uint8Array): IplData {
  const reader = new BinaryReader(bytes); reader.take(4);
  const counts = Array.from({ length: 6 }, () => reader.u32());
  const ranges = Array.from({ length: 6 }, () => ({ offset: reader.u32(), size: reader.u32() }));
  const count = counts[0], offset = ranges[0].offset;
  requireAsset(count <= limit, 'IPL exceeds the 200,000 instance limit.');
  requireAsset(count === 0 || offset >= 76 && offset + count * 40 <= bytes.length, 'IPL instance range is outside the file.');
  const carCount=counts[4],carOffset=ranges[4].offset;
  requireAsset(carCount<=limit,'IPL exceeds the 200,000 car generator limit.');
  requireAsset(carCount===0||carOffset>=76&&carOffset+carCount*48<=bytes.length,'IPL car generator range is outside the file.');
  requireAsset(count===0||carCount===0||offset+count*40<=carOffset||carOffset+carCount*48<=offset,'Overlapping IPL instance and car generator ranges.');
  const instances: IplInstance[] = [];
  reader.position = offset;
  for (let i = 0; i < count; i++) {
    const position: IplInstance['position'] = [reader.f32(), reader.f32(), reader.f32()];
    const rotation: IplInstance['rotation'] = [reader.f32(), reader.f32(), reader.f32(), reader.f32()];
    instances.push(validate({ position, rotation, modelId: reader.i32(), instanceType: reader.u32(), lodIndex: reader.i32(), interior: 0, modelName: null }));
  }
  const carGenerators:IplCarGenerator[]=[];reader.position=carOffset;
  for(let i=0;i<carCount;i++)carGenerators.push(readBinaryCarGenerator(reader));
  return { format: 'binary', instances, timecycleBoxes:[],carGenerators,entryExits:[],occluders:[],garages:[], warnings: counts.some((count,i)=>i!==0&&i!==4&&count>0) ? ['Other binary IPL sections are not imported.'] : [] };
}
/** An `occl` line: centre x and y, the bottom z, width, length, height, then the optional rotations about Z, Y and
 * X in degrees and the flags (CFileLoader::LoadOcclusionVolume reads all ten, the trailing ones defaulting to 0). */
export interface IplOccluder {centerX:number;centerY:number;bottomZ:number;width:number;length:number;height:number;rotZ:number;rotY:number;rotX:number;flags:number}
function readTextOccluder(fields:string[],line:number):IplOccluder{
  requireAsset(fields.length>=7&&fields.length<=10,`IPL line ${line}: expected 7 to 10 occluder fields.`);
  const values=fields.map(Number);requireAsset(values.every(Number.isFinite),`IPL line ${line}: invalid occluder field.`);
  const [centerX,centerY,bottomZ,width,length,height,rotZ,rotY=0,rotX=0,flags=0]=values;
  return {centerX,centerY,bottomZ,width,length,height,rotZ,rotY,rotX,flags:flags|0};
}
function readText(text: string): IplData {
  const timecycleBoxes:TimecycleBox[]=[],carGenerators:IplCarGenerator[]=[],entryExits:IplEntryExit[]=[],occluders:IplOccluder[]=[],garages:IplGarage[]=[],audioZones:IplAudioZone[]=[],cullZones:IplCullZone[]=[];
  const instances: IplInstance[] = [], skipped = new Set<string>(); let section = '';
  for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    if (line.toLowerCase() === 'end') { section = ''; continue; }
    if (!section) { section = line.toLowerCase(); if (section !== 'inst' && section !== 'tcyc' && section !== 'cars' && section !== 'enex' && section !== 'occl' && section !== 'grge' && section !== 'auzo' && section !== 'cull') skipped.add(section); continue; }
    if(section==='occl'){occluders.push(readTextOccluder(line.replace(/,/g,' ').split(/\s+/),index+1));requireAsset(occluders.length<=4096,'IPL exceeds the 4,096 occluder limit.');continue;}
    if(section==='tcyc'){timecycleBoxes.push(readTimecycleBox(line.replace(/,/g,' ').split(/\s+/),index+1));requireAsset(timecycleBoxes.length<=4096,'IPL exceeds the 4,096 timecycle modifier limit.');continue;}
    if(section==='cars'){carGenerators.push(readTextCarGenerator(line.replace(/,/g,' ').split(/\s+/)));requireAsset(carGenerators.length<=limit,'IPL exceeds the 200,000 car generator limit.');continue;}
    if(section==='enex'){entryExits.push(readTextEntryExit(line.replace(/,/g,' ').split(/\s+/)));requireAsset(entryExits.length<=400,'IPL exceeds the 400 entry exit pool.');continue;}
    // LoadGarage keeps a line only when sscanf fills all eleven fields: two SF rows have no name and are dropped.
    if(section==='auzo'){const zone=readAudioZoneLine(line);if(zone)audioZones.push(zone);continue;}
    if(section==='cull'){const zone=readCullZoneLine(line);if(zone)cullZones.push(zone);continue;}
    if(section==='grge'){const f=line.replace(/,/g,' ').split(/\s+/);if(f.length>=11&&f[10]&&f.slice(0,8).every(v=>Number.isFinite(Number(v)))&&/^-?\d+$/.test(f[8])&&/^-?\d+$/.test(f[9]))garages.push({corner:[+f[0],+f[1],+f[2]],front:[+f[3],+f[4]],far:[+f[5],+f[6],+f[7]],flags:+f[8],type:+f[9],name:f[10]});continue;}
    if (section !== 'inst') continue;
    const fields = line.replace(/,/g, ' ').split(/\s+/);
    requireAsset(fields.length === 11, `IPL line ${index + 1}: expected 11 San Andreas instance fields.`);
    requireAsset(/^[0-9]+$/.test(fields[0]) && /^[0-9]+$/.test(fields[2]) && /^-?[0-9]+$/.test(fields[10]), `IPL line ${index + 1}: invalid integer field.`);
    requireAsset(fields[1].length <= 24 && !/[\x00-\x20\\/.:]/.test(fields[1]), `IPL line ${index + 1}: invalid model name.`);
    instances.push(validate({ modelId: Number(fields[0]), modelName: fields[1], instanceType: Number(fields[2]), interior: 0,
      position: fields.slice(3, 6).map(Number) as IplInstance['position'], rotation: fields.slice(6, 10).map(Number) as IplInstance['rotation'], lodIndex: Number(fields[10]) }));
    requireAsset(instances.length <= limit, 'IPL exceeds the 200,000 instance limit.');
  }
  requireAsset(!section, 'Unterminated IPL section.');
  return { format: 'text', instances, timecycleBoxes,carGenerators,entryExits,occluders,garages,audioZones,cullZones, warnings: [...skipped].map(name => `IPL section ${name} is not imported.`) };
}

export function matchingPlacements(data: IplData, modelName: string, modelId: number | undefined, interior: number): IplInstance[] {
  requireAsset(Number.isInteger(interior) && interior >= 0 && interior <= 255, 'Interior must be an integer from 0 to 255.');
  requireAsset(data.format !== 'binary' || modelId !== undefined, 'Binary IPL placement requires an IDE model ID.');
  return data.instances.filter(instance => instance.interior === interior && (instance.modelName !== null ? instance.modelName.toLowerCase() === modelName.toLowerCase() : instance.modelId === modelId));
}
