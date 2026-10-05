import {CONVERSATION_PED_LINE_MS} from '../engine/ScmConversations';
import {SPECIAL_MODELS_RESOURCE_ID,SPECIAL_PED_MODELS} from '../engine/ScmCutscene';
import {LAW_ENFORCEMENT_MODELS} from './nativeWanted';
import {GROUP_TELEPORT_OFFSETS} from './groupFormation';
import type {CarRecordingFrame} from '../assets/carRecordings';
import {saveOrRetrieveDataForThisFrame,type CarRecordingVehicle} from '../engine/carRecordingPlayback';
import {TRAIN_TYPES} from './nativeTrainTracks';
import {ScmRuntime} from '../engine/ScmRuntime';
import {ScmCameraFade} from '../engine/ScmCameraFade';
import {speechLengthMs,MISSION_AUDIO_COUNT,scriptBankOfSample,SCRIPT_BANK_NULL} from '../engine/ScmMissionAudio';
import type {BeatTrackStream,TrackAudio} from '../engine/ScmCutsceneTrack';
import {requireAsset} from '../assets/binary';
import {gxtText} from '../assets/gxt';
import {deadPedPickupCoors} from '../ped/nativeDeadPedPickup';
import {resetGangWeapons,setGangWeapons} from './nativeGangWeapons';
import {VEHICLE_CLASSES} from '../assets/pedGroups';
import {ScmEntityPending,UnsupportedScmCommand,type ScmScriptedTask,type ScmThread,type ScmWorldCommands} from '../engine/ScmThread';
import {BRAIN_OBJECT,BRAIN_RANDOM_PED} from '../engine/ScmScriptBrains';
import {GARAGE_DOOR_REACH,garageCentre,garageDoorHeight,garageDoorPose,type ScmGarage} from '../engine/ScmGarages';
import {globalSoundLevel,type SoundQuietEvent} from '../ped/nativeSoundEvents';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import {findZone,worldZoneAt,type WorldZones} from '../assets/worldZones';
import {ScmVehiclePool} from './ScmVehiclePool';
import {ScmPedPool,type ScmPedProofs} from './ScmPedPool';
import {NativePedGroup} from '../ped/nativePedGroup';
import {findClosestStraightRoad,findNodeCoorsForScript,findNodeCoorsForScriptBetween,findNodeOrientationForCarPlacement,findNthNodeClosestToCoors} from './nativeScriptCarNodes';
import type {PathArea,PathNode} from '../assets/pathNodes';
import {MAX_DECISION_CHOICES,type DecisionChoice} from '../ped/nativeDecisionMaker';
import {PED_SIGHT_TARGET_RAISE,pedSightAngleAndRange} from '../ped/nativePedSight';
import {isMissionObjectType,type ScmObject} from '../engine/ScmObjects';
import {BLIP_CAR,BLIP_CHAR,BLIP_CONTACT_POINT,BLIP_DISPLAY_BLIPONLY,BLIP_DISPLAY_BOTH,BLIP_DISPLAY_MARKERONLY,BLIP_FLAG_THREAT,BLIP_FLAG_UNK,BLIP_NONE,BLIP_OBJECT,BLIP_PICKUP} from '../engine/ScmRadar';
import {MODE_ATTACHCAM,MODE_FIXED} from '../engine/ScmCamera';
import {HUD_COLOURS,HUD_COLOUR_BLUE,HUD_COLOUR_RED,radarTraceColour,radarTraceRgb} from '../ui/nativeHudColours';
/* The axes of something that only turns about the up axis, which is every ped and every object a script
 * places: CVector2D::Heading is atan2(-x, y), so a heading of nothing faces north and its right hand is east. */
/** The twelve numbers an FxMatrix holds: the three axis rows, then the position. */
const fxMatrix=(frame:{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number}},position:{x:number;y:number;z:number})=>
 [frame.right.x,frame.right.y,frame.right.z,frame.forward.x,frame.forward.y,frame.forward.z,
  frame.up.x,frame.up.y,frame.up.z,position.x,position.y,position.z];
/** The axes of something pointed along a direction, which is what the with-direction forms give. */
const directionFrame=(direction:{x:number;y:number;z:number})=>{
 const length=Math.hypot(direction.x,direction.y,direction.z);
 // CVector2D::Normalise leaves a zero-length vector pointing east, and the frame is built round that.
 const forward=length>0?{x:direction.x/length,y:direction.y/length,z:direction.z/length}:{x:1,y:0,z:0};
 const flat=Math.hypot(forward.x,forward.y);
 const right=flat>0?{x:forward.y/flat,y:-forward.x/flat,z:0}:{x:1,y:0,z:0};
 return {right,forward,up:{
  x:right.y*forward.z-right.z*forward.y,y:right.z*forward.x-right.x*forward.z,z:right.x*forward.y-right.y*forward.x}};
};
const headingFrame=(heading:number)=>({
 right:{x:Math.cos(heading),y:Math.sin(heading),z:0},
 forward:{x:-Math.sin(heading),y:Math.cos(heading),z:0},
 up:{x:0,y:0,z:1},
});
import {ScmDecisionMakers} from '../engine/ScmDecisionMakers';
import {scriptedPedOrder,type ScriptedPedOrder} from './nativeScriptedPedTasks';
import {PlayerScriptTasks} from './playerScriptTasks';
/** MI_NEVADA, whose radar cone floats higher above its box. */
const MODEL_NEVADA=553;

/** What the browser can answer for the script while it runs its opening. */
/** eScriptedTaskStatus and the scripts' FINISHED_TASK. */
const TASK_EVENT_ASSOCIATED=0,TASK_TASK_ASSOCIATED=1,FINISHED_TASK=7;
/** What the component commands reach on a CAutomobile. */
type V3={x:number;y:number;z:number};
/** ConvertPedNode2BoneTag: ePedNode (the index a hold task names) to the skeleton's bone tag. */
const PED_NODE_BONE_TAG:Readonly<Record<number,number>>={1:3,2:5,3:32,4:22,5:34,6:24,7:41,8:51,9:43,10:53,11:52,12:42,13:33,14:23,15:31,16:21,17:4,18:8};
/** CTaskSimpleHoldEntity's bone flag. */
const HOLD_ENTITY_UPDATE_TRANSLATION_ONLY=0x10;
/** The stealable objects' reach (AUTHORED, see playerStealKey): within 1.5 units across and 1.5 up or down, the carry
 * held at the upper torso (PED_NODE_UPPER_TORSO) half a unit before it, and set down 0.6 ahead. */
const STEAL_REACH=1.5,STEAL_HEIGHT=1.5,STEAL_HOLD_NODE=1,STEAL_HOLD_OFFSET={x:0,y:.45,z:0},STEAL_PUT_DOWN_AHEAD=.6;
/** CTaskSimpleHoldEntity's carry groups (ChoosePutDownHeight, TaskSimpleHoldEntity.cpp:476): CARRY105 for a surface
 * within 0.2 under the ped's origin, CARRY05 within 0.7, CARRY lower down; each with its LIFTUP and PUTDWN clips in
 * carry.ifp and m_fPutDownHeightZ, the put-down clip's time at which the object leaves the hands. CRRY_PRTIAL, the
 * arms round the load, is CTaskSimpleHoldEntity's partial clip in all three. */
const CARRY_GROUPS=[{below:.2,suffix:'105',putDownAt:.433333},{below:.7,suffix:'05',putDownAt:.366667},{below:Infinity,suffix:'',putDownAt:.6}] as const;
const carryGroupFor=(origin:number,surface:number|undefined)=>surface===undefined?CARRY_GROUPS[2]:CARRY_GROUPS.find(g=>origin-g.below<=surface)!;
export interface ScmCarComponents {
 popDoor(door:number,visible:boolean):void;popPanel(panel:number,visible:boolean):void;popBoot():void;
 fixDoor(door:number):void;fixPanel(panel:number):void;fixTyre(wheel:number):void;
 damageDoor(door:number):void;damagePanel(panel:number):void;controlDoor(door:number,status:number,ratio:number):void;
 tyreBurst(wheel:number):boolean;doorFullyOpen(door:number):boolean;
 readonly damageState:{readonly doors:readonly number[]};petrolTankIsWeakPoint:boolean;
}
export interface ScmMissionWorld {
 /** CPhysical::physicalFlags.bSubmergedInWater of a vehicle: cBuoyancy found it in the water. */
 scriptVehicleInWater?(car:unknown):boolean;
 /** CWaterLevel::GetWaterLevel (with the swell) or GetWaterLevelNoWaves at a native point; nothing off the water. */
 waterLevelAt?(x:number,y:number,waves:boolean):number|undefined;
 /** CCamera::IsSphereVisible for a native point. */
 isSphereVisible?(point:{x:number;y:number;z:number},radius:number):boolean;
 /** One of CDecisionMakerTypes' default decision makers, as the files load it (by its index). */
 defaultDecisionMaker?(index:number):import('../ped/nativeDecisionMaker').DecisionMaker|undefined;
 /** CAudioEngine::RetuneRadio for SET_RADIO_CHANNEL (an eRadioID). */
 retuneRadio?(station:number):void;
 /** CAERadioTrackManager::GetCurrentRadioStationID (reversed): the station asked for, RADIO_OFF (13) with none. */
 radioStationId?():number;
 /** CAEFrontendAudioEntity::AddAudioEvent, for the reports the script's own systems make (the timer count). */
 frontendAudioEvent?(event:number):void;
 /** TheCamera's fade (m_fFadeAlpha, m_bFading), one for the script and the game alike; the host processes it. Without
  * one the mission keeps and processes its own. */
 cameraFade?:ScmCameraFade;
 /** CTimeCycle::StartExtraColour and StopExtraColour, which SET_EXTRA_COLOURS and CLEAR_EXTRA_COLOURS call. */
 startExtraColour?(colour:number,fade:boolean):void;stopExtraColour?(fade:boolean):void;
 /** Draw a fade DO_FADE starts: direction 0 fades out to the fading colour, 1 back in. */
 showFade?(direction:number,milliseconds:number):void;
 /** Where CREATE_PLAYER would put the player. The browser has already placed them by the time the script
  * runs, from its own start, a restart point or a save, so the host records this rather than moving them. */
 playerCreatedAt(x:number,y:number,z:number):void;
 setPlayerHeading(degrees:number):void;
 /** CRunningScript::SetCharCoordinates for the player (script coordinates, already put to the ground if too low):
  * his vehicle (car, bike, boat or aircraft) is teleported with him in it, or he is. `groundPending`: the ground was asked for where no collision
  * is loaded yet (z is FindGroundZForCoord's 20), so it is found again once the streamed window under him is in. */
 teleportPlayer?(position:{x:number;y:number;z:number;groundPending?:boolean}):boolean;
 /** WARP_CHAR_INTO_CAR on the player (CTaskSimpleCarSetPedInAsDriver without the entry tasks), and
  * WARP_CHAR_FROM_CAR_TO_COORD (out of the vehicle and teleported). */
 /** The player's side of the ped commands a script also gives him: CPed::SetAmmo and GrantAmmo, the weapon hidden
  * for a cut, physicalFlags.bDontApplySpeed (FREEZE_CHAR_POSITION), the swimming and falling questions, the clip
  * playing, and m_nAreaCode. */
 setPlayerAmmo?(weaponType:number,ammo:number):void;
 /** ENSURE_PLAYER_HAS_DRIVE_BY_WEAPON: the SMG slot topped up to `ammo`, or a Micro-SMG given and taken up, in a vehicle only. */
 ensurePlayerHasDriveByWeapon?(ammo:number):void;
 /** SET_WEATHER_TO_APPROPRIATE_TYPE_NOW: CWeather::SetWeatherToAppropriateTypeNow on the world's weather. */
 setWeatherToAppropriateTypeNow?():void;
 addPlayerAmmo?(weaponType:number,ammo:number):void;
 hidePlayerWeapon?(hidden:boolean):void;
 markRoadNodeAsDontWander?(point:{x:number;y:number;z:number}):void;
 switchPathNodes?(area:{xMin:number;xMax:number;yMin:number;yMax:number;zMin:number;zMax:number},isOff:boolean,isCars:boolean,backToOriginal:boolean):void;
 unmarkAllRoadNodesAsDontWander?():void;
 /** The nearest of the map's own objects of a model within the radius (native), and whether it is smashed or shows its damage. */
 closestWorldObjectOfType?(point:{x:number;y:number;z:number},radius:number,model:number|string):{distance:number;smashed:boolean;damaged:boolean;key?:string}|undefined;
 /** bIsVisible or bUsesCollision on the map object with this placement key, kept while it streams in and out. */
 setWorldObjectFlag?(key:string,flag:'visible'|'collision',state:boolean):void;
 /** IS_CAR_IN_AIR_PROPER for a script vehicle: no wheel on the ground and nothing touched. */
 scriptVehicleInAirProper?(car:unknown):boolean;
 /** CTaskSimpleCarSetPedInAsPassenger for the player, SA's seat numbering (-1 the first free); false when he cannot. */
 warpPlayerIntoCarAsPassenger?(car:unknown,seat:number):boolean;
 /** CPedType's acquaintance tables by ePedType index. */
 setPedTypeRelationship?(relationship:number,pedType:number,otherPedType:number,on:boolean):void;
 pedTypeRelationshipSet?(relationship:number,pedType:number,otherPedType:number):boolean;
 /** CStats::FindMaxNumberOfGroupMembers. */
 maxGroupMembers?():number;
 /** CPed::GetWeaponInSlot for the player (no ped) or a script ped. */
 pedWeaponInSlot?(ped:unknown,slot:number):{type:number;ammo:number;model:number};
 /** The player's m_pEnex: set to the entry exit nearest a point, and read back (its name, its entrance's centre and
  * its entrance angle in degrees). */
 setPlayerUsedEntryExit?(x:number,y:number,radius:number):void;
 playerEntryExit?():{name:string;position:readonly [number,number,number];heading:number}|undefined;
 /** CTrain for the mission trains: made from a type at the track nearest a native point, read and driven. */
 spawnMissionTrain?(type:number,position:{x:number;y:number;z:number},clockwise:boolean):Promise<unknown>;
 trainCarriageOf?(train:unknown,index:number):unknown;
 trainCabooseOf?(train:unknown):unknown;
 scriptTrainModel?(carriage:unknown):number;
 setScriptTrainSpeed?(train:unknown,speed:number):void;
 setScriptTrainCruiseSpeed?(train:unknown,speed:number):void;
 setScriptTrainForcedToSlowDown?(train:unknown,state:boolean):void;
 scriptTrainClockwise?(train:unknown):boolean;
 setScriptTrainPosition?(train:unknown,position:{x:number;y:number;z:number}):void;
 removeScriptMissionTrain?(train:unknown):void;
 releaseScriptMissionTrain?(train:unknown):void;
 removeMissionTrains?():void;releaseMissionTrains?():void;removeAllTrains?():void;
 scriptVehicleIsTrain?(car:unknown):boolean;
 /** FORCE_CAR_LIGHTS (m_nOverrideLights) and SET_CAR_COLLISION (CEntity::m_bUsesCollision) on a car. */
 setScriptVehicleOverrideLights?(car:unknown,lights:number):void;
 setScriptVehicleUsesCollision?(car:unknown,state:boolean):void;
 /** CVehicleRecording's host: stream a file of carrec.img (calling `loaded` once its frames are here), read its
  * frames, and see a car as a playback moves it. */
 requestCarRecording?(fileNumber:number,loaded:(fileNumber:number)=>void):void;
 carRecordingFrames?(fileNumber:number):readonly CarRecordingFrame[]|undefined;
 carRecordingVehicle?(car:unknown):CarRecordingVehicle|undefined;
 /** The player's side of commands that name any ped:
  * - CLEAR_LOOK_AT ends the look the player was given;
  * - SET_CHAR_VISIBLE sets CEntity::m_bIsVisible (and gPlayerPedVisible);
  * - the relationship commands edit the player's own CAcquaintance;
  * - DAMAGE_CHAR takes health, armour first unless told not to. */
 clearPlayerLookAt?():void;
 setPlayerVisible?(visible:boolean):void;
 setPlayerRelationship?(relationship:number,pedType:number):void;
 clearPlayerRelationship?(relationship:number,pedType:number):void;
 clearPlayerRelationships?(relationship:number):void;
 damagePlayer?(amount:number,damageArmour:boolean):void;
 setPlayerFrozen?(frozen:boolean):void;
 playerInWater?():boolean;
 playerInAir?():boolean;
 playerIsPlayingAnim?(animation:string):boolean;
 setPlayerArea?(area:number):void;
 setPlayerProofs?(proofs:ScmPedProofs):void;
 /** TASK_USE_MOBILE_PHONE on the player ('player') or a script ped: the phone out or put away. */
 usePedMobilePhone?(ped:unknown,start:boolean):void;
 /** EXPLODE_CHAR_HEAD's CEventDamage: a sniper rifle's 1000 to the head, from nobody. */
 explodeScriptPedHead?(ped:unknown):void;
 /** CWorld::ClearCarsFromArea and ClearPedsFromArea over a box in the script's coordinates. */
 clearVehiclesInBox?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):void;
 /** USE_DETONATOR: CWorld::UseDetonator for the player. */
 useDetonator?():void;
 /** CREATE_RANDOM_CAR_FOR_CAR_PARK, in the script's coordinates. */
 createRandomCarForCarPark?(x:number,y:number,z:number,heading:number):void;
 clearPedsInBox?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):void;
 /** CTheScripts::CleanUpThisVehicle: the car is a random one again. */
 releaseScriptVehicle?(car:unknown):void;
 warpPlayerIntoCar?(car:unknown):boolean;
 warpPlayerFromCarToCoord?(position:{x:number;y:number;z:number}):boolean;
 /** (Each answers false for what it does not carry out: a player on a bike, boat or plane, or already in a car.) */
 /** CCamera::SetCameraDirectlyBehindForFollowPed_CamOnAString. */
 setCameraBehindPlayer():void;
 /** CStreaming::LoadScene and the collision request that goes before it. */
 loadScene(x:number,y:number,z:number):void;
 /** CGameLogic::SetLaRiotsActive. */
 setLaRiots(active:boolean):void;
 /** CWorld::ProcessVerticalLine from the native point down to z = -1000: the first ground under it, or nothing
  * where the world has none there. */
 groundLevel(x:number,y:number,z:number):number|undefined;
 /** The player's own ped, which is the only ped the browser holds while the opening runs: its position in
  * native axes, the vehicle it is in if any, whether it has stopped, and its health. */
 playerPed():{
  position:{x:number;y:number;z:number};
  /** The vehicle it is in, as eVehicleAppearance and whether that vehicle is a train. */
  vehicle:{appearance:number;train:boolean;model?:number;inAirProper?:()=>boolean}|undefined;
  stopped:boolean;health:number;dead:boolean;
  /** CPlaceable::GetHeading in degrees, as the script reads a ped's. */
  heading?:number;
  /** CEntity::GetAreaCode: the interior it is in, zero being the normal world. */
  areaCode:number;
  /** CPed::m_aWeapons as the types it carries, and the one it is holding. */
  /** GET_CHAR_SPEED: m_vecMoveSpeed's magnitude, units a second. */
  moveSpeed?:number;
  weapons:{carried:readonly number[];active:{type:number;melee:boolean};
   /** CWeapon::m_nTotalAmmo of each weapon he carries. */
   ammo?:Readonly<Record<number,number>>};
  /** CPed::bFiringWeapon, CEntity::GetIsOnScreen, and whether it is sitting in the car it rides. */
  shooting:boolean;onScreen:boolean;sittingInCar:boolean;
 };
 /** What CPlayerPed::CanPlayerStartMission asks of the game and the player. */
 playerMissionGates():{
  statePlaying:boolean;coopGoingOn:boolean;inControl:boolean;driving:boolean;alive:boolean;
  physicalResponseTask:boolean;eventResponseTask:boolean;nonDrivePrimaryTask:boolean;attackTask:boolean;
  scriptCommandEvent:boolean;
 };
 /** CClothes::RebuildPlayer: the browser builds its own player model, so what it does with this is its own.
  * The script calls it after dressing the player. */
 buildPlayerModel():void;
 /** CPlayerInfo::MakePlayerSafe with the state inverted, which is how the script takes control away. The
  * browser is a free-roam session the script only opens, so what a host does with this is its own. */
 setPlayerControl(control:boolean):void;
 /** TheText.LoadMissionText: the block of text a mission draws its messages from. */
 loadMissionText(name:string):void;
 /** The eLevelName of the map zone the player stands in. */
 playerCity():number;
 /** Mission dialogue: the SCRIPT pack's lines, loaded by sample (resolving once one can play, false when it cannot
  * be had), played and stopped by the script's one-based slot, and how long a loaded one runs. */
 /** The stream the beat tracks (and the mission-passed tune) play on (CAECutsceneTrackManager's channel). */
 beatTracks?:BeatTrackStream;
 /** CAudioEngine round those tracks: the radio and the ambience give way to them, and the radio comes back. */
 trackAudio?:TrackAudio;
 scriptSpeech?:{load(sample:number,scriptSlot?:number):Promise<boolean>;play(scriptSlot:number,sample:number):void;stop(scriptSlot:number):void;lengthMs(sample:number):number|undefined};
 /** A whole SCRIPT bank into mission audio slot `index` (zero-based), and the slot letting it go. */
 loadMissionBank?(index:number,bank:number):Promise<boolean>;clearMissionBank?(index:number):void;
 /** CModelInfo::GetModelInfo by name: the model index, or -1. */
 modelIndex?(name:string):number;
 /** CPed::GiveWeapon, SetCurrentWeapon and m_fArmour on the player. */
 givePlayerWeapon?(weaponType:number,ammo:number):void;
 setPlayerCurrentWeapon?(weaponType:number):void;
 setPlayerArmour?(armour:number):void;
 /** CPed::m_fArmour on the player. */
 playerArmour?():number;
 /** The streamed-in placements of the named models (lower case) within `radius` of a native point, for the script
  * brains allocated to object models. */
 worldObjectsNear?(models:ReadonlySet<string>,x:number,y:number,radius:number):{key:string;model:string;position:[number,number,number];heading:number}[];
 /** The street peds a script may take (GET_RANDOM_CHAR_IN_ZONE): each with its ePedType, peds.ide model id, native
  * centre position, heading (degrees), health and whether a roof is over it; and the call that makes one PED_MISSION. */
 randomStreetPeds?():{ped:unknown;pedType:number;model:number;position:{x:number;y:number;z:number};heading:number;health:number;roofed:()=>boolean}[];
 adoptStreetPed?(ped:unknown):void;
 /** CTheZones::GetLevelFromPosition for a native point. */
 cityAt?(x:number,y:number,z:number):number;
 /** Whether the archive holds the model a ped or vehicle id names (CStreaming's directory). */
 modelInArchive?(id:number):boolean;
 /** The peds.ide id of a ped model name. */
 pedModelId?(name:string):number|undefined;
 /** The taxi light of a script car, or of the player's own (undefined). */
 setTaxiLight?(vehicle:unknown,on:boolean):void;
 /** Take a listed placement out of the map (the script now draws and collides its own copy), or put it back. */
 takeWorldObject?(key:string,taken:boolean):boolean;
 /** The models whose IDE flags mark a garage door (0x800, CBaseModelInfo::IsGarageDoor), lower case. */
 garageDoorModels?():ReadonlySet<string>|undefined;
 /** CGarage's m_GarageAudio: a garage door's opening, opened, closing or closed, at the door (native). */
 garageDoorSound?(garage:string,event:number,position:{x:number;y:number;z:number}):void;
 /** m_bIsStaticWaitingForCollision on a script ped: set, and read. */
 scriptPedWaitForCollision?(ped:unknown):void;
 scriptPedWaitingForCollision?(ped:unknown):boolean;
 /** The follow camera turned to face along a heading (degrees, native), from in front. */
 setCameraInFrontOfHeading?(degrees:number):void;
 /** CCarCtrl::ScriptGenerateOneEmergencyServicesCar: a crewed emergency vehicle sent to the point. */
 scriptEmergencyServicesCar?(model:number,point:{x:number;y:number;z:number}):void;
 /** Fx_c::AddBlood (native axes). */
 addBlood?(position:{x:number;y:number;z:number},direction:{x:number;y:number;z:number},amount:number):void;
 /** A model's EFFECT_TRIGGER_POINT of that index, in the model's space. */
 modelTriggerPoint?(model:string,index:number):[number,number,number]|undefined;
 /** CWeaponInfo::GetWeaponInfo(type): m_nSlot and m_nModelId1, or nothing before weapon.dat is in. */
 weaponTypeInfo?(weaponType:number):{slot:number;model:number}|undefined;
 /** The cutscene data the script asks for. The browser plays none yet, so a host records the request and the
  * mission moves the state on itself, which keeps the script's own loop running rather than stalling it. */
 loadCutscene(name:string):void;
 /** CStreaming's script requests. The browser streams its own world by where the player is rather than by
  * name, so it records what the script asked for. */
 requestModel(model:number|string):void;
 /** The tags the browser's own tag manager holds: how many are sprayed, and what share of an area is. */
 tagsTagged():number;
 tagsPercentageInArea(x1:number,y1:number,x2:number,y2:number):number;
 /** SET_TAG_STATUS_IN_AREA and GET_NEAREST_TAG_POSITION through CTagManager. */
 setTagsInArea?(x1:number,y1:number,x2:number,y2:number,tagged:boolean):void;
 nearestTagPosition?(x:number,y:number,z:number):{x:number;y:number;z:number}|undefined;
 /** The share of the map the player's gang holds, which the browser's gang wars keep. */
 territoryUnderControlPercentage():number;
 /* The peds a script creates. As with the cars, the browser cannot build one inside the command, so the host
  * is asked and the pool holds the handle until the model is loaded. */
 spawnScriptPed(pedType:number,model:number|string,position:{x:number;y:number;z:number}):Promise<unknown>;
 /** CPopulation::AddPedInCar: the ped starts in a seat of a car the script already made, and rides there. */
 spawnScriptPedInCar(pedType:number,model:number|string,car:unknown,seat:number|'driver'):Promise<unknown>;
 /** The same with the occupation CPopulation::ChooseCivilianOccupationForVehicle would have picked for that car. */
 spawnScriptRandomPedInCar(car:unknown,seat:number|'driver'):Promise<unknown>;
 /** CPed::AttachPedToEntity: the ped rides on the car at an offset in the car's own axes. */
 /** `turret` is AttachPedToEntity's turret position for a ped the game attaches itself (the hot-dog vendor). */
 spawnScriptPedOnCar(pedType:number,model:number|string,car:unknown,offset:{x:number;y:number;z:number},turret?:number):Promise<unknown>;
 placeScriptPed(ped:unknown,position:{x:number;y:number;z:number}):void;
 setScriptPedHeading(ped:unknown,degrees:number):void;
 scriptPedPosition(ped:unknown):{x:number;y:number;z:number};
 scriptPedHeading(ped:unknown):number;
 scriptPedHealth(ped:unknown):number;
 setScriptPedHealth(ped:unknown,health:number):void;
 killScriptPed(ped:unknown):void;
 setScriptPedAccuracy(ped:unknown,accuracy:number):void;
 /** CPed::m_nWeaponShootingRate, which CTaskSimpleGunControl's bursts and pauses read. */
 setScriptPedShootingRate?(ped:unknown,rate:number):void;
 setScriptPedInvulnerable(ped:unknown,enabled:boolean):void;
 setScriptPedProofs(ped:unknown,proofs:ScmPedProofs):void;
 scriptPedAlive(ped:unknown):boolean;
 removeScriptPed(ped:unknown):void;
 releaseScriptPed(ped:unknown,keepTask?:boolean):void;
 scriptPedSpeed(ped:unknown):number;
 /** GET_CHAR_VELOCITY: a script ped's m_vecMoveSpeed in native axes, units a second (its car's when it rides). */
 scriptPedVelocity?(ped:unknown):{x:number;y:number;z:number};
 scriptPedStanding(ped:unknown):boolean;
 scriptPedSubmerged(ped:unknown):boolean;
 scriptPedOnScreen(ped:unknown):boolean;
 /** Whether the player holds aim with this script ped under the crosshair (m_p3rdPersonMouseTarget). */
 playerMouseTargets(ped:unknown):boolean;
 setScriptPedVisible(ped:unknown,visible:boolean):void;
 /** A task the script gave the ped, already turned into something the browser can carry out. */
 giveScriptPedOrder(ped:unknown,order:ScriptedPedOrder):void;
 /** A sequence of tasks, run in order, and started again from the first when it repeats. */
 giveScriptPedSequence(ped:unknown,orders:readonly ScriptedPedOrder[],repeat:boolean,start?:number):void;
 /** Whether a script's ped is still carrying out the order or sequence it was given (CTaskManager still holds it). */
 scriptPedHasOrder?(ped:unknown):boolean;
 /** TASK_COMPLEX_ENTER_CAR_AS_DRIVER/_AS_PASSENGER or GO_TO_CAR_DOOR_AND_STAND_STILL active: a script ped's, or the player's
  * (undefined ped). */
 pedEnteringCar?(ped:unknown|undefined):boolean;
 /** vehicles.ide's class of a vehicle model (CVehicleModelInfo::m_nVehicleClass), or undefined for none. */
 vehicleModelClass?(model:number):string|undefined;
 /** The index of the task a ped's script sequence is on, -1 without one (a single task is none). */
 scriptPedSequenceProgress?(ped:unknown):number;
 /** The same for the player's own sequence. */
 playerSequenceProgress?():number;
 clearScriptPedTasks(ped:unknown):void;
 /** The script's tasks on the player's own ped (PlayerScriptTasks), and whether one still runs. */
 givePlayerOrders?(orders:readonly ScriptedPedOrder[],repeat:boolean,sequence?:boolean,start?:number):void;
 clearPlayerTasks?():void;
 playerHasScriptTask?():boolean;
 /** CWorld::ClearExcitingStuffFromArea round a point in the script's own coordinates. */
 clearArea(point:{x:number;y:number;z:number},radius:number):void;
 /** CPlayerInfo::m_nPlayerState: PLAYERSTATE_PLAYING, HAS_DIED or HAS_BEEN_ARRESTED. */
 playerState?():'playing'|'dead'|'arrested';
 /** CFireManager::ExtinguishPoint over the host's own fires, in the script's coordinates. */
 extinguishFiresAtPoint?(point:{x:number;y:number;z:number},radius:number):void;
 /** Whether nothing solid stands between two points in the script's own coordinates. */
 lineOfSightClear(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},
  flags?:{buildings:boolean;vehicles:boolean;peds:boolean;objects:boolean}):boolean;
 /** CStreaming's random vehicle model in memory, with the class it belongs to. */
 randomVehicleInMemory():{model:number;vehicleClass:number}|undefined;
 /** CPickups::TestForPickupsInBubble round a native point. */
 pickupsInBubble?(p:{x:number;y:number;z:number},radius:number):boolean;
 /** CWorld::TestSphereAgainstWorld against vehicles only, native point. */
 vehicleInSphere?(p:{x:number;y:number;z:number},radius:number):boolean;
 /** Whether anything of the named kinds has its bounds in the native box (min and max corners). */
 areaOccupied?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number},kinds:{buildings:boolean;vehicles:boolean;peds:boolean;objects:boolean;dummies:boolean}):boolean;
 /** Whether any vehicle of these models has its position (script coordinates) in the box, ends included. */
 vehicleOfModelsInBox?(models:ReadonlySet<number>,min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):boolean;
 /** CEntryExitManager's nearest door to a point within a range, by its own pool index. */
 nearestEntryExit(x:number,y:number,radius:number):number|undefined;
 /** Whether the ped is still answering an event of that type. */
 scriptPedRespondingTo(ped:unknown,event:number):boolean;
 giveScriptPedWeapon(ped:unknown,weaponType:number,ammo:number):void;
 /** CPed::ClearWeapon and CPed::ClearWeapons: a script ped's, or (with no ped) the player's. */
 clearPedWeapon?(ped:unknown|undefined,weaponType:number):void;clearPedWeapons?(ped:unknown|undefined):void;
 scriptPedWeapon(ped:unknown):{type:number;ammo:number}|undefined;
 setScriptPedAmmo(ped:unknown,ammo:number):void;
 setScriptPedFrozen(ped:unknown,frozen:boolean):void;
 scriptPedInAir(ped:unknown):boolean;
 scriptPedArea(ped:unknown):number;
 scriptPedActiveWeapon(ped:unknown):{type:number;melee:boolean};
 scriptPedShooting(ped:unknown):boolean;
 warpScriptPedToCoord(ped:unknown,position:{x:number;y:number;z:number}):void;
 scriptPedIsPlayingAnim(ped:unknown,animation:string):boolean;
 setScriptPedArea(ped:unknown,area:number):void;
 setScriptPedSkill(ped:unknown,skill:number):void;
 setScriptPedUsedEntryExit(ped:unknown):void;
 setScriptVehicleAutopilot(car:unknown,field:'cruiseSpeed'|'drivingStyle'|'loadsCollision'|'cantGoAgainstTraffic'|'stayInSlowLane',value:number):void;
 setScriptPedRelationship(ped:unknown,relationship:number,pedType:number):void;
 clearScriptPedRelationship(ped:unknown,relationship:number,pedType:number):void;
 clearScriptPedRelationships(ped:unknown,relationship:number):void;
 setScriptPedFlag(ped:unknown,flag:'notAllowedToDuck'|'stayInCarOnJack'|'doesntDropWeaponsWhenDead'|'getOutUpsideDownCar'|'bleeding'|'drownsInWater'|'neverLeavesGroup'|'canBeShotInVehicle'|'cantBeDraggedOut'|'loadsCollision'|'kindaStayInSamePlace'|'deathPickupsPersist'|'targetPriority'|'stayOnBike'|'upperBodyDamageAnimsOnly',value:boolean):void;
 /** UPDATE_PICKUP_MONEY_PER_DAY reaching the drawn pickup. */
 setScriptPickupMoneyPerDay?(handle:number,moneyPerDay:number):void;
 setScriptPedCriticalHits(ped:unknown,suffers:boolean):void;
 scriptPedAnimProgress(ped:unknown,animation:string):number|undefined;
 /** SET_CHAR_ANIM_SPEED and SET_CHAR_ANIM_CURRENT_TIME on the clip the ped plays by that name; `undefined` is the player. */
 setScriptPedAnim?(ped:unknown,animation:string,change:{speed?:number;progress?:number}):void;
 /** GET_CHAR_ANIM_CURRENT_TIME on the player. */
 playerAnimProgress?(animation:string):number|undefined;
 setScriptPedSpeech(ped:unknown,shutUp:boolean):void;
 setScriptPedFacialTalk(ped:unknown,seconds:number|undefined):void;
 hideScriptPedWeapon(ped:unknown,hidden:boolean):void;
 /** CExplosion::AddExplosion at a point in the script's own coordinates; `sound` false for ADD_EXPLOSION_NO_SOUND. */
 addExplosion(position:{x:number;y:number;z:number},type:number,options?:{sound?:boolean}):void;
 /** The CAutomobile a car handle stands for, for the component commands; nothing for a bike, boat or aircraft. */
 scriptCarComponents?(car:unknown):ScmCarComponents|undefined;
 /** The named clip's total time in ms while the player or a script ped plays it (GET_CHAR_ANIM_TOTAL_TIME). */
 playerAnimTotalTime?(animation:string):number|undefined;
 scriptPedAnimTotalTime?(ped:unknown,animation:string):number|undefined;
 /** CPed::bIsDucking of the player and of a script ped. */
 playerDucking?():boolean;
 scriptPedDucking?(ped:unknown):boolean;
 /** The player climbs (CTaskSimpleClimb), and holds the horn while driving. */
 playerClimbing?():boolean;
 playerPressingHorn?():boolean;
 /** The world's weekday (Simulation.weekDay), which the script clock follows. */
 setWorldWeekDay?(day:number):void;
 /** CPopCycle::m_nCurrentZoneType. */
 populationZoneType?():number;
 /** Whether a script object's collision moved from `from` to `to` (native) would overlap a body that is not fixed. */
 scriptObjectBlockedAt?(handle:number,from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}):boolean;
 /** Streams an animation block (an .ifp of the archive) in ahead of its first clip. */
 preloadAnimationBlock?(block:string):void;
 /** CTaskSimpleHoldEntity's partial clip on the player (a CARRY clip name), or none. */
 setPlayerCarryPose?(clip:string|undefined):void;
 /** Any ped of the pool (the player too) other than the one named within the radius of a native point. */
 anyPedNear?(at:{x:number;y:number;z:number},radius:number,except:unknown,exceptPlayer:boolean):boolean;
 /** GET_CAR_COLOURS and GET_EXTRA_CAR_COLOURS: the four paint slots' palette entries (CVehicle::m_nPrimaryColor to
  * m_nQuaternaryColor). */
 scriptVehicleColours?(car:unknown):{primary:number;secondary:number;tertiary:number;quaternary:number};
 /** SET_CAR_AS_MISSION_CAR: the vehicle becomes the script's (MISSION_VEHICLE), which the population keeps. */
 claimScriptVehicle?(car:unknown):void;
 /** A model's vehicles.ide type; undefined for no vehicle, null while the vehicle catalog loads. */
 vehicleModelType?(model:number|string):string|undefined|null;
 /** m_fAirResistance as the handling's drag times the scale; false for a vehicle whose motion here has none. */
 setScriptVehicleAirResistance?(car:unknown,multiplier:number):boolean;
 /** m_bIsStaticWaitingForCollision on a vehicle. */
 scriptVehicleWaitingForCollision?(car:unknown):boolean;
 /** DRAW_CROSSHAIR. */
 setForceCrosshair?(state:boolean):void;
 /** STATUS_WRECKED or bIsDrowning: what IS_CAR_DEAD asks. */
 scriptVehicleIsDead(car:unknown):boolean;
 /** m_pEntityIgnoredCollision: the object and the car pass through each other until they part; undefined while the
  * object's collision loads, false for a vehicle that is no automobile here. */
 sortOutScriptObjectCollisionWithCar?(object:number,car:unknown):boolean|undefined;
 /** A vehicle model's collision bounding box; undefined while it loads, null for a model that is no vehicle. */
 vehicleModelBounds?(model:number):{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}|null|undefined;
 /** An object model's COL bounding box: undefined while it is read, null when there is none. */
 objectModelBounds?(model:number|string):{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}|null|undefined;
 /** Whether a vehicle drowns the peds sat in it: bIsDrowning, and not bWaterTight. */
 scriptVehicleDrownsOccupants?(car:unknown):boolean;
 /** SET_CAR_WATERTIGHT: bWaterTight on a car or a bike. */
 setScriptVehicleWatertight?(car:unknown,state:boolean):void;
 /** vehicleFlags.bIsDamaged. */
 scriptVehicleVisiblyDamaged?(car:unknown):boolean;
 /** CPhysical::ApplyForce on a script car; false for a vehicle the browser cannot push so. */
 applyScriptVehicleForce?(car:unknown,force:{x:number;y:number;z:number},offset:{x:number;y:number;z:number}):boolean;
 /** CPed::bDoesntListenToPlayerGroupCommands, the other way round. */
 setScriptPedListensToGroupCommands?(ped:unknown,listens:boolean):void;
 /** ENABLE_ENTRY_EXIT_PLAYER_GROUP_WARPING: ENEX_FLAG_ACCEPT_NPC_GROUP on the entrances near a point. */
 setEntryExitGroupWarping?(x:number,y:number,radius:number,on:boolean):void;
 /** CTaskSimpleGangDriveBy on a rider (TASK_DRIVE_BY): false for a ped not riding, or before the drive-by assets load. */
 setScriptPedDriveBy?(ped:unknown,target:{kind:'point';x:number;y:number;z:number}|{kind:'ped';handle:number}|{kind:'vehicle';handle:number},radius:number,fireRate:number,rightSide:boolean):boolean;
 clearScriptPedDriveBy?(ped:unknown):void;
 /** A ped's bone (by skeleton tag) as native rows and position: 'player' for the player's own ped. */
 /** Minus the object's COL bounding box's lowest z (0 until the collision is in): how far its origin sits above its base. */
 scriptObjectBaseOffset?(handle:number):number;
 scriptPedBoneMatrix?(ped:unknown,tag:number):{position:V3;right:V3;forward:V3;up:V3}|undefined;
 /** CPhysical::m_vecTurnSpeed from the script's radians a second, set or added. */
 setScriptVehicleTurnSpeed?(car:unknown,speed:{x:number;y:number;z:number},add:boolean):void;
 setScriptVehicleCanBurstTyres(car:unknown,canBurst:boolean):void;
 /** SET_CAR_HEAVY: physicalFlags.bMakeMassTwiceAsBig. */
 setScriptVehicleHeavy?(car:unknown,heavy:boolean):void;
 setScriptVehicleOnlyDamagedByPlayer(car:unknown,enabled:boolean):void;
 /** vehicleFlags.bVehicleCanBeTargettedByHS (VEHICLE_CAN_BE_TARGETTED_BY_HS_MISSILE). */
 setScriptVehicleHeatSeekTargetable(car:unknown,targetable:boolean):void;
 /** CProjectileInfo::IsProjectileInRange over a native box. */
 projectilesInBox(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number},destroy:boolean):boolean;
 /** CHANGE_CAR_COLOUR: the two paint slots take the palette entries the script names. */
 recolourScriptVehicle(car:unknown,primary:number,secondary:number):void;
 /** CAEPedSpeechAudioEntity's global gate, which the browser has nothing to silence. */
 setAllPedSpeechDisabled(disabled:boolean):void;
 /** Whoever last hurt the ped, as the browser's own objects, for the caller to name. */
 scriptPedLastDamagedBy(ped:unknown):{player?:true;ped?:unknown;car?:unknown}|undefined;
 /** CUpsideDownCarCheck::IsCarUpsideDown for a car. */
 scriptVehicleUpsideDownForCheck?(car:unknown):boolean;
 /** A car's autopilot route: the node it set out from and the one it is on its way to. */
 scriptVehicleRouteNodes?(car:unknown):{starting:PathNode;current:PathNode}|undefined;
 /** CPed::m_nLastWeaponDamage (-1 for none) for a script ped and for the player, and their clearing; the ped's
  * m_pLastEntityDamage cleared. */
 scriptPedLastWeaponDamage?(ped:unknown):number;
 clearScriptPedLastWeaponDamage?(ped:unknown):void;
 clearScriptPedLastDamagedBy?(ped:unknown):void;
 playerLastWeaponDamage?():number;
 clearPlayerLastWeaponDamage?():void;
 /** CVehicle::m_nMaxPassengers, and CAutomobile::BurstTyre with its physical effect. */
 scriptVehicleMaximumPassengers?(car:unknown):number;
 burstScriptVehicleTyre?(car:unknown,wheel:number):void;
 /** CExplosion::TestForExplosionInArea over the active explosions (native box). */
 explosionInArea?(type:number,min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):boolean;
 /** CEntity::GetDistanceFromCentreOfMassToBaseOfModel for a car (-its bounding box's lowest z); ClearSpaceForMissionEntity
  * round it where it stands; and its script mission joined to the roads again after a teleport. */
 scriptVehicleBaseOffset?(car:unknown):number;
 clearSpaceForScriptVehicle?(car:unknown):void;
 rejoinScriptVehicleRoads?(car:unknown):void;
 /** C3dMarkers::User3dMarkerSet (an eHudColours colour) and User3dMarkerDelete. */
 createScriptUser3dMarker?(x:number,y:number,z:number,colour:number):number;
 removeScriptUser3dMarker?(index:number):void;
 /** Whether a ped swims (CTaskSimpleSwim): the player's own, and a script ped's. */
 playerSwimming?():boolean;
 scriptPedSwimming?(ped:unknown):boolean;
 /** CGangWars::GangWarFightingGoingOn. */
 gangWarFightingGoingOn?():boolean;
 /** CGangWars::GangWarGoingOn: a war under way, or a defensive attack the player has been told of. */
 gangWarGoingOn?():boolean;
 /** A script ped in the player's group follows him on foot as his recruits do, or stops. */
 setScriptPedFollowsPlayer?(ped:unknown,follows:boolean):void;
 /** CPostEffects::ScriptDarknessFilterSwitch and ScriptHeatHazeFXSwitch. */
 setDarknessFilter?(enable:boolean,alpha:number):void;
 setHeatHazeFX?(enable:boolean):void;
 /** CPed::m_nFightingStyle and m_nAllowedAttackMoves (GIVE_MELEE_ATTACK_TO_CHAR); `undefined` is the player. */
 setPedFightingStyle?(ped:unknown,style:number,moves:number):void;
 /** TASK_PLAY_ANIM on a ped in a seat: the clip plays where it sits (seconds Infinity for no time of its own). */
 playScriptRiderClip?(ped:unknown,clip:{file:string;name:string;loop:boolean;hold:boolean;seconds:number}):void;
 /** Whether the seated clip is over: its time out, or a clip not looping at its end, or one that could not load. */
 scriptRiderClipDone?(ped:unknown):boolean;
 /** The seated clip goes (a held one is let go), as the ped's next task starts. */
 clearScriptRiderClip?(ped:unknown):void;
 /** CEntity::SetAreaCode for a car. */
 setScriptVehicleArea?(car:unknown,area:number):void;
 /** CGameLogic::SetUpSkip (a native point and heading in degrees), ClearSkip(false) and IsSkipWaitingForScriptToFadeIn. */
 setUpScriptSkip?(position:readonly [number,number,number],heading:number,afterMission:boolean,vehicle:unknown,finishedByScript:boolean):void;
 clearScriptSkip?():void;
 isScriptSkipWaitingForFadeIn?():boolean;
 /** The car path areas CPathFind has loaded, or nothing before any have. */
 carPathAreas?():ReadonlyMap<number,PathArea>|undefined;
 /** CVehicle::m_pLastDamageEntity and m_nLastWeaponDamageType, as the browser's own objects, and their clearing. */
 scriptVehicleLastDamagedBy?(car:unknown):{player?:true;ped?:unknown;car?:unknown}|undefined;
 scriptVehicleLastWeaponDamage?(car:unknown):number;
 clearScriptVehicleLastDamagedBy?(car:unknown):void;
 clearScriptVehicleLastWeaponDamage?(car:unknown):void;
 /** CHud: whether a message the script put up is still on screen, and whether a help message is. */
 messageShowing():boolean;
 /** Where the camera is, what it looks along, and its field of view, in the script's own coordinates. */
 cameraSource():{x:number;y:number;z:number};
 cameraFront():{x:number;y:number;z:number};
 cameraFov():number;
 setCameraInFrontOfPlayer():void;
 helpMessageShowing():boolean;
 /** Whether the help box is up with the text a GXT key names. */
 helpMessageShowingKey?(key:string):boolean;
 /** The civilian model the zone roster would have used, for the random ped the game picks itself. */
 randomCivilianModel():number|string|undefined;
 setScriptPedRange(ped:unknown,range:'informFriends'|'followNodeThreshold'|'sense',value:number):void;
 /* Fx_c's systems. The matrix is the twelve numbers FxMatrix holds — three rows of axes and a position — in
  * the script's own coordinates; nothing comes back when the archive has no system of that name. */
 /* `hanging` says the matrix is the parent FxSystem_c::SetMatrix will replace, rather than the placement the
  * system keeps for itself; a system that follows something needs the first, and one standing at a point the
  * second, because the two are multiplied together. */
 createScriptFx(name:string,matrix:readonly number[],ignoreBoundingChecks:boolean,hanging:boolean):unknown|undefined;
 setScriptFxMatrix(system:unknown,matrix:readonly number[]):void;
 playScriptFx(system:unknown,andKill:boolean):void;
 stopScriptFx(system:unknown):void;
 killScriptFx(system:unknown):void;
 /** Whether a point in the script's own coordinates is on screen, and whether it is under the water. */
 pointOnScreen(position:{x:number;y:number;z:number},radius:number):boolean;
 pointUnderWater(position:{x:number;y:number;z:number}):boolean;
 /** What CCamera::Restore asks of the player. */
 playerCameraState():{inVehicle:boolean;enteringCar:boolean;exitingCar:boolean};
 setScriptPedDecisionMaker(ped:unknown,decisionMaker:number):void;
 setScriptPedNeverTargeted(ped:unknown,enabled:boolean):void;
 clearScriptPedLookAt(ped:unknown):void;
 /** SET_CHAR_MONEY: m_nMoneyCount as an int16, and bMoneyHasBeenGivenByScript. */
 setScriptPedMoney?(ped:unknown,money:number):void;
 /** HAS_CHAR_BEEN_PHOTOGRAPHED: the ped's bHasBeenPhotographed, cleared as it is read. */
 takeScriptPedPhotographed?(ped:unknown):boolean;
 /** CPhysical::m_vecMoveSpeed in units a second (× 50), script axes. */
 scriptVehicleVelocity?(car:unknown):{x:number;y:number;z:number};
 scriptVehicleMatrix(car:unknown):{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};position:{x:number;y:number;z:number}};
 setScriptVehicleFrozen(car:unknown,frozen:boolean):void;
 /** ANCHOR_BOAT: false for a vehicle that is not a boat. */
 setScriptBoatAnchored?(car:unknown,anchored:boolean):boolean;
 /** SET_VEHICLE_IS_CONSIDERED_BY_PLAYER: CVehicle::bConsideredByPlayer. */
 setScriptVehicleConsideredByPlayer?(car:unknown,state:boolean):void;
 /** CPhysical::GetHasCollidedWith between two entities as they stand: their collision touches this frame. */
 scriptEntitiesTouching?(a:ScmTouchEntity,b:ScmTouchEntity):boolean;
 /** Whether a script object's collision touches anything but itself (its m_apCollidedEntities is not empty). */
 scriptObjectTouchingAnything?(handle:number):boolean;
 /** CAnimBlendHierarchy::m_fTotalTime of a clip in a script's animation block, seconds, once read. */
 scriptObjectAnimLength?(block:string,name:string):Promise<number|undefined>;
 /** SET_UPSIDEDOWN_CAR_NOT_DAMAGED: autoFlags.bDoesNotGetDamagedUpsideDown. */
 setScriptVehicleUpsideDownNotDamaged?(car:unknown,state:boolean):void;
 setScriptVehicleForwardSpeed(car:unknown,forwardSpeed:number):void;
 damageScriptPed(ped:unknown,amount:number):void;
 /* The cars a script creates. The browser builds one only once its model is streamed, so the host is asked to
  * spawn and the pool holds the handle in the meantime; everything the script says before the car arrives is
  * applied when it does. */
 /** The car the player drives, as the scriptVehicle* methods take it, when it is a car the browser can answer for. */
 playerVehicleEntity?():unknown|undefined;
 /** Where the player's vehicle of any kind is and how it lies: native position, axes and CPlaceable::GetHeading in degrees. */
 playerVehiclePose?():{position:{x:number;y:number;z:number};right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};heading:number}|undefined;
 spawnScriptVehicle(model:number|string,position:{x:number;y:number;z:number},heading:number,componentsToUse?:readonly [number,number]):Promise<unknown>;
 placeScriptVehicle(car:unknown,position:{x:number;y:number;z:number},heading:number):void;
 scriptVehiclePosition(car:unknown):{x:number;y:number;z:number};
 /** The top of a script car's collision box above its origin (GetColModel()->GetBoundingBox().m_vecMax.z). */
 scriptVehicleBoxTop?(car:unknown):number;
 scriptVehicleHeading(car:unknown):number;
 scriptVehicleAlive(car:unknown):boolean;
 removeScriptVehicle(car:unknown):void;
 scriptVehicleHealth(car:unknown):number;
 setScriptVehicleHealth(car:unknown,health:number):void;
 scriptVehicleSpeed(car:unknown):number;
 scriptVehicleStopped(car:unknown):boolean;
 scriptVehicleOnFire(car:unknown):boolean;
 scriptVehicleOnScreen(car:unknown):boolean;
 explodeScriptVehicle(car:unknown):void;
 /** CAutomobile::BlowUpCarCutSceneNoExtras on a car (a bike, boat or plane blows up as usual). */
 explodeScriptVehicleInCutscene?(car:unknown,o:{shake:boolean;bits:boolean;explosion:boolean;sound:boolean}):void;
 fixScriptVehicle(car:unknown):void;
 setScriptVehicleVisible(car:unknown,visible:boolean):void;
 setScriptVehicleProofs(car:unknown,proofs:ScmPedProofs):void;
 setScriptVehicleCanBeDamaged(car:unknown,canBeDamaged:boolean):void;
 setScriptVehicleDoorLock(car:unknown,locked:boolean):void;
 /** vehicleFlags.bSirenOrAlarm and autoFlags.bCanBeVisiblyDamaged. */
 setScriptVehicleSiren?(car:unknown,on:boolean):void;
 setScriptVehicleCanBeVisiblyDamaged?(car:unknown,state:boolean):void;
 /** CTimer::ms_fTimeScale, which the game's cheats and the script share. */
 setTimeScale?(scale:number):void;
 /** CEntity::SetUsesCollision on a script ped and on the player. */
 setScriptPedCollision?(ped:unknown,uses:boolean):void;
 /** handlingFlags.bHydraulicInst on a car: whether it is fitted, and AddVehicleUpgrade or RemoveVehicleUpgrade of
  * MI_HYDRAULICS. */
 scriptVehicleHasHydraulics?(car:unknown):boolean;
 /** CONTROL_CAR_HYDRAULICS's corners (null: RESET_VEHICLE_HYDRAULICS); false for a vehicle without hydraulics here. */
 setScriptVehicleHydraulicLevels?(car:unknown,wheels:{frontLeft:number;rearLeft:number;frontRight:number;rearRight:number}|null):boolean;
 setScriptVehicleHydraulics?(car:unknown,fitted:boolean):void;
 /** CVehicle::m_nHandlingFlags as the car's handling line gives them. */
 scriptVehicleHandlingFlags?(car:unknown):number;
 /** The vehicle catalog's upgrade tables: a vehicle model's upgrades (m_anUpgrades), an upgrade's eVehicleModSlot, a
  * model's paintjob count (GetNumRemaps) and colour variation count (m_nNumColorVariations). */
 vehicleUpgradeTables?():{upgradesOf(model:number):readonly number[];modSlotOf(model:number):number;remapCount(model:number):number;colourCount(model:number):number}|undefined;
 /** A script car's paintjob (CVehicle::GetRemapIndex, -1 none). */
 scriptVehiclePaintjob?(car:unknown):number;
 /** A script car's handling model flags (m_nModelFlags), which set vehicleFlags.bIsBig among others. */
 scriptVehicleModelFlags?(car:unknown):number;
 /** CVehicle::m_fDirtLevel. */
 setScriptVehicleDirtLevel?(car:unknown,level:number):void;
 /** CPlayerPed's jetpack task: whether the player wears one and flies it. */
 playerUsingJetpack?():boolean;
 /** CGameLogic's penalty switches: whether money and weapons go with the next death or arrest. */
 setDeathPenalties?(apply:boolean):void;
 setArrestPenalties?(apply:boolean):void;
 /** CAutomobile::OpenDoor with the eDoors index the script names and an open ratio. */
 openScriptVehicleDoor?(car:unknown,door:number,ratio:number):void;
 /** GetPositionToOpenCarDoor for a seat of a script car, in the script's coordinates, on the ground. */
 scriptVehicleSeatDoor?(car:unknown,seat:'driver'|number):{x:number;y:number;z:number}|undefined;
 /** CVehicle::CanPedStepOutCar(false): the car is still enough to step out of. */
 scriptVehicleStill?(car:unknown):boolean;
 /** CTaskSimpleCarJumpOut for a ped set out of a moving car: CAR_rollout_LHS or _RHS with the car's speed. */
 rollOutScriptPed?(ped:unknown,velocity:{x:number;z:number},clip:'car_rollout_lhs'|'car_rollout_rhs'):void;
 /** CCarAI's coordinate missions on a script car (ScriptCarMissions), in the script's coordinates, and
  * m_nStraightLineDistance. */
 driveScriptVehicleTo?(car:unknown,goal:{x:number;y:number;z:number},o:{cruise:number;style:number;accurate:boolean;straight:boolean}):void;
 setScriptVehicleStraightLineDistance?(car:unknown,distance:number):void;
 /** The car's CCarAI mission cleared (MISSION_NONE): its driver's task was cleared, or the driver got out. */
 stopScriptVehicle?(car:unknown):void;
 /** CAutoPilot's temporary action for its time, and MISSION_CRUISE, on a script car. */
 scriptVehicleTempAction?(car:unknown,action:number,seconds:number):void;
 scriptVehicleWander?(car:unknown,o:{cruise:number;style:number}):void;
 /** CTaskComplexCarDriveMission's autopilot mission (eCarMission) against a target car, or the player with none;
  * false for a mission the browser does not drive. */
 scriptVehicleCarMission?(car:unknown,o:{mission:number;target?:unknown;cruise:number;style:number}):boolean;
 setPlayerCollision?(uses:boolean):void;
 /** CWorld::StopAllLawEnforcersInTheirTracks. */
 stopAllLawEnforcers():void;
 /** CPlayerInfo::MakePlayerSafe with its radius, and the maxima the script raises. */
 makePlayerSafe(safe:boolean,radius:number):void;
 /** CWorld::SetAllCarsCanBeDamaged: vehicleFlags.bCanBeDamaged on every vehicle there is. */
 setAllVehiclesCanBeDamaged?(state:boolean):void;
 /** CHeli::SwitchPoliceHelis, CRoadBlocks::RegisterScriptRoadBlock (native corners, gang or police) and
  * ClearScriptRoadBlocks. */
 switchPoliceHelis?(state:boolean):void;
 /** The player group's limits: SET_SCRIPT_LIMIT_TO_GANG_SIZE and SET_GROUP_SEPARATION_RANGE. */
 setScriptLimitToGangSize?(size:number):void;
 /** CGangWars::SetGangWarsActive. */
 setGangWarsActive?(state:boolean):void;setPlayerGroupSeparationRange?(range:number):void;
 /** CCutsceneMgr::IsCutsceneSkipButtonBeingPressed this frame. */
 cutsceneSkipPressed?():boolean;
 /** A script car's own autopilot settings (SET_CAR_CRUISE_SPEED, SET_CAR_DRIVING_STYLE). */
 scriptVehicleAutopilotFields?(car:unknown):{cruiseSpeed?:number;drivingStyle?:number};
 /** vehicleFlags.bTakeLessDamage and the number of wheels on the ground. */
 setScriptVehicleStrong?(car:unknown,strong:boolean):void;
 scriptVehicleWheelsOnGround?(car:unknown):number;
 /** Room in the player's group for `room` mission peds, beside the `missionMembers` the script's group already holds. */
 makeRoomInPlayerGang?(room:number,missionMembers:number):void;
 /** SET_ANIM_GROUP_FOR_CHAR on a ped the browser built; false for a group it cannot play. */
 setScriptPedAnimGroup?(ped:unknown,group:string):boolean;
 /** CWaterLevel::SyncWater: restart the visual wave cycle now. */
 syncWater?():void;
 registerScriptRoadblock?(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},gang:boolean):void;
 clearScriptRoadblocks?():void;
 setPlayerMaxHealth(maxHealth:number):void;
 /** CPed::bDrownsInWater on the player. */
 setPlayerDrownsInWater?(drowns:boolean):void;
 /** CPed::AttachPedToEntity and DettachPedFromEntity for the player on a vehicle; false when he cannot be attached. */
 attachPlayerToVehicle?(car:unknown,offset:{x:number;y:number;z:number},side:number,limit:number,weapon:number):boolean;
 detachPlayerFromVehicle?():void;playerAttachedVehicle?():unknown;
 setAttachedPlayerHeading?(heading:number,range:number):boolean;
 attachPlayerToObject?(object:number,offset:{x:number;y:number;z:number},side:number,limit:number,weapon:number):boolean;playerAttachedObject?():number|undefined;
 /** The player's health (SET_CHAR_HEALTH), and his death at none. */
 setPlayerHealth?(health:number):void;killPlayer?():void;
 /** CPlayerInfo::m_bFreeHealthCare (SET_FREE_HEALTH_CARE): the next hospital trip costs nothing and keeps the weapons. */
 setFreeHealthCare?(on:boolean):void;
 /** CPhysical::SetVelocity on the player, native units per 50th of a second. */
 setPlayerVelocity?(velocity:{x:number;y:number;z:number}):void;
 /** SET_PHOTO_CAMERA_EFFECT on the HUD's crosshair. */
 setPhotoCameraEffect?(on:boolean):void;
 /** CPlaceable::SetOrientation (SET_CHAR_ROTATION) on the player and on a script ped: degrees, the heading z with the
  * tilt x about the ped's right and y about its forward. */
 setPlayerRotation?(x:number,y:number,z:number):void;
 setScriptPedRotation?(ped:unknown,x:number,y:number,z:number):void;
 /** GET_CHAR_VELOCITY on the player: his m_vecMoveSpeed (his vehicle's in one) in native axes, units a second. */
 playerVelocity?():{x:number;y:number;z:number};
 setPlayerMaxArmour(maxArmour:number):void;
 /** CEntryExitManager: the flag the script sets on the entry-exit nearest a point, and the named switch. */
 setClosestEntryExitFlag(x:number,y:number,radius:number,flag:number,on:boolean):void;
 switchEntryExit(name:string,on:boolean):void;
 /** SET_NAMED_ENTRY_EXIT_FLAG: the flag bits on every entry-exit of that name. */
 setNamedEntryExitFlag?(name:string,flag:number,on:boolean):void;
 /** CEntryExitManager::EnableBurglaryHouses and ms_bDisabled (DISABLE_ALL_ENTRY_EXITS). */
 enableBurglaryHouses(on:boolean):void;disableAllEntryExits(disabled:boolean):void;
}
/** CTheScripts' player slot: the script always addresses player zero, whose ped it creates first. */
export const PLAYER_PED_HANDLE=1,PLAYER_GROUP_HANDLE=0;
/** How near a ped the player stands for its conversation (AUTHORED; see playerInPositionForConversation). */
const CONVERSATION_REACH=3,CONVERSATION_HEIGHT=2;
/** CVehicle::CanPedOpenLocks answered for the player by eCarLock. */
export const playerLockedOut=(lock:number)=>lock===2||lock===3||lock===4||lock===5||lock===7;
/** The browser holds one vehicle for the player at a time, so the script's questions about the car it is in are
 * answered by a single handle rather than a pool the browser does not have. */
export const PLAYER_VEHICLE_HANDLE=1;
/** Where the script's own peds and cars are numbered from, above the player's handle and his car's. */
export const SCRIPT_PED_FIRST_HANDLE=1024,SCRIPT_VEHICLE_FIRST_HANDLE=1024;
/** eRadioID::RADIO_OFF. */
const RADIO_OFF=13;
/** eVehicleAppearance::VEHICLE_APPEARANCE_AUTOMOBILE. */
const VEHICLE_APPEARANCE_AUTOMOBILE=1;
/** IS_COP_VEHICLE_IN_AREA_3D_NO_SAVE's models: CVehicle::IsLawEnforcementVehicle's (iOS 0x100479618) less the
 * Predator, which the handler leaves out. */
const COP_VEHICLE_MODELS:ReadonlySet<number>=new Set([...LAW_ENFORCEMENT_MODELS].filter(model=>model!==430));
/** Streamed scripts that are never streamed in, so MAIN's HAS_STREAMED_SCRIPT_LOADED stays false and it never starts
 * them: none now. `impound` (the police pounds' gates, guards and cars) was held back while it stopped at
 * IS_COP_VEHICLE_IN_AREA_3D_NO_SAVE, which MAIN would have started again every pass; it now has every command it
 * reaches but GET_CHAR_HIGHEST_PRIORITY_EVENT (skipped: no event queue here, so no event is read). `player_parachute`
 * runs (it flies the free fall and the canopy, and the browser's own canopy stays shut while a script runs), and so
 * does `camera` (MAIN starts it while CJ holds the camera: his group poses for it, and a homie beside him takes his
 * picture); the port's own shots with the camera are the weapon's, which the script leaves alone. */
const HELD_BACK_STREAMED_SCRIPTS:ReadonlySet<string>=new Set();
/** CRunningScript::ThisIsAValidRandomPed (0x489490): civilians, the nine gang types, or criminals and prostitutes. */
export function validRandomPedType(pedType:number,civilian:boolean,gang:boolean,criminal:boolean){
 if(pedType===4||pedType===5)return civilian;
 if(pedType>=7&&pedType<=15)return gang;
 if(pedType===20||pedType===22)return criminal;
 return false;
}
/** CRunningScript::m_nExternalType of a script started on an object by its brain (ShutdownThisScript's cases 0, 2, 3
 * and 5 are the ped brains). */
const EXTERNAL_OBJECT_BRAIN=1;
/** CRunningScript::m_nExternalType of a random ped's brain (ShutdownThisScript's case 0). */
const EXTERNAL_PED_BRAIN=0;
/** How near the player a garage's doors are made objects of, and the height a door model with no collision gets (re3's
 * AddOne falls back to 4). The grge row's 0x1 flag: the door opens up and turns. */
const GARAGE_DOOR_STREAM_RADIUS=150,GARAGE_DOOR_DEFAULT_HEIGHT=4,GARAGE_FLAG_DOOR_TURNS=0x1;
/** MODEL_BMOCHIL and MODEL_HOTDOG (eModelID). */
const MODEL_BMOCHIL=168,MODEL_HOTDOG=588;
/** COMMAND_TASK_USE_ATTRACTOR and COMMAND_TASK_PLAY_ANIM_SECONDARY, the task records those commands leave. */
const TASK_USE_ATTRACTOR_COMMAND=0x74C,TASK_PLAY_ANIM_SECONDARY_COMMAND=0xA1A;
/** ePedType::PED_TYPE_CIVMALE, which is what the random civilian forms create. */
const PED_TYPE_CIVMALE=4;
/* The original MAIN.SCM running inside the browser. CTheScripts::Process is driven a frame at a time; a
 * command the runtime has not ported stops the script exactly where the original would have carried on, and
 * the reason is kept so the gap is visible rather than silent. Everything the script sets before that point,
 * the clock, the stats, the zone population, the restart points and the rest, is real script state rather
 * than a static reading of the file. */
/** An entity a touching question names: the player, a script ped or vehicle the host built, or a script object. */
export type ScmTouchEntity={kind:'player'}|{kind:'ped'|'vehicle';entity:unknown}|{kind:'object';handle:number};
/** CCarCtrl::CreateCarForScript's cruise speed. */
const CREATED_CRUISE_SPEED=13;
/** handlingFlags.bLowRider. */
const HANDLING_LOW_RIDER=0x2000000,HANDLING_STREET_RACER=0x4000000;
/** The handling model flag IS_BIG. */
const MODEL_FLAG_IS_BIG=0x8;
/** The tasks that drive or leave a car, which the on-foot peds cannot run. */
/** An axis's angle above the ground in degrees; with the car upside down (its up axis below the ground) the angle
 * runs on past 90, to 180 flat on the roof. */
const tiltDegrees=(axis:{x:number;y:number;z:number},upZ:number)=>{
 const degrees=Math.atan2(axis.z,Math.hypot(axis.x,axis.y))*180/Math.PI;
 return upZ>=0?degrees:(degrees>=0?180-degrees:-180-degrees);
};
const CAR_TASKS:ReadonlySet<ScmScriptedTask['kind']>=new Set(['carDriveToCoord','carTempAction','carDriveWander','carMission','leaveCar','leaveAnyCar','leaveCarImmediately']);
/** Orders that only set something and are over at once, with nothing for them to act on while the ped sits in a car. */
const IN_SEAT_OVER_AT_ONCE:ReadonlySet<ScriptedPedOrder['kind']>=new Set(['lookAt','clearLookAt','lookAtPoint','threatScanner','decisionMaker','kindaStayInSamePlace']);
/** Where a runner's task stands: held by the ped, waited out in the seat, waiting for the ped to be rebuilt (then the
 * task to begin), or getting in at the wheel before the drive. */
type RunnerStep=
 |{kind:'held'}
 |{kind:'wait';remaining:number}
 |{kind:'settle';then?:ScmScriptedTask}
 |{kind:'board';vehicle:number;then:ScmScriptedTask}
 |{kind:'slowing';then:ScmScriptedTask}
 /** A clip played in the seat, which the host says when it is over. */
 |{kind:'seatClip'};
/** CGeneral::GetATanOfXY: the angle of (x, y) from the x axis, in [0, 2π). */
export function getATanOfXY(x:number,y:number){if(x===0&&y===0)return 0;const a=Math.atan2(y,x);return a<0?a+2*Math.PI:a;}
/** IS_POINT_OBSCURED_BY_A_MISSION_ENTITY's box, the point less and plus each radius with the ends swapped into order,
 * and CBoundingBox::IsPointWithin's test of an entity's position against it, edges included. */
export function insideMissionCube(x:number,y:number,z:number,rx:number,ry:number,rz:number,p:{x:number;y:number;z:number}){
 return Math.abs(p.x-x)<=Math.abs(rx)&&Math.abs(p.y-y)<=Math.abs(ry)&&Math.abs(p.z-z)<=Math.abs(rz);
}
/** Nested sequences (CTaskComplexUseSequence) are run inline: each is replaced by the tasks its sequence holds
 * when the outer one is given, and each flattened task remembers which step, and which step of the nested
 * sequence, it is. A nested sequence runs once through; one that repeats would never hand back to the outer one,
 * which is not followed. `steps` is undefined when nothing is nested.
 *
 * PERFORM_SEQUENCE_TASK_FROM_PROGRESS gives m_nCurrentTaskIndex and m_nEndTaskIndex. CreateFirstSubTask starts at
 * the first; when that task is itself a use-sequence, it starts at the second. `start` is where in the flattened
 * list that is. A repeat goes back to the first task (CTaskComplexSequence::CreateNextSubTask), nested ones from
 * their own first. A use-sequence recorded with its own progress keeps it every time it is run. */
export function expandScriptSequence(tasks:readonly ScmScriptedTask[],sequenceTasks:(index:number)=>readonly ScmScriptedTask[],from?:{task:number;subTask:number}){
 const at=from?.task??0,sub=from?.subTask??-1;
 if(!tasks.some(task=>task.kind==='useSequence'))return {tasks,steps:undefined,start:at};
 const flat:ScmScriptedTask[]=[],steps:{outer:number;inner:number}[]=[];
 let start=-1;
 const nested=(task:Extract<ScmScriptedTask,{kind:'useSequence'}>,outer:number,inner:number|undefined,depth:number,first=0)=>{
  // A sequence that names itself, directly or not, is cut off rather than followed for ever.
  if(depth>4)return;
  const begin=task.from?.task??first;
  sequenceTasks(task.sequence).forEach((inside,step)=>{
   if(step<begin)return;
   if(inside.kind==='useSequence')nested(inside,outer,inner??step,depth+1,step===begin?Math.max(0,task.from?.subTask??0):0);
   else{flat.push(inside);steps.push({outer,inner:inner??step});}
  });
 };
 tasks.forEach((task,outer)=>{
  if(outer===at)start=flat.length;
  if(task.kind==='useSequence'){
   // Only the pass FROM_PROGRESS starts is cut short, and the flattened list is the whole sequence: the start
   // is found at the nested step it names.
   const before=flat.length;
   nested(task,outer,undefined,1);
   if(outer===at&&sub>0){const found=steps.findIndex((step,i)=>i>=before&&step.outer===outer&&step.inner>=sub);start=found<0?flat.length:found;}
  }
  else{flat.push(task);steps.push({outer,inner:-1});}
 });
 return {tasks:flat,steps,start:start<0?flat.length:start};
}
export class ScmMission {
 /** TheCamera's one fade, which the script shares with the game from MAIN's opening DO_FADE 0 0 on; a host without one
  * leaves the script its own. */
 private readonly ownFade=new ScmCameraFade();
 get fade(){return this.world.cameraFade??this.ownFade;}
 /** CPed::CreateDeadPedPickupCoors round a point (native axes): where a dead ped's weapons land, for the street
  * population as for GET_DEAD_CHAR_PICKUP_COORDS. */
 deadPedPickupCoordsAt(at:{x:number;y:number;z:number},command='CreateDeadPedWeaponPickups'){
  const bubble=this.host('pickupsInBubble',command),vehicles=this.host('vehicleInSphere',command);
  const flags=(both:boolean)=>({buildings:true,vehicles:both,peds:false,objects:both});
  return deadPedPickupCoors(at,this.world.playerPed().position,{groundZ:(x,y,z)=>this.world.groundLevel(x,y,z),pickupsInBubble:bubble,
   lineOfSightClear:(a,b,both)=>this.world.lineOfSightClear(a,b,flags(both)),vehicleInSphere:vehicles,random256:()=>Math.floor(Math.random()*256)});
 }
 /** Between START_CUTSCENE and CLEAR_CUTSCENE: the browser has no cutscene to show, so the screen stays faded out
  * through it rather than fading in on the world the cutscene would have covered. The hold goes with the thread that
  * started the cutscene, so a mission ended mid-cutscene does not leave the screen black. */
 /** The model a script ped is built from. Model ids from MODEL_SPECIAL01 (290) are CStreaming's special-character
  * slots (MODEL_SPECIAL01 to 10), which LOAD_SPECIAL_CHARACTER fills by name (RequestSpecialChar: script slot n is
  * model 289 + n); the host is handed that name, and any other id as it stands (its peds.ide row). The script keeps
  * the id it gave. */
 private pedModel(model:number|string){
  if(typeof model!=='number')return model;
  if(model>=SPECIAL_MODELS_RESOURCE_ID&&model<SPECIAL_MODELS_RESOURCE_ID+SPECIAL_PED_MODELS){
   const name=this.runtime.game.specialCharacters.at(model-SPECIAL_MODELS_RESOURCE_ID+1);
   if(name)return name.toLowerCase();
  }
  return model;
 }
 private cutsceneThread?:unknown;
 private get cutsceneOpen(){const thread=this.cutsceneThread;return !!thread&&this.runtime.active.some(slot=>slot.thread===thread);}
 readonly runtime:ScmRuntime;
 /** Where the script stopped outright, or nothing while any of it is still running. */
 stopped?:{command:string;offset:number;detail:string};
 /** Threads that gave up on a command this runtime has not ported, in the order they did. */
 readonly gaveUp:{thread:string;command:string;offset:number;detail?:string}[]=[];
 /** The commands skipped because their world member is not ported, by thread and command, with how often. */
 readonly skipped=new Map<string,{thread:string;command:string;offset:number;count:number}>();
 /** Commands the world was asked for, for a host that wants to follow along. */
 readonly relationships:{relationship:number;pedType:number;otherPedType:number}[]=[];
 laRiots=false;
 /** Entry-exit flags and switches the script has asked for. */
 entryExitFlags=0;
 /** World objects whose visibility the script switched. */
 objectVisibilities=0;
 /** How many times the script asked for the player's model to be rebuilt. */
 playerModelsBuilt=0;
 /** Whether the script has left the player in control of themselves. */
 playerControl=true;
 /** A mission thread gave up this pass (see handBack). */
 private handBackPending=false;
 /** The thread that gave up this pass was a mission's (see handBack). */
 private missionGaveUp=false;
 /** A streamed script that gives up while it holds the player at a counter (every shop script sets
  * SET_MINIGAME_IN_PROGRESS before it takes his controls and the camera) hands them back as a mission does. One
  * that never took them, a gate's or a machine's brain giving up as the player drives by, must not: that would cut
  * a mission's fixed camera and return controls the mission had taken. */
 private heldByShop(thread:ScmThread){return thread.isExternal&&this.runtime.game.miniGameInProgress;}
 /** Streamed scripts that stopped on a command the port lacks (not on a passing failure, such as a handle whose
  * object streamed out mid-command: that would stop every machine of the kind for the session). MAIN asks for most of them again whenever none is
  * running (the pounds, the valet, the cranes), and a brain starts its script on every object of the model, so a
  * file that stopped once is not streamed in again: it would stop at the same command every time. */
 private readonly stoppedStreamedScripts=new Set<string>();
 private streamedScriptStopped(thread:ScmThread){
  if(!thread.isExternal)return;
  const scripts=this.runtime.game.streamedScripts,index=scripts.indexOfMemory(thread.scriptSpace);if(index<0)return;
  this.stoppedStreamedScripts.add(scripts.filename(index).toLowerCase());scripts.removeFromMemory(index);
 }
 /** The adapter the runtime calls, for the mission's own helpers that reuse its members. */
 private adapterRef!:ScmWorldCommands;
 /** The player's CPed::bDontDragMeOutCar (SET_CHAR_CANT_BE_DRAGGED_OUT). */
 playerCantBeDraggedOut=false;
 /** For a ped running a sequence with nested ones, each flattened task's step and nested step. */
 private readonly sequenceSteps=new Map<number,{outer:number;inner:number}[]>();
 /** The mission text block the script last asked for. */
 missionText?:string;
 /** The cutscenes the script asked for, in order. */
 readonly cutscenes:string[]=[];
 /** The models the script asked the streamer for. */
 readonly requestedModels=new Set<string>();
 /** How many times the script asked for an area to be cleared. */
 areasCleared=0;
 /** Where the script created the player, in native axes. */
 playerStart?:{x:number;y:number;z:number};
/** The PC CRT stream the script draws from, seeded like a fresh run. */
 private seed=1;
 private readonly random={next:()=>{this.seed=(Math.imul(this.seed,214013)+2531011)>>>0;return (this.seed>>>16)&RANDOM_SAMPLE_MAX;}};
 private started=false;
 private elapsed=0;
 constructor(script:Uint8Array,private readonly zones:WorldZones,private readonly world:ScmMissionWorld){
  // A new game: CGangs::Initialise's weapon choices before the script changes any.
  resetGangWeapons();
  const adapter:ScmWorldCommands={
   fade:(milliseconds,direction,nowMs)=>{if(direction===1&&this.cutsceneOpen)direction=0;const shared=this.fade!==this.ownFade;this.fade.fade(milliseconds,direction,nowMs);if(shared)this.world.showFade?.(direction,milliseconds);},
   isFading:()=>this.fade.fading,
   setExtraColours:(colour,fade)=>{this.world.startExtraColour?.(colour,fade);},
   clearExtraColours:fade=>{this.world.stopExtraColour?.(fade);},
   requestCollision:()=>{},
   // CStreaming::RequestModel on a streamed script: script.img is held whole, so the file is in at once.
   requestStreamedScript:index=>{
    const scripts=this.runtime.game.streamedScripts,slot=scripts.at(index),bytes=this.streamedFiles.get(slot.filename.toLowerCase());
    const name=slot.filename.toLowerCase();
    if(bytes&&!slot.memory&&!HELD_BACK_STREAMED_SCRIPTS.has(name)&&!this.stoppedStreamedScripts.has(name))scripts.loadStreamedScript(index,bytes);
   },
   loadScene:(x,y,z)=>{this.world.loadScene(x,y,z);},
   createPlayer:(_playerId,x,y,z)=>{this.playerStart={x,y,z};this.world.playerCreatedAt(x,y,z);},
   getPlayerChar:()=>PLAYER_PED_HANDLE,
   getPlayerGroup:()=>PLAYER_GROUP_HANDLE,
   // SET_ANIM_GROUP_FOR_CHAR on a ped the script made; the player's own motion group follows his fat and muscle.
   setPedAnimGroup:(handle,group)=>{
    if(handle===PLAYER_PED_HANDLE)throw new UnsupportedScmCommand(-1,0,'SET_ANIM_GROUP_FOR_CHAR','the player');
    this.peds.setAnimGroup(handle,group.toLowerCase());
   },
   // CAR_GOTO_COORDINATES (VC's handler; SA's is unreversed): the car's own cruise speed, at least 6, and driving style
   // take it to the point, joining the road or going straight as JoinCarWithRoadSystemGotoCoors decides.
   // SET_CAR_MISSION (VC's handler; SA's is unreversed): CAutoPilot::m_nCarMission straight from the script, with the
   // car's own cruise speed and driving style, the anti-reverse timer restarted and the engine on. The ram and block
   // missions go for the player; MISSION_NONE stops the car.
   setVehicleMission:(handle,mission)=>{
    const car=this.liveVehicle(handle),fields=this.world.scriptVehicleAutopilotFields?.(car)??{};
    if('engineRunning' in (car as object))(car as {engineRunning:boolean}).engineRunning=true;
    if(mission===0){this.world.stopScriptVehicle?.(car);return;}
    if(!this.host('scriptVehicleCarMission','SET_CAR_MISSION')(car,{mission,cruise:fields.cruiseSpeed??CREATED_CRUISE_SPEED,style:fields.drivingStyle??0}))
     throw new UnsupportedScmCommand(-1,0,'SET_CAR_MISSION',`mission ${mission}`);
   },
   // CAR_WANDER_RANDOMLY (VC's handler; SA's is unreversed): the car joins the road system on MISSION_CRUISE with the
   // engine on, a cruise speed of at least 1 and the anti-reverse timer restarted.
   vehicleWanderRandomly:handle=>{
    const car=this.liveVehicle(handle),fields=this.world.scriptVehicleAutopilotFields?.(car)??{};
    if('engineRunning' in (car as object))(car as {engineRunning:boolean}).engineRunning=true;
    const cruise=Math.max(1,fields.cruiseSpeed??CREATED_CRUISE_SPEED);
    this.world.setScriptVehicleAutopilot(car,'cruiseSpeed',cruise);
    this.host('scriptVehicleWander','CAR_WANDER_RANDOMLY')(car,{cruise,style:fields.drivingStyle??0});
   },
   // SET_CAR_CAN_GO_AGAINST_TRAFFIC: CAutoPilot's bCantGoAgainstTraffic, the inverse of the operand. Nothing reversed
   // reads the bit, so it is kept and does nothing more.
   setVehicleIsConsideredByPlayer:(handle,state)=>{this.host('setScriptVehicleConsideredByPlayer','SET_VEHICLE_IS_CONSIDERED_BY_PLAYER')(this.liveVehicle(handle),state);},
   // SET_CAR_STAY_IN_SLOW_LANE: CAutoPilot::bStayInSlowLane.
   setVehicleStayInSlowLane:(handle,state)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'stayInSlowLane',state?1:0);},
   setVehicleCanGoAgainstTraffic:(handle,state)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'cantGoAgainstTraffic',state?0:1);},
   vehicleGotoCoordinates:(handle,x,y,z)=>{
    const car=this.liveVehicle(handle),fields=this.world.scriptVehicleAutopilotFields?.(car)??{};
    this.host('driveScriptVehicleTo','CAR_GOTO_COORDINATES')(car,{x,y,z},{cruise:Math.max(fields.cruiseSpeed??CREATED_CRUISE_SPEED,6),style:fields.drivingStyle??0,accurate:false,straight:false});
   },
   // CAR_GOTO_COORDINATES_ACCURATE: the same drive on the accurate mission, which slows to stop on the point.
   vehicleGotoCoordinatesAccurate:(handle,x,y,z)=>{
    const car=this.liveVehicle(handle),fields=this.world.scriptVehicleAutopilotFields?.(car)??{};
    this.host('driveScriptVehicleTo','CAR_GOTO_COORDINATES_ACCURATE')(car,{x,y,z},{cruise:Math.max(fields.cruiseSpeed??CREATED_CRUISE_SPEED,6),style:fields.drivingStyle??0,accurate:true,straight:false});
   },
   // GET_CAR_FORWARD_X and _Y (VC's handler, reVC): the forward vector's two ground components over its ground length.
   vehicleForwardX:handle=>{const f=this.vehicleMatrixOf(handle).forward;return f.x/Math.hypot(f.x,f.y);},
   vehicleForwardY:handle=>{const f=this.vehicleMatrixOf(handle).forward;return f.y/Math.hypot(f.x,f.y);},
   // GET_CAR_PITCH and GET_CAR_ROLL (unreversed): the forward and right axes' angles above the ground, in degrees, past
   // 90 once the car is upside down.
   getCarPitch:handle=>{const m=this.vehicleMatrixOf(handle);return tiltDegrees(m.forward,m.up.z);},
   vehicleRoll:handle=>{const m=this.vehicleMatrixOf(handle);return tiltDegrees(m.right,m.up.z);},
   // GET_CAR_SPEED_VECTOR: m_vecMoveSpeed in units a second.
   getCarSpeedVector:handle=>this.host('scriptVehicleVelocity','GET_CAR_SPEED_VECTOR')(this.liveVehicle(handle)),
   // CAR_SET_IDLE: MISSION_NONE.
   setVehicleIdle:handle=>{this.host('stopScriptVehicle','CAR_SET_IDLE')(this.liveVehicle(handle));},
   // CLOSE_ALL_CAR_DOORS: every door to shut.
   closeAllVehicleDoors:handle=>{const car=this.liveVehicle(handle),open=this.host('openScriptVehicleDoor','CLOSE_ALL_CAR_DOORS');for(let door=0;door<6;door++)open(car,door,0);},
   setVehicleStrong:(handle,strong)=>{this.host('setScriptVehicleStrong','SET_CAR_STRONG')(this.liveVehicle(handle),strong);},
   // IS_VEHICLE_ON_ALL_WHEELS: m_nNumContactWheels is four.
   vehicleIsOnAllWheels:handle=>this.host('scriptVehicleWheelsOnGround','IS_VEHICLE_ON_ALL_WHEELS')(this.liveVehicle(handle))>=4,
   isCutsceneSkipButtonBeingPressed:()=>this.world.cutsceneSkipPressed?.()??false,
   setPedKeepTask:(handle,keep)=>{if(handle!==PLAYER_PED_HANDLE)this.peds.setKeepTask(handle,keep);},
   makeRoomInPlayerGangForMissionPeds:count=>{this.host('makeRoomInPlayerGang','MAKE_ROOM_IN_PLAYER_GANG_FOR_MISSION_PEDS')(count,this.group(PLAYER_GROUP_HANDLE).countFollowers());},
   setCameraBehindPlayer:()=>{this.world.setCameraBehindPlayer();},
   // SetCharHeading (CharacterCommands.cpp): a ped in a vehicle keeps the heading it has, and one on foot
   // takes the angle for both its aiming and its current rotation.
   setCharHeading:(ped,degrees)=>{
    if(ped===PLAYER_PED_HANDLE){
     if(!this.world.playerPed().vehicle)this.world.setPlayerHeading(degrees);
     return;
    }
    if(this.peds.rideOf(ped)===undefined)this.peds.setHeading(ped,degrees);
   },
   // CPedType's tables: SET_RELATIONSHIP and CLEAR_RELATIONSHIP edit a ped type's acquaintances, which peds made
   // after it copy.
   setRelationship:(relationship,pedType,otherPedType)=>{this.relationships.push({relationship,pedType,otherPedType});this.world.setPedTypeRelationship?.(relationship,pedType,otherPedType,true);},
   clearRelationship:(relationship,pedType,otherPedType)=>{this.world.setPedTypeRelationship?.(relationship,pedType,otherPedType,false);},
   isRelationshipSet:(relationship,pedType,otherPedType)=>this.host('pedTypeRelationshipSet','IS_RELATIONSHIP_SET')(relationship,pedType,otherPedType),
   // GET_GROUP_SIZE: whether the group has a leader, and its members besides.
   groupSize:group=>{const g=this.groups.get(group);return {leader:g?.leader!==undefined?1:0,members:g?g.countFollowers():0};},
   groupMember:(group,slot)=>this.groups.get(group)?.memberAt(slot)??-1,
   setPhotoCameraEffect:on=>{this.host('setPhotoCameraEffect','SET_PHOTO_CAMERA_EFFECT')(on);},
   maxGroupMembers:()=>this.host('maxGroupMembers','FIND_MAX_NUMBER_OF_GROUP_MEMBERS')(),
   // CPed::GetWeaponInSlot(slot): its type, total ammo and CPickups::ModelForWeapon.
   pedWeaponInSlot:(handle,slot)=>this.host('pedWeaponInSlot','GET_CHAR_WEAPON_IN_SLOT')(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),slot),
   // CPathFind's area of nodes loaded for the script's cars. The browser keeps every node the paths stream in.
   loadPathNodesInArea:()=>{},
   setLaRiots:active=>{this.laRiots=active;this.world.setLaRiots(active);},
   groundLevel:(x,y,z)=>this.world.groundLevel(x,y,z),
   // CEntity::GetDistanceFromCentreOfMassToBaseOfModel needs the model's own bounds, which the browser only
   // has once the streamer has read it; until then the object sits with its origin on the ground.
   modelBaseOffset:()=>0,
   // The peds a script asks after: the player's handle is answered from the running game, and every other one
   // from the pool the script made it with. A question that needs a ped the browser has not built yet gives
   // that thread up rather than being made up.
   pedExists:handle=>handle===PLAYER_PED_HANDLE||this.peds.exists(handle),
   // GetCharCoordinates gives the vehicle's position while the ped rides in one.
   pedPosition:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.ridingIn(handle)??this.peds.positionOf(handle),
   pedVehicle:handle=>handle===PLAYER_PED_HANDLE?this.playerCarHandle():this.peds.rideOf(handle)?.vehicle,
   // CEntity::m_nAreaCode. A ped a script made belongs to the area it was told to, which is the ordinary
   // world until SET_CHAR_AREA_VISIBLE says otherwise.
   pedAreaCode:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().areaCode:this.world.scriptPedArea(this.livePed(handle)),
   pedHasWeapon:(handle,type)=>handle===PLAYER_PED_HANDLE?this.world.playerPed().weapons.carried.includes(type):this.world.scriptPedWeapon(this.livePed(handle))?.type===type,
   // The one weapon a browser ped carries is its active one; whether it is melee is the catalog's answer.
   pedActiveWeapon:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().weapons.active:this.world.scriptPedActiveWeapon(this.livePed(handle)),
   pedIsShooting:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().shooting:this.world.scriptPedShooting(this.livePed(handle)),
   playerIsTargettingPed:(_player,handle)=>handle!==PLAYER_PED_HANDLE&&this.world.playerMouseTargets(this.livePed(handle)),
   pedIsOnScreen:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().onScreen:this.world.scriptPedOnScreen(this.livePed(handle)),
   pedIsPlayer:handle=>handle===PLAYER_PED_HANDLE,
   // CPed::GiveWeapon and the ammo commands. A browser ped carries the one weapon a script gave it, so the
   // slot search CWeapon does is a single comparison, and choosing a weapon it already holds changes nothing.
   givePedWeapon:(handle,weaponType,ammo)=>{
    if(handle!==PLAYER_PED_HANDLE){this.world.giveScriptPedWeapon(this.livePed(handle),weaponType,ammo);this.peds.setWeapon(handle,weaponType,ammo);return;}
    if(!this.world.givePlayerWeapon)throw new UnsupportedScmCommand(-1,0,'GIVE_WEAPON_TO_CHAR','the player');
    this.world.givePlayerWeapon(weaponType,ammo);
   },
   // REMOVE_WEAPON_FROM_CHAR and REMOVE_ALL_CHAR_WEAPONS: CPed::ClearWeapon and CPed::ClearWeapons.
   removeWeaponFromPed:(handle,weaponType)=>{
    if(!this.world.clearPedWeapon)throw new UnsupportedScmCommand(-1,0,'REMOVE_WEAPON_FROM_CHAR','no host');
    this.world.clearPedWeapon(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),weaponType);
    if(handle!==PLAYER_PED_HANDLE)this.peds.clearWeapon(handle,weaponType);
   },
   removeAllPedWeapons:handle=>{
    if(!this.world.clearPedWeapons)throw new UnsupportedScmCommand(-1,0,'REMOVE_ALL_CHAR_WEAPONS','no host');
    this.world.clearPedWeapons(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle));
    if(handle!==PLAYER_PED_HANDLE)this.peds.clearWeapon(handle);
   },
   setPedCurrentWeapon:(handle,weaponType)=>{if(handle===PLAYER_PED_HANDLE)this.world.setPlayerCurrentWeapon?.(weaponType);},
   setPedAmmo:(handle,weaponType,ammo)=>{
    if(handle===PLAYER_PED_HANDLE){this.host('setPlayerAmmo','SET_CHAR_AMMO')(weaponType,ammo);return;}
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    if(held?.type===weaponType)this.world.setScriptPedAmmo(this.livePed(handle),ammo);
   },
   addAmmoToPed:(handle,weaponType,ammo)=>{
    if(handle===PLAYER_PED_HANDLE){this.host('addPlayerAmmo','ADD_AMMO_TO_CHAR')(weaponType,ammo);return;}
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    if(held?.type===weaponType)this.world.setScriptPedAmmo(this.livePed(handle),held.ammo+ammo);
   },
   // GetAmmoInCharWeapon: the total ammo of the ped's weapon of that type, 0 without one (the player's from his slots).
   pedWeaponAmmo:(handle,weaponType)=>{
    if(handle===PLAYER_PED_HANDLE){const w=this.world.playerPed().weapons;return w.carried.includes(weaponType)?w.ammo?.[weaponType]??0:0;}
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    return held?.type===weaponType?held.ammo:0;
   },
   // CPedIntelligence::ClearTasks, and its immediate form, which the browser cannot tell apart: a ped with no
   // order left goes back to wandering either way, having nothing to finish first.
   clearPedTasks:handle=>{this.clearTasks(handle,'CLEAR_CHAR_TASKS');},
   clearPedTasksImmediately:handle=>{this.clearTasks(handle,'CLEAR_CHAR_TASKS_IMMEDIATELY');},
   // CPedScriptedTaskRecord::GetStatus(ped, opcode): the record's status, or −1 without one, which the command
   // reports as 7 (FINISHED_TASK), the value the missions compare against.
   scriptTaskStatus:(handle,opcode)=>{const record=this.taskRecords.get(handle);return record&&(opcode===-1||record.opcode===opcode)?record.status:FINISHED_TASK;},
   freezePedPosition:(handle,frozen)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerFrozen','FREEZE_CHAR_POSITION')(frozen);else this.world.setScriptPedFrozen(this.livePed(handle),frozen);},
   pedIsInAir:handle=>handle===PLAYER_PED_HANDLE?this.host('playerInAir','IS_CHAR_IN_AIR')():this.world.scriptPedInAir(this.livePed(handle)),
   // m_bIsStaticWaitingForCollision: a script ped made, or frozen by FREEZE_CHAR_POSITION_AND_DONT_LOAD_COLLISION,
   // where its area's collision is not in waits for it. The browser streams collision round the player, so the player
   // never waits.
   pedIsWaitingForCollision:handle=>handle!==PLAYER_PED_HANDLE&&!!this.world.scriptPedWaitingForCollision?.(this.livePed(handle)),
   // m_bIsStaticWaitingForCollision: a mission car stands static until the world's collision is under it.
   vehicleIsWaitingForWorldCollision:handle=>this.world.scriptVehicleWaitingForCollision?.(this.liveVehicle(handle))??false,
   damagePed:(handle,amount,damageArmour)=>{if(handle===PLAYER_PED_HANDLE)this.host('damagePlayer','DAMAGE_CHAR')(amount,damageArmour);else this.world.damageScriptPed(this.livePed(handle),amount);},
   // CPedIntelligence::SetPedDecisionMakerType, and the fields the rest of this batch names.
   // SetCharDecisionMaker (reversed): the ped wears the slot CTheScripts::GetActualScriptThingIndex gives, -1 for none.
   setPedDecisionMaker:(handle,decisionMaker)=>{this.world.setScriptPedDecisionMaker(this.livePed(handle),this.runtime.game.decisionMakers.actualIndex(decisionMaker));},
   seedDecisionMaker:(handle,source)=>{
    const rows=this.decisionsFor(handle);rows.clear();
    const from=source<0?undefined:this.world.defaultDecisionMaker?.(source);
    if(from)for(const [event,choices] of from)rows.set(event,choices.map(choice=>({...choice})));
   },
   setPedMaxHealth:(handle,health)=>{this.peds.setMaxHealth(handle,health);},
   playerCameraState:()=>this.world.playerCameraState(),
   // CPed::SetAreaCode: the ped belongs to that area and is drawn only there.
   setPedAreaVisible:(handle,area)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerArea','SET_CHAR_AREA_VISIBLE')(area);else this.world.setScriptPedArea(this.livePed(handle),area);},
   pedIsPlayingAnim:(handle,animation)=>handle===PLAYER_PED_HANDLE?this.host('playerIsPlayingAnim','IS_CHAR_PLAYING_ANIM')(animation):this.world.scriptPedIsPlayingAnim(this.livePed(handle),animation),
   // WARP_CHAR_FROM_CAR_TO_COORD: CWorld::PutToGroundIfTooLow first, as the teleport does.
   warpPedFromCarToCoord:(handle,x,y,z)=>{
    const ground=z<=-100?this.findGroundZForCoord(x,y):undefined;
    if(handle===PLAYER_PED_HANDLE){if(!this.host('warpPlayerFromCarToCoord','WARP_CHAR_FROM_CAR_TO_COORD')({x,y,z:ground??z}))throw new UnsupportedScmCommand(-1,0,'WARP_CHAR_FROM_CAR_TO_COORD','a player on a bike, boat or plane');return;}
    // A ped in a car is set out of it at the point (CTaskSimpleCarSetPedOut, then the teleport): its seat is freed and
    // it no longer counts as in the car.
    const at={x,y,z:ground??z};
    if(this.peds.rideOf(handle)){this.stopDriving(handle);this.peds.detachFromCar(handle,at);return;}
    this.world.warpScriptPedToCoord(this.livePed(handle),at);
    this.peds.setPosition(handle,at);
   },
   // CTheScripts' elegant removal: a mission ped on foot is handed back to the game rather than taken out of
   // the world. A browser ped a script made is never in a vehicle, so that is the whole of it.
   removePedElegantly:handle=>{this.peds.markNoLongerNeeded(handle);},
   // IS_CHAR_IN_ZONE is CTheZones::FindZone of ZONE_TYPE_NAVI: any navigation zone with that text label, so every
   // part of a zone split in several. It used to take the first zone named so, which missed the parts.
   pedIsInNaviZone:(handle,zoneName)=>{const at=handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.ridingIn(handle)??this.peds.positionOf(handle);return findZone(this.zones,[at.x,at.y,at.z],zoneName,'navi');},
   // IS_PLAYER_IN_INFO_ZONE: FindZone of ZONE_TYPE_INFO at the player, by the zones' own names.
   playerIsInInfoZone:(_player,zoneName)=>{const at=this.world.playerPed().position;return findZone(this.zones,[at.x,at.y,at.z],zoneName,'info');},
   // The CPed bits a script sets by name, and the critical hit it can spare the ped.
   setPedFlag:(handle,flag,value)=>{this.world.setScriptPedFlag(this.livePed(handle),flag,value);},
   setPedSimpleFlag:(handle,flag,value)=>{
    // The player's own: whether he drowns; the group and car flags have nothing on him to act on.
    if(handle===PLAYER_PED_HANDLE){if(flag==='drownsInWater')this.world.setPlayerDrownsInWater?.(value);return;}
    this.world.setScriptPedFlag(this.livePed(handle),flag,value);
    if(flag==='neverLeavesGroup'){if(value)this.neverLeavesGroup.add(handle);else this.neverLeavesGroup.delete(handle);}
   },
   setPedSuffersCriticalHits:(handle,suffers)=>{this.world.setScriptPedCriticalHits(this.livePed(handle),suffers);},
   pedAnimTotalTime:(handle,animation)=>(handle===PLAYER_PED_HANDLE?this.host('playerAnimTotalTime','GET_CHAR_ANIM_TOTAL_TIME')(animation):this.world.scriptPedAnimTotalTime?.(this.livePed(handle),animation))??0,
   setWeekDay:day=>{this.world.setWorldWeekDay?.(day);},
   anyPedsNearPed:(handle,radius)=>{
    const at=handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.positionOf(handle);
    const self=handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle);
    return this.host('anyPedNear','ARE_ANY_CHARS_NEAR_CHAR')(at,radius,self,handle===PLAYER_PED_HANDLE);
   },
   // IsCharDucking (CharacterCommands.cpp:293): CPed::bIsDucking.
   pedIsDucking:handle=>handle===PLAYER_PED_HANDLE?this.host('playerDucking','IS_CHAR_DUCKING')():!!this.world.scriptPedDucking?.(this.livePed(handle)),
   // IsPlayerClimbing (PlayerCommands.cpp:90): a CTaskSimpleClimb in the player's intelligence.
   isPlayerClimbing:()=>this.host('playerClimbing','IS_PLAYER_CLIMBING')(),
   // IsPlayerPressingHorn (PlayerCommands.cpp:172): PEDSTATE_DRIVING and CPad::GetHorn.
   isPlayerPressingHorn:()=>this.host('playerPressingHorn','IS_PLAYER_PRESSING_HORN')(),
   // GetCurrentPopulationZoneType (ZoneCommands.cpp:87): CPopCycle::m_nCurrentZoneType.
   currentPopulationZoneType:()=>this.host('populationZoneType','GET_CURRENT_POPULATION_ZONE_TYPE')(),
   // CTaskComplexProstituteSolicit::GetRidOfPlayerProstitute: the browser has no prostitute's solicit task to end.
   getRidOfPlayerProstitute:()=>{},
   pedAnimProgress:(handle,animation)=>handle===PLAYER_PED_HANDLE?this.host('playerAnimProgress','GET_CHAR_ANIM_CURRENT_TIME')(animation):this.world.scriptPedAnimProgress(this.livePed(handle),animation),
   setPedAnimSpeed:(handle,animation,speed)=>{this.host('setScriptPedAnim','SET_CHAR_ANIM_SPEED')(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),animation,{speed});},
   setPedAnimProgress:(handle,animation,progress)=>{this.host('setScriptPedAnim','SET_CHAR_ANIM_CURRENT_TIME')(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),animation,{progress});},
   // A browser ped a script made never rides, so it sits in no car at all.
   // A ped a script put in a car rides there until something takes it out; nothing else in this browser does.
   // CPedGroups: the groups a script makes, and the membership commands that read and change them.
   createGroup:()=>{const handle=this.nextGroup++;this.groups.set(handle,new NativePedGroup());return handle;},
   removeGroup:group=>{this.groups.get(group)?.flush();if(group!==PLAYER_GROUP_HANDLE)this.groups.delete(group);},
   setGroupLeader:(group,handle)=>{this.group(group).setLeader(handle);},
   setGroupMember:(group,handle)=>{this.group(group).addFollower(handle);},
   setDarknessEffect:(enable,alpha)=>{this.host('setDarknessFilter','SET_DARKNESS_EFFECT')(enable,alpha);},
   setHeatHazeEffect:enable=>{this.host('setHeatHazeFX','SET_HEATHAZE_EFFECT')(enable);},
   setGroupFollowStatus:(group,state)=>{this.group(group).membersEnterLeadersVehicle=state;},
   // CPed's fighting style and allowed moves (the gyms teach the player boxing, kung fu and kickboxing).
   givePedMeleeAttack:(handle,style,moves)=>{this.host('setPedFightingStyle','GIVE_MELEE_ATTACK_TO_CHAR')(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),style,moves);},
   // SetGroupDecisionMakerType: the group's responses to its members' events are not simulated; the type is kept.
   setGroupDecisionMaker:(group,decisionMaker)=>{this.group(group).decisionMaker=decisionMaker;},
   // SetDefaultTaskAllocatorType. For the player's group it decides whether his followers keep with him.
   setGroupDefaultTaskAllocator:(group,type)=>{
    if(!Number.isInteger(type)||type<0||type>4)throw new UnsupportedScmCommand(-1,0,'SET_GROUP_DEFAULT_TASK_ALLOCATOR',`allocator ${type}`);
    this.group(group).defaultTaskAllocator=type;
   },
   pedIsInGroup:(handle,group)=>this.groups.get(group)?.isMember(handle)??false,
   pedIsGroupLeader:(handle,group)=>this.groups.get(group)?.isLeader(handle)??false,
   // GET_NUMBER_OF_FOLLOWERS asks after the group this ped leads.
   pedFollowerCount:handle=>{
    for(const group of this.groups.values())if(group.isLeader(handle))return group.countFollowers();
    return 0;
   },
   // CPedGroupMembership::RemoveMember, which leaves a leader where it is.
   removePedFromGroup:handle=>{for(const group of this.groups.values())if(group.isFollower(handle))group.removeMember(handle);},
   createCharInsideCar:(vehicle,pedType,model,seat)=>this.forCleanup(this.cleanupPeds,this.peds.createInCar(pedType,model,vehicle,seat)),
   createRandomCharInCar:(vehicle,seat)=>this.forCleanup(this.cleanupPeds,this.peds.createRandomInCar(vehicle,seat)),
   // CTaskSimpleCarSetPedInAsDriver after an immediate flush: the ped stops walking and rides.
   warpPedIntoCar:(handle,vehicle)=>{this.warpIntoCar(handle,vehicle,'WARP_CHAR_INTO_CAR');},
   // The passenger seat is the one CREATE_CHAR_AS_PASSENGER takes, from the same operand.
   warpPedIntoCarAsPassenger:(handle,vehicle,seat)=>{this.warpIntoCarAsPassenger(handle,vehicle,seat,'WARP_CHAR_INTO_CAR_AS_PASSENGER');},
   // CTaskSimpleCarSetPedInAsDriver and ...AsPassenger as the ped's primary task: the ped is in at once, so the task
   // is over by the time the script next asks after it.
   taskWarpCharIntoCarAsDriver:(handle,vehicle)=>{this.runners.delete(handle);this.warpIntoCar(handle,vehicle,'TASK_WARP_CHAR_INTO_CAR_AS_DRIVER');},
   taskWarpCharIntoCarAsPassenger:(handle,vehicle,seat)=>{this.runners.delete(handle);this.warpIntoCarAsPassenger(handle,vehicle,seat,'TASK_WARP_CHAR_INTO_CAR_AS_PASSENGER');},
   // CAutomobile::BlowUpCarCutSceneNoExtras: the blow-up without the havoc and property-damage stat an ordinary
   // one counts for the player (which the host's blow-up does not count either).
   // CAutomobile::BlowUpCarCutSceneNoExtras: "without affecting its surroundings" (a molotov's fire, no blast).
   explodeVehicleInCutscene:handle=>{const car=this.liveVehicle(handle);if(this.world.explodeScriptVehicleInCutscene)this.world.explodeScriptVehicleInCutscene(car,{shake:true,bits:true,explosion:true,sound:true});else this.world.explodeScriptVehicle(car);},
   explodeCarInCutsceneShakeAndBits:(handle,shake,effect,sound)=>{const car=this.liveVehicle(handle);if(this.world.explodeScriptVehicleInCutscene)this.world.explodeScriptVehicleInCutscene(car,{shake,bits:effect,explosion:effect,sound});else this.world.explodeScriptVehicle(car);},
   // CPed::AttachPedToEntity and DettachPedFromEntity. The angle limit and the weapon belong to a ped that can
   // aim from where it hangs, which this browser's riders do not do yet, so they are not taken.
   // ATTACH_CHAR_TO_CAR on the player: CPed::AttachPedToEntity's player branch (the host pins him, turns him to his
   // aim within the limit and swaps his weapon); a script ped rides the car at the offset.
   attachPedToCar:(handle,vehicle,offset,position,angleLimit,weapon)=>{
    if(handle===PLAYER_PED_HANDLE){this.host('attachPlayerToVehicle','ATTACH_CHAR_TO_CAR')(this.liveVehicle(vehicle),offset,position,angleLimit,weapon);return;}
    this.peds.attachToCar(handle,vehicle,offset);
   },
   // SET_HEADING_FOR_ATTACHED_PLAYER: a player not attached to anything is left alone.
   setHeadingForAttachedPlayer:(_player,heading,range)=>{this.world.setAttachedPlayerHeading?.(heading,range);},
   // ATTACH_CHAR_TO_OBJECT: the player's attachment to a script object; a script ped's is not ported yet.
   attachPedToObject:(handle,object,offset,position,angleLimit,weapon)=>{
    this.runtime.game.objects.at(object);
    if(handle!==PLAYER_PED_HANDLE)throw new UnsupportedScmCommand(-1,0,'ATTACH_CHAR_TO_OBJECT','a script ped');
    this.host('attachPlayerToObject','ATTACH_CHAR_TO_OBJECT')(object,offset,position,angleLimit,weapon);
   },
   // DetachCharFromCar: only a ped that hangs from something is let go.
   detachPedFromCar:handle=>{if(handle===PLAYER_PED_HANDLE){this.world.detachPlayerFromVehicle?.();return;}this.peds.detachFromCar(handle,this.peds.positionOf(handle));},
   // CPed::m_pAttachedTo is a vehicle: ATTACH_CHAR_TO_CAR's hold, not a seat. The reversed handler tests the ped
   // itself for being a vehicle, which never holds; its sibling STORE_CAR_CHAR_IS_ATTACHED_TO_NO_SAVE reads
   // m_pAttachedTo, which is what LOWR and SWEET6 ask about before they detach.
   isCharAttachedToAnyCar:handle=>handle===PLAYER_PED_HANDLE?this.world.playerAttachedVehicle?.()!==undefined:!!this.peds.rideOf(handle)?.offset,
   carCharIsAttachedTo:handle=>{if(handle===PLAYER_PED_HANDLE)return -1;const ride=this.peds.rideOf(handle);return ride?.offset?ride.vehicle:-1;},
   // CMenuManager::m_bLanguageChanged: only the menu's language option sets it, and the language here stays American.
   // SET_CHAR_VELOCITY: the player's; a script ped's walk has no free velocity to take one yet.
   setPedVelocity:(handle,velocity)=>{
    if(handle!==PLAYER_PED_HANDLE){this.livePed(handle);throw new UnsupportedScmCommand(-1,0,'SET_CHAR_VELOCITY','a script ped');}
    this.host('setPlayerVelocity','SET_CHAR_VELOCITY')(velocity);
   },
   // A ped in a car sits where the car puts it, so only one on foot is turned.
   setPedRotation:(handle,x,y,z)=>{
    requireAsset([x,y,z].every(Number.isFinite),'Invalid ped rotation.');
    if(handle===PLAYER_PED_HANDLE){if(!this.world.playerPed().vehicle)this.host('setPlayerRotation','SET_CHAR_ROTATION')(x,y,z);return;}
    const ped=this.livePed(handle);
    if(this.peds.rideOf(handle)===undefined)this.host('setScriptPedRotation','SET_CHAR_ROTATION')(ped,x,y,z);
   },
   hasLanguageChanged:()=>false,
   // IS_GERMAN_GAME: these are the English-language data files, not the German release's.
   gameIsGerman:()=>false,
   setPedUsesUpperbodyDamageAnimsOnly:(handle,state)=>{this.world.setScriptPedFlag(this.livePed(handle),'upperBodyDamageAnimsOnly',state);},
   setPedKindaStayInSamePlace:(handle,state)=>{this.world.setScriptPedFlag(this.livePed(handle),'kindaStayInSamePlace',state);},
   // CPed::bIsTalking and the facial talk. The depot has no speech banks, so these hold what the script said
   // and nothing speaks; the thread carries on rather than stopping on a question nothing here answers.
   // The player's own speech lines are not played, so shutting him up, or his face talking, has nothing to act on.
   shutPedUpForScriptedSpeech:(handle,enabled)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),enabled);},
   // SHUT_CHAR_UP, DISABLE_CHAR_SPEECH and ENABLE_CHAR_SPEECH (reversed): CPed::DisablePedSpeech and EnablePedSpeech.
   // The browser keeps one speech switch per ped, which the scripted-speech command sets too. The player has no
   // speech bank here, so his is nothing to switch.
   setPedSpeechDisabled:(handle,disabled)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),disabled);},
   disablePedSpeech:handle=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),true);},
   enablePedSpeech:handle=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),false);},
   // GET_CAR_CHAR_IS_USING (reversed): the car the ped sits in, else the one it is entering; none is -1. The
   // browser does not hand the script the car the player is walking to.
   // IS_CHAR_TALKING (unreversed; CPed::GetPedTalking): the browser plays no speech lines for a script's peds, the
   // speech banks not being published, so none of them is ever mid-line.
   pedIsTalking:()=>false,
   // IS_CAR_PASSENGER_SEAT_FREE: no script ped sits in that seat of the script's car.
   vehiclePassengerSeatIsFree:(handle,seat)=>!this.peds.seatTaken(handle,seat),
   // CVehicle::m_apPassengers[seat] (GET_CHAR_IN_CAR_PASSENGER_SEAT, reversed): the ped there. The original reads an
   // empty seat's null pointer; the scripts ask IS_CAR_PASSENGER_SEAT_FREE first, and an empty seat reads -1 here.
   pedInPassengerSeat:(handle,seat)=>this.peds.occupantOf(handle,seat)??-1,
   // CWorld::GetIsLineOfSightClear(from, to, buildings, vehicles, peds, objects, dummies): dummies and the see-through
   // flag have no bodies to test here.
   lineOfSightIsClear:(from,to,flags)=>this.world.lineOfSightClear(from,to,flags),
   // CWorld::FindObjectsIntersectingCube over the lists the flags name, the corners sorted first.
   // The vehicle pool walked for CVehicle::IsLawEnforcementVehicle's models less the Predator (430), each axis of the
   // box put in order first.
   copVehicleInArea3d:(a,b)=>this.host('vehicleOfModelsInBox','IS_COP_VEHICLE_IN_AREA_3D_NO_SAVE')(COP_VEHICLE_MODELS,
    {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),z:Math.min(a.z,b.z)},{x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),z:Math.max(a.z,b.z)}),
   areaIsOccupied:(a,b,flags)=>this.host('areaOccupied','IS_AREA_OCCUPIED')(
    {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),z:Math.min(a.z,b.z)},{x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),z:Math.max(a.z,b.z)},
    {buildings:flags.solid,vehicles:flags.vehicles,peds:flags.peds,objects:flags.objects,dummies:flags.particles}),
   // CPedGroups::ms_activeGroups: the groups made and not removed, the player's always among them.
   groupExists:group=>this.groups.has(group),
   // CVehicle::m_nVehicleFlags.bEngineOn.
   setVehicleEngineOn:(handle,state)=>{const car=this.liveVehicle(handle) as {engineRunning?:boolean};if('engineRunning' in car)car.engineRunning=state;},
   setVehicleEngineBroken:(handle,state)=>{const car=this.liveVehicle(handle) as {engineBroken?:boolean;engineRunning?:boolean};if('engineBroken' in car){car.engineBroken=state;if(state)car.engineRunning=false;}},
   pedCarInUse:handle=>handle===PLAYER_PED_HANDLE?this.playerCarHandle()??-1:this.peds.rideOf(handle)?.vehicle??-1,
   isSphereVisible:(point,radius)=>{if(!this.world.isSphereVisible)throw new UnsupportedScmCommand(-1,0,'IS_POINT_ON_SCREEN','no camera');return this.world.isSphereVisible(point,radius);},
   startPedFacialTalk:(handle,duration)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFacialTalk(this.livePed(handle),duration/1000);},
   stopPedFacialTalk:handle=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFacialTalk(this.livePed(handle),undefined);},
   hidePedWeaponForScriptedCutscene:(handle,state)=>{if(handle===PLAYER_PED_HANDLE)this.host('hidePlayerWeapon','HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE')(state);else this.world.hideScriptPedWeapon(this.livePed(handle),state);},
   addExplosion:(x,y,z,type)=>{this.world.addExplosion({x,y,z},type);},
   setVehicleCanBurstTyres:(handle,state)=>{this.world.setScriptVehicleCanBurstTyres(this.liveVehicle(handle),state);},
   setVehicleHeavy:(handle,state)=>{this.world.setScriptVehicleHeavy?.(this.liveVehicle(handle),state);},
   // CLocalisation::Metric() is m_nPrefsLanguage != AMERICAN; the port reads american.gxt, so feet. The conversion's
   // factor is in the unreversed handler; 3.28 is the documented opcode's (authored).
   measurementsAreInMetres:()=>false,
   convertMetresToFeet:metres=>Math.fround(metres*3.28),
   convertMetresToFeetInt:metres=>Math.trunc(metres*3.28),
   setVehicleOnlyDamagedByPlayer:(handle,state)=>{this.world.setScriptVehicleOnlyDamagedByPlayer(this.liveVehicle(handle),state);},
   projectileIsInArea:(min,max)=>this.world.projectilesInBox(min,max,false),
   vehicleCanBeTargettedByHomingMissile:(handle,state)=>{this.world.setScriptVehicleHeatSeekTargetable(this.liveVehicle(handle),state);},
   changeVehicleColour:(handle,colour1,colour2)=>{this.world.recolourScriptVehicle(this.liveVehicle(handle),colour1,colour2);},
   setAllPedSpeechDisabled:disabled=>{this.world.setAllPedSpeechDisabled(disabled);},
   // CHudColours' own table, which CRadar reads the same way for its blips.
   hudColour:colour=>{
    const rgb=HUD_COLOURS[colour];
    if(!rgb)throw new UnsupportedScmCommand(-1,0,'A_HUD_COLOUR_THE_TABLE_DOES_NOT_CARRY',`colour ${colour}`);
    return {red:rgb[0],green:rgb[1],blue:rgb[2],alpha:255};
   },
   isMessageBeingDisplayed:()=>this.world.messageShowing(),
   isHelpMessageBeingDisplayed:()=>this.world.helpMessageShowing(),
   isThisHelpMessageBeingDisplayed:key=>this.host('helpMessageShowingKey','IS_THIS_HELP_MESSAGE_BEING_DISPLAYED')(key),
   // Where the camera is and what it looks along, which is the browser's own camera whether the script has
   // taken it over or not, and the mode and field of view it is running with.
   // CCamera::SetCameraDirectlyInFrontForFollowPed_CamOnAString, the other side of the behind command.
   setCameraInFrontOfPlayer:()=>{this.world.setCameraInFrontOfPlayer();},
   activeCameraSource:()=>this.world.cameraSource(),
   activeCameraFront:()=>this.world.cameraFront(),
   activeCameraFov:()=>this.world.cameraFov(),
   activeCameraMode:()=>this.runtime.game.camera.modeToGoTo,
   // The debug camera is the same camera here: this browser has no separate one to ask.
   debugCameraSource:()=>this.world.cameraSource(),
   debugCameraFront:()=>this.world.cameraFront(),
   // ADD_CHAR_DECISION_MAKER_EVENT_RESPONSE and its group form write one of the six choices a decision file
   // holds for an event; the clearing forms empty that event's row.
   addPedDecisionMakerEventResponse:(decisionMaker,event,taskId,chances,inCar,onFoot)=>{
    this.addDecision(decisionMaker,event,taskId,chances,inCar,onFoot);
   },
   addGroupDecisionMakerEventResponse:(decisionMaker,event,taskId,chances,inCar,onFoot)=>{
    this.addDecision(decisionMaker,event,taskId,chances,inCar,onFoot);
   },
   clearPedDecisionMakerEventResponse:(decisionMaker,event)=>{this.decisionsFor(decisionMaker).delete(event);},
   clearGroupDecisionMakerEventResponse:(decisionMaker,event)=>{this.decisionsFor(decisionMaker).delete(event);},
   // CObject's own fields, which the runtime keeps, and the two questions only the world can answer.
   objectHealth:handle=>this.runtime.game.objects.at(handle).health,
   setObjectHealth:(handle,health)=>{this.runtime.game.objects.setHealth(handle,health);},
   // The handler is unreversed; off the water nothing writes its height, which reads here as 0.
   waterHeightAtCoords:(x,y,waves)=>this.host('waterLevelAt','GET_WATER_HEIGHT_AT_COORDS')(x,y,waves)??0,
   addToObjectVelocity:(handle,x,y,z)=>{this.runtime.game.objects.addToVelocity(handle,{x,y,z});},
   setObjectRotationVelocity:(handle,x,y,z)=>{this.runtime.game.objects.setTurnSpeed(handle,{x,y,z});},
   addToObjectRotationVelocity:(handle,x,y,z)=>{this.runtime.game.objects.addToTurnSpeed(handle,{x,y,z});},
   getObjectRotationVelocity:handle=>this.runtime.game.objects.getTurnSpeed(handle),
   addVelocityRelativeToObjectVelocity:(handle,x,y,z)=>{this.runtime.game.objects.addVelocityRelativeToVelocity(handle,{x,y,z});},
   breakObject:(handle,intensity)=>{this.runtime.game.objects.breakObject(handle,intensity!==0);},
   // IS_CHAR_TOUCHING_OBJECT, _VEHICLE and _CHAR: GetPedOrItsVehicle(ped)->GetHasCollidedWith(other), the other ped
   // also by its vehicle when it sits in one; IS_VEHICLE_TOUCHING_OBJECT and IS_CAR_TOUCHING_CAR ask the car's.
   pedIsTouching:(handle,other)=>{
    const self=this.touchEntityOfPed(handle);
    const target:ScmTouchEntity=other.kind==='ped'?this.touchEntityOfPed(other.handle):other.kind==='vehicle'?{kind:'vehicle',entity:this.liveVehicle(other.handle)}:(this.runtime.game.objects.at(other.handle),{kind:'object',handle:other.handle});
    return this.host('scriptEntitiesTouching','IS_CHAR_TOUCHING')(self,target);
   },
   vehicleIsTouchingObject:(handle,object)=>{this.runtime.game.objects.at(object);return this.host('scriptEntitiesTouching','IS_VEHICLE_TOUCHING_OBJECT')({kind:'vehicle',entity:this.liveVehicle(handle)},{kind:'object',handle:object});},
   isCarTouchingCar:(handle,other)=>this.host('scriptEntitiesTouching','IS_CAR_TOUCHING_CAR')({kind:'vehicle',entity:this.liveVehicle(handle)},{kind:'vehicle',entity:this.liveVehicle(other)}),
   // SET_OBJECT_RECORDS_COLLISIONS: physicalFlags.bCanBeCollidedWith, without which AddCollisionRecord keeps nothing and
   // HAS_OBJECT_COLLIDED_WITH_ANYTHING never holds.
   setObjectRecordsCollisions:(handle,state)=>{this.runtime.game.objects.at(handle).recordsCollisions=state;},
   objectHasCollidedWithAnything:handle=>!!this.runtime.game.objects.at(handle).recordsCollisions&&this.host('scriptObjectTouchingAnything','HAS_OBJECT_COLLIDED_WITH_ANYTHING')(handle),
   // PLAY_OBJECT_ANIM: the association goes on at once, and its length follows once the host has read the clip from
   // the block (which the script has loaded before it plays).
   playObjectAnim:(handle,name,block,blendDelta,lockF,loop)=>{
    const objects=this.runtime.game.objects;objects.playAnim(handle,name,block,blendDelta,lockF,loop);
    const anim=objects.at(handle).anim;
    if(anim&&anim.length===undefined)void this.world.scriptObjectAnimLength?.(block,name).then(length=>{if(length!==undefined&&objects.exists(handle))objects.setAnimLength(handle,name,length);});
   },
   objectIsPlayingAnim:(handle,name)=>this.runtime.game.objects.isPlayingAnim(handle,name),
   setObjectAnimSpeed:(handle,name,speed)=>{this.runtime.game.objects.setAnimSpeed(handle,name,speed);},
   setObjectAnimProgress:(handle,name,progress)=>{this.runtime.game.objects.setAnimProgress(handle,name,progress);},
   objectAnimProgress:(handle,name)=>this.runtime.game.objects.animProgress(handle,name),
   objectHasBeenDamaged:handle=>this.runtime.game.objects.hasBeenDamaged(handle),
   // CTaskSimpleHoldEntity::DropEntity with the operand as its second argument, and the held entity against the object.
   setPedDropsObject:(handle,quietly)=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);this.dropHeldObject(handle,quietly);},
   // SLIDE_OBJECT's collision check (Vice City's handler, the move undone when the object meets something): whether the
   // object at the next point would overlap a movable thing, the player, a ped or a vehicle.
   objectBlockedAt:(handle,position)=>{const object=this.runtime.game.objects.at(handle);return object.usesCollision&&!!this.world.scriptObjectBlockedAt?.(handle,object.position,position);},
   // The carry clips (carry.ifp) are streamed in with the first stealable object, as the hold task needs them at once.
   setObjectAsStealable:(handle,state)=>{this.runtime.game.objects.at(handle).stealable=state;if(state)this.world.preloadAnimationBlock?.('CARRY');},
   // CEventGlobalGroup::GetSoundLevel (reversed) over the last frame's quiet sounds: every source's for -1, else the
   // ped's own (only CJ's footsteps are reported yet).
   getSoundLevelAtCoords:(handle,x,y,z)=>globalSoundLevel(this.soundEvents,handle===-1?undefined:handle===PLAYER_PED_HANDLE?'player':this.livePed(handle),{x,y,z}),
   pedIsHoldingObject:(handle,object)=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);return this.heldObjectOf(handle)?.handle===object||this.heldObjectOf(handle,true)?.handle===object;},
   // TASK_PICK_UP_SECOND_OBJECT and DROP_SECOND_OBJECT: CTaskSimpleHoldEntity on the ped's second partial slot, so a
   // ped holds one object with each (the gym's two dumbbells).
   taskPickUpSecondObject:(handle,task)=>{this.pickUpObject(handle,task,true);},
   setPedDropsSecondObject:(handle,quietly)=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);this.dropHeldObject(handle,quietly,true);},
   // SetCharAnimPlayingFlag (CharacterCommands.cpp:2864): ANIMATION_IS_PLAYING on the named clip. A stopped clip holds
   // its frame; one started again runs at the usual rate (the rate it had before is not kept here).
   setPedAnimPlayingFlag:(handle,animation,playing)=>{this.host('setScriptPedAnim','SET_CHAR_ANIM_PLAYING_FLAG')(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),animation,{speed:playing?1:0});},
   // bDoesntListenToPlayerGroupCommands, which the group command events read of each member: the player, who gives
   // the commands, keeps it without effect.
   setPedListensToPlayerGroupCommands:(handle,listens)=>{if(handle===PLAYER_PED_HANDLE){this.playerListensToGroupCommands=listens;return;}this.world.setScriptPedListensToGroupCommands?.(this.livePed(handle),listens);},
   // CPed::bSignalAfterKill (true from the constructor): kept for the kill task's after-kill signal, not ported.
   pedSignalAfterKill:(handle,signal)=>{this.livePed(handle);this.signalAfterKill.set(handle,signal);},
   // bHeadStuckInCollision's head loss: the browser never takes a ped's head, so none is missing.
   pedHeadIsMissing:handle=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);return false;},
   enableEntryExitPlayerGroupWarping:(x,y,radius,on)=>{this.world.setEntryExitGroupWarping?.(x,y,radius,on);},
   // CInteriorManager_c::ActivatePeds: kept; the browser makes no interior peds of its own yet.
   activateInteriorPeds:on=>{this.runtime.game.interiorPedsActive=on;},
   // CPed::Say: the speech banks and CAEPedSpeechAudioEntity's contexts are not ported, so nothing is said and the
   // sound comes back as -1.
   pedSayContext:handle=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);return -1;},
   pedSayContextImportant:handle=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);return -1;},
   // AddScriptSayEvent plays the line from the scripted speech banks (GetSoundAndBankIDsForScriptedSpeech), which are
   // in AUDIO/SFX and not published: the casino's dealers deal on without their lines.
   pedSayScript:handle=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);},
   isPlayerInPositionForConversation:handle=>{this.livePed(handle);return this.playerInPositionForConversation(handle);},
   // FxSystem_c::AttachToBone: the system follows the bone (a bone tag) from here.
   attachFxSystemToPedBone:(fx,handle,bone)=>{
    const record=this.scriptFx.get(fx);if(!record)throw new UnsupportedScmCommand(-1,0,'AN_FX_SYSTEM_THE_BROWSER_DOES_NOT_HOLD',`fx ${fx}`);
    if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);
    record.attached={kind:'ped',handle,offset:{x:0,y:0,z:0},bone};
   },
   objectLastWeaponDamage:handle=>this.runtime.game.objects.at(handle).lastWeaponDamage,
   // CWorld::FindNearestObjectOfType over every object: the script's own and the map's props. Smashed is a hidden
   // object (bIsVisible off), damaged one showing its damaged model (m_bRenderDamaged).
   closestObjectOfTypeIsSmashedOrDamaged:(x,y,z,radius,model,smashed,damaged)=>{
    let best:{distance:number;smashed:boolean;damaged:boolean}|undefined;
    for(const object of this.runtime.game.objects.all){
     if(object.model!==model)continue;
     const distance=Math.hypot(object.position.x-x,object.position.y-y,object.position.z-z);
     if(distance<radius&&(!best||distance<best.distance))best={distance,smashed:!object.visible,damaged:object.renderDamaged};
    }
    const prop=this.world.closestWorldObjectOfType?.({x,y,z},radius,model);
    if(prop&&(!best||prop.distance<best.distance))best=prop;
    return !!best&&(smashed&&best.smashed||damaged&&best.damaged);
   },
   clearObjectLastWeaponDamage:handle=>{this.runtime.game.objects.clearLastWeaponDamage(handle);},
   // objectFlags.bIsTargetable; CPlayerPed::FindWeaponLockOnTarget's object pass reads it through the host.
   makeObjectTargettable:(handle,targetable)=>{this.runtime.game.objects.at(handle).targetable=targetable;},
   setObjectOnlyDamagedByPlayer:(handle,only)=>{this.runtime.game.objects.at(handle).onlyDamagedByPlayer=only;},
   // The object handler is unreversed; like the ped's, the flag is taken as it is read (reVC does the same).
   hasObjectBeenPhotographed:handle=>{const o=this.runtime.game.objects.at(handle),was=!!o.photographed;o.photographed=false;return was;},
   objectSpeed:handle=>this.runtime.game.objects.speed(handle),
   objectIsStatic:handle=>this.runtime.game.objects.at(handle).isStatic,
   getObjectQuaternion:handle=>this.runtime.game.objects.getQuaternion(handle),
   setObjectQuaternion:(handle,x,y,z,w)=>{this.runtime.game.objects.setQuaternion(handle,{x,y,z,w});},
   isObjectInArea3d:(handle,ax,ay,az,bx,by,bz)=>this.runtime.game.objects.isInArea3d(handle,{x:ax,y:ay,z:az},{x:bx,y:by,z:bz}),
   setObjectMass:(handle,mass)=>{this.runtime.game.objects.setMass(handle,mass);},
   setObjectTurnMass:(handle,turnMass)=>{this.runtime.game.objects.setTurnMass(handle,turnMass);},
   // CWorld::FindMissionEntitiesIntersectingCube over the box the radii span: a mission car, a mission ped or a mission
   // object whose position is inside it (edges included), found through the sectors the box covers.
   pointIsObscuredByMissionEntity:(x,y,z,rx,ry,rz)=>{
    const within=(p:{x:number;y:number;z:number})=>insideMissionCube(x,y,z,rx,ry,rz,p);
    for(const handle of this.vehicles.handles)if(this.vehicles.exists(handle)&&within(this.vehicles.positionOf(handle)))return true;
    for(const handle of this.peds.handles)if(this.peds.exists(handle)&&within(this.ridingIn(handle)??this.peds.positionOf(handle)))return true;
    return this.runtime.game.objects.all.some(o=>isMissionObjectType(o.objectType)&&within(o.position));
   },
   setObjectVisible:(handle,state)=>{this.runtime.game.objects.at(handle).visible=state;},
   // CEntity::GetIsOnScreen and physicalFlags.bSubmergedInWater, asked of where the object stands.
   objectIsOnScreen:handle=>this.world.pointOnScreen(this.runtime.game.objects.at(handle).position,1),
   objectIsInWater:handle=>this.world.pointUnderWater(this.runtime.game.objects.at(handle).position),
   // CEntity's attachment: the object hangs from a car, a ped or another object at an offset in that entity's
   // own axes, and stays where it had got to when it is let go.
   attachObjectToVehicle:(object,vehicle,offset,rotation)=>{this.runtime.game.objects.attach(object,'vehicle',vehicle,offset,rotation);},
   attachObjectToChar:(object,ped,x,y,z,rx,ry,rz)=>{this.runtime.game.objects.attach(object,'ped',ped,{x,y,z},{x:rx,y:ry,z:rz});},
   attachObjectToObject:(object,other,offset,rotation)=>{this.runtime.game.objects.attach(object,'object',other,offset,rotation);},
   // The push DETACH_OBJECT gives the object needs physics this browser does not run for a script's objects,
   // so the object is let go where it hangs and does not fly.
   detachObject:handle=>{this.runtime.game.objects.detach(handle);},
   objectIsAttached:handle=>this.runtime.game.objects.isAttached(handle),
   // Fx_c's systems, by the handle the script holds them with.
   createFxSystem:(name,x,y,z,ignoreBoundingChecks)=>this.makeFx(name,{x,y,z},ignoreBoundingChecks),
   createFxSystemOnPed:(name,handle,offset,ignoreBoundingChecks)=>this.makeAttachedFx(name,'ped',handle,offset,undefined,ignoreBoundingChecks),
   createFxSystemOnObject:(name,object,offset,ignoreBoundingChecks)=>this.makeAttachedFx(name,'object',object,offset,undefined,ignoreBoundingChecks),
   createFxSystemOnCar:(name,vehicle,x,y,z,ignoreBoundingChecks)=>this.makeAttachedFx(name,'vehicle',vehicle,{x,y,z},undefined,ignoreBoundingChecks),
   createFxSystemOnVehicleWithDirection:(name,vehicle,offset,direction,ignoreBoundingChecks)=>this.makeAttachedFx(name,'vehicle',vehicle,offset,direction,ignoreBoundingChecks),
   createFxSystemOnCharWithDirection:(name,char,x,y,z,dx,dy,dz,ignoreBoundingChecks)=>this.makeAttachedFx(name,'ped',char,{x,y,z},{x:dx,y:dy,z:dz},ignoreBoundingChecks),
   playFxSystem:handle=>{this.world.playScriptFx(this.fxOf(handle),false);},
   playAndKillFxSystem:handle=>{this.world.playScriptFx(this.fxOf(handle),true);},
   stopFxSystem:handle=>{this.world.stopScriptFx(this.fxOf(handle));},
   // A handle that names no system (a shop script kills the one it may never have made) is left alone, as
   // GetActualScriptThingIndex answers -1 for it.
   killFxSystem:handle=>{if(!this.scriptFx.has(handle))return;this.world.killScriptFx(this.fxOf(handle));this.scriptFx.delete(handle);},
   killFxSystemNow:handle=>{if(!this.scriptFx.has(handle))return;this.world.killScriptFx(this.fxOf(handle));this.scriptFx.delete(handle);},
   // CWorld::FindGroundZFor3DCoord looks down from the point itself rather than from a thousand above, and answers
   // 0 where it meets nothing.
   groundZFor3DCoord:(x,y,z)=>this.world.groundLevel(x,y,z)??0,
   // CREATE_RANDOM_CHAR: the game picks the model, which is the one the zone's own roster would have used.
   createRandomChar:(x,y,z)=>{
    const model=this.world.randomCivilianModel();
    if(model===undefined)throw new UnsupportedScmCommand(-1,0,'A_RANDOM_PED_THE_ZONE_CANNOT_YET_SUPPLY','');
    return this.forCleanup(this.cleanupPeds,this.peds.create(PED_TYPE_CIVMALE,model,{x,y,z}));
   },
   // The freeze that also waits for collision: a ped the browser built stands on ground it has already
   // loaded, so there is nothing to wait for and it is the plain freeze.
   freezePedPositionAndWaitForCollision:(handle,freeze,missionCleanup)=>{const ped=this.livePed(handle);this.world.setScriptPedFrozen(ped,freeze);if(freeze&&missionCleanup)this.world.scriptPedWaitForCollision?.(ped);},
   setPedCanBeShotInVehicle:(handle,canBeShot)=>{this.world.setScriptPedFlag(this.livePed(handle),'canBeShotInVehicle',canBeShot);},
   // The player's bDontDragMeOutCar is kept here: nothing in the browser drags the player out yet.
   setPedCantBeDraggedOut:(handle,cannot)=>{if(handle===PLAYER_PED_HANDLE)this.playerCantBeDraggedOut=cannot;else this.world.setScriptPedFlag(this.livePed(handle),'cantBeDraggedOut',cannot);},
   setPedLoadsCollision:(handle,loads)=>{this.world.setScriptPedFlag(this.livePed(handle),'loadsCollision',loads);},
   // bDeathPickupsPersist: CreateDeadPedWeaponPickups makes PICKUP_ONCE_FOR_MISSION pickups, which never time out.
   setPedDeathWeaponsPersist:(handle,persist)=>{this.world.setScriptPedFlag(this.livePed(handle),'deathPickupsPersist',persist);},
   updatePickupMoneyPerDay:(handle,money)=>{const pickup=this.runtime.game.pickups.at(handle);if(!pickup)return;pickup.moneyPerDay=money;this.world.setScriptPickupMoneyPerDay?.(handle,money);},
   setPedInformRespectedFriends:(handle,radius)=>{this.world.setScriptPedRange(this.livePed(handle),'informFriends',radius);},
   setPedFollowNodeThresholdDistance:(handle,range)=>{this.world.setScriptPedRange(this.livePed(handle),'followNodeThreshold',range);},
   setPedSenseRange:(handle,range)=>{this.world.setScriptPedRange(this.livePed(handle),'sense',range);},
   // CPed::m_pLastEntityDamage named back in the script's own handles: the player's ped, a ped the script made
   // or a car it made. Something the script never made has no handle to give, so it names nothing.
   pedLastDamagedBy:handle=>{
    const last=this.world.scriptPedLastDamagedBy(this.livePed(handle));
    if(!last)return undefined;
    if(last.player)return {ped:PLAYER_PED_HANDLE};
    const ped=last.ped===undefined?undefined:this.peds.handleOf(last.ped);
    const vehicle=last.car===undefined?undefined:this.vehicles.handleOf(last.car);
    return ped===undefined&&vehicle===undefined?undefined:{ped,vehicle};
   },
   // HAS_CAR_BEEN_DAMAGED_BY_CHAR: the car's m_pLastDamageEntity is the ped, or the vehicle the ped is in.
   vehicleWasDamagedByPed:(handle,ped)=>{
    const last=this.host('scriptVehicleLastDamagedBy','HAS_CAR_BEEN_DAMAGED_BY_CHAR')(this.liveVehicle(handle));
    if(!last)return false;
    if(ped===PLAYER_PED_HANDLE?last.player:last.ped!==undefined&&last.ped===this.livePed(ped))return true;
    const ride=ped===PLAYER_PED_HANDLE?this.playerCarHandle():this.peds.rideOf(ped)?.vehicle;
    return ride!==undefined&&last.car!==undefined&&last.car===this.vehicleByHandle(ride);
   },
   vehicleMaximumPassengers:handle=>this.host('scriptVehicleMaximumPassengers','GET_MAXIMUM_NUMBER_OF_PASSENGERS')(this.liveVehicle(handle)),
   // CVehicle::m_nNumPassengers: the script's peds in the car's passenger seats.
   vehiclePassengerCount:handle=>this.peds.passengersOf(handle),
   // The script's 0 to 3 are eCarWheel (front left, rear left, front right, rear right), which BurstTyre passes through.
   // The CAutomobile component commands: CAutomobile::PopDoor, PopPanel, PopBoot, FixDoor, FixPanel, FixTyre, and
   // the damage and state questions. A car that is not a CAutomobile gives no answer and takes no change.
   popVehicleDoor:(handle,door,visible)=>{this.carComponents(handle)?.popDoor(door,visible);},
   // SET_VEHICLE_AIR_RESISTANCE_MULTIPLIER: only an automobile runs CPhysical::ApplyAirResistance here.
   setVehicleAirResistanceMultiplier:(handle,multiplier)=>{this.world.setScriptVehicleAirResistance?.(this.liveVehicle(handle),multiplier);},
   // CModelInfo::IsCarModel, IsBoatModel, IsHeliModel and IsPlaneModel: the model info's vehicle type, exactly (a
   // monster truck or quad is no car); anything that is no vehicle model is none of them.
   isThisModelACar:model=>this.vehicleModelType(model,'IS_THIS_MODEL_A_CAR')==='car',
   modelIsBoat:model=>this.vehicleModelType(model,'IS_THIS_MODEL_A_BOAT')==='boat',
   modelIsHeli:model=>this.vehicleModelType(model,'IS_THIS_MODEL_A_HELI')==='heli',
   modelIsPlane:model=>this.vehicleModelType(model,'IS_THIS_MODEL_A_PLANE')==='plane',
   // vehicleFlags.bIsDamaged: only an automobile shows damaged components here.
   vehicleIsVisiblyDamaged:handle=>this.world.scriptVehicleVisiblyDamaged?.(this.liveVehicle(handle))??false,
   applyForceToVehicle:(handle,force,offset)=>{
    if(!this.host('applyScriptVehicleForce','APPLY_FORCE_TO_CAR')(this.liveVehicle(handle),force,offset))throw new UnsupportedScmCommand(-1,0,'APPLY_FORCE_TO_CAR','a bike, boat or aircraft');
   },
   setVehicleWatertight:(handle,state)=>{this.host('setScriptVehicleWatertight','SET_CAR_WATERTIGHT')(this.liveVehicle(handle),state);},
   // GET_MODEL_DIMENSIONS: the model's CColModel bounding box. A vehicle's is read from its collision (the thread waits
   // the frames the model takes to load); an object's is not held here yet.
   modelDimensions:model=>{
    let bounds=typeof model==='number'?this.host('vehicleModelBounds','GET_MODEL_DIMENSIONS')(model):null;
    // An object model's box comes from its COL, read on the first request.
    if(bounds===null&&this.world.objectModelBounds)bounds=this.world.objectModelBounds(model);
    if(bounds===undefined)throw new ScmEntityPending(`model ${model}`);
    if(bounds===null)throw new UnsupportedScmCommand(-1,0,'GET_MODEL_DIMENSIONS',`an object model (${model})`);
    return bounds;
   },
   // SORT_OUT_OBJECT_COLLISION_WITH_CAR (RYDER2's crates put in the van): the object ignores the car until they part.
   sortOutObjectCollisionWithVehicle:(object,vehicle)=>{
    this.runtime.game.objects.at(object);
    const done=this.host('sortOutScriptObjectCollisionWithCar','SORT_OUT_OBJECT_COLLISION_WITH_CAR')(object,this.liveVehicle(vehicle));
    if(done===undefined)throw new ScmEntityPending(`object ${object}`);
    if(!done)throw new UnsupportedScmCommand(-1,0,'SORT_OUT_OBJECT_COLLISION_WITH_CAR','a bike, boat or aircraft');
   },
   // IS_CHAR_GETTING_IN_TO_A_CAR: one of the entering tasks is active (CharacterCommands' handler).
   pedIsGettingIntoCar:handle=>this.host('pedEnteringCar','IS_CHAR_GETTING_IN_TO_A_CAR')(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle)),
   // GET_VEHICLE_CLASS: m_nVehicleClass, VEHICLE_CLASS_NORMAL (0) to _BICYCLE (11) in vehicles.ide's order, _IGNORE -1.
   getVehicleClass:handle=>{
    const model=handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle);
    const name=typeof model==='number'?this.host('vehicleModelClass','GET_VEHICLE_CLASS')(model):undefined;
    return name===undefined?-1:(VEHICLE_CLASSES as readonly string[]).indexOf(name);
   },
   // SET_GANG_WEAPONS: CGangs::SetGangWeapons, which the gang members the population makes from now on draw from.
   setGangWeapons:(gang,first,second,third)=>{setGangWeapons(gang,first,second,third);},
   drawCrosshair:state=>{this.host('setForceCrosshair','DRAW_CROSSHAIR')(state);},
   // DRAW_CORONA (reVC's handler): the point dropped to the ground at or below the map's low limit, then
   // RegisterCorona with the thread's id, full intensity, the script's colour, size, type and flare, and reflection.
   drawCorona:(x,y,z,size,coronaType,flareType,r,g,b,id)=>{
    if(z<=-100)z=this.findGroundZForCoord(x,y);
    this.coronaQueue.push({id,position:[x,y,z],size,color:[r&255,g&255,b&255],coronaType,flareType});
   },
   popVehiclePanel:(handle,panel,visible)=>{this.carComponents(handle)?.popPanel(panel,visible);},
   popVehicleBoot:handle=>{this.carComponents(handle)?.popBoot();},
   fixVehicleDoor:(handle,door)=>{this.carComponents(handle)?.fixDoor(door);},
   fixCarPanel:(handle,panel)=>{this.carComponents(handle)?.fixPanel(panel);},
   fixCarTyre:(handle,wheel)=>{this.carComponents(handle)?.fixTyre(wheel);},
   damageVehicleDoor:(handle,door)=>{this.carComponents(handle)?.damageDoor(door);},
   controlVehicleDoor:(handle,door,status,angle)=>{this.carComponents(handle)?.controlDoor(door,status,angle);},
   vehicleColours:handle=>this.host('scriptVehicleColours','GET_CAR_COLOURS')(this.liveVehicle(handle)),
   // SET_CAR_AS_MISSION_CAR (unreversed): a random or parked car the script holds becomes a mission vehicle, which the
   // population keeps and the mission's cleanup lets go again.
   setCarAsMissionCar:handle=>{this.host('claimScriptVehicle','SET_CAR_AS_MISSION_CAR')(this.liveVehicle(handle));this.forCleanup(this.cleanupVehicles,handle);},
   // TASK_SAY gives CTaskSimpleSay with a global speech context: the line is the ped's own speech, and the browser has
   // only the player's (as SET_CHAR_SAY_CONTEXT); the ped still has to exist.
   taskSay:handle=>{if(handle!==-1&&handle!==PLAYER_PED_HANDLE)this.livePed(handle);},
   damageVehiclePanel:(handle,panel)=>{this.carComponents(handle)?.damagePanel(panel);},
   vehicleTyreIsBurst:(handle,wheel)=>this.carComponents(handle)?.tyreBurst(wheel)??false,
   // Visibly damaged: crumpled, crumpled and open, or gone.
   isCarDoorDamaged:(handle,door)=>{const state=this.carComponents(handle)?.damageState.doors[door];return state===2||state===3||state===4;},
   isCarDoorFullyOpen:(handle,door)=>this.carComponents(handle)?.doorFullyOpen(door)??false,
   // vehicleFlags.bPetrolTankIsWeakPoint (CVehicle's constructor sets it); kept for the shot that reads it.
   setVehiclePetrolTankWeakpoint:(handle,weak)=>{const car=this.carComponents(handle);if(car)car.petrolTankIsWeakPoint=weak;},
   setVehicleRotationVelocity:(handle,x,y,z)=>{this.host('setScriptVehicleTurnSpeed','SET_CAR_ROTATION_VELOCITY')(this.liveVehicle(handle),{x,y,z},false);},
   addToCarRotationVelocity:(handle,x,y,z)=>{this.host('setScriptVehicleTurnSpeed','ADD_TO_CAR_ROTATION_VELOCITY')(this.liveVehicle(handle),{x,y,z},true);},
   addExplosionNoSound:(x,y,z,type)=>{this.world.addExplosion({x,y,z},type,{sound:false});},
   // The camera shake an explosion gives is not modelled, so the shake the script names changes nothing yet.
   addExplosionVariableShake:(x,y,z,type)=>{this.world.addExplosion({x,y,z},type);},
   burstVehicleTyre:(handle,wheel)=>{this.host('burstScriptVehicleTyre','BURST_CAR_TYRE')(this.liveVehicle(handle),wheel);},
   // reVC's TURN_CAR_TO_FACE_COORD: GetATanOfXY(position - point) + π/2, less a turn once past one, as a heading.
   turnVehicleToFaceCoord:(handle,x,y)=>{
    const at=handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle).position:this.vehicles.positionOf(handle);
    let heading=getATanOfXY(at.x-x,at.y-y)+Math.PI/2;if(heading>2*Math.PI)heading-=2*Math.PI;
    this.vehicles.setHeading(handle,heading*180/Math.PI);
   },
   // The mission trains (nativeTrain.ts, WorldTrain): the handle names the engine, and GET_TRAIN_CARRIAGE hands out
   // a handle for a carriage the first time it is asked, as CPool::GetRef does.
   createMissionTrain:(type,x,y,z,clockwise)=>{
    const spawn=this.host('spawnMissionTrain','CREATE_MISSION_TRAIN');
    const engine=TRAIN_TYPES[type]?.[0]??537;
    return this.vehicles.create(engine,{x,y,z},0,()=>spawn(type,{x,y,z},clockwise) as Promise<unknown>);
   },
   trainCarriage:(handle,index)=>{
    const carriage=this.host('trainCarriageOf','GET_TRAIN_CARRIAGE')(this.liveVehicle(handle),index);
    return carriage===undefined?-1:this.vehicles.handleFor(carriage,this.world.scriptTrainModel?.(carriage)??-1);
   },
   getTrainCaboose:handle=>{
    const caboose=this.host('trainCabooseOf','GET_TRAIN_CABOOSE')(this.liveVehicle(handle));
    return caboose===undefined?-1:this.vehicles.handleFor(caboose,this.world.scriptTrainModel?.(caboose)??-1);
   },
   setTrainSpeed:(handle,speed)=>{this.host('setScriptTrainSpeed','SET_TRAIN_SPEED')(this.liveVehicle(handle),speed);},
   setTrainCruiseSpeed:(handle,speed)=>{this.host('setScriptTrainCruiseSpeed','SET_TRAIN_CRUISE_SPEED')(this.liveVehicle(handle),speed);},
   setTrainForcedToSlowDown:(handle,state)=>{this.host('setScriptTrainForcedToSlowDown','SET_TRAIN_FORCED_TO_SLOW_DOWN')(this.liveVehicle(handle),state);},
   // bNotOnARailRoad: only a player's train leaves the rails, and the player drives none here.
   hasTrainDerailed:handle=>{this.liveVehicle(handle);return false;},
   findTrainDirection:handle=>this.host('scriptTrainClockwise','FIND_TRAIN_DIRECTION')(this.liveVehicle(handle)),
   setMissionTrainCoordinates:(handle,x,y,z)=>{this.host('setScriptTrainPosition','SET_MISSION_TRAIN_COORDINATES')(this.liveVehicle(handle),{x,y,z});},
   deleteMissionTrain:handle=>{this.host('removeScriptMissionTrain','DELETE_MISSION_TRAIN')(this.liveVehicle(handle));},
   markMissionTrainAsNoLongerNeeded:handle=>{this.host('releaseScriptMissionTrain','MARK_MISSION_TRAIN_AS_NO_LONGER_NEEDED')(this.liveVehicle(handle));},
   deleteMissionTrains:()=>{this.world.removeMissionTrains?.();},
   markMissionTrainsAsNoLongerNeeded:()=>{this.world.releaseMissionTrains?.();},
   deleteAllTrains:()=>{this.world.removeAllTrains?.();},
   // CPathFind::MarkRoadNodeAsDontWander and UnMarkAllRoadNodesAsDontWander on the loaded car nodes.
   markRoadNodeAsDontWander:(x,y,z)=>{this.world.markRoadNodeAsDontWander?.({x,y,z});},
   unmarkAllRoadNodesAsDontWander:()=>{this.world.unmarkAllRoadNodesAsDontWander?.();},
   flushPatrolRoute:()=>{this.patrolRoute.length=0;},
   forceVehicleLights:(handle,lights)=>{this.host('setScriptVehicleOverrideLights','FORCE_CAR_LIGHTS')(this.liveVehicle(handle),lights);},
   setVehicleCollision:(handle,state)=>{this.host('setScriptVehicleUsesCollision','SET_CAR_COLLISION')(this.liveVehicle(handle),state);},
   createUser3dMarker:(x,y,z,colour)=>this.host('createScriptUser3dMarker','CREATE_USER_3D_MARKER')(x,y,z,colour),
   removeUser3dMarker:index=>{this.host('removeScriptUser3dMarker','REMOVE_USER_3D_MARKER')(index);},
   pedIsSwimming:handle=>handle===PLAYER_PED_HANDLE?this.host('playerSwimming','IS_CHAR_SWIMMING')()
    :this.host('scriptPedSwimming','IS_CHAR_SWIMMING')(this.livePed(handle)),
   isGangWarFightingGoingOn:()=>this.host('gangWarFightingGoingOn','IS_GANG_WAR_FIGHTING_GOING_ON')(),
   gangWarIsGoingOn:()=>this.host('gangWarGoingOn','IS_GANG_WAR_GOING_ON')(),
   // The trip skip's four set-ups: after a mission, or for a named vehicle, or for one the script finishes off.
   setUpSkip:(x,y,z,heading)=>{this.host('setUpScriptSkip','SET_UP_SKIP')([x,y,z],heading,false,undefined,false);},
   setUpSkipAfterMission:(x,y,z,heading)=>{this.host('setUpScriptSkip','SET_UP_SKIP_AFTER_MISSION')([x,y,z],heading,true,undefined,false);},
   ensurePlayerHasDriveByWeapon:(_handle,ammo)=>{this.host('ensurePlayerHasDriveByWeapon','ENSURE_PLAYER_HAS_DRIVE_BY_WEAPON')(ammo);},
   setWeatherToAppropriateTypeNow:()=>{this.host('setWeatherToAppropriateTypeNow','SET_WEATHER_TO_APPROPRIATE_TYPE_NOW')();},
   setUpSkipForSpecificVehicle:(x,y,z,heading,car)=>{this.host('setUpScriptSkip','SET_UP_SKIP_FOR_SPECIFIC_VEHICLE')([x,y,z],heading,false,this.liveVehicle(car),false);},
   setUpSkipForVehicleFinishedByScript:(x,y,z,heading,car)=>{this.host('setUpScriptSkip','SET_UP_SKIP_FOR_VEHICLE_FINISHED_BY_SCRIPT')([x,y,z],heading,false,this.liveVehicle(car),true);},
   clearSkip:()=>{this.host('clearScriptSkip','CLEAR_SKIP')();},
   isSkipWaitingForScriptToFadeIn:()=>this.host('isScriptSkipWaitingForFadeIn','IS_SKIP_WAITING_FOR_SCRIPT_TO_FADE_IN')(),
   // The car watches CTheScripts::Process runs. They ask only about a car the browser has built: one still streaming
   // in has no driver in its seat, so the stuck check starts again from where it stands.
   vehicleHasDriver:handle=>{
    if(handle===PLAYER_VEHICLE_HANDLE)return !!this.world.playerPed().vehicle;
    if(!this.vehicles.entity(handle))return false;
    return this.playerCarHandle()===handle||this.peds.driverOf(handle)!==undefined;
   },
   vehicleIsUpsideDownForCheck:handle=>{const car=this.vehicleByHandle(handle);return !!car&&!!this.world.scriptVehicleUpsideDownForCheck?.(car);},
   vehicleRouteNodeForScript:handle=>{
    const car=this.vehicleByHandle(handle),route=car?this.world.scriptVehicleRouteNodes?.(car):undefined;
    return route?findNodeCoorsForScriptBetween(route.current,route.starting):undefined;
   },
   // CStuckCarCheck's search: from nought, switched-off nodes included.
   carPlacementNode:(point,nth)=>this.scriptCarNode(point,nth,false),
   // SetCoordsOfScriptCar with the orientation cleared, then the heading. The player's own car is no script car.
   warpVehicle:(handle,point,heading)=>{if(handle===PLAYER_VEHICLE_HANDLE)return;this.vehicles.setPosition(handle,point);this.vehicles.setHeading(handle,heading);},
   // GET_NTH_CLOSEST_CAR_NODE counts from one (FindNthNodeClosestToCoors from nought) over the car nodes not switched
   // off. With nothing found, FindNodeCoorsForScript gives back the zero vector.
   // FindNodeClosestToCoors over the car nodes, disabled ones passed over, then FindNodeCoorsForScript (and
   // FindNodeOrientationForCarPlacement), as reVC's CRunningScript has them.
   closestVehicleNode:(x,y,z)=>{const node=this.scriptCarNode({x,y,z},0,true);return node?{x:node.x,y:node.y,z:node.z}:{x:0,y:0,z:0};},
   closestVehicleNodeWithHeading:(x,y,z)=>this.scriptCarNode({x,y,z},0,true)??{x:0,y:0,z:0,heading:0},
   // GetClosestCharNode (CharacterCommands.cpp:1704): PutToGroundIfTooLow, then ThePaths.FindNodeClosestToCoors with its
   // defaults (a ped node, any distance, switched-off ones too); the origin when the loaded areas hold none.
   closestPedNode:(x,y,z)=>{
    const areas=this.world.carPathAreas?.();if(!areas)return {x:0,y:0,z:0};
    if(z<=-100)z=this.findGroundZForCoord(x,y);
    const node=findNthNodeClosestToCoors(areas,{x,y,z},0,{kind:'pedestrian',maxDistance:999999.88,ignoreDisabled:false});
    return node?findNodeCoorsForScript(areas,node):{x:0,y:0,z:0};
   },
   forceBigMessageAndCounter:state=>{this.runtime.game.forceBigMessageAndCounter=state;},
   // The vigilante's criminals. CAutoPilot's convoy flag, route seed and level-transition switch and CPed's
   // bChrisCriminal and bForceDieInCar are kept for the script; AUTHORED in that the port's car AI and police do not
   // read them yet (the criminals drive as any mission car does, and die as any ped does).
   markVehicleAsConvoyCar:(handle,on)=>{this.liveVehicle(handle);this.carFlag(handle).convoy=on;},
   setCarRandomRouteSeed:(handle,seed)=>{this.liveVehicle(handle);this.carFlag(handle).routeSeed=seed;},
   setCarAvoidLevelTransitions:(handle,on)=>{this.liveVehicle(handle);this.carFlag(handle).avoidLevelTransitions=on;},
   setPedChrisCriminal:(handle,on)=>{if(handle!==PLAYER_PED_HANDLE&&this.peds.exists(handle))this.pedFlag(handle).chrisCriminal=on;},
   setCharForceDieInCar:(handle,on)=>{if(handle!==PLAYER_PED_HANDLE&&this.peds.exists(handle))this.pedFlag(handle).forceDieInCar=on;},
   // IS_MODEL_IN_CDIMAGE: CStreaming's directory has the model. The vigilante draws random ped ids until one exists.
   isModelInCdimage:model=>typeof model==='number'?this.world.modelInArchive?.(model)??false:(this.world.modelIndex?.(model)??-1)>=0,
   // GET_RANDOM_CAR_OF_TYPE_IN_AREA hands a script a traffic car. AUTHORED: none is handed over yet (-1).
   getRandomCarOfTypeInArea:()=>-1,
   // START_CAR_FIRE (dispatch unreversed; as StartCharFire does for a ped): CFireManager::StartScriptFire on the
   // vehicle, strength 1, no generations to spread. The fire rides the car until it is put out or the car goes.
   startVehicleFire:handle=>this.runtime.game.fires.startScriptFire(this.vehicles.positionOf(handle),1,0,undefined,handle),
   // GET_NAME_OF_ZONE (the reference leaves it a todo): the text label of the smallest navigation zone at the point.
   getNameOfZone:(x,y,z)=>worldZoneAt(this.zones,[x,y,z],true).textLabel,
   getNameOfInfoZone:(x,y,z)=>worldZoneAt(this.zones,[x,y,z],false).infoLabel,
   // bWantedByPolice and bDruggedUp are kept on the handle. AUTHORED: nothing reads them yet (the cops' kill-criminal
   // task that would chase a ped wanted by the police is not the browser's).
   setPedWantedByPolice:(handle,state)=>{this.pedFlag(handle).wantedByPolice=state;},
   // bIgnoreHeightDifferenceFollowingNodes (PedCommands.cpp, reversed): kept on the ped; the browser's route
   // following does not test the height difference it waives.
   setPedIgnoreHeightDifferenceFollowingNodes:(handle,ignore)=>{if(handle!==PLAYER_PED_HANDLE)this.pedFlag(handle).ignoreHeightDifferenceFollowingNodes=ignore;},
   // SetCameraDirectlyInFrontForFollowPed_ForAPed_CamOnAString (CameraCommands.cpp, reversed): the follow camera
   // turned to look at the ped from in front; the player's camera is the one that follows.
   setCameraInFrontOfPed:handle=>{if(handle===PLAYER_PED_HANDLE)this.world.setCameraInFrontOfPlayer();else this.world.setCameraInFrontOfHeading?.(this.peds.headingOf(handle));},
   // CPlayerInfo's m_bCanShowVitalStats: whether the stats button shows the vital stats.
   setPlayerDisplayVitalStatsButton:(_player,enabled)=>{this.displayVitalStatsButton=enabled;},
   // CCarCtrl::ScriptGenerateOneEmergencyServicesCar (reversed) over the host's own emergency services.
   createEmergencyServicesVehicle:(model,x,y,z)=>{if(typeof model==='number')this.world.scriptEmergencyServicesCar?.(model,{x,y,z});},
   // Fx_c::AddBlood at the point, along the direction, for the density the script gives.
   addBlood:(x,y,z,vx,vy,vz,density)=>{this.world.addBlood?.({x,y,z},{x:vx,y:vy,z:vz},density);},
   // vehicleFlags.bAlwaysSkidMarks (SET_CAR_ALWAYS_CREATE_SKIDS, reversed): CRenderer keeps an off-screen car with
   // it pre-rendered further out, so its wheels go on laying marks; the browser lays every stepped car's marks on or off
   // screen, so the flag is kept and needs nothing more. And VEHICLE_DOES_PROVIDE_COVER's flag.
   setVehicleAlwaysCreateSkids:(handle,enable)=>{this.carFlag(handle).alwaysSkidMarks=enable;},
   vehicleDoesProvideCover:(handle,state)=>{this.carFlag(handle).providesCover=state;},
   setPedDruggedUp:(handle,state)=>{this.pedFlag(handle).druggedUp=state;},
   // AUTHORED: the street makes no drug buyers (the handler and whatever marks a buyer are unreversed), so a dealer's
   // look for one finds nobody.
   randomDrugsBuyerInSphere:()=>-1,
   getClosestStraightRoad:(x,y,z,minDist,maxDist)=>{
    const areas=this.world.carPathAreas?.(),found=areas&&findClosestStraightRoad(areas,{x,y,z},minDist,maxDist);
    return found??{node1X:0,node1Y:0,node1Z:0,node2X:0,node2Y:0,node2Z:0,angle:0};
   },
   // CTheZones::GetLevelFromPosition (dispatch unreversed): the city a point lies in, as the player's own is found.
   getCityFromCoords:(x,y,z)=>{if(!this.world.cityAt)throw new UnsupportedScmCommand(-1,0,'GET_CITY_FROM_COORDS','no host');return this.world.cityAt(x,y,z);},
   nthClosestVehicleNode:(x,y,z,nth)=>{const node=this.scriptCarNode({x,y,z},nth-1,true);return node?{x:node.x,y:node.y,z:node.z}:{x:0,y:0,z:0};},
   getNthClosestCarNodeWithHeading:(x,y,z,nth)=>this.scriptCarNode({x,y,z},nth-1,true)??{x:0,y:0,z:0,heading:0},
   vehicleWasDamagedByVehicle:(handle,other)=>{
    const last=this.host('scriptVehicleLastDamagedBy','HAS_CAR_BEEN_DAMAGED_BY_CAR')(this.liveVehicle(handle));
    return last?.car!==undefined&&last.car===this.liveVehicle(other);
   },
   vehicleLastWeaponDamage:handle=>this.host('scriptVehicleLastWeaponDamage','HAS_CAR_BEEN_DAMAGED_BY_WEAPON')(this.liveVehicle(handle)),
   clearVehicleLastDamageEntity:handle=>{this.host('clearScriptVehicleLastDamagedBy','CLEAR_CAR_LAST_DAMAGE_ENTITY')(this.liveVehicle(handle));},
   clearCarLastWeaponDamage:handle=>{this.host('clearScriptVehicleLastWeaponDamage','CLEAR_CAR_LAST_WEAPON_DAMAGE')(this.liveVehicle(handle));},
   pedLastWeaponDamage:handle=>handle===PLAYER_PED_HANDLE?this.host('playerLastWeaponDamage','HAS_CHAR_BEEN_DAMAGED_BY_WEAPON')()
    :this.host('scriptPedLastWeaponDamage','HAS_CHAR_BEEN_DAMAGED_BY_WEAPON')(this.livePed(handle)),
   clearPedLastWeaponDamage:handle=>{
    if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerLastWeaponDamage','CLEAR_CHAR_LAST_WEAPON_DAMAGE')();
    else this.host('clearScriptPedLastWeaponDamage','CLEAR_CHAR_LAST_WEAPON_DAMAGE')(this.livePed(handle));
   },
   // The player's own damager is not kept, so there is nothing of his to clear.
   clearPedLastDamageEntity:handle=>{if(handle!==PLAYER_PED_HANDLE)this.host('clearScriptPedLastDamagedBy','CLEAR_CHAR_LAST_DAMAGE_ENTITY')(this.livePed(handle));},
   pedIsSittingInCar:(handle,vehicle)=>handle===PLAYER_PED_HANDLE?this.world.playerPed().sittingInCar&&this.playerCarHandle()===vehicle:this.peds.rideOf(handle)?.vehicle===vehicle,
   // CPed's own acquaintance table, through CAcquaintance's routines.
   setPedRelationship:(handle,relationship,pedType)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerRelationship','SET_CHAR_RELATIONSHIP')(relationship,pedType);else this.world.setScriptPedRelationship(this.livePed(handle),relationship,pedType);},
   clearPedRelationship:(handle,relationship,pedType)=>{if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerRelationship','CLEAR_CHAR_RELATIONSHIP')(relationship,pedType);else this.world.clearScriptPedRelationship(this.livePed(handle),relationship,pedType);},
   clearAllPedRelationships:(handle,relationshipType)=>{if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerRelationships','CLEAR_ALL_CHAR_RELATIONSHIPS')(relationshipType);else this.world.clearScriptPedRelationships(this.livePed(handle),relationshipType);},
   setPedNeverTargeted:(handle,enabled)=>{this.world.setScriptPedNeverTargeted(this.livePed(handle),enabled);},
   clearPedLookAt:handle=>{if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerLookAt','CLEAR_LOOK_AT')();else this.world.clearScriptPedLookAt(this.livePed(handle));},
   // The player's own cash is CPlayerInfo's, not the ped's m_nMoneyCount.
   setPedMoney:(handle,money)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedMoney?.(this.livePed(handle),money);},
   takePedPhotographedFlag:handle=>handle!==PLAYER_PED_HANDLE&&!!this.world.takeScriptPedPhotographed?.(this.livePed(handle)),
   // SET_CHAR_STAY_IN_SAME_PLACE is the flag CTaskComplexBeStill reads, which for a browser ped is the order
   // that holds it where it is; clearing it lets the wander have the ped back.
   setPedStayInSamePlace:(handle,stay)=>{
    this.world.giveScriptPedOrder(this.livePed(handle),stay?{kind:'standStill',seconds:Number.POSITIVE_INFINITY}:{kind:'wander'});
   },
   vehicleMatrix:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle)),
   anchorBoat:(handle,state)=>{this.host('setScriptBoatAnchored','ANCHOR_BOAT')(this.liveVehicle(handle),state);},
   freezeVehiclePosition:(handle,frozen)=>{this.world.setScriptVehicleFrozen(this.liveVehicle(handle),frozen);},
   // bIsFrozen and bInfiniteMass as FREEZE_CAR_POSITION sets them; the collision it waits for is the browser's to stream.
   freezeVehiclePositionAndDontLoadCollision:(handle,frozen)=>{this.world.setScriptVehicleFrozen(this.liveVehicle(handle),frozen);},
   explosionInArea:(type,min,max)=>this.host('explosionInArea','IS_EXPLOSION_IN_AREA')(type,min,max),
   setUpsideDownVehicleNotDamaged:(handle,state)=>{this.world.setScriptVehicleUpsideDownNotDamaged?.(this.liveVehicle(handle),state);},
   setVehicleForwardSpeed:(handle,forwardSpeed)=>{this.world.setScriptVehicleForwardSpeed(this.liveVehicle(handle),forwardSpeed);},
   // CWorld::FindGroundZForCoord looks straight down from a thousand above and answers twenty where the world
   // has no ground under the point.
   groundZForCoord:(x,y)=>this.findGroundZForCoord(x,y),
   // A ped a script made never rides in the browser yet, so it is always on foot and never sitting in a car.
   pedIsOnFoot:handle=>handle===PLAYER_PED_HANDLE?!this.world.playerPed().vehicle:this.peds.exists(handle)&&this.peds.rideOf(handle)===undefined,
   pedIsSittingInAnyCar:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().sittingInCar:this.peds.rideOf(handle)!==undefined,
   // eVehicleAppearance. The browser builds a car for every vehicle a script makes, so one of those is an
   // automobile; the player's own is whatever he is riding.
   vehicleAppearance:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).appearance:(this.liveVehicle(handle),VEHICLE_APPEARANCE_AUTOMOBILE),
   vehicleIsTrain:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).train:!!this.world.scriptVehicleIsTrain?.(this.liveVehicle(handle)),
   playerMissionGates:()=>this.world.playerMissionGates(),
   pedIsStopped:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().stopped:this.world.scriptPedStanding(this.livePed(handle)),
   // CTheScripts::HighlightImportantArea: kept for this script pass, drawn by the marker pass after it.
   highlightArea:(id,centre,halfX)=>{this.highlights.set(id,{id,x:centre.x,y:centre.y,z:centre.z,halfX});},
   drawSphere:(id,x,y,z,radius)=>{this.highlights.set(id,{id,x,y,z,halfX:radius,sphere:true});},
   pedIsDeadForScript:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().dead:this.peds.isDead(handle),
   pedHealth:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().health:this.peds.healthOf(handle),
   setPlayerControl:(_player,control)=>{this.playerControl=control;this.world.setPlayerControl(control);},
   // The browser has no cutscene player, so the data counts as in as soon as it is asked for and the cutscene
   // ends as soon as it starts. That keeps the script's wait loops moving instead of holding a thread forever
   // on a question nothing here will ever answer.
   // The browser's streamer works from where the player is, not from names, so a requested model counts as
   // loaded at once. Holding a thread on a question nothing here answers would stop the script instead.
   // CStreaming::LoadScene with a heading, which the browser answers the same way it answers the plain one.
   loadSceneInDirection:(x,y,z)=>{this.world.loadScene(x,y,z);},
   /* CWorld::ClearExcitingStuffFromArea is ported and deliberately not called here, which is an ordering
    * difference rather than a missing piece. In the original the script runs at game start and its opening
    * clear finds an empty world. This browser builds and populates its world first and starts MAIN.SCM when
    * that world is ready, so the same clear arrives seconds late and would sweep away a street the original
    * had not put there yet. The host's own clearArea does what the routine does, for the day the script starts
    * before the population does, or for a mission that clears an area while it runs. */
   // A mission clearing its area while it runs gets the host's clear. MAIN's own sweeps, and the INTRO mission's
   // (MAIN launches it with the new game and it clears 500 units round Grove Street), are only counted, for the
   // ordering reason above.
   clearExcitingStuffFromArea:(point,radius,_projectiles,fromMission)=>{this.areasCleared++;if(fromMission)this.world.clearArea(point,radius);},
   // CWorld::ClearCarsFromArea and ClearPedsFromArea over the script's box.
   clearAreaOfVehicles:(min,max)=>{this.host('clearVehiclesInBox','CLEAR_AREA_OF_CARS')(min,max);},
   useDetonator:()=>{this.host('useDetonator','USE_DETONATOR')();},
   createRandomCarForCarPark:(x,y,z,heading)=>{this.host('createRandomCarForCarPark','CREATE_RANDOM_CAR_FOR_CAR_PARK')(x,y,z,heading);},
   clearAreaOfPeds:(min,max)=>{this.host('clearPedsInBox','CLEAR_AREA_OF_CHARS')(min,max);},
   extinguishFiresAtPoint:(point,radius)=>{this.world.extinguishFiresAtPoint?.(point,radius);},
   // SET_CAR_TEMP_ACTION on a script car: CAutoPilot::SetTempAction for the time.
   setVehicleTempAction:(handle,action,time)=>{this.host('scriptVehicleTempAction','SET_CAR_TEMP_ACTION')(this.liveVehicle(handle),action,time/1000);},
   // CPed::OurPedCanSeeThisEntity: in front, inside forty units, and nothing solid between the two of them.
   // The ped is looked at a unit above its own position, which is its head.
   pedCanSeePed:(handle,other)=>{
    if(!this.peds.exists(handle)||!this.peds.exists(other))return false;
    const from=this.peds.positionOf(handle),to=this.peds.positionOf(other);
    const heading=this.peds.headingOf(handle)*Math.PI/180,frame=headingFrame(heading);
    if(!pedSightAngleAndRange({x:from.x,y:from.y},{x:frame.forward.x,y:frame.forward.y},{x:to.x,y:to.y}))return false;
    return this.world.lineOfSightClear(from,{x:to.x,y:to.y,z:to.z+PED_SIGHT_TARGET_RAISE});
   },
   // CRadar's blip carries the entry-exit nearest the point the command names, by the manager's own lookup.
   setBlipEntryExit:(blip,x,y,radius)=>{
    this.runtime.game.radar.setEntryExit(blip>>>0,this.world.nearestEntryExit(x,y,radius)??null);
   },
   // IS_CHAR_RESPONDING_TO_EVENT. The command's own dispatch is not reversed; what it reads is CPedIntelligence's
   // event group, which for a browser ped is the one event it is answering and whether it still is.
   pedIsRespondingToEvent:(handle,event)=>this.world.scriptPedRespondingTo(this.livePed(handle),event),
   // EXTEND_PATROL_ROUTE builds the route CTaskComplexFollowPatrolRoute walks. The task is not one the browser
   // runs, so the points are kept in the order the script gave them and nothing walks them yet.
   extendPatrolRoute:(x,y,z,animationName,animationFile)=>{
    this.patrolRoute.push({position:{x,y,z},animationName,animationFile});
   },
   // CStreaming's own answer, which is a model the browser has built a car from.
   randomVehicleModelInMemory:()=>{
    const chosen=this.world.randomVehicleInMemory();
    if(!chosen)throw new UnsupportedScmCommand(-1,0,'NO_VEHICLE_MODEL_IS_IN_MEMORY','');
    return chosen;
   },
   // CPed's own fields, which the host holds for a ped it built.
   setPedWeaponSkill:(handle,skill)=>{this.world.setScriptPedSkill(this.livePed(handle),skill);},
   // The ped's m_pEnex: for the player, the nearest entry exit within the radius of the point (FindNearestEntryExit),
   // whose door he then leaves an interior by.
   setPedHasUsedEntryExit:(handle,x,y,radius)=>{
    if(handle===PLAYER_PED_HANDLE)this.host('setPlayerUsedEntryExit','SET_CHAR_HAS_USED_ENTRY_EXIT')(x,y,radius);
    else this.world.setScriptPedUsedEntryExit(this.livePed(handle));
   },
   getNameOfEntryExitCharUsed:handle=>handle===PLAYER_PED_HANDLE?this.host('playerEntryExit','GET_NAME_OF_ENTRY_EXIT_CHAR_USED')()?.name??'':(this.livePed(handle),''),
   getPositionOfEntryExitCharUsed:handle=>{
    const used=handle===PLAYER_PED_HANDLE?this.host('playerEntryExit','GET_POSITION_OF_ENTRY_EXIT_CHAR_USED')():(this.livePed(handle),undefined);
    return used?{x:used.position[0],y:used.position[1],z:used.position[2],heading:used.heading}:{x:0,y:0,z:0,heading:0};
   },
   // CAutoPilot's fields for a car the script made, which nothing drives here yet: they are the car's, kept
   // for the day something reads them, and the adapter says which of the two that is.
   setVehicleCruiseSpeed:(handle,maxSpeed)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'cruiseSpeed',maxSpeed);},
   setVehicleDrivingStyle:(handle,style)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'drivingStyle',style);},
   setVehicleLoadCollisionFlag:(handle,state)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'loadsCollision',state?1:0);},
   requestModel:model=>{this.requestedModels.add(String(model));this.world.requestModel(model);},
   hasModelLoaded:()=>true,
   markModelNotNeeded:()=>{},
   loadAllModelsNow:()=>{this.runtime.game.animBlocks.service();},
   loadCutscene:name=>{this.cutscenes.push(name);this.world.loadCutscene(name);this.runtime.game.cutscene.loaded();},
   startCutscene:()=>{this.cutsceneThread=this.runtime.currentThread;this.runtime.game.cutscene.finish();},
   clearCutscene:()=>{this.cutsceneThread=undefined;},
   findNumberTagsTagged:()=>this.world.tagsTagged(),
   percentageTaggedInArea:(x1,y1,x2,y2)=>this.world.tagsPercentageInArea(x1,y1,x2,y2),
   // The handler is unreversed; MAIN.SCM passes 0 or 1, read here as CTagManager::SetAlphaInArea with 0 or 255.
   setTagStatusInArea:(x1,y1,x2,y2,status)=>{this.world.setTagsInArea?.(x1,y1,x2,y2,status!==0);},
   // GetNearestTag returns nothing without tags; the variables are then left at the point asked about.
   getNearestTagPosition:(x,y,z)=>this.world.nearestTagPosition?.(x,y,z)??{x,y,z},
   getTerritoryUnderControlPercentage:()=>this.world.territoryUnderControlPercentage(),
   // CPopulation::AddPed through the pool, which hands the script a handle at once.
   // CREATE_CHAR from a mission script: the ped stands static until the collision under it is in (III's handler, and
   // SA's own CREATE_CHAR_AT_ATTRACTOR: bIsStaticWaitingForCollision with the mission cleanup). SWEET1B makes the crack
   // den's dealers in the interior while CJ is still in the street; without the wait they fell through the void.
   createChar:(pedType,model,x,y,z)=>{
    this.nextPedWaitsForCollision=!!this.runtime?.currentThread?.usesMissionCleanup;
    try{return this.forCleanup(this.cleanupPeds,this.peds.create(pedType,model,{x,y,z}));}finally{this.nextPedWaitsForCollision=false;}
   },
   pedHeading:handle=>{
    if(handle!==PLAYER_PED_HANDLE)return this.peds.headingOf(handle);
    const heading=this.world.playerPed().heading;if(heading===undefined)throw new UnsupportedScmCommand(-1,0,'GET_CHAR_HEADING','player heading');
    return heading;
   },
   // A ped stands upright: its matrix is its heading's turn about the vertical, at its position. The player's comes
   // from the host; one the host does not know is not guessed.
   pedMatrix:handle=>{
    if(handle===PLAYER_PED_HANDLE){const player=this.world.playerPed();if(player.heading===undefined)throw new UnsupportedScmCommand(-1,0,'GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS','player heading');
     return {...headingFrame(player.heading*Math.PI/180),position:player.position};}
    return {...headingFrame(this.peds.headingOf(handle)*Math.PI/180),position:this.ridingIn(handle)??this.peds.positionOf(handle)};
   },
   setPedCoordinates:(handle,x,y,z)=>{if(handle===PLAYER_PED_HANDLE)this.teleportPlayer(x,y,z,'SET_CHAR_COORDINATES');else this.peds.setPosition(handle,{x,y,z});},
   // SET_CHAR_COORDINATES_NO_OFFSET and the gang form differ from the plain one in what they do to a ped in a
   // car and to the ped's group, neither of which the browser's scripted peds have yet.
   setPedCoordinatesNoOffset:(handle,x,y,z)=>{if(handle===PLAYER_PED_HANDLE)this.teleportPlayer(x,y,z,'SET_CHAR_COORDINATES_NO_OFFSET');else this.peds.setPosition(handle,{x,y,z});},
   setPedCoordinatesDontWarpGang:(handle,x,y,z)=>{if(handle===PLAYER_PED_HANDLE)this.teleportPlayer(x,y,z,'SET_CHAR_COORDINATES_DONT_WARP_GANG');else this.peds.setPosition(handle,{x,y,z});},
   // GetRandomCharInZone (CharacterCommands.cpp:1784): the first street ped of an asked-for kind that stands in the
   // navigation zone, within five units of the player's height and under no roof, and is not the one taken last
   // time. It becomes the script's (PED_MISSION), on the mission's cleanup list when the thread keeps one.
   // GET_RANDOM_CHAR_IN_SPHERE (the reference disables its handler, CharacterCommands.cpp:4272; AUTHORED after the zone
   // twin above): the first street ped of an asked-for kind within the sphere, not the one taken last time, becomes the
   // script's.
   randomPedInSphere:(x,y,z,radius,civilian,gang,criminal)=>{
    const candidates=this.world.randomStreetPeds?.();
    if(!candidates)throw new UnsupportedScmCommand(-1,0,'GET_RANDOM_CHAR_IN_SPHERE','no host');
    for(const c of candidates){
     if(c.ped===this.lastRandomPed||!validRandomPedType(c.pedType,civilian,gang,criminal))continue;
     if(Math.hypot(c.position.x-x,c.position.y-y,c.position.z-z)>radius)continue;
     this.lastRandomPed=c.ped;this.world.adoptStreetPed?.(c.ped);
     return this.forCleanup(this.cleanupPeds,this.peds.adopt(c.ped,c.pedType,c.model,c.position,c.heading,c.health));
    }
    return -1;
   },
   randomPedInBox:(x,y,z,dx,dy,dz)=>{
    const inside=(q:{x:number;y:number;z:number})=>Math.abs(q.x-x)<=dx&&Math.abs(q.y-y)<=dy&&Math.abs(q.z-z)<=dz;
    // The script's own peds first, then the street's (taken under a handle, as the NO_SAVE forms hand one back).
    for(const h of this.peds.handles){try{if(this.peds.exists(h)&&inside(this.ridingIn(h)??this.peds.positionOf(h)))return h;}catch{}}
    for(const c of this.world.randomStreetPeds?.()??[]){
     if(!inside(c.position))continue;
     this.world.adoptStreetPed?.(c.ped);
     return this.peds.adopt(c.ped,c.pedType,c.model,c.position,c.heading,c.health);
    }
    return -1;
   },
   randomPedInZone:(zone,civilian,gang,criminal)=>{
    const candidates=this.world.randomStreetPeds?.();
    if(!candidates)throw new UnsupportedScmCommand(-1,0,'GET_RANDOM_CHAR_IN_ZONE','no host');
    const playerZ=this.world.playerPed().position.z;
    for(const c of candidates){
     if(c.ped===this.lastRandomPed||!validRandomPedType(c.pedType,civilian,gang,criminal))continue;
     if(!findZone(this.zones,[c.position.x,c.position.y,c.position.z],zone,'navi'))continue;
     if(playerZ-5>c.position.z||playerZ+5<c.position.z||c.roofed())continue;
     this.lastRandomPed=c.ped;this.world.adoptStreetPed?.(c.ped);
     return this.forCleanup(this.cleanupPeds,this.peds.adopt(c.ped,c.pedType,c.model,c.position,c.heading,c.health));
    }
    return -1;
   },
   // CEntity::m_nModelIndex: the id the script made the ped with, a name's peds.ide id, or an adopted ped's own.
   pedModelId:handle=>{
    if(handle===PLAYER_PED_HANDLE)return 0;
    const model=this.peds.modelOf(handle);
    return typeof model==='number'?model:model===undefined?-1:this.world.pedModelId?.(model)??-1;
   },
   // CAutomobile's taxi light (m_bTaxiLight through SetTaxiLight; the command's dispatch is unreversed).
   setTaxiLights:(handle,on)=>{if(handle!==PLAYER_VEHICLE_HANDLE)this.liveVehicle(handle);this.world.setTaxiLight?.(handle===PLAYER_VEHICLE_HANDLE?undefined:this.liveVehicle(handle),on);},
   // GetCharArmour: the player's m_fArmour; a script ped wears none here.
   pedArmour:handle=>handle===PLAYER_PED_HANDLE?this.world.playerArmour?.()??0:0,
   weaponTypeSlot:type=>{const info=this.world.weaponTypeInfo?.(type);if(!info)throw new UnsupportedScmCommand(-1,0,'GET_WEAPONTYPE_SLOT','weapon.dat');return info.slot;},
   weaponTypeModel:type=>{const info=this.world.weaponTypeInfo?.(type);if(!info)throw new UnsupportedScmCommand(-1,0,'GET_WEAPONTYPE_MODEL','weapon.dat');return info.model;},
   // CScripted2dEffects (ADD_ATTRACTOR; unreversed): a scripted ped attractor is a point, the heading its user takes
   // there and the sequence the user performs. AUTHORED: the user walks straight to the point, turns to the heading and
   // runs the sequence, which stands in for CTaskComplexUseAttractor's queueing.
   addAttractor:(x,y,z,angle,_arc,sequence)=>{const handle=++this.attractorSerial;this.scriptAttractors.set(handle,{x,y,z,heading:angle,sequence});return handle;},
   clearAttractor:handle=>{this.scriptAttractors.delete(handle);},
   taskUseAttractor:(char,attractor)=>{this.useAttractor(char,attractor,true,TASK_USE_ATTRACTOR_COMMAND);},
   // CEntity::FindTriggerPointCoors (0x533380): the model's trigger point of that index under the object's matrix,
   // or the origin when it has none. The matrix here is the object's heading about the vertical.
   getLevelDesignCoordsForObject:(handle,nth)=>{
    const object=this.runtime.game.objects.at(handle),local=typeof object.model==='string'?this.world.modelTriggerPoint?.(object.model,nth):undefined;
    if(!local)return {x:0,y:0,z:0};
    const c=Math.cos(object.heading),s=Math.sin(object.heading);
    return {x:object.position.x+local[0]*c-local[1]*s,y:object.position.y+local[0]*s+local[1]*c,z:object.position.z+local[2]};
   },
   isObjectWithinBrainActivationRange:handle=>{
    const objects=this.runtime.game.objects;if(!objects.exists(handle))return false;
    const object=objects.at(handle),brain=this.runtime.game.scriptBrains.brains.find(b=>b.typeOfBrain===BRAIN_OBJECT&&b.model===object.model);
    if(!brain)return false;
    const player=this.world.playerPed().position;
    return Math.hypot(player.x-object.position.x,player.y-object.position.y,player.z-object.position.z)<=brain.activationRadius;
   },
   // CREATE_CHAR_AT_ATTRACTOR: the ped is made at the attractor, facing its heading, already performing its sequence.
   createCharAtAttractor:(pedType,model,attractor,taskCommand)=>{
    const point=this.scriptAttractors.get(attractor);if(!point)throw new UnsupportedScmCommand(-1,0,'CREATE_CHAR_AT_ATTRACTOR',`attractor ${attractor}`);
    const ped=this.forCleanup(this.cleanupPeds,this.peds.create(pedType,model,{x:point.x,y:point.y,z:point.z}));
    // The ped's model is still coming in: its heading and its sequence are given once it stands there (a command
    // that waited on it here would run again and make another ped).
    this.attractorArrivals.set(ped,{attractor,opcode:taskCommand});
    return ped;
   },
   // TASK_PLAY_ANIM_SECONDARY plays the clip on the ped's secondary (partial) task slot beside whatever it is doing.
   // AUTHORED: the port's peds hold one scripted order, so the clip is played as TASK_PLAY_ANIM plays it.
   taskPlayAnimSecondary:(handle,animationName,animationFile,blendSpeed,loop,lockX,lockY,keepLastFrame,time)=>{
    adapter.givePedScriptedTask!(handle,{kind:'playAnim',animationName,animationFile,blendSpeed,loop,lockX,lockY,keepLastFrame,time,interruptable:true},TASK_PLAY_ANIM_SECONDARY_COMMAND);
   },
   // SetCharHealth on the player: the health capped at CPlayerInfo::m_nMaxHealth, which a script ped's is not.
   setPedHealth:(handle,health)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerHealth','SET_CHAR_HEALTH')(Math.min(health,this.runtime.game.playerInfo.maxHealth));else this.peds.setHealth(handle,health);},
   // SET_CHAR_HEALTH 0 (CTaskComplexDie through a script command event): the player dies as any ped does.
   killPed:handle=>{if(handle===PLAYER_PED_HANDLE)this.host('killPlayer','SET_CHAR_HEALTH')();else this.peds.kill(handle);},
   setPedAccuracy:(handle,accuracy)=>{this.peds.setAccuracy(handle,accuracy);},
   setPedShootRate:(handle,rate)=>{this.peds.setShootingRate(handle,rate);},
   setRadioChannel:station=>{this.world.retuneRadio?.(station);},
   // GET_RADIO_CHANNEL: CAudioEngine::GetCurrentRadioStationID; gf_date steps through the stations from it.
   getRadioChannel:()=>this.world.radioStationId?.()??RADIO_OFF,
   setPedInvulnerable:(handle,enabled)=>{this.peds.setInvulnerable(handle,enabled);},
   setPedProofs:(handle,proofs)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerProofs','SET_CHAR_PROOFS')(proofs);else this.peds.setProofs(handle,proofs);},
   deletePed:handle=>{this.cleanupPeds.delete(handle);this.peds.delete(handle);},
   markPedNoLongerNeeded:handle=>{this.cleanupPeds.delete(handle);this.peds.markNoLongerNeeded(handle);},
   // DONT_REMOVE_CHAR: CMissionCleanup::RemoveEntityFromList; the ped stays the script's after the mission.
   setPedDontRemove:handle=>{this.cleanupPeds.delete(handle);},
   pedType:handle=>this.peds.typeOf(handle),
   pedIsMale:handle=>this.peds.isMale(handle),
   // m_vecMoveSpeed in units a frame, which GET_CHAR_SPEED multiplies by fifty: the browser keeps speeds a second (CJ
   // read fifty times too fast against the 13.0 SCRASH2 checks him under).
   // GET_CHAR_VELOCITY: m_vecMoveSpeed in units a frame, as the handler expects.
   pedVelocity:handle=>{
    const v=handle===PLAYER_PED_HANDLE?this.host('playerVelocity','GET_CHAR_VELOCITY')():this.host('scriptPedVelocity','GET_CHAR_VELOCITY')(this.livePed(handle));
    return {x:v.x/50,y:v.y/50,z:v.z/50};
   },
   // GET_CHAR_HEIGHT_ABOVE_GROUND (0x0819, unreversed; AUTHORED): the ped's position, its origin a unit over its feet,
   // less the ground FindGroundZFor3DCoord finds under it. The parachute script lets him open the canopy above 20.
   getCharHeightAboveGround:handle=>{
    const p=handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.ridingIn(handle)??this.peds.positionOf(handle);
    return p.z-(this.world.groundLevel(p.x,p.y,p.z)??p.z);
   },
   pedSpeed:handle=>(handle===PLAYER_PED_HANDLE?this.world.playerPed().moveSpeed??0:this.world.scriptPedSpeed(this.livePed(handle)))/50,
   pedIsInWater:handle=>handle===PLAYER_PED_HANDLE?this.host('playerInWater','IS_CHAR_IN_WATER')():this.world.scriptPedSubmerged(this.livePed(handle)),
   setPedVisible:(handle,visible)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerVisible','SET_CHAR_VISIBLE')(visible);else this.world.setScriptPedVisible(this.livePed(handle),visible);},
   // CPedIntelligence's task, through the ped the browser built. A task with no browser behaviour yet turns
   // into nothing, and the thread gives up rather than leaving the ped standing as though it had obeyed.
   givePedScriptedTask:(handle,task,opcode)=>{
    // CTaskSimpleHoldEntity on the ped's partial-anim slot: it holds the object from here, and its other tasks go on.
    if(task.kind==='pickUpObject'){this.pickUpObject(handle,task);return;}
    // TASK_EVERYONE_LEAVE_CAR names a car: each ped seated in it takes CTaskComplexLeaveCar for it, the player too.
    if(task.kind==='everyoneLeaveCar'){
     for(const rider of this.peds.ridersOf(task.vehicle))adapter.givePedScriptedTask!(rider,{kind:'leaveCar',vehicle:task.vehicle},opcode);
     if(this.playerCarHandle()===task.vehicle)adapter.givePedScriptedTask!(PLAYER_PED_HANDLE,{kind:'leaveCar',vehicle:task.vehicle},opcode);
     return;
    }
    // CTaskComplexLeaveCarAndFlee (reversed): out of the car, then CTaskComplexSmartFleePoint from the point, 60 units
    // safe and 1,000,000 ms long. (A boat's rider first runs to a point behind it, which is not followed.)
    if(task.kind==='leaveCarAndFlee'&&handle!==PLAYER_PED_HANDLE){
     this.livePed(handle);this.dropRunner(handle);
     this.runSequence(handle,[{kind:'leaveCar',vehicle:task.vehicle},{kind:'smartFleePoint',x:task.x,y:task.y,z:task.z,radius:60,time:1_000_000}],false,opcode,false);
     return;
    }
    // CTaskSimpleGangDriveBy: a ped with a car handle target fires at the car, else at the ped a handle names, else at
    // the point. A ped not riding, or the player, is left as it is.
    // CTaskComplexShuffleSeats (reversed; the CAR_SHUFFLE clip is not played): across the car, the front right to the
    // driver's seat and back, the rear right to the rear left and back, when that seat is free.
    if(task.kind==='shuffleToNextCarSeat'){
     if(handle===PLAYER_PED_HANDLE)return;
     this.livePed(handle);const ride=this.peds.rideOf(handle);
     if(!ride||ride.vehicle!==task.vehicle||ride.offset)return;
     const to=ride.seat==='driver'?0:ride.seat===0?'driver':ride.seat===1?2:ride.seat===2?1:undefined;if(to===undefined)return;
     const free=to==='driver'?this.peds.driverOf(task.vehicle)===undefined&&this.playerCarHandle()!==task.vehicle:!this.peds.seatTaken(task.vehicle,to);
     if(free)this.peds.warpIntoCar(handle,task.vehicle,to);
     return;
    }
    // Any other primary task takes the rider's drive-by from it.
    if(task.kind!=='driveBy'&&task.kind!=='useMobilePhone'&&handle!==PLAYER_PED_HANDLE&&this.peds.exists(handle)){const e=this.peds.entity(handle);if(e!==undefined)this.world.clearScriptPedDriveBy?.(e);}
    if(task.kind==='driveBy'){
     if(handle===PLAYER_PED_HANDLE)return;
     const target=task.targetVehicle>=0?{kind:'vehicle' as const,handle:task.targetVehicle}:task.targetPed>=0?{kind:'ped' as const,handle:task.targetPed}:{kind:'point' as const,x:task.x,y:task.y,z:task.z};
     this.runners.delete(handle);this.world.setScriptPedDriveBy?.(this.livePed(handle),target,task.radius,task.fireRate,task.rightHandCarSeat);return;
    }
    // A new primary task replaces whatever sequence the ped was running from here.
    if(handle!==PLAYER_PED_HANDLE&&task.kind!=='useMobilePhone')this.dropRunner(handle);
    // CTaskComplexEnterCar::CreateFirstSubTask (reversed): a ped already in the car it is told to enter sits on
    // (CTaskSimpleCarDriveTimed) and the task is over, in whatever seat it has. SWEET3 makes its homies in Sweet's car
    // and then tells them to enter it in other seats: they stay where they were made.
    if((task.kind==='enterCarAsPassenger'||task.kind==='enterCarAsDriver')&&handle!==PLAYER_PED_HANDLE){
     const ride=this.peds.rideOf(handle);
     if(ride&&!ride.offset&&ride.vehicle===task.vehicle)return;
    }
    if((task.kind==='leaveCar'||task.kind==='leaveAnyCar'||task.kind==='leaveCarImmediately')&&handle!==PLAYER_PED_HANDLE){this.livePed(handle);this.runSequence(handle,[task],false,opcode,false);return;}
    // CTaskComplexUseMobilePhone is a secondary task: it does not take the ped's primary task or its task record.
    if(task.kind==='useMobilePhone'){this.host('usePedMobilePhone','TASK_USE_MOBILE_PHONE')(handle===PLAYER_PED_HANDLE?'player':this.livePed(handle),task.start);return;}
    if(CAR_TASKS.has(task.kind)&&handle!==PLAYER_PED_HANDLE){
     this.livePed(handle);
     // At the named car's wheel the drive begins now; on foot, CTaskComplexCarDrive gets in first.
     const ride=this.peds.rideOf(handle),atWheel=!!ride&&!ride.offset&&ride.seat==='driver'&&'vehicle' in task&&(ride.vehicle===task.vehicle||task.vehicle===-1);
     // No car (-1) is the one the ped drives.
     if(atWheel&&'vehicle' in task&&task.vehicle===-1)task={...task,vehicle:ride.vehicle};
     if(atWheel){this.startCarTask(handle,task,opcode);this.recordTask(handle,opcode,false);this.drivingTasks.add(handle);}
     else this.runSequence(handle,[task],false,opcode,false);
     return;
    }
    const order=scriptedPedOrder(task,this.taskWorld(handle));
    if(!order){
     // A task run as several orders (see standInOrders) goes as a sequence of them.
     const several=this.standInOrders(handle,task,this.taskWorld(handle));
     if(!several)throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
     if(handle===PLAYER_PED_HANDLE){this.givePlayer(several,false,opcode,true);return;}
     this.world.giveScriptPedSequence(this.livePed(handle),several,false,0);this.recordTask(handle,opcode,false);return;
    }
    if(handle===PLAYER_PED_HANDLE){this.givePlayer([order],false,opcode);return;}
    // A ped in a car runs an on-foot task from here: out of the car first, or in its seat.
    const ride=this.peds.rideOf(handle);
    if(ride&&!ride.offset&&order.kind!=='wander'){this.livePed(handle);this.runSequence(handle,[task],false,opcode,false);return;}
    this.world.giveScriptPedOrder(this.livePed(handle),order);
    this.recordTask(handle,opcode,order.kind==='wander');
   },
   // CTaskComplexSequence: every task in the sequence has to be one the browser runs, because a sequence with
   // a hole in it is not the sequence the script asked for.
   givePedSequence:(handle,sequenceTasks,repeat,opcode,from)=>{
    const {tasks,steps,start}=this.expandSequence(sequenceTasks,from);
    if(steps)this.sequenceSteps.set(handle,steps);else this.sequenceSteps.delete(handle);
    const world=this.taskWorld(handle);
    const orders:ScriptedPedOrder[]=[],orderSteps:{outer:number;inner:number}[]=[];let standIns=false,orderStart=start;
    const carTasks=handle!==PLAYER_PED_HANDLE&&tasks.some(task=>CAR_TASKS.has(task.kind));
    tasks.forEach((task,index)=>{
     if(carTasks&&CAR_TASKS.has(task.kind))return;
     if(index===start)orderStart=orders.length;
     const order=scriptedPedOrder(task,world),several=order?[order]:this.standInOrders(handle,task,world);
     if(!several)throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
     if(!order)standIns=true;
     for(const one of several){orders.push(one);orderSteps.push(steps?.[index]??{outer:index,inner:-1});}
    });
    // A step run as several orders keeps the sequence's own numbering for GET_SEQUENCE_PROGRESS.
    if(standIns)this.sequenceSteps.set(handle,orderSteps);
    if(handle===PLAYER_PED_HANDLE){this.givePlayer(orders,repeat,opcode,true,standIns?orderStart:start);return;}
    this.dropRunner(handle);
    const ride=this.peds.rideOf(handle);
    // With a car task in it, or for a ped in a car, the sequence runs from here a task at a time.
    if(carTasks||ride&&!ride.offset){this.livePed(handle);this.runSequence(handle,tasks,repeat,opcode,true,start);return;}
    this.world.giveScriptPedSequence(this.livePed(handle),orders,repeat,start);
    this.recordTask(handle,opcode,false);
   },
   // GET_SEQUENCE_PROGRESS (unreversed): CTaskComplexSequence::m_CurrentTaskIndex of the ped's running sequence, -1 with none.
   pedSequenceProgress:handle=>this.sequenceStep(handle).outer,
   getSequenceProgressRecursive:handle=>{const step=this.sequenceStep(handle);return {p2:step.outer,p3:step.inner};},
   // CCarCtrl::CreateCarForScript through the pool, which hands the script a handle at once.
   // CCarCtrl::CreateCarForScript builds the car at once, and its CreateInstance takes ms_compsToUse and resets both
   // slots to -2; the car here is built later, so the pair goes with it.
   createCar:(model,x,y,z)=>{
    const comps=this.componentsToUse;this.componentsToUse=undefined;
    const handle=comps?this.vehicles.create(model,{x,y,z},0,()=>this.world.spawnScriptVehicle(model,{x,y,z},0,comps)):this.vehicles.create(model,{x,y,z});
    return this.forCleanup(this.cleanupVehicles,handle);
   },
   // SET_CAR_MODEL_COMPONENTS: CVehicleModelInfo::SetComponentsToUse, the next instance's two extras (-1 none).
   setVehicleModelComponents:(_model,first,second)=>{this.componentsToUse=[first,second];},
   vehicleExists:handle=>handle===PLAYER_VEHICLE_HANDLE?!!this.world.playerPed().vehicle:this.vehicles.exists(handle),
   // A car still being built holds the command that needs it until it is there.
   awaitVehicle:handle=>{if(handle!==PLAYER_VEHICLE_HANDLE&&this.vehicles.exists(handle)&&!this.vehicles.settledFor(handle))throw new ScmEntityPending(`vehicle ${handle}`);},
   // IS_CAR_DEAD (reVC's handler): no vehicle, STATUS_WRECKED, or bIsDrowning. A car still being built is not dead.
   vehicleIsDeadForScript:handle=>{
    if(handle===PLAYER_VEHICLE_HANDLE){const car=this.world.playerPed().vehicle?this.world.playerVehicleEntity?.():undefined;return car===undefined||this.world.scriptVehicleIsDead(car);}
    if(!this.vehicles.exists(handle))return true;
    const car=this.vehicles.entity(handle);
    return car!==undefined&&this.world.scriptVehicleIsDead(car);
   },
   vehiclePosition:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle).position:this.vehicles.positionOf(handle),
   // reVC's SET_CAR_COORDINATES: the point lifted by CEntity::GetDistanceFromCentreOfMassToBaseOfModel, the car
   // teleported there keeping its heading, the space round it cleared (ClearSpaceForMissionEntity), and a car on a
   // mission joined to the roads again from where it now stands. The player's own car (handle 1) moves the same way.
   setVehicleCoordinates:(handle,x,y,z)=>{
    const car=this.vehicleByHandle(handle),at={x,y,z:z+(car!==undefined?this.world.scriptVehicleBaseOffset?.(car)??0:0)};
    if(handle===PLAYER_VEHICLE_HANDLE)this.world.placeScriptVehicle(this.liveVehicle(handle),at,this.playerPose(handle).heading);
    else this.vehicles.setPosition(handle,at,car===undefined?arrived=>this.world.scriptVehicleBaseOffset?.(arrived)??0:undefined);
    if(car!==undefined){this.world.clearSpaceForScriptVehicle?.(car);this.world.rejoinScriptVehicleRoads?.(car);}
   },
   vehicleHeading:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle).heading:this.vehicles.headingOf(handle),
   setVehicleHeading:(handle,degrees)=>{
    if(handle===PLAYER_VEHICLE_HANDLE)this.world.placeScriptVehicle(this.liveVehicle(handle),this.playerPose(handle).position,degrees);
    else this.vehicles.setHeading(handle,degrees);
   },
   deleteVehicle:handle=>{this.cleanupVehicles.delete(handle);this.vehicles.delete(handle);},
   markVehicleNoLongerNeeded:handle=>{this.cleanupVehicles.delete(handle);this.releaseVehicle(handle);},
   // CMissionCleanup::Process: what the mission made and still holds is let go, and the camera put back behind the
   // player (TheCamera.Restore).
   missionCleanUp:()=>{
    for(const handle of this.cleanupVehicles)if(this.vehicles.exists(handle))this.releaseVehicle(handle);
    for(const handle of this.cleanupPeds)if(this.peds.exists(handle))this.peds.markNoLongerNeeded(handle);
    this.cleanupVehicles.clear();this.cleanupPeds.clear();
    this.runtime.game.objects.cleanUpMissionObjects();this.cutsceneThread=undefined;
    for(let slot=1;slot<=MISSION_AUDIO_COUNT;slot++)this.world.scriptSpeech?.stop(slot);
    this.runtime.game.camera.restore(this.world.playerCameraState());
   },
   // The player's own car (not one the script made) answers from the host.
   vehicleModel:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle),
   // CPlayerInfo's two-wheel, wheelie and stoppie counters are kept by the unreversed CPlayerInfo::Process and the
   // vehicles' ProcessControl, which the port does not measure: no stunt is ever under way or on record, so the
   // stunt-bonus script (HJ) reads zeros and the wheelie questions (reversed, over those counters) answer no.
   // IS_CAR_IN_AIR_PROPER (VehicleCommands.cpp, reversed): nothing it collides with is a building or a vehicle. The
   // host answers for the player's own vehicle; a car the script made is not measured.
   vehicleIsInAirProper:handle=>{
    if(handle!==PLAYER_VEHICLE_HANDLE)return this.host('scriptVehicleInAirProper','IS_CAR_IN_AIR_PROPER')(this.liveVehicle(handle));
    const v=this.playerVehicle(handle);if(!v.inAirProper)throw new UnsupportedScmCommand(-1,0,'IS_CAR_IN_AIR_PROPER',`vehicle ${handle}`);return v.inAirProper();
   },
   // IS_CAR_UPRIGHT's handler is not reversed: the car is upright unless it lies on its roof (its up axis below the
   // horizontal), as the command is documented.
   isCarUpright:handle=>(handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle))).up.z>=0,
   // EXPLODE_CHAR_HEAD (CharacterCommands.cpp): CEventDamage with WEAPON_SNIPERRIFLE on PED_PIECE_HEAD, 1000 through
   // CPedDamageResponseCalculator, from no one.
   explodePedHead:handle=>{if(handle===PLAYER_PED_HANDLE)throw new UnsupportedScmCommand(-1,0,'EXPLODE_CHAR_HEAD','the player');this.host('explodeScriptPedHead','EXPLODE_CHAR_HEAD')(this.livePed(handle));},
   // CPlayerPed::ForceGroupToAlwaysFollow (PlayerCommands.cpp): the player's group keeps following whatever he does.
   forcePlayerGroupToAlwaysFollow:(_player,enable)=>{this.playerGroupAlwaysFollows=enable;},
   // CPlayerPed's m_bGroupNeverFollow, which TellGroupToStartFollowingPlayer checks as the always flag is checked.
   setPlayerGroupToFollowNever:(_player,state)=>{this.playerGroupNeverFollows=state;},
   // GET_DEAD_CHAR_COORDINATES: the car a ped sits in, else its pelvis bone (BONE_PELVIS), where a body lies rather
   // than where its root was left.
   // IS_ANY_PICKUP_AT_COORDS: TestForPickupsInBubble half a unit round the point (reVC's handler).
   anyPickupAtCoords:(x,y,z)=>this.host('pickupsInBubble','IS_ANY_PICKUP_AT_COORDS')({x,y,z},.5),
   // GET_DEAD_CHAR_PICKUP_COORDS: CPed::CreateDeadPedPickupCoors round the ped.
   deadPedPickupCoordinates:handle=>{
    const at=handle===PLAYER_PED_HANDLE?this.world.playerPed().position:(this.livePed(handle),this.peds.positionOf(handle));
    return this.deadPedPickupCoordsAt(at,'GET_DEAD_CHAR_PICKUP_COORDS');
   },
   deadPedCoordinates:handle=>{
    const ride=handle===PLAYER_PED_HANDLE?undefined:this.peds.rideOf(handle);
    if(ride&&!ride.offset&&this.vehicles.exists(ride.vehicle))return this.vehicles.positionOf(ride.vehicle);
    if(handle===PLAYER_PED_HANDLE&&this.world.playerPed().vehicle)return this.world.playerPed().position;
    if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);
    return this.pedBoneFrame(handle,1)?.position??(handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.positionOf(handle));
   },
   // CPed::bIsTargetPriority and bStayInCarOnJack's bike twin (m_nPedFlags): the ped's flags, kept on it.
   setPedIsTargetPriority:(handle,state)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFlag(this.livePed(handle),'targetPriority',state);},
   setFreeHealthCare:(_player,on)=>{this.host('setFreeHealthCare','SET_FREE_HEALTH_CARE')(on);},
   setPedCanBeKnockedOffBike:(handle,stayOnBike)=>{if(handle===PLAYER_PED_HANDLE)this.runtime.game.playerInfo.stayOnBike=stayOnBike;else this.world.setScriptPedFlag(this.livePed(handle),'stayOnBike',stayOnBike);},
   // The car's own fields the script sets that the browser's cars keep but do not act on: the heli's rotor speed,
   // CVehicle's status, and CAutomobile::m_fCarTraction.
   setHeliBladesFullSpeed:handle=>{(this.liveVehicle(handle) as {rotorFullSpeed?:boolean}).rotorFullSpeed=true;},
   // DISABLE_HELI_AUDIO: the vehicle audio entity's EnableHelicoptor (true) or DisableHelicoptor (false), kept on the
   // helicopter for its audio (DES3 turns its helicopter's back on).
   setHeliAudio:(handle,enabled)=>{(this.liveVehicle(handle) as {heliAudioDisabled?:boolean}).heliAudioDisabled=!enabled;},
   setVehicleStatus:(handle,status)=>{(this.liveVehicle(handle) as {scriptStatus?:number}).scriptStatus=status;},
   setVehicleTraction:(handle,traction)=>{(this.liveVehicle(handle) as {carTraction?:number}).carTraction=traction;},
   // POINT_CAMERA_AT_CAR and POINT_CAMERA_AT_CHAR: CCamera::TakeControl on the entity for the script (2).
   pointCameraAtVehicle:(handle,mode,switchType)=>{if(handle!==PLAYER_VEHICLE_HANDLE)this.liveVehicle(handle);this.runtime.game.camera.takeControl({kind:'vehicle',handle},mode,switchType,2);},
   pointCameraAtPed:(handle,_isPlayer,mode,switchType)=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);this.runtime.game.camera.takeControl({kind:'ped',handle},mode,switchType,2);},
   // SET_CAR_STRAIGHT_LINE_DISTANCE: CAutoPilot::m_nStraightLineDistance, which FindSwitchDistanceClose reads.
   setVehicleStraightLineDistance:(handle,distance)=>{this.host('setScriptVehicleStraightLineDistance','SET_CAR_STRAIGHT_LINE_DISTANCE')(this.liveVehicle(handle),distance);},
   // IS_CAR_UPSIDEDOWN's handler is unreversed; CVehicle::IsUpsideDown (0x6D1D90) is the car's up axis at or below -0.9.
   vehicleIsUpsideDown:handle=>(handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle))).up.z<=-.9,
   // GET_DRIVER_OF_CAR: m_pDriver's handle, or -1 with nobody driving. The player drives the car it is in.
   vehicleDriver:handle=>handle===PLAYER_VEHICLE_HANDLE?(this.world.playerPed().vehicle?PLAYER_PED_HANDLE:-1):this.playerCarHandle()===handle?PLAYER_PED_HANDLE:this.peds.driverOf(handle)??-1,
   // ADD_ARMOUR_TO_CHAR: m_fArmour plus the amount, up to CPlayerInfo::m_nMaxArmour for the player and 100 for anyone
   // else (the handler is unreversed; the armour pickup caps the player the same way). Script peds keep the figure,
   // which the browser's ped damage does not yet spend.
   addArmourToPed:(handle,amount)=>{
    if(handle===PLAYER_PED_HANDLE){
     if(!this.world.playerArmour||!this.world.setPlayerArmour)throw new UnsupportedScmCommand(-1,0,'ADD_ARMOUR_TO_CHAR','no host');
     this.world.setPlayerArmour(Math.min(Math.max(this.world.playerArmour()+amount,0),this.runtime.game.playerInfo.maxArmour));
    }else this.peds.setArmour(handle,Math.min(Math.max(this.peds.armourOf(handle)+amount,0),100));
   },
   // RANDOM_PASSENGER_SAY: a passenger's speech line (CAEPedSpeechAudioEntity); the speech banks are not published.
   randomPassengerSay:()=>{},
   getWheelieStats:()=>({twoWheelsTime:0,twoWheelsDistance:0,wheelieTime:0,wheelieDistance:0,stoppieTime:0,stoppieDistance:0}),
   isPlayerPerformingWheelie:()=>false,isPlayerPerformingStoppie:()=>false,
   vehicleModelIs:(handle,model)=>(handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle))===model,
   vehicleHealth:handle=>this.world.scriptVehicleHealth(this.liveVehicle(handle)),
   setVehicleHealth:(handle,health)=>{this.world.setScriptVehicleHealth(this.liveVehicle(handle),health);},
   vehicleSpeed:handle=>this.world.scriptVehicleSpeed(this.liveVehicle(handle)),
   // IS_CAR_IN_WATER (unreversed): the car's in-water flag, as Vice City's handler reads bIsInWater.
   vehicleIsInWater:handle=>{if(!this.world.scriptVehicleInWater)throw new UnsupportedScmCommand(-1,0,'IS_CAR_IN_WATER','no host');return this.world.scriptVehicleInWater(this.liveVehicle(handle));},
   vehicleIsStopped:handle=>this.world.scriptVehicleStopped(this.liveVehicle(handle)),
   vehicleIsOnFire:handle=>this.world.scriptVehicleOnFire(this.liveVehicle(handle)),
   vehicleIsOnScreen:handle=>this.world.scriptVehicleOnScreen(this.liveVehicle(handle)),
   explodeVehicle:handle=>{this.world.explodeScriptVehicle(this.liveVehicle(handle));},
   fixCar:handle=>{this.world.fixScriptVehicle(this.liveVehicle(handle));},
   carBeenResprayed:handle=>{const car=this.liveVehicle(handle);const had=this.resprayedCars.has(car as object);this.resprayedCars.delete(car as object);return had;},
   setVehicleVisible:(handle,state)=>{this.world.setScriptVehicleVisible(this.liveVehicle(handle),state);},
   setVehicleAreaVisible:(handle,area)=>{this.host('setScriptVehicleArea','SET_VEHICLE_AREA_VISIBLE')(this.liveVehicle(handle),area);},
   setVehicleProofs:(handle,proofs)=>{this.world.setScriptVehicleProofs(this.liveVehicle(handle),proofs);},
   setVehicleCanBeDamaged:(handle,canBeDamaged)=>{this.world.setScriptVehicleCanBeDamaged(this.liveVehicle(handle),canBeDamaged);},
   // CVehicle::m_nDoorLock and CanPedOpenLocks for the player: CARLOCK_LOCKED (2), LOCKOUT_PLAYER_ONLY (3),
   // LOCKED_PLAYER_INSIDE (4), COP_CAR (5) and SKIP_SHUT_DOORS (7) keep him out; NOT_USED (0), UNLOCKED (1) and
   // FORCE_SHUT_DOORS (6) let him open the door. Whether he may get in is all the browser keeps of the field.
   setVehicleDoorLock:(handle,lock)=>{this.world.setScriptVehicleDoorLock(this.liveVehicle(handle),playerLockedOut(lock));},
   // SWITCH_CAR_SIREN and SET_CAR_CAN_BE_VISIBLY_DAMAGED set the flags on the car; SET_TIME_SCALE sets
   // CTimer::ms_fTimeScale, the one the speed cheats and the stunt slow motion also write.
   switchVehicleSiren:(handle,on)=>{this.host('setScriptVehicleSiren','SWITCH_CAR_SIREN')(this.liveVehicle(handle),on);},
   setVehicleCanBeVisiblyDamaged:(handle,state)=>{this.host('setScriptVehicleCanBeVisiblyDamaged','SET_CAR_CAN_BE_VISIBLY_DAMAGED')(this.liveVehicle(handle),state);},
   setTimeScale:scale=>{this.host('setTimeScale','SET_TIME_SCALE')(scale);},
   // OPEN_CAR_DOOR swings the door fully open and OPEN_CAR_DOOR_A_BIT to a ratio, through CAutomobile::OpenDoor with
   // no ped and the sound on. The index is eDoors: bonnet, boot, then the front and rear doors left and right.
   // DOES_CAR_HAVE_HYDRAULICS reads handlingFlags.bHydraulicInst; SET_CAR_HYDRAULICS fits or removes the upgrade.
   // CONTROL_CAR_HYDRAULICS: hydraulicData.m_aWheelSuspension, which HydraulicControl reads for a mission car an AI
   // drives and clears after each step. A car without the hydraulics has no special collision model to move.
   controlVehicleHydraulics:(handle,frontLeft,rearLeft,frontRight,rearRight)=>{this.world.setScriptVehicleHydraulicLevels?.(this.liveVehicle(handle),{frontLeft,rearLeft,frontRight,rearRight});},
   resetVehicleHydraulics:handle=>{this.world.setScriptVehicleHydraulicLevels?.(this.liveVehicle(handle),null);},
   vehicleHasHydraulics:handle=>this.host('scriptVehicleHasHydraulics','DOES_CAR_HAVE_HYDRAULICS')(this.liveVehicle(handle)),
   setVehicleHydraulics:(handle,state)=>{this.host('setScriptVehicleHydraulics','SET_CAR_HYDRAULICS')(this.liveVehicle(handle),state);},
   // IS_CAR_LOW_RIDER: handlingFlags.bLowRider (0x2000000).
   isCarLowRider:handle=>(this.host('scriptVehicleHandlingFlags','IS_CAR_LOW_RIDER')(this.liveVehicle(handle))&HANDLING_LOW_RIDER)!==0,
   // IS_CAR_STREET_RACER: handlingFlags.bStreetRacer (0x4000000).
   isCarStreetRacer:handle=>(this.host('scriptVehicleHandlingFlags','IS_CAR_STREET_RACER')(this.liveVehicle(handle))&HANDLING_STREET_RACER)!==0,
   availableVehicleMod:(handle,index)=>{const tables=this.host('vehicleUpgradeTables','GET_AVAILABLE_VEHICLE_MOD')();const model=this.vehicleModelNumber(handle);return tables&&model!==undefined?tables.upgradesOf(model)[index]??-1:-1;},
   vehicleModType:model=>{const tables=this.host('vehicleUpgradeTables','GET_VEHICLE_MOD_TYPE')();return tables&&typeof model==='number'?tables.modSlotOf(model):0;},
   numAvailablePaintjobs:handle=>{const tables=this.host('vehicleUpgradeTables','GET_NUM_AVAILABLE_PAINTJOBS')();const model=this.vehicleModelNumber(handle);return tables&&model!==undefined?tables.remapCount(model):0;},
   numCarColours:handle=>{const tables=this.host('vehicleUpgradeTables','GET_NUM_CAR_COLOURS')();const model=this.vehicleModelNumber(handle);return tables&&model!==undefined?tables.colourCount(model):0;},
   currentVehiclePaintjob:handle=>this.host('scriptVehiclePaintjob','GET_CURRENT_VEHICLE_PAINTJOB')(this.liveVehicle(handle)),
   // IS_BIG_VEHICLE: vehicleFlags.bIsBig, which the vehicle takes from its handling's model flags (IS_BIG, 0x8).
   isBigVehicle:handle=>(this.host('scriptVehicleModelFlags','IS_BIG_VEHICLE')(this.liveVehicle(handle))&MODEL_FLAG_IS_BIG)!==0,
   // IS_EMERGENCY_SERVICES_VEHICLE: CVehicle::IsLawEnforcementVehicle, or the Fire Truck (407), its ladder truck (544)
   // or the Ambulance (416).
   isEmergencyServicesVehicle:handle=>{
    const model=this.vehicleModelNumber(handle);
    return model!==undefined&&(LAW_ENFORCEMENT_MODELS.has(model)||model===407||model===544||model===416);
   },
   // SET_VEHICLE_DIRT_LEVEL: m_fDirtLevel, which the dirt texture blend reads (0 to 15).
   setVehicleDirtLevel:(handle,level)=>{this.host('setScriptVehicleDirtLevel','SET_VEHICLE_DIRT_LEVEL')(this.liveVehicle(handle),Math.max(0,Math.min(15,level)));},
   // IS_CHAR_IN_TAXI: the model of the car the ped is in (the player's own included), nothing on foot.
   pedVehicleModelId:handle=>this.pedVehicleModel(handle),
   // CVehicle::IsLawEnforcementVehicle on the vehicle the ped rides, by its model.
   pedVehicleIsLawEnforcement:handle=>{const model=this.pedVehicleModel(handle);return model!==undefined&&LAW_ENFORCEMENT_MODELS.has(model);},
   playerIsUsingJetpack:()=>this.host('playerUsingJetpack','IS_PLAYER_USING_JETPACK')(),
   // CGameLogic::bPenaltyForDeathApplies and bPenaltyForArrestApplies.
   switchDeathPenalties:state=>{this.host('setDeathPenalties','SWITCH_DEATH_PENALTIES')(state);},
   switchArrestPenalties:state=>{this.host('setArrestPenalties','SWITCH_ARREST_PENALTIES')(state);},
   openVehicleDoor:(handle,door)=>{if(door>=0&&door<6)this.host('openScriptVehicleDoor','OPEN_CAR_DOOR')(this.liveVehicle(handle),door,1);},
   openVehicleDoorABit:(handle,door,ratio)=>{if(door>=0&&door<6)this.host('openScriptVehicleDoor','OPEN_CAR_DOOR_A_BIT')(this.liveVehicle(handle),door,ratio);},
   // SET_CHAR_COLLISION (0x619, CharacterCommands SetCharCollision): CEntity::SetUsesCollision.
   setPedCollision:(handle,uses)=>{
    if(handle===PLAYER_PED_HANDLE)this.host('setPlayerCollision','SET_CHAR_COLLISION')(uses);
    else this.host('setScriptPedCollision','SET_CHAR_COLLISION')(this.livePed(handle),uses);
   },
   vehicleExistsByHandle:handle=>handle===PLAYER_VEHICLE_HANDLE?!!this.world.playerPed().vehicle:this.vehicles.exists(handle),
   playerCity:()=>this.world.playerCity(),
   // CAEScriptAudioEntity's slots: the line streams in while the script waits on HAS_MISSION_AUDIO_LOADED, and runs
   // for its own length; without one, a line is sized from its subtitle.
   loadMissionAudio:(slot,sample)=>{
    const speech=this.world.scriptSpeech,audio=this.runtime.game.missionAudio,bank=scriptBankOfSample(sample);
    // A whole bank (the gym's, the casino games', the cranes'...) for the mission-bank sounds its reports play; the slot
    // stays loading until the bank is in, as the script's HAS_MISSION_AUDIO_LOADED loop waits on it.
    if(bank!==undefined){
     if(bank!==SCRIPT_BANK_NULL&&this.world.loadMissionBank&&audio.stream(slot,sample))void this.world.loadMissionBank(slot-1,bank).then(()=>audio.streamed(slot,sample));
     return;
    }
    this.world.clearMissionBank?.(slot-1);
    if(speech&&audio.stream(slot,sample))void speech.load(sample,slot).then(()=>audio.streamed(slot,sample));
   },
   playMissionAudio:slot=>{const sample=this.runtime.game.missionAudio.slots[slot-1]?.audioEvent;if(sample!==undefined&&sample>=0)this.world.scriptSpeech?.play(slot,sample);},
   clearMissionAudio:slot=>{this.world.scriptSpeech?.stop(slot);this.world.clearMissionBank?.(slot-1);},
   missionAudioLengthMs:(sample,subtitle)=>this.world.scriptSpeech?.lengthMs(sample)??(subtitle?speechLengthMs(gxtText(subtitle,'')):undefined),
   loadMissionText:name=>{this.missionText=name;this.world.loadMissionText(name);},
   buildPlayerModel:()=>{this.playerModelsBuilt++;this.world.buildPlayerModel();},
   stopAllLawEnforcers:()=>{this.world.stopAllLawEnforcers();},
   makePlayerSafe:(_player,safe,radius)=>{this.world.makePlayerSafe(safe,radius);},
   setAllVehiclesCanBeDamaged:state=>{this.world.setAllVehiclesCanBeDamaged?.(state);},
   switchPoliceHelis:state=>{this.world.switchPoliceHelis?.(state);},
   setScriptLimitToGangSize:size=>{this.world.setScriptLimitToGangSize?.(size);},
   setGangWarsActive:state=>{this.world.setGangWarsActive?.(state);},
   syncWater:()=>{this.world.syncWater?.();},
   // Only the player's group follows the browser's own rules; the script's other groups keep the range in their record.
   setGroupSeparationRange:(group,range)=>{this.group(group).separationRange=range;if(group===PLAYER_GROUP_HANDLE)this.world.setPlayerGroupSeparationRange?.(range);},
   // CREATE_SCRIPT_ROADBLOCK's handler is unreversed; the port reads its type as RegisterScriptRoadBlock's gang flag.
   createScriptRoadblock:(ax,ay,az,bx,by,bz,type)=>{this.world.registerScriptRoadblock?.({x:ax,y:ay,z:az},{x:bx,y:by,z:bz},type!==0);},
   clearAllScriptRoadblocks:()=>{this.world.clearScriptRoadblocks?.();},
   setPlayerMaxHealth:(_player,maxHealth)=>{this.world.setPlayerMaxHealth(maxHealth);},
   setPlayerMaxArmour:(_player,maxArmour)=>{this.world.setPlayerMaxArmour(maxArmour);},
   setVisibilityOfClosestObjectOfType:(x,y,z,radius,m,visible)=>{this.objectVisibilities++;this.closestObjectOfTypeFlag(x,y,z,radius,m,'visible',visible);},
   setUsesCollisionOfClosestObjectOfType:(x,y,z,radius,m,state)=>{this.closestObjectOfTypeFlag(x,y,z,radius,m,'collision',state);},
   setClosestEntryExitFlag:(x,y,radius,flag,on)=>{this.entryExitFlags++;this.world.setClosestEntryExitFlag(x,y,radius,flag,on);},
   switchEntryExit:(name,on)=>{this.entryExitFlags++;this.world.switchEntryExit(name,on);},
   setNamedEntryExitFlag:(name,flag,on)=>{this.entryExitFlags++;this.host('setNamedEntryExitFlag','SET_NAMED_ENTRY_EXIT_FLAG')(name,flag,on);},
   enableBurglaryHouses:on=>{this.world.enableBurglaryHouses(on);},
   disableAllEntryExits:disabled=>{this.world.disableAllEntryExits(disabled);},
   // CPlayerInfo::IsRestartingAfterDeath / IsRestartingAfterArrest (DoDeathArrestCheck), IS_PLAYER_PLAYING and
   // IS_PLAYER_DEAD, all on m_nPlayerState: a mission is failed and cleaned up by the wasted or busted it sees.
   isPlayerRestarting:()=>{const state=this.world.playerState?.();return state==='dead'||state==='arrested';},
   isPlayerPlaying:()=>(this.world.playerState?.()??'playing')==='playing',
   isPlayerDead:()=>this.world.playerState?.()==='dead',
   clearSmallMessages:()=>{},
   isDrawingMap:()=>false,
  };
  // Script handles start clear of the player's own, which is 1 for him and for the car he drives.
  this.peds=new ScmPedPool<unknown>({
   spawn:(pedType,model,position)=>{
    const wait=this.nextPedWaitsForCollision;
    return this.world.spawnScriptPed(pedType,this.pedModel(model),position).then(ped=>{if(ped&&wait)this.world.scriptPedWaitForCollision?.(ped);return ped;});
   },
   // A ped made in a car the browser is still building waits for the car.
   spawnInCar:async(pedType,model,vehicle,seat)=>this.world.spawnScriptPedInCar(pedType,this.pedModel(model),await this.vehicleOrPlayer(vehicle),seat),
   spawnRandomInCar:async(vehicle,seat)=>this.world.spawnScriptRandomPedInCar(await this.vehicleOrPlayer(vehicle),seat),
   spawnOnCar:async(pedType,model,vehicle,offset,turret)=>this.world.spawnScriptPedOnCar(pedType,this.pedModel(model),await this.vehicleOrPlayer(vehicle),offset,turret),
   place:(ped,position)=>{this.world.placeScriptPed(ped,position);},
   setHeading:(ped,degrees)=>{this.world.setScriptPedHeading(ped,degrees);},
   positionOf:ped=>this.world.scriptPedPosition(ped),
   headingOf:ped=>this.world.scriptPedHeading(ped),
   healthOf:ped=>this.world.scriptPedHealth(ped),
   setHealth:(ped,health)=>{this.world.setScriptPedHealth(ped,health);},
   kill:ped=>{this.world.killScriptPed(ped);},
   setAccuracy:(ped,accuracy)=>{this.world.setScriptPedAccuracy(ped,accuracy);},
   setShootingRate:(ped,rate)=>{this.world.setScriptPedShootingRate?.(ped,rate);},
   setInvulnerable:(ped,enabled)=>{this.world.setScriptPedInvulnerable(ped,enabled);},
   setAnimGroup:(ped,group)=>this.world.setScriptPedAnimGroup?.(ped,group)??false,
   setProofs:(ped,proofs)=>{this.world.setScriptPedProofs(ped,proofs);},
   giveWeapon:(ped,weaponType,ammo)=>{this.world.giveScriptPedWeapon(ped,weaponType,ammo);},
   aliveOf:ped=>this.world.scriptPedAlive(ped),
   remove:ped=>{this.world.removeScriptPed(ped);},
   release:(ped,keepTask)=>{this.world.releaseScriptPed(ped,keepTask);},
  },SCRIPT_PED_FIRST_HANDLE);
  this.vehicles=new ScmVehiclePool<unknown>({
   spawn:(model,position,heading)=>this.world.spawnScriptVehicle(model,position,heading),
   place:(car,position,heading)=>{this.world.placeScriptVehicle(car,position,heading);},
   positionOf:car=>this.world.scriptVehiclePosition(car),
   headingOf:car=>this.world.scriptVehicleHeading(car),
   aliveOf:car=>this.world.scriptVehicleAlive(car),
   remove:car=>{this.world.removeScriptVehicle(car);},
  },SCRIPT_VEHICLE_FIRST_HANDLE);
  this.adapterRef=adapter;
  const {runtime,header}=ScmRuntime.load(script,adapter,this.random);
  this.runtime=runtime;
  // CAECutsceneTrackManager's channel: the beat tracks and the mission-passed tune are heard through the host.
  runtime.game.cutsceneTrack.stream=this.world.beatTracks;runtime.game.cutsceneTrack.audio=this.world.trackAudio;
  // CVehicleRecording's host side: files streamed from carrec.img, and the cars playbacks move.
  // CGarage's slides report to the garage's own door audio at its first door (FindDoorsWithGarage); a garage with no
  // door object found has none to sound.
  runtime.game.garages.onDoorSound=(garage,event)=>{
   if(!this.world.garageDoorSound)return;
   for(const door of this.garageDoors.values())if(door.garage===garage&&runtime.game.objects.exists(door.handle)){this.world.garageDoorSound(garage.name,event,{...runtime.game.objects.at(door.handle).position});return;}
  };
  // CPathFind's switches reach the host's loaded path nodes as they are made.
  runtime.game.nodeSwitches.onSwitch=(area,isOff,isCars,backToOriginal)=>{this.world.switchPathNodes?.(area,isOff,isCars,backToOriginal);};
  const recordings=runtime.game.vehicleRecordings;
  recordings.onRequest=fileNumber=>{this.world.requestCarRecording?.(fileNumber,loaded=>{recordings.loadRecordingFile(loaded);});};
  if(this.world.carRecordingVehicle)runtime.game.carRecordingVehicles={
   frames:fileNumber=>this.world.carRecordingFrames?.(fileNumber),
   // A car the script lets go of (MARK_CAR_AS_NO_LONGER_NEEDED, or a death or arrest's cleanup) is still in the world
   // with its playback running, as the pool handle still names it in the original: the playback keeps its car to the
   // end and gives it its collision force back. Losing it there left a car on a velocity-driven body gliding on for
   // ever at the recording's last speed, through the ground, with whoever rode in it.
   vehicle:handle=>{
    let car=this.vehicleByHandle(handle);
    if(car!==undefined)this.recordedCars.set(handle,car);
    else{car=this.recordedCars.get(handle);if(car!==undefined&&(car as {disposed?:boolean}).disposed){this.recordedCars.delete(handle);car=undefined;}}
    return car===undefined?undefined:this.world.carRecordingVehicle?.(car);
   },
  };
  // CShopping's reach outside the script: the model table, the level's price and the player's weapons and armour.
  runtime.game.shopping.host={
   modelIndex:name=>this.world.modelIndex?.(name)??-1,
   level:()=>this.world.playerCity(),
   giveWeapon:(type,ammo)=>{this.world.givePlayerWeapon?.(type,ammo);},
   setCurrentWeapon:type=>{this.world.setPlayerCurrentWeapon?.(type);},
   setArmour:armour=>{this.world.setPlayerArmour?.(armour);},
  };
  // A command whose world member is not ported yet is skipped, and the mission runs on without it (AUTHORED: the
  // original has them all). Before, the thread gave up there and the mission hung or ended half way, so every
  // mission past the first few could not be finished. Each skip is counted for the census and sweep.
  this.runtime.onMissingAdapter=(error,thread)=>{
   const key=`${thread.name}:${error.command}`,entry=this.skipped.get(key);
   if(entry)entry.count++;else this.skipped.set(key,{thread:thread.name,command:error.command,offset:error.offset,count:1});
   return true;
  };
  // A thread that meets an unported command gives up; the others, MAIN among them, keep running.
  this.runtime.onUnsupported=(error,thread)=>{
   // An adapter that cannot answer (offset -1) names what it lacked; the command is the one the thread was running.
   const at=thread.currentInstruction;
   this.gaveUp.push(error.offset<0?{thread:thread.name,command:at.name,offset:at.offset,detail:error.command}:{thread:thread.name,command:error.command,offset:error.offset});
   if(thread.usesMissionCleanup||this.heldByShop(thread))this.handBackPending=true;
   if(thread.usesMissionCleanup)this.missionGaveUp=true;
   this.streamedScriptStopped(thread);
  };
  this.runtime.onThreadError=(error,thread)=>{const at=thread.currentInstruction;this.gaveUp.push({thread:thread.name,command:at.name,offset:at.offset,detail:String(error)});if(thread.usesMissionCleanup||this.heldByShop(thread))this.handBackPending=true;if(thread.usesMissionCleanup)this.missionGaveUp=true;};
  this.runtime.game.zones.load(zones.infoLabels);
  this.entry=header.entry;this.streamedTable=header.streamed;this.largestStreamedSize=header.largestStreamedSize;
 }
 /** Flags a script set on its cars and peds that nothing in the port reads yet (see the vigilante's adapters). */
 private readonly carFlags=new Map<number,{convoy?:boolean;routeSeed?:number;avoidLevelTransitions?:boolean;alwaysSkidMarks?:boolean;providesCover?:boolean}>();
 /** CPlayerInfo's m_bCanShowVitalStats, which SET_PLAYER_DISPLAY_VITAL_STATS_BUTTON sets. */
 displayVitalStatsButton=true;
 private readonly pedFlags=new Map<number,{chrisCriminal?:boolean;forceDieInCar?:boolean;wantedByPolice?:boolean;druggedUp?:boolean;ignoreHeightDifferenceFollowingNodes?:boolean}>();
 private carFlag(handle:number){let f=this.carFlags.get(handle);if(!f){f={};this.carFlags.set(handle,f);}return f;}
 private pedFlag(handle:number){let f=this.pedFlags.get(handle);if(!f){f={};this.pedFlags.set(handle,f);}return f;}
 /** CTheScripts::LastRandomPedId: the street ped GET_RANDOM_CHAR_IN_ZONE handed out last, which it passes over. */
 private lastRandomPed:unknown;
 /** ADD_ATTRACTOR's scripted attractors by handle: the point, the heading (degrees) and the sequence handle. */
 private readonly scriptAttractors=new Map<number,{x:number;y:number;z:number;heading:number;sequence:number}>();
 private attractorSerial=0;
 /** The map's objects a brain has been allocated to, by placement: the CObject handle the brain's script is given,
  * whether the brain's percentage chance came up for it, and the thread running on it. */
 private readonly brainObjects=new Map<string,{handle:number;wanted:boolean;brain:number;thread?:ScmThread;
  /** Where the map has it, and whether the script has since moved it: then the map's copy is taken out and the
   * object is drawn as the script's own (an automatic gate sliding open). */
  home:{x:number;y:number;z:number;heading:number};taken?:boolean}>();
 /** An object a brain's script moved, turned or animated stops being the map's: once a frame while a script holds it. */
 private takeMovedBrainObjects(){
  const objects=this.runtime.game.objects;
  for(const [key,record] of this.brainObjects){
   if(record.taken||!record.thread||!objects.exists(record.handle))continue;
   const o=objects.at(record.handle),h=record.home;
   if(o.position.x===h.x&&o.position.y===h.y&&o.position.z===h.z&&o.heading===h.heading&&!o.anim&&!o.heldBy&&!o.attachedTo)continue;
   if(this.world.takeWorldObject?.(key,true)){record.taken=true;o.worldPlacement=undefined;}
  }
 }
 private nextBrainScan=0;
 /** The map objects brains are allocated to near the player, for the dev API and the browser tests. */
 brainObjectsSnapshot(){
  const objects=this.runtime.game.objects;
  return [...this.brainObjects].map(([key,r])=>({key,handle:r.handle,wanted:r.wanted,running:!!r.thread&&!r.thread.terminated,script:r.thread?.name,
   model:String(objects.exists(r.handle)?objects.at(r.handle).model:''),position:objects.exists(r.handle)?{...objects.at(r.handle).position}:undefined,heading:objects.exists(r.handle)?objects.getHeading(r.handle):undefined}));
 }
 /** CScriptsForBrains' object brains. CheckIfNewEntityNeedsScript, StartOrRequestNewStreamedScriptBrain and
  * IsObjectWithinBrainActivationRange are unreversed, so this is AUTHORED from what ALLOCATE_STREAMED_SCRIPT_TO_OBJECT
  * records and the brain scripts themselves do: a placement of a brain's model near the player is a CObject the
  * script can hold; the brain's chance is drawn for it once; while the player is within the brain's radius and no
  * script runs on it, the streamed script is asked for and started with the object's handle as its first local. The
  * script ends itself once the player leaves the radius, and may be started again when he comes back. */
 private processObjectBrains(nowMs:number){
  if(nowMs<this.nextBrainScan)return;this.nextBrainScan=nowMs+500;
  const game=this.runtime.game,scripts=game.streamedScripts,near=this.world.worldObjectsNear;
  if(!near||!scripts.count)return;
  const brains=game.scriptBrains.brains,models=new Set<string>();let reach=0;
  for(const brain of brains)if(brain.typeOfBrain===BRAIN_OBJECT&&brain.active&&typeof brain.model==='string'){models.add(brain.model.toLowerCase());reach=Math.max(reach,brain.activationRadius);}
  const player=this.world.playerPed().position,seen=new Set<string>();
  if(models.size)for(const found of near(models,player.x,player.y,reach+40)){
   seen.add(found.key);
   let record=this.brainObjects.get(found.key);
   if(!record){
    const index=brains.findIndex(b=>b.typeOfBrain===BRAIN_OBJECT&&typeof b.model==='string'&&b.model.toLowerCase()===found.model.toLowerCase());if(index<0)continue;
    const brain=brains[index],[x,y,z]=found.position;
    const adopted=game.objects.adoptWorld(brain.model!,{x,y,z},found.heading,found.key);
    record={handle:adopted.handle,wanted:this.random.next()%100<brain.percentageChance,brain:index,home:{x,y,z,heading:adopted.heading}};
    this.brainObjects.set(found.key,record);
   }
   const brain=brains[record.brain];
   // A window streamed in since brings the map's copy back: it stays out while the script's own is drawn.
   if(record.taken)this.world.takeWorldObject?.(found.key,true);
   // A script that ended itself (the player left its radius) may start again; one that gave up on a command keeps
   // its thread record unterminated, so it is not started over and over.
   if(!record.wanted||!brain?.active||record.thread&&!record.thread.terminated)continue;
   const [x,y,z]=found.position;
   if(Math.hypot(player.x-x,player.y-y,player.z-z)>brain.activationRadius)continue;
   const index=scripts.properIndexFromScriptIndex(brain.streamedScriptIndex);if(index<0)continue;
   this.adapterRef.requestStreamedScript?.(index);
   record.thread=this.runtime.startNewStreamedScript(index,[record.handle],EXTERNAL_OBJECT_BRAIN)?.thread;
  }
  // A placement that streamed out takes its object with it: the script holding the handle finds it gone and ends.
  for(const [key,record] of this.brainObjects)if(!seen.has(key)){
   game.objects.remove(record.handle);this.brainObjects.delete(key);
   // The map has its own copy back, where it always stood.
   if(record.taken)this.world.takeWorldObject?.(key,false);
  }
 }
 /** The garages' doors as CObjects made from their map placements, by placement key. CGarage::FindDoorsWithGarage
  * is unreversed: as re3's FindDoorsEntities, a garage takes up to two garage-door models within GARAGE_DOOR_REACH of
  * its centre in x and y; a door near two garages goes with the nearer. The map's copy is taken out once the door
  * leaves where the map has it shut, and the object is drawn and collides in its place. */
 private readonly garageDoors=new Map<string,{garage:ScmGarage;handle:number;home:{x:number;y:number;z:number};heading:number;height?:number;applied?:number;taken:boolean}>();
 private nextGarageDoorScan=0;
 /** The global event group's CEventSoundQuiet events from the frame before (native axes), which the host reports. */
 soundEvents:SoundQuietEvent[]=[];
 /** vehicleFlags.bHasBeenResprayed, set on a vehicle a Pay 'n' Spray did. */
 private readonly resprayedCars=new WeakSet<object>();
 /** What the host calls on the vehicle a Pay 'n' Spray resprays. */
 markResprayed(car:object){this.resprayedCars.add(car);}
 /** CConversationForPed::IsPlayerInPositionForConversation (0x43AC40, unreversed; AUTHORED): both on foot and alive,
  * the player within CONVERSATION_REACH of the ped across and CONVERSATION_HEIGHT up or down. */
 private playerInPositionForConversation(handle:number){
  const me=this.world.playerPed();
  if(me.dead||me.health<=0||me.vehicle)return false;
  if(!this.peds.exists(handle)||(this.peds.healthOf(handle)??0)<=0||this.peds.rideOf(handle))return false;
  const p=this.peds.positionOf(handle),q=me.position;
  return Math.hypot(p.x-q.x,p.y-q.y)<CONVERSATION_REACH&&Math.abs(p.z-q.z)<CONVERSATION_HEIGHT;
 }
 /** CConversations::Update after the scripts: the ped's line goes up as a subtitle, PRINT_NOW's way, when the
  * conversation has them (dealer.scm turns them off in English). */
 private updateConversations(nowMs:number){
  const conversations=this.runtime.game.conversations;if(!conversations.count)return;
  conversations.update(nowMs,{
   inPosition:ped=>this.playerInPositionForConversation(ped),
   // Their lines are subtitles: with the Display settings' Subtitles off they are not printed.
   pedSays:(_ped,node,subtitles)=>{if(subtitles&&this.runtime.game.showSubtitles)this.runtime.game.messages.addMessageJump(node.name,CONVERSATION_PED_LINE_MS,1,false,nowMs);},
   playerSays:()=>{},
  });
 }
 private processGarageDoors(nowMs:number){
  const near=this.world.worldObjectsNear,models=this.world.garageDoorModels?.();
  if(!near||!models?.size)return;
  const game=this.runtime.game,objects=game.objects;
  if(nowMs>=this.nextGarageDoorScan){
   this.nextGarageDoorScan=nowMs+1000;
   const player=this.world.playerPed().position,claims=new Map<string,{garage:ScmGarage;distance:number;found:{key:string;model:string;position:[number,number,number];heading:number}}>();
   for(const garage of game.garages.garages){
    const centre=garageCentre(garage);if(!centre||Math.hypot(centre.x-player.x,centre.y-player.y)>GARAGE_DOOR_STREAM_RADIUS)continue;
    for(const found of near(models,centre.x,centre.y,GARAGE_DOOR_REACH*Math.SQRT2)){
     const dx=found.position[0]-centre.x,dy=found.position[1]-centre.y;if(Math.abs(dx)>=GARAGE_DOOR_REACH||Math.abs(dy)>=GARAGE_DOOR_REACH)continue;
     const distance=Math.hypot(dx,dy),claim=claims.get(found.key);
     if(!claim||distance<claim.distance)claims.set(found.key,{garage,distance,found});
    }
   }
   const perGarage=new Map<ScmGarage,number>(),kept=new Set<string>();
   for(const [key,claim] of [...claims].sort((a,b)=>a[1].distance-b[1].distance)){
    const count=perGarage.get(claim.garage)??0;if(count>=2)continue;perGarage.set(claim.garage,count+1);kept.add(key);
    const door=this.garageDoors.get(key);
    if(door){door.garage=claim.garage;if(door.taken)this.world.takeWorldObject?.(key,true);continue;}
    const [x,y,z]=claim.found.position,adopted=objects.adoptWorld(claim.found.model,{x,y,z},claim.found.heading,key);
    this.garageDoors.set(key,{garage:claim.garage,handle:adopted.handle,home:{x,y,z},heading:adopted.heading,taken:false});
   }
   for(const [key,door] of this.garageDoors)if(!kept.has(key)){
    if(objects.exists(door.handle))objects.remove(door.handle);this.garageDoors.delete(key);
    if(door.taken)this.world.takeWorldObject?.(key,false);
   }
  }
  for(const [key,door] of this.garageDoors){
   if(!objects.exists(door.handle))continue;
   const object=objects.at(door.handle),position=door.garage.doorPosition;
   if(position===door.applied)continue;
   if(door.height===undefined){
    const bounds=this.world.objectModelBounds?.(object.model);if(bounds===undefined)continue;
    door.height=bounds?garageDoorHeight(bounds):GARAGE_DOOR_DEFAULT_HEIGHT;
   }
   if(!door.taken){if(position===0)continue;if(!this.world.takeWorldObject?.(key,true))continue;door.taken=true;object.worldPlacement=undefined;}
   const pose=garageDoorPose(door.home,door.heading,door.height,!!(door.garage.flags&GARAGE_FLAG_DOOR_TURNS),position);
   object.position=pose.position;object.matrix={right:pose.right,forward:pose.forward,up:pose.up};door.applied=position;
  }
 }
 /** The garage doors held as objects, for the dev API and the browser tests. */
 garageDoorsSnapshot(){
  const objects=this.runtime.game.objects;
  return [...this.garageDoors].map(([key,d])=>({key,garage:d.garage.name,model:objects.exists(d.handle)?String(objects.at(d.handle).model):'',taken:d.taken,height:d.height,
   position:objects.exists(d.handle)?{...objects.at(d.handle).position}:undefined,up:objects.exists(d.handle)?objects.at(d.handle).matrix?.up:undefined}));
 }
 /** Street peds the random-ped brains have weighed already. */
 private readonly brainPeds=new WeakSet<object>();
 private nextPedBrainScan=0;
 /** CCarGenerator::DoInternalProcessing for a hot-dog van (CarGenerator.cpp:303, reversed): a generator whose own model
  * is the van, having made it, adds a BMOCHIL (PED_TYPE_CIVMALE) and attaches him to it at (0, 0, 0.6) facing its right
  * side (AttachPedToEntity's turret position 3), then CheckIfNewEntityNeedsScript, which is the random-ped brain MAIN
  * allocated for that model: hotdog.scm with the vendor as 0@. The van gets a handle the way a car the player takes
  * does. The vendor goes with the van; the script ends once he does. */
 hotdogVan(car:unknown){
  const game=this.runtime.game,scripts=game.streamedScripts;
  const brain=game.scriptBrains.brains.find(b=>b.typeOfBrain===BRAIN_RANDOM_PED&&b.active&&b.model===MODEL_BMOCHIL);
  const van=this.vehicles.handleFor(car,MODEL_HOTDOG);
  const vendor=this.peds.createOnCar(4,MODEL_BMOCHIL,van,{x:0,y:0,z:.6},3);
  if(!brain||!scripts.count||this.random.next()%100>=brain.percentageChance)return vendor;
  const index=scripts.properIndexFromScriptIndex(brain.streamedScriptIndex);if(index<0)return vendor;
  this.adapterRef.requestStreamedScript?.(index);
  this.runtime.startNewStreamedScript(index,[vendor],EXTERNAL_PED_BRAIN);
  return vendor;
 }
 /** CScriptsForBrains' random-ped brains (ALLOCATE_STREAMED_SCRIPT_TO_RANDOM_PED). CheckIfNewEntityNeedsScript and
  * StartOrRequestNewStreamedScriptBrain are unreversed, so this is AUTHORED from the allocation's operands and what the
  * brain scripts do: a street ped of a brain's model is weighed once, the first time it is seen, against the brain's
  * chance; a chosen one gets a handle (it stays a random ped, bHasAScriptBrain rather than PED_MISSION) and the
  * streamed script starts with it as 0@. The script runs while the ped lives; one the population removes is dead to it
  * (IS_CHAR_DEAD on a handle with no ped), and the script ends itself. MAIN gives dealer.scm to the four dealer models
  * and hotdog.scm to the hot-dog vendor. */
 private processPedBrains(nowMs:number){
  if(nowMs<this.nextPedBrainScan)return;this.nextPedBrainScan=nowMs+500;
  const game=this.runtime.game,scripts=game.streamedScripts;if(!scripts.count)return;
  const brains=game.scriptBrains.brains.filter(b=>b.typeOfBrain===BRAIN_RANDOM_PED&&b.active&&typeof b.model==='number');if(!brains.length)return;
  const candidates=this.world.randomStreetPeds?.();if(!candidates)return;
  for(const c of candidates){
   const key=c.ped as object;if(this.brainPeds.has(key))continue;
   const brain=brains.find(b=>b.model===c.model);if(!brain)continue;
   this.brainPeds.add(key);
   if(this.random.next()%100>=brain.percentageChance)continue;
   const index=scripts.properIndexFromScriptIndex(brain.streamedScriptIndex);if(index<0)continue;
   this.adapterRef.requestStreamedScript?.(index);
   const handle=this.peds.adopt(c.ped,c.pedType,c.model,c.position,c.heading,c.health);
   this.runtime.startNewStreamedScript(index,[handle],EXTERNAL_PED_BRAIN);
  }
 }
 /** Peds CREATE_CHAR_AT_ATTRACTOR made that have not yet been set at their attractor. */
 private readonly attractorArrivals=new Map<number,{attractor:number;opcode:number}>();
 private settleAttractorArrivals(){
  for(const [ped,use] of this.attractorArrivals){
   if(!this.peds.exists(ped)){this.attractorArrivals.delete(ped);continue;}
   const point=this.scriptAttractors.get(use.attractor);
   try{if(point){this.livePed(ped);this.peds.setHeading(ped,point.heading);this.useAttractor(ped,use.attractor,false,use.opcode);}}
   catch(error){if(error instanceof ScmEntityPending)continue;}
   this.attractorArrivals.delete(ped);
  }
 }
 private useAttractor(ped:number,attractor:number,walk:boolean,opcode:number){
  const point=this.scriptAttractors.get(attractor);if(!point)return;
  const found=this.runtime.game.sequences.sequenceFor(point.sequence);
  const tasks:ScmScriptedTask[]=[...(walk?[{kind:'goStraightToCoord' as const,x:point.x,y:point.y,z:point.z,speed:4,time:-1}]:[]),
   {kind:'achieveHeading',heading:point.heading},...(found?.sequence.tasks??[])];
  this.adapterRef.givePedSequence!(ped,tasks,false,opcode,undefined);
 }
 /** script.img's files by name (lower case, no extension). */
 private readonly streamedFiles=new Map<string,Uint8Array>();
 private streamedTable:readonly {name:string;size:number}[]=[];private largestStreamedSize=0;
 /** CTheScripts::Init's streamed scripts: CStreaming registers every file of data\script\script.img in the order the
  * archive lists them (CStreamedScripts::RegisterScript), then ReadStreamedScriptData gives each the size and the
  * index MAIN.SCM's header names it by. `img` is the VER2 archive whole. */
 loadStreamedScripts(img:Uint8Array){
  const scripts=this.runtime.game.streamedScripts;if(scripts.count)return;
  const view=new DataView(img.buffer,img.byteOffset,img.byteLength);
  if(img.length<8||view.getUint32(0,true)!==0x32524556)throw new Error('script.img is not a VER2 archive.');
  const count=view.getUint32(4,true);
  for(let i=0;i<count;i++){
   const at=8+i*32,offset=view.getUint32(at,true)*2048,length=view.getUint16(at+4,true)*2048;
   let name='';for(let c=0;c<24;c++){const code=img[at+8+c];if(!code)break;name+=String.fromCharCode(code);}
   if(!/\.scm$/i.test(name)||offset+length>img.length)continue;
   const base=name.slice(0,-4);
   this.streamedFiles.set(base.toLowerCase(),img.subarray(offset,offset+length));scripts.registerScript(base);
  }
  scripts.readStreamedScriptData(this.streamedTable,this.largestStreamedSize);
 }
 /** The browser answers for the player's ped alone; a handle it does not hold retires that thread, which the
  * snapshot reports with no instruction offset, since it is the world rather than the command that is short. */
 /** The browser's ped behind a script handle, for the questions only a built ped can answer. A handle whose ped
  * is still being loaded, or never arrived, gives the thread up rather than being answered with a guess. */
 /** The browser's car behind a script handle, for the questions only a built car can answer. */
 /** The pose of the vehicle the player rides, of whatever kind. */
 /** CMissionCleanup's list: the peds and cars a mission script made (AddEntityToList), until the script deletes one,
  * lets it go, or says not to remove it. */
 private readonly cleanupPeds=new Set<number>();private readonly cleanupVehicles=new Set<number>();
 /** CMissionCleanup::AddEntityToList when the thread making the entity is a mission's (m_bUseMissionCleanup). */
 private forCleanup(list:Set<number>,handle:number){if(this.runtime?.currentThread?.usesMissionCleanup)list.add(handle);return handle;}
 /** MARK_CAR_AS_NO_LONGER_NEEDED and the cleanup's CleanUpThisVehicle. */
 private releaseVehicle(handle:number){const car=this.vehicles.entity(handle);if(car)this.world.releaseScriptVehicle?.(car);this.vehicles.markNoLongerNeeded(handle);}
 /** A car's axes and place in script terms: the player's own car through its pose, a script car through its body. */
 private vehicleMatrixOf(handle:number){return handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle));}
 private playerPose(handle:number){
  const pose=this.world.playerVehiclePose?.();
  if(!pose)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return pose;
 }
 /** Whether a script car is still enough to step out of; one the browser does not hold, or a host that cannot tell, is. */
 private vehicleStill(vehicle:number){const car=this.vehicles.entity(vehicle);return car===undefined||(this.world.scriptVehicleStill?.(car)??true);}
 /** CTaskComplexLeaveCar (and LeaveAnyCar, and the Immediately form) for a script ped riding a script car: it is set
  * down at its seat's door, on foot. The get-out clips are not played. A ped on foot, or in another car than the one
  * named, has nothing to do and the task is over at once. */
 /** The ped out of its car at its seat's door, rebuilt on foot; false when it rides no car (or not the one named). */
 private leaveCarNow(handle:number,vehicle:number|undefined,opcode:number,jump=false){
  const ride=this.peds.rideOf(handle);
  if(!ride||ride.offset||vehicle!==undefined&&vehicle!==ride.vehicle)return false;
  // A car deleted with the ped still in it leaves the ped where it sat.
  if(!this.vehicles.exists(ride.vehicle)){this.stopDriving(handle);this.peds.detachFromCar(handle,this.peds.positionOf(handle));return true;}
  const car=this.liveVehicle(ride.vehicle);
  const at=this.host('scriptVehicleSeatDoor','TASK_LEAVE_CAR')(car,ride.seat);
  if(!at)throw new UnsupportedScmCommand(opcode,0,'A_SEAT_WITHOUT_A_DOOR',String(ride.seat));
  this.stopDriving(handle);
  // CTaskSimpleCarJumpOut: out of a car that is still moving the ped rolls, by its seat's side, with the car's speed.
  const native=jump&&!this.vehicleStill(ride.vehicle)?this.world.scriptVehicleVelocity?.(car):undefined,velocity=native&&{x:native.x,z:-native.y};
  const clip=ride.seat==='driver'||ride.seat===1?'car_rollout_lhs':'car_rollout_rhs';
  this.peds.detachFromCar(handle,at,velocity?ped=>this.world.rollOutScriptPed?.(ped,velocity,clip):undefined);
  return true;
 }
 /** A driving task on the car the ped is at the wheel of: CCarAI's mission, a temporary action, or the wander. */
 private startCarTask(handle:number,task:ScmScriptedTask,opcode:number){
  switch(task.kind){
   // CTaskComplexDriveToPoint: CCarAI::GetCarToGoToCoors (mode 0), …Accurate (1) or …StraightLine (2) with the task's
   // cruise speed and driving style; the racing mode (3) drives as the plain one. It is over once the mission clears.
   case 'carDriveToCoord':{
    const car=this.driverCar(handle,task.vehicle,opcode);
    this.host('driveScriptVehicleTo','TASK_CAR_DRIVE_TO_COORD')(car,{x:task.x,y:task.y,z:task.z},
     {cruise:task.speed,style:task.drivingStyle,accurate:task.driveStyle===1,straight:task.driveStyle===2});
    return;
   }
   case 'carTempAction':this.host('scriptVehicleTempAction','TASK_CAR_TEMP_ACTION')(this.driverCar(handle,task.vehicle,opcode),task.actionId,task.time/1000);return;
   case 'carDriveWander':this.host('scriptVehicleWander','TASK_CAR_DRIVE_WANDER')(this.driverCar(handle,task.vehicle,opcode),{cruise:task.speed,style:task.drivingMode});return;
   case 'carMission':{
    const car=this.driverCar(handle,task.vehicle,opcode);
    // -1 names no car: the player's missions (ram, block) go after him.
    const target=task.targetVehicle===-1?undefined:this.liveVehicle(task.targetVehicle);
    if(!this.host('scriptVehicleCarMission','TASK_CAR_MISSION')(car,{mission:task.missionId,target,cruise:task.cruiseSpeed,style:task.drivingStyle}))
     throw new UnsupportedScmCommand(opcode,0,'A_CAR_MISSION_THE_BROWSER_DOES_NOT_DRIVE',`mission ${task.missionId}`);
    return;
   }
   default:throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
  }
 }
 /** CTaskComplexSequence run from here, a task at a time, for the sequences the on-foot peds cannot carry alone: one
  * with a car task in it, or one given to a ped in a car (and a single task given to a ped in a car, which is a
  * sequence of one that reads no progress). `progress` is m_CurrentTaskIndex. */
 /** A runner's task goes because another replaces it. A driving task going is CTaskComplexCarDrive's destructor,
  * which puts the car's mission, style and cruise speed back as they were before it (a script car's are none), so
  * the car stops rather than driving on for a ped doing something else. */
 private dropRunner(handle:number){
  if(this.drivingTasks.delete(handle))this.stopDriving(handle);
  const r=this.runners.get(handle);if(!r)return;
  this.runners.delete(handle);
  if(r.step?.kind==='held'&&CAR_TASKS.has(r.tasks[r.progress]?.kind))this.stopDriving(handle);
 }
 /** Peds whose primary task is a driving task begun at the wheel without a runner, until its record goes. */
 private readonly drivingTasks=new Set<number>();
 private readonly runners=new Map<number,{tasks:readonly ScmScriptedTask[];at:number;repeat:boolean;opcode:number;sequence:boolean;progress:number;step?:RunnerStep}>();
 private runSequence(handle:number,tasks:readonly ScmScriptedTask[],repeat:boolean,opcode:number,sequence:boolean,start=0){
  const at=Math.min(Math.max(0,start),tasks.length);
  this.dropRunner(handle);
  this.runners.set(handle,{tasks:[...tasks],at,repeat,opcode,sequence,progress:at});
  this.recordTask(handle,opcode,false);
  this.advanceRunner(handle);
 }
 /** The sequence's next task, past the ones that are over as soon as they start; one pass of those at most. */
 private advanceRunner(handle:number){
  for(let n=0,steps=this.runners.get(handle)?.tasks.length??0;n<=steps;n++){
   const r=this.runners.get(handle);if(!r)return;
   if(r.at>=r.tasks.length){if(!r.repeat){this.runners.delete(handle);return;}r.at=0;}
   r.progress=r.at;
   const task=r.tasks[r.at++];
   const step=this.dispatch(handle,task,r.opcode);
   if(step){r.step=step;return;}
  }
  this.runners.delete(handle);
 }
 /** One task of a runner's sequence begun on the ped as it is now, or nothing when it is over at once:
  * - A car task runs on the car the ped drives. On foot, the ped gets in at the wheel first, as
  *   CTaskComplexCarDrive::CreateFirstSubTask does.
  * - A leave-car task sets the ped down at its door.
  * - An on-foot task leaves the car first. A pause or a stand-still is waited out in the seat, and the head-look and
  *   flag tasks, which have nothing to act on in a seat, are over at once. */
 private dispatch(handle:number,task:ScmScriptedTask,opcode:number):RunnerStep|undefined{
  const entity=this.peds.entity(handle);
  if(entity===undefined)return {kind:'settle',then:task};
  const ride=this.peds.rideOf(handle),riding=!!ride&&!ride.offset;
  switch(task.kind){
   case 'leaveCar':case 'leaveCarImmediately':case 'leaveAnyCar':{
    const vehicle=task.kind==='leaveAnyCar'?undefined:task.vehicle;
    if(!riding||vehicle!==undefined&&vehicle!==ride.vehicle)return undefined;
    // CTaskSimpleCarWaitToSlowDown first (not for the Immediately form): a script driver stops its car's mission,
    // and the ped waits in its seat until the car is still enough to step out of.
    const jump=this.groupLeaving.delete(handle);
    if(!jump&&task.kind!=='leaveCarImmediately'&&!this.vehicleStill(ride.vehicle)){this.stopDriving(handle);return {kind:'slowing',then:task};}
    return this.leaveCarNow(handle,vehicle,opcode,jump)?{kind:'settle'}:undefined;
   }
   case 'carDriveToCoord':case 'carTempAction':case 'carDriveWander':case 'carMission':{
    // CTaskComplexCarDrive::CreateFirstSubTask with no car (-1): the one the ped is in. On foot it would enter any
    // car as driver, which is not ported, so the task is over.
    if(task.vehicle===-1){if(!riding||ride.seat!=='driver')return undefined;task={...task,vehicle:ride.vehicle};}
    if(riding&&ride.seat==='driver'&&ride.vehicle===task.vehicle){this.startCarTask(handle,task,opcode);return {kind:'held'};}
    if(riding||!this.vehicles.entity(task.vehicle))return undefined;
    this.world.giveScriptPedOrder(entity,{kind:'enterCar',vehicle:task.vehicle,seat:'driver',seconds:Number.POSITIVE_INFINITY});
    return {kind:'board',vehicle:task.vehicle,then:task};
   }
  }
  const order=scriptedPedOrder(task,this.taskWorld(handle));
  if(!order)return undefined;
  if(riding)this.world.clearScriptRiderClip?.(entity);
  // CTaskSimpleRunAnim does not take a ped out of its seat: the clip plays where it sits (INTRO1's homies wave
  // BMX_COMEON from their saddles, then ride on).
  if(riding&&order.kind==='playAnim'&&this.world.playScriptRiderClip){
   this.world.playScriptRiderClip(entity,{file:order.file,name:order.name,loop:order.loop,hold:order.keepLastFrame,seconds:order.seconds});
   return {kind:'seatClip'};
  }
  if(riding){
   if(order.kind==='standStill')return {kind:'wait',remaining:order.seconds};
   if(IN_SEAT_OVER_AT_ONCE.has(order.kind))return undefined;
   return this.leaveCarNow(handle,undefined,opcode)?{kind:'settle',then:task}:undefined;
  }
  this.world.giveScriptPedOrder(entity,order);
  return {kind:'held'};
 }
 /** Each runner's task, a frame on: over when the ped no longer holds it, its wait is out, or the ped it waits for is
  * built. A task the browser cannot begin ends the runner, and the thread is told nothing (it has moved on). */
 private processRunners(dt:number){
  for(const [handle,r] of this.runners){
   if(!this.peds.exists(handle)){this.runners.delete(handle);continue;}
   try{
    const step=r.step,entity=this.peds.entity(handle);
    if(!step){this.advanceRunner(handle);continue;}
    switch(step.kind){
     case 'wait':step.remaining-=dt;if(step.remaining<=0)this.advanceRunner(handle);break;
     case 'seatClip':if(entity===undefined||!this.peds.rideOf(handle)||this.world.scriptRiderClipDone?.(entity)!==false)this.advanceRunner(handle);break;
     case 'slowing':{
      const ride=this.peds.rideOf(handle);
      if(!ride||ride.offset||!this.vehicles.exists(ride.vehicle))this.advanceRunner(handle);
      else if(this.vehicleStill(ride.vehicle)){const next=this.dispatch(handle,step.then,r.opcode);if(next)r.step=next;else this.advanceRunner(handle);}
      break;
     }
     case 'settle':
      if(entity===undefined)break;
      if(step.then){const next=this.dispatch(handle,step.then,r.opcode);if(next)r.step=next;else this.advanceRunner(handle);}
      else this.advanceRunner(handle);
      break;
     case 'board':{
      const ride=this.peds.rideOf(handle);
      if(ride&&!ride.offset&&ride.vehicle===step.vehicle&&ride.seat==='driver'){
       if(entity!==undefined){const next=this.dispatch(handle,step.then,r.opcode);if(next)r.step=next;else this.advanceRunner(handle);}
      }else if(entity!==undefined&&!ride&&!this.world.scriptPedHasOrder?.(entity))this.advanceRunner(handle);
      break;
     }
     case 'held':if(entity!==undefined&&this.world.scriptPedHasOrder&&!this.world.scriptPedHasOrder(entity))this.advanceRunner(handle);break;
    }
   }catch(error){
    if(!(error instanceof UnsupportedScmCommand))throw error;
    this.runners.delete(handle);
    this.gaveUp.push({thread:'(sequence)',command:error.command,offset:error.offset,detail:error.message});
   }
  }
 }
 /** A script driver's car stops its CCarAI mission when the driver's task goes. */
 private stopDriving(handle:number){
  const ride=this.peds.rideOf(handle);if(!ride||ride.offset||ride.seat!=='driver')return;
  const car=this.vehicles.entity(ride.vehicle);if(car)this.world.stopScriptVehicle?.(car);
 }
 /** The script car a driving task names, which the ped must already be at the wheel of. */
 private driverCar(handle:number,vehicle:number,opcode:number){
  this.livePed(handle);
  const ride=this.peds.rideOf(handle);
  if(!ride||ride.offset||ride.seat!=='driver'||ride.vehicle!==vehicle)throw new UnsupportedScmCommand(opcode,0,'A_DRIVER_NOT_AT_THE_WHEEL',`ped ${handle}`);
  return this.liveVehicle(vehicle);
 }
 /** The player's ped runs only the tasks PlayerScriptTasks knows; any other gives the thread up. */
 private givePlayer(orders:readonly ScriptedPedOrder[],repeat:boolean,opcode:number,sequence=false,start=0){
  const other=orders.find(order=>!PlayerScriptTasks.runs(order));
  if(other)throw new UnsupportedScmCommand(opcode,0,'A_PLAYER_TASK_THE_BROWSER_DOES_NOT_RUN',other.kind);
  this.host('givePlayerOrders','A_PLAYER_TASK')(orders,repeat,sequence,start);
  this.recordTask(PLAYER_PED_HANDLE,opcode,false);
 }
 private clearTasks(handle:number,command:string){
  if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerTasks',command)();
  else{this.runners.delete(handle);this.stopDriving(handle);const ped=this.livePed(handle);this.world.clearScriptPedDriveBy?.(ped);this.world.clearScriptRiderClip?.(ped);this.world.clearScriptPedTasks(ped);}
  this.taskRecords.delete(handle);
 }
 /** CRunningScript::SetCharCoordinates on the player: CWorld::PutToGroundIfTooLow first (a z at or below
  * MAP_Z_LOW_LIMIT is the ground there). The group teleport that warpGang asks for is not modelled. */
 /** CVehicleModelInfo::ms_compsToUse, until the next car the script makes takes it. */
 private componentsToUse?:[number,number];
 /** GetPedOrItsVehicle for a touching question: the vehicle a ped sits in (not one it is only held on), else the ped. */
 private touchEntityOfPed(handle:number):ScmTouchEntity{
  if(handle===PLAYER_PED_HANDLE){const car=this.world.playerPed().vehicle?this.world.playerVehicleEntity?.():undefined;return car!==undefined?{kind:'vehicle',entity:car}:{kind:'player'};}
  const ride=this.peds.rideOf(handle);
  if(ride&&!ride.offset)return {kind:'vehicle',entity:this.liveVehicle(ride.vehicle)};
  return {kind:'ped',entity:this.livePed(handle)};
 }
 /** CWorld::FindGroundZForCoord: straight down from z = 1000, and 20 where the world has no ground under the point. */
 private findGroundZForCoord(x:number,y:number){return this.world.groundLevel(x,y,1000)??20;}
 private teleportPlayer(x:number,y:number,z:number,command:string){
  // CWorld::PutToGroundIfTooLow.
  const found=z<=-100?this.world.groundLevel(x,y,1000):undefined,ground=z<=-100?found??20:undefined;
  const onFoot=!this.world.playerPed().vehicle;
  // A script puts CJ somewhere far after LOAD_SCENE has loaded its collision; the browser streams it in after the
  // teleport, so a ground not found yet is looked for again when it arrives.
  if(!this.host('teleportPlayer',command)({x,y,z:ground??z,...(z<=-100&&found===undefined?{groundPending:true}:{})}))throw new UnsupportedScmCommand(-1,0,command,'a player on a bike, boat or plane');
  // CRunningScript::SetCharCoordinates with warpGang (the plain command; not _NO_OFFSET or _DONT_WARP_GANG): a leader
  // on foot is moved by CPedGroup::Teleport, which takes his living followers along to the formation's offsets from
  // the point. A follower still sits in its car here, as a mission ped the game does not set out of one.
  if(command==='SET_CHAR_COORDINATES'&&onFoot){
   const group=this.groups.get(PLAYER_GROUP_HANDLE);if(!group)return;
   let slot=0;
   for(const follower of group.all()){
    if(follower===PLAYER_PED_HANDLE||!this.peds.exists(follower))continue;
    const index=slot++;
    if((this.peds.healthOf(follower)??0)<=0)continue;
    const ride=this.peds.rideOf(follower);if(ride&&!ride.offset)continue;
    const [ox,oy]=GROUP_TELEPORT_OFFSETS[index]??[0,0];
    this.peds.setPosition(follower,{x:x+ox,y:y+oy,z:ground??z});
   }
  }
 }
 /** The handle for the vehicle the player is in, nothing on foot. Every vehicle in CPools has a handle, so a street car
  * the player took gets one the first time a script asks (STORE_CAR_CHAR_IS_IN_NO_SAVE, GET_CAR_CHAR_IS_USING), and
  * keeps naming that car after he leaves it: the script can then seat its peds in it, warp it, or ask after it.
  * PLAYER_VEHICLE_HANDLE is left for a vehicle the host cannot hand over or whose model it does not know. */
 private playerCarHandle(){
  const vehicle=this.world.playerPed().vehicle;if(!vehicle)return undefined;
  const entity=this.world.playerVehicleEntity?.();if(entity===undefined)return PLAYER_VEHICLE_HANDLE;
  return this.vehicles.handleOf(entity)??(vehicle.model!==undefined?this.vehicles.handleFor(entity,vehicle.model):PLAYER_VEHICLE_HANDLE);
 }
 /** CPlayerData::m_bGroupAlwaysFollow (SET_PLAYER_GROUP_TO_FOLLOW_ALWAYS). */
 playerGroupAlwaysFollows=false;
 /** CPlayerData::m_bGroupNeverFollow (SET_PLAYER_GROUP_TO_FOLLOW_NEVER). */
 playerGroupNeverFollows=false;
 /** The player's own bDoesntListenToPlayerGroupCommands, the other way round. */
 playerListensToGroupCommands=true;
 /** What a car handle names: the player's own car for PLAYER_VEHICLE_HANDLE, a script car the browser built, or nothing. */
 /** A car by handle once it is built: the player's own at once, a script car when its making settles. */
 private async vehicleOrPlayer(handle:number):Promise<unknown>{return handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehicleEntity?.():this.vehicles.whenSettled(handle);}
 vehicleByHandle(handle:number):unknown{return handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehicleEntity?.():this.vehicles.entity(handle);}
 /** What a ped handle names: the player, the browser's ped behind a live script handle, or nothing. */
 pedByHandle(handle:number):unknown{return handle===PLAYER_PED_HANDLE?'player':this.peds.exists(handle)?this.peds.entity(handle):undefined;}
 /** Where the peds a task names stand: the ped itself, a script ped, or the player (whose handle is no pool ped). */
 private taskWorld(handle:number){
  return {
   self:()=>handle===PLAYER_PED_HANDLE?{...this.world.playerPed().position}:this.peds.positionOf(handle),
   ped:(other:number)=>other===PLAYER_PED_HANDLE?{...this.world.playerPed().position}:this.peds.exists(other)?this.peds.positionOf(other):undefined,
   decisionMaker:(dm:number)=>this.runtime.game.decisionMakers.actualIndex(dm),
   objectPosition:(object:number)=>this.runtime.game.objects.exists(object)?{...this.runtime.game.objects.at(object).position}:undefined,
   vehiclePosition:(vehicle:number)=>vehicle===PLAYER_VEHICLE_HANDLE||!this.vehicles.exists(vehicle)||!this.vehicles.entity(vehicle)?undefined:this.vehicles.positionOf(vehicle),
   // A car the script made and the browser has built; the player's own car is not one a script ped can board yet.
   vehicle:(vehicle:number)=>vehicle!==PLAYER_VEHICLE_HANDLE&&this.vehicles.exists(vehicle)&&!!this.vehicles.entity(vehicle),
  };
 }
 /** An optional host method, or the command gives up on a host that has none. */
 /** CAutomobile::ProcessPedInVehicleBuoyancy for the script's seated peds: in a drowning car that is not watertight
  * each takes WEAPON_DROWNING at a health point a 50th of a second (the damage calculator's CTimer::GetTimeStep). */
 private drownRiders(timeStepMs:number){
  const drowns=this.world.scriptVehicleDrownsOccupants;if(!drowns)return;
  for(const handle of this.peds.handles){
   const ride=this.peds.rideOf(handle);if(!ride||ride.offset||!this.vehicles.exists(ride.vehicle))continue;
   const car=this.vehicles.entity(ride.vehicle);
   if(car&&(this.peds.healthOf(handle)??0)>0&&drowns.call(this.world,car))this.peds.loseHealth(handle,timeStepMs/20);
  }
 }
 /** SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE and SET_USES_COLLISION_OF_CLOSEST_OBJECT_OF_TYPE (reVC's handler for the
  * first): the point dropped to the ground at or below the map's low limit, then the nearest entity of the model within
  * the radius among the map's buildings and dummies and the script's objects has bIsVisible (kept through its LOD
  * swaps by the invisibility swap array) or bUsesCollision set. */
 private closestObjectOfTypeFlag(x:number,y:number,z:number,radius:number,model:number|string,flag:'visible'|'collision',state:boolean){
  if(z<=-100)z=this.findGroundZForCoord(x,y);
  let best:{distance:number;apply:()=>void}|undefined;
  const objects=this.runtime.game.objects;
  for(const object of objects.all){
   if(object.model!==model)continue;
   const distance=Math.hypot(object.position.x-x,object.position.y-y,object.position.z-z);
   if(distance<radius&&(!best||distance<best.distance))best={distance,apply:()=>{if(flag==='visible')object.visible=state;else objects.setUsesCollision(object.handle,state);}};
  }
  const map=this.world.closestWorldObjectOfType?.({x,y,z},radius,model);
  if(map?.key!==undefined&&(!best||map.distance<best.distance)){const key=map.key;best={distance:map.distance,apply:()=>this.world.setWorldObjectFlag?.(key,flag,state)};}
  best?.apply();
 }
 /** DRAW_CORONA's registrations since the host last took them: the host registers each with CCoronas that frame. */
 private coronaQueue:{id:number;position:[number,number,number];size:number;color:[number,number,number];coronaType:number;flareType:number}[]=[];
 takeScriptCoronas(){const out=this.coronaQueue;this.coronaQueue=[];return out;}
 private vehicleModelType(model:number|string,command:string){
  const type=this.host('vehicleModelType',command)(model);
  if(type===null)throw new ScmEntityPending('the vehicle catalog');
  return type;
 }
 private host<K extends keyof ScmMissionWorld>(name:K,command:string):NonNullable<ScmMissionWorld[K]>{
  const method=this.world[name];
  if(typeof method!=='function')throw new UnsupportedScmCommand(-1,0,command,'no host');
  return (method as (...args:never[])=>unknown).bind(this.world) as NonNullable<ScmMissionWorld[K]>;
 }
 /** The CAutomobile behind a car handle, when the host has one. */
 private carComponents(handle:number){return this.world.scriptCarComponents?.(this.liveVehicle(handle));}
 private liveVehicle(handle:number){
  // The player's own car is not one the script made: the host hands it over while the player drives it.
  const car=handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehicleEntity?.():this.vehicles.entity(handle);
  if(!car&&handle!==PLAYER_VEHICLE_HANDLE&&this.vehicles.exists(handle)&&!this.vehicles.settledFor(handle))throw new ScmEntityPending(`vehicle ${handle}`);
  if(!car)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return car;
 }
 /** FindNthNodeClosestToCoors over the loaded car nodes, then FindNodeCoorsForScript and
  * FindNodeOrientationForCarPlacement for the node found. */
 private scriptCarNode(point:{x:number;y:number;z:number},nth:number,ignoreDisabled:boolean){
  const areas=this.world.carPathAreas?.();if(!areas)return undefined;
  const node=findNthNodeClosestToCoors(areas,point,nth,{kind:'vehicle',maxDistance:999999.9,ignoreDisabled});
  return node&&{...findNodeCoorsForScript(areas,node),heading:findNodeOrientationForCarPlacement(areas,node)};
 }
 /** Where a REPORT_MISSION_AUDIO_EVENT_AT_CHAR, _AT_CAR or _AT_OBJECT is heard: the entity's position (native), while
  * it exists. */
 /** For a reported ped, whether it is the player: its sounds are the player's ped audio entity's. */
 audioPed(kind:string,handle:number):'player'|'other'|undefined{return kind!=='ped'?undefined:handle===PLAYER_PED_HANDLE?'player':'other';}
 audioEntityPosition(kind:string,handle:number):{x:number;y:number;z:number}|undefined{
  try{
   if(kind==='ped')return handle===PLAYER_PED_HANDLE?{...this.world.playerPed().position}:this.peds.exists(handle)?this.ridingIn(handle)??this.peds.positionOf(handle):undefined;
   if(kind==='vehicle')return handle===PLAYER_VEHICLE_HANDLE?{...this.playerPose(handle).position}:this.vehicles.exists(handle)?this.vehicles.positionOf(handle):undefined;
   if(kind==='object')return this.runtime.game.objects.exists(handle)?{...this.runtime.game.objects.at(handle).position}:undefined;
  }catch{/* Gone. */}
  return undefined;
 }
 /** Where a ped that rides in a car is, which is where the car is. */
 private ridingIn(handle:number){
  const ride=this.peds.rideOf(handle);
  return ride&&this.vehicles.exists(ride.vehicle)?this.vehicles.positionOf(ride.vehicle):undefined;
 }
 /** The group a command names, made on demand so a script that sets a group it never created still works the
  * way CPedGroups' own array does, where every slot is a group already. */
 private group(handle:number){
  let group=this.groups.get(handle);
  if(!group){group=new NativePedGroup();this.groups.set(handle,group);}
  return group;
 }
 /** The rows a script has written for one decision maker, by the slot its handle names. */
 private decisionsFor(decisionMaker:number){
  const slot=ScmDecisionMakers.indexOf(decisionMaker);
  let rows=this.scriptDecisions.get(slot);
  if(!rows){rows=new Map();this.scriptDecisions.set(slot,rows);}
  return rows;
 }
 private addDecision(decisionMaker:number,event:number,taskId:number,
  chances:{respect:number;hate:number;like:number;dislike:number},inCar:boolean,onFoot:boolean){
  const rows=this.decisionsFor(decisionMaker);
  let choices=rows.get(event);
  if(!choices){choices=[];rows.set(event,choices);}
  // A row holds six; the seventh has nowhere to go, as the file's own row would have none.
  if(choices.length>=MAX_DECISION_CHOICES)return;
  choices.push({task:taskId,chances:[chances.respect,chances.hate,chances.like,chances.dislike],
   inVehicle:inCar,onFoot});
 }
 /* An attached object goes where the thing it hangs from goes. CEntity keeps the offset in the host's own
  * axes, so the world point is the host's position plus its right, forward and up scaled by the offset; a car
  * gives all three through its matrix, and a ped, which only turns about the up axis, gives them from its
  * heading. A host that has gone leaves the object where it last was rather than dragging it to nowhere. */
 /** The same again just before the frame is drawn: the script steps after the world's physics, and an object hung from
  * the moving player (player_parachute's canopy) would otherwise be drawn where he was a frame before, as CPhysical's
  * PositionAttachedEntity has it follow its host within the world's own process. */
 refreshAttachments(){this.followAttachments();}
 private followAttachments(){
  for(const object of this.runtime.game.objects.all){
   const attached=object.attachedTo;if(!attached)continue;
   const frame=this.attachmentFrame(attached);if(!frame)continue;
   const {offset}=attached;
   object.position={
    x:frame.position.x+frame.right.x*offset.x+frame.forward.x*offset.y+frame.up.x*offset.z,
    y:frame.position.y+frame.right.y*offset.x+frame.forward.y*offset.y+frame.up.y*offset.z,
    z:frame.position.z+frame.right.z*offset.x+frame.forward.z*offset.y+frame.up.z*offset.z,
   };
   object.heading=frame.heading+attached.rotation.z;
   object.rotation={x:attached.rotation.x,y:attached.rotation.y,z:0};
  }
  for(const object of this.runtime.game.objects.all)if(object.heldBy)this.poseHeldObject(object);
  // FxSystem_c::SetMatrix for the systems that hang from something, which is what keeps them with it.
  for(const record of this.scriptFx.values()){
   if(!record.attached)continue;
   const matrix=this.fxMatrixFor(record.attached);
   if(matrix)this.world.setScriptFxMatrix(record.system,matrix);
  }
 }
 /** Where the thing an object hangs from is, and which way its own axes point. */
 private attachmentFrame(attached:{kind:'vehicle'|'ped'|'object';handle:number}){
  if(attached.kind==='vehicle'){
   if(!this.vehicles.exists(attached.handle))return undefined;
   const car=this.vehicles.entity(attached.handle);if(!car)return undefined;
   const matrix=this.world.scriptVehicleMatrix(car);
   return {...matrix,heading:this.vehicles.headingOf(attached.handle)*Math.PI/180};
  }
  if(attached.kind==='object'){
   const host=this.runtime.game.objects.exists(attached.handle)?this.runtime.game.objects.at(attached.handle):undefined;
   if(!host)return undefined;
   return {...headingFrame(host.heading),position:host.position,heading:host.heading};
  }
  // The player is no script ped of the pool, and is the ped player_parachute hangs its canopy from.
  if(attached.handle===PLAYER_PED_HANDLE){
   const player=this.world.playerPed(),heading=(player.heading??0)*Math.PI/180;
   return {...headingFrame(heading),position:{...player.position},heading};
  }
  if(!this.peds.exists(attached.handle))return undefined;
  const position=this.peds.positionOf(attached.handle),heading=this.peds.headingOf(attached.handle)*Math.PI/180;
  return {...headingFrame(heading),position,heading};
 }
 /** The host's system behind an FX handle; a handle naming none gives the thread up rather than doing nothing. */
 private fxOf(handle:number){
  const record=this.scriptFx.get(handle);
  if(!record)throw new UnsupportedScmCommand(-1,0,'AN_FX_SYSTEM_THE_BROWSER_DOES_NOT_HOLD',`fx ${handle}`);
  return record.system;
 }
 /** A system at a point in the script's own coordinates, facing the way the world does. */
 private makeFx(name:string,position:{x:number;y:number;z:number},ignoreBoundingChecks:boolean){
  const handle=this.nextFx++;
  const system=this.world.createScriptFx(name,fxMatrix(headingFrame(0),position),ignoreBoundingChecks,false);
  if(system!==undefined)this.scriptFx.set(handle,{system});
  return handle;
 }
 /** A system that hangs from a car, a ped or an object, given that entity's matrix again each step. */
 private makeAttachedFx(name:string,kind:'vehicle'|'ped'|'object',host:number,offset:{x:number;y:number;z:number},
  direction:{x:number;y:number;z:number}|undefined,ignoreBoundingChecks:boolean){
  const handle=this.nextFx++;
  const attached={kind,handle:host,offset:{...offset},direction:direction&&{...direction}};
  const matrix=this.fxMatrixFor(attached)??fxMatrix(headingFrame(0),offset);
  const system=this.world.createScriptFx(name,matrix,ignoreBoundingChecks,true);
  if(system!==undefined)this.scriptFx.set(handle,{system,attached});
  return handle;
 }
 /** Where an attached system sits and which way it points, in the script's own coordinates. */
 private fxMatrixFor(attached:{kind:'vehicle'|'ped'|'object';handle:number;offset:{x:number;y:number;z:number};direction?:{x:number;y:number;z:number};bone?:number}){
  const frame=attached.bone!==undefined&&attached.kind==='ped'?this.pedBoneFrame(attached.handle,attached.bone):this.attachmentFrame(attached);if(!frame)return undefined;
  const {offset}=attached;
  const position={
   x:frame.position.x+frame.right.x*offset.x+frame.forward.x*offset.y+frame.up.x*offset.z,
   y:frame.position.y+frame.right.y*offset.x+frame.forward.y*offset.y+frame.up.y*offset.z,
   z:frame.position.z+frame.right.z*offset.x+frame.forward.z*offset.y+frame.up.z*offset.z,
  };
  // A system given a direction points along it; one without keeps the entity's own facing.
  return fxMatrix(attached.direction?directionFrame(attached.direction):frame,position);
 }
 /** The flattened step of the sequence a ped runs, as the runner, the player or the ped itself counts it. */
 private flatSequenceProgress(handle:number){
  if(handle===PLAYER_PED_HANDLE)return this.world.playerSequenceProgress?.()??-1;
  const r=this.runners.get(handle);if(r)return r.sequence?r.progress:-1;
  const ped=this.peds.entity(handle);
  return ped===undefined?-1:this.world.scriptPedSequenceProgress?.(ped)??-1;
 }
 /** CTaskComplexSequence::m_CurrentTaskIndex, and the step of the CTaskComplexUseSequence it is on (-1 when that
  * step is a plain task). */
 private sequenceStep(handle:number){
  const flat=this.flatSequenceProgress(handle);
  if(flat<0)return {outer:-1,inner:-1};
  return this.sequenceSteps.get(handle)?.[flat]??{outer:flat,inner:-1};
 }
 /** AUTHORED stand-ins for tasks the browser has no order of its own for, as the orders it does run:
  * - TASK_CHAR_SLIDE_TO_COORD_AND_PLAY_ANIM (CTaskComplexSlideToCoord then the named clip): the ped walks to the
  *   point, turns to the heading and plays the clip.
  * - TASK_PICK_UP_OBJECT as a step of a sequence: the object is in the hand from when the sequence is given, and the
  *   step plays the clip the command names.
  * - TASK_HAND_GESTURE (CTaskComplexSignalAtPed and CTaskComplexPlayHandSignalAnim, unreversed): the ped turns to face
  *   the other and plays one of GHANDS' five gang signs; the finger models the task swaps in are not drawn. */
 private standInOrders(handle:number,task:ScmScriptedTask,world:Parameters<typeof scriptedPedOrder>[1]):ScriptedPedOrder[]|undefined{
  const built=(tasks:ScmScriptedTask[])=>{const orders=tasks.map(t=>scriptedPedOrder(t,world));return orders.every(o=>!!o)?orders as ScriptedPedOrder[]:undefined;};
  if(task.kind==='slideToCoordAndPlayAnim')return built([
   {kind:'goStraightToCoord',x:task.x,y:task.y,z:task.z,speed:4,time:3000},{kind:'achieveHeading',heading:task.heading},
   {kind:'playAnim',animationName:task.animationName,animationFile:task.animationFile,blendSpeed:task.blendSpeed,loop:task.loop,lockX:task.lockX,lockY:task.lockY,keepLastFrame:task.keepLastFrame,time:task.time,interruptable:false}]);
  if(task.kind==='handGesture')return built([{kind:'turnToFaceEntity',target:task.target},
   {kind:'playAnim',animationName:`gsign${1+this.random.next()%5}`,animationFile:'GHANDS',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:true}]);
  if(task.kind==='pickUpObject'){
   this.pickUpObject(handle,task);
   const named=task.animationName&&task.animationName.toUpperCase()!=='NULL';
   return named?built([{kind:'playAnim',animationName:task.animationName,animationFile:task.animationFile,blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:false}]):[];
  }
  return undefined;
 }
 private expandSequence(tasks:readonly ScmScriptedTask[],from?:{task:number;subTask:number}){
  return expandScriptSequence(tasks,index=>this.runtime.game.sequences.at(index).tasks,from);
 }
 private livePed(handle:number){
  const ped=this.peds.entity(handle);
  // A ped still being built is waited for; one whose making failed, or a handle naming none, is not there to ask.
  if(!ped&&this.peds.exists(handle)&&!this.peds.settledFor(handle))throw new ScmEntityPending(`ped ${handle}`);
  if(!ped)throw new UnsupportedScmCommand(-1,0,'A_PED_THE_BROWSER_DOES_NOT_HOLD',`ped ${handle}`);
  return ped;
 }
 /** The vehicle the player is riding, which the commands that name his own car ask about. */
 /** TASK_PICK_UP_OBJECT, first run of CTaskSimpleHoldEntity::ProcessPed: the object loses its collision, stops
  * being static, and keeps its heading less the ped's as m_fRotation. A ped already holding something lets it go.
  * The pick-up clip a script names is not played: the object is in the hand at once. */
 private pickUpObject(handle:number,task:Extract<ScmScriptedTask,{kind:'pickUpObject'}>,second=false){
  if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);
  const objects=this.runtime.game.objects,object=objects.at(task.object);
  if(this.heldObjectOf(handle,second))this.dropHeldObject(handle,true,second);
  const pedHeading=this.pedHeadingRadians(handle);
  object.usesCollision=false;object.isStatic=false;
  object.heldBy={ped:handle,offset:{...task.offset},node:task.bone,flags:task.orientation,rotation:object.heading-pedHeading,...(second?{second:true}:{})};
  this.poseHeldObject(object);
 }
 /** The enter/exit button on foot near a stealable object. CPlayerInfo::FindObjectToSteal (0x56DBD0) and the code
  * that calls it are unreversed, so this is AUTHORED from what GUNS1 (Home Invasion) tells the player ("Press
  * ~k~~VEHICLE_ENTER_EXIT~ to pick up the crate", "... to put the crate in the truck") and waits on
  * (IS_CHAR_HOLDING_OBJECT, then NOT): carrying a stealable object, the button sets it down in front of CJ; otherwise
  * the nearest stealable object within STEAL_REACH in front of him is lifted and held before his chest, with no pick-up
  * clip or carrying walk. True when the button went to it rather than to a car. */
 playerStealKey(){
  const held=this.heldObjectOf(PLAYER_PED_HANDLE),me=this.world.playerPed(),h=(me.heading??0)*Math.PI/180,forward={x:-Math.sin(h),y:Math.cos(h)};
  if(held){
   if(!held.stealable)return false;
   if(this.puttingDown)return true;
   // CTaskSimplePutDownEntity: ChoosePutDownHeight looks 0.65 ahead from 0.2 over the origin, 1.5 down; the PUTDWN
   // clip of the group plays and the object leaves the hands at m_fPutDownHeightZ into it.
   const ahead={x:me.position.x+forward.x*.65,y:me.position.y+forward.y*.65},top=me.position.z+.2;
   const found=this.world.groundLevel(ahead.x,ahead.y,top),surface=found!==undefined&&found>=top-1.5?found:undefined;
   const group=carryGroupFor(me.position.z,surface);
   this.world.setPlayerCarryPose?.(undefined);
   this.world.givePlayerOrders?.([{kind:'playAnim',file:'CARRY',name:`PUTDWN${group.suffix}`,loop:false,keepLastFrame:false,seconds:Number.POSITIVE_INFINITY}],false,false);
   this.puttingDown={object:held.handle,at:this.clockMs+group.putDownAt*1000,forward};
   return true;
  }
  let best:import('../engine/ScmObjects').ScmObject|undefined,bestDistance=STEAL_REACH;
  for(const object of this.runtime.game.objects.all){
   if(!object.stealable||object.heldBy||object.attachedTo)continue;
   const dx=object.position.x-me.position.x,dy=object.position.y-me.position.y,distance=Math.hypot(dx,dy);
   if(distance>bestDistance||Math.abs(object.position.z-me.position.z)>STEAL_HEIGHT||(dx*forward.x+dy*forward.y)<0)continue;
   best=object;bestDistance=distance;
  }
  if(!best)return false;
  // CTaskSimplePickUpEntity's LIFTUP clip of the group the object stands at, then CRRY_PRTIAL over his walk.
  const group=carryGroupFor(me.position.z,best.position.z);
  this.pickUpObject(PLAYER_PED_HANDLE,{kind:'pickUpObject',object:best.handle,offset:{...STEAL_HOLD_OFFSET},bone:STEAL_HOLD_NODE,orientation:0,animationName:'',animationFile:'',time:0});
  this.world.givePlayerOrders?.([{kind:'playAnim',file:'CARRY',name:`LIFTUP${group.suffix}`,loop:false,keepLastFrame:false,seconds:Number.POSITIVE_INFINITY}],false,false);
  this.world.setPlayerCarryPose?.('CRRY_PRTIAL');
  return true;
 }
 private heldObjectOf(handle:number,second=false){return this.runtime.game.objects.all.find(object=>object.heldBy?.ped===handle&&!!object.heldBy.second===second);}
 private pedHeadingRadians(handle:number){
  const degrees=handle===PLAYER_PED_HANDLE?this.world.playerPed().heading??0:this.peds.headingOf(handle);
  return degrees*Math.PI/180;
 }
 /** CTaskSimpleHoldEntity::DropEntity (0x6930F0). Collision comes back. Dropped quietly off (the operand false) the
  * object stays where the hand left it; dropped on, a heavy one (99998 or more, so collision force off) is set down
  * static under the ped, and a light one gets a push and falls, which here, with no fall to run, ends on the ground
  * under the ped too. */
 /** CREATE_CHAR's ped about to be spawned is a mission script's, and waits for its collision. */
 private nextPedWaitsForCollision=false;
 /** The player's put-down under way: the object, when it leaves his hands, and the way he faced. */
 private puttingDown?:{object:number;at:number;forward:{x:number;y:number}};
 /** CTaskSimplePutDownEntity reaching m_fPutDownHeightZ: the object is let go and set down ahead of the player. */
 private settlePutDown(){
  const p=this.puttingDown;if(!p||this.clockMs<p.at)return;
  this.puttingDown=undefined;
  const held=this.heldObjectOf(PLAYER_PED_HANDLE);if(!held||held.handle!==p.object)return;
  this.dropHeldObject(PLAYER_PED_HANDLE,true);
  held.position={x:held.position.x+p.forward.x*STEAL_PUT_DOWN_AHEAD,y:held.position.y+p.forward.y*STEAL_PUT_DOWN_AHEAD,z:held.position.z};
 }
 private dropHeldObject(handle:number,quietly:boolean,second=false){
  const object=this.heldObjectOf(handle,second);if(!object)return;
  object.heldBy=undefined;object.usesCollision=true;
  if(!quietly){object.isStatic=true;return;}
  const at=handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.exists(handle)?this.peds.positionOf(handle):object.position;
  const base=this.world.scriptObjectBaseOffset?.(object.handle)??0;
  object.position={x:at.x,y:at.y,z:at.z-1+base};object.isStatic=true;object.velocity={x:0,y:0,z:0};
 }
 /** CTaskSimpleHoldEntity::SetPedPosition (0x6940A0): with HOLD_ENTITY_UPDATE_TRANSLATION_ONLY the object takes the
  * bone's matrix and sits at the offset in the bone's axes; without it, it sits at the bone plus the offset in the
  * ped's axes, turned from the ped's matrix by m_fRotation. A holder that has gone lets it drop. */
 private poseHeldObject(object:import('../engine/ScmObjects').ScmObject){
  const held=object.heldBy!;
  if(held.ped!==PLAYER_PED_HANDLE&&!this.peds.exists(held.ped)){this.dropHeldObject(held.ped,true,!!held.second);return;}
  const tag=PED_NODE_BONE_TAG[held.node];if(tag===undefined)return;
  const entity=held.ped===PLAYER_PED_HANDLE?'player':this.peds.entity(held.ped);if(entity===undefined)return;
  const bone=this.world.scriptPedBoneMatrix?.(entity,tag);if(!bone)return;
  const o=held.offset,add=(p:{x:number;y:number;z:number},r:{right:V3;forward:V3;up:V3})=>({x:p.x+r.right.x*o.x+r.forward.x*o.y+r.up.x*o.z,y:p.y+r.right.y*o.x+r.forward.y*o.y+r.up.y*o.z,z:p.z+r.right.z*o.x+r.forward.z*o.y+r.up.z*o.z});
  if(held.flags&HOLD_ENTITY_UPDATE_TRANSLATION_ONLY){
   object.matrix={right:{...bone.right},forward:{...bone.forward},up:{...bone.up}};object.position=add(bone.position,bone);
  }else{
   const h=this.pedHeadingRadians(held.ped)+held.rotation,c=Math.cos(h),s=Math.sin(h);
   const ped={right:{x:Math.cos(h-held.rotation),y:Math.sin(h-held.rotation),z:0},forward:{x:-Math.sin(h-held.rotation),y:Math.cos(h-held.rotation),z:0},up:{x:0,y:0,z:1}};
   object.matrix={right:{x:c,y:s,z:0},forward:{x:-s,y:c,z:0},up:{x:0,y:0,z:1}};object.position=add(bone.position,ped);
  }
  object.heading=Math.atan2(-object.matrix.forward.x,object.matrix.forward.y);
 }
 /** A ped's bone (a skeleton tag) as a frame: its rows and position. */
 private pedBoneFrame(handle:number,tag:number){
  if(handle!==PLAYER_PED_HANDLE&&!this.peds.exists(handle))return undefined;
  const entity=handle===PLAYER_PED_HANDLE?'player':this.peds.entity(handle);if(entity===undefined)return undefined;
  return this.world.scriptPedBoneMatrix?.(entity,tag);
 }
 /** WARP_CHAR_INTO_CAR and its task: the player through the host, a script ped into the driver's seat. */
 private warpIntoCar(handle:number,vehicle:number,command:string){
  if(handle===PLAYER_PED_HANDLE){if(!this.host('warpPlayerIntoCar',command)(this.liveVehicle(vehicle)))throw new UnsupportedScmCommand(-1,0,command,'a player already riding, or a vehicle he cannot be seated in');return;}
  this.livePed(handle);this.peds.warpIntoCar(handle,vehicle,'driver');
 }
 private warpIntoCarAsPassenger(handle:number,vehicle:number,seat:number,command:string){
  if(handle===PLAYER_PED_HANDLE){
   if(!this.host('warpPlayerIntoCarAsPassenger',command)(this.liveVehicle(vehicle),seat))
    throw new UnsupportedScmCommand(-1,0,command,'a player already in a vehicle, or a vehicle other than a car');
   return;
  }
  this.livePed(handle);this.peds.warpIntoCar(handle,vehicle,seat);
 }
 /** The model of the vehicle a ped rides, by its handle. */
 /** A car handle's model id, the player's own car's included; undefined for none or a model known only by name. */
 private vehicleModelNumber(handle:number){const model=handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle);return typeof model==='number'?model:undefined;}
 private pedVehicleModel(handle:number){
  const vehicle=handle===PLAYER_PED_HANDLE?this.playerCarHandle():this.peds.rideOf(handle)?.vehicle;
  if(vehicle===undefined)return undefined;
  const model=vehicle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(vehicle).model:this.vehicles.modelOf(vehicle);
  return typeof model==='number'?model:undefined;
 }
 private playerVehicle(handle:number){
  const vehicle=handle===PLAYER_VEHICLE_HANDLE?this.world.playerPed().vehicle:undefined;
  if(!vehicle)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return vehicle;
 }
 /* The decision makers a script builds itself, by the slot its handle names. CDecisionMakerTypes' own tables
  * come from files this port does not publish; these are the rows the script writes at run time, which a host
  * can use for a ped wearing that maker whether or not the files are there.
  *
  * The four chances are written in the order the command gives them. The command's own parameter names and the
  * decision file's column names disagree — the schema calls them respect, hate, like and dislike, and the file
  * reader (after gtamods) calls the four columns friend, threat, player and neutral — and settling which
  * naming is right is not this port's to do. Either way they are the same four slots in the same order, so the
  * chances go into them in order and nothing here depends on what they are called. */
 readonly scriptDecisions=new Map<number,Map<number,DecisionChoice[]>>();
 /** The patrol route a script has built, a point and an animation at a time. */
 readonly patrolRoute:{position:{x:number;y:number;z:number};animationName:string;animationFile:string}[]=[];
 /* The particle systems a script makes. CREATE_FX_SYSTEM hands back a handle the script plays, stops and
  * kills; the ones made on a car, a ped or an object hang from it and are given its matrix again each step,
  * which is what FxSystem_c::SetMatrix is for. The systems themselves are the host's. */
 private readonly scriptFx=new Map<number,{system:unknown;attached?:{kind:'vehicle'|'ped'|'object';handle:number;offset:{x:number;y:number;z:number};direction?:{x:number;y:number;z:number};bone?:number}}>();
 /** SET_CHAR_SIGNAL_AFTER_KILL by ped handle. */
 private readonly signalAfterKill=new Map<number,boolean>();
 private nextFx=1;
  /* The blips the script has put on the radar, as the browser's own map draws them. CRadar keeps the table;
  * a coord blip carries its own point and an entity blip follows the thing it names, so the handle is looked
  * up in the pools the script made it from. A blip whose display does not include the radar, or whose entity
  * has gone, is not drawn — which is what CRadar::DisplayThisBlip and a stale handle come to. */
 radarBlips(){
  const blips:{x:number;z:number;sprite?:number;colour?:string;size?:number;dz?:number;shortRange?:boolean;fade?:boolean}[]=[];
  const player=this.world.playerPed().position;
  const hud=(i:number)=>{const [r,g,b]=HUD_COLOURS[i];return `rgb(${r},${g},${b})`;};
  for(const trace of this.runtime.game.radar.traces){
   if(trace.type===BLIP_NONE||!(trace.display&BLIP_DISPLAY_BLIPONLY))continue;
   const at=this.blipPosition(trace);if(!at)continue;
   const entity=trace.type===BLIP_CAR||trace.type===BLIP_CHAR||trace.type===BLIP_OBJECT;
   // tRadarTrace::GetStaticColour for the coord blips DrawCoordBlip draws: HUD blue for a THREAT appearance, red for
   // UNK, otherwise the trace colour taken as unfriendly. Entity blips (DrawEntityBlip, unreversed) keep the flag.
   const colour=entity?radarTraceColour(trace.colour,trace.bright,trace.friendly)
    :trace.appearance===BLIP_FLAG_THREAT?hud(HUD_COLOUR_BLUE):trace.appearance===BLIP_FLAG_UNK?hud(HUD_COLOUR_RED):radarTraceColour(trace.colour,trace.bright,false);
   blips.push({x:at.x,z:-at.y,sprite:trace.sprite||undefined,colour,size:trace.blipSize,dz:at.z-player.z,shortRange:trace.shortRange,fade:trace.fade});
  }
  return blips;
 }
 /** CTheScripts::IsPlayerOnAMission: the global DECLARE_MISSION_FLAG names is 1. The INTRO mission is the exception:
  * here it never gets past its car-recording wait (docs/FIDELITY_AUDIT.md "The intro that cannot finish"), so free roam
  * does not stay on a mission because of it, as with its zone names and weather. */
 playerOnAMission(){return this.runtime.playerOnAMission()&&!this.runtime.active.some(slot=>slot.thread.name.toUpperCase()==='INTRO');}
 /* CRadar::Draw3dMarkers (0x585BF0), which CHud::Draw runs while the HUD draws 3D markers and the screen is not
  * widescreen: every tracked blip shown as a marker places one. An entity's cone floats above it in the blip's colour
  * (a car's 2 above its box top raised a fifth, two thirds for the Nevada; a ped's 2.7 above it; an object's or
  * pickup's 1.8 above its top, or 1.6 indoors). A contact point off a mission is the red cylinder at its point. The
  * handle is the trace index with its counter in the high word. */
 radarMarkers(indoors:boolean){
  const out:{id:number;kind:'cone'|'cylinder';position:[number,number,number];size:number;colour:[number,number,number]}[]=[];
  const onMission=this.playerOnAMission();
  this.runtime.game.radar.traces.forEach((trace,i)=>{
   if(!trace.tracking)return;
   if(trace.display!==BLIP_DISPLAY_BOTH&&trace.display!==BLIP_DISPLAY_MARKERONLY)return;
   const id=(i|trace.counter<<16)>>>0,colour=radarTraceRgb(trace.colour,trace.bright,trace.friendly);
   const cone=(at:{x:number;y:number;z:number},lift:number,size:number)=>{out.push({id,kind:'cone',position:[at.x,at.y,at.z+lift],size,colour});};
   if(trace.type===BLIP_CAR){
    if(!this.vehicles.exists(trace.entityHandle))return;
    const car=this.vehicles.entity(trace.entityHandle),top=car===undefined?0:this.world.scriptVehicleBoxTop?.(car)??0;
    cone(this.vehicles.positionOf(trace.entityHandle),top*(this.vehicles.modelOf(trace.entityHandle)===MODEL_NEVADA?5/3:6/5)+2,2);
   }else if(trace.type===BLIP_CHAR){
    const at=this.blipPosition(trace);if(at)cone(at,2.7,1.2);
   }else if(trace.type===BLIP_OBJECT||trace.type===BLIP_PICKUP){
    // The browser does not know an object's box top before it has streamed; its origin stands in.
    const at=this.blipPosition(trace);if(at)cone(at,(trace.type===BLIP_PICKUP?2:0)+(indoors?1.6:1.8),.8);
   }else if(trace.type===BLIP_CONTACT_POINT&&!onMission){
    out.push({id,kind:'cylinder',position:[trace.position.x,trace.position.y,trace.position.z],size:2,colour:[255,0,0]});
   }
  });
  return out;
 }
 /** Where a blip sits: its own point, or the thing it is tied to. */
 private blipPosition(trace:{type:number;entityHandle:number;position:{x:number;y:number;z:number}}){
  if(trace.type===BLIP_CAR)return this.vehicles.exists(trace.entityHandle)?this.vehicles.positionOf(trace.entityHandle):undefined;
  if(trace.type===BLIP_CHAR){
   if(trace.entityHandle===PLAYER_PED_HANDLE)return this.world.playerPed().position;
   return this.peds.exists(trace.entityHandle)?this.peds.positionOf(trace.entityHandle):undefined;
  }
  if(trace.type===BLIP_OBJECT)return this.runtime.game.objects.exists(trace.entityHandle)?this.runtime.game.objects.at(trace.entityHandle).position:undefined;
  // A pickup blip follows the pickup the handle names; the trace keeps no point of its own for it.
  if(trace.type===BLIP_PICKUP)return this.runtime.game.pickups.at(trace.entityHandle)?.position;
  return trace.position;
 }
 /* Where the script has put the camera, in the renderer's axes, or nothing while the camera is the player's.
  * CCamera's fixed mode is a source and a point it looks at; the restores hand it back, and the host then
  * returns to whatever camera it was running. */
 scriptCamera(){
  const camera=this.runtime.game.camera;
  if(camera.lookingAtPlayer)return undefined;
  const entity=camera.lookingAtVector?undefined:camera.targetEntity,at=entity&&this.cameraEntityPosition(entity);
  if(camera.modeToGoTo===MODE_FIXED){
   // The fixed camera looks at its vector, or at the entity TakeControl gave it, where that entity is now; the
   // script's linear move and track (CAMERA_SET_VECTOR_MOVE/TRACK) carry the source and the look-at point while
   // they run.
   const source=camera.moveLinearPoint(this.clockMs)??camera.fixedModeSource,target=camera.trackLinearPoint(this.clockMs)??at??camera.fixedModeVector;
   return {position:{x:source.x,y:source.z,z:-source.y},target:{x:target.x,y:target.z,z:-target.y}};
  }
  // MODE_ATTACHCAM (CCam::Process_AttachedCam, unreversed; AUTHORED): the camera rides the entity at the offset in
  // its space and looks at the target entity, or at the look-at point in the same space. The tilt (a roll) is not
  // applied: the browser's camera keeps its up.
  if(camera.modeToGoTo===MODE_ATTACHCAM&&camera.attached){
   const a=camera.attached;
   try{
    const matrix=a.kind==='vehicle'?this.adapterRef.vehicleMatrix!(a.handle):this.adapterRef.pedMatrix!(a.handle);
    const place=(o:{x:number;y:number;z:number})=>({x:matrix.right.x*o.x+matrix.forward.x*o.y+matrix.up.x*o.z+matrix.position.x,
     y:matrix.right.y*o.x+matrix.forward.y*o.y+matrix.up.y*o.z+matrix.position.y,z:matrix.right.z*o.x+matrix.forward.z*o.y+matrix.up.z*o.z+matrix.position.z});
    const source=place(a.offset),target=camera.targetEntity?this.cameraEntityPosition(camera.targetEntity):place(a.lookAt??{x:0,y:1,z:0});
    if(target)return {position:{x:source.x,y:source.z,z:-source.y},target:{x:target.x,y:target.z,z:-target.y}};
   }catch{return undefined;}
  }
  // MODE_CAM_ON_A_STRING and the follow camera on an entity the script names (two missions): a chase point behind
  // and above it stands in for CCam's own follow modes.
  if(entity&&at){
   const heading=(entity.kind==='ped'?this.pedHeadingOf(entity.handle):this.vehicleHeadingOf(entity.handle))*Math.PI/180;
   const back=entity.kind==='ped'?4:7,up=entity.kind==='ped'?1.5:2.5;
   const source={x:at.x+Math.sin(heading)*back,y:at.y-Math.cos(heading)*back,z:at.z+up};
   return {position:{x:source.x,y:source.z,z:-source.y},target:{x:at.x,y:at.z,z:-at.y}};
  }
  return undefined;
 }
 /** Where the entity the camera is on stands now, in the script's coordinates. */
 private cameraEntityPosition(entity:{kind:'ped'|'vehicle';handle:number}){
  try{
   if(entity.kind==='ped')return entity.handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.exists(entity.handle)?this.peds.positionOf(entity.handle):undefined;
   return entity.handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehiclePose?.()?.position:this.vehicles.exists(entity.handle)?this.vehicles.positionOf(entity.handle):undefined;
  }catch{return undefined;}
 }
 private pedHeadingOf(handle:number){return handle===PLAYER_PED_HANDLE?this.world.playerPed().heading??0:this.peds.headingOf(handle);}
 private vehicleHeadingOf(handle:number){return handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehiclePose?.()?.heading??0:this.vehicles.headingOf(handle);}
 /* The pickups the script has made. CPickups keeps them in the same array as the world's own, and the browser
  * has a pickup world of its own to put them in; what it needs beyond the record is the dff and txd the model
  * stands for, which the host looks up. A pickup the browser reports collected is collected for the script
  * too, which is what HAS_PICKUP_BEEN_COLLECTED asks after. */
 /** How many pickups the script is holding that have not been collected. */
 scriptPickupCount(){return this.runtime.game.pickups.uncollectedCount;}
 scriptPickups(){
  const out:{handle:number;model:number|string;type:number;ammo:number;position:[number,number,number];price?:number;moneyPerDay?:number;text?:string}[]=[];
  for(const pickup of this.runtime.game.pickups.all){
   if(pickup.collected)continue;
   out.push({handle:pickup.handle,model:pickup.model,type:pickup.type,ammo:pickup.ammo,
    position:[pickup.position.x,pickup.position.y,pickup.position.z],price:pickup.price,moneyPerDay:pickup.moneyPerDay,text:pickup.text});
  }
  return out;
 }
 /** CPickup::GiveUsAPickUpObject's other half: the script's record is collected when the world's is. */
 collectScriptPickup(handle:number){this.runtime.game.pickups.collect(handle);}
 /* The car generators the script has made. CTheCarGenerators holds them in the same array as the world's
  * own, so the browser's fleet takes them beside the ones the IPLs placed; the record already carries the
  * angle packed the way CCarGenerator keeps it, and the two flags the world's own record packs into a word. */
 /** How many generators the script has, for a host that only wants to know whether the list has changed. The
  * list itself is built from the runtime's records and is not worth building every frame to count it. */
 scriptCarGeneratorCount(){let count=0;for(const g of this.runtime.game.carGenerators.generators)if(g.used)count++;return count;}
 scriptCarGenerators(){
  const out=[];
  for(const [index,generator] of this.runtime.game.carGenerators.generators.entries()){
   if(!generator.used)continue;
   out.push({id:`script:${index}`,source:'script',sourceIndex:index,
    // The record keeps the angle packed to a byte (CCarGenerator::Setup); the fleet reads IPL radians.
    position:generator.position,angle:generator.angle*Math.PI*2/256,modelId:generator.modelId,
    // DoInternalProcessing's decrement compares the unsigned count with a signed -1 and so never runs.
    generateCount:()=>generator.generateCount,
    // CSpecialPlateHandler::Find: the plate text CUSTOM_PLATE_FOR_NEXT_CAR gave this generator.
    plateText:()=>this.runtime.game.carGenerators.plateFor(index),
    primaryColor:generator.primaryColour,secondaryColor:generator.secondaryColour,
    flags:(generator.highPriority?1:0)|(generator.ignorePopulationLimit?2:0),
    alarmChance:generator.alarmChance,doorLockChance:generator.doorLockChance,
    minDelay:generator.minDelay,maxDelay:generator.maxDelay});
  }
  return out;
 }
 /** CSetPieces' table, which the script's own ADD_SET_PIECE fills. The runtime keeps the area as CRect does,
  * with its four edges named; the browser's own record is the same four numbers in the order the read-ahead
  * wrote them, so the conversion is a reordering and nothing more. */
 /** How many set pieces the script has, for the same reason. */
 scriptSetPieceCount(){return this.runtime.game.setPieces.pieces.length;}
 scriptSetPieces():{type:number;area:[number,number,number,number];spawn1:[number,number];target1:[number,number];spawn2:[number,number];target2:[number,number]}[]{
  return this.runtime.game.setPieces.pieces.map(piece=>({type:piece.type,
   area:[piece.area.left,piece.area.bottom,piece.area.right,piece.area.top],
   spawn1:[piece.spawn1.x,piece.spawn1.y],target1:[piece.target1.x,piece.target1.y],
   spawn2:[piece.spawn2.x,piece.spawn2.y],target2:[piece.target2.x,piece.target2.y]}));
 }
 /** CStuntJumpManager's list, which the script's own ADD_STUNT_JUMP builds. */
 scriptStuntJumps(){return this.runtime.game.stuntJumps;}
 /** CTheZones' info record for a zone as the running script has it, or nothing before the labels are loaded. */
 scriptZoneInfo(zoneInfoIndex:number){
  const zones=this.runtime.game.zones;
  if(!zones.loaded||zoneInfoIndex<0||zoneInfoIndex>=zones.count)return undefined;
  const info=zones.at(zoneInfoIndex);
  return {popType:info.popType,gangStrength:info.gangStrength,dealerStrength:info.dealerStrength,
   noCops:info.noCops,popRaces:info.popRaces};
 }
 /** CRestart as the script has it, for the one the game respawns from to follow, and a cheap count of the
  * changes the script has made to it so a host can copy only when one has happened. */
 scriptRestart(){return this.runtime.game.restart;}
 scriptRestartRevision(){return this.runtime.game.restart.revision;}
 /** SUPPRESS_CAR_MODEL: the models the streamer is told not to bring in for traffic. */
 suppressedCarModels(){return this.runtime.game.suppressedCarModels;}
 /** How many of the script's fires are burning. */
 scriptFireCount(){let count=0;for(const fire of this.runtime.game.fires.fires)if(fire.active&&fire.createdByScript)count++;return count;}
 /* The fires the script has started, for a host to burn where CFireManager's own table says. A fresh array
  * each time, because two callers comparing two results is worth more than the one allocation it saves: the
  * records inside it are built anyway, and a shared array quietly makes those two results the same one. */
 /** Script fires the world put out, by their table index. */
 scriptFiresWentOut(keys:readonly number[]){for(const key of keys)this.runtime.game.fires.putOut(key);}
 scriptFires(){
  const out:{key:number;position:{x:number;y:number;z:number};strength:number;generations:number;player?:boolean}[]=[];
  this.runtime.game.fires.fires.forEach((fire,index)=>{
   if(!fire.active||!fire.createdByScript)return;
   // CFire::ProcessFire keeps a fire on its ped at the ped's position; a ped that is gone takes it with him.
   // A fire on a vehicle rides it the same way, and goes with it.
   if(fire.vehicle!==undefined){
    if(!this.vehicles.exists(fire.vehicle)){this.runtime.game.fires.putOut(index);return;}
    const at=this.vehicles.positionOf(fire.vehicle);fire.position={x:at.x,y:at.y,z:at.z};
   }
   if(fire.ped!==undefined){
    if(fire.ped!==PLAYER_PED_HANDLE&&!this.peds.exists(fire.ped)){this.runtime.game.fires.putOut(index);return;}
    const at=fire.ped===PLAYER_PED_HANDLE?this.world.playerPed().position:this.ridingIn(fire.ped)??this.peds.positionOf(fire.ped);
    fire.position={x:at.x,y:at.y,z:at.z};
   }
   // Native axes, as the weapon system's fire pool keeps every other fire.
   out.push({key:index,position:{x:fire.position.x,y:fire.position.y,z:fire.position.z},
    strength:fire.strength,generations:fire.generationsAllowed,...fire.ped===PLAYER_PED_HANDLE?{player:true}:{}});
  });
  return out;
 }
 /** The objects the script has made, for a host to draw where the runtime says they are. */
 scriptObjects(){return this.runtime.game.objects.all;}
 /** The cars the script has made, which outlive any one command. */
 readonly vehicles:ScmVehiclePool<unknown>;
 /** The peds the script has made. */
 readonly peds:ScmPedPool<unknown>;
 /** CPedGroups: the groups the script has made, by the handle it holds them with. The player's own group is
  * handle zero and is always there, as CPlayerPed's is. */
 readonly groups=new Map<number,NativePedGroup>([[PLAYER_GROUP_HANDLE,new NativePedGroup()]]);
 /** bNeverLeavesGroup, which SET_CHAR_NEVER_LEAVES_GROUP sets, by handle. */
 private readonly neverLeavesGroup=new Set<number>();
 /** CPedGroups::Process's membership half: each script group processes, and a group left empty is removed. The
  * player's group is never removed. */
 private processGroups(nowMs:number){
  const peds={
   alive:(h:number)=>h===PLAYER_PED_HANDLE?this.world.playerPed().health>0:this.peds.exists(h)&&!this.peds.isDead(h),
   isPlayer:(h:number)=>h===PLAYER_PED_HANDLE,
   neverLeavesGroup:(h:number)=>this.neverLeavesGroup.has(h),
   position:(h:number)=>h===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.exists(h)?this.peds.positionOf(h):undefined,
  };
  for(const [handle,group] of this.groups){
   // CPlayerPed leads its own group from its creation on, so a flushed player's group has him back as leader, and
   // Process never appoints one of his followers in his place.
   if(handle===PLAYER_GROUP_HANDLE&&group.leader===undefined)group.setLeader(PLAYER_PED_HANDLE);
   group.process(peds);
   if(!group.countMembers()&&handle!==PLAYER_GROUP_HANDLE)this.groups.delete(handle);
  }
  // The player's group's script peds take the group's default task, CTaskComplexFollowLeaderInFormation, whenever the
  // script has none running on them; one that leaves the group stops. Set every frame, because a ped the pool makes
  // again (warped, attached) is a new body.
  const setFollows=this.world.setScriptPedFollowsPlayer;if(!setFollows)return;
  const players=this.groups.get(PLAYER_GROUP_HANDLE)!,now=new Set<number>();
  if(players.followsLeader)for(const handle of players.all()){
   if(handle===PLAYER_PED_HANDLE||!players.isFollower(handle))continue;
   const entity=this.peds.entity(handle);if(entity!==undefined&&!this.peds.rideOf(handle)){setFollows.call(this.world,entity,true);now.add(handle);}
  }
  for(const handle of this.followingPlayer)if(!now.has(handle)){const entity=this.peds.entity(handle);if(entity!==undefined)setFollows.call(this.world,entity,false);}
  this.followingPlayer=now;
  this.groupFollowsIntoCars(players,nowMs);
 }
 /** The car the player's group last saw him in, and the followers still to get out of it. */
 private groupCar?:number;
 private groupExits:{handle:number;vehicle:number;at:number}[]=[];
 /** When each follower was last sent to get in the leader's car (CTaskComplexFollowLeaderAnyMeans). */
 private groupBoarding=new Map<number,number>();
 /** Followers the leader's exit sent out: ComputeResponseLeaderExitedCar's CTaskComplexLeaveCar has bSensibleLeaveCar
  * off, so they do not wait for the car to slow (GroupEventHandler.cpp:344-349) and jump from one still moving. */
 private groupLeaving=new Set<number>();
 /** CGroupEventHandler::ComputeResponseLeaderEnteredCar and ComputeResponseLeaderExitedCar for the player's group, for
  * the script's peds in it. As he gets in, each follower on foot with no script task of its own takes
  * CTaskComplexEnterCarAsPassenger into a free seat, while the group's members enter the leader's vehicle. As he gets
  * out, follower i leaves its seat rand(-250, 250) + 500 i ms after him. These are the group's tasks, not the script's,
  * so GET_SCRIPT_TASK_STATUS does not see them (they go under no command's opcode). */
 private groupFollowsIntoCars(players:NativePedGroup,nowMs:number){
  const car=this.world.playerPed().vehicle?this.playerCarHandle():undefined;
  const followers=players.all().filter(h=>h!==PLAYER_PED_HANDLE&&players.isFollower(h)&&this.peds.exists(h)&&!this.peds.isDead(h)&&this.peds.entity(h)!==undefined);
  const groupTask=(handle:number,task:ScmScriptedTask)=>{
   try{this.runtime.world!.givePedScriptedTask!(handle,task,0);}catch(error){if(!(error instanceof UnsupportedScmCommand)&&!(error instanceof ScmEntityPending))throw error;}
   this.taskRecords.delete(handle);
  };
  if(car!==this.groupCar){
   const left=this.groupCar;this.groupCar=car;
   if(left!==undefined&&left!==PLAYER_VEHICLE_HANDLE){
    let i=0;
    for(const handle of followers)if(this.peds.rideOf(handle)?.vehicle===left&&!this.taskRecords.has(handle))this.groupExits.push({handle,vehicle:left,at:nowMs+Math.max(0,this.random.next()/(RANDOM_SAMPLE_MAX+1)*500-250+i++*500)});
   }
   if(car!==undefined&&car!==PLAYER_VEHICLE_HANDLE&&players.membersEnterLeadersVehicle&&players.followsLeader){
    this.groupExits=this.groupExits.filter(exit=>exit.vehicle!==car);
    for(const handle of followers)if(!this.peds.rideOf(handle)&&!this.taskRecords.has(handle)){this.groupBoarding.set(handle,nowMs);groupTask(handle,{kind:'enterCarAsPassenger',vehicle:car,time:-1,seat:-1});}
   }
  }
  // CTaskComplexFollowLeaderAnyMeans, the default task of a follower in the player's group: while the leader sits in a
  // car, a follower on foot with nothing of the script's to do goes to get in it, not only as he gets in (a homie
  // thrown out by a crash, or set down by the script, climbs back in). Asked again every three seconds while it is
  // still on foot, as the task starts over when its entry fails.
  if(car!==undefined&&car!==PLAYER_VEHICLE_HANDLE&&players.membersEnterLeadersVehicle&&players.followsLeader){
   for(const handle of followers){
    if(this.peds.rideOf(handle)||this.taskRecords.has(handle)||this.runners.has(handle)||this.groupExits.some(exit=>exit.handle===handle))continue;
    // Still on its way to the car (the entry is its order): left to finish.
    const entity=this.peds.entity(handle);if(entity!==undefined&&this.world.scriptPedHasOrder?.(entity)){this.groupBoarding.set(handle,nowMs);continue;}
    const last=this.groupBoarding.get(handle);if(last!==undefined&&nowMs-last<3000)continue;
    this.groupBoarding.set(handle,nowMs);groupTask(handle,{kind:'enterCarAsPassenger',vehicle:car,time:-1,seat:-1});
   }
  }else this.groupBoarding.clear();
  if(!this.groupExits.length)return;
  const due=this.groupExits.filter(exit=>exit.at<=nowMs);if(!due.length)return;
  this.groupExits=this.groupExits.filter(exit=>exit.at>nowMs);
  for(const exit of due)if(this.peds.exists(exit.handle)&&this.peds.rideOf(exit.handle)?.vehicle===exit.vehicle&&!this.taskRecords.has(exit.handle)){this.groupLeaving.add(exit.handle);groupTask(exit.handle,{kind:'leaveCar',vehicle:exit.vehicle});}
 }
 /** The player's group's script peds last set following him. */
 private followingPlayer=new Set<number>();
 private nextGroup=1;
 private readonly entry:number;
 /** CTheScripts::Process for one frame. The first call starts MAIN, as CGame::Initialise does. */
 /** CTimer's last four frame times, for m_snPPPPreviousTimeInMilliseconds. */
 private readonly frameTimes:number[]=[];
 /** CVehicleRecording::SaveOrRetrieveDataForThisFrame, after the frame's collisions (CWorld::Process): each playback
  * puts its car on the recording. `nowMs` is the game clock. */
 /** The car each playback started on, by the handle it was started with, for as long as the playback runs. */
 private readonly recordedCars=new Map<number,unknown>();
 processCarRecordings(nowMs:number){
  const times=this.frameTimes,host=this.runtime.game.carRecordingHost;
  const previous=times.length<4?times[0]??nowMs:times[times.length-4];
  times.push(nowMs);if(times.length>4)times.shift();
  if(host&&!this.stopped)saveOrRetrieveDataForThisFrame(host,Math.max(0,nowMs-previous));
  // Cars with no playback left are forgotten.
  if(this.recordedCars.size){const recordings=this.runtime.game.vehicleRecordings;for(const handle of this.recordedCars.keys())if(recordings.findVehicleRecordingIndex(handle)===-1)this.recordedCars.delete(handle);}
 }
 /** The game clock the script last ran at. */
 private clockMs=0;
 /** The areas the last script pass asked HighlightImportantArea for, by marker id. */
 private readonly highlights=new Map<number,{id:number;x:number;y:number;z?:number;halfX:number;
  /** DRAW_SPHERE's marker: one cylinder as DrawScriptSpheres places them, not the highlight's three. */
  sphere?:boolean}>();
 /** CShadows::RenderIndicatorShadow (0x70CCB0) for each area the last script pass highlighted: three red cylinders
  * (C3dMarkers::PlaceMarkerSet, MARKER3D_CYLINDER, 255 0 0 255, pulse 2048 and 0.2) at 0.8, 0.9 and the full size, all
  * under the script's id. A 2D area's centre has no height: FindGroundZForCoord finds it. */
 highlightedAreas(){return [...this.highlights.values()];}
 step(nowMs:number,timeStepMs:number){
  this.clockMs=nowMs;
  if(this.stopped)return;
  this.highlights.clear();
  if(!this.started){this.started=true;this.runtime.start(this.entry);}
  this.elapsed+=timeStepMs;
  try{this.runtime.process(Math.trunc(nowMs)>>>0,timeStepMs);if(this.handBackPending)this.handBack(nowMs);if(this.attractorArrivals.size)this.settleAttractorArrivals();this.processObjectBrains(nowMs);this.processPedBrains(nowMs);this.processGarageDoors(nowMs);this.updateConversations(nowMs);this.settlePutDown();if(this.brainObjects.size)this.takeMovedBrainObjects();this.runtime.game.objects.advanceAnims(timeStepMs/1000);this.followAttachments();this.processGroups(nowMs);
   // CUserDisplay::Process, after CTheScripts::Process in CGame::Process: the mission clock moves its variable.
   this.processRunners(timeStepMs/1000);
   this.drownRiders(timeStepMs);
   this.processTaskRecords();
   const game=this.runtime.game;game.onscreenTimer.process(this.globals,timeStepMs,game.widescreenOn,()=>this.world.frontendAudioEvent?.(33));
   // CAudioEngine::Service after the frame: the beat track's status moves on.
   game.cutsceneTrack.service(timeStepMs);}
  catch(error){
   if(error instanceof UnsupportedScmCommand)this.stopped={command:error.command,offset:error.offset,detail:error.message};
   else this.stopped={command:'error',offset:-1,detail:String(error)};
  }
  if(this.fade===this.ownFade)this.ownFade.process(timeStepMs/1000);
 }
 /** A mission that gives up on a command the port lacks never reaches its own ending, which is what would hand the
  * player back: its cleanup has run (the camera is his again), but SET_PLAYER_CONTROL off and a fade to black would
  * stand for good, leaving a game that looks frozen. The original has no such stop; the port gives the player his
  * controls back and fades in, so free roam goes on. */
 private handBack(nowMs:number){
  this.handBackPending=false;
  if(!this.playerControl){this.playerControl=true;this.world.setPlayerControl(true);}
  if(this.fade.value>0)this.runtime.world?.fade(1000,1,nowMs);
  // A shop script that gave up at its counter leaves its fixed camera up: the camera goes back behind the player.
  const game=this.runtime.game;
  // A mission's own ending clears the flag DECLARE_MISSION_FLAG names; one that stopped part way never reaches it, and
  // the side missions, the gyms and the next mission's trigger would all go on hearing that a mission is under way.
  if(this.missionGaveUp){
   this.missionGaveUp=false;const flag=game.onAMissionFlag,space=this.runtime.scriptSpace;
   if(flag&&flag+4<=space.length)new DataView(space.buffer,space.byteOffset,space.byteLength).setUint32(flag,0,true);
  }
  if(game.miniGameInProgress){const state=this.world.playerCameraState?.();if(state)game.camera.restoreWithJumpCut(state);game.miniGameInProgress=false;}
 }
 /** What the script has done so far, for the dev API and the browser tests. */
 /** CPedScriptedTaskRecord's records, one per ped here (the port holds one scripted order at a time). A wander
  * task never finishes, so it keeps its record until it is replaced or cleared. */
 private readonly taskRecords=new Map<number,{opcode:number;status:number;wander:boolean}>();
 /** CPedScriptedTaskRecordData::Set through a CEventScriptCommand: EVENT_ASSOCIATED until the next Process. */
 private recordTask(handle:number,opcode:number,wander:boolean){this.taskRecords.set(handle,{opcode,status:TASK_EVENT_ASSOCIATED,wander});}
 /** CPedScriptedTaskRecord::Process (0x6085E0): a record whose ped is gone, or whose task the ped no longer holds, is
  * flushed; one still held is TASK_ASSOCIATED. */
 private processTaskRecords(){
  for(const [handle,record] of this.taskRecords){
   if(handle===PLAYER_PED_HANDLE){
    if(this.world.playerHasScriptTask?.())record.status=TASK_TASK_ASSOCIATED;else this.taskRecords.delete(handle);
    continue;
   }
   if(!this.peds.exists(handle)){this.taskRecords.delete(handle);this.drivingTasks.delete(handle);continue;}
   if(record.wander||this.runners.has(handle)){record.status=TASK_TASK_ASSOCIATED;continue;}
   // A ped still being made (its handle given, its body pending) keeps the order it will be given.
   const ped=this.peds.entity(handle);
   if(this.world.scriptPedHasOrder&&ped!==undefined&&!this.world.scriptPedHasOrder(ped)){this.taskRecords.delete(handle);this.drivingTasks.delete(handle);continue;}
   record.status=TASK_TASK_ASSOCIATED;
  }
 }
 /** The script's globals, which the onscreen clock and counters read and write. */
 private get globals(){const space=this.runtime.scriptSpace;return this.globalsView??=new DataView(space.buffer,space.byteOffset,space.byteLength);}
 private globalsView?:DataView;
 /** COnscreenTimer::ProcessForDisplay for the HUD: the clock and the counters, as text with their GXT keys. */
 onscreenDisplay(){
  const timer=this.runtime.game.onscreenTimer;timer.processForDisplay(this.globals);
  if(!timer.display)return undefined;
  return {clock:timer.clock.enabled?{text:timer.clock.displayed,key:timer.clock.textKey}:undefined,
   counters:timer.counters.map((c,slot)=>c.enabled?{slot,text:c.displayed,key:c.textKey,type:c.type,colour:c.colourId,flash:c.flashWhenFirstDisplayed,value:c.varId+4<=this.globals.byteLength?this.globals.getInt32(c.varId,true):0}:undefined).filter(c=>c!==undefined)};
 }
 snapshot(){
  const {game}=this.runtime;
  return {
   started:this.started,
   stopped:this.stopped?{...this.stopped}:null,
   gaveUp:this.gaveUp.map(entry=>({...entry})),
   skipped:[...this.skipped.values()].map(entry=>({...entry})),
   threads:this.runtime.active.map(slot=>({id:slot.id,name:slot.thread.name,ip:slot.thread.ip})),
   clock:{hours:game.clock.hours,minutes:game.clock.minutes},
   fade:{alpha:this.fade.value,fading:this.fade.fading},
   relationships:this.relationships.length,
   laRiots:this.laRiots,
   entryExitFlags:this.entryExitFlags,
   garages:game.garages.garages.length,
   objectVisibilities:this.objectVisibilities,
   playerModelsBuilt:this.playerModelsBuilt,
   playerControl:this.playerControl,
   scriptVehicles:this.vehicles.count,
   scriptPeds:this.peds.count,
   patrolRoute:this.patrolRoute.length,
   groups:[...this.groups.values()].filter(group=>group.countMembers()>0).length,
   missionText:this.missionText??null,
   cutscenes:this.cutscenes.length,
   requestedModels:this.requestedModels.size,
   areasCleared:this.areasCleared,
   playerStart:this.playerStart?{...this.playerStart}:null,
   restartPoints:{hospitals:game.restart.hospitals.length,police:game.restart.police.length},
   stuntJumps:game.stuntJumps.length,
   carGenerators:game.carGenerators.count,
   objects:game.objects.count,
   zones:game.zones.count,
   zonesTouched:game.zones.all.filter(zone=>zone.popType!==5||zone.dealerStrength>0||zone.gangStrength.some(Boolean)).length,
   maximumWantedLevel:game.maximumWantedLevel,
   totalMissions:game.totalNumberOfMissions,
   progressTotal:game.progressTotal,
  };
 }
}
