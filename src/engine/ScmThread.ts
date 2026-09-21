import {createScmDecodeBuffer,decodeScmInstructionInto,type ScmInstruction,type ScmParameter} from '../assets/scm';
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
/** One scratch word for the untagged 32-bit union a script parameter is. Written and read within a single
 * read, so a thread never sees another's. */
const UNION_BITS=new DataView(new ArrayBuffer(4));
/** Game-world effects a script can request. Every member beyond fade is
 * optional: a missing adapter stops the script explicitly at that command. */
/** One scripted task as its command describes it; a host builds the CTask this names. */
export type ScmScriptedTask=
 |{kind:'killPedOnFoot';target:number;time:number;flags:number;actionDelay:number;actionChance:number;mustBeOnFoot:boolean}
 |{kind:'turnToFaceEntity';target:number}
 /* The tasks below take their operands from the pinned Sanny Builder schema this project already generates its
  * opcode table from, which names and types every one of them. The names here are the schema's own. */
 |{kind:'goStraightToCoord';x:number;y:number;z:number;speed:number;time:number}
 |{kind:'followPathNodesToCoord';x:number;y:number;z:number;speed:number;time:number}
 |{kind:'playAnim';animationName:string;animationFile:string;blendSpeed:number;loop:boolean;lockX:boolean;lockY:boolean;keepLastFrame:boolean;time:number;interruptable:boolean}
 |{kind:'stayInSamePlace';state:boolean}
 |{kind:'toggleDuck';state:boolean}
 |{kind:'achieveHeading';heading:number}
 |{kind:'pause';time:number}
 |{kind:'leaveAnyCar'}
 |{kind:'lookAtPed';target:number;time:number}
 |{kind:'carDriveToCoord';vehicle:number;x:number;y:number;z:number;speed:number;driveStyle:number;model:number|string;drivingStyle:number}
 |{kind:'driveBy';targetPed:number;targetVehicle:number;x:number;y:number;z:number;radius:number;type:number;rightHandCarSeat:boolean;fireRate:number}
 |{kind:'followPointRoute';speed:number;mode:number}
 |{kind:'goToCoordAnyMeans';x:number;y:number;z:number;speed:number;vehicle:number}
 |{kind:'enterCarAsDriver';vehicle:number;time:number}
 |{kind:'enterCarAsPassenger';vehicle:number;time:number;seat:number}
 |{kind:'leaveCar';vehicle:number}
 |{kind:'standStill';time:number}
 |{kind:'shootAtCoord';x:number;y:number;z:number;time:number}
 |{kind:'setDecisionMaker';decisionMaker:number}
 |{kind:'chatWithPed';other:number;leadSpeaker:boolean;unknown:number}
 |{kind:'carMission';vehicle:number;targetVehicle:number;missionId:number;cruiseSpeed:number;drivingStyle:number}
 |{kind:'carTempAction';vehicle:number;actionId:number;time:number}
 |{kind:'smartFleePed';threat:number;radius:number;time:number}
 |{kind:'turnToFaceCoord';x:number;y:number;z:number}
 |{kind:'die'}
 |{kind:'kindaStayInSamePlace';state:boolean}
 |{kind:'useMobilePhone';start:boolean}
 |{kind:'pickUpObject';object:number;offset:{x:number;y:number;z:number};bone:number;orientation:number;animationName:string;animationFile:string;time:number}
 |{kind:'goToCoordWhileShooting';x:number;y:number;z:number;speed:number;turnRadius:number;stopRadius:number;target:number}
 |{kind:'carDriveWander';vehicle:number;speed:number;drivingMode:number}
 |{kind:'followPatrolRoute';speed:number;mode:number}
 |{kind:'gotoPed';target:number;time:number;radius:number}
 |{kind:'togglePedThreatScanner';onFoot:boolean;inCar:boolean;duringScriptTask:boolean}
 |{kind:'destroyCar';vehicle:number}
 |{kind:'shuffleToNextCarSeat';vehicle:number}
 |{kind:'scratchHead'}
 |{kind:'lookAtCoord';x:number;y:number;z:number;time:number}
 |{kind:'climb';flag:boolean}
 |{kind:'duck';time:number}
 |{kind:'setIgnoreWeaponRangeFlag';state:boolean}
 |{kind:'wanderStandard'}
 |{kind:'killPedOnFootTimed';target:number;time:number}
 |{kind:'lookAbout';time:number}
 |{kind:'aimGunAtCoord';x:number;y:number;z:number;time:number}
 |{kind:'aimGunAtPed';target:number;time:number}
 |{kind:'shootAtPed';target:number;time:number}
 |{kind:'leaveCarImmediately';vehicle:number}
 |{kind:'dieNamedAnim';animationName:string;animationFile:string;blendSpeed:number;time:number}
 |{kind:'slideToCoordAndPlayAnim';x:number;y:number;z:number;heading:number;slideSpeed:number;animationName:string;animationFile:string;blendSpeed:number;loop:boolean;lockX:boolean;lockY:boolean;keepLastFrame:boolean;time:number}
 |{kind:'fleePed';threat:number;radius:number;time:number}
 |{kind:'fleePoint';x:number;y:number;z:number;radius:number;time:number}
 |{kind:'handsUp';time:number}
 |{kind:'jump';state:boolean}
 |{kind:'sitDown';time:number}
 |{kind:'drivePointRouteAdvanced';vehicle:number;speed:number;driveMode:number;model:number|string;drivingStyle:number}
 |{kind:'everyoneLeaveCar';vehicle:number}
 |{kind:'smartFleePoint';x:number;y:number;z:number;radius:number;time:number}
 |{kind:'lookAtVehicle';vehicle:number;time:number}
 |{kind:'lookAtObject';object:number;time:number}
 |{kind:'weaponRoll';state:boolean}
 |{kind:'fallAndGetUp';state:boolean;time:number}
 |{kind:'diveAndGetUp';x:number;y:number;time:number}
 |{kind:'gotoPedOffset';target:number;time:number;offsetX:number;offsetY:number}
 |{kind:'followFootsteps';target:number}
 |{kind:'fleePedAnyMeans';threat:number;radius:number;time:number;flag:boolean;unknown1:number;unknown2:number;unknown3:number}
 |{kind:'swimToCoord';x:number;y:number;z:number}
 |{kind:'leaveCarAndFlee';vehicle:number;x:number;y:number;z:number}
 |{kind:'gotoCar';vehicle:number;time:number;radius:number}
 |{kind:'dead'};
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
 /** The same routine with a model and a ped type the game picks, which is what CREATE_RANDOM_CHAR asks for. */
 createRandomChar?(x:number,y:number,z:number):number;
 /** CPed's look task, which CLEAR_LOOK_AT ends. */
 clearPedLookAt?(handle:number):void;
 /** CPedGroupMembership: whether the ped belongs to the group the script names. */
 pedIsInGroup?(handle:number,group:number):boolean;
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
 /* The mission audio a script loads into one of four slots. The runtime keeps the slots; a host loads the
  * sample, plays it and says when it is ready and when it has run out. The slot numbers here are the script's
  * own, counting from one. */
 loadMissionAudio?(scriptSlot:number,sampleId:number):void;
 playMissionAudio?(scriptSlot:number):void;
 clearMissionAudio?(scriptSlot:number):void;
 /** The eLevelName of the map zone the player stands in: countryside, then the three cities. */
 playerCity?(playerId:number):number;
 /** CClothes::RebuildPlayer over the clothes description, then CReplay::Init. */
 buildPlayerModel?(playerId:number):void;
 /** CWorld::StopAllLawEnforcersInTheirTracks, which both back-off commands call as they go on. */
 stopAllLawEnforcers?():void;
 /** CPlayerInfo::MakePlayerSafe with its radius. */
 makePlayerSafe?(playerId:number,safe:boolean,radius:number):void;
 /* More of the ped, each mirroring the body of the command that asks for it. */
 /** CPed::m_aWeapons: whether the ped carries a weapon of that type in any slot. */
 pedHasWeapon?(handle:number,weaponType:number):boolean;
 /** CPed::GetActiveWeapon: the type it is holding, and whether that type is a melee one. */
 pedActiveWeapon?(handle:number):{type:number;melee:boolean};
 /** CPed::m_nLastWeaponDamage, which CDarkel::CheckDamagedWeaponType reads for the two wildcards. */
 pedLastWeaponDamage?(handle:number):{type:number;melee:boolean}|undefined;
 /** CPed::SetUsesCollision. */
 setPedCollision?(handle:number,usesCollision:boolean):void;
 /** CPed::bFiringWeapon. */
 pedIsShooting?(handle:number):boolean;
 /** CEntity::GetIsOnScreen. */
 pedIsOnScreen?(handle:number):boolean;
 /** Whether the ped is in a vehicle and carries the sitting-in-car task. */
 pedIsSittingInAnyCar?(handle:number):boolean;
 /** Whether the ped is out of a vehicle and not climbing into one, as a driver or a passenger. */
 pedIsOnFoot?(handle:number):boolean;
 /** The four ped flags these commands set, three of which the source stores inverted. */
 setPedFlag?(handle:number,flag:'notAllowedToDuck'|'stayInCarOnJack'|'doesntDropWeaponsWhenDead'|'getOutUpsideDownCar',value:boolean):void;
 /** physicalFlags.bDontApplySpeed, with the waiting-for-collision mark the freeze also makes. */
 freezePedPositionAndWaitForCollision?(handle:number,freeze:boolean):void;
 /** CPedGroupMembership::RemoveMember, which leaves a leader where it is. */
 removePedFromGroup?(handle:number):void;
 /** CTheScripts' elegant removal: a mission ped in a vehicle goes, and one on foot is handed back to the game. */
 removePedElegantly?(handle:number):void;
 /** CAEPedSpeechAudioEntity: one ped's speech, or every ped's. */
 setPedSpeechDisabled?(handle:number,disabled:boolean):void;
 setAllPedSpeechDisabled?(disabled:boolean):void;
 /** An animation the ped is playing, by name: its speed, and how far through it is as a fraction. */
 setPedAnimSpeed?(handle:number,animation:string,speed:number):void;
 pedAnimProgress?(handle:number,animation:string):number|undefined;
 /** CTheZones::FindZone for ZONE_TYPE_NAVI at the ped's own position. */
 pedIsInNaviZone?(handle:number,zoneName:string):boolean;
 /** The sniper-rifle head shot EXPLODE_CHAR_HEAD builds a damage event for. */
 explodePedHead?(handle:number):void;
 /** physicalFlags.bSubmergedInWater. */
 pedIsInWater?(handle:number):boolean;
 /** GetPedOrItsVehicle's heading in degrees: a ped in a car reads the car's. */
 pedHeading?(handle:number):number;
 /** CEntity::SetIsVisible, which for the player also moves gPlayerPedVisible. */
 setPedVisible?(handle:number,visible:boolean):void;
 /** The ped flags this batch sets, each stored exactly as the command gives it. */
 setPedSimpleFlag?(handle:number,flag:'bleeding'|'drownsInWater'|'neverLeavesGroup',value:boolean):void;
 /** CPed::DisablePedSpeech, which can stop what the ped is saying, and its enable. */
 disablePedSpeech?(handle:number,stopCurrentSpeech:boolean):void;
 enablePedSpeech?(handle:number):void;
 /** CPed::ClearWeapons and CPed::SetAmmo. */
 removeAllPedWeapons?(handle:number):void;
 setPedAmmo?(handle:number,weaponType:number,ammo:number):void;
 /** CWeapon::m_nTotalAmmo of the ped's weapon of that type, and nothing where it carries none. */
 pedWeaponAmmo?(handle:number,weaponType:number):number|undefined;
 /** m_nMoneyCount, with the flag saying the script gave it. */
 setPedMoney?(handle:number,money:number):void;
 /** bHasBeenPhotographed, which the question lowers as it answers. */
 takePedPhotographedFlag?(handle:number):boolean;
 /** The car the ped rides, or the one it is climbing into as a driver or a passenger. */
 pedCarInUse?(handle:number):number|undefined;
 /** The ped in a passenger seat of a car, or nothing where that seat is empty. */
 pedInPassengerSeat?(vehicle:number,seat:number):number|undefined;
 /** CTaskSimpleCarSetPedInAsPassenger after an immediate task flush: a warp into a seat. */
 warpPedIntoCarAsPassenger?(handle:number,vehicle:number,seat:number):void;
 /** CTheScripts::StuckCars, which the script adds a car to and takes it out of again. */
 removeStuckCarCheck?(vehicle:number):void;
 /** CPed::AttachPedToEntity over an object rather than a car, with its angle limit in radians. */
 attachPedToObject?(handle:number,object:number,offset:{x:number;y:number;z:number},position:number,angleLimit:number,weapon:number):void;
 /** m_fHealth, bSignalAfterKill, and the active weapon's type on its own. */
 pedSignalAfterKill?(handle:number,value:boolean):void;
 /** The dead ped's pickup point: its vehicle's position, or its pelvis bone. */
 deadPedCoordinates?(handle:number):{x:number;y:number;z:number};
 /** An animation the ped is playing, set to a fraction of its length. */
 setPedAnimProgress?(handle:number,animation:string,progress:number):void;
 /** CPlayerPed::ForceGroupToAlwaysFollow. */
 forcePlayerGroupToAlwaysFollow?(playerId:number,enable:boolean):void;
 /** CPlayerPed::m_pTargetedObject: what the player is aiming at, if anything. */
 playerTarget?(playerId:number):{kind:'ped'|'vehicle'|'object';handle:number}|undefined;
 /** CExplosion::TestForExplosionInArea over a box, for one explosion type. */
 explosionInArea?(type:number,min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):boolean;
 /** CTheZones::FindZone for ZONE_TYPE_INFO at the player's own position. */
 playerIsInInfoZone?(playerId:number,zoneName:string):boolean;
 /** CStuckCarCheck::AddCarToCheck, with the warp form's four extra switches. */
 addStuckCarCheck?(vehicle:number,radius:number,timeMs:number,warp:boolean,
  options:{stuck:boolean;flipped:boolean;inWater:boolean;nodesToCheck:number}):void;
 /** An animation an object is playing: whether it is, and its speed and progress. */
 objectIsPlayingAnim?(handle:number,animation:string):boolean;
 setObjectAnimSpeed?(handle:number,animation:string,speed:number):void;
 setObjectAnimProgress?(handle:number,animation:string,progress:number):void;
 /** CCamera::TakeControl over a ped, which only takes the player: any other ped hands it no entity. */
 pointCameraAtPed?(handle:number,isPlayer:boolean,mode:number,switchType:number):void;
 /** Whether the ped this names is the player's own. */
 pedIsPlayer?(handle:number):boolean;
 /** CEntity::GetHasCollidedWith, asked of the ped or the car it rides, against another ped, car or object. */
 pedIsTouching?(handle:number,other:{kind:'ped'|'vehicle'|'object';handle:number}):boolean;
 /** CVehicle::IsLawEnforcementVehicle for the car the ped rides, and the model it is. */
 pedVehicleModelId?(handle:number):number|undefined;
 pedVehicleIsLawEnforcement?(handle:number):boolean;
 /** CPed::bIsDucking, and CPed::GetMoveSpeed, which the engine keeps in units a frame at fifty frames. */
 pedIsDucking?(handle:number):boolean;
 pedSpeed?(handle:number):number;
 setPedVelocity?(handle:number,velocity:{x:number;y:number;z:number}):void;
 /** m_nLastWeaponDamage and m_pLastEntityDamage, which the script can clear. */
 clearPedLastWeaponDamage?(handle:number):void;
 clearPedLastDamageEntity?(handle:number):void;
 /** One weapon slot: the type, its ammo and the model a pickup of it would use. */
 pedWeaponInSlot?(handle:number,slot:number):{type:number;ammo:number;model:number};
 /** CPed::CreateDeadPedPickupCoors, which is not the same as the dead ped's own position. */
 deadPedPickupCoordinates?(handle:number):{x:number;y:number;z:number};
 /** CStuckCarCheck::HasCarBeenStuckForAWhile. */
 vehicleIsStuck?(handle:number):boolean;
 /** The active camera's own source, and the point it looks at, which is that source plus its forward. */
 activeCameraSource?():{x:number;y:number;z:number};
 activeCameraFront?():{x:number;y:number;z:number};
 /** CConversations::IsPlayerInPositionForConversation, which needs where the player and the ped both are. */
 isPlayerInPositionForConversation?(ped:number):boolean;
 /* The last of the ped and camera questions a host answers. */
 /** CPed::m_nPedType against the female types. */
 pedIsMale?(handle:number):boolean;
 pedModelId?(handle:number):number;
 /** CPed::GetMoveSpeed, in the engine's own units a frame. */
 pedVelocity?(handle:number):{x:number;y:number;z:number};
 /** Whether the ped carries one of the three tasks for climbing into a car. */
 pedIsGettingIntoCar?(handle:number):boolean;
 /** m_bIsStaticWaitingForCollision. */
 pedIsWaitingForCollision?(handle:number):boolean;
 /** m_pLastEntityDamage against a vehicle the script names. */
 pedWasDamagedByVehicle?(handle:number,vehicle:number):boolean;
 /** Whether any dead ped near this one can be seen by it. */
 pedCanSeeDeadPed?(handle:number):boolean;
 /** bChrisCriminal, bIgnoreHeightDifferenceFollowingNodes and the death-weapons flag. */
 setPedChrisCriminal?(handle:number,value:boolean):void;
 setPedIgnoreHeightDifferenceFollowingNodes?(handle:number,ignore:boolean):void;
 /** vehicleFlags.bAlwaysSkidMarks. */
 setVehicleAlwaysCreateSkids?(handle:number,enable:boolean):void;
 /** ANIMATION_IS_PLAYING on one of the ped's animations. */
 setPedAnimPlayingFlag?(handle:number,animation:string,playing:boolean):void;
 /** How far through an animation an object is, as a fraction, or nothing when it plays none. */
 objectAnimProgress?(handle:number,animation:string):number|undefined;
 /** CTaskSimpleCarSetPedOut with the ped put back where it stood. */
 removePedFromCarMaintainPosition?(handle:number,vehicle:number):void;
 /** CTaskComplexProstituteSolicit::GetRidOfPlayerProstitute. */
 getRidOfPlayerProstitute?():void;
 /** The camera the script puts in front of the player, or of a ped it names. */
 setCameraInFrontOfPlayer?():void;
 setCameraInFrontOfPed?(handle:number):void;
 /** The active camera's mode, its field of view, and the two angles the unfixed command sets. */
 activeCameraMode?():number;
 activeCameraFov?():number;
 setActiveCameraAngles?(vertical:number,horizontal:number):void;
 /** CCam::DoCamBump. */
 doCameraBump?(horizontal:number,vertical:number):void;
 /** The debug camera, which is the third of the camera array. */
 debugCameraSource?():{x:number;y:number;z:number};
 debugCameraFront?():{x:number;y:number;z:number};
 /* The ped commands the reference leaves unregistered but documents operand by operand. Each mirrors the one
  * line its documentation gives, which is all this source says about it. */
 /** The radius within which a ped's respected friends are told about what happens to it. */
 setPedInformRespectedFriends?(handle:number,radius:number,unknown:number):void;
 /** How far a ped may stray from the path node it follows, and how far its senses reach. */
 setPedFollowNodeThresholdDistance?(handle:number,range:number):void;
 setPedSenseRange?(handle:number,range:number):void;
 /** The animation group a ped moves with, and the move state the next task takes. */
 setPedAnimGroup?(handle:number,animGroup:number):void;
 setNextDesiredMoveState?(moveState:number):void;
 /** How far through its sequence a ped is, plainly and following nested sequences. */
 pedSequenceProgress?(handle:number):number;
 pedSequenceProgressRecursive?(handle:number):number;
 /** A sequence played from one task index to another rather than from its start. */
 performSequenceTaskFromProgress?(handle:number,sequence:number,startTask:number,endTask:number):void;
 /** Armour and ammo added to what the ped already carries, and a weapon taken away. */
 addArmourToPed?(handle:number,amount:number):void;
 addAmmoToPed?(handle:number,weaponType:number,ammo:number):void;
 removeWeaponFromPed?(handle:number,weaponType:number):void;
 /** The melee style and move a ped fights with. */
 givePedMeleeAttack?(handle:number,style:number,move:number):void;
 /** Damage dealt to a ped, which may or may not go through its armour. */
 damagePed?(handle:number,amount:number,damageArmour:boolean):void;
 /** Whether the ped drops what it holds, listens to the player's group commands, or is kept by the streamer. */
 setPedDropsObject?(handle:number,state:boolean):void;
 setPedListensToPlayerGroupCommands?(handle:number,state:boolean):void;
 setPedDontRemove?(handle:number):void;
 setPedDeathWeaponsPersist?(handle:number,state:boolean):void;
 /** A ped's group: whether it leads one, and how many follow it. */
 pedIsGroupLeader?(handle:number,group:number):boolean;
 pedFollowerCount?(handle:number):number;
 /** CPed::m_nPedType. */
 pedType?(handle:number):number;
 /** How fast a ped swims, which reaches the swim task it is running. */
 setPedSwimSpeed?(handle:number,speed:number):void;
 /** A line the ped says, with the three switches its documentation names. */
 pedSayContextImportant?(handle:number,phrase:number,overrideSilence:boolean,ignoreMute:boolean,frontEnd:boolean):number;
 /** A particle system tied to one of the ped's bones. */
 attachFxSystemToPedBone?(fxSystem:number,handle:number,bone:number):void;
 /** The attachment commands that limit which way an attached ped may face. */
 setHeadingLimitForAttachedPed?(handle:number,heading:number,headingRange:number):void;
 attachPedToBike?(handle:number,vehicle:number,offset:{x:number;y:number;z:number},heading:number,headingRange:number,pitchRange:number,weapon:number):void;
 /** Whether the ped stands in a searchlight, or at the attractor the script names. */
 pedIsInSearchlight?(searchlight:number,handle:number):boolean;
 pedIsAtScriptedAttractor?(handle:number,attractor:number):boolean;
 /** The path node nearest a point, which the script reads as a point of its own. */
 closestPedNode?(x:number,y:number,z:number):{x:number;y:number;z:number};
 /** A random ped in a named zone, of the kinds the script allows. */
 randomPedInZone?(zone:string,civilian:boolean,gang:boolean,criminalOrProstitute:boolean):number;
 /** A SWAT officer roped in at a point. */
 createSwatRope?(pedType:number,model:number|string,x:number,y:number,z:number):number;
 /** Whether the player is holding the button that skips a cutscene. */
 isSkipCutsceneButtonPressed?():boolean;
 /** CStreaming's request for a streamed script file, by its proper index. */
 requestStreamedScript?(index:number):void;
 /** The cutscene data a host loads, runs and drops. */
 loadCutscene?(name:string):void;
 startCutscene?():void;
 clearCutscene?():void;
 /* Vehicle and world commands whose operands the schema names. */
 setVehicleForwardSpeed?(handle:number,forwardSpeed:number):void;
 setVehicleCruiseSpeed?(handle:number,maxSpeed:number):void;
 changeVehicleColour?(handle:number,colour1:number,colour2:number):void;
 setVehicleLoadCollisionFlag?(handle:number,state:boolean):void;
 setVehicleOnlyDamagedByPlayer?(handle:number,state:boolean):void;
 setVehicleCanBurstTyres?(handle:number,state:boolean):void;
 /** CObject attached to a car with an offset and three rotations. */
 attachObjectToVehicle?(object:number,vehicle:number,offset:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number}):void;
 /** The particle system a script kills, and the explosion it sets off. */
 killFxSystem?(handle:number):void;
 addExplosion?(x:number,y:number,z:number,type:number):void;
 /** The ped's facial talk, and its weapon hidden for a scripted cutscene. */
 startPedFacialTalk?(handle:number,duration:number):void;
 stopPedFacialTalk?(handle:number):void;
 hidePedWeaponForScriptedCutscene?(handle:number,state:boolean):void;
 /** The group a ped is put into, and the entry-exit it has used. */
 setGroupMember?(group:number,handle:number):void;
 setPedHasUsedEntryExit?(handle:number,x:number,y:number,radius:number):void;
 /** The decision-maker event response a script clears. */
 clearPedDecisionMakerEventResponse?(decisionMaker:number,event:number):void;
 /** The patrol route a task follows, built a point at a time with an animation at each. */
 extendPatrolRoute?(x:number,y:number,z:number,animationName:string,animationFile:string):void;
 /** The mission-passed tune, and the two message questions the HUD answers. */
 playMissionPassedTune?(soundId:number):void;
 isMessageBeingDisplayed?():boolean;
 isHelpMessageBeingDisplayed?():boolean;
 /* More of the world the schema names. */
 vehicleExistsByHandle?(handle:number):boolean;
 vehicleIsStopped?(handle:number):boolean;
 vehicleIsOnScreen?(handle:number):boolean;
 explodeVehicle?(handle:number):void;
 vehicleDriver?(handle:number):number|undefined;
 /** CStreaming's random vehicle model in memory, with the class it belongs to. */
 randomVehicleModelInMemory?(normalOnly:boolean):{model:number;vehicleClass:number};
 /** The ped commands this batch adds. */
 setPedKindaStayInSamePlace?(handle:number,state:boolean):void;
 setPedKeepTask?(handle:number,state:boolean):void;
 setPedWeaponSkill?(handle:number,skill:number):void;
 setPedCoordinatesDontWarpGang?(handle:number,x:number,y:number,z:number):void;
 pedIsRespondingToEvent?(handle:number,event:number):boolean;
 addPedDecisionMakerEventResponse?(decisionMaker:number,event:number,taskId:number,
  chances:{respect:number;hate:number;like:number;dislike:number},inCar:boolean,onFoot:boolean):void;
 /** The object commands: a slide to a point at a speed, and its health. */
 slideObject?(handle:number,position:{x:number;y:number;z:number},speed:{x:number;y:number;z:number},collisionCheck:boolean):void;
 setObjectHealth?(handle:number,health:number):void;
 /** The particle system a script plays, and a one-off sound at a point. */
 playFxSystem?(handle:number):void;
 addOneOffSound?(x:number,y:number,z:number,soundId:number):void;
 /** The blip's own entry-exit, and the HUD colour the script reads. */
 setBlipEntryExit?(blip:number,x:number,y:number,radius:number):void;
 hudColour?(colour:number):{red:number;green:number;blue:number;alpha:number};
 /** The onscreen timer the script displays with a label. */
 displayOnscreenTimerWithString?(timer:number,direction:number,text:string):void;
 /* The vehicle, object and world commands of this batch, each named by the schema. */
 switchVehicleSiren?(handle:number,state:boolean):void;
 vehicleGotoCoordinates?(handle:number,x:number,y:number,z:number):void;
 setVehicleHeavy?(handle:number,state:boolean):void;
 setVehiclePetrolTankWeakpoint?(handle:number,state:boolean):void;
 setVehicleStatus?(handle:number,status:number):void;
 setVehicleRotationVelocity?(handle:number,x:number,y:number,z:number):void;
 freezeVehiclePositionAndDontLoadCollision?(handle:number,state:boolean):void;
 openVehicleDoor?(handle:number,door:number):void;
 setVehicleIdle?(handle:number):void;
 setTrainCruiseSpeed?(handle:number,speed:number):void;
 /** The objects this batch reaches. */
 setObjectVisible?(handle:number,state:boolean):void;
 setObjectOnlyDamagedByPlayer?(handle:number,state:boolean):void;
 makeObjectTargettable?(handle:number,state:boolean):void;
 breakObject?(handle:number,intensity:number):void;
 objectHasBeenDamaged?(handle:number):boolean;
 closestObjectOfTypeIsSmashedOrDamaged?(x:number,y:number,z:number,radius:number,model:number|string,smashed:boolean,damaged:boolean):boolean;
 /** The particle system a script creates by name at a point. */
 createFxSystem?(name:string,x:number,y:number,z:number,ignoreBoundingChecks:boolean):number;
 /** The ped's target priority, and the gang-size limits the script sets. */
 setPedIsTargetPriority?(handle:number,state:boolean):void;
 setScriptLimitToGangSize?(maxSize:number):void;
 makeRoomInPlayerGangForMissionPeds?(count:number):void;
 /** The patrol route this batch flushes, the road node it marks, and the radio, radar, clip and time scale. */
 flushPatrolRoute?():void;
 markRoadNodeAsDontWander?(x:number,y:number,z:number):void;
 setRadioChannel?(channel:number):void;
 setRadarZoom?(zoom:number):void;
 setNearClip?(distance:number):void;
 setTimeScale?(scale:number):void;
 /** The onscreen counter the script displays with a label. */
 displayOnscreenCounterWithString?(counter:number,display:number,text:string):void;
 /* The aircraft, vehicle and world commands of this batch, each named by the schema. */
 heliGotoCoords?(handle:number,x:number,y:number,z:number,minAltitude:number,maxAltitude:number):void;
 setHeliBladesFullSpeed?(handle:number):void;
 setVehicleStraightLineDistance?(handle:number,distance:number):void;
 setVehicleAreaVisible?(handle:number,interiorId:number):void;
 damageVehicleDoor?(handle:number,door:number):void;
 vehicleWasDamagedByPed?(handle:number,ped:number):boolean;
 setVehicleTempAction?(handle:number,actionId:number,time:number):void;
 vehicleHealth?(handle:number):number;
 vehicleIsInWater?(handle:number):boolean;
 setVehicleVisible?(handle:number,state:boolean):void;
 setTrainSpeed?(handle:number,speed:number):void;
 /** The peds and objects this batch reaches. */
 setPedCanBeKnockedOffBike?(handle:number,stayOnBike:boolean):void;
 pedIsHoldingObject?(handle:number,object:number):boolean;
 clearAllPedRelationships?(handle:number,relationshipType:number):void;
 objectIsAttached?(handle:number):boolean;
 createFxSystemOnPed?(name:string,handle:number,offset:{x:number;y:number;z:number},ignoreBoundingChecks:boolean):number;
 /** The decision makers a script copies and clears responses on. */
 clearGroupDecisionMakerEventResponse?(decisionMaker:number,event:number):void;
 copyPedDecisionMaker?(source:number):number;
 /** The world switches and the pad sticks. */
 switchEmergencyServices?(state:boolean):void;
 switchRandomTrains?(state:boolean):void;
 setAllVehiclesCanBeDamaged?(state:boolean):void;
 displayHud?(state:boolean):void;
 freezeOnscreenTimer?(state:boolean):void;
 displayNthOnscreenCounterWithString?(counter:number,display:number,slot:number,text:string):void;
 addExplosionVariableShake?(x:number,y:number,z:number,type:number,shake:number):void;
 analogueSticks?(pad:number):{leftX:number;leftY:number;rightX:number;rightY:number};
 /* The vehicles, boats, trains, groups and particles of this batch. */
 anchorBoat?(handle:number,state:boolean):void;
 vehicleIsOnFire?(handle:number):boolean;
 applyForceToVehicle?(handle:number,direction:{x:number;y:number;z:number},offset:{x:number;y:number;z:number}):void;
 damageVehiclePanel?(handle:number,panelId:number):void;
 vehicleHasHydraulics?(handle:number):boolean;
 vehicleIsOnAllWheels?(handle:number):boolean;
 vehicleIsUpsideDown?(handle:number):boolean;
 turnVehicleToFaceCoord?(handle:number,x:number,y:number):void;
 burstVehicleTyre?(handle:number,tyreId:number):void;
 closeAllVehicleDoors?(handle:number):void;
 setVehicleCanBeVisiblyDamaged?(handle:number,state:boolean):void;
 setUpsideDownVehicleNotDamaged?(handle:number,state:boolean):void;
 skipInPlaybackRecordedCar?(handle:number,amount:number):void;
 createMissionTrain?(type:number,x:number,y:number,z:number,direction:boolean):number;
 /** The groups a script makes, sets and drops. */
 createGroup?(defaultTaskAllocator:number):number;
 removeGroup?(group:number):void;
 setGroupFollowStatus?(group:number,state:boolean):void;
 setGroupDecisionMaker?(group:number,decisionMaker:number):void;
 /** The particle systems this batch stops, plays and kills, and the one made on an object. */
 stopFxSystem?(handle:number):void;
 playAndKillFxSystem?(handle:number):void;
 createFxSystemOnObject?(name:string,object:number,offset:{x:number;y:number;z:number},ignoreBoundingChecks:boolean):number;
 playObjectAnim?(handle:number,animationName:string,animationFile:string,frameDelta:number,lockF:boolean,loop:boolean):void;
 /** The world settings and questions of this batch. */
 disableAllEntryExits?(state:boolean):void;
 setDarknessEffect?(enable:boolean,pitchBlack:number):void;
 enableCraneControls?(up:boolean,down:boolean,release:boolean):void;
 setInterpolationParameters?(interpolationToStopMoving:number,time:number):void;
 setMusicDoesFade?(state:boolean):void;
 enableAmbientCrime?(state:boolean):void;
 pointIsObscuredByMissionEntity?(x:number,y:number,z:number,radiusX:number,radiusY:number,radiusZ:number):boolean;
 pedSayContext?(handle:number,phrase:number):number;
 setHeadingForAttachedPlayer?(playerId:number,heading:number,headingRange:number):void;
 /* The searchlights, menus and the rest of this batch. */
 createSearchlight?(position:{x:number;y:number;z:number},pointAt:{x:number;y:number;z:number},radius:number,radiusPoint:number):number;
 deleteSearchlight?(handle:number):void;
 searchlightExists?(handle:number):boolean;
 attachSearchlightToObject?(searchlight:number,tower:number,housing:number,bulb:number,offset:{x:number;y:number;z:number}):void;
 createMenu?(header:string,topLeftX:number,topLeftY:number,width:number,columns:number,interactive:boolean,background:boolean,alignment:number):number;
 deleteMenu?(handle:number):void;
 setMenuColumn?(handle:number,column:number,title:string,rows:readonly string[]):void;
 setMenuItemWithNumber?(handle:number,column:number,row:number,text:string,value:number):void;
 /** The objects and vehicles of this batch. */
 objectHealth?(handle:number):number;
 objectWasDamagedByWeapon?(handle:number,weaponType:number):boolean;
 sortOutObjectCollisionWithVehicle?(object:number,vehicle:number):void;
 detachObject?(handle:number,pitch:number,heading:number,strength:number,applyTurnForce:boolean):void;
 grabEntityOnRopeForObject?(handle:number):{vehicle:number;ped:number;object:number};
 vehiclePassengerSeatIsFree?(handle:number,seat:number):boolean;
 setVehicleMission?(handle:number,carMission:number):void;
 controlVehicleHydraulics?(handle:number,frontLeft:number,rearLeft:number,frontRight:number,rearRight:number):void;
 setVehicleHydraulics?(handle:number,state:boolean):void;
 vehicleTyreIsBurst?(handle:number,tyreId:number):boolean;
 setVehicleCanGoAgainstTraffic?(handle:number,state:boolean):void;
 setVehicleStrong?(handle:number,state:boolean):void;
 markVehicleAsConvoyCar?(handle:number,state:boolean):void;
 vehicleWanderRandomly?(handle:number):void;
 setVehicleTraction?(handle:number,traction:number):void;
 vehicleMaximumPassengers?(handle:number):number;
 clearVehicleLastDamageEntity?(handle:number):void;
 vehicleModelIs?(handle:number,model:number|string):boolean;
 planeGotoCoords?(handle:number,x:number,y:number,z:number,minAltitude:number,maxAltitude:number):void;
 /** The groups and the world settings of this batch. */
 setGroupLeader?(group:number,handle:number):void;
 setGroupDefaultTaskAllocator?(group:number,defaultTaskAllocator:number):void;
 addGroupDecisionMakerEventResponse?(decisionMaker:number,event:number,taskId:number,
  chances:{respect:number;hate:number;like:number;dislike:number},inCar:boolean,onFoot:boolean):void;
 setHeatHazeEffect?(state:boolean):void;
 addSparks?(position:{x:number;y:number;z:number},velocity:{x:number;y:number;z:number},density:number):void;
 switchAudioZone?(zone:string,state:boolean):void;
 setCanTriggerGangWarWhenOnMission?(state:boolean):void;
 displayVehicleNames?(state:boolean):void;
 setTagStatusInArea?(x1:number,y1:number,x2:number,y2:number,percent:number):void;
 percentageTaggedInArea?(x1:number,y1:number,x2:number,y2:number):number;
 clearAreaOfVehicles?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):void;
 setPlayerCycleWeaponButton?(playerId:number,enabled:boolean):void;
 drawLine?(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}):void;
 clearSkip?():void;
 registerOddjobMissionPassed?():void;
 /* The long tail: vehicles, planes, objects, searchlights and the world, each named by the schema. */
 vehicleIsTouchingObject?(handle:number,object:number):boolean;
 trainCarriage?(handle:number,index:number):number;
 vehicleModel?(handle:number):number|string|undefined;
 setVehicleCollision?(handle:number,state:boolean):void;
 setVehicleEngineOn?(handle:number,state:boolean):void;
 popVehicleDoor?(handle:number,door:number,state:boolean):void;
 detachVehicle?(handle:number,x:number,y:number,z:number,applyTurnForce:boolean):void;
 controlVehicleDoor?(handle:number,door:number,state:number,angle:number):void;
 setVehicleWatertight?(handle:number,state:boolean):void;
 vehiclePassengerCount?(handle:number):number;
 attachVehicleToVehicle?(handle:number,other:number,offset:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number}):void;
 vehicleCanBeTargettedByHomingMissile?(handle:number,state:boolean):void;
 dontSuppressVehicleModel?(model:number|string):void;
 setPlaneThrottle?(handle:number,throttle:number):void;
 planeStartsInAir?(handle:number):void;
 setPlaneUndercarriageUp?(handle:number,state:boolean):void;
 /** The objects of the tail. */
 setObjectRecordsCollisions?(handle:number,state:boolean):void;
 objectSpeed?(handle:number):number;
 addToObjectVelocity?(handle:number,x:number,y:number,z:number):void;
 attachObjectToObject?(handle:number,other:number,offset:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number}):void;
 setRopeHeightForObject?(handle:number,height:number):void;
 setUsesCollisionOfClosestObjectOfType?(x:number,y:number,z:number,radius:number,model:number|string,state:boolean):void;
 /** The peds, players and groups of the tail. */
 setPedCoordinatesNoOffset?(handle:number,x:number,y:number,z:number):void;
 pedIsTalking?(handle:number):boolean;
 pedIsSwimming?(handle:number):boolean;
 playerIsUsingJetpack?(playerId:number):boolean;
 setGroupSeparationRange?(group:number,range:number):void;
 clearAreaOfPeds?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):void;
 setCreateRandomGangMembers?(state:boolean):void;
 setGangWarsActive?(state:boolean):void;
 /** The searchlight aimed at a ped, and the line of sight the script tests. */
 pointSearchlightAtPed?(searchlight:number,handle:number,speed:number):void;
 lineOfSightIsClear?(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},
  flags:{buildings:boolean;vehicles:boolean;peds:boolean;objects:boolean;particles:boolean}):boolean;
 /** The audio, markers and remaining world settings of the tail. */
 beatTrackStatus?():number;
 stopBeatTrack?():void;
 controllerMode?():number;
 switchAmbientPlanes?(state:boolean):void;
 syncWater?():void;
 drawSphere?(x:number,y:number,z:number,radius:number):void;
 removeUser3dMarker?(handle:number):void;
 registerFastestTime?(stat:number,time:number):void;
 setUpSkip?(x:number,y:number,z:number,heading:number):void;
 setMenuItemWithTwoNumbers?(handle:number,column:number,row:number,text:string,first:number,second:number):void;
 explodeVehicleInCutscene?(handle:number):void;
 openVehicleDoorABit?(handle:number,door:number,amount:number):void;
 /* The last of the tail. */
 groupExists?(group:number):boolean;
 trailerIsAttachedToCab?(trailer:number,cab:number):boolean;
 setObjectCoordinatesAndVelocity?(handle:number,x:number,y:number,z:number):void;
 forceVehicleLights?(handle:number,lights:number):void;
 setVehicleCanBeDamaged?(handle:number,state:boolean):void;
 skipToEndAndStopPlaybackRecordedCar?(handle:number):void;
 vehicleGotoCoordinatesAccurate?(handle:number,x:number,y:number,z:number):void;
 vehicleWasDamagedByVehicle?(handle:number,other:number):boolean;
 popVehicleBoot?(handle:number):void;
 setVehicleModelComponents?(model:number|string,first:number,second:number):void;
 vehicleForwardX?(handle:number):number;
 vehicleForwardY?(handle:number):number;
 deleteAllTrains?():void;
 makeHeliComeCrashingDown?(handle:number):void;
 createSearchlightOnVehicle?(handle:number,offset:{x:number;y:number;z:number},pointAt:{x:number;y:number;z:number},radius:number,radiusPoint:number):number;
 moveSearchlightBetweenCoords?(handle:number,from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},speed:number):void;
 /** The peds, objects and world of the last batch. */
 setPedUsesUpperbodyDamageAnimsOnly?(handle:number,state:boolean):void;
 setPlayerGroupToFollowNever?(playerId:number,state:boolean):void;
 objectHasCollidedWithAnything?(handle:number):boolean;
 objectIsOnScreen?(handle:number):boolean;
 anyPickupAtCoords?(x:number,y:number,z:number):boolean;
 modelIsBoat?(model:number|string):boolean;
 modelIsHeli?(model:number|string):boolean;
 modelIsPlane?(model:number|string):boolean;
 enableEntryExitPlayerGroupWarping?(x:number,y:number,radius:number,state:boolean):void;
 switchStreaming?(state:boolean):void;
 setArea51SamSite?(state:boolean):void;
 switchPoliceHelis?(state:boolean):void;
 displayOnscreenTimer?(timer:number,direction:number):void;
 clearExtraColours?(fade:boolean):void;
 attachCameraToVehicle?(handle:number,offset:{x:number;y:number;z:number},pointAt:{x:number;y:number;z:number},tilt:number,switchType:number):void;
 attachCameraToVehicleLookAtVehicle?(handle:number,offset:{x:number;y:number;z:number},target:number,tilt:number,switchType:number):void;
 /* The remaining tail, each named by the schema. */
 removeSphere?(handle:number):void;
 startVehicleFire?(handle:number):number;
 maxGroupMembers?():number;
 measurementsAreInMetres?():boolean;
 forceBigMessageAndCounter?(state:boolean):void;
 releaseEntityFromRopeForObject?(handle:number):void;
 resetVehicleHydraulics?(handle:number):void;
 closestVehicleNode?(x:number,y:number,z:number):{x:number;y:number;z:number};
 nthClosestVehicleNode?(x:number,y:number,z:number,nth:number):{x:number;y:number;z:number};
 closestVehicleNodeWithHeading?(x:number,y:number,z:number):{x:number;y:number;z:number;heading:number};
 vehicleIsWaitingForWorldCollision?(handle:number):boolean;
 fixVehicleDoor?(handle:number,door:number):void;
 popVehiclePanel?(handle:number,panel:number,state:boolean):void;
 pedIsInAir?(handle:number):boolean;
 setVehicleAirResistanceMultiplier?(handle:number,multiplier:number):void;
 gangWarIsGoingOn?():boolean;
 setVehicleIsConsideredByPlayer?(handle:number,state:boolean):void;
 vehicleRoll?(handle:number):number;
 setCanResprayVehicle?(handle:number,state:boolean):void;
 vehicleIsVisiblyDamaged?(handle:number):boolean;
 improveVehicleByCheating?(handle:number,state:boolean):void;
 setBoatCruiseSpeed?(handle:number,speed:number):void;
 setMessageFormatting?(state:boolean,first:number,second:number):void;
 heliFollowEntity?(handle:number,ped:number,vehicle:number,radius:number):void;
 setSearchlightClipIfColliding?(handle:number,state:boolean):void;
 areaIsOccupied?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number},
  flags:{solid:boolean;vehicles:boolean;peds:boolean;objects:boolean;particles:boolean}):boolean;
 createFxSystemOnVehicleWithDirection?(name:string,vehicle:number,offset:{x:number;y:number;z:number},direction:{x:number;y:number;z:number},ignoreBoundingChecks:boolean):number;
 controlMovableVehiclePart?(handle:number,value:number):void;
 setAlwaysDraw3dMarkers?(state:boolean):void;
 objectIsStatic?(handle:number):boolean;
 setVehicleStayInSlowLane?(handle:number,state:boolean):void;
 setMenuColumnWidth?(handle:number,column:number,width:number):void;
 gameIsGerman?():boolean;
 createUser3dMarker?(x:number,y:number,z:number,colour:number):number;
 setExtraColours?(colour:number,fade:boolean):void;
 beatProximity?(track:number):{first:number;second:number;third:number};
 modelDimensions?(model:number|string):{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}};
 preloadBeatTrack?(track:number):void;
 deleteMissionTrains?():void;
 setHelpMessageBoxSize?(size:number):void;
 pedHeadIsMissing?(handle:number):boolean;
 switchCopsOnBikes?(state:boolean):void;
 groupSize?(group:number):{members:number;leader:number};
 projectileIsInArea?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):boolean;
 createEmergencyServicesVehicle?(model:number|string,x:number,y:number,z:number):void;
 objectIsInWater?(handle:number):boolean;
 waterHeightAtCoords?(x:number,y:number,ignoreWaves:boolean):number;
 markMissionTrainAsNoLongerNeeded?(handle:number):void;
 setVehicleFollowVehicle?(handle:number,other:number,radius:number):void;
 vehicleHasStuckCarCheck?(handle:number):boolean;
 setTaxiLights?(handle:number,state:boolean):void;
 addBlipForSearchlight?(handle:number):number;
 /** The ped's own matrix, whose rows the offset command transforms through. */
 pedMatrix?(handle:number):{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};position:{x:number;y:number;z:number}};
 /** CPed::OurPedCanSeeThisEntity with the flag that counts a ped behind this one. */
 pedCanSeePed?(handle:number,other:number):boolean;
 /** CCamera::TakeControl over a vehicle, in a camera mode and with a switch type. */
 pointCameraAtVehicle?(handle:number,mode:number,switchType:number):void;
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
 /** AngledRect::HighlightWithMarkers, the four corner markers an angled-area command draws when asked. */
 highlightAngledArea?(area:{a:{x:number;y:number};cornerC:{x:number;y:number};cornerD:{x:number;y:number};width:number;height:number}):void;
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
 /** The instruction record this thread refills as it runs, so stepping one allocates nothing. */
 private readonly decoded=createScmDecodeBuffer();
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
  const {type}=p;
  if(type===2||type===3||type===7||type===8){const {view,offset}=this.variable(p);return kind==='int'?view.getInt32(offset,true):view.getFloat32(offset,true);}
  requireAsset((type===1||type===4||type===5||type===6)&&typeof p.value==='number','Unsupported SCM numeric operand.');
  // Script parameters are an untagged 32-bit union after collection, so an integer read of a float operand
  // gives its bits rather than its value. One scratch word does that reinterpretation for every thread; it is
  // written and read inside this call, so nothing else can be looking at it.
  if(type===6)UNION_BITS.setFloat32(0,p.value as number,true);else UNION_BITS.setInt32(0,p.value as number,true);
  return kind==='int'?UNION_BITS.getInt32(0,true):UNION_BITS.getFloat32(0,true);
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
   decodeScmInstructionInto(this.scriptSpace,this.globals,this.ip,this.scriptSpace.length,this.decoded);
   const i:ScmInstruction=this.decoded,op=i.opcode&0x7fff,p=i.parameters;
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
