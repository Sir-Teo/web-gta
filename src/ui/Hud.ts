import type { AudioSettings } from '../audio/settings';
import type { Simulation } from '../simulation/Simulation';

export class Hud {
  readonly element = document.createElement('div');
  readonly menu: HTMLElement;
  private messageUntil = 0;
  private prompt: HTMLElement;
  private clock: HTMLElement;
  private money: HTMLElement;
  private vehicle: HTMLElement;
  constructor(container: HTMLElement) {
    this.element.className = 'game-ui';
    this.element.innerHTML = `
      <section class="status" aria-label="Player status">
        <div class="status-numbers"><span class="game-time">17:24</span><span class="cash">$00000350</span>
          <div class="bars"><div class="health-bar" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i></i></div></div>
          </div>
        <svg class="weapon" viewBox="0 0 64 70" aria-label="Unarmed"><path d="M16 53 10 39 13 31 12 16 18 12 23 16 24 10 31 8 35 14 39 10 45 12 47 19 51 17 56 21 55 39 48 51 44 63 22 64Z" fill="#e7e7dc" stroke="#111713" stroke-width="5" stroke-linejoin="round"/><path d="M14 32 24 35 26 45M24 16 24 29M35 14 35 29M47 19 45 31M23 52 45 51" fill="none" stroke="#111713" stroke-width="3"/></svg>
      </section>

      <div class="location">San Andreas</div><div class="vehicle-name"></div>
      <div class="prompt" role="status" aria-live="polite"></div>
      <div class="onboarding"><span>W A S D</span> move <b>·</b> <span>SHIFT</span> sprint <b>·</b> <span>SPACE</span> jump <b>·</b> <span>C</span> crouch <b>·</b> drag to look</div>
      <div class="death-overlay" hidden role="status"><span>Wasted</span></div>
      <div class="menu-backdrop"><section class="menu" aria-label="Game menu">
        <p class="setting">San Andreas</p><h1>San Andreas</h1><p class="menu-location">San Andreas</p>
        <div class="menu-actions"><button id="play" disabled>Loading the native world…</button><button id="controls">Controls</button><button id="audio">Audio</button><button id="lighting">Lighting</button></div>
        <div class="controls-panel" hidden><p><b>On foot</b> W A S D · Move &nbsp; Shift · Sprint &nbsp; Space · Jump &nbsp; C · Crouch / Stand</p><p><b>Camera</b> V / Home · Camera distance &nbsp; Drag mouse · Look &nbsp; Middle mouse / Numpad 1 · Look behind &nbsp; L · Lock pointer &nbsp; Escape · Pause</p></div>
        <div class="audio-panel" hidden aria-label="Audio settings">
          <label for="audio-master">Master volume <output id="value-master"></output></label><input id="audio-master" type="range" min="0" max="100" step="1">
          <label for="audio-effects">Sound effects <output id="value-effects"></output></label><input id="audio-effects" type="range" min="0" max="100" step="1">
          <label for="audio-ambience">Ambience <output id="value-ambience"></output></label><input id="audio-ambience" type="range" min="0" max="100" step="1">
          <label class="mute"><input id="audio-muted" type="checkbox"> Mute all sound</label>
          <p id="audio-status" role="status"></p><p class="audio-credits">Engine by qubodup · Foley by Kenney and looneybits.<br><a href="${import.meta.env.BASE_URL}audio/CREDITS.txt" target="_blank" rel="noopener">Audio credits and licenses</a></p>
        </div>
        <div class="lighting-panel" hidden aria-label="Local lighting">
          <label>Local timecycle file <input id="lighting-file" type="file" accept=".dat,text/plain"></label>
          <label for="lighting-weather">Weather</label><select id="lighting-weather" disabled></select>
          <button id="lighting-clear" disabled>Restore authored lighting</button>
          <p id="lighting-status" role="status">Use a local timecycle file for sky, fog and building lighting.</p>
          <details><summary>Water surfaces</summary>
            <label>Local water.dat <input id="water-file" type="file" accept=".dat,text/plain"></label>
            <button id="water-clear" disabled>Clear water surfaces</button>
            <p id="water-status" role="status">Imported water geometry uses local timecycle color. Particle TXD can supply water texture. Waves and swimming are unfinished.</p>
          </details>
          <details><summary>Sun texture</summary>
            <label>Local particle TXD <input id="sun-texture-file" type="file" accept=".txd"></label>
            <button id="sun-texture-clear" disabled>Clear sun texture</button>
            <p id="sun-texture-status" role="status">Optional coronastar raster. Requires a local timecycle; sprite sizing is experimental.</p>
          </details>
          <details><summary>Imported object definitions</summary>
            <label>Local OBJECT.DAT <input id="object-data-file" type="file" accept=".dat,text/plain"></label>
            <button id="object-data-clear" disabled>Clear object definitions</button>
            <p id="object-data-status" role="status"></p>
          </details>
        </div>
        <p><a id="character-workshop" target="_blank" rel="noopener" hidden>Open character workshop for this session</a></p><p class="menu-message" role="status"></p><p class="build-label">Native world development · <a href="${import.meta.env.BASE_URL}assets.html" target="_blank" rel="noopener">Local texture library</a></p>
      </section></div>`;
    container.append(this.element);
    this.menu = this.element.querySelector('.menu-backdrop')!;
    this.prompt = this.element.querySelector('.prompt')!;
    this.clock = this.element.querySelector('.game-time')!;
    this.money = this.element.querySelector('.cash')!;
    this.vehicle = this.element.querySelector('.vehicle-name')!;
    this.button('lighting').onclick = () => { const panel = this.element.querySelector<HTMLElement>('.lighting-panel')!; panel.hidden = !panel.hidden; };
    this.button('audio').onclick = () => { const panel = this.element.querySelector<HTMLElement>('.audio-panel')!; panel.hidden = !panel.hidden; };
    this.button('controls').onclick = () => { const panel = this.element.querySelector<HTMLElement>('.controls-panel')!; panel.hidden = !panel.hidden; };
  }
  bindAudio(settings: AudioSettings, update: (settings: AudioSettings) => void) {
    const values = { ...settings };
    for (const name of ['master', 'effects', 'ambience'] as const) {
      const input = this.element.querySelector<HTMLInputElement>(`#audio-${name}`)!;
      const output = this.element.querySelector<HTMLOutputElement>(`#value-${name}`)!;
      input.value = String(Math.round(values[name] * 100)); output.value = `${input.value}%`;
      input.oninput = () => { values[name] = Number(input.value) / 100; output.value = `${input.value}%`; update({ ...values }); };
    }
    const mute = this.element.querySelector<HTMLInputElement>('#audio-muted')!;
    mute.checked = values.muted; mute.onchange = () => { values.muted = mute.checked; update({ ...values }); };
  }
  audioStatus(state: { unavailable: boolean; failed: number; loaded: boolean }) {
    this.element.querySelector('#audio-status')!.textContent = state.unavailable ? 'Sound is unavailable in this browser.' : state.failed ? 'Some sounds could not load. Gameplay remains available.' : state.loaded ? '' : 'Sounds load when you begin playing.';
  }
  button(id: string) { return this.element.querySelector<HTMLButtonElement>(`#${id}`)!; }
  setMenu(open: boolean) { this.menu.hidden = !open; this.element.classList.toggle('paused', open); }
  message(text: string) { this.prompt.textContent = text; this.messageUntil = performance.now() + 3000; }
  menuMessage(text: string) { this.element.querySelector('.menu-message')!.textContent = text; }
  update(sim: Simulation, yaw: number) {
    const health = this.element.querySelector<HTMLElement>('.health-bar')!;
    health.setAttribute('aria-valuenow', String(Math.ceil(sim.player.health)));
    health.querySelector<HTMLElement>('i')!.style.width = `${sim.player.health}%`;
    this.element.querySelector<HTMLElement>('.death-overlay')!.hidden = sim.player.health > 0;
    const minutes = Math.floor(sim.timeMinutes);
    this.clock.textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    this.money.textContent = `$${String(Math.floor(sim.money)).padStart(8, '0')}`;
    this.vehicle.textContent = sim.activeVehicle ? sim.activeVehicle.name : '';
    if (performance.now() > this.messageUntil) this.prompt.textContent = sim.player.health <= 0 || sim.impactRemaining > 0 ? '' : sim.transition ? (sim.transition.kind === 'enter' ? 'Getting into the car…' : 'Getting out of the car…') : sim.activeVehicle ? 'W / S accelerate & brake   ·   SPACE handbrake   ·   F exit' : sim.nearbyVehicle() ? 'Press F to enter the car' : '';
  }
}
