import {taxiLightCoronas} from './render/taxiLights';
import {STARTING_LOADOUT,OPENING_MISSION,grantStartingLoadout} from './weapons/startingLoadout';
import {ScmGarages,isCarSprayable,BMX_CLASS_MODELS,STAT_VEHICLE_RESPRAYS,type StoredCar} from './engine/ScmGarages';
import {carBombEvents} from './vehicle/nativeCarBomb';
import {restoreStoredParts,storedPlacement,storeVehicle} from './simulation/storedVehicles';
import {playerFootstepSoundLevel} from './ped/nativeSoundEvents';
import {NativeWeaponAudio} from './audio/native/NativeWeaponAudio';
import {evaluateCarPosition} from './simulation/nativeCarChoice';
import {statUpdateBar,statNameKey} from './ui/nativeStatUpdate';
import {FALLEN_LAMPPOST_SOLVER_GROUPS} from './simulation/solverGroups';
import {carRollsOverProp} from './simulation/vehiclePropContacts';
import {controlNameOf,controlNaming,controlsNamedIn,gxtHudText,gxtText,insertNumbers,loadedText,setControlNaming,setTouchText,useTouchControlNames} from './assets/gxt';
import {ScriptTextLayer} from './ui/ScriptTextLayer';
import {populationOutsideView} from './render/populationVisibility';
import {NativeHunger} from './simulation/nativeHunger';
import {turnToward} from './simulation/nativePlayerLocomotion';
import {NativeParachuteTimer,WEAPON_PARACHUTE} from './simulation/nativeParachuteTimer';
import {sphereTouchingVehicle} from './vehicle/sphereTouchingVehicle';
import {NativeStatReactions,readActionReactionStats,STAT_BIKE_SKILL} from './simulation/nativeStatReactions';
import {STAT_CALORIES,STAT_COST_OF_PROPERTY_DAMAGED,STAT_PROGRESS_MADE,ScmStats} from './engine/ScmGameState';
import {NativeShinyTexts} from './render/NativeShinyTexts';
import {pedSignalQuad,type ShinyQuad} from './world/nativeShinyTexts';
import {nativeWeaponMovement} from './weapons/nativeWeaponMovement';
import {Progression} from './simulation/Progression';
/** A script heading, degrees clockwise from north, as the yaw the browser turns bodies by. */
const scriptYaw=(degrees:number)=>degrees*Math.PI/180+Math.PI;
/** SET_CHAR_ROTATION's x and y in degrees as a tilt in radians, none when both are nought. */
const scriptTilt=(x:number,y:number)=>x||y?{x:x*Math.PI/180,y:y*Math.PI/180}:undefined;
/** A script car heading (degrees, 0 facing north) as the body's rotation about the up axis. A car's front is its body's
 * -z, which a rotation of nothing already points north, so the angle is the heading itself; scriptYaw's half turn is for
 * the ped headings, which measure the facing from the renderer's +z. */
const scriptCarRotation=(degrees:number)=>degrees*Math.PI/180;
/** A ped a script made inside a car. It never walks: it rides where the car goes, and the occupant renderer
 * draws it in its seat. CPopulation::AddPedInCar makes one of these rather than a ped on the ground. */
interface ScriptRider{rider:true;model:number|string;car:import('./simulation/WorldCar').WorldCar;
 /** TASK_DRIVE_BY: the rider leans out and fires (scriptDriveBy). */
 driveBy?:import('./simulation/scriptDriveBy').ScriptDriveBy;
 seat:number|'driver';health:number;heading:number;accuracy:number;invulnerable:boolean;gone:boolean;
 /** The drive-by is the group's answer to a threat (CTaskAllocatorKillThreatsDriveby), not the script's, and on whom. */
 groupDriveBy?:string;
 /** Where on the car the ped hangs, in the car's own axes, for one attached rather than seated. */
 offset?:{x:number;y:number;z:number};
 /** An attached ped that stands (the hot-dog vendor) and the quarter turn he faces off the car's front. */
 stand?:boolean;facing?:number;
 /** TASK_PLAY_ANIM in the seat: the clip once read, the game time it began at, and how it ends. */
 clip?:{name:string;animation?:import('./assets/ifp').NativeAnimation;started:number;loop:boolean;hold:boolean;seconds:number;failed?:boolean}}
const scriptRiders=new Set<ScriptRider>();
const asRider=(entity:unknown)=>(entity as ScriptRider|undefined)?.rider?entity as ScriptRider:undefined;
/** A script vehicle that is a car (WorldCar) rather than a bike, boat, aircraft or train carriage. */
const isScriptCar=(v:unknown):v is import('./simulation/WorldCar').WorldCar=>!!v&&typeof (v as {setPedInAsDriver?:unknown}).setPedInAsDriver==='function';
/** A script vehicle CAutoPilot drives: a car, or a bike, whose rider takes the autopilot's pedals. */
const isScriptDrivable=(v:unknown):v is import('./simulation/ScriptCarMissions').ScriptDrivable=>isScriptCar(v)||!!v&&typeof (v as {autopilotInput?:unknown}).autopilotInput==='function';
/** The riders the occupant renderer should draw this frame. The browser's cars carry a seat point on each
 * side, so a driver and a front passenger are drawn where they sit; a script can seat a ped further back and
 * that ped rides unseen until the models carry rear seat points. A rider whose car has gone stops riding. */
/** `driveBy` gives the drive-by clips and gun a leaning rider needs, once the gang drive-bys have loaded them. */
function scriptOccupantPoses(driveBy?:{clip:(name:string)=>import('./assets/ifp').NativeAnimation|undefined;gun?:{asset:{model:import('./assets/dff').DffModel;textures:import('./assets/modelTextures').ModelTexture[]}}},
 bikeClip?:(block:string,name:string)=>import('./assets/ifp').NativeAnimation|undefined,nowMs=0){
 const poses:import('./render/VehicleOccupants').OccupantPose[]=[];
 for(const rider of scriptRiders){
  if(rider.gone||rider.car.disposed||rider.health<=0){scriptRiders.delete(rider);continue;}
  // A clip the script plays on the seated rider takes the place of the seat's own pose: looped, or held at its end.
  const own=rider.clip?.animation,played=own&&rider.clip?{clip:rider.clip.name,animation:own,seconds:own.duration>0?(rider.clip.loop?((nowMs-rider.clip.started)/1000)%own.duration:Math.min((nowMs-rider.clip.started)/1000,own.duration)):0}:undefined;
  // A bike's rider sits on the saddle with the ride group's clip, as the player does: still, riding or pedalling by
  // the bike's speed. A pillion, and riders of boats and aircraft, ride unseen for now.
  const bike=rider.car as unknown as Partial<import('./simulation/WorldBike').WorldBike>;
  if(!isScriptCar(rider.car)&&typeof bike.riderPose==='function'&&bike.car&&!rider.offset&&rider.seat==='driver'){
   const pose=bike.riderPose(),clip=pose.seat&&bikeClip?.(pose.block,pose.idle);
   if(pose.seat&&(clip||played))poses.push({key:`script:${bike.car.body.handle}:driver`,car:bike as import('./render/VehicleOccupants').OccupantVehicle,model:rider.model,local:pose.seat,...(played??{clip:pose.idle,seconds:clip!.duration>0?pose.time%clip!.duration:0,animation:clip!})});
   continue;
  }
  // The occupant renderer seats peds in cars; a rider on a script boat or aircraft rides unseen for now.
  if(!isScriptCar(rider.car))continue;
  // A ped a script attached hangs where it said, in the car's own axes; a seated one sits at the car's own
  // seat point, and the browser's cars carry one on each side.
  const seat=rider.offset??rider.car.seat(rider.seat==='driver'?'left':'right');
  if(!seat||!rider.offset&&typeof rider.seat==='number'&&rider.seat!==0)continue;
  // A drive-by rider plays GANG_DRIVEBYLHS/RHS on the window it fires from, the gun in its hand.
  const d=rider.driveBy,clipName=d&&`gang_driveby${d.side==='left'?'lhs':'rhs'}`,clip=clipName?driveBy?.clip(clipName):undefined;
  if(d&&clip&&clip.duration>0&&!rider.offset){
   poses.push({key:`script:${rider.car.car.body.handle}:${rider.seat}`,car:rider.car,model:rider.model,local:seat,clip:clipName!,seconds:d.seconds%clip.duration,animation:clip,gun:driveBy?.gun?.asset});
   continue;
  }
  poses.push({key:`script:${rider.car.car.body.handle}:${rider.offset?'on':rider.seat}`,car:rider.car,
   model:rider.model,local:seat,headingOffset:rider.facing,...(played??{clip:rider.offset?(rider.stand?'idle_stance':'car_sit'):sitClip(rider.car.modelFlags,rider.seat==='driver'),seconds:0})});
 }
 return poses;
}
/** The browser's walking ped behind a script handle, or nothing when the handle names a ped that rides. */
const onFoot=(entity:unknown)=>asRider(entity)?undefined:entity as import('./simulation/WorldPedestrians').Pedestrian|undefined;
import {canPedStepOutCar} from './vehicle/nativeDieInCar';
import {VehicleOccupants} from './render/VehicleOccupants';
import {SirenLights} from './render/SirenLights';
import {Skidmarks} from './render/Skidmarks';
import {BoatWakes} from './render/BoatWakes';
import {CarEntry,nativeRideAnims,nativeSteerOverlay} from './simulation/CarEntry';
import {BikeMount,bikeTooFastToBoard} from './simulation/BikeMount';
import {MODEL_FLAG,sitClip} from './simulation/nativeDoor';
import {WorldPickups} from './simulation/WorldPickups';
import {updatePlayerSwim} from './simulation/playerSwim';
import {vehicleDestroyed} from './simulation/vehicleDestroyed';
import {PLAYER_MOTION_CLIPS,playerMotionGroupToLoad} from './ped/playerMotionGroup';
import {playerBodyRatios,type PlayerBodyRatios} from './assets/blendPlayerBody';
import {vehicleLightsStatus} from './simulation/nativeVehicleLights';
/** aDriveAnimIdsBoat: the standing boat driver's idle, steering and look back. */
const BOAT_RIDE={idle:'DRIVE_BOAT',left:'DRIVE_BOAT_L',right:'DRIVE_BOAT_R',back:'DRIVE_BOAT_back'};
import {advancePlaneEntry,planeEntrySlots} from './simulation/WorldPlane';
import {WorldPolice,DEFAULT_COP_MODEL,DEFAULT_COP_CAR} from './simulation/WorldPolice';
import {waitingCopSpot,waitingCoppers} from './police/waitingCoppers';
import {scalePedLimits,scalePedTargets} from './assets/populationCycle';
import {WEAPONS} from './weapons/catalog';
import {WeaponDrops} from './simulation/WeaponDrops';
import {MoneyDrops} from './simulation/MoneyDrops';
import {nativeWeatherRegion,WEATHER_REGION} from './world/weatherRegion';
import {CRIME,LAW_ENFORCEMENT_MODELS} from './simulation/nativeWanted';
import {GangWars,GANG_COLOURS,attackBlipSprite} from './simulation/GangWars';
import {HeadlightBeams} from './render/HeadlightBeams';
import {FRAME_LIMITER_FPS,MENU_FPS,frameDue,readDisplaySettings,saveDisplaySettings,type DisplaySettings,type FramePacer} from './core/frameLimiter';
import {getUpClip,getUpBlockedBy,isFrontClip,stuckUnderCarDamage,GET_UP_CLEAR_RADIUS} from './ped/nativeGetUp';
import {WaterCannon,initialCannonAim,stepFireTruckAim,cannonDirection,cannonEmission,CANNON_MODELS,CANNON_DEFAULT_NOZZLE,type CannonAim} from './simulation/nativeWaterCannon';
import {initialTankTurret,stepTankTurret,stepTankTurretPad,tankShotDirection,tankDefaultMuzzle,TANK_FIRE_INTERVAL_MS,TANK_SHOT_RANGE,TANK_RECOIL,type TankTurret} from './simulation/nativeTankControl';
import {EXPLOSION} from './combat/nativeExplosion';
import {carLightPools} from './render/carLightPools';
import {pedTypeAtLeastDealer,playerKilledADealer} from './simulation/nativePopCycleEvents';
import {CHEATS,megaPunchBlow,type CheatName} from './simulation/nativeCheats';
import {VEHICLE_ANIM_GROUP_TABLES} from './assets/vehicleAnimGroups';
import {stepFogReduction} from './world/nativeFogReduction';
import {VehicleAnimationLibrary} from './assets/vehicleAnimations';
import {WantedSystem} from './simulation/WantedSystem';
import {WantedHud} from './ui/WantedHud';
import {hudAmmoText} from './ui/nativeAmmoText';
import {radarRange} from './ui/nativeRadar';
import {carsStrikePlayer} from './simulation/playerCarHit';
import {WeaponSystem,playerAimReach} from './weapons/WeaponSystem';
import {AIM_CROSSHAIR_NDC,pickAimTarget} from './input/aimAssist';
import {WeaponView} from './weapons/WeaponView';
import {WorldFx} from './simulation/fx/WorldFx';
import {NativeWeather,WEATHER} from './world/nativeWeather';
import {NativeWeatherEffects} from './render/NativeWeatherEffects';
import {NativeRoadsigns} from './render/NativeRoadsigns';
import {NativeOcclusion,type OcclusionCamera} from './world/nativeOcclusion';
import {NativePostEffects,type VisionMode} from './render/NativePostEffects';
import {NativeVolumetricClouds} from './render/NativeVolumetricClouds';
import {NativeEscalators} from './render/NativeEscalators';
import {openEscalatorAssets} from './assets/escalatorAssets';
import {lightingFromCol,screenExtraMult,SCREEN_EXTRA_MULT_INITIAL,DEFAULT_CONTACT_SURFACE_BRIGHTNESS} from './world/nativePostEffects';
import {nativeContactBrightness} from './assets/collisionLighting';
import {decodeNamedTextures} from './assets/modelTextures';
import {NativeMovingFog} from './render/NativeMovingFog';
import {playHornIfNecessary} from './simulation/nativeCarHorn';
import {GANG_RIVALS,addRespect,maxGroupMembers} from './simulation/nativePopulation';
import {Frustum,Matrix4,Object3D,Quaternion,Sphere,Vector2,Vector3} from 'three';
import {StuntJumps} from './simulation/StuntJumps';
/** Reused aim-direction scratch: WeaponSystem.tick copies it, fire/driveby read it synchronously. */
const scratchAim = new Vector3();
const scratchSpine = new Vector3(),scratchPoolFront = new Vector3(),scratchCameraFront = new Vector3();
import {nativeSaveEffects,type ScmSavePoint} from './assets/scmSavePoints';
import {AE_FRONTEND} from './audio/native/NativeFrontendAudio';
import {VEHICLE_AUDIO_TYPE_FOR_NAME} from './audio/native/NativePoliceScanner';
import {VEHICLE_AUDIO_SETTINGS} from './audio/native/vehicleAudioSettings';
import {HUD_COLOURS} from './ui/nativeHudColours';
import {PICKUP_TYPE} from './assets/scmPickups';
import {Arsenal} from './weapons/Arsenal';
import {WorldTraffic} from './simulation/WorldTraffic';
import {WorldPedestrians,setCharacterAnim,type Pedestrian} from './simulation/WorldPedestrians';
import {PlayerScriptTasks} from './simulation/playerScriptTasks';
import {PlayerPhone} from './simulation/PlayerPhone';
import {ScriptCarMissions} from './simulation/ScriptCarMissions';
import {ScriptObjectViews} from './simulation/ScriptObjectViews';
import {weaponById} from './weapons/catalog';
import {CAR_EXTINGUISHED_HEALTH} from './simulation/nativeCarDamage';
import {fxIdentity} from './simulation/fx/NativeFx';
import type {WorldCar as ScriptCar} from './simulation/WorldCar';
type WorldCarPad=ScriptCar['pad'];
import {nativeDayNightBalance} from './world/nativeDayNight';
import {StaticWorldProvider} from './assets/StaticWorldProvider';
import {setChunkCacheBudget} from './assets/staticWorldArchive';
import {setBuildingDualPass} from './assets/buildingAlpha';
import {modelBuildStats,setRetainedModels} from './assets/ModelObjects';
import {rehydrateResidentParts,residentModelsOf,type ResidentModel} from './assets/residentModels';
import {includedScene} from './assets/includedScenes';
import {SceneRegionFollower} from './assets/sceneRegionFollower';
import {readSurfaceMovementFlags,steepSlopeRefusesJump,surfaceBlocksSprint} from './simulation/nativeSurfaceMovement';
import {rapierClimbWorld} from './simulation/climbProbe';
import {WEAPON_FLAG,nativeWeaponInfo,weaponUsedWithoutAmmo} from './weapons/weaponData';
import {nativePedType} from './ped/nativeAcquaintance';
import {firstPersonMode} from './weapons/nativeFirstPerson';
import {loadHudSprites} from './ui/nativeHudSprites';
import {PLAYER_IDLE_CLIPS,PlayerIdles,loadPlayerIdles} from './assets/playerIdles';
import {CLIMB_CLIPS,testForClimb} from './ped/nativeClimb';
import {worldZoneAt} from './assets/worldZones';
import {zoneText} from './ui/nativeZoneText';
import {NativePlaceName} from './ui/nativePlaceName';
import {inPhotograph} from './weapons/nativePhotograph';
import {stepStamina} from './locomotion/player';
import {pickupCategory} from './assets/scmPickups';
import {readSurfaceAudio,nativeFootstepCategory,wadingSurface} from './assets/surfaceAudio';
import {nativeAudioCamera,worldBikeAudioInput,worldBoatAudioInput,worldCarAudioInput,worldPlaneAudioInput,worldTrainAudioInput} from './audio/native/worldVehicleAudio';
import {AE} from './audio/native/NativeVehicleAudio';
import {NativeHornInput,NATIVE_SIREN_MODELS} from './audio/native/nativeHornInput';
import {carCollider,worldColliderSurface} from './audio/native/worldCollisionAudio';
import {SURFACE} from './audio/native/NativeCollisionAudio';
import {nativeCollisionSurface} from './simulation/nativeWheelSurface';
import {explosionDirection,explosionFalloff,explosionOnObject,explosionUnfreezes} from './combat/nativeExplosion';
import {PED_PIECE,PEDMOVE,WEAPON,browserLocalDirection,computeDamageEventAnim,computeDeathAnim} from './combat/nativeDamageAnim';
import {WindowsCrtRandom} from './core/WindowsCrtRandom';
import {COL_DAMAGE_EFFECT,OBJECT_FX,bulletHitsObject,sniperHitsObject,pedHitsObject,newObjectState,objectDamage,objectDamagePlaysFx,type NativeObjectState} from './simulation/nativeObjectDamage';
import {GlassPanes,PANE_TYPE,isGlassDefinition,newGlassState,wasGlassHitByBullet,windowFrame,windowRespondsToCollision,windowRespondsToExplosion,windowRespondsToSoftCollision,type GlassState} from './simulation/nativeGlass';
import {GlassPanesView} from './render/GlassPanesView';
import {NativeBreakManager,rwMatrix} from './simulation/nativeBreakObject';
import {BreakPieces} from './render/BreakPieces';
import {nativePlacementMatrix} from './assets/placement';
import {nativeTexture} from './assets/nativeTexture';
import {loadSceneEnvironment} from './ui/loadSceneEnvironment';
import {sceneVegetationReader} from './world/WalkingVegetation';
import {bindLocalWater} from './ui/localWater';
import { NativeAmbienceTracks } from './audio/NativeAmbienceTracks';
import { painVoice } from './audio/native/painSpeech';
import { AudioSystem } from './audio/AudioSystem';
import { FixedClock, NATIVE_MAX_FRAME_SECONDS } from './core/FixedClock';
import { Input } from './input/Input';
import { GamepadInput } from './input/GamepadInput';
import { registerShell } from './core/serviceWorker';
import { storagePanel } from './ui/storagePanel';
import { TouchControls, enterWidgetArt, goFullscreen, offerInstall, showHelpIcons, suggestHomeScreen, touchSettingsPanel, wantsTouchControls } from './input/TouchControls';
import { DENSITY_SCALE, SIDE_MISSION_VEHICLES, readTouchSettings, resolutionRatio, saveTouchSettings } from './input/touchSettings';
import { ScreenAwake, SCREEN_IDLE_MS, screenIdle } from './input/screenAwake';
import { keepStorage, openedInstalled } from './core/persistentStorage';
import { installRapierTombstones } from './simulation/rapierTombstones';
import { installRapierUnfilteredQueries } from './simulation/rapierUnfilteredQueries';
import { LocalTimecycle, visionLighting } from './world/LocalTimecycle';
import { bindLocalLighting } from './ui/localLighting';
import {bindLocalObjectData} from './ui/localObjectData';
import {bindLocalSunTexture} from './ui/localSunTexture';
import { NativeMap } from './ui/NativeMap';
import { Hud } from './ui/Hud';
import { NativeGameLogic, STAT_DAYS_PASSED_IN_GAME, GAMELOGIC_STATE_WASTED, GAMELOGIC_STATE_BUSTED, type GameLogicWorld, type SkipWorld } from './simulation/nativeGameLogic';
import { LEVEL_COUNTRYSIDE, NativeRestart } from './simulation/nativeRestart';
import { ScmCameraFade } from './engine/ScmCameraFade';
import { NativeBirds } from './world/nativeBirds';
import { NativeBirdsMesh } from './render/NativeBirds';
import { MARKER3D, Native3dMarkers, type Marker3dContext } from './world/native3dMarkers';
import { Native3dMarkersMesh } from './render/Native3dMarkers';
import { NativeBrightLights } from './world/nativeBrightLights';
import { NativeCoronaReflections } from './render/NativeCoronaReflections';
import { NativeCoronaFlaresMesh } from './render/NativeCoronaFlares';
import { JETBALL_OFFSET, JETPACK_BONE, NativeJetPackView } from './render/NativeJetPackView';
import { projectCorona } from './render/coronaProjection';
import { GAME_CAMERA_FOV } from './render/cameraProjection';
import { FLARE, coronaFlares, type FlareSprite } from './world/nativeCoronaFlares';
import { NativeTagManager } from './world/nativeTagManager';
import { NativeSetPieces, type SetPieceRequest } from './simulation/nativeSetPieces';
import { NativePlaneTrails } from './world/nativePlaneTrails';
import { NativePlaneTrailsMesh } from './render/NativePlaneTrails';
import { NativeBulletTraces } from './weapons/nativeBulletTraces';
import { NativeImmediateTriangles } from './render/NativeImmediateTriangles';
import { NativeMotionBlurStreaks } from './weapons/nativeMotionBlurStreaks';
import { NativeBrightLightsMesh } from './render/NativeBrightLights';
import { sunReflection } from './world/nativeSunReflection';
import { NativeSunReflection } from './render/NativeSunReflection';
import { sampleSun } from './world/sun';
import { NativeCoronas, coronaReflections as nativeCoronaReflections } from './world/nativeCoronas';
import { processLightsForEntity } from './world/nativeEntityLights';
import { TRAFFIC_LIGHT_MODELS, displayActualLight } from './world/nativeTrafficLightCoronas';
import { laRiotsActiveHere, nativeTrafficLights, setLaRiotsHere } from './world/nativeTrafficLights';
import { NativeWorldCoronas } from './render/NativeWorldCoronas';
import { NativeLightPools } from './render/NativeLightPools';
import {drawsRealTimeShadow} from './render/NativeCharacterShadow';
import {extraPlayerShadows,pedShadowPool} from './render/nativePedShadows';
import {fxQuality,playerRealTimeShadow,setFxQuality,setRealTimeShadows} from './simulation/fx/fxQuality';
import {DRAW_DISTANCE_DEFAULT,setDrawDistance,setViewDistance} from './render/lodDistance';
import {CAR_REFLECTIONS} from './assets/nativeCarEnvMap';
import {stickSteering} from './input/stickSteering';
import {touchHaptic} from './input/haptics';
import {roadShake,thunderShake} from './engine/nativePadShakes';
import {AutoQuality,QUALITY_PRESETS,devicePreset,lowerPreset,type QualityContext} from './core/autoQuality';
import {DynamicResolution,scaledRatio} from './core/dynamicResolution';
/** The player's blob among the peds' (their ids are their own, from 0). */
const PLAYER_SHADOW_ID=-1;
import {fireGlow,missileGlow} from './combat/nativeFireGlow';
import {NativePermanentShadows,explosionScorch} from './render/nativePermanentShadows';
import {NativeCullZones,fewerPedsLimits} from './world/nativeCullZones';
import {heldPadActions,padStateFromActions} from './input/nativePadState';
import {ScriptButtonReads,touchActionsForReads} from './input/scriptButtons';
import {NativeHudBigMessages} from './ui/nativeHudBigMessages';
import {ScriptCarRecordingStore} from './simulation/scriptCarRecordings';
import {recordingVehicle} from './simulation/recordingBody';
import {startPlaybackRecordedCar} from './engine/carRecordingPlayback';
import {WorldTrain} from './simulation/WorldTrain';
import {WorldBoat} from './simulation/WorldBoat';
import {layoutMenu,menuItemAt} from './ui/nativeHudMenus';
import {newScriptDriveBy,stepScriptDriveBy,type ScriptDriveByWorld} from './simulation/scriptDriveBy';
import {applyStoredSwitches,markRoadNodeAsDontWander,switchRoadsOffInArea,unmarkAllRoadNodesAsDontWander} from './simulation/nativePathSwitches';
import {pathAreaLoaded,pathAreaMaps} from './assets/worldPaths';
import {findCaboose,findCarriage,setTrainCruiseSpeed,setTrainSpeed} from './simulation/nativeTrain';
import {VEHICLE_AIR_RESISTANCE_MULT,cullAirResistance} from './simulation/nativeAirResistance';
import {PED_ORIGIN_HEIGHT,SWIM,swimJumpoutPose} from './simulation/nativeSwim';
import { coronaLookMask } from './render/cameraLook';
import {MOUSE_ACCEL_MAX,MOUSE_ACCEL_MIN,MOUSE_ACCEL_STEP,mouseYawScale,parseMouseSettings,readMouseSettings,saveMouseSettings} from './input/mouseSettings';
import { NativeDuckMove, playerDuckMove } from './locomotion/nativeDuck';
import { ENEX, EntryExitManager, entryExitPosition, findValidTeleportPoint, type EntryExitTransition } from './world/nativeEntryExits';
import { worldLevelAt } from './assets/worldZones';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const canvas = document.createElement('canvas'); canvas.className = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'San Andreas game world'); app.append(canvas);
const hud = new Hud(app); hud.setMenu(true);
// Android's browser offers to install the game; on a touch screen the menu takes the offer (TouchControls.offerInstall).
if(wantsTouchControls())offerInstall(hud.button('install'));
// What the game keeps on the device, and a way to clear it, under the Controls page's settings (ui/storagePanel.ts).
{const storage=storagePanel(navigator.storage,typeof caches==='undefined'?undefined:caches);hud.element.querySelector('.controls-panel')!.append(storage.element);hud.button('controls').addEventListener('click',()=>void storage.refresh());}
// The installed game opens from the phone's storage, and offline (core/serviceWorker.ts).
registerShell(navigator, window, import.meta.env.PROD, import.meta.env.BASE_URL);
let cleanup = () => {};

/** vehicles.ide's bmx class: the BMX, Chopper and Mountain Bike, every CBmx. */
const BMX_MODELS:ReadonlySet<number>=new Set([481,509,510]);
async function boot() {
  const parameters = new URLSearchParams(location.search);
  const sceneToken = parameters.get('sceneTest');
  // The included static world is playable without selecting local files.
  const walkDemo = !sceneToken;
  const included=includedScene(parameters.get('area'));
  // The start package (about 11 MB) is what the play button waits on: request it, and the archive identity it is
  // installed under, before the physics WASM and the rest of boot, rather than after them. Failures surface where
  // the package is installed, below.
  /** `useEarly`: the first attempt reads the response index.html started (a retry from the menu fetches afresh). */
  // The start package's download as it goes, in the menu: on a phone's connection it is most of the wait.
  const startDownload={received:0,total:undefined as number|undefined,done:false,shownAt:0};
  const showStartDownload=(force=false)=>{
   const now=performance.now();if(startDownload.done||!force&&now-startDownload.shownAt<100)return;startDownload.shownAt=now;
   const mb=(n:number)=>(n/1048576).toFixed(1),{received,total}=startDownload;
   hud.menuMessage(`Downloading ${included.name}…${received?` ${total?`${mb(received)} of ${mb(total)}`:mb(received)} MB.`:''} The first load includes the terrain and character assets.`);
  };
  const readStartPack=(useEarly:boolean)=>import('./assets/scenePack').then(({readScenePack})=>{
      const url=new URL(`${import.meta.env.BASE_URL}play/${included.file}`,location.href).href,early=(window as {__startScenePack?:{url:string;response:Promise<Response>}}).__startScenePack;
      // A download that fails (a dropped connection, a busy server) is tried twice more, after 1 and 3 s, before the
      // menu reports it: the first attempt reads the response index.html started, the others fetch afresh.
      const progress=(received:number,total:number|undefined)=>{startDownload.received=received;startDownload.total=total;showStartDownload();};
      const attempt=(tries:number):ReturnType<typeof readScenePack>=>readScenePack(url,useEarly&&tries===0&&early?.url===url?early.response:undefined,progress)
        .catch(async error=>{if(tries>=2)throw error;await new Promise(resolve=>setTimeout(resolve,1000*3**tries));return attempt(tries+1);});
      startDownload.done=false;
      return attempt(0).finally(()=>{startDownload.done=true;});
    });
  const startScene=walkDemo?{
    pack:readStartPack(true),
    // The start package was published from the same archive the worker streams: installing it under the archive's
    // identity lets the first streamed window borrow its colliders, textures and model sources like every later one.
    identity:fetch(`${import.meta.env.BASE_URL}play/world/manifest.json`).then(r=>r.ok?r.json():undefined).then(m=>typeof m?.archive?.sha256==='string'?`static-world:${m.archive.sha256}`:undefined).catch(()=>undefined),
  }:undefined;
  startScene?.pack.catch(()=>{});
  /** Settles once the start package has arrived (or failed): the boot's own archive readers wait for it, so they no
   * longer share the connection with the download the play button waits on. */
  const afterStartPackage:Promise<void>=startScene?startScene.pack.then(()=>{},()=>{}):Promise.resolve();
  /** Settles once the first scene is installed (or has failed) and the menu's button is up: what play needs only after
   * the button (the radar's map, the streamed scripts) waits for it, rather than sharing a phone's connection with what
   * the button waits on (the start package, then the footstep banks). */
  let menuSettled=()=>{};const afterMenuReady=new Promise<void>(resolve=>{menuSettled=resolve;});
  // The world's chunks are kept in Cache Storage across sessions; ask that the browser not evict them under pressure.
  void navigator.storage?.persist?.().catch(()=>false);
  // Show the menu immediately, while the renderer and WASM load independently.
  const [{ Simulation }, { GameRenderer }, { default: RAPIER }, {sampleNativeGroundLighting}] = await Promise.all([
    import('./simulation/Simulation'), import('./render/Renderer'), import('@dimforge/rapier3d-compat'), import('./simulation/nativeContactLighting'),
  ]);
  await RAPIER.init();
  // A removed body or collider answers as a tombstone instead of trapping Rapier for the rest of the session.
  installRapierTombstones(RAPIER);
  installRapierUnfilteredQueries(RAPIER);
  const navigation=walkDemo?new NativeMap(hud.element,afterMenuReady):undefined;
  const importedMode = true;
  const sim = new Simulation();
  const flightInstruments=document.createElement('div');flightInstruments.className='flight-instruments';flightInstruments.hidden=true;hud.element.append(flightInstruments);
  let worldCar:ScriptCar|undefined;
  /** The player riding a car as a passenger (WARP_CHAR_INTO_CAR_AS_PASSENGER): the car and its seat (1 front right,
   * 2 rear left, 3 rear right). The car goes on under its own driver, AI or recording. */
  let playerPassenger:{car:ScriptCar;seat:1|2|3}|undefined;
  /** The exit button was pressed in a passenger seat: he gets out once the car is slow enough. */
  let passengerExitPending=false;
  /** CPed::m_pAttachedTo for the player (ATTACH_CHAR_TO_CAR): the vehicle, the offset in its axes (native), the side
   * he faces (m_fTurretAngleA: 0 ahead, 1 left, 2 behind, 3 right), the turn allowed either side of it (radians), and
   * the weapon and ammo he had before (m_nSavedWeapon, m_nTurretAmmo). */
  let playerAttached:{car?:unknown;object?:number;offset:{x:number;y:number;z:number};side:number;limit:number;facing?:number;savedWeapon?:number;savedAmmo?:number}|undefined;
  /** Where the thing the player hangs from is and how it is turned, renderer axes: a vehicle's body, or a script
   * object's drawn group (its record while the model loads). */
  const attachedFrame=(a:NonNullable<typeof playerAttached>):{t:{x:number;y:number;z:number};q:Quaternion}|undefined=>{
    if(a.object!==undefined){
     const objects=mission?.runtime.game.objects;if(!objects?.exists(a.object))return undefined;
     const group=scriptObjectViews?.groupFor(a.object);
     if(group){group.updateWorldMatrix(true,false);const t=group.getWorldPosition(new Vector3()),q=group.getWorldQuaternion(new Quaternion());return {t,q};}
     const o=objects.at(a.object);return {t:{x:o.position.x,y:o.position.z,z:-o.position.y},q:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),o.heading)};
    }
    const body=attachedBody(a.car);if(!body||!body.isValid())return undefined;
    const r=body.rotation();return {t:body.translation(),q:new Quaternion(r.x,r.y,r.z,r.w)};
  };
  const attachedBody=(car:unknown)=>{const c=car as {car?:{body?:import('@dimforge/rapier3d-compat').RigidBody};body?:import('@dimforge/rapier3d-compat').RigidBody;disposed?:boolean};return c.disposed?undefined:c.car?.body??c.body;};
  /** PositionAttachedPed for the player: his matrix is the vehicle's with the offset carried in its axes, turned to
   * where he aims (the camera's heading in sniper mode) within the limit about the side he faces; he takes the
   * vehicle's speed and stands. */
  const pinAttachedPlayer=()=>{
    const a=playerAttached;if(!a)return;
    const frame=attachedFrame(a);if(!frame){detachPlayer();return;}
    const {t,q}=frame;
    const off=new Vector3(a.offset.x,a.offset.z,-a.offset.y).applyQuaternion(q),forward=new Vector3(0,0,-1).applyQuaternion(q);
    const centre={x:t.x+off.x,y:t.y+off.y,z:t.z+off.z};
    const base=Math.atan2(forward.x,forward.z)-(a.facing??a.side*Math.PI/2);
    let heading=render.yaw+Math.PI;
    if(a.limit<Math.PI){let d=Math.atan2(Math.sin(heading-base),Math.cos(heading-base));d=Math.max(-a.limit,Math.min(a.limit,d));heading=base+d;}
    const feet={x:centre.x,y:centre.y-1,z:centre.z};
    sim.player.position={...feet};sim.player.previous={...feet};sim.player.heading=heading;sim.player.speed=0;sim.player.verticalSpeed=0;sim.player.grounded=true;sim.player.jumpMomentum={x:0,z:0};
    const at={x:feet.x,y:feet.y+sim.playerCenterHeight,z:feet.z};sim.playerBody.setTranslation(at,true);sim.playerBody.setNextKinematicTranslation(at);sim.playerCollider.setTranslation(at);
  };
  /** CPed::DettachPedFromEntity for the player: he stands where he was; the weapon given for the ride is emptied and the
   * one he had before comes back with its ammo; his collision returns. */
  const detachPlayer=()=>{
    const a=playerAttached;if(!a)return;playerAttached=undefined;
    sim.playerCollider.setEnabled(true);
    if(a.savedWeapon!==undefined&&sim.player.health>0){
     const inv=weapons.inventory;inv.setTotalAmmo(inv.selected,0);
     inv.select(a.savedWeapon);inv.setTotalAmmo(a.savedWeapon,a.savedAmmo??0);void weaponView.equip(inv.selected);
    }
  };
  const boneScratch=new Matrix4();
  /** The passenger steps out on his own side: his seat's point carried out past the body, set down on the ground. */
  /** CWorld::ClearExcitingStuffFromArea (0x56A0D0) in browser space: deletable peds (police crews too) and vehicles
   * (police helicopters with them) within `radius`, fires, and every projectile. */
  const clearExcitingStuff=(at:{x:number;y:number;z:number},radius:number)=>{
   pedestrians?.clearPedsInArea({x:at.x,z:at.z},radius,true);
   fleet?.clearCarsInArea({x:at.x,z:at.z},radius);
   // The fleet's pass already took the police helicopters (they are planes nobody rides): the police let go of them.
   police?.dropLostHelis();
   weapons.fires.extinguishPoint({x:at.x,y:-at.z,z:at.y},radius);
   // CWorld::ExtinguishAllCarFiresInArea: CVehicle::ExtinguishCarFire lifts every car but a wreck within the sphere to 300 health.
   for(const car of fleet?.cars??[])if(!car.wrecked){const p=car.car.body.translation();if(Math.hypot(p.x-at.x,p.y-at.y,p.z-at.z)<=radius&&car.health<=CAR_EXTINGUISHED_HEALTH)car.health=CAR_EXTINGUISHED_HEALTH;}
   weapons.removeAllProjectiles();
   // CPickups::RemoveUnnecessaryPickups: dropped weapons and cash in the sphere.
   drops.removeInSphere(at,radius);moneyDrops.removeInSphere(at,radius);pickups.removeUnnecessary(at,radius);
  };
  /** Sets the player out of his passenger seat; with `needRoom`, only where IsRoomForPedToLeaveCar finds a standing
   * capsule's room at his side of the car, else the other side, and false (still seated) when neither has it. */
  const leavePassengerSeat=(inPlace=false,needRoom=false,jump=false)=>{
   const ride=playerPassenger;if(!ride)return true;
   // A car deleted under him (CVehicle's destructor flags its passengers, and CPed::FlagToDestroyWhenNextProcessed
   // clears the player's vehicle and leaves him where he sat): he drops from where the car was.
   if(inPlace||ride.car.disposed){
    const at=sim.player.position,hit=sim.world.castRay(new RAPIER.Ray({x:at.x,y:at.y+2,z:at.z},{x:0,y:-1,z:0}),8,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    playerPassenger=undefined;ride.car.setPlayerOutAsPassenger({x:at.x,y:hit?at.y+2-hit.timeOfImpact+.03:at.y,z:at.z});return true;
   }
   const local=carEntry.passengerSeat(ride.car,ride.seat),own=ride.seat===2?-1:1;
   const bounds=ride.car.assets.collision.bounds,half=Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0]))+.6;
   const spot=(side:number)=>{
    const w=ride.car.worldPoint({x:side*half,y:local?.y??0,z:local?.z??0}),top=w.y+2;
    const hit=sim.world.castRay(new RAPIER.Ray({x:w.x,y:top,z:w.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    const at={x:w.x,y:hit?top-hit.timeOfImpact+.03:w.y-.5,z:w.z};
    // Ground found at the seat's height or above is the top of whatever stands there (a wall, another car).
    const room=at.y<w.y-.2&&!sim.world.intersectionWithShape({x:at.x,y:at.y+.95,z:at.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.55,.3),RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,sim.playerCollider,ride.car.car.body);
    return {at,room};
   };
   const first={...spot(own),side:own},out=!needRoom||first.room?first:(o=>o.room?o:undefined)({...spot(-own),side:-own});
   if(!out)return false;
   const v=ride.car.car.body.linvel();
   playerPassenger=undefined;ride.car.setPlayerOutAsPassenger(out.at,ride.car.heading());
   if(jump){
    // CTaskSimpleCarJumpOut from a passenger seat: out of the moving car with its speed, the car ignored until he is
    // clear of it, rolling on CAR_rollout_LHS or _RHS for the door's side, then up from the front.
    sim.collisionPush={x:v.x,z:v.z};sim.ignoreVehicleOnExit(ride.car.car.body);
    const view=render.nativeCharacter,clip=out.side>0?'car_rollout_rhs':'car_rollout_lhs';
    if(view?.hasReaction(clip)){const fall=view.reactionDuration(clip)??1,getUp=playerFall(view,clip);sim.knockdown=fall+getUp;sim.knockdownLie=0;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(clip,fall);}
   }
   return true;
  };
  let scriptObjectViews:ScriptObjectViews|undefined;
  let scriptFixedCamera:typeof render.fixedCamera,stuntCamera:typeof render.fixedCamera;
  let scriptGeneratorCount=0;
  let scriptStuntJumpCount=0;
  let scriptSetPieceCount=0;
  let scriptFiresBurning=0;
  let lastPlantFrame=-1,lastFogFrame=0,lastJetPackFrame=-1;
  /** CTaskSimpleSwim::ProcessEffects, once a game frame. The wake and stroke splashes come while sprinting (a hand or
   * foot within 0.05 of the ped's origin height splashes), one dive splash as a dive starts; the particles sit 0.4
   * ahead of the ped at the water height. */
  let swimDiveSplashed=false;const swimBone=new Vector3();
  const swimEffects=()=>{
   const p=sim.player;
   if(!p.swimming||p.health<=0||p.swimState!==SWIM.diveUnderwater)swimDiveSplashed=false;
   if(!p.swimming||p.health<=0)return;
   const fx=Math.sin(p.heading),fy=-Math.cos(p.heading),originY=p.position.y+PED_ORIGIN_HEIGHT;
   const water=render.lighting.water.levels?.level(p.position.x,-p.position.z)??originY;
   const at:[number,number,number]=[p.position.x+fx*.4,-p.position.z+fy*.4,water];
   if(p.swimState===SWIM.sprint||p.swimState===SWIM.sprinting){
    let degrees=Math.atan2(fx,-fy)*180/Math.PI;while(degrees>=180)degrees-=360;while(degrees<-180)degrees+=360;
    worldFx.effects?.swimWake(at,degrees+180);sound.nativeEngine?.swimWake();
    if(p.swimState===SWIM.sprinting)for(const bone of [24,34,53,43]){
     const b=render.nativeCharacter?.bonePosition(bone,swimBone);
     if(b&&Math.abs(b.y-originY)<.05){worldFx.effects?.swimStroke([b.x,-b.z,b.y]);sound.nativeEngine?.swimSplash(false);}
    }
   }else if(p.swimState===SWIM.diveUnderwater&&!swimDiveSplashed){swimDiveSplashed=true;worldFx.effects?.waterSplash(at,'big');sound.nativeEngine?.swimSplash(true);}
  };
  /** gbLARiots, which SET_LA_RIOTS sets: with the riot cheat, the lights flash and cars go on green (LaRiotsActiveHere). */
  let laRiots=false;
  setLaRiotsHere(()=>{const p=sim.player.position;return laRiotsActiveHere({x:p.x,y:-p.z,z:p.y},CHEATS.isActive('riot'),laRiots);});
  /** The pause or menu was open since the script last ran: CPad::JustOutOfFrontEnd. */
  let padsAfterPause=false;
  let allPedSpeechDisabled=false;void allPedSpeechDisabled;
  /** The script's pickups in the browser's world, by the handle the script holds them with. */
  const scriptPickupIds=new Map<number,string>();
  let scriptPickupModels:{byId:Map<number,import('./assets/ide').IdeAssociation>;byName:Map<string,import('./assets/ide').IdeAssociation>}|undefined;
  /** The models IDE flag 0x800 marks a garage door (CBaseModelInfo::IsGarageDoor), lower case. */
  let garageDoorModels:ReadonlySet<string>|undefined;
  let traffic:WorldTraffic|undefined;
  let police:WorldPolice|undefined;
  /** CCarCtrl's emergency services: ambulances and their medics answering the dead. */
  let emergency:import('./simulation/WorldEmergency').WorldEmergency|undefined;
  let driveby:import('./simulation/GangDriveBy').GangDriveBy|undefined;
  /** What a script's drive-by rider fires at and through: the player, the cars, the peds, and where its target is. */
  const scriptDriveByWorld:ScriptDriveByWorld={sim,cars:()=>fleet?.cars??[],random:Math.random,
   targetPosition:target=>{
    if(target.kind==='point')return {x:target.x,y:target.y,z:target.z};
    if(target.kind==='live')return target.position();
    const at=target.kind==='ped'?mission?.runtime.world?.pedPosition?.(target.handle):mission&&mission.vehicles.exists(target.handle)?mission.vehicles.positionOf(target.handle):undefined;
    return at&&{x:at.x,y:at.z-(target.kind==='ped'?PED_ORIGIN_HEIGHT:0),z:-at.y};
   },
   hitPed:(collider,damage,weapon,direction,end)=>!!pedestrians?.bulletHit(collider,damage,weapon,direction,end),
   onShot:(from,to,weapon,hit)=>{weapons.npcShot(from,to,weapon,hit);sound.combat('fire',weapon,from,'npc');}};
  /** CTaskAllocatorKillThreatsDriveby (reversed) for CJ's group while he drives: every member riding his car (not
   * driving it) gets CTaskSimpleGangDriveBy on the threat, abort range 60, frequency 90, all directions. Which ped is
   * the threat is CPedGroupIntelligence's, unreversed (AUTHORED): the nearest one within the range attacking CJ or a
   * member (a kill task or a retaliation on them, a rider's drive-by at them or at CJ's car), looked for twice a
   * second. A drive-by the script gave a rider is left alone; the group's ends when no threat is left. */
  let groupThreatScan=0;
  const groupThreatDriveBys=(dt:number)=>{
   const leaderCar=worldCar?.occupied?worldCar:fleet?.occupied;
   const clearAll=()=>{for(const rider of [...scriptRiders,...carEntry.passengers])if(rider.groupDriveBy){rider.driveBy=undefined;rider.groupDriveBy=undefined;}};
   const m=mission;if(!leaderCar||!m||sim.player.health<=0){clearAll();return;}
   if((groupThreatScan-=dt)>0)return;groupThreatScan=.5;
   const group=m.groups?.get?.(0),members=group?group.all().filter((h:number)=>h!==1&&group.isFollower(h)):[];
   const entityOf=(h:number)=>{try{return m.peds.exists(h)?m.peds.entity(h):undefined;}catch{return undefined;}};
   const riders=members.map((h:number)=>asRider(entityOf(h))).filter((r):r is ScriptRider=>!!r&&r.car===leaderCar&&r.seat!=='driver'&&!r.gone&&r.health>0);
   // The crew recruited off the street ride along too; one carrying a gun takes part (the drive-by needs one).
   const crew=carEntry.seated&&carEntry.car===leaderCar?carEntry.passengers.filter(p=>{const w=(p.keep as {weapon?:{info?:{type?:number}}}|undefined)?.weapon?.info?.type;return w!==undefined&&w>=22&&w<=34;}):[];
   if(!riders.length&&!crew.length){clearAll();return;}
   const memberEntities=new Set(members.map(entityOf).filter(Boolean));
   const isUs=(handle:number)=>handle===1||members.includes(handle);
   const c=leaderCar.car.body.translation(),threats:{key:string;position:()=>{x:number;y:number;z:number}|undefined}[]=[];
   for(const h of m.peds.handles){
    if(isUs(h))continue;const e=entityOf(h);if(!e)continue;
    const rider=asRider(e);
    if(rider){
     const t=rider.driveBy?.target;if(rider.gone||rider.health<=0||rider.car.wrecked||!t)continue;
     const atUs=t.kind==='ped'&&isUs(t.handle)||t.kind==='vehicle'&&(t.handle===1||m.vehicles.exists(t.handle)&&m.vehicles.entity(t.handle)===leaderCar);
     if(atUs)threats.push({key:`ped:${h}`,position:()=>rider.gone||rider.car.wrecked||rider.health<=0?undefined:rider.car.car.body.translation()});
     continue;
    }
    const p=onFoot(e);if(!p||p.health<=0||p.follow)continue;
    // A kill task or a retaliation on CJ or a member, a gun fired at them (TASK_SHOOT_AT_CHAR, SWEET4's Ballas running
    // in shooting), or TASK_DESTROY_CAR on the car they ride.
    const o=p.order;
    const killing=o?.kind==='killPed'&&(!o.foe||memberEntities.has(o.foe))||p.retaliate>0&&(!p.foe||memberEntities.has(p.foe))||
     (o?.kind==='gunAt'&&o.fire||o?.kind==='goToPointShooting')&&(o.player||!!o.target&&memberEntities.has(o.target))||
     o?.kind==='destroyCar'&&(o.vehicle===1||m.vehicles.exists(o.vehicle)&&m.vehicles.entity(o.vehicle)===leaderCar);
    if(killing)threats.push({key:`ped:${h}`,position:()=>p.health>0&&pedestrians?.hasPed(p)?p.actor.player.position:undefined});
   }
   for(const p of pedestrians?.attackersOf(memberEntities)??[]){
    threats.push({key:`street:${p.id}`,position:()=>p.health>0&&pedestrians?.hasPed(p)?p.actor.player.position:undefined});
   }
   let best:typeof threats[number]|undefined,bestD=60;
   for(const t of threats){const at=t.position();if(!at)continue;const d=Math.hypot(at.x-c.x,at.y-c.y,at.z-c.z);if(d<bestD){bestD=d;best=t;}}
   const q=leaderCar.car.body.rotation(),heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));
   for(const rider of [...riders,...crew]){
    if(rider.driveBy&&!rider.groupDriveBy)continue;
    if(!best){if(rider.groupDriveBy){rider.driveBy=undefined;rider.groupDriveBy=undefined;}continue;}
    if(rider.groupDriveBy===best.key)continue;
    const at=best.position()!,rightSide=(at.x-c.x)*Math.cos(heading)+(at.z-c.z)*-Math.sin(heading)>0;
    rider.driveBy=newScriptDriveBy({kind:'live',position:best.position},60,90,rightSide);rider.groupDriveBy=best.key;
   }
  };
  let pedestrians:WorldPedestrians|undefined;
  let fleet:import('./simulation/WorldFleet').WorldFleet|undefined;
  /** CGarages::StoreCarInNearestImpoundingGarage, once the script's garages are loaded. */
  let impoundCar:((vehicle:import('./simulation/WorldCar').WorldCar|import('./simulation/WorldBike').WorldBike)=>void)|undefined;
  let worldZones:import('./assets/worldZones').WorldZones|undefined;
  const placeName=new NativePlaceName();
 // CTheScripts running the original MAIN.SCM, started once the world source hands over the script.
 let mission:import('./simulation/ScmMission').ScmMission|undefined;
 // The script's tasks on CJ's own ped (TASK_GO_STRAIGHT_TO_COORD, TASK_PLAY_ANIM... on scplayer).
 /** The cutscene skip button this frame, and the keys it reads as they were last frame. */
 let cutsceneSkipNow=false,skipKeysLast={enter:false,space:false};
 /** The player's car while a script's driving task has it. */
 let scriptDrivenCar:ScriptCar|import("./simulation/WorldBike").WorldBike|undefined;
 const playerTasks=new PlayerScriptTasks({
  animation:(file,name)=>pedestrians?.scriptAnimation(file,name)??Promise.resolve(undefined),
  duck:crouch=>{sim.setCrouched(crouch);},
  enterCar:vehicle=>{
   const car=mission?.vehicles.entity(vehicle) as Partial<ScriptCar>|undefined;
   if(!car||typeof car.setPedInAsDriver!=='function'||car.disposed||carEntry.active)return false;
   return carEntry.enter(car as ScriptCar);
  },
  warpIntoCar:vehicle=>{const car=mission?.vehicles.entity(vehicle) as Partial<ScriptCar>|undefined;if(car&&typeof car.setPedInAsDriver==='function'&&!car.disposed&&!car.occupied){carEntry.cancel();carEntry.warpIn(car as ScriptCar);}},
  leaveCar:(vehicle,immediately)=>{
   // From a passenger seat he steps out beside it (the passenger's get-out clip is not ported).
   const ride=playerPassenger;
   if(ride&&!carEntry.seated){
    if(vehicle!==undefined&&mission?.vehicles.entity(vehicle)!==ride.car)return 'none';
    if(!immediately&&!ride.car.disposed&&!ride.car.canStepOut())return 'wait';
    return leavePassengerSeat(false,!immediately)?'none':'wait';
   }
   const car=carEntry.car;
   if(!carEntry.seated||!car)return 'none';
   if(vehicle!==undefined&&mission?.vehicles.entity(vehicle)!==car)return 'none';
   // CTaskSimpleCarWaitToSlowDown: the script's sensible leave waits for the car to be still enough to step out of.
   if(!immediately&&!car.canStepOut())return 'wait';
   return carEntry.exit()?'started':'wait';
  },
  carState:()=>carEntry.seated?'seated':carEntry.active?'entering':'none',
  // CTaskComplexEvasiveDiveAndGetUp on CJ: turned along the dive, EV_DIVE held through the script's lie, then
  // GETUP_FRONT, through the same knockdown a fall gives him. The dive's forward root motion is not applied.
  dive:(yaw,lie)=>{
   const view=render.nativeCharacter;if(!view?.hasReaction('ev_dive')||carEntry.seated||playerPassenger)return false;
   sim.player.heading=yaw;const fall=view.reactionDuration('ev_dive')??2.33,getUp=playerFall(view,'ev_dive');
   sim.knockdown=fall+lie+getUp;sim.knockdownLie=lie;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction('ev_dive',fall+lie);return true;
  },
  diving:()=>sim.knockdown>0,
  // The player's driving tasks: the car he sits in, or the bike he rides, the one the script names, drives on its
  // autopilot.
  startCarTask:order=>{
   const car=carEntry.seated?carEntry.car:fleet?.occupiedBike;
   if(!car||mission?.vehicleByHandle(order.vehicle)!==car)return false;
   car.scriptDriven=true;scriptDrivenCar=car;
   if(order.kind==='carTempAction')scriptCars.tempAction(car,order.action,order.seconds);
   else scriptCars.gotoCoords(car,{x:order.x,y:order.z>-100?order.z:('setPedInAsDriver' in car?car.car.body:car.body).translation().y,z:-order.y},{cruise:order.cruise,style:order.style,accurate:order.accurate,straight:order.straight});
   return true;
  },
  carTaskRunning:()=>!!scriptDrivenCar&&!scriptDrivenCar.disposed&&scriptDrivenCar.occupied&&(scriptCars.driving(scriptDrivenCar)||scriptCars.inTempAction(scriptDrivenCar)),
  endCarTask:()=>{const car=scriptDrivenCar;scriptDrivenCar=undefined;if(!car)return;car.scriptDriven=false;scriptCars.forget(car);car.autopilot=undefined;},
  lookAtPoint:(x,y,z,seconds)=>{pedestrians?.playerLookAtPoint({x,y:z,z:-y},seconds);},
  die:()=>{sim.killPlayer();},
  lookAt:(target,seconds)=>{const ped=onFoot(mission?.pedByHandle(target));if(ped&&typeof ped==='object')pedestrians?.playerLookAtPed(ped,seconds);},
  clearLookAt:()=>{pedestrians?.clearPlayerLookAt();},
  placeOnGround:(x,z,originY)=>{
   const ground=pedestrians?.groundUnder(x,z,(originY??sim.player.position.y+1+50)+.5);if(ground===undefined)return;
   sim.flushPlayerTasks();sim.player.position={x,y:ground,z};sim.player.previous={x,y:ground,z};
   sim.playerBody.setTranslation({x,y:ground+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:ground+.9,z});sim.playerCollider.setTranslation({x,y:ground+.9,z});
  },
 });
 // CCarAI's coordinate missions for the cars the script's own drivers take somewhere.
 // The car path nodes are read the first time a script drives a car.
 let scriptCarPathsReady:import('./simulation/ScriptCarMissions').ScriptCarPaths|undefined,scriptCarPathsAsked=false;
 const scriptCars=new ScriptCarMissions(()=>{
  if(!scriptCarPathsAsked){scriptCarPathsAsked=true;void Promise.all([import('./assets/staticWorldArchive'),import('./assets/worldPaths')]).then(async([{openStaticWorld},{worldPaths}])=>{
   const paths=worldPaths(await openStaticWorld(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));
   const p=sim.player.position;await paths.loadAround(p.x,p.z);scriptCarPathsReady=paths;
  }).catch(()=>{scriptCarPathsAsked=false;});}
  return scriptCarPathsReady;
 });
 // The player the missions against him chase: where he is, the car he drives, and how fast he goes.
 scriptCars.ground=(x,z,from)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:from,z},{x:0,y:-1,z:0}),40,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?from-hit.timeOfImpact:undefined;};
 // The cars on the road for FindMaximumSpeedForThisCarInTraffic, in native axes.
 scriptCars.traffic=()=>[...(fleet?.cars??[])].filter(c=>!c.disposed).map(c=>{const t=c.car.body.translation(),r=c.car.body.rotation(),v=c.car.body.linvel(),b=c.nativeBody;
  const fx=-2*(r.x*r.z+r.y*r.w),fz=-(1-2*(r.x*r.x+r.y*r.y));
  return {vehicle:c,position:{x:t.x,y:-t.z,z:t.y},front:b.boundsMax.y,back:-b.boundsMin.y,halfWidth:b.boundsMax.x,forward:{x:fx,y:-fz},moveSpeed:{x:v.x/50,y:-v.z/50}};});
 scriptCars.player=()=>({position:sim.player.position,vehicle:worldCar?.occupied?worldCar:undefined,velocity:{x:sim.lastMove.velocity.x,y:0,z:sim.lastMove.velocity.z}});
 // HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE and FREEZE_CHAR_POSITION on the player.
 let playerWeaponHiddenByScript=false,playerFrozenByScript=false,playerAreaCode=0;
 /** Each CRRY_PRTIAL request, so a clip that loads after the load was put down does not lift the arms again. */
 let carryPoseGeneration=0;
 // CTaskComplexUseMobilePhone on the player and on the script's peds.
 const phones=new Map<unknown,PlayerPhone>();
 const phoneFor=(key:unknown)=>{let phone=phones.get(key);if(!phone){phone=new PlayerPhone(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,(file,name)=>pedestrians?.scriptAnimation(file,name)??Promise.resolve(undefined));phones.set(key,phone);}return phone;};
 const playerTaskBody=()=>({position:sim.player.position,heading:sim.player.heading,speed:sim.player.speed,onFoot:sim.playerCollider.isEnabled(),view:render.nativeCharacter});
 let lastGameFrame=0;
 /** TheText (text/american.gxt). */
 let theText:import('./assets/gxt').NativeText|undefined;
 void import('./assets/gxt').then(m=>m.loadNativeText(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(t=>{theText=t;}).catch(e=>console.error('AMERICAN.GXT failed to load',e));
  let wasRiding=false;
  let tankTurret:TankTurret=initialTankTurret(),tankLastFire=-Infinity,tankGunWasDown=false;
  // m_fDoomHorizontalRotation / m_fDoomVerticalRotation are each CAutomobile's own: every Rhino, fire truck and S.W.A.T.
  // van keeps its turret or nozzle where it was left.
  const turretAims=new WeakMap<object,TankTurret>(),cannonAims=new WeakMap<object,CannonAim>();
  let cannonAim:CannonAim=initialCannonAim(),cannonFrame=0,cannonClock=0,cannonFiring=false;const waterCannon=new WaterCannon();
  /** CWaterCannons' other slots: one cannon for each fire engine answering a fire. */
  const npcCannons=new Map<import('./simulation/WorldCar').WorldCar,WaterCannon>();
  let gangWars:GangWars|undefined,gangWarBlip:{position:{x:number;y:number;z:number};gang:number;visible:boolean}|undefined;
  let worldGenerators:import('./assets/worldCarGenerators').WorldCarGenerator[]=[];
  let stuntJumps:StuntJumps|undefined,savePoints:ScmSavePoint[]=[],saving=false;
  /** A window the step waits for: a save point's, a restart's from indoors, or (`script`) the scene a script's teleport or
   * SET_AREA_VISIBLE took the player into, where he stays as the script put him. */
  let savedTransfer:{x:number;y:number;z:number;heading:number;quiet?:boolean;area?:number;enexStack?:number[];script?:boolean}|undefined,savedTransferInstalling=false;
  /** Whether a loaded game has had the new game's INTRO ended for it. */
  let introSkipped=false;
  /** When the new game's opening black was put up (play pressed with no save), until INTRO or a failure takes it over. */
  let openingHoldAt:number|undefined;
  /** CEntryExitManager and the teleport CEntryExit::TransitionFinished waits on while the spawn point's area streams. */
  let entryExits:EntryExitManager|undefined,interiorTransfer:EntryExitTransition|undefined;
  /** How long CJ has been in SWIM_BACK_TO_SURFACE, for its SWIM_JUMPOUT and CLIMB_jump. */
  let swimJumpoutSeconds:number|undefined;
  let importedScene: ReturnType<typeof import('./simulation/nativeScene').installNativeScene> | undefined;
  let surfaceSprint:Map<number,boolean>|undefined,surfaceClimbable:Map<number,boolean>|undefined,surfaceSteep:Map<number,boolean>|undefined;
  let surfaceSprintBlocked=false;
  /** CPlayerPedData::m_bPlayerSprintDisabled: the script's DISABLE_PLAYER_SPRINT, or CTaskComplexUseGoggles running. */
  const playerSprintDisabled=()=>!!mission?.runtime.game.playerInfo.sprintDisabled||!!weapons.goggles;
  /** The fire button got through to an aimed gun this step (m_LastCmd FIRE for CTaskSimpleUseGun::SetMoveAnim). */
  let gunFiring=false;
  /** The weapon whose CTaskSimpleUseGun the fire button started without the target button, while that task runs. */
  let hipGun:number|undefined;
  let climbsSeen=0;
  /** CPad::ExitVehicleJustDown this frame. */
  let exitJustDown=false;
  let surfaceAudio: ReturnType<typeof readSurfaceAudio> | undefined;
  let roadSurfaces:Awaited<ReturnType<typeof import('./assets/worldRoadMaterials').loadWorldRoadMaterials>>|undefined;
  const render = new GameRenderer(canvas, sim);
  const occupants=new VehicleOccupants(render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
  const sirens=new SirenLights();
  const skids=new Skidmarks(render.scene);
  const wakes=new BoatWakes(render.scene);
  /** Swim roles from the packaged swim.ifp once loaded (idempotent). */
  const swimChecked=new WeakSet<NonNullable<typeof render.nativeCharacter>>();
  const installSwimClips=()=>{
   const character=render.nativeCharacter;if(!character||swimChecked.has(character))return;
   const get=(name:string)=>carEntry.clips.peek('swim',name);
   const tread=get('Swim_Tread'),breast=get('Swim_Breast'),crawl=get('SWIM_crawl'),under=get('Swim_Under'),glide=get('Swim_Glide'),dive=get('Swim_Dive_Under');
   if(!tread||!breast||!crawl||!under||!glide||!dive)return;
   // Workshop replacements may have their own rig and coordinate convention.
   // Packaged CJ tracks must not be bound to those skeletons each render frame.
   swimChecked.add(character);
   if(!character.supportsNativeClips([tread,breast,crawl,under,glide,dive]))return;
   const track=(clip:import('./assets/ifp').NativeAnimation)=>clip.tracks.findIndex(t=>t.boneId===0&&t.translations);
   if(track(breast)<0||track(crawl)<0||track(under)<0)return;
   character.installSwim({tread:{clip:tread},breast:{clip:breast,track:track(breast)},crawl:{clip:crawl,track:track(crawl)},under:{clip:under,track:track(under)},glide:{clip:glide},dive:{clip:dive}});
  };
  // CClothes::RebuildPlayerIfNeeded: the player is rebuilt with the fat and muscle stats when they have changed since
  // the last build, which happens on a restart, at the end of an entry-exit transfer and on the save's load. The build
  // loads the group's block (RequestMotionGroupAnims) and the player walks with GetDefaultPlayerMotionGroup's clips.
  let builtBody:{fat:number;muscle:number}|undefined,wantedMotion:'fat'|'muscular'|undefined|null=null,motionCharacter:object|undefined;
  const rebuildPlayerIfNeeded=()=>{
   const stats=mission?.runtime.game.stats;if(!stats)return;
   const fat=stats.get(21),muscle=stats.get(23);
   if(builtBody&&builtBody.fat===fat&&builtBody.muscle===muscle)return;
   builtBody={fat,muscle};wantedMotion=playerMotionGroupToLoad(fat,muscle);
   void rebuildPlayerBody();
  };
  // CClothesBuilder::CreateSkinnedClump's body: the three bodies of the player's files blended by his fat and muscle,
  // put on the character the scene built from those files (a character from the workshop is left alone). The scene
  // builds the normal body; a rebuild with other ratios replaces it in place.
  let playerBody:{files:File[];character:object;ratios:PlayerBodyRatios}|undefined;
  const rebuildPlayerBody=async()=>{
   const body=playerBody;if(!body||!builtBody||render.nativeCharacter!==body.character)return;
   const ratios=playerBodyRatios(builtBody.fat,builtBody.muscle),was=body.ratios;
   if(was.normal===ratios.normal&&was.fat===ratios.fat&&was.ripped===ratios.ripped)return;
   body.ratios=ratios;
   try{
    const {readPlayerFiles}=await import('./assets/readPlayerFiles');
    const built=await readPlayerFiles(body.files,ratios,'classic');
    // A later rebuild, a new scene or another character supersedes this one.
    if(!alive||playerBody!==body||body.ratios!==ratios||render.nativeCharacter!==body.character)return;
    if(!render.nativeCharacter.replaceBody(built.model,built.textures))body.ratios=was;
   }catch{if(body.ratios===ratios)body.ratios=was;}
  };
  const applyPlayerMotionGroup=()=>{
   const character=render.nativeCharacter;if(!character)return;
   // A new player model (clothes, a skin) is built with the group of the last build.
   if(character!==motionCharacter&&builtBody&&wantedMotion===null)wantedMotion=playerMotionGroupToLoad(builtBody.fat,builtBody.muscle);
   motionCharacter=character;if(wantedMotion===null)return;
   if(wantedMotion===undefined){character.setMotionGroup(undefined);wantedMotion=null;return;}
   const group=wantedMotion,names=PLAYER_MOTION_CLIPS[group];
   const clips=Object.fromEntries(Object.entries(names).map(([slot,name])=>[slot,carEntry.clips.peek(group,name)])) as Record<keyof typeof names,import('./assets/ifp').NativeAnimation|undefined>;
   if(Object.values(clips).some(c=>!c))return;
   wantedMotion=null;
   const all=Object.values(clips) as import('./assets/ifp').NativeAnimation[];
   if(!character.supportsNativeClips(all))return;
   const track=(clip:import('./assets/ifp').NativeAnimation)=>clip.tracks.findIndex(t=>t.boneId===0&&t.translations&&t.times.length);
   if([clips.walk!,clips.run!,clips.sprint!,clips.walkStart!].some(c=>track(c)<0))return;
   const moving=(clip:import('./assets/ifp').NativeAnimation)=>({clip,track:track(clip)});
   character.setMotionGroup(group,{walk:moving(clips.walk!),run:moving(clips.run!),sprint:moving(clips.sprint!),walkStart:moving(clips.walkStart!),idle:{clip:clips.idle!}});
  };
  const carEntry=new CarEntry(sim,new VehicleAnimationLibrary(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));
  /** The player's bike mount and dismount through the bike's animation group (shares the clip library). */
  const bikeMount=new BikeMount(sim,carEntry.clips);
  /** How near a bike CJ must stand to board it (WorldBike.enterCheck's reach). */
  const bikeReach=(bike:import('./simulation/WorldBike').WorldBike)=>Math.max(4,bike.assets.collision?.bounds.radius??0);
  /** The walk to a bike chosen from further off than that: its clock, the nearest CJ has come and how long he has not
   * come nearer. */
  let bikeApproach:{bike:import('./simulation/WorldBike').WorldBike;time:number;best:number;stall:number}|undefined;
  /** How near the walk brings CJ before he boards. */
  const BIKE_APPROACH_BOARD=1.6;
  /** Board a bike within reach: through its jump-on clip once the animation group has loaded, the instant mount
   * before that. With no standing room at either side (a wall on one, a kerb or a prop on the other) the clip cannot
   * start, and CJ still gets on at once rather than the button doing nothing. */
  const boardBike=(bike:import('./simulation/WorldBike').WorldBike)=>{
    if(bike.enterCheck())return;
    if(!bikeMount.ready(bike)){bike.interact();return;}
    if(!bikeMount.mount(bike)){bikeMount.message=undefined;bike.interact();}
  };
  // CEventDraggedOutCar::AffectsPed needs a living ped: a driver who died in his seat is dragged out a corpse.
  carEntry.onDriverOut=(car,position,heading,lying)=>{law.registerCrime(CRIME.carSteal,`car:${car.car.body.handle}`);if(car.driverDead){car.driverDead=false;pedestrians?.spawnDead(occupants.driverModel(car),position,heading,car.gang);return;}pedestrians?.spawnJacked(occupants.driverModel(car),position,heading,car.gang,{position:()=>{const t=car.car.body.translation();return {x:t.x,y:t.y,z:t.z};}},VEHICLE_ANIM_GROUP_TABLES[car.animGroup.id]?.file==='coach',lying,()=>carEntry.releaseDragged(car))||carEntry.releaseDragged(car);};
  carEntry.onJackStart=car=>pedestrians?.prefetchModel(occupants.driverModel(car));
  const law=new WantedSystem(),wantedHud=new WantedHud(hud.element);
  // CGameLogic::Update drives the wasted and busted sequences over the native
  // CRestart tables; the simulation's own timer only releases the seat.
  const nativeRestart=new NativeRestart(),gameLogic=new NativeGameLogic(nativeRestart),cameraFade=new ScmCameraFade();
  sim.externalDeathRecovery=true;
  let arrested=false,gameTimeMs=0,previousGameTimeMs=0,gameTimeExact=0;
  /** The game clock the script last ran at, and the mission it ran for (a new mission starts from the clock as it is). */
  let scriptGameTimeExact=0,scriptClockMission:unknown;
  /** The script stop last reported to the player. */
  let scriptStopReported:unknown;
  /** Seconds of free play the key hints have been up. */
  let hintPlaySeconds=0;
  /** The script messages last handed to the HUD, by label and creation time. */
  const shownScript={brief:'',big:['','','','','','',''],help:'',helpRevision:0};
  // CHud::DrawScriptText's two passes: the script's DISPLAY_TEXT lines and boxes under and over the screen fade.
  const scriptText=new ScriptTextLayer(hud.element.querySelector('.screen-fade')!,hud.element.querySelector('.screen-fade')!);
  hud.messageClock=()=>gameTimeMs;
  // CGarages::TriggerMessage for 5 s (the garages' own line; a world without a script gets the prompt line instead).
  const GARAGE_MESSAGE_FALLBACK:Record<string,string>={TAG_ONE:'Tags sprayed~n~~1~ out of ~1~',TAG_ALL:'All tags sprayed!',HO_ONE:'Horseshoes ~1~ out of ~1~',HO_ALL:'All horseshoes found!',OY_ONE:'Oysters ~1~ out of ~1~',OY_ALL:'All oysters found!',SN_ONE:'Snapshots ~1~ out of ~1~',SN_ALL:'All snapshots found!'};
  const garageMessageText=(id:string,n1:number,n2:number)=>{const raw=gxtText(id,GARAGE_MESSAGE_FALLBACK[id]??id);return gxtHudText(n1<0?(n2<0?raw:insertNumbers(raw,n2)):insertNumbers(raw,n1,n2));};
  const triggerGarageMessage=(id:string,n1:number,n2:number)=>{const g=mission?.runtime.game.garageMessage;if(g)g.trigger(id,n1,5000,n2,gameTimeMs);else hud.message(garageMessageText(id,n1,n2),5000);};
  /** The player's CTaskSimpleDuck move command. */
  const duck=new NativeDuckMove();
  /** Cars that struck CJ on foot, for the dev state. */
  /** `hurtBy` keeps the kind of the last contact that hurt CJ; a harmless one (a look back) can follow within a frame. */
  const playerCarHits={contacts:0,hurt:0,last:'none',hurtBy:'none'};
  /** The player's pad as his car reads it, and the horn button's last state. */
  const NO_CAR_PAD:WorldCarPad={carGun:false,looking:false,hornJustDown:false};let carPad=NO_CAR_PAD,hornHeldLast=false;
  /** The model of the vehicle the player is in, and of the one whose radio is on. */
  let radioDriven:object|undefined,radioModel:number|undefined;
  /** No mission unlocks a city in this build, so every restart point qualifies. */
  const CITY_UNLOCKED=2;
  const weapons=new WeaponSystem(sim,()=>pedestrians,()=>fleet);
  weapons.scriptParachute=()=>!!mission;
  sim.neverTired=()=>!!mission?.runtime.game.playerInfo.doesNotGetTired;
  sim.indoors=()=>render.lighting.area!==0;
  // CPlayerInfo::m_bFastReload, which SET_PLAYER_FAST_RELOAD sets on the script's player info.
  weapons.inventory.fastReload=()=>!!mission?.runtime.game.playerInfo.fastReload;
  // CStats::GetPercentageProgress: STAT_PROGRESS_MADE over a constant 187, whatever SET_PROGRESS_TOTAL said.
  weapons.inventory.fullCompletion=()=>{const g=mission?.runtime.game;return !!g&&g.stats.get(STAT_PROGRESS_MADE)/187*100>=100;};
  let progressStorage:Storage|undefined;try{progressStorage=localStorage;}catch{}
  // A New Game whose old save could not be cleared comes back with ?new-game: the old progress is not read, and the
  // flag leaves the address so a later reload loads what the new game has saved since.
  const freshGame=new URLSearchParams(location.search).has('new-game');
  if(freshGame){const u=new URL(location.href);u.searchParams.delete('new-game');history.replaceState(history.state,'',u.href);}
  const progression=new Progression(weapons.inventory,sim,progressStorage,freshGame);
  weapons.onHit=id=>progression.hit(id);
  // The frontend's mouse options (Controls): the sensitivity slider and vertical inversion, kept between sessions.
  const mouseSettings=readMouseSettings();
  // On a touch screen the drag's vertical look follows the touch settings' Invert look; the mouse's is hidden there.
  const touchScreen=wantsTouchControls();let touchSettings=readTouchSettings();
  // A phone that says it is weak starts at the port's preset for one (devicePreset), before its first frame; the measured
  // play (AutoQuality) may still step it down. Settings the player chose stay.
  if(touchScreen&&!touchSettings.qualityChosen&&touchSettings.effects==='high'&&!navigator.webdriver){
   const start=devicePreset(navigator as Navigator&{deviceMemory?:number});
   if(start){touchSettings={...touchSettings,...QUALITY_PRESETS[start],qualityChosen:start==='low',wheelMeasured:start==='low',flightMeasured:start==='low'};saveTouchSettings(touchSettings);}
  }
  // The touch settings' Visual effects set the FX quality (the port's MOB_VS); elsewhere the game runs at high.
  // and its Draw distance TheCamera's LOD distance multiplier (the port's MOB_DD); elsewhere the game draws at its default.
  // A touch screen draws a building's alpha in one pass, as the mobile ports' shaders do (setBuildingDualPass).
  setBuildingDualPass(!touchScreen);
  const applyVisualEffects=()=>{setFxQuality(touchScreen?touchSettings.effects:'high');setDrawDistance(touchScreen?touchSettings.drawDistance:DRAW_DISTANCE_DEFAULT);setViewDistance(touchScreen&&touchSettings.effects==='low',touchSettings.drawDistance);CAR_REFLECTIONS.value=!touchScreen||touchSettings.carReflections;setRealTimeShadows(!touchScreen||touchSettings.shadows);};applyVisualEffects();
  const lookInverted=()=>touchScreen?touchSettings.invertLook:mouseSettings.invertY;
  const applyMouseSettings=()=>{render.mouseYawScale=mouseYawScale(mouseSettings);render.mouseYSign=lookInverted()?-1:1;};applyMouseSettings();
  {const sens=hud.element.querySelector<HTMLInputElement>('#mouse-sens')!,invert=hud.element.querySelector<HTMLInputElement>('#mouse-invert')!;
   sens.min=String(MOUSE_ACCEL_MIN);sens.max=String(MOUSE_ACCEL_MAX);sens.step=String(MOUSE_ACCEL_STEP);sens.value=String(mouseSettings.accel);invert.checked=mouseSettings.invertY;
   sens.oninput=()=>{Object.assign(mouseSettings,parseMouseSettings({...mouseSettings,accel:Number(sens.value)}));applyMouseSettings();saveMouseSettings(mouseSettings);};
   invert.onchange=()=>{mouseSettings.invertY=invert.checked;applyMouseSettings();saveMouseSettings(mouseSettings);};}
  progression.onSaveFailed=reason=>hud.message(reason==='conflict'?'Progress was saved from another tab; this tab no longer saves over it. Reload to continue from it.':'Progress could not be saved: browser storage is full or blocked.',8000);
  const saveProgress=()=>{progression.save();};window.addEventListener('pagehide',saveProgress);
   const PICKUP_TEXT:Record<string,string>={HO:'Horseshoes',OY:'Oysters',SN:'Snapshots'};
   // Dead armed peds drop their gun for its leftover rounds (one-shot pickups).
   let dropAssets:{load:(weapon:number)=>Promise<{asset?:{model:any;textures:any}}>} | undefined;
   const drops=new WeaponDrops(render.scene,{
    load:async weapon=>{dropAssets??=await import('./weapons/assets').then(m=>m.openWeaponAssets(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));return dropAssets!.load(weapon);},
   },point=>{const hit=sim.world.castRay(new RAPIER.Ray({x:point.x,y:point.y+3,z:point.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?point.y+3-hit.timeOfImpact:undefined;});
   // CPed::CreateDeadPedMoney: wads of cash from dead peds (CPickups::CreateSomeMoney).
   const moneyDrops=new MoneyDrops(render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,point=>{const hit=sim.world.castRay(new RAPIER.Ray({x:point.x,y:point.y+3,z:point.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?point.y+3-hit.timeOfImpact:undefined;});
  const pickups=new WorldPickups(sim,render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,{
    weaponForModel:model=>WEAPONS.find(w=>w.model?.toLowerCase()===model.toLowerCase())?.id,
    giveWeapon:(weapon,ammo)=>{const before=weapons.inventory.selected,given=weapons.inventory.give(weapon,ammo);if(given&&weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);return given;},
    canPickUpWeapon:weapon=>{const info=weapons.inventory.info(weapon);return !sim.jetPack||!!info&&!!(info.flags&WEAPON_FLAG.aimWithArm);},
    heldInSlot:weapon=>{const slot=weapons.inventory.slotOf(weapon);if(slot===undefined)return undefined;const held=weapons.inventory.inSlot(slot)??0,a=held?weapons.inventory.ammo.get(held):undefined;return {weapon:held,ammo:a?a.clip+a.reserve:0,slot};},
    grantAmmo:(weapon,ammo)=>{const held=weapons.inventory.inSlot(weapons.inventory.slotOf(weapon));if(held)weapons.inventory.give(held,ammo);},
    targeting:()=>input.down('MouseAim'),
    // DoesPlayerWantNewWeapon(type, false): not with a jetpack on, nor attacking or aiming with the slot's own weapon.
    wantsNewWeapon:weapon=>{const slot=weapons.inventory.slotOf(weapon),held=slot===undefined?0:weapons.inventory.inSlot(slot)??0;
     if(held===weapon||held===0)return true;if(sim.jetPack)return false;
     return !(weapons.inventory.selected===held&&(weapons.aiming||input.down('MouseFire')));},
    wantedLevel:()=>law.level,setWantedLevel:level=>law.setLevel(level),armour:()=>sim.player.armour,setArmour:value=>{sim.player.armour=value;},
    maxHealth:()=>mission?.runtime.game.playerInfo.maxHealth??100,maxArmour:()=>mission?.runtime.game.playerInfo.maxArmour??100,
    incrementStat:(stat,value)=>{mission?.runtime.game.stats.increment(stat,value);},statValue:stat=>{try{return mission?.runtime.game.stats.get(stat)??0;}catch{return 0;}},
    // CPickups::GivePlayerGoodiesWithPickUpMI: the jetpack hands the player its task, unless he already wears one.
    // CPickup::Update leaves the jetpack where it is while ArePlayerControlsDisabled.
    onJetPack:()=>{if(sim.jetPack||playerControlsDisabled())return false;sim.startJetPack();sound.frontend(AE_FRONTEND.pickupInfo);return true;},
    // PSAVE1: the save menu runs, the screen fades and the player is put back beside the disc facing its heading.
    onSave:pickup=>{
      if(saving||paused)return;
      // CPickup::Update takes the save disk only when CPlayerPed::CanPlayerStartMission: the game playing, the player
      // alive and in control, no physical response (a knockdown, a fall), no primary task (climbing, swimming, the
      // jetpack, a car entry) and no attack (aiming or a weapon mid-use).
      const canStartMission=()=>!(gameLogic.state!==0||sim.player.health<=0||law.arrested||sim.knockdown>0||!sim.player.grounded||sim.climb||sim.player.swimming||sim.jetPack||carEntry.active||weapons.aiming||weapons.inventory.cooldown>0);
      if(!canStartMission())return;
      const point=savePoints.filter(p=>Math.hypot(p.pickup[0]-pickup.position[0],p.pickup[1]-pickup.position[1],p.pickup[2]-pickup.position[2])<2)[0];
      if(!point)return;
      saving=true;hud.fade(true,1000);
      window.setTimeout(()=>{
        if(!alive)return;
        // The original's save menu holds the game from the pickup on; here the world runs under the fade, so what
        // happened meanwhile (a death, an arrest, a knockdown, a car entry, the pause menu) calls the save off.
        if(paused||!canStartMission()){hud.fade(false,1000);saving=false;return;}
        const effects=nativeSaveEffects({health:sim.player.health,maxHealth:mission?.runtime.game.playerInfo.maxHealth??100,timeMinutes:sim.timeMinutes});
        // DoGameSpecificStuffBeforeSave: the six hours pass on a full stomach.
        hunger.hoursDidntEat=0;
        // CGameLogic::PassTime hands CPickups::PassTime a second of timer for each game minute.
        sim.player.health=effects.health;sim.passTime(effects.passedMinutes);pickups.passTime(effects.passedMinutes);
        law.setLevel(effects.wanted);sim.player.stamina=effects.stamina;sim.player.sprintExhausted=false;
        // SET_CHAR_HEADING takes degrees where 0 faces north, so the browser heading is the native angle turned around.
        const heading=(point.heading*Math.PI/180+Math.PI)%(Math.PI*2),position={x:point.respawn[0],y:point.respawn[2],z:-point.respawn[1]};
        sim.flushPlayerTasks();sim.player.position={...position};sim.player.previous={...position};sim.player.heading=heading;
        sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
        render.yaw=heading+Math.PI;
        // The safehouses' discs are inside: the save keeps the interior (CGame::currArea) and the doors taken into it.
        const area=render.lighting.area,enexStack=area>0&&entryExits?entryExits.stack.map(e=>entryExits!.pool.indexOf(e)).filter(i=>i>=0):undefined;
        // CGenericGameStorage's save shuts the safehouse garages first (CGarages::CloseHideOutGaragesBeforeSave), so the
        // cars in them are the ones kept.
        mission?.runtime.game.garages.closeHideOutGaragesBeforeSave();
        progression.savedLocation={x:position.x,y:point.respawn[1],z:position.y,heading,timeMinutes:sim.timeMinutes,weekDay:sim.weekDay,...(area>0?{area,enexStack}:{})};const saved=progression.save();
        hud.fade(false,1000);hud.message(saved?'Game saved.':'The game could not be saved.');
        window.setTimeout(()=>{saving=false;},500);
      },1000);
    },
    onCollect:(pickup,message)=>{
      // A pickup the script made is collected for the script too, which is what it asks after; PICKUP_ASSET_REVENUE
      // only pays out and never sets bPickupCollected.
      // CPickup::Update: collecting shakes the pad (120 ms at 100), but not a property's icon.
      if(pickup.modelId!==1272&&pickup.modelId!==1273)mission?.runtime.game.pads.startShake(0,120,100,0,gameTimeMs);
      if(pickup.section==='script'&&pickup.category!=='revenue'&&mission){const handle=Number(pickup.id.slice('script:'.length));if(Number.isInteger(handle))mission.collectScriptPickup(handle);}if(!paused)sound.nativeEngine?.pickup(pickup.category,pickup.type);if(message){
        // CGarages::TriggerMessage of HO_, OY_ and SN_ONE with the counts in its ~1~s, or the _ALL line, for 5 s.
        const [code,count]=message.split(' '),name=/^(HO|OY|SN)_(ONE|ALL)$/.test(code)?PICKUP_TEXT[code.slice(0,2)]:undefined;
        if(!name)hud.message(message,5000);else{const [n1,n2]=code.endsWith('_ALL')?[-1,-1]:count.split('/').map(Number);triggerGarageMessage(code,n1,n2);}}progression.save();},
    onNotice:(_pickup,text)=>hud.help(text),
    onMission:()=>!!mission?.playerOnAMission(),
  },progression.pickups);
  const weaponView=new WeaponView(render.scene,()=>render.nativeCharacter,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,weapons);
  // CEscalator's step models, loaded once from the archive; plans made before they arrive wait for them.
  sim.groundCarry=feet=>escalators.carrySpeed(feet);
  void afterStartPackage.then(()=>openEscalatorAssets(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(assets=>{if(alive)escalators.setAssets(assets);}).catch(()=>{});
  // CPed::RemoveWeaponWhenEnteringVehicle(true) as the jetpack is put on: weapon changes are locked, and the Uzi or Tec-9
  // with ammo is taken up, else the handgun slot when the pistol or sawn-off has ammo, else the weapon's model is
  // removed. The pack coming off gives the saved weapon back.
  let jetSavedWeapon:number|undefined,jetWeaponHidden=false;
  const stepJetPackWeapon=()=>{
    const inv=weapons.inventory;
    if(sim.jetPack&&jetSavedWeapon===undefined){
     jetSavedWeapon=inv.selected;jetWeaponHidden=false;
     const loaded=(id:number)=>{const a=inv.ammo.get(id);return inv.owned.has(id)&&!!a&&a.clip+a.reserve>0;};
     const smg=[28,32].find(loaded);
     if(smg!==undefined)inv.select(smg);
     // SaveCurrentWeaponAndEquipInSlot(HANDGUN): with a loaded sawn-off and an empty handgun slot that slot's weapon is
     // the fists.
     else if(loaded(22)||loaded(26)){const handgun=[...inv.owned].find(id=>id!==0&&inv.slotOf(id)===inv.slotOf(22));inv.select(handgun??0);}
     else jetWeaponHidden=true;
     void weaponView.equip(inv.selected);
    }else if(!sim.jetPack&&jetSavedWeapon!==undefined){if(inv.owned.has(jetSavedWeapon))inv.select(jetSavedWeapon);jetSavedWeapon=undefined;jetWeaponHidden=false;void weaponView.equip(inv.selected);}
  };
  // CPed::RemoveWeaponWhenEnteringVehicle as the player takes a vehicle's controls: weapon changes lock, and the SMG slot's
  // Uzi or Tec-9 with ammo, else its MP5, is taken up; that is the one weapon a driver's drive-by fires. With none the
  // weapon stays put and there is no drive-by. ReplaceWeaponWhenExitingVehicle gives the saved weapon back.
  let driverSavedWeapon:number|undefined;
  // CPad::GetLookLeft / GetLookRight: one shoulder held and not the other, refused on the frame it is pressed and on the
  // frame the other is released; both held is the look-behind, which fires ahead.
  let lookQ=false,lookE=false;
  const bikeLookSide=():'left'|'right'|'forward'=>{
   const q=input.down('KeyQ'),e=input.down('KeyE'),side=q&&!e&&!(q&&!lookQ)&&!(lookE&&!e)?'left':e&&!q&&!(e&&!lookE)&&!(lookQ&&!q)?'right':'forward';
   lookQ=q;lookE=e;return side;
  };
  const DRIVER_DRIVEBY_WEAPONS=[28,32,29];
  const stepDriverWeapon=(driving:boolean)=>{
    const inv=weapons.inventory,loaded=(id:number)=>{const a=inv.ammo.get(id);return inv.owned.has(id)&&!!a&&a.clip+a.reserve>0;};
    if(driving&&driverSavedWeapon===undefined){
     driverSavedWeapon=inv.selected;
     // RemoveWeaponWhenEnteringVehicle: without m_bCanDoDriveBy the weapon is only put away, no SMG taken up.
     if(mission?.runtime.game.playerInfo.canDoDriveBy===false)return;
     // The port's arsenal can own the three at once; the one already in hand is the slot's.
     const smg=DRIVER_DRIVEBY_WEAPONS.includes(inv.selected)&&loaded(inv.selected)?inv.selected:DRIVER_DRIVEBY_WEAPONS.find(loaded);
     if(smg!==undefined&&smg!==inv.selected){inv.select(smg);void weaponView.equip(inv.selected);}
    }else if(!driving&&driverSavedWeapon!==undefined){
     if(driverSavedWeapon!==inv.selected&&inv.owned.has(driverSavedWeapon)){inv.select(driverSavedWeapon);void weaponView.equip(inv.selected);}
     driverSavedWeapon=undefined;
    }
  };
  // CPed::Render draws the weapon unless the ped is in a vehicle with a swim task: a swimmer keeps his gun in hand.
  weaponView.visible=()=>!playerWeaponHiddenByScript&&!render.scriptPlayerHidden&&!phones.get('player')?.active&&!jetWeaponHidden&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&(!carEntry.active||carEntry.phase==='approach');
  weapons.muzzle=left=>weaponView.muzzle(left);
  weapons.playerMove=()=>{const view=render.nativeCharacter;return view&&{blendRatio:view.moveBlendRatio,sprinting:view.sprinting};};
  const worldFx=new WorldFx(render.scene,sim,render.camera);
  worldFx.collisionSources=()=>importedScene?.sources;weapons.fires.onSteam=(p,rise)=>worldFx.fireSteam([p.x,p.y,p.z],rise);worldFx.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
  weapons.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
  void afterStartPackage.then(()=>worldFx.load(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(()=>{if(alive&&worldFx.ready)weapons.fx=worldFx;}).catch(error=>{worldFx.error=String(error);});
  // CCamera::Find3rdPersonCamTargetVector: third-person shots go through the crosshair at (0.53, 0.4) of the screen;
  // the sniper scope aims down the middle.
  const aimDirection=()=>render.scoped?render.camera.getWorldDirection(scratchAim):scratchAim.set(AIM_CROSSHAIR_NDC.x,AIM_CROSSHAIR_NDC.y,.5).unproject(render.camera).sub(render.camera.position).normalize();
  weaponView.aimDirection=aimDirection;
  // CCamera::Find3rdPersonCamTargetVector(20, ped + (0,0,0.7)): the crosshair ray's point nearest the ped's upper body
  // (the entity sits about a metre above the feet), carried 20 units on along the ray.
  const scratchAimTarget=new Vector3();
  weaponView.aimTarget=()=>{const d=aimDirection(),c=render.camera.position,p=sim.player.position;return scratchAimTarget.copy(c).addScaledVector(d,d.x*(p.x-c.x)+d.y*(p.y+1.7-c.y)+d.z*(p.z-c.z)+20);};
  // CTaskSimpleUseGun's PISTOLWHIP: GUN_BUTT, or GUN_BUTT_crouch ducked, from the pistlwhp group.
  weapons.onPistolWhip=crouched=>{const view=render.nativeCharacter;const clip=crouched?'gun_butt_crouch':'gun_butt';if(view?.hasReaction(clip))view.playReaction(clip);};
  weapons.onSound=(event,id,position,source)=>sound.combat(event,id,position,source);
  NativeWeaponAudio.canSeeOutside=()=>render.lighting.area===0;
  // CEventDamage::AffectsPed's MAKE_PLAYER_FIRE_PROOF and ComputeWillKillPed's CHEAT_NO_ONE_CAN_STOP_US (the AK recruit cheat).
  sim.playerFireProof=()=>!!mission?.runtime.game.playerInfo.fireProof;sim.playerWeaponProof=()=>CHEATS.isActive('recruitAk');
  weapons.onBulletHit=(hit,point,angle)=>{
    const collisions=sound.nativeEngine?.collisions;if(!collisions||paused)return;
    const handle=hit.collider.handle,vehicle=[...(fleet?.cars??[])].some(c=>hit.collider.parent()?.handle===c.car.body.handle)||[...(fleet?.planes??[])].some(p=>hit.collider.parent()?.handle===p.body.handle);
    const ped=!vehicle&&pedestrians?.targets().some(t=>t.handle===handle);
    const record=importedScene?.sources.get(handle),surface=vehicle?SURFACE.car:ped?SURFACE.ped:record?nativeCollisionSurface(record.source,hit)?.material:undefined;
    if(surface!==undefined)collisions.reportBulletHit(surface,{x:point.x,y:-point.z,z:point.y},angle);
  };
  // CCrime::ReportCrime passes PoliceDontCareAboutCrimesAgainstPedType for the victim, which divides the chaos by 3.
  weapons.policeHelis=()=>police?.helis??[];
  weapons.onCrime=(type,victim,queued)=>{const dontCare=!!pedestrians?.policeDontCare(victim);if(queued){if(victim)law.registerCrime(type,victim,dontCare);}else law.crime(type,victim,dontCare);};
  // CGangWars::GangWarFightingGoingOn zeroes the chaos a crime adds (CWanted::ReportCrimeNow).
  law.native.gangWarFighting=()=>!!gangWars?.gangWarFightingGoingOn();
  // CWanted::ReportCrimeNow's police scanner: a crime that raises the level is reported (NativePoliceScanner) for where
  // the player stood, the smallest type-0 navigation zone there, and what he is in or on. AUTHORED: paintjobs are not
  // applied to the port's cars, so GetRemapIndex is always -1.
  law.native.crimePosition=()=>({x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y});
  law.native.onLevelRaisedByCrime=(type,position)=>{
   const engine=sound.nativeEngine;if(!engine||!position)return;
   const zone=worldZones&&worldZoneAt(worldZones,[position.x,position.y,position.z],true);
   const seated=[...(fleet?.cars??[])].find(car=>car.occupied)??(worldCar?.occupied?worldCar:undefined)??fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
   const typeName=seated&&VEHICLE_AUDIO_SETTINGS[seated.modelId-400]?.[8];
   engine.crimeReported(type,{point:{x:position.x,y:position.y},
    zone:zone&&{textKey:zone.textLabel,min:[zone.min[0],zone.min[1]],max:[zone.max[0],zone.max[1]]},
    player:{inVehicle:!!seated,swimming:!!sim.player.swimming,jetPack:!!sim.jetPack&&!sim.jetPack.finished,
     vehicle:seated&&{typeForName:VEHICLE_AUDIO_TYPE_FOR_NAME.indexOf(typeName as (typeof VEHICLE_AUDIO_TYPE_FOR_NAME)[number]),remapped:false,
      primaryColour:(seated as {assets?:{colourIndices?:readonly number[]}}).assets?.colourIndices?.[0]??0}}});
  };
  law.chasedByPolice=victim=>pedestrians?.chasedByPolice(victim);
  /** CWeapon::TakePhotograph's marking: peds whose head, and script objects whose origin, the photo catches with a
   * clear line from two units in front of the camera (to 1.5 units short of the head, toward the camera). */
  const markPhotographed=()=>{
   const camera=render.camera,from=camera.getWorldPosition(new Vector3()),start=from.clone().addScaledVector(camera.getWorldDirection(new Vector3()),2);
   const clear=(to:Vector3)=>{const d=to.clone().sub(start),length=d.length();return length<=0||!sim.world.castRay(new RAPIER.Ray(start,d.normalize()),Math.max(0,length-.25),true,RAPIER.QueryFilterFlags.ONLY_FIXED);};
   pedestrians?.markPhotographed(head=>inPhotograph(camera,head)&&clear(head.clone().addScaledVector(from.clone().sub(head).normalize(),1.5)));
   for(const o of mission?.runtime.game.objects.all??[]){const at=new Vector3(o.position.x,o.position.z,-o.position.y);if(inPhotograph(camera,at)&&clear(at))o.photographed=true;}
  };
  // GOODBOY in STYLE_MIDDLE for 5 s, and $50 for PED_TYPE_PLAYER1.
  // CCrime::ReportCrime's good citizen bonus: $50, and AddBigMessage of TheText.Get("GOODBOY"). The PC GXT has no such
  // key, so Get gives "" and the big message is blank: the money comes with no text.
  law.onGoodCitizen=()=>{sim.money+=50;const text=gxtHudText(gxtText('GOODBOY',''));if(text)hud.bigMessage(text,'',5000);};
  // AR_STATS.DAT and the reversed CStats::UpdateStatsWhen* routines that read it.
  let statReactions:NativeStatReactions|undefined;
  void fetch(new URL(`${import.meta.env.BASE_URL}play/world/files/data/ar_stats.dat`,location.href)).then(r=>r.ok?r.text():Promise.reject(new Error(`ar_stats.dat ${r.status}`))).then(text=>{
   const values=readActionReactionStats(text);
   statReactions=new NativeStatReactions(values,(stat,value)=>{mission?.runtime.game.stats.increment(stat,value);displayStatUpdate(true,stat,value);});
   // STAT_INC_PISTOL_SKILL (12) to STAT_INC_M4_SKILL (21) by weapon; the Tec-9 trains the Micro Uzi's stat at its rate.
   progression.skillIncrements=new Map([22,23,24,25,26,27,28,29,30,31,32].map(id=>[id,values[id===32?18:id-10]??5]));
  }).catch(error=>{console.error('ar_stats.dat failed to load',error);});
  // data/shopping.dat for CShopping, handed to each mission runtime as it starts.
  let shoppingText:string|undefined;
  void fetch(new URL(`${import.meta.env.BASE_URL}play/world/files/data/shopping.dat`,location.href)).then(r=>r.ok?r.text():Promise.reject(new Error(`shopping.dat ${r.status}`))).then(text=>{shoppingText=text;mission?.runtime.game.shopping.load(text);}).catch(error=>{console.error('shopping.dat failed to load',error);});
  // data/script/script.img: the streamed scripts (shops, gyms, vending machines), registered with each mission runtime
  // as it starts or as the archive arrives, whichever is later; fetched once the menu's button is up.
  let scriptImg:Uint8Array|undefined;
  const registerStreamedScripts=()=>{if(scriptImg&&mission)try{mission.loadStreamedScripts(scriptImg);}catch(error){console.error('script.img could not be registered',error);}};
  void afterMenuReady.then(()=>fetch(new URL(`${import.meta.env.BASE_URL}play/world/files/scripts/script.img`,location.href))).then(r=>r.ok?r.arrayBuffer():Promise.reject(new Error(`script.img ${r.status}`))).then(buffer=>{scriptImg=new Uint8Array(buffer);registerStreamedScripts();}).catch(error=>{console.error('script.img failed to load',error);});
  // CPlayerInfo::m_nNumHoursDidntEat and WorkOutEnergyFromHunger.
  const hunger=new NativeHunger();
  const parachuteTimer=new NativeParachuteTimer();let inAircraft=false;
  /** CStats::DisplayScriptStatUpdateMessage into the HUD's stat box, the name from the GXT's STATnnn. */
  const displayStatUpdate=(increase:boolean,stat:number,value:number)=>{
    const game=mission?.runtime.game;if(!game)return;
    let current=0;try{current=game.stats.get(stat);}catch{return;}
    const bar=statUpdateBar({stat,value,widescreen:game.widescreenOn,helpShowing:hud.helpShowing()||game.help.state!==0,capped:ScmStats.isCapped(stat),current,maxGroup:Math.min(maxGroupMembers(),pedestrians?.scriptGangLimit??99)});
    if(bar===undefined||!game.help.setStatUpdate(increase,stat,value,bar))return;
    hud.statUpdate(gxtHudText(gxtText(statNameKey(stat),`Stat ${stat}`)),increase,current,bar);
  };
  /** CPlayerInfo::AddHealth: up to the maximum, never lower. */
  const addPlayerHealth=(amount:number)=>{const max=mission?.runtime.game.playerInfo.maxHealth??100;sim.player.health=Math.max(sim.player.health,Math.min(max,sim.player.health+amount));};
  law.position=()=>({...sim.player.position});law.presence=radius=>{const point={x:sim.player.position.x,y:sim.player.position.y+1,z:sim.player.position.z};return (pedestrians?.policePresence(point,radius)??0)+(police?.presence(point,radius)??0);};
  weapons.onStealth=seconds=>render.nativeCharacter?.playReaction('kill_knife_player',seconds,true);
  law.onArrest=()=>{arrested=true;input.clear();};
  /** Native axes: x east, y north, z up. */
  const nativePlayerPosition=():[number,number,number]=>[sim.player.position.x,-sim.player.position.z,sim.player.position.y];
  const nativeLevelAt=(p:readonly [number,number,number])=>worldZones?worldLevelAt(worldZones,[p[0],p[1],p[2]]):LEVEL_COUNTRYSIDE;
  /** CPopulation::CreateWaitingCoppers: NUM_CARS_FOR_WANTED_LEVEL empty cop cars (STATUS_ABANDONED) on the nearest
   * three road nodes within 30 units, facing the door, then NUM_COPS_FOR_WANTED_LEVEL cops 8-10 units out along the
   * exit heading over twenty tries, each needing a clear line of sight from the door, nothing within a unit and
   * ground under it; they face the door, carry the pistol above one star, and go for the player. Native `at`. */
  async function createWaitingCoppers(at:{x:number;y:number;z:number},exitAngle:number){
   const {cops,cars}=waitingCoppers(law.level),level=fleet?.zoneLevel()??0,createAt={x:at.x,y:at.z+1,z:-at.y};
   if(cars&&traffic&&fleet){
    let left=cars;
    for(const node of traffic.roadNodesNear({x:createAt.x,z:createAt.z},30).slice(0,3)){
     const car=await fleet.spawnTrafficCar(DEFAULT_COP_CAR[level],{x:node.x,y:node.y,z:node.z},Math.atan2(-(createAt.x-node.x),-(createAt.z-node.z)));
     if(!car)continue;car.driverless=true;if(!--left)break;
    }
   }
   if(!cops||!pedestrians)return;
   let left=cops;
   for(let i=0;i<20&&left>0;i++){
    const spot=waitingCopSpot({x:at.x,y:at.y},exitAngle,i,Math.random),x=spot.x,z=-spot.y;
    const top=createAt.y+2,hit=sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),8,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    const y=top-hit.timeOfImpact,eye={x:createAt.x,y:createAt.y,z:createAt.z},d={x:x-eye.x,y:y+1-eye.y,z:z-eye.z},length=Math.hypot(d.x,d.y,d.z)||1;
    if(sim.world.castRay(new RAPIER.Ray(eye,{x:d.x/length,y:d.y/length,z:d.z/length}),length,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,sim.playerCollider))continue;
    if(pedestrians.targets(true).some(t=>Math.hypot(t.position.x-x,t.position.z-z)<1))continue;
    const id=await pedestrians.spawnOfficer(DEFAULT_COP_MODEL[level],law.level>1?22:3,{x,y,z},Math.atan2(createAt.x-x,createAt.z-z));
    if(id!==false)left--;
   }
  }
  const gameLogicWorld:GameLogicWorld={
   setPadCamera:held=>{skipPadCamera=held;},
    playerOnAMission:()=>!!mission?.playerOnAMission(),
   // CGameLogic::Update waits for PEDSTATE_DEAD: CTaskSimpleDie raises CEventDeath once the death clip has finished and
   // the ped stands, is in water or has no collision (a seat). bIsDyingStuck, the fallback for a body that never comes to
   // rest, is set by unreversed code; the four-second death timer running out stands in for it.
   isPlayerDead:()=>{const view=render.nativeCharacter;return sim.player.health<=0&&(!view||view.reactionName!==undefined&&view.reactionPlayedOut&&(sim.player.grounded||sim.player.swimming||!sim.playerCollider.isEnabled())||sim.deathRemaining<=0);},
   isPlayerArrested:()=>arrested,
   // CGameLogic::Update takes the restart query from outside the door CJ came in by (GetPositionRelativeToOutsideWorld).
   playerPosition:()=>entryExits?entryExits.positionRelativeToOutsideWorld(nativePlayerPosition()):nativePlayerPosition(),
   wantedLevel:()=>law.level,
   isFading:()=>cameraFade.fading,
   fade(direction,seconds){cameraFade.fade(seconds*1000,direction,gameTimeMs,!!mission?.runtime.game.camera.ignoreFadingStuffForMusic);hud.fade(direction===0,seconds*1000);},
   // The browser crosshair follows the aiming state, so there is none to clear.
   clearCrossHairs(){},
   clearMessages(){hud.message('');},
   resetWastedText(){hud.whiteMiddleMessage('');},
   // CPed::ClearWeapons also takes the goggles off (RemoveGogglesModel), and their vision with them.
   punish(fee){sim.money=Math.max(0,sim.money-fee);weapons.inventory.strip();weapons.vision=null;weapons.goggles=undefined;void weaponView.equip(0);progression.save();},
   showWastedMessage(){hud.whiteMiddleMessage('wasted',4000);},
   showBustedMessage(){hud.whiteMiddleMessage('busted',5000);},
   // CGameLogic::PassTime: the clock and weekday, the days-passed stat, CClock::SetGameClock (which counts a day
   // for any weekday it is given, midnight or not), then CPickups::PassTime.
   passTime(minutes){
    const days=sim.passTime(minutes),game=mission?.runtime.game;
    if(days>0)game?.stats.increment(STAT_DAYS_PASSED_IN_GAME,days);
    const whole=Math.floor(sim.timeMinutes);game?.clock.setGameClock(Math.floor(whole/60),whole%60,sim.weekDay,gameTimeMs);
    pickups.passTime(minutes);drops.passTime(minutes);moneyDrops.passTime(minutes);
   },
   incrementStat:(stat,value)=>{mission?.runtime.game.stats.increment(stat,value);},
   endGangWar:()=>{gangWars?.endGangWar(false);},
   resurrect(result){
    arrested=false;law.clear();
    // RestorePlayerStuffDuringResurrection's MakePlayerSafe(false): no proofs, damageable again, cars too.
    sim.playerProofs=undefined;sim.playerCanBeDamaged=true;law.native.everybodyBackOff=false;for(const car of fleet?.cars??[])car.canBeDamaged=true;
    // ResetForResurrectionAndFadeOut: CWorld::ClearExcitingStuffFromArea(player, 4000, true) where he fell, and again at
    // the restart point after the teleport: every deletable ped and vehicle (police crews, cars and helicopters of the
    // chase included) goes, with the fires and projectiles; recruits, mission entities and locked cars stay. Before it,
    // CCarCtrl::ClearInterestingVehicleList (so none of his cars goes to the impound) and
    // CGarages::CloseHideOutGaragesBeforeSave (the safehouse garages shut on what is in them).
    fleet?.clearInterestingVehicleList();mission?.runtime.game.garages.closeHideOutGaragesBeforeSave();
    clearExcitingStuff(sim.player.position,4000);
    // RestorePlayerStuffDuringResurrection: back to the normal world (area 0) with an empty door stack. From an
    // interior the outside world at the restart point has to stream in first, as a save point's does.
    const inside=render.lighting.area!==0;entryExits?.clearStack();
    // CGame::currArea = AREA_CODE_NORMAL_WORLD (GameLogic.cpp:407), which GET_AREA_VISIBLE reads.
    if(mission)mission.runtime.game.currentArea=0;
    // RestorePlayerStuffDuringResurrection: CTimeCycle::StopExtraColour(0), and AudioEngine.StopPoliceScanner(true).
    localLighting.stopExtraColour(false);sound.nativeEngine?.policeScanner.stopScanner(true);
    // ResetForResurrectionAndFadeOut takes him out of a vehicle he sits in as a passenger, and the Teleport's
    // FlushImmediately drops whatever fall, get-up or arrest hold was running (RestartNonPartialAnims).
    if(playerPassenger)leavePassengerSeat(true);
    if(playerAttached){playerAttached.savedWeapon=undefined;detachPlayer();}
    playerGetUp=0;playerStuckUnderCar=false;playerFallClip=undefined;render.nativeCharacter?.clearReaction();render.nativeCharacter?.resetLocomotion();
    // RestorePlayerStuffDuringResurrection teleports the ped's origin, a unit above its feet, to the restart point plus
    // one (GameLogic.cpp:397): the feet stand on the point itself, where the ped's collision settles him. The browser
    // starts him a tenth up (the points sit a few centimetres under their ground here), inside the snap to the ground,
    // so he stands rather than dropping a metre into a landing.
    sim.respawn={x:result.position[0],y:result.position[2]+.1,z:-result.position[1]};
    sim.resetPlayer();
    // RestorePlayerStuffDuringResurrection: health back to CPlayerInfo::m_nMaxHealth.
    sim.player.health=mission?.runtime.game.playerInfo.maxHealth??100;
    // CGameLogic::Update's restart: m_nNumHoursDidntEat = 0 after the twelve hours pass.
    hunger.hoursDidntEat=0;
    // CPostEffects::ScriptResetForEffects: the script's heat haze and darkness filter go.
    postEffects.scriptResetForEffects();
    rebuildPlayerIfNeeded();
    sim.player.heading=(result.heading*Math.PI/180+Math.PI)%(Math.PI*2);
    render.yaw=sim.player.heading+Math.PI;input.clear();
    clearExcitingStuff(sim.respawn,4000);
    // CGarages::PlayerArrestedOrDied: a respray or bomb shop door down on him goes back up, the other garages shut, and
    // the garage message is over.
    if(mission)mission.runtime.game.garages.playerArrestedOrDied(mission.runtime.game.garageMessage);
    // CStreaming loads the collision under a teleported player before he falls (m_bIsStaticWaitingForCollision): the
    // restart point's window is asked for at once and the hold keeps him there until it is in, as for a script's
    // teleport.
    if(!inside){scriptTeleported=true;requestFollowingTerrain();}
    if(inside&&staticWorld&&!savedTransfer){
     follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;
     savedTransfer={x:result.position[0],y:result.position[1],z:result.position[2],heading:sim.player.heading,quiet:true};
     staticWorld.request(-1,{x:result.position[0],y:result.position[1],radius:180,lodRadius:1000,includeCollisionBounds:true});
    }
   },
   // CPlayerInfo's bust lines need the engine-wide CRT stream, which the
   // browser does not share yet, so no line is selected.
  };
  // CGameLogic's trip skip reaches the world through this. CPad::IsDPadRightPressed is the frame's own edge, kept
  // below each frame from the pad the held keys make.
  // CHud's big messages outside STYLE_MIDDLE and STYLE_WHITE_MIDDLE, stepped by game time.
  // LoadPathFindData: an area loads, then takes the script's stored switches.
  pathAreaLoaded.hook=(areas,areaId)=>{const switches=mission?.runtime.game.nodeSwitches.switches;if(switches?.length)applyStoredSwitches(areas,areaId,switches);};
  const carRecordings=new ScriptCarRecordingStore(()=>fetch(new URL(`${import.meta.env.BASE_URL}play/world/files/data/paths/carrec.img`,location.href)).then(r=>r.ok?r.blob():Promise.reject(new Error(`carrec.img ${r.status}`))));
  const hudBigMessages=new NativeHudBigMessages();let hudBigMessagesClock=0;
  let skipButtonDown=false,skipButtonPressed=false,skipPadCamera=false,tripSkipHelpShown=false;
  // CPad::DisablePlayerControls: the script's SET_PLAYER_CONTROL, or bCamera while a trip skip moves the player.
  /** CPad's PLAYERCONTROL_GARAGE: a Pay 'n' Spray holds the player while his car is in it. */
  let garageHold=false;
  const playerControlsDisabled=()=>mission?.playerControl===false||skipPadCamera||garageHold;
  /** The pad's own switches the player commands set (SET_PLAYER_ENTER_CAR_BUTTON and the rest): CPad's getters for
   * that button answer nothing while its bDisablePlayer flag is up, as they do with the controls off. */
  const padSwitchedOff=(button:'duck'|'enterCar'|'fireWeapon'|'jump'|'cycleWeapon')=>!!mission?.runtime.game.pads.disabled[0][button];
  const skipWorld:SkipWorld={
   canSeeOutside:()=>render.lighting.area===0,
   isFading:()=>cameraFade.fading,
   // FindPlayerVehicle when it is a car, bike, monster truck, quad or BMX.
   playerRoadVehicle:()=>worldCar?.occupied?worldCar:fleet?.occupied??fleet?.occupiedBike??undefined,
   playerSwimming:()=>sim.player.swimming,
   playerLeavingCar:()=>carEntry.phase==='waitSlow'||carEntry.phase==='getOut'||carEntry.phase==='closeOutside'||carEntry.phase==='jumpOut'||carEntry.phase==='getUp'||carEntry.phase==='crawlOut',
   skipButtonJustPressed:()=>skipButtonPressed,
   setPadCamera:held=>{skipPadCamera=held;},
   fade:(direction,seconds)=>gameLogicWorld.fade(direction,seconds),
   // CMessages::AddBigMessage(TheText.Get("SKIP"), 4500, STYLE_BOTTOM_RIGHT).
   showSkipMessage:()=>{mission?.runtime.game.messages.addBigMessage2('SKIP',4500,1,false,gameTimeMs);},
   clearHudMessage:()=>{hud.message('');},
   // UpdateSkip's move, in native coordinates.
   teleportForSkip:(position,headingDegrees)=>{
    const [x,y,z]=position,hit=sim.world.castRay(new RAPIER.Ray({x,y:z+50,z:-y},{x:0,y:-1,z:0}),150,true,RAPIER.QueryFilterFlags.ONLY_FIXED),ground=hit?z+50-hit.timeOfImpact:z;
    const car=worldCar?.occupied?worldCar:fleet?.occupied,bike=fleet?.occupiedBike;
    if(car||bike){
     const body=car?car.car.body:bike!.body,yaw=scriptCarRotation(headingDegrees);
     if(car)fleet?.clearSpaceFor({x,y:ground-car.nativeBody.boundsMin.z,z:-y},yaw,car.assets.collision.bounds);
     // Teleport, SetHeading and PlaceOnRoadProperly: the wheels on the road at the point, then rolling on at the
     // forward over 2.5 units a frame, the camera behind.
     const lift=car?-car.nativeBody.boundsMin.z:1;
     body.setTranslation({x,y:ground+lift,z:-y},true);body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
     body.setLinvel({x:-Math.sin(yaw)*20,y:0,z:-Math.cos(yaw)*20},true);body.setAngvel({x:0,y:0,z:0},true);
     render.yaw=yaw;
    }else{
     sim.flushPlayerTasks();sim.player.position={x,y:ground,z:-y};sim.player.previous={...sim.player.position};sim.player.speed=0;
     sim.playerBody.setTranslation({x,y:ground+.9,z:-y},true);sim.playerBody.setNextKinematicTranslation({x,y:ground+.9,z:-y});sim.playerCollider.setTranslation({x,y:ground+.9,z:-y});
    }
    fleet?.generateEvenIfClose();
   },
   playerPosition:()=>nativePlayerPosition(),
   passTime:minutes=>gameLogicWorld.passTime(minutes),
  };
  const arsenal=new Arsenal(hud.element,weapons);
  void afterStartPackage.then(()=>loadHudSprites(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,['siteM16','siterocket','radardisc','radar_north','radar_centre','radar_waypoint','arrow','radarRingPlane','fist','skipicon',...NativeMap.blipSpriteNames()])).then(sprites=>{arsenal.hudSprites=sprites;navigation?.setRadarSprites(sprites);hud.fistIcon=sprites.fist;hud.skipIcon=sprites.skipicon;}).catch(()=>{});
  arsenal.onSelect=id=>{void weaponView.equip(id);};
  /** An overlay opened over a locked pointer lets it go so its controls can be clicked, without that pausing the game. */
  let overlayReleasedLock=false,lockLostAt=-Infinity;
  const releaseLockForOverlay=()=>{if(document.pointerLockElement!==canvas)return;overlayReleasedLock=true;document.exitPointerLock();};
  arsenal.onToggle=open=>{input.clear();sound.setPlaying(!paused&&!open&&!navigation?.open);if(open)releaseLockForOverlay();};
  render.shadowReceivers=(footprint,projection)=>{
    if(!importedScene)return {chunks:[],candidateCount:0,triangleCount:0,vertexCount:0};
    return importedScene.shadowReceivers(footprint,projection);
  };
  // CCollision::BuildCacheOfCameraCollision: the cone cast tests buildings, vehicles and objects, never peds, and not the
  // car the player is climbing into (CTaskComplexEnterCar::GetCameraAvoidVehicle). CCamera::CameraVehicleModeSpecialCases:
  // in a vehicle, cars whose speed relative to it is at least sqrt(0.1) units a frame (sqrt(1) above 0.2 units a
  // frame) are passed through, and objects are tested only while it is that slow.
  const ENTER_AVOID_PHASES=new Set(['align','locked','open','pullout','getIn','closeInside','shuffle','getOut','draggedOut']);
  sim.cameraCollisionFilter=()=>{
    const own=worldCar?.occupied?worldCar.car.body:fleet?.occupiedBike?.body??fleet?.occupiedBoat?.body??fleet?.occupiedPlane?.body;
    const avoid=carEntry.active&&ENTER_AVOID_PHASES.has(carEntry.phase!)?carEntry.car?.car.body.handle:undefined;
    const vehicles=new Set<number>();
    for(const car of fleet?.cars??[])vehicles.add(car.car.body.handle);
    for(const list of [fleet?.bikes,fleet?.boats,fleet?.planes])for(const v of list??[])vehicles.add(v.body.handle);
    let slow=true,relSq=0,v0={x:0,y:0,z:0};
    if(own){v0=own.linvel();const speed=Math.hypot(v0.x,v0.y,v0.z)/50;slow=speed<=.2;relSq=slow?.1:1;}
    const scene=importedScene;
    return {
      body:body=>{
        if(pedestrians?.bodyHandles.has(body.handle)||body.handle===avoid)return true;
        if(vehicles.has(body.handle)){if(!own)return false;const v=body.linvel();return relSq<=((v0.x-v.x)**2+(v0.y-v.y)**2+(v0.z-v.z)**2)/2500;}
        // Loose props and debris are objects.
        return !slow;
      },
      fixed:slow||!scene?undefined:collider=>{const kind=scene.sources.get(collider.handle)?.entityKind;return kind==='object'||kind==='dummy';},
    };
  };
  render.afterRender=()=>pedestrians?.restoreCameraHidden();
  render.beforeRender = camera => {
    // CCollision::CheckPeds: on foot always, in a vehicle only while it is slow (bCamCollideWithPeds).
    {const own=worldCar?.occupied?worldCar.car.body:fleet?.occupiedBike?.body??fleet?.occupiedBoat?.body??fleet?.occupiedPlane?.body,v=own?.linvel();
     if(!v||Math.hypot(v.x,v.y,v.z)/50<=.2)pedestrians?.hideNearCamera(camera.position,camera.getWorldDirection(scratchCameraFront),camera.near);}
    weaponView.update();
    worldFx.draw(nativeDayNightBalance(sim.timeMinutes));
    roadsigns.update(camera.position);
    // CEscalators::Update: the streamed escalator effects build their steps near the camera and move them.
    if(importedScene&&escalators.ready){
      // A new streaming window brings new placements, and supplied effects bump the version; both need a re-read.
      if(escalatorScene!==importedScene||escalatorVersion!==importedScene.effectsVersion){
        escalatorScene=importedScene;escalatorVersion=importedScene.effectsVersion;
        for(const e of importedScene.escalatorPlacements())escalators.addEffect(e.effect,e.position,e.matrix);}
      escalators.setLighting(render.lighting.nativeWorldAmbient,render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier);
      escalators.update(camera.position,Math.min(3,Math.max(0,elapsed-escalatorElapsed)*50));escalatorElapsed=elapsed;
    }
    // CPostEffects::Render: the timecycle post-effect colours over the frame, greyed under the goggles, scaled by
    // the player's collision lighting (ambient before brightness plus the contact surface brightness).
    {const ambient=render.lighting.nativeWorldAmbient,contact=render.contactLighting===undefined?DEFAULT_CONTACT_SURFACE_BRIGHTNESS:nativeContactBrightness(render.contactLighting,nativeDayNightBalance(sim.timeMinutes));
     const light=ambient?lightingFromCol([ambient[0],ambient[1],ambient[2]],contact,render.lighting.area!==0):SCREEN_EXTRA_MULT_INITIAL;
     const nowMs=performance.now(),frameSeconds=colourFilterState.lastMs?Math.min(.1,(nowMs-colourFilterState.lastMs)/1000):0;colourFilterState.lastMs=nowMs;
     colourFilterState.extraMult=screenExtraMult(colourFilterState.extraMult,light,frameSeconds*50);
     // CWeather::UnderWaterness and WaterDepth come from a raw CWeather::Update: here the camera under the water
     // surface counts as fully under (1), its depth the surface height less the camera height.
     const surface=render.lighting.water.levels?.level(camera.position.x,-camera.position.z),waterDepth=surface===undefined?0:surface-camera.position.y;
     weather.underwaterness=waterDepth>0?1:0;render.lighting.skyWeather.underwaterness=weather.underwaterness;render.lighting.skyWeather.cloudCoverage=weatherStarted?weather.cloudCoverage:0;
     render.lighting.lightningFlash=weatherStarted&&weather.lightningFlash;
     postEffects.update(render.lighting.nativePostFx?.pass1,render.lighting.nativePostFx?.pass2,{vision:(weapons.vision??null) as VisionMode,extraMult:colourFilterState.extraMult,timeStep:frameSeconds*50,timeMs:Math.floor(elapsed*1000),underwaterness:weather.underwaterness,waterDepth:Math.max(0,waterDepth)});}
    // CTimeCycle::m_FogReduction, stepped once a frame with the colours.
    // It moves by one per CTimeCycle::CalcColoursForPoint, once a 30 fps game frame.
    {const frame=Math.floor(gameTimeExact*30/1000),steps=Math.min(6,Math.max(0,frame-lastFogFrame));lastFogFrame=frame;
     if(!paused)for(let i=0;i<steps;i++){fogReduction=stepFogReduction(fogReduction,{cameraForwardZ:camera.getWorldDirection(fogReductionForward).y,noRain:cullNoRain()});localLighting.stepExtraColour(50/30);}}
    if(weatherStarted)weatherEffects.update(camera,{rain:weather.rain,wind:weather.wind,windDir:weather.windDir,
      // CClouds::Render draws the rainbow only where the outside can be seen (CGame::CanSeeOutSideFromCurrArea).
      rainbow:render.lighting.area===0?weather.rainbow:0,fov:render.fov,frame:Math.floor(gameTimeExact*30/1000),noRain:cullNoRain(),underwater:weather.underwaterness>0,fogReduction},render.lighting.sunTexture.texture,paused||!!navigation?.open||arsenal.open,{width:Math.max(1,canvas.clientWidth),height:Math.max(1,canvas.clientHeight)});
    // CClouds::VolumetricCloudsRender: the puffy high clouds, created ahead of the player's vehicle (or the camera). It
    // runs once a 30 fps game frame: creation and the wind drift are per frame, the fader per time step.
    const cloudFrames=Math.floor(elapsed*30)-Math.floor(volumetricCloudElapsed*30);
    if(cloudFrames>0||!volumetricCloudElapsed){const sky=render.lighting.nativeSkyTop,bottom=render.lighting.nativeSkyBottom;
     volumetricClouds.setTexture(render.lighting.sunTexture.extraTexture('cloudhigh'));
     const plane=fleet?.occupiedPlane,ride=plane?plane.body:worldCar?.occupied?worldCar.car.body:undefined;
     const front=ride?new Vector3(0,0,-1).applyQuaternion(new Quaternion().copy(ride.rotation())):camera.getWorldDirection(scratchAim).clone();
     const anchorPos=ride?ride.translation():camera.position;
     const p=sim.player.position;
     volumetricClouds.update({cameraPos:[camera.position.x,-camera.position.z,camera.position.y],playerPos:[p.x,-p.z,p.y],
      anchorPos:[anchorPos.x,-anchorPos.z,anchorPos.y],anchorForward:[front.x,-front.z,front.y],
      skyTop:sky??[0,0,0],skyBottom:bottom??[0,0,0],windDir:[weatherStarted?weather.windDir.x:0,weatherStarted?weather.windDir.y:0],
      timeStep:Math.min(3,Math.max(1,cloudFrames)*50/30),farClip:camera.far,outside:render.lighting.area===0,quality:fxQuality()});
     volumetricCloudElapsed=elapsed;}
    const skyBottom=render.lighting.nativeSkyBottom;
    {const f=camera.getWorldDirection(scratchAim);
     birdsMesh.frame(birds,gameTimeMs,[camera.position.x,-camera.position.z,camera.position.y],render.lighting.sunTexture.fogTexture,{forward:[f.x,-f.z,f.y],near:camera.near});}
    {
      // CCoronas::Update (CGame::Process), CEntity::PreRender's ProcessLightsForEntity, then CCoronas::Render.
      const cam:[number,number,number]=[camera.position.x,-camera.position.z,camera.position.y],timeStep=Math.min(Math.max(0,elapsed-coronaElapsed)*50,3);coronaElapsed=elapsed;
      coronas.update(timeStep,cam,coronaLookMask(render.glance),(a,b)=>{const from={x:a[0],y:a[2],z:-a[1]},d={x:b[0]-a[0],y:b[2]-a[2],z:-(b[1]-a[1])},l=Math.hypot(d.x,d.y,d.z)||1;
        // CRegisteredCorona::Update's GetIsLineOfSightClear checks buildings only: props and dummies do not hide it.
        return !sim.world.castRay(new RAPIER.Ray(from,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.ONLY_FIXED,undefined,undefined,undefined,
          collider=>{const kind=importedScene?.sources.get(collider.handle)?.entityKind;return kind!=='dummy'&&kind!=='object';});});
      if(importedScene){
        const frame={timeMs:gameTimeMs,frame:++coronaFrame,dayNightBalance:nativeDayNightBalance(sim.timeMinutes),wetRoads:weatherStarted?weather.wetRoads:0,rain:weatherStarted?weather.rain:0,
          spriteBrightness:render.lighting.nativeSpriteBrightness??3,camera:cam,rand:()=>Math.floor(Math.random()*32768),
          sunGlare:(()=>{const core=render.lighting.nativeSunBytes?.core;if(!weatherStarted||!core||render.lighting.area!==0)return undefined;const d=sampleSun(sim.timeMinutes).direction;
            return {amount:weather.sunGlare,vectorToSun:[d.x,-d.z,d.y] as [number,number,number],sunCore:core as [number,number,number]};})()};
        const f=camera.getWorldDirection(scratchAim),lights=nativeTrafficLights(Math.floor(traffic?.lightMs??gameTimeMs)>>>0).visualCars;
        const trafficFrame={visual:lights,cameraForward:[f.x,-f.z,f.y] as [number,number,number],camera:cam,spriteBrightness:render.lighting.nativeSpriteBrightness??3,spriteSize:render.lighting.nativeSpriteSize??10,
          lightsOnGroundBrightness:render.lighting.nativeLightsOnGroundBrightness??10,trafficLightsBrightness:weatherStarted?weather.trafficLightsBrightness:0};
        // CMovingThings::Update's CPlaneTrails: the three sky planes and their night lights.
        // CMovingThings::Update runs every frame, indoors too, so a trail has no jump after an interior.
        planeTrails.update(gameTimeMs,Math.floor(sim.timeMinutes/60)%24,coronas,cam);
        // CEntity::PreRender: ProcessLightsForEntity, then DisplayActualLight for traffic light models.
        const shinyQuads:ShinyQuad[]=[];
        // CEntity::ProcessLightsForEntity and CTrafficLights::DisplayActualLight skip an entity with m_bRenderDamaged.
        const pointLights:import('./world/nativeEntityLights').EntityPointLight[]=[];
        const pools=importedScene.litPlacements().filter(entity=>!lightIsDamaged(entity.name,entity.matrix)).flatMap(entity=>{
          // The walk sign is part of DisplayActualLight, which a light tipped past up.z 0.96 skips.
          if(entity.name&&TRAFFIC_LIGHT_MODELS.has(entity.name)&&entity.matrix[10]>=.96){const sign=pedSignalQuad(entity,Math.floor(traffic?.lightMs??gameTimeMs),cam);if(sign)shinyQuads.push(sign);}
          return [...processLightsForEntity(entity,frame,coronas,pointLights),...(entity.name&&TRAFFIC_LIGHT_MODELS.has(entity.name)?displayActualLight(entity,trafficFrame,coronas,brightLights):[])];});
        shinyTexts.frame(shinyQuads,render.lighting.sunTexture.extraTexture('handman'));
        if(poolScene!==importedScene){lightPools.clear();carLightPoolsTwin.clear();carLightPoolsSingle.clear();pedShadows.clear();scorchShadows.clear();extraCarShadows.clear();poolScene=importedScene;}
        // CEntity::CreateEffects / DestroyEffects: the installed scene's particle effects run while it is loaded.
        if((fxScene!==importedScene||fxVersion!==importedScene.effectsVersion)&&worldFx.ready){
          for(const system of sceneFx)system.kill();sceneFx.length=0;fxScene=importedScene;fxVersion=importedScene.effectsVersion;
          for(const p of importedScene.particlePlacements()){const system=worldFx.entityFx(p.name,p.position,Float64Array.from(p.matrix));if(system)sceneFx.push(system);}
        }
        // CFireManager::Update's glow: an additive shad_exp pool over each group of fires, and coronas over strong ones.
        const e=camera.matrixWorld.elements,glow=fireGlow(weapons.fires.fires,cam,{x:e[0],y:-e[2]});
        for(const projectile of weapons.projectiles)if(projectile.weapon===35||projectile.weapon===36){
          const p=projectile.position,missile=missileGlow(projectile.id,[p.x,-p.z,p.y]);glow.pools.push(missile.pool);glow.coronas.push(missile.corona);
        }
        for(const corona of glow.coronas)coronas.register(corona,cam);
        // The sounding sirens' light bars: coronas, and the flashes' pools on the ground.
        const siren=sirens.update(fleet?.cars??[],Math.floor(elapsed*1000));
        for(const corona of siren.coronas)coronas.register(corona,cam);glow.pools.push(...siren.pools);
        // A lit taxi sign (bTaxiLight): its roof corona.
        for(const corona of taxiLightCoronas([...(fleet?.cars??[]),...(worldCar&&!fleet?.cars.has(worldCar)?[worldCar]:[])]))coronas.register(corona,cam);
        // DRAW_CORONA: 450 units of range, reflected in wet roads, no obstacle check (reVC's RegisterCorona call). Only
        // the star raster is drawn here, whatever type the script names.
        for(const c of mission?.takeScriptCoronas()??[])coronas.register({id:c.id,color:c.color,intensity:255,position:c.position,size:c.size,range:450,flareType:c.flareType,reflection:true},cam);
        const scene=importedScene;lightPools.frame([...pools,...glow.pools],cam,footprint=>scene.shadowReceivers(footprint),render.lighting.sunTexture.poolTexture);
        // CVehicle::DoHeadLightReflection: the road pools under lit headlights (each car's GetVehicleLightsStatus).
        const twinPools:import('./world/nativeEntityLights').LightPool[]=[],singlePools:import('./world/nativeEntityLights').LightPool[]=[];
        const front=camera.getWorldDirection(scratchPoolFront),cameraFront={x:cam[0],y:cam[1],front:{x:front.x,y:-front.z}};
        for(const car of fleet?.cars??[]){
          if(!car.lightsOn||!car.car.body.isEnabled())continue;const d=car.car.nativeFramePosition('headlights');if(!d)continue;
          const p=car.car.body.translation(),r=car.car.body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),f=new Vector3(0,0,-1).applyQuaternion(q),rt=new Vector3(1,0,0).applyQuaternion(q);
          const got=carLightPools({id:car.car.body.handle,position:{x:p.x,y:-p.z,z:p.y},forward:{x:f.x,y:-f.z},right:{x:rt.x,y:-rt.z},dummy:{x:d.x,y:d.y,z:d.z},lamps:[!car.damageState.lights[0],!car.damageState.lights[1]]},cameraFront);
          twinPools.push(...got.twin);singlePools.push(...got.single);
        }
        // Motorbikes (not the CBmx pedal bikes) light one lamp, DoHeadLightReflectionSingle's 1.25 pool; the quad has two.
        // CBike::PreRender and DoVehicleLights are not reversed, so which lamps a bike lights is authored.
        for(const bike of fleet?.bikes??[]){
          if(!bike.lightsOn||!bike.body.isEnabled())continue;
          const frame=bike.assets.model.frames.find(f=>f.name.toLowerCase()==='headlights');if(!frame)continue;
          const p=bike.body.translation(),r=bike.body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),f=new Vector3(0,0,-1).applyQuaternion(q),rt=new Vector3(1,0,0).applyQuaternion(q),quad=bike.modelId===471;
          const got=carLightPools({id:bike.body.handle,position:{x:p.x,y:-p.z,z:p.y},forward:{x:f.x,y:-f.z},right:{x:rt.x,y:-rt.z},dummy:{x:frame.matrix[12],y:frame.matrix[13],z:frame.matrix[14]},lamps:[quad,true],bike:true},cameraFront);
          twinPools.push(...got.twin);singlePools.push(...got.single);
        }
        carLightPoolsTwin.frame(twinPools,cam,footprint=>scene.shadowReceivers(footprint),render.lighting.sunTexture.extraTexture('headlight'));
        carLightPoolsSingle.frame(singlePools,cam,footprint=>scene.shadowReceivers(footprint),render.lighting.sunTexture.extraTexture('headlight1'));
        // CPed::PreRenderAfterTest: every other ped casts StoreShadowForPedObject's `shad_ped` blob (FX quality high:
        // only the player has a real-time shadow).
        const strength=render.lighting.nativeShadowStrength,pedPools:import('./world/nativeEntityLights').LightPool[]=[];
        if(strength&&pedestrians){
          const d=sampleSun(sim.timeMinutes).direction,sun:[number,number,number]=[d.x,-d.z,d.y];
          for(const {id,root} of pedestrians.shadowCasters()){const pool=pedShadowPool(id,[root.x,-root.z,root.y],cam,sun,strength);if(pool)pedPools.push(pool);}
        }
        // Below high FX quality the player has no real-time shadow: on foot he casts the same blob (DrawDummyShadow).
        if(strength&&!playerRealTimeShadow()&&!render.vehicleView&&render.nativeCharacter?.root.visible){
          const d=sampleSun(sim.timeMinutes).direction,root=render.nativeCharacter.shadowPosition();
          const pool=pedShadowPool(PLAYER_SHADOW_ID,[root.x,-root.z,root.y],cam,[d.x,-d.z,d.y],strength);if(pool)pedPools.push(pool);
        }
        pedShadows.frame(pedPools,cam,footprint=>scene.shadowReceivers(footprint),render.lighting.sunTexture.extraTexture('shad_ped'));
        // CShadows::RenderExtraPlayerShadows: the player's car under street lamps (never the RC Bandit).
        const carPools:import('./world/nativeEntityLights').LightPool[]=[];
        if(strength&&worldCar?.occupied&&worldCar.modelId!==441){
          const b=worldCar.car.body,t=b.translation(),r=b.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),f=new Vector3(0,0,-1).applyQuaternion(q),rt=new Vector3(1,0,0).applyQuaternion(q),up=new Vector3(0,1,0).applyQuaternion(q),bounds=worldCar.assets.collision.bounds;
          const at:[number,number,number]=[t.x,-t.z,t.y];
          carPools.push(...extraPlayerShadows({position:at,forward:[f.x,-f.z],right:[rt.x,-rt.z],upZ:up.y,boundsMin:bounds.min as [number,number,number],boundsMax:bounds.max as [number,number,number]},at,pointLights,strength));
        }
        extraCarShadows.frame(carPools,cam,footprint=>scene.shadowReceivers(footprint),render.lighting.sunTexture.extraTexture('shad_car'));
        scorchShadows.frame(scorches.pools(gameTimeMs),cam,footprint=>scene.shadowReceivers(footprint),render.lighting.sunTexture.extraTexture('shad_heli'));
      }
      worldCoronas.frame(camera,coronas,render.lighting.sunTexture.texture,weatherStarted?weather.foggyness:0);
      // RenderScene's CCoronas::RenderReflections on wet roads.
      {
        const wet=weatherStarted&&render.lighting.area===0?weather.wetRoads:0;
        // CWorld::FindGroundZFor3DCoord: a vertical line down to z = -1000 through buildings; the lamps within reach are
        // objects by then, so the line passes through them.
        const reflections=nativeCoronaReflections(coronas,wet,coronaFrame,cam,q=>{
          const hit=sim.world.castRay(new RAPIER.Ray({x:q[0],y:q[2],z:-q[1]},{x:0,y:-1,z:0}),q[2]+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED,undefined,undefined,undefined,
            collider=>{const kind=importedScene?.sources.get(collider.handle)?.entityKind;return kind!=='dummy'&&kind!=='object';});
          return hit?q[2]-hit.timeOfImpact:undefined;
        });
        coronaReflectionCandidates=reflections.length;
        coronaReflections.frame(camera,reflections,wet,render.lighting.sunTexture.extraTexture('coronareflect'));
      }
      // CCoronas::Render's flare pass for the sun's corona (id 2). CWorld::ProcessLineOfSight from it to the camera
      // tests vehicles and peds only, so CJ or a car between them takes the flare away.
      {
        const sun=render.lighting.sunCoronas.corona,bytes=render.lighting.nativeSunBytes?.corona;let sprites:FlareSprite[]=[];flareSun=null;
        if(sun&&bytes&&sun.intensity>0){
          const screen=projectCorona(camera,sun.position,1,1,GAME_CAMERA_FOV);
          const blocked=()=>{
            const length=flareRay.copy(camera.position).sub(sun.position).length();
            if(!(length>1e-3))return false;
            flareRay.divideScalar(length);
            return !!sim.world.castRay(new RAPIER.Ray(sun.position,flareRay),length,false,RAPIER.QueryFilterFlags.EXCLUDE_FIXED|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,
              collider=>!importedScene?.sources.has(collider.handle));
          };
          if(screen&&!blocked()){flareSun=[screen.x*2-1,1-screen.y*2];sprites=coronaFlares(FLARE.sun,flareSun,bytes,sun.intensity);}
        }
        coronaFlaresMesh.frame(sprites,render.renderer.getDrawingBufferSize(flareRaster),render.lighting.sunTexture.texture);
      }
      // CTaskSimpleJetPack::RenderJetPack: the pack follows the ped's arm bone, and DoJetPackEffect keeps a `jetpack`
      // flame on each jet ball, at the thrust's key time.
      {
        const pack=sim.jetPack;
        {const jetFrame=Math.floor(gameTimeExact*30/1000),due=jetFrame!==lastJetPackFrame;lastJetPackFrame=jetFrame;
         jetPackView.frame(render.nativeCharacter?.hand(JETPACK_BONE),pack,sim.player.heading-Math.PI,gameTimeMs,pack&&!sim.player.grounded?pack.heading:sim.player.heading-Math.PI,due);}
        render.nativeCharacter?.setLegSwing(pack&&!sim.player.grounded?{fwd:pack.legSwingFwd,side:pack.legSwingSide}:undefined);
        const matrices=pack?jetPackView.ballMatrices():[];
        matrices.forEach((matrix,i)=>{
          const e=jetNativeMatrix.multiplyMatrices(jetToNative,matrix).elements;
          const fx=Float64Array.of(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10],e[12],e[13],e[14]);
          let system=jetFlames[i];
          if(!system||system.destroyed){system=jetFlames[i]=worldFx.entityFx('jetpack',[0,0,0],fx);system?.setLocalParticles(true);system?.copyParentMatrix();}
          if(!system)return;
          system.setMatrix(fx);system.setOffsetPos(...JETBALL_OFFSET);system.setConstTime(true,pack!.fxKeyTime);
        });
        if(!matrices.length&&jetFlames.some(f=>f)){for(const system of jetFlames)system?.kill();jetFlames.length=0;}
      }
      // CEntryExitManager::Update's marker pass, C3dMarkers::Update (CSpecialFX::Update), then C3dMarkers::Render.
      if(markersMesh.ready){
        const p=sim.player.position,f=camera.getWorldDirection(scratchAim);
        markerFrustum.setFromProjectionMatrix(markerProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
        const visible=(q:readonly [number,number,number],radius:number)=>markerFrustum.intersectsSphere(markerSphere.set(markerPoint.set(q[0],q[2],-q[1]),radius));
        const ctx:Marker3dContext={player:[p.x,-p.z,p.y+1],timeMs:gameTimeMs,timeStep,radius:markersMesh.radius,roofAt:a=>{
          const hit=sim.world.castRay(new RAPIER.Ray({x:a[0],y:a[2],z:-a[1]},{x:0,y:1,z:0}),1.5,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?a[2]+hit.timeOfImpact:undefined;},
          // FindGroundZFor3DCoord's vertical line against the world's fixed collision; a streamed-out spot has none, which
          // stands in for CColStore::HasCollisionLoaded.
          groundZ:(x,y,z)=>markerGround(x,y,z),collisionLoaded:(x,y)=>markerGround(x,y,1000)!==undefined,
          waterNoWaves:(x,y)=>render.lighting.water.levels?.levelNoWaves(x,y)};
        if(entryExits&&!interiorTransfer)for(const {enex,position} of entryExits.markers(cam,[f.x,-f.z],render.lighting.area,Math.floor(sim.timeMinutes/60)%24,q=>visible(q,1),playerControlsDisabled()))
          markers3d.placeMarkerCone(enex.index+1,position,2,255,255,0,255,1024,1,5,false,cam,ctx);
        // CRadar::Draw3dMarkers (from CHud::Draw, not in widescreen): cones over blipped things, cylinders at contact points.
        if(mission&&!mission.runtime.game.widescreenOn)for(const m of mission.radarMarkers(render.lighting.area!==0)){
          if(m.kind==='cone')markers3d.placeMarkerCone(m.id,m.position,m.size,m.colour[0],m.colour[1],m.colour[2],255,1024,.2,5,true,cam,ctx);
          else markers3d.placeMarkerSet(m.id,MARKER3D.cylinder,m.position,m.size,m.colour[0],m.colour[1],m.colour[2],228,2048,.2,ctx);
        }
        // CTheScripts::HighlightImportantArea's CShadows::RenderIndicatorShadow: three red cylinders at the area's centre.
        if(mission)for(const h of mission.highlightedAreas()){
          const z=h.z??markerGround(h.x,h.y,1000);if(z===undefined)continue;
          // DRAW_SPHERE: one cylinder, as DrawScriptSpheres places its own.
          if(h.sphere){markers3d.placeMarkerSet(h.id,MARKER3D.cylinder,[h.x,h.y,z],h.halfX,255,0,0,228,2048,.1,ctx);continue;}
          for(const mult of [.8,.9,1])markers3d.placeMarkerSet(h.id,MARKER3D.cylinder,[h.x,h.y,z],h.halfX*mult,255,0,0,255,2048,.2,ctx);
        }
        // CTheScripts::DrawScriptSpheres (0x4810E0): every sphere ADD_SPHERE made, a red cylinder of its radius.
        if(mission)for(const s of mission.runtime.game.scriptSpheres.active)markers3d.placeMarkerSet(s.id,MARKER3D.cylinder,[s.position.x,s.position.y,s.position.z],s.radius,255,0,0,228,2048,.1,ctx);
        debugMarkers.forEach((q,i)=>markers3d.placeMarkerCone(0x10000+i,q,2,255,255,0,255,1024,1,5,false,cam,ctx));
        // CCheckpoints::Render: the script's race tubes and rings, placed as markers each frame.
        mission?.runtime.game.checkpoints.markers.render(markers3d,ctx,(x,y)=>render.lighting.water.levels?.levelNoWaves(x,y));
        // A car a script put in an area other than the outside world shows only while that area does.
        for(const car of fleet?.cars??[])if(car.areaCode)car.showForArea(render.lighting.area);
        markers3d.update(timeStep);markersMesh.frame([...markers3d.drawUserMarkers(),...markers3d.render(visible)],camera);markersMesh.frameArrows(markers3d.drawDirectionArrows());
      }
      // CEntity::CreateRwObject's CTagManager::ResetAlpha for a newly installed scene's tags.
      if(importedScene&&tagManager&&tagScene!==importedScene){for(const key of importedScene.tagKeys())importedScene.setTagAlpha(key,tagManager.alpha(key));tagScene=importedScene;}
      // CMovingThings::Render_BeforeClouds.
      trailsMesh.frame(render.lighting.area===0&&render.lighting.nativeSkyBottom?planeTrails.render(render.lighting.nativeSkyBottom,{cloudCoverage:weatherStarted?weather.cloudCoverage:0,foggyness:weatherStarted?weather.foggyness:0,rain:weatherStarted?weather.rain:0},gameTimeMs):[]);
      // CSpecialFX::Update's CBulletTraces::Update, then CBulletTraces::Render.
      bulletTraces.update(gameTimeMs);bulletTracesMesh.frame(bulletTraces.geometry(camera.position));
      streaksMesh.frame(streaks.geometry());
      // CSpecialFX::Render: CBrightLights before the markers.
      brightMesh.frame(brightLights.render(()=>Math.floor(Math.random()*32768)),camera);
      // RenderScene's CCoronas::RenderSunReflection, before the water.
      {
        const sun=sampleSun(sim.timeMinutes).direction,bytes=render.lighting.nativeSunBytes;
        sunReflectionMesh.frame(bytes&&render.lighting.area===0?sunReflection({toSun:[sun.x,-sun.z,sun.y],camera:cam,cloudCoverage:weatherStarted?weather.cloudCoverage:0,foggyness:weatherStarted?weather.foggyness:0,
          wind:weatherStarted?weather.wind:0,sunCore:bytes.core,sunCorona:bytes.corona,timeMs:gameTimeMs}):undefined,render.lighting.sunTexture.extraTexture('coronaheadlightline'));
      }
    }
    movingFog.frame(Math.floor(elapsed*1000),camera,weatherStarted&&skyBottom?{foggynessSF:weather.foggynessSF,outside:render.lighting.area===0,noRain:cullNoRain(),underwaterness:weather.underwaterness,skyBottom}:undefined,render.lighting.sunTexture.fogTexture,paused||!!navigation?.open||arsenal.open);
    // Bikes and boats light like every other vehicle: the object ambient and the day/night prelight blend.
    for(const vehicle of [...(fleet?.bikes??[]),...(fleet?.boats??[])])vehicle.setLighting(render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier,nativeDayNightBalance(sim.timeMinutes));
    for(const plane of fleet?.planes??[])plane.setLighting(render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier,nativeDayNightBalance(sim.timeMinutes));
    for(const train of fleet?.trains??[])train.setLighting(render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier,nativeDayNightBalance(sim.timeMinutes));
    // GetVehicleLightsStatus for every car with a driver (the player, an autopilot, a script driver); a parked car's
    // CAutomobile::PreRender, which sets bLightsOn, is a retail stub, and generated cars start with it off.
    {const hours=Math.floor(sim.timeMinutes/60)%24,minutes=Math.floor(sim.timeMinutes)%60;
     const zone=worldZones?.population?worldZones.population[worldZoneAt(worldZones,[sim.player.position.x,-sim.player.position.z,sim.player.position.y]).zoneInfoIndex]:undefined;
     const gangArea=(zone?.gangStrength?.reduce((a,b)=>a+b,0)??0)>20,foggyness=weatherStarted?weather.foggyness:0,wetRoads=weatherStarted?weather.wetRoads:0;
     // A ridden motorbike reads the same rule; the bike's contact brightness is not kept, so the dark test is off.
     for(const bike of fleet?.bikes??[])bike.lightsOn=!bike.wrecked&&bike.occupied&&!BMX_MODELS.has(bike.modelId)&&vehicleLightsStatus({seed:bike.randomSeed,gangDriverOddSeed:false,gangArea,hours,minutes,foggyness,wetRoads,contactBrightness:1,camNoRain:cullZones.camNoRain});
     // m_nOverrideLights answers first: FORCE_CAR_LIGHTS on or off, whoever drives.
     for(const car of fleet?.cars??[])car.lightsOn=car.overrideLights===2?!car.wrecked:car.overrideLights===1?false:!car.wrecked&&(car.occupied||!!car.autopilot&&!car.driverOut)&&vehicleLightsStatus({seed:car.randomSeed,gangDriverOddSeed:car.gang!==undefined&&car.driverSeedOdd,gangArea,hours,minutes,foggyness,wetRoads,contactBrightness:car.contactBrightness(nativeDayNightBalance(sim.timeMinutes)),camNoRain:cullZones.camNoRain});}
    for(const bike of fleet?.bikes??[])bike.setViewDistance(bike.root.position.distanceToSquared(camera.position),1);
    for(const car of fleet?.cars??[]){car.car.setViewDistance(car.car.root.position.distanceToSquared(camera.position),1);car.setLighting(render.lighting.nativeWorldAmbient,render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier,nativeDayNightBalance(sim.timeMinutes));}
    // CWaterCannons::Render: the crossed quads of the live sections, and the splash where the jet meets a surface.
    {const f=camera.getWorldDirection(new Vector3());
     const g=waterCannon.renderGeometry({cameraForward:{x:f.x,y:-f.z,z:f.y},random:Math.random,lineOfSight:(a,b)=>{
      const A={x:a.x,y:a.z,z:-a.y},d={x:b.x-a.x,y:b.z-a.z,z:-(b.y-a.y)},len=Math.hypot(d.x,d.y,d.z);if(len<1e-6)return undefined;
      const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray(A,{x:d.x/len,y:d.y/len,z:d.z/len}),len,true,RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
      if(!hit)return undefined;const t=hit.timeOfImpact,P={x:A.x+d.x/len*t,y:A.y+d.y/len*t,z:A.z+d.z/len*t};
      return {point:{x:P.x,y:-P.z,z:P.y},normal:{x:hit.normal.x,y:-hit.normal.z,z:hit.normal.y}};}});
     const positions:number[]=[];for(let i=0;i<g.positions.length;i+=3)positions.push(g.positions[i],g.positions[i+2],-g.positions[i+1]);
     waterCannonMesh.frame({positions,colors:g.colors});
     if(g.splash)worldFx.waterCannon.splash([g.splash.point.x,g.splash.point.y,g.splash.point.z],[g.splash.normal.x,g.splash.normal.y,g.splash.normal.z],1000/60,Math.random);
     // The fire engines' cannons, drawn the same way.
     const npcPositions:number[]=[],npcColors:number[]=[];
     for(const cannon of npcCannons.values()){
      const n=cannon.renderGeometry({cameraForward:{x:f.x,y:-f.z,z:f.y},random:Math.random,lineOfSight:(a,b)=>{
       const A={x:a.x,y:a.z,z:-a.y},d={x:b.x-a.x,y:b.z-a.z,z:-(b.y-a.y)},len=Math.hypot(d.x,d.y,d.z);if(len<1e-6)return undefined;
       const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray(A,{x:d.x/len,y:d.y/len,z:d.z/len}),len,true,RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
       if(!hit)return undefined;const t=hit.timeOfImpact,P={x:A.x+d.x/len*t,y:A.y+d.y/len*t,z:A.z+d.z/len*t};
       return {point:{x:P.x,y:-P.z,z:P.y},normal:{x:hit.normal.x,y:-hit.normal.z,z:hit.normal.y}};}});
      for(let i=0;i<n.positions.length;i+=3)npcPositions.push(n.positions[i],n.positions[i+2],-n.positions[i+1]);
      npcColors.push(...n.colors);
      if(n.splash)worldFx.waterCannon.splash([n.splash.point.x,n.splash.point.y,n.splash.point.z],[n.splash.normal.x,n.splash.normal.y,n.splash.normal.z],1000/60,Math.random);
     }
     npcCannonMesh.frame({positions:npcPositions,colors:npcColors});}
    // CVehicle::DoHeadLightBeam: the lit headlights' fans, for the cars whose lights are on.
    headlightBeams.frame([...(fleet?.cars??[])].some(car=>car.lightsOn)?[...(fleet?.cars??[])].filter(car=>car.lightsOn&&car.car.body.isEnabled()).map(car=>{const p=car.car.body.translation(),r=car.car.body.rotation(),d=car.car.nativeFramePosition('headlights');return {position:{x:p.x,y:p.y,z:p.z},rotation:{x:r.x,y:r.y,z:r.z,w:r.w},dummy:d?{x:d.x,y:d.y,z:d.z}:undefined,broken:[car.damageState.lights[0],car.damageState.lights[1]] as [boolean,boolean],tilt:car.modelId===530?.5:.15};}):[],{x:camera.position.x,y:camera.position.y,z:camera.position.z});
    // CCustomBuildingRenderer::Update steps its counter once a 30 fps game frame (CGame::Process).
    importedScene?.setTime(sim.timeMinutes,render.lighting.nativeWorldAmbient,render.lighting.sunLightMultiplier,render.lighting.nativeObjectAmbient,Math.floor(gameTimeExact*30/1000));
    // CWeather::Wind drives grass bending (Windyness itself follows the reVC categories; see docs/research/NATIVE_WEATHER.md).
    // COcclusion::ProcessBeforeRendering: this frame's active occluders before the visibility pass culls behind them.
    occlusion.processBeforeRendering(occlusionCamera(),render.lighting.area===0);
    // CRenderer::ConstructRenderList's tunnel switches from CCullZones::FindTunnelAttributesForCoors at the camera.
    // CPlantMgr::Update runs once a 30 fps game frame.
    const plantFrame=Math.floor(gameTimeExact*30/1000),plantDue=plantFrame!==lastPlantFrame;lastPlantFrame=plantFrame;
    if(!paused&&plantDue)swimEffects();
    importedScene?.updateView(camera,render.lighting.lowLodScale,{milliseconds:Math.floor(elapsed*1000)>>>0,wind:weatherStarted?weather.windClipped:0,seed:0},!paused&&plantDue,cullZones.renderTunnels([camera.position.x,-camera.position.z,camera.position.y]));
  };
  const disposeWater=bindLocalWater(hud.element,render.lighting.water);
  const disposeSunTexture=bindLocalSunTexture(hud.element,render.lighting.sunTexture);
  sim.sunCollisionEligible=handle=>importedScene?.sources.get(handle)?.entityKind!=='dummy';
  // TheCamera::CalculateGroundHeight(ENTITY_BB_TOP) for the jetpack's climb fade: what is under the flier.
  // CTaskSimpleJetPack::DropJetPack: CPickups::GenerateNewOne leaves the pack beside the player.
  // CPickups::CreatePickupCoorsCloseToCoors is unreversed, so it goes two units in front of him, clear of his reach.
  sim.onJetPackDropped=position=>{
    const x=position.x+Math.sin(sim.player.heading)*2,z=position.z+Math.cos(sim.player.heading)*2;
    pickups.generate({id:`jetpack:${Date.now()}`,command:'GENERATED',section:'jetpack',offset:0,
      modelId:370,model:'jetpack',dictionary:'jetpack',type:PICKUP_TYPE.onceTimeoutSlow,category:'jetpack',ammo:0,
      position:[x,-z,position.y+1]});
  };
  // TheCamera.CalculateGroundHeight(ENTITY_BB_TOP): a line down from z = 1000 at the camera's x, y, cached until the
  // camera moves 20 units, a miss keeping the last height. It returns the hit model's bounding-box top; the hit point
  // stands in here.
  let jetGround:{x:number;z:number;height:number}|undefined;
  sim.jetGroundHeight=position=>{
    const c=render.camera.position;
    if(!jetGround||Math.hypot(c.x-jetGround.x,c.z-jetGround.z)>20){
     const hit=sim.world.castRay(new RAPIER.Ray({x:c.x,y:1000,z:c.z},{x:0,y:-1,z:0}),2000,true,RAPIER.QueryFilterFlags.ONLY_FIXED,undefined,sim.playerCollider);
     if(hit)jetGround={x:c.x,z:c.z,height:1000-hit.timeOfImpact};
    }
    return jetGround?.height??position.z-2;
  };
  // CTaskSimpleClimb::ScanToGrabSectorList's entities: buildings, static objects without infinite mass (object.dat's
  // hanging response, CObjectData::SetObjectData) and vehicles. Peds and loose objects are never scanned.
  sim.climbWorld=rapierClimbWorld(sim.world,{
   kind:collider=>{
    const body=collider.parent();if(!body||collider.handle===sim.playerCollider.handle)return undefined;
    if(!body.isFixed()){
     for(const car of fleet?.cars??[])if(car.car.body.handle===body.handle)return 'vehicle';
     for(const vehicle of [...fleet?.bikes??[],...fleet?.boats??[],...fleet?.planes??[]])if(vehicle.body.handle===body.handle)return 'vehicle';
     return undefined;
    }
    const source=importedScene?.sources.get(collider.handle);
    if(source?.entityKind!=='dummy'&&source?.entityKind!=='object')return 'building';
    return (localObjectDefs??resolvedObjectDefs)?.get(source.modelName.toLowerCase())?.values.specialCollisionResponse===8?undefined:'object';
   },
   source:collider=>importedScene?.sources.get(collider.handle)?.source,
   climbable:()=>surfaceClimbable,
  });
  const disposeObjectData=bindLocalObjectData(hud.element,sim.imported,definitions=>{
    if(!importedScene)throw new Error('Wait for the imported scene to finish loading.');
    localObjectDefs=definitions;applySceneObjectData();
  });
  // Shipped object definitions classify fixed collision (notably sun-halo
  // dummies) until a local upload overrides them for the session.
  // (Loaded below, after the page-lifecycle flags.)
  function applySceneObjectData(){
   if(!importedScene||!alive)return;
   if(localObjectDefs){importedScene.setObjectData(localObjectDefs);return;}
   void defaultObjectDefs.then(defs=>{if(alive&&defs&&!localObjectDefs)importedScene?.setObjectData(defs);});
  }
  // CWeather drives the playable world's timecycle; the lighting menu forces or releases it.
  // CCullZones: the IPL `cull` zones. Rain is off in interiors and wherever the camera's or the player's zone is
  // no-rain (CamNoRain, PlayerNoRain).
  const cullZones=new NativeCullZones();
  const cullNoRain=()=>render.lighting.area!==0||cullZones.camNoRain||cullZones.playerNoRain;
  const weather=new NativeWeather();let weatherStarted=false;
  const localLighting = new LocalTimecycle(), disposeLighting = bindLocalLighting(hud.element,localLighting,walkDemo?value=>{if(value<0)weather.releaseWeather();else weather.forceWeatherNow(value);localLighting.setWeatherState(weather.state());}:undefined);
  const roadsigns=new NativeRoadsigns(render.scene),occlusion=new NativeOcclusion(),postEffects=new NativePostEffects(render.scene),volumetricClouds=new NativeVolumetricClouds(render.scene),escalators=new NativeEscalators(render.scene),weatherEffects=new NativeWeatherEffects(render.scene),
  /** CPostEffects s_ExtraMult (0.35 at rest), crept toward the player's lighting from the collision surface. */
  colourFilterState={extraMult:SCREEN_EXTRA_MULT_INITIAL,lastMs:0},
  /** CalcScreenCoors' camera: the renderer's view, the projection's half-angle tangents and the canvas in pixels. */
  occlusionCamera=():OcclusionCamera=>{const cam=render.camera,m=cam.matrixWorldInverse.elements,p=cam.projectionMatrix.elements,canvas=render.renderer.domElement;
    return {position:[cam.position.x,-cam.position.z,cam.position.y],view:q=>{const x=q[0],y=q[2],z=-q[1];return {x:m[0]*x+m[4]*y+m[8]*z+m[12],y:m[1]*x+m[5]*y+m[9]*z+m[13],z:-(m[2]*x+m[6]*y+m[10]*z+m[14])};},tanHalfWidth:1/p[0],tanHalfHeight:1/p[5],width:Math.max(1,canvas.clientWidth),height:Math.max(1,canvas.clientHeight),fov:render.fov};},movingFog=new NativeMovingFog(render.scene),birdsMesh=new NativeBirdsMesh(render.scene);
  /** CCoronas for the world's 2d effect lights, and the frame clock their flashing reads. */
  const coronaReflections=new NativeCoronaReflections(render.scene);let coronaReflectionCandidates=0;
  const coronaFlaresMesh=new NativeCoronaFlaresMesh(render.scene),flareRaster=new Vector2(),flareRay=new Vector3();let flareSun:[number,number]|null=null;
  const coronas=new NativeCoronas(),worldCoronas=new NativeWorldCoronas(render.scene),lightPools=new NativeLightPools(render.scene);let coronaFrame=0,coronaElapsed=0,volumetricCloudElapsed=0,escalatorElapsed=0,escalatorVersion=-1,escalatorScene:unknown,poolScene:unknown;
  /** C3dMarkers and its diamond_3 instances; `debugMarkers` are cones a test places every frame. */
  const markers3d=new Native3dMarkers(),markersMesh=new Native3dMarkersMesh(render.scene),debugMarkers:[number,number,number][]=[];
  /** FindPlayerCoors for CCheckpoints, in native axes. */
  const checkpointPlayer=():[number,number,number]=>{const p=sim.player.position;return [p.x,-p.z,p.y];};
  /** The fixed collision's height under a native point, looking down from it; nothing where none has streamed in. */
  const markerGround=(x:number,y:number,z:number)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:z,z:-y},{x:0,y:-1,z:0}),z+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?z-hit.timeOfImpact:undefined;};
  /** CPlaneTrails' distant planes. */
  const planeTrails=new NativePlaneTrails(),trailsMesh=new NativePlaneTrailsMesh(render.scene);
  /** CBrightLights (traffic light lenses) and the sun's sea reflection. */
  const brightLights=new NativeBrightLights(),brightMesh=new NativeBrightLightsMesh(render.scene),sunReflectionMesh=new NativeSunReflection(render.scene);
  const markerFrustum=new Frustum(),markerProjection=new Matrix4(),markerSphere=new Sphere(),markerPoint=new Vector3();
  void afterStartPackage.then(()=>markersMesh.load(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));
  const jetPackView=new NativeJetPackView(),jetFlames:(ReturnType<WorldFx['entityFx']>|undefined)[]=[];
  const jetToNative=new Matrix4().makeRotationX(Math.PI/2),jetNativeMatrix=new Matrix4();
  void afterStartPackage.then(()=>jetPackView.load(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));
  /** The FX systems of the installed scene's 2d effect particles. */
  const sceneFx:{kill():void}[]=[];let fxScene:unknown,fxVersion=-1;
  let fogReduction=0;const fogReductionForward=new Vector3();
  render.lighting.nativeTimecycle = (minutes,position,lightsMult) => visionLighting(localLighting.sample(minutes,position,lightsMult,fogReduction,weather.underwaterness),weapons.vision??null);
  const sound = new AudioSystem();
  // Mission dialogue streams bank by bank as missions load their lines (audio/ScriptSpeech.ts).
  sound.useScriptSpeech(new URL(`${import.meta.env.BASE_URL}play/audio/script/`,location.href).href);
  sound.useStreamTracks(new URL(`${import.meta.env.BASE_URL}play/audio/streams/`,location.href).href);
  const ambience=new NativeAmbienceTracks(sound.ambienceTracks);
  /** TheCamera's m_fDistanceToWater and m_fHeightOfNearestWater (CWaterLevel::FindNearestWaterAndItsFlow, from
   * PreRenderWater), for the sea's ambience and the birds; and the iOS port's 30 s hold on the ambience from a cutscene
   * or beat track's preload (its PreloadCutsceneTrack's flag, against the OS clock). */
  let cameraWater={distance:1e7,height:0},cameraWaterFrame=-1,ambienceHeldUntil=-Infinity;
  // CJ's pain cries in his PAIN_A voice, as the damage, the fall and the fire say them.
  sim.onPlayerPain=context=>{sound.nativeEngine?.playerPain(context);};
  /** Each streamed window carries the same vegetation package; it is parsed once. */
  const readSceneVegetationOnce=sceneVegetationReader();
  // The sample fallback for combat sounds (banks 52 and 143) only plays without the native engine, which loads the
  // same two banks itself: fetch it only if the engine could not load, instead of downloading them twice.
  // The engine's banks (about 5 MB) are needed once play starts, not to show the menu: download them after the start
  // package has arrived instead of alongside it.
  void afterMenuReady.then(()=>sound.loadNativeAudio(new URL(`${import.meta.env.BASE_URL}play/audio/`,location.href).href)).then(loaded=>{if(!loaded)void sound.loadNativeCombat(new URL(`${import.meta.env.BASE_URL}play/audio/`,location.href).href);
   // The radio waits while a beat track holds the stream (GetBeatTrackStatus), and its name shows when it comes back;
   // it starts as the ambience track lets it (CAERadioTrackManager::StartRadio).
   const engine=sound.nativeEngine;if(engine){engine.beatTrackStatus=()=>mission?.runtime.game.cutsceneTrack.reportedStatus??0;engine.onRadioName=label=>hud.radioName(label);engine.ambience=ambience;}});
  const hornInput=new NativeHornInput();sound.setPlayer(()=>({...sim.player.position,y:sim.player.position.y+1}));
  sound.reset(sim);
  // Open the (suspended) output device while the menu waits, not inside the click that starts play.
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>sound.prepare(),{timeout:4000});else setTimeout(()=>sound.prepare(),1000);
  if(navigation)navigation.onToggle=open=>{input.clear();sound.setPlaying(!paused&&!open);if(open)releaseLockForOverlay();};
  if(navigation){navigation.canOpen=()=>!paused&&!arsenal.open&&!(mission?.runtime.game.widescreenOn&&!mission.runtime.game.allowPauseInWidescreen);navigation.onLetter=letter=>input.onLetter?.(letter);}
  hud.bindAudio(sound.settings, settings => sound.setSettings(settings));
  // The PC original's frame limiter (on by default): display frames pace at 30 a second over the 60 Hz simulation.
  const display=readDisplaySettings(),pacer:FramePacer={lastDrawn:0};
  // The Display settings' Radar (FrontEndMenuManager.m_nRadarMode) is the HUD radar's.
  const displayChanged=(settings:DisplaySettings)=>{Object.assign(display,settings);saveDisplaySettings(display);navigation?.setRadarMode(display.radarMode);};
  hud.bindDisplay(display,displayChanged);navigation?.setRadarMode(display.radarMode);
  // A phone keeps CTimer's cap on a frame's step (not under automation, whose software rendering would slow every
  // run's world against the specs' real-time waits); a desktop, which keeps up, the browser's catch-up.
  const clock = new FixedClock(touchScreen&&!navigator.webdriver?NATIVE_MAX_FRAME_SECONDS:undefined);
  let paused = true, started = false, last = performance.now(), elapsed = 0, frame = 0, alive = true;
  /** One faulting population system must not freeze the frame: its step is skipped, the fault logged once per
   * message and counted for the dev state, and the player, world and renderer keep running. */
  const subsystemFaults=new Map<string,number>();
  /** Cumulative milliseconds per frame-loop section, for the dev state (divide by frames for averages). */
  const frameProfile={frames:0,population:0,steps:0,stepTraffic:0,stepPeds:0,stepPlayer:0,between:0,render:0};
  const guard=(name:string,run:()=>void)=>{try{run();}catch(error){const message=`${name}: ${error instanceof Error?error.message:String(error)}`;const count=(subsystemFaults.get(message)??0)+1;subsystemFaults.set(message,count);if(count===1)console.error(`Subsystem fault (further repeats are counted, not logged): ${message}`,error);}};
  /** `?perf=1` overlay: frame EMA + renderer counters at 2Hz, no per-frame DOM cost. */
  const perfOverlay = new URLSearchParams(location.search).has('perf') ? (()=>{const el=document.createElement('div');el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;background:rgba(0,0,0,.65);color:#0f0;font:11px/1.4 monospace;padding:6px 8px;border-radius:4px;pointer-events:none;white-space:pre';document.body.append(el);return el;})() : undefined;
  let perfFrameMs = 0, perfLastUpdate = 0;
  /** Post-step ground sample reused for the next tick's sprint gate (1 tick stale, 16ms); audio uses the fresh sample. Halves foot raycasts. */
  let lastGround: ReturnType<typeof import('./simulation/nativeContactLighting').sampleNativeGroundLighting> | undefined;
  let localObjectDefs:ReadonlyMap<string,import('./assets/objectData').ObjectDataRecord>|undefined;
  const defaultObjectDefs=(async()=>{
   await afterStartPackage;
   try{
    const [{openStaticWorld},{readObjectData,indexObjectData}]=await Promise.all([import('./assets/staticWorldArchive'),import('./assets/objectData')]);
    const source=await openStaticWorld(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
    const found=source.manifest.resources.find(r=>r.path==='object.dat');
    if(!found||!alive)return undefined;
    return indexObjectData(readObjectData(await (await source.resource(found)).text()));
   }catch{return undefined;}
  })();
  void defaultObjectDefs.then(defs=>{if(alive&&defs&&!localObjectDefs)importedScene?.setObjectData(defs);});
  let resolvedObjectDefs:ReadonlyMap<string,import('./assets/objectData').ObjectDataRecord>|undefined;
  void defaultObjectDefs.then(defs=>{resolvedObjectDefs=defs;});
  /** CObject health per placed prop collider. A prop reinstalled after streaming starts over, as a recreated CObject does. */
  const propStates=new Map<number,NativeObjectState>();
  /** Placements smashed or uprooted in the current streaming window, by model and position.
   * A window replacement rebuilds their colliders, so smashed ones are removed again and
   * uprooted ones return to their last pose; one that streamed out is forgotten, as SA
   * recreates the object when its area streams back in. */
  const smashedPlacements=new Set<string>();
  const movedPlacements=new Map<string,{translation:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number};physics:Omit<import('./simulation/nativeScene').UprootPhysics,'linvel'|'angvel'>}>();
  /** IS_CAR_IN_AIR_PROPER's GetCollidingEntities test: the body touches a building (the fixed world that is not an
   * OBJECT.DAT dummy or object) or another vehicle. */
  const isVehicleBody=(handle:number)=>[...(fleet?.cars??[])].some(c=>c.car.body.handle===handle)||worldCar?.car.body.handle===handle||
    [...(fleet?.bikes??[]),...(fleet?.boats??[]),...(fleet?.planes??[])].some(v=>v.body.handle===handle);
  // IS_CAR_IN_AIR_PROPER also counts the wheels: AddCollisionRecord takes the entity a wheel line rests on (the road
  // is a building), so a car on its wheels is never in the air (the callers test the wheels first).
  const touchesBuildingOrVehicle=(body:import('@dimforge/rapier3d-compat').RigidBody)=>{
    let touching=false;
    for(let i=0;i<body.numColliders()&&!touching;i++){const collider=body.collider(i);sim.world.contactPairsWith(collider,other=>{
      if(touching||other.isSensor()||other.handle===sim.playerCollider.handle)return;const owner=other.parent();if(!owner||owner.handle===body.handle)return;
      let contact=false;sim.world.contactPair(collider,other,m=>{if(m.numSolverContacts()||m.numContacts())contact=true;});if(!contact)return;
      const kind=importedScene?.sources.get(other.handle)?.entityKind;
      if(owner.isFixed()&&kind!=='dummy'&&kind!=='object')touching=true;
      else if(!owner.isFixed()&&isVehicleBody(owner.handle))touching=true;
    });}
    return touching;
  };
  /** How close two collisions count as touching for CPhysical's collision records, kept for the frame's contacts: a
   * resting contact sits within this of the surface, and a ped's character controller stops a few centimetres short of
   * what it walks into where the game's ped would press against it. */
  const TOUCH_MARGIN=.1;
  /** The solid colliders of an entity a touching question names. */
  const touchColliders=(e:import('./simulation/ScmMission').ScmTouchEntity)=>{
    type Bodied={car?:{body?:import('@dimforge/rapier3d-compat').RigidBody};body?:import('@dimforge/rapier3d-compat').RigidBody};
    const body=e.kind==='player'?sim.playerBody:e.kind==='object'?scriptObjectViews?.bodyOf(e.handle):e.kind==='ped'?onFoot(e.entity)?.body:(e.entity as Bodied)?.car?.body??(e.entity as Bodied)?.body;
    const out:import('@dimforge/rapier3d-compat').Collider[]=[];
    if(body)for(let i=0;i<body.numColliders();i++){const c=body.collider(i);if(!c.isSensor()&&c.isEnabled())out.push(c);}
    return out;
  };
  /** Whether any collider of one touches any of the other: a contact the narrow phase already has, else the shapes
   * within TOUCH_MARGIN (a kinematic pair, a ped against a script object, makes no contact pair). */
  const collidersTouch=(a:readonly import('@dimforge/rapier3d-compat').Collider[],b:readonly import('@dimforge/rapier3d-compat').Collider[])=>{
    for(const ca of a)for(const cb of b){
      if(ca.handle===cb.handle)continue;
      let hit=false;sim.world.contactPair(ca,cb,m=>{if(m.numContacts()>0)hit=true;});if(hit)return true;
      try{if(ca.contactCollider(cb,TOUCH_MARGIN))return true;}catch{/* a shape pair Rapier has no contact query for (two meshes) */}
    }
    return false;
  };
  const placementKey=(model:string,[x,y,z]:readonly number[])=>`${model.toLowerCase()}:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`;
  /** Placements whose object has m_bRenderDamaged (or has gone), by lowercased model: their lights stay off. */
  const damagedLights=new Map<string,[number,number,number][]>();
  // Each broken lamp is recorded once: a damaged prop is hit again and again (every bullet, every frame a car leans on
  // it), and a list growing with each hit made every frame's lit-placement check slower over a long session.
  const markLightDamaged=(model:string,position:readonly number[])=>{const key=model.toLowerCase(),list=damagedLights.get(key)??[];if(list.some(p=>Math.abs(p[0]-position[0])<.05&&Math.abs(p[1]-position[1])<.05&&Math.abs(p[2]-position[2])<.05))return;list.push([position[0],position[1],position[2]]);damagedLights.set(key,list);};
  const lightIsDamaged=(model:string|undefined,m:readonly number[])=>!!model&&!!damagedLights.get(model)?.some(p=>Math.abs(p[0]-m[12])<.05&&Math.abs(p[1]-m[13])<.05&&Math.abs(p[2]-m[14])<.05);
  /** The map objects a script hid (SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE) or took the collision off
   * (SET_USES_COLLISION_OF_CLOSEST_OBJECT_OF_TYPE), by placement key, applied again to every window that streams them in. */
  const hiddenPlacements=new Set<string>(),solidlessPlacements=new Set<string>();
  /** SORT_OUT_OBJECT_COLLISION_WITH_CAR: a script object's m_pEntityIgnoredCollision on a car, by object handle. */
  const sortedOutCollisions=new Map<number,{car:ScriptCar;pairs:string[];colliders:number[]}>();
  const pairKey=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
  const dropSortedOut=(handle:number)=>{
    const entry=sortedOutCollisions.get(handle);if(!entry)return;
    sortedOutCollisions.delete(handle);for(const pair of entry.pairs)sim.ignoredBodyPairs.delete(pair);
    for(const h of entry.colliders)sim.world.getCollider(h)?.setActiveHooks(RAPIER.ActiveHooks.NONE);
  };
  /** CPhysical::ProcessCollisionSectorList lets go of the ignored entity once the two bounding spheres no longer
   * touch (or either is gone). */
  const releaseSortedOutCollisions=()=>{
    for(const [handle,entry] of sortedOutCollisions){
     const body=scriptObjectViews?.bodyOf(handle),car=entry.car;
     if(!body?.isValid()||car.disposed||!car.car.body.isValid()){dropSortedOut(handle);continue;}
     const a=body.translation(),b=car.car.body.translation(),n=car.nativeBody,carRadius=Math.hypot(n.boundsMax.x-n.boundsMin.x,n.boundsMax.y-n.boundsMin.y,n.boundsMax.z-n.boundsMin.z)/2;
     if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>=(scriptObjectViews?.boundsRadius(handle)??0)+carRadius)dropSortedOut(handle);
    }
  };
  const reapplySmashedProps=(scene:NonNullable<typeof importedScene>)=>{
    if(hiddenPlacements.size||solidlessPlacements.size)for(const [handle,source] of scene.sources){
      if(!source.placement)continue;
      const key=placementKey(source.modelName,source.placement.position);
      if(hiddenPlacements.has(key))scene.setPlacementHidden(handle,true);
      if(solidlessPlacements.has(key))scene.setPlacementCollision(handle,false);
    }
    if(!smashedPlacements.size&&!movedPlacements.size)return;
    const present=new Set<string>();
    for(const [handle,source] of [...scene.sources]){
      if(!source.placement)continue;
      const key=placementKey(source.modelName,source.placement.position);
      if(smashedPlacements.has(key)){present.add(key);scene.removePlacement(handle);continue;}
      const moved=movedPlacements.get(key);if(!moved)continue;
      present.add(key);
      const body=sim.world.getCollider(handle)?.parent();
      if(body&&!body.isDynamic()&&scene.uprootPlacement(handle,{...moved.physics,linvel:{x:0,y:0,z:0},angvel:{x:0,y:0,z:0}})){body.setTranslation(moved.translation,true);body.setRotation(moved.rotation,true);}
    }
    for(const key of smashedPlacements)if(!present.has(key))smashedPlacements.delete(key);
    for(const key of movedPlacements.keys())if(!present.has(key))movedPlacements.delete(key);
  };
  /** Keep uprooted visuals on their bodies and remember their poses for window replacements. */
  const syncMovedProps=()=>{
    const scene=importedScene;if(!scene)return;
    for(const pose of scene.syncMoving()){
      const source=scene.sources.get(pose.handle);if(!source?.placement)continue;
      const moved=movedPlacements.get(placementKey(source.modelName,source.placement.position));
      if(moved){moved.translation=pose.translation;moved.rotation=pose.rotation;}
      // CObject::Init's bIsLampPost (the street and traffic lights, and any model that sways in the wind, IDE flags
      // 0x800 and 0x1000): once it leans past GetUp().z < 0.66, cars pass through it.
      const q=pose.rotation,upY=1-2*(q.x*q.x+q.z*q.z);
      if(upY<.66&&!fallenLampPosts.has(pose.handle)&&isLampPost(source.modelName,scene.placementInfo(pose.handle)?.part.definition?.flags??0)){
        fallenLampPosts.add(pose.handle);
        const body=sim.world.getCollider(pose.handle)?.parent();if(body)for(let i=0;i<body.numColliders();i++)body.collider(i).setSolverGroups(FALLEN_LAMPPOST_SOLVER_GROUPS);
      }
      // CVehicle::SpecialEntityPreCollisionStuff: a car over a loose prop it cannot smash, under a unit on every axis of
      // its bounds, ignores the collision (the prop is under it); the pair is filtered for as long as that holds.
      const record=(localObjectDefs??resolvedObjectDefs)?.get(source.modelName.toLowerCase()),bounds=scene.placementInfo(pose.handle)?.part.collision?.bounds,propBody=sim.world.getCollider(pose.handle)?.parent();
      if(record&&bounds&&propBody&&fleet){
       const effect=record.values.collisionDamageEffect??0,size=[bounds.max[0]-bounds.min[0],bounds.max[1]-bounds.min[1],bounds.max[2]-bounds.min[2]] as const;
       for(const car of fleet.cars){
        if(car.disposed)continue;const b=car.car.body,cp=b.translation();
        const key=b.handle<propBody.handle?`${b.handle}:${propBody.handle}`:`${propBody.handle}:${b.handle}`;
        const near=Math.hypot(cp.x-pose.translation.x,cp.y-pose.translation.y,cp.z-pose.translation.z)<car.boundRadius+2;
        if(near&&carRollsOverProp({position:cp,rotation:b.rotation()},{position:pose.translation,rotation:pose.rotation,effect,boundsMax:bounds.max,boundsSize:size})){sim.ignoredBodyPairs.add(key);rolledOverPairs.add(key);}
        else if(rolledOverPairs.delete(key))sim.ignoredBodyPairs.delete(key);
       }
      }
    }
  };
  const fallenLampPosts=new Set<number>();
  /** The car and prop body pairs SpecialEntityPreCollisionStuff has filtered this frame. */
  const rolledOverPairs=new Set<string>();
  const LAMP_POST_MODELS=new Set(['mtraffic1','vgsstriptlights1','mtraffic2','lamppost1','lamppost2','lamppost3','doublestreetlght1','mlamppost']);
  const isLampPost=(model:string,flags:number)=>LAMP_POST_MODELS.has(model.toLowerCase())||(flags&0x1800)!==0;
  /** Collider handles are never reused (Rapier encodes a generation), so the states of colliders a window swap
   * retired would stay for the rest of the session: keep only those the installed window still owns. */
  const prunePropStates=(scene:NonNullable<typeof importedScene>)=>{
    for(const handle of propStates.keys())if(!scene.sources.has(handle))propStates.delete(handle);
    for(const handle of glassStates.keys())if(!scene.sources.has(handle))glassStates.delete(handle);
  };
  /** The last props removed by collisions, newest last, for the dev probe. */
  const smashedProps:{model:string;position:number[]}[]=[];
  /** OBJECT.DAT props a car can damage through CPhysical::ApplyCollision's static-object branch. */
  const scenePropFor:NonNullable<ScriptCar['propFor']>=other=>{
    const scene=importedScene,source=scene?.sources.get(other.handle),record=source&&(localObjectDefs??resolvedObjectDefs)?.get(source.modelName.toLowerCase());
    if(!scene||!record)return undefined;
    const values=record.values,effect=values.collisionDamageEffect??0,uprootLimit=values.uprootLimit??0,mass=values.mass??99999;
    // Neither damageable nor movable: an ordinary wall to ApplyCollision.
    if(!effect&&(mass>=99998||uprootLimit>=9999))return undefined;
    let state=propStates.get(other.handle);
    if(!state||(state.destroyed&&other.parent()?.isEnabled()))propStates.set(other.handle,state=newObjectState());
    // CPhysical::ApplyAirResistance above 0.1 scales speed by airResistance per 1/50 s frame.
    const air=values.airResistance??.99,damping=air>.1&&air<1?-50*Math.log(air):0;
    const physics={mass,turnMass:values.turnMass??mass,elasticity:values.elasticity??0,damping};
    const colBounds=scene.placementInfo(other.handle)?.part.collision?.bounds,boundsSize=colBounds?[colBounds.max[0]-colBounds.min[0],colBounds.max[1]-colBounds.min[1],colBounds.max[2]-colBounds.min[2]] as const:undefined;
    /* CObject::TryToExplode and Explode (0x5A1340): the blast half a unit above the prop; a breakable prop then takes
     * ObjectDamage(10000) from a unit below it, and any other that takes collision force (mass under 99998) jumps 0.5
     * units a frame upward (25 m/s) and up to 0.0256 either way across, coming loose if it was fixed. From then on
     * CObject::ProcessControl hides it on a 1-in-32 roll each game frame (explodedProps). */
    const tryToExplode=()=>{
      if(!values.causesExplosion||state.exploded)return false;
      state.exploded=true;
      const [x,y,z]=source.placement?.position??[0,0,0],body=other.parent(),at=body?.isDynamic()?body.translation():{x,y:z,z:-y};
      weapons.objectExplosion(at);
      if(effect===COL_DAMAGE_EFFECT.breakable||effect===COL_DAMAGE_EFFECT.breakableRemoved)
        prop.damaged({result:objectDamage(state,10000,effect,values.collisionDamageMultiplier??1),damage:10000,point:{...at,y:at.y-1},normal:{x:0,y:1,z:0}});
      else if(mass<99998&&body){
        const kick={x:(Math.random()*2-1)*.0256*50,y:.5*50,z:-(Math.random()*2-1)*.0256*50};
        if(body.isDynamic()){const v=body.linvel();body.setLinvel({x:v.x+kick.x,y:v.y+kick.y,z:v.z+kick.z},true);}
        else prop.uproot(kick,{x:0,y:0,z:0},'explosion');
      }
      explodedProps.add(other.handle);
      // Explode's last step: an object whose FX plays on destruction plays it at its rotated offset (the reversed code
      // adds the position twice, as in ObjectDamage).
      if(record.effectName&&(values.fxType??0)===OBJECT_FX.playOnDestroyed){
       const q=source.placement?.rotation??[0,0,0,1],v=new Vector3(values.fxOffsetX??0,values.fxOffsetY??0,values.fxOffsetZ??0).applyQuaternion(new Quaternion(-q[0],-q[1],-q[2],q[3]).normalize());
       worldFx.objectFx(record.effectName,[x+v.x,y+v.y,z+v.z]);
      }
      return true;
    };
    const prop:NonNullable<ReturnType<NonNullable<ScriptCar['propFor']>>>={tryToExplode,effect,colDamageMultiplier:values.collisionDamageMultiplier??1,uprootLimit,mass,
      lampPost:isLampPost(source.modelName,scene.placementInfo(other.handle)?.part.definition?.flags??0),boundsSize,turnMass:physics.turnMass,elasticity:physics.elasticity,state,
    uproot:(linvel,angvel,cause='collision')=>{
      if(!source.placement||!scene.uprootPlacement(other.handle,{...physics,linvel,angvel}))return false;
      // CPhysical::ApplyCollision's static-object branch and CWorld::TriggerExplosionSectorList as a prop comes loose:
      // a fire hydrant bursts (Fx_c::TriggerWaterHydrant, unreversed: the water_hydrant system at its base, pointing
      // up), a parking meter knocked loose by a collision drops CreateSomeMoney(rand % 100), and any other prop that
      // does not cause explosions is marked exploded. Each happens once, on bIsExploded.
      {const model=source.modelName.toLowerCase(),[x,y,z]=source.placement.position;
       if(model==='fire_hydrant'&&!state.exploded){worldFx.objectFx('water_hydrant',[x,y,z],[0,0,1]);state.exploded=true;}
       else if(cause==='collision'&&(model==='parkingmeter'||model==='parkingmeterg')&&!state.exploded){moneyDrops.drop({x,y:z,z:-y},Math.floor(Math.random()*32768)%100);state.exploded=true;}
       else if(!values.causesExplosion)state.exploded=true;}
      const t=other.parent()!.translation(),r=other.parent()!.rotation();
      movedPlacements.set(placementKey(source.modelName,source.placement.position),{translation:{x:t.x,y:t.y,z:t.z},rotation:{x:r.x,y:r.y,z:r.z,w:r.w},physics});
      return true;
    },
    damaged:({result,damage,point,normal})=>{
      const [x,y,z]=source.placement?.position??[0,0,0];
      if(state.renderDamaged||result.removed)markLightDamaged(source.modelName,[x,y,z]);
      let exploded=false;
      if(result.removed){
        // CObject::ObjectDamage hands breakable objects to g_breakMan before turning their collision off.
        const breakable=effect===COL_DAMAGE_EFFECT.breakable||effect===COL_DAMAGE_EFFECT.breakableRemoved;
        const removed=scene.removePlacement(other.handle);if(!removed)return;
        smashedProps.push({model:source.modelName,position:[x,y,z]});if(smashedProps.length>64)smashedProps.shift();smashedPlacements.add(placementKey(source.modelName,[x,y,z]));movedPlacements.delete(placementKey(source.modelName,[x,y,z]));
        if(breakable&&source.placement)breakPlacement(source.placement,removed.part,damage*(values.collisionDamageMultiplier??1)>(values.smashMultiplier??0)*150,values);
        // CAudioEngine::ReportObjectDestruction reads the first sphere, box or triangle surface.
        const parts=removed.sources,first=parts.find(p=>p.kind==='sphere')??parts.find(p=>p.kind==='box')??parts.find(p=>p.kind==='mesh');
        sound.nativeEngine?.collisions.reportObjectDestruction({x,y,z},!first?undefined:first.kind==='mesh'?first.mesh.materials[0]:first.surface.material);
      }
      // CObject::TryToExplode: OBJECT.DAT's causes-explosion props (petrol pumps, barrels) blow up once.
      if(result.destroyed&&tryToExplode())exploded=true;
      if(!record.effectName||!objectDamagePlaysFx(values.fxType??0,damage,result.destroyed,exploded))return;
      // An X offset below -500 plays at the hit point along the normal (Fx_c::CreateMatFromVec); otherwise at the
      // object's rotated offset. The reversed code adds the position twice there, which would place it far away.
      const offset:[number,number,number]=[values.fxOffsetX??0,values.fxOffsetY??0,values.fxOffsetZ??0];
      if(offset[0]<-500)worldFx.objectFx(record.effectName,[point.x,-point.z,point.y],[normal.x,-normal.z,normal.y]);
      else{const q=source.placement?.rotation??[0,0,0,1],v=new Vector3(...offset).applyQuaternion(new Quaternion(-q[0],-q[1],-q[2],q[3]).normalize());worldFx.objectFx(record.effectName,[x+v.x,y+v.y,z+v.z]);}
    }};
    return prop;
  };
  /** Exploded causes-explosion props still in the world, which CObject::ProcessControl hides on a 1-in-32 roll. */
  const explodedProps=new Set<number>();
  const hideExplodedProps=()=>{for(const handle of explodedProps)if(Math.floor(Math.random()*32768)%32===10){explodedProps.delete(handle);importedScene?.removePlacement(handle);}};
  /** BreakManager_c: pieces of broken OBJECT.DAT props. */
  const breakManager=new NativeBreakManager(),breakPieces=new BreakPieces(render.scene);
  // CGlass: the world's glass windows crack and shatter into falling panes.
  const glass=new GlassPanes(),glassStates=new Map<number,GlassState>(),glassView=new GlassPanesView(render.scene);let glassTextured=false;
  const glassWindowAt=(handle:number)=>{
    const info=importedScene?.placementInfo(handle);if(!info||!isGlassDefinition(info.part.definition?.flags))return undefined;
    // CGlass::IsObjectGlass wants a CObject: a glass-flagged model without an OBJECT.DAT entry loads as a CBuilding.
    if(importedScene?.sources.get(handle)?.entityKind==='building')return undefined;
    let state=glassStates.get(handle);if(!state){state=newGlassState();glassStates.set(handle,state);}
    return {info,state};
  };
  /** CGlass::WindowRespondsToCollision for the placement behind `handle` (native move speed and point). */
  const breakWindow=(handle:number,damageIntensity:number,moveSpeed:[number,number,number],point:[number,number,number],max1Section:boolean)=>{
    const window=glassWindowAt(handle);if(!window||window.state.brokenAltogether)return false;
    const {info}=window,mesh=info.part.collision?.mesh,m=nativePlacementMatrix(info.placement).elements;
    const transform=(v:[number,number,number]):[number,number,number]=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
    const vertices:[number,number,number][]=[];if(mesh)for(let i=0;i<Math.min(4,mesh.positions.length/3);i++)vertices.push([mesh.positions[i*3],mesh.positions[i*3+1],mesh.positions[i*3+2]]);
    const frame=mesh&&mesh.indices.length===6?windowFrame(vertices,transform):undefined;
    const base=frame?frame.vert0:transform([0,0,0]);
    const hit=sim.world.castRay(new RAPIER.Ray({x:base[0],y:base[2]+.5,z:-base[1]},{x:0,y:-1,z:0}),60,true,RAPIER.QueryFilterFlags.ONLY_FIXED,undefined,undefined,undefined,c=>c.handle!==handle);
    const groundZ=hit?base[2]+.5-hit.timeOfImpact:base[2]-2;
    if(!windowRespondsToCollision(window.state,glass,frame,damageIntensity,moveSpeed,point,max1Section,gameTimeMs,groundZ))return false;
    importedScene?.removePlacement(handle);
    sound.nativeEngine?.collisions?.reportGlassCollisionEvent('breakFast',{x:base[0],y:base[1],z:base[2]});
    return true;
  };
  let explodedClock=0,breakClock=0,glassClock=0,glassShown=false,weatherClock=0,weatherFrame=0,statFrameClock=0;
  /** CBirds, stepped on CTimer's 30 fps frames like the break pieces. */
  const birds=new NativeBirds();let birdClock=0,birdFrame=0,streakClock=0;
  let lastBulletLine:[{x:number;y:number;z:number},{x:number;y:number;z:number}]|undefined;
  weapons.onBulletLine=(a,b)=>{lastBulletLine=[{...a},{...b}];birds.handleGunShot([a.x,-a.z,a.y],[b.x,-b.z,b.y]);};
  /** CBulletTraces, and the whizz of a bullet passing near the camera (PlayFrontEndSoundForTrace). */
  // TheCamera.GetMatrix().GetRight() is CrossProduct(up, front), which points to the screen's left.
  const bulletTraces=new NativeBulletTraces(()=>{const m=render.camera.matrixWorld.elements;return {position:{x:m[12],y:m[13],z:m[14]},right:{x:-m[0],y:-m[1],z:-m[2]},up:{x:m[4],y:m[5],z:m[6]},forward:{x:-m[8],y:-m[9],z:-m[10]}};},
    (event,volume)=>sound.frontend(event,volume)),bulletTracesMesh=new NativeImmediateTriangles(render.scene,16*12,'Native bullet traces',6.3,false),headlightBeams=new HeadlightBeams(render.scene),carLightPoolsTwin=new NativeLightPools(render.scene),pedShadows=new NativeLightPools(render.scene,{blend:'alpha',name:'Native ped shadows',renderOrder:5.1}),scorchShadows=new NativeLightPools(render.scene,{blend:'alpha',name:'Native scorch marks',renderOrder:5.05}),scorches=new NativePermanentShadows(),extraCarShadows=new NativeLightPools(render.scene,{blend:'alpha',name:'Native extra player shadows',renderOrder:5.1}),carLightPoolsSingle=new NativeLightPools(render.scene);
  bulletTraces.clock=()=>gameTimeMs;
  /** CMotionBlurStreaks behind thrown grenades and molotovs; fogged with the sky's bottom colour. */
  const streaks=new NativeMotionBlurStreaks(),streaksMesh=new NativeImmediateTriangles(render.scene,4*12,'Native motion blur streaks',6.25,true);
  const waterCannonMesh=new NativeImmediateTriangles(render.scene,31*18,'Native water cannon',6.28,true);
  const npcCannonMesh=new NativeImmediateTriangles(render.scene,2*31*18,'Native fire engine water cannons',6.28,true);
  // CShinyTexts: the pedestrian walk / don't-walk signs on traffic light poles.
  // MAX_SHINYTEXTS: 32 a frame; further registrations are dropped.
  const shinyTexts=new NativeShinyTexts(render.scene,32);
  /** CSetPieces from the INITIAL mission; each request is generated here and reported back. */
  let setPieces:NativeSetPieces|undefined,setPieceClock=0,setPieceFrame=0,setPieceAttempts=0,setPieceError='';
  const generateSetPiece=async(request:SetPieceRequest)=>{
    let success=false;setPieceAttempts++;
    try{
      if(request.kind==='cars'){
        const cars:ScriptCar[]=[];
        for(const piece of request.cars){const car=await police?.spawnSetPieceCar(piece);if(car)cars.push(car);else if(request.together)break;}
        if(request.together&&cars.length<request.cars.length)for(const car of cars)police?.removeSetPieceCar(car);
        else success=cars.length>0;
      }else{
        // CSetPiece::TryToGenerateCopPed: a CCopPed of the level on the ground at the spawn point, facing its target, under
        // CTaskComplexBeCop with a CTaskComplexGoToPointAndStandStill (run) to the target. CTaskComplexWanderCop runs
        // that go-to only while ShouldPursuePlayer is false (a clean wanted level); otherwise the pursuit starts at once.
        const p=sim.player.position,level=Math.max(0,Math.min(3,nativeLevelAt([p.x,-p.z,p.y])));
        let spawned=0;
        for(const cop of request.cops){
          const x=cop.spawn[0],z=-cop.spawn[1],ground=sim.world.castRay(new RAPIER.Ray({x,y:p.y+60,z},{x:0,y:-1,z:0}),160,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
          if(!ground){if(request.together)break;continue;}
          // CSetPieces' cops cull extra far away.
          const id=await pedestrians?.spawnOfficer(DEFAULT_COP_MODEL[level],22,{x,y:p.y+60-ground.timeOfImpact,z},Math.atan2(cop.target[0]-cop.spawn[0],-(cop.target[1]-cop.spawn[1])),undefined,60,true);
          if(typeof id==='number'&&law.level===0)pedestrians?.sendOfficer(id,{x:cop.target[0],z:-cop.target[1]},false,.5);
          spawned++;
        }
        success=request.together?spawned===request.cops.length:spawned>0;
      }
    }catch(error){setPieceError=String(error);}finally{setPieces?.generated(request.piece,success,gameTimeMs);}
  };
  /** The entities scripts' mission audio reports were made at, by kind and handle (NativeScriptAudio's physicals). */
  const missionAudioEntities=new Map<string,import('./audio/native/NativeSound').NativePhysicalEntity>();
  /** CTagManager, from the world's IPLs once the world worker is ready. */
  let tagManager:NativeTagManager|undefined,tagScene:unknown;
  weapons.onSprayPaint=(point,radius)=>{if(!tagManager)return undefined;const state=tagManager.sprayPaint(point,radius,(key,alpha,message)=>{
    importedScene?.setTagAlpha(key,alpha);progression.tags=tagManager!.saved();
    // CGarages::TriggerMessage("TAG_ONE"/"TAG_ALL") for 5 s, not in widescreen, with the counts put in its ~1~s.
    if(message&&!mission?.runtime.game.widescreenOn){if(message.message==='TAG_ALL')triggerGarageMessage('TAG_ALL',-1,-1);else triggerGarageMessage('TAG_ONE',message.tagged,message.total);}
  });return {state,direction:tagManager.sprayDirection};};
  weapons.onSprayPainted=()=>sound.frontend(AE_FRONTEND.partMissionComplete);
  weapons.onTrace=(from,to,source)=>{
    // FireOneInstantHitRound's aircraft-gun streak.
    if(source==='aircraft'){bulletTraces.addTrace(from,to,.02,750,150);return;}
    // The first-person camera modes leave no trace of the player's shots while he moves under 0.05 units a frame.
    const still=source==='player'&&!!render.firstPerson&&Math.hypot(sim.player.speed,sim.player.verticalSpeed)<.05*50;
    bulletTraces.addWeaponTrace(from,to,Math.random,still);
  };
  /** BreakObject_c::Init for a removed placement: its first atomic's breakable plugin, placement matrix and collision bounds. */
  const breakPlacement=(placement:import('./assets/ipl').IplInstance,part:import('./assets/scene').ScenePart,justFaces:boolean,values:import('./assets/objectData').ObjectDataRecord['values'])=>{
    const bounds=part.collision?.bounds;if(!bounds)return;
    breakModel(part.model,part.textures,bounds,nativePlacementMatrix(placement).elements,justFaces,values);
  };
  /** BreakObject_c::Init for a model at a native matrix: its first atomic's breakable plugin and its collision bounds. */
  const breakModel=(model:import('./assets/dff').DffModel,modelTextures:readonly import('./assets/modelTextures').ModelTexture[],bounds:{min:readonly [number,number,number];max:readonly [number,number,number]},m:ArrayLike<number>,justFaces:boolean,values:import('./assets/objectData').ObjectDataRecord['values'])=>{
    const atomic=model.atomics[0],info=atomic&&model.geometries[atomic.geometry]?.breakable;if(!info)return;
    const ambient=render.lighting.nativeWorldAmbient;
    const object=breakManager.add({
      info,ltm:rwMatrix([m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]],[m[12],m[13],m[14]]),
      velocity:[values.breakVelocityX??0,values.breakVelocityY??0,values.breakVelocityZ??0],velocityRandom:values.breakVelocityRandom??0,
      justFaces,sparks:!!values.sparksOnImpact,bounds:{min:[...bounds.min],max:[...bounds.max]},
      // AmbientLightColourForFrame (timecycle ambient x CCoronas::LightsMult) x 255; the static default is 32.
      ambient:ambient?[ambient[0]*255,ambient[1]*255,ambient[2]*255]:[32,32,32],
      ground:([x,y,z])=>{
        const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:z,z:-y},{x:0,y:-1,z:0}),z+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED,undefined,undefined,undefined,collider=>importedScene?.sources.get(collider.handle)?.entityKind!=='dummy');
        return hit?{z:z-hit.timeOfImpact,normal:[hit.normal.x,-hit.normal.z,hit.normal.y]}:undefined;
      },
      random:Math.random,
    });
    if(!object)return;
    const wanted=new Set(info.textures.map(name=>name.toLowerCase())),textures=new Map<string,import('three').Texture>();
    for(const texture of modelTextures)if(wanted.has(texture.name.toLowerCase())&&!textures.has(texture.name.toLowerCase()))textures.set(texture.name.toLowerCase(),nativeTexture(texture));
    breakPieces.attach(object,textures);
  };
  /** A model's OBJECT.DAT values, by id (through the IDE's dff name) or by name. */
  const objectDefValues=(model:number|string)=>{
    const name=typeof model==='number'?scriptPickupModels?.byId.get(model)?.model:model;
    return name?(localObjectDefs??resolvedObjectDefs)?.get(name.toLowerCase())?.values:undefined;
  };
  /** CWeapon::DoBulletImpact (and CBulletInfo::Update for the sniper) on a script object the player's fire hits:
   * ObjectDamage with the gun-break damage for a breakable, and the sniper's 50 on anything. The push a lighter
   * object takes is not applied: the record holds the object where the script put it. */
  const shootScriptObject=(handle:number,sniper:boolean,weapon:number)=>{
    const objects=mission?.runtime.game.objects;if(!objects?.exists(handle))return;
    const object=objects.at(handle),values=objectDefValues(object.model);
    const info={effect:object.colDamageEffect,colDamageMultiplier:object.colDamageMultiplier,uprootLimit:values?.uprootLimit??0,mass:object.mass,gunBreakMode:values?.gunBreakMode,smashMultiplier:object.smashMultiplier};
    const damages=sniper?sniperHitsObject(info,object.isStatic).damages:[bulletHitsObject(info,object.isStatic,false).damage].filter((d):d is number=>d!==undefined);
    for(const damage of damages)objects.damage(handle,damage,weapon,'player');
  };
  /** CWeapon::DoBulletImpact on an OBJECT.DAT prop: a push that can unfreeze it, or ObjectDamage for breakables. */
  const shootProp=(hit:import('@dimforge/rapier3d-compat').RayColliderIntersection,point:{x:number;y:number;z:number},incremental:boolean,sniper:boolean,weapon:number)=>{
    const scriptObject=scriptObjectViews?.objectForCollider(hit.collider.handle);
    if(scriptObject!==undefined){shootScriptObject(scriptObject,sniper,weapon);return;}
    // CGlass::WasGlassHitByBullet: the first round cracks a window, later ones break it one time in four.
    const window=glassWindowAt(hit.collider.handle);
    if(window){const outcome=wasGlassHitByBullet(window.state);if(outcome==='break')breakWindow(hit.collider.handle,0,[0,0,0],[point.x,-point.z,point.y],false);return;}
    const collider=hit.collider,prop=scenePropFor(collider),body=collider.parent();if(!prop||!body||prop.state.destroyed)return;
    const record=importedScene?.sources.get(collider.handle),values=record&&(localObjectDefs??resolvedObjectDefs)?.get(record.modelName.toLowerCase())?.values;
    const normal={x:hit.normal.x,y:hit.normal.y,z:hit.normal.z};
    if(sniper){
     const out=sniperHitsObject({...prop,gunBreakMode:values?.gunBreakMode,smashMultiplier:values?.smashMultiplier},!body.isDynamic());
     if(out.unfreeze&&!prop.uproot({x:0,y:0,z:0},{x:0,y:0,z:0}))return;
     // ApplyMoveForce: speed only, no turn.
     if(out.moveForce!==undefined&&body.isDynamic())body.applyImpulse({x:normal.x*out.moveForce*50,y:normal.y*out.moveForce*50,z:normal.z*out.moveForce*50},true);
     for(const damage of out.damages){if(prop.state.destroyed)break;prop.damaged({result:objectDamage(prop.state,damage,prop.effect,prop.colDamageMultiplier),damage,point,normal});}
     return;
    }
    const out=bulletHitsObject({...prop,gunBreakMode:values?.gunBreakMode,smashMultiplier:values?.smashMultiplier},!body.isDynamic(),incremental);
    if(out.damage!==undefined){prop.damaged({result:objectDamage(prop.state,out.damage,prop.effect,prop.colDamageMultiplier),damage:out.damage,point,normal});return;}
    if(out.unfreeze&&!prop.uproot({x:0,y:0,z:0},{x:0,y:0,z:0}))return;
    // ApplyForce(normal x force) in mass x units per frame: 50 times that in kg m/s.
    if(out.force!==undefined&&body.isDynamic())body.applyImpulseAtPoint({x:normal.x*out.force*50,y:normal.y*out.force*50,z:normal.z*out.force*50},point,true);
  };
  weapons.onObjectShot=shootProp;
  /** After CTaskComplexCarSlowBeDraggedOut the player lies where the jacked clip ends, then
   * CTaskComplexFallAndGetUp: a second down and the get-up, the fall a cop can arrest in. */
  carEntry.onPlayerDraggedOut=clip=>{
    const view=render.nativeCharacter,getUp=playerFall(view,clip.key);
    view?.holdClipEnd(`dragged:${clip.key}`,clip.clip,1);
    sim.knockdown=1+getUp;sim.knockdownLie=1;sim.knockdownGetUp=playerGetUp=getUp;
  };
  /** CEventDamage on the player: ComputeDamageAnim flinches, knockdowns through CTaskComplexFallAndGetUp
   * (fall, a second on the ground, get up), and ComputeDeathAnim when the hit kills. */
  let playerHitAnimDelay=0,playerDamageAnimId=-1,playerGetUp=0,playerFallClip:string|undefined,playerStuckUnderCar=false;const playerDamageRandom=new WindowsCrtRandom(1);
  /** Records the clip the player fell with and returns the length of the get-up it calls for (CTaskSimpleGetUp). */
  const playerFall=(view:import('./render/NativeCharacter').NativeCharacter|undefined,clip:string)=>{playerFallClip=clip;return view?.reactionDuration(getUpClip(clip))??1.2;};
  // A teleport flushes the knockdown's fall and get-up: CJ stands at the destination rather than lying there.
  sim.playerInAirTask=()=>!sim.jetPack&&!!render.nativeCharacter?.jumping;
  sim.playerFallHeld=()=>playerTasks.uninterruptable;
  sim.onFlushPlayerTasks=()=>{playerGetUp=0;playerStuckUnderCar=false;playerFallClip=undefined;render.nativeCharacter?.clearReaction();};
  /** CPedPlacement::IsPositionClearOfCars at the player's origin (a unit above the feet). */
  const carOverPlayer=()=>{
    const q=sim.player.position,origin={x:q.x,y:q.y+1,z:q.z},probe=new RAPIER.Ball(GET_UP_CLEAR_RADIUS),still={x:0,y:0,z:0,w:1};
    for(const car of fleet?.cars??[]){
      if(!car.car.body.isEnabled()||car.occupied)continue;
      const c=car.car.body.translation(),reach=(car.boundRadius??Infinity)+GET_UP_CLEAR_RADIUS;
      if((c.x-origin.x)**2+(c.z-origin.z)**2>reach*reach)continue;
      for(let i=0;i<car.car.body.numColliders();i++){const collider=car.car.body.collider(i);if(!collider.isSensor()&&collider.intersectsShape(probe,origin,still))return car;}
    }
    return undefined;
  };
  const playerDamageReactions=(dt:number)=>{
    const view=render.nativeCharacter;
    if(view)view.reactionPaused=sim.knockdownStalled;
    if(sim.player.health>0&&playerDied){playerDied=false;view?.clearReaction();}
    // CTaskSimpleInAir's FALL_FALL while CJ drops, then CTaskComplexInAirAndLand's landing of it: FALL_COLLAPSE, or
    // after the fastest falls CTaskSimpleFall's KO_SKID_BACK for 700 ms and the get-up.
    if(view&&sim.player.health>0){
      if(sim.fall.falling&&!sim.player.grounded&&!sim.player.swimming&&view.hasReaction('fall_fall')&&!view.reactionName)view.playReaction('fall_fall',Infinity);
      else if(view.reactionName==='fall_fall'&&(sim.player.grounded||sim.player.swimming)&&!sim.fallLanding)view.clearReaction();
      const landing=sim.fallLanding;sim.fallLanding=undefined;
      // CTaskSimpleFall counts its 700 ms down only once the clip has finished.
      if(landing==='knockdown'&&view.hasReaction('ko_skid_back')){const fall=view.reactionDuration('ko_skid_back')??1,getUp=playerFall(view,'ko_skid_back');sim.knockdown=fall+.7+getUp;sim.knockdownLie=.7;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction('ko_skid_back',fall+.7);}
      else if(landing==='collapse'&&view.hasReaction('fall_collapse')){const d=view.reactionDuration('fall_collapse')??1;view.playReaction('fall_collapse',d);sim.knockdown=d;sim.knockdownLie=0;sim.knockdownGetUp=0;}
    }
    // A CJ killed while he lies stays down: the death sequence owns him, not the get-up.
    if(playerGetUp&&sim.knockdown<=playerGetUp&&view&&sim.player.health>0){
      // CTaskSimpleGetUp::StartAnim: a car over the origin sphere keeps CJ down (bStuckUnderCar) and runs him over for
      // the time step a frame; otherwise the get-up matching the fall clip's ANIMATION_IS_FRONT flag plays.
      if(sim.player.health>0&&getUpBlockedBy(carOverPlayer()?{bike:false,standingOn:false,attached:false}:undefined)){
        // CTaskSimpleGetUp does not start while bStuckUnderCar: the fall clip stays on its last frame. Its reaction has
        // usually just ended as the lie ran out, so it is put back held on that frame.
        playerStuckUnderCar=true;sim.knockdown=playerGetUp;sim.knockdownLie=0;
        if(playerFallClip&&view.reactionName!==playerFallClip&&view.hasReaction(playerFallClip))view.playReaction(playerFallClip,Infinity,false,view.reactionDuration(playerFallClip)??0);else view.holdReaction();if(dt>0)sim.damagePlayer(stuckUnderCarDamage(dt*50,true),false,{weapon:WEAPON.runOverByCar});
      }else{playerStuckUnderCar=false;view.playReaction(getUpClip(playerFallClip),playerGetUp,true);playerGetUp=0;}
    }
    for(const event of sim.damageEvents.splice(0)){
      if(!view)continue;
      // Weapons take GetLocalDirection toward the attacker (Weapon.cpp DoBulletImpact); a blast takes it from the blast
      // toward the victim (CWorld::TriggerExplosionSectorList's impactVelocity).
      const p=sim.player.position,away=event.weapon===WEAPON.explosion?-1:1,direction=event.from?browserLocalDirection(sim.player.heading,(event.from.x-p.x)*away,(event.from.z-p.z)*away):0;
      const moveState=sim.player.speed<.1?PEDMOVE.still:sim.player.speed<3?PEDMOVE.walk:sim.player.speed<7?PEDMOVE.run:PEDMOVE.sprint;
      const victim={player:true,inVehicle:false,moveState,fallingOrGettingUp:sim.knockdown>0,standing:sim.player.grounded,submerged:sim.player.swimming,hitAnimDelayUntil:playerHitAnimDelay,driving:false};
      if(event.died){
        playerDied=true;playerGetUp=0;playerStuckUnderCar=false;
        // ComputeDeathAnim's floor branch has no player test: CJ killed while he falls or lies (head below his root)
        // takes FLOOR_HIT, or FLOOR_HIT_F on his front.
        const lying=sim.knockdown>sim.knockdownGetUp;
        const death=computeDeathAnim({weapon:event.weapon,pedPiece:event.piece??PED_PIECE.torso,direction,health:0,damageArmour:event.armour,damageHealth:event.health,victim:{...victim,headBelowRoot:lying,lyingOnFront:lying&&isFrontClip(playerFallClip)},source:{ped:true},megaPunch:megaPunchBlow(event.weapon),nextRandom:()=>playerDamageRandom.next()});
        const clip=death.clip&&view.hasReaction(death.clip)?death.clip:'ko_shot_front';view.playReaction(clip,Infinity);
        knockPlayer(death.force,event.from);
        continue;
      }
      // CTaskSimpleFall refuses damage that leaves CJ alive, through the fall and the time lying (and the get-up waits
      // while he is stuck under a car). CTaskSimpleGetUp::MakeAbortable gives way once its clip plays: the get-up ends and
      // the hit gets its own response, so a blow as he rises flinches or floors him again.
      if(sim.knockdown>0&&(playerGetUp>0||playerStuckUnderCar))continue;
      // The get-up gives way only to a response that replaces it (HandleEvents aborts the task for one).
      const endGetUp=()=>{if(sim.knockdown>0){sim.knockdown=0;sim.knockdownGetUp=0;view.clearReaction();}};
      // WEAPON_DROWNING short of death animates nothing: the swim task or the seat refuses the event.
      if(event.weapon===WEAPON.drowning)continue;
      // CTaskComplexEnterCar (and the leave and the seat) aborts only at ABORT_PRIORITY_IMMEDIATE once past the walk to the
      // door: a damage response cannot floor or flinch CJ pinned to a door or seated (the hurt still counts).
      if(carEntry.pinned||carEntry.seated||bikeMount.pinned)continue;
      // CEventDamage::ComputeDamageAnim for a ped in any vehicle (bInVehicle) sets no animation: riding a bike, a boat, a
      // plane or a passenger seat, a hit neither flinches nor floors CJ on foot (the bike's knock-off response,
      // ComputeKnockOffBikeResponse, is unreversed).
      if(fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger||worldCar?.occupied||fleet?.occupied)continue;
      // CTaskSimpleClimb::MakeAbortable refuses any event under priority 71 while the ped lives: damage (65) cannot
      // floor or flinch a climbing CJ.
      if(sim.climb)continue;
      // CTaskSimpleSwim::MakeAbortable likewise gives way only to priority 71 or a killing blow, so ComputeDamageAnim
      // drops the fall (m_bFallDown false) and plays nothing: a swimming CJ is neither floored nor flinched.
      if(sim.player.swimming)continue;
      // CTaskSimpleJump, CTaskSimpleInAir and CTaskSimpleLand refuse an urgent abort too: ComputeDamageAnim sets
      // ANIM_ID_DOOR_LHINGE_O without the fall, so a hit on the launch, in the air or on the landing neither floors nor
      // flinches CJ (the jetpack is no jump). The tasks as they stood when the event was raised count: a blast's own lift
      // has not started the in-air task yet.
      if(event.inAirTask)continue;
      // CTaskSimpleJetPack::MakeAbortable refuses a damage event while the flier lives: no fall, no flinch on the pack.
      if(sim.jetPack&&sim.player.health>0)continue;
      // A cop's nightstick finisher (melee.dat FALL_3) floors CJ only from the front: ComputeDamageAnim's combo branch,
      // FIGHT_HIT_1 + move from the bat group with the fall (that group's Bat_Hit clips are not on CJ; the knockout
      // stands in). From another side it is an ordinary hit.
      if(event.fall&&(event.weapon!==WEAPON.nightstick||direction===0)){
        // TriggerExplosionSectorList lifts a standing ped (bIsStanding false, 4 up): it falls with the
        // blast's knockout clip for the direction and gets up.
        // A car strike (KillPedWithCar's lesser branch) falls the same way with the ramming clips.
        const blast=computeDeathAnim({weapon:event.weapon,pedPiece:PED_PIECE.torso,direction,health:0,damageArmour:0,damageHealth:event.health,victim,source:{ped:false}});
        const clip=blast.clip&&view.hasReaction(blast.clip)?blast.clip:'ko_skid_front',fall=view.reactionDuration(clip)??1,getUp=playerFall(view,clip);
        // CTaskComplexFallAndGetUp's lie: 500 ms for the player after a car or a fall (1000 for a street ped), else
        // 1000 / (shooting rate / 40).
        const lie=event.weapon===WEAPON.rammedByCar||event.weapon===WEAPON.runOverByCar||event.weapon===WEAPON.fall?.5:1;
        endGetUp();sim.knockdown=fall+lie+getUp;sim.knockdownLie=lie;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(clip,fall+lie);
        continue;
      }
      // CEventHandler::ComputeDamageResponse: past CWeaponInfo::TypeIsWeapon (type < WEAPON_LAST_WEAPON, 47) only a car's
      // ram or run-over and a fall get a response (the fall task above); a blast that leaves CJ standing plays no flinch
      // and starts no hit-animation wait, so a gunshot just after it still flinches him.
      if(event.weapon>=47)continue;
      // A street ped's fist combo hands its move to CEventDamage::ComputeAnim: the player plays HitA_1..3.
      const fight=event.fight&&{comboSet:4,currentMove:event.fight.move,comboActive:event.fight.move===2,hitComboActive:false,hitClip:(move:number)=>`hita_${move+1}`,group:'melee_1'};
      const hit=computeDamageEventAnim({weapon:event.weapon,pedPiece:event.piece??PED_PIECE.torso,direction,health:sim.player.health,damageArmour:event.armour,damageHealth:event.health,victim,source:{ped:true,fight},previousAnimId:playerDamageAnimId,nextRandom:()=>playerDamageRandom.next(),nowMs:Math.floor(elapsed*1000)});
      if(hit.hitAnimDelayUntil!==undefined)playerHitAnimDelay=hit.hitAnimDelayUntil;
      playerDamageAnimId=hit.id;
      if(!hit.clip||!view.hasReaction(hit.clip))continue;
      endGetUp();
      if(hit.fallDown){
        // Fall, lie a second, then get up; input waits for all of it.
        const fall=view.reactionDuration(hit.clip)??1,getUp=playerFall(view,hit.clip);
        sim.knockdown=fall+1+getUp;sim.knockdownLie=1;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(hit.clip,fall+1);
      }else view.playReaction(hit.clip);
      knockPlayer(hit.force,event.from);
    }
    // Deaths without a damage event (fire, drowning, a wrecked car) still leave CJ down.
    if(view&&sim.player.health<=0&&!playerDied){playerDied=true;if(view.hasReaction('ko_shot_front'))view.playReaction('ko_shot_front',Infinity);}
  };
  /** CEventDamage::ComputeDeathAnim / ComputeDamageAnim's ApplyMoveForce on the player: the force away from the source
   * (m_fMass 70, so force × 50 / 70 m/s) and 5 up, which lifts him off his feet. */
  const knockPlayer=(force:number,from:{x:number;z:number}|undefined)=>{
    if(!(force>0)||!from)return;
    const p=sim.player.position,dx=p.x-from.x,dz=p.z-from.z,l=Math.hypot(dx,dz)||1,speed=force*50/70;
    sim.collisionPush.x+=dx/l*speed;sim.collisionPush.z+=dz/l*speed;
    sim.player.verticalSpeed=Math.max(sim.player.verticalSpeed,5/70*50);sim.player.grounded=false;
  };
  /** CDarkel::RegisterKillByPlayer's stats: a cop or dealer +1.5 respect; a Grove Street member (PED_TYPE_GANG2)
   * -5 respect and one more friendly gang member killed (and a recruited one when he was in CJ's group; the gang
   * strength message that follows is not a stat DisplayScriptStatUpdateMessage shows); any other
   * gangster +0.75 respect and one more enemy gang member killed. Kills by anyone else register nothing. */
  vehicleDestroyed.report=(kind,modelId)=>{const game=mission?.runtime.game;if(!game)return;game.registerKill(modelId);game.stats.increment(kind==='boat'?123:122,1);};
  const registerKillByPlayer=(victim:{officer:boolean;gang?:number;pedType?:string;recruit?:boolean})=>{
    const stats=mission?.runtime.game.stats;if(!stats)return;
    // CDarkel::RegisterKillByPlayer counts STAT_PEOPLE_YOUVE_WASTED and STAT_KILLS_SINCE_LAST_CHECKPOINT (which a save
    // moves into STAT_TOTAL_LEGITIMATE_KILLS).
    stats.increment(121,1);stats.increment(176,1);
    if(victim.officer||victim.pedType?.toUpperCase()==='DEALER')stats.increment(68,1.5);
    if(victim.gang===1){stats.increment(240,1);stats.decrement(68,5);if(victim.recruit)stats.increment(163,1);}
    else if(victim.gang!==undefined){stats.increment(239,1);stats.increment(68,.75);}
  };
  let playerDied=false;
  /** PlayIdleAnimations' clips, timer and CPad's untouched time. */
  let playerIdleClips:Awaited<ReturnType<typeof loadPlayerIdles>>|undefined,playerIdleRefused:object|undefined,playerIdleTouches=0,playerUntouchedMs=0;const playerIdles=new PlayerIdles();
  void afterStartPackage.then(()=>loadPlayerIdles(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(clips=>{playerIdleClips=clips;}).catch(()=>{});
  sim.onHitHead=()=>{const view=render.nativeCharacter;if(!view?.hasReaction('hit_wall'))return undefined;view.playReaction('hit_wall');return view.reactionDuration('hit_wall');};
  /** CPhysical::ApplyCollision for CJ walking into OBJECT.DAT props: loose props (uproot limit
   * below 70 x the closing speed) unfreeze, and moving ones are pushed at the ten-times-mass common speed. */
  const kickSweptProps=()=>{
    const {hits,velocity}=sim.lastMove;if(!hits.length)return;
    const p=sim.player.position,seen=new Set<number>();
    for(const handle of hits){
      const collider=sim.world.getCollider(handle),body=collider?.parent();if(!collider||!body||seen.has(body.handle))continue;
      seen.add(body.handle);
      const prop=scenePropFor(collider);if(!prop||prop.state.destroyed)continue;
      const at=body.translation(),n={x:p.x-at.x,z:p.z-at.z},l=Math.hypot(n.x,n.z);if(l<1e-4)continue;
      n.x/=l;n.z/=l;
      const ov=body.linvel(),out=pedHitsObject({closing:(velocity.x*n.x+velocity.z*n.z)/50,objectSpeed:body.isDynamic()?(ov.x*n.x+ov.z*n.z)/50:0,mass:prop.mass,elasticity:prop.elasticity,uprootLimit:prop.uprootLimit,isStatic:!body.isDynamic()});
      if(out.unfreeze&&!prop.uproot({x:0,y:0,z:0},{x:0,y:0,z:0}))continue;
      // ApplyCollision's ped branch: an unfrozen prop adds 30 to 60 to STAT_COST_OF_PROPERTY_DAMAGED.
      if(out.unfreeze)mission?.runtime.game.stats.increment(STAT_COST_OF_PROPERTY_DAMAGED,30+Math.floor(Math.random()*31));
      if(out.push&&body.isDynamic()){const dv=out.push*50,v=body.linvel();body.setLinvel({x:v.x-n.x*dv,y:v.y,z:v.z-n.z*dv},true);}
    }
  };
  /** CWorld::TriggerExplosionSectorList's object pass over OBJECT.DAT props: TryToExplode,
   * unfreezing when the blast force beats the uproot limit, ObjectDamage and the push. */
  weapons.onScorch=point=>{scorches.add(explosionScorch([point.x,-point.z,point.y]),gameTimeMs);};
  // CPad::StartShake_Distance from an explosion or the player's shot: the distance to the camera decides.
  weapons.onPadShake=(time,frequency,from)=>{const c=render.camera.position;mission?.runtime.game.pads.startShakeDistance(0,time,frequency,Math.hypot(from.x-c.x,from.y-c.y,from.z-c.z));};
  weapons.onPadShakeDirect=(time,frequency)=>{mission?.runtime.game.pads.startShake(0,time,frequency,0,gameTimeMs);};
  weapons.onCamShake=(strength,from)=>{const cam=mission?.runtime.game.camera;if(!cam)return;if(from){const c=render.camera.position;cam.camShake(strength,Math.hypot(from.x-c.x,from.y-c.y,from.z-c.z),gameTimeMs);}else cam.camShakeNoPos(strength,gameTimeMs);};
  render.shake=()=>mission?.runtime.game.camera.shakeLeft(gameTimeMs)??0;
  weapons.onExplosion=(point,params,byPlayer)=>{
    // The script's objects in the blast: ObjectDamage(WEAPON_EXPLOSION) from whoever set it off, 300 x falloff for
    // one the blast frees and the falloff alone for one it leaves static. The record keeps the object in place.
    if(mission&&scriptObjectViews){
      const objects=mission.runtime.game.objects;
      for(const object of mission.scriptObjects()){
        if(!object.usesCollision||!scriptObjectViews.bodyOf(object.handle))continue;
        const falloff=explosionFalloff(params.radius,Math.hypot(object.position.x-point.x,object.position.z-point.y,-object.position.y-point.z));if(!falloff)continue;
        const values=objectDefValues(object.model),freed=!object.isStatic||explosionUnfreezes(params.force,values?.uprootLimit??0);
        objects.damage(object.handle,freed?300*falloff:falloff,51,byPlayer?'player':'other');
      }
    }
    const scene=importedScene;if(!scene)return;
    const toNative=(v:{x:number;y:number;z:number})=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:{x:number;y:number;z:number})=>({x:v.x,y:v.z,z:-v.y});
    const seen=new Set<number>();
    for(const [handle,source] of [...scene.sources]){
      if(!source.placement)continue;
      const collider=sim.world.getCollider(handle),body=collider?.parent();if(!collider||!body||!body.isEnabled()||seen.has(body.handle))continue;
      const at=body.isDynamic()?body.translation():(()=>{const [x,y,z]=source.placement!.position;return {x,y:z,z:-y};})();
      const falloff=explosionFalloff(params.radius,Math.hypot(at.x-point.x,at.y-point.y,at.z-point.z));if(!falloff)continue;
      // TriggerExplosionSectorList: a static glass object inside the blast whose uproot limit the explosion beats
      // answers with CGlass::WindowRespondsToExplosion instead of coming loose.
      const pane=glassWindowAt(handle);
      if(pane){
        seen.add(body.handle);
        const limit=(localObjectDefs??resolvedObjectDefs)?.get(source.modelName.toLowerCase())?.values.uprootLimit??0;
        if(pane.state.brokenAltogether||body.isDynamic()||!explosionUnfreezes(params.force,limit))continue;
        const blast=toNative(point),[x,y,z]=source.placement.position,response=windowRespondsToExplosion([x,y,z],[blast.x,blast.y,blast.z]);
        if(response==='crack')pane.state.hasBrokenGlass=true;
        else if(response)breakWindow(handle,response.damageIntensity,response.moveSpeed,response.point,response.max1Section);
        continue;
      }
      const prop=scenePropFor(collider);if(!prop||prop.state.destroyed)continue;
      seen.add(body.handle);
      const record=(localObjectDefs??resolvedObjectDefs)?.get(source.modelName.toLowerCase());
      // CObject::TryToExplode for causes-explosion props (petrol pumps), once.
      prop.tryToExplode?.();
      const hitPoint={x:at.x,y:at.y,z:at.z},up={x:0,y:1,z:0};
      if(!body.isDynamic()){
        // bar_barrier10 and bar_barrier12 (MI_FENCE, MI_FENCE2) always come loose.
        const fence=/^bar_barrier1[02]$/i.test(source.modelName);
        if(!fence&&!explosionUnfreezes(params.force,prop.uprootLimit)){
          // Left static: ObjectDamage(min(1, 2 (radius - distance) / radius)).
          prop.damaged({result:objectDamage(prop.state,falloff,prop.effect,prop.colDamageMultiplier),damage:falloff,point:hitPoint,normal:up});
          continue;
        }
        if(!prop.uproot({x:0,y:0,z:0},{x:0,y:0,z:0},'explosion'))continue;
      }
      const v=body.linvel(),dir=explosionDirection(toNative(point),toNative(at));
      const hit=explosionOnObject({falloff,force:params.force,direction:dir,mass:prop.mass,turnMass:prop.turnMass,moveSpeed:toNative({x:v.x/50,y:v.y/50,z:v.z/50}),boundRadius:scene.placementRadius(handle)??.5,disableCollisionForce:prop.mass>=99998});
      if(hit.move&&body.isDynamic()){
        const move=fromNative(hit.move);body.applyImpulse({x:move.x*50,y:move.y*50,z:move.z*50},true);
        // ApplyTurnForce at half the bounding radius above the centre of mass.
        const f=fromNative(hit.turn!.impulse),arm=fromNative(hit.turn!.arm);
        body.applyTorqueImpulse({x:(arm.y*f.z-arm.z*f.y)*50,y:(arm.z*f.x-arm.x*f.z)*50,z:(arm.x*f.y-arm.y*f.x)*50},true);
      }
      if(prop.state.destroyed)continue;
      prop.damaged({result:objectDamage(prop.state,hit.damage,prop.effect,prop.colDamageMultiplier),damage:hit.damage,point:hitPoint,normal:up});
    }
  };
  let loadRequest = 0;
  /** Set while the game waits for streamed terrain; cleared only when play resumes. */
  let terrainPause=false;
  /** The safety boundary hold: the simulation stands still until the window arrives, as the original hitches while
   * CStreaming catches up, but the view, the pointer lock and held keys stay; no menu opens. */
  /** Holds so far and their total length, for the dev state. */
  const terrainHolds={count:0,ms:0,last:0};let terrainHoldStart=0;
  function terrainHold(on:boolean){
    if(on===terrainPause)return;
    terrainPause=on;clock.reset();last=performance.now();
    if(on){terrainHolds.count++;terrainHoldStart=performance.now();}else if(terrainHoldStart){terrainHolds.last=performance.now()-terrainHoldStart;terrainHolds.ms+=terrainHolds.last;terrainHoldStart=0;}
    sound.setPlaying(!on&&!paused&&!navigation?.open&&!arsenal.open);
    // Offline (an installed game started without a connection), only the places downloaded before are on the device.
    if(on)hud.message(navigator.onLine===false?'No connection: the ground here loads once the connection is back.':'Loading nearby terrain…');
  }
  function menuBusy(busy: boolean) {
    hud.element.querySelectorAll<HTMLButtonElement>('.menu-actions button').forEach(button => button.disabled = busy);
  }
  // Escape closes the map, leaves the pause menu as the original's does when the game can be resumed, and otherwise pauses.
  const input = new Input(canvas, () => {
    const resume=hud.button('play');
    if(navigation?.open)navigation.toggle(false);
    // The Escape that just let a locked pointer go (and paused) is not also a request to resume.
    else if(paused&&started&&!resume.hidden&&!resume.disabled&&performance.now()-lockLostAt>300)play();
    else pause();
  });
  // A game controller, as the iOS and Android port takes one: it holds the keys (src/input/GamepadInput), the touch
  // controls stand aside once it is played and come back at a touch, and under a menu its D-pad and cross work the menu.
  const gamepad=new GamepadInput(input);let lastTouchAt=-Infinity,lastKeyAt=-Infinity;
  /** A keyboard played on a touch screen (a tablet's, or one paired with a phone): its last key the game reads, not a
   * volume or media key nor one typed into a field. While it is played the touch buttons give way to it, as to a pad. */
  let lastKeyboardAt=-Infinity,keysPlayed=false;
  const GAME_KEY=/^(Key[A-Z]|Digit|Numpad|Arrow|Space|Shift|Control|Alt|Tab|Enter|Escape|Backquote|Page|Home|End|CapsLock|Backspace|Delete|Insert)/;
  /** Keys walking while a finger looks: a drag on the right leaves the buttons away; a tap there, or any touch elsewhere,
   * brings them back. */
  let lookTouch:{id:number;x:number;y:number;moved:boolean}|undefined;
  /** Fingers on the glass and the last touch, for the screen's idle time (screenIdle). */
  let fingersDown=0,lastTouchActivityAt=performance.now();
  const onTouchStart=(e:TouchEvent)=>{fingersDown=e.touches?.length??fingersDown+1;lastTouchActivityAt=performance.now();const t=e.changedTouches?.[0];
   if(keysPlayed&&t&&(e.target as Element|null)?.closest?.('.touch-look')){lookTouch={id:t.identifier,x:t.clientX,y:t.clientY,moved:false};return;}
   lastTouchAt=performance.now();};
  const onTouchMove=(e:TouchEvent)=>{lastTouchActivityAt=performance.now();const look=lookTouch;if(!look)return;for(const t of e.changedTouches)if(t.identifier===look.id&&Math.hypot(t.clientX-look.x,t.clientY-look.y)>12)look.moved=true;};
  const onTouchEnd=(e:TouchEvent)=>{fingersDown=e.touches?.length??Math.max(0,fingersDown-1);lastTouchActivityAt=performance.now();const look=lookTouch;if(!look)return;for(const t of e.changedTouches)if(t.identifier===look.id){if(!look.moved)lastTouchAt=performance.now();lookTouch=undefined;}};
  window.addEventListener('touchstart',onTouchStart,{passive:true,capture:true});window.addEventListener('touchmove',onTouchMove,{passive:true,capture:true});
  for(const type of ['touchend','touchcancel'] as const)window.addEventListener(type,onTouchEnd,{passive:true,capture:true});
  const onKeyOrMouse=(e:Event)=>{lastKeyAt=performance.now();
   if(e instanceof KeyboardEvent&&GAME_KEY.test(e.code)&&!e.metaKey&&!(e.target instanceof HTMLElement&&e.target.closest('input[type=text],input[type=search],textarea,[contenteditable]')))lastKeyboardAt=lastKeyAt;};
  for(const type of ['keydown','mousedown'] as const)window.addEventListener(type,onKeyOrMouse,{passive:true,capture:true});
  /** The help's control names: a played controller's buttons until a key, a click or a touch, and an aircraft's flying. */
  let namingPad:'playstation'|'xbox'|undefined,namingFlying=false,namingMenu=false;
  /** The D-pad moves between the open menu's controls (the arsenal's, the map's, or the pause menu's) and cross presses. */
  const padMenu=(move:number,select:boolean)=>{
   const root=arsenal.open?arsenal.element:navigation?.open?hud.element.querySelector<HTMLElement>('.world-map-panel'):hud.menu;if(!root)return;
   const controls=[...root.querySelectorAll<HTMLElement>('button,select,input,a[href]')].filter(c=>c.offsetParent!==null&&!(c as HTMLButtonElement).disabled);
   if(!controls.length)return;
   const at=controls.indexOf(document.activeElement as HTMLElement);
   if(move){controls[at<0?0:(at+move+controls.length)%controls.length].focus({preventScroll:false});return;}
   if(select)(at<0?controls[0]:controls[at]).click();
  };
  // Phones and tablets: a stick, a camera drag and buttons over the game, feeding the same Input.
  /** Whether the touch controls' Enter has something to do, and the frame count it is looked at by. */
  let touchEnterNear=false,touchEnterTick=0;
  /** The ped the touch aim assist last eased onto, kept while it stays near the crosshair. */
  let aimAssistHandle:number|undefined;
  let touchPanel:{element:HTMLElement;display:HTMLElement;refresh():void}|undefined;
  const touch=touchScreen?new TouchControls(input,hud.element,{pause:()=>input.onPause(),arsenal:()=>{if(!paused&&!navigation?.open)arsenal.toggle(true);},playOn:()=>{if(started&&paused)play();}},touchSettings,next=>{touchSettings=next;saveTouchSettings(next);useTouchControlNames(true,next.steering);applyVisualEffects();}):undefined;
  /** The touch settings' population share (peds through the density multiplier, cars through the fleet's traffic scale). */
  const touchPopulation=()=>touch?DENSITY_SCALE[touchSettings.density]:1;
  /** The touch controls keep a phone's screen on while the game plays (src/input/screenAwake). */
  const screenAwake=touch?new ScreenAwake():undefined;
  /** Opened from the home screen (read before the game's own fullscreen): its storage is asked to be kept at the first play. */
  const installedAtLaunch=openedInstalled();let storageAsked=false;
  /** Whether the lock was let go for a phone left untouched mid-game (screenIdle), to be taken again at its next touch. */
  let screenIdled=false,screenIdleMs=SCREEN_IDLE_MS;
  // The touch settings' Resolution: the screen's own density, up to twice the CSS pixel, when asked for; under it a
  // step of the adaptive resolution while the game falls behind (not under automation, whose pictures are compared).
  const dynamicResolution=touch&&!navigator.webdriver?new DynamicResolution():undefined;
  function applyResolution(){if(touch)render.setPixelRatio(scaledRatio(resolutionRatio(touchSettings.resolution,devicePixelRatio),touchSettings.dynamicResolution&&dynamicResolution?dynamicResolution.scale:1));}
  // A taken pad shake, felt: a played pad rumbles for its time at its strength; a touch screen vibrates for half of it,
  // as the iOS port halves StartShake's time for a phone (an iPhone ticks once).
  const touchShake=touch?touchHaptic():undefined;
  function padShake(pad:number,time:number,frequency:number){
    if(pad!==0)return;
    if(gamepad.lastUsed>lastTouchAt)gamepad.rumble(time,Math.min(1,frequency/255));
    else if(touchShake&&touchSettings.vibration)touchShake(time/2);
  }
  // The first play's measure, on a touch screen whose quality settings nobody has chosen (not under automation, whose
  // software rendering would lower every run's). Settings an earlier measure settled on foot alone are measured again
  // at the wheel, and settings settled on the ground are measured again in the air: a phone that kept up walking could
  // crawl driving, and one that kept up driving crawl flying. Each context is kept as it is found fine.
  const unmeasured=():QualityContext[]=>[...(touchSettings.qualityChosen?[]:['foot' as const]),...(touchSettings.wheelMeasured?[]:['vehicle' as const]),...(touchSettings.flightMeasured?[]:['aircraft' as const])];
  let autoQuality=touch&&!navigator.webdriver&&unmeasured().length?new AutoQuality(undefined,undefined,undefined,undefined,unmeasured()):undefined;
  function keepMeasured(context:QualityContext){
    touchSettings={...touchSettings,...(context==='foot'?{qualityChosen:true}:context==='vehicle'?{wheelMeasured:true}:{flightMeasured:true})};saveTouchSettings(touchSettings);
  }
  function settleQuality(verdict:'slow'|'fine'){
    const preset=verdict==='slow'?lowerPreset(touchSettings):undefined;
    const done=!preset||preset==='low';
    touchSettings={...touchSettings,...(preset?QUALITY_PRESETS[preset]:{}),...(preset?{qualityChosen:done,wheelMeasured:done,flightMeasured:done}:{})};saveTouchSettings(touchSettings);
    if(done)autoQuality=undefined;
    if(!preset)return;
    touch?.apply(touchSettings);applyVisualEffects();applyResolution();touchPanel?.refresh();
    hud.message(`Graphics lowered to keep the game smooth (Visual effects ${touchSettings.effects==='low'?'Low':'Medium'}, Draw distance ${touchSettings.drawDistance}). Pause → Controls changes them.`,6000);
  }
  // The help box draws the buttons it names: a touch button's glyph beside its name, as the mobile ports' help shows the
  // widget itself, and a played pad's face buttons as their symbols, as the PS2 original's did.
  hud.decorateHelp=(box,text)=>showHelpIcons(box,text,controlsNamedIn(text),controlNameOf,controlNaming());
  // A phone keeps less of the streamed world it has left behind, textures counted (ModelObjects RETAINED_MODELS), and
  // one that says it has 2 GB or less half that again.
  // It keeps fewer of the world's decoded chunks too, in the page and in the streaming worker: 24 MB each (16 at 2 GB or
  // less) against 64, about 85 MB less over a drive, for a third more chunks inflated again from Cache Storage.
  const weakDevice=((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)<=2;
  if(touch)setRetainedModels(weakDevice?16*1024*1024:32*1024*1024,true);
  const worldChunkBudget=touch?(weakDevice?16:24)*1024*1024:undefined;
  if(worldChunkBudget!==undefined)setChunkCacheBudget(worldChunkBudget);
  // A touch screen's help is the iOS port's wording of it ("Tap ENTER to use this machine"), its own chunk, fetched beside
  // the touch controls.
  if(touch)void import('./assets/touchGxtText').then(({TOUCH_GXT_TEXT})=>setTouchText(TOUCH_GXT_TEXT)).catch(error=>console.warn('Touch help text unavailable.',error));
  if(touch){document.documentElement.classList.add('touch');useTouchControlNames(true,touchSettings.steering);applyResolution();
   // The pause menu's Controls panel holds the touch settings.
   // Adjust controls leaves the menu for the buttons themselves, the game still held, and comes back to it on Done.
   // A script menu's line takes a tap on a touch screen, as the port's menus do: a tap lights it, and a tap on the lit
   // one chooses it (Select, the pad's cross, for a frame).
   {const menusEl=hud.element.querySelector<HTMLElement>('.script-menus')!;
    menusEl.addEventListener('pointerdown',e=>{
     const menus=mission?.runtime.game.menus,id=menus?.currentMenuInUse??-1,menu=id>=0&&menus?.inUse[id]?menus.menus[id]:undefined;
     if(!menu||!menu.interactive[0]||paused)return;
     const r=menusEl.getBoundingClientRect(),row=menuItemAt(menu,(e.clientX-r.left)/r.width*640,(e.clientY-r.top)/r.height*448);
     e.preventDefault();e.stopPropagation();
     if(row===undefined||!menu.selectable[row]||menu.type!==1&&!menu.rowTitles[0][row])return;
     if(row===menu.selectedRow){input.hold('MenuSelect');input.releaseAfterFrame('MenuSelect');}
     else{menu.selectedRow=row;menus!.onSound?.('highlight');}
    });}
   touchPanel=touchSettingsPanel(()=>touchSettings,next=>{touchSettings=next;saveTouchSettings(next);touch.apply(next);useTouchControlNames(true,next.steering);applyMouseSettings();applyResolution();applyVisualEffects();},
    ()=>{hud.setMenu(false);armBackButton();touch.adjust(()=>{hud.setMenu(true);touchPanel?.refresh();});});hud.element.querySelector('.controls-panel')?.prepend(touchPanel.element);hud.element.querySelector('.display-panel')?.prepend(touchPanel.display);
   // A phone's short screen puts the touch buttons where the PC HUD's wanted stars sit (175 px down): they hang under
   // the clock, money and bars instead, wherever those end.
   {const status=hud.element.querySelector<HTMLElement>('.status');
    if(status){const place=()=>hud.element.style.setProperty('--status-bottom',`${Math.round(status.getBoundingClientRect().bottom-hud.element.getBoundingClientRect().top)}px`);
     const watch=new ResizeObserver(place);watch.observe(status);watch.observe(hud.element);place();}}}
  const cheats=CHEATS;
  /** CTimer::ms_fTimeScale as the gameplay cheats set it; a unique stunt jump's 0.3 overrides it and ResetTimeScale
   * afterwards puts it back to 1. */
  let cheatTimeScale=1,stuntSlow=false;
  /* CSpecialFX's snapshot after a photo (bSnapShotActive, SnapShotFrames): for 20 frames the game stands still
   * (SetTimeScale(0)), frames 1 to 9 add a white quad of 255 − 255 × frame / 10 over the screen (ONE / ONE), and then
   * ResetTimeScale puts the time scale back to 1. Counted in real frames of 1/30 s, since the game's own time stops. */
  let snapShotClock:number|undefined;
  const snapShotFlash=document.createElement('div');
  snapShotFlash.style.cssText='position:fixed;inset:0;pointer-events:none;mix-blend-mode:plus-lighter;display:none;z-index:5';
  document.body.appendChild(snapShotFlash);
  const stepSnapShot=(realSeconds:number)=>{
    if(snapShotClock===undefined)return;
    snapShotClock+=realSeconds;const frame=Math.floor(snapShotClock*30)+1;
    if(frame>20){snapShotClock=undefined;cheatTimeScale=1;snapShotFlash.style.display='none';return;}
    const shade=frame<10?(255-Math.trunc(255*frame/10))&255:0;
    snapShotFlash.style.display=shade?'block':'none';if(shade)snapShotFlash.style.background=`rgb(${shade},${shade},${shade})`;
  };
  const timeScale=()=>{if(snapShotClock!==undefined)return 0;const stunt=stuntJumps?.timeScale??1;if(stunt!==1){stuntSlow=true;return stunt;}if(stuntSlow){stuntSlow=false;cheatTimeScale=1;}return cheatTimeScale;};
  /** CCheat::ApplyCheat (0x438370): the cheat functions of Cheat.cpp for the systems this port has. Cheats without a
   * function, or whose effect is not ported, only toggle (CCheat::Toggle); fat, muscle, skinny, jetpack and max stamina
   * do nothing yet. */
  const rebuildPlayerUnlessDriving=()=>{if(!(worldCar?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike||carEntry.seated))rebuildPlayerIfNeeded();};
  const applyCheat=(cheat:CheatName)=>{
    const player=sim.player,inventory=weapons.inventory,before=inventory.selected;
    const vehicle=(model:number)=>{if(render.lighting.area===0&&fleet)void fleet.spawnCheatVehicle(model,player.position,player.heading);};
    const vehicles:Partial<Record<CheatName,number>>={rhino:432,bloodringBanger:504,rancher:505,hotringA:502,hotringB:503,romero:442,stretch:409,trashmaster:408,caddy:457,
      hydra:520,vortex:539,hunter:425,quad:471,tanker:514,dozer:486,stuntPlane:513,monsterTruck:556};
    // CPed::GiveWeaponSet1 (sets 2 and 3 are the gta-reversed reconstructions).
    const sets:Partial<Record<CheatName,readonly (readonly [number,number])[]>>={weaponSet1:[[1,1],[5,1],[18,10],[22,100],[25,50],[28,150],[30,120],[33,25],[35,200],[41,200]],
      weaponSet2:[[4,0],[16,10],[24,40],[26,40],[32,150],[31,150],[34,21],[37,500],[42,200]],weaponSet3:[[9,0],[39,5],[23,40],[27,30],[29,100],[31,150],[36,200]]};
    // CPed::GiveWeaponSet1/2/3 call GiveWeapon, which never changes the active slot: the fists stay in hand.
    if(sets[cheat])for(const [weapon,ammo] of sets[cheat]!)inventory.give(weapon,ammo,false);
    else if(vehicles[cheat])vehicle(vehicles[cheat]!);
    else switch(cheat){
      // MoneyArmourHealthCheat, then HealthCheat: full health, and the player's vehicle at 1000 with its fire out and fixed.
      case 'moneyArmourHealth':{
        // m_nMaxArmour and m_nMaxHealth, which the paramedic and vigilante rewards raise.
        const info=mission?.runtime.game.playerInfo;sim.money+=250000;player.armour=info?.maxArmour??100;player.health=info?.maxHealth??100;
        const car=worldCar?.occupied?worldCar:fleet?.occupied;if(car){car.health=1000;car.burnTimer=0;car.fix();}
        const bike=fleet?.occupiedBike;if(bike){bike.health=1000;bike.burnTimer=0;}
        // FindPlayerVehicle() of any type takes 1000 health: aircraft (CAutomobiles, their burn timer cleared) and boats too.
        const plane=fleet?.occupiedPlane;if(plane&&plane.health>0){plane.health=1000;plane.burnTimer=0;}
        const boat=fleet?.occupiedBoat;if(boat&&!boat.wrecked){boat.health=1000;boat.burnTimer=0;}
        break;
      }
      // CWanted::CheatWantedLevel: past the script's maximum it first raises the maximum.
      case 'wantedLevelUp':{const level=Math.min(law.level+2,6);if(level>law.native.maximumWantedLevel)law.native.setMaximumWantedLevel(level);law.setLevel(level);break;}
      case 'wantedLevelDown':law.setLevel(0);break;
      case 'sixStars':if(6>law.native.maximumWantedLevel)law.native.setMaximumWantedLevel(6);law.setLevel(6);break;
      case 'neverWanted':law.setLevel(0);cheats.toggle(cheat);break;
      // CWeather::ForceWeatherNow.
      case 'sunnyWeather':weather.forceWeatherNow(WEATHER.sunnyLA);break;
      case 'extraSunnyWeather':weather.forceWeatherNow(WEATHER.extraSunnyLA);break;
      case 'cloudyWeather':weather.forceWeatherNow(WEATHER.cloudyLA);break;
      case 'rainyWeather':weather.forceWeatherNow(WEATHER.rainyCountry);break;
      case 'foggyWeather':weather.forceWeatherNow(WEATHER.foggySF);break;
      case 'thunderstorm':weather.forceWeatherNow(WEATHER.rainyCountry);weather.rain=1;weather.wind=1;break;
      case 'sandstorm':weather.forceWeatherNow(WEATHER.sandstormDesert);break;
      case 'fasterGameplay':if(cheatTimeScale<4)cheatTimeScale*=2;break;
      case 'slowerGameplay':if(cheatTimeScale>.25)cheatTimeScale/=2;break;
      // MidnightCheat stops the clock at midnight; DuskCheat stops it where it is and puts it at 21:00 when turned off.
      case 'alwaysMidnight':cheats.toggle(cheat);if(cheats.isActive(cheat))sim.timeMinutes=0;break;
      case 'orangeSky':cheats.toggle(cheat);if(!cheats.isActive(cheat))sim.timeMinutes=21*60;break;
      case 'blackTraffic':cheats.toggle(cheat);if(cheats.isActive(cheat))cheats.disable('pinkTraffic');break;
      case 'pinkTraffic':cheats.toggle(cheat);if(cheats.isActive(cheat))cheats.disable('blackTraffic');break;
      // An unarmed 1000-point hit to the torso.
      case 'suicide':sim.damagePlayer(1000,false,{weapon:0});break;
      case 'parachute':inventory.give(46,0);inventory.select(46);break;
      // GivePlayerGoodiesWithPickUpMI(adrenaline) when turned on; ClearAdrenaline when turned off.
      // GivePlayerGoodiesWithPickUpMI reports AE_FRONTEND_PICKUP_ADRENALINE; ClearAdrenaline resets the time scale too.
      case 'adrenaline':cheats.toggle(cheat);if(cheats.isActive(cheat)){player.adrenaline=20;player.stamina=100;player.sprintExhausted=false;sound.frontend(AE_FRONTEND.pickupAdrenaline);}else{player.adrenaline=0;cheatTimeScale=1;}break;
      // A Micro Uzi with 150 rounds when the SMG slot's weapon is WEAPON_UNARMED (an emptied SMG still fills it).
      case 'driveby':cheats.toggle(cheat);if(cheats.isActive(cheat)&&![28,29,32].some(id=>inventory.owned.has(id))){inventory.give(28,150);inventory.select(28);}break;
      case 'weaponSkills':for(let id=22;id<=31;id++)inventory.practice.set(id,1000);break;
      // VehicleSkillsCheat: driving, flying, bike and cycling skill all to 1000.
      case 'vehicleSkills':progression.drivingSkill=1000;carEntry.drivingSkill=1000;for(const stat of [160,223,229,230])mission?.runtime.game.stats.set(stat,1000);break;
      case 'blowUpCars':
        // Every valid vehicle of the pool: the script's own car with the fleet's.
        if(worldCar&&!worldCar.wrecked)worldCar.blowUp();
        for(const car of fleet?.cars??[])car.blowUp();for(const bike of fleet?.bikes??[])bike.blowUp();for(const boat of fleet?.boats??[])boat.blowUp();
        for(const plane of fleet?.planes??[])plane.damage(plane.health);
        break;
      // CCheat::JetpackCheat: the player is given CTaskSimpleJetPack unless he already has one. It is not a toggle.
      case 'jetpack':sim.startJetPack();break;
      // CCheat::FatCheat, MuscleCheat and SkinnyCheat set the body stats and, unless the player is driving
      // (PEDSTATE_DRIVING), CClothes::RebuildPlayer him at once: the fat, muscular or plain motion group takes over on the
      // spot. The body shape itself has no port; StaminaCheat only sets its stat.
      case 'fat':mission?.runtime.game.stats.set(21,1000);rebuildPlayerUnlessDriving();break;
      case 'muscle':mission?.runtime.game.stats.set(23,1000);rebuildPlayerUnlessDriving();break;
      case 'skinny':mission?.runtime.game.stats.set(21,0);mission?.runtime.game.stats.set(23,0);rebuildPlayerUnlessDriving();break;
      case 'maxStamina':mission?.runtime.game.stats.set(22,1000);break;
      default:cheats.toggle(cheat);
    }
    if(inventory.selected!==before)void weaponView.equip(inventory.selected);
  };
  input.onLetter=letter=>{
    // CCheat::DoCheats reads every key the pad sees outside the menus; the map (M) is an overlay here, so it keeps listening.
    if(paused||arsenal.open)return;
    const cheat=cheats.add(letter);if(!cheat)return;
    // AddToCheatString: CHEAT8 when the cheat was on, CHEAT1 otherwise, in the help box (CHud::SetHelpMessage);
    // STAT_TIMES_CHEATED is the cheats' own count, bound into the stat table.
    hud.help(gxtHudText(cheats.wasActive?gxtText('CHEAT8','Cheat deactivated'):gxtText('CHEAT1','Cheat activated')));
    applyCheat(cheat);
  };
  /** A script message as the HUD prints it: its text, the ~a~ string and the ~1~ numbers put in, the controls named. */
  const scriptMessageText=(m:{key:string;insert?:string;numbers:readonly number[]})=>gxtHudText(insertNumbers(gxtText(m.key,m.key).replace('~a~',m.insert?gxtText(m.insert,m.insert):''),...m.numbers));
  function pause() {
    loadRequest++;
    if (!started) return;
    // One overlay at a time: the pause menu closes the map and the arsenal rather than opening over them.
    if (navigation?.open) navigation.toggle(false);
    if (arsenal.open) arsenal.toggle(false);
    paused = true; sound.setPlaying(false); clock.reset(); input.clear(); hud.setMenu(true);
    // The front end's Map page, the first of the PC's pause menu: the full map over the game, held as the map holds it
    // (with the radar switched off, the only way to it on a touch screen).
    {const map=hud.button('menu-map');map.hidden=!navigation;map.onclick=()=>{play();navigation?.toggle(true);};}
    void screenAwake?.hold(false);touchPanel?.refresh();
    // The front end's Brief: CMessages::PreviousBriefs, newest first in the array, listed oldest first. A brief keeps
    // its text's key, and a mission's text goes with its table: lines whose text is no longer loaded are left out.
    hud.setBriefs(mission?[...mission.runtime.game.messages.previousBriefs].filter(b=>!!b&&!!loadedText()?.has(b.key)).reverse().map(b=>scriptMessageText(b!)):[],gxtText('FEH_BRI','Brief'));
    hud.button('play').textContent = 'Resume game';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  /** How long the opening's black hold goes before it says it is loading. */
  const OPENING_LOADING_MS=1500;
  function play() {
    terrainHold(false);
    if (!started) {
      started = true;
      // A new game opens on MAIN's DO_FADE 0 0, but the script is only built once the world is there, a few seconds
      // after the button: until then the screen is held black, so Grove Street and the HUD do not flash up before the
      // opening's title card. Loading a save point (which skips INTRO) fades straight in.
      if (!progression.savedLocation && !mission) { openingHoldAt = performance.now(); cameraFade.alpha = 255; cameraFade.value = 255; cameraFade.fading = false; hud.fade(true, 0); }
      if (!progression.savedLocation && STARTING_LOADOUT) { grantStartingLoadout(weapons.inventory, sim.player, mission?.runtime.game.playerInfo.maxArmour ?? 100); progression.save(); }
    }
    paused = false; sound.setPlaying(true); last = performance.now(); clock.reset(); input.clear(); hud.setMenu(false); hud.menuMessage(''); canvas.focus();
    // A tap on the menu's button is the gesture a phone needs to go fullscreen.
    if (touch) { void goFullscreen(); void screenAwake?.hold(true); screenIdled=false; armBackButton(); if(!storageAsked){storageAsked=true;void keepStorage(navigator.storage,installedAtLaunch);} }
    // Terrain loading that gave up after failures in a row tries again from where the player stands.
    follower?.retry();
  }
  hud.button('play').disabled = false; hud.button('play').textContent = 'Begin game'; hud.button('play').onclick = play;
  // A phone switching apps hides the page, and may kill it later without the pagehide that saves: the progress is
  // saved as it goes.
  const onVisibility = () => { if (document.hidden) { pause(); saveProgress(); } };
  document.addEventListener('visibilitychange', onVisibility);
  const onBlur = () => pause(); window.addEventListener('blur', onBlur);
  // A phone's back button or gesture closes the map or the arsenal, or else pauses, as the Android port's opens its pause
  // menu: playing on touch keeps one history entry of its own for back to take, and from the menu back leaves as it
  // always does. Back in fullscreen first takes the page out of fullscreen, which pauses too; Resume takes the screen
  // again.
  let backArmed=false;
  function armBackButton(){if(backArmed)return;backArmed=true;try{history.pushState({groveStreetPlay:true},'');}catch{backArmed=false;}}
  const onPopState=()=>{if(!backArmed)return;backArmed=false;
   // Adjusting the touch layout, back is Done: the layout is kept and the menu comes back.
   if(touch?.adjusting){touch.endAdjusting();armBackButton();return;}
   // Back closes the map or the arsenal first, as it closes a dialog, and play goes on.
   if(navigation?.open||arsenal.open){if(navigation?.open)navigation.toggle(false);if(arsenal.open)arsenal.toggle(false);armBackButton();return;}
   if(started&&!paused)pause();};
  const onFullscreenChange=()=>{if(touch&&started&&!paused&&!document.fullscreenElement)pause();};
  // A phone turned upright mid-play holds the game behind the card asking it back sideways, as switching apps does.
  const upright=touch?matchMedia('(orientation: portrait) and (max-width: 600px)'):undefined;
  const onUpright=()=>{if(upright?.matches&&started&&!paused&&!touch!.uprightAllowed)pause();};
  if(touch){window.addEventListener('popstate',onPopState);document.addEventListener('fullscreenchange',onFullscreenChange);upright!.addEventListener('change',onUpright);}
  // Losing the pointer lock pauses the game, except when an overlay let it go so its controls can be clicked.
  const onLockChange = () => {
    if (document.pointerLockElement) { overlayReleasedLock = false; return; }
    if (!started) return;
    if (overlayReleasedLock) { overlayReleasedLock = false; return; }
    lockLostAt = performance.now(); pause();
  };
  document.addEventListener('pointerlockchange', onLockChange);
  const onContextLost = (event: Event) => { event.preventDefault(); pause(); hud.menuMessage('Graphics paused. Waiting for the display to recover…'); };
  const onContextRestored = () => { render.nativeShadow.invalidateCapture(); hud.menuMessage('Display recovered. Resume when ready.'); render.resize(); };
  canvas.addEventListener('webglcontextlost', onContextLost); canvas.addEventListener('webglcontextrestored', onContextRestored);
  // Development only: the world streams from the dev server, so with the server gone the terrain hold waits for
  // windows that never come and the game looks frozen, Resume or not. Say so; Vite reloads the page once it is back.
  import.meta.hot?.on('vite:ws:disconnect', () => { pause(); hud.menuMessage('The local game server stopped, so the world cannot load. Start it again (npm run dev); this page reloads by itself once it is back.'); });
  // Development-only observation hook: useful for browser verification, never an alternate input path.
  if (import.meta.env.DEV) Object.assign(window, { __game: {
    /** Dev diagnostic: what each collider of the occupied native car is touching. */
    /** An entry-exit's entrance, native (x, y, z), by pool index: where a blip SET_BLIP_ENTRY_EXIT tied to it leads from outside. */
    entryExitEntrance:(index:number)=>{const e=entryExits?.pool[index];if(!e)return null;const [x,y,z]=entryExitPosition(e);return {x,y,z};},
    /** The entry-exit marker in the area CJ is in that is nearest him (native), the way out of an interior. */
    interiorExitNear:(x:number,y:number,z:number,enabledOnly=false)=>{let best:{x:number;y:number;z:number}|null=null,d=Infinity;
     for(const e of entryExits?.pool??[]){if(e.area!==render.lighting.area||enabledOnly&&!(e.flags&ENEX.ENABLE_ACCESS))continue;const [ex,ey,ez]=entryExitPosition(e),k=Math.hypot(ex-x,ey-y,ez-z);if(k<d){d=k;best={x:ex,y:ey,z:ez};}}
     return best;},
    /** The tags within `radius` of a native (x, y): position, the way the wall faces, and how far painted (255 done). */
    tagsNear:(x:number,y:number,radius:number)=>((tagManager as unknown as {tags?:{position:number[];forward:readonly number[];alpha:number}[]})?.tags??[]).filter(t=>Math.hypot(t.position[0]-x,t.position[1]-y)<radius).map(t=>({x:t.position[0],y:t.position[1],z:t.position[2],forward:[...t.forward],alpha:t.alpha})),
    smashedProps:()=>smashedProps.slice(),
    /** The scene's OBJECT.DAT placements whose model matches, for specs. */
    propsNamed:(pattern:string)=>{const re=new RegExp(pattern,'i'),out:{handle:number;model:string;position:number[];present:boolean;solid:boolean}[]=[];for(const [handle,source] of importedScene?.sources??[])if(source.placement&&re.test(source.modelName))out.push({handle,model:source.modelName,position:[...source.placement.position],present:!!sim.world.getCollider(handle)?.parent()?.isEnabled(),solid:!!sim.world.getCollider(handle)?.isEnabled()});return out;},
    /** CObject::TryToExplode on the placement behind a collider handle. */
    explodeProp:(handle:number)=>{const collider=sim.world.getCollider(handle);return !!collider&&!!scenePropFor(collider)?.tryToExplode?.();},
    /** Uprooted props that moved, with their current pose (renderer frame). */
    movedProps:()=>[...movedPlacements].map(([key,m])=>{
      const handle=[...(importedScene?.sources.entries()??[])].find(([,source])=>source.placement&&placementKey(source.modelName,source.placement.position)===key)?.[0];
      const body=handle===undefined?undefined:sim.world.getCollider(handle)?.parent();
      return {key,translation:m.translation,dynamic:!!body?.isDynamic(),at:body?{...body.translation()}:null};
    }),
    /** Fire the held weapon from CJ at a renderer-frame point. */
    /** The GXT text of a key, mission table included (empty when none). */
    text:(key:string)=>gxtText(key,''),
    /** CBulletTraces::AddTrace for a weapon's streak (browser space), as an NPC's shot past the camera adds it. */
    traceBullet:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>{bulletTraces.addTrace(from,to,.01,300,70);},
    fireAt:(x:number,y:number,z:number)=>{const p=sim.player.position,eye={x:p.x,y:p.y+1.3,z:p.z},d={x:x-eye.x,y:y-eye.y,z:z-eye.z},l=Math.hypot(d.x,d.y,d.z)||1;return weapons.fire({origin:eye,direction:{x:d.x/l,y:d.y/l,z:d.z/l}});},
    /** The world car's wheel col spheres (renderer frame), as bullets test them. */
    carWheels:()=>worldCar?.wheelSpheres().map(s=>({wheel:s.wheel,center:{x:s.center.x,y:s.center.y,z:s.center.z},radius:s.radius}))??[],
    /** Add a native explosion (eExplosionType) at a renderer-frame point. */
    explodeAt:(x:number,y:number,z:number,type=0)=>{weapons.debugExplosion({x,y,z},type);return true;},
    /** Turn CJ to a renderer-frame heading (0 faces +z), with the camera behind him. */
    turnPlayer:(heading:number)=>{sim.player.heading=heading;render.yaw=heading+Math.PI;return true;},
    /** CTaskSimpleClimb::TestForClimb from where CJ stands: the native-frame hold, 'invalid', or null. */
    testClimb:(launch=true)=>{const p=sim.player.position;if(!sim.climbWorld)return null;const found=testForClimb(sim.climbWorld,{position:{x:p.x,y:-p.z,z:p.y+1},heading:sim.player.heading-Math.PI},launch);return found===undefined?null:found==='invalid'?'invalid':{kind:found.entity.kind,...found.hold};},
    /** Height of the fixed collision under a renderer-frame point, searching down from `top`. */
    /** Dev probe: renderer-frame centroids of the loaded collision faces carrying a material id (first `limit`). */
    collisionFacesOf:(material:number,limit=20)=>{const out:{x:number;y:number;z:number;model:string}[]=[];for(const [handle,record] of importedScene?.sources??[]){const s=record.source;if(s.kind!=='mesh')continue;const c=sim.world.getCollider(handle);if(!c)continue;const v=c.vertices(),t=c.translation(),q=c.rotation(),rot=new Quaternion(q.x,q.y,q.z,q.w);for(let i=0;i<s.mesh.materials.length&&out.length<limit;i++){if(s.mesh.materials[i]!==material)continue;const a=s.mesh.indices[i*3],b=s.mesh.indices[i*3+1],d=s.mesh.indices[i*3+2];const p=new Vector3((v[a*3]+v[b*3]+v[d*3])/3,(v[a*3+1]+v[b*3+1]+v[d*3+1])/3,(v[a*3+2]+v[b*3+2]+v[d*3+2])/3).applyQuaternion(rot);out.push({x:+(p.x+t.x).toFixed(1),y:+(p.y+t.y).toFixed(1),z:+(p.z+t.z).toFixed(1),model:record.modelName});}}return out;},
    /** Dev probe: how many collision faces of every loaded mesh source carry each material id. */
    /** Dev probe: how far a bullet line test from `from` along `dir` (renderer frame) reaches before it hits. */
    lineOfFire:(from:{x:number;y:number;z:number},dir:{x:number;y:number;z:number},range:number)=>weapons.lineOfFire(from,dir,range)??null,
    /** Dev probe: the first shoot-through collision face (SURFINFO shootThrough) a ring of level rays from the player (at `height` over its centre) meets. */
    shootThroughProbe:(range=60,height=.5)=>{const p=sim.player.position;for(let i=0;i<128;i++){const a=i/128*Math.PI*2,dir={x:Math.sin(a),y:0,z:Math.cos(a)},from={x:p.x,y:p.y+height,z:p.z};const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray(from,dir),range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,sim.playerCollider,sim.playerBody);if(hit&&worldFx.isShootThrough(hit))return {from,dir,distance:hit.timeOfImpact};}return null;},
    collisionMaterialHistogram:()=>{const h:Record<number,number>={};for(const record of importedScene?.sources.values()??[]){const s=record.source;if(s.kind!=='mesh')continue;for(const m of s.mesh.materials)h[m]=(h[m]??0)+1;}return h;},
    /** The map placements a script hid or took the collision off, by placement key. */
    scriptPlacementFlags:()=>({hidden:[...hiddenPlacements],solidless:[...solidlessPlacements]}),
    /** Script objects still passing through the car they were sorted out with. */
    sortedOutCollisions:()=>[...sortedOutCollisions.keys()],
    /** The live CCoronas slots: id, colour, intensity and where. */
    coronaSlots:()=>coronas.coronas.filter(c=>c.id).map(c=>({id:c.id,color:[...c.color],alpha:c.alpha,position:[...c.position],size:c.size,farClip:c.farClip})),
    /** Dev probe: the collision surface under a renderer-frame point (material id, face and source kind), or null. */
    surfaceAt:(x:number,z:number,top=200)=>{const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),top+100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)return null;const record=importedScene?.sources.get(hit.collider.handle);const surface=record?nativeCollisionSurface(record.source,hit):undefined;return {y:top-hit.timeOfImpact,handle:hit.collider.handle,known:!!record,model:record?.modelName??null,kind:record?.source.kind??null,material:surface?.material??null,face:surface?.faceIndex??null,featureType:hit.featureType,keys:record?Object.keys(record):[]};},
    /** What a ray between two renderer-frame points meets first (the player excluded). */
    rayBetween:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>{const d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},l=Math.hypot(d.x,d.y,d.z)||1;const hit=sim.world.castRay(new RAPIER.Ray(from,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,sim.playerCollider,sim.playerBody);return hit?{at:hit.timeOfImpact,of:l,scriptObject:scriptObjectViews?.objectForCollider(hit.collider.handle)??null,model:importedScene?.sources.get(hit.collider.handle)?.modelName??null}:null;},
    /** The first collider a ray straight down meets, and the script object it belongs to, if any. */
    rayDown:(x:number,z:number,top=200)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),top+100,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);return hit?{y:top-hit.timeOfImpact,scriptObject:scriptObjectViews?.objectForCollider(hit.collider.handle)??null}:null;},
    groundAt:(x:number,z:number,top=200)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),top+100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?top-hit.timeOfImpact:null;},
    /** Set the game clock, in minutes after midnight. */
    setTime:(minutes:number)=>{sim.timeMinutes=((minutes%1440)+1440)%1440;return sim.timeMinutes;},
    /** Set CBirds' frame counter; the next frame after 5 (mod 512) tries a flock. */
    birdFrame:(frame:number)=>{birdFrame=frame;return true;},
    /** Put a bird at a renderer-frame point, flying along the renderer-frame direction (dx, dz). */
    placeMarkerCone:(x:number,y:number,z:number)=>{debugMarkers.push([x,-z,y]);},
    /** The lit placements in range, native. */
    /** Hides the sun's lens flare, to read what it adds to the frame. */
    hideFlares:(hidden:boolean)=>{coronaFlaresMesh.hidden=hidden;},
    litPlacements:()=>importedScene?.litPlacements().map(e=>({name:e.name??'',position:[e.matrix[12],e.matrix[13],e.matrix[14]],forward:[e.matrix[4],e.matrix[5],e.matrix[6]]}))??[],
    placeBird:(x:number,y:number,z:number,dx=1,dz=0)=>{birds.createNumberOfBirds([x,-z,y],[x+dx*10,-(z+dz*10),y],1,'normal',false);return birds.count;},
    /** Stand CJ at a renderer-frame point. */
    /** The simulation itself, for probes that must read or wrap its physics bodies. */
    sim,
    /** Placements within a radius of the player with their visibility and LOD state. */
    placementsNear:(radius=40)=>importedScene?.placementsNear(sim.player.position.x,sim.player.position.z,radius)??[],
    glassNear:(radius=60)=>{const p=sim.player.position,out:{handle:number;model:string;position:number[];state:GlassState|null}[]=[];for(const [handle,source] of importedScene?.sources??[]){if(!source.placement)continue;const [x,y,z]=source.placement.position;if(Math.hypot(x-p.x,y+p.z)>radius)continue;const window=glassWindowAt(handle);if(window)out.push({handle,model:source.modelName,position:[x,y,z],state:glassStates.get(handle)??null});}return out;},
    glass:()=>({panes:glass.panes.length,cracked:[...glassStates.values()].filter(s=>s.hasBrokenGlass&&!s.brokenAltogether).length,broken:[...glassStates.values()].filter(s=>s.brokenAltogether).length}),
    attractorsNear:(radius=60)=>importedScene?.attractorsNear(sim.player.position.x,-sim.player.position.z,radius)??[],
    placePlayer:(x:number,y:number,z:number)=>{sim.player.position={x,y,z};sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:y+.9,z});sim.playerCollider.setTranslation({x,y:y+.9,z});fleet?.generateEvenIfClose();return true;},
    /** Stand a civilian still at a renderer-frame point. */
    placePed:(x:number,y:number,z:number,except?:number[])=>pedestrians?.debugPlace({x,y,z},0,except)??null,
    /** CPostEffects::m_bColorEnable. */
    setColourFilter:(on:boolean)=>{postEffects.colourFilterEnabled=!!on;return postEffects.colourFilterEnabled;},
    pedestrians:()=>pedestrians,scriptCars:()=>scriptCars,
    RAPIER,
    /** Kill a pedestrian where it stands through the ordinary damage path. */
    killPed:(id:number)=>{const p=pedestrians?.snapshot().people.find(p=>p.id===id);return p?pedestrians!.damageCollider(p.handle,1000,{x:0,z:1}):false;},
    /** Put the world car at a renderer-frame position at rest; `heading` turns it about the vertical (0 faces -z). */
    placeCar:(x:number,y:number,z:number,heading?:number)=>{if(!worldCar)return false;const b=worldCar.car.body;b.setTranslation({x,y,z},true);if(heading!==undefined)b.setRotation({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);return true;},
    setWantedLevel:(level:number)=>{law.setLevel(level);return law.level;},
    // CCrime::ReportCrime of a crime against a new victim, with the police who see it or not as they stand.
    crime:(type:number)=>{law.crime(type,`debug-${performance.now()}`);return law.level;},
    /** Dev: the frame limiter (the menu's Display setting). */
    setFrameLimiter:(on:boolean)=>{display.frameLimiter=!!on;saveDisplaySettings(display);hud.bindDisplay(display,displayChanged);return display.frameLimiter;},
    /** Dev: the traffic, weapons and occupants. */
    traffic:()=>traffic,weapons:()=>weapons,occupants:()=>occupants,
    /** Dev: the world head-sphere centre of a car's seated driver (renderer frame), by body handle. */
    driverHead:(handle:number)=>{const car=fleet?.carById(`handle:${handle}`);const seat=car?.seat('left');return car&&seat?car.worldPoint({x:seat.x,y:seat.y,z:seat.z+.6}):null;},
    /** Dev: the world effects. */
    fx:()=>worldFx,
    /** Dev: the renderer (scene, camera, three.js renderer). */
    render:()=>render,
    /** Dev: the fleet and the car entry task. */
    fleet:()=>fleet,carEntry:()=>carEntry,
    /** Dev: the walk up to a bike the enter button chose from further off than boarding reach. */
    bikeApproach:()=>bikeApproach?{time:bikeApproach.time,best:bikeApproach.best,stall:bikeApproach.stall}:null,
    moneyDrops:()=>moneyDrops,hud:()=>hud,screenAwake:(idleMs?:number)=>{if(idleMs!==undefined)screenIdleMs=idleMs;return {held:screenAwake?.held??false,idled:screenIdled,fingers:fingersDown};},weather:()=>weather,cullZones:()=>cullZones,bikeMount:()=>bikeMount,
    /** Dev: spawn a vehicle model beside the player the way the vehicle cheats do. */
    spawnVehicle:(model:number)=>{if(!fleet)return false;void fleet.spawnCheatVehicle(model,sim.player.position,sim.player.heading);return true;},
    /** Put a fleet car (by its snapshot id, e.g. 'starter') at a renderer-frame position at rest. */
    placeFleetCar:(id:string,x:number,y:number,z:number,heading?:number)=>{const car=fleet?.carById(id);if(!car)return false;const b=car.car.body;b.setTranslation({x,y,z},true);if(heading!==undefined)b.setRotation({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);return true;},
    /** A Los Santos street cop (CCopPed with its nightstick and pistol) at a point. */
    placeCop:(x:number,y:number,z:number)=>pedestrians?pedestrians.spawnOfficer('lapd1',22,{x,y,z},0).then(id=>typeof id==='number'):false,
    /** Scene graph size: objects, those updating their matrix every frame, meshes and visible meshes. */
    /** Milliseconds per scene matrix update: as the renderer runs it now, and forced through the whole tree as before. */
    benchMatrices:(n=200)=>{const t0=performance.now();for(let i=0;i<n;i++)render.scene.updateMatrixWorld();const t1=performance.now();for(let i=0;i<n;i++)render.scene.updateMatrixWorld(true);const t2=performance.now();return {current:(t1-t0)/n,forced:(t2-t1)/n};},
    /** Objects whose world matrix is recomputed every frame, by the nearest auto-updating ancestor that forces them. */
    forcedMatrices:()=>{const groups=new Map<string,number>();let forced=0,visited=0;const label=(o:any)=>{const parts=[];for(let c=o;c&&c!==render.scene&&parts.length<3;c=c.parent)parts.push(c.name||c.type);return parts.reverse().join('/');};
      let traversed=0;const pass=(o:any,force:boolean)=>{traversed++;const f=force||o.matrixAutoUpdate||o.matrixWorldNeedsUpdate;for(const c of o.children)if(c.matrixWorldAutoUpdate||f)pass(c,f);};for(const c of render.scene.children)pass(c,false);
      const walk=(o:any,by:any)=>{visited++;const cause=by??(o.matrixAutoUpdate?o:undefined);if(cause){forced++;const k=label(cause);groups.set(k,(groups.get(k)??0)+1);}for(const c of o.children)walk(c,cause);};
      for(const c of render.scene.children)walk(c,undefined);
      const children=render.scene.children.map(c=>{let size=0,auto=0;c.traverse(o=>{size++;if(o.matrixAutoUpdate)auto++;});return [c.name||c.type,size,auto,c.matrixWorldAutoUpdate] as const;}).sort((a,b)=>b[1]-a[1]).slice(0,12);
      return {visited,traversed,forced,top:[...groups].sort((a,b)=>b[1]-a[1]).slice(0,15),children};},
    sceneCounts:async()=>{let objects=0,auto=0,meshes=0,visible=0,roads=0;render.scene.traverse(o=>{objects++;if(o.matrixAutoUpdate)auto++;if((o as any).isMesh){meshes++;}});render.scene.traverseVisible(o=>{if((o as any).isMesh){visible++;if(o.renderOrder===-2)roads++;}});
      // Every render pass of one frame (scene, silhouettes, shadow filter), not just the last.
      const info=render.renderer.info;info.autoReset=false;await new Promise(r=>requestAnimationFrame(()=>{info.reset();requestAnimationFrame(r);}));info.autoReset=true;
      return {objects,auto,meshes,visible,roads,calls:info.render.calls,triangles:info.render.triangles,programs:info.programs?.length,gpuGeometries:info.memory.geometries,gpuTextures:info.memory.textures};},
    /** Meshes inside the camera frustum this frame grouped by geometry and by geometry+material: how many draws
     * repeat a geometry (instancing candidates) versus unique ones. */
    /** Meshes in the frustum by their scene-graph path (two levels below the scene): which system the draws are. */
    drawBreakdown:()=>{const frustum=new Frustum(),m=new Matrix4().multiplyMatrices(render.camera.projectionMatrix,render.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(m);
      const by=new Map<string,number>();render.scene.traverseVisible(o=>{const mesh=o as any;if(!mesh.isMesh&&!mesh.isPoints&&!mesh.isLine)return;if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;
        const path:string[]=[];for(let c=mesh.parent;c&&c!==render.scene;c=c.parent)path.unshift(c.name||c.type);const k=path.slice(0,2).join('/')||mesh.name||'(scene)';by.set(k,(by.get(k)??0)+1);});
      return [...by].sort((a,b)=>b[1]-a[1]).slice(0,20);},
    /** Meshes in the frustum and the material groups they draw (a mesh with a material array draws once a group): what
     * renderer.info's draw calls are made of. */
    groupCounts:()=>{const frustum=new Frustum(),m=new Matrix4().multiplyMatrices(render.camera.projectionMatrix,render.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(m);
      let meshes=0,groups=0,hist=new Map<number,number>(),transparent=0;const bySize=new Map<number,number>(),sphere=new Sphere(),cam=render.camera as any;
      const pxPerUnit=innerHeight/2/Math.tan((cam.fov??60)*Math.PI/360);
      render.scene.traverseVisible(o=>{const mesh=o as any;if(!mesh.isMesh)return;if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;meshes++;const n=Array.isArray(mesh.material)?Math.max(1,mesh.geometry.groups.length):1;groups+=n;hist.set(n,(hist.get(n)??0)+1);if([mesh.material].flat().some((x:any)=>x.transparent))transparent++;
        // Draws by the mesh's projected size: its bounding sphere's diameter on screen, in CSS pixels (bucket 2^k).
        if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
        const d=Math.max(.1,sphere.center.distanceTo(cam.position)-sphere.radius),px=2*sphere.radius/d*pxPerUnit,k=px<2?1:2**Math.min(8,Math.floor(Math.log2(px)));bySize.set(k,(bySize.get(k)??0)+n);});
      // Groups a mesh could draw together: materials alike but for their object (texture, colour, flags, program).
      let mergeable=0;render.scene.traverseVisible(o=>{const mesh=o as any;if(!mesh.isMesh||!Array.isArray(mesh.material))return;if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;
        const keys=new Set<string>();for(const g of mesh.geometry.groups){const m=mesh.material[g.materialIndex];if(!m)continue;keys.add([m.map?.uuid,m.color?.getHexString?.(),m.opacity,m.transparent,m.alphaTest,m.side,m.customProgramCacheKey?.(),m.userData?.nativeEnv?1:0,m.userData?.uvAnim?1:0].join('|'));}
        mergeable+=Math.max(0,mesh.geometry.groups.length-keys.size);});
      return {meshes,groups,transparent,mergeable,hist:[...hist].sort((a,b)=>a[0]-b[0]),drawsBySizePx:[...bySize].sort((a,b)=>a[0]-b[0])};},
    /** What batching the world by material would leave: the visible opaque groups of the streamed windows, and the keys
     * (texture image, colour, opacity, alpha test, side, program) they share, overall and per window. */
    batchPotential:()=>{const frustum=new Frustum(),m=new Matrix4().multiplyMatrices(render.camera.projectionMatrix,render.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(m);
      let groups=0,opaque=0,other=0;const keys=new Set<string>(),perWindow=new Set<string>();
      render.scene.traverseVisible(o=>{const mesh=o as any;if(!mesh.isMesh||mesh.isSkinnedMesh)return;if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;
        let win=mesh.parent;while(win&&win.parent&&win.parent!==render.scene)win=win.parent;
        const mats=Array.isArray(mesh.material)?mesh.geometry.groups.map((g:any)=>mesh.material[g.materialIndex]):[mesh.material];
        for(const mt of mats){if(!mt)continue;groups++;if(mt.transparent||mt.userData?.uvAnim){other++;continue;}opaque++;
          const k=[mt.map?.source?.uuid??'none',mt.color?.getHexString?.(),mt.opacity,mt.alphaTest,mt.side,mt.customProgramCacheKey?.()??mt.type].join('|');keys.add(k);perWindow.add((win?.uuid??'')+'|'+k);}});
      return {groups,opaque,other,keys:keys.size,keysPerWindow:perWindow.size};},
    drawGroups:()=>{const frustum=new Frustum(),m=new Matrix4().multiplyMatrices(render.camera.projectionMatrix,render.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(m);
      const byGeometry=new Map<string,number>(),byPair=new Map<string,number>();let drawn=0,skinned=0;
      render.scene.traverseVisible(o=>{const mesh=o as any;if(!mesh.isMesh)return;if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;drawn++;if((mesh as any).isSkinnedMesh)skinned++;
        const g=mesh.geometry.uuid,mat=[mesh.material].flat().map((x:any)=>x.uuid).join('+');byGeometry.set(g,(byGeometry.get(g)??0)+1);byPair.set(g+'|'+mat,(byPair.get(g+'|'+mat)??0)+1);});
      const repeats=[...byPair.values()].filter(n=>n>1),dist=(v:number[])=>{const s=[...v].sort((a,b)=>b-a);return {groups:s.length,draws:s.reduce((a,b)=>a+b,0),top:s.slice(0,12)};};
      return {drawn,skinned,uniqueGeometries:byGeometry.size,uniquePairs:byPair.size,repeatedPairs:dist(repeats)};},
    /** CPU-side bytes held by scene geometry and textures (shared buffers counted once), for memory checks. A level
     * decoded only for its upload (nativeTexture's decodedOnUpload) counts while it is held. */
    memoryCounts:async()=>{const seen=new Set<ArrayBufferLike>();let geometry=0,textures=0,textureCount=0,compressed=0;const seenTextures=new Set<unknown>();const add=(b:ArrayBufferLike|undefined)=>{if(!b||seen.has(b))return 0;seen.add(b);return b.byteLength;};
      render.scene.traverse(o=>{const g=(o as any).geometry;if(g)for(const a of Object.values(g.attributes??{}) as any[])geometry+=add(a.array?.buffer);if(g?.index)geometry+=add(g.index.array.buffer);const ms=[(o as any).material].flat().filter(Boolean);
        const texture=(v:any)=>{if(!v?.isTexture||seenTextures.has(v))return;seenTextures.add(v);let n=0;for(const level of v.mipmaps?.length?v.mipmaps:[v.image])if(!level?.released)n+=add(level?.data?.buffer);if(n){textures+=n;textureCount++;if(v.isCompressedTexture)compressed++;}};
        for(const m of ms)for(const v of Object.values(m))texture(v);for(const u of Object.values(ms[0]?.uniforms??{}) as any[])texture(u?.value);});
      const archive=await import('./assets/staticWorldArchive').then(m=>m.openStaticWorld(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));
      return {geometryMB:geometry/1e6,texturesMB:textures/1e6,textureCount,compressed,chunkCacheMB:archive.stats().retainedBytes/1e6};},
    /** Rigid bodies by kind, for performance checks. */
    bodyCounts:()=>{let fixed=0,dynamic=0,kinematic=0,colliders=0;sim.world.bodies.forEach(b=>{if(b.isFixed())fixed++;else if(b.isDynamic())dynamic++;else kinematic++;});sim.world.colliders.forEach(()=>{colliders++;});return {fixed,dynamic,kinematic,colliders};},
    /** A cop's CTaskComplexCarSlowBeDraggedOut on the seated player. */
    dragPlayerOut:()=>carEntry.dragOut(),
    /** Turns the player's car onto its roof where it stands. */
    flipCar:()=>{if(!worldCar)return false;const b=worldCar.car.body,t=b.translation();b.setTranslation({x:t.x,y:t.y+1.5,z:t.z},true);b.setRotation({x:0,y:0,z:1,w:0},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);return true;},
    /** CVehicle::m_HornCounter on the player's car. */
    setHorn:(counter:number)=>{if(!worldCar)return false;worldCar.horn.counter=counter;return true;},
    /** Sets the player's car rolling along its forward axis at `speed` m/s. */
    launchCar:(speed:number)=>{if(!worldCar)return false;const b=worldCar.car.body,q=b.rotation(),f=new Vector3(0,0,-1).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w));b.setLinvel({x:f.x*speed,y:0,z:f.z*speed},true);return true;},
    /** Smashed placements in the current window whose collider is enabled again (should stay 0). */
    revivedProps:()=>[...(importedScene?.sources.entries()??[])].filter(([handle,source])=>source.placement&&smashedPlacements.has(placementKey(source.modelName,source.placement.position))&&sim.world.getCollider(handle)?.parent()?.isEnabled()).length,
    carContacts:()=>{
      if(!worldCar)return null;const body=worldCar.car.body,out:{model:string|null;kind:string|null;fixed:boolean|null;handle:number}[]=[];
      for(let i=0;i<body.numColliders();i++)sim.world.contactPairsWith(body.collider(i),other=>{const source=importedScene?.sources.get(other.handle);out.push({model:source?.modelName??null,kind:source?.entityKind??null,fixed:other.parent()?.isFixed()??null,handle:other.handle});});
      return out;
    },
    proceduralPixelProbe:()=>{
      const root=render.scene.getObjectByName('native-procedural-objects');if(!root)return {changed:0};
      const renderer=render.renderer,gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,visible=root.visible;
      const read=()=>{renderer.render(render.scene,render.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
      try{const withObjects=read();root.visible=false;const without=read();let changed=0;for(let i=0;i<withObjects.length;i+=4)if(withObjects[i]!==without[i]||withObjects[i+1]!==without[i+1]||withObjects[i+2]!==without[i+2])changed++;return {changed};}
      finally{root.visible=visible;renderer.render(render.scene,render.camera);}
    },
    /** CTheScripts as it stands this frame: what the original script has set, and where it stopped. */
    scm:()=>mission?mission.snapshot():null,
    /** The entry-exit manager, for a spec checking that the script's switches reach it. */
    entryExits:()=>entryExits,
    /** The set pieces, for a spec checking whose table it is running. */
    setPieces:()=>setPieces,
    /** The stunt jump manager, for a spec checking whose list it is running. */
    stuntJumps:()=>stuntJumps,
    /** The particle manager, for a spec checking what a script's own systems do. */
    worldFx:()=>worldFx,
    /** The views the script's own objects are drawn in. */
    scriptObjectViews:()=>scriptObjectViews,
    /** The mission itself, so a measurement can step it on its own and see what a frame of script costs. */
    missionForProfiling:()=>mission,
    /** CTimer::m_snTimeInMilliseconds as the game frames count it. */
    gameTimeMs:()=>gameTimeMs,
    /** The car recordings streamed so far, and the last failure. */
    carRecordings:()=>carRecordings,
    /** START_PLAYBACK_RECORDED_CAR on a script car, for a spec driving one along a recording. */
    startCarPlayback:(car:number,fileNumber:number,looped=false)=>{const host=mission?.runtime.game.carRecordingHost;return host?startPlaybackRecordedCar(host,car,fileNumber,false,looped):-1;},
    /** CClothes::RebuildPlayerIfNeeded, as a restart or an entry-exit transfer runs it. */
    rebuildPlayerIfNeeded:()=>rebuildPlayerIfNeeded(),
    /** The ratios CJ's body was last built with, and its bind-pose half width. */
    playerBody:()=>({ratios:playerBody?{...playerBody.ratios}:null,extent:render.nativeCharacter?.bodyExtent()??null}),
    /** One pixel of a freshly drawn frame at fractions of the drawing buffer (GL origin bottom-left): the frame
     * limiter skips presenting on most animation frames, so a read from a spec's own callback sees a cleared buffer. */
    readPixel:(xFraction:number,yFraction:number)=>{
      const renderer=render.renderer,gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixel=new Uint8Array(4);
      renderer.render(render.scene,render.camera);gl.readPixels(Math.floor(width*xFraction),Math.floor(height*yFraction),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];
    },
    /** The frame with and without the named post-effect quads: pixels changed and the mean channel gain. */
    postEffectPixelProbe:(names:string[])=>{
      const renderer=render.renderer,quads:import('three').Object3D[]=[];postEffects.group.traverse(o=>{if(names.includes(o.name))quads.push(o);});const visible=quads.map(q=>q.visible);
      const gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
      const read=()=>{renderer.render(render.scene,render.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
      try{
        const withQuads=read();for(const q of quads)q.visible=false;const without=read();let changed=0,darkened=0;const gain=[0,0,0];
        for(let i=0;i<withQuads.length;i+=4){let delta=false;for(let j=0;j<3;j++){const d=withQuads[i+j]-without[i+j];gain[j]+=d;if(d!==0)delta=true;if(d<0)darkened++;}if(delta)changed++;}
        const n=width*height;return {quads:quads.length,visible:visible.some(Boolean),changed,darkened,meanGain:gain.map(g=>+(g/n).toFixed(3)),pixels:n};
      }finally{quads.forEach((q,i)=>{q.visible=visible[i];});renderer.render(render.scene,render.camera);}
    },
    /** The frame with the colour filter scaled in place against the native passes over the copied frame: how many
     * pixels differ, and by how much at most (a channel step), in one go so nothing moves between the two. */
    colourFilterPathProbe:()=>{
      const renderer=render.renderer,gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
      const read=()=>{renderer.render(render.scene,render.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
      const both=postEffects.drawBothColourFilterPaths(read);if(!both)return null;
      let differ=0,max=0;for(let i=0;i<both.current.length;i+=4){let d=0;for(let j=0;j<3;j++)d=Math.max(d,Math.abs(both.current[i+j]-both.native[i+j]));if(d>0)differ++;if(d>max)max=d;}
      return {pixels:width*height,differ,max};
    },
    /** The frame with and without the colour filter quad: pixels changed and the mean channel gain. */
    colourFilterPixelProbe:()=>{
      const renderer=render.renderer,quads=postEffects.colourFilterQuads,visible=quads.map(q=>q.visible);
      const gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
      const read=()=>{renderer.render(render.scene,render.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
      try{
        const withFilter=read();for(const q of quads)q.visible=false;const without=read();let changed=0,darkened=0;const gain=[0,0,0];
        for(let i=0;i<withFilter.length;i+=4){let delta=false;for(let j=0;j<3;j++){const d=withFilter[i+j]-without[i+j];gain[j]+=d;if(d!==0)delta=true;if(d<0)darkened++;}if(delta)changed++;}
        const n=width*height;return {visible:visible.some(Boolean),changed,darkened,meanGain:gain.map(g=>+(g/n).toFixed(3)),pixels:n};
      }finally{quads.forEach((q,i)=>{q.visible=visible[i];});renderer.render(render.scene,render.camera);}
    },
    shadowPixelProbe:()=>{
      const renderer=render.renderer,mesh=render.nativeShadow.draw.mesh,visible=mesh.visible;
      const gl=renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
      const read=()=>{renderer.render(render.scene,render.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
      try{
        const withShadow=read();mesh.visible=false;const without=read();let changed=0,maxDarkening=0,brightened=0;
        for(let i=0;i<withShadow.length;i+=4){let delta=0;for(let j=0;j<3;j++){delta=Math.max(delta,without[i+j]-withShadow[i+j]);if(withShadow[i+j]>without[i+j])brightened++;}if(delta>0)changed++;maxDarkening=Math.max(maxDarkening,delta);}
        return {visible,changed,maxDarkening,brightened};
      }finally{mesh.visible=visible;renderer.render(render.scene,render.camera);}
    },
    shadowReceiverProbe: () => {
      const p=sim.player.position;
      const result=importedScene?.shadowReceivers({center:{x:p.x,y:p.y+1,z:p.z},side:{x:1,z:0},front:{x:0,z:1},depth:4});
      const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray({x:p.x,y:p.y+.15,z:p.z},{x:0,y:-1,z:0}),.5,true,undefined,undefined,sim.playerCollider);
      const ground=hit&&importedScene?.sources.get(hit.collider.handle);
      return result ? {candidates:result.candidateCount,triangles:result.triangleCount,vertices:result.vertexCount,models:result.chunks.map(c=>c.modelName),ground:ground?{model:ground.modelName,kind:ground.source.kind,face:hit?.featureId,count:ground.source.kind==='mesh'?ground.source.mesh.indices.length/3:0,position:p}:null} : null;
    },
    gangWars:()=>gangWars,
    police:()=>police,
    emergency:()=>emergency,
    state: () => ({ frameLimiter:display.frameLimiter, escalators:escalators.snapshot(), volumetricClouds:volumetricClouds.snapshot(), roadsigns:roadsigns.snapshot(), colourFilter:{...postEffects.snapshot().colourFilter,extraMult:+colourFilterState.extraMult.toFixed(4)}, postEffects:postEffects.snapshot(), occlusion:{...occlusion.snapshot(),culled:importedScene?.occludedCount()??0}, shinyTexts:shinyTexts.drawn, waterCannon:{id:waterCannon.id,sections:waterCannon.sections().length,points:waterCannon.sections().map(s=>[+s.point.x.toFixed(1),+s.point.y.toFixed(1),+s.point.z.toFixed(1)]),drawn:waterCannonMesh.drawn,yaw:+cannonAim.yaw.toFixed(3),pitch:+cannonAim.pitch.toFixed(3)}, gangWars:gangWars?.snapshot()??null, headlightBeams:headlightBeams.drawn,tank:fleet?.occupied?.modelId===432?{yaw:+tankTurret.yaw.toFixed(3),pitch:+tankTurret.pitch.toFixed(3)}:null,carLightPools:carLightPoolsTwin.drawn+carLightPoolsSingle.drawn, jetPack:sim.jetPack?{worn:jetPackView.worn,balls:jetPackView.ballAngles(),error:jetPackView.error??null,flames:jetFlames.filter(f=>f&&!f.destroyed).length,thrustFwd:sim.jetPack.thrustFwd,strafe:+sim.jetPack.thrustStrafe.toFixed(3),angle:+sim.jetPack.thrustAngle.toFixed(3),fx:+sim.jetPack.fxKeyTime.toFixed(2),legs:[+sim.jetPack.legSwingFwd.toFixed(3),+sim.jetPack.legSwingSide.toFixed(3)]}:null, coronaFlares:{drawn:coronaFlaresMesh.drawn,sun:flareSun}, coronaReflections:{drawn:coronaReflections.drawn,candidates:coronaReflectionCandidates}, setPieces:setPieces?{count:setPieces.pieces.length,generated:setPieces.lastGeneration.filter(t=>t>0).length,attempts:setPieceAttempts,error:setPieceError}:null, tags:tagManager?{total:tagManager.numTags,tagged:tagManager.numTagged,sprayed:tagManager.saved().length}:null, planeTrails:trailsMesh.drawn, bulletTraces:bulletTracesMesh.drawn/12, streaks:streaksMesh.drawn/6, money:sim.money, cheats:{times:cheats.timesCheated,active:[...cheats.active],timeScale:cheatTimeScale}, brightLights:{vertices:brightMesh.drawn,center:brightMesh.firstCenter}, sunReflection:sunReflectionMesh.visible, markers3d:{drawn:markersMesh.drawn,arrows:markersMesh.arrowsDrawn,active:markers3d.numActiveMarkers,error:markersMesh.error??null,center:markersMesh.firstCenter,first:(m=>m?{position:[...m.position],size:m.size}:null)(markers3d.markers.find(m=>m.hasAtomic)),list:markers3d.markers.filter(m=>m.hasAtomic&&m.type>=0).map(m=>({id:m.id,type:m.type,position:m.position.map(v=>+v.toFixed(2)),size:+m.size.toFixed(2),colour:[...m.color]}))}, coronas:{sceneFx:sceneFx.length,pools:lightPools.drawn,firstPool:lightPools.first,count:coronas.count,drawn:worldCoronas.drawn,lit:importedScene?.litPlacements().length??0,first:worldCoronas.firstCenter}, lastBulletLine:lastBulletLine??null, birds:{count:birds.count,drawn:birdsMesh.drawnBirds,shot:birds.shot??null,positions:birds.birds.filter(b=>b.created).map(b=>[...b.position])}, duck:{x:duck.x,y:duck.y,rolling:duck.rolling}, entryExits:entryExits?{state:entryExits.state,active:entryExits.active?.enex.name??null,loading:!!interiorTransfer,stack:entryExits.stack.map(e=>e.name),count:entryExits.pool.length}:null, skidmarks:skids.snapshot(), weather:{...weather.snapshot(),effects:weatherEffects.snapshot(),movingFog:movingFog.snapshot()},fx:worldFx.snapshot(),police:police?.snapshot()??null,emergency:emergency?.snapshot()??null,driveby:driveby?.snapshot()??null,pickups:pickups.snapshot(),drops:drops.snapshot(),carEntry:carEntry.snapshot(),progression:progression.snapshot(),stuntJumps:stuntJumps?.snapshot()??null,occupants:occupants.snapshot(),wanted:law.snapshot(),weapons:{...weapons.snapshot(),error:weaponView.error??null,arsenal:arsenal.open,gunSpin:+weaponView.gunSpinSpeed.toFixed(3)}, traffic:traffic?.snapshot()??null, pedestrians:pedestrians?.snapshot()??null, aircraft:fleet?.occupiedPlane?.snapshot()??null, fleet:fleet?.snapshot()??null, nativeCar:worldCar&&!worldCar.disposed?{occupied:worldCar.occupied,colours:worldCar.assets.colourIndices??null,touchingSand:worldCar.touchingSand,boggedDown:worldCar.boggedDownInSand,wheelMaterials:worldCar.wheelGround.map(g=>g?.material??null),gas:worldCar.gasPedal,health:worldCar.health,wrecked:worldCar.wrecked,upsideDown:worldCar.upsideDownCounter,doors:worldCar.doors.map((door,i)=>({angle:door.angle,ratio:door.ratio,status:worldCar!.damageState.doors[i]})),debris:worldCar.debris.count,propsSmashed:worldCar.propsSmashed,propsUprooted:worldCar.propsUprooted,tyres:[...worldCar.damageState.wheels],wheels:worldCar.car.wheelSnapshot(),position:{...worldCar.car.body.translation()},velocity:{...worldCar.car.body.linvel()},spin:{...worldCar.car.body.angvel()}}:null, breakObjects:{active:breakManager.activeCount,drawn:breakPieces.count,groups:breakManager.objects.filter(o=>o.active).map(o=>o.groups.map(g=>({z:+g.matrix[11].toFixed(2),frames:g.framesToLive,stopped:g.stoppedMoving})))},proceduralCollisionSources:[...(importedScene?.sources.values()??[])].filter(source=>source.procedural).length, nativeVegetation:importedScene?.vegetation()??null, following:follower?{...follower.snapshot(),supportOverrides,lastSupportMiss:lastSupportMiss??null,lastSwap:lastSwap??null,holds:{...terrainHolds},latencyEma:Math.round(latencyEma),leadSeconds:follower.leadSeconds}:null,objectKinds: [...(importedScene?.sources.values()??[])].map(source=>source.entityKind), imported: sim.imported, importedInstances: importedScene?.instanceCount ?? 0, importedReusedColliders:importedScene?.reusedColliderCount??0,importedReusedPlacements:importedScene?.reusedPlacementCount??0, physics:{colliders:sim.world.colliders.len(),bodies:sim.world.bodies.len()},pooledModels:importedScene?.pooledModelCount??0, retiredModels:importedScene?.retiredModelCount??0, retiredModelMB:+(importedScene?.retiredModelMB??0).toFixed(1), frameProfile:{...frameProfile,renderSections:{...render.profile}}, uvAnimators:importedScene?.uvAnimatorCount??0, modelBuild:{...modelBuildStats}, subsystemFaults:[...subsystemFaults].map(([message,count])=>({message,count})), visibleImportedInstances: importedScene?.visibleInstanceCount ?? 0, visibleImportedModels: importedScene?.visibleModels() ?? [], paused, terrainHold:terrainPause, nativeShadow: render.nativeShadow.snapshot(), nativeContactLighting: render.contactLighting ?? null, nativeCharacter: render.nativeCharacter?.snapshot() ?? null, deathRemaining: sim.deathRemaining, knockdown: sim.knockdown, stuckUnderCar:playerStuckUnderCar, playerCarHits:{...playerCarHits,push:{...sim.collisionPush},stuck:sim.playerStuck}, gameLogicState: gameLogic.state, fadeAlpha: cameraFade.value, restartPoints: {hospitals:nativeRestart.hospitals.length,police:nativeRestart.police.length}, player: { ...sim.player, position: { ...sim.player.position } },moneyDrops:moneyDrops.snapshot(),climb:sim.climb?{clip:sim.climb.anim?.clip??null,time:sim.climb.anim?.time??0,blend:sim.climb.anim?.blend??0,heightForAnim:sim.climb.heightForAnim,heightForPos:sim.climb.heightForPos,hold:{...sim.climb.hold}}:null,climbReady:!!sim.climbDurations,
      camera: { mode: render.distanceMode, distance: render.followDistance, far: render.camera.far, fog: render.scene.fog?.toJSON(), yaw: render.yaw, viewYaw: render.viewYaw, pitch: render.viewPitch, glance: render.glance, position: render.camera.position.toArray(), firstPerson: render.firstPerson??null, fov: render.fov, verticalFov: render.camera.fov, near: render.camera.near },
      movementSurfaceDefinitions:surfaceSprint?.size??0,surfaceSprintBlocked,
      audio: {...sound.state(),surfaceDefinitions:surfaceAudio?.byId.size??0,ambience:{track:ambience.trackId,status:ambience.status,volume:+ambience.volume.toFixed(2),zones:mission?.runtime.game.audioZones.activeIds??[]}}, timeMinutes: sim.timeMinutes, lighting: { area: render.lighting.area, sunMultiplier: render.lighting.sunLightMultiplier, night: render.lighting.night, imported: localLighting.name, weather: localLighting.weather, regionalModifiers:localLighting.modifierCount, native: localLighting.sample(sim.timeMinutes,render.camera.position) },
      tick: clock.tick, memory: { ...render.renderer.info.memory }, draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles }),
  } });
  /** How long a group button has been held. The game's help text: "Holding GROUP_CONTROL_FWD or GROUP_CONTROL_BWD for a
   * few seconds ... will disband your group"; the exact hold is in the unreversed ProcessGroupBehaviour, so authored. */
  let groupButtonHeld=0;
  const GROUP_DISBAND_HOLD_SECONDS=2;
  /** weapon.dat UNARMED's target range, for a target with no weapon row. */
  const GROUP_RECRUIT_MELEE_RANGE=10;
  /** When the scripts last read each pad button (scriptButtons). */
  const scriptReads=new ScriptButtonReads();
  /** Who the group buttons are aimed at: with PED_LOCK_TARGET held, a gun's crosshair names the ped; otherwise the
   * nearest ahead within the weapon's target range. Without it, nobody (the buttons command the group). */
  /** Who Y and N speak to: with PED_LOCK_TARGET held, the crosshair's ped or the nearest ahead within the weapon's
   * range; without it, the nearest ahead within a few steps. */
  const talkTarget=()=>{const info=weapons.inventory.info(),crosshair=['bullet','shotgun','rocket'].includes(weapons.inventory.weapon.kind);
   return input.down('MouseAim')?{handle:crosshair?weapons.lock?.handle??undefined:undefined,range:info?.targetRange??GROUP_RECRUIT_MELEE_RANGE}:{range:CONVERSE_RANGE};};
  const groupTarget=()=>{const info=weapons.inventory.info(),crosshair=['bullet','shotgun','rocket'].includes(weapons.inventory.weapon.kind);
   return input.down('MouseAim')?{handle:crosshair?weapons.lock?.handle??-1:undefined,range:info?.targetRange??GROUP_RECRUIT_MELEE_RANGE}:undefined;};
  /** How near a ped must be to hear CJ's Y or N without the aim button (authored). */
  const CONVERSE_RANGE=4;
  /** The frames drawn as the game is first held, and after anything that may change what is behind the menu. */
  const HELD_REDRAWS=3,HELD_REDRAW_MS=2000;let heldRedraws=HELD_REDRAWS,heldDrawnAt=-Infinity;
  const redrawHeld=()=>{heldRedraws=HELD_REDRAWS;};
  for(const type of ['pointerdown','keydown','input','change','resize'] as const)window.addEventListener(type,redrawHeld,{capture:true,passive:true});
  canvas.addEventListener('webglcontextrestored',redrawHeld);
  function animate(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    // Frame pacing: the limiter's 30 a second in play, 10 a second under the menu, or every display frame when off.
    // A skipped frame leaves `last` alone so the simulation clock still receives the whole interval.
    // The pause menu, the full map and the arsenal all hold the game: the world behind them draws at the menu's rate.
    if(!frameDue(pacer,now,paused||navigation?.open||arsenal.open?MENU_FPS:display.frameLimiter?FRAME_LIMITER_FPS:undefined))return;
    // A touch screen's first play is measured (autoQuality): a game that cannot keep up steps its quality down.
    // Measured in free play only: not under a menu, a load, a hidden page, or a cutscene or scripted scene, whose
    // subtitles the message would cover.
    // Once settled (play on foot or at the wheel, each judged on its own), the same free play steers the adaptive
    // resolution: a phone held back as it warms draws fewer pixels.
    if(autoQuality||dynamicResolution&&touchSettings.dynamicResolution){const scene=!!mission&&(mission.runtime.game.cutscene.running||mission.runtime.game.widescreenOn);
     const playing=started&&!paused&&!navigation?.open&&!arsenal.open&&!terrainPause&&!scene&&document.visibilityState==='visible';
     const context:QualityContext=fleet?.occupiedPlane?'aircraft':worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||playerPassenger?'vehicle':'foot';
     if(autoQuality?.measuring(context)){const verdict=autoQuality.frame(now,playing,context);
      if(autoQuality.settled){keepMeasured(autoQuality.settled);autoQuality.settled=undefined;}
      if(verdict)settleQuality(verdict);}
     else if(dynamicResolution?.frame(now,playing)!==undefined)applyResolution();}
    input.frameStart();
    // A queued frame timestamp can predate the performance.now() baseline set on resume.
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.1)); last = now;
    // The pads' shakes: the menus' vibration setting (on a touch screen the touch settings'), none in a cutscene, run
    // down with the frames, and each taken request felt on the pad or the phone.
    {const pads=mission?.runtime.game.pads;if(pads){pads.useVibration=touch?touchSettings.vibration:true;pads.cutsceneRunning=!!mission?.runtime.game.cutscene.running;
      pads.onShake??=padShake;if(!paused)pads.stepShake(dt*1000);}}
    {const vehicle=!!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger);
     const pad=gamepad.poll(dt,paused||navigation?.open||arsenal.open?'menu':fleet?.occupiedPlane?'aircraft':vehicle?'vehicle':render.firstPerson?'scope':'foot',now);
     const padNames=gamepad.lastUsed>Math.max(lastTouchAt,lastKeyAt)?gamepad.family:undefined,flying=!!fleet?.occupiedPlane;
     if(padNames!==namingPad||flying!==namingFlying){namingPad=padNames;namingFlying=flying;setControlNaming({pad:padNames,flying});}
     // A keyboard played on a touch screen: the help names its keys, a help up reads again with them, and the buttons step aside.
     // A phone left untouched mid-game lets its screen go dark on its own time, and a touch keeps it on again.
     if(screenAwake&&started&&!paused){const scene=!!mission&&(mission.runtime.game.cutscene.running||mission.runtime.game.widescreenOn);
      const idle=screenIdle({fingers:fingersDown,lastActivity:Math.max(lastTouchActivityAt,lastKeyAt,gamepad.lastUsed),now,scene,idleMs:screenIdleMs});
      if(idle!==screenIdled){screenIdled=idle;void screenAwake.hold(!idle);}}
     const keys=!!touch&&lastKeyboardAt>Math.max(lastTouchAt,gamepad.lastUsed);
     if(keys!==keysPlayed){keysPlayed=keys;setControlNaming({keys});touch?.setKeyboard(keys);if(hud.helpShowing())shownScript.helpRevision=-1;}
     if(pad.start)input.onPause();else if(pad.menuMove||pad.menuSelect)padMenu(pad.menuMove,pad.menuSelect);}
    let alpha = 1;
    if(input.consume('Backquote')&&!paused&&!navigation?.open)arsenal.toggle();
    // CPad::CollectPickupJustDown is PED_ANSWER_PHONE (Tab), and false while DisablePlayerControls.
    if(input.consume('Tab')&&!paused&&!navigation?.open&&!arsenal.open&&!playerControlsDisabled())pickups.collectJustDown();
    // The group buttons, GROUP_CONTROL_FWD (G) and GROUP_CONTROL_BWD (H), on foot: a targeted Families member joins,
    // otherwise the group follows (G) or stays in position (H); holding either disbands it.
    {
     const onFoot=!paused&&!navigation?.open&&!arsenal.open&&!worldCar?.occupied&&!fleet?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!carEntry.active;
     // SET_PLAYER_GROUP_RECRUITMENT off (m_bGroupStuffDisabled) stops ProcessGroupBehaviour altogether.
     const enabled=onFoot&&!!pedestrians&&!mission?.runtime.game.playerInfo.groupStuffDisabled;
     // In a vehicle the buttons are the vehicle's (G raises an aircraft's gear, H sounds the horn).
     const forward=enabled&&input.consume('KeyG'),back=enabled&&input.consume('KeyH');
     const held=enabled&&(input.down('KeyG')||input.down('KeyH'));
     groupButtonHeld=held?groupButtonHeld+dt:0;
     if(held&&groupButtonHeld>=GROUP_DISBAND_HOLD_SECONDS&&groupButtonHeld-dt<GROUP_DISBAND_HOLD_SECONDS)pedestrians!.disbandGroup();
     if(enabled&&(forward||back)){
      const result=pedestrians!.groupControl(forward?'forward':'back',groupTarget());
      // Recruiting shows no text in the original; the recruit answers with a line.
      if(result==='joined'){const p=sim.player.position;sound.nativeEngine?.speech('greet',{x:p.x,y:-p.z,z:p.y});}
     }
     // CPad::ConversationYesJustDown and ConversationNoJustDown (Y and N here): CJ says something positive or negative
     // to the ped he targets (with the aim button, the crosshair's ped or the nearest ahead; without it, the nearest
     // ahead within a few steps), and the ped answers (WorldPedestrians.converse).
     const yes=onFoot&&input.consume('KeyY'),no=onFoot&&input.consume('KeyN');
     // A script's conversation waiting for an answer takes it first (CConversationForPed::Update reads the same pad).
     const answered=(yes||no)&&!playerControlsDisabled()&&!!mission?.runtime.game.conversations.answer(yes?'yes':'no');
     if(!answered&&(yes||no)&&!playerControlsDisabled()&&sim.player.health>0&&sim.knockdown===0&&pedestrians){
      if(pedestrians.converse(yes?'yes':'no',talkTarget())!=='none'){const p=sim.player.position;sound.nativeEngine?.speech(yes?'greet':'threat',{x:p.x,y:-p.z,z:p.y},Math.abs(Math.floor(p.x*13-p.z*7)));}
     }
    }
    // Vehicle radio tuning (N cycles the 11 stations while driving).
    // N tunes on, Shift+N back; the touch Radio button swiped to the left tunes back too (RadioBack).
    {const on=input.consume('KeyN'),back=input.consume('RadioBack');
     if((on||back)&&!paused&&radioModel!==undefined){const station=sound.nativeEngine?.tuneRadio(back||input.down('ShiftLeft')||input.down('ShiftRight')?-1:1);if(station)hud.radioName(station);}}
    // ProcessPlayerWeapon drops the aim of any non-melee weapon while the player sprints.
    // A weapon aimed with the arm (the pistols, the Uzi and Tec-9) keeps PlayerControlZelda, which sprints on the sprint
    // button while he moves; that sprint (PEDMOVE_SPRINT with m_nWeaponFire) ends the use-gun task. The aimed walk never
    // reports a sprint itself, so the button is read here; ZeldaWeapon's two-handed guns never sprint.
    const armAimInfo=weapons.inventory.info(),armAimed=!!armAimInfo&&!!(armAimInfo.flags&WEAPON_FLAG.aimWithArm);
    // The aim button held with a gun wins over the sprint button: CJ drops out of the sprint into the aimed walk, so
    // aiming works from a sprint as it does from a run (the sprint button is released for the step below too).
    const aimOverridesSprint=input.down('MouseAim')&&weapons.inventory.weapon.kind!=='melee'&&!!armAimInfo&&armAimInfo.fire!=='melee'&&armAimInfo.fire!=='use';
    // Only a real PEDMOVE_SPRINT drops the arm's aim: sprint disabled or a surface that cannot be sprinted on leaves a run.
    const armSprint=armAimed&&!aimOverridesSprint&&(input.down('ShiftLeft')||input.down('ShiftRight'))&&!sim.player.sprintExhausted&&!playerSprintDisabled()&&!surfaceSprintBlocked&&(()=>{const a=input.axes();return Math.hypot(a.x,a.y)>0;})();
    const playerSprinting=(!!render.nativeCharacter?.sprinting||armSprint)&&weapons.inventory.weapon.kind!=='melee'&&!aimOverridesSprint;
    // CTaskSimplePlayerOnFoot, whose ProcessPlayerWeapon aims and fires, is not the task running while a knockdown's fall
    // and get-up (the event-response slot) or the death sequence owns the player, nor while a jump's launch or the
    // in-air task does (CTaskComplexJump replaces it as the primary task until the landing).
    const playerDown=sim.knockdown>0||sim.player.health<=0;
    const playerJumping=!!render.nativeCharacter?.jumping&&!sim.jetPack&&!sim.player.swimming;
    // CPad::GetTarget answers false while DisablePlayerControls is set (the script's SET_PLAYER_CONTROL, the skip
    // camera, an arrest), and ProcessPlayerWeapon never runs in a passenger seat.
    weapons.aiming=!paused&&!arsenal.open&&!navigation?.open&&!playerControlsDisabled()&&!law.arrested&&!playerPassenger&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!sim.player.swimming&&!sim.climbing&&!playerSprinting&&!carEntry.active&&!bikeMount.active&&!playerDown&&!playerJumping&&input.down('MouseAim');
    // ProcessPlayerWeapon: aiming a b1stPerson weapon puts the camera in its weapon mode; releasing the button leaves it.
    const firstPerson=weapons.aiming?firstPersonMode(weapons.inventory.selected,weapons.inventory.info()):undefined;
    // ProcessPlayerWeapon puts the camera in MODE_AIMWEAPON only for a weapon it aims: with nothing locked (the mouse camera
    // clears the lock) a melee weapon, a thrown one or a used one (goggles, detonator, parachute) sets lookAtTarget and the
    // follow camera stays.
    const aimCamera=weapons.aiming&&(!!firstPerson||(f=>f==='instant'||f==='area')(weapons.inventory.info()?.fire));
    render.aiming=aimCamera;render.firstPerson=firstPerson;weapons.firstPerson=firstPerson;
    // PED_SNIPER_ZOOM_IN and ZOOM_OUT held: PgUp and PgDn, with the optional X and Z.
    render.zoomInput.held=input.down('PageUp')||input.down('KeyX')?1:input.down('PageDown')||input.down('KeyZ')?-1:0;
    exitJustDown=false;
    if (!paused&&!terrainPause&&!navigation?.open&&!arsenal.open) {
      const tPopulation=performance.now();
      guard('traffic.update',()=>traffic?.update(now));guard('police.update',()=>police?.update(now));guard('driveby.update',()=>driveby?.update(now));
      // CAutomobile::ScanForCrimes: an AI law-enforcement car within 20 units of the player's automobile whose alarm is
      // sounding gives him a star (SetWantedLevelNoDrop(WANTED_LEVEL_1)).
      guard('scanForCrimes',()=>{const own=fleet?.occupied;if(!own||own.wrecked||own.alarm<=0)return;const p=own.car.body.translation();
       for(const car of fleet!.cars){if(car===own||car.wrecked||car.occupied||!car.autopilot||!LAW_ENFORCEMENT_MODELS.has(car.modelId))continue;const c=car.car.body.translation();if((c.x-p.x)**2+(c.y-p.y)**2+(c.z-p.z)**2<400){law.setLevelNoDrop(1);break;}}});
      guard('pedestrians.update',()=>pedestrians?.update(now));
      // CTimer::m_FrameCounter's 30 fps game frames, from game time, so frame-counted waits (the car generators' 20-frame
      // start window, CAudioZones' 16-frame cadence) keep their length whatever the display rate.
      const gameFrame=Math.floor(gameTimeExact*30/1000),newGameFrames=Math.min(6,Math.max(0,gameFrame-lastGameFrame));lastGameFrame=gameFrame;
      guard('fleet.update',()=>{for(let f=gameFrame-newGameFrames+1;f<=gameFrame;f++)fleet?.tickFrame(f,gameTimeMs,playerPassenger?.car);fleet?.update(now);});
      // CAudioZones::Update from Game.cpp's frame, with the camera's position.
      if(newGameFrames){const c=render.camera.position;mission?.runtime.game.audioZones.update(false,[c.x,-c.z,c.y],gameFrame);
       // CWaterLevel::PreRenderWater's FindNearestWaterAndItsFlow, every 32nd frame where the area can see water
       // (CGame::CanSeeWaterFromCurrArea), and on the first.
       const nearest=render.lighting.water.nearest,area=render.lighting.area;
       if(nearest&&(area===0||area===5))for(let f=gameFrame-newGameFrames+1;f<=gameFrame;f++)if(f%32===29||cameraWaterFrame<0){cameraWater=nearest.find(c.x,-c.z);cameraWaterFrame=f;}
       // CAEAmbienceTrackManager::Service, with CAudioEngine's, once a game frame (its rise and fade are steps a frame):
       // the zone's (or the sandstorm's) looped track, else the sea's or the riots'. The choice is held while a beat or
       // cutscene track plays and while the game is paused.
       if(mission){const g=mission.runtime.game,p=sim.player.position;
        const riots=laRiotsActiveHere({x:p.x,y:-p.z,z:p.y},CHEATS.isActive('riot'),laRiots);
        for(let i=0;i<newGameFrames;i++)ambience.service({zone:g.audioZones.firstActive,camera:[c.x,-c.z,c.y],sandstorm:weatherStarted?weather.sandstorm:0,
         outside:area===0,noRain:cullZones.camNoRain||cullZones.playerNoRain,underwaterness:weather.underwaterness,water:cameraWater,riots,radio:sound.nativeEngine,
         held:paused||g.cutsceneTrack.active,trackHold:g.cutsceneTrack.active||g.widescreenOn||performance.now()<=ambienceHeldUntil,nowMs:gameTimeMs});}}
      // CCheckpoints::Update (CSpecialFX::Update), once a game frame.
      if(mission){const cps=mission.runtime.game.checkpoints.markers;cps.player=checkpointPlayer;for(let i=0;i<newGameFrames;i++)cps.update();}
      {const c=render.camera.position,p=sim.player.position;
       for(let f=gameFrame-newGameFrames+1;f<=gameFrame;f++)cullZones.update(f,[c.x,-c.z,c.y],[p.x,-p.z,p.y],!!mission?.runtime.game.militaryZonesDisabled,()=>{if(sim.player.health>0)law.setLevelNoDrop(5);});cullAirResistance.multiplier=cullZones.extraAirResistance?VEHICLE_AIR_RESISTANCE_MULT:1;}worldCar=carEntry.car??fleet?.nearest()??(worldCar?.disposed?undefined:worldCar);
      frameProfile.population+=performance.now()-tPopulation;
      // CTaskComplexLeaveCar keeps asking CanPedJumpOutCar each frame, slowing the aircraft, until the pilot can go.
      const planeExitReady=!!fleet?.occupiedPlane?.exitPending&&fleet.occupiedPlane.leaveMode()!=='wait';
      if(planeExitReady)fleet!.occupiedPlane!.exitPending=false;
      if(passengerExitPending){const ride=playerPassenger;if(!ride)passengerExitPending=false;else if(ride.car.disposed){passengerExitPending=false;leavePassengerSeat();}else if(ride.car.canStepOut()?leavePassengerSeat(false,true):ride.car.canJumpOut()&&leavePassengerSeat(false,true,true))passengerExitPending=false;}
      // CPad::DisablePlayerControls (SET_PLAYER_CONTROL off): every pad query answers 0, the exit button included.
      exitJustDown=!sim.climbing&&input.consume('KeyF')&&!playerControlsDisabled()&&!padSwitchedOff('enterCar');
      if(!sim.climbing&&(exitJustDown||planeExitReady)&&!law.arrested){
        // CTaskSimpleJetPack reads the exit-vehicle button itself, to drop the pack.
        if(sim.jetPack){/* the jetpack task owns the button */}
        // A passenger leaves through CTaskComplexLeaveCar too: CTaskSimpleCarWaitToSlowDown (SLOW_ENOUGH_TO_STEP_OR_JUMP,
        // TaskSimpleCarWaitToSlowDown.cpp:66-71) holds him in the seat until the car can be stepped or jumped out of.
        else if(playerPassenger)passengerExitPending=true;
        // The original gives no text for any of the vehicle refusals and notices below; the calls keep their effects.
        else if(sim.player.swimming){}
        // On foot the button picks a stealable object up or sets it down before it looks for a car.
        else if(!worldCar?.occupied&&!fleet?.occupied&&!fleet?.occupiedBike&&!fleet?.occupiedBoat&&!fleet?.occupiedPlane&&!carEntry.active&&mission?.playerStealKey()){}
        else{
        const plane=fleet?.nearestPlane(true);
        // Entry/exit clips resolve through the model's handling anim group; a first
        // miss starts the block load and falls back to the immediate warp this once.
        const planeSteps=(target:import('./simulation/WorldPlane').WorldPlane,phase:'getin'|'getout')=>{
         const slots=planeEntrySlots(target.assets.animGroup,phase);
         if(!slots)return undefined;
         const clips=slots.map(s=>({def:s,clip:carEntry.clips.peek(s.file,s.name)}));
         if(clips.some(c=>!c.clip))return undefined;
         return clips.map(c=>({clip:c.clip!,clipName:c.def.name.toLowerCase()}));
        };
        const installPlaneSteps=(steps:{clip:import('./assets/ifp').NativeAnimation;clipName:string}[])=>render.nativeCharacter?.installVehicleClips(Object.fromEntries(steps.map(s=>[s.clipName,s.clip])));
         if(fleet?.occupiedPlane){
          const exiting=fleet.occupiedPlane;
          const leave=exiting.leaveMode();
          if(sim.player.health>0&&leave==='wait')exiting.exitPending=true;
          // In the air a step or a jump both leave with the aircraft's velocity; the parachute is the player's choice after.
          else if(!exiting.grounded)exiting.exitAir();
          else if(leave==='jump'){const foot=exiting.exitFoot();if(foot)exiting.jumpOutOnGround(foot);}
          else{const blocked=exiting.exitCheck();
          if(!blocked){const foot=exiting.exitFoot();if(foot){const steps=planeSteps(exiting,'getout');if(steps){installPlaneSteps(steps);exiting.beginExit(foot,steps);}else exiting.finishExit(foot);}}}
         }
        else if(fleet?.occupiedBoat)fleet.occupiedBoat.interact();
        else if(fleet?.occupiedBike){const bike=fleet.occupiedBike;if(bikeMount.active){}else if(!bikeMount.ready(bike))bike.interact();else if(!bikeMount.dismount(bike))bikeMount.message=undefined;}
        else if(carEntry.seated)carEntry.exit();
        else if(carEntry.phase==='approach')carEntry.cancel();
        else if(!carEntry.active&&sim.player.health>0){
          // CPlayerInfo::FindClosestCarSectorList (unreversed): the cars in a 10-unit box around the player, each scored
          // by the reversed EvaluateCarPosition, (1 - |angle off the player's facing| / 2π) × (10 - distance); the best
          // score wins, so a car ahead beats a nearer one behind.
          const p=sim.player.position,carScore=(c:{car:{body:{translation():{x:number;z:number}}};distance():number})=>{const q=c.car.body.translation();return evaluateCarPosition(sim.player.heading,Math.atan2(q.x-p.x,q.z-p.z),c.distance());};
          const car=[...(fleet?.cars??[])].filter(c=>{const q=c.car.body.translation();return c.consideredByPlayer!==false&&Math.abs(q.x-p.x)<10&&Math.abs(q.z-p.z)<10&&Math.abs(q.y-p.y)<5;}).sort((a,b)=>carScore(b)-carScore(a))[0];
          const boat=fleet?.nearestBoat(true);
          // A bike a script ped rides (INTRO1's homies' BMXs, parked 2.5 units from CJ's) has its driver seat taken; the
          // nearest free one is the one to board.
          const scriptRidden=(b:import('./simulation/WorldBike').WorldBike)=>{const handle=mission?.vehicles.handleOf(b);return handle!==undefined&&!!mission?.peds.seatTaken(handle,'driver');};
          const bike=fleet?.nearestBike(true,scriptRidden);
          if(plane&&(!car||plane.distance()<car.distance())&&(!boat||plane.distance()<boat.distance())&&(!bike||plane.distance()<bike.distance())&&plane.distance()<10){
           // Planes, boats and bikes board without an approach to hold, so a press while the knockdown's fall and get-up
           // own CJ boards nothing (a car's approach waits for the get-up instead).
           if(sim.knockdown===0&&!plane.enterCheck()){const steps=planeSteps(plane,'getin');if(steps){installPlaneSteps(steps);plane.beginEnter(steps);}else plane.finishEnter();}
          }
          else if(boat&&(!car||boat.distance()<car.distance())&&(!bike||boat.distance()<bike.distance())&&boat.distance()<10){if(sim.knockdown===0)boat.interact();}
          else if(bike&&(!car||bike.distance()<car.distance())&&bike.distance()<10){
            // Out of boarding reach, CJ walks up to it first; within it, on he gets.
            if(sim.knockdown>0||bikeMount.active){}
            else if(bike.distance()>bikeReach(bike)){if(!bikeTooFastToBoard(bike)&&!bike.wrecked)bikeApproach={bike,time:0,best:Infinity,stall:0};}
            else boardBike(bike);
          }
          else if(car)carEntry.enter(car);
        }
        }
      }
      if(openingHoldAt!==undefined&&!mission&&performance.now()-openingHoldAt>45000){openingHoldAt=undefined;cameraFade.fade(1000,1,gameTimeMs);hud.fade(false,1000);}
      // The opening's black lasts until the story script and the place it opens in are down, which on a phone's
      // connection can be many seconds: past a moment, it says so (the line goes half a second after the hold does).
      if(openingHoldAt!==undefined&&performance.now()-openingHoldAt>OPENING_LOADING_MS)hud.message(navigator.onLine===false?'No connection: San Andreas loads once the connection is back.':'Loading San Andreas…',500);
      if(input.consume('KeyT')&&fleet?.occupiedPlane)fleet.occupiedPlane.toggleVtol();
      if(input.consume('KeyG')&&fleet?.occupiedPlane)fleet.occupiedPlane.toggleGear();
      elapsed += dt;
      // The key hints fade after 20 s of play: paused, map and cutscene time do not count.
      if(!mission?.runtime.game.widescreenOn)hintPlaySeconds+=dt;if(hintPlaySeconds>=20)hud.element.classList.add('playing-long');
      const cycleCamera = input.consume('KeyV'), alternateCamera = input.consume('Home');
      // The original switches camera modes without any text.
      if (cycleCamera || alternateCamera) render.cycleCameraDistance();
       // CTaskSimpleDuck::CanPedDuck: never from a run or sprint, and only with a melee or "use" weapon, the spray can or
       // one flagged for crouch-fire; PlayerControlDucked stands the player up once it fails.
       // CTaskSimpleDuck::CanPedDuck refuses only PEDMOVE_RUN and PEDMOVE_SPRINT (TaskSimpleDuck.cpp:96-99).
       const duckable=()=>{const info=weapons.inventory.info(),w=weapons.inventory.weapon;const moving=(sim.footMove==='run'||sim.footMove==='sprint')&&!sim.player.crouched;
        return !moving&&(w.kind==='melee'||w.id===41||!info||info.fire==='melee'||info.fire==='use'||!!(info.flags&WEAPON_FLAG.crouchFire));};
       // PlayerControlZelda starts the duck, so only while CTaskSimplePlayerOnFoot runs: not in the air, swimming,
       // climbing, knocked down or dying.
       if (input.consume('KeyC')&&!playerControlsDisabled()&&!padSwitchedOff('duck')&&!playerDown&&!playerJumping&&sim.hitHead===0&&sim.player.grounded&&!sim.player.swimming&&!sim.climbing&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!carEntry.active&&!duck.rolling&&(sim.player.crouched||duckable())) { sim.toggleCrouch(); }
       else if(sim.player.crouched&&!duck.rolling&&!duckable())sim.setCrouched(false);
      if (input.consume('KeyL')) canvas.requestPointerLock()?.catch(() => hud.message('Pointer lock unavailable. Drag to look.'));
      // CTimer::SetTimeScale(0.3) while a unique stunt jump plays.
      const tSteps=performance.now();
      stepSnapShot(dt);
      alpha = clock.advance(interiorTransfer||savedTransfer||savedTransferInstalling?0:dt*timeScale(), step => {
        sim.beginPlayerBreathFrame(step);
        if(walkDemo&&importedScene){
          if(!weatherStarted){weatherStarted=true;weather.setAppropriateNow(sim.player.position.x,-sim.player.position.z);}
          const today=((sim.timeMinutes%1440)+1440)%1440,angle=today*Math.PI/720,sun=[.7+Math.sin(angle),-.7,.2-Math.cos(angle)],camera=render.camera.position;
          // CGame::Process calls CWeather::Update once a frame: at the PC frame limiter's 30 fps, with CTimer's 50/30
          // step and m_FrameCounter counting those frames (its lightning odds are per call).
          for(weatherClock+=step;weatherClock>=1/30;weatherClock-=1/30){
            weatherFrame++;
            weather.update({clock:{hours:Math.floor(today/60),minutes:Math.floor(today%60),seconds:Math.floor(today%1*60)},timeMs:Math.floor(elapsed*1000),frame:weatherFrame,timeStep:50/30,camera:{x:camera.x,y:-camera.z,z:camera.y},sunZ:sun[2]/Math.hypot(...sun),noRain:cullNoRain()});
            // CWeather::Update's thunder shakes the pad too: 40 × the lightning's duration + 100 ms at (duration + 40) × 2.
            if(weather.thunder){sound.nativeEngine?.thunder();const shake=thunderShake(weather.thunder.duration);mission?.runtime.game.pads.startShake(0,shake.time,shake.frequency,0,gameTimeMs);}
          }
          localLighting.setWeatherState(weather.state());
          render.lighting.water.wavyness=weather.wavyness;
        }
         gangWars?.update(step*1000);
         {const region=nativeWeatherRegion(sim.player.position.x,-sim.player.position.z);// CWanted::Update: an interior (CanSeeOutSideFromCurrArea) counts as elusive, and only the player's own vehicle
          // can be the elusive one — a law vehicle, a helicopter or a plane.
          const ridden=[...(fleet?.cars??[])].find(car=>car.occupied)??fleet?.occupiedBike??fleet?.occupiedBoat;
          law.tick(step,sim.player.health>0,region===WEATHER_REGION.default||region===WEATHER_REGION.desert||render.lighting.area!==0,!!fleet?.occupiedPlane||!!ridden&&LAW_ENFORCEMENT_MODELS.has(ridden.modelId));}
        // StreamParachuteWeapon while in a plane or helicopter, and GivePlayerParachute as the player leaves it.
        // The parachute timer and CStats' counters step once per game frame (30 fps), each truncating its frame's
        // milliseconds to 33 as CTimer::GetTimeStepInMS does; per 60 Hz step they lost 4%.
        statFrameClock+=step;const statFrameDue=statFrameClock>=1/30;if(statFrameDue)statFrameClock-=1/30;
        // CAutomobile::ProcessControl once a game frame, sound or no sound: AI cars count their horn down, honk when blocked
        // by cars or pedestrians, and sirens chirp when (seed ^ rand) & 0xFF is 0xAD (CCarAI::UpdateCarAI).
        if(statFrameDue)for(const car of fleet?.cars??[])if(!car.occupied){if(car.horn.counter)car.horn.counter--;playHornIfNecessary(car);if(car.siren&&Math.random()*256<1)car.horn.counter=45;}
        {const plane=fleet?.occupiedPlane;if(statFrameDue)parachuteTimer.step(1000/30,plane?{heightOverGround:plane.altitude}:undefined);
         // GivePlayerParachute: GiveWeapon(PARACHUTE, 1, true) and SetSavedWeapon(PARACHUTE), so ReplaceWeaponWhenExitingVehicle
         // hands the parachute back rather than whatever was held before boarding.
         if(inAircraft&&!plane&&parachuteTimer.wantsParachute&&sim.player.health>0&&weapons.inventory.give(WEAPON_PARACHUTE,1)){weapons.inventory.select(WEAPON_PARACHUTE);if(driverSavedWeapon!==undefined)driverSavedWeapon=WEAPON_PARACHUTE;void weaponView.equip(WEAPON_PARACHUTE);}
         inAircraft=!!plane;}
        {const game=mission?.runtime.game;
         if(game&&statReactions&&sim.player.health>0){
          const bike=fleet?.occupiedBike,onFoot=!worldCar?.occupied&&!fleet?.occupied&&!bike&&!fleet?.occupiedBoat&&!fleet?.occupiedPlane&&!playerPassenger;
          if(statFrameDue&&onFoot&&sim.footMove==='sprint')statReactions.sprinting(1000/30);
          else if(statFrameDue&&onFoot&&sim.footMove==='run')statReactions.running(1000/30);
          // CBike counts four wheel contact points.
          if(statFrameDue&&bike?.motorbike){const v=bike.body.linvel();statReactions.onMotorBike(1000/30,Math.hypot(v.x,v.y,v.z)/50,bike.airborne?0:4);}
         }
         if(game&&sim.player.health>0)hunger.update(Math.floor(sim.timeMinutes/60)%24,cheats.isActive('neverHungry'),playerControlsDisabled()||game.widescreenOn||!!navigation?.open||arsenal.open||game.cutscene.running||!!playerAttached,{
          fat:()=>game.stats.get(21),muscle:()=>game.stats.get(23),decrementFat:v=>{game.stats.decrement(21,v);displayStatUpdate(false,21,v);},decrementMuscle:v=>{game.stats.decrement(23,v);displayStatUpdate(false,23,v);},
          hurt:v=>{sim.player.health-=v;},rumble:()=>{game.pads.startShake(0,400,110,0,gameTimeMs);},helpMessage:()=>hud.help(gxtHudText(gxtText('NOTEAT',"You're hungry. Eat something to keep your strength up."))),
         });}
        // CTimer game time drives the native hold, fade and respawn sequence.
        // CTimer::m_snTimeInMilliseconds: whole milliseconds of the time played. Flooring each 60 Hz step lost 4%.
        previousGameTimeMs=gameTimeMs;gameTimeExact+=step*1000;gameTimeMs=Math.floor(gameTimeExact);
        // CEntity::PreRender: every animated material adds this step's seconds (MaterialUpdateUVAnimCB).
        importedScene?.advanceUvAnimations(step);
        cameraFade.process(step);sound.setFaderScalingFactor(cameraFade.faderScalingFactor);
        gameLogic.update(gameTimeMs,previousGameTimeMs,gameLogicWorld,CITY_UNLOCKED,nativeLevelAt);
        // CGameLogic::Update then UpdateSkip, with the D-pad right's edge for this frame; CHud::DrawTripSkip while a skip
        // can be taken (SKIP_1's help the first time it shows).
        {const down=!!mission&&mission.runtime.game.pads.pads[0].dpadRight>0;skipButtonPressed=down&&!skipButtonDown;skipButtonDown=down;}
        gameLogic.updateSkip(gameTimeMs,skipWorld);
        {const canSkip=gameLogic.skipCanBeActivated(skipWorld);
         if(canSkip&&!tripSkipHelpShown){tripSkipHelpShown=true;hud.help(gxtHudText(gxtText('SKIP_1','')),5000);}else if(!canSkip)tripSkipHelpShown=false;
         hud.tripSkip(canSkip,canSkip?gxtHudText(gxtText('FEC_TSK','TRIP SKIP')):'');}
        weapons.tick(step,weapons.aiming?{origin:{...render.camera.position},direction:aimDirection()}:undefined);
        // The touch controls' aim assist (input/aimAssist): an aimed gun in the follow camera eases onto the ped nearest
        // the crosshair that the camera can see. A swipe switches targets, as the mobile ports' lock-on does: while the
        // finger turns the camera the target held is not favoured, so the ped the swipe ends on is taken.
        {const w=weapons.inventory.weapon,info=weapons.inventory.info();
         const assist=touch&&touchSettings.aimAssist&&weapons.aiming&&!render.firstPerson&&(w.kind==='bullet'||w.kind==='shotgun')&&info&&info.fire!=='melee'&&sim.player.health>0;
         if(assist){const origin=render.camera.position,target=pickAimTarget(pedestrians?.targets()??[],{origin,direction:aimDirection()},sim.player.position,playerAimReach(w.kind,info),render.lookingAround?undefined:aimAssistHandle,c=>{
           const to={x:c.position.x-origin.x,y:c.position.y-origin.y,z:c.position.z-origin.z},d=Math.hypot(to.x,to.y,to.z);if(d<.5)return true;
           return !sim.world.castRay(new RAPIER.Ray(origin,{x:to.x/d,y:to.y/d,z:to.z/d}),d-.3,true,RAPIER.QueryFilterFlags.ONLY_FIXED);});
          aimAssistHandle=target?.handle;render.aimAssist=target?.position;}
         else{aimAssistHandle=undefined;render.aimAssist=undefined;}}
        const entryBusy=[...(fleet?.planes??[])].some(p=>p.entryBusy);
        const onFoot=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!playerPassenger&&!entryBusy&&!bikeMount.active&&(!carEntry.active||carEntry.phase==='approach');
        // CTaskSimplePlayerOnFoot raises CEventGunAimedAt on a locked ped. With the mouse there is no lock; the ped under
        // the crosshair (m_p3rdPersonMouseTarget, from the stubbed Compute3rdPersonMouseTarget) gets it instead.
        if(onFoot&&weapons.aiming&&weapons.lock&&weapons.inventory.info()?.fire==='instant')pedestrians?.gunAimedAt(weapons.lock.handle,{...sim.player.position});
        // CPed::ProcessBuoyancy: the ped origin (a unit above the feet) 0.6 under the surface starts the in-water task.
        const swimWater=render.lighting.water.levels?.level(sim.player.position.x,-sim.player.position.z);
        // ProcessBuoyancy's tail for a player outside the swim task: his head bone (plus 0.1) under the surface loses
        // breath at x1 (HandlePlayerBreath) and drowns him, floored in a channel or wading a steep bank.
        if(onFoot&&!sim.player.swimming&&swimWater!==undefined&&sim.player.health>0){const head=render.nativeCharacter?.headPosition();
         if(head&&head.y+.1<swimWater)sim.handlePlayerBreath(step,true,1);}
        const stopSwim=()=>{sim.player.swimming=false;sim.player.swimState=0;sim.player.swimBlend=0;sim.player.swimStopTime=0;sim.player.swimDiveTime=0;sim.player.swimVel={x:0,z:0};};
        // PED_CYCLE_WEAPON_LEFT and _RIGHT: the PC defaults Q and E, and the mouse wheel. (In a vehicle Q and E look aside.)
        const cycleLeft=input.consume('KeyQ'),cycleRight=input.consume('KeyE');
        const reload=input.consume('KeyR'),next=input.consume('WheelNext')||onFoot&&cycleRight,previous=input.consume('WheelPrevious')||onFoot&&cycleLeft;
        // The first-person weapon modes ignore weapon cycling; the wheel zooms instead (up zooms in).
        if(render.firstPerson){if(next||previous)render.zoomInput.notch=previous?1:-1;}
        // CTaskComplexUseGoggles sets m_bDontAllowWeaponChange for as long as the goggles go on or come off.
        else if(onFoot&&!sim.jetPack&&!weapons.goggles&&!playerControlsDisabled()&&!padSwitchedOff('cycleWeapon')&&(next||previous)){const before=weapons.inventory.selected;weapons.inventory.cycle(next?1:-1);if(weapons.inventory.selected!==before){weapons.inventory.loadClipForNewWeapon();weapons.attackButtonCounter=0;}void weaponView.equip(weapons.inventory.selected);}
        // SA has no reload control: CWeapon::Fire reloads when a clip runs out.
        const mouse=input.consume('MouseFire'),key=input.consume('ControlLeft')||input.consume('ControlRight'),click=input.consume('MouseClick');
        // The left button fires whenever it is not dragging the camera: aiming, under pointer lock, or a short click.
        const mouseFires=weapons.aiming||document.pointerLockElement===canvas;
        // CPad::GetWeapon is the held button: every gun keeps firing at its own rate while it is down.
        const held=weapons.inventory.weapon.automatic||['bullet','shotgun','rocket','guided','camera'].includes(weapons.inventory.weapon.kind);
        const firing=playerControlsDisabled()||padSwitchedOff('fireWeapon')?false:held?(mouseFires&&input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight')||key||mouseFires&&mouse||click):(mouseFires&&mouse||click||key);
        // The minigun's use-gun task runs while it is aimed or fired: its barrel spins up, and spins dry without a shot.
        {const miniUse=onFoot&&weapons.inventory.selected===38&&(weapons.aiming||firing);weaponView.stepGunSpin(step,miniUse);if(miniUse&&!firing)sound.nativeEngine?.minigunSpin();}
        {const justDown=mouseFires&&mouse||click||key;if(justDown&&onFoot&&!playerControlsDisabled()&&!sim.player.swimming){const fail=weapons.fireFailEvent();if(fail!==undefined)sound.frontend(fail);}}
        // CTaskSimplePlayerOnFoot's weapon control does not run under the climb task.
        // No gun fires while the player sprints (m_nMoveState != PEDMOVE_SPRINT); a sprinting swing is the moving attack.
        // Aimed without bMoveFire, a gun waits for m_MoveCmd to settle before it fires (CTaskSimpleUseGun::StartAnim).
        // Firing wins over moving: CTaskSimpleUseGun::SetMoveAnim drops move control while the last command is FIRE on
        // a weapon without bMoveFire, so CJ plants and shoots rather than walking on without a shot.
        gunFiring=firing;
        // CTaskSimpleJetPack::ProcessControlInput fires only an instant-hit weapon aimed with the arm.
        stepJetPackWeapon();
        // The drive task is gone once the getout, the drag-out or the jump-out starts: no drive-by from then on, and
        // the leaving task gives the weapon back (ReplaceWeaponWhenExitingVehicle) as it starts.
        const leavingCar=carEntry.phase==='getOut'||carEntry.phase==='draggedOut'||carEntry.phase==='jumpOut'||carEntry.phase==='crawlOut';
        // CTaskSimpleCarGetOut gives the weapon back (ReplaceWeaponWhenExitingVehicle) as its clip starts, not once he is out.
        stepDriverWeapon(!!(worldCar?.occupied&&!leavingCar||fleet?.occupied&&!(leavingCar&&carEntry.car===fleet.occupied)||fleet?.occupiedBoat||fleet?.occupiedBike||fleet?.occupiedPlane));
        const jetFireAllowed=!sim.jetPack||!jetWeaponHidden&&(()=>{const info=weapons.inventory.info();return !!info&&info.fire==='instant'&&!!(info.flags&WEAPON_FLAG.aimWithArm);})();
        if(onFoot&&jetFireAllowed&&!playerDown&&!playerJumping&&!sim.climbing&&!law.arrested&&!weapons.stealth&&!duck.rolling&&!(render.nativeCharacter?.sprinting&&weapons.inventory.weapon.kind!=='melee'&&!weapons.aiming)&&firing){const direction=aimDirection();weapons.fire({origin:render.camera.position,direction});}
        // CPad::GetWeapon for the throw task's button counter: the fire button while it stays down.
        weapons.throwHeld=onFoot&&!playerDown&&(mouseFires&&input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'));
        // Drive-by: Ctrl fires the selected one-handed weapon from the driven car or boat (CTaskSimpleGangDriveBy port).
        // CPad::GetCarGunFired and CarGunJustDown answer false while DisablePlayerControls is set: no vehicle weapon fires.
        const carGunOff=playerControlsDisabled();
        // CAutomobile::ProcessControl skips DoDriveByShootings in the S.W.A.T. van and the Rhino (their gun is the car's),
        // and SET_PLAYER_CAN_DO_DRIVE_BY off leaves the driver no drive-by weapon.
        const driveByAllowed=mission?.runtime.game.playerInfo.canDoDriveBy!==false;
        // CPad::GetCarGunFired: the fire button (the mouse, or Ctrl) fires a vehicle's gun and the rider's drive-by.
        // The drive-by is the SMG slot's weapon (CTaskSimpleGangDriveBy takes it whatever is in hand), so it is put in
        // hand when the trigger is pulled with another selected.
        const drivebyReady=()=>{const inv=weapons.inventory,smg=[28,29,32].includes(inv.selected)?inv.selected:inv.inSlot(inv.slotOf(28));if(smg===undefined)return false;if(inv.selected!==smg)inv.select(smg);return true;};
        // Without pointer lock the left button also drags the camera round the vehicle: held still it is the trigger (an
        // automatic keeps firing), and a click fires one round.
        const drivebyPulled=()=>(weapons.inventory.weapon.automatic?(input.down('ControlLeft')||input.down('ControlRight')||mouseFires&&input.down('MouseFire')||input.stillHold()||key||mouseFires&&mouse||click):key||mouseFires&&mouse||click||mouse)&&drivebyReady();
        if(worldCar?.occupied&&!leavingCar&&worldCar.modelId!==432&&worldCar.modelId!==601&&driveByAllowed&&!carGunOff&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=drivebyPulled();
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDriveby(worldCar,{origin:render.camera.position,direction});}
        }
        // CAutomobile::TankControl: the Rhino's turret follows the camera and Ctrl fires the cannon every 800 ms.
        const tank=fleet?.occupied?.modelId===432?fleet.occupied:undefined;
        if(tank&&!law.arrested){
         tank.onCrushCar=other=>law.crime(CRIME.explosion,other.crimeKey);
         const q=tank.car.body.rotation(),tq=new Quaternion(q.x,q.y,q.z,q.w),front=render.camera.getWorldDirection(scratchAim).clone().applyQuaternion(tq.clone().invert());
         // Off the camera's string (first person here) the turret takes the car-gun stick at its rates instead.
         const turretStick={leftRight:(Number(input.down('Numpad6'))-Number(input.down('Numpad4')))*128,upDown:(Number(input.down('Numpad2'))-Number(input.down('Numpad8')))*128};
         tankTurret=render.firstPerson?stepTankTurretPad(turretAims.get(tank)??initialTankTurret(),turretStick,step*50):stepTankTurret(turretAims.get(tank)??initialTankTurret(),{x:front.x,y:-front.z,z:front.y},step*50);turretAims.set(tank,tankTurret);
         tank.setTurret(tankTurret.yaw,tankTurret.pitch);
         const nowMs=elapsed*1000;
         // CarGunJustDown: a fresh press fires, once the last shot is 800 ms old; holding the button fires no more.
         const gunDown=!carGunOff&&(input.down('ControlLeft')||input.down('ControlRight')||input.down('MouseFire')),gunJustDown=gunDown&&!tankGunWasDown;tankGunWasDown=gunDown;
         if(gunJustDown&&nowMs>tankLastFire+TANK_FIRE_INTERVAL_MS){
          tankLastFire=nowMs;
          const local=tankShotDirection(tankTurret),dir=new Vector3(local.x,local.z,-local.y).applyQuaternion(tq);
          const muzzle=tank.muzzleWorld()??(()=>{const m=tankDefaultMuzzle(tankTurret),p=tank.car.body.translation(),o=new Vector3(m.x,m.z,-m.y).applyQuaternion(tq);return new Vector3(p.x+o.x,p.y+o.y,p.z+o.z);})();
          const length=dir.length()||1,unit={x:dir.x/length,y:dir.y/length,z:dir.z/length};
          const hit=sim.world.castRay(new RAPIER.Ray(muzzle,unit),TANK_SHOT_RANGE*length,true,undefined,undefined,undefined,tank.car.body);
          // The blast stands back 4% of the way from the hit toward the turret (colPoint - (colPoint - turret) * 0.04).
          const end=hit?hit.timeOfImpact*.96:TANK_SHOT_RANGE*length;
          const explosion={x:muzzle.x+unit.x*end,y:muzzle.y+unit.y*end,z:muzzle.z+unit.z*end};
          weapons.debugExplosion(explosion,EXPLOSION.tankFire);
          const mass=tank.assets.handling.values.mass;
          tank.car.body.applyImpulseAtPoint({x:-dir.x*TANK_RECOIL*50*mass,y:-dir.y*TANK_RECOIL*50*mass,z:-dir.z*TANK_RECOIL*50*mass},muzzle,true);
         }
        }
        // CAutomobile::FireTruckControl for the Fire Truck and the S.W.A.T. tank under the player; the cannon's sections
        // live on (CWaterCannons::Update) after the gun is released or the truck left.
        cannonClock+=step;const cannonFrameDue=cannonClock>=1/30;if(cannonFrameDue)cannonClock-=1/30;
        const cannonCar=fleet?.occupied&&CANNON_MODELS.has(fleet.occupied.modelId)?fleet.occupied:undefined;
        if(cannonCar&&!law.arrested){
         const swat=cannonCar.modelId===601,q=cannonCar.car.body.rotation(),cq=new Quaternion(q.x,q.y,q.z,q.w),front=render.camera.getWorldDirection(scratchAim).clone().applyQuaternion(cq.clone().invert());
         cannonAim=stepFireTruckAim(cannonAims.get(cannonCar)??initialCannonAim(),{x:front.x,y:-front.z,z:front.y},step*50,swat);cannonAims.set(cannonCar,cannonAim);
         cannonCar.setCannon(cannonAim.yaw);
         cannonFiring=!carGunOff&&(input.down('ControlLeft')||input.down('ControlRight')||input.down('MouseFire'));
         if(cannonFiring&&cannonFrameDue){
          const local=cannonDirection(cannonAim),dir=new Vector3(local.x,local.z,-local.y).applyQuaternion(cq);
          const node=cannonCar.car.frameWorldPosition('misc_a'),p=cannonCar.car.body.translation();
          const nozzle=node??new Vector3(CANNON_DEFAULT_NOZZLE.x,CANNON_DEFAULT_NOZZLE.z,-CANNON_DEFAULT_NOZZLE.y).applyQuaternion(cq).add(new Vector3(p.x,p.y,p.z));
          const v=cannonCar.car.body.linvel(),w=cannonCar.car.body.angvel();
          const e=cannonEmission({direction:{x:dir.x,y:-dir.z,z:dir.y},nozzle:{x:nozzle.x,y:-nozzle.z,z:nozzle.y},fromNode:!!node,carPosition:{x:p.x,y:-p.z,z:p.y},moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},turnSpeed:{x:w.x/50,y:-w.z/50,z:w.y/50},timeStep:50/30,swat,randomInt:Math.floor(Math.random()*65536)});
          waterCannon.newInput(cannonCar.car.body.handle+1,elapsed*1000,e.start,e.end);
         }
        }
        // CWaterCannon::Update_OncePerFrame and FireTruckControl's new section run once per game frame at the frame
        // limiter's 30 fps with CTimer's 50/30 step: each of the 32 sections lives ~1 s, as native.
        if(waterCannon.id&&cannonFrameDue){
         const push=waterCannon.update(elapsed*1000,50/30,cannonFrame,0,point=>weapons.fires.extinguishPointWithWater(point,2,.5,1/30));
         if(push)pedestrians?.waterCannonPush(waterCannon.sections());
        }
        // FireTruckControl for the fire engines answering fires: the AI's aim, and the cannon on every frame (only the
        // player's waits for the car gun).
        for(const {car,aim} of emergency?.cannons()??[]){
         car.setCannon(aim.yaw);
         if(!cannonFrameDue)continue;
         let cannon=npcCannons.get(car);if(!cannon){cannon=new WaterCannon();npcCannons.set(car,cannon);}
         const q=car.car.body.rotation(),cq=new Quaternion(q.x,q.y,q.z,q.w),local=cannonDirection(aim),dir=new Vector3(local.x,local.z,-local.y).applyQuaternion(cq);
         const node=car.car.frameWorldPosition('misc_a'),p=car.car.body.translation();
         const nozzle=node??new Vector3(CANNON_DEFAULT_NOZZLE.x,CANNON_DEFAULT_NOZZLE.z,-CANNON_DEFAULT_NOZZLE.y).applyQuaternion(cq).add(new Vector3(p.x,p.y,p.z));
         const v=car.car.body.linvel(),w=car.car.body.angvel();
         const e=cannonEmission({direction:{x:dir.x,y:-dir.z,z:dir.y},nozzle:{x:nozzle.x,y:-nozzle.z,z:nozzle.y},fromNode:!!node,carPosition:{x:p.x,y:-p.z,z:p.y},moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},turnSpeed:{x:w.x/50,y:-w.z/50,z:w.y/50},timeStep:50/30,swat:false,randomInt:Math.floor(Math.random()*65536)});
         cannon.newInput(car.car.body.handle+1,elapsed*1000,e.start,e.end);
        }
        {let index=1;for(const [car,cannon] of npcCannons){
         if(cannonFrameDue&&cannon.id){const push=cannon.update(elapsed*1000,50/30,cannonFrame,index,point=>weapons.fires.extinguishPointWithWater(point,2,.5,1/30));if(push)pedestrians?.waterCannonPush(cannon.sections());}
         if(!cannon.id&&(car.disposed||!emergency?.covers(car)))npcCannons.delete(car);
         index++;
        }}
        if(cannonFrameDue)cannonFrame++;
        // CAEWaterCannonAudioEntity::Service: the jet's voices ride its last section, the splash pair the point the
        // jet last landed on (CWaterCannon::Update's SetSplashInfo).
        {const cannonAudio=sound.nativeEngine?.waterCannon;
         if(cannonAudio){
          const live=waterCannon.id?waterCannon.sections():[];
          const tip=live.length?live[live.length-1]:undefined;
          if(tip){
           // CWaterCannon::Update splashes where the jet's line first hits the world; the tip's own drop onto the
           // ground under it stands in for that test, which the browser's cannon does not run.
           const ray=sim.world.castRay(new RAPIER.Ray({x:tip.point.x,y:tip.point.z+2,z:-tip.point.y},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
           if(ray)cannonAudio.setSplash({x:tip.point.x,y:tip.point.y,z:tip.point.z+2-ray.timeOfImpact},Math.hypot(tip.speed.x,tip.speed.y,tip.speed.z));
           else cannonAudio.clearSplash();}
          else cannonAudio.clearSplash();
          cannonAudio.service(tip?{x:tip.point.x,y:tip.point.y,z:tip.point.z}:undefined);
         }}
        // SET_PLAYER_CAN_DO_DRIVE_BY off leaves the boat's helmsman no drive-by weapon, as it does a car's driver.
        if(fleet?.occupiedBoat&&driveByAllowed&&!carGunOff&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=drivebyPulled();
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDrivebyBoat(fleet.occupiedBoat,{origin:render.camera.position,direction});}
        }

        // A rider's drive-by: ahead of the bike (eDrivebyStyle FIXED_FWD) unless VEHICLE_LOOKLEFT or LOOKRIGHT (Q, E)
        // is held, which shoots out of that side (CVehicle::DoDriveByShootings is unreversed; the styles are its own).
        if(fleet?.occupiedBike&&!bikeMount.active&&driveByAllowed&&!carGunOff&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=drivebyPulled();
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDrivebyBike(fleet.occupiedBike,{origin:render.camera.position,direction},bikeLookSide());}
        }
        const rocket=input.consume('KeyB')||input.down('KeyB');
        // The guns and the ordnance are separate buttons with separate clocks: both can fire together.
        if(fleet?.occupiedPlane&&!carGunOff){if(firing||input.down('ControlLeft')||input.down('ControlRight'))weapons.fireAircraft(fleet.occupiedPlane,false);if(rocket)weapons.fireAircraft(fleet.occupiedPlane,true);}
        const tTraffic=performance.now();
        guard('phones.step',()=>{for(const [key,phone] of phones){
         const view=key==='player'?render.nativeCharacter:(key as Pedestrian).view;
         if(key!=='player'&&!pedestrians?.hasPed(key as Pedestrian)){phones.delete(key);continue;}
         phone.step(view);if(!phone.active&&key!=='player')phones.delete(key);
        }});
        guard('traffic.beforeStep',()=>traffic?.beforeStep(step));guard('scriptCars.step',()=>{scriptCars.step(step,sim.player.position);if(mission)scriptCars.pathAreas(sim.player.position);});guard('police.beforeStep',()=>police?.beforeStep(step,worldCar?.occupied&&!worldCar.disposed?worldCar:undefined));guard('emergency.update',()=>emergency?.update(step));guard('driveby.beforeStep',()=>driveby?.beforeStep(step,worldCar?.occupied?worldCar:undefined));
        guard('groupDriveBys',()=>groupThreatDriveBys(step));
        guard('scriptDriveBys',()=>{const gun=driveby?.gun;if(!gun)return;for(const rider of scriptRiders)if(rider.driveBy&&!rider.gone&&rider.health>0&&!rider.car.wrecked)stepScriptDriveBy(rider.driveBy,rider.car,gun.info,gun.reloadSeconds,step,scriptDriveByWorld);
          if(carEntry.seated&&carEntry.car&&!carEntry.car.wrecked)for(const p of carEntry.passengers)if(p.driveBy)stepScriptDriveBy(p.driveBy,carEntry.car,gun.info,gun.reloadSeconds,step,scriptDriveByWorld);});
        frameProfile.stepTraffic+=performance.now()-tTraffic;const tPeds=performance.now();
        guard('pedestrians.beforeStep',()=>pedestrians?.beforeStep(step,fleet?.cars??[]));
        frameProfile.stepPeds+=performance.now()-tPeds;
        // CPhysical::ApplyCollision and CEventVehicleCollision for cars striking CJ on foot.
        if(onFoot)for(const hit of carsStrikePlayer(sim,[...(fleet?.cars??[]),...(fleet?.trains??[])],{excluded:carEntry.active?carEntry.car:undefined,
          fistWeapon:()=>([WEAPON.unarmed,WEAPON.brassKnuckle,WEAPON.golfClub,WEAPON.knife] as number[]).includes(weapons.inventory.selected),
          // CTaskSimpleShakeFist: ANIM_ID_FUCKU from the default group.
          shakeFist:()=>{const view=render.nativeCharacter;if(view&&!view.reactionName&&view.hasReaction('fucku'))view.playReaction('fucku');}})){playerCarHits.contacts++;if(hit.hurt){playerCarHits.hurt++;playerCarHits.hurtBy=hit.response.event.kind;}playerCarHits.last=hit.response.event.kind;}
        const controlsOff=playerControlsDisabled();
        const axes = law.arrested||weapons.stealth||entryBusy||controlsOff?{x:0,y:0}:input.axes();
        // At the wheel the touch stick steers on the iOS port's curve (stickSteering); on foot, and a pad's stick, read straight.
        const steerAxes='touchStick' in axes&&axes.touchStick?{...axes,x:stickSteering(axes.x)}:axes;
        let jumpPressed=input.consume('Space')&&!law.arrested&&!weapons.stealth&&!entryBusy&&!controlsOff&&!padSwitchedOff('jump')&&!playerDown;
        // CTaskSimplePlayerOnFoot::PlayerControlDucked (reversed): sprint, a jump press or an exit-vehicle press stands a
        // crouched CJ up (ClearTaskDuckSecondary). Only the ducked control runs that frame, so the press does not also jump.
        if(sim.player.crouched&&sim.player.grounded&&!law.arrested&&(jumpPressed||exitJustDown||input.down('ShiftLeft')||input.down('ShiftRight'))&&(duck.rolling||sim.setCrouched(false)))jumpPressed=false;
        // CTaskSimplePlayerOnFoot::ProcessPlayerWeapon: the fire button without the target button starts CTaskSimpleUseGun too.
        // With a gun not aimed with the arm, ProcessPed moves CJ through PlayerControlZeldaWeapon (the GunMove strafe) and turns
        // him to the follow camera's heading (m_fAimingRotation) for as long as that task runs; with the button up, a push on
        // the stick past 50 ends it (END_NOW). No use-gun task starts while sprinting.
        {const info=weapons.inventory.info();
         if(!onFoot||weapons.aiming||render.firstPerson||sim.jetPack||sim.player.swimming||sim.climbing||playerDown||sim.player.health<=0||law.arrested||!info||(info.fire!=='instant'&&info.fire!=='area')||info.flags&(WEAPON_FLAG.aimWithArm|WEAPON_FLAG.firstPerson))hipGun=undefined;
         else if(firing&&!render.nativeCharacter?.sprinting)hipGun=weapons.inventory.selected;
         // With the button up the task runs on only through the fire clip (FinishGunAnimCB, then StartAnim with no command
         // left finishes it): once the shot's interval and any reload are over, CJ lets the gun down.
         else if(hipGun!==weapons.inventory.selected||Math.hypot(axes.x,axes.y)>50/128||weapons.inventory.cooldown<=0&&!weapons.inventory.reloading)hipGun=undefined;}
        // Hip-fire in the follow camera sets only m_fAimingRotation (TaskSimplePlayerOnFoot.cpp:505-507): CJ turns to it at
        // his heading change rate, where the aim camera turns him at once.
        // The target button turns CJ to the camera only for a weapon it aims (MODE_AIMWEAPON) and the standing fight
        // stance: with a thrown or used weapon, or a melee one ducked, PlayerControlZelda and PlayerControlDucked steer
        // him by the stick (TaskSimplePlayerOnFoot.cpp:615-619, 893-903).
        // PlayerControlZelda jumps only while the target button is up; PlayerControlZeldaWeapon, which moves CJ while a
        // hip-fired rifle's use-gun task runs, never does.
        let controls:import('./simulation/Simulation').Controls = { ...axes, jetPack:!!sim.jetPack, cameraYaw: render.yaw, cameraPitch: Math.asin(Math.max(-1,Math.min(1,render.camera.getWorldDirection(fogReductionForward).y))), walk: input.down('AltLeft') || input.down('AltRight'), sprint: input.down('ShiftLeft') || input.down('ShiftRight'), jump: jumpPressed&&!input.down('MouseAim')&&hipGun===undefined&&!((weapons.inventory.info()?.flags??0)&WEAPON_FLAG.heavy),jumpHeld:input.down('Space')&&!controlsOff&&!law.arrested&&!padSwitchedOff('jump'),
          // The touch settings' Auto climb (the port's MOB_ATC, on by default): its check is the pad's left stick pushed
          // forward past half (LeftStickY under -64), the touch stick or a played pad's.
          autoClimb:touchScreen&&touchSettings.autoClimb&&!controlsOff&&!law.arrested&&(input.stick?.y??0)>64/128,exitVehicle:input.down('KeyF')&&!controlsOff&&!law.arrested&&!padSwitchedOff('enterCar'),parachute:weapons.parachute,facing:weapons.stealth?sim.player.heading:weapons.aiming&&(render.aiming||weapons.inventory.weapon.kind==='melee'&&!sim.player.crouched)?render.yaw+Math.PI:hipGun!==undefined?turnToward(sim.player.heading,render.yaw+Math.PI,step):undefined };
        // CTaskSimpleSwim player states: Space surfaces, attack dives, sprint selects the crawl while there is energy for
        // it (ControlButtonSprint's HandleSprintEnergy fails once spent, as the on-foot sprint does).
        if(onFoot&&sim.player.health>0&&!law.arrested&&!carEntry.active){
          const splash=updatePlayerSwim(sim.player,{moveMag:Math.max(0,axes.y),sprint:(input.down('ShiftLeft')||input.down('ShiftRight'))&&!sim.player.sprintExhausted,jump:jumpPressed,dive:key||mouseFires&&mouse||click,underwaterStroke:render.nativeCharacter?.swimUnderAssociation(),drownsInWater:sim.playerDrownsInWater},swimWater,step,carEntry.clips.peek('swim','Swim_Dive_Under')?.duration);
          // CEventDamage::AffectsPed turns WEAPON_DROWNING away from a ped that does not drown.
          if(splash.damage>0&&sim.playerDrownsInWater)sim.damagePlayer(splash.damage,true,{weapon:WEAPON.drowning});
          controls={...controls,swimWater,jump:sim.player.swimming?false:controls.jump};
          swimJumpoutSeconds=sim.player.swimming&&sim.player.swimState===SWIM.backToSurface?(swimJumpoutSeconds??0)+step:undefined;
        }
        // A dead CJ's body keeps its buoyancy (CPed::ProcessBuoyancy): the sim floats it on this surface.
        else if(onFoot&&sim.player.health<=0)controls={...controls,swimWater};else if(sim.player.swimming)stopSwim();
        if(carEntry.active&&sim.player.swimming)carEntry.cancel();
        if(carEntry.phase==='approach')controls=carEntry.approach(step,controls,{x:axes.x,y:axes.y,quit:controls.jump||firing});
        // The walk up to a bike the enter button chose from further off than the boarding reach, as the go-to-door
        // part of CTaskComplexEnterCar brings CJ to a car. Steering away, jumping or firing gives it up.
        if(bikeApproach){
          const a=bikeApproach,b=a.bike,p=sim.player.position,t=b.body.translation(),dx=t.x-p.x,dz=t.z-p.z,d=Math.hypot(dx,dz);
          const c=Math.cos(controls.cameraYaw),s=Math.sin(controls.cameraYaw),inX=axes.x*c-axes.y*s,inZ=-axes.x*s-axes.y*c;
          a.time+=step;if(d<a.best-.05){a.best=d;a.stall=0;}else a.stall+=step;
          if(b.disposed||b.occupied||!onFoot||carEntry.active||bikeMount.active||sim.knockdown>0||sim.player.health<=0||law.arrested||a.time>10||d>12||controls.jump||firing||Math.hypot(inX,inZ)>.1&&inX*dx+inZ*dz<0)bikeApproach=undefined;
          // Beside it, or held up against it (a wall, the bike's own frame) within reach: on.
          else if(d<=BIKE_APPROACH_BOARD||a.stall>.8&&d<=bikeReach(b)){bikeApproach=undefined;boardBike(b);}
          else{const ax=dx/d,az=dz/d;controls={...controls,x:ax*c-az*s,y:-ax*s-az*c,walk:d<2.5,sprint:false,jump:false,facing:undefined};}
        }
        if(carEntry.active&&(sim.player.health<=0||law.arrested))carEntry.abandon();
        for(const pl of fleet?.planes??[])if(pl.entry&&(sim.player.health<=0||law.arrested))pl.cancelEntry();
        const entryMotion=carEntry.step(step,{pedal:input.down('KeyW')||input.down('KeyS'),moving:Math.hypot(axes.x,axes.y)>0||input.down('MouseAim'),steer:{x:axes.x,y:axes.y,cameraYaw:controls.cameraYaw},fire:firing});
        carEntry.stepPassengers(step);
        surfaceSprintBlocked=false;
        if(importedScene&&sim.player.grounded&&lastGround){
          surfaceSprintBlocked=surfaceBlocksSprint(surfaceSprint,lastGround?.material);
          if(controls.jump&&steepSlopeRefusesJump(surfaceSteep,lastGround?.material,{x:Math.sin(sim.player.heading),z:Math.cos(sim.player.heading)},lastGround?.normal))controls.jump=false;
          if(surfaceSprintBlocked)controls.sprint=false;
        }
        // PlayerControlZelda: m_bPlayerSprintDisabled (DISABLE_PLAYER_SPRINT, and the goggles going on or off) turns the
        // sprint button into a run.
        if(playerSprintDisabled())controls.sprint=false;
        if(aimOverridesSprint&&weapons.aiming)controls.sprint=false;
        // CTaskComplexGotoDoorAndOpen under CTaskSimpleUninterruptable: a walk-in entrance walks CJ 4 units on, out of the pad's hands.
        const walkIn=entryExits?.active?.walk;
        if(walkIn&&onFoot){const p=sim.player.position,dx=walkIn[0]-p.x,dz=-walkIn[1]-p.z;controls={...controls,x:0,y:Math.hypot(dx,dz)>.5?-1:0,cameraYaw:Math.atan2(dx,dz),walk:true,sprint:false,jump:false,facing:undefined};}
        // A warp with no walk-in (UNKNOWN_PAIRING, FOOD_DATE_FLAG) sets bPlayerOnInteriorTransition, one of
        // DisablePlayerControls' reasons, and on foot adds CTaskSimpleUninterruptable: CJ stands still through the fade.
        else if(entryExits?.active&&onFoot&&entryExits.active.freeze!==false)controls={...controls,x:0,y:0,walk:false,sprint:false,jump:false,facing:undefined};
        // physicalFlags.bDontApplySpeed: a player the script froze does not move on the pad.
        else if(onFoot&&playerFrozenByScript)controls={...controls,x:0,y:0,walk:false,sprint:false,jump:false,facing:undefined};
        // A task the script gave CJ's ped speaks for the pad while it runs on foot; getting into or out of a car, CarEntry
        // moves him, and the task is stepped below.
        else if(onFoot&&playerTasks.active&&sim.player.health>0){
         const task=playerTasks.step(step,playerTaskBody());
         if(task?.kind==='move')controls={...controls,x:0,y:-1,cameraYaw:task.yaw,walk:task.walk,sprint:task.sprint,jump:false,facing:undefined};
         else if(task)controls={...controls,x:0,y:0,walk:false,sprint:false,jump:false,facing:task.facing};
        }
        if(!onFoot&&playerTasks.active&&sim.player.health>0)playerTasks.step(step,playerTaskBody());
        if(!sim.player.swimming)controls=nativeWeaponMovement(controls,weapons.native,weapons.inventory.selected,weapons.aiming);
        // CTaskSimpleUseGun moves an aimed gun's holder on the GunMove clips at the skill row's move speed. The spray can
        // and extinguisher are area-effect weapons without bAimWithArm, which CTaskSimplePlayerOnFoot::ProcessPed moves
        // through PlayerControlZeldaWeapon like the rifles.
        const aimedGun=weapons.aiming&&(['bullet','shotgun','rocket','guided','flame','spray','extinguisher'].includes(weapons.inventory.weapon.kind)||!!render.firstPerson)||hipGun!==undefined?weapons.inventory.info():undefined;
        if(aimedGun)controls={...controls,gunMove:{aimWithArm:!!(aimedGun.flags&WEAPON_FLAG.aimWithArm),moveAim:!!(aimedGun.flags&WEAPON_FLAG.moveAim),moveFire:!!(aimedGun.flags&WEAPON_FLAG.moveFire),firing:gunFiring&&!weapons.inventory.reloading,moveSpeed:aimedGun.moveSpeed}};
        // CTaskSimplePlayerOnFoot::ProcessPlayerWeapon: the target button with a melee weapon starts CTaskSimpleFight, whose
        // stance shuffles CJ about on the FightSh clips (PlayerControlFighter) instead of walking him.
        else if(weapons.aiming&&onFoot&&weapons.inventory.weapon.kind==='melee'&&!sim.player.crouched)controls={...controls,fightMove:true};
        // The fight task made by an untargeted press lives 2000 ms: a standing player (m_nMoveState below PEDMOVE_WALK)
        // is under PlayerControlFighter for that long; a push of the stick is PlayerControlZelda as usual. A chainsaw's
        // FIGHTIDLE counts as moving, so it never holds him.
        else if(onFoot&&weapons.inventory.weapon.kind==='melee'&&weapons.inventory.weapon.id!==9&&!sim.player.crouched&&weapons.fightStance&&controls.x===0&&controls.y===0)controls={...controls,fightMove:true};
        // CTaskSimplePlayerOnFoot::PlayerControlDucked feeds CTaskSimpleDuck::ControlDuckMove: aiming a gun walks forward and
        // back on the stick and rolls on a sideways push; otherwise CJ turns to the stick and crouch-walks forward.
        if(sim.player.crouched&&sim.player.grounded&&onFoot&&!sim.player.swimming&&sim.player.health>0){
          // The pad's walk axis is negative forward; the key axes are positive forward.
          const move=playerDuckMove(controls.x,-controls.y,weapons.aiming&&weapons.inventory.weapon.kind!=='melee');
          duck.control(move.x,move.y,step*50);
          // CTaskSimpleUseGun::SetMoveAnim, ducked, with its last command FIRE, FIREBURST or RELOAD: ForceStopMove.
          // The fire button alone starts the use-gun task too, so a hip-fired gun stops the crouch-walk the same way.
          {const fire=weapons.inventory.info()?.fire,gun=fire==='instant'||fire==='area';
           if(weapons.aiming&&weapons.inventory.weapon.kind!=='melee'&&(gunFiring||weapons.inventory.reloading)||!weapons.aiming&&gun&&gunFiring)duck.forceStopMove();}
          controls={...controls,duck:{clip:duck.clip,speed:duck.speed}};
        }else duck.reset();
        // The player's pad for NitrousControl and BoostJumpControl: the car-gun button, the look keys and a fresh horn press.
        {const horn=input.down('CapsLock')||input.down('KeyH'),looking=input.down('KeyQ')||input.down('KeyE')||input.down('MouseMiddle');
         // The car-gun stick (GetCarGunLeftRight / GetCarGunUpDown) on the PC's special-control keys, numpad 4/6 and 8/2.
         // A touch screen's Hydraulics button, dragged, is the stick itself, as far as the finger pushes it.
         const gun=input.carGunStick,stick=gun?{leftRight:Math.round(gun.x*128),upDown:Math.round(gun.y*128)}:{leftRight:(Number(input.down('Numpad6'))-Number(input.down('Numpad4')))*128,upDown:(Number(input.down('Numpad2'))-Number(input.down('Numpad8')))*128};
         // GetHydraulicJump reads ShockButtonR, TOGGLE_SUBMISSIONS in a car: the '2' key and numpad plus.
         carPad={carGun:input.down('ControlLeft')||input.down('ControlRight')||input.down('MouseFire'),looking,hornJustDown:horn&&!hornHeldLast,stick,hydraulicJump:input.down('Digit2')||input.down('NumpadAdd'),
          // VEHICLE_STEERUP / STEERDOWN are the arrow keys on the PC; GetAccelerate is W (the port's arrows also drive).
          steerUpDown:Number(input.down('ArrowDown'))-Number(input.down('ArrowUp')),accelerate:input.down('KeyW')};hornHeldLast=horn;}
        // CObject::ProcessControl once a 30 fps game frame: the exploded props' roll and loose props settling static again.
        for(explodedClock+=step;explodedClock>=1/30;explodedClock-=1/30){hideExplodedProps();importedScene?.settleMoving();}
        // CTrain::ProcessControl: every carriage to its place on the rails, the bodies following in this step.
        fleet?.stepTrains(step*50,gameTimeMs);
        for(const car of fleet?.cars??[]){car.wetRoads=weatherStarted?weather.wetRoads:0;car.propFor??=scenePropFor;car.firstPersonCamera=!!render.firstPerson;car.controlsDisabled=playerControlsDisabled();car.pad=car.occupied&&!playerControlsDisabled()?carPad:NO_CAR_PAD;
          // ProcessControlInputs' automaticallyHandBrake: the exit button held (not through a jump-out) or the driver under arrest.
          car.exitHeld=car.occupied&&carEntry.phase!=='jumpOut'&&(input.down('KeyF')&&!padSwitchedOff('enterCar')&&!playerControlsDisabled()||law.arrested);
          car.beforeStep(step,steerAxes,input.down('Space'),importedScene?.sources);}
        // The touch stick is the yoke: pushed forward the nose goes down, as a pad's left stick flies (on the port's steering
        // curve, its GetSteeringLeftRight and UpDown); the keys otherwise.
        const yoke=input.stick&&Math.hypot(input.stick.x,input.stick.y)>.12?input.stick:undefined,yokeCurve=input.stickFromPad?(v:number)=>v:stickSteering;
        for(const plane of fleet?.planes??[])plane.beforeStep(step,{throttle:Number(input.down('KeyW'))-Number(input.down('KeyS')),pitch:yoke?-yokeCurve(yoke.y):Number(input.down('ArrowDown'))-Number(input.down('ArrowUp')),roll:yoke?yokeCurve(yoke.x):Number(input.down('KeyD'))-Number(input.down('KeyA')),rudder:Number(input.down('KeyE'))-Number(input.down('KeyQ')),brake:input.down('Space')});
        for(const plane of fleet?.planes??[])if(plane.entry&&advancePlaneEntry(plane.entry,step)){const {phase,foot}=plane.entry;plane.entry=undefined;if(phase==='getin')plane.finishEnter();else plane.finishExit(foot);}
        for(const boat of fleet?.boats??[])boat.beforeStep(step,boat.occupied?{throttle:axes.y,steer:steerAxes.x,brake:input.down('Space')}:undefined);
        // ProcessDrivingAnims in a boat: a boat without m_bSitInBoat uses the DRIVE_BOAT set, steering and looking back.
        {const boat=fleet?.occupiedBoat;if(boat&&!(boat.modelFlags&MODEL_FLAG.sitInBoat))boat.driving.step(step,{steer:boat.steerAngle,reversing:boat.gasPedal<0&&!(boat.modelFlags&MODEL_FLAG.low),idleFull:true,ride:BOAT_RIDE,duration:name=>carEntry.clips.ped(name)?.duration});}
        const bikeMotion=bikeMount.step(step);
        // While the rider waits or gets off, the bike only brakes.
        // DisablePlayerControls: no hop (CBmx refuses the press and drops the charge), gas off and the brakes on, as
        // CAutomobile::ProcessControlInputs does for the quad.
        for(const bike of fleet?.bikes??[])bike.beforeStep(step,bike.occupied&&!bike.scriptDriven?(bikeMount.active&&bikeMount.bike===bike||controlsOff?{throttle:0,steer:0,brake:true,disabled:controlsOff}:{throttle:axes.y,steer:steerAxes.x,brake:input.down('Space'),hop:input.down('ControlLeft')}):bike.autopilotInput());
        const tPlayer=performance.now();
        const riding=!!(worldCar?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike||carEntry.pinned||bikeMount.pinned||playerPassenger||playerAttached);
        // A ride or entry sequence ending leaves CJ standing: neither move blend ratio carries over from before it.
        // The car clips blend over every other full-body clip as the ride starts: a hit, a fist-shake or a script clip
        // playing then does not freeze through the ride and come back after it.
        // An exit that hands CJ the vehicle's move speed keeps it.
        if(wasRiding!==riding){wasRiding=riding;sim.player.moveBlend=0;if(riding||!sim.exitCarriesSpeed){sim.player.speed=0;sim.player.jumpMomentum={x:0,z:0};sim.player.verticalSpeed=0;}sim.exitCarriesSpeed=false;if(!riding)sim.checkInAirAfterRide();sim.fall={minVz:0,falling:false};render.nativeCharacter?.resetLocomotion();if(riding&&!playerAttached&&sim.player.health>0)render.nativeCharacter?.clearReaction();}
        if(riding){
          // CPlayerPed::ProcessControl: in any vehicle but a CBmx (the BMX, Chopper and Mountain Bike), sprint energy
          // recovers as standing still.
          if(!BMX_MODELS.has(fleet?.occupiedBike?.modelId??-1))sim.player.stamina=stepStamina(sim.player.stamina,false,false,step);
          sim.stepWorld();sim.advanceClock(step*sim.clockRate());
          sim.advancePlayerDeath(step,()=>{
            carEntry.abandon();bikeMount.abandon();
            if(worldCar)worldCar.occupied=false;
            for(const car of fleet?.cars??[])car.occupied=false;
            for(const plane of fleet?.planes??[]){if(plane.occupied){plane.occupied=false;plane.throttle=0;}}
            for(const boat of fleet?.boats??[]){if(boat.occupied){boat.occupied=false;boat.throttle=0;}}
            for(const bike of fleet?.bikes??[])bike.occupied=false;
          });
        }
        else if(carEntry.rolling||bikeMount.rolling)sim.step(step,{...controls,x:0,y:0,jump:false,sprint:false,animationMotion:(carEntry.rolling?entryMotion:bikeMotion)??{x:0,z:0},animationMotionSpace:'world'});
        else {if(sim.climbing)render.nativeCharacter?.resetAirborne();// CTaskComplexFallAndGetUp and CTaskSimpleHitHead stand in for PlayerControlZelda: the stick that the sim ignores
          // under them does not drive the move clips' blend ratio either, so CJ gets up from standing.
          const held=sim.knockdown>0||sim.hitHead>0,stepped=held?{...controls,x:0,y:0,jump:false,sprint:false}:controls;
          // CTaskSimpleClimb's finish blends IDLE in at 1000 and zeroes the move ratio: the run or sprint from before the
          // jump does not carry over the ledge.
          if(sim.climbsFinished!==climbsSeen){climbsSeen=sim.climbsFinished;render.nativeCharacter?.resetLocomotion();}
          const animated=sim.climbing?controls:render.nativeCharacter?.step(step, stepped, sim)??controls;sim.step(step,(weapons.aiming||hipGun!==undefined)&&(controls.gunMove||controls.fightMove)&&!animated.animationMotion?controls:animated);}
        frameProfile.stepPlayer+=performance.now()-tPlayer;
        if(render.nativeCharacter?.duckRollDone)duck.rollFinished();
        kickSweptProps();releaseSortedOutCollisions();
        guard('pedestrians.afterStep',()=>pedestrians?.afterStep());
        // CWorld::Process: after the collisions, CVehicleRecording puts each played-back car on its recording.
        mission?.processCarRecordings(gameTimeMs);
        for(const car of fleet?.cars??[])car.afterStep(step);
        // BreakManager_c::Update once per native frame at the PC frame limiter's 30 fps (APP_MAX_FPS).
        for(breakClock+=step;breakClock>=1/30;breakClock-=1/30)breakManager.update(50/30,worldFx.breakFx);
        // CGlass::Update and Render once per native frame at the PC frame limiter's 30 fps, CTimer's step 50/30: the
        // fall is scaled by it, the tumble is not.
        if(glass.panes.length||glassShown){
          glassShown=glass.panes.length>0;
          for(glassClock+=step;glassClock>=1/30;glassClock-=1/30)glass.update(50/30,gameTimeMs,(at,slow)=>{sound.nativeEngine?.collisions?.reportGlassCollisionEvent('hitGround',{x:at[0],y:at[1],z:at[2]});if(!slow)worldFx.glassLanding(at,1);});
          if(!glassTextured){const cracked=worldFx.texture('wincrack_32'),pool=render.lighting.sunTexture?.poolTexture;if(cracked&&pool){glassView.setTextures(pool,cracked);glassTextured=true;}}
          const f=render.camera.getWorldDirection(scratchAim),c=render.camera.position;
          glassView.update(glass,gameTimeMs,[f.x,-f.z,f.y],[c.x,-c.z,c.y]);
        }
        // CSpecialFX::Update's CMotionBlurStreaks::Update, then CEntity::PreRender's streaks for thrown grenades and
        // molotovs moving over 0.03 units a frame in 2D (a molotov only above water), once per 30 fps frame.
        for(streakClock+=step;streakClock>=1/30;streakClock-=1/30){
          streaks.update();
          const r=render.camera.matrixWorld.elements,right={x:r[0]*.07,y:r[1]*.07,z:r[2]*.07},level=render.lighting.water.levels;
          for(const p of weapons.projectiles){
            if((p.weapon!==16&&p.weapon!==18)||Math.hypot(p.velocity.x,p.velocity.z)<=.03*50)continue;
            const water=p.weapon===18?level?.level(p.position.x,-p.position.z):undefined;if(water!==undefined&&p.position.y<=water)continue;
            streaks.register(p.id+1,p.weapon===16?[100,100,100,255]:[255,160,100,255],{x:p.position.x-right.x,y:p.position.y-right.y,z:p.position.z-right.z},{x:p.position.x+right.x,y:p.position.y+right.y,z:p.position.z+right.z});
          }
        }
        // CSetPieces::Update, once per 30 fps frame: police ambushes where the player stands, by wanted level.
        for(setPieceClock+=step;setPieceClock>=1/30;setPieceClock-=1/30){
          if(!setPieces||!police||!pedestrians||render.lighting.area!==0)break;
          const p=sim.player.position,car=worldCar?.occupied?worldCar:fleet?.occupied,inVehicle=!!car||!!fleet?.occupiedPlane||!!fleet?.occupiedBike||!!fleet?.occupiedBoat;
          const v=car?car.car.body.linvel():{x:Math.sin(sim.player.heading)*sim.player.speed,z:Math.cos(sim.player.heading)*sim.player.speed};
          for(const request of setPieces.update(++setPieceFrame,{player:[p.x,-p.z,p.y+1],playerSpeed:[v.x/50,-v.z/50],wanted:law.level,inVehicle,timeMs:gameTimeMs}))void generateSetPiece(request);
        }
        // CBirds::Update from CGame::Process, once per frame.
        for(birdClock+=step;birdClock>=1/30;birdClock-=1/30){
          const c=render.camera.position,f=render.camera.getWorldDirection(scratchAim),level=render.lighting.water.levels;
          const waterLevel=(x:number,y:number)=>level?.level(x,y);
          birds.update({camera:[c.x,-c.z,c.y],forward:[f.x,-f.z,f.y],area:render.lighting.area,hour:Math.floor(sim.timeMinutes/60)%24,
            distanceToWater:cameraWater.distance,desert:nativeWeatherRegion(c.x,-c.z)===WEATHER_REGION.desert,waterLevel,
            lineOfSightClear:(a,b)=>{const from={x:a[0],y:a[2],z:-a[1]},d={x:b[0]-a[0],y:b[2]-a[2],z:-(b[1]-a[1])},l=Math.hypot(d.x,d.y,d.z)||1;
              return !sim.world.castRay(new RAPIER.Ray(from,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.ONLY_FIXED);}},++birdFrame,1/30);
        }
        // Once each: afterStep hands back a pending BlowUpCar, which a second call would lose.
        for(const boat of fleet?.boats??[])if(boat.afterStep())weapons.vehicleExplosion(boat.body.translation(),'boat');
        for(const bike of fleet?.bikes??[]){bike.propFor??=scenePropFor;if(bike.afterStep())weapons.vehicleExplosion(bike.body.translation(),'bike');}
        carEntry.syncPlayer();
        pinAttachedPlayer();
        for(const plane of fleet?.planes??[]){plane.onBurnExplosion??=at=>weapons.burningAircraftExplosion(at);if(plane.afterStep())weapons.vehicleExplosion(plane.body.translation(),'aircraft',()=>fleet?.planes.has(plane)?{...plane.body.translation()}:undefined);}
        if(stuntJumps){
         // Any vehicle but a boat, plane or helicopter: cars and bikes alike.
         const car=[...(fleet?.cars??[])].find(c=>c.occupied)??(worldCar?.occupied?worldCar:undefined),bike=car?undefined:fleet?.occupiedBike;
         const body=car?.car.body??bike?.body,p=body?.translation(),v=body?.linvel();
         const water=p?render.lighting.water.levels?.level(p.x,-p.z):undefined,under=water!==undefined&&p!==undefined&&water>p.y;
         stuntJumps.update(step*1000,{driving:!!body&&sim.player.health>0&&!law.arrested,position:p?{x:p.x,y:-p.z,z:p.y}:{x:0,y:0,z:0},
          moveSpeed:v?{x:v.x/50,y:-v.z/50,z:v.y/50}:{x:0,y:0,z:0},collided:car?car.entitiesCollided:bike?bike.entitiesCollided():1,lost:car?car.wrecked||car.drowning||under:bike?bike.wrecked||under:false});
        }
        progression.tick(step,!!worldCar?.occupied,law.arrested);
        carEntry.drivingSkill=progression.drivingSkill;
        if(entryExits&&importedScene&&!interiorTransfer){
         const active=entryExits.active;
         if(active){
          const next=entryExits.finishStep(cameraFade.fading);
          if(next==='teleport')startInteriorTransfer(active);
          else if(next){cameraFade.fade(next.fade*1000,0,gameTimeMs,!!mission?.runtime.game.camera.ignoreFadingStuffForMusic);hud.fade(true,next.fade*1000);}
         }else{
          const p=sim.player.position;
          // CPlayerPed::CanPlayerStartMission: in control, no attack task, alive. Vehicles are not teleported yet.
          // CPlayerPed::CanPlayerStartMission also wants GAME_STATE_PLAYING and no script-given primary task.
          const canStart=onFoot&&sim.player.health>0&&!law.arrested&&!sim.climbing&&sim.player.grounded&&!weapons.aiming&&!sim.player.swimming&&sim.knockdown===0&&sim.deathRemaining===0&&gameLogic.state===0&&!playerTasks.active;
          entryExits.update({position:[p.x,-p.z,p.y+1],vehicle:onFoot?undefined:{type:'other',big:false},canStartMission:canStart},Math.floor(sim.timeMinutes/60)%24,playerControlsDisabled());
         }
        }
        // CPickup::Update: only a bribe can be taken from a vehicle, any vehicle (IsSphereTouchingVehicle); the rest need
        // the player on foot.
        // FindPlayerVehicle counts a passenger seat. CPickups::Update skips the player's pickups while he runs
        // CTaskComplexEnterCarAsDriver (the walk to the door included, and a bike's mount) or the mobile phone.
        const driven=worldCar?.occupied?worldCar:fleet?.occupied??playerPassenger?.car,ridden=fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
        const pickupsBusy=carEntry.active||bikeMount.active||!!phones.get('player')?.active;
        pickups.step(step,driven?(point,radius)=>driven.sphereTouches(point,radius):ridden?(point,radius)=>!!ridden.assets.collision&&sphereTouchingVehicle(ridden.body,ridden.assets.collision.bounds,point,radius):pickupsBusy?()=>false:undefined,Math.floor(gameTimeExact*30/1000));
        const onFootDrops=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!playerPassenger&&!pickupsBusy;
        const cash=moneyDrops.step(step,{position:sim.player.position,alive:sim.player.health>0,onFoot:onFootDrops});
        if(cash){sim.money+=cash;sound.frontend(AE_FRONTEND.pickupMoney);}
        // A dead ped's gun is a PICKUP_ONCE_TIMEOUT pickup: CPickup::Update's weapon rules apply (stand on it over
        // another loaded weapon of the slot, ammo into an exchangeable slot, the collect press takes it).
        drops.step(step,{position:sim.player.position,alive:sim.player.health>0,onFoot:onFootDrops},(weapon,drop)=>{
         const gate={ammo:drop.rounds,empty:drop.empty,helpShown:drop.helpShown},verdict=pickups.gateWeapon(weapon,gate,text=>hud.help(text));
         drop.rounds=gate.ammo;drop.empty=gate.empty;drop.helpShown=gate.helpShown;
         if(verdict!=='take')return undefined;
         const before=weapons.inventory.selected,given=weapons.inventory.give(weapon,gate.ammo);
         if(!given)return undefined;
         if(weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);
         const name=WEAPONS.find(w=>w.id===weapon)?.name??'Weapon';
         sound.frontend(AE_FRONTEND.pickupWeapon);
         return name;
        });
        let playerSurface: import('./assets/surfaceAudio').FootstepCategory | undefined = importedScene ? 'concrete' : undefined,playerSurfaceFlags:import('./assets/surfaceAudio').SurfaceAudioFlags|undefined;
        if (importedScene && sim.player.grounded) {
          const contact=sampleNativeGroundLighting(sim.world,sim.player.position,sim.playerCollider,importedScene.sources);
          lastGround=contact;
          render.contactLighting=contact?.light;
          playerSurfaceFlags=contact?surfaceAudio?.byId.get(contact.material):undefined;
          // Feet under open water step and land on the swimming bank even over dry collision.
          const waterAt=render.lighting.water.levels?.level(sim.player.position.x,-sim.player.position.z);
          playerSurfaceFlags=wadingSurface(playerSurfaceFlags,waterAt===undefined?undefined:waterAt-sim.player.position.y);
          playerSurface=nativeFootstepCategory(playerSurfaceFlags);
        }
        const action=render.nativeCharacter?.currentAction;
        if(!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike)sound.tick(sim, render.nativeCharacter?.landingFootContacts, playerSurface,{surface:playerSurfaceFlags,move:action==='sprint'?'sprint':action==='run'?'run':'walk'});
      });
      frameProfile.steps+=performance.now()-tSteps;
    }
    if(input.consume('KeyM'))navigation?.toggle();
    if(paused||terrainPause||navigation?.open||arsenal.open)input.dropPresses();
    const tBetween=performance.now();
    if(!paused&&!navigation?.open&&!arsenal.open){stepPrebuild();scriptSceneTransfer();requestFollowingTerrain();}
    // A passenger whose car has gone or burnt out is set down beside it.
    if(playerPassenger&&(playerPassenger.car.disposed||playerPassenger.car.wrecked))leavePassengerSeat();
    render.vehicleView=!!worldCar?.occupied||!!fleet?.occupiedPlane||!!fleet?.occupiedBoat||!!fleet?.occupiedBike||!!playerPassenger;
    {
      const p=sim.player,water=render.lighting.water.levels?.level(p.position.x,-p.position.z),entering=carEntry.active&&['approach','align','locked','open','pullout','getIn','closeInside','shuffle'].includes(carEntry.phase!);
      const inCar=!!worldCar?.occupied||!!fleet?.occupiedPlane||!!fleet?.occupiedBoat||carEntry.seated||carEntry.phase==='waitSlow'||carEntry.phase==='getOut';
      render.playerShadowAllowed=playerRealTimeShadow()&&drawsRealTimeShadow({submerged:water!==undefined&&water>p.position.y,vehicle:fleet?.occupiedBike?'bike':inCar?'other':undefined,enteringAsDriver:entering?'other':undefined,
        // The drawn ped's root is its matrix position: a unit above the feet on foot, the seat when riding.
        alive:p.health>0,originZ:render.nativeCharacter?.root.getWorldPosition(scratchSpine).y??p.position.y+PED_ORIGIN_HEIGHT,spine1Z:render.nativeCharacter?.bonePosition(3,scratchSpine)?.y,ducking:p.crouched});
    }
    installSwimClips();if(!builtBody)rebuildPlayerIfNeeded();applyPlayerMotionGroup();
    render.vehicleDistance=fleet?.occupiedPlane?Math.max(22,fleet.occupiedPlane.assets.collision!.bounds.radius*2.5):9;render.vehicleLooks=!fleet?.occupiedPlane;
    // CCam::Process_1stPerson's source: the front-seat dummy with its x ignored plus (0, 0.08, 0.62) in the vehicle's
    // frame; a bike's height is the rider's neck plus 0.15; a boat's is its front light dummy half a unit higher (the
    // port's boats keep no light dummies, so the bounds' front top stands in). The vehicle's render root gives the
    // frame the mesh is drawn at.
    render.bumperAllowed=!mission?.runtime.game.camera.disableFirstPersonInCar;
    {
      const car=worldCar?.occupied?worldCar:fleet?.occupied,bike=fleet?.occupiedBike,boat=fleet?.occupiedBoat;
      const frameOf=(root:Object3D,local:{x:number;y:number;z:number})=>{const q=root.quaternion,w=new Vector3(local.x,local.z,-local.y).applyQuaternion(q);return {source:{x:root.position.x+w.x,y:root.position.y+w.y,z:root.position.z+w.z},quaternion:{x:q.x,y:q.y,z:q.z,w:q.w}};};
      if(car){const seat=car.car.nativeFramePosition('ped_frontseat');render.bumper=frameOf(car.car.root,{x:0,y:(seat?.y??0)+.08,z:(seat?.z??0)+.62});}
      else if(bike){const b=frameOf(bike.root,{x:0,y:.08,z:.62}),neck=render.nativeCharacter?.bonePosition(4,scratchSpine);if(neck)b.source.y=neck.y+.15;render.bumper=b;}
      else if(boat){const bounds=boat.assets.collision?.bounds;render.bumper=frameOf(boat.root,{x:0,y:(bounds?.max[1]??0)+.08,z:(bounds?.max[2]??0)+.62+.5});}
      else render.bumper=undefined;
    }
    guard('pedestrians.render',()=>pedestrians?.render(alpha,render.lighting.nativeObjectAmbient,nativeDayNightBalance(sim.timeMinutes),weapons.vision==='infrared'));
    for(const plane of fleet?.planes??[])plane.update(alpha);
    for(const boat of fleet?.boats??[])boat.update(alpha);
    for(const bike of fleet?.bikes??[])bike.update(alpha);
    for(const train of fleet?.trains??[])train.update();
    // The on-foot key hints (jump, crouch, enter car) do not apply in a vehicle.
    hud.element.classList.toggle('in-vehicle',!!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike||playerPassenger));
    if(touch){
     const asked=hud.shownPrompts().flatMap(controlsNamedIn),inVehicle=hud.element.classList.contains('in-vehicle');
     // A cutscene, or a scripted scene the widescreen bars frame (the intro's ride, a mission's opening), leaves the
     // player nothing to drive or walk: the controls give way, to Skip while it can be skipped (a cutscene, or a script
     // with SKIP_CUTSCENE_START's label set). The script holding the player (SET_PLAYER_CONTROL off) does not clear
     // them: a gym's machine, a dance or a shop reads the pad's buttons itself while it holds him ("Press SPRINT
     // rapidly to begin to pedal"). Held, he cannot lean out for a drive-by, though.
     const game=mission?.runtime.game,scene=!!game&&(game.cutscene.running||game.widescreenOn),held=scene||playerControlsDisabled();
     // Wasted or busted, nothing CJ could do answers until he is back on his feet: the controls give way, as in a scene,
     // to the screen's own message and its fade.
     const out=sim.player.health<=0||law.arrested;
     // A side-mission vehicle (a taxi, an ambulance, a police car...) puts up Mission, the port's mission start and cancel.
     {const ridden=worldCar?.occupied?worldCar:fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane??[...fleet?.trains??[]].find(t=>t.occupied);
      if(ridden&&!playerPassenger&&SIDE_MISSION_VEHICLES.has(ridden.modelId))asked.push('TOGGLE_SUBMISSIONS');}
     // An interactive script menu up puts up its arrows, Select and Back (a grid of car colours left and right too).
     {const menus=mission?.runtime.game.menus,current=menus?.numInUse&&menus.inUse[menus.currentMenuInUse]?menus.menus[menus.currentMenuInUse]:undefined;
      if(current?.interactive[0])asked.push('MENU_UP','MENU_DOWN',...current.type===1?['MENU_LEFT','MENU_RIGHT']:[],'MENU_BACK','MENU_SELECT');}
     // On foot, the group's buttons as the port's widgets show them: Recruit while targeting a Families member who would
     // join, else Follow and Stay while a crew listens (the help text names them only the first time).
     if(!inVehicle&&!held&&!carEntry.active&&pedestrians&&!mission?.runtime.game.playerInfo.groupStuffDisabled){
      const offer=pedestrians.groupOffer(groupTarget());
      if(offer.recruit)asked.push('GANG_RECRUIT');else if(offer.crew)asked.push('GROUP_CONTROL_FWD','GROUP_CONTROL_BWD');
     }
     // Yes and No (the port's REPLY_YES and _NO, "Positive talk" and "Negative talk"): a script's conversation waiting
     // for an answer, or, on foot with Aim held, someone CJ could talk to.
     if(!inVehicle&&!carEntry.active&&!playerControlsDisabled()&&(mission?.runtime.game.conversations.waitingForInput||!held&&input.down('MouseAim')&&!!pedestrians?.canTalk(talkTarget())))
      asked.push('CONVERSATION_YES','CONVERSATION_NO');
     // A script waiting on a pad button the controls show only on call puts its button up while it reads it, though the
     // help names it only the first time (scriptButtons): the phone's Action for a call or camera.scm's picture, Enter at
     // a machine or a blackjack table, the arrows for a gym machine's level or the roulette chip, Look back for a hoop.
     {const read=scriptReads.update(button=>mission?.runtime.game.pads.reads(0,button)??0,performance.now());
      if(!carEntry.active)asked.push(...touchActionsForReads(read,{inVehicle,menu:asked.includes('MENU_SELECT'),asked,held:playerControlsDisabled()}));}
     // A plane with retracting gear puts up Gear in the air, and the Hydra VTOL.
     {const plane=fleet?.occupiedPlane;if(plane?.retractableGear&&!plane.grounded)asked.push('AIRCRAFT_GEAR');if(plane?.modelId===520)asked.push('AIRCRAFT_VTOL');}
     // Flying, the look keys are the rudder the Yaw buttons already are, and help names them so. In a road vehicle with a
     // drive-by to fire (the driver's SMG, or a passenger's seat), looking out of either side comes up.
     {const flying=!!fleet?.occupiedPlane,inv=weapons.inventory;
      if(flying){for(let i=asked.length-1;i>=0;i--)if(asked[i]==='VEHICLE_LOOKLEFT'||asked[i]==='VEHICLE_LOOKRIGHT')asked.splice(i,1);}
      else if(inVehicle&&!held&&mission?.runtime.game.playerInfo.canDoDriveBy!==false&&(playerPassenger||inv.inSlot(inv.slotOf(28))!==undefined))asked.push('VEHICLE_LOOKLEFT','VEHICLE_LOOKRIGHT');
     }
     touch.setVisible(!paused&&!navigation?.open&&!arsenal.open&&!(gamepad.lastUsed>lastTouchAt));touch.setPrompts(out?[]:asked);
     if(fleet)fleet.trafficScale=touchPopulation();
     const skippable=!!game&&(game.cutscene.running||game.widescreenOn&&mission!.runtime.active.some(slot=>slot.thread.sceneSkipIp!==undefined));
     touch.setPassenger(!!playerPassenger);
     touch.setMode(scene||out?'cutscene':fleet?.occupiedPlane?'aircraft':inVehicle?'vehicle':render.firstPerson?'scope':sim.player.swimming?'swim':'foot');
     // Enter shows only when it would do something, as the mobile ports' does: in a vehicle, with a jetpack on, on the
     // way to a car's door, when a prompt asks for it, or beside a vehicle (the box the enter button searches; looked
     // at a few times a second).
     if(inVehicle||sim.jetPack||carEntry.active||asked.includes('VEHICLE_ENTER_EXIT'))touchEnterNear=true;
     else if(++touchEnterTick%8===0){const p=sim.player.position,near=(q:{x:number;y:number;z:number})=>Math.abs(q.x-p.x)<10&&Math.abs(q.z-p.z)<10&&Math.abs(q.y-p.y)<5;
      touchEnterNear=[...(fleet?.cars??[])].some(c=>c.consideredByPlayer!==false&&near(c.car.body.translation()))||[fleet?.nearestPlane(true),fleet?.nearestBoat(true),fleet?.nearestBike(true)].some(v=>!!v&&v.distance()<10);}
     // The enter widget's art (enterWidgetArt): the vehicle he sits in, else the nearest one the button would take.
     if(touchEnterNear&&(inVehicle||touchEnterTick%8===0)){
      const seated=[...(fleet?.cars??[])].find(c=>c.occupied)??(worldCar?.occupied?worldCar:undefined)??fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
      let target:{modelId:number;hydraulics?:unknown}|undefined=seated,best=10;
      if(!seated)for(const v of [...(fleet?.cars??[]),fleet?.nearestPlane(true),fleet?.nearestBoat(true),fleet?.nearestBike(true)]){
       if(!v||v.consideredByPlayer===false)continue;const d=v.distance();if(d<best){best=d;target=v;}}
      touch.setEnterArt(enterWidgetArt(target&&{type:fleet?.vehicleIdeType(target.modelId),modelId:target.modelId,hydraulics:!!target.hydraulics},!seated,!!sim.jetPack));
     }
     // Radio, while the vehicle has a radio to tune (a bicycle has none, CAERadioTrackManager's RADIO_DISABLED).
     touch.setOffered([...touchEnterNear?['enter']:[],...worldCar?.occupied&&worldCar.car.nitro.installed?['nitro']:[],...worldCar?.occupied&&worldCar.hydraulics?['hydraulics']:[],...fleet?.occupiedBike&&BMX_MODELS.has(fleet.occupiedBike.modelId)?['hop']:[],...radioModel!==undefined?['radio']:[],...skippable?['skip']:[]]);
    }
    const aircraft=fleet?.occupiedPlane;hud.element.classList.toggle('flying',!!aircraft);flightInstruments.hidden=!aircraft;if(aircraft)flightInstruments.textContent=touch
     // A phone's short screen gets one line, a stall first: the name shows below and the buttons say what they do.
     ?`${aircraft.stall?'STALL — lower nose · ':''}${Math.round(aircraft.airspeed*3.6)} km/h · ${Math.round(aircraft.altitude)} m${aircraft.retractableGear?` · Gear ${aircraft.gearUp?'UP':'DOWN'}`:''}${aircraft.modelId===520?` · ${aircraft.vtol?'VERTICAL':'FORWARD'}`:''}`
     :`${aircraft.name} · ${Math.round(aircraft.airspeed*3.6)} km/h · ${Math.round(aircraft.altitude)} m AGL · Throttle ${Math.round(aircraft.throttle*100)}% · Gear ${aircraft.gearUp?'UP':'DOWN'}${aircraft.modelId===520?` · ${aircraft.vtol?'VERTICAL':'FORWARD'} [T]`:''}${aircraft.armed?` · Guns [Ctrl]${aircraft.rocketsArmed?` · Rockets [B]`:''}`:''}${aircraft.stall?' · STALL — lower nose':''} | W/S throttle · ↓/↑ pitch · A/D bank · Q/E turn · G gear · Space ${aircraft.helicopter||aircraft.modelId===520&&aircraft.vtol?'hover':'brake'} · F exit`;
    for(const car of fleet?.cars??[]){car.car.update(alpha);car.car.setNight(nativeDayNightBalance(sim.timeMinutes));}
    // CSkidmarks::Update in the game frame, then each car's PreRender registers its wheels, then Render.
    if(!paused&&!navigation?.open&&!arsenal.open&&roadSurfaces){const surfaces=roadSurfaces,now=Math.floor(elapsed*1000);skids.update(now);
      for(const car of fleet?.cars??[])skids.lay(car,now,{skidMark:material=>surfaces.records.get(material)?.skidMark,water:material=>!!surfaces.records.get(material)?.values.water},render.camera);}
    skids.render(Math.floor(elapsed*1000),nativeDayNightBalance(sim.timeMinutes));
    // The car over a stuck CJ runs him over only while the world runs, not under the pause menu, map or arsenal.
    playerDamageReactions(!paused&&!terrainPause&&!navigation?.open&&!arsenal.open?dt:0);
    breakPieces.sync(breakManager);
    syncMovedProps();
    if(weatherStarted)wakes.update(fleet?.boats??[],{waterLevel:(x,y)=>render.lighting.water.levels?.level(x,y),camera:render.camera.position,windClipped:weather.windClipped,elapsedMs:Math.floor(elapsed*1000)});
    const leavingAll=carEntry.npcPoses();
    const policeCars=new Set(police?.units.map(u=>u.car));
    // CTheCarGenerators holds the script's generators in the same array as the world's, so the fleet is given
    // both; the list only changes when the script makes one, so it is rebuilt then rather than every frame.
    if(mission&&fleet){
     // Counting is cheap; building the list is not, so it is only built when the count has moved.
     const count=mission.scriptCarGeneratorCount();
     if(count!==scriptGeneratorCount){
      scriptGeneratorCount=count;
      fleet.setGenerators([...worldGenerators,...mission.scriptCarGenerators()]);
     }
    }
    // CRestart is one table in the original: once the script has filled its restart table, the game's respawn
    // reads that same table, so every change the script makes (and every override a restart spends) is shared.
    if(mission&&gameLogic.restart!==mission.scriptRestart()&&mission.scriptRestartRevision()>0)gameLogic.restart=mission.scriptRestart();
    // CStuntJumpManager's list is the script's own; the browser's was read ahead and is replaced by it.
    if(mission&&stuntJumps){
     const scripted=mission.scriptStuntJumps();
     if(scripted.length!==scriptStuntJumpCount){scriptStuntJumpCount=scripted.length;stuntJumps.setJumps(scripted);}
    }
    // CSetPieces' table is the script's too.
    if(mission&&setPieces){
     const count=mission.scriptSetPieceCount();
     if(count!==scriptSetPieceCount){scriptSetPieceCount=count;setPieces.setPieces(mission.scriptSetPieces());}
    }
    if(scriptObjectViews&&mission){
      // The script's objects g_breakMan took this frame, broken from the models still drawn before the views hide them.
      const broken=mission.runtime.game.objects.broken;
      for(const {handle,justFaces} of broken){
        const source=scriptObjectViews.breakSource(handle);
        if(source)breakModel(source.model,source.textures,source.bounds,source.matrix,justFaces,objectDefValues(source.id)??{});
      }
      broken.length=0;
      mission.refreshAttachments();
      scriptObjectViews.update(mission.scriptObjects(),paused?0:dt*timeScale());
    }
    // CPickups' own array holds the script's pickups beside the world's, so the browser's pickup world takes
    // them too. The IDE associations name the dff and txd a model id stands for, which is the one thing the
    // script's record does not carry; a model the archive has no entry for cannot be drawn and is left out.
    if(mission&&scriptPickupModels){
     // A pickup the script has made or had collected changes the count, and nothing else about the list
     // moves, so a count that matches what is registered means there is nothing to do.
     if(mission.scriptPickupCount()!==scriptPickupIds.size){
     const wanted=mission.scriptPickups();
     const live=new Set(wanted.map(p=>p.handle));
     for(const [handle,id] of scriptPickupIds)if(!live.has(handle)){pickups.removeGenerated(id);scriptPickupIds.delete(handle);}
     for(const pickup of wanted){
      if(scriptPickupIds.has(pickup.handle))continue;
      const association=typeof pickup.model==='number'?scriptPickupModels.byId.get(pickup.model):scriptPickupModels.byName.get(String(pickup.model).toLowerCase());
      if(!association)continue;
      const id=`script:${pickup.handle}`;
      pickups.generate({id,command:'CREATE_PICKUP',section:'script',offset:0,modelId:association.id,
       // CPickup::Update treats a script's pickup as any other: its model decides what it gives.
       model:association.model,dictionary:association.dictionary,type:pickup.type,category:pickupCategory(association),
       ammo:pickup.ammo,position:pickup.position,
       // CREATE_PROTECTION_PICKUP's limit and daily take, and a property's price and label.
       ...(pickup.type===PICKUP_TYPE.assetRevenue?{revenueLimit:pickup.price,revenueRate:pickup.moneyPerDay}:{price:pickup.price}),text:pickup.text},Number.POSITIVE_INFINITY);
      scriptPickupIds.set(pickup.handle,id);
     }
     }
    }
    // CCamera's fixed mode, which the script takes and gives back. The browser keeps its own camera until the
    // script asks for one, and takes it back as soon as the script restores it — anything else the browser had
    // fixed, a stunt jump above all, is left where it was.
    if(mission){
     const scripted=mission.scriptCamera();
     if(scripted){scriptFixedCamera=render.fixedCamera={position:new Vector3(scripted.position.x,scripted.position.y,scripted.position.z),
      target:()=>new Vector3(scripted.target.x,scripted.target.y,scripted.target.z)};}
     else if(scriptFixedCamera&&render.fixedCamera===scriptFixedCamera){render.fixedCamera=undefined;scriptFixedCamera=undefined;}
    }
    occupants.update([...occupants.drivers(fleet?.cars??[],car=>policeCars.has(car)||!!driveby?.covers(car)||!!emergency?.covers(car)),...leavingAll.map(({pose:leaving,clip:leavingClip})=>({key:`leaving:${leaving.car.car.body.handle}`,car:leaving.car,model:occupants.driverModel(leaving.car),local:leaving.local,clip:leaving.clip,seconds:leaving.seconds,animation:leavingClip.clip})),...(police?.poses().map((p,i)=>({...p,key:`police:${p.car.car.body.handle}:${i}`}))??[]),...(emergency?.poses().map((p,i)=>({...p,key:`emergency:${p.car.car.body.handle}:${i}`}))??[]),...(driveby?.poses()??[]),...carEntry.passengerPoses(d=>{const name=`gang_driveby${d.side==='left'?'lhs':'rhs'}`,clip=driveby?.clip(name);return clip&&clip.duration>0?{clip:name,seconds:d.seconds%clip.duration,animation:clip,gun:driveby?.gun?.asset}:undefined;}),...carEntry.leavingPoses(),...scriptOccupantPoses(driveby,(block,name)=>carEntry.clips.peek(block,name),gameTimeMs)],render.lighting.nativeObjectAmbient,nativeDayNightBalance(sim.timeMinutes));
    const entryPose=carEntry.pose(),entryClips=entryPose&&carEntry.requiredClips();
    const entryPlane=[...(fleet?.planes??[])].find(p=>p.entry);
    if(entryClips&&render.nativeCharacter)render.nativeCharacter.installVehicleClips(entryClips,['car_rollout_lhs','car_rollout_rhs']);
    // The climb's clip lengths come from ped.ifp; climbing waits for them.
    if(!sim.climbDurations){const clips=CLIMB_CLIPS.map(name=>carEntry.clips.peek('ped',name));if(clips.every(clip=>clip))sim.climbDurations=Object.fromEntries(CLIMB_CLIPS.map((name,i)=>[name,clips[i]!.duration])) as Record<typeof CLIMB_CLIPS[number],number>;}
    // CTaskSimpleClimb's partial CLIMB_* association, standing at the ped position with its root translation.
    const climbAnim=sim.climb?.anim,climbJump=sim.climbJumpSeconds,climbClips=(climbAnim||climbJump!==undefined||swimJumpoutSeconds!==undefined)&&render.nativeCharacter?CLIMB_CLIPS.map(name=>[name.toLowerCase(),carEntry.clips.ped(name)] as const):undefined;
    if(climbClips?.every(([,clip])=>clip))render.nativeCharacter!.installVehicleClips(Object.fromEntries(climbClips) as Record<string,import('./assets/ifp').NativeAnimation>);
    const p=sim.player,lerp=(a:number,b:number)=>a+(b-a)*alpha;
    render.cameraFocus=undefined;
    if(sim.climb){
      // GetCameraTargetPos, in feet space.
      const focus=sim.climb.cameraTarget({x:lerp(p.previous.x,p.position.x),y:-lerp(p.previous.z,p.position.z),z:lerp(p.previous.y,p.position.y)+1});
      render.cameraFocus={x:focus.x,y:focus.z-1,z:-focus.y};
    }
    const passengerSeat=playerPassenger&&carEntry.passengerSeat(playerPassenger.car,playerPassenger.seat),passengerClip=playerPassenger&&sitClip(playerPassenger.car.modelFlags,false);
    if(playerPassenger&&passengerSeat&&passengerClip&&render.nativeCharacter?.hasVehicleClip(passengerClip)){
      // The passenger sits in his seat (CTaskSimpleCarDrive's sit, not the driver's).
      render.vehiclePose={frame:{vehicle:playerPassenger.car.car.root,local:passengerSeat},pose:{clip:passengerClip,seconds:0,blend:1}};
    }else if(climbAnim&&render.nativeCharacter?.hasVehicleClip(climbAnim.clip.toLowerCase())){
      render.vehiclePose={frame:{position:{x:lerp(p.previous.x,p.position.x),y:lerp(p.previous.y,p.position.y)+1,z:lerp(p.previous.z,p.position.z)},heading:p.heading},pose:{clip:climbAnim.clip.toLowerCase(),seconds:climbAnim.time,blend:climbAnim.blend}};
    }else if(swimJumpoutSeconds!==undefined&&sim.player.swimming&&render.nativeCharacter&&(()=>{const clip=carEntry.clips.peek('swim','Swim_Jumpout');if(clip&&!render.nativeCharacter.hasVehicleClip('swim_jumpout'))render.nativeCharacter.installVehicleClips({swim_jumpout:clip});return !!clip&&render.nativeCharacter.hasVehicleClip('climb_jump');})()){
      // CTaskSimpleSwim::ProcessSwimAnims, SWIM_BACK_TO_SURFACE: SWIM_JUMPOUT, then CLIMB_jump.
      const pose=swimJumpoutPose(swimJumpoutSeconds,carEntry.clips.peek('swim','Swim_Jumpout')?.duration??0);
      render.vehiclePose={frame:{position:{x:lerp(p.previous.x,p.position.x),y:lerp(p.previous.y,p.position.y)+1,z:lerp(p.previous.z,p.position.z)},heading:p.heading},pose:{...pose,blend:1}};
    }else if(climbJump!==undefined&&render.nativeCharacter?.hasVehicleClip('climb_jump')){
      // CTaskSimpleJump::Launch blends CLIMB_jump for a climb jump; CTaskSimpleInAir keeps it while it plays.
      render.vehiclePose={frame:{position:{x:lerp(p.previous.x,p.position.x),y:lerp(p.previous.y,p.position.y)+1,z:lerp(p.previous.z,p.position.z)},heading:p.heading},pose:{clip:'climb_jump',seconds:climbJump,blend:1}};
    }else if(entryPose&&render.nativeCharacter?.hasVehicleClip(entryPose.clip)){
      const world=entryPose.world?{x:p.previous.x+(p.position.x-p.previous.x)*alpha,y:p.previous.y+(p.position.y-p.previous.y)*alpha+1,z:p.previous.z+(p.position.z-p.previous.z)*alpha}:undefined;
      render.vehiclePose={frame:entryPose.car?{vehicle:entryPose.car.car.root,local:entryPose.local,headingOffset:entryPose.headingOffset}:{position:world,heading:entryPose.heading},pose:{clip:entryPose.clip,seconds:entryPose.seconds,blend:entryPose.blend,overlay:entryPose.overlay,overlays:entryPose.overlays}};
    }else if(bikeMount.active&&render.nativeCharacter&&bikeMount.pose()){
      // Bike jump-on and get-off: bike space at the side point (the clip's root carries the body), or the world once a
      // get-off-back has set the rider out.
      const pose=bikeMount.pose()!;render.nativeCharacter.installVehicleClips(bikeMount.requiredClips());
      render.vehiclePose=pose.world?{frame:{position:{x:p.previous.x+(p.position.x-p.previous.x)*alpha,y:p.previous.y+(p.position.y-p.previous.y)*alpha+1,z:p.previous.z+(p.position.z-p.previous.z)*alpha},heading:pose.heading},pose:{clip:pose.clip,seconds:pose.seconds,blend:1}}
        :{frame:{vehicle:pose.bike!.root,local:pose.local},pose:{clip:pose.clip,seconds:pose.seconds,blend:1}};
    }else if(entryPlane?.entry&&render.nativeCharacter?.hasVehicleClip(entryPlane.entry.steps[entryPlane.entry.index].clipName)){
      // Choreographed aircraft entry/exit (clips resolved through the handling anim group).
      const e=entryPlane.entry,step=e.steps[e.index],seat=entryPlane.seat();
      if(e.phase==='getin'&&seat)render.vehiclePose={frame:{vehicle:entryPlane.root,local:seat},pose:{clip:step.clipName,seconds:e.time,blend:1}};
      else{const p=sim.player.position;render.vehiclePose={frame:{position:{x:p.x,y:p.y+1,z:p.z},heading:sim.player.heading},pose:{clip:step.clipName,seconds:e.time,blend:1}};}
    }else if(fleet?.occupiedPlane&&render.nativeCharacter){
      // CTaskSimpleCarDrive in an aircraft: ProcessDrivingAnims' ride set at the mirrored ped_frontseat dummy.
      const plane=fleet.occupiedPlane,seat=plane.seat(),v=plane.body.linvel(),ride=nativeRideAnims({low:!!(plane.modelFlags&MODEL_FLAG.low),kart:false,truck:false,drivingSkill:carEntry.drivingSkill,speed:Math.hypot(v.x,v.y,v.z)});
      const idle=carEntry.clips.ped(ride.idle);if(!idle)void carEntry.clips.block('ped').catch(()=>{});
      if(seat&&idle){
        render.nativeCharacter.installVehicleClips(Object.fromEntries([ride.idle,ride.left,ride.right].flatMap(name=>{const clip=carEntry.clips.ped(name);return clip?[[name.toLowerCase(),clip]]:[];})));
        render.vehiclePose={frame:{vehicle:plane.root,local:seat},pose:{clip:ride.idle.toLowerCase(),seconds:idle.duration,blend:1,overlay:nativeSteerOverlay(plane.steerAngle,ride)}};
      }else render.vehiclePose=undefined;
    }else if(fleet?.occupiedBoat&&render.nativeCharacter){
      // CCarEnterExit::AddInCarAnim seats a boat's driver in DRIVE_BOAT: a boat with m_bSitInBoat keeps it (its car ride
      // set is never found, so ProcessDrivingAnims returns), and one without runs the boat set's steering over it.
      const boat=fleet.occupiedBoat,seat=boat.seat(),idle=carEntry.clips.ped('DRIVE_BOAT');
      if(!idle)void carEntry.clips.block('ped').catch(()=>{});
      if(seat&&idle){
        render.nativeCharacter.installVehicleClips(Object.fromEntries([BOAT_RIDE.idle,BOAT_RIDE.left,BOAT_RIDE.right,BOAT_RIDE.back].flatMap(name=>{const clip=carEntry.clips.ped(name);return clip?[[name.toLowerCase(),clip]]:[];})));
        render.vehiclePose={frame:{vehicle:boat.root,local:seat},pose:{clip:'drive_boat',seconds:idle.duration,blend:1,overlays:boat.driving.overlays()}};
      }else render.vehiclePose=undefined;
    }else if(fleet?.occupiedBike&&render.nativeCharacter){
      // Riding pillion-style: the class IFP's ride/pedal idle with a lean overlay at the ped_frontseat dummy.
      const bike=fleet.occupiedBike,pose=bike.riderPose(),seat=pose.seat;
      const idle=carEntry.clips.peek(pose.block,pose.idle),lean=pose.overlay?carEntry.clips.peek(pose.block,pose.overlay.clip):undefined;
      if(seat&&idle){
        render.nativeCharacter.installVehicleClips(Object.fromEntries([[pose.idle,idle],...(lean&&pose.overlay?[[pose.overlay.clip,lean]]:[])]));
        render.vehiclePose={frame:{vehicle:bike.root,local:seat},pose:{clip:pose.idle,seconds:idle.duration>0?pose.time%idle.duration:0,blend:1,overlay:lean&&pose.overlay?{...pose.overlay}:undefined}};
      }else render.vehiclePose=undefined;
    }else render.vehiclePose=undefined;
    if(carEntry.error){hud.message(carEntry.error);carEntry.error=undefined;}
    if(!paused&&!navigation?.open&&!arsenal.open){if(weatherStarted)worldFx.weather({rain:weather.rain,sandstorm:weather.sandstorm,wind:weather.wind,windDir:[weather.windDir.x,weather.windDir.y,weather.windDir.z],noRain:cullNoRain()});const onFoot=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&(!carEntry.active||carEntry.phase==='approach');if(mission&&(mission.scriptFireCount()>0||scriptFiresBurning>0)){scriptFiresBurning=mission.scriptFireCount();mission.scriptFiresWentOut(weapons.fires.syncScriptFires(mission.scriptFires()));}worldFx.syncFires(weapons.fires.active);worldFx.step(dt,fleet?.cars??[],weapons.hazards,fleet?.planes??[],[...(onFoot?[{position:sim.player.position,speed:sim.player.speed,grounded:sim.player.grounded}]:[]),...(onFoot?(pedestrians?.walkers()??[]):[])],fleet?.boats??[]);}
    frameProfile.between+=performance.now()-tBetween;const tRender=performance.now();
    // Held (the start screen, the pause menu, the arsenal) the world does not move: it is drawn a few times, then again
    // only when something may change it (a touch, a key, a setting, a resize, a restored display, a streamed window
    // swapped in) or every two seconds, not ten times a second: a phone left on the title or paused keeps its GPU, and
    // its battery, idle. Not under the full map: with the page drawing nothing, Chrome now and then makes no click of a
    // tap that ends a pinch there (two taps in six lost a waypoint), and the map is gestures throughout.
    let draw=true;
    if((!started||paused||arsenal.open)&&!navigation?.open){if(heldRedraws>0)heldRedraws--;else if(now-heldDrawnAt<HELD_REDRAW_MS)draw=false;if(draw)heldDrawnAt=now;}
    else heldRedraws=HELD_REDRAWS;
    if(draw){
    render.update(dt, alpha, input, elapsed, paused||terrainPause||!!navigation?.open||arsenal.open);
    frameProfile.render+=performance.now()-tRender;frameProfile.frames++;}
    wantedHud.update(law,gameTimeMs);
    arsenal.update(weaponView.error,weaponView.crosshair);
    hud.weapon(weapons.inventory.weapon.name,weaponView.icon,weapons.inventory.selected===0);
    // CTaskSimplePlayerOnFoot::PlayIdleAnimations on CPad's untouched time (game time: it stops while paused). Ducking,
    // aiming, moving, disabled control or a vehicle count as touching.
    {const view=render.nativeCharacter,onFoot=sim.playerBody.isEnabled()&&sim.playerCollider.isEnabled()&&!sim.player.swimming;
     // SetTouched too in widescreen and under DisablePlayerControls (a scripted scene never idles). Aiming is not a
     // touch in the original, but the browser's reaction clips take the whole body, so the aim keeps counting from zero.
     if(input.touches!==playerIdleTouches||!onFoot||sim.player.crouched||sim.player.speed>.1||weapons.aiming||law.arrested||sim.knockdown>0||sim.climbing||sim.player.health<=0||!!mission?.runtime.game.widescreenOn||playerControlsDisabled()){playerIdleTouches=input.touches;playerUntouchedMs=0;}
     else if(!paused)playerUntouchedMs+=dt*1000;
     if(view&&playerIdleClips&&view!==playerIdleRefused){
      // A rig without the native skeleton (a test or local character) cannot bind the clips; it just gets no idles.
      if(!view.hasReaction('stretch')){try{view.installReactions(playerIdleClips);}catch{playerIdleRefused=view;}}
      if(view!==playerIdleRefused){
       const playing=(PLAYER_IDLE_CLIPS as readonly string[]).includes(view.reactionName??'');
       const next=playerIdles.step(playerUntouchedMs,playing,Math.random);
       if(next==='stop')view.clearReaction();else if(next&&!view.reactionName)view.playReaction(next);
      }
     }}
    {const id=weapons.inventory.selected,a=weapons.inventory.ammo.get(id),info=weapons.inventory.info();hud.ammo(a?hudAmmoText({type:id,clipSize:weapons.inventory.magazine(),inClip:a.clip,total:a.clip+a.reserve,fire:info?info.fire:undefined,slot:info?info.slot:undefined}):undefined);}
    pickups.setAmbient(render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier);pickups.render(render.camera.position,Math.floor(elapsed*1000));
    // CWeapon::TakePhotograph: the camflash system plays and dies at the shot origin, then the snapshot check runs.
    if(weapons.photoRequested){weapons.photoRequested=false;snapShotClock=0;{const m=weapons.muzzle?.();if(m)worldFx.objectFx('camflash',[m.x,-m.z,m.y]);}pickups.pictureTaken(render.camera,render.fov);markPhotographed();canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`San-Andreas-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});hud.message('Photo saved');}
    // CTheScripts::Process: the original script runs a frame at a time once the world has handed it over.
    // CClock is one clock: the script reads the world's time of day and weekday, and what the script sets
    // (SET_TIME_OF_DAY, RESTORE_CLOCK) is the world's.
    if(paused||navigation?.open||arsenal.open)padsAfterPause=true;
    // The script stops with the game: the pause menu, and the full map and the arsenal, which hold the simulation too.
    if(mission&&!paused&&!terrainPause&&!navigation?.open&&!arsenal.open){
      // CPad::Update: the script reads the pad the held keys make, through the driving mapping while the player drives
      // with the controls on. JustOutOfFrontEnd holds for the first frame after the menu.
      // FrontEndMenuManager.m_bShowSubtitles, the Display settings' Subtitles.
      mission.runtime.game.showSubtitles=display.subtitles;
      {const pads=mission.runtime.game.pads;pads.invertMouseY=lookInverted();const driving=mission.playerControl!==false&&!!(worldCar?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike);
       padStateFromActions(heldPadActions(code=>input.down(code)),driving?'driving':render.firstPerson?'firstPerson':'thirdPerson',false,pads.pads[0]);
       // The touch stick is the pad's analog left stick (the script's menus and its stick checks read it), where no key
       // already pushes it: up is −128, as CPad's is.
       {const stick=input.stick,pad=pads.pads[0];if(stick&&Math.hypot(stick.x,stick.y)>.12){
        if(!pad.leftStickX)pad.leftStickX=Math.max(-128,Math.min(127,Math.round(stick.x*128)));
        if(!pad.leftStickY)pad.leftStickY=Math.max(-128,Math.min(127,Math.round(-stick.y*128)));}}
       // The touch controls' script-menu buttons press the pad's d-pad, cross (accept) and triangle (back).
       if(input.down('MenuUp'))pads.pads[0].dpadUp=255;if(input.down('MenuDown'))pads.pads[0].dpadDown=255;
       if(input.down('MenuLeft'))pads.pads[0].dpadLeft=255;if(input.down('MenuRight'))pads.pads[0].dpadRight=255;
       if(input.down('MenuSelect'))pads.pads[0].cross=255;if(input.down('MenuBack'))pads.pads[0].triangle=255;
       pads.justOutOfFrontEnd=padsAfterPause;padsAfterPause=false;}
      // CPed's footsteps for the player: the CEventSoundQuiet his last frame's move made, which the script reads before
      // CWorld::Process flushes the global group (GUNS1's noise bar). Walking and standing make none.
      {const level=sim.player.grounded?playerFootstepSoundLevel(sim.footMove==='sprint'?'sprint':sim.footMove==='run'?'run':sim.player.moveBlend>0?'walk':'still',sim.player.moveBlend):0,p=sim.player.position;
       mission.soundEvents=level>0?[{source:'player',level,position:{x:p.x,y:-p.z,z:p.y+1}}]:[];}
      // The script's FORCE_WEATHER, FORCE_WEATHER_NOW and RELEASE_WEATHER reach the one CWeather, as the cheats' do.
      mission.runtime.game.weatherHost??={forceWeather:w=>weather.forceWeather(w),forceWeatherNow:w=>weather.forceWeatherNow(w),releaseWeather:()=>weather.releaseWeather()};
      const clock=mission.runtime.game.clock;if(clock.follow(sim.timeMinutes,sim.weekDay))mission.runtime.game.stats.increment(STAT_DAYS_PASSED_IN_GAME,1);
      const set=[clock.hours,clock.minutes,clock.seconds,clock.currentDay];
      // CCutsceneMgr::IsCutsceneSkipButtonBeingPressed: the left mouse button held, or Return or Space just pressed.
      {const enter=input.down('Enter')||input.down('NumpadEnter'),space=input.down('Space');
       cutsceneSkipNow=input.down('MouseFire')||enter&&!skipKeysLast.enter||space&&!skipKeysLast.space;skipKeysLast={enter,space};}
      // CTheScripts::Process reads CTimer's game clock: WAITs, TIMERA/B and the onscreen timers stop while the world is
      // held (a streaming hold included) and run slower under the stunt jump's or a cheat's time scale.
      if(scriptClockMission!==mission){scriptClockMission=mission;scriptGameTimeExact=gameTimeExact;}
      const scriptStepMs=gameTimeExact-scriptGameTimeExact;scriptGameTimeExact=gameTimeExact;
      mission.step(gameTimeExact,scriptStepMs);
      // The script runtime stops at a command the port cannot run: say so once, with the command, rather than leave the
      // story silently frozen (the world and free roam go on).
      if(mission.stopped&&scriptStopReported!==mission.stopped){scriptStopReported=mission.stopped;console.error('The mission script stopped',mission.stopped);
        hud.message(`The story script stopped (${mission.stopped.command}${mission.stopped.offset>=0?` at ${mission.stopped.offset}`:''}); free roam continues. Reloading the page starts it again.`,10000);}
      // Loading a game the player saved does not play the new game's opening again: once INITIAL has set the world up
      // and MAIN launches INTRO, the story mission is ended (as leaving it for free roam does), the screen fades in
      // and the save point's clock and place are put back.
      // The opening black is INTRO's from its first frame; a script that stops first, or never gets to INTRO, fades in.
      if(openingHoldAt!==undefined&&(mission.runtime.active.some(slot=>slot.thread.base>0&&slot.thread.name==='INTRO')||mission.stopped||performance.now()-openingHoldAt>45000)){
        if(!mission.runtime.active.some(slot=>slot.thread.base>0&&slot.thread.name==='INTRO')){cameraFade.fade(1000,1,gameTimeMs);hud.fade(false,1000);}
        openingHoldAt=undefined;
      }
      if(!introSkipped&&progression.savedLocation&&mission.runtime.active.some(slot=>slot.thread.base>0&&slot.thread.name==='INTRO')){
        introSkipped=true;const runtime=mission.runtime;
        for(const slot of [...runtime.active])if(slot.thread.base>0)runtime.terminateAllWithName(slot.thread.name);
        runtime.game.alreadyRunningAMissionScript=false;runtime.game.displayAreaName=true;
        // The mission's own end clears the global DECLARE_MISSION_FLAG names; ended from here, it is cleared by hand, as
        // a saved game holds it clear: left set, every trigger that asks whether CJ is on a mission (the story's
        // markers, the gyms, the shops, the camera's group photo) heard yes for the rest of the session.
        if(runtime.game.onAMissionFlag)new DataView(runtime.scriptSpace.buffer,runtime.scriptSpace.byteOffset,runtime.scriptSpace.byteLength).setUint32(runtime.game.onAMissionFlag,0,true);
        // A 0 ms fade-in never finishes in CCamera::ProcessFade, so the shortest that does.
        runtime.world?.fade(1,1,performance.now());
        restoreSavedLocation(progression.savedLocation,!savedTransfer&&!progression.savedLocation.area);
      }
      if(clock.hours!==set[0]||clock.minutes!==set[1]||clock.seconds!==set[2]||clock.currentDay!==set[3]){sim.timeMinutes=clock.hours*60+clock.minutes+clock.seconds/60;sim.weekDay=clock.currentDay;}
    }
    sound.update(render.camera.position, render.viewYaw, render.viewPitch);
    if(!paused&&!navigation?.open&&!arsenal.open)sound.nativeFrame(dt,()=>{
      const engine=sound.nativeEngine,alive=sim.player.health>0,cars=[...(fleet?.cars??[])],planes=[...(fleet?.planes??[])],bikes=[...(fleet?.bikes??[])],boats=[...(fleet?.boats??[])],trains=[...(fleet?.trains??[])];
      if(engine)engine.surfaceAudio=surfaceAudio?.byId;
      for(const unit of police?.units??[])if(!unit.car.occupied)unit.car.siren=unit.siren;
      const driven=cars.find(car=>car.occupied);
      for(const car of cars){
        car.onDoorEvent??=(event,door)=>engine?.vehicle(car,car.modelId)?.addAudioEvent((event==='open'?AE.carBonnetOpen:AE.carBonnetClose)+door);
        // CAutomobile::BurstTyre's AE_TYRE_BURST.
        car.onTyreBurst??=()=>engine?.vehicle(car,car.modelId)?.addAudioEvent(AE.tyreBurst);
        car.onHydraulicSound??=event=>engine?.vehicle(car,car.modelId)?.addAudioEvent(event);
        car.takeAudioChangingGear??=()=>engine?.takeChangingGear(car)??false;
        // CPhysical::ApplyCollision reports: other cars as SURFACE_CAR, pedestrians as SURFACE_PED, world colliders by their COL surface.
        // CGlass::CarWindscreenShatters: the windscreen's panes fly off the car's glass quad.
        car.onWindscreenShatter??=(frame,moveSpeed)=>{
          const hit=sim.world.castRay(new RAPIER.Ray({x:frame.point[0],y:frame.point[2],z:-frame.point[1]},{x:0,y:-1,z:0}),20,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
          glass.generatePanesForWindow(PANE_TYPE.car,frame.point,frame.fwd,frame.right,moveSpeed,frame.center,0.1,false,false,2,true,gameTimeMs,hit?frame.point[2]-hit.timeOfImpact:frame.point[2]-2);
        };
        car.onCollision??=report=>{
          // CPhysical::ApplyCollision on a glass window: past the uproot limit it shatters, otherwise a blow over 50 cracks it.
          const window=glassWindowAt(report.other.handle);
          if(window){
            const intensity=report.impulse*car.assets.handling.values.mass,uproot=scenePropFor(report.other)?.uprootLimit??9999;
            if(uproot>=9999||intensity<=uproot){if(windowRespondsToSoftCollision(window.state,intensity))sound.nativeEngine?.collisions?.reportGlassCollisionEvent('hit',{x:report.point.x,y:-report.point.z,z:report.point.y});}
            else{const v=car.car.body.linvel();breakWindow(report.other.handle,intensity,[v.x/50,-v.z/50,v.y/50],[report.point.x,-report.point.z,report.point.y],false);}
          }
          const collisions=sound.nativeEngine?.collisions;if(!collisions)return;
          const otherCar=[...(fleet?.cars??[])].find(c=>c!==car&&report.other.parent()?.handle===c.car.body.handle);
          const ped=!otherCar&&pedestrians?.targets().some(t=>t.handle===report.other.handle);
          const other=otherCar?carCollider(otherCar):ped?{key:report.other.handle,surface:SURFACE.ped}:worldColliderSurface(report.other,importedScene?.sources,report.point,report.normal,material=>roadSurfaces?.records.get(material)?.frictionEffect==='SPARKS');
          if(other)collisions.reportCollision(carCollider(car),other,{x:report.point.x,y:-report.point.z,z:report.point.y},{x:report.normal.x,y:-report.normal.z,z:report.normal.y},report.impulse,1);
          // CPhysical::ApplyCollision's physical-against-physical branches report both ways, so the second report finds the
          // pair's one-shot and turns it into the scrape tail (GetCollisionSoundStatus matches the pair in either order).
          if(otherCar&&other)collisions.reportCollision(other,carCollider(car),{x:report.point.x,y:-report.point.z,z:report.point.y},{x:-report.normal.x,y:report.normal.z,z:-report.normal.y},report.impulse,1);
        };
      }
      for(const plane of planes)if(plane.splashReport){const p=plane.body.translation(),[x,y,z]=plane.splashReport;engine?.vehicleWaterSplash(plane,{x:p.x,y:-p.z,z:p.y},{x,y,z});plane.splashReport=undefined;}
      for(const car of cars)if(car.splashReport){const p=car.car.body.translation(),[x,y,z]=car.splashReport;engine?.vehicleWaterSplash(car,{x:p.x,y:-p.z,z:p.y},{x,y,z});car.splashReport=undefined;}
      for(const boat of fleet?.boats??[])if(boat.splashReport){const p=boat.body.translation(),[x,y,z]=boat.splashReport;engine?.vehicleWaterSplash(boat,{x:p.x,y:-p.z,z:p.y},{x,y,z});boat.splashReport=undefined;}
      for(const boat of fleet?.boats??[])if(boat.waveVolume>0){const p=boat.body.translation();engine?.collisions.reportBoatWaveHit(boat,{x:p.x,y:-p.z,z:p.y},boat.waveVolume);}
      // CAEFireAudioEntity per burning car and flame hazard.
      const fires:{key:object;at:{x:number;y:number;z:number}}[]=[];
      for(const car of cars)if(car.onFire){const p=car.car.body.translation();fires.push({key:car,at:{x:p.x,y:-p.z,z:p.y}});}
      for(const fire of weapons.fires.active)fires.push({key:fire,at:{...fire.position}});
      const hornVehicle=driven??fleet?.occupiedBike;if(hornVehicle)hornInput.process(hornVehicle,input.down('CapsLock')||input.down('KeyH'),NATIVE_SIREN_MODELS.has(hornVehicle.modelId));
      const audioCamera=nativeAudioCamera(render.camera,sim.player.position,render.scoped);
      const cityVehicle=driven??fleet?.occupiedPlane;
      const cityLin='car' in (cityVehicle??{})?(cityVehicle as ScriptCar).car.body.linvel():(cityVehicle as import('./simulation/WorldPlane').WorldPlane|undefined)?.body.linvel();
      return {camera:audioCamera,
        vehicles:[...cars.map(car=>[car,car.modelId,worldCarAudioInput(car,alive,surfaceAudio?.byId)] as const),...bikes.map(bike=>[bike,bike.modelId,worldBikeAudioInput(bike,alive)] as const),...boats.map(boat=>[boat,boat.modelId,worldBoatAudioInput(boat,alive)] as const),...trains.map(train=>[train,train.modelId,worldTrainAudioInput(train,alive)] as const),...planes.map(plane=>[plane,plane.modelId,worldPlaneAudioInput(plane,alive,{accelerate:Number(input.down('KeyW')),brake:Number(input.down('KeyS'))})] as const)],
        weather:weatherStarted?{rain:weather.rain,windClipped:weather.windClipped,lightningDuration:weather.lightningDuration,noRain:cullNoRain(),outside:render.lighting.area===0,cameraZ:render.camera.position.y,
          city:{camPos:audioCamera.position,camRight:audioCamera.right,camForward:audioCamera.forward,playerPos:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},inVehicle:!!cityVehicle,moveSpeed:cityLin?{x:cityLin.x/50,y:-cityLin.z/50,z:cityLin.y/50}:{x:0,y:0,z:0},
            los:(origin,target)=>{const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,dist=Math.hypot(dx,dy,dz);if(!(dist>0))return undefined;
              // CWorld::ProcessLineOfSight for city-noise whooshes: fixed world geometry blocks the lateral probe.
              const hit=sim.world.castRay(new RAPIER.Ray(origin,{x:dx/dist,y:dy/dist,z:dz/dist}),dist,true,RAPIER.QueryFilterFlags.ONLY_FIXED|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
              if(!hit)return undefined;const t=hit.timeOfImpact;return {point:{x:origin.x+dx*t/dist,y:origin.y+dy*t/dist,z:origin.z+dz*t/dist},physical:{x:0,y:0,z:0},entity:hit.collider.handle};}}}:undefined,
        ambient:weatherStarted?{region:nativeWeatherRegion(render.camera.position.x,-render.camera.position.z),camera:{x:render.camera.position.x,y:-render.camera.position.z,z:render.camera.position.y},player:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},foggynessSF:weather.foggynessSF}:undefined,
        fires:fires.map(f=>[f.key,f.at] as const),
        widescreen:!!mission?.runtime.game.widescreenOn,
        // The radio's: CClock's date and hour, a mission line playing (it ducks the radio) and the riots where CJ is.
        clock:{days:mission?.runtime.game.clock.days??1,month:mission?.runtime.game.clock.month??1,hours:Math.floor(sim.timeMinutes/60)%24},
        dialogue:sound.speechPlaying,
        laRiots:laRiotsActiveHere({x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},CHEATS.isActive('riot'),laRiots),
        player:{weapon:weapons.inventory.selected,swimming:sim.player.swimming,onFoot:!driven&&!fleet?.occupiedPlane&&!carEntry.active,inVehicle:!!radioDriven,attacking:input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'),radio:radioModel!==undefined}};
    });
    hud.audioStatus(sound.status());
    hud.update(sim, render.viewYaw, {maxHealth:mission?.runtime.game.playerInfo.maxHealth??100,maxArmour:mission?.runtime.game.playerInfo.maxArmour??100});
    // CGarages::PrintMessages, drawn by CHud::Draw each frame while its time runs.
    {const m=mission?.runtime.game.garageMessage.current(gameTimeMs);hud.garageMessage(m&&garageMessageText(m.id,m.number,m.number2));}
    // CHud::DrawVehicleName: TheText.Get of the model's game name (vehicles.ide's GXT key); the model name until the
    // text has loaded.
    const occupiedVehicle=[...(fleet?.cars??[])].find(car=>car.occupied)??fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
    const vehicleName=occupiedVehicle&&(theText?theText.get(occupiedVehicle.assets.vehicle.gameName):occupiedVehicle.name);
    // CAEVehicleAudioEntity::TurnOnRadioForVehicle and StartRadio as the player takes a vehicle, StopRadio as he
    // leaves; the station's name shows (m_bDisplayStationName) unless it is the emergency channel.
    // A driver who dies or is arrested at the wheel turns it off at once (Service's PlayerAboutToExitVehicleAsDriver).
    // The vehicle itself is followed, so stepping from one car into another of its model restarts the radio, and
    // nothing is decided until the native engine has loaded.
    {const seated=[...(fleet?.cars??[])].find(car=>car.occupied)??(worldCar?.occupied?worldCar:undefined)??fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
     const driven=sim.player.health>0&&!law.arrested?seated:undefined;
     const model=driven?.modelId,engine=sound.nativeEngine,hour=Math.floor(sim.timeMinutes/60)%24;
     if(engine&&driven!==radioDriven){
      if(radioModel!==undefined)engine.stopRadio(elapsed*1000,hour,sim.weekDay);
      radioDriven=driven;
      radioModel=model!==undefined&&engine.startRadio(model,elapsed*1000,hour,sim.weekDay)?model:undefined;
      if(radioModel!==undefined){const label=engine?.radioLabel;if(label)hud.radioName(label);}
     }}
    const radioVehicle=!!vehicleName;
    hud.names.setVehicleName(vehicleName);
    if(!paused&&walkDemo){const zoneName=placeName.process(worldZones,[sim.player.position.x,-sim.player.position.z,sim.player.position.y],render.lighting.area!==0);if(zoneName)hud.names.setZoneName(zoneName);}
    // CHud::DrawAfterFade skips DrawAreaName in a plane and while the script has DISPLAY_ZONE_NAMES off.
    hud.zoneNameColour=gangWars?.zoneNameColour();
    hud.drawNames(dt*1000,paused,radioVehicle,!!fleet?.occupiedPlane||mission?.runtime.game.displayAreaName===false,!!mission?.runtime.game.widescreenOn,mission?.runtime.game.displayVehicleName===false);
    hud.widescreen(!!mission?.runtime.game.widescreenOn);
    // The widescreen borders hide the HUD and the map with it: a map left open would hold the game unseen.
    if(mission?.runtime.game.widescreenOn&&navigation?.open)navigation.toggle(false);
    hud.displayHud(mission?.runtime.game.displayHud??true);
    {const camera=mission?.runtime.game.camera;render.scriptNearClip=camera?.useNearClipScript?camera.nearClipScript:undefined;}
    // CMessages::Process once a game frame, and CMessages::Display handing the front of each queue to the HUD: the
    // brief to the subtitle line, STYLE_MIDDLE and STYLE_WHITE_MIDDLE to their big messages, and CHud's help message.
    // The other styles go through CHud's own clocks (nativeHudBigMessages).
    {const game=mission?.runtime.game;
     if(game&&!paused){
      game.messages.process(gameTimeMs);
      const text=scriptMessageText;
      const brief=game.messages.briefs[0],briefKey=brief?`${brief.key}|${brief.createdAt}`:'';
      if(briefKey!==shownScript.brief){if(brief)hud.message(text(brief),brief.visibleTime);else if(shownScript.brief)hud.message('',0);shownScript.brief=briefKey;}
      for(const [style,show] of [[0,(t:string,ms:number)=>hud.bigMessage(t,'',ms)],[2,(t:string,ms:number)=>hud.whiteMiddleMessage(t,ms)]] as const){
       const big=game.messages.big[style][0],key=big?`${big.key}|${big.createdAt}`:'';
       if(key!==shownScript.big[style]){if(big)show(text(big),big.visibleTime);shownScript.big[style]=key;}
      }
      // CMessages::Display's SetBigMessage for every other style, then CHud::Draw and DrawAfterFade's drawing of them.
      game.messages.onClearBigMessage??=style=>hudBigMessages.clear(style);
      for(let style=1;style<game.messages.big.length;style++){if(style===2)continue;const big=game.messages.big[style][0];hudBigMessages.set(style,big?text(big):'');}
      // CHud::Draw: with no STYLE_MIDDLE message up, CMenuSystem::Process draws the script's menus (the ones not current
      // dimmed) and moves the current one's highlight from the pad.
      // CAudioEngine::ReportMissionAudioEvent: at a point, or following the ped, car or object it names.
      // One physical per entity, so a handler can stop the sounds it started at the same one.
      const missionPhysical=(owner:import('./simulation/ScmMission').ScmMission,kind:string,handle:number)=>{
        const key=`${kind}:${handle}`;let physical=missionAudioEntities.get(key);
        if(!physical){
          if(missionAudioEntities.size>64)for(const [k,p] of missionAudioEntities)if(!p.position())missionAudioEntities.delete(k);
          physical={position:()=>owner.audioEntityPosition(kind,handle)};missionAudioEntities.set(key,physical);
        }
        return physical;
      };
      game.missionAudio.onReport??=(event,at)=>{
        if(sound.nativeEngine)sound.nativeEngine.scriptAudio.ambience??=ambience;
        if(!('kind' in at)){sound.missionAudioEvent(event,{position:{x:at.x,y:at.y,z:at.z}});return;}
        const owner=mission;if(!owner?.audioEntityPosition(at.kind,at.handle))return;
        const physical=missionPhysical(owner,at.kind,at.handle),ped=owner.audioPed(at.kind,at.handle);
        sound.missionAudioEvent(event,ped?{physical,ped}:{physical});
      };
      // SET_MISSION_AUDIO_POSITION and the attach commands: the slot's link follows the same physical a report would.
      game.missionAudio.onPlace??=(slot,at)=>{
        if(!('kind' in at)){sound.missionAudioAt(slot,{position:{...at}});return;}
        const owner=mission;if(owner)sound.missionAudioAt(slot,{physical:missionPhysical(owner,at.kind,at.handle)});
      };
      {const menus=game.menus,draws:import('./ui/nativeHudMenus').MenuDraw[]=[];
       if(menus.numInUse&&!game.messages.big[0][0]){
        // AE_FRONTEND_SELECT, _BACK and _HIGHLIGHT.
        menus.onSound??=which=>{sound.frontend(which==='select'?1:which==='back'?2:3);};
        menus.process(game.pads.pads[0]);
        const menuText=(key:string,first:number,second:number)=>gxtHudText(insertNumbers(gxtText(key,key),first,second));
        for(let id=0;id<menus.menus.length;id++){const menu=menus.menus[id];if(menus.inUse[id]&&menu&&id!==menus.currentMenuInUse)draws.push(layoutMenu(menu,false,menuText));}
        const current=menus.menus[menus.currentMenuInUse];if(menus.inUse[menus.currentMenuInUse]&&current)draws.push(layoutMenu(current,true,menuText));
       }
       hud.menus(draws);}
      hud.bigMessages(hudBigMessages.draw(Math.max(0,gameTimeMs-hudBigMessagesClock),hud.element.clientWidth||innerWidth,game.drawOddJobTitleBeforeFade,()=>{
       hud.names.hideZoneName();game.help.set(undefined,true,false,false,game.messages);}));
      hud.missionTitleShowing=hudBigMessages.missionTitleShowing;hudBigMessagesClock=gameTimeMs;
      // Each set is drawn afresh, the same text included; a stat update's "+" or "-" is drawn by displayStatUpdate itself.
      const help=game.help.message,revision=game.help.revision;hud.helpBoxWidth(game.help.boxWidth);
      // On a touch screen a script menu's help names the menu's own buttons: a menu coming or going reads the help
      // shown again with the names it now has.
      {const menuUp=!!touch&&game.menus.numInUse>0;if(menuUp!==namingMenu){namingMenu=menuUp;setControlNaming({menu:menuUp});if(hud.helpShowing())shownScript.helpRevision=-1;}}
      if(revision!==shownScript.helpRevision&&game.help.statId){shownScript.help=help;shownScript.helpRevision=revision;}
      else if(revision!==shownScript.helpRevision){const [key,number]=help.split('#');hud.help(help?gxtHudText(number!==undefined?insertNumbers(gxtText(key,key),Number(number)):gxtText(key,key)):'',game.help.permanent?1e9:game.help.quick?3000:5000);shownScript.help=help;shownScript.helpRevision=revision;}
     }}
    {const colour=mission?.runtime.game.fadeColour;if(colour)hud.fadeColour(colour.red,colour.green,colour.blue);}
    {const game=mission?.runtime.game,shown=game&&!paused&&!game.messages.big[0][0];
     scriptText.draw(shown?{lines:game.introText.lines,count:game.introText.count,rectangles:game.introRectangles.rectangles,rectangleCount:game.introRectangles.count}:undefined,
      (key,first,second)=>gxtHudText(insertNumbers(gxtText(key,key),first,second)),hud.element.clientWidth||innerWidth,hud.element.clientHeight||innerHeight,Math.min(2,devicePixelRatio||1));}
    {const shown=mission&&!paused?mission.onscreenDisplay():undefined,label=(key:string)=>key?gxtHudText(gxtText(key,key)):'';
     hud.missionTimers(shown&&{clock:shown.clock&&{text:shown.clock.text,label:label(shown.clock.key)},counters:shown.counters.map(c=>({text:c.text,label:label(c.key),type:c.type,value:c.value,colour:HUD_COLOURS[c.colour]??HUD_COLOURS[3]}))});}
    // CTheZones::Update, while the game runs: the map squares the player has explored, which fog the frontend map.
    {const game=mission?.runtime.game;
     if(!paused&&!navigation?.open&&!arsenal.open)progression.zones.update(gameTimeMs,sim.player.position.x,-sim.player.position.z,render.lighting.area===0,!!game?.playerIsOffTheMap);
     if(navigation){navigation.zones=progression.zones;navigation.placeAt??=(x,y)=>worldZones?zoneText(worldZoneAt(worldZones,[x,y,sim.player.position.y]).textLabel):undefined;navigation.hideMapBlips=!!(game?.hideAllFrontEndMapBlips||game?.playerIsOffTheMap);}}
    navigation?.setZoneOverlays((gangWars?.zoneOverlays(elapsed*1000)??[]).map(o=>({x1:o.zone.min[0],z1:-o.zone.max[1],x2:o.zone.max[0],z2:-o.zone.min[1],colour:`rgba(${o.colour[0]},${o.colour[1]},${o.colour[2]},${(o.colour[3]/255).toFixed(3)})`})));
    // The script's own blips join the browser's: CRadar's table, drawn where the things it names are.
    navigation?.setLiveBlips([...(mission?.radarBlips()??[]),...(gangWarBlip&&gangWarBlip.visible?[{x:gangWarBlip.position.x,z:-gangWarBlip.position.y,sprite:attackBlipSprite(gangWarBlip.gang)}]:[]),...(pedestrians?.attackWavePositions()??[]).map(p=>{const c=GANG_COLOURS[p.gang??0]??[255,255,255];return {x:p.x,z:p.z,colour:`rgb(${c[0]},${c[1]},${c[2]})`,size:2};})]);
    navigation?.update(sim.player.position,sim.player.heading,
      // CRadar: the camera looks along viewYaw + pi; the range follows the vehicle's speed, or a plane's altitude (not a
      // helicopter's or the Vortex's, which go by speed).
      (()=>{const plane=fleet?.occupiedPlane,body=plane?plane.body:[...(fleet?.cars??[])].find(c=>c.occupied)?.car.body??fleet?.occupiedBike?.body??fleet?.occupiedBoat?.body;const v=body?.linvel();
        // CHud::DrawRadar: the ring for planes other than the Vortex, the altimeter for every plane and heli and a parachute.
        const vortex=plane?.modelId===539,q=plane?.body.rotation();
        const ring=plane&&q&&!plane.helicopter&&!vortex?Math.PI-Math.atan2(-2*(q.x*q.y+q.w*q.z),1-2*(q.x*q.x+q.z*q.z)):undefined;
        // The altimeter's test is IsSubPlane() || IsSubHeli() && not the Vortex, and the Vortex is a plane: it gets one.
        const altitude=plane?plane.body.translation().y:weapons.inventory.selected===46?sim.player.position.y:undefined;
        // CRadar::DrawMap takes the script's RadarZoomValue off the on-foot range.
        const zoom=mission?.runtime.game.radarZoom??0,range=radarRange({inVehicle:!!body,plane:!!plane&&!plane.helicopter&&!vortex,speed:v?Math.hypot(v.x,v.y,v.z)/50:0,altitude:body?.translation().y});
        // CRadar::DrawRadarMap's plane horizon: atan2(-forward.z, up.z) of the plane (not a helicopter or the Vortex).
        let horizon:number|undefined;
        if(plane&&q&&!plane.helicopter&&!vortex){const r=new Quaternion(q.x,q.y,q.z,q.w),fy=new Vector3(0,0,-1).applyQuaternion(r).y,uy=new Vector3(0,1,0).applyQuaternion(r).y;horizon=Math.atan2(-fy,uy);}
        return {viewHeading:render.viewYaw+Math.PI,range:!body&&zoom?range-zoom:range,ring,altitude,zoomed:zoom!==0,horizon};})());
    if(navigation){navigation.indoors=render.lighting.area!==0;navigation.showRadar(mission?.runtime.game.displayRadar!==false);}
    if(perfOverlay){
      perfFrameMs = perfFrameMs === 0 ? dt*1000 : perfFrameMs*0.9 + dt*1000*0.1;
      if(now - perfLastUpdate > 500){
        perfLastUpdate = now;
        const info=render.renderer.info;
        perfOverlay.textContent=`frame ${perfFrameMs.toFixed(1)}ms · tick ${clock.tick} · draws ${info.render.calls} · tris ${(info.render.triangles/1000).toFixed(0)}k · geoms ${info.memory.geometries} · tex ${info.memory.textures}`;
      }
    }
  }
  const sessionCharacterToken = crypto.randomUUID();
  const sessionCharacterChannel = new BroadcastChannel(`character-session-${sessionCharacterToken}`);
  const workshop = hud.element.querySelector<HTMLAnchorElement>('#character-workshop')!;
  workshop.href = `${import.meta.env.BASE_URL}models.html?characterTarget=${encodeURIComponent(sessionCharacterToken)}`;
  workshop.hidden = false;
  sessionCharacterChannel.onmessage = ({data}) => {
    if (!alive || data?.type !== 'character' || typeof data.requestId !== 'string') return;
    try {
      render.installCharacter(data.source);
      pause();
      hud.menuMessage('Local character installed in this session. Resume to test it.');
      sessionCharacterChannel.postMessage({type:'installed',requestId:data.requestId});
    } catch(error) {
      sessionCharacterChannel.postMessage({type:'failed',requestId:data.requestId,error:error instanceof Error ? error.message : 'Character installation failed.'});
    }
  };
  let characterChannel: BroadcastChannel | undefined;
  const characterToken = new URLSearchParams(location.search).get('characterTest');
  if (characterToken) {
    hud.button('play').disabled = true; hud.menuMessage('Waiting for the local character…');
    characterChannel = new BroadcastChannel(`character-test-${characterToken}`);
    characterChannel.onmessage = ({ data }) => {
      if (data.type !== 'character') return;
      try {
        render.installCharacter(data.source); hud.button('play').disabled = false;
        hud.menuMessage('Local locomotion clip ready. Assigned idle, walk and run clips follow movement and Shift; unassigned actions have no native animation.');
        characterChannel?.postMessage({ type: 'installed' }); characterChannel?.close();
      } catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Character installation failed.'); }
    };
    characterChannel.postMessage({ type: 'ready' });
  }
  let sceneChannel: BroadcastChannel | undefined;
  let staticWorld:StaticWorldProvider|undefined;
  let installingScene = false;
  let flightTransfer:{modelId:number;resolve:()=>void;reject:(reason:unknown)=>void}|undefined;
  type TerrainUpdate={ parts: import('./assets/scene').ScenePart[]; timecycleBoxes?: import('./assets/timecycleBoxes').TimecycleBox[]; preferredSpawn?: {x:number;z:number}; preservePosition?:boolean;followId?:number;datasetIdentity?:string;
    /** Install behind a black screen for an entry exit: no menu, and the caller places the player. */
    keepPlayer?:boolean;
    /** Support checks that missed so far, and when the next attempt may run (see replaceWalkTerrain). */
    supportRetries?:number;retryAt?:number;
    /** What the window message carried, for the dev state. */
    transfer?:{payloadBytes:number;resident:number};
    /** Model instances and new colliders built ahead over several frames (InstalledNativeScene.prebuild). */
    prebuilt?:import('./simulation/nativeScene').PrebuiltWindow;prebuiltMs?:number;latencyMs?:number;workerMs?:number;timings?:Record<string,number> };
  /** The next window's pre-build in progress: stepped a few milliseconds per frame, then committed. */
  let pendingPrebuild:{data:TerrainUpdate;job:import('./simulation/nativeScene').PrebuildJob;ms:number}|undefined;
  const PREBUILD_BUDGET_MS=4;
  /** Resident parts came without their payload: put the copies the current window holds back, once per message. */
  function prepareWindow(data:TerrainUpdate){
    if(data.transfer)return;
    let payloadBytes=0;const seenBuffers=new Set<ArrayBufferLike>();
    for(const part of data.parts){for(const g of part.model.geometries)for(const a of [g.positions,g.normals,g.colors,g.nightColors,g.indices,g.materialIds,...g.uvs])if(a&&!seenBuffers.has(a.buffer)){seenBuffers.add(a.buffer);payloadBytes+=a.byteLength;}for(const t of part.textures)for(const m of t.mips)if(!seenBuffers.has(m.data.buffer)){seenBuffers.add(m.data.buffer);payloadBytes+=m.data.byteLength;}}
    data.transfer={payloadBytes,resident:data.parts.filter(p=>p.resident).length};
    const held=new Map(residentModels);for(const [key,model] of importedScene?.retiredModels()??[])if(!held.has(key))held.set(key,model);
    const missingResident=rehydrateResidentParts(data.parts,held);
    if(missingResident.length)throw new Error(`Resident models missing from the current window: ${missingResident.slice(0,3).join(', ')}.`);
  }
  /** A following window arrives: build its instances and new colliders across frames, then commit it. */
  /** When each follow request left, so a window's latency (request to install) can be reported. */
  const requestedAt=new Map<number,number>();
  /** Recent request-to-install latency (ms), which sets how far ahead the next window is centred. */
  let latencyEma=0;
  function scheduleWindow(data:TerrainUpdate){
    pendingPrebuild?.job.dispose();pendingPrebuild=undefined;
    if(data.followId!==undefined&&data.followId>0){const at=requestedAt.get(data.followId);if(at!==undefined){data.workerMs=(data as any).timings?.total;data.latencyMs=+(performance.now()-at).toFixed(0);requestedAt.delete(data.followId);latencyEma=latencyEma?latencyEma*.6+data.latencyMs*.4:data.latencyMs;}}
    const automatic=data.followId!==undefined&&data.followId>0;
    try{prepareWindow(data);}catch(error){if(automatic){failFollowing(data.followId!,error instanceof Error?error.message:String(error));return;}}
    const job=automatic&&importedScene&&!installingScene&&follower?.matches(data.followId!)?importedScene.prebuild(data.parts,data.datasetIdentity):undefined;
    if(job)pendingPrebuild={data,job,ms:0};else void replaceWalkTerrain(data);
  }
  function stepPrebuild(){
    const pending=pendingPrebuild;if(!pending)return;
    if(!follower?.matches(pending.data.followId!)||!importedScene){pending.job.dispose();pendingPrebuild=undefined;return;}
    const started=performance.now();
    const done=pending.job.step(PREBUILD_BUDGET_MS);pending.ms+=performance.now()-started;
    if(!done)return;
    pendingPrebuild=undefined;
    void replaceWalkTerrain({...pending.data,prebuilt:pending.job.result(),prebuiltMs:+pending.ms.toFixed(1)});
  }
  /** A window whose support check missed while the game runs retries this often, this many times, then installs anyway. */
  const SUPPORT_RETRY_MS=150,SUPPORT_RETRY_LIMIT=4;
  class SupportRetry extends Error{}
  /** Windows installed where the support check still missed, for the dev state. */
  let supportOverrides=0,lastSupportMiss:string|undefined;
  let lastSwap:{ms:number;latencyMs:number;workerMs:number;timings:Record<string,number>;parts:number;placements:number;reusedPlacements:number;pooledModels:number;payloadMB:number;resident:number;prebuiltMs:number;stages:Record<string,number>}|undefined;
  /** The models the installed window holds, which the next request lets the worker leave out of its message. */
  let residentModels=new Map<string,ResidentModel>();
  let pendingFollowingData:TerrainUpdate|undefined,followBoundaryPaused=false;
  /** How far round CJ an interior's scene counts as having its collision in. */
  const INTERIOR_COLLISION_REACH=150;
  let follower:SceneRegionFollower|undefined,followTimer:ReturnType<typeof setTimeout>|undefined,followResume=0;
  // CColStore::HasCollisionLoaded: inside the installed window's safety boundary. In an interior nothing follows and
  // the scene is the interior alone, so only its own neighbourhood is in (Sweet's car outside the pizza place is not);
  // with no window following outside, everything counts. A script's waiting car or ped asks it.
  sim.collisionLoaded=(x,z)=>{
    if(follower?.snapshot().enabled)return follower.covers({x,z});
    if(render.lighting.area!==0)return Math.hypot(x-sim.player.position.x,z-sim.player.position.z)<INTERIOR_COLLISION_REACH;
    return true;
  };
  /** The interior window's centre (native x, y), where its door or save put the player; none outside. */
  let interiorCentre:{x:number;y:number}|undefined;
  /** CGame::currArea as last seen, and a script teleport of the player since the scene was last checked. */
  let lastScriptArea=0,scriptSceneDirty=false;
  /** How near one of the area's doors (across, and up or down) a script's point counts as inside that interior. */
  const SCRIPT_INTERIOR_DOOR_REACH=100,SCRIPT_INTERIOR_DOOR_HEIGHT=50;
  // The original's world is one, its interiors standing high over the map, and CStreaming loads what CGame::currArea
  // names round the player wherever a script puts him (its LOAD_SCENE waits for that). The browser's scene is one
  // window, the outside world or one interior's neighbourhood: a script that sets the area visible and teleports CJ out
  // of an interior (INTRO2 taking him out of the pizza place to Sweet's car) or into one swaps the window as a save
  // point's is swapped, the step held until it is in. Left in the interior's window, the street had no collision and
  // Sweet's car waited for it for ever.
  //   An interior is only taken for a point by one of its own doors: the area is often set for a cutscene in a house
  // while CJ waits outside (SWEET1B's opening), and there the street stays under him.
  function scriptSceneTransfer(){
    const game=mission?.runtime.game;if(!game)return;
    if(game.currentArea!==lastScriptArea){lastScriptArea=game.currentArea;scriptSceneDirty=true;}
    if(!scriptSceneDirty||!staticWorld||!importedScene||interiorTransfer||savedTransfer||flightTransfer||installingScene||sim.deathRemaining>0)return;
    scriptSceneDirty=false;
    const want=game.currentArea,p=sim.player.position,here={x:p.x,y:-p.z},height=p.y;
    const elsewhere=importedScene.area!==0&&(!interiorCentre||Math.hypot(here.x-interiorCentre.x,here.y-interiorCentre.y)>INTERIOR_COLLISION_REACH);
    const byDoor=want!==0&&!!entryExits?.pool.some(e=>{if(e.area!==want)return false;const [x,y,z]=entryExitPosition(e);return Math.hypot(x-here.x,y-here.y)<SCRIPT_INTERIOR_DOOR_REACH&&Math.abs(z-height)<SCRIPT_INTERIOR_DOOR_HEIGHT;});
    const area=byDoor&&(importedScene.area!==want||elsewhere)?want:!byDoor&&elsewhere?0:undefined;
    if(area===undefined)return;
    follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;
    savedTransfer={x:here.x,y:here.y,z:height,heading:sim.player.heading,quiet:true,script:true,...(area?{area}:{})};
    staticWorld.request(-1,area?{x:here.x,y:here.y,radius:100,includeCollisionBounds:true,interior:area}:{x:here.x,y:here.y,radius:180,lodRadius:1000,includeCollisionBounds:true});
  }
  function failFollowing(id:number,message:string){
    if(!follower?.finish(id,false))return;
    clearTimeout(followTimer);pendingFollowingData=undefined;
    // CStreaming never gives up on a sector: the follower re-requests the window after a backoff, holding the
    // player at the safety boundary meanwhile. Only a run of failures stops following and shows the menu.
    if(follower.snapshot().enabled){console.warn(`Terrain window ${id} failed; retrying. ${message}`);return;}
    followBoundaryPaused=false;pause();menuBusy(false);
    hud.menuMessage(navigator.onLine===false?'No connection: this part of San Andreas has not been downloaded yet. The current area is still available; Resume once the connection is back.'
      :`${message} Automatic terrain loading stopped; the current area is still available. Resume to try loading again.`);
  }
  function requestFollowingTerrain(){
    if((!sceneChannel&&!staticWorld)||!importedScene)return;
    if(staticWorld)follower?.setRadius(180,1000);
    if(follower)follower.leadSeconds=Math.min(4,Math.max(2,latencyEma/1000+.8));
    const eligible=playerMayTakeTerrain()&&sim.deathRemaining===0&&importedScene.area===0;
    // An aircraft well above the ground needs no collision under it: it flies on while the windows catch up, and
    // the hold only applies when it comes down into terrain that is not there yet.
    const airborne=!!fleet?.occupiedPlane&&fleet.occupiedPlane.altitude>40;
    if(!paused&&eligible&&!airborne&&follower?.needsPause(sim.player.position))terrainHold(true);
    // A terrain pause is self-healing: once the follower has nothing in flight
    // and nothing is waiting to install, the game resumes itself. A follower
    // that was deliberately stopped keeps its own menu instead.
    // The installed window must cover him: between one window going in and the next being asked for nothing is
    // pending, and letting the step run there dropped a player the script had put past the window.
    if(terrainPause&&!installingScene&&!pendingFollowingData&&follower?.snapshot().enabled===true&&(airborne||follower.snapshot().pending===null&&(!eligible||follower.covers(sim.player.position)))){
      terrainHold(false);return;
    }
    // Following that stopped for good releases the hold; failFollowing has opened the menu with the reason.
    if(terrainPause&&follower?.snapshot().enabled===false)terrainHold(false);
    if(pendingFollowingData&&eligible&&!installingScene&&(pendingFollowingData.retryAt===undefined||performance.now()>=pendingFollowingData.retryAt)){const data=pendingFollowingData;pendingFollowingData=undefined;void replaceWalkTerrain(data);return;}
    // A window that failed at the safety boundary is asked for again from the pause, once its backoff passes.
    if(paused||installingScene)return;
    if(!terrainPause)settleGroundAfterStream();
    // Directional lookahead for the next window: vehicles report Rapier
    // velocity, on-foot motion uses heading and blend speed. A passenger seat counts too: riding in the back of
    // INTRO's police car (a recording at 11 m/s) with no lookahead ran the car off the streamed window, and the game
    // held for terrain again and again with the world half drawn.
    const motion=fleet?.occupiedPlane?.body.linvel()??(worldCar?.occupied?worldCar.car.body.linvel():undefined)??fleet?.occupiedBoat?.body.linvel()??fleet?.occupiedBike?.body.linvel()??(playerPassenger&&!playerPassenger.car.disposed?playerPassenger.car.car.body.linvel():undefined);
    const followVelocity=motion?{x:motion.x,z:motion.z}:{x:Math.sin(sim.player.heading)*sim.player.speed,z:Math.cos(sim.player.heading)*sim.player.speed};
    const request=follower?.request(sim.player.position,eligible,followVelocity);
    if(!request)return;
    followResume=loadRequest;followBoundaryPaused=false;
    followTimer=setTimeout(()=>failFollowing(request.id,'The terrain request timed out.'),staticWorld?45000:30000);requestedAt.set(request.id,performance.now());
    // Resident: the installed window's models plus the pool's retired sources, whose models the main thread still holds.
    if(staticWorld)staticWorld.request(request.id,request.region,[...new Set([...residentModels.keys(),...(importedScene?.retiredModels().keys()??[])])]);else sceneChannel!.postMessage({type:'region-request',...request});
    // A window asked for a player already outside the installed one (a script teleport) holds at once, before the
    // step can run him over ground that is not there.
    if(eligible&&!airborne&&follower?.needsPause(sim.player.position))terrainHold(true);
  }
  /** A window may be asked for and installed under a player who stands, flies, or falls: a parachutist or a jumper
   * over ground that is not streamed in yet would otherwise fall out of the world while the window waited for him
   * to land on nothing (the boundary hold freezes him mid-air). Only a brief hop keeps the swap off. */
  let airborneSince=0;
  /** Set by a script teleport until the player stands again: the window for the new place is asked for at once and
   * the hold freezes him where the script put him, as CStreaming loads the collision under a teleported player before
   * he falls (m_bIsStaticWaitingForCollision). Waiting out the jump allowance let him drop through the unloaded ground
   * first and land below it once the window came in. */
  let scriptTeleported=false;
  /** A script teleport's PutToGroundIfTooLow that found no collision yet (renderer x, z): once the streamed window
   * under the point is in, the player (or his vehicle) is set on the highest ground there, as he would have been had
   * the collision been loaded when the script asked. He keeps it only while he has not moved off the point. */
  let groundAfterStream:{x:number;z:number}|undefined;
  const settleGroundAfterStream=()=>{
   const at=groundAfterStream;if(!at)return;
   const car=worldCar?.occupied?worldCar:fleet?.occupied,other=car?undefined:fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
   const p=car?car.car.body.translation():other?other.body.translation():sim.player.position;
   if(Math.hypot(p.x-at.x,p.z-at.z)>1.5){groundAfterStream=undefined;return;}
   const hit=sim.world.castRay(new RAPIER.Ray({x:at.x,y:1000,z:at.z},{x:0,y:-1,z:0}),2000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(!hit)return;
   groundAfterStream=undefined;const y=1000-hit.timeOfImpact;
   if(car||other){const body=car?car.car.body:other!.body,lift=car?-car.nativeBody.boundsMin.z:-other!.assets.collision.bounds.min[2];body.setTranslation({x:p.x,y:y+lift,z:p.z},true);body.setLinvel({x:0,y:0,z:0},true);return;}
   sim.player.position={x:p.x,y,z:p.z};sim.player.previous={...sim.player.position};sim.player.verticalSpeed=0;
   sim.playerBody.setTranslation({x:p.x,y:y+.9,z:p.z},true);sim.playerBody.setNextKinematicTranslation({x:p.x,y:y+.9,z:p.z});sim.playerCollider.setTranslation({x:p.x,y:y+.9,z:p.z});
  };
  const playerMayTakeTerrain=()=>{
    const now=performance.now();
    if(sim.player.grounded||!!fleet?.occupiedPlane){airborneSince=0;scriptTeleported=false;return true;}
    if(scriptTeleported)return true;
    if(!airborneSince)airborneSince=now;
    // A jump is over in well under a second; anything longer is a fall, a parachute descent or a launch.
    return now-airborneSince>700||sim.player.verticalSpeed<-4;
  };
  const replaceWalkTerrain = async (data: TerrainUpdate) => {
    const automatic=data.followId!==undefined;
    if(automatic&&!follower?.matches(data.followId!))return;
    if(automatic&&(!playerMayTakeTerrain()||sim.deathRemaining>0)){pendingFollowingData=data;return;}
    if(!automatic&&follower?.snapshot().pending){sceneChannel?.postMessage({type:'region-error',message:'Wait for the following terrain request.'});return;}
    let autoResume=false,completed=false,resumeVersion=loadRequest,keepPrebuilt=false;
    if(!automatic){follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;}
    if (!importedScene || installingScene) { sceneChannel?.postMessage({type:'region-error',message:'Wait for the current scene request to finish.'}); return; }
    const quiet=data.keepPlayer===true;
    // A window the follower streams in as the player moves stays off the menu, as CStreaming's loads do: pausing
    // while one installs neither disables the menu nor turns "Resume game" into the workshop's "Walk imported scene".
    const menuQuiet=quiet||automatic;
    installingScene=true;if(!automatic&&!quiet)pause();if(!menuQuiet){menuBusy(true);hud.menuMessage('Preparing the selected terrain…');}
    try {
      const [{nativeSceneDestination,assertInstalledSceneSupport},{prepareTimecycleBoxes},vegetation]=await Promise.all([import('./simulation/nativeSceneDestination'),import('./world/nativeTimecycleBoxes'),readSceneVegetationOnce('environment' in data?data.environment:undefined)]);
      if(vegetation&&'proceduralAssets' in data)vegetation.proceduralAssets=data.proceduralAssets as import('./world/WalkingVegetation').WalkingVegetationPackage['proceduralAssets'];
      if(!alive||automatic&&!follower?.matches(data.followId!))return;
      if(automatic&&(!playerMayTakeTerrain()||sim.deathRemaining>0)){pendingFollowingData=data;return;}
      resumeVersion=loadRequest;autoResume=automatic&&followBoundaryPaused&&followResume===loadRequest&&!document.hidden;
      const modifiers=data.timecycleBoxes??[];prepareTimecycleBoxes(modifiers);
      const preserve=data.preservePosition===true;
      if(preserve&&(!playerMayTakeTerrain()||sim.deathRemaining>0))throw new Error('Keep position requires a standing, flying or falling player.');
      let spawn:ReturnType<typeof nativeSceneDestination>|undefined;
      // Swap accounting for the dev state: what the window carried and how long the synchronous replacement took.
      const swapStart=performance.now();
      prepareWindow(data);
      // A pre-built window lets the support check run against the colliders the next window will own before
      // anything is assembled; a miss then keeps the pre-built window for the retry instead of rebuilding it.
      if(data.prebuilt&&automatic&&preserve&&!quiet&&!paused&&(data.supportRetries??0)<SUPPORT_RETRY_LIMIT&&!fleet?.occupiedPlane){
        const handles=importedScene.previewHandles(data.prebuilt);
        try{if(worldCar?.occupied)worldCar.car.assertTerrainSupport(handles);else assertInstalledSceneSupport(sim.world,handles,sim.playerBody.translation(),sim.player.crouched);}
        catch(error){keepPrebuilt=true;throw new SupportRetry(error instanceof Error?error.message:String(error));}
      }
      const {payloadBytes,resident:residentCount}=data.transfer!;
      const next=importedScene.replace(data.parts,candidate=>{
        if(quiet){spawn={...sim.player.position};return;}
        if(!preserve){spawn=nativeSceneDestination(data.parts,data.preferredSpawn);return;}
        try{spawn=fleet?.occupiedPlane?{...sim.player.position}:worldCar?.occupied?worldCar.car.assertTerrainSupport(candidate.sources.keys()):assertInstalledSceneSupport(sim.world,candidate.sources.keys(),sim.playerBody.translation(),sim.player.crouched);}
        catch(error){
          // The check is advisory: CStreaming never refuses a sector. A miss while the game runs (an airborne car,
          // a brushed wall) retries briefly; then the window installs where the player stands and physics settles it.
          const message=error instanceof Error?error.message:String(error);
          if(automatic&&!paused&&(data.supportRetries??0)<SUPPORT_RETRY_LIMIT)throw new SupportRetry(message);
          supportOverrides++;lastSupportMiss=message;console.warn(`Terrain window installed without support confirmation: ${message}`);
          spawn={...sim.player.position};
        }
      },data.datasetIdentity,vegetation,data.prebuilt);
      importedScene=next;redrawHeld();reapplySmashedProps(next);prunePropStates(next);localLighting.setModifiers(modifiers);render.lighting.area=next.area;
      lastSwap={ms:+(performance.now()-swapStart).toFixed(1),latencyMs:data.latencyMs??0,workerMs:+(data.workerMs??0).toFixed(0),timings:data.timings??{},parts:data.parts.length,placements:next.instanceCount,reusedPlacements:next.reusedPlacementCount,pooledModels:next.pooledModelCount,payloadMB:+(payloadBytes/1e6).toFixed(1),resident:residentCount,prebuiltMs:data.prebuiltMs??0,stages:Object.fromEntries(Object.entries(next.buildStages).map(([k,v])=>[k,+v.toFixed(1)]))};
      residentModels=residentModelsOf(data.parts);
      sim.respawn=spawn!;if(!preserve&&!quiet){sim.resetPlayer();render.yaw=sim.player.heading+Math.PI;}if(!automatic&&!quiet)sound.reset(sim);
      if(!menuQuiet){hud.button('play').hidden=false;hud.button('play').textContent='Walk imported scene';
      hud.menuMessage('Terrain updated. Current environment and character settings are retained.');}
      if(automatic)follower!.finish(data.followId!,true);completed=true;
      sceneChannel?.postMessage({type:'region-installed'});
      return true;
    } catch(error) {
      if(error instanceof SupportRetry&&automatic&&follower?.matches(data.followId!)){data.supportRetries=(data.supportRetries??0)+1;data.retryAt=performance.now()+SUPPORT_RETRY_MS;pendingFollowingData=data;return;}
      const message=error instanceof Error?error.message:'Terrain replacement failed.';
      if(automatic){console.warn(`Terrain window ${data.followId} could not be installed: ${message}`);follower!.finish(data.followId!,false);if(!follower!.snapshot().enabled)pause();}
      hud.menuMessage(`${message} The previous terrain is still available.`);
      sceneChannel?.postMessage({type:'region-error',message});
    } finally {
      if(!keepPrebuilt){data.prebuilt?.dispose();data.prebuilt=undefined;}
      installingScene=false;
      if(completed||automatic&&!follower?.matches(data.followId!)){clearTimeout(followTimer);pendingFollowingData=undefined;followBoundaryPaused=false;}
      if(alive){if(!menuQuiet)menuBusy(false);if(completed&&autoResume&&paused&&loadRequest===resumeVersion&&!document.hidden)play();}
    }
  };
  /** CEntryExit::TransitionFinished once the screen is black: CStreaming::LoadScene at the spawn point's exit in its
   * area (the game clock is suspended meanwhile), then the teleport. */
  /** The last save point's clock and, with `place`, where the player stood and faced there. */
  function restoreSavedLocation(saved:NonNullable<typeof progression.savedLocation>,place:boolean){
    sim.timeMinutes=saved.timeMinutes;if(saved.weekDay)sim.weekDay=saved.weekDay;
    if(!place)return;
    const position={x:saved.x,y:saved.z,z:-saved.y};
    sim.flushPlayerTasks();sim.player.position={...position};sim.player.previous={...position};sim.player.heading=saved.heading;
    sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
    render.yaw=saved.heading+Math.PI;
  }
  /** The deadline of the transfer under way (an interior's or the hangar flight's terrain). */
  let transferTimer:ReturnType<typeof setTimeout>|undefined;
  const TRANSFER_TIMEOUT_MS=45000;
  function startInteriorTransfer(t:EntryExitTransition){
    if(!staticWorld){entryExits?.arrived();mission?.runtime.game.pads.setDisabled(0,'enterCar',false);return;}
    interiorTransfer=t;follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;
    // A request the worker never answers gives up after the time an ordinary terrain request has.
    clearTimeout(transferTimer);transferTimer=setTimeout(()=>{if(interiorTransfer===t)failInteriorTransfer('The entrance could not be loaded in time.');},TRANSFER_TIMEOUT_MS);
    const [x,y]=t.spawn.exit,area=t.spawn.area;
    staticWorld.request(-2,area===0?{x,y,radius:180,lodRadius:1000,includeCollisionBounds:true}:{x,y,radius:100,includeCollisionBounds:true,interior:area});
  }
  async function finishInteriorTransfer(data:TerrainUpdate){
    clearTimeout(transferTimer);
    const t=interiorTransfer!,spawn=t.spawn;
    const installed=await replaceWalkTerrain({...data,followId:undefined,preservePosition:false,keepPlayer:true}).catch(()=>false);
    if(!alive)return;
    if(!installed){failInteriorTransfer('The entrance could not be loaded.');return;}
    // CEntryExit::FindValidTeleportPoint against the world (TestSphereAgainstWorld 0.35, GetIsLineOfSightClear).
    const toBrowser=(p:[number,number,number])=>({x:p[0],y:p[2],z:-p[1]});
    const point=findValidTeleportPoint(spawn.exit,p=>!!sim.world.intersectionWithShape(toBrowser(p),{x:0,y:0,z:0,w:1},new RAPIER.Ball(.35),undefined,undefined,sim.playerCollider),(a,b)=>{
      const from=toBrowser(a),to=toBrowser(b),d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},length=Math.hypot(d.x,d.y,d.z)||1;
      return !sim.world.castRay(new RAPIER.Ray(from,{x:d.x/length,y:d.y/length,z:d.z/length}),length,true,undefined,undefined,sim.playerCollider);
    });
    // CPed::Teleport to the ped centre, then the spawn point's exit heading (native forward (−sin, cos)).
    const feet={x:point[0],y:point[2]-1,z:-point[1]},heading=spawn.exitAngle*Math.PI/180+Math.PI;
    sim.flushPlayerTasks();sim.player.position={...feet};sim.player.previous={...feet};sim.player.heading=heading;sim.player.speed=0;sim.respawn={...feet};
    sim.playerBody.setTranslation({x:feet.x,y:feet.y+.9,z:feet.z},true);sim.playerBody.setNextKinematicTranslation({x:feet.x,y:feet.y+.9,z:feet.z});
    // TheCamera.RestoreWithJumpCut behind the player.
    render.yaw=heading+Math.PI;
    // CPopulation::RemoveAllRandomPeds; the interior's own peds (PopulateInterior) are not generated.
    pedestrians?.removeAllRandomPeds();
    // CEntryExit::GenerateAmbientPeds on an exit to the outside world: CPopulation::CreateWaitingCoppers.
    if(spawn.area===0&&law.level>0)void createWaitingCoppers({x:point[0],y:point[1],z:point[2]},spawn.exitAngle*Math.PI/180);
    // TransitionFinished: a spawn point that accepts the player's group warps his followers in with him
    // (IsTeleportPointValid: a clear 0.35 sphere in sight of him).
    if(spawn.flags&ENEX.ACCEPT_NPC_GROUP){
      const eye={x:feet.x,y:feet.y+1,z:feet.z};
      pedestrians?.warpGangWithPlayer(feet,spawn.area,q=>{
        const c={x:q.x,y:q.y+1,z:q.z};if(sim.world.intersectionWithShape(c,{x:0,y:0,z:0,w:1},new RAPIER.Ball(.35),undefined,undefined,sim.playerCollider))return false;
        const d={x:c.x-eye.x,y:c.y-eye.y,z:c.z-eye.z},length=Math.hypot(d.x,d.y,d.z)||1;
        return !sim.world.castRay(new RAPIER.Ray(eye,{x:d.x/length,y:d.y/length,z:d.z/length}),length,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,sim.playerCollider);
      });
    }
    entryExits?.arrived();mission?.runtime.game.pads.setDisabled(0,'enterCar',false);rebuildPlayerIfNeeded();
    // TransitionFinished (EntryExit.cpp:350, 376): CGame::currArea = ms_spawnPoint->m_nArea, which GET_AREA_VISIBLE reads.
    // Only SET_AREA_VISIBLE wrote it before, so a script asking which area CJ walked into heard 0 (INTRO2 never asked
    // for the SHOP animations in the barber's and waited for them for ever after the haircut).
    if(mission)mission.runtime.game.currentArea=spawn.area;
    spawnPointSky(spawn);
    // TransitionFinished's shop (reconstructed): a reward interior's door unloads the shop, any other door loads the
    // shop its name names and marks its pair as the reward side.
    {const shopping=mission?.runtime.game.shopping,door=t.enex;
     if(shopping){if(door.flags&ENEX.REWARD_INTERIOR)shopping.removeLoadedShop();else{try{shopping.loadShop(door.name);}catch(error){console.warn('LoadShop',door.name,error);}if(door.link)door.link.flags|=ENEX.REWARD_INTERIOR;}}}
    follower=spawn.area===0?new SceneRegionFollower({x:point[0],y:point[1],radius:180,lodRadius:1000,includeCollisionBounds:true}):undefined;
    interiorCentre=spawn.area===0?undefined:{x:point[0],y:point[1]};
    interiorTransfer=undefined;
    cameraFade.fade(1000,1,gameTimeMs);hud.fade(false,1000);
  }
  /** TransitionFinished (EntryExit.cpp:461): the spawn point's sky colour, less one, is its extra timecycle colour, on at
   * once (CTimeCycle::StartExtraColour); a spawn point without one turns the extra colour off. Without it an interior
   * kept the street's sky behind its rooms and the street's ambient on its walls. */
  function spawnPointSky(spawn:{skyColor:number}){
    if(spawn.skyColor>0&&spawn.skyColor<=16)localLighting.startExtraColour(spawn.skyColor-1,false);else localLighting.stopExtraColour(false);
  }
  function failInteriorTransfer(message:string){
    clearTimeout(transferTimer);interiorTransfer=undefined;entryExits?.arrived();mission?.runtime.game.pads.setDisabled(0,'enterCar',false);
    follower=new SceneRegionFollower({x:sim.player.position.x,y:-sim.player.position.z,radius:180,lodRadius:1000,includeCollisionBounds:true});
    cameraFade.fade(1000,1,gameTimeMs);hud.fade(false,1000);hud.message(message);
  }
  if (importedMode) {
    // The area under the title; the whole of San Andreas would only say the title again.
    {const location=hud.element.querySelector<HTMLElement>('.menu-location')!;location.textContent=walkDemo?included.name:'Imported scene';
     location.hidden=location.textContent===hud.element.querySelector('.menu h1')?.textContent;}
    // A local imported scene has no zone file of its own, so its label stands in; the world names its zones every frame.
    if(!walkDemo)hud.names.setZoneName('Imported scene',true);
    hud.element.querySelector('.setting')!.textContent = walkDemo?included.location:'Local scene walk test';
    hud.element.querySelector('.build-label')!.textContent = walkDemo?'Browser exploration · Native terrain and character':'Temporary imported environment · Source files stay on this device';
    hud.button('play').hidden = true;

    let bundledProceduralAssets:Awaited<ReturnType<typeof import('./assets/nativeProcAssets').readNativeProcAssets>>|undefined;
    const installScene = async (data: { parts: import('./assets/scene').ScenePart[]; timecycleBoxes?: import('./assets/timecycleBoxes').TimecycleBox[]; preferredSpawn?: { x: number; z: number } }) => {
      if (importedScene || installingScene) return;
      installingScene = true;
      try {
        const [{ installNativeScene }, { importedSpawn }, vegetation] = await Promise.all([import('./simulation/nativeScene'), import('./simulation/importedSpawn'),readSceneVegetationOnce('environment' in data?data.environment:undefined)]);
        if(vegetation&&bundledProceduralAssets)vegetation.proceduralAssets=bundledProceduralAssets;
        if (!alive) return;
        surfaceAudio=undefined;surfaceSprint=undefined;surfaceClimbable=undefined;surfaceSprintBlocked=false;
        const environmentWarnings=await loadSceneEnvironment('environment' in data?data.environment:undefined,{lighting:disposeLighting,water:disposeWater,particle:{load:async file=>{void skids.loadTexture(file).catch(()=>false);
          // CCustomRoadsignMgr::Initialise reads `roadsignfont` from particle.txd.
          try{const [font]=decodeNamedTextures(['roadsignfont'],new Uint8Array(await file.arrayBuffer()));if(font&&!font.compressed)roadsigns.setFont({width:font.mips[0].width,height:font.mips[0].height,data:font.mips[0].data});}catch{}
          return disposeSunTexture.load(file);}},surfaceInfo:{load:async file=>{
          if(file.size>4*1024*1024)return false;
          try{const flags=readSurfaceMovementFlags(await file.text());surfaceSprint=flags.sprint;surfaceClimbable=flags.climbable;surfaceSteep=flags.steepSlope;return true;}catch{surfaceSprint=surfaceClimbable=undefined;return false;}
        }},surfaceAudio:{load:async file=>{
          surfaceAudio=undefined;if(file.size>1024*1024)return false;
          try{const parsed=readSurfaceAudio(await file.text());if(parsed.warnings.length)return false;surfaceAudio=parsed;return true;}catch{return false;}
        }}},files=>sound.loadNativeFootsteps(files),async files=>{
          try{if(parameters.has('characterTest'))return true;const {readLocalPlayerCharacter}=await import('./assets/localPlayerCharacter');const source=await readLocalPlayerCharacter(files);if(!alive)return false;render.installCharacter(source);
           playerBody={files:files.body,character:render.nativeCharacter!,ratios:{normal:1,fat:0,ripped:0}};void rebuildPlayerBody();return true;}catch{return false;}
        });
        if(!alive)return;
        localLighting.setModifiers(data.timecycleBoxes??[]);
        importedScene = installNativeScene(sim.world, render.scene, data.parts,{datasetIdentity:'datasetIdentity' in data?data.datasetIdentity as string|undefined:undefined,vegetation,roadsigns,occlusion});
        residentModels=residentModelsOf(data.parts);
        smashedPlacements.clear();movedPlacements.clear();
        render.lighting.area=importedScene.area;
        applySceneObjectData();
        importedScene.setTime(sim.timeMinutes,localLighting.sample(sim.timeMinutes)?.ambient);
        sim.world.step();
        sim.respawn = importedSpawn(sim.world, data.parts, new Set(importedScene.sources.keys()), sim.playerCollider, data.preferredSpawn); sim.resetPlayer();
        render.yaw = sim.player.heading + Math.PI; sound.reset(sim);
        hud.button('play').hidden = false; hud.button('play').textContent = walkDemo?`Explore ${included.name}`:'Walk imported scene';
        // The front end's Start Game offers New Game beside the saved game: FESZ_QR asks first, and the page starts over.
        const newGame=hud.button('new-game');newGame.hidden=!(walkDemo&&(progression.savedLocation||progression.hadSave));newGame.textContent=gxtText('FES_NGA','New Game');
        newGame.onclick=()=>{if(!confirm(gxtText('FESZ_QR','Are you sure you want to start a new game? All current game progress will be lost. Proceed?')))return;if(progression.startNewGame())location.reload();else{const u=new URL(location.href);u.searchParams.set('new-game','1');location.replace(u.href);}};
        // A phone has no keys to name: the touch controls' own words.
        const howToWalk=touch?'Your left thumb walks; drag on the right to look.':walkDemo?'WASD to walk, Shift to sprint, Space to jump.':'WASD to walk; Space to jump.';
        // An iPhone's browser cannot take the screen: the home screen can.
        const homeScreen=touch&&suggestHomeScreen()?' On an iPhone, Share → Add to Home Screen plays it full screen.':'';
        hud.menuMessage((walkDemo?`${included.name} is ready. ${howToWalk}${homeScreen}`:`Imported scene ready. ${howToWalk} This test scene is not saved.`)+(environmentWarnings.length?` Environment files unavailable: ${environmentWarnings.join(', ')}.${touch?'':' See Lighting for details.'}`:''));
        if('followRegion' in data&&data.followRegion)follower=new SceneRegionFollower(data.followRegion as import('./assets/sceneRegion').SceneRegion);
        if(walkDemo){
          pedestrians=new WorldPedestrians(sim,render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,()=>render.nativeCharacter,law);
          sim.nearestPedNode=position=>pedestrians?.nearestPedNode(position);
          // Crossing peds read the same traffic-light timer as the cars.
          pedestrians.lightClock=()=>traffic?.lightMs;
          pedestrians.playerArmed=()=>{const fire=weapons.inventory.info()?.fire;return fire==='instant'||fire==='projectile';};
          pedestrians.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
          pedestrians.onShot=(from,to,weapon,hit,shooter)=>{weapons.npcShot(from,to,weapon,hit);sound.combat('fire',weapon,from,'npc',shooter);};
          pedestrians.onMeleeHit=(position,byPlayer)=>sound.combat('impact',0,position,byPlayer?'player':'npc');
          // CPed::CreateDeadPedWeaponPickups: each gun lands at CreateDeadPedPickupCoors round the body, 0.3 higher.
          pedestrians.onDropWeapon=(position,weapon,rounds,persist)=>{
           const spot=mission?.deadPedPickupCoordsAt({x:position.x,y:-position.z,z:position.y});
           if(spot)void drops.report({x:spot.x,y:spot.z+.3,z:-spot.y},weapon,rounds,persist,true);
           else void drops.report(position,weapon,rounds,persist);
          };
          pedestrians.onDropMoney=(position,amount)=>moneyDrops.drop(position,amount);
          pedestrians.resolveScriptPed=handle=>{const ped=mission?.pedByHandle(handle);return ped==='player'?ped:onFoot(ped);};
          pedestrians.resolveScriptVehicle=handle=>{
           const m=mission,entity=m?.vehicles.exists(handle)?m.vehicles.entity(handle):undefined;
           if(!m||!entity)return undefined;
           // A bike (BMX INTRO1's homies ride, and the motorbikes) has a driver's saddle and one pillion, each got on
           // from the side, the jump-on clip's end short of the seat when the clips are in and a unit out otherwise.
           if(!isScriptCar(entity)){
            const bike=entity as import('./simulation/WorldBike').WorldBike;
            if(typeof bike.seat!=='function'||!bike.body)return undefined;
            return {
             alive:()=>m.vehicles.exists(handle)&&!bike.wrecked,
             entity:()=>undefined,
             seatFor:seat=>seat==='driver'?(m.peds.seatTaken(handle,'driver')?undefined:'driver'):(seat<=0&&!m.peds.seatTaken(handle,0)?0:undefined),
             doorPoint:(_seat,from)=>{
              const seat=bike.seat();if(!seat)return undefined;
              const sides=(['left','right'] as const).map(side=>bikeMount.worldPoint(bike,bikeMount.sidePoint(bike,side)??{x:seat.x+(side==='left'?-1:1),y:seat.y,z:seat.z}));
              const w=sides.reduce((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)<=Math.hypot(b.x-from.x,b.z-from.z)?a:b);
              return {x:w.x,y:w.y,z:w.z};
             },
             board:(ped,seat)=>{const h=m.peds.handleOf(ped);if(h===undefined||!m.vehicles.exists(handle))return false;m.peds.warpIntoCar(h,handle,seat);return true;},
            };
           }
           const car=entity;
           return {
            alive:()=>m.vehicles.exists(handle)&&!car.wrecked,
            entity:()=>m.vehicles.exists(handle)?car:undefined,
            // Any free passenger seat for -1; a rear seat only where the model has ped_backseat. A seat a script ped
            // already sits in is not free, and a taken driving seat is not jacked here.
            seatFor:seat=>{
             if(seat==='driver')return m.peds.seatTaken(handle,'driver')?undefined:'driver';
             const rear=!!car.car.nativeFramePosition('ped_backseat');
             return (seat>=0?[seat]:[0,1,2]).find(s=>s>=0&&s<=2&&(s===0||rear)&&!m.peds.seatTaken(handle,s));
            },
            doorPoint:seat=>{const local=carEntry.seatDoorPoint(car,seat);if(!local)return undefined;const w=car.worldPoint(local);return {x:w.x,y:w.y,z:w.z};},
            board:(ped,seat)=>{const h=m.peds.handleOf(ped);if(h===undefined||!m.vehicles.exists(handle))return false;m.peds.warpIntoCar(h,handle,seat);return true;},
           };
          };
          // CDarkel::RegisterKillNotByPlayer for everyone else's kills: STAT_PEOPLE_WASTED_BY_OTHERS, a recruit of the
          // player's group costing 2 respect (STAT_RECRUITED_GANG_MEMBERS_KILLED), and a gangster's friendly or enemy count.
          pedestrians.onKill=victim=>{if(victim.byPlayerVehicle)mission?.runtime.game.stats.increment(121,1);
           else if(!victim.byPlayer){const stats=mission?.runtime.game.stats;if(stats){if(victim.recruit){stats.decrement(68,2);stats.increment(163,1);}stats.increment(120,1);if(victim.gang!==undefined)stats.increment(victim.gang===1?240:239,1);}}if(victim.byPlayer&&sim.playerCollider.isEnabled())gangWars?.addKillToProvocation(victim.gang);if(victim.byPlayer&&pedTypeAtLeastDealer(victim.pedType))playerKilledADealer(worldZones,{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y});if(victim.byPlayer){if(victim.gang!==undefined&&GANG_RIVALS.has(victim.gang))addRespect(5);registerKillByPlayer(victim);}};
          const speechSeed=(position:{x:number;z:number})=>Math.abs(Math.floor(position.x*13+position.z*7));
          pedestrians.playerVehicleVelocity=()=>{const b=worldCar?.occupied?worldCar.car.body:fleet?.occupiedBike?.body??fleet?.occupiedBoat?.body??fleet?.occupiedPlane?.body;if(!b)return undefined;const v=b.linvel();return {x:v.x,y:v.y,z:v.z};};
          // CAEPedSpeechAudioEntity::AddSayEvent says nothing for a ped whose speech a script disabled.
          const speaks=(ped:object)=>!(ped as {shutUp?:boolean}).shutUp;
          // CTX_GLOBAL_PAIN_HIGH, or PAIN_ON_FIRE while burning, in the ped's PAIN_A voice (GetPainVoice).
          pedestrians.onPain=(ped,position,onFire)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'pain',speechSeed(position),{voice:painVoice(false,(ped as {pedType?:string}).pedType),context:onFire?'onFire':'high'});};
          pedestrians.onFlee=(ped,position)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'flee',speechSeed(position));};
          pedestrians.onThreat=(ped,position)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'threat',speechSeed(position));};
          pedestrians.onGreet=(ped,position)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'greet',speechSeed(position));};
          pedestrians.onFootstep=(ped,position,move,foot)=>sound.pedFootstep(ped,position,move,foot);
          pedestrians.onCrunch=(ped,position)=>sound.nativeEngine?.pedCrunch(ped,{x:position.x,y:-position.z,z:position.y});
          pedestrians.onCarCrunch=car=>sound.nativeEngine?.vehicle(car,car.modelId)?.addAudioEvent(AE.pedCrunch);
          pedestrians.onPlayerCarKill=(time,frequency)=>{mission?.runtime.game.pads.startShake(0,time,frequency,0,gameTimeMs);};
          // Car colliders do not touch peds in the solver, so the strike reports its own collision sound, both ways.
          pedestrians.onCarPedCollision=(car,handle,point,normal,carImpulse,pedImpulse)=>{const c=sound.nativeEngine?.collisions;if(!c)return;
           const pos={x:point.x,y:-point.z,z:point.y},n={x:normal.x,y:-normal.z,z:normal.y},ped={key:handle,surface:SURFACE.ped};
           c.reportCollision(carCollider(car),ped,pos,n,carImpulse,1);c.reportCollision(ped,carCollider(car),pos,{x:-n.x,y:-n.y,z:-n.z},pedImpulse,1);};
          pedestrians.onWaterCannonSmoke=(p,v)=>worldFx.waterCannon.pedSmoke([p.x,p.y,p.z],[v.x,v.y,v.z]);
          pedestrians.isShootThrough=hit=>worldFx.isShootThrough(hit);
          worldFx.onDanger=(plane,radius)=>{const at=()=>{if(!fleet?.planes.has(plane))return undefined;const t=plane.body.translation();return {x:t.x,z:t.z};};pedestrians?.danger(at,radius,plane.occupied?'player':plane.policeHeli?'cop':undefined);};
          pedestrians.rain=()=>weatherStarted?weather.rain:0;
          // Turf gangs from the INITIAL zone population: strongest gang wins the node.
          // Shared by street parties and drive-by attack cars.
          const turfAt=(x:number,z:number)=>{
            const population=worldZones?.population;
            if(!population)return undefined;
            const zone=worldZoneAt(worldZones!,[x,-z,sim.player.position.y]);
            const strengths=population[zone.zoneInfoIndex]?.gangStrength;
            if(!strengths)return undefined;
            let gang=-1,strength=0;
            strengths.forEach((value,index)=>{if(value>strength){strength=value;gang=index;}});
            return strength>0?{gang,strength}:undefined;
          };
          pedestrians.gangTurf=turfAt;pedestrians.dontCreateRandomGangMembers=()=>!!mission?.runtime.game.population.dontCreateRandomGangMembers;pedestrians.onlyCreateRandomGangMembers=()=>!!mission?.runtime.game.population.onlyCreateRandomGangMembers;
          pedestrians.gangsNeeded=(x,z)=>{
            const population=worldZones?.population;
            if(!population)return 0;
            const strengths=population[worldZoneAt(worldZones!,[x,-z,sim.player.position.y]).zoneInfoIndex]?.gangStrength;
            let mask=strengths?strengths.reduce((mask,value,index)=>value>0?mask|(1<<index):mask,0):0;
            // CGangWars::TellStreamingWhichGangsAreNeeded: the attacking gang within 150 units of the point of attack.
            if(gangWars&&gangWars.state2!==0&&Math.hypot(gangWars.pointOfAttack.x-x,gangWars.pointOfAttack.y+z)<150)mask|=1<<gangWars.gang1;
            return mask;
          };
          pedestrians.dealerTurf=(x,z)=>{
            const population=worldZones?.population;
            if(!population)return undefined;
            const zone=worldZoneAt(worldZones!,[x,-z,sim.player.position.y]);
            return population[zone.zoneInfoIndex]?.dealerStrength;
          };
          void Promise.all([import('./assets/includedGreenwood'),import('./simulation/WorldCar'),import('./assets/worldRoadMaterials'),import('./simulation/WorldFleet')]).then(async([{loadIncludedGreenwood},{WorldCar},{loadWorldRoadMaterials},{WorldFleet}])=>{
            // CPed::GetBikeRidingSkill for the player.
            void import('./simulation/WorldBike').then(({WorldBike})=>{WorldBike.ridingSkill=()=>Math.min(1000,(mission?.runtime.game.stats.get(STAT_BIKE_SKILL)??0)/1000);WorldBike.riderStaysOn=()=>!!mission?.runtime.game.playerInfo.stayOnBike;WorldBike.playerOnStairs=()=>{const p=sim.player.position;return cullZones.playerOnStairs([p.x,-p.z,p.y]);};WorldBike.onKnockedOff=clip=>{/* CTaskComplexFallAndGetUp: the fall, the player's 500 ms down after a vehicle, the get-up. */const view=render.nativeCharacter;if(!view?.hasReaction(clip)||sim.player.health<=0)return;const fall=view.reactionDuration(clip)??1,getUp=playerFall(view,clip);sim.knockdown=fall+.5+getUp;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(clip,fall+.5);};WorldBike.hopClipSeconds=model=>{const group=model===509?'choppa':model===510?'mtb':'bmx';return carEntry.clips.peek(group,`${group.toUpperCase()}_bunnyhop`)?.duration;};});
            // CVehicle::SetDriver and RemoveDriver's freebies (nativeFreebies). The weapon goes through
            // DoesPlayerWantNewWeapon(type, true): taken only into an empty slot or onto the same weapon; with another
            // weapon in the slot the cop car's shotgun becomes GrantAmmo on it (which feeds whatever the slot holds) and
            // the Caddy's golf club is not given.
            WorldCar.onFreebie=(_car,freebie)=>{
             if(freebie.kind==='health')addPlayerHealth(freebie.amount);
             else if(freebie.kind==='money')sim.money+=freebie.amount;
             else if(freebie.kind==='armour')sim.player.armour=Math.max(mission?.runtime.game.playerInfo.maxArmour??100,sim.player.armour);
             else if(freebie.kind==='calories'){const stats=mission?.runtime.game.stats;if(stats?.player)stats.increment(STAT_CALORIES,freebie.amount);else addPlayerHealth(freebie.amount);}
             else{
              const inv=weapons.inventory,held=inv.inSlot(inv.slotOf(freebie.weapon));
              if(held!==undefined&&held!==freebie.weapon){if(freebie.weapon===WEAPON.shotgun)inv.grantAmmo(held,freebie.ammo);}
              else{const before=inv.selected;if(inv.give(freebie.weapon,freebie.ammo)&&inv.selected!==before)void weaponView.equip(inv.selected);}
             }
            };
            const [assets,road]=await Promise.all([loadIncludedGreenwood(`${import.meta.env.BASE_URL}play/vehicles/greenwood/`),loadWorldRoadMaterials(`${import.meta.env.BASE_URL}play/world/`)]);if(!alive)return;worldFx.surfaces=road.records;roadSurfaces=road;surfaceAudio??={byId:road.audio,warnings:[]};
            const x=2491,z=1680,hit=sim.world.castRay(new RAPIER.Ray({x,y:80,z},{x:0,y:-1,z:0}),100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
            if(!hit)throw new Error('No native road surface for the Greenwood.');
            // CAutomobile::VehicleDamage: ramming a manned law car gives the player a star.
            WorldCar.onPlayerRammedLaw=()=>law.setLevelNoDrop(1);
            // CAutomobile::VehicleDamage's crash shake on the player's pad.
            WorldCar.onPlayerCarShake=(time,frequency,delayMs)=>{mission?.runtime.game.pads.startShake(0,time,frequency,delayMs,gameTimeMs);};
            WorldCar.onRoadShake=(suspension,roughness,speed,mass,timeStep)=>{const shake=roadShake({suspension,roughness,speed,mass,timeStep,timeMs:gameTimeMs});if(shake)mission?.runtime.game.pads.startShake(0,shake.time,shake.frequency,0,gameTimeMs);};
            worldCar=new WorldCar(sim,render.scene,assets,{x,y:80-hit.timeOfImpact+1,z},road);worldCar.driverless=true;
            worldCar.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
            fleet=new WorldFleet(sim,render.scene,road,worldCar,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);fleet.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);fleet.outside=()=>render.lighting.area===0;fleet.sphereVisible=(x,y,z)=>new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(render.camera.projectionMatrix,render.camera.matrixWorldInverse)).containsPoint(new Vector3(x,y,z));fleet.setGenerators(worldGenerators);if(worldZones)fleet.setZones(worldZones);fleet.onImpound=car=>impoundCar?.(car);
            // ClearSpaceForMissionEntity's ped removals reach the crowd once it exists.
            fleet.clearPed=handle=>pedestrians?.removeDeletableCollider(handle)??false;
            // CCarGenerator's hot-dog van brings its vendor, and his brain.
            fleet.onHotdogVan=car=>{try{mission?.hotdogVan(car);}catch(error){console.warn('Hot-dog vendor',error);}};
            fleet.raining=()=>weatherStarted&&weather.rainyWeatherType;
            traffic=new WorldTraffic(sim,fleet,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
            // A phone drives the traffic beyond 60 units on rails (measured: four of six cars, a sixth of the frame's CPU).
            if(touch)traffic.physicsRadius=60;
            police=new WorldPolice(sim,fleet,law,carEntry.clips,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);if(worldZones)police.zones=worldZones;police.noPoliceZone=()=>cullZones.noPolice;
            traffic.spawnPatrol=(position,heading)=>police!.spawnPatrol(position,heading);
            void import('./simulation/WorldEmergency').then(({WorldEmergency})=>{
             if(!alive||!fleet||emergency)return;
             emergency=new WorldEmergency(sim,fleet,carEntry.clips,scriptCars,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
             if(worldZones)emergency.zones=worldZones;emergency.wanted=()=>law.level;emergency.outside=()=>render.lighting.area===0;
             emergency.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);emergency.fires=weapons.fires;
             emergency.crowd={dead:()=>pedestrians?.deadPeds()??[],exists:id=>!!pedestrians?.pedExists(id),spawnCrew:(model,position,heading,crew)=>pedestrians?pedestrians.spawnCrew(model,position,heading,crew):Promise.resolve(false),
              orders:(id,orders)=>pedestrians?.crewOrders(id,orders),crewState:id=>pedestrians?.crewState(id),holdDead:id=>pedestrians?.holdDead(id),revive:id=>!!pedestrians?.revive(id),
              board:id=>!!pedestrians?.boardOfficer(id),release:unit=>pedestrians?.releaseCrew(unit)};
            }).catch(error=>{if(alive)hud.message(`Emergency services could not load: ${error instanceof Error?error.message:String(error)}`);});
            traffic.noSpawn=()=>gangWars?.dontCreateCivilians()??false;
            // CEventVehicleOnFire: the random driver's decision is TASK_COMPLEX_LEAVE_CAR_AND_FLEE (R_Norm/R_Tough/R_Weak.ped),
            // CTaskComplexLeaveAnyCar then CTaskComplexSmartFleeEntity 15 units from the car.
            traffic.onFire=car=>{const at=car.car.body.translation();carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnFleeing(occupants.driverModel(car),position,heading,car.gang,{from:{x:at.x,z:at.z},safe:15}));pedestrians?.vehicleOnFire({x:at.x,z:at.z});};
            // CEventVehicleDamageCollision from the player's car: the driver's decision maker draws nothing, a flee-scene
            // drive or CTaskComplexRoadRage (R_Norm/R_Tough/R_Weak.ped rows for event 73).
            traffic.driverDecisionMaker=car=>pedestrians?.decisionMakerOf(occupants.driverModel(car));traffic.playerOnMission=()=>!!mission?.playerOnAMission();if(pedestrians)pedestrians.onGunShot=(from,silent,byPlayer)=>traffic?.gunShot(from,silent,byPlayer);
            traffic.onRoadRage=car=>carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnRoadRage(occupants.driverModel(car),position,heading,car.gang));
            // CTaskComplexDieInCar: the shot driver leaves and dies once the car rests, or dies in his seat while it rolls.
            traffic.onDriverDiesOut=car=>{if(!carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnDead(occupants.driverModel(car),position,heading,car.gang)))traffic?.onDriverDied?.(car);};
            traffic.onDriverDeadInSeat=car=>occupants.markDeadInSeat(car);
            // The seated peds a bullet can reach: traffic drivers and police crews (drive-by crews stay with their own module).
            weapons.seatedPeds=()=>{const policeCars=new Set(police?.units.map(u=>u.car));const out:import('./weapons/WeaponSystem').SeatedTarget[]=[];
             for(const car of fleet?.cars??[]){if(!car.autopilot||car.occupied||car.driverOut||car.wrecked||policeCars.has(car)||driveby?.covers(car)||emergency?.covers(car))continue;const seat=car.seat('left');if(seat)out.push({car,seat:0,local:seat,kind:'traffic'});}
             for(const c of police?.crewSeats()??[])out.push({car:c.car,seat:c.seat,local:c.local,kind:'police'});
             for(const c of driveby?.crewSeats()??[])out.push({car:c.car,seat:c.seat,local:c.local,kind:'driveby'});
             return out;};
            weapons.onSeatedShot=(target,damage)=>target.kind==='police'?police?.crewShot(target.car,target.seat,damage):target.kind==='driveby'?driveby?.crewShot(target.car,target.seat,damage):traffic?.driverShot(target.car,damage);
            if(driveby)driveby.onCrewDiesOut=(car,model)=>{if(!carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnDead(model,position,heading,car.gang))){const seat=car.seat('left'),w=seat?car.worldPoint(seat):car.car.body.translation();pedestrians?.spawnDead(model,{x:w.x,y:w.y,z:w.z},car.heading(),car.gang);}};
            if(police)police.onCrewDiesOut=(car,model)=>{if(!carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnDead(model,position,heading))){const seat=car.seat('left'),w=seat?car.worldPoint(seat):car.car.body.translation();pedestrians?.spawnDead(model,{x:w.x,y:w.y,z:w.z},car.heading());}};
            // CTaskComplexLeaveCarAndFlee (a tyre shot out, R_Weak.ped): CTaskComplexLeaveCar without waiting for the car to
            // slow, then CTaskComplexSmartFleePoint 60 units from where the driver was, for good.
            // CEventVehicleDied: a car blown up with its driver aboard leaves him dead at the seat.
            traffic.onDriverDied=car=>{const seat=car.seat('left'),w=seat?car.worldPoint(seat):car.car.body.translation();pedestrians?.spawnDead(occupants.driverModel(car),{x:w.x,y:w.y,z:w.z},car.heading(),car.gang);};
            traffic.onLeaveCarAndFlee=car=>{const at=car.car.body.translation();carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnFleeing(occupants.driverModel(car),position,heading,car.gang,{from:{x:at.x,z:at.z},safe:60}));};
            fleet.canChangePopulation=(point,radius)=>populationOutsideView(render.camera,point,radius);
            // Sounding sirens own the lane: pursuit units plus the player's siren.
            traffic.sirens=()=>{
             const out:{position:{x:number;y:number;z:number};velocity:{x:number;y:number;z:number}}[]=[];
             const add=(car:ScriptCar)=>out.push({position:{...car.car.body.translation()},velocity:{...car.car.body.linvel()}});
             for(const u of police?.units??[])if(u.siren&&!u.car.wrecked)add(u.car);
             for(const u of emergency?.units??[])if(u.car.siren&&!u.car.wrecked&&!u.car.disposed)add(u.car);
             const driven=fleet?.occupied;
             if(driven?.siren&&!driven.wrecked)add(driven);
             return out;
            };
            traffic.peds=()=>{const out=pedestrians?.positions()??[];if(!fleet?.occupied)out.push({...sim.player.position});return out;};
            police.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
            police.camera=()=>{const forward=render.camera.getWorldDirection(render.camera.position.clone());return {position:render.camera.position,forward};};
            police.spawnOfficer=(model,weapon,position,heading,crew,accuracy)=>{void pedestrians?.spawnOfficer(model,weapon,position,heading,crew,accuracy);};
            police.onUnitDropped=unit=>pedestrians?.releaseCrew(unit);
            police.crew={list:unit=>pedestrians?.footCrew(unit)??[],goTo:(id,point,walk)=>pedestrians?.sendOfficer(id,point,walk),board:id=>pedestrians?.boardOfficer(id)??false};
            // CTaskComplexArrestPed opens the door and waits for the suspect to be out; the arrest itself follows on foot.
            police.onPullFromCar=()=>{if(carEntry.seated)carEntry.dragOut();};police.onPullFromBike=bike=>{if(!bikeMount.active&&!bikeMount.jacked(bike))bike.pulledOff();};
            void import('./simulation/GangDriveBy').then(({GangDriveBy})=>{
             if(!alive||!fleet||driveby)return;driveby=new GangDriveBy(sim,fleet,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
             driveby.gangTurf=turfAt;driveby.gangResident=gang=>pedestrians?.gangResident(gang)??[];driveby.gangHatesPlayer=gang=>!!pedestrians?.gangHatesPlayer(gang);driveby.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
             driveby.onShot=(from,to,weapon,hit)=>{weapons.npcShot(from,to,weapon,hit);sound.combat('fire',weapon,from,'npc');};
            }).catch(error=>{if(alive)hud.message(`Drive-by pursuit could not load: ${error instanceof Error?error.message:String(error)}`);});
           if(pedestrians){
             // Reinforcements arrive with their car crews; do not synthesize extra nearby foot police.
             pedestrians.footOfficerLimit=()=>0;
             // PopulateInterior's interior peds are not generated; street peds only come outside (CanSeeOutSideFromCurrArea).
             pedestrians.limits=()=>render.lighting.area!==0?{civilians:0,total:0}:scalePedLimits(fewerPedsLimits(fleet?.pedLimits(),cullZones.fewerPeds),(mission?.runtime.game.pedDensityMultiplier??1)*touchPopulation());pedestrians.pedZone=()=>fleet?.pedZone();pedestrians.trains=()=>[...(fleet?.trains??[])].filter(t=>!t.disposed).map(t=>({body:t.body,nativeBody:t.nativeBody,occupied:false,boundRadius:t.boundRadius,train:true}));pedestrians.pedTargets=()=>{const t=fleet?.pedTargets();return t&&scalePedTargets(t,(mission?.runtime.game.pedDensityMultiplier??1)*touchPopulation());};pedestrians.dontCreateRandomCops=()=>!!mission?.runtime.game.population.dontCreateRandomCops;pedestrians.copModel=()=>DEFAULT_COP_MODEL[fleet?.zoneLevel()??0];pedestrians.cameraKeepsPeds=()=>render.firstPerson==='sniper'||render.firstPerson==='camera'||render.glance!=='none';pedestrians.noCivilians=()=>gangWars?.dontCreateCivilians()??false;pedestrians.gangWarFighting=()=>!!gangWars?.gangWarFightingGoingOn();pedestrians.playerVehicle=()=>{const car=worldCar?.occupied?worldCar:fleet?.occupied;if(!car)return undefined;const t=car.car.body.translation();return {position:{x:t.x,y:t.y,z:t.z},alarm:car.alarm>0,law:LAW_ENFORCEMENT_MODELS.has(car.modelId),wrecked:car.wrecked};};pedestrians.bikes=()=>[...(fleet?.bikes??[])].map(bike=>({body:bike.body,nativeBody:bike.nativeBody,occupied:bike.occupied,boundRadius:bike.boundRadius}));pedestrians.playerRide=()=>{const bike=fleet?.occupiedBike;if(bike)return {body:bike.body,bike:true};const other=fleet?.occupiedBoat??fleet?.occupiedPlane;return other?{body:other.body,bike:false}:undefined;};pedestrians.playerVehicleSpeed=()=>{const car=worldCar?.occupied&&!worldCar.disposed?worldCar:fleet?.occupied&&!fleet.occupied.disposed?fleet.occupied:undefined;if(!car)return 0;const v=car.car.body.linvel();return Math.hypot(v.x,v.z)/50;};pedestrians.attractorsNear=(x,y,r)=>importedScene?.attractorsNear(x,y,r)??[];pedestrians.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);pedestrians.visibleArea=()=>render.lighting.area;pedestrians.scriptDecisionMaker=slot=>mission?.scriptDecisions.get(slot);if(fleet)fleet.rain=()=>{if(!weatherStarted)return 0;const car=worldCar?.occupied?worldCar:fleet?.occupied;
             // CPopCycle::GetCurrentPercOther_Peds: no rain damping on a mission in a Taxi or Cabbie (the fares keep coming).
             if(car&&(car.modelId===420||car.modelId===438)&&mission?.playerOnAMission())return 0;return weather.rain;};if(fleet)fleet.insideHideOutGarage=at=>!!mission?.runtime.game.garages.isPointWithinHideOut([at.x,-at.z,at.y]);if(fleet)fleet.pedCentres=()=>pedestrians?.targets(true).map(t=>t.position)??[];if(fleet)fleet.suppressedModels=()=>mission?.suppressedCarModels()??new Set();if(fleet)fleet.scriptZoneInfo=index=>mission?.scriptZoneInfo(index);occupants.pickDriver=car=>car.gang!==undefined?pedestrians?.gangDriver(car.gang):pedestrians?.specificDriver(fleet?.modelName(car.modelId),fleet?.zoneLevel()??0)??pedestrians?.rosterDriver(fleet?.vehicleClass(car.modelId));
             carEntry.crowd=pedestrians;
           }
          }).catch(error=>{if(alive)hud.message(`Vehicle could not load: ${error.message}`);});
          if(navigation)navigation.onFly=modelId=>{
            // Any vehicle, and any entry or exit under way: the player can only be put in the new aircraft from on foot.
            const riding=fleet?.occupied||fleet?.occupiedPlane||fleet?.occupiedBike||fleet?.occupiedBoat||worldCar?.occupied||playerPassenger||playerAttached||carEntry.phase!==undefined||bikeMount.active;
            if(riding)return Promise.reject(new Error('Leave your current vehicle before choosing another plane.'));
            if(!fleet||!staticWorld||flightTransfer||installingScene)return Promise.reject(new Error('Wait for world loading to finish.'));
            // The airfield replaces the current window: a follow request in flight (the primed start window, say) is dropped.
            follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;pendingPrebuild?.job.dispose();pendingPrebuild=undefined;
            navigation.toggle(false);pause();menuBusy(true);hud.menuMessage('Loading Verdant Meadows and your aircraft…');
            return new Promise<void>((resolve,reject)=>{
              const transfer={modelId,resolve,reject};flightTransfer=transfer;
              staticWorld!.request(-1,{x:150,y:2500,radius:180,lodRadius:1000,includeCollisionBounds:true});
              clearTimeout(transferTimer);transferTimer=setTimeout(()=>{
                if(flightTransfer!==transfer)return;
                // Given up: the menu is free again and the terrain around the player streams on.
                flightTransfer=undefined;menuBusy(false);hud.menuMessage('Verdant Meadows could not be loaded in time.');
                follower=new SceneRegionFollower({x:sim.player.position.x,y:-sim.player.position.z,radius:180,lodRadius:1000,includeCollisionBounds:true});
                reject(new Error('Verdant Meadows could not be loaded in time.'));
              },TRANSFER_TIMEOUT_MS);
            });
          };
          follower=new SceneRegionFollower({x:included.spawn.x,y:-included.spawn.z,radius:180,lodRadius:1000,includeCollisionBounds:true});
          staticWorld=new StaticWorldProvider(`${import.meta.env.BASE_URL}play/world/`,data=>{
            if(!alive)return;
            if(data.type==='effects'){importedScene?.supplyEffects(data.effects);return;}
            if(data.type==='ready'){if(Array.isArray(data.pickups))pickups.setPickups(data.pickups);
              // The bundled start scene carries no 2d effects: fetch its models' lights from the archive.
              if(importedScene)staticWorld?.effects(importedScene.partNames());
              if(Array.isArray(data.tags)){tagManager=new NativeTagManager(data.tags);tagManager.load(progression.tags);}if(Array.isArray(data.setPieces))setPieces=new NativeSetPieces(data.setPieces);if(data.entryExits){const interiors=data.entryExits.archives.includes('gta_int.img');entryExits=new EntryExitManager(data.entryExits.rows,Math.random,area=>area===0||interiors);entryExits.applyScript(data.entryExits.script);}if(Array.isArray(data.savePoints))savePoints=data.savePoints;if(Array.isArray(data.radarBlips))navigation?.setScriptBlips(data.radarBlips);if(data.restartPoints)nativeRestart.load(data.restartPoints);
              // A save point outside the starting region needs its own terrain before the player can stand there.
              const saved=progression.savedLocation;
              // So does one inside an interior, wherever it is: the interior streams as its door would load it.
              const savedInside=!!saved?.area&&!!entryExits?.areaAvailable(saved.area);
              if(saved&&!savedTransfer&&!flightTransfer&&(savedInside||!saved.area&&Math.hypot(saved.x-sim.player.position.x,-saved.y-sim.player.position.z)>150)){
                savedTransfer=saved;sim.timeMinutes=saved.timeMinutes;if(saved.weekDay)sim.weekDay=saved.weekDay;fleet?.generateEvenIfClose();
                // As a door does: the outside stops following, so none of its windows lands after the interior.
                if(savedInside){follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;}
                staticWorld?.request(-1,savedInside?{x:saved.x,y:saved.y,radius:100,includeCollisionBounds:true,interior:saved.area}:{x:saved.x,y:saved.y,radius:180,lodRadius:1000,includeCollisionBounds:true});
              }

              // The bundled start scene has no distant ring: ask for the spawn's full window now rather than at the
              // first 54 m of travel, so the LOD world is up before the player drives off.
              // A save point inside it is restored in place: the clock, and where the player stood and faced.
              else{
                // An interior that cannot stream (no GTA_INT.IMG) keeps the saved clock and leaves the player at the start.
                if(saved&&!savedTransfer&&!flightTransfer)restoreSavedLocation(saved,!saved.area);
                if(follower&&!flightTransfer)follower.primeNext=true;
              }
              if(Array.isArray(data.stuntJumps)){
                stuntJumps=new StuntJumps(data.stuntJumps,{
                  // CTimer::SetTimeScale and TheCamera.TakeControl(vehicle, MODE_FIXED, JUMPCUT).
                  onStart:jump=>{stuntCamera=render.fixedCamera={position:new Vector3(jump.camera[0],jump.camera[2],-jump.camera[1]),target:()=>{const t=([...(fleet?.cars??[])].find(c=>c.occupied)?.car.body??(worldCar?.occupied?worldCar.car.body:undefined)??fleet?.occupiedBike?.body)?.translation()??sim.player.position;return new Vector3(t.x,t.y,t.z);}};},
                  onFound:()=>{mission?.runtime.game.stats.increment(144,1);},onDone:()=>{mission?.runtime.game.stats.increment(145,1);},
                  // RestoreWithJumpCut only hands back the camera the jump took, not a script's that came since.
                  onEnd:()=>{if(render.fixedCamera===stuntCamera)render.fixedCamera=undefined;stuntCamera=undefined;},
                  onReward:(_jump,reward,all)=>{
                    sim.money+=reward;sound.frontend(AE_FRONTEND.partMissionComplete);
                    // USJ_ALL goes to the help box; the bonus title shows for 5 s either way, the reward line beneath it.
                    if(all)hud.help(gxtHudText(gxtText('USJ_ALL','ALL UNIQUE STUNTS COMPLETED!')));
                    // AddBigMessageQ(USJ, 5000, STYLE_MIDDLE_SMALLER_HIGHER), then AddBigMessageWithNumber(REWARD, 6000,
                    // STYLE_WHITE_MIDDLE_SMALLER, reward). Without the script's messages, the middle message stands in.
                    const messages=mission?.runtime.game.messages;
                    if(messages){messages.addBigMessage2('USJ',5000,4,false,gameTimeMs);messages.addBigMessage2('REWARD',6000,5,true,gameTimeMs,undefined,[reward,-1,-1,-1,-1,-1]);}
                    else hud.bigMessage(gxtHudText(gxtText('USJ','UNIQUE STUNT BONUS!')),gxtHudText(insertNumbers(gxtText('REWARD','REWARD $~1~'),reward)),5000,6000,true);
                    progression.save();
                  },
                });
                for(const id of progression.stuntJumpsFound)stuntJumps.found.add(id);
                for(const id of progression.stuntJumpsDone)stuntJumps.done.add(id);
                progression.stuntJumpsFound=stuntJumps.found;progression.stuntJumpsDone=stuntJumps.done;
              }
              // The objects a script makes are drawn from the runtime's own records; the IDE associations say
              // which dff and txd each model id stands for.
              if(Array.isArray(data.ideRecords)&&!scriptObjectViews){
               scriptObjectViews=new ScriptObjectViews(render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,data.ideRecords,sim.world);
               scriptObjectViews.visibleArea=()=>render.lighting.area;
               // CObjectData's physics for a script object CPhysical moves, as an uprooted prop takes them.
               scriptObjectViews.physicsOf=model=>{const values=objectDefValues(model);if(!values)return undefined;const air=values.airResistance??.99;return {turnMass:values.turnMass,elasticity:values.elasticity??0,damping:air>.1&&air<1?-50*Math.log(air):0};};
               scriptObjectViews.animation=(block,name)=>pedestrians?.scriptAnimation(block,name)??Promise.resolve(undefined);
               const byId=new Map<number,import('./assets/ide').IdeAssociation>(),byName=new Map<string,import('./assets/ide').IdeAssociation>();
               const doors=new Set<string>();
               for(const record of data.ideRecords as import('./assets/ide').IdeAssociation[]){
                if(!byId.has(record.id))byId.set(record.id,record);
                const name=record.model.toLowerCase();if(!byName.has(name))byName.set(name,record);
                if((record.flags??0)&0x800)doors.add(name);
               }
               garageDoorModels=doors;
               scriptPickupModels={byId,byName};
              }
              worldGenerators=data.carGenerators;if(Array.isArray(data.occluders))occlusion.setOccluders(data.occluders);worldZones=data.worldZones;fleet?.setGenerators(worldGenerators);if(worldZones){fleet?.setZones(worldZones);if(police)police.zones=worldZones;}
              // CGame::Initialise starts MAIN.SCM once the world is there. The script runs a frame at a time
              // and stops at the first command this runtime has not ported, which its snapshot reports.
              if(worldZones&&data.script&&!mission){
               const zones=worldZones;
               void import('./simulation/ScmMission').then(({ScmMission})=>{
                mission=new ScmMission(new Uint8Array(data.script),zones,{
                  frontendAudioEvent:event=>sound.frontend(event),
                  retuneRadio:station=>{sound.nativeEngine?.retuneRadio(station);},
                  radioStationId:()=>sound.nativeEngine?.radioId??13,
                  defaultDecisionMaker:index=>pedestrians?.defaultDecisionMaker(index),
                  // CCamera::IsSphereVisible: the sphere against the camera's frustum.
                  isSphereVisible:(point,radius)=>{const c=render.camera;c.updateMatrixWorld();return new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse)).intersectsSphere(new Sphere(new Vector3(point.x,point.z,-point.y),Math.max(0,radius)));},
                 // TheCamera's one fade: DO_FADE shares it with the game logic, the entry exits and the restarts.
                 cameraFade,showFade:(direction,milliseconds)=>hud.fade(direction===0,milliseconds),
                 startExtraColour:(colour,fade)=>localLighting.startExtraColour(colour,fade),stopExtraColour:fade=>localLighting.stopExtraColour(fade),
                 // The browser has already placed the player by the time the script runs, from its own start,
                 // a restart point or a save, so the script's creation point is recorded rather than applied.
                 playerCreatedAt:()=>{},
                 // The browser places the player itself — from its own start, a restart point or a save — and
                 // his facing is part of that placement, so the heading the script sets him is recorded and
                 // not applied. Turning him from the script would fight the placement rather than add to it:
                 // the opening's own call is the new game's facing, and honouring it moved the spawn.
                 // CPed::SetHeading on foot: m_fCurrentRotation and m_fAimingRotation both, so he stays facing it.
                 // CPlaceable::SetHeading's SetRotateZOnly drops SET_CHAR_ROTATION's tilt.
                 setPlayerHeading:degrees=>{sim.player.heading=scriptYaw(degrees);sim.player.tilt=undefined;},
                 // SetOrientation turns the matrix only; the browser keeps one heading, which the matrix's is drawn from.
                 setPlayerRotation:(x,y,z)=>{sim.player.heading=scriptYaw(z);sim.player.tilt=scriptTilt(x,y);},
                 // CCamera::SetCameraDirectlyBehindForFollowPed_CamOnAString.
                 setCameraBehindPlayer:()=>{render.camDirectlyBehind=sim.player.heading;},
                 loadScene:()=>{},
                 setLaRiots:active=>{laRiots=active;},
                 // CPopulation::AddPed through the street population the browser already runs. The script's
                 // coordinates are native and the browser's are the renderer's; its heading is degrees clockwise
                 // from north, held here as the yaw the player controller uses.
                 // CPopulation::ChooseCivilianOccupationForVehicle picks the model a car's own driver would
                 // have had, which is the one the browser's occupant renderer already assigns that car.
                 spawnScriptRandomPedInCar:async(car,seat)=>{
                  const target=car as ScriptCar|undefined;
                  if(!target||target.disposed)return undefined;
                  const rider:ScriptRider={rider:true,model:occupants.driverModel(target),car:target,seat,
                   health:100,heading:target.heading(),accuracy:60,invulnerable:false,gone:false};
                  scriptRiders.add(rider);
                  return rider;
                 },
                 spawnScriptPedOnCar:async(_pedType,id,car,offset,turret)=>{
                  const model=await pedestrians?.scriptPedModel(id)??id;
                  const target=car as ScriptCar|undefined;
                  if(!target||target.disposed)return undefined;
                  // AUTHORED (CPed::PositionAttachedPed is unreversed): a ped the game attaches itself stands in its idle,
                  // facing the turret position (0 ahead, 1 left, 2 behind, 3 right) a quarter turn at a time.
                  const rider:ScriptRider={rider:true,model,car:target,seat:0,offset:{...offset},health:100,
                   heading:target.heading(),accuracy:60,invulnerable:false,gone:false,...(turret!==undefined?{stand:true,facing:turret*Math.PI/2}:{})};
                  scriptRiders.add(rider);
                  return rider;
                 },
                 spawnScriptPedInCar:async(_pedType,id,car,seat)=>{
                  const model=await pedestrians?.scriptPedModel(id)??id;
                  const target=car as ScriptCar|undefined;
                  if(!target||target.disposed)return undefined;
                  const rider:ScriptRider={rider:true,model,car:target,seat,health:100,heading:target.heading(),
                   accuracy:60,invulnerable:false,gone:false};
                  scriptRiders.add(rider);
                  return rider;
                 },
                 spawnScriptPed:async(_pedType,id,position)=>{
                  // CWorld::PutToGroundIfTooLow: a z at or below the map's low limit is the ground there, or
                  // FindGroundZForCoord's 20 where none is streamed in; the ped is then set down when it arrives.
                  const low=position.z<=-100;let y=position.z;
                  if(low){const hit=sim.world.castRay(new RAPIER.Ray({x:position.x,y:1000,z:-position.y},{x:0,y:-1,z:0}),2000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);y=hit?1000-hit.timeOfImpact:20;}
                  return await pedestrians?.spawnScripted(await pedestrians.scriptPedModel(id),{x:position.x,y,z:-position.y},scriptYaw(0),low)??undefined;
                 },
                 // A ped riding in a car goes where the car goes, so nothing a script says about where it
                 // stands, how it walks or what it looks at reaches it; onFoot answers nothing for one, and
                 // each of those falls away rather than being applied to a ped that is not there.
                 placeScriptPed:(ped,position)=>{
                  const target=onFoot(ped);if(!target)return;
                  const place={x:position.x,y:position.z,z:-position.y};
                  target.actor.player.position={...place};target.actor.player.previous={...place};
                  target.body.setTranslation({x:place.x,y:place.y+.9,z:place.z},true);
                 },
                 setScriptPedHeading:(ped,degrees)=>{const p=onFoot(ped);if(p){p.actor.player.heading=scriptYaw(degrees);p.actor.player.tilt=undefined;}else{const r=asRider(ped);if(r)r.heading=scriptYaw(degrees);}},
                 setScriptPedRotation:(ped,x,y,z)=>{const p=onFoot(ped);if(p){p.actor.player.heading=scriptYaw(z);p.actor.player.tilt=scriptTilt(x,y);}},
                 scriptPedPosition:ped=>{const r=asRider(ped);if(r){const q=r.car.car.body.translation();return {x:q.x,y:-q.z,z:q.y};}const q=onFoot(ped)!.actor.player.position;return {x:q.x,y:-q.z,z:q.y+PED_ORIGIN_HEIGHT};},
                 scriptPedHeading:ped=>{const r=asRider(ped);const yaw=r?r.car.heading():onFoot(ped)!.actor.player.heading;const degrees=(yaw-Math.PI)*180/Math.PI;return ((degrees%360)+360)%360;},
                 scriptPedHealth:ped=>asRider(ped)?.health??onFoot(ped)?.health??0,
                 setScriptPedHealth:(ped,health)=>{const r=asRider(ped);if(r)r.health=health;else{const p=onFoot(ped);if(p)p.health=health;}},
                 killScriptPed:ped=>{const r=asRider(ped);if(r){r.health=0;r.gone=true;scriptRiders.delete(r);}else{const p=onFoot(ped);if(p)p.health=0;}},
                 setScriptPedAccuracy:(ped,accuracy)=>{const r=asRider(ped);if(r)r.accuracy=accuracy;else{const p=onFoot(ped);if(p)p.gunAccuracy=accuracy;}},
                 setScriptPedShootingRate:(ped,rate)=>{const p=onFoot(ped);if(p)p.shootingRate=rate;},
                 setScriptPedInvulnerable:(ped,enabled)=>{const r=asRider(ped);if(r)r.invulnerable=enabled;else{const p=onFoot(ped);if(p)p.onlyDamagedByPlayer=enabled;}},
                 setScriptPedProofs:(ped,proofs)=>{const p=onFoot(ped);if(p)p.proofs={...proofs};},
                 scriptPedAlive:ped=>{const r=asRider(ped);if(r)return !r.gone&&!r.car.disposed;return !!pedestrians?.holdsScripted(ped as Pedestrian);},
                 removeScriptPed:ped=>{const r=asRider(ped);if(r){r.gone=true;scriptRiders.delete(r);return;}pedestrians?.removeScripted(ped as Pedestrian);},
                 releaseScriptPed:(ped,keepTask)=>{const p=onFoot(ped);if(p)pedestrians?.releaseScripted(p,keepTask);},
                 // Native axes, units a second: the car's own when the ped rides, its last step's travel on foot.
                 scriptPedVelocity:ped=>{const r=asRider(ped),v=r?r.car.car.body.linvel():(()=>{const p=onFoot(ped);return p&&pedestrians?pedestrians.velocityOf(p):{x:0,y:0,z:0};})();return {x:v.x,y:-v.z,z:v.y};},
                 scriptPedSpeed:ped=>{const r=asRider(ped);if(r){const v=r.car.car.body.linvel();return Math.hypot(v.x,v.y,v.z);}return onFoot(ped)?.actor.player.speed??0;},
                 scriptPedStanding:ped=>{const p=onFoot(ped);return p?!!pedestrians?.standingStill(p):false;},
                 scriptPedSubmerged:ped=>{const p=onFoot(ped);return p?!!pedestrians?.submerged(p):false;},
                 scriptPedOnScreen:ped=>{const r=asRider(ped);const at=r?r.car.car.body.translation():onFoot(ped)?.actor.player.position;return !!at&&!populationOutsideView(render.camera,at,2);},
                 setScriptPedVisible:(ped,visible)=>{const p=onFoot(ped);if(p)p.hidden=!visible;},
                 giveScriptPedOrder:(ped,order)=>{const p=onFoot(ped);if(p)pedestrians?.giveOrder(p,order);},
                 giveScriptPedSequence:(ped,orders,repeat,start)=>{const p=onFoot(ped);if(p)pedestrians?.giveSequence(p,orders,repeat,true,start);},
                 clearScriptPedTasks:ped=>{const p=onFoot(ped);if(p)pedestrians?.clearTasks(p);},
                 // A ped in a car holds no on-foot order the browser tracks, so its record is left as it is.
                 // A ped riding in a car runs none of the tasks the browser carries out on foot.
                 // A ped riding in a car holds a task only while it drives the car on a CCarAI mission.
                 scriptPedHasOrder:ped=>{const p=onFoot(ped);if(p)return pedestrians?.hasScriptTask(p)??false;const r=asRider(ped);return !!r&&r.seat==='driver'&&(scriptCars.driving(r.car)||scriptCars.inTempAction(r.car));},
                 // CWorld::ClearExcitingStuffFromArea: the deletable peds and cars in the radius go, and the
                 // fires in it are put out, which is CFireManager::ExtinguishPoint and the car-fire pass.
                 // CPlayerInfo::m_nPlayerState: KillPlayer and ArrestPlayer set it with the game logic's WASTED and
                 // BUSTED, and ResetForResurrectionAndFadeOut puts both back to playing.
                 playerState:()=>gameLogic.state===GAMELOGIC_STATE_WASTED?'dead':gameLogic.state===GAMELOGIC_STATE_BUSTED?'arrested':'playing',
                 // Native axes, as the fire pool keeps them.
                 extinguishFiresAtPoint:(point,radius)=>weapons.fires.extinguishPoint({x:point.x,y:point.y,z:point.z},radius),
                 clearArea:(point,radius)=>{
                  const at={x:point.x,y:point.z,z:-point.y};
                  pedestrians?.clearPedsInArea({x:at.x,z:at.z},radius);
                  fleet?.clearCarsInArea({x:at.x,z:at.z},radius);
                  // CFireManager::ExtinguishPoint works in the fire pool's native axes (the script's own point).
                  weapons.fires.extinguishPoint({x:point.x,y:point.y,z:point.z},radius);
                  // CWorld::ExtinguishAllCarFiresInArea: CVehicle::ExtinguishCarFire lifts every car but a wreck within the
                  // sphere to 300 health, burning or not.
                  for(const car of fleet?.cars??[])if(!car.wrecked){
                   const p=car.car.body.translation();
                   if(Math.hypot(p.x-at.x,p.y-at.y,p.z-at.z)<=radius&&car.health<=CAR_EXTINGUISHED_HEALTH)car.health=CAR_EXTINGUISHED_HEALTH;
                  }
                 },
                 giveScriptPedWeapon:(ped,weaponType,ammo)=>{const p=onFoot(ped);if(p)pedestrians?.giveWeapon(p,weaponType,ammo);},
                 // CPed::ClearWeapon/ClearWeapons: the goggles come off with their weapon (RemoveGogglesModel).
                 clearPedWeapon:(ped,weaponType)=>{
                  if(ped!==undefined){const p=onFoot(ped);if(p)pedestrians?.clearWeapon(p,weaponType);return;}
                  const before=weapons.inventory.selected;if(!weapons.inventory.clearWeapon(weaponType))return;
                  if((weaponType===44||weaponType===45)&&weapons.vision){weapons.vision=null;weapons.goggles=undefined;}
                  if(weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);},
                 clearPedWeapons:ped=>{
                  if(ped!==undefined){const p=onFoot(ped);const held=p?.weapon?.info.type??p?.weaponType;if(p&&held!==undefined)pedestrians?.clearWeapon(p,held);return;}
                  weapons.inventory.strip();weapons.vision=null;weapons.goggles=undefined;void weaponView.equip(0);
                  if(STARTING_LOADOUT&&mission?.runtime.currentThread?.name===OPENING_MISSION)grantStartingLoadout(weapons.inventory,sim.player,mission.runtime.game.playerInfo.maxArmour);},
                 scriptPedWeapon:ped=>{
                  const held=onFoot(ped);
                  return held?.weaponType===undefined?undefined:{type:held.weaponType,ammo:held.totalAmmo??0};
                 },
                 setScriptPedAmmo:(ped,ammo)=>{const p=onFoot(ped);if(p)p.totalAmmo=ammo;},
                 setScriptPedFrozen:(ped,frozen)=>{const p=onFoot(ped);if(p)p.frozen=frozen;},
                 scriptPedWaitForCollision:ped=>{const p=onFoot(ped);if(p)pedestrians?.waitForCollision(p);},
                 scriptPedWaitingForCollision:ped=>!!onFoot(ped)?.collisionWait,
                 // A ped without collision leaves the query pipeline: nothing touches it and no line of sight meets
                 // it. Its own movement query still finds the ground.
                 setScriptPedCollision:(ped,uses)=>{onFoot(ped)?.collider.setEnabled(uses);},
                 givePlayerOrders:(orders,repeat,sequence,start)=>{playerTasks.giveSequence(orders,repeat,playerTaskBody(),sequence,start);},
                 playerSequenceProgress:()=>playerTasks.progress,
                 scriptPedSequenceProgress:ped=>{const p=onFoot(ped);return p&&pedestrians?pedestrians.sequenceProgress(p):-1;},
                 clearPlayerTasks:()=>{playerTasks.clear(playerTaskBody());},
                 playerHasScriptTask:()=>playerTasks.active,
                 setPlayerCollision:uses=>{sim.setPlayerUsesCollision(uses);},
                 scriptPedInAir:ped=>!!onFoot(ped)?.air,
                 scriptPedArea:ped=>onFoot(ped)?.areaCode??0,
                 setScriptPedSkill:(ped,skill)=>{const p=onFoot(ped);if(p)pedestrians?.setWeaponSkill(p,skill);},
                 setScriptPedUsedEntryExit:ped=>{const p=onFoot(ped);if(p)p.usedEntryExit=true;},
                 setScriptVehicleAutopilot:(car,field,value)=>{((car as ScriptCar).autopilotFields??={})[field]=value;},
                 // CWorld::ProcessLineOfSight against the world's own fixed collision; with `flags`, CWorld::GetIsLineOfSightClear
                 // over the entity kinds they name: buildings (the fixed world), vehicles, peds (the player's included) and
                 // objects (any other body). Dummies are not bodies here.
                 lineOfSightClear:(from,to,flags)=>{
                  const a={x:from.x,y:from.z,z:-from.y},b={x:to.x,y:to.z,z:-to.y};
                  const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},length=Math.hypot(d.x,d.y,d.z);
                  if(length<=0)return true;
                  const ray=new RAPIER.Ray(a,{x:d.x/length,y:d.y/length,z:d.z/length});
                  if(!flags)return !sim.world.castRay(ray,length,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
                  const vehicleBodies=new Set<number>();
                  for(const set of [fleet?.cars,fleet?.bikes,fleet?.boats,fleet?.planes,fleet?.trains])for(const v of set??[])vehicleBodies.add((v as {car?:{body:{handle:number}};body?:{handle:number}}).car?.body.handle??(v as {body:{handle:number}}).body.handle);
                  const blocks=(c:import('@dimforge/rapier3d-compat').Collider)=>{
                   const body=c.parent();
                   if(!body||body.isFixed())return flags.buildings;
                   if(vehicleBodies.has(body.handle))return flags.vehicles;
                   if(c.handle===sim.playerCollider.handle||pedestrians?.pedPosition(c.handle))return flags.peds;
                   return flags.objects;
                  };
                  return !sim.world.castRay(ray,length,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,blocks);
                 },
                 // FindObjectsIntersectingCube tests each entity's bounding sphere against the box; the collider
                 // bounds stand in for it. The handles are gathered first and sorted into the lists after the query.
                 pickupsInBubble:(p,radius)=>pickups.anyInBubble(p,radius),
                 // TestSphereAgainstWorld with only the vehicles list: gathered first, sorted after the query.
                 vehicleInSphere:(p,radius)=>{
                  const found:number[]=[];
                  sim.world.intersectionsWithShape({x:p.x,y:p.z,z:-p.y},{x:0,y:0,z:0,w:1},new RAPIER.Ball(radius),c=>{found.push(c.handle);return true;},RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
                  if(!found.length)return false;
                  const vehicleBodies=new Set<number>();
                  for(const set of [fleet?.cars,fleet?.bikes,fleet?.boats,fleet?.planes,fleet?.trains])for(const v of set??[])vehicleBodies.add((v as {car?:{body:{handle:number}};body?:{handle:number}}).car?.body.handle??(v as {body:{handle:number}}).body.handle);
                  return found.some(h=>{const body=sim.world.getCollider(h)?.parent();return !!body&&vehicleBodies.has(body.handle);});
                 },
                 // The vehicle pool: the fleet's cars, bikes, boats and aircraft, by their positions in native axes.
                 vehicleOfModelsInBox:(models,min,max)=>{
                  for(const set of [fleet?.cars,fleet?.bikes,fleet?.boats,fleet?.planes])for(const v of set??[]){
                   if(v.disposed||!models.has(v.modelId))continue;
                   const t=('car' in v&&v.car?v.car.body:(v as {body:import('@dimforge/rapier3d-compat').RigidBody}).body).translation(),x=t.x,y=-t.z,z=t.y;
                   if(x>=min.x&&x<=max.x&&y>=min.y&&y<=max.y&&z>=min.z&&z<=max.z)return true;
                  }
                  return false;
                 },
                 areaOccupied:(min,max,kinds)=>{
                  const found:import('@dimforge/rapier3d-compat').Collider[]=[];
                  sim.world.collidersWithAabbIntersectingAabb({x:(min.x+max.x)/2,y:(min.z+max.z)/2,z:-(min.y+max.y)/2},{x:(max.x-min.x)/2,y:(max.z-min.z)/2,z:(max.y-min.y)/2},c=>{found.push(c);return true;});
                  if(!found.length)return false;
                  const vehicleBodies=new Set<number>();
                  for(const set of [fleet?.cars,fleet?.bikes,fleet?.boats,fleet?.planes,fleet?.trains])for(const v of set??[])vehicleBodies.add((v as {car?:{body:{handle:number}};body?:{handle:number}}).car?.body.handle??(v as {body:{handle:number}}).body.handle);
                  return found.some(c=>{
                   if(c.isSensor())return false;
                   if(scriptObjectViews?.objectForCollider(c.handle)!==undefined)return kinds.objects;
                   const body=c.parent();
                   if(body&&vehicleBodies.has(body.handle))return kinds.vehicles;
                   if(c.handle===sim.playerCollider.handle||pedestrians?.pedPosition(c.handle))return kinds.peds;
                   const kind=importedScene?.sources.get(c.handle)?.entityKind;
                   if(kind==='dummy')return kinds.dummies;
                   if(kind==='object')return kinds.objects;
                   return body?.isFixed()!==false?kinds.buildings:kinds.objects;
                  });
                 },
                 nearestEntryExit:(x,y,radius)=>entryExits?.findNearest(x,y,radius)?.index,
                 // The one event a browser ped answers, and whether it is still answering it.
                 scriptPedRespondingTo:(ped,event)=>{
                  const p=onFoot(ped);
                  if(!p||p.event?.type!==event)return false;
                  return p.retaliate>0||p.flee>0||!!p.gunReact;
                 },
                 randomVehicleInMemory:()=>{
                  const model=fleet?.trafficModel();
                  if(model===undefined)return undefined;
                  const vehicleClass=fleet?.vehicleClass(model);
                  // CStreaming answers with the class the model belongs to; an unclassed model has none to give.
                  return vehicleClass===undefined?undefined:{model,vehicleClass:Number(vehicleClass)||0};
                 },
                 // A browser ped carries one weapon; WEAPON.DAT's own kind says whether it is a melee one.
                 scriptPedActiveWeapon:ped=>{
                  const type=onFoot(ped)?.weaponType??0;
                  return {type,melee:weaponById(type)?.kind==='melee'};
                 },
                 scriptPedShooting:ped=>!!onFoot(ped)?.gunState?.active,
                 warpScriptPedToCoord:(ped,position)=>{const p=onFoot(ped);if(p)pedestrians?.warpToCoord(p,{x:position.x,y:position.z,z:-position.y});},
                 scriptPedIsPlayingAnim:(ped,animation)=>{const p=onFoot(ped);return !!p&&!!pedestrians?.isPlayingAnim(p,animation);},
                 setScriptPedArea:(ped,area)=>{const p=onFoot(ped);if(p)p.areaCode=area;},
                 setScriptPedRelationship:(ped,relationship,pedType)=>{const p=onFoot(ped);if(p)pedestrians?.setRelationship(p,relationship,pedType);},
                 clearScriptPedRelationship:(ped,relationship,pedType)=>{const p=onFoot(ped);if(p)pedestrians?.clearRelationship(p,relationship,pedType);},
                 // CLEAR_ALL_CHAR_RELATIONSHIPS empties one acquaintance, which is the list it names.
                 clearScriptPedRelationships:(ped,relationship)=>{const p=onFoot(ped);if(p&&pedestrians)pedestrians.acquaintanceOf(p).clear(relationship);},
                 setScriptPedFlag:(ped,flag,value)=>{const p=onFoot(ped);if(p)pedestrians?.setFlag(p,flag,value);},
                 setScriptPickupMoneyPerDay:(handle,money)=>{pickups.patchGenerated(`script:${handle}`,{revenueRate:money});},
                 // bNoCriticalHits is the command's own value inverted.
                 setScriptPedCriticalHits:(ped,suffers)=>{const p=onFoot(ped);if(p)p.noCriticalHits=!suffers;},
                 playerAnimTotalTime:animation=>{const view=render.nativeCharacter;return view&&(view.reactionName??'').toLowerCase()===animation.toLowerCase()?(view.reactionDuration(view.reactionName!)??0)*1000:undefined;},
                 scriptPedAnimTotalTime:(ped,animation)=>{const p=onFoot(ped);return p?pedestrians?.animTotalTime(p,animation):undefined;},
                 playerDucking:()=>!!sim.player.crouched,
                 scriptPedDucking:ped=>!!onFoot(ped)?.actor.player.crouched,
                 playerClimbing:()=>!!sim.climb,
                 playerPressingHorn:()=>!!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike)&&(input.down('CapsLock')||input.down('KeyH')),
                 populationZoneType:()=>fleet?.pedZone()?.zoneType??0,
                 setWorldWeekDay:day=>{sim.weekDay=day;},
                 preloadAnimationBlock:block=>{void pedestrians?.scriptAnimation(block,'');},
                 // CAutomobile::SetTaxiLight (0x6A3740) on a script's car, or (none named) the one the player drives.
                 setTaxiLight:(car,on)=>{const c=(car!==undefined?car:worldCar?.occupied?worldCar:fleet?.occupied) as {taxiLight?:boolean}|undefined;if(c&&'taxiLight' in c)c.taxiLight=on;},
                 scriptObjectBlockedAt:(handle,from,to)=>{
                  const body=scriptObjectViews?.bodyOf(handle);if(!body)return false;
                  const offset={x:to.x-from.x,y:to.z-from.z,z:-(to.y-from.y)};
                  for(let i=0;i<body.numColliders();i++){
                   const c=body.collider(i);if(!c.isEnabled())continue;const t=c.translation();
                   if(sim.world.intersectionWithShape({x:t.x+offset.x,y:t.y+offset.y,z:t.z+offset.z},c.rotation(),c.shape,RAPIER.QueryFilterFlags.EXCLUDE_FIXED,undefined,undefined,body))return true;
                  }
                  return false;
                 },
                 setPlayerCarryPose:clip=>{
                  const view=render.nativeCharacter,generation=++carryPoseGeneration;if(!view)return;
                  if(!clip){view.setCarryPose(undefined);return;}
                  const name=clip.toLowerCase();if(view.hasReaction(name)){view.setCarryPose(name);return;}
                  void pedestrians?.scriptAnimation('CARRY',clip).then(animation=>{if(!animation||generation!==carryPoseGeneration||render.nativeCharacter!==view)return;view.installReactions({[name]:animation});view.setCarryPose(name);});
                 },
                 anyPedNear:(at,radius,except,exceptPlayer)=>{
                  const me=sim.player.position;if(!exceptPlayer&&Math.hypot(me.x-at.x,-me.z-at.y,me.y-at.z)<radius)return true;
                  return !!pedestrians?.anyNear(at,radius,except?onFoot(except):undefined);
                 },
                 scriptPedAnimProgress:(ped,animation)=>{const p=onFoot(ped);return p?pedestrians?.animProgress(p,animation):undefined;},
                 setScriptPedAnim:(ped,animation,change)=>{if(ped===undefined){if(render.nativeCharacter)setCharacterAnim(render.nativeCharacter,animation,change);return;}const p=onFoot(ped);if(p)pedestrians?.setAnim(p,animation,change);},
                 playerAnimProgress:animation=>{const view=render.nativeCharacter;return view&&(view.reactionName??'').toLowerCase()===animation.toLowerCase()?view.reactionProgress:undefined;},
                 setScriptPedSpeech:(ped,shutUp)=>{const p=onFoot(ped);if(p)p.shutUp=shutUp;},
                 setScriptPedFacialTalk:(ped,seconds)=>{const p=onFoot(ped);if(p)p.facialTalk=seconds;},
                 hideScriptPedWeapon:(ped,hidden)=>{const p=onFoot(ped);if(p)pedestrians?.hideWeapon(p,hidden);},
                 // CExplosion::AddExplosion, which the weapon system already runs for its own blasts.
                 addExplosion:(position,type,options)=>{weapons.debugExplosion({x:position.x,y:position.z,z:-position.y},type,options?.sound??true);},
                 // vehicleFlags.bTyresDontBurst inverted: a shot wheel keeps its air.
                 setScriptVehicleCanBurstTyres:(car,canBurst)=>{(car as ScriptCar).tyresDontBurst=!canBurst;},
                 setScriptVehicleHeavy:(car,heavy)=>{(car as {heavy?:boolean}).heavy=heavy;},
                 // physicalFlags.bInvulnerable on a car: a shot from anyone but the player leaves it alone.
                 setScriptVehicleOnlyDamagedByPlayer:(car,enabled)=>{(car as ScriptCar).onlyDamagedByPlayer=enabled;},
                 projectilesInBox:(min,max,destroy)=>weapons.projectilesInBox(min,max,destroy),
                 setScriptVehicleHeatSeekTargetable:(car,targetable)=>{(car as {hsTargetable?:boolean}).hsTargetable=targetable;},
                 recolourScriptVehicle:(car,primary,secondary)=>{if(isScriptCar(car))fleet?.recolourCar(car,primary,secondary);},
                 // The depot carries no speech banks, so no ped speaks and there is nothing to silence; the
                 // gate is held so a script that closes and opens it carries on.
                 setAllPedSpeechDisabled:disabled=>{allPedSpeechDisabled=disabled;},
                 scriptPedLastDamagedBy:ped=>onFoot(ped)?.lastDamagedBy,
                 scriptPedLastWeaponDamage:ped=>onFoot(ped)?.lastWeaponDamage??-1,
                 clearScriptPedLastWeaponDamage:ped=>{const p=onFoot(ped);if(p)p.lastWeaponDamage=-1;},
                 clearScriptPedLastDamagedBy:ped=>{const p=onFoot(ped);if(p)p.lastDamagedBy=undefined;},
                 playerLastWeaponDamage:()=>sim.lastWeaponDamage,
                 clearPlayerLastWeaponDamage:()=>{sim.lastWeaponDamage=-1;},
                 // CUpsideDownCarCheck::IsCarUpsideDown; a vehicle without the car's wheel contacts is judged by its up alone.
                 scriptVehicleUpsideDownForCheck:car=>{if(isScriptCar(car))return car.upsideDownForCheck();const q=(car as {car:{body:import('@dimforge/rapier3d-compat').RigidBody}}).car.body.rotation();return 1-2*(q.x*q.x+q.z*q.z)<0;},
                 scriptVehicleRouteNodes:car=>isScriptDrivable(car)?scriptCars.routeNodes(car):undefined,
                 scriptVehicleMaximumPassengers:car=>(car as ScriptCar).maximumPassengers,
                 burstScriptVehicleTyre:(car,wheel)=>{if(isScriptCar(car))car.burstTyre(wheel,true);},
                 scriptCarComponents:car=>isScriptCar(car)?car:undefined,
                 scriptVehicleColours:car=>{const indices=(car as {assets?:{colourIndices?:readonly number[]}}).assets?.colourIndices;return {primary:indices?.[0]??0,secondary:indices?.[1]??0,tertiary:indices?.[2]??0,quaternary:indices?.[3]??0};},
                 claimScriptVehicle:car=>{(car as {missionCar?:boolean}).missionCar=true;},
                 vehicleModelType:model=>fleet?fleet.vehicleIdeType(model):null,
                 scriptVehicleWaitingForCollision:car=>isScriptCar(car)&&car.waitingForCollision,
                 // CTheScripts::bDrawCrossHair is one setting: the circle and the photo effect each clear the other.
                 setForceCrosshair:state=>{weapons.forceCrosshair=state;weapons.photoCameraEffect=false;},
                 setPhotoCameraEffect:on=>{weapons.photoCameraEffect=on;weapons.forceCrosshair=false;},
                 scriptVehicleIsDead:car=>{const v=car as {wrecked?:boolean;drowning?:boolean;disposed?:boolean};return v.disposed===true||v.wrecked===true||v.drowning===true;},
                 pedEnteringCar:ped=>ped===undefined?carEntry.active||bikeMount.active:onFoot(ped)?.order?.kind==='enterCar',
                 vehicleModelClass:model=>fleet?.vehicleClass(model),
                 sortOutScriptObjectCollisionWithCar:(object,car)=>{
                  if(!isScriptCar(car))return false;
                  const body=scriptObjectViews?.bodyOf(object);if(!body?.isValid())return undefined;
                  dropSortedOut(object);
                  const colliders:number[]=[];for(let i=0;i<body.numColliders();i++){const c=body.collider(i);c.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);colliders.push(c.handle);}
                  // Keyed on the bodies the car's colliders report as their parents, which the filter is handed.
                  const parents=new Set<number>([car.car.body.handle]);for(let i=0;i<car.car.body.numColliders();i++){const p=car.car.body.collider(i).parent();if(p)parents.add(p.handle);}
                  const pairs=[...parents].map(p=>pairKey(body.handle,p));for(const pair of pairs)sim.ignoredBodyPairs.add(pair);
                  sortedOutCollisions.set(object,{car,pairs,colliders});return true;
                 },
                 vehicleModelBounds:model=>fleet?fleet.modelBounds(model):undefined,
                 objectModelBounds:model=>scriptObjectViews?scriptObjectViews.modelBounds(model):undefined,
                 scriptVehicleDrownsOccupants:car=>isScriptCar(car)&&car.drowning&&!car.waterTight,
                 setScriptVehicleWatertight:(car,state)=>{(car as {waterTight?:boolean}).waterTight=state;},
                 scriptVehicleVisiblyDamaged:car=>isScriptCar(car)&&car.visiblyDamaged,
                 applyScriptVehicleForce:(car,force,offset)=>{if(!isScriptCar(car))return false;car.applyScriptForce(force,offset);return true;},
                 setScriptVehicleAirResistance:(car,multiplier)=>{if(!isScriptCar(car))return false;car.setAirResistanceMultiplier(multiplier);return true;},
                 setScriptPedListensToGroupCommands:(ped,listens)=>{const p=onFoot(ped);if(p)p.ignoresGroupCommands=!listens;},
                 playScriptRiderClip:(ped,o)=>{
                  const rider=asRider(ped);if(!rider)return;
                  const clip:NonNullable<ScriptRider['clip']>={name:o.name.toLowerCase(),started:gameTimeMs,loop:o.loop,hold:o.hold,seconds:o.seconds};rider.clip=clip;
                  void (pedestrians?.loadScriptAnimation(o.file,o.name)??Promise.resolve(undefined)).then(animation=>{if(rider.clip!==clip)return;if(!animation){clip.failed=true;return;}clip.animation=animation;clip.started=gameTimeMs;},()=>{clip.failed=true;});
                 },
                 scriptRiderClipDone:ped=>{
                  const rider=asRider(ped),clip=rider?.clip;if(!rider||!clip||clip.failed){if(rider)rider.clip=undefined;return true;}
                  if(!clip.animation)return false;
                  const elapsed=(gameTimeMs-clip.started)/1000,over=elapsed>=clip.seconds||!clip.loop&&elapsed>=clip.animation.duration;
                  if(over&&!clip.hold)rider.clip=undefined;
                  return over;
                 },
                 clearScriptRiderClip:ped=>{const rider=asRider(ped);if(rider)rider.clip=undefined;},
                 setPedFightingStyle:(ped,style,moves)=>{
                  if(ped===undefined){
                   weapons.inventory.fightingStyle=style;weapons.inventory.allowedAttackMoves=moves;progression.save();
                   // Fists and brass knuckles swing the style's own clips from here, so they are taken up again.
                   if(weapons.inventory.selected===0||weapons.inventory.selected===1)void weaponView.equip(weapons.inventory.selected);
                   return;
                  }
                  const p=onFoot(ped);if(p)pedestrians?.setFightingStyle(p,style,moves);
                 },
                 setDarknessFilter:(enable,alpha)=>{postEffects.scriptDarknessFilterSwitch(enable,alpha);},
                 setHeatHazeFX:enable=>{postEffects.heatHazeFX=enable;},
                 setScriptPedFollowsPlayer:(ped,follows)=>{const p=onFoot(ped);if(p&&p.follow!==follows){p.follow=follows;if(!follows)p.foe=undefined;}},
                 setEntryExitGroupWarping:(x,y,radius,on)=>{entryExits?.setAcceptNpcGroupNear(x,y,radius,on);},
                 // TASK_DRIVE_BY on a rider: the target is a point (script coordinates), a ped or a car handle.
                 setScriptPedDriveBy:(ped,target,radius,fireRate,rightSide)=>{
                  const rider=asRider(ped);if(!rider)return false;
                  const t=target.kind==='point'?{kind:'point' as const,x:target.x,y:target.z,z:-target.y}:target;
                  rider.driveBy=newScriptDriveBy(t,radius,fireRate,rightSide);return true;
                 },
                 clearScriptPedDriveBy:ped=>{const rider=asRider(ped);if(rider)rider.driveBy=undefined;},
                 scriptObjectBaseOffset:handle=>scriptObjectViews?.baseOffset(handle)??0,
                 // The bone's world matrix: its columns are the bone's own axes, turned back from the renderer's
                 // (x, z, -y) into native rows.
                 scriptPedBoneMatrix:(ped,tag)=>{
                  const view=ped==='player'?render.nativeCharacter:(ped as {view?:import('./render/NativeCharacter').NativeCharacter}).view;
                  const m=view?.boneMatrix(tag,boneScratch);if(!m)return undefined;
                  const e=m.elements,n=(x:number,y:number,z:number)=>({x,y:-z,z:y}),unit=(v:{x:number;y:number;z:number})=>{const l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
                  return {position:n(e[12],e[13],e[14]),right:unit(n(e[0],e[1],e[2])),forward:unit(n(e[4],e[5],e[6])),up:unit(n(e[8],e[9],e[10]))};
                 },
                 // m_vecTurnSpeed is radians a frame; the script's are a second, so they are the body's own rate here
                 // (native x, y, z to the renderer's x, z, -y).
                 setScriptVehicleTurnSpeed:(car,speed,add)=>{
                  const body=(car as {car?:{body?:import('@dimforge/rapier3d-compat').RigidBody}}).car?.body;if(!body||!body.isDynamic())return;
                  const w=add?body.angvel():{x:0,y:0,z:0};body.setAngvel({x:w.x+speed.x,y:w.y+speed.z,z:w.z-speed.y},true);
                 },
                 explosionInArea:(type,min,max)=>weapons.explosionSlots.inArea(type,min,max),
                 scriptVehicleBaseOffset:car=>-(car as ScriptCar).assets.collision.bounds.min[2],
                 clearSpaceForScriptVehicle:car=>{const c=car as ScriptCar,t=c.car.body.translation(),r=c.car.body.rotation();fleet?.clearSpaceFor({x:t.x,y:t.y,z:t.z},2*Math.atan2(r.y,r.w),c.assets.collision.bounds);},
                 rejoinScriptVehicleRoads:car=>{if(isScriptDrivable(car))scriptCars.rejoinRoads(car);},
                 createScriptUser3dMarker:(x,y,z,colour)=>markers3d.userMarkerSet(x,y,z,HUD_COLOURS[colour]??[0,0,0]),
                 removeScriptUser3dMarker:index=>{markers3d.userMarkerDelete(index);},
                 playerSwimming:()=>sim.player.swimming,
                 // The world's peds do not swim: in deep water they drown.
                 scriptPedSwimming:()=>false,
                 gangWarFightingGoingOn:()=>!!gangWars?.gangWarFightingGoingOn(),
                 gangWarGoingOn:()=>!!gangWars?.gangWarGoingOn(),
                 setUpScriptSkip:(position,heading,afterMission,vehicle,finishedByScript)=>{gameLogic.setUpSkip(position,heading,afterMission,vehicle,finishedByScript,gameTimeMs,skipWorld);},
                 clearScriptSkip:()=>{gameLogic.clearSkip(false,skipWorld);},
                 isScriptSkipWaitingForFadeIn:()=>gameLogic.isSkipWaitingForScriptToFadeIn(),
                 carPathAreas:()=>scriptCars.pathAreas({x:sim.player.position.x,z:sim.player.position.z}),
                 scriptVehicleLastDamagedBy:car=>(car as ScriptCar).lastDamagedBy,
                 scriptVehicleLastWeaponDamage:car=>(car as ScriptCar).lastWeaponDamage,
                 clearScriptVehicleLastDamagedBy:car=>{(car as ScriptCar).lastDamagedBy=undefined;},
                 clearScriptVehicleLastWeaponDamage:car=>{(car as ScriptCar).lastWeaponDamage=-1;},
                 messageShowing:()=>hud.messageShowing,
                 cameraSource:()=>{const p=render.camera.position;return {x:p.x,y:-p.z,z:p.y};},
                 cameraFront:()=>{const d=render.camera.getWorldDirection(new Vector3());return {x:d.x,y:-d.z,z:d.y};},
                 cameraFov:()=>render.camera.fov,
                 setCameraInFrontOfPlayer:()=>{render.camDirectlyInFront=sim.player.heading;},
                 setCameraInFrontOfHeading:degrees=>{render.camDirectlyInFront=scriptYaw(degrees);},
                 scriptEmergencyServicesCar:(model,point)=>{emergency?.scriptGenerate(model,point);},
                 addBlood:(position,direction,amount)=>{worldFx.effects?.blood([position.x,position.y,position.z],[direction.x,direction.y,direction.z],amount,1);},
                 // CHud::HelpMessageDisplayed: the help box (or the stat box, which is the same one) is up.
                 helpMessageShowing:()=>hud.helpShowing(),
                 // IS_THIS_HELP_MESSAGE_BEING_DISPLAYED: the box is up with the script's own text for that key.
                 helpMessageShowingKey:key=>hud.helpShowing()&&shownScript.help.split('#')[0]===key,
                 randomCivilianModel:()=>pedestrians?.rosterCivilian(),
                 setScriptPedRange:(ped,range,value)=>{const p=onFoot(ped);if(p)(p.ranges??={})[range]=value;},
                 pointOnScreen:(position,radius)=>!populationOutsideView(render.camera,{x:position.x,y:position.z,z:-position.y},radius),
                 // Fx_c::CreateFx through the browser's own particle manager, which already speaks the native
                 // matrix: three rows of axes and a position, in the script's coordinates.
                 createScriptFx:(name,matrix,ignoreBoundingChecks,hanging)=>hanging
                  ?worldFx.manager?.create(name,fxIdentity(),Float64Array.from(matrix),ignoreBoundingChecks)
                  :worldFx.manager?.create(name,Float64Array.from(matrix),undefined,ignoreBoundingChecks),
                 setScriptFxMatrix:(system,matrix)=>{(system as import('./simulation/fx/NativeFx').NativeFxSystem).setMatrix(Float64Array.from(matrix));},
                 playScriptFx:(system,andKill)=>{const fx=system as import('./simulation/fx/NativeFx').NativeFxSystem;if(andKill)fx.playAndKill();else fx.play();},
                 stopScriptFx:system=>{(system as import('./simulation/fx/NativeFx').NativeFxSystem).stop();},
                 killScriptFx:system=>{(system as import('./simulation/fx/NativeFx').NativeFxSystem).kill();},
                 // The same test CPed::ProcessBuoyancy makes: the point under the water's own level.
                 pointUnderWater:position=>{const level=render.lighting.water.levels?.level(position.x,position.y);return level!==undefined&&position.z<level;},
                 // CCamera::Restore asks FindPlayerVehicle and the ped's state. The browser's entry sequence is
                 // on foot until the door work begins, which is where the original's ENTER_CAR, CARJACK and
                 // OPEN_DOOR states start, and its exit states run to the ped standing up again.
                 playerCameraState:()=>({
                  inVehicle:!!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane),
                  enteringCar:(['align','open','pullout','getIn','closeInside','shuffle'] as const).includes(carEntry.phase as never),
                  exitingCar:(['waitSlow','getOut','closeOutside','jumpOut','getUp','draggedOut'] as const).includes(carEntry.phase as never),
                 }),
                 setScriptPedDecisionMaker:(ped,decisionMaker)=>{const p=onFoot(ped);if(p)p.decisionMaker=decisionMaker;},
                 setScriptPedNeverTargeted:(ped,enabled)=>{const p=onFoot(ped);if(p)p.neverTargeted=enabled;},
                 clearScriptPedLookAt:ped=>{const p=onFoot(ped);if(p)pedestrians?.clearLookAt(p);},
                 setScriptPedMoney:(ped,money)=>{const p=onFoot(ped);if(p){p.money=money<<16>>16;p.moneyByScript=true;}},
                 takeScriptPedPhotographed:ped=>{const p=onFoot(ped);if(!p?.photographed)return false;p.photographed=false;return true;},
                 // CMatrix's rows in the script's own axes: right, forward, up and the position.
                 scriptVehicleVelocity:car=>{const v=(car as ScriptCar).car.body.linvel();return {x:v.x,y:-v.z,z:v.y};},
                 scriptVehicleMatrix:car=>{
                  const body=(car as ScriptCar).car.body,q=body.rotation(),p=body.translation();
                  const rotate=(v:{x:number;y:number;z:number})=>{
                   const t={x:2*(q.y*v.z-q.z*v.y),y:2*(q.z*v.x-q.x*v.z),z:2*(q.x*v.y-q.y*v.x)};
                   return {x:v.x+q.w*t.x+q.y*t.z-q.z*t.y,y:v.y+q.w*t.y+q.z*t.x-q.x*t.z,z:v.z+q.w*t.z+q.x*t.y-q.y*t.x};
                  };
                  const native=(v:{x:number;y:number;z:number})=>({x:v.x,y:-v.z,z:v.y});
                  // The body's front is its local -z (as playerVehiclePose reads it), so up = right x forward holds.
                  return {right:native(rotate({x:1,y:0,z:0})),forward:native(rotate({x:0,y:0,z:-1})),
                   up:native(rotate({x:0,y:1,z:0})),position:{x:p.x,y:-p.z,z:p.y}};
                 },
                 setScriptVehicleUpsideDownNotDamaged:(car,state)=>{if('noUpsideDownDamage' in (car as object))(car as ScriptCar).noUpsideDownDamage=state;},
                 scriptObjectAnimLength:(block,name)=>(pedestrians?.scriptAnimation(block,name)??Promise.resolve(undefined)).then(clip=>clip?.duration),
                 scriptEntitiesTouching:(a,b)=>collidersTouch(touchColliders(a),touchColliders(b)),
                 // An object's own records: anything within a hair of its collision (the world, a car, a ped), found among
                 // the colliders in its bounding box.
                 scriptObjectTouchingAnything:handle=>{
                  const body=scriptObjectViews?.bodyOf(handle),radius=scriptObjectViews?.boundsRadius(handle);if(!body||radius===undefined)return false;
                  // The candidates are gathered first and tested after: no physics call is made inside the query's callback.
                  const own=touchColliders({kind:'object',handle}),r=radius+TOUCH_MARGIN,near:import('@dimforge/rapier3d-compat').Collider[]=[];
                  sim.world.collidersWithAabbIntersectingAabb(body.translation(),{x:r,y:r,z:r},other=>{near.push(other);return true;});
                  return collidersTouch(own,near.filter(other=>!other.isSensor()&&other.parent()?.handle!==body.handle));
                 },
                 setScriptVehicleConsideredByPlayer:(car,state)=>{if(car&&typeof car==='object'&&'consideredByPlayer' in car)(car as {consideredByPlayer:boolean}).consideredByPlayer=state;},
                 setScriptBoatAnchored:(car,anchored)=>{if(!(car instanceof WorldBoat))return false;car.setAnchored(anchored);return true;},
                 // physicalFlags.bDontApplySpeed: the car keeps its place and stops carrying any motion.
                 setScriptVehicleFrozen:(car,frozen)=>{
                  const body=(car as ScriptCar).car.body;
                  // Every vehicle body keeps Rapier's gravity off (installNativeVehicleBody): the native forces, or the bike's
                  // own step, apply it. Unfreezing used to turn it on, and a car's forces then threw every frame.
                  // Each vehicle's own step enables its body when in range; the flag keeps a frozen one out.
                  if('frozen' in (car as object))(car as {frozen:boolean}).frozen=frozen;
                  body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);body.setEnabled(!frozen);
                 },
                 // SET_CAR_FORWARD_SPEED: the speed along the car's own forward, in units a second.
                 setScriptVehicleForwardSpeed:(car,forwardSpeed)=>{
                  const target=car as ScriptCar,yaw=target.heading();
                  target.car.body.setLinvel({x:Math.sin(yaw)*forwardSpeed,y:0,z:Math.cos(yaw)*forwardSpeed},true);
                 },
                 // CPed::InflictDamage through the browser's own damage entry, which the ped's proofs answer.
                 playerMouseTargets:ped=>{const p=onFoot(ped);return !!p&&weapons.aiming&&weapons.lock?.handle===p.collider.handle;},
                 damageScriptPed:(ped,amount)=>{const p=onFoot(ped);if(p)pedestrians?.damageCollider(p.collider.handle,amount,{x:0,z:1});},
                 // CCarCtrl::CreateCarForScript through the fleet the browser already drives. The script speaks
                 // native coordinates and degrees clockwise from north; the browser holds renderer coordinates
                 // and the same yaw the player controller uses, which is those degrees in radians plus π.
                 // CVehicleRecording: carrec.img's files streamed on request, and a script car as a playback moves it.
                 requestCarRecording:(fileNumber,loaded)=>{carRecordings.request(fileNumber,loaded);},
                 carRecordingFrames:fileNumber=>carRecordings.framesOf(fileNumber),
                 carRecordingVehicle:car=>car&&typeof car==='object'&&'recordingSlot' in car?recordingVehicle(car as ScriptCar):undefined,
                 // CTrain: the fleet's mission trains, from native points.
                 spawnMissionTrain:(type,position,clockwise)=>fleet?fleet.spawnMissionTrain(type,position,clockwise,gameTimeMs):Promise.resolve(undefined),
                 trainCarriageOf:(train,index)=>train instanceof WorldTrain?fleet?.trainFor(findCarriage(train.carriage,index)):undefined,
                 trainCabooseOf:train=>train instanceof WorldTrain?fleet?.trainFor(findCaboose(train.carriage)):undefined,
                 scriptTrainModel:carriage=>carriage instanceof WorldTrain?carriage.modelId:-1,
                 setScriptTrainSpeed:(train,speed)=>{if(train instanceof WorldTrain)setTrainSpeed(train.carriage,speed);},
                 setScriptTrainCruiseSpeed:(train,speed)=>{if(train instanceof WorldTrain)setTrainCruiseSpeed(train.carriage,speed);},
                 setScriptTrainForcedToSlowDown:(train,state)=>{if(train instanceof WorldTrain)train.carriage.forceSlowDown=state;},
                 scriptTrainClockwise:train=>train instanceof WorldTrain&&train.carriage.clockwise,
                 setScriptTrainPosition:(train,position)=>{if(train instanceof WorldTrain)fleet?.setTrainPosition(train,position);},
                 removeScriptMissionTrain:train=>{if(train instanceof WorldTrain)fleet?.removeMissionTrain(train);},
                 releaseScriptMissionTrain:train=>{if(train instanceof WorldTrain)fleet?.releaseMissionTrain(train);},
                 removeMissionTrains:()=>{fleet?.removeMissionTrains();},
                 releaseMissionTrains:()=>{fleet?.releaseMissionTrains();},
                 removeAllTrains:()=>{fleet?.removeAllTrains();},
                 scriptVehicleIsTrain:car=>car instanceof WorldTrain,
                 // CPathFind's switches over every path loader's areas (the browser's systems each keep their own).
                 switchPathNodes:(area,isOff,isCars,backToOriginal)=>{for(const areas of pathAreaMaps)switchRoadsOffInArea(areas,area,isOff,isCars,backToOriginal);},
                 markRoadNodeAsDontWander:point=>{for(const areas of pathAreaMaps)markRoadNodeAsDontWander(areas,point);},
                 unmarkAllRoadNodesAsDontWander:()=>{for(const areas of pathAreaMaps)unmarkAllRoadNodesAsDontWander(areas);},
                 // The map's props in the streamed window: smashed once ObjectDamage turned the collision off and hid it,
                 // damaged once its damaged model shows.
                 setWorldObjectFlag:(key,flag,state)=>{
                  const set=flag==='visible'?hiddenPlacements:solidlessPlacements;
                  if(state)set.delete(key);else set.add(key);
                  for(const [handle,source] of importedScene?.sources??[]){
                   if(!source.placement||placementKey(source.modelName,source.placement.position)!==key)continue;
                   if(flag==='visible')importedScene!.setPlacementHidden(handle,!state);else importedScene!.setPlacementCollision(handle,state);
                  }
                 },
                 closestWorldObjectOfType:(point,radius,model)=>{
                  const scene=importedScene,name=(typeof model==='number'?scriptPickupModels?.byId.get(model)?.model:model)?.toLowerCase();if(!scene||!name)return undefined;
                  let best:{distance:number;smashed:boolean;damaged:boolean;key:string}|undefined;
                  for(const [handle,source] of scene.sources){
                   if(!source.placement||source.modelName.toLowerCase()!==name)continue;
                   const [x,y,z]=source.placement.position,distance=Math.hypot(x-point.x,y-point.y,z-point.z);
                   if(distance>=radius||best&&distance>=best.distance)continue;
                   const state=propStates.get(handle);
                   best={distance,smashed:!!state?.destroyed||smashedPlacements.has(placementKey(source.modelName,source.placement.position)),damaged:!!state?.renderDamaged,key:placementKey(source.modelName,source.placement.position)};
                  }
                  return best;
                 },
                 scriptVehicleInAirProper:car=>{
                  if(car instanceof WorldTrain)return false;
                  const body=(car as {car:{body:import('@dimforge/rapier3d-compat').RigidBody}}).car.body;
                  const airborne=isScriptCar(car)?car.audio.contactWheels===0:'airborne' in (car as object)?!!(car as {airborne:boolean}).airborne:false;
                  return airborne&&!touchesBuildingOrVehicle(body);
                 },
                 setPedTypeRelationship:(relationship,pedType,other,on)=>{pedestrians?.setPedTypeRelationship(relationship,pedType,other,on);},
                 pedTypeRelationshipSet:(relationship,pedType,other)=>!!pedestrians?.pedTypeRelationshipSet(relationship,pedType,other),
                 maxGroupMembers:()=>maxGroupMembers(),
                 pedWeaponInSlot:(ped,slot)=>{
                  const inv=weapons.inventory,model=(type:number)=>inv.info(type)?.models[0]??-1;
                  if(ped===undefined){
                   const type=[...inv.owned].find(id=>id!==0&&inv.slotOf(id)===slot&&((inv.ammo.get(id)?.clip??0)+(inv.ammo.get(id)?.reserve??0)>0||!weaponById(id)?.reload));
                   if(type===undefined)return {type:0,ammo:0,model:model(0)};
                   const a=inv.ammo.get(type)!;return {type,ammo:a.clip+a.reserve,model:model(type)};
                  }
                  // A script ped holds the one weapon it was given.
                  const held=onFoot(ped),type=held?.weaponType;
                  return type!==undefined&&inv.slotOf(type)===slot?{type,ammo:held?.totalAmmo??0,model:model(type)}:{type:0,ammo:0,model:model(0)};
                 },
                 setPlayerUsedEntryExit:(x,y,radius)=>{if(entryExits)entryExits.enteredBy=entryExits.findNearest(x,y,radius);},
                 playerEntryExit:()=>{const e=entryExits?.enteredBy;return e&&{name:e.name,position:entryExitPosition(e),heading:e.angle*180/Math.PI};},
                 setScriptVehicleOverrideLights:(car,lights)=>{if(car&&typeof car==='object'&&'overrideLights' in car)(car as ScriptCar).overrideLights=lights&3;},
                 // CEntity::m_bUsesCollision: with it off nothing collides with the car, the ground included.
                 setScriptVehicleUsesCollision:(car,state)=>{
                  const body=car instanceof WorldTrain?car.body:(car as ScriptCar|undefined)?.car?.body;if(!body)return;
                  for(let i=0;i<body.numColliders();i++)body.collider(i).setEnabled(state);
                 },
                 spawnScriptVehicle:async(model,position,heading,componentsToUse)=>{
                  if(!fleet||typeof model!=='number')return undefined;
                  return await fleet.spawnScriptVehicle(model,{x:position.x,y:position.z,z:-position.y},scriptCarRotation(heading),componentsToUse).catch(()=>undefined);
                 },
                 // The script's (x, y, z) is the renderer's (x, z, -y), the player's feet on z. In a car, the car goes with
                 // him, its centre of mass GetDistanceFromCentreOfMassToBaseOfModel above the point.
                 setPlayerAmmo:(weapon,ammo)=>{weapons.inventory.setTotalAmmo(weapon,ammo);},
                 // ENSURE_PLAYER_HAS_DRIVE_BY_WEAPON: nothing on foot; the SMG slot's weapon is topped up to `ammo`, or, empty, a
                 // Micro-SMG is given, the current weapon saved for the exit, and the SMG taken up.
                 ensurePlayerHasDriveByWeapon:ammo=>{
                  const inv=weapons.inventory;if(!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger))return;
                  const smg=[28,29,32].find(id=>inv.owned.has(id));
                  if(smg!==undefined){const a=inv.ammo.get(smg);if(!a||a.clip+a.reserve<ammo)inv.setTotalAmmo(smg,ammo);return;}
                  inv.give(28,ammo);driverSavedWeapon??=inv.selected;inv.select(28);void weaponView.equip(28);
                 },
                 addPlayerAmmo:(weapon,ammo)=>{weapons.inventory.grantAmmo(weapon,ammo);},
                 hidePlayerWeapon:hidden=>{playerWeaponHiddenByScript=hidden;},
                 clearPlayerLookAt:()=>{pedestrians?.clearPlayerLookAt();},
                 setPlayerVisible:visible=>{render.scriptPlayerHidden=!visible;},
                 setPlayerRelationship:(relationship,pedType)=>{pedestrians?.playerAcquaintance.setAs(relationship,1<<pedType);},
                 clearPlayerRelationship:(relationship,pedType)=>{pedestrians?.playerAcquaintance.clearAs(relationship,1<<pedType);},
                 clearPlayerRelationships:relationship=>{pedestrians?.playerAcquaintance.clear(relationship);},
                 damagePlayer:(amount,damageArmour)=>{sim.damagePlayer(amount,!damageArmour);},
                 setPlayerFrozen:frozen=>{playerFrozenByScript=frozen;},
                 playerInWater:()=>sim.player.swimming,
                 playerInAir:()=>!sim.player.grounded&&!sim.player.swimming,
                 playerIsPlayingAnim:animation=>(render.nativeCharacter?.reactionName??'').toLowerCase()===animation.toLowerCase(),
                 // The player's m_nAreaCode: the browser draws him wherever the camera is, so it is kept, not acted on.
                 // SetCharAreaVisible on the player to the normal world: the door stack is emptied (CEntryExitManager's
                 // ms_entryExitStackPosn = 0) and CTimeCycle::StopExtraColour(0).
                 setPlayerArea:area=>{playerAreaCode=area;if(area===0){entryExits?.clearStack();localLighting.stopExtraColour(false);}},
                 setPlayerProofs:proofs=>{sim.playerProofs={...proofs};},
                 usePedMobilePhone:(ped,start)=>{if(ped==='player'||onFoot(ped))phoneFor(ped).use(start);},
                 explodeScriptPedHead:ped=>{const p=onFoot(ped);if(!p)return;const q=p.actor.player.position;
                  pedestrians?.damageCollider(p.collider.handle,1000,{x:0,z:1},'bullet',{weapon:34,point:{x:q.x,y:q.y+1.6,z:q.z},noSource:true});},
                 // USE_DETONATOR: CWorld::UseDetonator for the player (his satchels and sticky car bombs).
                 useDetonator:()=>weapons.useDetonator(),
                 // CREATE_RANDOM_CAR_FOR_CAR_PARK: the script's point in renderer axes, its heading as CREATE_CAR's.
                 createRandomCarForCarPark:(x,y,z,heading)=>{void fleet?.spawnCarParkCar({x,y:z,z:-y},scriptCarRotation(heading));},
                 clearVehiclesInBox:(min,max)=>{fleet?.clearCarsInBox({x:min.x,y:min.z,z:-min.y},{x:max.x,y:max.z,z:-max.y});},
                 clearPedsInBox:(min,max)=>{pedestrians?.clearPedsInBox({x:min.x,y:min.z,z:-min.y},{x:max.x,y:max.z,z:-max.y});},
                 // CTheScripts::CleanUpThisVehicle: unlocked, no longer a mission car, and off its script mission.
                 releaseScriptVehicle:car=>{const c=car as ScriptCar;if(c.disposed)return;c.missionCar=false;if(scriptCars.mission(c)!==undefined){scriptCars.forget(c);c.autopilot=undefined;}},
                 teleportPlayer:position=>{
                  const x=position.x,z=-position.y,y=position.z,car=worldCar?.occupied?worldCar:fleet?.occupied;
                  // CPed::Teleport on a ped in a vehicle moves the vehicle, its base on the point
                  // (GetDistanceFromCentreOfMassToBaseOfModel), with him in it.
                  const other=car?undefined:fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
                  if(car||other){
                   const body=car?car.car.body:other!.body,lift=car?-car.nativeBody.boundsMin.z:-other!.assets.collision.bounds.min[2];
                   body.setTranslation({x,y:y+lift,z},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
                  }else{
                   carEntry.cancel();sim.flushPlayerTasks();
                   sim.player.position={x,y,z};sim.player.previous={x,y,z};sim.player.speed=0;sim.player.verticalSpeed=0;sim.player.jumpMomentum={x:0,z:0};
                   sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:y+.9,z});sim.playerCollider.setTranslation({x,y:y+.9,z});
                  }
                  fleet?.generateEvenIfClose();
                  groundAfterStream=position.groundPending?{x,z}:undefined;
                  scriptTeleported=true;scriptSceneDirty=true;requestFollowingTerrain();return true;
                 },
                 // CTaskSimpleCarSetPedInAsPassenger for the player: SA's seat 0 is the front right, 1 and 2 the rear; -1 the
                 // first free one.
                 warpPlayerIntoCarAsPassenger:(car,seat)=>{
                  if(!isScriptCar(car)||car.disposed)return false;
                  if(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger)return false;
                  const chosen=(seat>=0&&seat<=2?seat+1:1) as 1|2|3;
                  carEntry.cancel();car.setPlayerInAsPassenger(chosen);playerPassenger={car,seat:chosen};return true;
                 },
                 warpPlayerIntoCar:car=>{
                  const riding=()=>!!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger);
                  const target=car as ScriptCar;
                  // CTaskSimpleCarSetPedInAsDriver on a player seated in another car: he leaves that one where he sits
                  // (as WARP_CHAR_FROM_CAR_TO_COORD sets him out) and is put in this one.
                  const seatedIn=worldCar?.occupied?worldCar:fleet?.occupied;
                  if(seatedIn&&seatedIn!==car){const at=sim.player.position;carEntry.cancel();seatedIn.setPedOut({x:at.x,y:at.y,z:at.z});}
                  else if(playerPassenger&&playerPassenger.car!==car)leavePassengerSeat(true);
                  if(typeof target.setPedInAsDriver!=='function'){
                   // A bike, boat or aircraft: CTaskSimpleCarSetPedInAsDriver seats him at once, so no jump-on plays.
                   const other=car as {disposed?:boolean;occupied?:boolean;finishEnter?:()=>unknown;mountTimer?:number};
                   if(other.disposed||typeof other.finishEnter!=='function')return false;
                   if(other.occupied)return true;
                   if(riding())return false;
                   carEntry.cancel();bikeMount.abandon();other.finishEnter();if(other.mountTimer!==undefined)other.mountTimer=0;return true;
                  }
                  if(target.disposed)return false;
                  if(target.occupied)return true;
                  if(riding())return false;
                  carEntry.cancel();carEntry.warpIn(target);return true;
                 },
                 warpPlayerFromCarToCoord:position=>{
                  const car=worldCar?.occupied?worldCar:fleet?.occupied,x=position.x,z=-position.y,y=position.z;
                  if(car){carEntry.cancel();car.setPedOut({x,y,z});}
                  else if(fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane)return false;
                  else{sim.flushPlayerTasks();sim.player.position={x,y,z};sim.player.previous={x,y,z};sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:y+.9,z});sim.playerCollider.setTranslation({x,y:y+.9,z});}
                  return true;
                 },
                 placeScriptVehicle:(car,position,heading)=>{
                  // A train's carriage is put on its rails at the nearest node (SetNewTrainPosition).
                  if(car instanceof WorldTrain){fleet?.setTrainPosition(car,position);return;}
                  const target=car as ScriptCar;if(target.disposed)return;
                  const yaw=scriptCarRotation(heading),body=target.car.body;
                  body.setTranslation({x:position.x,y:position.z,z:-position.y},true);
                  body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
                  body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
                  // A car set down where the world's collision is not streamed in yet (INTRO2 puts Sweet's car back
                  // outside the pizza place before its LOAD_SCENE; a job's car sent across the city) stands static until
                  // the collision is under it, as the game's synchronous scene load would have it, with CJ in it or
                  // not; with the ground there it goes on at once.
                  if(typeof (target as {waitForCollision?:unknown}).waitForCollision==='function')target.waitForCollision(false,true);
                  // CJ in it is where it is (a ped in a car is at the car): the terrain hold looks at his position, which
                  // otherwise followed the car only on the next stepped frame, and that step ran the car over a spot
                  // whose window had not been asked for yet.
                  if(target.occupied||(target as {playerPassengerSeat?:unknown}).playerPassengerSeat){const p=body.translation();sim.player.previous={x:p.x,y:p.y,z:p.z};sim.player.position={x:p.x,y:p.y,z:p.z};}
                 },
                 scriptVehiclePosition:car=>{const p=(car as ScriptCar).car.body.translation();return {x:p.x,y:-p.z,z:p.y};},
                 scriptVehicleBoxTop:car=>(car as ScriptCar).assets.collision.bounds.max[2],
                 scriptVehicleHeading:car=>{const degrees=((car as ScriptCar).heading()-Math.PI)*180/Math.PI;return ((degrees%360)+360)%360;},
                 scriptVehicleAlive:car=>!(car as ScriptCar).disposed,
                 // CVehicle's destructor flags its driver (FlagToDestroyWhenNextProcessed): the player, whom it does not
                 // destroy, is out of the car and left where he sat, as a passenger is; one hanging from it is let go.
                 removeScriptVehicle:car=>{if(playerPassenger?.car===car)leavePassengerSeat(true);
                  if(playerAttached?.car===car)detachPlayer();
                  if(carEntry.car===car&&!carEntry.seated)carEntry.cancel();
                  if(bikeMount.bike===car&&bikeMount.active&&!(car as {occupied?:boolean}).occupied)bikeMount.abandon();
                  const seated=car as {occupied?:boolean;setPedOut?:(foot:{x:number;y:number;z:number})=>void;finishExit?:(foot?:{x:number;y:number;z:number})=>void};
                  if(seated.occupied){const at={...sim.player.position};carEntry.cancel();bikeMount.abandon();if(seated.setPedOut)seated.setPedOut(at);else seated.finishExit?.(at);}if(car instanceof WorldTrain)fleet?.removeTrainCarriage(car);else fleet?.removeScriptVehicle(car as ScriptCar);},
                 // CVehicle::m_fHealth, and GET_CAR_SPEED's m_vecMoveSpeed magnitude times fifty, which for a
                 // body the browser moves in units a second is the magnitude itself.
                 playerVehicleEntity:()=>worldCar?.occupied?worldCar:fleet?.occupied??playerPassenger?.car??fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane,
                 playerVehiclePose:()=>{
                  const car=worldCar?.occupied?worldCar:fleet?.occupied,other=fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane,body=car?car.car.body:other?.body;
                  if(!body)return undefined;
                  const r=body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),t=body.translation(),axis=(x:number,y:number,z:number)=>{const v=new Vector3(x,y,z).applyQuaternion(q);return {x:v.x,y:-v.z,z:v.y};};
                  const forward=axis(0,0,-1),heading=Math.atan2(-forward.x,forward.y)*180/Math.PI;
                  return {position:{x:t.x,y:-t.z,z:t.y},right:axis(1,0,0),forward,up:axis(0,1,0),heading:(heading%360+360)%360};
                 },
                 scriptVehicleHealth:car=>(car as ScriptCar).health,
                 setScriptVehicleHealth:(car,health)=>{(car as ScriptCar).health=health;},
                 scriptVehicleSpeed:car=>{const v=(car as ScriptCar).car.body.linvel();return Math.hypot(v.x,v.y,v.z);},
                 // CTheScripts::IsVehicleStopped: a time step's hundredth of a unit a frame, which at the
                 // original's own step is a fiftieth of a unit a second.
                 scriptVehicleStopped:car=>{const v=(car as ScriptCar).car.body.linvel();return Math.hypot(v.x,v.y,v.z)/50<=.01;},
                 scriptVehicleOnFire:car=>(car as ScriptCar).onFire,
                 scriptVehicleInWater:car=>!!(car as {inWater?:boolean}).inWater,
                 waterLevelAt:(x,y,waves)=>{const levels=render.lighting.water.levels;return waves?levels?.level(x,y):levels?.levelNoWaves(x,y);},
                 scriptVehicleOnScreen:car=>{const p=(car as ScriptCar).car.body.translation();return !populationOutsideView(render.camera,p,2);},
                 explodeScriptVehicle:car=>{(car as {blowUp?:()=>void}).blowUp?.();},
                 explodeScriptVehicleInCutscene:(car,o)=>{if(isScriptCar(car))car.blowUpInCutscene(o);else (car as {blowUp?:()=>void}).blowUp?.();},
                 fixScriptVehicle:car=>{if(isScriptCar(car))car.fix();else (car as {health:number}).health=1000;},
                 setScriptVehicleVisible:(car,visible)=>{if(!isScriptCar(car))return;car.scriptVisible=visible;car.showForArea(render.lighting.area);},
                 setScriptVehicleArea:(car,area)=>{if(!isScriptCar(car))return;car.areaCode=area;car.showForArea(render.lighting.area);},
                 setScriptVehicleProofs:(car,proofs)=>{(car as ScriptCar).proofs={...proofs};},
                 setScriptVehicleCanBeDamaged:(car,canBeDamaged)=>{(car as ScriptCar).canBeDamaged=canBeDamaged;},
                 setScriptVehicleDoorLock:(car,locked)=>{(car as ScriptCar).locked=locked;},
                 setScriptVehicleSiren:(car,on)=>{(car as ScriptCar).siren=on;},
                 openScriptVehicleDoor:(car,door,ratio)=>{(car as Partial<ScriptCar>).openDoor?.(door,ratio);},
                 cutsceneSkipPressed:()=>cutsceneSkipNow,
                 scriptVehicleAutopilotFields:car=>({...(car as Partial<ScriptCar>).autopilotFields}),
                 setScriptVehicleStrong:(car,strong)=>{const c=car as Partial<ScriptCar>;if(c.takeLessDamage!==undefined)c.takeLessDamage=strong;},
                 scriptVehicleWheelsOnGround:car=>(car as Partial<ScriptCar>).wheelsOnGround??0,
                 rollOutScriptPed:(ped,velocity,clip)=>{const p=onFoot(ped);if(p)pedestrians?.rollOut(p,velocity,clip);},
                 scriptVehicleStill:car=>{
                  const body=(car as Partial<ScriptCar>).car?.body;if(!body)return true;
                  const v=body.linvel(),w=body.angvel();
                  return canPedStepOutCar(1,{x:v.x/50,y:-v.z/50,z:v.y/50},{x:w.x/50,y:-w.z/50,z:w.y/50});
                 },
                 scriptVehicleHasHydraulics:car=>!!(car as Partial<ScriptCar>).hydraulics,
                 setScriptVehicleHydraulicLevels:(car,wheels)=>{if(!isScriptCar(car)||!car.hydraulics)return false;car.setScriptHydraulics(wheels);return true;},
                 setScriptVehicleHydraulics:(car,fitted)=>{const c=car as Partial<ScriptCar>;if(fitted)c.fitHydraulics?.();else c.removeHydraulics?.();},
                 scriptVehicleHandlingFlags:car=>(car as Partial<ScriptCar>).handlingFlags??0,
                 scriptVehicleModelFlags:car=>(car as Partial<ScriptCar>).modelFlags??0,
                 setScriptVehicleDirtLevel:(car,level)=>{const c=car as Partial<ScriptCar>;if(c.dirtLevel!==undefined)c.dirtLevel=level;},
                 playerUsingJetpack:()=>!!sim.jetPack,
                 setDeathPenalties:apply=>{gameLogic.penaltyForDeathApplies=apply;},
                 beatTracks:sound.beatTracks,
                 // CAudioEngine::PreloadBeatTrack: the radio, else the ambience track, gives the stream up to the track.
                 trackAudio:{stopForTrack:()=>{if(!sound.nativeEngine?.stopRadioForTrack())ambience.stopNow(gameTimeMs);},radioAfterTrack:kept=>{sound.nativeEngine?.restartRadioAfterTrack(kept);},
                  holdAmbience:()=>{ambienceHeldUntil=performance.now()+30000;}},
                 scriptSpeech:{load:(sample,slot)=>sound.loadSpeech(sample,slot),play:(slot,sample)=>{sound.playSpeech(slot,sample);},stop:slot=>{sound.stopSpeech(slot);},lengthMs:sample=>sound.speechLengthMs(sample)},
                 loadMissionBank:(index,bank)=>sound.loadMissionBank(index,bank),clearMissionBank:index=>sound.clearMissionBank(index),
                 garageDoorSound:(garage,event,position)=>sound.garageDoorEvent(garage,event,position),
                 setArrestPenalties:apply=>{gameLogic.penaltyForArrestApplies=apply;},
                 // The script's (x, y, z) is the renderer's (x, z, -y); a z at or below MAP_Z_LOW_LIMIT is on the ground.
                 driveScriptVehicleTo:(car,goal,o)=>{if(isScriptDrivable(car))scriptCars.gotoCoords(car,{x:goal.x,y:goal.z>-100?goal.z:(car as ScriptCar).car.body.translation().y,z:-goal.y},o);},
                 setScriptVehicleStraightLineDistance:(car,distance)=>{if(isScriptDrivable(car))scriptCars.setStraightLineDistance(car,distance);},
                 stopScriptVehicle:car=>{if(isScriptDrivable(car))scriptCars.clear(car);},
                 scriptVehicleTempAction:(car,action,seconds)=>{if(isScriptDrivable(car))scriptCars.tempAction(car,action,seconds);},
                 scriptVehicleWander:(car,o)=>{if(isScriptDrivable(car))scriptCars.wander(car,o);},
                 scriptVehicleCarMission:(car,o)=>{
                  const target=o.target as Partial<ScriptCar>|undefined;
                  // Only a car the browser drives with the native body can be a target.
                  if(target&&!(target.car&&target.nativeBody))return false;
                  if(!isScriptDrivable(car))return false;
                  return scriptCars.carMission(car,{mission:o.mission,target:target as ScriptCar|undefined,cruise:o.cruise,style:o.style});
                 },
                 scriptVehicleSeatDoor:(car,seat)=>{
                  // A bike's rider steps off at its side: the driver's saddle to the left, the pillion to the right, as the
                  // leave-car task picks the door by the seat. A bike has no doors, and a car's frames are not on it.
                  if(!isScriptCar(car)){
                   const bike=car as import('./simulation/WorldBike').WorldBike;if(typeof bike.seat!=='function'||!bike.body)return undefined;
                   const saddle=bike.seat();if(!saddle)return undefined;const side=seat==='driver'?'left':'right';
                   const w=bikeMount.worldPoint(bike,bikeMount.sidePoint(bike,side)??{x:saddle.x+(side==='left'?-1:1),y:saddle.y,z:saddle.z});
                   const ground=pedestrians?.groundUnder(w.x,w.z,w.y+2)??w.y;
                   return {x:w.x,y:-w.z,z:ground};
                  }
                  const c=car as ScriptCar;if(typeof c.seat!=='function')return undefined;
                  const local=carEntry.seatDoorPoint(c,seat);if(!local)return undefined;
                  const w=c.worldPoint(local),ground=pedestrians?.groundUnder(w.x,w.z,w.y+2)??w.y;
                  return {x:w.x,y:-w.z,z:ground};
                 },
                 setScriptVehicleCanBeVisiblyDamaged:(car,state)=>{(car as ScriptCar).canBeVisiblyDamaged=state;},
                 setTimeScale:scale=>{cheatTimeScale=scale;},
                 // CWeather::SetWeatherToAppropriateTypeNow: the player's region's first list entry, the forcing released.
                 setWeatherToAppropriateTypeNow:()=>{weather.setAppropriateNow(sim.player.position.x,-sim.player.position.z);},
                 // The one ped the browser holds. CTheScripts::IsPedStopped asks a vehicle whether its moving
                 // speed is under a step's worth, and a ped on foot whether it is standing in place, on the
                 // ground and not shifting; the browser's own speed and grounded flag answer both.
                 playerPed:()=>{
                  const car=worldCar?.occupied?worldCar:fleet?.occupied??playerPassenger?.car;
                  const vehicle=car??fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
                  const speed=vehicle?Math.hypot(sim.player.position.x-sim.player.previous.x,sim.player.position.z-sim.player.previous.z)*60:sim.player.speed;
                  // eVehicleAppearance: a car is an automobile, and the browser's bikes, boats and planes are
                  // their own; a helicopter is a plane here until the fleet tells them apart.
                  const appearance=car?1:fleet?.occupiedBike?2:fleet?.occupiedBoat?4:fleet?.occupiedPlane?5:0;
                  return {
                   // CPed::GetPosition is the ped's origin, its collision's centre a unit above the feet
                   // (GetDistanceFromCentreOfMassToBaseOfModel); in a vehicle it is the vehicle's, which the player's
                   // position already follows.
                   position:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y+(vehicle?0:PED_ORIGIN_HEIGHT)},
                   vehicle:vehicle?{appearance,train:false,model:vehicle.modelId,inAirProper:()=>!(car?car.audio.contactWheels>0:'airborne' in vehicle&&!(vehicle as {airborne:boolean}).airborne)&&!touchesBuildingOrVehicle(car?car.car.body:(vehicle as {body:import('@dimforge/rapier3d-compat').RigidBody}).body)}:undefined,
                   stopped:speed<0.01&&(!!vehicle||sim.player.grounded),
                   // m_vecMoveSpeed's magnitude in units a second: the car's in one, his own (with the fall) on foot.
                   moveSpeed:vehicle?speed:Math.hypot(sim.player.speed,sim.player.verticalSpeed),
                   health:sim.player.health,dead:sim.player.health<=0,
                   heading:((((sim.player.heading-Math.PI)*180/Math.PI)%360)+360)%360,
                   areaCode:render.lighting.area,
                   // The inventory holds one of each weapon the player has picked up, and the catalog says
                   // which of them are melee. A weapon with no ammo counts while he holds it if it is used without
                   // any (CWeapon::HasWeaponAmmoToBeUsed: the fists' and the melee slots', and the parachute, which
                   // MAIN starts player_parachute for).
                   // Read only by the weapon commands: worked out when one asks, not each of the dozens of times a
                   // frame the scripts ask where the player is (two copies of the ammo table a time, a phone's
                   // garbage collector's busiest caller).
                   get weapons(){return {
                    carried:[...weapons.inventory.ammo].filter(([id,ammo])=>id===0||ammo.clip>0||ammo.reserve>0||weapons.inventory.owned.has(id)&&weaponUsedWithoutAmmo(id)).map(([id])=>id),
                    active:{type:weapons.inventory.selected,melee:weapons.inventory.weapon.kind==='melee'},
                    ammo:Object.fromEntries([...weapons.inventory.ammo].map(([id,a])=>[id,a.clip+a.reserve])),
                   };},
                   shooting:input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'),
                   // The player is always the camera's subject, and rides in the seat rather than hanging off it.
                   onScreen:true,sittingInCar:!!vehicle,
                  };
                 },
                 // CanPlayerStartMission's gates, answered from what the browser has. Its game logic state and
                 // the player's health carry the first and the last; a knockdown stands for the physical
                 // response task and a climb for a primary task that is not driving. The browser has no coop
                 // game, no event responses and no script commands given to the player, so those are none.
                 playerMissionGates:()=>({
                  statePlaying:gameLogic.state===0,coopGoingOn:false,
                  inControl:sim.player.health>0&&!sim.knockdown&&sim.deathRemaining<=0,
                  driving:!!(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane),
                  alive:sim.player.health>0,
                  physicalResponseTask:!!sim.knockdown,eventResponseTask:false,
                  nonDrivePrimaryTask:!!sim.climb,
                  attackTask:input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'),
                  scriptCommandEvent:false,
                 }),
                 // The browser builds its own player model and keeps no replay buffer, so a rebuild is only
                 // recorded; the law enforcers, the safety radius and the maxima are the game's own.
                 // The browser keeps the player in control of themselves whatever the script asks; taking it
                 // away would stop a free-roam session the script is only opening.
                 // The browser draws its own messages from the text the game already loaded, so the block the
                 // script names is recorded rather than swapped in.
                 // CTheZones' map zones carry the level the script asks for.
                 playerCity:()=>worldLevelAt(zones,[sim.player.position.x,-sim.player.position.z,sim.player.position.y]),
                 cityAt:(x,y,z)=>worldLevelAt(zones,[x,y,z]),
                 modelIndex:name=>scriptPickupModels?.byName.get(name.toLowerCase())?.id??-1,
                 givePlayerWeapon:(weapon,ammo)=>{const before=weapons.inventory.selected;if(weapons.inventory.give(weapon,ammo)&&weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);},
                 // SetCurrentCharWeapon only picks among the weapons the ped holds: a type he does not have changes nothing.
                 setPlayerCurrentWeapon:weapon=>{if(weapons.inventory.selected!==weapon&&weapons.inventory.owned.has(weapon)&&weapons.inventory.select(weapon))void weaponView.equip(weapons.inventory.selected);},
                 setPlayerArmour:armour=>{sim.player.armour=armour;},playerArmour:()=>sim.player.armour,
                 randomStreetPeds:()=>(pedestrians?.scriptCandidates()??[]).map(p=>{const at=p.actor.player.position;return {ped:p,pedType:nativePedType(p.pedType)??4,model:pedestrians!.modelIdOf(p)??-1,
                  position:{x:at.x,y:-at.z,z:at.y+1},heading:(((p.actor.player.heading-Math.PI)*180/Math.PI)%360+360)%360,health:p.health,
                  // CWorld::FindRoofZFor3DCoord: anything fixed straight above the ped.
                  roofed:()=>!!sim.world.castRay(new RAPIER.Ray({x:at.x,y:at.y+1.2,z:at.z},{x:0,y:1,z:0}),200,true,RAPIER.QueryFilterFlags.ONLY_FIXED)};}),
                 adoptStreetPed:ped=>{const p=onFoot(ped);if(p)pedestrians?.adoptForScript(p);},
                 pedModelId:name=>pedestrians?.modelIdByName(name),
                 modelInArchive:id=>!!pedestrians?.hasModelId(id),
                 worldObjectsNear:(models,x,y,radius)=>importedScene?.modelPlacementsNear(models,x,y,radius)??[],
                 garageDoorModels:()=>garageDoorModels,
                 modelTriggerPoint:(model,index)=>importedScene?.modelTriggerPoint(model,index),
                 takeWorldObject:(key,taken)=>importedScene?.setModelPlacementTaken(key,taken)??false,
                 weaponTypeInfo:type=>{const info=weapons.native&&nativeWeaponInfo(weapons.native,type);return info?{slot:info.slot,model:info.models[0]}:undefined;},
                 // CText::LoadMissionText: the mission's table replaces the loaded one, so its subtitles and briefs read as
                 // text rather than keys. The GXT may still be loading at the mission's start; the request waits for it.
                 loadMissionText:name=>{const load=(t:import('./assets/gxt').NativeText)=>{try{t.loadMissionText(name);}catch(e){console.warn(`Mission text ${name}: ${(e as Error).message}`);}};
                  if(theText)load(theText);else void import('./assets/gxt').then(m=>m.loadNativeText(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(load).catch(()=>{});},
                 // The browser plays no cutscenes; the request is recorded so the script's loop carries on.
                 // The browser's own tag manager and gang wars answer these three.
                 tagsTagged:()=>tagManager?.numTagged??0,
                 tagsPercentageInArea:(x1,y1,x2,y2)=>tagManager?.percentageTaggedInArea(x1,y1,x2,y2)??0,
                 setTagsInArea:(x1,y1,x2,y2,tagged)=>{{const loaded=new Set(importedScene?.tagKeys()??[]);tagManager?.setAlphaInArea(x1,y1,x2,y2,tagged?255:0,(key,alpha)=>importedScene?.setTagAlpha(key,alpha),key=>loaded.has(key));}if(tagManager)progression.tags=tagManager.saved();},
                 nearestTagPosition:(x,y)=>{const tag=tagManager?.nearestTag(x,y);return tag&&{x:tag.position[0],y:tag.position[1],z:tag.position[2]};},
                 // CGangWars keeps the share as a fraction; the script reads it as a percentage.
                 territoryUnderControlPercentage:()=>Math.round((gangWars?.territoryUnderControlPercentage??0)*100),
                 // CCutsceneMgr::LoadCutsceneData: ResetSprintEnergy, the player's stamina back to full.
                 // ... CClothes::RebuildPlayerIfNeeded, and CWanted::ClearQdCrimes: a crime still waiting to be reported is dropped.
                 loadCutscene:()=>{sim.player.stamina=100;sim.player.sprintExhausted=false;rebuildPlayerIfNeeded();law.native.clearQueuedCrimes();},
                 requestModel:()=>{},
                 setPlayerControl:()=>{},
                 buildPlayerModel:()=>{},
                 // The browser's police drive themselves; stopping them where they stand would need the task
                 // clearing the original does, which it has no equivalent of yet.
                 stopAllLawEnforcers:()=>{},
                 // CPlayerInfo::MakePlayerSafe: the player takes no damage at all while it is on, the wanted
                 // system's everybody-back-off goes with it and every car's bCanBeDamaged follows. Turning it on
                 // also clears adrenaline, puts out the fires and car fires within the radius and removes every
                 // projectile; the pad shake, the replay and the law enforcers (the adapter above) have nothing to
                 // reach here, and the port's explosions do not linger to be removed.
                 makePlayerSafe:(safe,radius)=>{
                  // MakePlayerSafe sets or clears every proof SET_CHAR_PROOFS writes, so a mission's proofs end with it.
                  sim.playerCanBeDamaged=!safe;law.native.everybodyBackOff=safe;sim.playerProofs={bullet:safe,fire:safe,explosion:safe,collision:safe,melee:safe};
                  for(const car of fleet?.cars??[])car.canBeDamaged=!safe;
                  if(!safe)return;
                  // CPlayerInfo::MakePlayerSafe lifts m_fTimeCanRun out of its spent range (max(x, 0)): a winded player can
                  // sprint again as soon as the script hands control back.
                  sim.player.adrenaline=0;sim.player.stamina=Math.max(sim.player.stamina,0);sim.player.sprintExhausted=false;
                  const p=sim.player.position,at={x:p.x,y:-p.z,z:p.y};
                  weapons.fires.extinguishPoint(at,radius);
                  weapons.projectilesInBox({x:-Infinity,y:-Infinity,z:-Infinity},{x:Infinity,y:Infinity,z:Infinity},true);
                  // CWorld::ExtinguishAllCarFiresInArea: CVehicle::ExtinguishCarFire on each car within the radius.
                  for(const car of fleet?.cars??[]){
                   const c=car.car.body.translation();if((c.x-p.x)**2+(c.y-p.y)**2+(c.z-p.z)**2>radius*radius)continue;
                   if(!car.wrecked&&car.health<=300)car.health=300;car.burnTimer=0;
                   const fire=weapons.fires.fireOn(car);if(fire){fire.script=false;fire.extinguish();}
                  }
                 },
                 setAllVehiclesCanBeDamaged:state=>{for(const car of fleet?.cars??[])car.canBeDamaged=state;},
                 switchPoliceHelis:state=>{if(police)police.policeHelisAllowed=state;},
                 setGangWarsActive:state=>{gangWars?.setActive(state);},
                 syncWater:()=>{render.lighting.water.syncWater();},
                 setScriptLimitToGangSize:size=>{if(pedestrians)pedestrians.scriptGangLimit=size;},
                 setPlayerGroupSeparationRange:range=>{if(pedestrians)pedestrians.groupSeparationRange=range;},
                 makeRoomInPlayerGang:(room,missionMembers)=>{pedestrians?.makeRoomForMissionPeds(room,missionMembers);},
                 setScriptPedAnimGroup:(ped,group)=>{const p=onFoot(ped);return !!p&&!!pedestrians?.setAnimGroup(p,group);},
                 registerScriptRoadblock:(a,b,gang)=>{police?.registerScriptRoadblock(a,b,gang);},
                 clearScriptRoadblocks:()=>{police?.clearScriptRoadblocks();},
                 setPlayerMaxHealth:maxHealth=>{sim.player.health=maxHealth;},
                 setPlayerHealth:health=>{if(sim.player.health>0)sim.player.health=health;},
                 setFreeHealthCare:on=>{gameLogic.freeHealthCare=on;},
                 killPlayer:()=>{sim.killPlayer();},
                 setPlayerDrownsInWater:drowns=>{sim.playerDrownsInWater=drowns;},
                 // CPed::AttachPedToEntity for the player: not while he sits in a vehicle. His collision goes, he keeps the
                 // weapon he had (m_nSavedWeapon, m_nTurretAmmo), is given this one with 30000 rounds (none for fists)
                 // and has it chosen.
                 attachPlayerToVehicle:(car,offset,side,limit,weapon)=>{
                  if(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger||!attachedBody(car))return false;
                  const inv=weapons.inventory,previous=playerAttached;
                  playerAttached={car,offset:{...offset},side:side&3,limit,savedWeapon:previous?.savedWeapon??inv.selected,savedAmmo:previous?.savedAmmo??((inv.ammo.get(inv.selected)?.clip??0)+(inv.ammo.get(inv.selected)?.reserve??0))};
                  carEntry.cancel();sim.playerCollider.setEnabled(false);
                  if(weapon!==0)inv.give(weapon,30000);
                  inv.select(weapon);void weaponView.equip(inv.selected);
                  pinAttachedPlayer();return true;
                 },
                 // ATTACH_CHAR_TO_OBJECT on the player: the same attachment to a script object (the shooting range's
                 // stand, HEIST5, MANSIO1, CASINO9).
                 attachPlayerToObject:(object,offset,side,limit,weapon)=>{
                  if(worldCar?.occupied||fleet?.occupied||fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane||playerPassenger)return false;
                  const inv=weapons.inventory,previous=playerAttached;
                  playerAttached={object,offset:{...offset},side:side&3,limit,savedWeapon:previous?.savedWeapon??inv.selected,savedAmmo:previous?.savedAmmo??((inv.ammo.get(inv.selected)?.clip??0)+(inv.ammo.get(inv.selected)?.reserve??0))};
                  carEntry.cancel();sim.playerCollider.setEnabled(false);
                  if(weapon!==0)inv.give(weapon,30000);
                  inv.select(weapon);void weaponView.equip(inv.selected);
                  pinAttachedPlayer();return true;
                 },
                 detachPlayerFromVehicle:()=>{detachPlayer();},
                 setPlayerVelocity:velocity=>{sim.setPlayerVelocity(velocity);},
                 // His vehicle's move speed when he rides, his own last step's travel on foot (native axes, units a second).
                 playerVelocity:()=>{
                  const vehicle=worldCar?.occupied?worldCar.car.body:fleet?.occupied?.car.body??playerPassenger?.car.car.body??(fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane)?.body;
                  const v=vehicle?vehicle.linvel():sim.playerVelocity();return {x:v.x,y:-v.z,z:v.y};
                 },
                 playerAttachedObject:()=>playerAttached?.object,
                 // SET_HEADING_FOR_ATTACHED_PLAYER: the way he faces on the thing he hangs from (degrees anticlockwise from
                 // its front, as the side's quarter turns are) and the turn allowed either side of it; the view turns there.
                 setAttachedPlayerHeading:(heading,range)=>{
                  const a=playerAttached;if(!a)return false;
                  a.facing=heading*Math.PI/180;a.limit=range*Math.PI/180;
                  const frame=attachedFrame(a);
                  if(frame){const f=new Vector3(0,0,-1).applyQuaternion(frame.q);render.yaw=Math.atan2(f.x,f.z)-a.facing-Math.PI;}
                  pinAttachedPlayer();return true;
                 },
                 playerAttachedVehicle:()=>playerAttached?.car,
                 setPlayerMaxArmour:maxArmour=>{sim.player.armour=maxArmour;},
                 // The script's native x and y become the browser's x and negated z.
                 // CWorld::ProcessVerticalLine from the point down to z = -1000.
                 groundLevel:(x,y,z)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:z,z:-y},{x:0,y:-1,z:0}),z+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?z-hit.timeOfImpact:undefined;},
                 // CEntryExitManager's flags are the script's: SET_CLOSEST_ENTRY_EXIT_FLAG and ENABLE_ENTRY_EXIT
                 // reach the same entrances the read-ahead applied at load, and now also whatever the script
                 // changes later, which the read-ahead could not see.
                 setClosestEntryExitFlag:(x,y,radius,flag,on)=>{entryExits?.setClosestFlag(x,y,radius,flag,on);},
                 switchEntryExit:(name,on)=>{entryExits?.switchAccess(name,on);},
                 setNamedEntryExitFlag:(name,flag,on)=>{entryExits?.setNamedFlag(name,flag,on);},
                 enableBurglaryHouses:on=>{entryExits?.enableBurglaryHouses(on);},
                 disableAllEntryExits:disabled=>{if(entryExits)entryExits.disabled=disabled;},
                 // CObject's visibility by model near a point needs the object pool this browser does not keep
                 // for the world's own props; the script's own objects answer SET_OBJECT_VISIBLE instead.
                });
                // The script's wanted commands act on the player's own CWanted, not a copy of their own.
                mission.runtime.game.useWanted(law.native);
                // CStats::IncrementStat's food stats read and heal the player. UpdateStatsAddToHealth, which follows
                // the raw m_fHealth += value, is a retail stub; the port keeps health within the maximum, as the HUD
                // bar does, and the rest goes to fat through STAT_CALORIES.
                {const game=mission.runtime.game;game.stats.onUpdateMessage=displayStatUpdate;
                 // CPlayerInfo::m_nMoney is the one purse the HUD shows and the score commands move.
                 game.bindMoney({get:()=>sim.money,set:v=>{sim.money=v;}});
                 if(shoppingText)game.shopping.load(shoppingText);registerStreamedScripts();game.stats.player={health:()=>sim.player.health,maxHealth:()=>game.playerInfo.maxHealth,addHealth:addPlayerHealth,ateEnough:()=>{hunger.hoursDidntEat=0;}};
                 // STAT_DRIVING_SKILL and the weapon skills (GetSkillStatIndex: pistol 22 to M4 31 on stats 69-78, the
                 // Tec-9 sharing the machine pistol's) are the saved skills the ride sets and aiming read.
                 game.stats.bind(160,{get:()=>progression.drivingSkill,set:v=>{progression.drivingSkill=v;}});
                 law.native.stats=game.stats;
                 game.stats.bind(137,{get:()=>cheats.timesCheated,set:v=>{cheats.timesCheated=v;}});
                 for(let stat=69;stat<=78;stat++)game.stats.bind(stat,{get:()=>weapons.inventory.practice.get(stat-47)??0,set:v=>{weapons.inventory.practice.set(stat-47,v);}});}
                // CObjectData::SetObjectData for the script's objects: the model's OBJECT.DAT row, by the dff name the
                // IDE gives its id.
                mission.runtime.game.objects.objectInfo=model=>{
                  const name=typeof model==='number'?scriptPickupModels?.byId.get(model)?.model:model,values=name?(localObjectDefs??resolvedObjectDefs)?.get(name.toLowerCase())?.values:undefined;
                  return values&&{colDamageEffect:values.collisionDamageEffect??0,colDamageMultiplier:values.collisionDamageMultiplier??1,smashMultiplier:values.smashMultiplier??1,mass:values.mass??99999};
                };
                // A clump model (the IDE's anim and hier sections, and the vehicles, peds and weapons) takes an animation;
                // an atomic one (objs, tobj) does not. An unknown model is let through.
                mission.runtime.game.objects.clumpModel=model=>{
                  const record=typeof model==='number'?scriptPickupModels?.byId.get(model):scriptPickupModels?.byName.get(model.toLowerCase());
                  return !record||(record.section!=='objs'&&record.section!=='tobj');
                };
                // CGarages as CFileLoader::LoadGarage filled it from the world's grge rows.
                if(Array.isArray(data.garages))mission.runtime.game.garages.load(data.garages);
                // CGarages::Load's aCarsInSafeHouse: the cars the safehouse garages keep come from the save and go back to it.
                mission.runtime.game.garages.storedCars=progression.storedCars;
                // CGarage::Update's Pay 'n' Spray (ScmGarages: AUTHORED from re3) on the player's own vehicle, purse
                // and wanted level. A vehicle's collision spheres stand for it in the box tests, in native axes.
                {const game=mission.runtime.game,owner=mission;
                 const playerVehicle=()=>(worldCar?.occupied?worldCar:fleet?.occupied)??fleet?.occupiedBike??undefined;
                 /** PED_GETTING_OUT and the wait to slow down before it. */
                 const GETTING_OUT=new Set<string>(['waitSlow','getOut','closeOutside','jumpOut']);
                 const bodyOf=(v:{car?:{body:import('@dimforge/rapier3d-compat').RigidBody};body?:import('@dimforge/rapier3d-compat').RigidBody})=>(v.car?.body??v.body)!;
                 const spheresOf=(v:{assets:{collision:import('./assets/col').ColModel}}&Parameters<typeof bodyOf>[0])=>{
                  const body=bodyOf(v),t=body.translation(),q=body.rotation(),col=v.assets.collision,b=col.bounds;
                  const list=col.spheres.length?col.spheres.map(s=>({c:s.center,r:s.radius})):[{c:[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2] as const,r:0}];
                  return list.map(({c,r})=>{
                   // The native offset in renderer axes, turned by the body and placed, then back to native axes.
                   const vx=c[0],vy=c[2],vz=-c[1],ix=q.w*vx+q.y*vz-q.z*vy,iy=q.w*vy+q.z*vx-q.x*vz,iz=q.w*vz+q.x*vy-q.y*vx,iw=-q.x*vx-q.y*vy-q.z*vz;
                   const rx=ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y,ry=iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z,rz=iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x;
                   return {p:[t.x+rx,-(t.z+rz),t.y+ry] as [number,number,number],r};
                  });
                 };
                 const touching=(garage:import('./engine/ScmGarages').ScmGarage,v:Parameters<typeof spheresOf>[0])=>spheresOf(v).some(s=>ScmGarages.sphereTouching(garage,s.p,s.r));
                 game.garages.respray={
                  get nowMs(){return Math.trunc(gameTimeExact);},
                  // IsStaticPlayerCarEntirelyInside (not getting out, at rest to 0.01 units a frame, every sphere in the
                  // box) and not IsAnyOtherCarTouchingGarage.
                  playerCarParkedInside:garage=>{
                   const v=playerVehicle();if(!v||carEntry.phase&&GETTING_OUT.has(carEntry.phase))return false;
                   const velocity=bodyOf(v).linvel();if(Math.hypot(velocity.x,velocity.y,velocity.z)>.5)return false;
                   if(!spheresOf(v).every(s=>ScmGarages.sphereInside(garage,s.p,s.r)))return false;
                   for(const car of fleet?.cars??[])if(car!==v&&!car.disposed&&touching(garage,car))return false;
                   return true;
                  },
                  // The respray case's own test (iOS 0x1001b41b4): under 250 health, or what IsCarSprayable refuses; a
                  // BMX-class bike gets its own line.
                  playerCarRefusal:()=>{
                   const v=playerVehicle();if(!v)return 'unsprayable';
                   if(BMX_CLASS_MODELS.has(v.modelId))return 'bmx';
                   return v.health<250||!isCarSprayable(v.modelId)?'unsprayable':undefined;
                  },
                  // IsPlayerOutsideGarage: his vehicle's spheres, or a ped-sized sphere at his middle, clear of the box.
                  playerOutside:garage=>{
                   const v=playerVehicle();if(v)return !touching(garage,v);
                   const p=sim.player.position;return !ScmGarages.sphereTouching(garage,[p.x,-p.z,p.y],.5);
                  },
                  money:()=>sim.money,wantedLevel:()=>law.native.level,
                  respray:()=>{
                   // The player's car or bike (the automobiles and bikes the case works on).
                   const v=playerVehicle();if(!v)return undefined;
                   const repaired=v.health<970;
                   v.health=Math.max(v.health,1000);v.burnTimer=0;if('fix' in v)v.fix();
                   game.stats.increment(STAT_VEHICLE_RESPRAYS,1);
                   // A car on its roof comes out on its wheels: its right and up turned about its forward.
                   const body=bodyOf(v),q=body.rotation(),upY=1-2*(q.x*q.x+q.z*q.z);
                   if(upY<0)body.setRotation({x:q.y,y:-q.x,z:q.w,w:-q.z},true);
                   // SET_CAN_RESPRAY_CAR off (bShouldNotChangeColour) keeps the paint; so does a paintjob.
                   const handle=owner.vehicles.handleOf(v),keepPaint=handle!==undefined&&game.resprayForbidden.has(handle);
                   const recoloured='fix' in v&&!keepPaint&&!!fleet?.resprayCar(v);
                   owner.markResprayed(v);
                   return {repaired,recoloured};
                  },
                  pay:amount=>{sim.money=Math.max(0,sim.money-amount);},
                  clearWanted:()=>{law.setLevel(0);},
                  holdPlayer:on=>{garageHold=on;law.native.policeBackOffGarage=on;},
                  message:id=>{game.garageMessage.trigger(id,-1,4000,-1,gameTimeMs);},
                  coin:()=>Math.random()<.5,
                  sound:event=>sound.frontend(event),
                  stats:{get:id=>game.stats.get(id),increment:(id,by)=>game.stats.increment(id,by),set:(id,value)=>game.stats.set(id,value)},
                 };
                 // CGarage::Update's bomb shops: the Pay 'n' Spray's tests of the player's car, his money and the hold, and
                 // the car's bomb.
                 const respray=game.garages.respray;
                 game.garages.bombShops={
                  get nowMs(){return respray.nowMs;},
                  playerCarParkedInside:garage=>respray.playerCarParkedInside(garage),
                  playerCarBomb:()=>{const v=playerVehicle();return v&&'fix' in v?v.bombOnBoard:undefined;},
                  playerOutside:garage=>respray.playerOutside(garage),
                  money:()=>sim.money,pay:amount=>respray.pay(amount),holdPlayer:on=>respray.holdPlayer(on),
                  message:id=>respray.message(id),
                  help:key=>hud.help(gxtHudText(gxtText(key,''))),
                  sound:event=>sound.frontend(event),
                  stats:{increment:(id,by)=>game.stats.increment(id,by)},
                  // An automobile takes it (the bikes the open door turns away carry none here); the remote shop's
                  // detonator, one charge, goes into his hand.
                  fitBomb:(bomb,detonator)=>{
                   const v=playerVehicle();if(!v||!('fix' in v))return false;
                   v.bombOnBoard=bomb;v.bombInstalledByPlayer=true;
                   if(detonator&&weapons.inventory.give(40,1)){weapons.inventory.select(40);void weaponView.equip(40);}
                   return true;
                  },
                 };
                 // A bomb armed: CGarages::TriggerMessage("GA_12", -1, 3000).
                 carBombEvents.armed=()=>{game.garageMessage.trigger('GA_12',-1,3000,-1,gameTimeMs);};
                 // CGarage::Update's hideouts (the safehouse garages): where the player is, what he rides, the cars in the
                 // box and in its doorway, and CStoredCar's keeping of them while the door is down.
                 const restoring=new Map<StoredCar,Promise<void>|true>();
                 const cars=()=>[...(fleet?.cars??[]),...(worldCar&&!worldCar.disposed&&!fleet?.cars.has(worldCar)?[worldCar]:[])].filter(car=>!car.disposed);
                 game.garages.hideouts={
                  playerCentre:()=>{const v=playerVehicle(),p=v?bodyOf(v).translation():sim.player.position;return [p.x,-p.z,p.y];},
                  playerVehicle:()=>{const v=playerVehicle();return !v?undefined:BMX_CLASS_MODELS.has(v.modelId)?'bmx':'vehicle';},
                  playerOutside:(garage,margin)=>{
                   const v=playerVehicle();if(v)return !spheresOf(v).some(s=>ScmGarages.sphereTouching(garage,s.p,s.r+margin));
                   const p=sim.player.position;return !ScmGarages.sphereTouching(garage,[p.x,-p.z,p.y],.5+margin);
                  },
                  carsInside:garage=>{const own=playerVehicle();return cars().filter(car=>{if(car===own)return false;const t=car.car.body.translation();return ScmGarages.pointInside(garage,[t.x,-t.z,t.y]);}).length;},
                  carBlockingDoor:garage=>cars().some(car=>touching(garage,car)&&!spheresOf(car).every(s=>ScmGarages.sphereInside(garage,s.p,s.r))),
                  // StoreAndRemoveCarsForThisHideOut: the vehicle pool from its end (here the fleet's cars and bikes, newest
                  // first); each one not a mission's with its middle in the box goes, and the first `max` with no sphere
                  // a unit clear of the box (EntityHasASphereWayOutsideGarage, iOS 0x1001b767c) are kept (StoreCar).
                  removeCarsInside:(garage,max)=>{
                   const kept:StoredCar[]=[];if(!fleet)return kept;
                   for(const v of [...fleet.cars,...fleet.bikes].reverse()){
                    if(v.disposed||v.missionCar||v.occupied)continue;
                    const body=bodyOf(v),t=body.translation();if(!ScmGarages.pointInside(garage,[t.x,-t.z,t.y]))continue;
                    if(kept.length<max&&!spheresOf(v).some(s=>!ScmGarages.sphereTouching(garage,s.p,s.r+1)))kept.push(storeVehicle(v));
                    fleet.removeVehicle(v);
                   }
                   return kept;
                  },
                  get nowMs(){return Math.trunc(gameTimeExact);},
                  playerNearDoor:(garage,distance)=>{
                   const v=playerVehicle(),p=v?bodyOf(v).translation():sim.player.position;
                   return owner.garageDoorsSnapshot().some(door=>door.garage===garage.name&&!!door.position&&Math.hypot(door.position.x-p.x,door.position.y+p.z)<distance);
                  },
                  help:key=>hud.help(gxtHudText(gxtText(key,key==='GA_21'?'You cannot store any more cars in this garage.':''))),
                  removeCarBlockingDoor:garage=>{
                   if(!fleet)return;
                   const v=[...fleet.cars,...fleet.bikes].reverse().find(v=>{
                    if(v.disposed||v.missionCar||v.occupied||'locked' in v&&v.locked)return false;
                    const t=bodyOf(v).translation();return touching(garage,v)&&!ScmGarages.pointInside(garage,[t.x,-t.z,t.y]);
                   });
                   if(v)fleet.removeVehicle(v);
                  },
                  // RestoreCar (iOS 0x1001b7f20) with CWorld::Add: none until the model is in, then the car where it
                  // stood, its forward unpacked and squared with the up (as re3's), its proofs and nitro back.
                  restoreCar:(stored,impound)=>{
                   const state=restoring.get(stored);if(state===true){restoring.delete(stored);return true;}
                   // Until the fleet is up the car cannot be made, and the door waits as for a model still loading.
                   if(state||!fleet)return false;
                   const {position,rotation}=storedPlacement(stored);
                   restoring.set(stored,fleet.restoreStoredVehicle(stored.model,position,rotation,stored.colours,impound).then(v=>{
                    if(!v)return;restoreStoredParts(v,stored);
                    // vehicleFlags.bImpounded, which nothing reads.
                    if(impound&&'fix' in v)v.impounded=true;
                   }).catch(error=>{console.error('A stored car could not be restored',error);}).finally(()=>{restoring.set(stored,true);}));
                   return false;
                  },
                 };
                 // A car of his an area clear takes goes to the nearest impound (CGarages::StoreCarInNearestImpoundingGarage).
                 impoundCar=vehicle=>game.garages.storeCarInNearestImpoundingGarage(storeVehicle(vehicle));}
                // CAudioZones as CFileLoader::LoadAudioZone filled it from Audiozon.ipl's auzo rows.
                if(Array.isArray(data.audioZones))mission.runtime.game.audioZones.load(data.audioZones);
                if(Array.isArray(data.cullZones)&&!cullZones.attributeZones.length&&!cullZones.tunnelZones.length)cullZones.load(data.cullZones);
               // A failure here would leave the script silent, so it is reported rather than swallowed.
               }).catch(error=>{console.error('ScmMission failed to start',error);});
              }
              // CGangWars over the zone gang strengths. CreateAttackWave is a retail stub: the offensive waves are
              // authored (4 + 2 × ferocity attackers, at most 12, round a path node 45 units from the player).
              if(worldZones&&!gangWars){
               const toNative=(p:{x:number;y:number;z:number})=>({x:p.x,y:-p.z,z:p.y}),toBrowser=(p:{x:number;y:number;z:number})=>({x:p.x,y:p.z,z:-p.y});
               let pending:'wave'|'defenders'|undefined,ready:'wave'|'defenders'|undefined;
               const spawn=(kind:'wave'|'defenders',gang:number,count:number,center:{x:number;y:number;z:number},accuracy:number)=>{
                if(ready===kind){ready=undefined;return true;}
                if(!pending&&pedestrians){pending=kind;void pedestrians.spawnAttackWave(gang,count,center,accuracy,kind==='defenders').then(n=>{pending=undefined;if(n>0)ready=kind;}).catch(()=>{pending=undefined;});}
                return false;
               };
               const groundY=(x:number,z:number,top:number)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:top+50,z},{x:0,y:-1,z:0}),150,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?top+50-hit.timeOfImpact:top;};
               gangWars=new GangWars({
                nowMs:()=>elapsed*1000,player:()=>toNative(sim.player.position),playerOnMission:()=>!!mission?.playerOnAMission(),canTriggerGangWarWhenOnAMission:()=>!!mission?.runtime.game.canTriggerGangWarWhenOnAMission,playerInAircraft:()=>!!fleet?.occupiedPlane,
                canStartHere:infoIndex=>{const g=mission?.runtime.game;if(!g)return true;if(g.gangWarsTrainingMission)return infoIndex===g.gangWarTrainingZone;return !g.specificGangWarZones.length||g.specificGangWarZones.includes(infoIndex);},
                trainingMission:()=>!!mission?.runtime.game.gangWarsTrainingMission,
                territoryStat:(kind,value)=>{const stats=mission?.runtime.game.stats;if(!stats)return;if(kind==='taken')stats.increment(234,1);else if(kind==='lost')stats.increment(235,1);else{stats.set(236,value);stats.setNewRecord(237,value);}},
                weatherLA:()=>nativeWeatherRegion(sim.player.position.x,-sim.player.position.z)===WEATHER_REGION.la,zones:()=>worldZones,
                createAttackWave:(ferocity)=>{const a=Math.random()*Math.PI*2,p=sim.player.position;return spawn('wave',gangWars!.gang1,Math.min(12,4+2*ferocity),{x:p.x+Math.sin(a)*45,y:p.y,z:p.z+Math.cos(a)*45},90-gangWars!.difficulty*60);},
                createDefendingGroup:(gang,point,difficulty)=>{
                 // The group gathers at the car node nearest PointOfAttack (within 400; none while the paths are not loaded),
                 // and not while the player is within 40 of that node.
                 const b=toBrowser(point),p=sim.player.position,gather=traffic?.roadNodesNear(b,400)[0];
                 if(!gather||Math.hypot(p.x-gather.x,p.z-gather.z)<=40)return false;
                 const ok=spawn('defenders',gang,Math.trunc(10*(.4*difficulty+.6)),{x:gather.x,y:gather.y,z:gather.z},90-difficulty*60);
                 if(ok){
                  // CreateDefendingGroup's three gang cars: on the three nearest car nodes within 100 units of the point (none
                  // within 25 of the player), facing away from the defenders' node, unlocked, released as ordinary cars.
                  const model=fleet?.gangCarModel(gang);
                  if(model!==undefined&&traffic&&fleet)for(const node of traffic.roadNodesNear(b,100).slice(0,3)){
                   if(Math.hypot(node.x-p.x,node.z-p.z)<=25)continue;
                   const fx=node.x-gather.x,fz=node.z-gather.z,heading=Math.atan2(-fx,-fz);
                   void fleet.spawnTrafficCar(model,{x:node.x,y:node.y+.5,z:node.z},heading).catch(()=>{});
                  }
                  // The pickup lands within 2 units of the node, 0.75 above the ground: health when GetRandomNumberInRange(0, 2)
                  // gives 1 (one time in two), else body armour.
                  const armour=Math.floor(Math.random()*2)!==1,px=gather.x+Math.random()*4-2,pz=gather.z-(Math.random()*4-2),y=groundY(px,pz,gather.y+1);
                  pickups.generate({id:`gangwar:${Date.now()}`,command:'GENERATED',section:'gangwar',offset:0,modelId:armour?1242:1240,model:armour?'bodyarmour':'health',dictionary:armour?'icons7':'icons5',type:PICKUP_TYPE.onceTimeoutSlow,category:armour?'armour':'health',ammo:0,position:[px,-pz,y+.75]});}
                 return ok;},
                attackWaveOvercome:()=>pedestrians?.attackWaveOvercome()??true,
                releasePedsInAttackWave:(endOfWar,restore)=>{const n=pedestrians?.releaseAttackWave(restore)??0;if(endOfWar&&pedestrians)pedestrians.clearStreets=false;return n;},
                releaseCarsInAttackWave:()=>{},tellGangMembersTo:w=>pedestrians?.tellGangMembersTo(w),clearTheStreets:()=>{if(pedestrians)pedestrians.clearStreets=true;},
                message:t=>hud.message(t,4500),help:t=>hud.help(t),// CStats::IncrementStat(STAT_RESPECT, 45) on a win and DecrementStat(30) on a defensive loss: the stat itself, on its
                // total-respect scale; the recruit counter (FindMaxNumberOfGroupMembers reads that scale over ten) follows.
                respect:d=>{const s=mission?.runtime.game.stats;if(s){if(d>0)s.increment(68,d);else s.decrement(68,-d);}addRespect(d/10);},blip:b=>{gangWarBlip=b;},zoneColours:()=>{},streamGangs:()=>{},random:Math.random});
               gangWars.updateTerritoryUnderControlPercentage();
              }}
            if(data.type==='terrain'&&data.followId===-1&&savedTransfer&&!flightTransfer){
              const target=savedTransfer;savedTransfer=undefined;
              // A game already under way takes the window as a door's is taken, behind the frozen step: the menu
              // opened over it and stayed up, so a save loaded indoors or a death indoors left the game paused.
              const running=started&&!paused;
              // The step stays held until the window is in: run over the old one meanwhile, a player the script had put
              // in an interior fell through the street's empty sky beneath it.
              savedTransferInstalling=true;
              void (async()=>{
                const installed=await replaceWalkTerrain({...data,followId:undefined,preservePosition:false,preferredSpawn:{x:target.x,z:-target.y},...(running||target.script?{keepPlayer:true}:{})}).catch(()=>false).finally(()=>{savedTransferInstalling=false;});
                if(!installed||!alive){if(!target.quiet)hud.message('Your save point could not be loaded.');return;}
                if(!target.script){
                  const position={x:target.x,y:target.z,z:-target.y};
                  sim.flushPlayerTasks();sim.player.position={...position};sim.player.previous={...position};sim.player.heading=target.heading;
                  sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
                  render.yaw=target.heading+Math.PI;if(running)sim.respawn={...position};
                }
                // CGame::currArea is the window's: a save's own (SimpleVariablesSaveStructure), 0 after a restart; a
                // script's stays what it set.
                if(mission&&!target.script)mission.runtime.game.currentArea=target.area??0;
                interiorCentre=target.area?{x:target.x,y:target.y}:undefined;
                // Inside, nothing follows (as after a door) and the way back out is the doors the save kept; a script's
                // teleport leaves the door stack as it was.
                if(target.area){follower=undefined;pedestrians?.removeAllRandomPeds();if(entryExits&&!target.script){entryExits.clearStack();for(const i of target.enexStack??[]){const e=entryExits.pool[i];if(e)entryExits.stack.push(e);}
                  // The save keeps CTimeCycle's extra colour; here it is the one the last door in gave.
                  const door=entryExits.stack.at(-1);if(door){spawnPointSky(door);entryExits.enteredBy=door.link??door;}}}
                else follower=new SceneRegionFollower({x:target.x,y:target.y,radius:180,lodRadius:1000,includeCollisionBounds:true});
                if(!target.quiet)hud.message('Loaded your last save point.');
              })();return;
            }
            if(data.type==='terrain'&&data.followId===-2&&interiorTransfer){void finishInteriorTransfer(data);return;}
            if(data.type==='terrain'&&data.followId===-1&&flightTransfer){
              const transfer=flightTransfer;flightTransfer=undefined;clearTimeout(transferTimer);
              void (async()=>{try{
                const installed=await replaceWalkTerrain({...data,followId:undefined,preservePosition:false,preferredSpawn:{x:150,z:-2500}});
                if(!installed)throw new Error('Airfield terrain could not be installed.');
                if(!fleet||!alive)throw new Error('Aircraft fleet is unavailable.');
                // Selecting a new hangar aircraft replaces any unoccupied aircraft on its departure spot.
                for(const previous of fleet.planes){const p=previous.body.translation();if(!previous.occupied&&Math.hypot(p.x-150,p.z+2500)<40)fleet.removePlane(previous);}
                // The hangar is a browser convenience on the original continuous airfield.
                const plane=await fleet.spawnPlane(transfer.modelId,150,-2500,-Math.PI/2);
                sim.player.position={...plane.body.translation()};plane.interact();render.yaw=sim.player.heading-Math.PI;
                follower=new SceneRegionFollower({x:150,y:2500,radius:180,lodRadius:1000,includeCollisionBounds:true});play();transfer.resolve();
              }catch(error){hud.menuMessage(String(error));transfer.reject(error);}})();return;
            }
            // A transfer's window (a negative id) that nothing waits for any more, since its request timed out.
            if(data.type==='terrain'&&data.followId!==undefined&&data.followId<0)return;
            if(data.type==='terrain')scheduleWindow(data);
            if(data.type==='error'){
              if(interiorTransfer&&data.followId===-2){failInteriorTransfer(data.message);return;}
              // A save point's or a restart's window that failed lets the frozen step go; outdoors the follower asks again.
              if(savedTransfer&&data.followId===-1){const target=savedTransfer;savedTransfer=undefined;if(!target.quiet)hud.message('Your save point could not be loaded.');
                if(!target.area&&target.quiet){follower=new SceneRegionFollower({x:target.x,y:target.y,radius:180,lodRadius:1000,includeCollisionBounds:true});scriptTeleported=true;}
                // A script's interior that would not load leaves the outside window it was asked from following again.
                else if(target.script&&importedScene?.area===0)follower=new SceneRegionFollower({x:sim.player.position.x,y:-sim.player.position.z,radius:180,lodRadius:1000,includeCollisionBounds:true});
                return;}
              if(flightTransfer){clearTimeout(transferTimer);flightTransfer.reject(new Error(data.message));flightTransfer=undefined;menuBusy(false);hud.menuMessage(data.message);return;}
              const pending=follower?.snapshot().pending;
              if(pending)failFollowing(pending,data.message);
              // The world source failed to open (followId undefined): following goes on, and its next request opens it again.
              else if(data.followId===undefined)hud.menuMessage(`${data.message} The current terrain remains available.`);
              else{follower?.stop();hud.menuMessage(`${data.message} The current terrain remains available.`);}
            }
          },{chunkCacheBytes:worldChunkBudget});
        }
        sceneChannel?.postMessage({ type: 'installed' });
      } catch (error) { localLighting.setModifiers([]); importedScene?.dispose(); importedScene = undefined; hud.menuMessage(error instanceof Error ? error.message : 'Scene installation failed.'); }
      finally { installingScene = false; menuSettled(); }
    };
    if (sceneToken) {
      hud.menuMessage('Waiting for the local imported scene…');
      sceneChannel = new BroadcastChannel(`scene-test-${sceneToken}`);
      sceneChannel.onmessage = ({ data }) => {
        if(data?.type==='region-source-error'){failFollowing(data.followId,data.message);return;}
        if(data?.type==='replace-terrain'){void replaceWalkTerrain(data);return;}
        if (data?.type === 'scene') {bundledProceduralAssets=data.proceduralAssets;void installScene(data);}
      };
      sceneChannel.postMessage({ type: 'ready' });
    } else {
      if(startDownload.done)hud.menuMessage(`Downloading ${included.name}… The first load includes the terrain and character assets.`);else showStartDownload(true);
      // A download that still fails after its own retries offers Retry in the menu: once the connection is back the
      // package is fetched again, without reloading the page. Offline (an installed game opened in a tunnel, the shell
      // from its service worker) it says so, and goes again by itself when the device is back online.
      const loadStartScene=(pack:NonNullable<typeof startScene>['pack'])=>void Promise.all([pack,startScene!.identity]).then(([data,identity])=>{bundledProceduralAssets=data.proceduralAssets;if(identity)data.datasetIdentity=identity;return installScene(data);}).catch(error=>{
        if(!alive)return;
        hud.menuMessage(navigator.onLine===false?`No connection: ${included.name} downloads once the connection is back.`:`${error instanceof Error?error.message:'The included world could not be loaded.'} Check the connection, then retry.`);
        const retry=hud.button('play');retry.hidden=false;retry.disabled=false;retry.textContent='Retry download';
        const again=()=>{window.removeEventListener('online',again);if(!alive||retry.onclick!==again)return;retry.onclick=play;retry.hidden=true;hud.menuMessage(`Downloading ${included.name}…`);loadStartScene(readStartPack(false));};
        retry.onclick=again;window.addEventListener('online',again);
      });
      loadStartScene(startScene!.pack);
    }
  }
  frame = requestAnimationFrame(animate);
  cleanup = () => { sessionCharacterChannel.close(); disposeWater(); disposeSunTexture(); disposeObjectData(); disposeLighting(); characterChannel?.close();
    alive = false; pendingPrebuild?.job.dispose();pendingPrebuild=undefined; progression.save();window.removeEventListener('pagehide',saveProgress);for(const type of ['pointerdown','keydown','input','change','resize'] as const)window.removeEventListener(type,redrawHeld,{capture:true});canvas.removeEventListener('webglcontextrestored',redrawHeld);worldFx.dispose();breakManager.resetAll();breakPieces.dispose();weatherEffects.dispose();movingFog.dispose();birdsMesh.dispose();worldCoronas.dispose();lightPools.dispose();pickups.dispose();drops.dispose();occupants.dispose();sirens.dispose();skids.dispose();wakes.dispose();wantedHud.dispose();weaponView.dispose();weapons.dispose();arsenal.dispose();traffic?.dispose(); police?.dispose(); emergency?.dispose(); driveby?.dispose(); pedestrians?.dispose(); if(fleet)fleet.dispose();else worldCar?.dispose();staticWorld?.dispose();clearTimeout(followTimer);follower?.stop();sceneChannel?.close(); importedScene?.dispose(); cancelAnimationFrame(frame); input.dispose(); sound.dispose(); render.dispose(); sim.dispose();
    window.removeEventListener('touchstart',onTouchStart,{capture:true});window.removeEventListener('touchmove',onTouchMove,{capture:true});for(const type of ['touchend','touchcancel'] as const)window.removeEventListener(type,onTouchEnd,{capture:true});for(const type of ['keydown','mousedown'] as const)window.removeEventListener(type,onKeyOrMouse,{capture:true});upright?.removeEventListener('change',onUpright);window.removeEventListener('popstate',onPopState);document.removeEventListener('fullscreenchange',onFullscreenChange);
    document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onLockChange); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
boot().catch(error => { console.error(error); hud.button('play').textContent = 'Unable to start'; hud.menuMessage(`The game needs a browser with WebGL2 enabled. ${error instanceof Error ? error.message : ''}`); });
if (import.meta.hot) import.meta.hot.dispose(() => { cleanup(); app.replaceChildren(); });
