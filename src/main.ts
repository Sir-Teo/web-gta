import RAPIER from '@dimforge/rapier3d-compat';
import { FixedClock } from './core/FixedClock';
import { Simulation } from './simulation/Simulation';
import { GameRenderer } from './render/Renderer';
import { Input } from './input/Input';
import { Hud } from './ui/Hud';
import { captureSave, readSave, restoreSave, writeSave } from './persistence/saves';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const canvas = document.createElement('canvas'); canvas.className = 'world'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'San Andreas game world'); app.append(canvas);
const hud = new Hud(app); hud.setMenu(true);
let cleanup = () => {};

async function boot() {
  await RAPIER.init();
  const sim = new Simulation();
  const render = new GameRenderer(canvas, sim);
  const clock = new FixedClock();
  let paused = true, started = false, last = performance.now(), elapsed = 0, frame = 0, alive = true;
  const input = new Input(canvas, () => pause());
  function pause() {
    if (!started) return;
    paused = true; clock.reset(); input.clear(); hud.setMenu(true);
    hud.button('play').textContent = 'Resume game'; hud.button('save').hidden = false; hud.button('export').hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function play() {
    if (!started) { started = true; setTimeout(() => hud.element.classList.add('playing-long'), 20000); }
    paused = false; last = performance.now(); clock.reset(); input.clear(); hud.setMenu(false); hud.menuMessage(''); canvas.focus();
  }
  hud.button('play').disabled = false; hud.button('play').textContent = 'Begin game'; hud.button('play').onclick = play;
  try {
    const save = await readSave();
    if (save) {
      hud.button('continue').hidden = false;
      hud.button('continue').onclick = () => { restoreSave(sim, save); render.yaw = sim.player.heading + Math.PI; play(); };
    }
  } catch { hud.menuMessage('Local save storage is unavailable. You can still play and export a save.'); }
  hud.button('save').onclick = async () => {
    try { await writeSave(captureSave(sim)); hud.menuMessage('Game saved on this device.'); }
    catch (error) { hud.menuMessage(error instanceof Error ? error.message : 'Could not save the game.'); }
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
    state: () => ({ paused, player: { ...sim.player, position: { ...sim.player.position } }, vehicle: sim.activeVehicle?.id ?? null,
      vehicles: sim.vehicles.map(v => ({ id: v.id, position: { ...v.body.translation() }, speed: v.controller.currentVehicleSpeed() })),
      tick: clock.tick, draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles }),
  } });
  function animate(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    let alpha = 1;
    if (!paused) {
      elapsed += dt;
      if (input.consume('KeyF')) { const message = sim.interact(); if (message) hud.message(message); }
      if (input.consume('KeyL')) canvas.requestPointerLock()?.catch(() => hud.message('Pointer lock unavailable. Drag to look.'));
      alpha = clock.advance(dt, step => {
        const axes = input.axes();
        sim.step(step, { ...axes, cameraYaw: render.yaw, sprint: input.down('ShiftLeft') || input.down('ShiftRight'), jump: input.consume('Space'), handbrake: input.down('Space') });
      });
    }
    render.update(dt, alpha, input, elapsed);
    hud.update(sim, render.yaw);
  }
  frame = requestAnimationFrame(animate);
  cleanup = () => {
    alive = false; cancelAnimationFrame(frame); input.dispose(); render.dispose(); sim.dispose();
    document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onLockChange); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };
}
boot().catch(error => { console.error(error); hud.button('play').textContent = 'Unable to start'; hud.menuMessage(`The game needs a browser with WebGL2 enabled. ${error instanceof Error ? error.message : ''}`); });
if (import.meta.hot) import.meta.hot.dispose(() => { cleanup(); app.replaceChildren(); });
