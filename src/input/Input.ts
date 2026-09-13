export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();
  lookX = 0;
  lookY = 0;
  private drag = false;
  private abort = new AbortController();
  constructor(readonly canvas: HTMLCanvasElement, readonly onPause: () => void) {
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).closest('input, select, button')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') { if (!e.repeat) onPause(); return; }
      if (!this.held.has(e.code)) this.pressed.add(e.code);
      this.held.add(e.code);
    }, options);
    window.addEventListener('keyup', e => this.held.delete(e.code), options);
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener('pointerdown', e => {
      if (e.button === 0) this.drag = true;
      if (e.button === 1) { e.preventDefault(); this.held.add('MouseMiddle'); }
      canvas.focus();
    }, options);
    window.addEventListener('pointerup', e => {
      if (e.button === 0) this.drag = false;
      if (e.button === 1) this.held.delete('MouseMiddle');
    }, options);
    window.addEventListener('pointercancel', () => this.clear(), options);
    canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); }, options);
    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas || this.drag) {
        this.lookX += e.movementX; this.lookY += e.movementY;
      }
    }, options);
    canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
  }
  down(code: string) { return this.held.has(code); }
  consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  axes() {
    return {
      x: Number(this.down('KeyD') || this.down('ArrowRight')) - Number(this.down('KeyA') || this.down('ArrowLeft')),
      y: Number(this.down('KeyW') || this.down('ArrowUp')) - Number(this.down('KeyS') || this.down('ArrowDown')),
    };
  }
  clear() { this.held.clear(); this.pressed.clear(); this.lookX = this.lookY = 0; this.drag = false; }
  dispose() { this.abort.abort(); }
}
