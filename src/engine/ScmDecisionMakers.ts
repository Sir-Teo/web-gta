import {requireAsset} from '../assets/binary';
import {scriptThingHandle} from './ScmFires';
/* The decision makers a script loads, pinned gta-reversed ead3051. The command body is reversed in
 * `CharacterCommands.cpp` (`LoadCharDecisionMaker`), and so is the name table it goes through
 * (`CDecisionMakerTypesFileLoader::GetPedDMName` 0x600860 and `GetGrpDMName` 0x600880); the file reader that
 * fills a maker's decisions is reversed too. What is not is `CDecisionMakerTypes::AddDecisionMaker` (0x607050),
 * which still calls into the executable, so the slot it picks and the number it gives back are not known.
 *
 * That number is opaque to the script: it holds the handle and hands it to the commands that dress a ped or a
 * group with it. So the slots are allocated here, in the order the script asks, and wrapped in the same
 * script-thing handle every other table uses. The decisions themselves live in files this port does not
 * publish, and choosing between them belongs to a host, so only what the script can see is kept. */
/** TOTAL_DECISION_MAKERS. */
export const TOTAL_DECISION_MAKERS=20;
/** eDecisionMakerType's built-in entries, which the script's own loads come after. */
export const COUNT_GAME_DECISION_MAKERS=10;
/** CDecisionMakerTypesFileLoader::GetPedDMName, in its own order. */
export const PED_DECISION_MAKER_NAMES=['m_empty.ped','m_norm.ped','m_tough.ped','m_weak.ped','m_steal.ped','MISSION.grp'] as const;
/** GetGrpDMName, which has the one entry. */
export const GROUP_DECISION_MAKER_NAMES=['MISSION.grp'] as const;
export interface ScmDecisionMaker {
 /** The slot, the type the script named and the file that type reads. */
 index:number;type:number;file:string;
 /** Whether the thread that loaded it uses mission cleanup, which decides whether it is freed with the mission. */
 forMission:boolean;
 group:boolean;referenceIndex:number;loaded:boolean;
 /** A copy's source: the default decision maker whose decisions it took (-1 for none). */
 copiedFrom?:number;
 /** Made by COPY_SHARED_CHAR_DECISION_MAKER, and handed again to the next script that asks for its template. */
 shared?:boolean;
}
export class ScmDecisionMakers {
 private readonly slots:(ScmDecisionMaker|undefined)[]=Array(TOTAL_DECISION_MAKERS).fill(undefined);
 /** Each slot's reference index, which goes on counting as the slot is freed and taken again, so a handle to what it
  * held before names nothing rather than its new maker. */
 private readonly references:number[]=Array(TOTAL_DECISION_MAKERS).fill(1);
 /** The slot a handle names: its low half, as every script thing is addressed. */
 static indexOf(handle:number){return handle&0xffff;}
 private at(handle:number){
  const index=ScmDecisionMakers.indexOf(handle);
  requireAsset(Number.isInteger(index)&&index>=0&&index<TOTAL_DECISION_MAKERS,'Decision maker handle out of range.');
  return this.slots[index];
 }
 /** The name a type reads its decisions from; a type outside the table has none, and the command then loads
  * nothing, which is what the file reader's own warning path comes to. */
 static fileFor(type:number,group:boolean){
  const names=group?GROUP_DECISION_MAKER_NAMES:PED_DECISION_MAKER_NAMES;
  return type>=0&&type<names.length?names[type]:undefined;
 }
 /** LOAD_CHAR_DECISION_MAKER and its group twin: the first free slot after the built-in ones takes it. */
 load(type:number,forMission:boolean,group=false){
  requireAsset(Number.isInteger(type),'Invalid decision maker type.');
  const file=ScmDecisionMakers.fileFor(type,group);
  return this.allocate({type,file:file??'',forMission,group,loaded:file!==undefined});
 }
 /** COPY_CHAR_DECISION_MAKER: a new slot holding a copy of a default decision maker (a script handle whose low half
  * is the default's index, or -1 for none). CDecisionMakerTypes' copy is not in the reference; the new slot is
  * allocated as a load's is, and the host fills it with the source's decisions. */
 copy(source:number,forMission:boolean){
  requireAsset(Number.isInteger(source),'Invalid decision maker source.');
  const from=source===-1?-1:ScmDecisionMakers.indexOf(source);
  return {handle:this.allocate({type:-1,file:'',forMission,group:false,loaded:true,copiedFrom:from}),from};
 }
 /** COPY_SHARED_CHAR_DECISION_MAKER (handler unreversed; AUTHORED): the copy of a default decision maker the scripts
  * share, made once a template and handed again to the next script that asks for that template until it is removed.
  * dealer.scm, which every street dealer's brain runs, keeps the copy in one global, edits its responses through it,
  * and frees what the global names when its dealer is done; a copy for each brain filled the ten script slots with
  * dealers within minutes and the next brain gave up. */
 copyShared(source:number,forMission:boolean){
  requireAsset(Number.isInteger(source),'Invalid decision maker source.');
  const from=source===-1?-1:ScmDecisionMakers.indexOf(source);
  const shared=this.slots.find(maker=>maker?.shared&&maker.copiedFrom===from);
  if(shared)return {handle:(shared.referenceIndex<<16|shared.index)|0,from,made:false};
  const copied=this.copy(source,forMission);
  this.slots[ScmDecisionMakers.indexOf(copied.handle)]!.shared=true;
  return {...copied,made:true};
 }
 /** CTheScripts::GetActualScriptThingIndex for a decision maker: the slot a handle names, or -1 when a script slot's
  * reference no longer matches (freed and reused). The game's own makers below COUNT_GAME_DECISION_MAKERS are always
  * there. */
 actualIndex(handle:number){
  if(handle===-1)return -1;
  const index=ScmDecisionMakers.indexOf(handle);
  if(index<COUNT_GAME_DECISION_MAKERS)return index;
  const maker=index<TOTAL_DECISION_MAKERS?this.slots[index]:undefined;
  return maker&&maker.referenceIndex===(handle>>>16)?index:-1;
 }
 private allocate(fields:Omit<ScmDecisionMaker,'index'|'referenceIndex'>){
  let index=COUNT_GAME_DECISION_MAKERS;
  while(index<TOTAL_DECISION_MAKERS&&this.slots[index])index++;
  requireAsset(index<TOTAL_DECISION_MAKERS,'Every decision maker slot is taken.');
  const {handle,referenceIndex}=scriptThingHandle(index,this.references[index]);
  this.references[index]=referenceIndex;
  this.slots[index]={index,referenceIndex,...fields};
  return handle;
 }
 /** What a handle names, or nothing once its slot has been freed. */
 get(handle:number){return this.at(handle);}
 /** REMOVE_DECISION_MAKER, and the mission cleanup that frees the ones a mission loaded. */
 remove(handle:number){const index=ScmDecisionMakers.indexOf(handle);if(index<TOTAL_DECISION_MAKERS)this.slots[index]=undefined;}
 cleanUpMissionMakers(){
  for(let index=0;index<TOTAL_DECISION_MAKERS;index++)if(this.slots[index]?.forMission)this.slots[index]=undefined;
 }
 get count(){return this.slots.filter(Boolean).length;}
 get all():readonly ScmDecisionMaker[]{return this.slots.filter(Boolean) as ScmDecisionMaker[];}
}
