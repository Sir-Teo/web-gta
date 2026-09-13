import type { ModelTexture } from './modelTextures';
import { ModelPreview } from './ModelPreview';
import type { DffModel } from './dff';
import './workshop.css';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const preview = new ModelPreview(get('model-canvas')), input = get<HTMLInputElement>('model-file'), status = get('status');
let worker: Worker | null = null;
function clear() { worker?.terminate(); worker = null; preview.clear(); get('summary').textContent = get('warnings').textContent = get('metadata').textContent = ''; get<HTMLInputElement>('night').value = '0'; }
function load() {
  const file = input.files?.[0]; if (!file) return; clear(); get<HTMLInputElement>('texture-file').disabled = false; status.textContent = `Reading ${file.name} locally…`;
  const current = worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  current.onmessage = ({ data }) => {
    if (worker !== current) return;
    current.terminate(); worker = null;
    if (data.error) { status.textContent = data.error; return; }
    const model: DffModel = data.model;
    const decoded: ModelTexture[] = data.textures;
    try { preview.load(model, decoded); } catch (error) { preview.clear(); status.textContent = error instanceof Error ? error.message : 'Model preview failed.'; return; }
    status.textContent = `${file.name} loaded locally.`;
    const vertices = model.geometries.reduce((n, g) => n + g.positions.length / 3, 0), faces = model.geometries.reduce((n, g) => n + g.indices.length / 3, 0);
    get('summary').textContent = `${model.frames.length} frames · ${model.atomics.length} atomics · ${vertices} source vertices · ${faces} source triangles`;
    const bound = new Set(decoded.map(t => t.name.toLowerCase()));
    const textures = [...new Set(model.geometries.flatMap(g => g.materials.map(m => m.texture).filter(n => n && !bound.has(n.toLowerCase()))))];
    get('summary').textContent += ` · ${decoded.length} textures bound`;
    get('warnings').textContent = [...model.warnings, ...decoded.filter(t => t.filter < 1 || t.filter > 6).map(t => `${t.name}: unknown filter previews as linear.`), ...decoded.filter(t => t.addressU === 4 || t.addressV === 4).map(t => `${t.name}: border addressing previews as edge clamp.`), ...(textures.length ? [`Unbound textures: ${textures.join(', ')}`] : [])].join('\n');
    get('metadata').textContent = model.frames.map((f, i) => `${i}: ${f.name} · parent ${f.parent}`).join('\n') + '\n\n' + model.geometries.map((g, i) => `Geometry ${i}: ${g.uvs.length} UV layers · ${g.nightColors ? 'day/night' : 'day'} colors\n${g.materials.map((m, j) => `  Material ${j}: RGBA ${m.color.join('/')} · ${m.texture || 'untextured'}`).join('\n')}`).join('\n');
  };
  current.onerror = () => { if (worker === current) { current.terminate(); worker = null; status.textContent = 'The model worker failed. Select the file again to retry.'; } };
  current.postMessage({ file, textureFile: get<HTMLInputElement>('texture-file').files?.[0] });
}
input.onchange = load;
get<HTMLInputElement>('texture-file').onchange = load;
get('remove-textures').onclick = () => { get<HTMLInputElement>('texture-file').value = ''; load(); };
get('clear').onclick = () => { clear(); input.value = ''; get<HTMLInputElement>('texture-file').value = ''; get<HTMLInputElement>('texture-file').disabled = true; status.textContent = 'Local model cleared.'; };
get('frame').onclick = () => preview.frame();
get<HTMLInputElement>('night').oninput = event => preview.night(Number((event.target as HTMLInputElement).value));
window.addEventListener('pagehide', () => { worker?.terminate(); preview.dispose(); });

if (import.meta.env.DEV) Object.assign(window, { __modelPreview: { state: () => preview.snapshot() } });
