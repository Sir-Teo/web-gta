import {NativeWeaponAudio} from './audio/native/NativeWeaponAudio';
import {evaluateCarPosition} from './simulation/nativeCarChoice';
import {statUpdateBar,statNameKey} from './ui/nativeStatUpdate';
import {FALLEN_LAMPPOST_SOLVER_GROUPS} from './simulation/solverGroups';
import {gxtHudText,gxtText,insertNumbers} from './assets/gxt';
import {populationOutsideView} from './render/populationVisibility';
import {NativeHunger} from './simulation/nativeHunger';
import {NativeParachuteTimer,WEAPON_PARACHUTE} from './simulation/nativeParachuteTimer';
import {sphereTouchingVehicle} from './vehicle/sphereTouchingVehicle';
import {NativeStatReactions,readActionReactionStats,STAT_BIKE_SKILL} from './simulation/nativeStatReactions';
import {STAT_CALORIES,ScmStats} from './engine/ScmGameState';
import {NativeShinyTexts} from './render/NativeShinyTexts';
import {pedSignalQuad,type ShinyQuad} from './world/nativeShinyTexts';
import {nativeWeaponMovement} from './weapons/nativeWeaponMovement';
import {Progression} from './simulation/Progression';
/** A script heading, degrees clockwise from north, as the yaw the browser turns bodies by. */
const scriptYaw=(degrees:number)=>degrees*Math.PI/180+Math.PI;
/** A script car heading (degrees, 0 facing north) as the body's rotation about the up axis. A car's front is its body's
 * -z, which a rotation of nothing already points north, so the angle is the heading itself; scriptYaw's half turn is for
 * the ped headings, which measure the facing from the renderer's +z. */
const scriptCarRotation=(degrees:number)=>degrees*Math.PI/180;
/** A ped a script made inside a car. It never walks: it rides where the car goes, and the occupant renderer
 * draws it in its seat. CPopulation::AddPedInCar makes one of these rather than a ped on the ground. */
interface ScriptRider{rider:true;model:number|string;car:import('./simulation/WorldCar').WorldCar;
 seat:number|'driver';health:number;heading:number;accuracy:number;invulnerable:boolean;gone:boolean;
 /** Where on the car the ped hangs, in the car's own axes, for one attached rather than seated. */
 offset?:{x:number;y:number;z:number}}
const scriptRiders=new Set<ScriptRider>();
const asRider=(entity:unknown)=>(entity as ScriptRider|undefined)?.rider?entity as ScriptRider:undefined;
/** A script vehicle that is a car (WorldCar) rather than a bike, boat, aircraft or train carriage. */
const isScriptCar=(v:unknown):v is import('./simulation/WorldCar').WorldCar=>!!v&&typeof (v as {setPedInAsDriver?:unknown}).setPedInAsDriver==='function';
/** The riders the occupant renderer should draw this frame. The browser's cars carry a seat point on each
 * side, so a driver and a front passenger are drawn where they sit; a script can seat a ped further back and
 * that ped rides unseen until the models carry rear seat points. A rider whose car has gone stops riding. */
function scriptOccupantPoses(){
 const poses=[];
 for(const rider of scriptRiders){
  if(rider.gone||rider.car.disposed||rider.health<=0){scriptRiders.delete(rider);continue;}
  // The occupant renderer seats peds in cars; a rider on a script bike, boat or aircraft rides unseen for now.
  if(!isScriptCar(rider.car))continue;
  // A ped a script attached hangs where it said, in the car's own axes; a seated one sits at the car's own
  // seat point, and the browser's cars carry one on each side.
  const seat=rider.offset??rider.car.seat(rider.seat==='driver'?'left':'right');
  if(!seat||!rider.offset&&typeof rider.seat==='number'&&rider.seat!==0)continue;
  poses.push({key:`script:${rider.car.car.body.handle}:${rider.offset?'on':rider.seat}`,car:rider.car,
   model:rider.model,local:seat,clip:rider.offset?'car_sit':sitClip(rider.car.modelFlags,rider.seat==='driver'),seconds:0});
 }
 return poses;
}
/** The browser's walking ped behind a script handle, or nothing when the handle names a ped that rides. */
const onFoot=(entity:unknown)=>asRider(entity)?undefined:entity as import('./simulation/WorldPedestrians').Pedestrian|undefined;
import {ActivityJournal} from './ui/ActivityJournal';
import {canPedStepOutCar} from './vehicle/nativeDieInCar';
import {VehicleOccupants} from './render/VehicleOccupants';
import {SirenLights} from './render/SirenLights';
import {Skidmarks} from './render/Skidmarks';
import {BoatWakes} from './render/BoatWakes';
import {CarEntry,nativeRideAnims,nativeSteerOverlay} from './simulation/CarEntry';
import {BikeMount} from './simulation/BikeMount';
import {MODEL_FLAG,sitClip} from './simulation/nativeDoor';
import {WorldPickups} from './simulation/WorldPickups';
import {updatePlayerSwim} from './simulation/playerSwim';
import {vehicleDestroyed} from './simulation/vehicleDestroyed';
import {PLAYER_MOTION_CLIPS,playerMotionGroupToLoad} from './ped/playerMotionGroup';
import {vehicleLightsStatus} from './simulation/nativeVehicleLights';
/** aDriveAnimIdsBoat: the standing boat driver's idle, steering and look back. */
const BOAT_RIDE={idle:'DRIVE_BOAT',left:'DRIVE_BOAT_L',right:'DRIVE_BOAT_R',back:'DRIVE_BOAT_back'};
import {advancePlaneEntry,planeEntrySlots} from './simulation/WorldPlane';
import {WorldPolice,DEFAULT_COP_MODEL} from './simulation/WorldPolice';
import {WEAPONS} from './weapons/catalog';
import {WeaponDrops} from './simulation/WeaponDrops';
import {MoneyDrops} from './simulation/MoneyDrops';
import {nativeWeatherRegion,WEATHER_REGION} from './world/weatherRegion';
import {CRIME,LAW_ENFORCEMENT_MODELS} from './simulation/nativeWanted';
import {GangWars,GANG_COLOURS,attackBlipSprite} from './simulation/GangWars';
import {HeadlightBeams} from './render/HeadlightBeams';
import {FRAME_LIMITER_FPS,MENU_FPS,frameDue,readDisplaySettings,saveDisplaySettings,type FramePacer} from './core/frameLimiter';
import {getUpClip,getUpBlockedBy,isFrontClip,stuckUnderCarDamage,GET_UP_CLEAR_RADIUS} from './ped/nativeGetUp';
import {WaterCannon,initialCannonAim,stepFireTruckAim,cannonDirection,cannonEmission,CANNON_MODELS,CANNON_DEFAULT_NOZZLE,type CannonAim} from './simulation/nativeWaterCannon';
import {initialTankTurret,stepTankTurret,tankShotDirection,tankDefaultMuzzle,TANK_FIRE_INTERVAL_MS,TANK_SHOT_RANGE,TANK_RECOIL,type TankTurret} from './simulation/nativeTankControl';
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
import {WeaponSystem} from './weapons/WeaponSystem';
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
import {Frustum,Matrix4,Quaternion,Sphere,Vector2,Vector3} from 'three';
import {StuntJumps} from './simulation/StuntJumps';
/** Reused aim-direction scratch: WeaponSystem.tick copies it, fire/driveby read it synchronously. */
const scratchAim = new Vector3();
const scratchSpine = new Vector3(),scratchPoolFront = new Vector3(),scratchCameraFront = new Vector3();
import {nativeSaveEffects,type ScmSavePoint} from './assets/scmSavePoints';
import {AE_FRONTEND} from './audio/native/NativeFrontendAudio';
import {HUD_COLOURS} from './ui/nativeHudColours';
import {PICKUP_TYPE} from './assets/scmPickups';
import {Arsenal} from './weapons/Arsenal';
import {WorldTraffic} from './simulation/WorldTraffic';
import {WorldPedestrians,type Pedestrian} from './simulation/WorldPedestrians';
import {PlayerScriptTasks} from './simulation/playerScriptTasks';
import {PlayerPhone} from './simulation/PlayerPhone';
import {ScriptCarMissions} from './simulation/ScriptCarMissions';
import {ScriptObjectViews} from './simulation/ScriptObjectViews';
import {weaponById} from './weapons/catalog';
import {CAR_FIRE_HEALTH} from './simulation/nativeCarDamage';
import {fxIdentity} from './simulation/fx/NativeFx';
import type {WorldCar as ScriptCar} from './simulation/WorldCar';
type WorldCarPad=ScriptCar['pad'];
import {nativeDayNightBalance} from './world/nativeDayNight';
import {StaticWorldProvider} from './assets/StaticWorldProvider';
import {modelBuildStats} from './assets/ModelObjects';
import {rehydrateResidentParts,residentModelsOf,type ResidentModel} from './assets/residentModels';
import {includedScene} from './assets/includedScenes';
import {SceneRegionFollower} from './assets/sceneRegionFollower';
import {readSurfaceMovementFlags,steepSlopeRefusesJump,surfaceBlocksSprint} from './simulation/nativeSurfaceMovement';
import {rapierClimbWorld} from './simulation/climbProbe';
import {WEAPON_FLAG} from './weapons/weaponData';
import {firstPersonMode} from './weapons/nativeFirstPerson';
import {loadHudSprites} from './ui/nativeHudSprites';
import {PLAYER_IDLE_CLIPS,PlayerIdles,loadPlayerIdles} from './assets/playerIdles';
import {CLIMB_CLIPS,testForClimb} from './ped/nativeClimb';
import {worldZoneAt} from './assets/worldZones';
import {NativePlaceName} from './ui/nativePlaceName';
import {inPhotograph} from './weapons/nativePhotograph';
import {stepStamina} from './locomotion/player';
import {pickupCategory} from './assets/scmPickups';
import {readSurfaceAudio,nativeFootstepCategory,wadingSurface} from './assets/surfaceAudio';
import {nativeAudioCamera,worldCarAudioInput,worldPlaneAudioInput} from './audio/native/worldVehicleAudio';
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
import { AudioSystem } from './audio/AudioSystem';
import { FixedClock } from './core/FixedClock';
import { Input } from './input/Input';
import { LocalTimecycle, visionLighting } from './world/LocalTimecycle';
import { bindLocalLighting } from './ui/localLighting';
import {bindLocalObjectData} from './ui/localObjectData';
import {bindLocalSunTexture} from './ui/localSunTexture';
import { NativeMap } from './ui/NativeMap';
import { Hud } from './ui/Hud';
import { NativeGameLogic, STAT_DAYS_PASSED_IN_GAME, type GameLogicWorld, type SkipWorld } from './simulation/nativeGameLogic';
import { LEVEL_COUNTRYSIDE, NativeRestart } from './simulation/nativeRestart';
import { ScmCameraFade } from './engine/ScmCameraFade';
import { NativeBirds, sampledDistanceToWater } from './world/nativeBirds';
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
import {fireGlow,missileGlow} from './combat/nativeFireGlow';
import {NativePermanentShadows,explosionScorch} from './render/nativePermanentShadows';
import {NativeCullZones,fewerPedsLimits} from './world/nativeCullZones';
import {heldPadActions,padStateFromActions} from './input/nativePadState';
import {NativeHudBigMessages} from './ui/nativeHudBigMessages';
import {ScriptCarRecordingStore} from './simulation/scriptCarRecordings';
import {recordingVehicle} from './simulation/recordingBody';
import {startPlaybackRecordedCar} from './engine/carRecordingPlayback';
import {WorldTrain} from './simulation/WorldTrain';
import {layoutMenu} from './ui/nativeHudMenus';
import {applyStoredSwitches,markRoadNodeAsDontWander,switchRoadsOffInArea,unmarkAllRoadNodesAsDontWander} from './simulation/nativePathSwitches';
import {pathAreaLoaded,pathAreaMaps} from './assets/worldPaths';
import {findCaboose,findCarriage,setTrainCruiseSpeed,setTrainSpeed} from './simulation/nativeTrain';
import {VEHICLE_AIR_RESISTANCE_MULT,cullAirResistance} from './simulation/nativeAirResistance';
import {PED_ORIGIN_HEIGHT,SWIM} from './simulation/nativeSwim';
import { coronaLookMask } from './render/cameraLook';
import { NativeDuckMove, playerDuckMove } from './locomotion/nativeDuck';
import { ENEX, EntryExitManager, entryExitPosition, findValidTeleportPoint, type EntryExitTransition } from './world/nativeEntryExits';
import { worldLevelAt } from './assets/worldZones';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const canvas = document.createElement('canvas'); canvas.className = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'San Andreas game world'); app.append(canvas);
const hud = new Hud(app); hud.setMenu(true);
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
  const startScene=walkDemo?{
    pack:import('./assets/scenePack').then(({readScenePack})=>{
      const url=new URL(`${import.meta.env.BASE_URL}play/${included.file}`,location.href).href,early=(window as {__startScenePack?:{url:string;response:Promise<Response>}}).__startScenePack;
      return readScenePack(url,early?.url===url?early.response:undefined);
    }),
    // The start package was published from the same archive the worker streams: installing it under the archive's
    // identity lets the first streamed window borrow its colliders, textures and model sources like every later one.
    identity:fetch(`${import.meta.env.BASE_URL}play/world/manifest.json`).then(r=>r.ok?r.json():undefined).then(m=>typeof m?.archive?.sha256==='string'?`static-world:${m.archive.sha256}`:undefined).catch(()=>undefined),
  }:undefined;
  startScene?.pack.catch(()=>{});
  /** Settles once the start package has arrived (or failed): the boot's own archive readers wait for it, so they no
   * longer share the connection with the download the play button waits on. */
  const afterStartPackage:Promise<void>=startScene?startScene.pack.then(()=>{},()=>{}):Promise.resolve();
  // The world's chunks are kept in Cache Storage across sessions; ask that the browser not evict them under pressure.
  void navigator.storage?.persist?.().catch(()=>false);
  // Show the menu immediately, while the renderer and WASM load independently.
  const [{ Simulation }, { GameRenderer }, { default: RAPIER }, {sampleNativeGroundLighting}] = await Promise.all([
    import('./simulation/Simulation'), import('./render/Renderer'), import('@dimforge/rapier3d-compat'), import('./simulation/nativeContactLighting'),
  ]);
  await RAPIER.init();
  const navigation=walkDemo?new NativeMap(hud.element):undefined;
  const importedMode = true;
  const sim = new Simulation();
  const flightInstruments=document.createElement('div');flightInstruments.className='flight-instruments';flightInstruments.hidden=true;hud.element.append(flightInstruments);
  let worldCar:ScriptCar|undefined;
  /** The player riding a car as a passenger (WARP_CHAR_INTO_CAR_AS_PASSENGER): the car and its seat (1 front right,
   * 2 rear left, 3 rear right). The car goes on under its own driver, AI or recording. */
  let playerPassenger:{car:ScriptCar;seat:1|2|3}|undefined;
  /** The passenger steps out on his own side: his seat's point carried out past the body, set down on the ground. */
  const leavePassengerSeat=(inPlace=false)=>{
   const ride=playerPassenger;if(!ride)return;playerPassenger=undefined;
   // A car deleted under him (CVehicle's destructor flags its passengers, and CPed::FlagToDestroyWhenNextProcessed
   // clears the player's vehicle and leaves him where he sat): he drops from where the car was.
   if(inPlace||ride.car.disposed){
    const at=sim.player.position,hit=sim.world.castRay(new RAPIER.Ray({x:at.x,y:at.y+2,z:at.z},{x:0,y:-1,z:0}),8,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    ride.car.setPlayerOutAsPassenger({x:at.x,y:hit?at.y+2-hit.timeOfImpact+.03:at.y,z:at.z});return;
   }
   const local=carEntry.passengerSeat(ride.car,ride.seat),side=ride.seat===2?-1:1;
   const bounds=ride.car.assets.collision.bounds,x=side*(Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0]))+.6);
   const w=ride.car.worldPoint({x,y:local?.y??0,z:local?.z??0}),top=w.y+2;
   const hit=sim.world.castRay(new RAPIER.Ray({x:w.x,y:top,z:w.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   ride.car.setPlayerOutAsPassenger({x:w.x,y:hit?top-hit.timeOfImpact+.03:w.y-.5,z:w.z},ride.car.heading());
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
  let traffic:WorldTraffic|undefined;
  let police:WorldPolice|undefined;
  let driveby:import('./simulation/GangDriveBy').GangDriveBy|undefined;
  let pedestrians:WorldPedestrians|undefined;
  let fleet:import('./simulation/WorldFleet').WorldFleet|undefined;
  let worldZones:import('./assets/worldZones').WorldZones|undefined;
  const placeName=new NativePlaceName();
 // CTheScripts running the original MAIN.SCM, started once the world source hands over the script.
 let mission:import('./simulation/ScmMission').ScmMission|undefined;
 // The script's tasks on CJ's own ped (TASK_GO_STRAIGHT_TO_COORD, TASK_PLAY_ANIM... on scplayer).
 /** The cutscene skip button this frame, and the keys it reads as they were last frame. */
 let cutsceneSkipNow=false,skipKeysLast={enter:false,space:false};
 /** The player's car while a script's driving task has it. */
 let scriptDrivenCar:ScriptCar|undefined;
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
    leavePassengerSeat();return 'none';
   }
   const car=carEntry.car;
   if(!carEntry.seated||!car)return 'none';
   if(vehicle!==undefined&&mission?.vehicles.entity(vehicle)!==car)return 'none';
   // CTaskSimpleCarWaitToSlowDown: the script's sensible leave waits for the car to be still enough to step out of.
   if(!immediately&&!car.canStepOut())return 'wait';
   return carEntry.exit()?'started':'wait';
  },
  carState:()=>carEntry.seated?'seated':carEntry.active?'entering':'none',
  // The player's driving tasks: the car he sits in, the one the script names, drives on its autopilot.
  startCarTask:order=>{
   const car=carEntry.seated?carEntry.car:undefined;
   if(!car||mission?.vehicleByHandle(order.vehicle)!==car)return false;
   car.scriptDriven=true;scriptDrivenCar=car;
   if(order.kind==='carTempAction')scriptCars.tempAction(car,order.action,order.seconds);
   else scriptCars.gotoCoords(car,{x:order.x,y:order.z>-100?order.z:car.car.body.translation().y,z:-order.y},{cruise:order.cruise,style:order.style,accurate:order.accurate,straight:order.straight});
   return true;
  },
  carTaskRunning:()=>!!scriptDrivenCar&&!scriptDrivenCar.disposed&&scriptDrivenCar.occupied&&(scriptCars.driving(scriptDrivenCar)||scriptCars.inTempAction(scriptDrivenCar)),
  endCarTask:()=>{const car=scriptDrivenCar;scriptDrivenCar=undefined;if(!car)return;car.scriptDriven=false;scriptCars.forget(car);car.autopilot=undefined;},
  lookAtPoint:(x,y,z,seconds)=>{pedestrians?.playerLookAtPoint({x,y:z,z:-y},seconds);},
  die:()=>{sim.killPlayer();},
  lookAt:(target,seconds)=>{const ped=onFoot(mission?.pedByHandle(target));if(ped&&typeof ped==='object')pedestrians?.playerLookAtPed(ped,seconds);},
  placeOnGround:(x,z,originY)=>{
   const ground=pedestrians?.groundUnder(x,z,(originY??sim.player.position.y+1+50)+.5);if(ground===undefined)return;
   sim.player.position={x,y:ground,z};sim.player.previous={x,y:ground,z};
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
 scriptCars.player=()=>({position:sim.player.position,vehicle:worldCar?.occupied?worldCar:undefined,velocity:{x:sim.lastMove.velocity.x,y:0,z:sim.lastMove.velocity.z}});
 // HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE and FREEZE_CHAR_POSITION on the player.
 let playerWeaponHiddenByScript=false,playerFrozenByScript=false,playerAreaCode=0;
 // CTaskComplexUseMobilePhone on the player and on the script's peds.
 const phones=new Map<unknown,PlayerPhone>();
 const phoneFor=(key:unknown)=>{let phone=phones.get(key);if(!phone){phone=new PlayerPhone(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,(file,name)=>pedestrians?.scriptAnimation(file,name)??Promise.resolve(undefined));phones.set(key,phone);}return phone;};
 const playerTaskBody=()=>({position:sim.player.position,heading:sim.player.heading,speed:sim.player.speed,onFoot:sim.playerCollider.isEnabled(),view:render.nativeCharacter});
 let lastGameFrame=0;
 /** TheText (text/american.gxt). */
 let theText:import('./assets/gxt').NativeText|undefined;
 void import('./assets/gxt').then(m=>m.loadNativeText(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(t=>{theText=t;}).catch(e=>console.error('AMERICAN.GXT failed to load',e));
  let wasRiding=false;
  let tankTurret:TankTurret=initialTankTurret(),tankLastFire=-Infinity;
  let cannonAim:CannonAim=initialCannonAim(),cannonFrame=0,cannonClock=0,cannonFiring=false;const waterCannon=new WaterCannon();
  let gangWars:GangWars|undefined,gangWarBlip:{position:{x:number;y:number;z:number};gang:number;visible:boolean}|undefined;
  let worldGenerators:import('./assets/worldCarGenerators').WorldCarGenerator[]=[];
  let stuntJumps:StuntJumps|undefined,savePoints:ScmSavePoint[]=[],saving=false;
  let savedTransfer:{x:number;y:number;z:number;heading:number;quiet?:boolean}|undefined;
  /** CEntryExitManager and the teleport CEntryExit::TransitionFinished waits on while the spawn point's area streams. */
  let entryExits:EntryExitManager|undefined,interiorTransfer:EntryExitTransition|undefined;
  let importedScene: ReturnType<typeof import('./simulation/nativeScene').installNativeScene> | undefined;
  let surfaceSprint:Map<number,boolean>|undefined,surfaceClimbable:Map<number,boolean>|undefined,surfaceSteep:Map<number,boolean>|undefined;
  let surfaceSprintBlocked=false;
  /** The fire button got through to an aimed gun this step (m_LastCmd FIRE for CTaskSimpleUseGun::SetMoveAnim). */
  let gunFiring=false;
  let surfaceAudio: ReturnType<typeof readSurfaceAudio> | undefined;
  let roadSurfaces:Awaited<ReturnType<typeof import('./assets/worldRoadMaterials').loadWorldRoadMaterials>>|undefined;
  const render = new GameRenderer(canvas, sim);
  const occupants=new VehicleOccupants(render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
  const sirens=new SirenLights(render.scene);
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
  carEntry.onDriverOut=(car,position,heading)=>{law.registerCrime(CRIME.carSteal,`car:${car.car.body.handle}`);pedestrians?.spawnJacked(occupants.driverModel(car),position,heading,car.gang,{position:()=>{const t=car.car.body.translation();return {x:t.x,y:t.y,z:t.z};}},VEHICLE_ANIM_GROUP_TABLES[car.animGroup.id]?.file==='coach');};
  const law=new WantedSystem(),wantedHud=new WantedHud(hud.element);
  // CGameLogic::Update drives the wasted and busted sequences over the native
  // CRestart tables; the simulation's own timer only releases the seat.
  const nativeRestart=new NativeRestart(),gameLogic=new NativeGameLogic(nativeRestart),cameraFade=new ScmCameraFade();
  sim.externalDeathRecovery=true;
  let arrested=false,gameTimeMs=0,previousGameTimeMs=0,gameTimeExact=0;
  /** The script messages last handed to the HUD, by label and creation time. */
  const shownScript={brief:'',big:['','','','','','',''],help:'',helpRevision:0};
  hud.messageClock=()=>gameTimeMs;
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
  sim.neverTired=()=>!!mission?.runtime.game.playerInfo.doesNotGetTired;
  sim.indoors=()=>render.lighting.area!==0;
  // CPlayerInfo::m_bFastReload, which SET_PLAYER_FAST_RELOAD sets on the script's player info.
  weapons.inventory.fastReload=()=>!!mission?.runtime.game.playerInfo.fastReload;
  let progressStorage:Storage|undefined;try{progressStorage=localStorage;}catch{}
  const progression=new Progression(weapons.inventory,sim,progressStorage),journal=new ActivityJournal(hud.element,progression);
  progression.onReward=(name,reward)=>hud.message(`${name} completed · +$${reward}`);weapons.onHit=id=>progression.hit(id);
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
    wantedLevel:()=>law.level,setWantedLevel:level=>law.setLevel(level),armour:()=>sim.player.armour,setArmour:value=>{sim.player.armour=value;},
    maxHealth:()=>mission?.runtime.game.playerInfo.maxHealth??100,maxArmour:()=>mission?.runtime.game.playerInfo.maxArmour??100,
    // CPickups::GivePlayerGoodiesWithPickUpMI: the jetpack hands the player its task, unless he already wears one.
    onJetPack:()=>{if(sim.jetPack)return false;sim.startJetPack();sound.frontend(AE_FRONTEND.pickupInfo);return true;},
    // PSAVE1: the save menu runs, the screen fades and the player is put back beside the disc facing its heading.
    onSave:pickup=>{
      if(saving||paused)return;
      // CPickup::Update takes the save disk only when CPlayerPed::CanPlayerStartMission: the game playing, the player
      // alive and in control, no physical response (a knockdown, a fall), no primary task (climbing, swimming, the
      // jetpack, a car entry) and no attack (aiming or a weapon mid-use).
      if(gameLogic.state!==0||sim.player.health<=0||law.arrested||sim.knockdown>0||!sim.player.grounded||sim.climb||sim.player.swimming||sim.jetPack||carEntry.active||weapons.aiming||weapons.inventory.cooldown>0)return;
      const point=savePoints.filter(p=>Math.hypot(p.pickup[0]-pickup.position[0],p.pickup[1]-pickup.position[1],p.pickup[2]-pickup.position[2])<2)[0];
      if(!point)return;
      saving=true;hud.fade(true,1000);
      window.setTimeout(()=>{
        if(!alive)return;
        const effects=nativeSaveEffects({health:sim.player.health,maxHealth:mission?.runtime.game.playerInfo.maxHealth??100,timeMinutes:sim.timeMinutes});
        // DoGameSpecificStuffBeforeSave: the six hours pass on a full stomach.
        hunger.hoursDidntEat=0;
        // CGameLogic::PassTime hands CPickups::PassTime a second of timer for each game minute.
        sim.player.health=effects.health;sim.passTime(effects.passedMinutes);pickups.passTime(effects.passedMinutes);
        law.setLevel(effects.wanted);sim.player.stamina=effects.stamina;sim.player.sprintExhausted=false;
        // SET_CHAR_HEADING takes degrees where 0 faces north, so the browser heading is the native angle turned around.
        const heading=(point.heading*Math.PI/180+Math.PI)%(Math.PI*2),position={x:point.respawn[0],y:point.respawn[2],z:-point.respawn[1]};
        sim.player.position={...position};sim.player.previous={...position};sim.player.heading=heading;
        sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
        render.yaw=heading+Math.PI;
        progression.savedLocation={x:position.x,y:point.respawn[1],z:position.y,heading,timeMinutes:sim.timeMinutes,weekDay:sim.weekDay};progression.save();
        hud.fade(false,1000);hud.message('Game saved.');
        window.setTimeout(()=>{saving=false;},500);
      },1000);
    },
    onCollect:(pickup,message)=>{
      // A pickup the script made is collected for the script too, which is what it asks after.
      if(pickup.section==='script'&&mission){const handle=Number(pickup.id.slice('script:'.length));if(Number.isInteger(handle))mission.collectScriptPickup(handle);}if(!paused)sound.nativeEngine?.pickup(pickup.category,pickup.type);progression.recordCollect(pickup.category);if(message){
        // CGarages::TriggerMessage of HO_, OY_ and SN_ONE with the counts in its ~1~s, or the _ALL line.
        const [code,count]=message.split(' '),name=/^(HO|OY|SN)_(ONE|ALL)$/.test(code)?PICKUP_TEXT[code.slice(0,2)]:undefined;
        hud.message(!name?message:gxtHudText(code.endsWith('_ALL')?gxtText(code,`All ${name.toLowerCase()} found!`):insertNumbers(gxtText(code,`${name} ~1~ out of ~1~`),...count.split('/').map(Number))),5000);}progression.save();},
    onNotice:(_pickup,text)=>hud.help(text),
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
     else if(loaded(22)||loaded(26)){const handgun=[...inv.owned].find(id=>id!==0&&inv.slotOf(id)===inv.slotOf(22));if(handgun!==undefined)inv.select(handgun);else jetWeaponHidden=true;}
     else jetWeaponHidden=true;
     void weaponView.equip(inv.selected);
    }else if(!sim.jetPack&&jetSavedWeapon!==undefined){inv.select(jetSavedWeapon);jetSavedWeapon=undefined;jetWeaponHidden=false;void weaponView.equip(inv.selected);}
  };
  weaponView.visible=()=>!playerWeaponHiddenByScript&&!render.scriptPlayerHidden&&!phones.get('player')?.active&&!jetWeaponHidden&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!sim.player.swimming&&(!carEntry.active||carEntry.phase==='approach');
  weapons.muzzle=left=>weaponView.muzzle(left);
  weapons.playerMove=()=>{const view=render.nativeCharacter;return view&&{blendRatio:view.moveBlendRatio,sprinting:view.sprinting};};
  const worldFx=new WorldFx(render.scene,sim,render.camera);
  worldFx.collisionSources=()=>importedScene?.sources;weapons.fires.onSteam=(p,rise)=>worldFx.fireSteam([p.x,p.y,p.z],rise);worldFx.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
  weapons.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
  void afterStartPackage.then(()=>worldFx.load(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href)).then(()=>{if(alive&&worldFx.ready)weapons.fx=worldFx;}).catch(error=>{worldFx.error=String(error);});
  // CCamera::Find3rdPersonCamTargetVector: third-person shots go through the crosshair at (0.53, 0.4) of the screen;
  // the sniper scope aims down the middle.
  const aimDirection=()=>render.scoped?render.camera.getWorldDirection(scratchAim):scratchAim.set(.06,.2,.5).unproject(render.camera).sub(render.camera.position).normalize();
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
  const gameLogicWorld:GameLogicWorld={
   setPadCamera:held=>{skipPadCamera=held;},
    playerOnAMission:()=>!!mission?.playerOnAMission(),
   isPlayerDead:()=>sim.player.health<=0,
   isPlayerArrested:()=>arrested,
   // CGameLogic::Update takes the restart query from outside the door CJ came in by (GetPositionRelativeToOutsideWorld).
   playerPosition:()=>entryExits?entryExits.positionRelativeToOutsideWorld(nativePlayerPosition()):nativePlayerPosition(),
   wantedLevel:()=>law.level,
   isFading:()=>cameraFade.fading,
   fade(direction,seconds){cameraFade.fade(seconds*1000,direction,gameTimeMs);hud.fade(direction===0,seconds*1000);},
   // The browser crosshair follows the aiming state, so there is none to clear.
   clearCrossHairs(){},
   clearMessages(){hud.message('');},
   resetWastedText(){hud.whiteMiddleMessage('');},
   punish(fee){sim.money=Math.max(0,sim.money-fee);weapons.inventory.strip();void weaponView.equip(0);progression.failEscape();progression.save();},
   showWastedMessage(){hud.whiteMiddleMessage('wasted',4000);},
   showBustedMessage(){hud.whiteMiddleMessage('busted',5000);},
   // CGameLogic::PassTime: the clock and weekday, the days-passed stat, CClock::SetGameClock (which counts a day
   // for any weekday it is given, midnight or not), then CPickups::PassTime.
   passTime(minutes){
    const days=sim.passTime(minutes),game=mission?.runtime.game;
    if(days>0)game?.stats.increment(STAT_DAYS_PASSED_IN_GAME,days);
    const whole=Math.floor(sim.timeMinutes);game?.clock.setGameClock(Math.floor(whole/60),whole%60,sim.weekDay,gameTimeMs);
    pickups.passTime(minutes);
   },
   incrementStat:(stat,value)=>{mission?.runtime.game.stats.increment(stat,value);},
   endGangWar:()=>{gangWars?.endGangWar(false);},
   resurrect(result){
    arrested=false;law.clear();
    // RestorePlayerStuffDuringResurrection: back to the normal world (area 0) with an empty door stack. From an
    // interior the outside world at the restart point has to stream in first, as a save point's does.
    const inside=render.lighting.area!==0;entryExits?.clearStack();
    sim.respawn={x:result.position[0],y:result.position[2]+1,z:-result.position[1]};
    sim.resetPlayer();
    // RestorePlayerStuffDuringResurrection: health back to CPlayerInfo::m_nMaxHealth.
    sim.player.health=mission?.runtime.game.playerInfo.maxHealth??100;
    // CGameLogic::Update's restart: m_nNumHoursDidntEat = 0 after the twelve hours pass.
    hunger.hoursDidntEat=0;
    rebuildPlayerIfNeeded();
    sim.player.heading=(result.heading*Math.PI/180+Math.PI)%(Math.PI*2);
    render.yaw=sim.player.heading+Math.PI;input.clear();
    if(inside&&staticWorld&&!savedTransfer){
     follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;
     savedTransfer={x:result.position[0],y:result.position[1],z:result.position[2]+1,heading:sim.player.heading,quiet:true};
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
  const playerControlsDisabled=()=>mission?.playerControl===false||skipPadCamera;
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
     sim.player.position={x,y:ground,z:-y};sim.player.previous={...sim.player.position};sim.player.speed=0;
     sim.playerBody.setTranslation({x,y:ground+.9,z:-y},true);sim.playerBody.setNextKinematicTranslation({x,y:ground+.9,z:-y});sim.playerCollider.setTranslation({x,y:ground+.9,z:-y});
    }
    fleet?.generateEvenIfClose();
   },
   playerPosition:()=>nativePlayerPosition(),
   passTime:minutes=>gameLogicWorld.passTime(minutes),
  };
  const arsenal=new Arsenal(hud.element,weapons);
  void afterStartPackage.then(()=>loadHudSprites(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,['siteM16','siterocket','radardisc','radar_north','radar_centre','radar_waypoint','radarRingPlane','fist','skipicon',...NativeMap.blipSpriteNames()])).then(sprites=>{arsenal.hudSprites=sprites;navigation?.setRadarSprites(sprites);hud.fistIcon=sprites.fist;hud.skipIcon=sprites.skipicon;}).catch(()=>{});
  arsenal.onSelect=id=>{void weaponView.equip(id);};
  arsenal.onToggle=open=>{input.clear();sound.setPlaying(!paused&&!open&&!navigation?.open);};
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
      timeStep:Math.min(3,Math.max(1,cloudFrames)*50/30),farClip:camera.far,outside:render.lighting.area===0});
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
     if(g.splash)worldFx.waterCannon.splash([g.splash.point.x,g.splash.point.y,g.splash.point.z],[g.splash.normal.x,g.splash.normal.y,g.splash.normal.z],1000/60,Math.random);}
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
  /** Each streamed window carries the same vegetation package; it is parsed once. */
  const readSceneVegetationOnce=sceneVegetationReader();
  // The sample fallback for combat sounds (banks 52 and 143) only plays without the native engine, which loads the
  // same two banks itself: fetch it only if the engine could not load, instead of downloading them twice.
  // The engine's banks (about 5 MB) are needed once play starts, not to show the menu: download them after the start
  // package has arrived instead of alongside it.
  void (startScene?.pack.catch(()=>{})??Promise.resolve()).then(()=>sound.loadNativeAudio(new URL(`${import.meta.env.BASE_URL}play/audio/`,location.href).href)).then(loaded=>{if(!loaded)void sound.loadNativeCombat(new URL(`${import.meta.env.BASE_URL}play/audio/`,location.href).href);});
  const hornInput=new NativeHornInput();sound.setPlayer(()=>({...sim.player.position,y:sim.player.position.y+1}));
  sound.reset(sim);
  // Open the (suspended) output device while the menu waits, not inside the click that starts play.
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>sound.prepare(),{timeout:4000});else setTimeout(()=>sound.prepare(),1000);
  if(navigation)navigation.onToggle=open=>{input.clear();sound.setPlaying(!paused&&!open);};
  hud.bindAudio(sound.settings, settings => sound.setSettings(settings));
  // The PC original's frame limiter (on by default): display frames pace at 30 a second over the 60 Hz simulation.
  const display=readDisplaySettings(),pacer:FramePacer={lastDrawn:0};
  hud.bindDisplay(display,settings=>{display.frameLimiter=settings.frameLimiter;saveDisplaySettings(display);});
  const clock = new FixedClock();
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
  const placementKey=(model:string,[x,y,z]:readonly number[])=>`${model.toLowerCase()}:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`;
  /** Placements whose object has m_bRenderDamaged (or has gone), by lowercased model: their lights stay off. */
  const damagedLights=new Map<string,[number,number,number][]>();
  const markLightDamaged=(model:string,position:readonly number[])=>{const key=model.toLowerCase(),list=damagedLights.get(key)??[];list.push([position[0],position[1],position[2]]);damagedLights.set(key,list);};
  const lightIsDamaged=(model:string|undefined,m:readonly number[])=>!!model&&!!damagedLights.get(model)?.some(p=>Math.abs(p[0]-m[12])<.05&&Math.abs(p[1]-m[13])<.05&&Math.abs(p[2]-m[14])<.05);
  const reapplySmashedProps=(scene:NonNullable<typeof importedScene>)=>{
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
    }
  };
  const fallenLampPosts=new Set<number>();
  const LAMP_POST_MODELS=new Set(['mtraffic1','vgsstriptlights1','mtraffic2','lamppost1','lamppost2','lamppost3','doublestreetlght1','mlamppost']);
  const isLampPost=(model:string,flags:number)=>LAMP_POST_MODELS.has(model.toLowerCase())||(flags&0x1800)!==0;
  /** Collider handles are never reused (Rapier encodes a generation), so the states of colliders a window swap
   * retired would stay for the rest of the session: keep only those the installed window still owns. */
  const prunePropStates=(scene:NonNullable<typeof importedScene>)=>{
    for(const handle of propStates.keys())if(!scene.sources.has(handle))propStates.delete(handle);
    for(const handle of glassStates.keys())if(!scene.sources.has(handle))glassStates.delete(handle);
  };
  /** Props removed by collisions, newest last, for the dev probe. */
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
      lampPost:isLampPost(source.modelName,scene.placementInfo(other.handle)?.part.definition?.flags??0),turnMass:physics.turnMass,elasticity:physics.elasticity,state,
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
        smashedProps.push({model:source.modelName,position:[x,y,z]});smashedPlacements.add(placementKey(source.modelName,[x,y,z]));movedPlacements.delete(placementKey(source.modelName,[x,y,z]));
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
  /** CTagManager, from the world's IPLs once the world worker is ready. */
  let tagManager:NativeTagManager|undefined,tagScene:unknown;
  weapons.onSprayPaint=(point,radius)=>{if(!tagManager)return undefined;const state=tagManager.sprayPaint(point,radius,(key,alpha,message)=>{
    importedScene?.setTagAlpha(key,alpha);progression.tags=tagManager!.saved();
    // CGarages::TriggerMessage("TAG_ONE"/"TAG_ALL") for 5 s, not in widescreen, with the counts put in its ~1~s.
    if(message&&!mission?.runtime.game.widescreenOn)hud.message(gxtHudText(message.message==='TAG_ALL'?gxtText('TAG_ALL','All tags sprayed!'):insertNumbers(gxtText('TAG_ONE','Tags sprayed~n~~1~ out of ~1~'),message.tagged,message.total)),5000);
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
    const atomic=part.model.atomics[0],info=atomic&&part.model.geometries[atomic.geometry]?.breakable;
    const bounds=part.collision?.bounds;if(!info||!bounds)return;
    const m=nativePlacementMatrix(placement).elements,ambient=render.lighting.nativeWorldAmbient;
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
    for(const texture of part.textures)if(wanted.has(texture.name.toLowerCase())&&!textures.has(texture.name.toLowerCase()))textures.set(texture.name.toLowerCase(),nativeTexture(texture));
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
    sim.knockdown=1+getUp;sim.knockdownGetUp=playerGetUp=getUp;
  };
  /** CEventDamage on the player: ComputeDamageAnim flinches, knockdowns through CTaskComplexFallAndGetUp
   * (fall, a second on the ground, get up), and ComputeDeathAnim when the hit kills. */
  let playerHitAnimDelay=0,playerDamageAnimId=-1,playerGetUp=0,playerFallClip:string|undefined,playerStuckUnderCar=false;const playerDamageRandom=new WindowsCrtRandom(1);
  /** Records the clip the player fell with and returns the length of the get-up it calls for (CTaskSimpleGetUp). */
  const playerFall=(view:import('./render/NativeCharacter').NativeCharacter|undefined,clip:string)=>{playerFallClip=clip;return view?.reactionDuration(getUpClip(clip))??1.2;};
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
    if(sim.player.health>0&&playerDied){playerDied=false;view?.clearReaction();}
    // CTaskSimpleInAir's FALL_FALL while CJ drops, then CTaskComplexInAirAndLand's landing of it: FALL_COLLAPSE, or
    // after the fastest falls CTaskSimpleFall's KO_SKID_BACK for 700 ms and the get-up.
    if(view&&sim.player.health>0){
      if(sim.fall.falling&&!sim.player.grounded&&!sim.player.swimming&&view.hasReaction('fall_fall')&&!view.reactionName)view.playReaction('fall_fall',Infinity);
      else if(view.reactionName==='fall_fall'&&(sim.player.grounded||sim.player.swimming)&&!sim.fallLanding)view.clearReaction();
      const landing=sim.fallLanding;sim.fallLanding=undefined;
      // CTaskSimpleFall counts its 700 ms down only once the clip has finished.
      if(landing==='knockdown'&&view.hasReaction('ko_skid_back')){const fall=view.reactionDuration('ko_skid_back')??1,getUp=playerFall(view,'ko_skid_back');sim.knockdown=fall+.7+getUp;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction('ko_skid_back',fall+.7);}
      else if(landing==='collapse'&&view.hasReaction('fall_collapse')){const d=view.reactionDuration('fall_collapse')??1;view.playReaction('fall_collapse',d);sim.knockdown=d;sim.knockdownGetUp=0;}
    }
    if(playerGetUp&&sim.knockdown<=playerGetUp&&view){
      // CTaskSimpleGetUp::StartAnim: a car over the origin sphere keeps CJ down (bStuckUnderCar) and runs him over for
      // the time step a frame; otherwise the get-up matching the fall clip's ANIMATION_IS_FRONT flag plays.
      if(sim.player.health>0&&getUpBlockedBy(carOverPlayer()?{bike:false,standingOn:false,attached:false}:undefined)){
        playerStuckUnderCar=true;sim.knockdown=playerGetUp;view.holdReaction();sim.damagePlayer(stuckUnderCarDamage(dt*50,true),false,{weapon:WEAPON.runOverByCar});
      }else{playerStuckUnderCar=false;view.playReaction(getUpClip(playerFallClip),playerGetUp,true);playerGetUp=0;}
    }
    for(const event of sim.damageEvents.splice(0)){
      if(!view)continue;
      // Weapons take GetLocalDirection toward the attacker (Weapon.cpp DoBulletImpact); a blast takes it from the blast
      // toward the victim (CWorld::TriggerExplosionSectorList's impactVelocity).
      const p=sim.player.position,away=event.weapon===WEAPON.explosion?-1:1,direction=event.from?browserLocalDirection(sim.player.heading,(event.from.x-p.x)*away,(event.from.z-p.z)*away):0;
      const moveState=sim.player.speed<.1?PEDMOVE.still:sim.player.speed<3?PEDMOVE.walk:sim.player.speed<7?PEDMOVE.run:PEDMOVE.sprint;
      const victim={player:true,inVehicle:false,moveState,fallingOrGettingUp:sim.knockdown>0,standing:sim.player.grounded,hitAnimDelayUntil:playerHitAnimDelay,driving:false};
      if(event.died){
        playerDied=true;
        // ComputeDeathAnim's floor branch has no player test: CJ killed while he falls or lies (head below his root)
        // takes FLOOR_HIT, or FLOOR_HIT_F on his front.
        const lying=sim.knockdown>sim.knockdownGetUp;
        const death=computeDeathAnim({weapon:event.weapon,pedPiece:event.piece??PED_PIECE.torso,direction,health:0,damageArmour:event.armour,damageHealth:event.health,victim:{...victim,headBelowRoot:lying,lyingOnFront:lying&&isFrontClip(playerFallClip)},source:{ped:true},megaPunch:megaPunchBlow(event.weapon),nextRandom:()=>playerDamageRandom.next()});
        const clip=death.clip&&view.hasReaction(death.clip)?death.clip:'ko_shot_front';view.playReaction(clip,Infinity);
        knockPlayer(death.force,event.from);
        continue;
      }
      if(sim.knockdown>0)continue;
      // A cop's nightstick finisher (melee.dat FALL_3) floors CJ only from the front: ComputeDamageAnim's combo branch,
      // FIGHT_HIT_1 + move from the bat group with the fall (that group's Bat_Hit clips are not on CJ; the knockout
      // stands in). From another side it is an ordinary hit.
      // WEAPON_EXPLOSION (51) takes ComputeDamageAnim's ordinary branch (no fall: it is past WEAPON_CHAINSAW, no fight):
      // HIT_FRONT + direction, or HIT_WALK over 20 damage; the blast's own push throws CJ.
      if(event.fall&&(event.weapon!==WEAPON.nightstick||direction===0)){
        // TriggerExplosionSectorList lifts a standing ped (bIsStanding false, 4 up): it falls with the
        // blast's knockout clip for the direction and gets up.
        // A car strike (KillPedWithCar's lesser branch) falls the same way with the ramming clips.
        const blast=computeDeathAnim({weapon:event.weapon,pedPiece:PED_PIECE.torso,direction,health:0,damageArmour:0,damageHealth:event.health,victim,source:{ped:false}});
        const clip=blast.clip&&view.hasReaction(blast.clip)?blast.clip:'ko_skid_front',fall=view.reactionDuration(clip)??1,getUp=playerFall(view,clip);
        // CTaskComplexFallAndGetUp's lie: 500 ms for the player after a car or a fall (1000 for a street ped), else
        // 1000 / (shooting rate / 40).
        const lie=event.weapon===WEAPON.rammedByCar||event.weapon===WEAPON.runOverByCar||event.weapon===WEAPON.fall?.5:1;
        sim.knockdown=fall+lie+getUp;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(clip,fall+lie);
        continue;
      }
      // A street ped's fist combo hands its move to CEventDamage::ComputeAnim: the player plays HitA_1..3.
      const fight=event.fight&&{comboSet:4,currentMove:event.fight.move,comboActive:event.fight.move===2,hitComboActive:false,hitClip:(move:number)=>`hita_${move+1}`,group:'melee_1'};
      const hit=computeDamageEventAnim({weapon:event.weapon,pedPiece:event.piece??PED_PIECE.torso,direction,health:sim.player.health,damageArmour:event.armour,damageHealth:event.health,victim,source:{ped:true,fight},previousAnimId:playerDamageAnimId,nextRandom:()=>playerDamageRandom.next(),nowMs:Math.floor(elapsed*1000)});
      if(hit.hitAnimDelayUntil!==undefined)playerHitAnimDelay=hit.hitAnimDelayUntil;
      playerDamageAnimId=hit.id;
      if(!hit.clip||!view.hasReaction(hit.clip))continue;
      if(hit.fallDown){
        // Fall, lie a second, then get up; input waits for all of it.
        const fall=view.reactionDuration(hit.clip)??1,getUp=playerFall(view,hit.clip);
        sim.knockdown=fall+1+getUp;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(hit.clip,fall+1);
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
      if(out.push&&body.isDynamic()){const dv=out.push*50,v=body.linvel();body.setLinvel({x:v.x-n.x*dv,y:v.y,z:v.z-n.z*dv},true);}
    }
  };
  /** CWorld::TriggerExplosionSectorList's object pass over OBJECT.DAT props: TryToExplode,
   * unfreezing when the blast force beats the uproot limit, ObjectDamage and the push. */
  weapons.onScorch=point=>{scorches.add(explosionScorch([point.x,-point.z,point.y]),gameTimeMs);};
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
    if(on)hud.message('Loading nearby terrain…');
  }
  function menuBusy(busy: boolean) {
    hud.element.querySelectorAll<HTMLButtonElement>('.menu-actions button').forEach(button => button.disabled = busy);
  }
  const input = new Input(canvas, () => {if(navigation?.open)navigation.toggle(false);else pause();});
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
  const applyCheat=(cheat:CheatName)=>{
    const player=sim.player,inventory=weapons.inventory,before=inventory.selected;
    const owned=(id:number)=>{const a=inventory.ammo.get(id);return !!a&&a.clip+a.reserve>0;};
    const vehicle=(model:number)=>{if(render.lighting.area===0&&fleet)void fleet.spawnCheatVehicle(model,player.position,player.heading);};
    const vehicles:Partial<Record<CheatName,number>>={rhino:432,bloodringBanger:504,rancher:505,hotringA:502,hotringB:503,romero:442,stretch:409,trashmaster:408,caddy:457,
      hydra:520,vortex:539,hunter:425,quad:471,tanker:514,dozer:486,stuntPlane:513,monsterTruck:556};
    // CPed::GiveWeaponSet1 (sets 2 and 3 are the gta-reversed reconstructions).
    const sets:Partial<Record<CheatName,readonly (readonly [number,number])[]>>={weaponSet1:[[1,1],[5,1],[18,10],[22,100],[25,50],[28,150],[30,120],[33,25],[35,200],[41,200]],
      weaponSet2:[[4,0],[16,10],[24,40],[26,40],[32,150],[31,150],[34,21],[37,500],[42,200]],weaponSet3:[[9,0],[39,5],[23,40],[27,30],[29,100],[31,150],[36,200]]};
    if(sets[cheat])for(const [weapon,ammo] of sets[cheat]!)inventory.give(weapon,ammo);
    else if(vehicles[cheat])vehicle(vehicles[cheat]!);
    else switch(cheat){
      // MoneyArmourHealthCheat, then HealthCheat: full health, and the player's vehicle at 1000 with its fire out and fixed.
      case 'moneyArmourHealth':{
        // m_nMaxArmour and m_nMaxHealth, which the paramedic and vigilante rewards raise.
        const info=mission?.runtime.game.playerInfo;sim.money+=250000;player.armour=info?.maxArmour??100;player.health=info?.maxHealth??100;
        const car=worldCar?.occupied?worldCar:fleet?.occupied;if(car){car.health=1000;car.burnTimer=0;car.fix();}
        const bike=fleet?.occupiedBike;if(bike){bike.health=1000;bike.burnTimer=0;}
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
      case 'adrenaline':cheats.toggle(cheat);if(cheats.isActive(cheat)){player.adrenaline=20;player.stamina=100;player.sprintExhausted=false;}else player.adrenaline=0;break;
      // A Micro Uzi with 150 rounds when the SMG slot is empty.
      case 'driveby':cheats.toggle(cheat);if(cheats.isActive(cheat)&&![28,29,32].some(owned)){inventory.give(28,150);inventory.select(28);}break;
      case 'weaponSkills':for(let id=22;id<=31;id++)inventory.practice.set(id,1000);break;
      // VehicleSkillsCheat: driving, flying, bike and cycling skill all to 1000.
      case 'vehicleSkills':progression.drivingSkill=1000;carEntry.drivingSkill=1000;for(const stat of [160,223,229,230])mission?.runtime.game.stats.set(stat,1000);break;
      case 'blowUpCars':
        for(const car of fleet?.cars??[])car.blowUp();for(const bike of fleet?.bikes??[])bike.blowUp();for(const boat of fleet?.boats??[])boat.blowUp();
        for(const plane of fleet?.planes??[])plane.damage(plane.health);
        break;
      // CCheat::JetpackCheat: the player is given CTaskSimpleJetPack unless he already has one. It is not a toggle.
      case 'jetpack':sim.startJetPack();break;
      // CCheat::FatCheat, MuscleCheat, SkinnyCheat and StaminaCheat set the body stats; CClothes::RebuildPlayer, which
      // would reshape the body from them, has no port yet.
      case 'fat':mission?.runtime.game.stats.set(21,1000);break;
      case 'muscle':mission?.runtime.game.stats.set(23,1000);break;
      case 'skinny':mission?.runtime.game.stats.set(21,0);mission?.runtime.game.stats.set(23,0);break;
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
  function pause() {
    loadRequest++;
    if (!started) return;
    paused = true; sound.setPlaying(false); clock.reset(); input.clear(); hud.setMenu(true);
    hud.button('play').textContent = 'Resume game';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function play() {
    terrainHold(false);
    if (!started) { started = true; setTimeout(() => hud.element.classList.add('playing-long'), 20000); }
    paused = false; sound.setPlaying(true); last = performance.now(); clock.reset(); input.clear(); hud.setMenu(false); hud.menuMessage(''); canvas.focus();
  }
  hud.button('play').disabled = false; hud.button('play').textContent = 'Begin game'; hud.button('play').onclick = play;
  const onVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVisibility);
  const onBlur = () => pause(); window.addEventListener('blur', onBlur);
  const onLockChange = () => { if (!document.pointerLockElement && started) pause(); };
  document.addEventListener('pointerlockchange', onLockChange);
  const onContextLost = (event: Event) => { event.preventDefault(); pause(); hud.menuMessage('Graphics paused. Waiting for the display to recover…'); };
  const onContextRestored = () => { render.nativeShadow.invalidateCapture(); hud.menuMessage('Display recovered. Resume when ready.'); render.resize(); };
  canvas.addEventListener('webglcontextlost', onContextLost); canvas.addEventListener('webglcontextrestored', onContextRestored);
  // Development-only observation hook: useful for browser verification, never an alternate input path.
  if (import.meta.env.DEV) Object.assign(window, { __game: {
    /** Dev diagnostic: what each collider of the occupied native car is touching. */
    smashedProps:()=>smashedProps.slice(),
    /** The scene's OBJECT.DAT placements whose model matches, for specs. */
    propsNamed:(pattern:string)=>{const re=new RegExp(pattern,'i'),out:{handle:number;model:string;position:number[];present:boolean}[]=[];for(const [handle,source] of importedScene?.sources??[])if(source.placement&&re.test(source.modelName))out.push({handle,model:source.modelName,position:[...source.placement.position],present:!!sim.world.getCollider(handle)?.parent()?.isEnabled()});return out;},
    /** CObject::TryToExplode on the placement behind a collider handle. */
    explodeProp:(handle:number)=>{const collider=sim.world.getCollider(handle);return !!collider&&!!scenePropFor(collider)?.tryToExplode?.();},
    /** Uprooted props that moved, with their current pose (renderer frame). */
    movedProps:()=>[...movedPlacements].map(([key,m])=>{
      const handle=[...(importedScene?.sources.entries()??[])].find(([,source])=>source.placement&&placementKey(source.modelName,source.placement.position)===key)?.[0];
      const body=handle===undefined?undefined:sim.world.getCollider(handle)?.parent();
      return {key,translation:m.translation,dynamic:!!body?.isDynamic(),at:body?{...body.translation()}:null};
    }),
    /** Fire the held weapon from CJ at a renderer-frame point. */
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
    /** Dev probe: the collision surface under a renderer-frame point (material id, face and source kind), or null. */
    surfaceAt:(x:number,z:number,top=200)=>{const hit=sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),top+100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)return null;const record=importedScene?.sources.get(hit.collider.handle);const surface=record?nativeCollisionSurface(record.source,hit):undefined;return {y:top-hit.timeOfImpact,handle:hit.collider.handle,known:!!record,model:record?.modelName??null,kind:record?.source.kind??null,material:surface?.material??null,face:surface?.faceIndex??null,featureType:hit.featureType,keys:record?Object.keys(record):[]};},
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
    placePed:(x:number,y:number,z:number)=>pedestrians?.debugPlace({x,y,z})??null,
    /** CPostEffects::m_bColorEnable. */
    setColourFilter:(on:boolean)=>{postEffects.colourFilterEnabled=!!on;return postEffects.colourFilterEnabled;},
    pedestrians:()=>pedestrians,
    RAPIER,
    /** Kill a pedestrian where it stands through the ordinary damage path. */
    killPed:(id:number)=>{const p=pedestrians?.snapshot().people.find(p=>p.id===id);return p?pedestrians!.damageCollider(p.handle,1000,{x:0,z:1}):false;},
    /** Put the world car at a renderer-frame position at rest; `heading` turns it about the vertical (0 faces -z). */
    placeCar:(x:number,y:number,z:number,heading?:number)=>{if(!worldCar)return false;const b=worldCar.car.body;b.setTranslation({x,y,z},true);if(heading!==undefined)b.setRotation({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);return true;},
    setWantedLevel:(level:number)=>{law.setLevel(level);return law.level;},
    /** Dev: the frame limiter (the menu's Display setting). */
    setFrameLimiter:(on:boolean)=>{display.frameLimiter=!!on;saveDisplaySettings(display);hud.bindDisplay(display,settings=>{display.frameLimiter=settings.frameLimiter;saveDisplaySettings(display);});return display.frameLimiter;},
    /** Dev: the traffic, weapons and occupants. */
    traffic:()=>traffic,weapons:()=>weapons,occupants:()=>occupants,
    /** Dev: the world head-sphere centre of a car's seated driver (renderer frame), by body handle. */
    driverHead:(handle:number)=>{const car=fleet?.carById(`handle:${handle}`);const seat=car?.seat('left');return car&&seat?car.worldPoint({x:seat.x,y:seat.y,z:seat.z+.6}):null;},
    /** Dev: the world effects. */
    fx:()=>worldFx,
    /** Dev: the renderer (scene, camera, three.js renderer). */
    render:()=>render,
    /** Dev: the fleet and the car entry task. */
    fleet:()=>fleet,carEntry:()=>carEntry,hud:()=>hud,weather:()=>weather,cullZones:()=>cullZones,bikeMount:()=>bikeMount,
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
    drawGroups:()=>{const frustum=new Frustum(),m=new Matrix4().multiplyMatrices(render.camera.projectionMatrix,render.camera.matrixWorldInverse);frustum.setFromProjectionMatrix(m);
      const byGeometry=new Map<string,number>(),byPair=new Map<string,number>();let drawn=0,skinned=0;
      render.scene.traverseVisible(o=>{const mesh=o as any;if(!mesh.isMesh)return;if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;drawn++;if((mesh as any).isSkinnedMesh)skinned++;
        const g=mesh.geometry.uuid,mat=[mesh.material].flat().map((x:any)=>x.uuid).join('+');byGeometry.set(g,(byGeometry.get(g)??0)+1);byPair.set(g+'|'+mat,(byPair.get(g+'|'+mat)??0)+1);});
      const repeats=[...byPair.values()].filter(n=>n>1),dist=(v:number[])=>{const s=[...v].sort((a,b)=>b-a);return {groups:s.length,draws:s.reduce((a,b)=>a+b,0),top:s.slice(0,12)};};
      return {drawn,skinned,uniqueGeometries:byGeometry.size,uniquePairs:byPair.size,repeatedPairs:dist(repeats)};},
    /** CPU-side bytes held by scene geometry and textures (shared buffers counted once), for memory checks. */
    memoryCounts:async()=>{const seen=new Set<ArrayBufferLike>();let geometry=0,textures=0,textureCount=0,compressed=0;const seenTextures=new Set<unknown>();const add=(b:ArrayBufferLike|undefined)=>{if(!b||seen.has(b))return 0;seen.add(b);return b.byteLength;};
      render.scene.traverse(o=>{const g=(o as any).geometry;if(g)for(const a of Object.values(g.attributes??{}) as any[])geometry+=add(a.array?.buffer);if(g?.index)geometry+=add(g.index.array.buffer);const ms=[(o as any).material].flat().filter(Boolean);
        const texture=(v:any)=>{if(!v?.isTexture||seenTextures.has(v))return;seenTextures.add(v);let n=0;for(const level of v.mipmaps?.length?v.mipmaps:[v.image])n+=add(level?.data?.buffer);if(n){textures+=n;textureCount++;if(v.isCompressedTexture)compressed++;}};
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
    state: () => ({ frameLimiter:display.frameLimiter, escalators:escalators.snapshot(), volumetricClouds:volumetricClouds.snapshot(), roadsigns:roadsigns.snapshot(), colourFilter:{...postEffects.snapshot().colourFilter,extraMult:+colourFilterState.extraMult.toFixed(4)}, postEffects:postEffects.snapshot(), occlusion:{...occlusion.snapshot(),culled:importedScene?.occludedCount()??0}, shinyTexts:shinyTexts.drawn, waterCannon:{id:waterCannon.id,sections:waterCannon.sections().length,points:waterCannon.sections().map(s=>[+s.point.x.toFixed(1),+s.point.y.toFixed(1),+s.point.z.toFixed(1)]),drawn:waterCannonMesh.drawn,yaw:+cannonAim.yaw.toFixed(3),pitch:+cannonAim.pitch.toFixed(3)}, gangWars:gangWars?.snapshot()??null, headlightBeams:headlightBeams.drawn,tank:fleet?.occupied?.modelId===432?{yaw:+tankTurret.yaw.toFixed(3),pitch:+tankTurret.pitch.toFixed(3)}:null,carLightPools:carLightPoolsTwin.drawn+carLightPoolsSingle.drawn, jetPack:sim.jetPack?{worn:jetPackView.worn,balls:jetPackView.ballAngles(),error:jetPackView.error??null,flames:jetFlames.filter(f=>f&&!f.destroyed).length,thrustFwd:sim.jetPack.thrustFwd,strafe:+sim.jetPack.thrustStrafe.toFixed(3),angle:+sim.jetPack.thrustAngle.toFixed(3),fx:+sim.jetPack.fxKeyTime.toFixed(2),legs:[+sim.jetPack.legSwingFwd.toFixed(3),+sim.jetPack.legSwingSide.toFixed(3)]}:null, coronaFlares:{drawn:coronaFlaresMesh.drawn,sun:flareSun}, coronaReflections:{drawn:coronaReflections.drawn,candidates:coronaReflectionCandidates}, setPieces:setPieces?{count:setPieces.pieces.length,generated:setPieces.lastGeneration.filter(t=>t>0).length,attempts:setPieceAttempts,error:setPieceError}:null, tags:tagManager?{total:tagManager.numTags,tagged:tagManager.numTagged,sprayed:tagManager.saved().length}:null, planeTrails:trailsMesh.drawn, bulletTraces:bulletTracesMesh.drawn/12, streaks:streaksMesh.drawn/6, money:sim.money, cheats:{times:cheats.timesCheated,active:[...cheats.active],timeScale:cheatTimeScale}, brightLights:{vertices:brightMesh.drawn,center:brightMesh.firstCenter}, sunReflection:sunReflectionMesh.visible, markers3d:{drawn:markersMesh.drawn,arrows:markersMesh.arrowsDrawn,active:markers3d.numActiveMarkers,error:markersMesh.error??null,center:markersMesh.firstCenter,first:(m=>m?{position:[...m.position],size:m.size}:null)(markers3d.markers.find(m=>m.hasAtomic))}, coronas:{sceneFx:sceneFx.length,pools:lightPools.drawn,firstPool:lightPools.first,count:coronas.count,drawn:worldCoronas.drawn,lit:importedScene?.litPlacements().length??0,first:worldCoronas.firstCenter}, lastBulletLine:lastBulletLine??null, birds:{count:birds.count,drawn:birdsMesh.drawnBirds,shot:birds.shot??null,positions:birds.birds.filter(b=>b.created).map(b=>[...b.position])}, duck:{x:duck.x,y:duck.y,rolling:duck.rolling}, entryExits:entryExits?{state:entryExits.state,active:entryExits.active?.enex.name??null,loading:!!interiorTransfer,stack:entryExits.stack.map(e=>e.name),count:entryExits.pool.length}:null, skidmarks:skids.snapshot(), weather:{...weather.snapshot(),effects:weatherEffects.snapshot(),movingFog:movingFog.snapshot()},fx:worldFx.snapshot(),police:police?.snapshot()??null,driveby:driveby?.snapshot()??null,pickups:pickups.snapshot(),drops:drops.snapshot(),carEntry:carEntry.snapshot(),progression:progression.snapshot(),stuntJumps:stuntJumps?.snapshot()??null,occupants:occupants.snapshot(),wanted:law.snapshot(),weapons:{...weapons.snapshot(),error:weaponView.error??null,arsenal:arsenal.open,gunSpin:+weaponView.gunSpinSpeed.toFixed(3)}, traffic:traffic?.snapshot()??null, pedestrians:pedestrians?.snapshot()??null, aircraft:fleet?.occupiedPlane?.snapshot()??null, fleet:fleet?.snapshot()??null, nativeCar:worldCar&&!worldCar.disposed?{occupied:worldCar.occupied,touchingSand:worldCar.touchingSand,boggedDown:worldCar.boggedDownInSand,wheelMaterials:worldCar.wheelGround.map(g=>g?.material??null),gas:worldCar.gasPedal,health:worldCar.health,wrecked:worldCar.wrecked,upsideDown:worldCar.upsideDownCounter,doors:worldCar.doors.map((door,i)=>({angle:door.angle,ratio:door.ratio,status:worldCar!.damageState.doors[i]})),debris:worldCar.debris.count,propsSmashed:worldCar.propsSmashed,propsUprooted:worldCar.propsUprooted,tyres:[...worldCar.damageState.wheels],wheels:worldCar.car.wheelSnapshot(),position:{...worldCar.car.body.translation()},velocity:{...worldCar.car.body.linvel()},spin:{...worldCar.car.body.angvel()}}:null, breakObjects:{active:breakManager.activeCount,drawn:breakPieces.count,groups:breakManager.objects.filter(o=>o.active).map(o=>o.groups.map(g=>({z:+g.matrix[11].toFixed(2),frames:g.framesToLive,stopped:g.stoppedMoving})))},proceduralCollisionSources:[...(importedScene?.sources.values()??[])].filter(source=>source.procedural).length, nativeVegetation:importedScene?.vegetation()??null, following:follower?{...follower.snapshot(),supportOverrides,lastSupportMiss:lastSupportMiss??null,lastSwap:lastSwap??null,holds:{...terrainHolds},latencyEma:Math.round(latencyEma),leadSeconds:follower.leadSeconds}:null,objectKinds: [...(importedScene?.sources.values()??[])].map(source=>source.entityKind), imported: sim.imported, importedInstances: importedScene?.instanceCount ?? 0, importedReusedColliders:importedScene?.reusedColliderCount??0,importedReusedPlacements:importedScene?.reusedPlacementCount??0, physics:{colliders:sim.world.colliders.len(),bodies:sim.world.bodies.len()},pooledModels:importedScene?.pooledModelCount??0, retiredModels:importedScene?.retiredModelCount??0, retiredModelMB:+(importedScene?.retiredModelMB??0).toFixed(1), frameProfile:{...frameProfile,renderSections:{...render.profile}}, uvAnimators:importedScene?.uvAnimatorCount??0, modelBuild:{...modelBuildStats}, subsystemFaults:[...subsystemFaults].map(([message,count])=>({message,count})), visibleImportedInstances: importedScene?.visibleInstanceCount ?? 0, visibleImportedModels: importedScene?.visibleModels() ?? [], paused, terrainHold:terrainPause, nativeShadow: render.nativeShadow.snapshot(), nativeContactLighting: render.contactLighting ?? null, nativeCharacter: render.nativeCharacter?.snapshot() ?? null, deathRemaining: sim.deathRemaining, knockdown: sim.knockdown, stuckUnderCar:playerStuckUnderCar, playerCarHits:{...playerCarHits,push:{...sim.collisionPush},stuck:sim.playerStuck}, gameLogicState: gameLogic.state, fadeAlpha: cameraFade.value, restartPoints: {hospitals:nativeRestart.hospitals.length,police:nativeRestart.police.length}, player: { ...sim.player, position: { ...sim.player.position } },moneyDrops:moneyDrops.snapshot(),climb:sim.climb?{clip:sim.climb.anim?.clip??null,time:sim.climb.anim?.time??0,blend:sim.climb.anim?.blend??0,heightForAnim:sim.climb.heightForAnim,heightForPos:sim.climb.heightForPos,hold:{...sim.climb.hold}}:null,climbReady:!!sim.climbDurations,
      camera: { mode: render.distanceMode, distance: render.followDistance, far: render.camera.far, fog: render.scene.fog?.toJSON(), yaw: render.yaw, viewYaw: render.viewYaw, pitch: render.viewPitch, glance: render.glance, position: render.camera.position.toArray(), firstPerson: render.firstPerson??null, fov: render.fov, verticalFov: render.camera.fov, near: render.camera.near },
      movementSurfaceDefinitions:surfaceSprint?.size??0,surfaceSprintBlocked,
      audio: {...sound.state(),surfaceDefinitions:surfaceAudio?.byId.size??0}, timeMinutes: sim.timeMinutes, lighting: { area: render.lighting.area, sunMultiplier: render.lighting.sunLightMultiplier, night: render.lighting.night, imported: localLighting.name, weather: localLighting.weather, regionalModifiers:localLighting.modifierCount, native: localLighting.sample(sim.timeMinutes,render.camera.position) },
      tick: clock.tick, memory: { ...render.renderer.info.memory }, draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles }),
  } });
  function animate(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    // Frame pacing: the limiter's 30 a second in play, 10 a second under the menu, or every display frame when off.
    // A skipped frame leaves `last` alone so the simulation clock still receives the whole interval.
    if(!frameDue(pacer,now,paused?MENU_FPS:display.frameLimiter?FRAME_LIMITER_FPS:undefined))return;
    // A queued frame timestamp can predate the performance.now() baseline set on resume.
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.1)); last = now;
    let alpha = 1;
    if(input.consume('Tab')&&!paused&&!navigation?.open)arsenal.toggle();
    // Grove crew recruitment (empty-handed press disbands).
    if(!paused&&!navigation?.open&&!arsenal.open&&!fleet?.occupiedPlane&&input.consume('KeyG')){
     // SET_PLAYER_GROUP_RECRUITMENT off (m_bGroupStuffDisabled) stops ProcessGroupBehaviour's recruiting.
     const result=mission?.runtime.game.playerInfo.groupStuffDisabled?undefined:pedestrians?.recruit();
     // Recruiting shows no text in the original; the recruit answers with a line.
     if(result==='joined'){const p=sim.player.position;sound.nativeEngine?.speech('greet',{x:p.x,y:-p.z,z:p.y});}
    }
    // Vehicle radio tuning (N cycles the 11 stations while driving).
    if(input.consume('KeyN')&&!paused&&radioModel!==undefined){const station=sound.nativeEngine?.tuneRadio(input.down('ShiftLeft')||input.down('ShiftRight')?-1:1);if(station)hud.radioName(station);}
    // ProcessPlayerWeapon drops the aim of any non-melee weapon while the player sprints.
    const playerSprinting=!!render.nativeCharacter?.sprinting&&weapons.inventory.weapon.kind!=='melee';
    weapons.aiming=!paused&&!arsenal.open&&!navigation?.open&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!sim.player.swimming&&!sim.climbing&&!playerSprinting&&!carEntry.active&&!bikeMount.active&&input.down('MouseAim');
    // ProcessPlayerWeapon: aiming a b1stPerson weapon puts the camera in its weapon mode; releasing the button leaves it.
    const firstPerson=weapons.aiming?firstPersonMode(weapons.inventory.selected,weapons.inventory.info()):undefined;
    render.aiming=weapons.aiming;render.firstPerson=firstPerson;weapons.firstPerson=firstPerson;
    // PED_SNIPER_ZOOM_IN and ZOOM_OUT held: PgUp and PgDn, with the optional X and Z.
    render.zoomInput.held=input.down('PageUp')||input.down('KeyX')?1:input.down('PageDown')||input.down('KeyZ')?-1:0;
    if (!paused&&!terrainPause&&!navigation?.open&&!arsenal.open) {
      const tPopulation=performance.now();
      guard('traffic.update',()=>traffic?.update(now));guard('police.update',()=>police?.update(now));guard('driveby.update',()=>driveby?.update(now));
      guard('pedestrians.update',()=>pedestrians?.update(now));
      // CTimer::m_FrameCounter's 30 fps game frames, from game time, so frame-counted waits (the car generators' 20-frame
      // start window, CAudioZones' 16-frame cadence) keep their length whatever the display rate.
      const gameFrame=Math.floor(gameTimeExact*30/1000),newGameFrames=Math.min(6,Math.max(0,gameFrame-lastGameFrame));lastGameFrame=gameFrame;
      guard('fleet.update',()=>{for(let i=0;i<newGameFrames;i++)fleet?.tickFrame();fleet?.update(now);});
      // CAudioZones::Update from Game.cpp's frame, with the camera's position.
      if(newGameFrames){const c=render.camera.position;mission?.runtime.game.audioZones.update(false,[c.x,-c.z,c.y],gameFrame);}
      // CCheckpoints::Update (CSpecialFX::Update), once a game frame.
      if(mission){const cps=mission.runtime.game.checkpoints.markers;cps.player=checkpointPlayer;for(let i=0;i<newGameFrames;i++)cps.update();}
      {const c=render.camera.position,p=sim.player.position;
       for(let f=gameFrame-newGameFrames+1;f<=gameFrame;f++)cullZones.update(f,[c.x,-c.z,c.y],[p.x,-p.z,p.y],!!mission?.runtime.game.militaryZonesDisabled,()=>{if(sim.player.health>0)law.setLevelNoDrop(5);});cullAirResistance.multiplier=cullZones.extraAirResistance?VEHICLE_AIR_RESISTANCE_MULT:1;}worldCar=carEntry.car??fleet?.nearest()??(worldCar?.disposed?undefined:worldCar);
      frameProfile.population+=performance.now()-tPopulation;
      // CTaskComplexLeaveCar keeps asking CanPedJumpOutCar each frame, slowing the aircraft, until the pilot can go.
      const planeExitReady=!!fleet?.occupiedPlane?.exitPending&&fleet.occupiedPlane.leaveMode()!=='wait';
      if(planeExitReady)fleet!.occupiedPlane!.exitPending=false;
      // CPad::DisablePlayerControls (SET_PLAYER_CONTROL off): every pad query answers 0, the exit button included.
      if(!sim.climbing&&(input.consume('KeyF')&&!playerControlsDisabled()||planeExitReady)&&!law.arrested){
        // CTaskSimpleJetPack reads the exit-vehicle button itself, to drop the pack.
        if(sim.jetPack){/* the jetpack task owns the button */}
        else if(playerPassenger)leavePassengerSeat();
        else if(sim.player.swimming){hud.message('Get out of the water first.');}
        else{
        const plane=fleet?.nearestPlane();
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
          else if(!exiting.grounded){const out=exiting.exitAir();hud.message(weapons.parachute?out:'Out of the aircraft');}
          else if(leave==='jump'){const foot=exiting.exitFoot();hud.message(foot?exiting.jumpOutOnGround(foot)??'':'No clear ground beside the plane.');}
          else{const blocked=exiting.exitCheck();
          if(blocked)hud.message(blocked);
          else{const foot=exiting.exitFoot();if(!foot)hud.message('No clear ground beside the plane.');else{const steps=planeSteps(exiting,'getout');if(steps){installPlaneSteps(steps);exiting.beginExit(foot,steps);}else hud.message(exiting.finishExit(foot));}}}
         }
        else if(fleet?.occupiedBoat)hud.message(fleet.occupiedBoat.interact());
        else if(fleet?.occupiedBike){const bike=fleet.occupiedBike;if(bikeMount.active){}else if(!bikeMount.ready(bike))hud.message(bike.interact());else if(!bikeMount.dismount(bike)&&bikeMount.message){hud.message(bikeMount.message);bikeMount.message=undefined;}}
        else if(carEntry.seated){if(!carEntry.exit()&&carEntry.message)hud.message(carEntry.message);}
        else if(carEntry.phase==='approach')carEntry.cancel();
        else if(!carEntry.active&&sim.player.health>0){
          // CPlayerInfo::FindClosestCarSectorList (unreversed): the cars in a 10-unit box around the player, each scored
          // by the reversed EvaluateCarPosition, (1 - |angle off the player's facing| / 2π) × (10 - distance); the best
          // score wins, so a car ahead beats a nearer one behind.
          const p=sim.player.position,carScore=(c:{car:{body:{translation():{x:number;z:number}}};distance():number})=>{const q=c.car.body.translation();return evaluateCarPosition(sim.player.heading,Math.atan2(q.x-p.x,q.z-p.z),c.distance());};
          const car=[...(fleet?.cars??[])].filter(c=>{const q=c.car.body.translation();return Math.abs(q.x-p.x)<10&&Math.abs(q.z-p.z)<10&&Math.abs(q.y-p.y)<5;}).sort((a,b)=>carScore(b)-carScore(a))[0];
          const boat=fleet?.nearestBoat();
          const bike=fleet?.nearestBike();
          if(plane&&(!car||plane.distance()<car.distance())&&(!boat||plane.distance()<boat.distance())&&(!bike||plane.distance()<bike.distance())&&plane.distance()<10){
           const reason=plane.enterCheck();if(reason)hud.message(reason);
           else{const steps=planeSteps(plane,'getin');if(steps){installPlaneSteps(steps);plane.beginEnter(steps);}else hud.message(plane.finishEnter());}
          }
          else if(boat&&(!car||boat.distance()<car.distance())&&(!bike||boat.distance()<bike.distance())&&boat.distance()<10)hud.message(boat.interact());
          else if(bike&&(!car||bike.distance()<car.distance())&&bike.distance()<10){
            // Board through the bike's jump-on clip once its animation group has loaded; before that, the instant mount.
            const check=bike.enterCheck();if(check)hud.message(check);else if(bikeMount.active){}else if(!bikeMount.ready(bike))hud.message(bike.interact());else if(!bikeMount.mount(bike)&&bikeMount.message){hud.message(bikeMount.message);bikeMount.message=undefined;}
          }
          else if(car){if(!carEntry.enter(car)&&carEntry.message)hud.message(carEntry.message);}
        }
        }
      }
      if(input.consume('KeyT')&&fleet?.occupiedPlane)hud.message(fleet.occupiedPlane.toggleVtol());
      if(input.consume('KeyG')&&fleet?.occupiedPlane)hud.message(fleet.occupiedPlane.toggleGear());
      elapsed += dt;
      const cycleCamera = input.consume('KeyV'), alternateCamera = input.consume('Home');
      // The original switches camera modes without any text.
      if (cycleCamera || alternateCamera) render.cycleCameraDistance();
       // CTaskSimpleDuck::CanPedDuck: never from a run or sprint, and only with a melee or "use" weapon, the spray can or
       // one flagged for crouch-fire; PlayerControlDucked stands the player up once it fails.
       const duckable=()=>{const info=weapons.inventory.info(),w=weapons.inventory.weapon;const moving=sim.player.moveBlend>1&&!sim.player.crouched;
        return !moving&&(w.kind==='melee'||w.id===41||!info||info.fire==='melee'||info.fire==='use'||!!(info.flags&WEAPON_FLAG.crouchFire));};
       if (input.consume('KeyC')&&!playerControlsDisabled()&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!carEntry.active&&!duck.rolling&&(sim.player.crouched||duckable())) { sim.toggleCrouch(); }
       else if(sim.player.crouched&&!duck.rolling&&!duckable())sim.setCrouched(false);
      if (input.consume('KeyL')) canvas.requestPointerLock()?.catch(() => hud.message('Pointer lock unavailable. Drag to look.'));
      // CTimer::SetTimeScale(0.3) while a unique stunt jump plays.
      const tSteps=performance.now();
      stepSnapShot(dt);
      alpha = clock.advance(interiorTransfer||savedTransfer?.quiet?0:dt*timeScale(), step => {
        sim.beginPlayerBreathFrame(step);
        if(walkDemo&&importedScene){
          if(!weatherStarted){weatherStarted=true;weather.setAppropriateNow(sim.player.position.x,-sim.player.position.z);}
          const today=((sim.timeMinutes%1440)+1440)%1440,angle=today*Math.PI/720,sun=[.7+Math.sin(angle),-.7,.2-Math.cos(angle)],camera=render.camera.position;
          // CGame::Process calls CWeather::Update once a frame: at the PC frame limiter's 30 fps, with CTimer's 50/30
          // step and m_FrameCounter counting those frames (its lightning odds are per call).
          for(weatherClock+=step;weatherClock>=1/30;weatherClock-=1/30){
            weatherFrame++;
            weather.update({clock:{hours:Math.floor(today/60),minutes:Math.floor(today%60),seconds:Math.floor(today%1*60)},timeMs:Math.floor(elapsed*1000),frame:weatherFrame,timeStep:50/30,camera:{x:camera.x,y:-camera.z,z:camera.y},sunZ:sun[2]/Math.hypot(...sun),noRain:cullNoRain()});
            if(weather.thunder)sound.nativeEngine?.thunder();
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
         if(inAircraft&&!plane&&parachuteTimer.wantsParachute&&sim.player.health>0&&weapons.inventory.give(WEAPON_PARACHUTE,1)){weapons.inventory.select(WEAPON_PARACHUTE);void weaponView.equip(WEAPON_PARACHUTE);}
         inAircraft=!!plane;}
        {const game=mission?.runtime.game;
         if(game&&statReactions&&sim.player.health>0){
          const bike=fleet?.occupiedBike,onFoot=!worldCar?.occupied&&!fleet?.occupied&&!bike&&!fleet?.occupiedBoat&&!fleet?.occupiedPlane&&!playerPassenger;
          if(statFrameDue&&onFoot&&sim.footMove==='sprint')statReactions.sprinting(1000/30);
          else if(statFrameDue&&onFoot&&sim.footMove==='run')statReactions.running(1000/30);
          // CBike counts four wheel contact points.
          if(statFrameDue&&bike?.motorbike){const v=bike.body.linvel();statReactions.onMotorBike(1000/30,Math.hypot(v.x,v.y,v.z)/50,bike.airborne?0:4);}
         }
         if(game&&sim.player.health>0)hunger.update(Math.floor(sim.timeMinutes/60)%24,cheats.isActive('neverHungry'),playerControlsDisabled()||game.widescreenOn||!!navigation?.open||arsenal.open,{
          fat:()=>game.stats.get(21),muscle:()=>game.stats.get(23),decrementFat:v=>{game.stats.decrement(21,v);displayStatUpdate(false,21,v);},decrementMuscle:v=>{game.stats.decrement(23,v);displayStatUpdate(false,23,v);},
          hurt:v=>{sim.player.health-=v;},rumble:()=>{game.pads.startShake(0,400,110,0,gameTimeMs);},helpMessage:()=>hud.help(gxtHudText(gxtText('NOTEAT',"You're hungry. Eat something to keep your strength up."))),
         });}
        // CTimer game time drives the native hold, fade and respawn sequence.
        // CTimer::m_snTimeInMilliseconds: whole milliseconds of the time played. Flooring each 60 Hz step lost 4%.
        previousGameTimeMs=gameTimeMs;gameTimeExact+=step*1000;gameTimeMs=Math.floor(gameTimeExact);
        // CEntity::PreRender: every animated material adds this step's seconds (MaterialUpdateUVAnimCB).
        importedScene?.advanceUvAnimations(step);
        cameraFade.process(step);
        gameLogic.update(gameTimeMs,previousGameTimeMs,gameLogicWorld,CITY_UNLOCKED,nativeLevelAt);
        // CGameLogic::Update then UpdateSkip, with the D-pad right's edge for this frame; CHud::DrawTripSkip while a skip
        // can be taken (SKIP_1's help the first time it shows).
        {const down=!!mission&&mission.runtime.game.pads.pads[0].dpadRight>0;skipButtonPressed=down&&!skipButtonDown;skipButtonDown=down;}
        gameLogic.updateSkip(gameTimeMs,skipWorld);
        {const canSkip=gameLogic.skipCanBeActivated(skipWorld);
         if(canSkip&&!tripSkipHelpShown){tripSkipHelpShown=true;hud.help(gxtHudText(gxtText('SKIP_1','')),5000);}else if(!canSkip)tripSkipHelpShown=false;
         hud.tripSkip(canSkip,canSkip?gxtHudText(gxtText('FEC_TSK','TRIP SKIP')):'');}
        weapons.tick(step,weapons.aiming?{origin:{...render.camera.position},direction:aimDirection()}:undefined);
        const entryBusy=[...(fleet?.planes??[])].some(p=>p.entryBusy);
        const onFoot=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!playerPassenger&&!entryBusy&&!bikeMount.active&&(!carEntry.active||carEntry.phase==='approach');
        // CTaskSimplePlayerOnFoot raises CEventGunAimedAt on a locked ped. With the mouse there is no lock; the ped under
        // the crosshair (m_p3rdPersonMouseTarget, from the stubbed Compute3rdPersonMouseTarget) gets it instead.
        if(onFoot&&weapons.aiming&&weapons.lock&&weapons.inventory.info()?.fire==='instant')pedestrians?.gunAimedAt(weapons.lock.handle,{...sim.player.position});
        // CPed::ProcessBuoyancy: the ped origin (a unit above the feet) 0.6 under the surface starts the in-water task.
        const swimWater=render.lighting.water.levels?.level(sim.player.position.x,-sim.player.position.z);
        const stopSwim=()=>{sim.player.swimming=false;sim.player.swimState=0;sim.player.swimBlend=0;sim.player.swimStopTime=0;sim.player.swimDiveTime=0;sim.player.swimVel={x:0,z:0};};
        const reload=input.consume('KeyR'),next=input.consume('WheelNext'),previous=input.consume('WheelPrevious');
        // The first-person weapon modes ignore weapon cycling; the wheel zooms instead (up zooms in).
        if(render.firstPerson){if(next||previous)render.zoomInput.notch=previous?1:-1;}
        else if(onFoot&&!sim.jetPack&&!playerControlsDisabled()&&(next||previous)){weapons.inventory.cycle(next?1:-1);void weaponView.equip(weapons.inventory.selected);}
        // SA has no reload control: CWeapon::Fire reloads when a clip runs out.
        const mouse=input.consume('MouseFire'),key=input.consume('ControlLeft')||input.consume('ControlRight'),click=input.consume('MouseClick');
        // The left button fires whenever it is not dragging the camera: aiming, under pointer lock, or a short click.
        const mouseFires=weapons.aiming||document.pointerLockElement===canvas;
        // CPad::GetWeapon is the held button: every gun keeps firing at its own rate while it is down.
        const held=weapons.inventory.weapon.automatic||['bullet','shotgun','rocket','guided','camera'].includes(weapons.inventory.weapon.kind);
        const firing=playerControlsDisabled()?false:held?(mouseFires&&input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight')||key||mouseFires&&mouse||click):(mouseFires&&mouse||click||key);
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
        const jetFireAllowed=!sim.jetPack||!jetWeaponHidden&&(()=>{const info=weapons.inventory.info();return !!info&&info.fire==='instant'&&!!(info.flags&WEAPON_FLAG.aimWithArm);})();
        if(onFoot&&jetFireAllowed&&!sim.climbing&&!law.arrested&&!weapons.stealth&&!duck.rolling&&!(render.nativeCharacter?.sprinting&&weapons.inventory.weapon.kind!=='melee')&&firing){const direction=aimDirection();weapons.fire({origin:render.camera.position,direction});}
        // CPad::GetWeapon for the throw task's button counter: the fire button while it stays down.
        weapons.throwHeld=onFoot&&(mouseFires&&input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'));
        // Drive-by: Ctrl fires the selected one-handed weapon from the driven car or boat (CTaskSimpleGangDriveBy port).
        if(worldCar?.occupied&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=weapons.inventory.weapon.automatic?(input.down('ControlLeft')||input.down('ControlRight')||key):key;
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDriveby(worldCar,{origin:render.camera.position,direction});}
        }
        // CAutomobile::TankControl: the Rhino's turret follows the camera and Ctrl fires the cannon every 800 ms.
        const tank=fleet?.occupied?.modelId===432?fleet.occupied:undefined;
        if(tank&&!law.arrested){
         tank.onCrushCar=other=>law.crime(CRIME.explosion,`car:${other.car.body.handle}`);
         const q=tank.car.body.rotation(),tq=new Quaternion(q.x,q.y,q.z,q.w),front=render.camera.getWorldDirection(scratchAim).clone().applyQuaternion(tq.clone().invert());
         tankTurret=stepTankTurret(tankTurret,{x:front.x,y:-front.z,z:front.y},step*50);
         tank.setTurret(tankTurret.yaw,tankTurret.pitch);
         const nowMs=elapsed*1000;
         if((input.down('ControlLeft')||input.down('ControlRight')||input.down('MouseFire'))&&nowMs>tankLastFire+TANK_FIRE_INTERVAL_MS){
          tankLastFire=nowMs;
          const local=tankShotDirection(tankTurret),dir=new Vector3(local.x,local.z,-local.y).applyQuaternion(tq);
          const muzzle=tank.muzzleWorld()??(()=>{const m=tankDefaultMuzzle(tankTurret),p=tank.car.body.translation(),o=new Vector3(m.x,m.z,-m.y).applyQuaternion(tq);return new Vector3(p.x+o.x,p.y+o.y,p.z+o.z);})();
          const length=dir.length()||1,unit={x:dir.x/length,y:dir.y/length,z:dir.z/length};
          const hit=sim.world.castRay(new RAPIER.Ray(muzzle,unit),TANK_SHOT_RANGE*length,true,undefined,undefined,undefined,tank.car.body);
          const end=hit?Math.max(0,hit.timeOfImpact-TANK_SHOT_RANGE*length*.04):TANK_SHOT_RANGE*length;
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
         cannonAim=stepFireTruckAim(cannonAim,{x:front.x,y:-front.z,z:front.y},step*50,swat);
         cannonCar.setCannon(cannonAim.yaw);
         cannonFiring=input.down('ControlLeft')||input.down('ControlRight')||input.down('MouseFire');
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
        if(fleet?.occupiedBoat&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=weapons.inventory.weapon.automatic?(input.down('ControlLeft')||input.down('ControlRight')||key):key;
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDrivebyBoat(fleet.occupiedBoat,{origin:render.camera.position,direction});}
        }

        const rocket=input.consume('KeyB')||input.down('KeyB');
        if(fleet?.occupiedPlane&&(firing||input.down('ControlLeft')||input.down('ControlRight')||rocket))weapons.fireAircraft(fleet.occupiedPlane,rocket);
        const tTraffic=performance.now();
        guard('phones.step',()=>{for(const [key,phone] of phones){
         const view=key==='player'?render.nativeCharacter:(key as Pedestrian).view;
         if(key!=='player'&&!pedestrians?.hasPed(key as Pedestrian)){phones.delete(key);continue;}
         phone.step(view);if(!phone.active&&key!=='player')phones.delete(key);
        }});
        guard('traffic.beforeStep',()=>traffic?.beforeStep(step));guard('scriptCars.step',()=>{scriptCars.step(step,sim.player.position);if(mission)scriptCars.pathAreas(sim.player.position);});guard('police.beforeStep',()=>police?.beforeStep(step,worldCar?.occupied?worldCar:undefined));guard('driveby.beforeStep',()=>driveby?.beforeStep(step,worldCar?.occupied?worldCar:undefined));
        frameProfile.stepTraffic+=performance.now()-tTraffic;const tPeds=performance.now();
        guard('pedestrians.beforeStep',()=>pedestrians?.beforeStep(step,fleet?.cars??[]));
        frameProfile.stepPeds+=performance.now()-tPeds;
        // CPhysical::ApplyCollision and CEventVehicleCollision for cars striking CJ on foot.
        if(onFoot)for(const hit of carsStrikePlayer(sim,fleet?.cars??[],{excluded:carEntry.active?carEntry.car:undefined,
          fistWeapon:()=>([WEAPON.unarmed,WEAPON.brassKnuckle,WEAPON.golfClub,WEAPON.knife] as number[]).includes(weapons.inventory.selected),
          // CTaskSimpleShakeFist: ANIM_ID_FUCKU from the default group.
          shakeFist:()=>{const view=render.nativeCharacter;if(view&&!view.reactionName&&view.hasReaction('fucku'))view.playReaction('fucku');}})){playerCarHits.contacts++;if(hit.hurt){playerCarHits.hurt++;playerCarHits.hurtBy=hit.response.event.kind;}playerCarHits.last=hit.response.event.kind;}
        const controlsOff=playerControlsDisabled();
        const axes = law.arrested||weapons.stealth||entryBusy||controlsOff?{x:0,y:0}:input.axes();
        let jumpPressed=input.consume('Space')&&!law.arrested&&!weapons.stealth&&!entryBusy&&!controlsOff;
        // CTaskSimplePlayerOnFoot::PlayerControlDucked (reversed): sprint or a jump press stands a crouched CJ up
        // (ClearTaskDuckSecondary). Only the ducked control runs that frame, so the press does not also jump.
        if(sim.player.crouched&&sim.player.grounded&&!law.arrested&&(jumpPressed||input.down('ShiftLeft')||input.down('ShiftRight'))&&(duck.rolling||sim.setCrouched(false)))jumpPressed=false;
        // PlayerControlZelda jumps only while the target button is up (PlayerControlZeldaWeapon never does).
        let controls:import('./simulation/Simulation').Controls = { ...axes, jetPack:!!sim.jetPack, cameraYaw: render.yaw, cameraPitch: Math.asin(Math.max(-1,Math.min(1,render.camera.getWorldDirection(fogReductionForward).y))), walk: input.down('AltLeft') || input.down('AltRight'), sprint: input.down('ShiftLeft') || input.down('ShiftRight'), jump: jumpPressed&&!input.down('MouseAim'),jumpHeld:input.down('Space')&&!law.arrested,exitVehicle:input.down('KeyF'),parachute:weapons.parachute,facing:weapons.stealth?sim.player.heading:weapons.aiming?render.yaw+Math.PI:undefined };
        // CTaskSimpleSwim player states: Space surfaces, attack dives, sprint selects the crawl.
        if(onFoot&&sim.player.health>0&&!law.arrested&&!carEntry.active){
          const splash=updatePlayerSwim(sim.player,{moveMag:Math.max(0,axes.y),sprint:input.down('ShiftLeft')||input.down('ShiftRight'),jump:jumpPressed,dive:key,underwaterStroke:render.nativeCharacter?.swimUnderAssociation()},swimWater,step,carEntry.clips.peek('swim','Swim_Dive_Under')?.duration);
          if(splash.damage>0)sim.damagePlayer(splash.damage,true);
          controls={...controls,swimWater,jump:sim.player.swimming?false:controls.jump};
        }else if(sim.player.swimming)stopSwim();
        if(carEntry.active&&sim.player.swimming)carEntry.cancel();
        if(carEntry.phase==='approach')controls=carEntry.approach(step,controls,{x:axes.x,y:axes.y,quit:controls.jump||firing});
        if(carEntry.active&&(sim.player.health<=0||law.arrested))carEntry.abandon();
        for(const pl of fleet?.planes??[])if(pl.entry&&(sim.player.health<=0||law.arrested))pl.cancelEntry();
        const entryMotion=carEntry.step(step,{pedal:input.down('KeyW')||input.down('KeyS'),moving:Math.hypot(axes.x,axes.y)>0||input.down('MouseAim')});
        carEntry.stepPassengers(step);
        surfaceSprintBlocked=false;
        if(importedScene&&sim.player.grounded&&lastGround){
          surfaceSprintBlocked=surfaceBlocksSprint(surfaceSprint,lastGround?.material);
          if(controls.jump&&steepSlopeRefusesJump(surfaceSteep,lastGround?.material,{x:Math.sin(sim.player.heading),z:Math.cos(sim.player.heading)},lastGround?.normal))controls.jump=false;
          if(surfaceSprintBlocked)controls.sprint=false;
        }
        // CTaskComplexGotoDoorAndOpen under CTaskSimpleUninterruptable: a walk-in entrance walks CJ 4 units on, out of the pad's hands.
        const walkIn=entryExits?.active?.walk;
        if(walkIn&&onFoot){const p=sim.player.position,dx=walkIn[0]-p.x,dz=-walkIn[1]-p.z;controls={...controls,x:0,y:Math.hypot(dx,dz)>.5?-1:0,cameraYaw:Math.atan2(dx,dz),walk:true,sprint:false,jump:false,facing:undefined};}
        // A warp with no walk-in (UNKNOWN_PAIRING, FOOD_DATE_FLAG) sets bPlayerOnInteriorTransition, one of
        // DisablePlayerControls' reasons, and on foot adds CTaskSimpleUninterruptable: CJ stands still through the fade.
        else if(entryExits?.active&&onFoot)controls={...controls,x:0,y:0,walk:false,sprint:false,jump:false,facing:undefined};
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
        // CTaskSimpleUseGun moves an aimed gun's holder on the GunMove clips at the skill row's move speed.
        const aimedGun=weapons.aiming&&(['bullet','shotgun','rocket','guided','flame'].includes(weapons.inventory.weapon.kind)||!!render.firstPerson)?weapons.inventory.info():undefined;
        if(aimedGun)controls={...controls,gunMove:{aimWithArm:!!(aimedGun.flags&WEAPON_FLAG.aimWithArm),moveAim:!!(aimedGun.flags&WEAPON_FLAG.moveAim),moveFire:!!(aimedGun.flags&WEAPON_FLAG.moveFire),firing:gunFiring,moveSpeed:aimedGun.moveSpeed}};
        // CTaskSimplePlayerOnFoot::PlayerControlDucked feeds CTaskSimpleDuck::ControlDuckMove: aiming a gun walks forward and
        // back on the stick and rolls on a sideways push; otherwise CJ turns to the stick and crouch-walks forward.
        if(sim.player.crouched&&sim.player.grounded&&onFoot&&!sim.player.swimming&&sim.player.health>0){
          // The pad's walk axis is negative forward; the key axes are positive forward.
          const move=playerDuckMove(controls.x,-controls.y,weapons.aiming&&weapons.inventory.weapon.kind!=='melee');
          duck.control(move.x,move.y,step*50);controls={...controls,duck:{clip:duck.clip,speed:duck.speed}};
        }else duck.reset();
        // The player's pad for NitrousControl and BoostJumpControl: the car-gun button, the look keys and a fresh horn press.
        {const horn=input.down('CapsLock')||input.down('KeyH'),looking=input.down('KeyQ')||input.down('KeyE')||input.down('MouseMiddle');
         // The car-gun stick (GetCarGunLeftRight / GetCarGunUpDown) on the PC's special-control keys, numpad 4/6 and 8/2.
         const stick={leftRight:(Number(input.down('Numpad6'))-Number(input.down('Numpad4')))*128,upDown:(Number(input.down('Numpad2'))-Number(input.down('Numpad8')))*128};
         // GetHydraulicJump reads ShockButtonR, TOGGLE_SUBMISSIONS in a car: the '2' key and numpad plus.
         carPad={carGun:input.down('ControlLeft')||input.down('ControlRight')||input.down('MouseFire'),looking,hornJustDown:horn&&!hornHeldLast,stick,hydraulicJump:input.down('Digit2')||input.down('NumpadAdd'),
          // VEHICLE_STEERUP / STEERDOWN are the arrow keys on the PC; GetAccelerate is W (the port's arrows also drive).
          steerUpDown:Number(input.down('ArrowDown'))-Number(input.down('ArrowUp')),accelerate:input.down('KeyW')};hornHeldLast=horn;}
        // CObject::ProcessControl once a 30 fps game frame: the exploded props' roll and loose props settling static again.
        for(explodedClock+=step;explodedClock>=1/30;explodedClock-=1/30){hideExplodedProps();importedScene?.settleMoving();}
        // CTrain::ProcessControl: every carriage to its place on the rails, the bodies following in this step.
        fleet?.stepTrains(step*50,gameTimeMs);
        for(const car of fleet?.cars??[]){car.wetRoads=weatherStarted?weather.wetRoads:0;car.propFor??=scenePropFor;car.firstPersonCamera=!!render.firstPerson;car.controlsDisabled=playerControlsDisabled();car.pad=car.occupied&&!playerControlsDisabled()?carPad:NO_CAR_PAD;car.beforeStep(step,axes,input.down('Space'),importedScene?.sources);}
        for(const plane of fleet?.planes??[])plane.beforeStep(step,{throttle:Number(input.down('KeyW'))-Number(input.down('KeyS')),pitch:Number(input.down('ArrowDown'))-Number(input.down('ArrowUp')),roll:Number(input.down('KeyD'))-Number(input.down('KeyA')),rudder:Number(input.down('KeyE'))-Number(input.down('KeyQ')),brake:input.down('Space')});
        for(const plane of fleet?.planes??[])if(plane.entry&&advancePlaneEntry(plane.entry,step)){const phase=plane.entry.phase;plane.entry=undefined;hud.message(phase==='getin'?plane.finishEnter():plane.finishExit());}
        for(const boat of fleet?.boats??[])boat.beforeStep(step,boat.occupied?{throttle:axes.y,steer:axes.x,brake:input.down('Space')}:undefined);
        // ProcessDrivingAnims in a boat: a boat without m_bSitInBoat uses the DRIVE_BOAT set, steering and looking back.
        {const boat=fleet?.occupiedBoat;if(boat&&!(boat.modelFlags&MODEL_FLAG.sitInBoat))boat.driving.step(step,{steer:boat.steerAngle,reversing:boat.gasPedal<0&&!(boat.modelFlags&MODEL_FLAG.low),idleFull:true,ride:BOAT_RIDE,duration:name=>carEntry.clips.ped(name)?.duration});}
        const bikeMotion=bikeMount.step(step);
        // While the rider waits or gets off, the bike only brakes.
        // DisablePlayerControls: no hop (CBmx refuses the press and drops the charge), gas off and the brakes on, as
        // CAutomobile::ProcessControlInputs does for the quad.
        for(const bike of fleet?.bikes??[])bike.beforeStep(step,bike.occupied?(bikeMount.active&&bikeMount.bike===bike||controlsOff?{throttle:0,steer:0,brake:true,disabled:controlsOff}:{throttle:axes.y,steer:axes.x,brake:input.down('Space'),hop:input.down('ControlLeft')}):undefined);
        const tPlayer=performance.now();
        const riding=!!(worldCar?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike||carEntry.pinned||bikeMount.pinned||playerPassenger);
        // A ride or entry sequence ending leaves CJ standing: neither move blend ratio carries over from before it.
        if(wasRiding!==riding){wasRiding=riding;sim.player.moveBlend=0;sim.player.speed=0;sim.player.jumpMomentum={x:0,z:0};render.nativeCharacter?.resetLocomotion();}
        if(riding){
          // CPlayerPed::ProcessControl: in any vehicle but a CBmx (the BMX, Chopper and Mountain Bike), sprint energy
          // recovers as standing still.
          if(!BMX_MODELS.has(fleet?.occupiedBike?.modelId??-1))sim.player.stamina=stepStamina(sim.player.stamina,false,false,step);
          sim.world.step();sim.advanceClock(step*sim.clockRate());
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
        else {const animated=sim.climbing?controls:render.nativeCharacter?.step(step, controls, sim)??controls;sim.step(step,weapons.aiming&&!(controls.gunMove&&animated.animationMotion)?controls:animated);}
        frameProfile.stepPlayer+=performance.now()-tPlayer;
        if(render.nativeCharacter?.duckRollDone)duck.rollFinished();
        kickSweptProps();
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
            distanceToWater:level?sampledDistanceToWater(waterLevel,c.x,-c.z):Infinity,desert:nativeWeatherRegion(c.x,-c.z)===WEATHER_REGION.desert,waterLevel,
            lineOfSightClear:(a,b)=>{const from={x:a[0],y:a[2],z:-a[1]},d={x:b[0]-a[0],y:b[2]-a[2],z:-(b[1]-a[1])},l=Math.hypot(d.x,d.y,d.z)||1;
              return !sim.world.castRay(new RAPIER.Ray(from,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.ONLY_FIXED);}},++birdFrame,1/30);
        }
        // Once each: afterStep hands back a pending BlowUpCar, which a second call would lose.
        for(const boat of fleet?.boats??[])if(boat.afterStep())weapons.vehicleExplosion(boat.body.translation(),'boat');
        for(const bike of fleet?.bikes??[]){bike.propFor??=scenePropFor;if(bike.afterStep())weapons.vehicleExplosion(bike.body.translation(),'bike');}
        carEntry.syncPlayer();
        for(const plane of fleet?.planes??[]){plane.onBurnExplosion??=at=>weapons.burningAircraftExplosion(at);if(plane.afterStep())weapons.vehicleExplosion(plane.body.translation(),'aircraft',()=>fleet?.planes.has(plane)?{...plane.body.translation()}:undefined);}
        if(stuntJumps){
         // Any vehicle but a boat, plane or helicopter: cars and bikes alike.
         const car=[...(fleet?.cars??[])].find(c=>c.occupied)??(worldCar?.occupied?worldCar:undefined),bike=car?undefined:fleet?.occupiedBike;
         const body=car?.car.body??bike?.body,p=body?.translation(),v=body?.linvel();
         const water=p?render.lighting.water.levels?.level(p.x,-p.z):undefined,under=water!==undefined&&p!==undefined&&water>p.y;
         stuntJumps.update(step*1000,{driving:!!body&&sim.player.health>0&&!law.arrested,position:p?{x:p.x,y:-p.z,z:p.y}:{x:0,y:0,z:0},
          moveSpeed:v?{x:v.x/50,y:-v.z/50,z:v.y/50}:{x:0,y:0,z:0},collided:car?car.entitiesCollided:bike?bike.entitiesCollided():1,lost:car?car.wrecked||car.drowning||under:bike?bike.wrecked||under:false});
        }
        progression.tick(step,!!worldCar?.occupied,law.level,law.arrested);
        carEntry.drivingSkill=progression.drivingSkill;
        if(entryExits&&importedScene&&!interiorTransfer){
         const active=entryExits.active;
         if(active){
          const next=entryExits.finishStep(cameraFade.fading);
          if(next==='teleport')startInteriorTransfer(active);
          else if(next){cameraFade.fade(next.fade*1000,0,gameTimeMs);hud.fade(true,next.fade*1000);}
         }else{
          const p=sim.player.position;
          // CPlayerPed::CanPlayerStartMission: in control, no attack task, alive. Vehicles are not teleported yet.
          const canStart=onFoot&&sim.player.health>0&&!law.arrested&&!sim.climbing&&sim.player.grounded&&!weapons.aiming&&!sim.player.swimming&&sim.knockdown===0&&sim.deathRemaining===0;
          entryExits.update({position:[p.x,-p.z,p.y+1],vehicle:onFoot?undefined:{type:'other',big:false},canStartMission:canStart},Math.floor(sim.timeMinutes/60)%24,playerControlsDisabled());
         }
        }
        // CPickup::Update: only a bribe can be taken from a vehicle, any vehicle (IsSphereTouchingVehicle); the rest need
        // the player on foot.
        const driven=worldCar?.occupied?worldCar:fleet?.occupied,ridden=fleet?.occupiedBike??fleet?.occupiedBoat??fleet?.occupiedPlane;
        pickups.step(step,driven?(point,radius)=>driven.sphereTouches(point,radius):ridden?(point,radius)=>!!ridden.assets.collision&&sphereTouchingVehicle(ridden.body,ridden.assets.collision.bounds,point,radius):carEntry.active&&carEntry.phase!=='approach'?()=>false:undefined,Math.floor(gameTimeExact*30/1000));
        const onFootDrops=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&(!carEntry.active||carEntry.phase==='approach');
        const cash=moneyDrops.step(step,{position:sim.player.position,alive:sim.player.health>0,onFoot:onFootDrops});
        if(cash){sim.money+=cash;sound.frontend(AE_FRONTEND.pickupMoney);}
        drops.step(step,{position:sim.player.position,alive:sim.player.health>0,onFoot:onFootDrops},(weapon,rounds)=>{
         const before=weapons.inventory.selected,given=weapons.inventory.give(weapon,rounds);
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
    if(!paused&&!navigation?.open&&!arsenal.open){stepPrebuild();requestFollowingTerrain();}
    // A passenger whose car has gone or burnt out is set down beside it.
    if(playerPassenger&&(playerPassenger.car.disposed||playerPassenger.car.wrecked))leavePassengerSeat();
    render.vehicleView=!!worldCar?.occupied||!!fleet?.occupiedPlane||!!fleet?.occupiedBoat||!!fleet?.occupiedBike||!!playerPassenger;
    {
      const p=sim.player,water=render.lighting.water.levels?.level(p.position.x,-p.position.z),entering=carEntry.active&&['approach','align','locked','open','pullout','getIn','closeInside','shuffle'].includes(carEntry.phase!);
      const inCar=!!worldCar?.occupied||!!fleet?.occupiedPlane||!!fleet?.occupiedBoat||carEntry.seated||carEntry.phase==='waitSlow'||carEntry.phase==='getOut';
      render.playerShadowAllowed=drawsRealTimeShadow({submerged:water!==undefined&&water>p.position.y,vehicle:fleet?.occupiedBike?'bike':inCar?'other':undefined,enteringAsDriver:entering?'other':undefined,
        // The drawn ped's root is its matrix position: a unit above the feet on foot, the seat when riding.
        alive:p.health>0,originZ:render.nativeCharacter?.root.getWorldPosition(scratchSpine).y??p.position.y+PED_ORIGIN_HEIGHT,spine1Z:render.nativeCharacter?.bonePosition(3,scratchSpine)?.y,ducking:p.crouched});
    }
    installSwimClips();if(!builtBody)rebuildPlayerIfNeeded();applyPlayerMotionGroup();
    render.vehicleDistance=fleet?.occupiedPlane?Math.max(22,fleet.occupiedPlane.assets.collision!.bounds.radius*2.5):9;render.vehicleLooks=!fleet?.occupiedPlane;
    guard('pedestrians.render',()=>pedestrians?.render(alpha,render.lighting.nativeObjectAmbient,nativeDayNightBalance(sim.timeMinutes),weapons.vision==='infrared'));
    for(const plane of fleet?.planes??[])plane.update(alpha);
    for(const boat of fleet?.boats??[])boat.update(alpha);
    for(const bike of fleet?.bikes??[])bike.update(alpha);
    for(const train of fleet?.trains??[])train.update();
    const aircraft=fleet?.occupiedPlane;hud.element.classList.toggle('flying',!!aircraft);flightInstruments.hidden=!aircraft;if(aircraft)flightInstruments.textContent=`${aircraft.name} · ${Math.round(aircraft.airspeed*3.6)} km/h · ${Math.round(aircraft.altitude)} m AGL · Throttle ${Math.round(aircraft.throttle*100)}% · Gear ${aircraft.gearUp?'UP':'DOWN'}${aircraft.modelId===520?` · ${aircraft.vtol?'VERTICAL':'FORWARD'} [T]`:''}${aircraft.armed?` · Guns ${aircraft.gunAmmo} [Ctrl]${aircraft.modelId!==476?` · Rockets ${aircraft.rockets} [B]`:''}`:''}${aircraft.stall?' · STALL — lower nose':''} | W/S throttle · ↓/↑ pitch · A/D bank · Q/E turn · G gear · Space ${aircraft.helicopter||aircraft.modelId===520&&aircraft.vtol?'hover':'brake'} · F exit`;
    for(const car of fleet?.cars??[]){car.car.update(alpha);car.car.setNight(nativeDayNightBalance(sim.timeMinutes));}
    sirens.update(fleet?.cars??[],Math.floor(elapsed*1000));
    // CSkidmarks::Update in the game frame, then each car's PreRender registers its wheels, then Render.
    if(!paused&&!navigation?.open&&!arsenal.open&&roadSurfaces){const surfaces=roadSurfaces,now=Math.floor(elapsed*1000);skids.update(now);
      for(const car of fleet?.cars??[])skids.lay(car,now,{skidMark:material=>surfaces.records.get(material)?.skidMark,water:material=>!!surfaces.records.get(material)?.values.water},render.camera);}
    skids.render(Math.floor(elapsed*1000),nativeDayNightBalance(sim.timeMinutes));
    playerDamageReactions(dt);
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
    if(scriptObjectViews&&mission)scriptObjectViews.update(mission.scriptObjects());
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
    occupants.update([...occupants.drivers(fleet?.cars??[],car=>policeCars.has(car)||!!driveby?.covers(car)),...leavingAll.map(({pose:leaving,clip:leavingClip})=>({key:`leaving:${leaving.car.car.body.handle}`,car:leaving.car,model:occupants.driverModel(leaving.car),local:leaving.local,clip:leaving.clip,seconds:leaving.seconds,animation:leavingClip.clip})),...(police?.poses().map((p,i)=>({...p,key:`police:${p.car.car.body.handle}:${i}`}))??[]),...(driveby?.poses()??[]),...carEntry.passengerPoses(),...carEntry.leavingPoses(),...scriptOccupantPoses()],render.lighting.nativeObjectAmbient,nativeDayNightBalance(sim.timeMinutes));
    const entryPose=carEntry.pose(),entryClips=entryPose&&carEntry.requiredClips();
    const entryPlane=[...(fleet?.planes??[])].find(p=>p.entry);
    if(entryClips&&render.nativeCharacter)render.nativeCharacter.installVehicleClips(entryClips,['car_rollout_lhs','car_rollout_rhs']);
    // The climb's clip lengths come from ped.ifp; climbing waits for them.
    if(!sim.climbDurations){const clips=CLIMB_CLIPS.map(name=>carEntry.clips.peek('ped',name));if(clips.every(clip=>clip))sim.climbDurations=Object.fromEntries(CLIMB_CLIPS.map((name,i)=>[name,clips[i]!.duration])) as Record<typeof CLIMB_CLIPS[number],number>;}
    // CTaskSimpleClimb's partial CLIMB_* association, standing at the ped position with its root translation.
    const climbAnim=sim.climb?.anim,climbJump=sim.climbJumpSeconds,climbClips=(climbAnim||climbJump!==undefined)&&render.nativeCharacter?CLIMB_CLIPS.map(name=>[name.toLowerCase(),carEntry.clips.ped(name)] as const):undefined;
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
        render.vehiclePose={frame:{vehicle:bike.root,local:seat},pose:{clip:pose.idle,seconds:idle.duration,blend:1,overlay:lean&&pose.overlay?{...pose.overlay}:undefined}};
      }else render.vehiclePose=undefined;
    }else render.vehiclePose=undefined;
    if(carEntry.message){hud.message(carEntry.message);carEntry.message=undefined;}
    for(const bike of fleet?.bikes??[])if(bike.message){hud.message(bike.message);bike.message=undefined;}
    if(!paused&&!navigation?.open&&!arsenal.open){if(weatherStarted)worldFx.weather({rain:weather.rain,sandstorm:weather.sandstorm,wind:weather.wind,windDir:[weather.windDir.x,weather.windDir.y,weather.windDir.z],noRain:cullNoRain()});const onFoot=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&(!carEntry.active||carEntry.phase==='approach');if(mission&&(mission.scriptFireCount()>0||scriptFiresBurning>0)){scriptFiresBurning=mission.scriptFireCount();weapons.fires.syncScriptFires(mission.scriptFires());}worldFx.syncFires(weapons.fires.active);worldFx.step(dt,fleet?.cars??[],weapons.hazards,fleet?.planes??[],[...(onFoot?[{position:sim.player.position,speed:sim.player.speed,grounded:sim.player.grounded}]:[]),...(onFoot?(pedestrians?.walkers()??[]):[])],fleet?.boats??[]);}
    frameProfile.between+=performance.now()-tBetween;const tRender=performance.now();
    render.update(dt, alpha, input, elapsed, paused||terrainPause||!!navigation?.open||arsenal.open);
    frameProfile.render+=performance.now()-tRender;frameProfile.frames++;
    journal.update();wantedHud.update(law,gameTimeMs);
    arsenal.update(weaponView.error,weaponView.crosshair);
    hud.weapon(weapons.inventory.weapon.name,weaponView.icon,weapons.inventory.selected===0);
    // CTaskSimplePlayerOnFoot::PlayIdleAnimations on CPad's untouched time (game time: it stops while paused). Ducking,
    // aiming, moving, disabled control or a vehicle count as touching.
    {const view=render.nativeCharacter,onFoot=sim.playerBody.isEnabled()&&sim.playerCollider.isEnabled()&&!sim.player.swimming;
     if(input.touches!==playerIdleTouches||!onFoot||sim.player.crouched||sim.player.speed>.1||weapons.aiming||law.arrested||sim.knockdown>0||sim.climbing||sim.player.health<=0){playerIdleTouches=input.touches;playerUntouchedMs=0;}
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
    if(paused)padsAfterPause=true;
    if(mission&&!paused){
      // CPad::Update: the script reads the pad the held keys make, through the driving mapping while the player drives
      // with the controls on. JustOutOfFrontEnd holds for the first frame after the menu.
      {const pads=mission.runtime.game.pads,driving=mission.playerControl!==false&&!!(worldCar?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike);
       padStateFromActions(heldPadActions(code=>input.down(code)),driving?'driving':render.firstPerson?'firstPerson':'thirdPerson',false,pads.pads[0]);
       pads.justOutOfFrontEnd=padsAfterPause;padsAfterPause=false;}
      const clock=mission.runtime.game.clock;clock.follow(sim.timeMinutes,sim.weekDay);
      const set=[clock.hours,clock.minutes,clock.seconds,clock.currentDay];
      // CCutsceneMgr::IsCutsceneSkipButtonBeingPressed: the left mouse button held, or Return or Space just pressed.
      {const enter=input.down('Enter')||input.down('NumpadEnter'),space=input.down('Space');
       cutsceneSkipNow=input.down('MouseFire')||enter&&!skipKeysLast.enter||space&&!skipKeysLast.space;skipKeysLast={enter,space};}
      mission.step(elapsed*1000,dt*1000);
      if(clock.hours!==set[0]||clock.minutes!==set[1]||clock.seconds!==set[2]||clock.currentDay!==set[3]){sim.timeMinutes=clock.hours*60+clock.minutes+clock.seconds/60;sim.weekDay=clock.currentDay;}
    }
    sound.update(render.camera.position, render.viewYaw, render.viewPitch);
    if(!paused&&!navigation?.open&&!arsenal.open)sound.nativeFrame(dt,()=>{
      const engine=sound.nativeEngine,alive=sim.player.health>0,cars=[...(fleet?.cars??[])],planes=[...(fleet?.planes??[])];
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
      if(driven)hornInput.process(driven,input.down('CapsLock')||input.down('KeyH'),NATIVE_SIREN_MODELS.has(driven.modelId));
      const audioCamera=nativeAudioCamera(render.camera,sim.player.position,render.scoped);
      const cityVehicle=driven??fleet?.occupiedPlane;
      const cityLin='car' in (cityVehicle??{})?(cityVehicle as ScriptCar).car.body.linvel():(cityVehicle as import('./simulation/WorldPlane').WorldPlane|undefined)?.body.linvel();
      return {camera:audioCamera,
        vehicles:[...cars.map(car=>[car,car.modelId,worldCarAudioInput(car,alive,surfaceAudio?.byId)] as const),...planes.map(plane=>[plane,plane.modelId,worldPlaneAudioInput(plane,alive,{accelerate:Number(input.down('KeyW')),brake:Number(input.down('KeyS'))})] as const)],
        weather:weatherStarted?{rain:weather.rain,windClipped:weather.windClipped,lightningDuration:weather.lightningDuration,noRain:cullNoRain(),outside:render.lighting.area===0,cameraZ:render.camera.position.y,
          city:{camPos:audioCamera.position,camRight:audioCamera.right,camForward:audioCamera.forward,playerPos:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},inVehicle:!!cityVehicle,moveSpeed:cityLin?{x:cityLin.x/50,y:-cityLin.z/50,z:cityLin.y/50}:{x:0,y:0,z:0},
            los:(origin,target)=>{const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,dist=Math.hypot(dx,dy,dz);if(!(dist>0))return undefined;
              // CWorld::ProcessLineOfSight for city-noise whooshes: fixed world geometry blocks the lateral probe.
              const hit=sim.world.castRay(new RAPIER.Ray(origin,{x:dx/dist,y:dy/dist,z:dz/dist}),dist,true,RAPIER.QueryFilterFlags.ONLY_FIXED|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
              if(!hit)return undefined;const t=hit.timeOfImpact;return {point:{x:origin.x+dx*t/dist,y:origin.y+dy*t/dist,z:origin.z+dz*t/dist},physical:{x:0,y:0,z:0},entity:hit.collider.handle};}}}:undefined,
        ambient:weatherStarted?{region:nativeWeatherRegion(render.camera.position.x,-render.camera.position.z),camera:{x:render.camera.position.x,y:-render.camera.position.z,z:render.camera.position.y},player:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},foggynessSF:weather.foggynessSF}:undefined,
        fires:fires.map(f=>[f.key,f.at] as const),
        player:{weapon:weapons.inventory.selected,swimming:sim.player.swimming,onFoot:!driven&&!fleet?.occupiedPlane&&!carEntry.active,inVehicle:!!radioDriven,attacking:input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'),radio:radioModel!==undefined}};
    });
    hud.audioStatus(sound.state());
    hud.update(sim, render.viewYaw, {maxHealth:mission?.runtime.game.playerInfo.maxHealth??100,maxArmour:mission?.runtime.game.playerInfo.maxArmour??100});
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
    // CHud::DrawAfterFade skips DrawAreaName in a plane. It also skips it while DISPLAY_ZONE_NAMES is off, but
    // MAIN.SCM turns names off for the INTRO mission, which here never gets past waiting for car recordings 706
    // and 707 (no host reads carrec.img), so the script's switch is recorded and not applied.
    hud.drawNames(dt*1000,paused,radioVehicle,!!fleet?.occupiedPlane,!!mission?.runtime.game.widescreenOn,mission?.runtime.game.displayVehicleName===false);
    hud.widescreen(!!mission?.runtime.game.widescreenOn);
    hud.displayHud(mission?.runtime.game.displayHud??true);
    {const camera=mission?.runtime.game.camera;render.scriptNearClip=camera?.useNearClipScript?camera.nearClipScript:undefined;}
    // CMessages::Process once a game frame, and CMessages::Display handing the front of each queue to the HUD: the
    // brief to the subtitle line, STYLE_MIDDLE and STYLE_WHITE_MIDDLE to their big messages, and CHud's help message.
    // The other styles go through CHud's own clocks (nativeHudBigMessages).
    {const game=mission?.runtime.game;
     if(game&&!paused){
      game.messages.process(gameTimeMs);
      const text=(m:{key:string;insert?:string;numbers:readonly number[]})=>gxtHudText(insertNumbers(gxtText(m.key,m.key).replace('~a~',m.insert?gxtText(m.insert,m.insert):''),...m.numbers));
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
      const help=game.help.message,revision=game.help.revision;
      if(revision!==shownScript.helpRevision&&game.help.statId){shownScript.help=help;shownScript.helpRevision=revision;}
      else if(revision!==shownScript.helpRevision){const [key,number]=help.split('#');hud.help(help?gxtHudText(number!==undefined?insertNumbers(gxtText(key,key),Number(number)):gxtText(key,key)):'',game.help.permanent?1e9:game.help.quick?3000:5000);shownScript.help=help;shownScript.helpRevision=revision;}
     }}
    {const colour=mission?.runtime.game.fadeColour;if(colour)hud.fadeColour(colour.red,colour.green,colour.blue);}
    {const shown=mission&&!paused?mission.onscreenDisplay():undefined,label=(key:string)=>key?gxtHudText(gxtText(key,key)):'';
     hud.missionTimers(shown&&{clock:shown.clock&&{text:shown.clock.text,label:label(shown.clock.key)},counters:shown.counters.map(c=>({text:c.text,label:label(c.key),type:c.type,value:c.value,colour:HUD_COLOURS[c.colour]??HUD_COLOURS[3]}))});}
    navigation?.setZoneOverlays((gangWars?.zoneOverlays(elapsed*1000)??[]).map(o=>({x1:o.zone.min[0],z1:-o.zone.max[1],x2:o.zone.max[0],z2:-o.zone.min[1],colour:`rgba(${o.colour[0]},${o.colour[1]},${o.colour[2]},${(o.colour[3]/255).toFixed(3)})`})));
    // The script's own blips join the browser's: CRadar's table, drawn where the things it names are.
    navigation?.setLiveBlips([...(mission?.radarBlips()??[]),...(gangWarBlip&&gangWarBlip.visible?[{x:gangWarBlip.position.x,z:-gangWarBlip.position.y,sprite:attackBlipSprite(gangWarBlip.gang)}]:[]),...(pedestrians?.attackWavePositions()??[]).map(p=>{const c=GANG_COLOURS[p.gang??0]??[255,255,255];return {x:p.x,z:p.z,colour:`rgb(${c[0]},${c[1]},${c[2]})`,size:2};})]);
    navigation?.update(sim.player.position,sim.player.heading,[...[...(fleet?.cars??[])].filter(car=>!car.occupied).map(car=>({...car.car.body.translation(),name:car.name})),...[...(fleet?.planes??[])].filter(p=>!p.occupied).map(p=>({...p.body.translation(),name:p.name}))],
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
  let follower:SceneRegionFollower|undefined,followTimer:ReturnType<typeof setTimeout>|undefined,followResume=0;
  function failFollowing(id:number,message:string){
    if(!follower?.finish(id,false))return;
    clearTimeout(followTimer);pendingFollowingData=undefined;
    // CStreaming never gives up on a sector: the follower re-requests the window after a backoff, holding the
    // player at the safety boundary meanwhile. Only a run of failures stops following and shows the menu.
    if(follower.snapshot().enabled){console.warn(`Terrain window ${id} failed; retrying. ${message}`);return;}
    followBoundaryPaused=false;pause();menuBusy(false);
    hud.menuMessage(`${message} Automatic terrain loading stopped; the current area is still available.`);
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
    if(terrainPause&&!installingScene&&!pendingFollowingData&&follower?.snapshot().enabled===true&&(airborne||follower.snapshot().pending===null&&!follower.needsPause(sim.player.position))){
      terrainHold(false);return;
    }
    // Following that stopped for good releases the hold; failFollowing has opened the menu with the reason.
    if(terrainPause&&follower?.snapshot().enabled===false)terrainHold(false);
    if(pendingFollowingData&&eligible&&!installingScene&&(pendingFollowingData.retryAt===undefined||performance.now()>=pendingFollowingData.retryAt)){const data=pendingFollowingData;pendingFollowingData=undefined;void replaceWalkTerrain(data);return;}
    // A window that failed at the safety boundary is asked for again from the pause, once its backoff passes.
    if(paused||installingScene)return;
    // Directional lookahead for the next window: vehicles report Rapier
    // velocity, on-foot motion uses heading and blend speed.
    const motion=fleet?.occupiedPlane?.body.linvel()??(worldCar?.occupied?worldCar.car.body.linvel():undefined)??fleet?.occupiedBoat?.body.linvel()??fleet?.occupiedBike?.body.linvel();
    const followVelocity=motion?{x:motion.x,z:motion.z}:{x:Math.sin(sim.player.heading)*sim.player.speed,z:Math.cos(sim.player.heading)*sim.player.speed};
    const request=follower?.request(sim.player.position,eligible,followVelocity);
    if(!request)return;
    followResume=loadRequest;followBoundaryPaused=false;
    followTimer=setTimeout(()=>failFollowing(request.id,'The terrain request timed out.'),staticWorld?45000:30000);requestedAt.set(request.id,performance.now());
    // Resident: the installed window's models plus the pool's retired sources, whose models the main thread still holds.
    if(staticWorld)staticWorld.request(request.id,request.region,[...new Set([...residentModels.keys(),...(importedScene?.retiredModels().keys()??[])])]);else sceneChannel!.postMessage({type:'region-request',...request});
  }
  /** A window may be asked for and installed under a player who stands, flies, or falls: a parachutist or a jumper
   * over ground that is not streamed in yet would otherwise fall out of the world while the window waited for him
   * to land on nothing (the boundary hold freezes him mid-air). Only a brief hop keeps the swap off. */
  let airborneSince=0;
  const playerMayTakeTerrain=()=>{
    const now=performance.now();
    if(sim.player.grounded||!!fleet?.occupiedPlane){airborneSince=0;return true;}
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
    installingScene=true;if(!automatic&&!quiet)pause();if(!quiet){menuBusy(true);hud.menuMessage('Preparing the selected terrain…');}
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
      importedScene=next;reapplySmashedProps(next);prunePropStates(next);localLighting.setModifiers(modifiers);render.lighting.area=next.area;
      lastSwap={ms:+(performance.now()-swapStart).toFixed(1),latencyMs:data.latencyMs??0,workerMs:+(data.workerMs??0).toFixed(0),timings:data.timings??{},parts:data.parts.length,placements:next.instanceCount,reusedPlacements:next.reusedPlacementCount,pooledModels:next.pooledModelCount,payloadMB:+(payloadBytes/1e6).toFixed(1),resident:residentCount,prebuiltMs:data.prebuiltMs??0,stages:Object.fromEntries(Object.entries(next.buildStages).map(([k,v])=>[k,+v.toFixed(1)]))};
      residentModels=residentModelsOf(data.parts);
      sim.respawn=spawn!;if(!preserve&&!quiet){sim.resetPlayer();render.yaw=sim.player.heading+Math.PI;}if(!automatic&&!quiet)sound.reset(sim);
      if(!quiet){hud.button('play').hidden=false;hud.button('play').textContent='Walk imported scene';
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
      if(alive){if(!quiet)menuBusy(false);if(completed&&autoResume&&paused&&loadRequest===resumeVersion&&!document.hidden)play();}
    }
  };
  /** CEntryExit::TransitionFinished once the screen is black: CStreaming::LoadScene at the spawn point's exit in its
   * area (the game clock is suspended meanwhile), then the teleport. */
  function startInteriorTransfer(t:EntryExitTransition){
    if(!staticWorld){entryExits?.arrived();return;}
    interiorTransfer=t;follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;
    const [x,y]=t.spawn.exit,area=t.spawn.area;
    staticWorld.request(-2,area===0?{x,y,radius:180,lodRadius:1000,includeCollisionBounds:true}:{x,y,radius:100,includeCollisionBounds:true,interior:area});
  }
  async function finishInteriorTransfer(data:TerrainUpdate){
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
    sim.player.position={...feet};sim.player.previous={...feet};sim.player.heading=heading;sim.player.speed=0;sim.respawn={...feet};
    sim.playerBody.setTranslation({x:feet.x,y:feet.y+.9,z:feet.z},true);sim.playerBody.setNextKinematicTranslation({x:feet.x,y:feet.y+.9,z:feet.z});
    // TheCamera.RestoreWithJumpCut behind the player.
    render.yaw=heading+Math.PI;
    // CPopulation::RemoveAllRandomPeds; the interior's own peds (PopulateInterior) are not generated.
    pedestrians?.removeAllRandomPeds();
    entryExits?.arrived();rebuildPlayerIfNeeded();
    // TransitionFinished's shop (reconstructed): a reward interior's door unloads the shop, any other door loads the
    // shop its name names and marks its pair as the reward side.
    {const shopping=mission?.runtime.game.shopping,door=t.enex;
     if(shopping){if(door.flags&ENEX.REWARD_INTERIOR)shopping.removeLoadedShop();else{try{shopping.loadShop(door.name);}catch(error){console.warn('LoadShop',door.name,error);}if(door.link)door.link.flags|=ENEX.REWARD_INTERIOR;}}}
    follower=spawn.area===0?new SceneRegionFollower({x:point[0],y:point[1],radius:180,lodRadius:1000,includeCollisionBounds:true}):undefined;
    interiorTransfer=undefined;
    cameraFade.fade(1000,1,gameTimeMs);hud.fade(false,1000);
  }
  function failInteriorTransfer(message:string){
    interiorTransfer=undefined;entryExits?.arrived();
    follower=new SceneRegionFollower({x:sim.player.position.x,y:-sim.player.position.z,radius:180,lodRadius:1000,includeCollisionBounds:true});
    cameraFade.fade(1000,1,gameTimeMs);hud.fade(false,1000);hud.message(message);
  }
  if (importedMode) {
    hud.element.querySelector('.menu-location')!.textContent = walkDemo?included.name:'Imported scene';
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
          try{if(parameters.has('characterTest'))return true;const {readLocalPlayerCharacter}=await import('./assets/localPlayerCharacter');const source=await readLocalPlayerCharacter(files);if(!alive)return false;render.installCharacter(source);return true;}catch{return false;}
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
        hud.menuMessage((walkDemo?`${included.name} is ready. WASD to walk, Shift to sprint, Space to jump.`:'Imported scene ready. WASD to walk; Space to jump. This test scene is not saved.')+(environmentWarnings.length?` Environment files unavailable: ${environmentWarnings.join(', ')}. See Lighting for details.`:''));
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
          pedestrians.onDropWeapon=(position,weapon,rounds,persist)=>{void drops.report(position,weapon,rounds,persist);};
          pedestrians.onDropMoney=(position,amount)=>moneyDrops.drop(position,amount);
          pedestrians.resolveScriptPed=handle=>{const ped=mission?.pedByHandle(handle);return ped==='player'?ped:onFoot(ped);};
          pedestrians.resolveScriptVehicle=handle=>{
           const m=mission,car=m?.vehicles.exists(handle)?m.vehicles.entity(handle) as ScriptCar|undefined:undefined;
           if(!m||!car||typeof car.seat!=='function')return undefined;
           return {
            alive:()=>m.vehicles.exists(handle)&&!car.wrecked,
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
           else if(!victim.byPlayer){const stats=mission?.runtime.game.stats;if(stats){if(victim.recruit){stats.decrement(68,2);stats.increment(163,1);}stats.increment(120,1);if(victim.gang!==undefined)stats.increment(victim.gang===1?240:239,1);}}if(victim.byPlayer&&sim.playerCollider.isEnabled())gangWars?.addKillToProvocation(victim.gang);if(victim.byPlayer&&pedTypeAtLeastDealer(victim.pedType))playerKilledADealer(worldZones,{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y});if(victim.byPlayer){progression.recordKill(victim.gang);if(victim.gang!==undefined&&GANG_RIVALS.has(victim.gang))addRespect(5);registerKillByPlayer(victim);}};
          const speechSeed=(position:{x:number;z:number})=>Math.abs(Math.floor(position.x*13+position.z*7));
          pedestrians.playerVehicleVelocity=()=>{const b=worldCar?.occupied?worldCar.car.body:fleet?.occupiedBike?.body??fleet?.occupiedBoat?.body??fleet?.occupiedPlane?.body;if(!b)return undefined;const v=b.linvel();return {x:v.x,y:v.y,z:v.z};};
          // CAEPedSpeechAudioEntity::AddSayEvent says nothing for a ped whose speech a script disabled.
          const speaks=(ped:object)=>!(ped as {shutUp?:boolean}).shutUp;
          pedestrians.onPain=(ped,position)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'pain',speechSeed(position));};
          pedestrians.onFlee=(ped,position)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'flee',speechSeed(position));};
          pedestrians.onThreat=(ped,position)=>{if(speaks(ped))sound.nativeEngine?.pedSpeech(ped,{x:position.x,y:-position.z,z:position.y},'threat',speechSeed(position));};
          pedestrians.onFootstep=(ped,position,move,foot)=>sound.pedFootstep(ped,position,move,foot);
          pedestrians.onCrunch=(ped,position)=>sound.nativeEngine?.pedCrunch(ped,{x:position.x,y:-position.z,z:position.y});
          pedestrians.onCarCrunch=car=>sound.nativeEngine?.vehicle(car,car.modelId)?.addAudioEvent(AE.pedCrunch);
          // Car colliders do not touch peds in the solver, so the strike reports its own collision sound, both ways.
          pedestrians.onCarPedCollision=(car,handle,point,normal,carImpulse,pedImpulse)=>{const c=sound.nativeEngine?.collisions;if(!c)return;
           const pos={x:point.x,y:-point.z,z:point.y},n={x:normal.x,y:-normal.z,z:normal.y},ped={key:handle,surface:SURFACE.ped};
           c.reportCollision(carCollider(car),ped,pos,n,carImpulse,1);c.reportCollision(ped,carCollider(car),pos,{x:-n.x,y:-n.y,z:-n.z},pedImpulse,1);};
          pedestrians.onWaterCannonSmoke=(p,v)=>worldFx.waterCannon.pedSmoke([p.x,p.y,p.z],[v.x,v.y,v.z]);
          worldFx.onDanger=(plane,radius)=>{let last={x:0,z:0};const at=()=>{if(fleet?.planes.has(plane)&&plane.health>0){const t=plane.body.translation();last={x:t.x,z:t.z};}return last;};pedestrians?.danger(at,radius,plane.occupied?'player':plane.policeHeli?'cop':undefined);};
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
          pedestrians.gangTurf=turfAt;pedestrians.dontCreateRandomGangMembers=()=>!!mission?.runtime.game.population.dontCreateRandomGangMembers;
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
            void import('./simulation/WorldBike').then(({WorldBike})=>{WorldBike.ridingSkill=()=>Math.min(1000,(mission?.runtime.game.stats.get(STAT_BIKE_SKILL)??0)/1000);WorldBike.hopClipSeconds=model=>{const group=model===509?'choppa':model===510?'mtb':'bmx';return carEntry.clips.peek(group,`${group.toUpperCase()}_bunnyhop`)?.duration;};});
            // CVehicle::SetDriver and RemoveDriver's freebies (nativeFreebies). The port's inventory has no weapon slots,
            // so DoesPlayerWantNewWeapon never turns the weapon into GrantAmmo.
            WorldCar.onFreebie=(_car,freebie)=>{
             if(freebie.kind==='health')addPlayerHealth(freebie.amount);
             else if(freebie.kind==='money')sim.money+=freebie.amount;
             else if(freebie.kind==='armour')sim.player.armour=Math.max(mission?.runtime.game.playerInfo.maxArmour??100,sim.player.armour);
             else if(freebie.kind==='calories'){const stats=mission?.runtime.game.stats;if(stats?.player)stats.increment(STAT_CALORIES,freebie.amount);else addPlayerHealth(freebie.amount);}
             else{const before=weapons.inventory.selected;if(weapons.inventory.give(freebie.weapon,freebie.ammo)&&weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);}
            };
            const [assets,road]=await Promise.all([loadIncludedGreenwood(`${import.meta.env.BASE_URL}play/vehicles/greenwood/`),loadWorldRoadMaterials(`${import.meta.env.BASE_URL}play/world/`)]);if(!alive)return;worldFx.surfaces=road.records;roadSurfaces=road;surfaceAudio??={byId:road.audio,warnings:[]};
            const x=2491,z=1680,hit=sim.world.castRay(new RAPIER.Ray({x,y:80,z},{x:0,y:-1,z:0}),100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
            if(!hit)throw new Error('No native road surface for the Greenwood.');
            // CAutomobile::VehicleDamage: ramming a manned law car gives the player a star.
            WorldCar.onPlayerRammedLaw=()=>law.setLevelNoDrop(1);
            worldCar=new WorldCar(sim,render.scene,assets,{x,y:80-hit.timeOfImpact+1,z},road);
            worldCar.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
            fleet=new WorldFleet(sim,render.scene,road,worldCar,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);fleet.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);fleet.outside=()=>render.lighting.area===0;fleet.setGenerators(worldGenerators);if(worldZones)fleet.setZones(worldZones);
            // ClearSpaceForMissionEntity's ped removals reach the crowd once it exists.
            fleet.clearPed=handle=>pedestrians?.removeDeletableCollider(handle)??false;
            fleet.raining=()=>weatherStarted&&weather.rainyWeatherType;
            traffic=new WorldTraffic(sim,fleet,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
            police=new WorldPolice(sim,fleet,law,carEntry.clips,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);if(worldZones)police.zones=worldZones;
            traffic.spawnPatrol=(position,heading)=>police!.spawnPatrol(position,heading);
            traffic.noSpawn=()=>gangWars?.dontCreateCivilians()??false;
            // CEventVehicleOnFire: the random driver's decision is TASK_COMPLEX_LEAVE_CAR_AND_FLEE (R_Norm/R_Tough/R_Weak.ped),
            // CTaskComplexLeaveAnyCar then CTaskComplexSmartFleeEntity 15 units from the car.
            traffic.onFire=car=>{const at=car.car.body.translation();carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnFleeing(occupants.driverModel(car),position,heading,car.gang,{from:{x:at.x,z:at.z},safe:15}));pedestrians?.vehicleOnFire({x:at.x,z:at.z});};
            // CEventVehicleDamageCollision from the player's car: the driver's decision maker draws nothing, a flee-scene
            // drive or CTaskComplexRoadRage (R_Norm/R_Tough/R_Weak.ped rows for event 73).
            traffic.driverDecisionMaker=car=>pedestrians?.decisionMakerOf(occupants.driverModel(car));
            traffic.onRoadRage=car=>carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnRoadRage(occupants.driverModel(car),position,heading,car.gang));
            // CTaskComplexDieInCar: the shot driver leaves and dies once the car rests, or dies in his seat while it rolls.
            traffic.onDriverDiesOut=car=>{if(!carEntry.evictDriver(car,(position,heading)=>pedestrians?.spawnDead(occupants.driverModel(car),position,heading,car.gang)))traffic?.onDriverDied?.(car);};
            traffic.onDriverDeadInSeat=car=>occupants.markDeadInSeat(car);
            // The seated peds a bullet can reach: traffic drivers and police crews (drive-by crews stay with their own module).
            weapons.seatedPeds=()=>{const policeCars=new Set(police?.units.map(u=>u.car));const out:import('./weapons/WeaponSystem').SeatedTarget[]=[];
             for(const car of fleet?.cars??[]){if(!car.autopilot||car.occupied||car.driverOut||car.wrecked||policeCars.has(car)||driveby?.covers(car))continue;const seat=car.seat('left');if(seat)out.push({car,seat:0,local:seat,kind:'traffic'});}
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
             const driven=fleet?.occupied;
             if(driven?.siren&&!driven.wrecked)add(driven);
             return out;
            };
            traffic.peds=()=>{const out=pedestrians?.positions()??[];if(!fleet?.occupied)out.push({...sim.player.position});return out;};
            police.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
            police.camera=()=>{const forward=render.camera.getWorldDirection(render.camera.position.clone());return {position:render.camera.position,forward};};
            police.spawnOfficer=(model,weapon,position,heading,crew,accuracy)=>{void pedestrians?.spawnOfficer(model,weapon,position,heading,crew,accuracy);};
            police.crew={list:unit=>pedestrians?.footCrew(unit)??[],goTo:(id,point,walk)=>pedestrians?.sendOfficer(id,point,walk),board:id=>pedestrians?.boardOfficer(id)??false};
            // CTaskComplexArrestPed opens the door and waits for the suspect to be out; the arrest itself follows on foot.
            police.onPullFromCar=()=>{if(carEntry.seated)carEntry.dragOut();};
            void import('./simulation/GangDriveBy').then(({GangDriveBy})=>{
             if(!alive||!fleet||driveby)return;driveby=new GangDriveBy(sim,fleet,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
             driveby.gangTurf=turfAt;driveby.gangResident=gang=>pedestrians?.gangResident(gang)??[];driveby.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
             driveby.onShot=(from,to,weapon,hit)=>{weapons.npcShot(from,to,weapon,hit);sound.combat('fire',weapon,from,'npc');};
            }).catch(error=>{if(alive)hud.message(`Drive-by pursuit could not load: ${error instanceof Error?error.message:String(error)}`);});
           if(pedestrians){
             // Reinforcements arrive with their car crews; do not synthesize extra nearby foot police.
             pedestrians.footOfficerLimit=()=>0;
             // PopulateInterior's interior peds are not generated; street peds only come outside (CanSeeOutSideFromCurrArea).
             pedestrians.limits=()=>render.lighting.area!==0?{civilians:0,total:0}:fewerPedsLimits(fleet?.pedLimits(),cullZones.fewerPeds);pedestrians.pedZone=()=>fleet?.pedZone();pedestrians.pedTargets=()=>fleet?.pedTargets();pedestrians.noCivilians=()=>gangWars?.dontCreateCivilians()??false;pedestrians.gangWarFighting=()=>!!gangWars?.gangWarFightingGoingOn();pedestrians.playerVehicle=()=>{const car=worldCar?.occupied?worldCar:fleet?.occupied;if(!car)return undefined;const t=car.car.body.translation();return {position:{x:t.x,y:t.y,z:t.z},alarm:car.alarm>0,law:LAW_ENFORCEMENT_MODELS.has(car.modelId),wrecked:car.wrecked};};pedestrians.playerVehicleSpeed=()=>{const car=worldCar?.occupied&&!worldCar.disposed?worldCar:fleet?.occupied&&!fleet.occupied.disposed?fleet.occupied:undefined;if(!car)return 0;const v=car.car.body.linvel();return Math.hypot(v.x,v.z)/50;};pedestrians.attractorsNear=(x,y,r)=>importedScene?.attractorsNear(x,y,r)??[];pedestrians.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);pedestrians.visibleArea=()=>render.lighting.area;pedestrians.scriptDecisionMaker=slot=>mission?.scriptDecisions.get(slot);if(fleet)fleet.rain=()=>weatherStarted?weather.rain:0;if(fleet)fleet.pedCentres=()=>pedestrians?.targets(true).map(t=>t.position)??[];if(fleet)fleet.suppressedModels=()=>mission?.suppressedCarModels()??new Set();if(fleet)fleet.scriptZoneInfo=index=>mission?.scriptZoneInfo(index);occupants.pickDriver=car=>car.gang!==undefined?pedestrians?.gangDriver(car.gang):pedestrians?.specificDriver(fleet?.modelName(car.modelId),fleet?.zoneLevel()??0)??pedestrians?.rosterDriver(fleet?.vehicleClass(car.modelId));
             carEntry.crowd=pedestrians;
           }
          }).catch(error=>{if(alive)hud.message(`Vehicle could not load: ${error.message}`);});
          if(navigation)navigation.onFly=modelId=>{
            if(!fleet||!staticWorld||flightTransfer||installingScene)return Promise.reject(new Error('Wait for world loading to finish.'));
            if(fleet.occupied||fleet.occupiedPlane)return Promise.reject(new Error('Leave your current vehicle before choosing another plane.'));
            // The airfield replaces the current window: a follow request in flight (the primed start window, say) is dropped.
            follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;pendingPrebuild?.job.dispose();pendingPrebuild=undefined;
            navigation.toggle(false);pause();menuBusy(true);hud.menuMessage('Loading Verdant Meadows and your aircraft…');
            return new Promise<void>((resolve,reject)=>{flightTransfer={modelId,resolve,reject};staticWorld!.request(-1,{x:150,y:2500,radius:180,lodRadius:1000,includeCollisionBounds:true});});
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
              if(saved&&!savedTransfer&&!flightTransfer&&Math.hypot(saved.x-sim.player.position.x,-saved.y-sim.player.position.z)>150){
                savedTransfer=saved;sim.timeMinutes=saved.timeMinutes;if(saved.weekDay)sim.weekDay=saved.weekDay;fleet?.generateEvenIfClose();
                staticWorld?.request(-1,{x:saved.x,y:saved.y,radius:180,lodRadius:1000,includeCollisionBounds:true});
              }
              // The bundled start scene has no distant ring: ask for the spawn's full window now rather than at the
              // first 54 m of travel, so the LOD world is up before the player drives off.
              else{if(saved){sim.timeMinutes=saved.timeMinutes;if(saved.weekDay)sim.weekDay=saved.weekDay;}if(follower&&!flightTransfer)follower.primeNext=true;}
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
               const byId=new Map<number,import('./assets/ide').IdeAssociation>(),byName=new Map<string,import('./assets/ide').IdeAssociation>();
               for(const record of data.ideRecords as import('./assets/ide').IdeAssociation[]){
                if(!byId.has(record.id))byId.set(record.id,record);
                const name=record.model.toLowerCase();if(!byName.has(name))byName.set(name,record);
               }
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
                 setPlayerHeading:degrees=>{sim.player.heading=scriptYaw(degrees);},
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
                 spawnScriptPedOnCar:async(_pedType,model,car,offset)=>{
                  const target=car as ScriptCar|undefined;
                  if(!target||target.disposed)return undefined;
                  const rider:ScriptRider={rider:true,model,car:target,seat:0,offset:{...offset},health:100,
                   heading:target.heading(),accuracy:60,invulnerable:false,gone:false};
                  scriptRiders.add(rider);
                  return rider;
                 },
                 spawnScriptPedInCar:async(_pedType,model,car,seat)=>{
                  const target=car as ScriptCar|undefined;
                  if(!target||target.disposed)return undefined;
                  const rider:ScriptRider={rider:true,model,car:target,seat,health:100,heading:target.heading(),
                   accuracy:60,invulnerable:false,gone:false};
                  scriptRiders.add(rider);
                  return rider;
                 },
                 spawnScriptPed:async(_pedType,model,position)=>
                  await pedestrians?.spawnScripted(model,{x:position.x,y:position.z,z:-position.y},scriptYaw(0))??undefined,
                 // A ped riding in a car goes where the car goes, so nothing a script says about where it
                 // stands, how it walks or what it looks at reaches it; onFoot answers nothing for one, and
                 // each of those falls away rather than being applied to a ped that is not there.
                 placeScriptPed:(ped,position)=>{
                  const target=onFoot(ped);if(!target)return;
                  const place={x:position.x,y:position.z,z:-position.y};
                  target.actor.player.position={...place};target.actor.player.previous={...place};
                  target.body.setTranslation({x:place.x,y:place.y+.9,z:place.z},true);
                 },
                 setScriptPedHeading:(ped,degrees)=>{const p=onFoot(ped);if(p)p.actor.player.heading=scriptYaw(degrees);else{const r=asRider(ped);if(r)r.heading=scriptYaw(degrees);}},
                 scriptPedPosition:ped=>{const r=asRider(ped);const q=r?r.car.car.body.translation():onFoot(ped)!.actor.player.position;return {x:q.x,y:-q.z,z:q.y};},
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
                 scriptPedSpeed:ped=>{const r=asRider(ped);if(r){const v=r.car.car.body.linvel();return Math.hypot(v.x,v.y,v.z);}return onFoot(ped)?.actor.player.speed??0;},
                 scriptPedStanding:ped=>{const p=onFoot(ped);return p?!!pedestrians?.standingStill(p):false;},
                 scriptPedSubmerged:ped=>{const p=onFoot(ped);return p?!!pedestrians?.submerged(p):false;},
                 scriptPedOnScreen:ped=>{const r=asRider(ped);const at=r?r.car.car.body.translation():onFoot(ped)?.actor.player.position;return !!at&&!populationOutsideView(render.camera,at,2);},
                 setScriptPedVisible:(ped,visible)=>{const p=onFoot(ped);if(p)p.hidden=!visible;},
                 giveScriptPedOrder:(ped,order)=>{const p=onFoot(ped);if(p)pedestrians?.giveOrder(p,order);},
                 giveScriptPedSequence:(ped,orders,repeat)=>{const p=onFoot(ped);if(p)pedestrians?.giveSequence(p,orders,repeat);},
                 clearScriptPedTasks:ped=>{const p=onFoot(ped);if(p)pedestrians?.clearTasks(p);},
                 // A ped in a car holds no on-foot order the browser tracks, so its record is left as it is.
                 // A ped riding in a car runs none of the tasks the browser carries out on foot.
                 // A ped riding in a car holds a task only while it drives the car on a CCarAI mission.
                 scriptPedHasOrder:ped=>{const p=onFoot(ped);if(p)return pedestrians?.hasScriptTask(p)??false;const r=asRider(ped);return !!r&&r.seat==='driver'&&(scriptCars.driving(r.car)||scriptCars.inTempAction(r.car));},
                 // CWorld::ClearExcitingStuffFromArea: the deletable peds and cars in the radius go, and the
                 // fires in it are put out, which is CFireManager::ExtinguishPoint and the car-fire pass.
                 clearArea:(point,radius)=>{
                  const at={x:point.x,y:point.z,z:-point.y};
                  pedestrians?.clearPedsInArea({x:at.x,z:at.z},radius);
                  fleet?.clearCarsInArea({x:at.x,z:at.z},radius);
                  weapons.fires.extinguishPoint(at,radius);
                  for(const car of fleet?.cars??[])if(car.onFire){
                   const p=car.car.body.translation();
                   if(Math.hypot(p.x-at.x,p.z-at.z)<radius)car.health=Math.max(car.health,CAR_FIRE_HEALTH);
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
                  weapons.inventory.strip();weapons.vision=null;weapons.goggles=undefined;void weaponView.equip(0);},
                 scriptPedWeapon:ped=>{
                  const held=onFoot(ped);
                  return held?.weaponType===undefined?undefined:{type:held.weaponType,ammo:held.totalAmmo??0};
                 },
                 setScriptPedAmmo:(ped,ammo)=>{const p=onFoot(ped);if(p)p.totalAmmo=ammo;},
                 setScriptPedFrozen:(ped,frozen)=>{const p=onFoot(ped);if(p)p.frozen=frozen;},
                 // A ped without collision leaves the query pipeline: nothing touches it and no line of sight meets
                 // it. Its own movement query still finds the ground.
                 setScriptPedCollision:(ped,uses)=>{onFoot(ped)?.collider.setEnabled(uses);},
                 givePlayerOrders:(orders,repeat,sequence)=>{playerTasks.giveSequence(orders,repeat,playerTaskBody(),sequence);},
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
                 // CWorld::ProcessLineOfSight against the world's own fixed collision.
                 lineOfSightClear:(from,to)=>{
                  const a={x:from.x,y:from.z,z:-from.y},b={x:to.x,y:to.z,z:-to.y};
                  const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},length=Math.hypot(d.x,d.y,d.z);
                  if(length<=0)return true;
                  const hit=sim.world.castRay(new RAPIER.Ray(a,{x:d.x/length,y:d.y/length,z:d.z/length}),length,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
                  return !hit;
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
                 scriptPedAnimProgress:(ped,animation)=>{const p=onFoot(ped);return p?pedestrians?.animProgress(p,animation):undefined;},
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
                 scriptVehicleRouteNodes:car=>isScriptCar(car)?scriptCars.routeNodes(car):undefined,
                 scriptVehicleMaximumPassengers:car=>(car as ScriptCar).maximumPassengers,
                 burstScriptVehicleTyre:(car,wheel)=>{if(isScriptCar(car))car.burstTyre(wheel,true);},
                 scriptCarComponents:car=>isScriptCar(car)?car:undefined,
                 // m_vecTurnSpeed is radians a frame; the script's are a second, so they are the body's own rate here
                 // (native x, y, z to the renderer's x, z, -y).
                 setScriptVehicleTurnSpeed:(car,speed,add)=>{
                  const body=(car as {car?:{body?:import('@dimforge/rapier3d-compat').RigidBody}}).car?.body;if(!body||!body.isDynamic())return;
                  const w=add?body.angvel():{x:0,y:0,z:0};body.setAngvel({x:w.x+speed.x,y:w.y+speed.z,z:w.z-speed.y},true);
                 },
                 explosionInArea:(type,min,max)=>weapons.explosionSlots.inArea(type,min,max),
                 scriptVehicleBaseOffset:car=>-(car as ScriptCar).assets.collision.bounds.min[2],
                 clearSpaceForScriptVehicle:car=>{const c=car as ScriptCar,t=c.car.body.translation(),r=c.car.body.rotation();fleet?.clearSpaceFor({x:t.x,y:t.y,z:t.z},2*Math.atan2(r.y,r.w),c.assets.collision.bounds);},
                 rejoinScriptVehicleRoads:car=>{if(isScriptCar(car))scriptCars.rejoinRoads(car);},
                 createScriptUser3dMarker:(x,y,z,colour)=>markers3d.userMarkerSet(x,y,z,HUD_COLOURS[colour]??[0,0,0]),
                 removeScriptUser3dMarker:index=>{markers3d.userMarkerDelete(index);},
                 playerSwimming:()=>sim.player.swimming,
                 // The world's peds do not swim: in deep water they drown.
                 scriptPedSwimming:()=>false,
                 gangWarFightingGoingOn:()=>!!gangWars?.gangWarFightingGoingOn(),
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
                 // physicalFlags.bDontApplySpeed: the car keeps its place and stops carrying any motion.
                 setScriptVehicleFrozen:(car,frozen)=>{
                  const body=(car as ScriptCar).car.body;
                  body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
                  body.setGravityScale(frozen?0:1,true);body.setEnabled(!frozen);
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
                 closestWorldObjectOfType:(point,radius,model)=>{
                  const scene=importedScene,name=(typeof model==='number'?scriptPickupModels?.byId.get(model)?.model:model)?.toLowerCase();if(!scene||!name)return undefined;
                  let best:{distance:number;smashed:boolean;damaged:boolean}|undefined;
                  for(const [handle,source] of scene.sources){
                   if(!source.placement||source.modelName.toLowerCase()!==name)continue;
                   const [x,y,z]=source.placement.position,distance=Math.hypot(x-point.x,y-point.y,z-point.z);
                   if(distance>=radius||best&&distance>=best.distance)continue;
                   const state=propStates.get(handle);
                   best={distance,smashed:!!state?.destroyed||smashedPlacements.has(placementKey(source.modelName,source.placement.position)),damaged:!!state?.renderDamaged};
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
                 spawnScriptVehicle:async(model,position,heading)=>{
                  if(!fleet||typeof model!=='number')return undefined;
                  return await fleet.spawnScriptVehicle(model,{x:position.x,y:position.z,z:-position.y},scriptCarRotation(heading)).catch(()=>undefined);
                 },
                 // The script's (x, y, z) is the renderer's (x, z, -y), the player's feet on z. In a car, the car goes with
                 // him, its centre of mass GetDistanceFromCentreOfMassToBaseOfModel above the point.
                 setPlayerAmmo:(weapon,ammo)=>{weapons.inventory.setTotalAmmo(weapon,ammo);},
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
                 setPlayerArea:area=>{playerAreaCode=area;},
                 setPlayerProofs:proofs=>{sim.playerProofs={...proofs};},
                 usePedMobilePhone:(ped,start)=>{if(ped==='player'||onFoot(ped))phoneFor(ped).use(start);},
                 explodeScriptPedHead:ped=>{const p=onFoot(ped);if(!p)return;const q=p.actor.player.position;
                  pedestrians?.damageCollider(p.collider.handle,1000,{x:0,z:1},'bullet',{weapon:34,point:{x:q.x,y:q.y+1.6,z:q.z},noSource:true});},
                 clearVehiclesInBox:(min,max)=>{fleet?.clearCarsInBox({x:min.x,y:min.z,z:-min.y},{x:max.x,y:max.z,z:-max.y});},
                 clearPedsInBox:(min,max)=>{pedestrians?.clearPedsInBox({x:min.x,y:min.z,z:-min.y},{x:max.x,y:max.z,z:-max.y});},
                 // CTheScripts::CleanUpThisVehicle: unlocked, no longer a mission car, and off its script mission.
                 releaseScriptVehicle:car=>{const c=car as ScriptCar;if(c.disposed)return;c.missionCar=false;if(scriptCars.mission(c)!==undefined){scriptCars.forget(c);c.autopilot=undefined;}},
                 teleportPlayer:position=>{
                  const x=position.x,z=-position.y,y=position.z,car=worldCar?.occupied?worldCar:fleet?.occupied;
                  if(car){
                   const body=car.car.body,lift=-car.nativeBody.boundsMin.z;
                   body.setTranslation({x,y:y+lift,z},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
                  }else if(fleet?.occupiedBike||fleet?.occupiedBoat||fleet?.occupiedPlane)return false;
                  else{
                   carEntry.cancel();
                   sim.player.position={x,y,z};sim.player.previous={x,y,z};sim.player.speed=0;sim.player.verticalSpeed=0;sim.player.jumpMomentum={x:0,z:0};
                   sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:y+.9,z});sim.playerCollider.setTranslation({x,y:y+.9,z});
                  }
                  fleet?.generateEvenIfClose();return true;
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
                  else{sim.player.position={x,y,z};sim.player.previous={x,y,z};sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:y+.9,z});sim.playerCollider.setTranslation({x,y:y+.9,z});}
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
                 },
                 scriptVehiclePosition:car=>{const p=(car as ScriptCar).car.body.translation();return {x:p.x,y:-p.z,z:p.y};},
                 scriptVehicleBoxTop:car=>(car as ScriptCar).assets.collision.bounds.max[2],
                 scriptVehicleHeading:car=>{const degrees=((car as ScriptCar).heading()-Math.PI)*180/Math.PI;return ((degrees%360)+360)%360;},
                 scriptVehicleAlive:car=>!(car as ScriptCar).disposed,
                 removeScriptVehicle:car=>{if(playerPassenger?.car===car)leavePassengerSeat(true);if(car instanceof WorldTrain)fleet?.removeTrainCarriage(car);else fleet?.removeScriptVehicle(car as ScriptCar);},
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
                 scriptVehicleOnScreen:car=>{const p=(car as ScriptCar).car.body.translation();return !populationOutsideView(render.camera,p,2);},
                 explodeScriptVehicle:car=>{(car as {blowUp?:()=>void}).blowUp?.();},
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
                 scriptVehicleStill:car=>{
                  const body=(car as Partial<ScriptCar>).car?.body;if(!body)return true;
                  const v=body.linvel(),w=body.angvel();
                  return canPedStepOutCar(1,{x:v.x/50,y:-v.z/50,z:v.y/50},{x:w.x/50,y:-w.z/50,z:w.y/50});
                 },
                 scriptVehicleHasHydraulics:car=>!!(car as Partial<ScriptCar>).hydraulics,
                 setScriptVehicleHydraulics:(car,fitted)=>{const c=car as Partial<ScriptCar>;if(fitted)c.fitHydraulics?.();else c.removeHydraulics?.();},
                 scriptVehicleHandlingFlags:car=>(car as Partial<ScriptCar>).handlingFlags??0,
                 setScriptVehicleDirtLevel:(car,level)=>{const c=car as Partial<ScriptCar>;if(c.dirtLevel!==undefined)c.dirtLevel=level;},
                 playerUsingJetpack:()=>!!sim.jetPack,
                 setDeathPenalties:apply=>{gameLogic.penaltyForDeathApplies=apply;},
                 setArrestPenalties:apply=>{gameLogic.penaltyForArrestApplies=apply;},
                 // The script's (x, y, z) is the renderer's (x, z, -y); a z at or below MAP_Z_LOW_LIMIT is on the ground.
                 driveScriptVehicleTo:(car,goal,o)=>{if(isScriptCar(car))scriptCars.gotoCoords(car,{x:goal.x,y:goal.z>-100?goal.z:(car as ScriptCar).car.body.translation().y,z:-goal.y},o);},
                 setScriptVehicleStraightLineDistance:(car,distance)=>{if(isScriptCar(car))scriptCars.setStraightLineDistance(car,distance);},
                 stopScriptVehicle:car=>{if(isScriptCar(car))scriptCars.clear(car);},
                 scriptVehicleTempAction:(car,action,seconds)=>{if(isScriptCar(car))scriptCars.tempAction(car,action,seconds);},
                 scriptVehicleWander:(car,o)=>{if(isScriptCar(car))scriptCars.wander(car,o);},
                 scriptVehicleCarMission:(car,o)=>{
                  const target=o.target as Partial<ScriptCar>|undefined;
                  // Only a car the browser drives with the native body can be a target.
                  if(target&&!(target.car&&target.nativeBody))return false;
                  return scriptCars.carMission(car as ScriptCar,{mission:o.mission,target:target as ScriptCar|undefined,cruise:o.cruise,style:o.style});
                 },
                 scriptVehicleSeatDoor:(car,seat)=>{
                  const c=car as ScriptCar;if(typeof c.seat!=='function')return undefined;
                  const local=carEntry.seatDoorPoint(c,seat);if(!local)return undefined;
                  const w=c.worldPoint(local),ground=pedestrians?.groundUnder(w.x,w.z,w.y+2)??w.y;
                  return {x:w.x,y:-w.z,z:ground};
                 },
                 setScriptVehicleCanBeVisiblyDamaged:(car,state)=>{(car as ScriptCar).canBeVisiblyDamaged=state;},
                 setTimeScale:scale=>{cheatTimeScale=scale;},
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
                   position:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},
                   vehicle:vehicle?{appearance,train:false,model:vehicle.modelId,inAirProper:()=>!(car?car.audio.contactWheels>0:'airborne' in vehicle&&!(vehicle as {airborne:boolean}).airborne)&&!touchesBuildingOrVehicle(car?car.car.body:(vehicle as {body:import('@dimforge/rapier3d-compat').RigidBody}).body)}:undefined,
                   stopped:speed<0.01&&(!!vehicle||sim.player.grounded),
                   health:sim.player.health,dead:sim.player.health<=0,
                   heading:((((sim.player.heading-Math.PI)*180/Math.PI)%360)+360)%360,
                   areaCode:render.lighting.area,
                   // The inventory holds one of each weapon the player has picked up, and the catalog says
                   // which of them are melee.
                   weapons:{
                    carried:[...weapons.inventory.ammo].filter(([id,ammo])=>id===0||ammo.clip>0||ammo.reserve>0).map(([id])=>id),
                    active:{type:weapons.inventory.selected,melee:weapons.inventory.weapon.kind==='melee'},
                   },
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
                 modelIndex:name=>scriptPickupModels?.byName.get(name.toLowerCase())?.id??-1,
                 givePlayerWeapon:(weapon,ammo)=>{const before=weapons.inventory.selected;if(weapons.inventory.give(weapon,ammo)&&weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);},
                 setPlayerCurrentWeapon:weapon=>{if(weapons.inventory.selected!==weapon&&weapons.inventory.select(weapon))void weaponView.equip(weapons.inventory.selected);},
                 setPlayerArmour:armour=>{sim.player.armour=armour;},playerArmour:()=>sim.player.armour,
                 loadMissionText:()=>{},
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
                  sim.playerCanBeDamaged=!safe;law.native.everybodyBackOff=safe;
                  for(const car of fleet?.cars??[])car.canBeDamaged=!safe;
                  if(!safe)return;
                  sim.player.adrenaline=0;sim.player.stamina=Math.max(sim.player.stamina,0);
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
                 setPlayerMaxArmour:maxArmour=>{sim.player.armour=maxArmour;},
                 // The script's native x and y become the browser's x and negated z.
                 groundLevel:(x,y)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:200,z:-y},{x:0,y:-1,z:0}),300,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?200-hit.timeOfImpact:undefined;},
                 // CEntryExitManager's flags are the script's: SET_CLOSEST_ENTRY_EXIT_FLAG and ENABLE_ENTRY_EXIT
                 // reach the same entrances the read-ahead applied at load, and now also whatever the script
                 // changes later, which the read-ahead could not see.
                 setClosestEntryExitFlag:(x,y,radius,flag,on)=>{entryExits?.setClosestFlag(x,y,radius,flag,on);},
                 switchEntryExit:(name,on)=>{entryExits?.switchAccess(name,on);},
                 enableBurglaryHouses:on=>{entryExits?.enableBurglaryHouses(on);},
                 disableAllEntryExits:disabled=>{if(entryExits)entryExits.disabled=disabled;},
                 // CObject's visibility by model near a point needs the object pool this browser does not keep
                 // for the world's own props; the script's own objects answer SET_OBJECT_VISIBLE instead.
                 setVisibilityOfClosestObjectOfType:()=>{},
                });
                // The script's wanted commands act on the player's own CWanted, not a copy of their own.
                mission.runtime.game.useWanted(law.native);
                // CStats::IncrementStat's food stats read and heal the player. UpdateStatsAddToHealth, which follows
                // the raw m_fHealth += value, is a retail stub; the port keeps health within the maximum, as the HUD
                // bar does, and the rest goes to fat through STAT_CALORIES.
                {const game=mission.runtime.game;game.stats.onUpdateMessage=displayStatUpdate;
                 // CPlayerInfo::m_nMoney is the one purse the HUD shows and the score commands move.
                 game.bindMoney({get:()=>sim.money,set:v=>{sim.money=v;}});
                 if(shoppingText)game.shopping.load(shoppingText);game.stats.player={health:()=>sim.player.health,maxHealth:()=>game.playerInfo.maxHealth,addHealth:addPlayerHealth,ateEnough:()=>{hunger.hoursDidntEat=0;}};
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
                // CGarages as CFileLoader::LoadGarage filled it from the world's grge rows.
                if(Array.isArray(data.garages))mission.runtime.game.garages.load(data.garages);
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
                canStartHere:infoIndex=>{const g=mission?.runtime.game;if(!g)return true;if(g.gangWarTrainingZone>=0)return infoIndex===g.gangWarTrainingZone;return !g.specificGangWarZones.length||g.specificGangWarZones.includes(infoIndex);},
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
                message:t=>hud.message(t,4500),help:t=>hud.help(t),respect:d=>addRespect(d),blip:b=>{gangWarBlip=b;},zoneColours:()=>{},streamGangs:()=>{},random:Math.random});
               gangWars.updateTerritoryUnderControlPercentage();
              }}
            if(data.type==='terrain'&&data.followId===-1&&savedTransfer&&!flightTransfer){
              const target=savedTransfer;savedTransfer=undefined;
              void (async()=>{
                const installed=await replaceWalkTerrain({...data,followId:undefined,preservePosition:false,preferredSpawn:{x:target.x,z:-target.y}}).catch(()=>false);
                if(!installed||!alive){if(!target.quiet)hud.message('Your save point could not be loaded.');return;}
                const position={x:target.x,y:target.z,z:-target.y};
                sim.player.position={...position};sim.player.previous={...position};sim.player.heading=target.heading;
                sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
                render.yaw=target.heading+Math.PI;follower=new SceneRegionFollower({x:target.x,y:target.y,radius:180,lodRadius:1000,includeCollisionBounds:true});
                if(!target.quiet)hud.message('Loaded your last save point.');
              })();return;
            }
            if(data.type==='terrain'&&data.followId===-2&&interiorTransfer){void finishInteriorTransfer(data);return;}
            if(data.type==='terrain'&&data.followId===-1&&flightTransfer){
              const transfer=flightTransfer;flightTransfer=undefined;
              void (async()=>{try{
                const installed=await replaceWalkTerrain({...data,followId:undefined,preservePosition:false,preferredSpawn:{x:150,z:-2500}});
                if(!installed)throw new Error('Airfield terrain could not be installed.');
                if(!fleet||!alive)throw new Error('Aircraft fleet is unavailable.');
                // Selecting a new hangar aircraft replaces any unoccupied aircraft on its departure spot.
                for(const previous of fleet.planes){const p=previous.body.translation();if(!previous.occupied&&Math.hypot(p.x-150,p.z+2500)<40){previous.dispose();fleet.planes.delete(previous);}}
                // The hangar is a browser convenience on the original continuous airfield.
                const plane=await fleet.spawnPlane(transfer.modelId,150,-2500,-Math.PI/2);
                sim.player.position={...plane.body.translation()};hud.message(plane.interact());render.yaw=sim.player.heading-Math.PI;
                follower=new SceneRegionFollower({x:150,y:2500,radius:180,lodRadius:1000,includeCollisionBounds:true});play();transfer.resolve();
              }catch(error){hud.menuMessage(String(error));transfer.reject(error);}})();return;
            }
            if(data.type==='terrain')scheduleWindow(data);
            if(data.type==='error'){
              if(interiorTransfer&&data.followId===-2){failInteriorTransfer(data.message);return;}
              if(flightTransfer){flightTransfer.reject(new Error(data.message));flightTransfer=undefined;menuBusy(false);hud.menuMessage(data.message);return;}
              const pending=follower?.snapshot().pending;
              if(pending)failFollowing(pending,data.message);
              else{follower?.stop();hud.menuMessage(`${data.message} The current terrain remains available.`);}
            }
          });
        }
        sceneChannel?.postMessage({ type: 'installed' });
      } catch (error) { localLighting.setModifiers([]); importedScene?.dispose(); importedScene = undefined; hud.menuMessage(error instanceof Error ? error.message : 'Scene installation failed.'); }
      finally { installingScene = false; }
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
      hud.menuMessage(`Downloading ${included.name}… The first load includes the terrain and character assets.`);
      void Promise.all([startScene!.pack,startScene!.identity]).then(([data,identity])=>{bundledProceduralAssets=data.proceduralAssets;if(identity)data.datasetIdentity=identity;return installScene(data);}).catch(error=>{
        hud.menuMessage(error instanceof Error?error.message:'The included world could not be loaded. Reload to retry.');
      });
    }
  }
  frame = requestAnimationFrame(animate);
  cleanup = () => { sessionCharacterChannel.close(); disposeWater(); disposeSunTexture(); disposeObjectData(); disposeLighting(); characterChannel?.close();
    alive = false; pendingPrebuild?.job.dispose();pendingPrebuild=undefined; progression.save();window.removeEventListener('pagehide',saveProgress);journal.dispose();worldFx.dispose();breakManager.resetAll();breakPieces.dispose();weatherEffects.dispose();movingFog.dispose();birdsMesh.dispose();worldCoronas.dispose();lightPools.dispose();pickups.dispose();drops.dispose();occupants.dispose();sirens.dispose();skids.dispose();wakes.dispose();wantedHud.dispose();weaponView.dispose();weapons.dispose();arsenal.dispose();traffic?.dispose(); police?.dispose(); driveby?.dispose(); pedestrians?.dispose(); if(fleet)fleet.dispose();else worldCar?.dispose();staticWorld?.dispose();clearTimeout(followTimer);follower?.stop();sceneChannel?.close(); importedScene?.dispose(); cancelAnimationFrame(frame); input.dispose(); sound.dispose(); render.dispose(); sim.dispose();
    document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onLockChange); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
boot().catch(error => { console.error(error); hud.button('play').textContent = 'Unable to start'; hud.menuMessage(`The game needs a browser with WebGL2 enabled. ${error instanceof Error ? error.message : ''}`); });
if (import.meta.hot) import.meta.hot.dispose(() => { cleanup(); app.replaceChildren(); });
