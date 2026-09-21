import {decodeScmInstruction,type ScmInstruction,type ScmParameter} from '../assets/scm';
import {requireAsset} from '../assets/binary';
import {ScmStrings} from './ScmStrings';
import {NATIVE_NOP_OPCODES} from './ScmNativeNops';
import {RANDOM_SAMPLE_MAX,randomFloatInRange,randomIntInRange} from './nativeRandomRange';
import {SCM_GAME_COMMANDS} from './ScmGameCommands';
import type {ScmGameState} from './ScmGameState';

export class UnsupportedScmCommand extends Error {
 constructor(readonly offset:number,readonly opcode:number,readonly command:string,detail=''){
  super(`Unsupported SCM command ${command} (0x${opcode.toString(16)}) at ${offset}${detail?`: ${detail}`:''}`);
 }
}
type NumericKind='int'|'float';
/** Game-world effects a script can request. Every member beyond fade is
 * optional: a missing adapter stops the script explicitly at that command. */
/** One scripted task as its command describes it; a host builds the CTask this names. */
export type ScmScriptedTask=
 |{kind:'killPedOnFoot';target:number;time:number;flags:number;actionDelay:number;actionChance:number;mustBeOnFoot:boolean}
 |{kind:'turnToFaceEntity';target:number};
export interface ScmWorldCommands {
 fade(milliseconds:number,direction:number,nowMs:number):void;
 /** CPlayerInfo::IsRestartingAfterDeath() || IsRestartingAfterArrest(). */
 isPlayerRestarting?():boolean;
 /** CPlayerInfo::m_nPlayerState == PLAYERSTATE_PLAYING / HAS_DIED. */
 isPlayerPlaying?(playerId:number):boolean;
 isPlayerDead?(playerId:number):boolean;
 /** CTheScripts::DoDeathArrestCheck clears small HUD messages before resetting. */
 clearSmallMessages?():void;
 requestCollision?(x:number,y:number):void;
 /** CTimer::Stop; CStreaming::LoadScene; CTimer::Update. */
 loadScene?(x:number,y:number,z:number):void;
 /** CreatePlayer (PlayerCommands.cpp): the script receives the player index. */
 createPlayer?(playerId:number,x:number,y:number,z:number):void;
 getPlayerChar?(playerId:number):number;
 getPlayerGroup?(playerId:number):number;
 setCameraBehindPlayer?():void;
 /** SetCharHeading: ignored inside vehicles; degrees are fixed to 0..360. */
 setCharHeading?(ped:number,degrees:number):void;
 setRelationship?(relationship:number,pedType:number,otherPedType:number):void;
 setLaRiots?(enabled:boolean):void;
 /** CPlayerInfo::MakePlayerSafe(!state, 10.0). */
 setPlayerControl?(playerId:number,enabled:boolean):void;
 /** CCamera::GetFading (0x50ADE0). */
 isFading?():boolean;
 /** FrontEndMenuManager.m_bDrawingMap for CRadar::ChangeBlipScale. */
 isDrawingMap?():boolean;
 /** TheText.Get for the subtitle-only "~z~" prefix test when subtitles are off. */
 resolveText?(key:string):string|undefined;
 /** TheText.LoadMissionText. */
 loadMissionText?(name:string):void;
 /** Garage message, replay playback or running cutscene: SetHelpMessage bails. */
 helpMessageBlocked?():boolean;
 /** CHud big-message buffer blanking from ClearThisPrintBigNow. */
 clearBigMessage?(style:number):void;
 /** CWorld::PutToGroundIfTooLow for CREATE_OBJECT: the ground under a point, or undefined where the world has
  * nothing there, which leaves the point alone as the native call does. */
 groundLevel?(x:number,y:number,z:number):number|undefined;
 /** CEntity::GetDistanceFromCentreOfMassToBaseOfModel (0x536BE0): how far CREATE_OBJECT lifts the object. */
 modelBaseOffset?(model:number|string):number;
 /** What CCamera::Restore asks of the player: FindPlayerVehicle, and whether the ped state is one of
  * ENTER_CAR, CARJACK or OPEN_DOOR (the car camera) or EXIT_CAR (the on-foot camera). */
 playerCameraState?():{inVehicle:boolean;enteringCar:boolean;exitingCar:boolean};
 /* The peds a script holds, by the handle the ped pool gave them. The runtime keeps none of this: a host owns
  * its peds and answers for them, and every method mirrors the body of the command that calls it. */
 /** A handle the pool still knows. */
 pedExists?(handle:number):boolean;
 /** CPed::IsStateDeadForScript. A handle that names no ped counts as dead, which the command decides. */
 pedIsDeadForScript?(handle:number):boolean;
 /** GetCharCoordinates: the vehicle's position while the ped rides in one. */
 pedPosition?(handle:number):{x:number;y:number;z:number};
 /** CRunningScript::SetCharCoordinates, which also puts the ped on the ground and warps it out of a car. */
 setPedCoordinates?(handle:number,x:number,y:number,z:number):void;
 /** SetCharHealth: a health of nothing kills the ped instead of setting the field, and a ped still carrying
  * the default maximum of a hundred takes the new health as its maximum too. */
 setPedHealth?(handle:number,health:number):void;
 killPed?(handle:number):void;
 /** m_nWeaponAccuracy. */
 setPedAccuracy?(handle:number,accuracy:number):void;
 /** physicalFlags.bInvulnerable, which SET_CHAR_ONLY_DAMAGED_BY_PLAYER sets. */
 setPedInvulnerable?(handle:number,enabled:boolean):void;
 /** The five physicalFlags proofs SET_CHAR_PROOFS sets. */
 setPedProofs?(handle:number,proofs:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}):void;
 /** CTheScripts::CleanUpThisPed: the ped stays in the world for the streamer to reclaim. */
 markPedNoLongerNeeded?(handle:number):void;
 /** CPopulation::RemovePed through the command's own cleanup. */
 deletePed?(handle:number):void;
 /** CPopulation::AddPedInCar (0x613A00) through the host: a ped created straight into a seat of that car,
  * as its driver or in the seat the script names. The model substitutions the routine makes for the emergency
  * vehicles read streaming defaults the browser does not carry, so they stay with the host. */
 createCharInsideCar?(vehicle:number,pedType:number,model:number|string,seat:number|'driver'):number;
 /** The same routine with a civilian occupation the game picks, which is what the random forms ask for. */
 createRandomCharInCar?(vehicle:number,seat:number|'driver'):number;
 /** CPopulation::AddPed (0x612710) through the host, which owns the models: the handle of the new ped. */
 createChar?(pedType:number,model:number|string,x:number,y:number,z:number):number;
 /* The vehicles a script holds, by the handle the vehicle pool gave them. As with the peds, a host owns them. */
 /** CCarCtrl::CreateCarForScript (0x431F80) through the host: a point at or below the map's low limit is
  * dropped to the ground and the car is lifted off the base of its model, locked, engine off and abandoned. */
 createCar?(model:number|string,x:number,y:number,z:number):number;
 deleteVehicle?(handle:number):void;
 vehicleExists?(handle:number):boolean;
 /** What the script calls a dead car. The command's own dispatch is not reversed, so what counts as wrecked
  * is the host's; the runtime only keeps the part the ped equivalent shows, that a handle naming nothing is. */
 vehicleIsDeadForScript?(handle:number):boolean;
 vehiclePosition?(handle:number):{x:number;y:number;z:number};
 setVehicleCoordinates?(handle:number,x:number,y:number,z:number):void;
 /** Headings are degrees to the script and radians to the engine, fixed once into range on the way in. */
 vehicleHeading?(handle:number):number;
 setVehicleHeading?(handle:number,degrees:number):void;
 setVehicleProofs?(handle:number,proofs:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}):void;
 markVehicleNoLongerNeeded?(handle:number):void;
 /** CPed::IsInVehicle, and the vehicle it is in: the ped counts as in a car while it still holds one, even
  * opening or closing the door. */
 pedVehicle?(handle:number):number|undefined;
 /** CVehicle::GetVehicleAppearance, as eVehicleAppearance: none, automobile, bike, heli, boat or plane. */
 vehicleAppearance?(handle:number):number;
 /** CVehicle::IsSubTrain, which is m_nVehicleSubType against VEHICLE_TYPE_TRAIN. */
 vehicleIsTrain?(handle:number):boolean;
 /** The ped behind a player index, filled to the maximum the script just raised. */
 setPlayerMaxHealth?(playerId:number,maxHealth:number):void;
 setPlayerMaxArmour?(playerId:number,maxArmour:number):void;
 /** CClothes::RebuildPlayer over the clothes description, then CReplay::Init. */
 buildPlayerModel?(playerId:number):void;
 /** CWorld::StopAllLawEnforcersInTheirTracks, which both back-off commands call as they go on. */
 stopAllLawEnforcers?():void;
 /** CPlayerInfo::MakePlayerSafe with its radius. */
 makePlayerSafe?(playerId:number,safe:boolean,radius:number):void;
 /** CEntity::GetAreaCode of a ped: the interior it is in, zero being the normal world. */
 pedAreaCode?(handle:number):number;
 /** What CPlayerPed::CanPlayerStartMission asks of the game and the player. The tasks it also refuses on are
  * a task manager the host may not have; a host that cannot see one reports none. */
 playerMissionGates?(playerId:number):{
  statePlaying:boolean;coopGoingOn:boolean;inControl:boolean;driving:boolean;alive:boolean;
  physicalResponseTask:boolean;eventResponseTask:boolean;nonDrivePrimaryTask:boolean;attackTask:boolean;
  scriptCommandEvent:boolean;
 };
 /** The model of a vehicle the script names, for IS_CHAR_IN_MODEL. */
 vehicleModel?(handle:number):number|string|undefined;
 /* The tasks a script hands a ped. CRunningScript::GivePedScriptedTask (0x465C20) builds the task, then either
  * adds it to the sequence being recorded, when the handle is -1, or gives it to the ped and records the
  * command that asked for it, so GET_SCRIPT_TASK_STATUS can answer later. The task itself is described here
  * rather than built, since the tasks are the host's. */
 givePedScriptedTask?(pedHandle:number,task:ScmScriptedTask,opcode:number):void;
 /** PERFORM_SEQUENCE_TASK: the ped runs the tasks a sequence recorded, repeating them when it was told to. */
 givePedSequence?(pedHandle:number,tasks:readonly ScmScriptedTask[],repeat:boolean,opcode:number):void;
 /** CPedIntelligence::SetPedDecisionMakerType: the decision maker a ped answers events with, or -1 for none. */
 setPedDecisionMaker?(handle:number,decisionMaker:number):void;
 /** CPed::SetAreaCode, which for the normal world also drops the ped's entry-exit and, for the player, the
  * entry-exit stack and the extra colour. */
 setPedAreaVisible?(handle:number,area:number):void;
 /** bNeverEverTargetThisPed. */
 setPedNeverTargeted?(handle:number,enabled:boolean):void;
 /** SetCurrentCharWeapon: the slot holding that weapon type becomes the current one. */
 setPedCurrentWeapon?(handle:number,weaponType:number):void;
 /** m_pLastEntityDamage: the ped, or the vehicle that ped rides in, did the damage. */
 pedLastDamagedBy?(handle:number):{ped?:number;vehicle?:number}|undefined;
 /** CTaskSimpleCarSetPedInAsDriver after an immediate flush. */
 warpPedIntoCar?(handle:number,vehicle:number):void;
 /** The teleport that flushes the ped's tasks, drops the point to the ground and lifts the ped off its base. */
 warpPedFromCarToCoord?(handle:number,x:number,y:number,z:number):void;
 /** Whether an animation of that name is playing on the ped. */
 pedIsPlayingAnim?(handle:number,animation:string):boolean;
 /** CPed::bIsTalking and the scripted speech gate SHUT_CHAR_UP_FOR_SCRIPTED_SPEECH sets. */
 shutPedUpForScriptedSpeech?(handle:number,enabled:boolean):void;
 /** CWorld's closest object of a model within a radius, whose visibility the script switches. The world holds
  * those objects, so the host finds and flips it. */
 setVisibilityOfClosestObjectOfType?(x:number,y:number,z:number,radius:number,model:number|string,visible:boolean):void;
 /** CEntryExitManager's flags: the entry-exit nearest a point within a radius takes or loses one flag, and
  * an entry-exit named in the world file is switched on or off by name. */
 setClosestEntryExitFlag?(x:number,y:number,radius:number,flag:number,on:boolean):void;
 switchEntryExit?(name:string,on:boolean):void;
 /** CWorld::ClearExcitingStuffFromArea (0x56A0D0): the peds, cars and objects in a radius that may be
  * deleted, leaving the player and their group alone. The flag also takes the projectiles and shadows. */
 clearExcitingStuffFromArea?(point:{x:number;y:number;z:number},radius:number,removeProjectilesAndShadows:boolean):void;
 /** A vehicle's matrix rows, right, forward, up and position, for the object-space transform. */
 vehicleMatrix?(handle:number):{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};position:{x:number;y:number;z:number}};
 /** CPedScriptedTaskRecord::GetStatus(ped, opcode): the status the record holds for that command, or none. */
 scriptTaskStatus?(pedHandle:number,opcode:number):number;
 /** CPed::GiveDelayedWeapon, which also drops what the ped holds when it is not the player. */
 givePedWeapon?(handle:number,weaponType:number,ammo:number):void;
 /** m_fMaxHealth, and the shoot rate the ped fires at. */
 setPedMaxHealth?(handle:number,health:number):void;
 setPedShootRate?(handle:number,rate:number):void;
 /** CPedIntelligence's acquaintance table: how this ped regards that ped type. */
 setPedRelationship?(handle:number,relationship:number,pedType:number):void;
 clearPedRelationship?(handle:number,relationship:number,pedType:number):void;
 /** CPedIntelligence::ClearTasks, which unlike the immediate flush lets the ped finish what it is doing. */
 clearPedTasks?(handle:number):void;
 /** CVehicle::m_fHealth. */
 vehicleHealth?(handle:number):number;
 setVehicleHealth?(handle:number,health:number):void;
 /** The freeze that stops a car moving, the same bDontApplySpeed the ped one sets. */
 freezeVehiclePosition?(handle:number,frozen:boolean):void;
 /** CVehicle::m_nDoorLock. */
 setVehicleDoorLock?(handle:number,lock:number):void;
 /** m_vecMoveSpeed's magnitude times fifty, the speed a script reads. */
 vehicleSpeed?(handle:number):number;
 /** CAutoPilot::m_nCarDrivingStyle. */
 setVehicleDrivingStyle?(handle:number,style:number):void;
 /** The four paint slots: primary, secondary, and the two extra ones a script can read. */
 vehicleColours?(handle:number):{primary:number;secondary:number;tertiary:number;quaternary:number};
 /** CAutomobile::PopBootUsingPhysics on the player's own car. */
 popCarBoot?(handle:number):void;
 /** CTrain::SkipToNextAllowedStation. */
 skipTrainToNextStation?(handle:number):void;
 /** CVehicleAudio's helicopter voice, which the script can silence. */
 setHeliAudio?(handle:number,enabled:boolean):void;
 /** CHeli::ClearHeliOrientation. */
 clearHeliOrientation?(handle:number):void;
 /** CPlayerInfo::BlowUpRCBuggy(false). */
 removeRCBuggy?():void;
 /** CVehicle::IsInAirProper. */
 vehicleIsInAirProper?(handle:number):boolean;
 /** CPed::m_fHealth. */
 pedHealth?(handle:number):number;
 /** Whether the ped is sitting in that car, which is more than holding it: it must have the sitting task. */
 pedIsSittingInCar?(handle:number,vehicle:number):boolean;
 /** SetStayInSamePlace, bNoCriticalHits inverted, bCanBeShotInVehicle, bDontDragMeOutCar and the freeze that
  * sets bDontApplySpeed, each a flag of its own on the ped. */
 setPedStayInSamePlace?(handle:number,stay:boolean):void;
 setPedSuffersCriticalHits?(handle:number,suffers:boolean):void;
 setPedCanBeShotInVehicle?(handle:number,canBeShot:boolean):void;
 setPedCantBeDraggedOut?(handle:number,cannot:boolean):void;
 freezePedPosition?(handle:number,frozen:boolean):void;
 /** bDontLoadCollision inverted, with the ped left waiting for its collision when it is set. */
 setPedLoadsCollision?(handle:number,loads:boolean):void;
 /** CPed::AttachPedToEntity with an offset, a position, an angle limit in radians and a weapon. */
 attachPedToCar?(handle:number,vehicle:number,offset:{x:number;y:number;z:number},position:number,angleLimit:number,weapon:number):void;
 /** DettachPedFromEntity, which does nothing when the ped is attached to nothing. */
 detachPedFromCar?(handle:number):void;
 /** CTheScripts::IsPedStopped, which the stopped forms of the locate commands ask for. */
 pedIsStopped?(handle:number):boolean;
 /** CRunningScript::HighlightImportantArea, the debug box a locate command draws when it is asked to. */
 highlightArea?(point:{x:number;y:number;z:number},radius:{x:number;y:number;z:number}):void;
 /** CPedIntelligence::FlushImmediately. */
 clearPedTasksImmediately?(handle:number):void;
 /** TheCamera::IsSphereVisible for IS_POINT_ON_SCREEN. */
 isSphereVisible?(point:{x:number;y:number;z:number},radius:number):boolean;
 /** CRenderer::RequestObjectsInDirection with CStreaming::LoadScene, the scene load that faces a heading. */
 loadSceneInDirection?(x:number,y:number,z:number,heading:number):void;
 /** CWorld::FindGroundZFor3DCoord for GET_GROUND_Z_FOR_3D_COORD: the ground under a point, looking down from it. */
 groundZFor3DCoord?(x:number,y:number,z:number):number;
 /** CWorld::FindGroundZForCoord, which POINT_CAMERA_AT_POINT uses for a target below minus a hundred. */
 groundZForCoord?(x:number,y:number):number;
 /** LOAD_TEXTURE_DICTIONARY: CTxdStore loads models\txd\<name>.txd into the script slot and keeps a reference;
  * REMOVE_TEXTURE_DICTIONARY drops it again. */
 loadScriptTextureDictionary?(name:string):void;
 removeScriptTextureDictionary?():void;
 /** CPopCycle::m_nCurrentZoneType for GET_CURRENT_POPULATION_ZONE_TYPE. */
 currentPopulationZoneType?():number;
 /** CStreaming requests. A negative script model id names a UsedObjectArray entry. */
 requestModel?(model:number|string):void;
 hasModelLoaded?(model:number|string):boolean;
 markModelNotNeeded?(model:number|string):void;
 loadAllModelsNow?():void;
}
export interface ScmThreadHost {
 startScript(entry:number,argumentBits:readonly number[]):void;
 world?:ScmWorldCommands;nextRandom?:()=>number;game?:ScmGameState;
 loadMission?(missionId:number):void;launchMission?(label:number):void;
 terminateAllWithName?(name:string):void;
 /** START_NEW_STREAMED_SCRIPT: the host loads the file if it must and starts a thread over its own bytes. */
 startStreamedScript?(index:number,argumentBits:readonly number[]):void;
 /** Header object names for negative script model operands. */
 objectNames?:readonly string[];
}

/** CRunningScript execution core, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 * Caller owns mutable ScriptSpace and scheduling. Ordinary threads have 32
 * locals plus two timers; mission threads receive the shared mission-local
 * storage instead. Native commands outside the ported families fail
 * explicitly. This is not a campaign-complete VM. */
export class ScmThread {
 ip:number;name='noname';condition=false;logical=0;wakeTime=0;terminated=false;
 /** CRunningScript::Init defaults for the streamed-script fields: an ordinary thread is not external and has no
  * external type, which is what decides whether its objects are OBJECT_MISSION or OBJECT_MISSION2. */
 isExternal=false;externalType=-1;
 /** CRunningScript::Init defaults for the mission-lifecycle flags. */
 usesMissionCleanup=false;thisMustBeTheOnlyMissionRunning=false;deathArrestEnabled=true;doneDeathArrest=false;isTextBlockOverride=false;
 readonly stack:number[]=[];
 readonly locals:DataView;
 private readonly globals:DataView;
 private readonly strings:ScmStrings;
 constructor(readonly scriptSpace:Uint8Array,entry:number,readonly base=0,locals=new DataView(new ArrayBuffer(34*4)),readonly host?:ScmThreadHost){
  this.globals=new DataView(scriptSpace.buffer,scriptSpace.byteOffset,scriptSpace.byteLength);
  this.locals=locals;this.strings=new ScmStrings(this.globals,locals);this.ip=this.address(entry);
 }
 private address(offset:number){
  requireAsset(Number.isInteger(offset)&&offset>=0&&offset<this.scriptSpace.length,'SCM instruction address out of bounds.');return offset;
 }
 private target(label:number){return this.address(label>=0?label:this.base-label);}
 private variable(p:ScmParameter){
  if(p.type===7||p.type===8){
   requireAsset(Array.isArray(p.value)&&p.value.length===6,'Invalid SCM array reference.');
   const bytes=p.value as number[],base=bytes[0]|bytes[1]<<8,indexVariable=bytes[2]|bytes[3]<<8;
   const index=this.read({type:bytes[5]&0x80?2:3,value:indexVariable},'int');
   // Native ReadArrayInformation ignores the encoded count/type. Bounds are
   // checked against actual storage, not that advisory array length.
   const view=p.type===7?this.globals:this.locals,offset=(p.type===7?base:base*4)+index*4;
   requireAsset(Number.isInteger(offset)&&offset>=0&&offset+4<=view.byteLength,'SCM array address out of bounds.');
   return {view,offset};
  }
  requireAsset((p.type===2||p.type===3)&&typeof p.value==='number','Unsupported SCM variable reference.');
  const view=p.type===2?this.globals:this.locals,offset=p.type===2?p.value:p.value*4;
  requireAsset(Number.isInteger(offset)&&offset>=0&&offset+4<=view.byteLength,'SCM variable out of bounds.');
  return {view,offset};
 }
 private read(p:ScmParameter,kind:NumericKind):number{
  requireAsset(p,'Missing SCM operand.');
  if(p.type===2||p.type===3||p.type===7||p.type===8){const {view,offset}=this.variable(p);return kind==='int'?view.getInt32(offset,true):view.getFloat32(offset,true);}
  requireAsset([1,4,5,6].includes(p.type)&&typeof p.value==='number','Unsupported SCM numeric operand.');
  // Script parameters are an untagged 32-bit union after collection.
  const bits=new DataView(new ArrayBuffer(4));
  if(p.type===6)bits.setFloat32(0,p.value,true);else bits.setInt32(0,p.value,true);
  return kind==='int'?bits.getInt32(0,true):bits.getFloat32(0,true);
 }
 private write(p:ScmParameter,value:number,kind:NumericKind){
  requireAsset(p,'Missing SCM operand.');const {view,offset}=this.variable(p);
  if(kind==='int')view.setInt32(offset,value,true);else view.setFloat32(offset,value,true);
 }
 readInt(p:ScmParameter){return this.read(p,'int');}
 readFloat(p:ScmParameter){return this.read(p,'float');}
 writeInt(p:ScmParameter,value:number){this.write(p,value,'int');}
 writeFloat(p:ScmParameter,value:number){this.write(p,value,'float');}
 text(p:ScmParameter){requireAsset(p,'Missing SCM operand.');return this.strings.text(p);}
 /** Byte offset of a global variable operand, as native handlers read it. */
 globalOffset(p:ScmParameter){
  requireAsset(p.type===2&&typeof p.value==='number','Expected an SCM global variable operand.');this.variable(p);return p.value as number;
 }
 /** CRunningScript::UpdateCompareFlag (0x4859D0) with the opcode NOT bit. */
 updateCompareFlag(value:boolean,negated:boolean){this.compare(value,negated);}
 private compare(value:boolean,negated:boolean){
  if(negated)value=!value;
  if(this.logical===0)this.condition=value;
  else if(this.logical>=1&&this.logical<=8){this.condition=this.condition&&value;this.logical=this.logical===1?0:this.logical-1;}
  else if(this.logical>=21&&this.logical<=28){this.condition=this.condition||value;this.logical=this.logical===21?0:this.logical-1;}
 }
 /** CRunningScript::ResetIP: unwind to the outermost GOSUB return address.
  * The pinned transcription post-decrements past the top entry and is marked
  * as an original bug there; the outermost return address is the documented
  * mission-wrapper behaviour this port follows. */
 resetIp(){
  requireAsset(this.stack.length>0,'ResetIP with an empty GOSUB stack is undefined in the source.');
  this.ip=this.stack[0];this.stack.length=0;
 }
 /** Run until WAIT/termination. The watchdog throws instead of silently
  * yielding a runaway script and changing original cooperative scheduling. */
 run(nowMs:number,budget=10000,timeStep?:number):'waiting'|'terminated'{
  requireAsset(Number.isInteger(nowMs)&&nowMs>=0&&nowMs<=0xffffffff,'Invalid SCM clock.');
  requireAsset(Number.isInteger(budget)&&budget>0,'Invalid SCM instruction budget.');
  requireAsset(timeStep===undefined||Number.isFinite(timeStep)&&timeStep>=0,'Invalid SCM timestep.');
  if(this.terminated)return 'terminated';
  if(nowMs<this.wakeTime)return 'waiting';
  for(let count=0;count<budget;count++){
   const i=decodeScmInstruction(this.scriptSpace,this.ip),op=i.opcode&0x7fff,p=i.parameters;
   let next=i.end;
   if(op===0){/* NOP */}
   else if(op===1){this.wakeTime=(nowMs+(this.read(p[0],'int')>>>0))>>>0;this.ip=next;return 'waiting';}
   else if(op===2)next=this.target(this.read(p[0],'int'));
   else if(op>=4&&op<=23||op>=88&&op<=119){
    const kind:NumericKind=op%2===0?'int':'float',rhs=this.read(p[1],kind);
    if(op<=7)this.write(p[0],rhs,kind);
    else{
     const lhs=this.read(p[0],kind);let result:number;
     if(op<=11||op>=88&&op<=95)result=lhs+rhs;
     else if(op<=15||op>=96&&op<=103)result=lhs-rhs;
     else if(op<=19||op>=104&&op<=111)result=kind==='int'?Math.imul(lhs,rhs):lhs*rhs;
     else{
      if(kind==='int')requireAsset(rhs!==0&&!(lhs===-2147483648&&rhs===-1),'Invalid SCM integer division.');
      result=kind==='int'?Math.trunc(lhs/rhs):lhs/rhs;
     }
     this.write(p[0],result,kind);
    }
   }else if(op>=120&&op<=131){
    requireAsset(timeStep!==undefined,'Timed SCM arithmetic requires the native timestep.');
    const lhs=this.read(p[0],'float'),delta=Math.fround(Math.fround(timeStep)*this.read(p[1],'float'));
    this.write(p[0],op<=125?lhs+delta:lhs-delta,'float');
   }else if(op>=132&&op<=139||op===1198||op===1199){
    const kind:NumericKind=op>=134&&op<=137?'float':'int';this.write(p[0],this.read(p[1],kind),kind);
   }else if(op>=140&&op<=147){
    const kind:NumericKind=op%2===0?'int':'float',value=this.read(p[1],kind==='int'?'float':'int');
    if(kind==='int')requireAsset(Number.isFinite(value)&&Math.trunc(value)>=-2147483648&&Math.trunc(value)<=2147483647,'SCM float-to-int conversion out of range.');
    this.write(p[0],kind==='int'?Math.trunc(value):value,kind);
   }else if(op>=148&&op<=151){
    const kind:NumericKind=op<=149?'int':'float';this.write(p[0],Math.abs(this.read(p[0],kind)),kind);
   }else if(op===197||op===198){
    this.compare(op===197,!!(i.opcode&0x8000));
   }else if(op===1449||op===1450||op===1745||op===1746){
    this.strings.assign(p[0],p[1],op<=1450?8:16);
   }else if(op>=2116&&op<=2119){
    this.compare(this.strings.text(p[0]).length===0,!!(i.opcode&0x8000));
   }else if(op===1453||op===1454||op===2297||op===2298){
    this.compare(this.strings.text(p[0])===this.strings.text(p[1]),!!(i.opcode&0x8000));
   }else if(op===153||op===520||op===521){
    if(!this.host?.nextRandom)throw new UnsupportedScmCommand(i.offset,op,i.name);
    const destination=p[op===153?0:2];this.variable(destination);
    const kind:NumericKind=op===520?'float':'int';
    const sample=this.host.nextRandom();
    // GENERATE_RANDOM_INT stores the raw sample; the range commands share
    // the CGeneral interpolation with the rest of the engine.
    const value=op===153?sample
     :kind==='int'?randomIntInRange(sample,this.read(p[0],'int'),this.read(p[1],'int'))
     :randomFloatInRange(sample,this.read(p[0],'float'),this.read(p[1],'float'));
    if(op===153)requireAsset(Number.isInteger(sample)&&sample>=0&&sample<=RANDOM_SAMPLE_MAX,'Invalid native random sample.');
    this.write(destination,value,kind);
   }else if(op>=24&&op<=60||op>=66&&op<=70){
    const kind:NumericKind=op<40?(op<32?'int':'float'):op<56?(op<48?'int':'float'):op<66?'int':'float';
    const a=this.read(p[0],kind),b=this.read(p[1],kind);
    this.compare(op<40?a>b:op<56?a>=b:a===b,!!(i.opcode&0x8000));
   }else if(op===0x4a3||op===0x4a4||op>=0x4b0&&op<=0x4b7){
    // Constant-operand integer compares. 04B0-04B7 follow the IsGreater /
    // IsGreaterEqual handlers; the 04A3/04A4 equality dispatch is unreversed.
    const a=this.read(p[0],'int'),b=this.read(p[1],'int');
    this.compare(op<0x4b0?a===b:op<0x4b4?a>b:a>=b,!!(i.opcode&0x8000));
   }else if(op===0x871||op===0x872){
    // SWITCH_START / SWITCH_CONTINUED: dispatch unreversed; the jump-table
    // helpers and statics are reversed. START carries the value, case count,
    // default flag and address plus seven (value, label) pairs; CONTINUED
    // carries nine more pairs. The jump happens once every case is read.
    const state=this.host?.game;if(!state)throw new UnsupportedScmCommand(i.offset,op,i.name,'no game state');
    let at=0;
    if(op===0x871){state.switchValue=this.read(p[0],'int');state.switchEntriesToRead=this.read(p[1],'int');state.switchDefaultExists=this.read(p[2],'int')!==0;state.switchDefaultAddress=this.read(p[3],'int');at=4;}
    for(let k=0,pairs=op===0x871?7:9;k<pairs&&state.switchEntriesToRead>0;k++,at+=2){state.addSwitchCase(this.read(p[at],'int'),this.read(p[at+1],'int'));state.switchEntriesToRead--;}
    if(state.switchEntriesToRead===0)next=this.target(state.useSwitchJumpTable());
   }else if(op===0x4d){if(!this.condition)next=this.target(this.read(p[0],'int'));}
   else if(op===0x4e){this.terminated=true;this.ip=next;return 'terminated';}
   else if(op===0x4f){
    if(!this.host)throw new UnsupportedScmCommand(i.offset,op,i.name);
    const entry=this.read(p[0],'int');this.address(entry);
    requireAsset(p.length-1<=34,'SCM new-thread arguments exceed local storage.');
    // Raw union bits, including floats and referenced variables, are copied.
    const args=p.slice(1).map(parameter=>this.read(parameter,'int'));
    this.host.startScript(entry,args);
   }
   else if(op===0x50){
    next=this.target(this.read(p[0],'int'));requireAsset(this.stack.length<8,'SCM subroutine stack overflow.');this.stack.push(i.end);
   }else if(op===0x51){requireAsset(this.stack.length>0,'SCM subroutine stack underflow.');next=this.stack.pop()!;}
   else if(op===0xd6){
    const logical=this.read(p[0],'int');requireAsset(logical===0||logical>=1&&logical<=8||logical>=21&&logical<=28,'Invalid SCM logical operator.');
    this.logical=logical===0?0:logical+1;this.condition=logical>=1&&logical<=8;
   }else if(i.name==='SCRIPT_NAME'){
    requireAsset(p[0].type===9&&typeof p[0].value==='string','Unsupported SCM script name.');this.name=p[0].value;
   }else if(op===0x16a){
    if(!this.host?.world)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.world.fade(this.read(p[0],'int')>>>0,this.read(p[1],'int')&0xffff,nowMs);
   }else if(op===0xd7){
    // LAUNCH_MISSION: CTheScripts::StartNewScript(&ScriptSpace[label]).
    if(!this.host?.launchMission)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.launchMission(this.address(this.read(p[0],'int')));
   }else if(op===0x417){
    if(!this.host?.loadMission)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.loadMission(this.read(p[0],'int'));
   }else if(op===0x459){
    if(!this.host?.terminateAllWithName)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.terminateAllWithName(this.strings.text(p[0]));
   }else if(NATIVE_NOP_OPCODES.has(op)){/* PC 1.0 parses operands and does nothing. */}
   else{
    const handler=SCM_GAME_COMMANDS.get(op);
    if(!handler)throw new UnsupportedScmCommand(i.offset,op,i.name);
    handler(this,p,i,nowMs);
   }
   this.ip=next;
  }
  throw new Error(`SCM instruction watchdog at ${this.ip}`);
 }
}
