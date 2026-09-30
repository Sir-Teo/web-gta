const isModifierButton = (code: string) => code.startsWith('Alt') || code.startsWith('Control');
/** SA's PC controls hold Alt to walk and Ctrl to fire, as plain buttons. The browser reads them as modifiers: Alt alone
 * focuses its menu, and with the keys played beside them they go back a page (Alt+←), focus the address bar (Alt+D),
 * open the find bar (Ctrl+F), save or bookmark the page (Ctrl+S, Ctrl+D) or reload it (Ctrl+R), each taking the
 * keyboard, or the game, away mid-play. Ctrl+Shift combinations stay the browser's (developer tools). */
export function takesBrowserShortcut(e: { code: string; altKey: boolean; ctrlKey: boolean; shiftKey: boolean }) {
  return isModifierButton(e.code) || e.altKey || e.ctrlKey && !e.shiftKey;
}

export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();
  lookX = 0;
  lookY = 0;
  private drag = false;
  /** Left-button press point and time, to tell a click from a camera drag. */
  private press?: { x: number; y: number; at: number; moved: number };
  /** Bumped by every key, button, wheel or mouse movement: CPad's last-touched time. */
  touches = 0;
  /** Letter keys in press order, for CCheat::AddToCheatString. */
  onLetter?: (letter: string) => void;
  private abort = new AbortController();
  constructor(readonly canvas: HTMLCanvasElement, readonly onPause: () => void) {
    const options = { signal: this.abort.signal };
    for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'wheel'] as const) window.addEventListener(type, () => { this.touches++; }, { ...options, passive: true });
    window.addEventListener('keydown', e => {
      // Escape works from the menu's buttons too (a clicked button keeps the focus); a text field or list keeps its own.
      // A text field or an open list keeps its own Escape; a slider, checkbox or button does not use it.
      if (e.code === 'Escape') { if (!e.repeat && !(e.target as HTMLElement).closest('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]), select, textarea')) onPause(); return; }
      if ((e.target as HTMLElement).closest('input, select, button')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home'].includes(e.code) || takesBrowserShortcut(e)) e.preventDefault();
      // CCheat::DoCheats feeds every standard key just pressed to the cheat string: a digit, the space or a punctuation
      // key breaks a code being typed (it can match nothing itself).
      if (!this.held.has(e.code)) { this.pressed.add(e.code); if (/^Key[A-Z]$/.test(e.code)) this.onLetter?.(e.code.slice(3)); else if (/^Digit[0-9]$/.test(e.code)) this.onLetter?.(e.code.slice(5)); else if (e.code === 'Space' || /^(Minus|Equal|Comma|Period|Slash|Semicolon|Quote|Backquote|BracketLeft|BracketRight|Backslash)$/.test(e.code)) this.onLetter?.(' '); }
      this.held.add(e.code);
    }, options);
    window.addEventListener('keyup', e => {
      this.held.delete(e.code);
      // Releasing Alt alone shows or focuses the browser's menu bar.
      if (isModifierButton(e.code) && !(e.target as HTMLElement).closest('input, select, textarea, button')) e.preventDefault();
    }, options);
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener('mousedown', e => {
      if(e.button===0){this.drag=true;this.held.add('MouseFire');this.pressed.add('MouseFire');this.press={x:e.clientX,y:e.clientY,at:performance.now(),moved:0};}
      if(e.button===2){this.held.add('MouseAim');this.pressed.add('MouseAim');}
      if (e.button === 1) { e.preventDefault(); this.held.add('MouseMiddle'); }
      canvas.focus();
    }, options);
    window.addEventListener('mouseup', e => {
      if(e.button===0){
        this.drag=false;this.held.delete('MouseFire');
        // SA's left button fires. Without pointer lock it also drags the camera, so a
        // short, nearly still press is the attack.
        const p=this.press;this.press=undefined;
        if(p&&document.pointerLockElement!==canvas&&p.moved<6&&performance.now()-p.at<350)this.pressed.add('MouseClick');
      }
      if(e.button===2)this.held.delete('MouseAim');
      if (e.button === 1) this.held.delete('MouseMiddle');
    }, options);
    window.addEventListener('pointercancel', () => this.clear(), options);
    canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); }, options);
    window.addEventListener('mousemove', e => {
      if (this.press) this.press.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (document.pointerLockElement === canvas || this.drag || this.down('MouseAim')) {
        this.lookX += e.movementX; this.lookY += e.movementY;
      }
    }, options);
    // Only a vertical turn of the wheel is a weapon step; a sideways scroll (a trackpad, a tilt wheel) is not.
    canvas.addEventListener('wheel',e=>{e.preventDefault();if(e.deltaY!==0)this.pressed.add(e.deltaY>0?'WheelNext':'WheelPrevious');},{...options,passive:false});
    canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
  }
  /** A touch screen's analog stick, x right and y forward in -1..1; undefined while no thumb is on it. */
  stick?: { x: number; y: number };
  /** Holds a key or button from somewhere other than the keyboard and mouse (the touch controls), with its press. */
  hold(code: string) { if (!this.held.has(code)) this.pressed.add(code); this.held.add(code); this.touches++; }
  release(code: string) { this.held.delete(code); }
  /** A single press, as a key tapped and let go within the frame. */
  tap(code: string) { this.pressed.add(code); this.touches++; }
  down(code: string) { return this.held.has(code); }
  /** The left button held without dragging the camera (under 6 pixels moved): without pointer lock, the fire button. */
  stillHold() { const p = this.press; return this.held.has('MouseFire') && !!p && p.moved < 6; }
  consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  axes() {
    const stick = this.stick;
    // The touch stick reads like CPad's left stick: its deflection is the walk-to-run ratio, and a vehicle's
    // accelerate and brake buttons are the stick pushed forward or back.
    if (stick && Math.hypot(stick.x, stick.y) > .12) return { x: stick.x, y: stick.y, forward: stick.y > .3, back: stick.y < -.3 };
    const forward = this.down('KeyW') || this.down('ArrowUp'), back = this.down('KeyS') || this.down('ArrowDown');
    return {
      x: Number(this.down('KeyD') || this.down('ArrowRight')) - Number(this.down('KeyA') || this.down('ArrowLeft')),
      y: Number(forward) - Number(back),
      // The car's accelerate and brake buttons read apart (CPad::GetAccelerate / GetBrake): both can be held.
      forward, back,
    };
  }
  /** Forget presses nobody consumed (CPad's "just down" lasts one frame): a key pressed during a pause or menu does
   * not act when play resumes. Held keys stay held. */
  dropPresses() { this.pressed.clear(); }
  clear() { this.held.clear(); this.pressed.clear(); this.lookX = this.lookY = 0; this.drag = false; this.press = undefined; this.stick = undefined; }
  dispose() { this.abort.abort(); }
}
