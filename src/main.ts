import {populationOutsideView} from './render/populationVisibility';
import {nativeWeaponMovement} from './weapons/nativeWeaponMovement';
import {Progression} from './simulation/Progression';
import {ActivityJournal} from './ui/ActivityJournal';
import {VehicleOccupants} from './render/VehicleOccupants';
import {SirenLights} from './render/SirenLights';
import {Skidmarks} from './render/Skidmarks';
import {BoatWakes} from './render/BoatWakes';
import {CarEntry,nativeRideAnims,nativeSteerOverlay} from './simulation/CarEntry';
import {MODEL_FLAG} from './simulation/nativeDoor';
import {WorldPickups} from './simulation/WorldPickups';
import {updatePlayerSwim} from './simulation/playerSwim';
import {advancePlaneEntry,planeEntrySlots} from './simulation/WorldPlane';
import {WorldPolice} from './simulation/WorldPolice';
import {WEAPONS} from './weapons/catalog';
import {WeaponDrops} from './simulation/WeaponDrops';
import {nativeWeatherRegion,WEATHER_REGION} from './world/weatherRegion';
import {CRIME,LAW_ENFORCEMENT_MODELS} from './simulation/nativeWanted';
import {NativeCheatString} from './simulation/nativeCheats';
import {VehicleAnimationLibrary} from './assets/vehicleAnimations';
import {WantedSystem} from './simulation/WantedSystem';
import {WantedHud} from './ui/WantedHud';
import {hudAmmoText} from './ui/nativeAmmoText';
import {carsStrikePlayer} from './simulation/playerCarHit';
import {WeaponSystem} from './weapons/WeaponSystem';
import {WeaponView} from './weapons/WeaponView';
import {WorldFx} from './simulation/fx/WorldFx';
import {NativeWeather} from './world/nativeWeather';
import {NativeWeatherEffects} from './render/NativeWeatherEffects';
import {NativeMovingFog} from './render/NativeMovingFog';
import {playHornIfNecessary} from './simulation/nativeCarHorn';
import {GANG_RIVALS,addRespect} from './simulation/nativePopulation';
import {Quaternion,Vector3} from 'three';
import {StuntJumps} from './simulation/StuntJumps';
/** Reused aim-direction scratch: WeaponSystem.tick copies it, fire/driveby read it synchronously. */
const scratchAim = new Vector3();
import {nativeSaveEffects,type ScmSavePoint} from './assets/scmSavePoints';
import {AE_FRONTEND} from './audio/native/NativeFrontendAudio';
import {Arsenal} from './weapons/Arsenal';
import {WorldTraffic} from './simulation/WorldTraffic';
import {WorldPedestrians} from './simulation/WorldPedestrians';
import {nativeDayNightBalance} from './world/nativeDayNight';
import {StaticWorldProvider} from './assets/StaticWorldProvider';
import {includedScene} from './assets/includedScenes';
import {SceneRegionFollower} from './assets/sceneRegionFollower';
import {readSurfaceSprintRestrictions,surfaceBlocksSprint} from './simulation/nativeSurfaceMovement';
import {worldZoneAt} from './assets/worldZones';
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
import {COL_DAMAGE_EFFECT,bulletHitsObject,pedHitsObject,newObjectState,objectDamage,objectDamagePlaysFx,type NativeObjectState} from './simulation/nativeObjectDamage';
import {NativeBreakManager,rwMatrix} from './simulation/nativeBreakObject';
import {BreakPieces} from './render/BreakPieces';
import {nativePlacementMatrix} from './assets/placement';
import {nativeTexture} from './assets/nativeTexture';
import {loadSceneEnvironment} from './ui/loadSceneEnvironment';
import {readSceneVegetation} from './world/WalkingVegetation';
import {bindLocalWater} from './ui/localWater';
import { AudioSystem } from './audio/AudioSystem';
import { FixedClock } from './core/FixedClock';
import { Input } from './input/Input';
import { LocalTimecycle } from './world/LocalTimecycle';
import { bindLocalLighting } from './ui/localLighting';
import {bindLocalObjectData} from './ui/localObjectData';
import {bindLocalSunTexture} from './ui/localSunTexture';
import { NativeMap } from './ui/NativeMap';
import { Hud } from './ui/Hud';
import { NativeGameLogic, type GameLogicWorld } from './simulation/nativeGameLogic';
import { LEVEL_COUNTRYSIDE, NativeRestart } from './simulation/nativeRestart';
import { ScmCameraFade } from './engine/ScmCameraFade';
import { worldLevelAt } from './assets/worldZones';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const canvas = document.createElement('canvas'); canvas.className = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'San Andreas game world'); app.append(canvas);
const hud = new Hud(app); hud.setMenu(true);
let cleanup = () => {};

async function boot() {
  // Show the menu immediately, while the renderer and WASM load independently.
  const [{ Simulation }, { GameRenderer }, { default: RAPIER }, {sampleNativeGroundLighting}] = await Promise.all([
    import('./simulation/Simulation'), import('./render/Renderer'), import('@dimforge/rapier3d-compat'), import('./simulation/nativeContactLighting'),
  ]);
  await RAPIER.init();
  const parameters = new URLSearchParams(location.search);
  const sceneToken = parameters.get('sceneTest');
  // The included static world is playable without selecting local files.
  const walkDemo = !sceneToken;
  const included=includedScene(parameters.get('area'));
  const navigation=walkDemo?new NativeMap(hud.element):undefined;
  const importedMode = true;
  const sim = new Simulation();
  const flightInstruments=document.createElement('div');flightInstruments.className='flight-instruments';flightInstruments.hidden=true;hud.element.append(flightInstruments);
  let worldCar:import('./simulation/WorldCar').WorldCar|undefined;
  let traffic:WorldTraffic|undefined;
  let police:WorldPolice|undefined;
  let driveby:import('./simulation/GangDriveBy').GangDriveBy|undefined;
  let pedestrians:WorldPedestrians|undefined;
  let fleet:import('./simulation/WorldFleet').WorldFleet|undefined;
  let worldZones:import('./assets/worldZones').WorldZones|undefined;
  let worldGenerators:import('./assets/worldCarGenerators').WorldCarGenerator[]=[];
  let stuntJumps:StuntJumps|undefined,savePoints:ScmSavePoint[]=[],saving=false;
  let savedTransfer:{x:number;y:number;z:number;heading:number}|undefined;
  let importedScene: ReturnType<typeof import('./simulation/nativeScene').installNativeScene> | undefined;
  let surfaceSprint:Map<number,boolean>|undefined;
  let surfaceSprintBlocked=false;
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
  const carEntry=new CarEntry(sim,new VehicleAnimationLibrary(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href));
  carEntry.onDriverOut=(car,position,heading)=>{law.registerCrime(CRIME.carSteal,`car:${car.car.body.handle}`);pedestrians?.spawnFleeing(occupants.driverModel(car),position,heading);};
  carEntry.onBreakIn=(car)=>{law.registerCrime(CRIME.carSteal,`car:${car.car.body.handle}`);};
  const law=new WantedSystem(),wantedHud=new WantedHud(hud.element);
  // CGameLogic::Update drives the wasted and busted sequences over the native
  // CRestart tables; the simulation's own timer only releases the seat.
  const nativeRestart=new NativeRestart(),gameLogic=new NativeGameLogic(nativeRestart),cameraFade=new ScmCameraFade();
  sim.externalDeathRecovery=true;
  let arrested=false,gameTimeMs=0,previousGameTimeMs=0;
  /** Cars that struck CJ on foot, for the dev state. */
  const playerCarHits={contacts:0,hurt:0,last:'none'};
  /** No mission unlocks a city in this build, so every restart point qualifies. */
  const CITY_UNLOCKED=2;
  const weapons=new WeaponSystem(sim,()=>pedestrians,()=>fleet);
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
  const pickups=new WorldPickups(sim,render.scene,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,{
    weaponForModel:model=>WEAPONS.find(w=>w.model?.toLowerCase()===model.toLowerCase())?.id,
    giveWeapon:(weapon,ammo)=>{const before=weapons.inventory.selected,given=weapons.inventory.give(weapon,ammo);if(given&&weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);return given;},
    wantedLevel:()=>law.level,setWantedLevel:level=>law.setLevel(level),armour:()=>sim.player.armour,setArmour:value=>{sim.player.armour=value;},
    // PSAVE1: the save menu runs, the screen fades and the player is put back beside the disc facing its heading.
    onSave:pickup=>{
      if(saving||paused)return;
      const point=savePoints.filter(p=>Math.hypot(p.pickup[0]-pickup.position[0],p.pickup[1]-pickup.position[1],p.pickup[2]-pickup.position[2])<2)[0];
      if(!point)return;
      saving=true;hud.fade(true,1000);
      window.setTimeout(()=>{
        if(!alive)return;
        const effects=nativeSaveEffects({health:sim.player.health,maxHealth:100,timeMinutes:sim.timeMinutes});
        sim.player.health=effects.health;sim.timeMinutes=effects.timeMinutes;pickups.passTime(effects.passedMinutes*60);
        law.setLevel(effects.wanted);sim.player.stamina=effects.stamina;sim.player.sprintExhausted=false;
        // SET_CHAR_HEADING takes degrees where 0 faces north, so the browser heading is the native angle turned around.
        const heading=(point.heading*Math.PI/180+Math.PI)%(Math.PI*2),position={x:point.respawn[0],y:point.respawn[2],z:-point.respawn[1]};
        sim.player.position={...position};sim.player.previous={...position};sim.player.heading=heading;
        sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
        render.yaw=heading+Math.PI;
        progression.savedLocation={x:position.x,y:point.respawn[1],z:position.y,heading,timeMinutes:sim.timeMinutes};progression.save();
        hud.fade(false,1000);hud.message('Game saved.');
        window.setTimeout(()=>{saving=false;},500);
      },1000);
    },
    onCollect:(pickup,message)=>{if(!paused)sound.nativeEngine?.pickup(pickup.category);progression.recordCollect(pickup.category);if(message){const [code,count]=message.split(' '),name=PICKUP_TEXT[code.slice(0,2)];hud.message(code.endsWith('_ALL')?`All ${name.toLowerCase()} collected · +$100,000`:`${name} ${count.replace('/',' of ')}`);}progression.save();},
  },progression.pickups);
  const weaponView=new WeaponView(render.scene,()=>render.nativeCharacter,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href,weapons);
  weaponView.visible=()=>!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!sim.player.swimming&&(!carEntry.active||carEntry.phase==='approach');
  weapons.muzzle=left=>weaponView.muzzle(left);
  const worldFx=new WorldFx(render.scene,sim,render.camera);
  worldFx.collisionSources=()=>importedScene?.sources;worldFx.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
  weapons.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
  void worldFx.load(new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href).then(()=>{if(alive&&worldFx.ready)weapons.fx=worldFx;}).catch(error=>{worldFx.error=String(error);});
  weaponView.aimDirection=()=>render.camera.getWorldDirection(scratchAim);
  weapons.onSound=(event,id,position,source)=>sound.combat(event,id,position,source);
  weapons.onBulletHit=(hit,point,angle)=>{
    const collisions=sound.nativeEngine?.collisions;if(!collisions||paused)return;
    const handle=hit.collider.handle,vehicle=[...(fleet?.cars??[])].some(c=>hit.collider.parent()?.handle===c.car.body.handle)||[...(fleet?.planes??[])].some(p=>hit.collider.parent()?.handle===p.body.handle);
    const ped=!vehicle&&pedestrians?.targets().some(t=>t.handle===handle);
    const record=importedScene?.sources.get(handle),surface=vehicle?SURFACE.car:ped?SURFACE.ped:record?nativeCollisionSurface(record.source,hit)?.material:undefined;
    if(surface!==undefined)collisions.reportBulletHit(surface,{x:point.x,y:-point.z,z:point.y},angle);
  };
  weapons.onCrime=(type,victim,queued)=>{if(queued){if(victim)law.registerCrime(type,victim);}else law.crime(type,victim);};
  law.position=()=>({...sim.player.position});law.presence=radius=>{const point={x:sim.player.position.x,y:sim.player.position.y+1,z:sim.player.position.z};return (pedestrians?.policePresence(point,radius)??0)+(police?.presence(point,radius)??0);};
  weapons.onStealth=seconds=>render.nativeCharacter?.playReaction('kill_knife_player',seconds,true);
  law.onArrest=()=>{arrested=true;input.clear();};
  /** Native axes: x east, y north, z up. */
  const nativePlayerPosition=():[number,number,number]=>[sim.player.position.x,-sim.player.position.z,sim.player.position.y];
  const nativeLevelAt=(p:readonly [number,number,number])=>worldZones?worldLevelAt(worldZones,[p[0],p[1],p[2]]):LEVEL_COUNTRYSIDE;
  const gameLogicWorld:GameLogicWorld={
   isPlayerDead:()=>sim.player.health<=0,
   isPlayerArrested:()=>arrested,
   playerPosition:nativePlayerPosition,
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
   passTime(minutes){sim.timeMinutes=(sim.timeMinutes+minutes)%1440;},
   resurrect(result){
    arrested=false;law.clear();
    sim.respawn={x:result.position[0],y:result.position[2]+1,z:-result.position[1]};
    sim.resetPlayer();
    sim.player.heading=(result.heading*Math.PI/180+Math.PI)%(Math.PI*2);
    render.yaw=sim.player.heading+Math.PI;input.clear();
   },
   // CPlayerInfo's bust lines need the engine-wide CRT stream, which the
   // browser does not share yet, so no line is selected.
  };
  const arsenal=new Arsenal(hud.element,weapons);
  arsenal.onSelect=id=>{void weaponView.equip(id);};
  arsenal.onToggle=open=>{input.clear();sound.setPlaying(!paused&&!open&&!navigation?.open);};
  render.shadowReceivers=(footprint,projection)=>{
    if(!importedScene)return {chunks:[],candidateCount:0,triangleCount:0,vertexCount:0};
    return importedScene.shadowReceivers(footprint,projection);
  };
  render.beforeRender = camera => {
    weaponView.update();
    worldFx.draw(nativeDayNightBalance(sim.timeMinutes));
    if(weatherStarted)weatherEffects.update(camera,{rain:weather.rain,wind:weather.wind,windDir:weather.windDir,rainbow:weather.rainbow,noRain:render.lighting.area!==0},render.lighting.sunTexture.texture,paused||!!navigation?.open||arsenal.open,{width:Math.max(1,canvas.clientWidth),height:Math.max(1,canvas.clientHeight)});
    const skyBottom=render.lighting.nativeSkyBottom;
    movingFog.frame(Math.floor(elapsed*1000),camera,weatherStarted&&skyBottom?{foggynessSF:weather.foggynessSF,outside:render.lighting.area===0,noRain:render.lighting.area!==0,underwaterness:weather.underwaterness,skyBottom}:undefined,render.lighting.sunTexture.fogTexture,paused||!!navigation?.open||arsenal.open);
    for(const plane of fleet?.planes??[])plane.setLighting(render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier,nativeDayNightBalance(sim.timeMinutes));
    for(const car of fleet?.cars??[]){car.car.setViewDistance(car.car.root.position.distanceToSquared(camera.position),1);car.setLighting(render.lighting.nativeWorldAmbient,render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier,nativeDayNightBalance(sim.timeMinutes));}
    importedScene?.setTime(sim.timeMinutes,render.lighting.nativeWorldAmbient,render.lighting.sunLightMultiplier,render.lighting.nativeObjectAmbient);
    // CWeather::Wind drives grass bending (Windyness itself follows the reVC categories; see docs/research/NATIVE_WEATHER.md).
    importedScene?.updateView(camera,render.lighting.lowLodScale,{milliseconds:Math.floor(elapsed*1000)>>>0,wind:weatherStarted?weather.windClipped:0,seed:0},!paused);
  };
  const disposeWater=bindLocalWater(hud.element,render.lighting.water);
  const disposeSunTexture=bindLocalSunTexture(hud.element,render.lighting.sunTexture);
  sim.sunCollisionEligible=handle=>importedScene?.sources.get(handle)?.entityKind!=='dummy';
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
  const weather=new NativeWeather();let weatherStarted=false;
  const localLighting = new LocalTimecycle(), disposeLighting = bindLocalLighting(hud.element,localLighting,walkDemo?value=>{if(value<0)weather.releaseWeather();else weather.forceWeatherNow(value);localLighting.setWeatherState(weather.state());}:undefined);
  const weatherEffects=new NativeWeatherEffects(render.scene),movingFog=new NativeMovingFog(render.scene);
  render.lighting.nativeTimecycle = (minutes,position) => localLighting.sample(minutes,position);
  const sound = new AudioSystem();
  void sound.loadNativeAudio(new URL(`${import.meta.env.BASE_URL}play/audio/`,location.href).href);
  const hornInput=new NativeHornInput();sound.setPlayer(()=>({...sim.player.position,y:sim.player.position.y+1}));
  void sound.loadNativeCombat(new URL(`${import.meta.env.BASE_URL}play/audio/`,location.href).href); sound.reset(sim);
  if(navigation)navigation.onToggle=open=>{input.clear();sound.setPlaying(!paused&&!open);};
  hud.bindAudio(sound.settings, settings => sound.setSettings(settings));
  const clock = new FixedClock();
  let paused = true, started = false, last = performance.now(), elapsed = 0, frame = 0, alive = true;
  /** `?perf=1` overlay: frame EMA + renderer counters at 2Hz, no per-frame DOM cost. */
  const perfOverlay = new URLSearchParams(location.search).has('perf') ? (()=>{const el=document.createElement('div');el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;background:rgba(0,0,0,.65);color:#0f0;font:11px/1.4 monospace;padding:6px 8px;border-radius:4px;pointer-events:none;white-space:pre';document.body.append(el);return el;})() : undefined;
  let perfFrameMs = 0, perfLastUpdate = 0;
  /** Post-step ground sample reused for the next tick's sprint gate (1 tick stale, 16ms); audio uses the fresh sample. Halves foot raycasts. */
  let lastGround: ReturnType<typeof import('./simulation/nativeContactLighting').sampleNativeGroundLighting> | undefined;
  let localObjectDefs:ReadonlyMap<string,import('./assets/objectData').ObjectDataRecord>|undefined;
  const defaultObjectDefs=(async()=>{
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
  const placementKey=(model:string,[x,y,z]:readonly number[])=>`${model.toLowerCase()}:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`;
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
    }
  };
  /** Props removed by collisions, newest last, for the dev probe. */
  const smashedProps:{model:string;position:number[]}[]=[];
  /** OBJECT.DAT props a car can damage through CPhysical::ApplyCollision's static-object branch. */
  const scenePropFor:NonNullable<import('./simulation/WorldCar').WorldCar['propFor']>=other=>{
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
    return {effect,colDamageMultiplier:values.collisionDamageMultiplier??1,uprootLimit,mass,turnMass:physics.turnMass,elasticity:physics.elasticity,state,
    uproot:(linvel,angvel)=>{
      if(!source.placement||!scene.uprootPlacement(other.handle,{...physics,linvel,angvel}))return false;
      const t=other.parent()!.translation(),r=other.parent()!.rotation();
      movedPlacements.set(placementKey(source.modelName,source.placement.position),{translation:{x:t.x,y:t.y,z:t.z},rotation:{x:r.x,y:r.y,z:r.z,w:r.w},physics});
      return true;
    },
    damaged:({result,damage,point,normal})=>{
      const [x,y,z]=source.placement?.position??[0,0,0];
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
      if(result.destroyed&&values.causesExplosion&&!state.exploded){state.exploded=exploded=true;weapons.objectExplosion({x,y:z,z:-y});}
      if(!record.effectName||!objectDamagePlaysFx(values.fxType??0,damage,result.destroyed,exploded))return;
      // An X offset below -500 plays at the hit point along the normal (Fx_c::CreateMatFromVec); otherwise at the
      // object's rotated offset. The reversed code adds the position twice there, which would place it far away.
      const offset:[number,number,number]=[values.fxOffsetX??0,values.fxOffsetY??0,values.fxOffsetZ??0];
      if(offset[0]<-500)worldFx.objectFx(record.effectName,[point.x,-point.z,point.y],[normal.x,-normal.z,normal.y]);
      else{const q=source.placement?.rotation??[0,0,0,1],v=new Vector3(...offset).applyQuaternion(new Quaternion(-q[0],-q[1],-q[2],q[3]).normalize());worldFx.objectFx(record.effectName,[x+v.x,y+v.y,z+v.z]);}
    }};
  };
  /** BreakManager_c: pieces of broken OBJECT.DAT props. */
  const breakManager=new NativeBreakManager(),breakPieces=new BreakPieces(render.scene);
  let breakClock=0;
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
  /** CWeapon::DoBulletImpact on an OBJECT.DAT prop: a push that can unfreeze it, or ObjectDamage for breakables. */
  const shootProp=(hit:import('@dimforge/rapier3d-compat').RayColliderIntersection,point:{x:number;y:number;z:number},incremental:boolean)=>{
    const collider=hit.collider,prop=scenePropFor(collider),body=collider.parent();if(!prop||!body||prop.state.destroyed)return;
    const record=importedScene?.sources.get(collider.handle),values=record&&(localObjectDefs??resolvedObjectDefs)?.get(record.modelName.toLowerCase())?.values;
    const normal={x:hit.normal.x,y:hit.normal.y,z:hit.normal.z};
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
    const view=render.nativeCharacter,getUp=view?.reactionDuration('getup_front')??1.2;
    view?.holdClipEnd(`dragged:${clip.key}`,clip.clip,1);
    sim.knockdown=1+getUp;sim.knockdownGetUp=playerGetUp=getUp;
  };
  /** CEventDamage on the player: ComputeDamageAnim flinches, knockdowns through CTaskComplexFallAndGetUp
   * (fall, a second on the ground, get up), and ComputeDeathAnim when the hit kills. */
  let playerHitAnimDelay=0,playerDamageAnimId=-1,playerGetUp=0;const playerDamageRandom=new WindowsCrtRandom(1);
  const playerDamageReactions=()=>{
    const view=render.nativeCharacter;
    if(sim.player.health>0&&playerDied){playerDied=false;view?.clearReaction();}
    if(playerGetUp&&sim.knockdown<=playerGetUp&&view){view.playReaction('getup_front',playerGetUp,true);playerGetUp=0;}
    for(const event of sim.damageEvents.splice(0)){
      if(!view)continue;
      const p=sim.player.position,direction=event.from?browserLocalDirection(sim.player.heading,event.from.x-p.x,event.from.z-p.z):0;
      const moveState=sim.player.speed<.1?PEDMOVE.still:sim.player.speed<3?PEDMOVE.walk:sim.player.speed<7?PEDMOVE.run:PEDMOVE.sprint;
      const victim={player:true,inVehicle:false,moveState,fallingOrGettingUp:sim.knockdown>0,standing:sim.player.grounded,hitAnimDelayUntil:playerHitAnimDelay,driving:false};
      if(event.died){
        playerDied=true;
        const death=computeDeathAnim({weapon:event.weapon,pedPiece:PED_PIECE.torso,direction,health:0,damageArmour:event.armour,damageHealth:event.health,victim,source:{ped:true},nextRandom:()=>playerDamageRandom.next()});
        const clip=death.clip&&view.hasReaction(death.clip)?death.clip:'ko_shot_front';view.playReaction(clip,Infinity);
        continue;
      }
      if(sim.knockdown>0)continue;
      if(event.weapon===51||event.fall){
        // TriggerExplosionSectorList lifts a standing ped (bIsStanding false, 4 up): it falls with the
        // blast's knockout clip for the direction and gets up.
        // A car strike (KillPedWithCar's lesser branch) falls the same way with the ramming clips.
        const blast=computeDeathAnim({weapon:event.weapon,pedPiece:PED_PIECE.torso,direction,health:0,damageArmour:0,damageHealth:event.health,victim,source:{ped:false}});
        const clip=blast.clip&&view.hasReaction(blast.clip)?blast.clip:'ko_skid_front',fall=view.reactionDuration(clip)??1,getUp=view.reactionDuration('getup_front')??1.2;
        sim.knockdown=fall+1+getUp;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(clip,fall+1);
        continue;
      }
      const hit=computeDamageEventAnim({weapon:event.weapon,pedPiece:PED_PIECE.torso,direction,health:sim.player.health,damageArmour:event.armour,damageHealth:event.health,victim,source:{ped:true},previousAnimId:playerDamageAnimId,nextRandom:()=>playerDamageRandom.next(),nowMs:Math.floor(elapsed*1000)});
      if(hit.hitAnimDelayUntil!==undefined)playerHitAnimDelay=hit.hitAnimDelayUntil;
      playerDamageAnimId=hit.id;
      if(!hit.clip||!view.hasReaction(hit.clip))continue;
      if(hit.fallDown){
        // Fall, lie a second, then get up; input waits for all of it.
        const fall=view.reactionDuration(hit.clip)??1,getUp=view.reactionDuration('getup_front')??1.2;
        sim.knockdown=fall+1+getUp;sim.knockdownGetUp=playerGetUp=getUp;view.playReaction(hit.clip,fall+1);
      }else view.playReaction(hit.clip);
    }
    // Deaths without a damage event (fire, drowning, a wrecked car) still leave CJ down.
    if(view&&sim.player.health<=0&&!playerDied){playerDied=true;if(view.hasReaction('ko_shot_front'))view.playReaction('ko_shot_front',Infinity);}
  };
  let playerDied=false;
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
  weapons.onExplosion=(point,params)=>{
    const scene=importedScene;if(!scene)return;
    const toNative=(v:{x:number;y:number;z:number})=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:{x:number;y:number;z:number})=>({x:v.x,y:v.z,z:-v.y});
    const seen=new Set<number>();
    for(const [handle,source] of [...scene.sources]){
      if(!source.placement)continue;
      const collider=sim.world.getCollider(handle),body=collider?.parent();if(!collider||!body||!body.isEnabled()||seen.has(body.handle))continue;
      const at=body.isDynamic()?body.translation():(()=>{const [x,y,z]=source.placement!.position;return {x,y:z,z:-y};})();
      const falloff=explosionFalloff(params.radius,Math.hypot(at.x-point.x,at.y-point.y,at.z-point.z));if(!falloff)continue;
      const prop=scenePropFor(collider);if(!prop||prop.state.destroyed)continue;
      seen.add(body.handle);
      const record=(localObjectDefs??resolvedObjectDefs)?.get(source.modelName.toLowerCase());
      // CObject::TryToExplode for causes-explosion props (petrol pumps), once.
      if(record?.values.causesExplosion&&!prop.state.exploded){prop.state.exploded=true;weapons.objectExplosion(at);}
      const hitPoint={x:at.x,y:at.y,z:at.z},up={x:0,y:1,z:0};
      if(!body.isDynamic()){
        if(!explosionUnfreezes(params.force,prop.uprootLimit)){
          // Left static: ObjectDamage(min(1, 2 (radius - distance) / radius)).
          prop.damaged({result:objectDamage(prop.state,falloff,prop.effect,prop.colDamageMultiplier),damage:falloff,point:hitPoint,normal:up});
          continue;
        }
        if(!prop.uproot({x:0,y:0,z:0},{x:0,y:0,z:0}))continue;
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
  function menuBusy(busy: boolean) {
    hud.element.querySelectorAll<HTMLButtonElement>('.menu-actions button').forEach(button => button.disabled = busy);
  }
  const input = new Input(canvas, () => {if(navigation?.open)navigation.toggle(false);else pause();});
  const cheats=new NativeCheatString();
  input.onLetter=letter=>{
    if(paused||navigation?.open||arsenal.open)return;
    const cheat=cheats.add(letter);if(!cheat)return;
    // CCheat::ApplyCheat for the supported entries; CHEAT1 is "Cheat activated".
    if(cheat==='wantedLevelUp')law.setLevel(Math.min(law.level+2,6));
    else if(cheat==='wantedLevelDown')law.setLevel(0);
    else if(cheat==='moneyArmourHealth'){sim.money+=250000;sim.player.armour=100;sim.player.health=100;}
    else{// CPed::GiveWeaponSet1 (sets 2 and 3 are the gta-reversed reconstructions).
    const sets={weaponSet1:[[1,1],[5,1],[18,10],[22,100],[25,50],[28,150],[30,120],[33,25],[35,200],[41,200]],weaponSet2:[[4,0],[16,10],[24,40],[26,40],[32,150],[31,150],[34,21],[37,500],[42,200]],weaponSet3:[[9,0],[39,5],[23,40],[27,30],[29,100],[31,150],[36,200]]} as const;for(const [weapon,ammo] of sets[cheat])weapons.inventory.give(weapon,ammo);}
    hud.message('Cheat activated');
  };
  function pause() {
    loadRequest++;
    if (!started) return;
    paused = true; sound.setPlaying(false); clock.reset(); input.clear(); hud.setMenu(true);
    hud.button('play').textContent = 'Resume game';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function play() {
    terrainPause=false;
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
    /** Stand CJ at a renderer-frame point. */
    placePlayer:(x:number,y:number,z:number)=>{sim.player.position={x,y,z};sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:y+.9,z});return true;},
    /** Stand a civilian still at a renderer-frame point. */
    placePed:(x:number,y:number,z:number)=>pedestrians?.debugPlace({x,y,z})??null,
    /** Put the world car at a renderer-frame position at rest; `heading` turns it about the vertical (0 faces -z). */
    placeCar:(x:number,y:number,z:number,heading?:number)=>{if(!worldCar)return false;const b=worldCar.car.body;b.setTranslation({x,y,z},true);if(heading!==undefined)b.setRotation({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);return true;},
    setWantedLevel:(level:number)=>{law.setLevel(level);return law.level;},
    /** A Los Santos street cop (CCopPed with its nightstick and pistol) at a point. */
    placeCop:(x:number,y:number,z:number)=>pedestrians?.spawnOfficer('lapd1',22,{x,y,z},0)??false,
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
    state: () => ({ weather:{...weather.snapshot(),effects:weatherEffects.snapshot(),movingFog:movingFog.snapshot()},fx:worldFx.snapshot(),police:police?.snapshot()??null,driveby:driveby?.snapshot()??null,pickups:pickups.snapshot(),drops:drops.snapshot(),carEntry:carEntry.snapshot(),progression:progression.snapshot(),stuntJumps:stuntJumps?.snapshot()??null,occupants:occupants.snapshot(),wanted:law.snapshot(),weapons:{...weapons.snapshot(),error:weaponView.error??null,arsenal:arsenal.open}, traffic:traffic?.snapshot()??null, pedestrians:pedestrians?.snapshot()??null, aircraft:fleet?.occupiedPlane?.snapshot()??null, fleet:fleet?.snapshot()??null, nativeCar:worldCar?{occupied:worldCar.occupied,health:worldCar.health,wrecked:worldCar.wrecked,upsideDown:worldCar.upsideDownCounter,doors:worldCar.doors.map((door,i)=>({angle:door.angle,ratio:door.ratio,status:worldCar!.damageState.doors[i]})),debris:worldCar.debris.count,propsSmashed:worldCar.propsSmashed,propsUprooted:worldCar.propsUprooted,tyres:[...worldCar.damageState.wheels],wheels:worldCar.car.wheelSnapshot(),position:{...worldCar.car.body.translation()},velocity:{...worldCar.car.body.linvel()}}:null, breakObjects:{active:breakManager.activeCount,drawn:breakPieces.count,groups:breakManager.objects.filter(o=>o.active).map(o=>o.groups.map(g=>({z:+g.matrix[11].toFixed(2),frames:g.framesToLive,stopped:g.stoppedMoving})))},proceduralCollisionSources:[...(importedScene?.sources.values()??[])].filter(source=>source.procedural).length, nativeVegetation:importedScene?.vegetation()??null, following:follower?.snapshot()??null,objectKinds: [...(importedScene?.sources.values()??[])].map(source=>source.entityKind), imported: sim.imported, importedInstances: importedScene?.instanceCount ?? 0, importedReusedColliders:importedScene?.reusedColliderCount??0,importedReusedPlacements:importedScene?.reusedPlacementCount??0, visibleImportedInstances: importedScene?.visibleInstanceCount ?? 0, visibleImportedModels: importedScene?.visibleModels() ?? [], paused, nativeShadow: render.nativeShadow.snapshot(), nativeContactLighting: render.contactLighting ?? null, nativeCharacter: render.nativeCharacter?.snapshot() ?? null, deathRemaining: sim.deathRemaining, knockdown: sim.knockdown, playerCarHits:{...playerCarHits,push:{...sim.collisionPush},stuck:sim.playerStuck}, gameLogicState: gameLogic.state, fadeAlpha: cameraFade.value, restartPoints: {hospitals:nativeRestart.hospitals.length,police:nativeRestart.police.length}, player: { ...sim.player, position: { ...sim.player.position } },
      camera: { mode: render.distanceMode, distance: render.followDistance, far: render.camera.far, fog: render.scene.fog?.toJSON(), yaw: render.yaw, viewYaw: render.viewYaw, pitch: render.viewPitch, glance: render.glance, position: render.camera.position.toArray() },
      movementSurfaceDefinitions:surfaceSprint?.size??0,surfaceSprintBlocked,
      audio: {...sound.state(),surfaceDefinitions:surfaceAudio?.byId.size??0}, timeMinutes: sim.timeMinutes, lighting: { area: render.lighting.area, sunMultiplier: render.lighting.sunLightMultiplier, night: render.lighting.night, imported: localLighting.name, weather: localLighting.weather, regionalModifiers:localLighting.modifierCount, native: localLighting.sample(sim.timeMinutes,render.camera.position) },
      tick: clock.tick, memory: { ...render.renderer.info.memory }, draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles }),
  } });
  function animate(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    // A queued frame timestamp can predate the performance.now() baseline set on resume.
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.1)); last = now;
    let alpha = 1;
    if(input.consume('Tab')&&!paused&&!navigation?.open)arsenal.toggle();
    // Grove crew recruitment (empty-handed press disbands).
    if(!paused&&!navigation?.open&&!arsenal.open&&!fleet?.occupiedPlane&&input.consume('KeyG')){
     const result=pedestrians?.recruit();
     if(result==='joined'){hud.message('Homie joined the crew');sound.nativeEngine?.speech('greet',sim.player.position);}
     else if(result==='full')hud.message('Crew is full (3)');
     else if(result==='dismissed')hud.message('Crew dismissed');
    }
    // Native target cycling while aiming on foot (Q/E shift the lock).
    if(weapons.aiming&&!paused&&!navigation?.open&&!arsenal.open){if(input.consume('KeyQ'))weapons.cycleLock(false);else if(input.consume('KeyE'))weapons.cycleLock(true);}
    // Vehicle radio tuning (N cycles the 11 stations while driving).
    if(input.consume('KeyN')&&!paused&&(worldCar?.occupied||fleet?.occupiedBoat||fleet?.occupiedBike)){const station=sound.nativeEngine?.tuneRadio(1);if(station)hud.message(`Radio · ${station}`);}
    weapons.aiming=!paused&&!arsenal.open&&!navigation?.open&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!sim.player.swimming&&!carEntry.active&&input.down('MouseAim');
    render.aiming=weapons.aiming;render.scoped=weapons.aiming&&weapons.inventory.selected===34;
    if (!paused&&!navigation?.open&&!arsenal.open) {
      traffic?.update(now);police?.update(now);driveby?.update(now);
      pedestrians?.update(now);
      fleet?.update(now);worldCar=carEntry.car??fleet?.nearest()??worldCar;
      if(input.consume('KeyF')&&!law.arrested){
        if(sim.player.swimming){hud.message('Get out of the water first.');}
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
          if(!exiting.grounded&&weapons.parachute)hud.message(exiting.exitAir());
          else{const blocked=exiting.exitCheck();
          if(blocked)hud.message(blocked);
          else{const foot=exiting.exitFoot();if(!foot)hud.message('No clear ground beside the plane.');else{const steps=planeSteps(exiting,'getout');if(steps){installPlaneSteps(steps);exiting.beginExit(foot,steps);}else hud.message(exiting.finishExit(foot));}}}
         }
        else if(fleet?.occupiedBoat)hud.message(fleet.occupiedBoat.interact());
        else if(fleet?.occupiedBike)hud.message(fleet.occupiedBike.interact());
        else if(carEntry.seated){if(!carEntry.exit()&&carEntry.message)hud.message(carEntry.message);}
        else if(carEntry.phase==='approach')carEntry.cancel();
        else if(!carEntry.active&&sim.player.health>0){
          // CPlayerInfo::FindClosestCarSectorList port: 10-unit box around the player, nearest first.
          const p=sim.player.position,car=[...(fleet?.cars??[])].filter(c=>{const q=c.car.body.translation();return Math.abs(q.x-p.x)<10&&Math.abs(q.z-p.z)<10&&Math.abs(q.y-p.y)<5;}).sort((a,b)=>a.distance()-b.distance())[0];
          const boat=fleet?.nearestBoat();
          const bike=fleet?.nearestBike();
          if(plane&&(!car||plane.distance()<car.distance())&&(!boat||plane.distance()<boat.distance())&&(!bike||plane.distance()<bike.distance())&&plane.distance()<10){
           const reason=plane.enterCheck();if(reason)hud.message(reason);
           else{const steps=planeSteps(plane,'getin');if(steps){installPlaneSteps(steps);plane.beginEnter(steps);}else hud.message(plane.finishEnter());}
          }
          else if(boat&&(!car||boat.distance()<car.distance())&&(!bike||boat.distance()<bike.distance())&&boat.distance()<10)hud.message(boat.interact());
          else if(bike&&(!car||bike.distance()<car.distance())&&bike.distance()<10)hud.message(bike.interact());
          else if(car){if(!carEntry.enter(car)&&carEntry.message)hud.message(carEntry.message);}
        }
        }
      }
      if(input.consume('KeyT')&&fleet?.occupiedPlane)hud.message(fleet.occupiedPlane.toggleVtol());
      if(input.consume('KeyG')&&fleet?.occupiedPlane)hud.message(fleet.occupiedPlane.toggleGear());
      elapsed += dt;
      const cycleCamera = input.consume('KeyV'), alternateCamera = input.consume('Home');
      if (cycleCamera || alternateCamera) hud.message(`Camera: ${render.cycleCameraDistance()}`);
       if (input.consume('KeyC')&&!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!carEntry.active) { const message = sim.toggleCrouch(); if (message) hud.message(message); }
      if (input.consume('KeyL')) canvas.requestPointerLock()?.catch(() => hud.message('Pointer lock unavailable. Drag to look.'));
      // CTimer::SetTimeScale(0.3) while a unique stunt jump plays.
      alpha = clock.advance(dt*(stuntJumps?.timeScale??1), step => {
        sim.beginPlayerBreathFrame(step);
        if(walkDemo&&importedScene){
          if(!weatherStarted){weatherStarted=true;weather.setAppropriateNow(sim.player.position.x,-sim.player.position.z);}
          const today=((sim.timeMinutes%1440)+1440)%1440,angle=today*Math.PI/720,sun=[.7+Math.sin(angle),-.7,.2-Math.cos(angle)],camera=render.camera.position;
          weather.update({clock:{hours:Math.floor(today/60),minutes:Math.floor(today%60),seconds:Math.floor(today%1*60)},timeMs:Math.floor(elapsed*1000),frame:clock.tick,timeStep:step*50,camera:{x:camera.x,y:-camera.z,z:camera.y},sunZ:sun[2]/Math.hypot(...sun),noRain:render.lighting.area!==0});
          localLighting.setWeatherState(weather.state());
          if(weather.thunder)sound.nativeEngine?.thunder();
        }
         {const region=nativeWeatherRegion(sim.player.position.x,-sim.player.position.z);law.tick(step,sim.player.health>0,region===WEATHER_REGION.default||region===WEATHER_REGION.desert,!!fleet?.occupiedPlane||!!worldCar?.occupied&&LAW_ENFORCEMENT_MODELS.has(worldCar.modelId)||!!police?.heliActive);}
        // CTimer game time drives the native hold, fade and respawn sequence.
        previousGameTimeMs=gameTimeMs;gameTimeMs=Math.floor(gameTimeMs+step*1000);
        cameraFade.process(step);
        gameLogic.update(gameTimeMs,previousGameTimeMs,gameLogicWorld,CITY_UNLOCKED,nativeLevelAt);
        weapons.tick(step,weapons.aiming?{origin:{...render.camera.position},direction:render.camera.getWorldDirection(scratchAim)}:undefined);
        const entryBusy=[...(fleet?.planes??[])].some(p=>p.entryBusy);
        const onFoot=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&!entryBusy&&(!carEntry.active||carEntry.phase==='approach');
        // CTaskSimplePlayerOnFoot: an instant-hit weapon locked on a ped raises CEventGunAimedAt on it.
        if(onFoot&&weapons.aiming&&weapons.lock&&weapons.inventory.info()?.fire==='instant')pedestrians?.gunAimedAt(weapons.lock.handle,{...sim.player.position});
        // CTaskComplexInWater: feet 0.6 under the surface start swimming (the buoyancy-ratio trigger is not ported).
        const swimWater=render.lighting.water.levels?.level(sim.player.position.x,-sim.player.position.z);
        const stopSwim=()=>{sim.player.swimming=false;sim.player.swimState=0;sim.player.swimBlend=0;sim.player.swimStopTime=0;sim.player.swimDiveTime=0;sim.player.swimVel={x:0,z:0};};
        const reload=input.consume('KeyR'),next=input.consume('WheelNext'),previous=input.consume('WheelPrevious');
        if(onFoot&&(next||previous)){weapons.inventory.cycle(next?1:-1);void weaponView.equip(weapons.inventory.selected);}
        if(onFoot&&reload&&weapons.inventory.weapon.kind!=='melee'||worldCar?.occupied&&reload&&weapons.inventory.weapon.kind!=='melee')weapons.inventory.reload();
        const mouse=input.consume('MouseFire'),key=input.consume('ControlLeft')||input.consume('ControlRight'),click=input.consume('MouseClick');
        // The left button fires whenever it is not dragging the camera: aiming, under pointer lock, or a short click.
        const mouseFires=weapons.aiming||document.pointerLockElement===canvas;
        const firing=weapons.inventory.weapon.automatic?(mouseFires&&input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight')||key||mouseFires&&mouse||click):(mouseFires&&mouse||click||key||reload&&weapons.inventory.weapon.kind==='melee');
        if(onFoot&&!law.arrested&&!weapons.stealth&&(firing||reload&&weapons.inventory.weapon.kind==='melee')){const direction=render.camera.getWorldDirection(scratchAim);weapons.fire({origin:render.camera.position,direction});}
        // Drive-by: Ctrl fires the selected one-handed weapon from the driven car or boat (CTaskSimpleGangDriveBy port).
        if(worldCar?.occupied&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=weapons.inventory.weapon.automatic?(input.down('ControlLeft')||input.down('ControlRight')||key):key;
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDriveby(worldCar,{origin:render.camera.position,direction});}
        }
        if(fleet?.occupiedBoat&&!law.arrested&&!weapons.stealth){
         const drivebyTrigger=weapons.inventory.weapon.automatic?(input.down('ControlLeft')||input.down('ControlRight')||key):key;
         if(drivebyTrigger){const direction=render.camera.getWorldDirection(scratchAim);weapons.fireDrivebyBoat(fleet.occupiedBoat,{origin:render.camera.position,direction});}
        }

        const rocket=input.consume('KeyB')||input.down('KeyB');
        if(fleet?.occupiedPlane&&(firing||input.down('ControlLeft')||input.down('ControlRight')||rocket))weapons.fireAircraft(fleet.occupiedPlane,rocket);
        traffic?.beforeStep(step);police?.beforeStep(step,worldCar?.occupied?worldCar:undefined);driveby?.beforeStep(step,worldCar?.occupied?worldCar:undefined);
        pedestrians?.beforeStep(step,fleet?.cars??[]);
        // CPhysical::ApplyCollision and CEventVehicleCollision for cars striking CJ on foot.
        if(onFoot)for(const hit of carsStrikePlayer(sim,fleet?.cars??[],{excluded:carEntry.active?carEntry.car:undefined,
          fistWeapon:()=>([WEAPON.unarmed,WEAPON.brassKnuckle,WEAPON.golfClub,WEAPON.knife] as number[]).includes(weapons.inventory.selected),
          // CTaskSimpleShakeFist: ANIM_ID_FUCKU from the default group.
          shakeFist:()=>{const view=render.nativeCharacter;if(view&&!view.reactionName&&view.hasReaction('fucku'))view.playReaction('fucku');}})){playerCarHits.contacts++;if(hit.hurt)playerCarHits.hurt++;playerCarHits.last=hit.response.event.kind;}
        const axes = law.arrested||weapons.stealth||entryBusy?{x:0,y:0}:input.axes();
        let controls:import('./simulation/Simulation').Controls = { ...axes, cameraYaw: render.yaw, walk: input.down('AltLeft') || input.down('AltRight'), sprint: input.down('ShiftLeft') || input.down('ShiftRight'), jump: input.consume('Space')&&!law.arrested&&!weapons.stealth&&!entryBusy,parachute:weapons.parachute,facing:weapons.stealth?sim.player.heading:weapons.aiming?render.yaw+Math.PI:undefined };
        // CTaskSimpleSwim player states: Space surfaces, attack dives, sprint selects the crawl.
        if(onFoot&&sim.player.health>0&&!law.arrested&&!carEntry.active){
          const splash=updatePlayerSwim(sim.player,{moveMag:Math.hypot(axes.x,axes.y),sprint:input.down('ShiftLeft')||input.down('ShiftRight'),jump:controls.jump,dive:key,underwaterStroke:render.nativeCharacter?.swimUnderAssociation()},swimWater,step,carEntry.clips.peek('swim','Swim_Dive_Under')?.duration);
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
          if(surfaceSprintBlocked)controls.sprint=false;
        }
        if(!sim.player.swimming)controls=nativeWeaponMovement(controls,weapons.native,weapons.inventory.selected,weapons.aiming);
        for(const car of fleet?.cars??[]){car.wetRoads=weatherStarted?weather.wetRoads:0;car.propFor??=scenePropFor;car.beforeStep(step,axes,input.down('Space'),importedScene?.sources);}
        for(const plane of fleet?.planes??[])plane.beforeStep(step,{throttle:Number(input.down('KeyW'))-Number(input.down('KeyS')),pitch:Number(input.down('ArrowDown'))-Number(input.down('ArrowUp')),roll:Number(input.down('KeyD'))-Number(input.down('KeyA')),rudder:Number(input.down('KeyE'))-Number(input.down('KeyQ')),brake:input.down('Space')});
        for(const plane of fleet?.planes??[])if(plane.entry&&advancePlaneEntry(plane.entry,step)){const phase=plane.entry.phase;plane.entry=undefined;hud.message(phase==='getin'?plane.finishEnter():plane.finishExit());}
        for(const boat of fleet?.boats??[])boat.beforeStep(step,boat.occupied?{throttle:axes.y,steer:axes.x,brake:input.down('Space')}:undefined);
        for(const bike of fleet?.bikes??[])bike.beforeStep(step,bike.occupied?{throttle:axes.y,steer:axes.x,brake:input.down('Space')}:undefined);
        if(worldCar?.occupied||fleet?.occupiedPlane||fleet?.occupiedBoat||fleet?.occupiedBike||carEntry.pinned){
          sim.world.step();sim.timeMinutes=(sim.timeMinutes+step*1)%1440;
          sim.advancePlayerDeath(step,()=>{
            carEntry.abandon();
            if(worldCar)worldCar.occupied=false;
            for(const car of fleet?.cars??[])car.occupied=false;
            for(const plane of fleet?.planes??[]){if(plane.occupied){plane.occupied=false;plane.throttle=0;}}
            for(const boat of fleet?.boats??[]){if(boat.occupied){boat.occupied=false;boat.throttle=0;}}
            for(const bike of fleet?.bikes??[])bike.occupied=false;
          });
        }
        else if(carEntry.rolling)sim.step(step,{...controls,x:0,y:0,jump:false,sprint:false,animationMotion:entryMotion??{x:0,z:0},animationMotionSpace:'world'});
        else {const animated=render.nativeCharacter?.step(step, controls, sim)??controls;sim.step(step,weapons.aiming?controls:animated);}
        kickSweptProps();
        pedestrians?.afterStep();
        for(const car of fleet?.cars??[])car.afterStep(step);
        // BreakManager_c::Update once per native frame at the PC frame limiter's 30 fps (APP_MAX_FPS).
        for(breakClock+=step;breakClock>=1/30;breakClock-=1/30)breakManager.update(50/30,worldFx.breakFx);
        for(const boat of fleet?.boats??[])boat.afterStep();
        for(const bike of fleet?.bikes??[])bike.afterStep();
        carEntry.syncPlayer();
        for(const plane of fleet?.planes??[])if(plane.afterStep())weapons.vehicleExplosion(plane.body.translation());
        for(const boat of fleet?.boats??[])if(boat.afterStep())weapons.vehicleExplosion(boat.body.translation());
        for(const bike of fleet?.bikes??[])if(bike.afterStep())weapons.vehicleExplosion(bike.body.translation());
        if(stuntJumps){
         const car=worldCar?.occupied?worldCar:undefined,body=car?.car.body,p=body?.translation(),v=body?.linvel();
         const water=p?render.lighting.water.levels?.level(p.x,-p.z):undefined;
         stuntJumps.update(step*1000,{driving:!!car&&sim.player.health>0&&!law.arrested,position:p?{x:p.x,y:-p.z,z:p.y}:{x:0,y:0,z:0},
          moveSpeed:v?{x:v.x/50,y:-v.z/50,z:v.y/50}:{x:0,y:0,z:0},collided:car?car.entitiesCollided:1,lost:!!car&&(car.wrecked||(water!==undefined&&p!==undefined&&water>p.y))});
        }
        progression.tick(step,!!worldCar?.occupied,law.level,law.arrested);
        carEntry.drivingSkill=progression.drivingSkill;
        const driven=worldCar?.occupied?worldCar:undefined;pickups.step(step,driven?(point,radius)=>driven.sphereTouches(point,radius):carEntry.active&&carEntry.phase!=='approach'?()=>false:undefined);
        const onFootDrops=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&(!carEntry.active||carEntry.phase==='approach');
        // Dropped guns collect on foot or rolling over them slowly, like street pickups.
        const roller=worldCar?.occupied?worldCar:fleet?.occupied;
        const rollingOver=!!roller&&Math.hypot(roller.car.body.linvel().x,roller.car.body.linvel().z)<4;
        drops.step(step,{position:sim.player.position,alive:sim.player.health>0,onFoot:onFootDrops||rollingOver},(weapon,rounds)=>{
         const before=weapons.inventory.selected,given=weapons.inventory.give(weapon,rounds);
         if(!given)return undefined;
         if(weapons.inventory.selected!==before)void weaponView.equip(weapons.inventory.selected);
         const name=WEAPONS.find(w=>w.id===weapon)?.name??'Weapon';
         sound.frontend(AE_FRONTEND.pickupWeapon);hud.message(`${name} picked up`);
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
        const action=render.nativeCharacter?.snapshot().action;
        if(!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike)sound.tick(sim, render.nativeCharacter?.landingFootContacts, playerSurface,{surface:playerSurfaceFlags,move:action==='sprint'?'sprint':action==='run'?'run':'walk'});
      });
    }
    if(input.consume('KeyM'))navigation?.toggle();
    if((!paused||terrainPause)&&!navigation?.open&&!arsenal.open)requestFollowingTerrain();
    render.vehicleView=!!worldCar?.occupied||!!fleet?.occupiedPlane||!!fleet?.occupiedBoat||!!fleet?.occupiedBike;
    installSwimClips();
    render.vehicleDistance=fleet?.occupiedPlane?Math.max(22,fleet.occupiedPlane.assets.collision!.bounds.radius*2.5):9;
    pedestrians?.render(alpha,render.lighting.nativeObjectAmbient,nativeDayNightBalance(sim.timeMinutes),weapons.vision==='infrared');
    for(const plane of fleet?.planes??[])plane.update(alpha);
    for(const boat of fleet?.boats??[])boat.update(alpha);
    for(const bike of fleet?.bikes??[])bike.update(alpha);
    const aircraft=fleet?.occupiedPlane;hud.element.classList.toggle('flying',!!aircraft);flightInstruments.hidden=!aircraft;if(aircraft)flightInstruments.textContent=`${aircraft.name} · ${Math.round(aircraft.airspeed*3.6)} km/h · ${Math.round(aircraft.altitude)} m AGL · Throttle ${Math.round(aircraft.throttle*100)}% · Gear ${aircraft.gearUp?'UP':'DOWN'}${aircraft.modelId===520?` · ${aircraft.vtol?'VERTICAL':'FORWARD'} [T]`:''}${aircraft.armed?` · Guns ${aircraft.gunAmmo} [Ctrl]${aircraft.modelId!==476?` · Rockets ${aircraft.rockets} [B]`:''}`:''}${aircraft.stall?' · STALL — lower nose':''} | W/S throttle · ↓/↑ pitch · A/D bank · Q/E turn · G gear · Space ${aircraft.helicopter||aircraft.modelId===520&&aircraft.vtol?'hover':'brake'} · F exit`;
    for(const car of fleet?.cars??[]){car.car.update(alpha);car.car.setNight(render.lighting.night);}
    sirens.update(fleet?.cars??[],Math.floor(elapsed*1000));
    if(!paused&&!navigation?.open&&!arsenal.open&&roadSurfaces){const surfaces=roadSurfaces;for(const car of fleet?.cars??[])skids.lay(car,Math.floor(elapsed*1000),{skidMark:material=>surfaces.records.get(material)?.skidMark},(x,z,fromY)=>{const hit=sim.world.castRay(new RAPIER.Ray({x,y:fromY,z},{x:0,y:-1,z:0}),1.6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?fromY-hit.timeOfImpact:undefined;});}
    skids.frame(Math.floor(elapsed*1000));
    playerDamageReactions();
    breakPieces.sync(breakManager);
    syncMovedProps();
    if(weatherStarted)wakes.update(fleet?.boats??[],{waterLevel:(x,y)=>render.lighting.water.levels?.level(x,y),camera:render.camera.position,windClipped:weather.windClipped,elapsedMs:Math.floor(elapsed*1000)});
    const leaving=carEntry.npcPose(),leavingClip=carEntry.npcClip;
    const policeCars=new Set(police?.units.map(u=>u.car));
    occupants.update([...occupants.drivers(fleet?.cars??[],car=>policeCars.has(car)||!!driveby?.covers(car)),...(leaving&&leavingClip?[{key:`leaving:${leaving.car.car.body.handle}`,car:leaving.car,model:occupants.driverModel(leaving.car),local:leaving.local,clip:leaving.clip,seconds:leaving.seconds,animation:leavingClip.clip}]:[]),...(police?.poses().map((p,i)=>({...p,key:`police:${p.car.car.body.handle}:${i}`}))??[]),...(driveby?.poses()??[]),...carEntry.passengerPoses()],render.lighting.nativeObjectAmbient,nativeDayNightBalance(sim.timeMinutes));
    const entryPose=carEntry.pose(),entryClips=entryPose&&carEntry.requiredClips();
    const entryPlane=[...(fleet?.planes??[])].find(p=>p.entry);
    if(entryClips&&render.nativeCharacter)render.nativeCharacter.installVehicleClips(entryClips,['car_rollout_lhs','car_rollout_rhs']);
    if(entryPose&&render.nativeCharacter?.hasVehicleClip(entryPose.clip)){
      const p=sim.player,world=entryPose.world?{x:p.previous.x+(p.position.x-p.previous.x)*alpha,y:p.previous.y+(p.position.y-p.previous.y)*alpha+1,z:p.previous.z+(p.position.z-p.previous.z)*alpha}:undefined;
      render.vehiclePose={frame:entryPose.car?{vehicle:entryPose.car.car.root,local:entryPose.local,headingOffset:entryPose.headingOffset}:{position:world,heading:entryPose.heading},pose:{clip:entryPose.clip,seconds:entryPose.seconds,blend:entryPose.blend,overlay:entryPose.overlay}};
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
    }else if(fleet?.occupiedBike&&render.nativeCharacter){
      // Riding pillion-style: the class IFP's ride/pedal idle with a lean overlay at the ped_frontseat dummy.
      const bike=fleet.occupiedBike,pose=bike.riderPose(),seat=pose.seat;
      const idle=carEntry.clips.peek(pose.block,pose.idle),lean=pose.overlay?carEntry.clips.peek(pose.block,pose.overlay.clip):undefined;
      if(seat&&idle){
        render.nativeCharacter.installVehicleClips(Object.fromEntries([[pose.idle,idle],...(lean&&pose.overlay?[[pose.overlay.clip,lean]]:[])]));
        render.vehiclePose={frame:{vehicle:bike.root,local:seat},pose:{clip:pose.idle,seconds:idle.duration,blend:1,overlay:lean&&pose.overlay?{...pose.overlay}:undefined}};
      }else render.vehiclePose=undefined;
    }else render.vehiclePose=undefined;
    }else render.vehiclePose=undefined;
    if(carEntry.message){hud.message(carEntry.message);carEntry.message=undefined;}
    for(const bike of fleet?.bikes??[])if(bike.message){hud.message(bike.message);bike.message=undefined;}
    if(!paused&&!navigation?.open&&!arsenal.open){if(weatherStarted)worldFx.weather({rain:weather.rain,sandstorm:weather.sandstorm,wind:weather.wind,windDir:[weather.windDir.x,weather.windDir.y,weather.windDir.z],noRain:render.lighting.area!==0});const onFoot=!worldCar?.occupied&&!fleet?.occupiedPlane&&!fleet?.occupiedBoat&&!fleet?.occupiedBike&&(!carEntry.active||carEntry.phase==='approach');worldFx.syncFires(weapons.fires.active);worldFx.step(dt,fleet?.cars??[],weapons.hazards,fleet?.planes??[],[...(onFoot?[{position:sim.player.position,speed:sim.player.speed,grounded:sim.player.grounded}]:[]),...(onFoot?(pedestrians?.walkers()??[]):[])],fleet?.boats??[]);}
    render.update(dt, alpha, input, elapsed, paused||!!navigation?.open||arsenal.open);
    journal.update();wantedHud.update(law);
    arsenal.update(weaponView.error);
    hud.weapon(weapons.inventory.weapon.name,weaponView.icon,weapons.inventory.selected===0);
    {const id=weapons.inventory.selected,a=weapons.inventory.ammo.get(id),info=weapons.inventory.info();hud.ammo(a?hudAmmoText({type:id,clipSize:weapons.inventory.magazine(),inClip:a.clip,total:a.clip+a.reserve,fire:info?info.fire:undefined,slot:info?info.slot:undefined}):undefined);}
    app.classList.toggle('vision-nightvision',weapons.vision==='nightvision');app.classList.toggle('vision-infrared',weapons.vision==='infrared');
    pickups.setAmbient(render.lighting.nativeObjectAmbient,render.lighting.sunLightMultiplier);pickups.render(render.camera.position,Math.floor(elapsed*1000));
    if(weapons.photoRequested){weapons.photoRequested=false;pickups.pictureTaken(render.camera);canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`San-Andreas-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});hud.message('Photo saved');}
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
        // CPhysical::ApplyCollision reports: other cars as SURFACE_CAR, pedestrians as SURFACE_PED, world colliders by their COL surface.
        car.onCollision??=report=>{
          const collisions=sound.nativeEngine?.collisions;if(!collisions)return;
          const otherCar=[...(fleet?.cars??[])].find(c=>c!==car&&report.other.parent()?.handle===c.car.body.handle);
          const ped=!otherCar&&pedestrians?.targets().some(t=>t.handle===report.other.handle);
          const other=otherCar?carCollider(otherCar):ped?{key:report.other.handle,surface:SURFACE.ped}:worldColliderSurface(report.other,importedScene?.sources,report.point,report.normal,material=>roadSurfaces?.records.get(material)?.frictionEffect==='SPARKS');
          if(other)collisions.reportCollision(carCollider(car),other,{x:report.point.x,y:-report.point.z,z:report.point.y},{x:report.normal.x,y:-report.normal.z,z:report.normal.y},report.impulse,1);
        };
        // CAutomobile::ProcessControl: AI cars count their horn down, honk when blocked by cars or pedestrians, and sirens chirp when (seed ^ rand) & 0xFF is 0xAD (CCarAI::UpdateCarAI).
        if(car!==driven){if(car.horn.counter)car.horn.counter--;playHornIfNecessary(car);if(car.siren&&Math.random()*256<1)car.horn.counter=45;}
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
      const cityLin='car' in (cityVehicle??{})?(cityVehicle as import('./simulation/WorldCar').WorldCar).car.body.linvel():(cityVehicle as import('./simulation/WorldPlane').WorldPlane|undefined)?.body.linvel();
      return {camera:audioCamera,
        vehicles:[...cars.map(car=>[car,car.modelId,worldCarAudioInput(car,alive,surfaceAudio?.byId)] as const),...planes.map(plane=>[plane,plane.modelId,worldPlaneAudioInput(plane,alive,{accelerate:Number(input.down('KeyW')),brake:Number(input.down('KeyS'))})] as const)],
        weather:weatherStarted?{rain:weather.rain,windClipped:weather.windClipped,lightningDuration:weather.lightningDuration,noRain:render.lighting.area!==0,outside:render.lighting.area===0,cameraZ:render.camera.position.y,
          city:{camPos:audioCamera.position,camRight:audioCamera.right,camForward:audioCamera.forward,playerPos:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},inVehicle:!!cityVehicle,moveSpeed:cityLin?{x:cityLin.x/50,y:-cityLin.z/50,z:cityLin.y/50}:{x:0,y:0,z:0},
            los:(origin,target)=>{const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,dist=Math.hypot(dx,dy,dz);if(!(dist>0))return undefined;
              // CWorld::ProcessLineOfSight for city-noise whooshes: fixed world geometry blocks the lateral probe.
              const hit=sim.world.castRay(new RAPIER.Ray(origin,{x:dx/dist,y:dy/dist,z:dz/dist}),dist,true,RAPIER.QueryFilterFlags.ONLY_FIXED|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
              if(!hit)return undefined;const t=hit.timeOfImpact;return {point:{x:origin.x+dx*t/dist,y:origin.y+dy*t/dist,z:origin.z+dz*t/dist},physical:{x:0,y:0,z:0}};}}}:undefined,
        ambient:weatherStarted?{region:nativeWeatherRegion(render.camera.position.x,-render.camera.position.z),camera:{x:render.camera.position.x,y:-render.camera.position.z,z:render.camera.position.y},player:{x:sim.player.position.x,y:-sim.player.position.z,z:sim.player.position.y},foggynessSF:weather.foggynessSF}:undefined,
        fires:fires.map(f=>[f.key,f.at] as const),
        player:{weapon:weapons.inventory.selected,onFoot:!driven&&!fleet?.occupiedPlane&&!carEntry.active,attacking:input.down('MouseFire')||input.down('ControlLeft')||input.down('ControlRight'),radio:!!(worldCar?.occupied||fleet?.occupiedBoat||fleet?.occupiedBike)}};
    });
    hud.audioStatus(sound.state());
    hud.update(sim, render.viewYaw);
    hud.names.setVehicleName([...(fleet?.cars??[])].find(car=>car.occupied)?.name??fleet?.occupiedBike?.name??fleet?.occupiedBoat?.name??fleet?.occupiedPlane?.name);
    hud.drawNames(dt*1000,paused);
    navigation?.update(sim.player.position,sim.player.heading,[...[...(fleet?.cars??[])].filter(car=>!car.occupied).map(car=>({...car.car.body.translation(),name:car.name})),...[...(fleet?.planes??[])].filter(p=>!p.occupied).map(p=>({...p.body.translation(),name:p.name}))]);
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
  type TerrainUpdate={ parts: import('./assets/scene').ScenePart[]; timecycleBoxes?: import('./assets/timecycleBoxes').TimecycleBox[]; preferredSpawn?: {x:number;z:number}; preservePosition?:boolean;followId?:number;datasetIdentity?:string };
  let pendingFollowingData:TerrainUpdate|undefined,followBoundaryPaused=false;
  let follower:SceneRegionFollower|undefined,followTimer:ReturnType<typeof setTimeout>|undefined,followResume=0;
  function failFollowing(id:number,message:string){
    if(!follower?.finish(id,false))return;
    clearTimeout(followTimer);pendingFollowingData=undefined;followBoundaryPaused=false;pause();menuBusy(false);
    hud.menuMessage(`${message} Automatic terrain loading stopped; the current area is still available.`);
  }
  function requestFollowingTerrain(){
    if((!sceneChannel&&!staticWorld)||!importedScene)return;
    if(staticWorld)follower?.setRadius(180,fleet?.occupiedPlane?1000:undefined);
    const eligible=(sim.player.grounded||!!fleet?.occupiedPlane)&&sim.deathRemaining===0&&importedScene.area===0;
    if(!paused&&eligible&&follower?.needsPause(sim.player.position)){
      pause();followResume=loadRequest;followBoundaryPaused=true;terrainPause=true;menuBusy(true);hud.menuMessage('Waiting for nearby terrain…');
    }
    // A terrain pause is self-healing: once the follower has nothing in flight
    // and nothing is waiting to install, the game resumes itself. A follower
    // that was deliberately stopped keeps its own menu instead.
    if(paused&&terrainPause&&!installingScene&&!pendingFollowingData&&follower?.snapshot().enabled===true&&follower.snapshot().pending===null){
      followBoundaryPaused=false;play();return;
    }
    if(pendingFollowingData&&eligible&&!installingScene){const data=pendingFollowingData;pendingFollowingData=undefined;void replaceWalkTerrain(data);return;}
    if(paused||installingScene)return;
    // Directional lookahead for the next window: vehicles report Rapier
    // velocity, on-foot motion uses heading and blend speed.
    const motion=fleet?.occupiedPlane?.body.linvel()??(worldCar?.occupied?worldCar.car.body.linvel():undefined)??fleet?.occupiedBoat?.body.linvel()??fleet?.occupiedBike?.body.linvel();
    const followVelocity=motion?{x:motion.x,z:motion.z}:{x:Math.sin(sim.player.heading)*sim.player.speed,z:Math.cos(sim.player.heading)*sim.player.speed};
    const request=follower?.request(sim.player.position,eligible,followVelocity);
    if(!request)return;
    followResume=loadRequest;followBoundaryPaused=false;
    followTimer=setTimeout(()=>failFollowing(request.id,'The terrain request timed out.'),staticWorld?120000:30000);
    if(staticWorld)staticWorld.request(request.id,request.region);else sceneChannel!.postMessage({type:'region-request',...request});
  }
  const replaceWalkTerrain = async (data: TerrainUpdate) => {
    const automatic=data.followId!==undefined;
    if(automatic&&!follower?.matches(data.followId!))return;
    if(automatic&&((!sim.player.grounded&&!fleet?.occupiedPlane)||sim.deathRemaining>0)){pendingFollowingData=data;return;}
    if(!automatic&&follower?.snapshot().pending){sceneChannel?.postMessage({type:'region-error',message:'Wait for the following terrain request.'});return;}
    let autoResume=false,completed=false,resumeVersion=loadRequest;
    if(!automatic){follower?.stop();clearTimeout(followTimer);pendingFollowingData=undefined;}
    if (!importedScene || installingScene) { sceneChannel?.postMessage({type:'region-error',message:'Wait for the current scene request to finish.'}); return; }
    installingScene=true;if(!automatic)pause();menuBusy(true);
    hud.menuMessage('Preparing the selected terrain…');
    try {
      const [{nativeSceneDestination,assertInstalledSceneSupport},{prepareTimecycleBoxes},vegetation]=await Promise.all([import('./simulation/nativeSceneDestination'),import('./world/nativeTimecycleBoxes'),readSceneVegetation('environment' in data?data.environment:undefined)]);
      if(vegetation&&'proceduralAssets' in data)vegetation.proceduralAssets=data.proceduralAssets as import('./world/WalkingVegetation').WalkingVegetationPackage['proceduralAssets'];
      if(!alive||automatic&&!follower?.matches(data.followId!))return;
      if(automatic&&((!sim.player.grounded&&!fleet?.occupiedPlane)||sim.deathRemaining>0)){pendingFollowingData=data;return;}
      resumeVersion=loadRequest;autoResume=automatic&&followBoundaryPaused&&followResume===loadRequest&&!document.hidden;
      const modifiers=data.timecycleBoxes??[];prepareTimecycleBoxes(modifiers);
      const preserve=data.preservePosition===true;
      if(preserve&&((!sim.player.grounded&&!fleet?.occupiedPlane)||sim.deathRemaining>0))throw new Error('Keep position requires a grounded player on foot.');
      let spawn:ReturnType<typeof nativeSceneDestination>|undefined;
      const next=importedScene.replace(data.parts,candidate=>{spawn=preserve?(fleet?.occupiedPlane?{...sim.player.position}:worldCar?.occupied?worldCar.car.assertTerrainSupport(candidate.sources.keys()):assertInstalledSceneSupport(sim.world,candidate.sources.keys(),sim.playerBody.translation(),sim.player.crouched)):nativeSceneDestination(data.parts,data.preferredSpawn);},data.datasetIdentity,vegetation);
      importedScene=next;reapplySmashedProps(next);localLighting.setModifiers(modifiers);render.lighting.area=next.area;
      sim.respawn=spawn!;if(!preserve){sim.resetPlayer();render.yaw=sim.player.heading+Math.PI;}if(!automatic)sound.reset(sim);
      hud.button('play').hidden=false;hud.button('play').textContent='Walk imported scene';
      hud.menuMessage('Terrain updated. Current environment and character settings are retained.');
      if(automatic)follower!.finish(data.followId!,true);completed=true;
      sceneChannel?.postMessage({type:'region-installed'});
      return true;
    } catch(error) {
      if(automatic){follower!.finish(data.followId!,false);pause();}
      const message=error instanceof Error?error.message:'Terrain replacement failed.';
      hud.menuMessage(`${message} The previous terrain is still available.`);
      sceneChannel?.postMessage({type:'region-error',message});
    } finally {
      installingScene=false;
      if(completed||automatic&&!follower?.matches(data.followId!)){clearTimeout(followTimer);pendingFollowingData=undefined;followBoundaryPaused=false;}
      if(alive){menuBusy(false);if(completed&&autoResume&&paused&&loadRequest===resumeVersion&&!document.hidden)play();}
    }
  };
  if (importedMode) {
    hud.element.querySelector('.menu-location')!.textContent = walkDemo?included.name:'Imported scene';
    // CHud::SetZoneName: the zone names are GXT text, which the depot lacks, so the region name stands in.
    hud.names.setZoneName(walkDemo?included.name:'Imported scene',true);
    hud.element.querySelector('.setting')!.textContent = walkDemo?included.location:'Local scene walk test';
    hud.element.querySelector('.build-label')!.textContent = walkDemo?'Browser exploration · Native terrain and character':'Temporary imported environment · Source files stay on this device';
    hud.button('play').hidden = true;

    let bundledProceduralAssets:Awaited<ReturnType<typeof import('./assets/nativeProcAssets').readNativeProcAssets>>|undefined;
    const installScene = async (data: { parts: import('./assets/scene').ScenePart[]; timecycleBoxes?: import('./assets/timecycleBoxes').TimecycleBox[]; preferredSpawn?: { x: number; z: number } }) => {
      if (importedScene || installingScene) return;
      installingScene = true;
      try {
        const [{ installNativeScene }, { importedSpawn }, vegetation] = await Promise.all([import('./simulation/nativeScene'), import('./simulation/importedSpawn'),readSceneVegetation('environment' in data?data.environment:undefined)]);
        if(vegetation&&bundledProceduralAssets)vegetation.proceduralAssets=bundledProceduralAssets;
        if (!alive) return;
        surfaceAudio=undefined;surfaceSprint=undefined;surfaceSprintBlocked=false;
        const environmentWarnings=await loadSceneEnvironment('environment' in data?data.environment:undefined,{lighting:disposeLighting,water:disposeWater,particle:disposeSunTexture,surfaceInfo:{load:async file=>{
          if(file.size>4*1024*1024)return false;
          try{surfaceSprint=readSurfaceSprintRestrictions(await file.text());return true;}catch{surfaceSprint=undefined;return false;}
        }},surfaceAudio:{load:async file=>{
          surfaceAudio=undefined;if(file.size>1024*1024)return false;
          try{const parsed=readSurfaceAudio(await file.text());if(parsed.warnings.length)return false;surfaceAudio=parsed;return true;}catch{return false;}
        }}},files=>sound.loadNativeFootsteps(files),async files=>{
          try{if(parameters.has('characterTest'))return true;const {readLocalPlayerCharacter}=await import('./assets/localPlayerCharacter');const source=await readLocalPlayerCharacter(files);if(!alive)return false;render.installCharacter(source);return true;}catch{return false;}
        });
        if(!alive)return;
        localLighting.setModifiers(data.timecycleBoxes??[]);
        importedScene = installNativeScene(sim.world, render.scene, data.parts,{datasetIdentity:'datasetIdentity' in data?data.datasetIdentity as string|undefined:undefined,vegetation});
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
          pedestrians.playerArmed=()=>{const fire=weapons.inventory.info()?.fire;return fire==='instant'||fire==='projectile';};
          pedestrians.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
          pedestrians.onShot=(from,to,weapon,hit)=>{weapons.npcShot(from,to,weapon,hit);sound.combat('fire',weapon,from,'npc');};
          pedestrians.onMeleeHit=(position,byPlayer)=>sound.combat('impact',0,position,byPlayer?'player':'npc');
          pedestrians.onDropWeapon=(position,weapon,rounds)=>{void drops.report(position,weapon,rounds);};
          pedestrians.onKill=victim=>{progression.recordKill(victim.gang);if(victim.gang!==undefined&&GANG_RIVALS.has(victim.gang))addRespect(5);};
          const speechSeed=(position:{x:number;z:number})=>Math.abs(Math.floor(position.x*13+position.z*7));
          pedestrians.onPain=(ped,position)=>sound.nativeEngine?.pedSpeech(ped,position,'pain',speechSeed(position));
          pedestrians.onFlee=(ped,position)=>sound.nativeEngine?.pedSpeech(ped,position,'flee',speechSeed(position));
          pedestrians.onThreat=(ped,position)=>sound.nativeEngine?.pedSpeech(ped,position,'threat',speechSeed(position));
          pedestrians.onFootstep=(ped,position,move,foot)=>sound.pedFootstep(ped,position,move,foot);
          pedestrians.onCarCrunch=car=>sound.nativeEngine?.vehicle(car,car.modelId)?.addAudioEvent(AE.pedCrunch);
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
          pedestrians.gangTurf=turfAt;
          pedestrians.dealerTurf=(x,z)=>{
            const population=worldZones?.population;
            if(!population)return undefined;
            const zone=worldZoneAt(worldZones!,[x,-z,sim.player.position.y]);
            return population[zone.zoneInfoIndex]?.dealerStrength;
          };
          void Promise.all([import('./assets/includedGreenwood'),import('./simulation/WorldCar'),import('./assets/worldRoadMaterials'),import('./simulation/WorldFleet')]).then(async([{loadIncludedGreenwood},{WorldCar},{loadWorldRoadMaterials},{WorldFleet}])=>{
            const [assets,road]=await Promise.all([loadIncludedGreenwood(`${import.meta.env.BASE_URL}play/vehicles/greenwood/`),loadWorldRoadMaterials(`${import.meta.env.BASE_URL}play/world/`)]);if(!alive)return;worldFx.surfaces=road.records;roadSurfaces=road;surfaceAudio??={byId:road.audio,warnings:[]};
            const x=2491,z=1680,hit=sim.world.castRay(new RAPIER.Ray({x,y:80,z},{x:0,y:-1,z:0}),100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
            if(!hit)throw new Error('No native road surface for the Greenwood.');
            worldCar=new WorldCar(sim,render.scene,assets,{x,y:80-hit.timeOfImpact+1,z},road);
            worldCar.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);
            fleet=new WorldFleet(sim,render.scene,road,worldCar,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);fleet.waterLevel=(x,y)=>render.lighting.water.levels?.level(x,y);fleet.setGenerators(worldGenerators);if(worldZones)fleet.setZones(worldZones);
            traffic=new WorldTraffic(sim,fleet,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
            police=new WorldPolice(sim,fleet,law,carEntry.clips,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);if(worldZones)police.zones=worldZones;
            fleet.canChangePopulation=(point,radius)=>populationOutsideView(render.camera,point,radius);
            // Sounding sirens own the lane: pursuit units plus the player's siren.
            traffic.sirens=()=>{
             const out:{x:number;z:number}[]=[];
             for(const u of police?.units??[])if(u.siren&&!u.car.wrecked){const p=u.car.car.body.translation();out.push({x:p.x,z:p.z});}
             const driven=fleet?.occupied;
             if(driven?.siren&&!driven.wrecked){const p=driven.car.body.translation();out.push({x:p.x,z:p.z});}
             return out;
            };
            police.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
            police.camera=()=>{const forward=render.camera.getWorldDirection(render.camera.position.clone());return {position:render.camera.position,forward};};
            police.spawnOfficer=(model,weapon,position,heading,crew,accuracy)=>{void pedestrians?.spawnOfficer(model,weapon,position,heading,crew,accuracy);};
            police.crew={list:unit=>pedestrians?.footCrew(unit)??[],goTo:(id,point,walk)=>pedestrians?.sendOfficer(id,point,walk),board:id=>pedestrians?.boardOfficer(id)??false};
            // CTaskComplexArrestPed opens the door and waits for the suspect to be out; the arrest itself follows on foot.
            police.onPullFromCar=()=>{if(carEntry.seated)carEntry.dragOut();};
            void import('./simulation/GangDriveBy').then(({GangDriveBy})=>{
             if(!alive||!fleet||driveby)return;driveby=new GangDriveBy(sim,fleet,new URL(`${import.meta.env.BASE_URL}play/world/`,location.href).href);
             driveby.gangTurf=turfAt;driveby.canSpawn=(point,radius)=>populationOutsideView(render.camera,point,radius);
             driveby.onShot=(from,to,weapon,hit)=>{weapons.npcShot(from,to,weapon,hit);sound.combat('fire',weapon,from,'npc');};
            }).catch(error=>{if(alive)hud.message(`Drive-by pursuit could not load: ${error instanceof Error?error.message:String(error)}`);});
           if(pedestrians){
             // Reinforcements arrive with their car crews; do not synthesize extra nearby foot police.
             pedestrians.footOfficerLimit=()=>0;pedestrians.limits=()=>fleet?.pedLimits();
             carEntry.crowd=pedestrians;
           }
          }).catch(error=>{if(alive)hud.message(`Vehicle could not load: ${error.message}`);});
          if(navigation)navigation.onFly=modelId=>{
            if(!fleet||!staticWorld||flightTransfer||installingScene||follower?.snapshot().pending)return Promise.reject(new Error('Wait for world loading to finish.'));
            if(fleet.occupied||fleet.occupiedPlane)return Promise.reject(new Error('Leave your current vehicle before choosing another plane.'));
            navigation.toggle(false);pause();menuBusy(true);hud.menuMessage('Loading Verdant Meadows and your aircraft…');
            return new Promise<void>((resolve,reject)=>{flightTransfer={modelId,resolve,reject};staticWorld!.request(-1,{x:150,y:2500,radius:180,lodRadius:1000,includeCollisionBounds:true});});
          };
          follower=new SceneRegionFollower({x:included.spawn.x,y:-included.spawn.z,radius:180,includeCollisionBounds:true});
          staticWorld=new StaticWorldProvider(`${import.meta.env.BASE_URL}play/world/`,data=>{
            if(!alive)return;
            if(data.type==='ready'){if(Array.isArray(data.pickups))pickups.setPickups(data.pickups);if(Array.isArray(data.savePoints))savePoints=data.savePoints;if(data.restartPoints)nativeRestart.load(data.restartPoints);
              // A save point outside the starting region needs its own terrain before the player can stand there.
              const saved=progression.savedLocation;
              if(saved&&!savedTransfer&&!flightTransfer&&Math.hypot(saved.x-sim.player.position.x,-saved.y-sim.player.position.z)>150){
                savedTransfer=saved;sim.timeMinutes=saved.timeMinutes;
                staticWorld?.request(-1,{x:saved.x,y:saved.y,radius:180,lodRadius:1000,includeCollisionBounds:true});
              }else if(saved)sim.timeMinutes=saved.timeMinutes;
              if(Array.isArray(data.stuntJumps)){
                stuntJumps=new StuntJumps(data.stuntJumps,{
                  // CTimer::SetTimeScale and TheCamera.TakeControl(vehicle, MODE_FIXED, JUMPCUT).
                  onStart:jump=>{render.fixedCamera={position:new Vector3(jump.camera[0],jump.camera[2],-jump.camera[1]),target:()=>{const t=worldCar?.car.body.translation()??sim.player.position;return new Vector3(t.x,t.y,t.z);}};},
                  onEnd:()=>{render.fixedCamera=undefined;},
                  onReward:(_jump,reward,all)=>{
                    sim.money+=reward;sound.frontend(AE_FRONTEND.partMissionComplete);
                    hud.bigMessage(all?'ALL UNIQUE STUNTS COMPLETED!':'UNIQUE STUNT BONUS!',`REWARD $${reward}`,6000);
                    progression.save();
                  },
                });
                for(const id of progression.stuntJumpsFound)stuntJumps.found.add(id);
                for(const id of progression.stuntJumpsDone)stuntJumps.done.add(id);
                progression.stuntJumpsFound=stuntJumps.found;progression.stuntJumpsDone=stuntJumps.done;
              }worldGenerators=data.carGenerators;worldZones=data.worldZones;fleet?.setGenerators(worldGenerators);if(worldZones){fleet?.setZones(worldZones);if(police)police.zones=worldZones;}}
            if(data.type==='terrain'&&data.followId===-1&&savedTransfer&&!flightTransfer){
              const target=savedTransfer;savedTransfer=undefined;
              void (async()=>{
                const installed=await replaceWalkTerrain({...data,followId:undefined,preservePosition:false,preferredSpawn:{x:target.x,z:-target.y}}).catch(()=>false);
                if(!installed||!alive){hud.message('Your save point could not be loaded.');return;}
                const position={x:target.x,y:target.z,z:-target.y};
                sim.player.position={...position};sim.player.previous={...position};sim.player.heading=target.heading;
                sim.playerBody.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);sim.playerBody.setNextKinematicTranslation({x:position.x,y:position.y+.9,z:position.z});
                render.yaw=target.heading+Math.PI;follower=new SceneRegionFollower({x:target.x,y:target.y,radius:180,includeCollisionBounds:true});
                hud.message('Loaded your last save point.');
              })();return;
            }
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
            if(data.type==='terrain')void replaceWalkTerrain(data);
            if(data.type==='error'){
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
      void import('./assets/scenePack').then(({readScenePack})=>readScenePack(`${import.meta.env.BASE_URL}play/${included.file}`)).then(data=>{bundledProceduralAssets=data.proceduralAssets;return installScene(data);}).catch(error=>{
        hud.menuMessage(error instanceof Error?error.message:'The included world could not be loaded. Reload to retry.');
      });
    }
  }
  frame = requestAnimationFrame(animate);
  cleanup = () => { sessionCharacterChannel.close(); disposeWater(); disposeSunTexture(); disposeObjectData(); disposeLighting(); characterChannel?.close();
    alive = false; progression.save();window.removeEventListener('pagehide',saveProgress);journal.dispose();worldFx.dispose();breakManager.resetAll();breakPieces.dispose();weatherEffects.dispose();movingFog.dispose();pickups.dispose();drops.dispose();occupants.dispose();sirens.dispose();skids.dispose();wakes.dispose();wantedHud.dispose();weaponView.dispose();weapons.dispose();arsenal.dispose();traffic?.dispose(); police?.dispose(); driveby?.dispose(); pedestrians?.dispose(); if(fleet)fleet.dispose();else worldCar?.dispose();staticWorld?.dispose();clearTimeout(followTimer);follower?.stop();sceneChannel?.close(); importedScene?.dispose(); cancelAnimationFrame(frame); input.dispose(); sound.dispose(); render.dispose(); sim.dispose();
    document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onLockChange); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
boot().catch(error => { console.error(error); hud.button('play').textContent = 'Unable to start'; hud.menuMessage(`The game needs a browser with WebGL2 enabled. ${error instanceof Error ? error.message : ''}`); });
if (import.meta.hot) import.meta.hot.dispose(() => { cleanup(); app.replaceChildren(); });
