import {requireAsset} from './binary';
import type {HandlingRecord} from './handling';
import type {VehicleIdeRecord} from './vehicleIde';
import {prepareHandling} from '../simulation/nativeHandling';
/** Read the native 210 × 14-byte name table supplied by the caller. No model-ID
 * arithmetic or guessed enum-to-name conversion substitutes for this table. */
export function readNativeHandlingNames(bytes:Uint8Array):string[]{
  requireAsset(bytes.length===210*14,'Handling name table requires exactly 2,940 bytes.');
  const names:string[]=[];
  for(let i=0;i<210;i++){
    const entry=bytes.subarray(i*14,(i+1)*14),end=entry.indexOf(0);
    requireAsset(end>0,'Handling table names must be nonempty and NUL-terminated.');
    const name=entry.subarray(0,end);requireAsset(name.every(n=>n>=33&&n<=126),'Handling table contains an invalid name.');
    names.push(String.fromCharCode(...name));
  }
  return names;
}
function validateNames(names:readonly string[]){
  requireAsset(names.length===210&&names.every(n=>n.length>0&&n.length<14&&/^[\x21-\x7e]+$/.test(n)),'Invalid native handling name table.');
}
/** Handling loader's FindExactWord is a prefix comparison despite its name.
 * Preserve first matching table entry and last loaded row for each entry. */
export function indexNativeHandling(records:readonly HandlingRecord[],names:readonly string[]){
  validateNames(names);const byId=new Map<number,HandlingRecord>(),warnings:string[]=[];
  for(const record of records){
    const id=names.findIndex(name=>record.name.startsWith(name));
    if(id<0){warnings.push(`Handling line ${record.line}: no native table entry for ${record.name}.`);continue;}
    if(record.name!==names[id])warnings.push(`Handling line ${record.line}: prefix ${names[id]} selects table entry ${id}.`);
    if(byId.has(id))warnings.push(`Handling line ${record.line}: replaces table entry ${id} from line ${byId.get(id)!.line}.`);
    byId.set(id,record);
  }
  return {byId,warnings};
}
/** VehicleModelInfo::SetHandlingId uses exact matching, unlike row loading. */
export function resolveVehicleHandling(vehicle:VehicleIdeRecord,records:readonly HandlingRecord[],names:readonly string[]){
  validateNames(names);const handlingId=names.indexOf(vehicle.handling);
  requireAsset(handlingId>=0,`Vehicle ${vehicle.model}: unknown exact handling name ${vehicle.handling}.`);
  const {byId,warnings}=indexNativeHandling(records,names),record=byId.get(handlingId);
  requireAsset(record,`Vehicle ${vehicle.model}: native handling entry ${handlingId} was not loaded.`);
  return {vehicle,handlingId,record,handling:prepareHandling(record,handlingId),warnings};
}
