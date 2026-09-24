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
      if ((e.target as HTMLElement).closest('input, select, button')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') { if (!e.repeat) onPause(); return; }
      if (!this.held.has(e.code)) { this.pressed.add(e.code); if (/^Key[A-Z]$/.test(e.code)) this.onLetter?.(e.code.slice(3)); }
      this.held.add(e.code);
    }, options);
    window.addEventListener('keyup', e => this.held.delete(e.code), options);
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
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.pressed.add(e.deltaY>0?'WheelNext':'WheelPrevious');},{...options,passive:false});
    canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
  }
  down(code: string) { return this.held.has(code); }
  consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  axes() {
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
  clear() { this.held.clear(); this.pressed.clear(); this.lookX = this.lookY = 0; this.drag = false; this.press = undefined; }
  dispose() { this.abort.abort(); }
}
