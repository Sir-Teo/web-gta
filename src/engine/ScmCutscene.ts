import {requireAsset} from '../assets/binary';
/* The cutscene a script loads, runs and clears, and the special-character slots it fills beside it. The
 * operands come from the pinned Sanny Builder schema this project generates its opcode table from, which names
 * and types each one; gta-reversed registers none of these commands. Playing the cutscene is a host's, so what
 * is kept is the state the script itself asks about: whether the data is in, whether it is running, and whether
 * it has finished. The script's own loop is load, wait for loaded, start, wait for finished, clear. */
export const CUTSCENE_NONE=0,CUTSCENE_LOADING=1,CUTSCENE_LOADED=2,CUTSCENE_RUNNING=3,CUTSCENE_FINISHED=4;
/** CStreaming's special-character slots, which LOAD_SPECIAL_CHARACTER fills by number. */
export const TOTAL_SPECIAL_CHARACTERS=21;
/** constants.h: the model id of the first special-character slot (MODEL_SPECIAL01). */
export const SPECIAL_MODELS_RESOURCE_ID=290;
/** eModelID: the ped models the slots stand behind, MODEL_SPECIAL01 to MODEL_SPECIAL10 (300 on is MODEL_CUTOBJ01). */
export const SPECIAL_PED_MODELS=10;
export class ScmCutscene {
 /** The name the script asked for, and where that request has got to. */
 name?:string;status=CUTSCENE_NONE;
 /** LOAD_CUTSCene: the data is asked for and nothing is running yet. */
 load(name:string){
  requireAsset(name.length>0,'Invalid cutscene name.');
  this.name=name;this.status=CUTSCENE_LOADING;this.wasSkipped=false;this.time=0;
 }
 /** What a host calls once the data is in. */
 loaded(){if(this.status===CUTSCENE_LOADING)this.status=CUTSCENE_LOADED;}
 get hasLoaded(){return this.status===CUTSCENE_LOADED||this.status===CUTSCENE_RUNNING||this.status===CUTSCENE_FINISHED;}
 /** START_CUTSCENE, which does nothing until the data is in. */
 start(){if(this.status===CUTSCENE_LOADED)this.status=CUTSCENE_RUNNING;}
 get running(){return this.status===CUTSCENE_RUNNING;}
 /** What a host calls when the cutscene runs out, and the question the script waits on. */
 finish(){if(this.status===CUTSCENE_RUNNING)this.status=CUTSCENE_FINISHED;}
 get hasFinished(){return this.status===CUTSCENE_FINISHED;}
 /** CLEAR_CUTSCENE: everything goes. */
 clear(){this.name=undefined;this.status=CUTSCENE_NONE;this.wasSkipped=false;this.time=0;}
 /** Whether this cutscene was skipped, which the script asks after it has finished. A clear forgets it along
  * with everything else, so the question only answers for the cutscene just played. */
 wasSkipped=false;
 /** SET_CUTSCENE_OFFSET and GET_CUTSCENE_OFFSET: where the cutscene is played. */
 readonly offset={x:0,y:0,z:0};
 setOffset(x:number,y:number,z:number){
  requireAsset([x,y,z].every(Number.isFinite),'Invalid cutscene offset.');
  Object.assign(this.offset,{x,y,z});
 }
 /** GET_CUTSCENE_TIME, which a host advances while the cutscene runs. */
 time=0;
 /** CCutsceneMgr::SkipCutscene: a running cutscene the player skips is over, and says so. */
 skip(){if(this.status!==CUTSCENE_RUNNING)return;this.wasSkipped=true;this.status=CUTSCENE_FINISHED;}
}
export class ScmSpecialCharacters {
 /** The model each slot holds, or nothing where the slot is empty. */
 readonly slots:(string|undefined)[]=Array(TOTAL_SPECIAL_CHARACTERS).fill(undefined);
 private index(slotId:number){
  // The script counts its slots from one and the streamer from nothing, as the loading command's own operand
  // shows: the first special character the script asks for is slot one.
  const index=slotId-1;
  requireAsset(Number.isInteger(index)&&index>=0&&index<TOTAL_SPECIAL_CHARACTERS,'Special character slot out of range.');
  return index;
 }
 load(slotId:number,modelName:string){this.slots[this.index(slotId)]=modelName;}
 unload(slotId:number){this.slots[this.index(slotId)]=undefined;}
 at(slotId:number){return this.slots[this.index(slotId)];}
 get count(){return this.slots.filter(Boolean).length;}
}
