import {SOUND,type NativeAudioEntity,type NativeSound} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {randomInt,type AudioRandom} from './nativeAudioUtility';
import {SCANNER_AREAS,SCANNER_COLOURS,SCANNER_CRIMES,SCANNER_OPENINGS,SCANNER_VEHICLES} from './scannerTables';
/** SND_BANK_SCRIPT_SCANNER_* (eSoundBank.h): the SCRIPT pack's first six banks. */
export const SCANNER_BANK={areas:147,colours:148,directions:149,instructions:150,numbers:151,vehicles:152} as const;
/** SND_BANK_SLOT_SCANNER_FIRST: a slot for each of a list's five sounds. The area's (37) plays to its end. */
const SLOT_FIRST=33,SLOTS=5,AREA_SLOT=37;
/** eAudioEvents::AE_CRIME_COMMITTED, which CWanted::ReportCrimeNow raises, and the scanner's frontend events. */
export const AE_CRIME_COMMITTED=164;
const NOISE_START=47,NOISE_STOP=48,CLICK=49;
/** The SND_BANK_SCRIPT_SCANNER_INSTRUCTIONS sounds of a list's second half, named for how AddAudioEvent uses them (not
 * checked by ear): the one it leads with, the one before a vehicle one rides on and the one before any other, and the
 * ones for swimming and for walking. */
const SUSPECT=7,IN_A=1,ON_A=3,SWIMMING=2,ON_FOOT=4;
/** The vehicles "on a" goes before, by eAEVehicleAudioTypeForName (moped, bike, quad bike, tractor, mower and
 * bicycle), and those whose colour is said: masks the arm64 AddAudioEvent tests (0x1001502fc, 0x100150314). */
const ON_A_TYPES=0x22462000000n,COLOURED_TYPES=0x373efb5bbe7fn;
/** A paintjob's colour (CVehicle::GetRemapIndex is not -1): SND_BANK_SCRIPT_SCANNER_COLOURS sound 4. */
const REMAP_COLOUR=4;
/** AE_VAT_SEDAN, which the scanner never names, and AE_VAT_FOUR_DOOR, the last type. */
const TYPE_SEDAN=5,TYPE_LAST=45;
/** eAEVehicleAudioTypeForName by name, as vehicleAudioSettings.ts spells them. */
export const VEHICLE_AUDIO_TYPE_FOR_NAME=['OFFROAD','TWO_DOOR','SPORTS_CAR','RIG','STATION_WAGON','SEDAN','TRUCK','FIRETRUCK','GARBAGE_TRUCK','STRETCH','LOWRIDER','VAN','AMBULANCE',
 'HELICOPTER','TAXI','PICK_UP','ICE_CREAM_VAN','BUGGY','POLICE_VAN','BOAT','COACH','TANK','CONVERTIBLE','HEARSE','MONSTER_TRUCK','MOPED','TRAM','GOLF_CART','PLANE','BIKE','QUADBIKE','COUPE',
 'BULLDOZER','FORKLIFT','TRACTOR','COMBINE_HARVESTER','KART','MOWER','POLICE_CAR','TRAIN','HOVERCRAFT','BICYCLE','SEA_PLANE','DINGHY','CAMPER_VAN','FOUR_DOOR'] as const;
/** tScannerSlot: a bank and a sound of it; either below zero leaves the slot out. */
interface ScannerSlot {bank:number;sound:number}
const emptySlots=():ScannerSlot[]=>Array.from({length:SLOTS},()=>({bank:-1,sound:-1}));
const unused=(slot:ScannerSlot)=>slot.bank<0||slot.sound<0;
/** What AddAudioEvent reads of the world: the smallest type-0 navigation zone at the crime's point
 * (CTheZones::FindSmallestZoneForPosition(point, true)), with its text key and corners, and what the player is in. */
export interface ScannerCrimeScene {
 point:{x:number;y:number};
 zone?:{textKey:string;min:readonly [number,number];max:readonly [number,number]};
 /** The player ped (FindPlayerPed of the wanted whose scanner this is), on foot or seated in a vehicle. */
 player?:{
  vehicle?:{typeForName:number;remapped:boolean;primaryColour:number};
  inVehicle:boolean;swimming:boolean;jetPack:boolean;
 };
}
/** The scanner's states (CAEPoliceScannerAudioEntity::State): loading a list, about to play, playing. */
const STATE={initial:0,loading:2,loaded:4,starting:5,playing:7} as const;
/** s_SlotState: to load, left out, loading, loaded, played. */
const SLOT_STATE={load:0,unused:1,loading:2,loaded:3,played:5} as const;
/** CAEPoliceScannerAudioEntity: the police scanner's report of a crime that raised the player's wanted level, the
 * crime's ten-code and where, then what the player is in or on. Its statics are this object's fields: there is one
 * player, so one entity both builds the report and plays it (s_pPSControlling).
 *
 * AddAudioEvent (0x4E71E0) is unreversed in gta-reversed: it follows the iOS port's executable (arm64 0x100150064),
 * its tables generated into scannerTables.ts. The rest is reversed there and checked against the same executable,
 * which differs from gta-reversed in three places, followed here: CanWePlayNewScannerDialogue plays only from the
 * initial state (gta-reversed inverts the test), a report finishing holds the next off for 10 s from now (not the old
 * time plus now), and FinishedPlayingScannerDialogue leaves all five slot states at 1. */
export class NativePoliceScanner implements NativeAudioEntity {
 private state:number=STATE.initial;
 private stopping=false;
 private sound?:NativeSound;
 private volumeOffset=0;
 private sectionPlaying=0;
 private playbackStartTime=0;private abortPlaybackTime=0;
 private nextNewDialogueTime=0;
 private disabled=false;
 private slotState=new Array<number>(SLOTS).fill(SLOT_STATE.unused);
 private first=emptySlots();private second=emptySlots();
 private current?:ScannerSlot[];
 /** TheCamera.m_bWideScreenOn, which holds new reports and stops one playing. */
 widescreen=false;
 /** Reports heard to their end. */
 reportsPlayed=0;
 constructor(private manager:NativeSoundManager,
  private bank:{loadSound(bank:number,sound:number,slot:number):void;isSoundLoaded(bank:number,sound:number,slot:number):boolean},
  private frontend:{addAudioEvent(event:number,volumeBoost?:number,speed?:number):void},
  private defaultVolume:(event:number)=>number,
  /** CAEVehicleAudioEntity::s_pVehicleAudioSettingsForRadio is set: a report starts 8 dB quieter on foot. */
  private playerInVehicle:()=>boolean,
  private random:AudioRandom=Math.random){}
 private get now(){return this.manager.clock.timeMs;}
 /** AddAudioEvent (0x4E71E0; arm64 0x100150064): AE_CRIME_COMMITTED for a crime of type 2 to 22. The first list is
  * an opening, the crime's ten-code, the direction within the zone (north or south, then east or west, or "central"
  * when neither) for a zone that has one, and the area; nothing is said in a zone the scanner has no name for. The
  * second describes the player: a vehicle by its colour (for the types that have one said) and kind, or swimming or on
  * foot; nothing on a jetpack, or in a vehicle the scanner has no word for. */
 addAudioEvent(event:number,crimeType:number,scene:ScannerCrimeScene){
  if(event!==AE_CRIME_COMMITTED||crimeType-2>20||crimeType<2)return;
  const first=emptySlots(),second=emptySlots();
  first[0]={bank:SCANNER_BANK.instructions,sound:SCANNER_OPENINGS[randomInt(this.random,0,2)]};
  first[1]={bank:SCANNER_BANK.numbers,sound:SCANNER_CRIMES[crimeType]};
  const zone=scene.zone;if(!zone)return;
  const area=SCANNER_AREAS.find(([key,sound])=>key===zone.textKey&&sound>=0);if(!area)return;
  if(area[2]){
   // The zone's middle half each way is "central"; beyond it, north or south and east or west (float32, as there).
   const f=Math.fround,width=f(zone.max[0]-zone.min[0]),height=f(zone.max[1]-zone.min[1]);
   const cx=f(zone.min[0]+f(width*.5)),cy=f(zone.min[1]+f(height*.5)),qw=f(width*.25),qh=f(height*.25);
   const x=f(scene.point.x),y=f(scene.point.y);
   let northSouth=false;
   if(y>f(qh+cy)){first[2]={bank:SCANNER_BANK.directions,sound:2};northSouth=true;}
   else if(y<f(cy-qh)){first[2]={bank:SCANNER_BANK.directions,sound:3};northSouth=true;}
   if(x>f(qw+cx))first[3]={bank:SCANNER_BANK.directions,sound:1};
   else if(x<f(cx-qw))first[3]={bank:SCANNER_BANK.directions,sound:4};
   else if(!northSouth)first[3]={bank:SCANNER_BANK.directions,sound:0};
  }
  first[4]={bank:SCANNER_BANK.areas,sound:area[1]};
  const player=scene.player;
  if(player&&!player.inVehicle){
   // CPedIntelligence::GetTaskSwim and GetTaskJetPack.
   if(player.swimming){second[0]={bank:SCANNER_BANK.instructions,sound:SUSPECT};second[4]={bank:SCANNER_BANK.instructions,sound:SWIMMING};}
   else if(!player.jetPack){second[0]={bank:SCANNER_BANK.instructions,sound:SUSPECT};second[4]={bank:SCANNER_BANK.instructions,sound:ON_FOOT};}
  }else if(player?.vehicle){
   const {typeForName:type,remapped,primaryColour}=player.vehicle;
   if(type>=0&&type<=TYPE_LAST&&type!==TYPE_SEDAN){
    second[0]={bank:SCANNER_BANK.instructions,sound:SUSPECT};
    second[1]={bank:SCANNER_BANK.instructions,sound:(ON_A_TYPES>>BigInt(type)&1n)?ON_A:IN_A};
    if(COLOURED_TYPES>>BigInt(type)&1n){
     if(remapped)second[3]={bank:SCANNER_BANK.colours,sound:REMAP_COLOUR};
     else if(primaryColour!==6&&primaryColour>=1&&primaryColour<=126)second[3]={bank:SCANNER_BANK.colours,sound:SCANNER_COLOURS[primaryColour]};
    }
    second[4]={bank:SCANNER_BANK.vehicles,sound:SCANNER_VEHICLES[type]};
   }
  }
  this.playPoliceScannerDialogue(first,second);
 }
 /** CanWePlayNewScannerDialogue (0x4E6C00), inlined in PlayPoliceScannerDialogue (0x4E6ED0; arm64 0x1001503fc). */
 private canPlayNewDialogue(){return this.state===STATE.initial&&this.now>=this.nextNewDialogueTime&&!this.widescreen&&!this.disabled;}
 /** PlayPoliceScannerDialogue: the lists are copied, the first is prepared (PrepSlots), and the report starts 2 s on
  * once its sounds have loaded, or gives up after 5 s. */
 private playPoliceScannerDialogue(first:ScannerSlot[],second:ScannerSlot[]){
  if(!this.canPlayNewDialogue())return;
  this.first=first.map(s=>({...s}));this.second=second.map(s=>({...s}));
  this.sectionPlaying=0;this.current=this.first;this.prepSlots();
  this.state=STATE.loading;this.playbackStartTime=this.now+2000;this.abortPlaybackTime=this.now+5000;
 }
 /** PrepSlots (0x4E6BC0). */
 private prepSlots(){for(let i=0;i<SLOTS;i++)this.slotState[i]=unused(this.current![i])?SLOT_STATE.unused:SLOT_STATE.load;}
 /** LoadSlots (0x4E6CD0): each sound is loaded into its scanner slot; once all are in, the list can play.
  * AUTHORED: CStreaming::IsVeryBusy, which holds a load back, is not consulted. */
 private loadSlots(){
  const slots=this.current;if(!slots)return;
  let canPlay=true;
  for(let i=0;i<SLOTS;i++){
   const slot=slots[i],state=this.slotState[i];
   if(state===SLOT_STATE.loading){if(this.bank.isSoundLoaded(slot.bank,slot.sound,SLOT_FIRST+i))this.slotState[i]=SLOT_STATE.loaded;else canPlay=false;}
   else if(state===SLOT_STATE.load){
    if(unused(slot))this.slotState[i]=SLOT_STATE.unused;
    else{this.bank.loadSound(slot.bank,slot.sound,SLOT_FIRST+i);canPlay=false;this.slotState[i]=SLOT_STATE.loading;}
   }
  }
  if(canPlay)this.state=STATE.loaded;
 }
 /** EnableScanner (0x4E6DB0) and DisableScanner (0x4E71B0). */
 enableScanner(){this.disabled=false;}
 disableScanner(stop:boolean,stopSound:boolean){this.disabled=true;if(stop&&this.state!==STATE.initial)this.stopScanner(stopSound);}
 /** StopScanner (0x4E6DC0), as RestorePlayerStuffDuringResurrection calls it: a report playing fades out, or with
  * `stopSound` ends at once. */
 stopScanner(stopSound:boolean){
  if(this.state===STATE.initial)return;
  this.stopping=true;
  if(stopSound){this.sound?.stopSoundAndForget();this.sound=undefined;this.finishedPlayingScannerDialogue();}
 }
 /** Reset (0x4E6E90). */
 reset(){this.stopScanner(true);this.finishedPlayingScannerDialogue();}
 /** FinishedPlayingScannerDialogue (0x4E6C30; arm64 inlined): the noise stops and the next report waits 10 s. */
 private finishedPlayingScannerDialogue(){
  this.frontend.addAudioEvent(NOISE_STOP,0,1);
  this.nextNewDialogueTime=this.now+10000;
  this.state=STATE.initial;this.current=undefined;this.stopping=false;this.volumeOffset=0;
  this.slotState.fill(SLOT_STATE.unused);this.first=emptySlots();this.second=emptySlots();
 }
 /** PlayLoadedDialogue (0x4E6F60; arm64 0x100150688): the next loaded sound after the last one played, each a
  * frontend sound ahead of the listener at AE_CRIME_COMMITTED's volume. With none left, a click and the noise's end;
  * the first list goes on to the second, loaded at once, and the second ends the report. */
 private playLoadedDialogue(){
  let start=this.slotState.indexOf(SLOT_STATE.played);if(start<0)start=0;
  for(let i=start;i<SLOTS;i++){
   if(this.slotState[i]!==SLOT_STATE.loaded)continue;
   this.sound=this.manager.playSound({slot:SLOT_FIRST+i,sound:this.current![i].sound,entity:this,position:{x:0,y:1,z:0},volume:this.defaultVolume(AE_CRIME_COMMITTED)+this.volumeOffset,
    rollOff:1,speed:1,doppler:1,event:AE_CRIME_COMMITTED,clientVariable:i,flags:SOUND.frontEnd|SOUND.uncancellable|SOUND.requestUpdates|SOUND.unduckable});
   if(this.sound){this.slotState[i]=SLOT_STATE.played;this.state=STATE.playing;}
   return;
  }
  this.frontend.addAudioEvent(CLICK,this.volumeOffset,1);
  this.frontend.addAudioEvent(NOISE_STOP,0,1);
  if(this.sectionPlaying){this.reportsPlayed++;this.finishedPlayingScannerDialogue();return;}
  this.current=this.second;this.sectionPlaying=1;this.prepSlots();
  this.playbackStartTime=0;this.abortPlaybackTime=this.now+5000;this.state=STATE.loading;
 }
 /** UpdateParameters (0x4E7590): a stopping report's sound falls 6 dB a frame; the next sound starts 40 ms before
  * this one ends, except after the area's. */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition===-1){
   this.sound=undefined;
   if(this.stopping){if(this.state!==STATE.initial)this.finishedPlayingScannerDialogue();return;}
   this.playLoadedDialogue();return;
  }
  if(this.stopping){sound.volume-=6;return;}
  if(sound.length>0&&playPosition>sound.length-40&&sound.slot!==AREA_SLOT){
   sound.setFlags(SOUND.requestUpdates,false);this.sound=undefined;this.playLoadedDialogue();
  }
 }
 /** Service (0x4E7630; arm64 0x1001509ac), every audio frame: loads a list's sounds, then clicks and starts the noise
  * (8 dB down on foot) and plays the list 300 ms later. Widescreen stops a report. */
 service(){
  if(this.widescreen&&this.state!==STATE.initial)this.stopping=true;
  switch(this.state){
   case STATE.loading:
    if(this.now>this.abortPlaybackTime||this.stopping){this.finishedPlayingScannerDialogue();break;}
    this.loadSlots();break;
   case STATE.loaded:
    if(this.stopping){this.finishedPlayingScannerDialogue();break;}
    if(this.now>=this.playbackStartTime){
     this.volumeOffset=this.playerInVehicle()?0:-8;
     this.frontend.addAudioEvent(CLICK,this.volumeOffset,1);
     this.frontend.addAudioEvent(NOISE_START,this.volumeOffset-6,1);
     this.playbackStartTime=this.now+300;this.state=STATE.starting;
    }
    break;
   case STATE.starting:
    if(this.stopping){this.finishedPlayingScannerDialogue();break;}
    if(this.now>=this.playbackStartTime){this.state=STATE.playing;this.playLoadedDialogue();}
    break;
  }
 }
 snapshot(){
  const list=(slots:ScannerSlot[])=>slots.map(s=>[s.bank,s.sound]);
  return {state:this.state,section:this.sectionPlaying,slots:[...this.slotState],first:list(this.first),second:list(this.second),reportsPlayed:this.reportsPlayed,nextNewDialogueTime:this.nextNewDialogueTime};
 }
}
