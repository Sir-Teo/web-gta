/* CScriptsForBrains, pinned gta-reversed ead3051 (`ScriptsForBrains.h`'s `tScriptForBrains` record and
 * `GetIndexOfScriptBrainWithThisName` 0x46AA30, reversed); the rest is unreversed there and read from the iOS
 * executable (the table at 0x100793fa0; AddNewScriptBrain 0x1001f4e00, SwitchAllObjectBrainsWithThisID 0x1001f4dd4,
 * CheckIfNewEntityNeedsScript 0x1001f4f10). Seventy slots, each pointing a streamed script at the thing that should
 * start it: an object model, a random ped, or a named attractor. The record's fields and the commands' operands line
 * up one to one: a streamed script index, the model, a percentage chance, an activation radius and a grouping id.
 * Starting the script when such a thing is made belongs to a host. */
/** CScriptsForBrains' seventy slots. */
export const NUM_SCRIPT_BRAINS=70;
/** What kind of thing starts the script, which is which command made the entry. */
export const BRAIN_OBJECT=0,BRAIN_RANDOM_PED=1,BRAIN_ATTRACTOR=2,BRAIN_CODE=3;
export interface ScmScriptBrain {
 streamedScriptIndex:number;typeOfBrain:number;
 /** The object model or ped model the brain waits for, or the name a code-use brain is registered under. */
 model?:number|string;name?:string;
 percentageChance:number;
 /** m_ObjectBrainActivationRadius, five units unless the command says otherwise. */
 activationRadius:number;
 objectGroupingId:number;active:boolean;
}
export class ScmScriptBrains {
 readonly brains:ScmScriptBrain[]=[];
 /** CScriptsForBrains::Init: every slot empty. */
 init(){this.brains.length=0;}
 /** AddNewScriptBrain: the next free slot, with no test for the same brain twice; with all seventy taken, nothing. */
 private add(brain:ScmScriptBrain){
  if(this.brains.length>=NUM_SCRIPT_BRAINS)return -1;
  this.brains.push(brain);return this.brains.length-1;
 }
 /** ALLOCATE_STREAMED_SCRIPT_TO_OBJECT: the script starts when that object model comes within the radius (five
  * units for a radius that is not above 0). */
 addObjectBrain(streamedScriptIndex:number,model:number|string,percentageChance:number,activationRadius:number,objectGroupingId:number){
  return this.add({streamedScriptIndex,typeOfBrain:BRAIN_OBJECT,model,percentageChance,activationRadius:activationRadius>0?activationRadius:5,objectGroupingId,active:true});
 }
 /** ALLOCATE_STREAMED_SCRIPT_TO_RANDOM_PED: the script starts on a ped of that model, by chance. */
 addRandomPedBrain(streamedScriptIndex:number,model:number|string,percentageChance:number){
  return this.add({streamedScriptIndex,typeOfBrain:BRAIN_RANDOM_PED,model,percentageChance,activationRadius:5,objectGroupingId:-1,active:true});
 }
 /** REGISTER_SCRIPT_BRAIN_FOR_CODE_USE and its attractor form: a brain the engine starts by name. */
 registerForCodeUse(streamedScriptIndex:number,name:string,attractor:boolean){
  return this.add({streamedScriptIndex,typeOfBrain:attractor?BRAIN_ATTRACTOR:BRAIN_CODE,name,percentageChance:100,activationRadius:5,objectGroupingId:-1,active:true});
 }
 /** CScriptsForBrains::GetIndexOfScriptBrainWithThisName (0x46AA30), by name and kind. */
 indexOfName(name:string,attractor:boolean){
  const wanted=name.toLowerCase(),type=attractor?BRAIN_ATTRACTOR:BRAIN_CODE;
  return this.brains.findIndex(brain=>brain.typeOfBrain===type&&brain.name?.toLowerCase()===wanted);
 }
 /** SWITCH_OBJECT_BRAINS, which CScriptsForBrains::SwitchAllObjectBrainsWithThisID reaches: every brain of that
  * grouping id (compared as a byte; only object brains are given one) turns on or off together, and a negative id
  * does nothing. A brain switched off gives no new object its script; one already given it keeps it. */
 switchObjectBrains(objectGroupingId:number,active:boolean){
  if(objectGroupingId<0)return 0;
  let changed=0;
  for(const brain of this.brains)if((brain.objectGroupingId&0xff)===(objectGroupingId&0xff)){brain.active=active;changed++;}
  return changed;
 }
 get count(){return this.brains.length;}
}
/** CheckIfNewEntityNeedsScript's roll for a brain whose type and model match the new entity: (rand() & 0xffff) /
 * 65536 × 100 in float, truncated, under the brain's percentage chance. `sample16` is the low 16 bits of a rand(). */
export function brainChancePasses(sample16:number,percentageChance:number){
 return Math.trunc(Math.fround(Math.fround((sample16&0xffff)*(1/65536))*100))<percentageChance;
}
