import {StaticWorldProvider} from './assets/StaticWorldProvider';
import {INCLUDED_SCENES,includedScene} from './assets/includedScenes';
import {SceneRegionFollower} from './assets/sceneRegionFollower';
import {readSurfaceSprintRestrictions,surfaceBlocksSprint} from './simulation/nativeSurfaceMovement';
import {readSurfaceAudio,nativeFootstepCategory} from './assets/surfaceAudio';
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
import { Hud } from './ui/Hud';
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
  const importedMode = true;
  const sim = new Simulation(importedMode);
  let importedScene: ReturnType<typeof import('./simulation/nativeScene').installNativeScene> | undefined;
  let surfaceSprint:Map<number,boolean>|undefined;
  let surfaceSprintBlocked=false;
  let surfaceAudio: ReturnType<typeof readSurfaceAudio> | undefined;
  const render = new GameRenderer(canvas, sim);
  render.shadowReceivers=(footprint,projection)=>{
    if(!importedScene)return {chunks:[],candidateCount:0,triangleCount:0,vertexCount:0};
    return importedScene.shadowReceivers(footprint,projection);
  };
  render.beforeRender = camera => {
    importedScene?.setTime(sim.timeMinutes,render.lighting.nativeWorldAmbient,render.lighting.sunLightMultiplier,render.lighting.nativeObjectAmbient);
    // Calm-wind compatibility policy until native weather wind is reconstructed.
    importedScene?.updateView(camera,render.lighting.lowLodScale,{milliseconds:Math.floor(elapsed*1000)>>>0,wind:0,seed:0},!paused);
  };
  const disposeWater=bindLocalWater(hud.element,render.lighting.water);
  const disposeSunTexture=bindLocalSunTexture(hud.element,render.lighting.sunTexture);
  sim.sunCollisionEligible=handle=>importedScene?.sources.get(handle)?.entityKind!=='dummy';
  const disposeObjectData=bindLocalObjectData(hud.element,sim.imported,definitions=>{
    if(!importedScene)throw new Error('Wait for the imported scene to finish loading.');
    importedScene.setObjectData(definitions);
  });
  const localLighting = new LocalTimecycle(), disposeLighting = bindLocalLighting(hud.element,localLighting);
  render.lighting.nativeTimecycle = (minutes,position) => localLighting.sample(minutes,position);
  const sound = new AudioSystem(); sound.reset(sim);
  hud.bindAudio(sound.settings, settings => sound.setSettings(settings));
  const clock = new FixedClock();
  let paused = true, started = false, last = performance.now(), elapsed = 0, frame = 0, alive = true;
  let loadRequest = 0;
  function menuBusy(busy: boolean) {
    hud.element.querySelectorAll<HTMLButtonElement>('.menu-actions button').forEach(button => button.disabled = busy);
  }
  const input = new Input(canvas, () => pause());
  function pause() {
    loadRequest++;
    if (!started) return;
    paused = true; sound.setPlaying(false); clock.reset(); input.clear(); hud.setMenu(true);
    hud.button('play').textContent = 'Resume game';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function play() {
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
    state: () => ({ proceduralCollisionSources:[...(importedScene?.sources.values()??[])].filter(source=>source.procedural).length, nativeVegetation:importedScene?.vegetation()??null, following:follower?.snapshot()??null,objectKinds: [...(importedScene?.sources.values()??[])].map(source=>source.entityKind), imported: sim.imported, importedInstances: importedScene?.instanceCount ?? 0, importedReusedColliders:importedScene?.reusedColliderCount??0,importedReusedPlacements:importedScene?.reusedPlacementCount??0, visibleImportedInstances: importedScene?.visibleInstanceCount ?? 0, visibleImportedModels: importedScene?.visibleModels() ?? [], paused, nativeShadow: render.nativeShadow.snapshot(), nativeContactLighting: render.contactLighting ?? null, nativeCharacter: render.nativeCharacter?.snapshot() ?? null, deathRemaining: sim.deathRemaining, impactRemaining: sim.impactRemaining, player: { ...sim.player, position: { ...sim.player.position } }, transition: sim.transition ? { kind: sim.transition.kind, phase: sim.transition.phase, elapsed: sim.transition.elapsed } : null, seated: sim.seated, vehicle: sim.activeVehicle?.id ?? null,
      vehicles: sim.vehicles.map(v => ({ id: v.id, position: { ...v.body.translation() }, traffic: v.traffic ? { ...v.traffic } : null, speed: v.controller.currentVehicleSpeed() })),
      camera: { mode: render.distanceMode, distance: render.followDistance, far: render.camera.far, fog: render.scene.fog?.toJSON(), yaw: render.yaw, viewYaw: render.viewYaw, pitch: render.viewPitch, glance: render.glance, position: render.camera.position.toArray() },
      movementSurfaceDefinitions:surfaceSprint?.size??0,surfaceSprintBlocked,
      audio: {...sound.state(),surfaceDefinitions:surfaceAudio?.byId.size??0}, timeMinutes: sim.timeMinutes, lighting: { area: render.lighting.area, sunMultiplier: render.lighting.sunLightMultiplier, night: render.lighting.night, imported: localLighting.name, weather: localLighting.weather, regionalModifiers:localLighting.modifierCount, native: localLighting.sample(sim.timeMinutes,render.camera.position) },
      pedestrians: sim.population.pedestrians.map(p => ({ id: p.id, position: { ...p.position }, state: p.state, speed: p.speed })),
      tick: clock.tick, memory: { ...render.renderer.info.memory }, draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles }),
  } });
  function animate(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    // A queued frame timestamp can predate the performance.now() baseline set on resume.
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.1)); last = now;
    let alpha = 1;
    if (!paused) {
      elapsed += dt;
      const cycleCamera = input.consume('KeyV'), alternateCamera = input.consume('Home');
      if (cycleCamera || alternateCamera) hud.message(`Camera: ${render.cycleCameraDistance()}`);
      if (input.consume('KeyC')) { const message = sim.toggleCrouch(); if (message) hud.message(message); }
      if (input.consume('KeyF')) { const message = sim.interact(); if (message) hud.message(message); }
      if (input.consume('KeyL')) canvas.requestPointerLock()?.catch(() => hud.message('Pointer lock unavailable. Drag to look.'));
      alpha = clock.advance(dt, step => {
        const axes = input.axes();
        const controls = { ...axes, cameraYaw: render.yaw, walk: input.down('AltLeft') || input.down('AltRight'), sprint: input.down('ShiftLeft') || input.down('ShiftRight'), jump: input.consume('Space'), handbrake: input.down('Space') };
        surfaceSprintBlocked=false;
        if(importedScene&&sim.player.grounded&&!sim.activeVehicle&&!sim.transition){
          const contact=sampleNativeGroundLighting(sim.world,sim.player.position,sim.playerCollider,importedScene.sources);
          surfaceSprintBlocked=surfaceBlocksSprint(surfaceSprint,contact?.material);
          if(surfaceSprintBlocked)controls.sprint=false;
        }
        sim.step(step, render.nativeCharacter?.step(step, controls, sim) ?? controls);
        let playerSurface: import('./assets/surfaceAudio').FootstepCategory | undefined = importedScene ? 'concrete' : undefined;
        if (importedScene && sim.player.grounded) {
          const contact=sampleNativeGroundLighting(sim.world,sim.player.position,sim.playerCollider,importedScene.sources);
          render.contactLighting=contact?.light;
          playerSurface=nativeFootstepCategory(contact&&surfaceAudio?.byId.get(contact.material));
        }
        sound.tick(sim, render.nativeCharacter?.landingFootContacts, playerSurface);
      });
    }
    if(!paused)requestFollowingTerrain();
    render.update(dt, alpha, input, elapsed, paused);
    sound.update(sim, render.camera.position, render.viewYaw, render.viewPitch, input.axes().y, input.down('KeyH'));
    hud.audioStatus(sound.state());
    hud.update(sim, render.viewYaw);
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
      hud.menuMessage('Local character installed in this session. Resume to test it. Character assets are not stored in saves.');
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
        hud.menuMessage('Local locomotion clip ready. Assigned idle, walk and run clips follow movement and Shift; unassigned actions use fallbacks. This character is not stored in saves.');
        characterChannel?.postMessage({ type: 'installed' }); characterChannel?.close();
      } catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Character installation failed.'); }
    };
    characterChannel.postMessage({ type: 'ready' });
  }
  let sceneChannel: BroadcastChannel | undefined;
  let staticWorld:StaticWorldProvider|undefined;
  let installingScene = false;
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
    const eligible=sim.player.grounded&&!sim.activeVehicle&&!sim.transition&&sim.deathRemaining===0&&importedScene.area===0;
    if(eligible&&follower?.needsPause(sim.player.position)){
      pause();followResume=loadRequest;followBoundaryPaused=true;menuBusy(true);hud.menuMessage('Waiting for nearby terrain…');
    }
    if(pendingFollowingData&&eligible&&!installingScene){const data=pendingFollowingData;pendingFollowingData=undefined;void replaceWalkTerrain(data);return;}
    if(paused||installingScene)return;
    const request=follower?.request(sim.player.position,eligible);
    if(!request)return;
    followResume=loadRequest;followBoundaryPaused=false;
    followTimer=setTimeout(()=>failFollowing(request.id,'The terrain request timed out.'),staticWorld?120000:30000);
    if(staticWorld)staticWorld.request(request.id,request.region);else sceneChannel!.postMessage({type:'region-request',...request});
  }
  const replaceWalkTerrain = async (data: TerrainUpdate) => {
    const automatic=data.followId!==undefined;
    if(automatic&&!follower?.matches(data.followId!))return;
    if(automatic&&(!sim.player.grounded||sim.activeVehicle||sim.transition||sim.deathRemaining>0)){pendingFollowingData=data;return;}
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
      if(automatic&&(!sim.player.grounded||sim.activeVehicle||sim.transition||sim.deathRemaining>0)){pendingFollowingData=data;return;}
      resumeVersion=loadRequest;autoResume=automatic&&followBoundaryPaused&&followResume===loadRequest&&!document.hidden;
      const modifiers=data.timecycleBoxes??[];prepareTimecycleBoxes(modifiers);
      const preserve=data.preservePosition===true;
      if(preserve&&(!sim.player.grounded||sim.activeVehicle||sim.transition||sim.deathRemaining>0))throw new Error('Keep position requires a grounded player on foot.');
      let spawn:ReturnType<typeof nativeSceneDestination>|undefined;
      const next=importedScene.replace(data.parts,candidate=>{spawn=preserve?assertInstalledSceneSupport(sim.world,candidate.sources.keys(),sim.playerBody.translation(),sim.player.crouched):nativeSceneDestination(data.parts,data.preferredSpawn);},data.datasetIdentity,vegetation);
      importedScene=next;localLighting.setModifiers(modifiers);render.lighting.area=next.area;
      sim.respawn=spawn!;if(!preserve){sim.resetPlayer();render.yaw=sim.player.heading+Math.PI;}if(!automatic)sound.reset(sim);
      hud.button('play').hidden=false;hud.button('play').textContent='Walk imported scene';
      hud.menuMessage('Terrain updated. Current environment and character settings are retained.');
      if(automatic)follower!.finish(data.followId!,true);completed=true;
      sceneChannel?.postMessage({type:'region-installed'});
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
    for (const selector of ['.location', '.menu-location']) hud.element.querySelector(selector)!.textContent = walkDemo?included.name:'Imported scene';
    hud.element.querySelector('.setting')!.textContent = walkDemo?included.location:'Local scene walk test';
    hud.element.querySelector('.build-label')!.textContent = walkDemo?'Browser exploration · Native terrain and character':'Temporary imported environment · Source files stay on this device';
    hud.button('play').hidden = true;
    if(walkDemo&&!parameters.has('characterTest')){
      const choices=document.createElement('nav');choices.className='scene-choices';choices.setAttribute('aria-label','Choose a starting point');
      for(const scene of INCLUDED_SCENES){
        const link=document.createElement('a');link.textContent=scene.name;link.href=`${import.meta.env.BASE_URL}?area=${scene.id}`;
        if(scene.id===included.id)link.setAttribute('aria-current','page');choices.append(link);
      }
      hud.element.querySelector('.menu-actions')!.after(choices);
    }

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
        render.lighting.area=importedScene.area;
        importedScene.setTime(sim.timeMinutes,localLighting.sample(sim.timeMinutes)?.ambient);
        sim.world.step();
        sim.respawn = importedSpawn(sim.world, data.parts, new Set(importedScene.sources.keys()), sim.playerCollider, data.preferredSpawn); sim.resetPlayer();
        render.yaw = sim.player.heading + Math.PI; sound.reset(sim);
        hud.button('play').hidden = false; hud.button('play').textContent = walkDemo?`Explore ${included.name}`:'Walk imported scene';
        hud.menuMessage((walkDemo?`${included.name} is ready. WASD to walk, Shift to sprint, Space to jump.`:'Imported scene ready. WASD to walk; Space to jump. This test scene is not saved.')+(environmentWarnings.length?` Environment files unavailable: ${environmentWarnings.join(', ')}. See Lighting for details.`:''));
        if('followRegion' in data&&data.followRegion)follower=new SceneRegionFollower(data.followRegion as import('./assets/sceneRegion').SceneRegion);
        if(walkDemo){
          follower=new SceneRegionFollower({x:included.spawn.x,y:-included.spawn.z,radius:included.id==='verdant-meadows'?300:180,includeCollisionBounds:true});
          staticWorld=new StaticWorldProvider(`${import.meta.env.BASE_URL}play/world/`,data=>{
            if(!alive)return;
            if(data.type==='terrain')void replaceWalkTerrain(data);
            if(data.type==='error'){
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
        if (data?.type === 'scene') void installScene(data);
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
    alive = false; staticWorld?.dispose();clearTimeout(followTimer);follower?.stop();sceneChannel?.close(); importedScene?.dispose(); cancelAnimationFrame(frame); input.dispose(); sound.dispose(); render.dispose(); sim.dispose();
    document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onLockChange); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
boot().catch(error => { console.error(error); hud.button('play').textContent = 'Unable to start'; hud.menuMessage(`The game needs a browser with WebGL2 enabled. ${error instanceof Error ? error.message : ''}`); });
if (import.meta.hot) import.meta.hot.dispose(() => { cleanup(); app.replaceChildren(); });
