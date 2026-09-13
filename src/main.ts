import { AudioSystem } from './audio/AudioSystem';
import { FixedClock } from './core/FixedClock';
import { Input } from './input/Input';
import { Hud } from './ui/Hud';
import { captureSave, parseSaveFile, readSave, restoreSave, writeSave } from './persistence/saves';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const canvas = document.createElement('canvas'); canvas.className = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'San Andreas game world'); app.append(canvas);
const hud = new Hud(app); hud.setMenu(true);
let cleanup = () => {};

async function boot() {
  // Show the menu immediately, while the renderer and WASM load independently.
  const [{ Simulation }, { GameRenderer }, { default: RAPIER }] = await Promise.all([
    import('./simulation/Simulation'), import('./render/Renderer'), import('@dimforge/rapier3d-compat'),
  ]);
  await RAPIER.init();
  const sim = new Simulation();
  const render = new GameRenderer(canvas, sim);
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
    hud.button('play').textContent = 'Resume game'; hud.button('save').hidden = false; hud.button('export').hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function play() {
    if (!started) { started = true; setTimeout(() => hud.element.classList.add('playing-long'), 20000); }
    paused = false; sound.setPlaying(true); last = performance.now(); clock.reset(); input.clear(); hud.setMenu(false); hud.menuMessage(''); canvas.focus();
  }
  hud.button('play').disabled = false; hud.button('play').textContent = 'Begin game'; hud.button('play').onclick = play;
  try {
    const save = await readSave();
    if (save) {
      hud.button('continue').hidden = false;
    }
  } catch { hud.menuMessage('Local save storage is unavailable. You can still play and export a save.'); }
  hud.button('continue').onclick = async () => {
    sound.unlock();
    const request = ++loadRequest;
    menuBusy(true);
    try {
      const latest = await readSave();
      if (request !== loadRequest || !alive) return;
      if (!latest) throw new Error('No valid saved game was found.');
      restoreSave(sim, latest); sound.reset(sim); render.yaw = sim.player.heading + Math.PI; play();
    } catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Could not load the saved game.'); }
    finally { menuBusy(false); }
  };
  hud.button('save').onclick = async () => {
    menuBusy(true);
    try { await writeSave(captureSave(sim)); hud.button('continue').hidden = false; hud.menuMessage('Game saved on this device.'); }
    catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Could not save the game.'); }
    finally { menuBusy(false); }
  };
  const importFile = hud.element.querySelector<HTMLInputElement>('#save-file')!;
  hud.button('import').disabled = false;
  hud.button('import').onclick = () => importFile.click();
  importFile.onchange = async () => {
    const file = importFile.files?.[0]; if (!file) return;
    const request = ++loadRequest;
    menuBusy(true);
    try {
      const data = await parseSaveFile(file);
      if (request !== loadRequest || !alive) return;
      await writeSave(data);
      if (request !== loadRequest || !alive) return;
      restoreSave(sim, data); sound.reset(sim); render.yaw = sim.player.heading + Math.PI;
      hud.button('continue').hidden = false;
      hud.menuMessage('Save imported. Choose Continue saved game to play.');
    } catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Could not import this save.'); }
    finally { importFile.value = ''; menuBusy(false); }
  };
  hud.button('export').onclick = () => {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(captureSave(sim), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'san-andreas-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      hud.menuMessage('Save exported. Keep this file as your backup.');
    } catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Could not export save.'); }
  };
  const onVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVisibility);
  const onBlur = () => pause(); window.addEventListener('blur', onBlur);
  const onLockChange = () => { if (!document.pointerLockElement && started) pause(); };
  document.addEventListener('pointerlockchange', onLockChange);
  const onContextLost = (event: Event) => { event.preventDefault(); pause(); hud.menuMessage('Graphics paused. Waiting for the display to recover…'); };
  const onContextRestored = () => { hud.menuMessage('Display recovered. Resume when ready.'); render.resize(); };
  canvas.addEventListener('webglcontextlost', onContextLost); canvas.addEventListener('webglcontextrestored', onContextRestored);
  // Development-only observation hook: useful for browser verification, never an alternate input path.
  if (import.meta.env.DEV) Object.assign(window, { __game: {
    state: () => ({ paused, deathRemaining: sim.deathRemaining, impactRemaining: sim.impactRemaining, player: { ...sim.player, position: { ...sim.player.position } }, transition: sim.transition ? { kind: sim.transition.kind, phase: sim.transition.phase, elapsed: sim.transition.elapsed } : null, seated: sim.seated, vehicle: sim.activeVehicle?.id ?? null,
      vehicles: sim.vehicles.map(v => ({ id: v.id, position: { ...v.body.translation() }, traffic: v.traffic ? { ...v.traffic } : null, speed: v.controller.currentVehicleSpeed() })),
      camera: { mode: render.distanceMode, distance: render.followDistance, yaw: render.yaw, viewYaw: render.viewYaw, pitch: render.viewPitch, glance: render.glance, position: render.camera.position.toArray() },
      audio: sound.state(), timeMinutes: sim.timeMinutes, lighting: { night: render.lighting.night },
      pedestrians: sim.population.pedestrians.map(p => ({ id: p.id, position: { ...p.position }, state: p.state, speed: p.speed })),
      tick: clock.tick, memory: { ...render.renderer.info.memory }, draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles }),
  } });
  function animate(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
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
        sim.step(step, { ...axes, cameraYaw: render.yaw, sprint: input.down('ShiftLeft') || input.down('ShiftRight'), jump: input.consume('Space'), handbrake: input.down('Space') });
        sound.tick(sim);
      });
    }
    render.update(dt, alpha, input, elapsed);
    sound.update(sim, render.camera.position, render.viewYaw, render.viewPitch, input.axes().y, input.down('KeyH'));
    hud.audioStatus(sound.state());
    hud.update(sim, render.viewYaw);
  }
  frame = requestAnimationFrame(animate);
  cleanup = () => {
    alive = false; cancelAnimationFrame(frame); input.dispose(); sound.dispose(); render.dispose(); sim.dispose();
    document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onLockChange); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
boot().catch(error => { console.error(error); hud.button('play').textContent = 'Unable to start'; hud.menuMessage(`The game needs a browser with WebGL2 enabled. ${error instanceof Error ? error.message : ''}`); });
if (import.meta.hot) import.meta.hot.dispose(() => { cleanup(); app.replaceChildren(); });
