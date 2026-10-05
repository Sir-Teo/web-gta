import {requireAsset} from '../assets/binary';
/* CAEScriptAudioEntity's mission-audio slots, pinned gta-reversed ead3051. The command layer is reversed in
 * `Scripts/Commands/ScriptCommands.cpp` (`LoadMissionAudio`, `PlayMissionAudio`, `AttachMissionAudioToCar`,
 * `ReportMissionAudioEventAtChar` and `ReportMissionAudioEventAtCar`) and the slot interface in
 * `Audio/AudioEngine.h` (`PreloadMissionAudio`, `GetMissionAudioLoadingStatus`, `PlayLoadedMissionAudio`,
 * `ClearMissionAudio`, `SetMissionAudioPosition` and the three attach calls); the bodies behind those still
 * call into the executable, so what is known is the bookkeeping, not the mixing. That is enough for the script:
 * it loads a sample into one of four slots, waits for it, plays it, asks whether it has finished and clears it.
 *
 * Two details the commands carry are easy to lose. The script numbers its slots from one and every command
 * subtracts one before it reaches the engine. And CAudioLink::Init leaves the audio event, the bank and the bank
 * slot at -1, which is what an empty slot reads as rather than zero. */
/** CAEScriptAudioEntity::MISSION_AUDIO_COUNT. */
export const MISSION_AUDIO_COUNT=4;
/** GetMissionAudioLoadingStatus, as the script's wait loop reads it. */
export const AUDIO_LOADING=0,AUDIO_LOADED=1,AUDIO_NOT_LOADED=2;
export interface ScmMissionAudioSlot {
 /** m_nAudioEvent, m_nBankId and m_nBankSlotId, all -1 while the slot is empty. */
 audioEvent:number;bankId:number;bankSlotId:number;
 /** m_vPosition and m_pEntity: where the sound is, or what it follows. */
 position?:{x:number;y:number;z:number};
 entity?:{kind:'ped'|'vehicle'|'object';handle:number};
 /** Whether the sample is ready, playing, and done. */
 loadingStatus:number;playing:boolean;finished:boolean;
 /** How much of the playing sample is left, in ms. */
 remainingMs:number;
 /** Played this frame and not yet sized from the subtitle the frame left up (settleLengths). */
 sizing:boolean;
 /** The host is streaming the sample in: the slot stays loading until it says the sample is in (streamed). */
 streaming:boolean;
}
const emptySlot=():ScmMissionAudioSlot=>({audioEvent:-1,bankId:-1,bankSlotId:-1,loadingStatus:AUDIO_NOT_LOADED,playing:false,finished:false,remainingMs:0,sizing:false,streaming:false});
/** A sample's length when nothing better is known (no host plays the SCRIPT pack's lines). */
export const DEFAULT_SAMPLE_MS=2000;
/** Conversational speech runs at about fifteen characters a second, with a short breath before the line. */
const MS_PER_CHARACTER=66,LEAD_MS=300,SHORTEST_LINE_MS=800;
/** A spoken line's length from its subtitle, for when the sample itself is not to hand: the HUD tokens (~w~ and
 * the like) are not spoken. */
export function speechLengthMs(subtitle:string){
 const spoken=subtitle.replace(/~[a-zA-Z0-9]~/g,'').trim().length;
 return spoken?Math.max(SHORTEST_LINE_MS,LEAD_MS+spoken*MS_PER_CHARACTER):DEFAULT_SAMPLE_MS;
}
/** CAEAudioUtility::GetBankAndSoundFromScriptSlotAudioEvent's whole-bank samples: AE_SCRIPT_BANK_FIRST (1800) to 1829
 * name a SCRIPT bank through gScriptBanksLookup (gta-reversed's; the iOS executable's at 0x10062a64c is the same), which
 * PreloadMissionAudio loads whole for ProcessMissionAudioEvent's mission-bank sounds. SND_BANK_SCRIPT_NULL is 291. */
export const SCRIPT_BANK_SAMPLE_FIRST=1800,SCRIPT_BANK_NULL=291;
export const SCRIPT_BANKS_LOOKUP:readonly number[]=[352,310,296,291,242,291,222,209,291,167,163,160,265,304,158,291,291,292,171,198,226,293,319,345,351,266,183,153,298,339];
/** The bank a whole-bank sample names, or undefined for any other sample. */
export function scriptBankOfSample(sample:number){return sample>=SCRIPT_BANK_SAMPLE_FIRST&&sample<SCRIPT_BANK_SAMPLE_FIRST+SCRIPT_BANKS_LOOKUP.length?SCRIPT_BANKS_LOOKUP[sample-SCRIPT_BANK_SAMPLE_FIRST]:undefined;}
/** How many recent mission audio reports are kept. */
export const REPORTS_KEPT=64;
export class ScmMissionAudio {
 readonly slots:ScmMissionAudioSlot[]=Array.from({length:MISSION_AUDIO_COUNT},emptySlot);
 /** The events the script reported, in order, for a host that plays them one by one. */
 readonly reported:{audioEvent:number;at:{x:number;y:number;z:number}|{kind:string;handle:number}}[]=[];
 /** Every command's slot operand is one-based, and the engine's is not. */
 private slot(scriptSlot:number){
  const index=scriptSlot-1;
  requireAsset(Number.isInteger(index)&&index>=0&&index<MISSION_AUDIO_COUNT,'Mission audio slot out of range.');
  return this.slots[index];
 }
 /** LOAD_MISSION_AUDIO: the slot takes the sample and starts loading. A host moves it on. */
 preload(scriptSlot:number,sampleId:number){
  requireAsset(Number.isInteger(sampleId),'Invalid mission audio sample.');
  const slot=this.slot(scriptSlot);
  // A sample the slot already holds (or is loading) is not loaded again: the vending machine's script asks for its
  // sample every frame it waits for the button, and then waits for HAS_MISSION_AUDIO_LOADED, which a reload each
  // frame would never let come true. (PreloadMissionAudio is unreversed; the scripts need it this way.)
  if(slot.audioEvent===sampleId&&slot.loadingStatus!==AUDIO_NOT_LOADED&&!slot.playing&&!slot.finished)return slot;
  Object.assign(slot,emptySlot(),{audioEvent:sampleId,loadingStatus:AUDIO_LOADING});
  return slot;
 }
 /** What a host calls once the bank is in, if before the next service: the slot is ready to play. */
 loaded(scriptSlot:number,bankId=-1,bankSlotId=-1){
  const slot=this.slot(scriptSlot);slot.loadingStatus=AUDIO_LOADED;slot.bankId=bankId;slot.bankSlotId=bankSlotId;
 }
 /** A host that streams the sample in takes over the slot's loading: until streamed, it stays loading, as the
  * script's HAS_MISSION_AUDIO_LOADED loop waits on the bank to arrive. False when the slot is not loading it. */
 stream(scriptSlot:number,sampleId:number){
  const slot=this.slot(scriptSlot);
  if(slot.audioEvent!==sampleId||slot.loadingStatus!==AUDIO_LOADING)return false;
  slot.streaming=true;return true;
 }
 /** The host's sample is in (or will never be, which the script cannot tell apart): a slot still loading that
  * sample is ready to play. One since cleared or given another sample is left alone. */
 streamed(scriptSlot:number,sampleId:number){
  const slot=this.slot(scriptSlot);
  if(slot.audioEvent===sampleId&&slot.loadingStatus===AUDIO_LOADING&&slot.streaming){slot.streaming=false;slot.loadingStatus=AUDIO_LOADED;}
 }
 /** HAS_MISSION_AUDIO_LOADED. */
 hasLoaded(scriptSlot:number){return this.slot(scriptSlot).loadingStatus===AUDIO_LOADED;}
 /** PLAY_MISSION_AUDIO: a slot that is not ready is left alone, as an unloaded sample has nothing to play.
  * `lengthMs` is how long the sample runs. */
 play(scriptSlot:number,lengthMs=DEFAULT_SAMPLE_MS){
  const slot=this.slot(scriptSlot);
  if(slot.loadingStatus!==AUDIO_LOADED)return false;
  requireAsset(Number.isFinite(lengthMs)&&lengthMs>=0,'Invalid mission audio length.');
  slot.playing=true;slot.finished=false;slot.remainingMs=lengthMs;slot.sizing=true;return true;
 }
 /** The lengths of the samples played last frame, from what a host can tell of them now: the decoded line's when it
  * has one, else its subtitle's, which the script prints beside the PLAY in either order (INTRO1 prints three of its
  * four after it): the brief the whole frame left up is the one that belongs to it. */
 settleLengths(lengthOf:(audioEvent:number)=>number|undefined){
  for(const slot of this.slots){
   if(!slot.sizing)continue;slot.sizing=false;
   const ms=lengthOf(slot.audioEvent);
   if(ms!==undefined&&slot.playing){requireAsset(Number.isFinite(ms)&&ms>=0,'Invalid mission audio length.');slot.remainingMs=ms;}
  }
 }
 /** CAudioEngine::Service's part in the slots, once a frame: a sample the script asked for has streamed in by the
  * next frame, and a playing one runs out after its length. */
 service(deltaMs:number){
  for(const slot of this.slots){
   if(slot.loadingStatus===AUDIO_LOADING){if(!slot.streaming)slot.loadingStatus=AUDIO_LOADED;}
   else if(slot.playing&&(slot.remainingMs-=deltaMs)<=0){slot.remainingMs=0;slot.playing=false;slot.finished=true;}
  }
 }
 /** What a host calls when the sample runs out before its length. */
 finish(scriptSlot:number){const slot=this.slot(scriptSlot);slot.playing=false;slot.finished=true;slot.remainingMs=0;}
 /** HAS_MISSION_AUDIO_FINISHED. */
 hasFinished(scriptSlot:number){return this.slot(scriptSlot).finished;}
 /** IS_MISSION_AUDIO_PLAYING and IS_MISSION_AUDIO_LOADING, neither of which names a slot: they ask about all
  * four at once, which is the only reading their empty operand list allows. */
 get anyPlaying(){return this.slots.some(slot=>slot.playing);}
 get anyLoading(){return this.slots.some(slot=>slot.loadingStatus===AUDIO_LOADING);}
 /** CLEAR_MISSION_AUDIO: the slot goes back to empty, which is -1 in its three fields. */
 clear(scriptSlot:number){Object.assign(this.slot(scriptSlot),emptySlot());}
 /** SET_MISSION_AUDIO_POSITION: the sound sits at a point instead of following anything. */
 setPosition(scriptSlot:number,position:{x:number;y:number;z:number}){
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid mission audio position.');
  const slot=this.slot(scriptSlot);slot.position={...position};slot.entity=undefined;
  this.onPlace?.(scriptSlot,{...position});
 }
 /** The three attach commands, which point the slot at a ped, a vehicle or an object instead of a point. */
 attach(scriptSlot:number,kind:'ped'|'vehicle'|'object',handle:number){
  const slot=this.slot(scriptSlot);slot.entity={kind,handle};slot.position=undefined;
  this.onPlace?.(scriptSlot,{kind,handle});
 }
 /** CAEScriptAudioEntity's SetMissionAudioPosition and AttachMissionAudioToPhysical: the host's slot link. */
 onPlace?:(scriptSlot:number,at:{x:number;y:number;z:number}|{kind:'ped'|'vehicle'|'object';handle:number})=>void;
 /** CAudioEngine::ReportMissionAudioEvent's host: CAEScriptAudioEntity::ProcessMissionAudioEvent. */
 onReport?:(audioEvent:number,at:{x:number;y:number;z:number}|{kind:string;handle:number})=>void;
 /** The report commands, which do not use a slot at all: they ask for one event at a place or an entity. */
 report(audioEvent:number,at:{x:number;y:number;z:number}|{kind:string;handle:number}){
  requireAsset(Number.isInteger(audioEvent),'Invalid mission audio event.');
  this.onReport?.(audioEvent,at);
  // Only the latest are kept, for diagnostics: a whole session's worth would only grow.
  this.reported.push({audioEvent,at});if(this.reported.length>REPORTS_KEPT)this.reported.splice(0,this.reported.length-REPORTS_KEPT);
 }
 get loadedCount(){return this.slots.filter(slot=>slot.loadingStatus===AUDIO_LOADED).length;}
}
