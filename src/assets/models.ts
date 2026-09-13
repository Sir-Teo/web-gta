import type { ImgEntry } from './img';
import type { ModelTexture } from './modelTextures';
import { ModelPreview } from './ModelPreview';
import type { DffModel } from './dff';
import './workshop.css';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const preview = new ModelPreview(get('model-canvas')), input = get<HTMLInputElement>('model-file'), status = get('status');
let worker: Worker | null = null;
let archiveFile: File | null = null, archiveEntries: ImgEntry[] = [];
const archivedModels = get<HTMLSelectElement>('archive-models'), archivedTextures = get<HTMLSelectElement>('archive-textures');
function resetArchive() { archiveFile = null; archiveEntries = []; get('archive-browser').hidden = true; get<HTMLInputElement>('model-archive').value = ''; archivedModels.replaceChildren(); archivedTextures.replaceChildren(); }
function listArchive(kind: 'model' | 'texture', selected?: number) {
  const select = kind === 'model' ? archivedModels : archivedTextures;
  const query = get<HTMLInputElement>(kind === 'model' ? 'model-search' : 'dictionary-search').value.toLowerCase();
  const extension = kind === 'model' ? '.dff' : '.txd';
  const matches = archiveEntries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.name.toLowerCase().endsWith(extension) && entry.name.toLowerCase().includes(query));
  const visible = matches.slice(0, 200), chosen = matches.find(e => e.index === selected);
  if (chosen && !visible.includes(chosen)) visible.push(chosen);
  select.replaceChildren(...(kind === 'texture' ? [new Option('No archive dictionary', '-1')] : []), ...visible.map(({ entry, index }) => new Option(entry.name, String(index))));
  if (selected !== undefined && visible.some(e => e.index === selected)) select.value = String(selected);
  else select.selectedIndex = select.options.length ? 0 : -1;
  get<HTMLButtonElement>('load-archive-model').disabled = archivedModels.selectedIndex < 0;
}
function suggestDictionary() {
  const entry = archivedModels.selectedIndex >= 0 ? archiveEntries[Number(archivedModels.value)] : undefined;
  const index = entry ? archiveEntries.findIndex(e => e.name.toLowerCase() === entry.name.toLowerCase().replace(/\.dff$/, '.txd')) : -1;
  get<HTMLInputElement>('dictionary-search').value = ''; listArchive('texture', index);
  get('dictionary-hint').textContent = !entry ? 'No matching models. Change the search or open another archive.' : index >= 0 ? 'A dictionary with the same filename is selected. Change it if this model uses another dictionary.' : 'No same-name dictionary found. Select the model’s dictionary or add a separate TXD file.';
}
function clear() { worker?.terminate(); worker = null; preview.clear(); get('summary').textContent = get('warnings').textContent = get('metadata').textContent = ''; get<HTMLInputElement>('night').value = '0'; }
function load() {
  const entry = archiveFile && archivedModels.selectedIndex >= 0 ? archiveEntries[Number(archivedModels.value)] : undefined;
  const file = archiveFile ?? input.files?.[0]; if (!file || archiveFile && !entry) return;
  const name = entry ? `${archiveFile!.name} / ${entry.name}` : file.name; clear(); get<HTMLInputElement>('texture-file').disabled = false; status.textContent = `Reading ${name} locally…`;
  const current = worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  current.onmessage = ({ data }) => {
    if (worker !== current) return;
    current.terminate(); worker = null;
    if (data.error) { status.textContent = data.error; return; }
    const model: DffModel = data.model;
    const decoded: ModelTexture[] = data.textures;
    try { preview.load(model, decoded); } catch (error) { preview.clear(); status.textContent = error instanceof Error ? error.message : 'Model preview failed.'; return; }
    status.textContent = `${name} loaded locally.`;
    const vertices = model.geometries.reduce((n, g) => n + g.positions.length / 3, 0), faces = model.geometries.reduce((n, g) => n + g.indices.length / 3, 0);
    get('summary').textContent = `${model.frames.length} frames · ${model.atomics.length} atomics · ${vertices} source vertices · ${faces} source triangles`;
    const bound = new Set(decoded.map(t => t.name.toLowerCase()));
    const textures = [...new Set(model.geometries.flatMap(g => g.materials.map(m => m.texture).filter(n => n && !bound.has(n.toLowerCase()))))];
    get('summary').textContent += ` · ${decoded.length} textures bound`;
    get('warnings').textContent = [...model.warnings, ...decoded.filter(t => t.filter < 1 || t.filter > 6).map(t => `${t.name}: unknown filter previews as linear.`), ...decoded.filter(t => t.addressU === 4 || t.addressV === 4).map(t => `${t.name}: border addressing previews as edge clamp.`), ...(textures.length ? [`Unbound textures: ${textures.join(', ')}`] : [])].join('\n');
    get('metadata').textContent = model.frames.map((f, i) => `${i}: ${f.name} · parent ${f.parent}`).join('\n') + '\n\n' + model.geometries.map((g, i) => `Geometry ${i}: ${g.uvs.length} UV layers · ${g.nightColors ? 'day/night' : 'day'} colors\n${g.materials.map((m, j) => `  Material ${j}: RGBA ${m.color.join('/')} · ${m.texture || 'untextured'}`).join('\n')}`).join('\n');
  };
  current.onerror = () => { if (worker === current) { current.terminate(); worker = null; status.textContent = 'The model worker failed. Select the file again to retry.'; } };
  current.postMessage({ file, entry, textureEntry: archiveFile && archivedTextures.value !== '-1' ? archiveEntries[Number(archivedTextures.value)] : undefined, textureFile: get<HTMLInputElement>('texture-file').files?.[0] });
}
input.onchange = () => { resetArchive(); load(); };
get<HTMLInputElement>('model-archive').onchange = () => {
  const file = get<HTMLInputElement>('model-archive').files?.[0]; if (!file) return;
  clear(); archiveFile = file; archiveEntries = []; input.value = ''; get<HTMLInputElement>('texture-file').value = ''; get<HTMLInputElement>('texture-file').disabled = true;
  get('archive-browser').hidden = true; get<HTMLInputElement>('model-search').value = ''; get<HTMLInputElement>('dictionary-search').value = '';
  status.textContent = `Reading ${file.name} directory locally…`;
  const current = worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  current.onmessage = ({ data }) => {
    if (worker !== current) return; current.terminate(); worker = null;
    if (data.error) { status.textContent = data.error; return; }
    archiveEntries = data.entries; get('archive-browser').hidden = false; listArchive('model'); suggestDictionary();
    const models = archiveEntries.filter(e => e.name.toLowerCase().endsWith('.dff')).length;
    const dictionaries = archiveEntries.filter(e => e.name.toLowerCase().endsWith('.txd')).length;
    get('archive-count').textContent = `${models} models · ${dictionaries} texture dictionaries · ${archiveEntries.length} total entries`;
    get<HTMLInputElement>('texture-file').disabled = models === 0;
    status.textContent = `${file.name} directory loaded. Choose a model to preview.`;
  };
  current.onerror = () => { if (worker === current) { current.terminate(); worker = null; status.textContent = 'The archive reader failed. Select the file again to retry.'; } };
  current.postMessage({ action: 'index', file });
};
get<HTMLInputElement>('model-search').oninput = () => { listArchive('model'); suggestDictionary(); };
get<HTMLInputElement>('dictionary-search').oninput = () => listArchive('texture');
archivedModels.onchange = suggestDictionary;
get('load-archive-model').onclick = load;
get<HTMLInputElement>('texture-file').onchange = load;
get('remove-textures').onclick = () => { get<HTMLInputElement>('texture-file').value = ''; archivedTextures.value = '-1'; load(); };
get('clear').onclick = () => { clear(); resetArchive(); input.value = ''; get<HTMLInputElement>('texture-file').value = ''; get<HTMLInputElement>('texture-file').disabled = true; status.textContent = 'Local model cleared.'; };
get('frame').onclick = () => preview.frame();
get<HTMLInputElement>('night').oninput = event => preview.night(Number((event.target as HTMLInputElement).value));
window.addEventListener('pagehide', () => { worker?.terminate(); preview.dispose(); });

if (import.meta.env.DEV) Object.assign(window, { __modelPreview: { state: () => preview.snapshot() } });
