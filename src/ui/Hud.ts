import type { AudioSettings } from '../audio/settings';
import type { Simulation } from '../simulation/Simulation';

export class Hud {
  readonly element = document.createElement('div');
  readonly menu: HTMLElement;
  private weaponIcon=document.createElement('img');
  private messageUntil = 0;
  private prompt: HTMLElement;
  private bigMessageUntil = 0;
  private clock: HTMLElement;
  private money: HTMLElement;
  weapon(name:string,icon:string|undefined,unarmed:boolean){const fist=this.element.querySelector<SVGElement>('svg.weapon')!;fist.style.display=unarmed?'':'none';this.weaponIcon.hidden=!icon||unarmed;if(icon&&this.weaponIcon.src!==icon)this.weaponIcon.src=icon;this.weaponIcon.alt=name;}
  constructor(container: HTMLElement) {
    this.element.className = 'game-ui';
    this.element.innerHTML = `
      <section class="status" aria-label="Player status">
        <div class="status-numbers"><span class="game-time">17:24</span><span class="cash">$00000350</span>
          <div class="bars"><div class="armour-bar" role="progressbar" aria-label="Armour" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i></i></div><div class="health-bar" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i></i></div></div>
          </div>
        <svg class="weapon" viewBox="0 0 64 70" aria-label="Unarmed"><path d="M16 53 10 39 13 31 12 16 18 12 23 16 24 10 31 8 35 14 39 10 45 12 47 19 51 17 56 21 55 39 48 51 44 63 22 64Z" fill="#e7e7dc" stroke="#111713" stroke-width="5" stroke-linejoin="round"/><path d="M14 32 24 35 26 45M24 16 24 29M35 14 35 29M47 19 45 31M23 52 45 51" fill="none" stroke="#111713" stroke-width="3"/></svg>
      </section>

      <div class="screen-fade" aria-hidden="true"></div>
      <div class="big-message" role="status" aria-live="polite" hidden><b></b><span></span></div>
      <div class="location">San Andreas</div>
      <div class="prompt" role="status" aria-live="polite"></div>
      <div class="onboarding"><span>W A S D</span> move <b>·</b> <span>SHIFT</span> sprint <b>·</b> <span>SPACE</span> jump <b>·</b> <span>C</span> crouch <b>·</b> drag to look <b>·</b> <span>TAB</span> arsenal <b>·</b> <span>F</span> enter car <b>·</b> <span>M</span> map</div>
      <div class="death-overlay" hidden role="status"><span>Wasted</span></div>
      <div class="menu-backdrop"><section class="menu" aria-label="Game menu">
        <p class="setting">San Andreas</p><h1>San Andreas</h1><p class="menu-location">San Andreas</p>
        <div class="menu-actions"><button id="play" disabled>Loading the native world…</button><button id="controls">Controls</button><button id="audio">Audio</button><button id="lighting">Lighting</button></div>
        <div class="controls-panel" hidden><p><b>On foot</b> W A S D · Move &nbsp; Shift · Sprint &nbsp; Space · Jump &nbsp; C · Crouch / Stand &nbsp; R · Punch / Reload &nbsp; Ctrl · Fire / Use &nbsp; Right mouse · Aim &nbsp; Left mouse while aiming · Fire &nbsp; Wheel · Switch weapon &nbsp; Tab · Arsenal &nbsp; Hold H · Surrender when wanted</p><p><b>Vehicles</b> F · Enter / Exit nearest car &nbsp; W/S · Accelerate / Brake / Reverse &nbsp; A/D · Steer &nbsp; Space · Handbrake</p><p><b>Boats</b> F · Board / Leave nearest runabout (leaving needs shallow water) &nbsp; W/S · Throttle / Reverse &nbsp; A/D · Steer &nbsp; Space · Brake</p><p><b>Aircraft</b> W/S · Throttle &nbsp; ↓/↑ · Nose up/down &nbsp; A/D · Bank &nbsp; Q/E · Rudder &nbsp; G · Retractable gear &nbsp; T · Hydra hover/forward mode &nbsp; Ctrl · Mounted guns &nbsp; B · Rockets &nbsp; Space · Helicopter hover &nbsp; Space · Ground brake &nbsp; F · Exit after landing and stopping. Choose an aircraft from the full map to fly from Verdant Meadows.</p><p><b>Map</b> M · Full map &nbsp; Click map · Waypoint</p><p><b>Camera</b> V / Home · Camera distance &nbsp; Drag mouse · Look &nbsp; Middle mouse / Numpad 1 · Look behind &nbsp; L · Lock pointer &nbsp; Escape · Pause</p></div>
        <div class="audio-panel" hidden aria-label="Audio settings">
          <label for="audio-master">Master volume <output id="value-master"></output></label><input id="audio-master" type="range" min="0" max="100" step="1">
          <label for="audio-effects">Sound effects <output id="value-effects"></output></label><input id="audio-effects" type="range" min="0" max="100" step="1">
          <label class="mute"><input id="audio-muted" type="checkbox"> Mute all sound</label>
          <p id="audio-status" role="status"></p><p class="audio-credits">Native San Andreas footsteps, weapons and explosions.</p>
        </div>
        <div class="lighting-panel" hidden aria-label="Local lighting">
          <label>Local timecycle file <input id="lighting-file" type="file" accept=".dat,text/plain"></label>
          <label for="lighting-weather">Weather</label><select id="lighting-weather" disabled></select>
          <button id="lighting-clear" disabled>Restore scene lighting</button>
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
    this.weaponIcon.className='weapon native-weapon-icon';this.weaponIcon.hidden=true;this.element.querySelector('.status')!.append(this.weaponIcon);
    this.menu = this.element.querySelector('.menu-backdrop')!;
    this.prompt = this.element.querySelector('.prompt')!;
    this.clock = this.element.querySelector('.game-time')!;
    this.money = this.element.querySelector('.cash')!;
    this.button('lighting').onclick = () => { const panel = this.element.querySelector<HTMLElement>('.lighting-panel')!; panel.hidden = !panel.hidden; };
    this.button('audio').onclick = () => { const panel = this.element.querySelector<HTMLElement>('.audio-panel')!; panel.hidden = !panel.hidden; };
    this.button('controls').onclick = () => { const panel = this.element.querySelector<HTMLElement>('.controls-panel')!; panel.hidden = !panel.hidden; };
  }
  bindAudio(settings: AudioSettings, update: (settings: AudioSettings) => void) {
    const values = { ...settings };
    for (const name of ['master', 'effects'] as const) {
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
  /** DO_FADE: `out` fades the screen to the fading colour over `milliseconds`, otherwise back to the game. */
  fade(out: boolean, milliseconds = 1000) {
    const screen = this.element.querySelector<HTMLElement>('.screen-fade')!;
    screen.style.transition = `opacity ${Math.max(0, milliseconds)}ms linear`;
    screen.style.opacity = out ? '1' : '0';
  }
  /** CMessages::AddBigMessageQ: the middle style used for stunt bonuses, with its reward line below. */
  bigMessage(title: string, subtitle = '', milliseconds = 5000) {
    const big = this.element.querySelector<HTMLElement>('.big-message')!;
    big.querySelector('b')!.textContent = title; big.querySelector('span')!.textContent = subtitle;
    big.hidden = false; this.bigMessageUntil = performance.now() + milliseconds;
  }
  menuMessage(text: string) { this.element.querySelector('.menu-message')!.textContent = text; }
  update(sim: Simulation, yaw: number) {
    const health = this.element.querySelector<HTMLElement>('.health-bar')!;
    if(performance.now()>this.messageUntil)this.prompt.textContent='';
    if(performance.now()>this.bigMessageUntil)this.element.querySelector<HTMLElement>('.big-message')!.hidden=true;
    health.setAttribute('aria-valuenow', String(Math.ceil(sim.player.health)));
    health.querySelector<HTMLElement>('i')!.style.width = `${sim.player.health}%`;
    // CHud::DrawVitalStats shows armour only above 1.
    const armour = this.element.querySelector<HTMLElement>('.armour-bar')!;armour.hidden = sim.player.armour <= 1;armour.setAttribute('aria-valuenow', String(Math.ceil(sim.player.armour)));armour.querySelector<HTMLElement>('i')!.style.width = `${sim.player.armour}%`;
    this.element.querySelector<HTMLElement>('.death-overlay')!.hidden = sim.player.health > 0;
    const minutes = Math.floor(sim.timeMinutes);
    this.clock.textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    this.money.textContent = `$${String(Math.floor(sim.money)).padStart(8, '0')}`;
  }
}
