import type { DisplaySettings } from '../core/frameLimiter';
import type { AudioSettings } from '../audio/settings';
import {healthBarHidden,armourBarHidden,hudMoney,healthBarWidth,barFill} from './nativeHudBars';
import { NativeHudNames } from './nativeHudNames';
import type { DrawnHudBigMessages } from './nativeHudBigMessages';
import {elementSize} from './elementSize';
import type { Simulation } from '../simulation/Simulation';

/** How far a box (a script menu) moves to stand clear of another (a touch screen's pause button) by `margin`: right if
 * it then fits across the screen, else down if it fits, else not at all. */
export function clearOf(box: { left: number; top: number; right: number; bottom: number }, avoid: { left: number; top: number; right: number; bottom: number }, screen: { width: number; height: number }, margin = 8) {
  const overlaps = box.left < avoid.right + margin && box.right > avoid.left - margin && box.top < avoid.bottom + margin && box.bottom > avoid.top - margin;
  if (!overlaps) return { x: 0, y: 0 };
  const x = avoid.right + margin - box.left;
  if (box.right + x <= screen.width - margin) return { x, y: 0 };
  const y = avoid.bottom + margin - box.top;
  if (box.bottom + y <= screen.height - margin) return { x: 0, y };
  return { x: 0, y: 0 };
}
export class Hud {
  readonly element = document.createElement('div');
  readonly menu: HTMLElement;
  private weaponIcon=document.createElement('img');
  private ammoText=document.createElement('span');
  private radioLeftMs=0;private radioPending=false;private inVehicle=false;
  /** CHud's zone and vehicle name slots. */
  readonly names=new NativeHudNames();
  private messageUntil = 0;
  private prompt: HTMLElement;
  private bigMessageUntil = 0;
  private whiteMiddleUntil = 0;
  private clock: HTMLElement;
  private money: HTMLElement;
  /** DrawAreaName and DrawVehicleName for one frame: names fade by their alpha. A small message or
   * the white-middle big message pushes the zone name out. */
  /** CAERadioTrackManager::DisplayRadioStationName: the station for 2.5 s of game time at the top centre, in gold,
   * only while the player is in a vehicle. m_bDisplayStationName waits out a pause or widescreen, and nothing is drawn
   * during either. */
  radioName(name:string|undefined){const el=this.element.querySelector<HTMLElement>('.radio-name')!;if(!name){el.hidden=true;this.radioLeftMs=0;this.radioPending=false;return;}el.textContent=name;this.radioPending=true;}
  private nameEls?:{radio:HTMLElement;zone:HTMLElement;vehicle:HTMLElement};
  /** CHud::DrawAreaName: with gang wars active the zone name takes the current zone's gang colour (all channels non-zero). */
  zoneNameColour?:readonly [number,number,number];
  drawNames(dtMs:number,paused=false,inVehicle=false,areaNameOff=false,widescreen=false,vehicleNameOff=false){
    this.inVehicle=inVehicle;
    const radio=this.nameEls?.radio??this.element.querySelector<HTMLElement>('.radio-name')!;
    const els=this.nameEls??={radio,zone:this.element.querySelector<HTMLElement>('.location')!,vehicle:this.element.querySelector<HTMLElement>('.vehicle-name')!};
    if(!paused){if(!widescreen&&inVehicle&&this.radioPending){this.radioPending=false;this.radioLeftMs=2500;}else this.radioLeftMs=Math.max(0,this.radioLeftMs-dtMs);}
    radio.hidden=!inVehicle||paused||widescreen||this.radioLeftMs<=0;
    // CHud::Draw skips DrawAreaName and DrawVehicleName in widescreen, so their fades and timers wait (CSS hides them).
    if(paused||widescreen)return;
    const out=this.names.update(dtMs,{message:!!this.prompt.textContent,bigMessage:this.element.classList.contains('white-middle')||this.missionTitleShowing,areaNameOff,vehicleNameOff});
    for(const [key,el,name] of [['zone',els.zone,out.zone],['vehicle',els.vehicle,out.vehicle]] as const){
      if(el.hidden!==!name)el.hidden=!name;
      if(name){if(el.textContent!==name.text)el.textContent=name.text;this.put(`${key}.alpha`,String(name.alpha/255),v=>{el.style.opacity=v;});
       if(key==='zone'){const c=this.zoneNameColour;this.put('zone.colour',c?`rgb(${c[0]},${c[1]},${c[2]})`:'',v=>{el.style.color=v;});}}
    }
  }
  /** CHud::DrawAmmo's text, or undefined when it draws nothing. */
  ammo(text:string|undefined){this.ammoText.hidden=text===undefined;if(text!==undefined&&this.ammoText.textContent!==text)this.ammoText.textContent=text;}
  /** hud.txd's fist raster (SPRITE_FIST), which CHud::DrawWeaponIcon draws for an unarmed ped; the drawn fist stands in
   * until it loads. */
  fistIcon?:string;
  private fist?:SVGElement;
  weapon(name:string,icon:string|undefined,unarmed:boolean){
    const shown=unarmed?this.fistIcon:icon,fist=this.fist??=this.element.querySelector<SVGElement>('svg.weapon')!;
    this.put('fist.display',unarmed&&!this.fistIcon?'':'none',v=>{fist.style.display=v;});if(this.weaponIcon.hidden!==!shown)this.weaponIcon.hidden=!shown;
    if(shown&&this.weaponIcon.src!==shown)this.weaponIcon.src=shown;if(this.weaponIcon.alt!==name)this.weaponIcon.alt=name;
  }
  constructor(container: HTMLElement) {
    this.element.className = 'game-ui';
    this.element.innerHTML = `
      <section class="status" aria-label="Player status">
        <div class="status-numbers"><span class="game-time">17:24</span><span class="cash">$00000350</span>
          <div class="bars"><div class="breath-bar" role="progressbar" aria-label="Breath" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" hidden><i></i></div><div class="armour-bar" role="progressbar" aria-label="Armour" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i></i></div><div class="health-bar" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i></i></div></div>
          </div>
        <svg class="weapon" viewBox="0 0 64 70" aria-label="Unarmed"><path d="M16 53 10 39 13 31 12 16 18 12 23 16 24 10 31 8 35 14 39 10 45 12 47 19 51 17 56 21 55 39 48 51 44 63 22 64Z" fill="#e7e7dc" stroke="#111713" stroke-width="5" stroke-linejoin="round"/><path d="M14 32 24 35 26 45M24 16 24 29M35 14 35 29M47 19 45 31M23 52 45 51" fill="none" stroke="#111713" stroke-width="3"/></svg>
      </section>

      <div class="credits" aria-label="Credits" hidden><div class="credits-roll"></div></div>
      <div class="widescreen-border top" aria-hidden="true" hidden></div><div class="widescreen-border bottom" aria-hidden="true" hidden></div>
      <div class="hud-big light-blue-top" role="status" hidden></div><div class="hud-big middle-smaller" role="status" hidden></div>
      <div class="hud-big white-middle-smaller" role="status" hidden></div><div class="hud-big oddjob-title" role="status" hidden></div>
      <div class="screen-fade" aria-hidden="true"></div>
      <div class="hud-big mission-title" role="status" hidden></div>
      <div class="big-message" role="status" aria-live="polite" hidden><b></b><span></span></div>
      <div class="white-middle-message" role="status" aria-live="assertive" hidden></div>
      <div class="location" hidden></div>
      <div class="vehicle-name" hidden></div>
      <div class="radio-name" hidden></div>
      <div class="prompt" role="status" aria-live="polite"></div>
      <div class="garage-message" role="status" aria-live="polite" hidden></div>
      <div class="script-menus" role="menu" aria-label="Menu" hidden></div>
      <div class="help-box" role="status" aria-live="polite" hidden></div>
      <div class="mission-timers" hidden></div>
      <div class="trip-skip" hidden><img alt=""><span></span></div>
      <div class="stat-update" hidden><span class="stat-name"></span> <b class="stat-sign"></b><div class="stat-bar"><i></i></div></div>
      <div class="onboarding"><span>W A S D</span> move <b>·</b> <span>SHIFT</span> sprint <b>·</b> <span>SPACE</span> jump <b>·</b> <span>C</span> crouch <b>·</b> drag to look <b>·</b> <span>&#96;</span> arsenal <b>·</b> <span>F</span> enter car <b>·</b> <span>M</span> map</div>
      <div class="menu-backdrop"><section class="menu" aria-label="Game menu">
        <p class="setting">San Andreas</p><h1>San Andreas</h1><p class="menu-location">San Andreas</p>
        <div class="menu-actions"><button id="play" disabled>Loading the native world…</button><button id="menu-map" hidden>Map</button><button id="new-game" hidden>New Game</button><button id="brief" hidden>Brief</button><button id="controls">Controls</button><button id="display">Display</button><button id="audio">Audio</button><button id="lighting">Lighting</button><button id="install" hidden>Add to Home screen</button></div>
        <div class="brief-panel" hidden aria-label="Brief"><ol></ol></div>
        <div class="controls-panel" hidden><p><b>On foot</b> W A S D · Move &nbsp; Shift · Sprint &nbsp; Space · Jump &nbsp; C · Crouch / Stand &nbsp; R · Reload &nbsp; Ctrl · Fire / Use &nbsp; Right mouse · Aim &nbsp; Left mouse while aiming · Fire &nbsp; Wheel · Switch weapon &nbsp; Tab · Arsenal</p><p><b>Vehicles</b> F · Enter / Exit nearest car &nbsp; W/S · Accelerate / Brake / Reverse &nbsp; A/D · Steer &nbsp; Space · Handbrake</p><p><b>Boats</b> F · Board / Leave nearest runabout (leaving needs shallow water) &nbsp; W/S · Throttle / Reverse &nbsp; A/D · Steer &nbsp; Space · Brake &nbsp; Ctrl · Drive-by</p><p><b>Jetpack</b> W/S · Tilt forward / back &nbsp; A/D · Strafe &nbsp; Space · Ascend &nbsp; Shift · Descend &nbsp; F · Drop while standing still</p><p><b>Aircraft</b> W/S · Throttle &nbsp; ↓/↑ · Nose up/down &nbsp; A/D · Bank &nbsp; Q/E · Rudder &nbsp; G · Retractable gear &nbsp; T · Hydra hover/forward mode &nbsp; Ctrl · Mounted guns &nbsp; B · Rockets &nbsp; Space · Helicopter hover &nbsp; Space · Ground brake &nbsp; F · Exit after landing and stopping. Choose an aircraft from the full map to fly from Verdant Meadows.</p><p><b>Map</b> M · Full map &nbsp; Click map · Waypoint &nbsp; Wheel / PgUp / PgDn · Zoom &nbsp; Arrows · Pan &nbsp; Home · Find CJ</p><p><b>Camera</b> V / Home · Camera distance &nbsp; Drag mouse · Look &nbsp; Middle mouse / Numpad 1 · Look behind &nbsp; L · Lock pointer &nbsp; Escape · Pause</p><p class="mouse-settings"><label>Mouse sensitivity <input type="range" id="mouse-sens" aria-label="Mouse sensitivity"></label> &nbsp; <label><input type="checkbox" id="mouse-invert"> Invert mouse vertically</label></p></div>
        <div class="display-panel" hidden aria-label="Display settings">
          <label class="mute"><input id="display-frame-limiter" type="checkbox"> Frame limiter (30 frames a second, as the PC original)</label>
          <label class="mute"><input id="display-subtitles" type="checkbox"> Subtitles</label>
          <label class="mute">Radar <select id="display-radar" aria-label="Radar"><option value="map">Map &amp; blips</option><option value="blips">Blips only</option><option value="off">Off</option></select></label>
        </div>
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
            <p id="water-status" role="status">Imported water geometry uses local timecycle color with wave swells. Particle TXD can supply water texture. Boats exit overboard into the swim.</p>
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
    this.weaponIcon.className='weapon native-weapon-icon';this.weaponIcon.hidden=true;
    // CHud::DrawWeapon puts the ammo readout (DrawAmmo) centred under the weapon icon.
    const fist=this.element.querySelector('.status svg.weapon')!,slot=document.createElement('div');slot.className='weapon-slot';
    fist.replaceWith(slot);this.ammoText.className='weapon-ammo';this.ammoText.hidden=true;slot.append(fist,this.weaponIcon,this.ammoText);
    this.menu = this.element.querySelector('.menu-backdrop')!;
    // Tab and Shift+Tab walk the open menu's controls and wrap round, so the keyboard never falls back to the game.
    this.menu.addEventListener('keydown', e => {
      if (e.code !== 'Tab') return;
      const controls = [...this.menu.querySelectorAll<HTMLElement>('button,input,select,a[href]')].filter(c => !(c as HTMLButtonElement).disabled && !c.hidden && c.offsetParent !== null), at = controls.indexOf(document.activeElement as HTMLElement);
      if (!controls.length) return;
      if (e.shiftKey && at <= 0) { e.preventDefault(); controls[controls.length - 1].focus(); } else if (!e.shiftKey && (at < 0 || at === controls.length - 1)) { e.preventDefault(); controls[0].focus(); }
    });
    this.prompt = this.element.querySelector('.prompt')!;
    this.clock = this.element.querySelector('.game-time')!;
    this.money = this.element.querySelector('.cash')!;
    // Each button opens and closes its panel. On a touch screen one is open at a time, as the port's menu shows one page
    // beside its list (style.css puts it there on a short screen).
    // Display is the PC front end's Display Setup (and the mobile ports' Display): the frame limiter, subtitles, the
    // radar, and on a touch screen the port's graphics settings.
    const panels = { brief: '.brief-panel', lighting: '.lighting-panel', audio: '.audio-panel', display: '.display-panel', controls: '.controls-panel' } as const;
    const toggle = (name: keyof typeof panels) => {
      const panel = this.element.querySelector<HTMLElement>(panels[name])!, open = panel.hidden;
      if (open && document.documentElement.classList.contains('touch')) for (const [other, selector] of Object.entries(panels)) if (other !== name) { this.element.querySelector<HTMLElement>(selector)!.hidden = true; this.button(other).setAttribute('aria-expanded', 'false'); }
      panel.hidden = !open; this.button(name).setAttribute('aria-expanded', String(open));
      return panel;
    };
    for (const name of Object.keys(panels) as (keyof typeof panels)[]) this.button(name).setAttribute('aria-expanded', 'false');
    // Opened, the list shows its newest line, and a phone's short menu scrolls the page down to it.
    this.button('brief').onclick = () => { const panel = toggle('brief'); if (!panel.hidden) { panel.scrollTop = panel.scrollHeight; panel.scrollIntoView({ block: 'nearest' }); } };
    this.button('lighting').onclick = () => toggle('lighting');
    this.button('audio').onclick = () => toggle('audio');
    this.button('display').onclick = () => toggle('display');
    this.button('controls').onclick = () => toggle('controls');
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
  /** The frame limiter, subtitles and radar mode (FrontEndMenuManager.m_bPrefsFrameLimiter, m_bShowSubtitles and
   * m_nRadarMode). */
  bindDisplay(settings: DisplaySettings, update: (settings: DisplaySettings) => void) {
    const limiter = this.element.querySelector<HTMLInputElement>('#display-frame-limiter')!, subtitles = this.element.querySelector<HTMLInputElement>('#display-subtitles')!, radar = this.element.querySelector<HTMLSelectElement>('#display-radar')!;
    limiter.checked = settings.frameLimiter; subtitles.checked = settings.subtitles; radar.value = settings.radarMode;
    limiter.onchange = subtitles.onchange = radar.onchange = () => update({ frameLimiter: limiter.checked, subtitles: subtitles.checked, radarMode: radar.value === 'blips' || radar.value === 'off' ? radar.value : 'map' });
  }
  audioStatus(state: { unavailable: boolean; failed: number; loaded: boolean }) {
    const text = state.unavailable ? 'Sound is unavailable in this browser.' : state.failed ? 'Some sounds could not load. Gameplay remains available.' : state.loaded ? '' : 'Sounds load when you begin playing.';
    this.put('audio.status', text, v => { this.element.querySelector('#audio-status')!.textContent = v; });
  }
  button(id: string) { return this.element.querySelector<HTMLButtonElement>(`#${id}`)!; }
  /** Opening the menu moves the keyboard into it (its first control), so Tab reaches its buttons from the game. */
  setMenu(open: boolean) {
    const opening = open && this.menu.hidden;this.menu.hidden = !open; this.element.classList.toggle('paused', open);
    if (opening && !this.menu.contains(document.activeElement)) this.menu.querySelector<HTMLElement>('button:not([disabled]):not([hidden])')?.focus({ preventScroll: true });
  }
  /** CGarages::PrintMessages: the garage message line (pickup and tag tallies) for this frame, or none. */
  garageMessage(text?:string){const el=this.garageEl??=this.element.querySelector<HTMLElement>('.garage-message')!;if(text){if(el.textContent!==text)el.textContent=text;el.hidden=false;}else if(!el.hidden){el.hidden=true;el.textContent='';}}
  private garageEl?:HTMLElement;
  /** A prompt line, timed on the game clock like CMessages' messages, so it does not run out while the game is paused. */
  message(text: string, milliseconds = 3000) { this.prompt.textContent = text; this.messageUntil = this.messageClock() + milliseconds; }
  /** CHud::SetHelpMessage: the top-left help box. DrawHelpText is not reversed; the box shows for `milliseconds`. */
  /** Dresses the help box's text after it is set (the touch controls' glyphs beside the buttons it names). */
  decorateHelp?: (box: HTMLElement, text: string) => void;
  help(text: string, milliseconds = 5000) {
    const box = this.element.querySelector<HTMLElement>('.help-box')!;box.textContent = text;box.hidden = !text;
    if (text) this.decorateHelp?.(box, text);
    this.helpUntil = text ? this.messageClock() + milliseconds : 0;
    // The help line and the stat box are one box (m_pHelpMessage): either replaces the other.
    this.element.querySelector<HTMLElement>('.stat-update')!.hidden = true;this.statUpdateUntil = 0;
  }
  private helpUntil = 0;
  /** The texts on screen that can ask for a control: the help box's and the prompt line's. */
  shownPrompts(): string[] {
    const box = this.element.querySelector<HTMLElement>('.help-box')!;
    return [box.hidden ? '' : box.textContent ?? '', this.prompt.textContent ?? ''].filter(Boolean);
  }
  /** CHud::m_fHelpMessageBoxWidth on its 640-wide screen: the box's width as a share of the default 200 (DrawHelpText
   * is unreversed, so the default box keeps its authored size and a script's width scales it). */
  helpBoxWidth(width: number) {
    if (width === this.helpWidth) return;
    this.helpWidth = width;
    // A share of the box's width, which on a touch screen stays clear of the buttons on the right too.
    const box = this.element.querySelector<HTMLElement>('.help-box')!;
    if (width === 200) box.style.removeProperty('--help-width'); else box.style.setProperty('--help-width', String(width / 200));
  }
  private helpWidth = 200;
  /** CHud::HelpMessageDisplayed (m_nHelpMessageState != 0): a help line or stat box that a drawn frame put up. What
   * is set during a frame is not displayed until DrawHelpText runs, so a later message in the frame replaces it. */
  helpShowing() { return this.helpDrawn; }
  private helpDrawn = false;
  private statUpdateUntil = 0;
  /** CHud::SetHelpMessageStatUpdate: the stat's name, "+" or "-", and a bar of its value out of `max`. */
  statUpdate(name: string, increase: boolean, value: number, max = 1000, milliseconds = 3000) {
    const box = this.element.querySelector<HTMLElement>('.stat-update')!;
    box.querySelector('.stat-name')!.textContent = name;box.querySelector('.stat-sign')!.textContent = increase ? '+' : '-';
    box.querySelector<HTMLElement>('.stat-bar i')!.style.width = `${Math.max(0, Math.min(100, value / max * 100))}%`;
    box.hidden = false; this.statUpdateUntil = this.messageClock() + milliseconds;
    this.element.querySelector<HTMLElement>('.help-box')!.hidden = true;this.helpUntil = 0;
  }
  /** DO_FADE: `out` fades the screen to the fading colour over `milliseconds`, otherwise back to the game. */
  /** CCamera::DrawBordersForWideScreen: black bars to GetScreenRect's top and bottom while widescreen is on. */
  /** The script's mission clock and counters (COnscreenTimer::ProcessForDisplay's text). CHud::DrawMissionTimers is
   * unreversed, so the rows' placement and type are authored: under the wanted level, the label on the left and the
   * value on the right, a bar counter's value as a filled bar out of 100, in the counter's HUD colour. */
  missionTimers(display:{clock?:{text:string;label:string};counters:{text:string;label:string;type:number;colour:readonly number[];value:number}[]}|undefined){
    const box=this.element.querySelector<HTMLElement>('.mission-timers')!;
    const key=display?JSON.stringify(display):'';if(key===this.shownTimers)return;this.shownTimers=key;
    box.hidden=!display;if(!display){box.replaceChildren();return;}
    const rows:HTMLElement[]=[];
    const row=(label:string,value:HTMLElement|string,colour:readonly number[])=>{const r=document.createElement('div');r.className='timer-row';r.style.color=`rgb(${colour.join(',')})`;
      const l=document.createElement('span');l.className='timer-label';l.textContent=label;const v=document.createElement('span');v.className='timer-value';if(typeof value==='string')v.textContent=value;else v.append(value);r.append(l,v);rows.push(r);};
    if(display.clock)row(display.clock.label,display.clock.text,[172,203,241]);
    for(const counter of display.counters){
      if(counter.type===1){const bar=document.createElement('div');bar.className='timer-bar';const fill=document.createElement('i');fill.style.width=`${Math.max(0,Math.min(100,counter.value))}%`;fill.style.background=`rgb(${counter.colour.join(',')})`;bar.append(fill);row(counter.label,bar,counter.colour);}
      else row(counter.label,counter.text,counter.colour);
    }
    box.replaceChildren(...rows);
  }
  private shownTimers='';
  /** CTheScripts::bDisplayHud: off, CHud::Draw leaves out the player info and the wanted level. */
  displayHud(on:boolean){if(on===this.hudOn)return;this.hudOn=on;document.body.classList.toggle('script-hud-off',!on);}
  private hudOn=true;
  widescreen(on:boolean){
    for(const bar of this.element.querySelectorAll<HTMLElement>('.widescreen-border'))if(bar.hidden===on)bar.hidden=!on;
    // CHud::Draw and DrawAfterFade leave out the crosshair, player info, wanted level, vehicle name, radar, 3D markers
    // and area name in widescreen.
    document.body.classList.toggle('widescreen',on);
  }
  /** CCamera::SetFadeColour (SET_FADING_COLOUR): the colour the screen fades to. */
  fadeColour(r:number,g:number,b:number){const screen=this.element.querySelector<HTMLElement>('.screen-fade')!,colour=`rgb(${r},${g},${b})`;if(screen.dataset.colour!==colour){screen.dataset.colour=colour;screen.style.background=colour;}}
  fade(out: boolean, milliseconds = 1000) {
    const screen = this.element.querySelector<HTMLElement>('.screen-fade')!;
    screen.style.transition = `opacity ${Math.max(0, milliseconds)}ms linear`;
    screen.style.opacity = out ? '1' : '0';
    // What a touch screen raises over the fade goes with it, over the same time (style.css).
    this.element.style.setProperty('--fade-ms', `${Math.max(0, milliseconds)}ms`);
    this.element.classList.toggle('screen-faded', out);
  }
  /** CTimer::GetTimeInMS for the messages CMessages and CHud time: game time, which stops while paused. */
  messageClock: () => number = () => performance.now();
  private bigQueue: {title:string;milliseconds:number}[] = [];
  private bigSubtitleUntil = 0;
  /** CMessages::AddBigMessage (or AddBigMessageQ with `queued`, which waits for the one showing) in the middle style
   * stunt bonuses use; `subtitle` is the separate line below (AddBigMessageWithNumber's REWARD), kept `subtitleMs`. */
  bigMessage(title: string, subtitle = '', milliseconds = 5000, subtitleMs = milliseconds, queued = false) {
    const big = this.element.querySelector<HTMLElement>('.big-message')!,now = this.messageClock();
    if (subtitle) { big.querySelector('span')!.textContent = subtitle; this.bigSubtitleUntil = now + subtitleMs; big.hidden = false; }
    if (queued && now <= this.bigMessageUntil) { this.bigQueue.push({ title, milliseconds }); return; }
    big.querySelector('b')!.textContent = title; big.hidden = false; this.bigMessageUntil = now + milliseconds;
  }
  private updateBigMessage(now: number) {
    const big = this.element.querySelector<HTMLElement>('.big-message')!;
    if (this.bigMessageUntil && now > this.bigMessageUntil) {
      const next = this.bigQueue.shift();
      if (next) { big.querySelector('b')!.textContent = next.title; this.bigMessageUntil = now + next.milliseconds; }
      else { big.querySelector('b')!.textContent = ''; this.bigMessageUntil = 0; }
    }
    if (this.bigSubtitleUntil && now > this.bigSubtitleUntil) { big.querySelector('span')!.textContent = ''; this.bigSubtitleUntil = 0; }
    big.hidden = !this.bigMessageUntil && !this.bigSubtitleUntil;
  }
  /** CHud::DrawBustedWastedMessage (STYLE_WHITE_MIDDLE): light grey gothic text, fading in at 0.4 alpha per ms, until cleared. */
  // CMessages::AddBigMessage keeps it for `milliseconds`; ResetWastedText clears it at resurrection.
  // CFont scale is SCREEN_STRETCH_X(2.1) by SCREEN_SCALE_Y(2.1) over the 640 x 448 frame, so the
  // glyphs are 16 x 2.1 / 448 of the screen tall and stretched sideways on wide screens.
  whiteMiddleMessage(text: string, milliseconds = 0) {
    const el = this.element.querySelector<HTMLElement>('.white-middle-message')!;
    if(text&&!this.element.classList.contains('white-middle'))this.names.clearForBigMessage();
    el.textContent = text; el.style.transition = 'none'; el.style.opacity = '0'; el.hidden = !text;
    this.element.classList.toggle('white-middle', !!text);
    this.whiteMiddleUntil = text ? this.messageClock() + milliseconds : 0;
    if (text) {
      const {width:w, height:h} = elementSize(this.element), width = w || innerWidth, height = h || innerHeight;
      // The gothic sprite glyphs fill most of their 32-texel cell; the web font's capitals fill about 0.65 em.
      el.style.fontSize = `${1.25 * 16 * 2.1 * height / 448}px`;
      el.style.transform = `translate(-50%, -100%) scaleX(${(width / 640) / (height / 448)})`;
      void el.offsetWidth; el.style.transition = 'opacity 638ms linear'; el.style.opacity = '1';
    }
  }
  /** DrawMissionTitle's clock is running: DrawAreaName steps aside for it. */
  missionTitleShowing = false;
  private bigEls?: Record<'title'|'oddJob'|'lightBlue'|'middleSmaller'|'whiteMiddleSmaller', HTMLElement>;
  /** CHud's big messages in the styles nativeHudBigMessages draws. CFont's scale (sx, sy) is over the 640 x 448
   * frame: the glyphs are 16 sy / 448 of the screen tall, and a scale of half as wide as tall is the fonts' own shape.
   * `centre` is CFont's centre size, the width centred text wraps at. */
  bigMessages(d: DrawnHudBigMessages) {
    const q = (c: string) => this.element.querySelector<HTMLElement>(`.${c}`)!;
    const e = this.bigEls ??= { title: q('mission-title'), oddJob: q('oddjob-title'), lightBlue: q('light-blue-top'), middleSmaller: q('middle-smaller'), whiteMiddleSmaller: q('white-middle-smaller') };
    const {width:w, height:h} = elementSize(this.element), width = w || innerWidth, height = h || innerHeight;
    const show = (el: HTMLElement, text: string | undefined, sx: number, sy: number, centre?: number) => {
      if (el.hidden !== !text) el.hidden = !text;
      if (!text) return;
      const key = `${text}|${width}|${height}`;
      if (el.dataset.key === key) return;
      el.dataset.key = key; el.textContent = text;
      const stretch = 2 * (sx / sy) * (width / 640) / (height / 448);
      el.style.fontSize = `${16 * sy * height / 448}px`;
      el.style.setProperty('--stretch', String(stretch));
      el.style.maxWidth = centre ? `${centre / 640 * width / stretch}px` : '';
    };
    show(e.title, d.missionTitle?.text, 1, 1.3);
    if (d.missionTitle) this.put('title.alpha', String(d.missionTitle.alpha / 255), v => { e.title.style.opacity = v; });
    show(e.oddJob, d.oddJobTitle?.text, .6, 1.35, 350);
    if (d.oddJobTitle) e.oddJob.classList.toggle('after-fade', d.oddJobTitle.afterFade);
    show(e.lightBlue, d.lightBlueTop, 1, 1.8, 500);
    show(e.middleSmaller, d.middleSmaller, .6, 1.35, 500);
    show(e.whiteMiddleSmaller, d.whiteMiddleSmaller, .6, 1.35, 500);
  }
  private creditsBuilt = false;
  /** CCredits::RenderCredits: the roll's lines in the subtitles font, centred, a heading white and the rest 210 grey
   * at 210 alpha, each over its black copy one unit down and right (PrintCreditText), the roll's top at SCREEN_HEIGHT
   * less `scroll`, in units of the 448 the HUD is laid out over; under the widescreen bars, which RenderCredits draws
   * last. The lines are built once and the roll moved as a whole. Nothing while `scroll` is undefined. */
  credits(scroll: number | undefined, lines: () => readonly { text: string; scale: number; heading: boolean; position: number }[]) {
    const el = this.element.querySelector<HTMLElement>('.credits')!;
    if (scroll === undefined) { if (!el.hidden) el.hidden = true; return; }
    const roll = el.firstElementChild as HTMLElement;
    if (!this.creditsBuilt) {
      this.creditsBuilt = true;
      roll.replaceChildren(...lines().map(line => {
        const div = document.createElement('div'); div.className = line.heading ? 'credit heading' : 'credit'; div.textContent = line.text;
        div.style.top = `calc(${line.position} / 448 * var(--hud-h,var(--screen-h)))`; div.style.fontSize = `calc(16 * ${line.scale} / 448 * var(--hud-h,var(--screen-h)))`;
        return div;
      }));
    }
    if (el.hidden) el.hidden = false;
    roll.style.transform = `translateY(calc(${(448 - scroll) / 448} * var(--hud-h,var(--screen-h))))`;
  }
  /** CMenuSystem's menus as nativeHudMenus lays them out, over the 640 x 448 screen: the box and its gothic title,
   * the headers and rows in the subtitles font at CFont scale 0.52 x 1.0 (a row wider than its column shrinks, as
   * CFont's scale steps down), and a grid's colour cells. Rebuilt only when what is drawn changes. */
  menus(draws: readonly import('./nativeHudMenus').MenuDraw[]) {
    const el = this.element.querySelector<HTMLElement>('.script-menus')!;
    if (el.hidden !== !draws.length) el.hidden = !draws.length;
    if (!draws.length) { el.dataset.key = ''; return; }
    const {width:w, height:h} = elementSize(this.element), width = w || innerWidth, height = h || innerHeight;
    const key = JSON.stringify(draws) + `|${width}|${height}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key; el.replaceChildren();
    const px = (x: number) => x / 640 * width, py = (y: number) => y / 448 * height, rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const stretch = 2 * .52 * (width / 640) / (height / 448);
    for (const draw of draws) {
      if (draw.box) {
        const box = document.createElement('div'); box.className = 'script-menu-box';
        Object.assign(box.style, { left: `${px(draw.box.x)}px`, top: `${py(draw.box.y)}px`, width: `${px(draw.box.width)}px`, height: `${py(draw.box.height)}px` });
        el.append(box);
        if (draw.box.title) {
          // DrawWindow: 10 in from the left, its baseline 16 above the box's top edge.
          const title = document.createElement('div'); title.className = 'script-menu-title'; title.textContent = draw.box.title;
          Object.assign(title.style, { left: `${px(draw.box.x + 10)}px`, top: `${py(draw.box.y - 16)}px`, fontSize: `${16 * 1.4 * height / 448}px`, color: rgb(draw.box.titleColour) });
          el.append(title);
        }
      }
      for (const r of draw.rects) {
        const cell = document.createElement('div'); cell.className = 'script-menu-cell';
        Object.assign(cell.style, { left: `${px(r.x)}px`, top: `${py(r.y)}px`, width: `${px(r.width)}px`, height: `${py(r.height)}px`, background: rgb(r.colour) });
        el.append(cell);
      }
      for (const t of draw.texts) {
        const span = document.createElement('div'); span.className = 'script-menu-text'; span.textContent = t.text;
        const origin = t.align === 0 ? '50%' : t.align === 2 ? '100%' : '0';
        Object.assign(span.style, { left: `${px(t.x)}px`, top: `${py(t.y)}px`, fontSize: `${16 * height / 448}px`, color: rgb(t.colour), transformOrigin: `${origin} 0` });
        el.append(span);
        const natural = span.offsetWidth * stretch, fit = t.fit === undefined ? Infinity : px(t.fit);
        // CFont's x scale steps down by 0.05 until the row fits its column.
        let scale = .52; while (natural * scale / .52 > fit && scale > .05) scale -= .05;
        const sx = stretch * scale / .52, shift = t.align === 0 ? '-50%' : t.align === 2 ? '-100%' : '0';
        span.style.transform = `translateX(${shift}) scaleX(${sx})`;
      }
    }
    // A touch screen's pause button stands under the radar, where a menu at the left edge would cover it (the game's
    // only way to pause on an iPhone): the menus move right past it, or down if the screen has no room across.
    el.style.transform = '';
    const pause = document.documentElement.classList.contains('touch') ? this.element.ownerDocument.querySelector('.touch-top .pause')?.getBoundingClientRect() : undefined;
    if (pause?.width) {
      const parts = [...el.children].map(c => c.getBoundingClientRect()), origin = el.getBoundingClientRect();
      const menu = { left: Math.min(...parts.map(r => r.left)) - origin.left, top: Math.min(...parts.map(r => r.top)) - origin.top, right: Math.max(...parts.map(r => r.right)) - origin.left, bottom: Math.max(...parts.map(r => r.bottom)) - origin.top };
      const move = clearOf(menu, { left: pause.left - origin.left, top: pause.top - origin.top, right: pause.right - origin.left, bottom: pause.bottom - origin.top }, { width, height });
      if (move.x || move.y) el.style.transform = `translate(${move.x}px, ${move.y}px)`;
    }
  }
  /** CHud::DrawTripSkip: the skip icon (hud.txd skipicon) and its label (FEC_TSK) above the radar while
   * CGameLogic::SkipCanBeActivated holds. */
  skipIcon?: string;
  tripSkip(show: boolean, label = '') {
    const el = this.element.querySelector<HTMLElement>('.trip-skip')!;
    if (el.hidden === !show && (!show || el.querySelector('span')!.textContent === label)) return;
    el.hidden = !show;
    if (!show) return;
    const img = el.querySelector('img')!;
    if (this.skipIcon && img.getAttribute('src') !== this.skipIcon) img.src = this.skipIcon;
    img.hidden = !this.skipIcon;
    el.querySelector('span')!.textContent = label;
  }
    /** The front end's Brief page (FEH_BRI): the mission text shown lately, the oldest first and the newest at the
     * bottom, where the list opens. With none, the page and its button go. */
    setBriefs(lines: readonly string[], label: string) {
      const button = this.button('brief'), panel = this.element.querySelector<HTMLElement>('.brief-panel')!;
      panel.querySelector('ol')!.replaceChildren(...lines.map(line => { const item = document.createElement('li'); item.textContent = line; return item; }));
      button.textContent = label; button.hidden = !lines.length; if (!lines.length) { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); }
      if (!panel.hidden) panel.scrollTop = panel.scrollHeight;
    }
    menuMessage(text: string) { this.element.querySelector('.menu-message')!.textContent = text; }
  /** Whether a message the script put up is still on screen, which is what IS_MESSAGE_BEING_DISPLAYED asks:
   * CHud's big message, or the prompt line the text commands write. */
  get messageShowing(){return !!this.prompt.textContent||!this.element.querySelector<HTMLElement>('.big-message')!.hidden;}
  /** Last values written to the DOM, so a frame that changes nothing writes nothing. */
  private written=new Map<string,string>();
  private put(key:string,value:string,write:(value:string)=>void){if(this.written.get(key)!==value){this.written.set(key,value);write(value);}}
  private els?:{help:HTMLElement;stat:HTMLElement;health:HTMLElement;healthFill:HTMLElement;armour:HTMLElement;armourFill:HTMLElement;breath:HTMLElement;breathFill:HTMLElement};
  update(sim: Simulation, yaw: number, limits:{maxHealth:number;maxArmour:number}={maxHealth:100,maxArmour:100}) {
    const q=(selector:string)=>this.element.querySelector<HTMLElement>(selector)!;
    const e=this.els??=(()=>{const health=q('.health-bar'),armour=q('.armour-bar'),breath=q('.breath-bar');
      return {help:q('.help-box'),stat:q('.stat-update'),health,healthFill:health.querySelector<HTMLElement>('i')!,armour,armourFill:armour.querySelector<HTMLElement>('i')!,breath,breathFill:breath.querySelector<HTMLElement>('i')!};})();
    if(this.prompt.textContent&&this.messageClock()>this.messageUntil)this.prompt.textContent='';
    const now=this.messageClock();
    if(this.helpUntil&&now>this.helpUntil){this.helpUntil=0;e.help.hidden=true;}
    if(this.statUpdateUntil&&now>this.statUpdateUntil){this.statUpdateUntil=0;e.stat.hidden=true;}
    this.helpDrawn=!!this.helpUntil||!!this.statUpdateUntil;
    if(this.bigMessageUntil||this.bigSubtitleUntil)this.updateBigMessage(now);
    if(this.whiteMiddleUntil&&now>this.whiteMiddleUntil)this.whiteMiddleMessage('');
    // CHud::RenderHealthBar: under 10 health the bar blinks with bit 3 of CTimer::m_FrameCounter, which counts the
    // game's 30 fps frames (and stops while paused).
    const frame=Math.floor(now*30/1000)>>>0;
    this.put('health.now',String(Math.ceil(sim.player.health)),v=>e.health.setAttribute('aria-valuenow',v));
    this.put('health.max',String(Math.ceil(limits.maxHealth)),v=>e.health.setAttribute('aria-valuemax',v));
    this.put('health.width',`${healthBarWidth(limits.maxHealth)*78}px`,v=>{e.health.style.width=v;});
    this.put('health.fill',`${barFill(sim.player.health,limits.maxHealth)}%`,v=>{e.healthFill.style.width=v;});
    this.put('health.blink',healthBarHidden(sim.player.health,frame)?'hidden':'',v=>{e.healthFill.style.visibility=v;});
    // CHud::RenderArmorBar shows armour only above 1.
    this.put('armour.hidden',String(armourBarHidden(sim.player.armour)),v=>{e.armour.hidden=v==='true';});
    this.put('armour.now',String(Math.ceil(sim.player.armour)),v=>e.armour.setAttribute('aria-valuenow',v));
    this.put('armour.max',String(Math.ceil(limits.maxArmour)),v=>e.armour.setAttribute('aria-valuemax',v));
    this.put('armour.fill',`${barFill(sim.player.armour,limits.maxArmour)}%`,v=>{e.armourFill.style.width=v;});
    // CHud::RenderBreathBar: light blue, the armour bar's width, breath over lung capacity. Its caller is unreversed; the bar
    // shows while CJ is under the water or short of air.
    const capacity=100,under=sim.player.swimming&&(sim.player.swimState===3||sim.player.swimState===4);
    this.put('breath.hidden',String(!under&&sim.player.breath>=capacity),v=>{e.breath.hidden=v==='true';});
    this.put('breath.now',String(Math.ceil(sim.player.breath)),v=>e.breath.setAttribute('aria-valuenow',v));
    this.put('breath.fill',`${barFill(sim.player.breath,capacity)}%`,v=>{e.breathFill.style.width=v;});
    const minutes = Math.floor(sim.timeMinutes);
    this.put('clock',`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,v=>{this.clock.textContent=v;});
    const money=hudMoney(sim.money);
    this.put('money',money.text,v=>{this.money.textContent=v;});this.put('money.negative',String(money.negative),v=>this.money.classList.toggle('negative',v==='true'));
  }
}
