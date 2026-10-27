import {DEFAULT_SPRINT_CAPACITY} from '../simulation/nativePlayerSprint';
import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions} from './scm';
export interface ScmSavePoint {
 /** Stable save key: the PICKUPSAVE global slot. */
 id:string;slot:number;
 /** Native pickup position and where the player stands after saving. */
 pickup:[number,number,number];respawn:[number,number,number];heading:number;
}
/** PICKUPSAVE is object -43 in the pickup commands. */
const SAVE_MODEL=-43;
/** Global variables are addressed by byte offset: $886 (the first pickup X) is 3544. */
const GLOBAL={pickupX:886*4,pickupY:904*4,pickupZ:922*4,respawnX:940*4,respawnY:958*4,respawnZ:976*4,heading:994*4},SLOTS=18;
/** The INITIAL mission's save points (also created by the PSAVE1 thread). Each slot's disc position, the spot the player is put back
 * on afterwards and its heading come from consecutive globals: $886/$904/$922 the pickup, $940/$958/$976 the respawn and $994 the heading. */
export function readInitialSavePoints(bytes:Uint8Array){
 const header=readScmHeader(bytes),mission=header.missions[0];
 requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end);
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const globals=new Map<number,number>(),points:ScmSavePoint[]=[];
 for(const instruction of code){
  if(instruction.name==='SET_VAR_INT'||instruction.name==='SET_VAR_FLOAT'){
   const [target,value]=instruction.parameters;
   if(target?.type===2&&typeof target.value==='number'&&typeof value?.value==='number'&&[1,4,5,6].includes(value.type))globals.set(target.value,value.value);
   continue;
  }
  if(instruction.name!=='CREATE_PICKUP')continue;
  const [model,,x,y,z]=instruction.parameters;
  if(model?.value!==SAVE_MODEL||x?.type!==2||typeof x.value!=='number')continue;
  const slot=(x.value-GLOBAL.pickupX)/4;
  requireAsset(Number.isInteger(slot)&&slot>=0&&slot<SLOTS,'Unexpected save point global.');
  requireAsset(y?.type===2&&y.value===GLOBAL.pickupY+slot*4&&z?.type===2&&z.value===GLOBAL.pickupZ+slot*4,'Save point globals are not consecutive.');
  const read=(base:number)=>{const value=globals.get(base+slot*4);requireAsset(value!==undefined&&Number.isFinite(value),`Save point global ${base/4+slot} has no literal.`);return value!;};
  points.push({id:`save:${slot}`,slot,pickup:[read(GLOBAL.pickupX),read(GLOBAL.pickupY),read(GLOBAL.pickupZ)],respawn:[read(GLOBAL.respawnX),read(GLOBAL.respawnY),read(GLOBAL.respawnZ)],heading:read(GLOBAL.heading)});
  requireAsset(points.length<=SLOTS,'Too many save points.');
 }
 return points;
}
/** CGenericGameStorage::DoGameSpecificStuffBeforeSave (0x618F50): full health up to 200, six hours pass, the wanted level clears
 * and sprint energy is restored. Ropes, pickup objects and the gang war are not in the browser. */
export function nativeSaveEffects(state:{health:number;maxHealth:number;timeMinutes:number;sprintCapacity?:number}){
 return {health:Math.min(200,state.maxHealth),timeMinutes:(state.timeMinutes+6*60)%1440,passedMinutes:6*60,wanted:0,stamina:state.sprintCapacity??DEFAULT_SPRINT_CAPACITY};
}
