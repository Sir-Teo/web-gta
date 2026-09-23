import type { AudioSettings } from '../audio/settings';
import {healthBarHidden,armourBarHidden,hudMoney,healthBarWidth,barFill} from './nativeHudBars';
import { NativeHudNames } from './nativeHudNames';
import type { Simulation } from '../simulation/Simulation';

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
  drawNames(dtMs:number,paused=false,inVehicle=false,areaNameOff=false,widescreen=false){
    this.inVehicle=inVehicle;
    const radio=this.element.querySelector<HTMLElement>('.radio-name')!;
    if(!paused){if(!widescreen&&inVehicle&&this.radioPending){this.radioPending=false;this.radioLeftMs=2500;}else this.radioLeftMs=Math.max(0,this.radioLeftMs-dtMs);}
    radio.hidden=!inVehicle||paused||widescreen||this.radioLeftMs<=0;
    if(paused)return;
    const out=this.names.update(dtMs,{message:!!this.prompt.textContent,bigMessage:this.element.classList.contains('white-middle'),areaNameOff});
    for(const [selector,name] of [['.location',out.zone],['.vehicle-name',out.vehicle]] as const){
      const el=this.element.querySelector<HTMLElement>(selector)!;el.hidden=!name;
      if(name){if(el.textContent!==name.text)el.textContent=name.text;el.style.opacity=String(name.alpha/255);}
    }
  }
  /** CHud::DrawAmmo's text, or undefined when it draws nothing. */
  ammo(text:string|undefined){this.ammoText.hidden=text===undefined;if(text!==undefined&&this.ammoText.textContent!==text)this.ammoText.textContent=text;}
  /** hud.txd's fist raster (SPRITE_FIST), which CHud::DrawWeaponIcon draws for an unarmed ped; the drawn fist stands in
   * until it loads. */
  fistIcon?:string;
  weapon(name:string,icon:string|undefined,unarmed:boolean){
    const shown=unarmed?this.fistIcon:icon,fist=this.element.querySelector<SVGElement>('svg.weapon')!;
    fist.style.display=unarmed&&!this.fistIcon?'':'none';this.weaponIcon.hidden=!shown;
    if(shown&&this.weaponIcon.src!==shown)this.weaponIcon.src=shown;this.weaponIcon.alt=name;
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

      <div class="widescreen-border top" aria-hidden="true" hidden></div><div class="widescreen-border bottom" aria-hidden="true" hidden></div>
      <div class="screen-fade" aria-hidden="true"></div>
      <div class="big-message" role="status" aria-live="polite" hidden><b></b><span></span></div>
      <div class="white-middle-message" role="status" aria-live="assertive" hidden></div>
      <div class="location" hidden></div>
      <div class="vehicle-name" hidden></div>
      <div class="radio-name" hidden></div>
      <div class="prompt" role="status" aria-live="polite"></div>
      <div class="onboarding"><span>W A S D</span> move <b>·</b> <span>SHIFT</span> sprint <b>·</b> <span>SPACE</span> jump <b>·</b> <span>C</span> crouch <b>·</b> drag to look <b>·</b> <span>TAB</span> arsenal <b>·</b> <span>F</span> enter car <b>·</b> <span>M</span> map</div>
      <div class="menu-backdrop"><section class="menu" aria-label="Game menu">
        <p class="setting">San Andreas</p><h1>San Andreas</h1><p class="menu-location">San Andreas</p>
        <div class="menu-actions"><button id="play" disabled>Loading the native world…</button><button id="controls">Controls</button><button id="audio">Audio</button><button id="lighting">Lighting</button></div>
        <div class="controls-panel" hidden><p><b>On foot</b> W A S D · Move &nbsp; Shift · Sprint &nbsp; Space · Jump &nbsp; C · Crouch / Stand &nbsp; R · Punch / Reload &nbsp; Ctrl · Fire / Use &nbsp; Right mouse · Aim &nbsp; Left mouse while aiming · Fire &nbsp; Wheel · Switch weapon &nbsp; Tab · Arsenal</p><p><b>Vehicles</b> F · Enter / Exit nearest car &nbsp; W/S · Accelerate / Brake / Reverse &nbsp; A/D · Steer &nbsp; Space · Handbrake</p><p><b>Boats</b> F · Board / Leave nearest runabout (leaving needs shallow water) &nbsp; W/S · Throttle / Reverse &nbsp; A/D · Steer &nbsp; Space · Brake &nbsp; Ctrl · Drive-by</p><p><b>Aircraft</b> W/S · Throttle &nbsp; ↓/↑ · Nose up/down &nbsp; A/D · Bank &nbsp; Q/E · Rudder &nbsp; G · Retractable gear &nbsp; T · Hydra hover/forward mode &nbsp; Ctrl · Mounted guns &nbsp; B · Rockets &nbsp; Space · Helicopter hover &nbsp; Space · Ground brake &nbsp; F · Exit after landing and stopping. Choose an aircraft from the full map to fly from Verdant Meadows.</p><p><b>Map</b> M · Full map &nbsp; Click map · Waypoint</p><p><b>Camera</b> V / Home · Camera distance &nbsp; Drag mouse · Look &nbsp; Middle mouse / Numpad 1 · Look behind &nbsp; L · Lock pointer &nbsp; Escape · Pause</p></div>
        <div class="audio-panel" hidden aria-label="Audio settings">
          <label for="audio-master">Master volume <output id="value-master"></output></label><input id="audio-master" type="range" min="0" max="100" step="1">
          <label for="audio-effects">Sound effects <output id="value-effects"></output></label><input id="audio-effects" type="range" min="0" max="100" step="1">
          <label class="mute"><input id="audio-muted" type="checkbox"> Mute all sound</label>
          <label class="mute"><input id="display-frame-limiter" type="checkbox"> Frame limiter (30 frames a second, as the PC original)</label>
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
  /** The frame limiter checkbox (FrontEndMenuManager.m_bPrefsFrameLimiter). */
  bindDisplay(settings: { frameLimiter: boolean }, update: (settings: { frameLimiter: boolean }) => void) {
    const limiter = this.element.querySelector<HTMLInputElement>('#display-frame-limiter')!;
    limiter.checked = settings.frameLimiter; limiter.onchange = () => update({ frameLimiter: limiter.checked });
  }
  audioStatus(state: { unavailable: boolean; failed: number; loaded: boolean }) {
    this.element.querySelector('#audio-status')!.textContent = state.unavailable ? 'Sound is unavailable in this browser.' : state.failed ? 'Some sounds could not load. Gameplay remains available.' : state.loaded ? '' : 'Sounds load when you begin playing.';
  }
  button(id: string) { return this.element.querySelector<HTMLButtonElement>(`#${id}`)!; }
  setMenu(open: boolean) { this.menu.hidden = !open; this.element.classList.toggle('paused', open); }
  message(text: string, milliseconds = 3000) { this.prompt.textContent = text; this.messageUntil = performance.now() + milliseconds; }
  /** DO_FADE: `out` fades the screen to the fading colour over `milliseconds`, otherwise back to the game. */
  /** CCamera::DrawBordersForWideScreen: black bars to GetScreenRect's top and bottom while widescreen is on. */
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
  }
  /** CMessages::AddBigMessageQ: the middle style used for stunt bonuses, with its reward line below. */
  bigMessage(title: string, subtitle = '', milliseconds = 5000) {
    const big = this.element.querySelector<HTMLElement>('.big-message')!;
    big.querySelector('b')!.textContent = title; big.querySelector('span')!.textContent = subtitle;
    big.hidden = false; this.bigMessageUntil = performance.now() + milliseconds;
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
    this.whiteMiddleUntil = text ? performance.now() + milliseconds : 0;
    if (text) {
      const width = this.element.clientWidth || innerWidth, height = this.element.clientHeight || innerHeight;
      // The gothic sprite glyphs fill most of their 32-texel cell; the web font's capitals fill about 0.65 em.
      el.style.fontSize = `${1.25 * 16 * 2.1 * height / 448}px`;
      el.style.transform = `translate(-50%, -100%) scaleX(${(width / 640) / (height / 448)})`;
      void el.offsetWidth; el.style.transition = 'opacity 638ms linear'; el.style.opacity = '1';
    }
  }
  menuMessage(text: string) { this.element.querySelector('.menu-message')!.textContent = text; }
  /** Whether a message the script put up is still on screen, which is what IS_MESSAGE_BEING_DISPLAYED asks:
   * CHud's big message, or the prompt line the text commands write. */
  get messageShowing(){return !!this.prompt.textContent||!this.element.querySelector<HTMLElement>('.big-message')!.hidden;}
  private frame=0;
  update(sim: Simulation, yaw: number, limits:{maxHealth:number;maxArmour:number}={maxHealth:100,maxArmour:100}) {
    const health = this.element.querySelector<HTMLElement>('.health-bar')!;
    if(performance.now()>this.messageUntil)this.prompt.textContent='';
    if(performance.now()>this.bigMessageUntil)this.element.querySelector<HTMLElement>('.big-message')!.hidden=true;
    if(this.whiteMiddleUntil&&performance.now()>this.whiteMiddleUntil)this.whiteMiddleMessage('');
    health.setAttribute('aria-valuenow', String(Math.ceil(sim.player.health)));
    // CHud::RenderHealthBar: under 10 health the bar blinks every eight frames.
    this.frame=(this.frame+1)>>>0;const fill=health.querySelector<HTMLElement>('i')!;health.style.width=`${healthBarWidth(limits.maxHealth)*78}px`;fill.style.width = `${barFill(sim.player.health,limits.maxHealth)}%`;fill.style.visibility=healthBarHidden(sim.player.health,this.frame)?'hidden':'';
    // CHud::RenderArmorBar shows armour only above 1.
    const armour = this.element.querySelector<HTMLElement>('.armour-bar')!;armour.hidden = armourBarHidden(sim.player.armour);armour.setAttribute('aria-valuenow', String(Math.ceil(sim.player.armour)));armour.querySelector<HTMLElement>('i')!.style.width = `${barFill(sim.player.armour,limits.maxArmour)}%`;
    // CHud::RenderBreathBar: light blue, the armour bar's width, breath over lung capacity. Its caller is unreversed; the bar
    // shows while CJ is under the water or short of air.
    const breath=this.element.querySelector<HTMLElement>('.breath-bar')!,capacity=100,under=sim.player.swimming&&(sim.player.swimState===3||sim.player.swimState===4);
    breath.hidden=!under&&sim.player.breath>=capacity;breath.setAttribute('aria-valuenow',String(Math.ceil(sim.player.breath)));breath.querySelector<HTMLElement>('i')!.style.width=`${barFill(sim.player.breath,capacity)}%`;
    const minutes = Math.floor(sim.timeMinutes);
    this.clock.textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const money=hudMoney(sim.money);this.money.textContent=money.text;this.money.classList.toggle('negative',money.negative);
  }
}
