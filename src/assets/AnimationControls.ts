import type { AnimationPackage } from './ifp';
import type { ModelPreview } from './ModelPreview';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export class AnimationControls {
  private file = get<HTMLInputElement>('animation-file');
  private select = get<HTMLSelectElement>('animation-clip');
  private play = get<HTMLButtonElement>('animation-play');
  private restore = get<HTMLButtonElement>('animation-restore');
  private time = get<HTMLInputElement>('animation-time');
  private clock = get('animation-clock');
  private status = get('animation-status');
  private worker?: Worker;
  private package?: AnimationPackage;
  private frame = 0;
  private previous = 0;
  private seconds = 0;
  private duration = 0;
  private playing = false;
  constructor(private preview: ModelPreview) {
    this.file.onchange = () => this.load();
    this.select.onchange = () => this.bind();
    this.time.oninput = () => { this.pause(); this.seconds = Number(this.time.value); preview.sampleAnimation(this.seconds); this.display(); };
    this.play.onclick = () => {
      if (this.playing) this.pause();
      else { this.playing = true; this.previous = performance.now(); this.play.textContent = 'Pause animation'; this.frame = requestAnimationFrame(this.tick); }
    };
    this.restore.onclick = () => { this.pause(); preview.restoreAnimation(); this.play.disabled = this.time.disabled = true; this.seconds = 0; this.display(); this.select.value = ''; this.status.textContent = 'Bind pose restored. Select a clip to inspect it again.'; };
    document.addEventListener('visibilitychange', this.visibility);
  }
  reset(enabled = false) {
    this.pause(); this.worker?.terminate(); this.worker = undefined; this.package = undefined;
    this.file.value = ''; this.file.disabled = !enabled; this.select.replaceChildren(); this.select.disabled = true;
    this.play.disabled = this.restore.disabled = this.time.disabled = true; this.seconds = this.duration = 0; this.time.max = '0'; this.display();
    this.status.textContent = enabled ? 'Choose a local IFP package for this model.' : 'Load one unplaced model to inspect local animation clips.';
  }
  private pause() { this.playing = false; cancelAnimationFrame(this.frame); this.play.textContent = 'Play animation'; }
  private visibility = () => { if (document.hidden) this.pause(); };
  private display() { this.time.value = String(this.seconds); this.clock.textContent = `${this.seconds.toFixed(3)} / ${this.duration.toFixed(3)} s`; }
  private tick = (now: number) => {
    if (!this.playing) return;
    this.seconds = this.duration > 0 ? (this.seconds + Math.min((now - this.previous) / 1000, .1)) % this.duration : 0;
    this.previous = now; this.preview.sampleAnimation(this.seconds); this.display(); this.frame = requestAnimationFrame(this.tick);
  };
  private bind() {
    this.pause(); this.play.disabled = this.time.disabled = true;
    const clip = this.package?.animations[Number(this.select.value)]; if (!clip) return;
    try {
      const result = this.preview.loadAnimation(clip); this.seconds = 0; this.duration = result.duration; this.time.max = String(result.duration); this.display();
      this.play.disabled = this.time.disabled = result.duration <= 0; this.restore.disabled = false;
      this.status.textContent = `${clip.name}: ${result.trackCount} tracks bound. Source-space clip preview; gameplay blending is not applied.`;
    } catch (error) { this.status.textContent = error instanceof Error ? error.message : 'Animation binding failed.'; }
  }
  private load() {
    const file = this.file.files?.[0]; if (!file) return;
    this.pause(); this.preview.restoreAnimation(); this.worker?.terminate(); this.package = undefined;
    this.select.replaceChildren(); this.select.disabled = this.play.disabled = this.restore.disabled = this.time.disabled = true;
    this.seconds = this.duration = 0; this.time.max = '0'; this.display();
    this.status.textContent = `Reading ${file.name} locally…`;
    const worker = this.worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return; worker.terminate(); this.worker = undefined;
      if (data.error) { this.status.textContent = data.error; return; }
      this.package = data.animation;
      this.select.replaceChildren(...this.package!.animations.map((clip, i) => new Option(clip.name, String(i))));
      this.select.disabled = !this.package!.animations.length;
      if (!this.select.disabled) this.bind(); else this.status.textContent = 'This package has no animation clips.';
    };
    worker.onerror = () => { if (this.worker !== worker) return; worker.terminate(); this.worker = undefined; this.status.textContent = 'Animation worker failed. Select the file again to retry.'; };
    worker.postMessage({ action: 'animation', file });
  }
  dispose() { this.reset(); document.removeEventListener('visibilitychange', this.visibility); }
}
