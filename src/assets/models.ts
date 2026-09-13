import { planSceneCollision } from './sceneCollision';
import { AnimationControls } from './AnimationControls';
import type { IdeAssociation } from './ide';
import type { ImgEntry } from './img';
import type { ModelTexture } from './modelTextures';
import { ModelPreview } from './ModelPreview';
import type { DffModel } from './dff';
import './workshop.css';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const preview = new ModelPreview(get('model-canvas')), input = get<HTMLInputElement>('model-file'), status = get('status');
const animationControls = new AnimationControls(preview);
let sceneActive = false, scenePending = false;
let assembledParts: import('./scene').ScenePart[] | undefined;
let walkChannel: BroadcastChannel | undefined;
let worker: Worker | null = null, ideWorker: Worker | null = null;
let associations = new Map<string, IdeAssociation>(), parents = new Map<string, string>();
let archiveFile: File | null = null, archiveEntries: ImgEntry[] = [];
const archivedModels = get<HTMLSelectElement>('archive-models'), archivedTextures = get<HTMLSelectElement>('archive-textures');
function selectedArchiveEntry(kind: 'placement' | 'collision' = 'placement') {
  const value = get<HTMLSelectElement>(kind === 'placement' ? 'archive-placements' : 'archive-collisions').value;
  return archiveFile && value !== '' && value !== '-1' ? archiveEntries[Number(value)] : undefined;
}
function listAuxiliaryEntries(kind: 'placement' | 'collision' = 'placement') {
  const query = get<HTMLInputElement>(`${kind}-search`).value.toLowerCase(), select = get<HTMLSelectElement>(kind === 'placement' ? 'archive-placements' : 'archive-collisions');
  const prior = select.value, extension = kind === 'placement' ? '.ipl' : '.col';
  const matches = archiveEntries.map((entry, index) => ({ entry, index })).filter(e => e.entry.name.toLowerCase().endsWith(extension) && e.entry.name.toLowerCase().includes(query)).slice(0, 200);
  select.replaceChildren(new Option(kind === 'placement' ? 'No archive placements' : 'No archive collision', '-1'), ...matches.map(e => new Option(e.entry.name, String(e.index))));
  select.value = matches.some(e => String(e.index) === prior) ? prior : '-1';
}
function resetCollisionPicker() { get('collision-archive-browser').hidden = true; get<HTMLSelectElement>('archive-collisions').replaceChildren(); get<HTMLInputElement>('collision-search').value = ''; }
function resetArchive() { resetCollisionPicker(); get('placement-archive-browser').hidden = true; get<HTMLSelectElement>('archive-placements').replaceChildren(); archiveFile = null; archiveEntries = []; get('archive-browser').hidden = true; get<HTMLInputElement>('model-archive').value = ''; archivedModels.replaceChildren(); archivedTextures.replaceChildren(); }
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
  const association = entry ? associations.get(entry.name.toLowerCase().replace(/\.dff$/, '')) : undefined;
  const dictionary = association ? `${association.dictionary}.txd` : entry?.name.replace(/\.dff$/i, '.txd');
  const index = dictionary ? archiveEntries.findIndex(e => e.name.toLowerCase() === dictionary.toLowerCase()) : -1;
  get<HTMLInputElement>('dictionary-search').value = ''; listArchive('texture', index);
  get('dictionary-hint').textContent = !entry ? 'No matching models. Change the search or open another archive.' : association ? (index >= 0 ? `IDE model ${association.id} selects ${dictionary}.` : `IDE model ${association.id} requires ${dictionary}, which is absent from this archive. Add a separate TXD file.`) : index >= 0 ? 'A dictionary with the same filename is selected. Change it if this model uses another dictionary.' : 'No same-name dictionary found. Select the model’s dictionary or add a separate TXD file.';
}
function clear() { animationControls.reset(); assembledParts = undefined; get<HTMLButtonElement>('walk-scene').disabled = true; walkChannel?.close(); sceneActive = scenePending = false; worker?.terminate(); worker = null; preview.clear(); get('summary').textContent = get('warnings').textContent = get('metadata').textContent = ''; get<HTMLInputElement>('night').value = '0'; }
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
    try { preview.load(model, decoded, data.placements, data.collision); } catch (error) { preview.clear(); status.textContent = error instanceof Error ? error.message : 'Model preview failed.'; return; }
    animationControls.reset(!data.placements);
    status.textContent = `${name} loaded locally.`;
    const vertices = model.geometries.reduce((n, g) => n + g.positions.length / 3, 0), faces = model.geometries.reduce((n, g) => n + g.indices.length / 3, 0);
    get('summary').textContent = `${model.frames.length} frames · ${model.atomics.length} atomics · ${vertices} source vertices · ${faces} source triangles`;
    const bound = new Set(decoded.map(t => t.name.toLowerCase()));
    const textures = [...new Set(model.geometries.flatMap(g => g.materials.map(m => m.texture).filter(n => n && !bound.has(n.toLowerCase()))))];
    const skins = model.geometries.filter(g => g.skin).length;
    if (skins) get('summary').textContent += ` · ${skins} skinned geometries`;
    get('summary').textContent += ` · ${decoded.length} textures bound` + (data.placements ? ` · ${data.placements.length} placements` : '');
    get('warnings').textContent = [...model.warnings, ...(data.notices ?? []), ...decoded.filter(t => t.filter < 1 || t.filter > 6).map(t => `${t.name}: unknown filter previews as linear.`), ...decoded.filter(t => t.addressU === 4 || t.addressV === 4).map(t => `${t.name}: border addressing previews as edge clamp.`), ...(textures.length ? [`Unbound textures: ${textures.join(', ')}`] : [])].join('\n');
    get('metadata').textContent = (data.collisionSource ? `Collision source: ${data.collisionSource}\n` : '') + (data.placementSource ? `Placement source: ${data.placementSource}\n` : '') + (data.placements ? data.placements.map((p: import('./ipl').IplInstance, i: number) => `Placement ${i}: model ${p.modelId} · interior ${p.interior} · flags ${p.instanceType} · LOD ${p.lodIndex} · position ${p.position.join('/')} · quaternion ${p.rotation.join('/')}`).join('\n') + '\n\n' : '') + `Dictionary lookup: ${(data.dictionaryNames ?? []).join(' → ') || 'none'}\n\n` + model.frames.map((f, i) => `${i}: ${f.name} · parent ${f.parent}`).join('\n') + '\n\n' + model.geometries.map((g, i) => `Geometry ${i}: ${g.uvs.length} UV layers · ${g.nightColors ? 'day/night' : 'day'} colors\n${g.materials.map((m, j) => `  Material ${j}: RGBA ${m.color.join('/')} · ${m.texture || 'untextured'}`).join('\n')}`).join('\n');
  };
  current.onerror = () => { if (worker === current) { current.terminate(); worker = null; status.textContent = 'The model worker failed. Select the file again to retry.'; } };
  current.postMessage({ file, entry, collisionEntry: selectedArchiveEntry('collision'), collisionFile: get<HTMLInputElement>('collision-file').files?.[0], placementEntry: selectedArchiveEntry(), placementFile: get<HTMLInputElement>('placement-file').files?.[0], interior: Number(get<HTMLInputElement>('placement-interior').value), modelId: associations.get((entry?.name ?? file.name).replace(/\.dff$/i, '').toLowerCase())?.id, parents: [...parents], textureEntry: archiveFile && archivedTextures.value !== '-1' ? archiveEntries[Number(archivedTextures.value)] : undefined, textureFile: get<HTMLInputElement>('texture-file').files?.[0] });
}
input.onchange = () => { resetArchive(); load(); };
get<HTMLInputElement>('model-archive').onchange = () => {
  const file = get<HTMLInputElement>('model-archive').files?.[0]; if (!file) return;
  clear(); resetCollisionPicker(); get('placement-archive-browser').hidden = true; get<HTMLSelectElement>('archive-placements').replaceChildren(); archiveFile = file; archiveEntries = []; input.value = ''; get<HTMLInputElement>('texture-file').value = ''; get<HTMLInputElement>('texture-file').disabled = true;
  get('archive-browser').hidden = true; get<HTMLInputElement>('model-search').value = ''; get<HTMLInputElement>('dictionary-search').value = '';
  status.textContent = `Reading ${file.name} directory locally…`;
  const current = worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  current.onmessage = ({ data }) => {
    if (worker !== current) return; current.terminate(); worker = null; scenePending = false;
    if (data.error) { status.textContent = data.error; return; }
    get<HTMLInputElement>('placement-search').value = ''; get<HTMLSelectElement>('archive-placements').replaceChildren();
    archiveEntries = data.entries; get('collision-archive-browser').hidden = false; listAuxiliaryEntries('collision'); get('placement-archive-browser').hidden = false; listAuxiliaryEntries(); get('archive-browser').hidden = false; listArchive('model'); suggestDictionary();
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
get('clear').onclick = () => { get<HTMLInputElement>('collision-file').value = ''; get<HTMLInputElement>('placement-file').value = ''; get<HTMLInputElement>('static-placement-file').value = ''; get<HTMLInputElement>('placement-interior').value = '0'; resetDefinitions(); clear(); resetArchive(); input.value = ''; get<HTMLInputElement>('texture-file').value = ''; get<HTMLInputElement>('texture-file').disabled = true; status.textContent = 'Local model cleared.'; };
get('frame').onclick = () => preview.frame();
get<HTMLInputElement>('night').oninput = event => preview.night(Number((event.target as HTMLInputElement).value));
window.addEventListener('pagehide', () => { animationControls.dispose(); walkChannel?.close(); ideWorker?.terminate(); worker?.terminate(); preview.dispose(); });

if (import.meta.env.DEV) Object.assign(window, { __modelPreview: { state: () => preview.snapshot() } });

function resetDefinitions() {
  ideWorker?.terminate(); ideWorker = null; associations.clear(); parents.clear();
  get<HTMLInputElement>('ide-files').value = '';
  get('ide-status').textContent = 'IDE definitions can select the model’s named archive dictionary.';
}
get('remove-definitions').onclick = () => { resetDefinitions(); if (archiveFile) suggestDictionary(); };
get<HTMLInputElement>('ide-files').onchange = () => {
  const files = [...(get<HTMLInputElement>('ide-files').files ?? [])]; if (!files.length) return;
  ideWorker?.terminate(); associations.clear(); parents.clear(); if (archiveFile) suggestDictionary();
  get('ide-status').textContent = 'Reading model definitions locally…';
  const current = ideWorker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  current.onmessage = ({ data }) => {
    if (ideWorker !== current) return; current.terminate(); ideWorker = null;
    if (data.error) { get('ide-status').textContent = data.error; return; }
    associations = new Map(data.associations); parents = new Map(data.parents);
    get('ide-status').textContent = `${associations.size} model associations loaded from ${files.length} IDE files. ${parents.size} texture-parent links. Only dictionary associations are applied.`;
    if (archiveFile) suggestDictionary();
  };
  current.onerror = () => { if (ideWorker === current) { current.terminate(); ideWorker = null; get('ide-status').textContent = 'The definition reader failed. Select the files again.'; } };
  current.postMessage({ action: 'ide', files });
};

get('apply-placements').onclick = load;
get('remove-static-placements').onclick = () => { get<HTMLInputElement>('static-placement-file').value = ''; if (sceneActive || scenePending) get('assemble-scene').click(); };
get<HTMLInputElement>('placement-search').oninput = () => listAuxiliaryEntries();
get<HTMLInputElement>('collision-search').oninput = () => listAuxiliaryEntries('collision');
get('remove-placements').onclick = () => { get<HTMLSelectElement>('archive-placements').value = '-1'; get<HTMLInputElement>('placement-file').value = ''; get<HTMLInputElement>('static-placement-file').value = ''; load(); };

get('assemble-scene').onclick = () => {
  const placementFile = get<HTMLInputElement>('placement-file').files?.[0];
  if (!archiveFile || !placementFile && !selectedArchiveEntry()) { status.textContent = 'Select an IMG archive and an IPL file to assemble a scene.'; return; }
  clear(); scenePending = true; status.textContent = 'Assembling local archive scene…';
  const current = worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  current.onmessage = ({ data }) => {
    if (worker !== current) return; current.terminate(); worker = null; scenePending = false;
    if (data.error) { status.textContent = data.error; return; }
    const parts: import('./scene').ScenePart[] = data.scene;
    try { preview.loadScene(parts); } catch (error) { preview.clear(); status.textContent = error instanceof Error ? error.message : 'Scene preview failed.'; return; }
    assembledParts = parts; get<HTMLButtonElement>('walk-scene').disabled = data.omitted > 0 || planSceneCollision(parts).missing.length > 0;
    sceneActive = true; status.textContent = 'Archive scene assembled locally.';
    get('summary').textContent = `${parts.length} model types · ${data.requested - data.omitted} placements · ${data.omitted} omitted placements`;
    get('warnings').textContent = [...data.notices, ...parts.flatMap(p => [...p.notices, ...p.model.warnings].map(n => `${p.name}: ${n}`))].join('\n');
    get('metadata').textContent = (data.collisionSource ? `Collision source: ${data.collisionSource}\n` : '') + `Placement source: ${data.placementSource}${data.staticPlacementSource ? `\nStatic LOD source: ${data.staticPlacementSource}` : ''}\n\n` + parts.map(p => `${p.name}: ${p.placements.length} placements · source indices ${p.sourceIndices?.join(', ') ?? 'unavailable'} · draw distance ${p.definition?.drawDistance ?? 'unavailable'} · flags ${p.definition?.flags ?? 'unavailable'}${p.definition?.timeOn !== undefined ? ` · hours ${p.definition.timeOn}–${p.definition.timeOff}` : ''} · dictionaries ${p.dictionaryNames.join(' → ') || 'none'} ${p.timeCounterpart ? ` · time counterpart ${p.timeCounterpart} (${parts.some(other => other.name.toLowerCase() === p.timeCounterpart!.toLowerCase()) ? 'loaded' : 'unavailable'})` : ''}${p.visibilityBounds ? ` · bounds radius ${p.visibilityBounds.bounds.radius} from ${p.visibilityBounds.sourceModel}${p.visibilityBounds.inherited ? ' (inherited)' : ''}` : ''} · placement keys ${p.sourceRefs?.map(r => `${r.namespace}:${r.index}`).join(', ') ?? 'unavailable'}`).join('\n') + '\n\n' + (data.lodLinks ?? []).map((link: {sourceIndex:number;targetIndex:number;sourceKey:string;targetKey:string;status:string}) => `LOD ${link.sourceIndex} → ${link.targetIndex}: ${link.status} (${link.sourceKey} → ${link.targetKey})`).join('\n');
  };
  current.onerror = () => { if (worker === current) { current.terminate(); worker = null; scenePending = false; status.textContent = 'Scene worker failed. Retry assembly.'; } };
  current.postMessage({ action: 'scene', staticPlacementFile: get<HTMLInputElement>('static-placement-file').files?.[0], collisionEntry: selectedArchiveEntry('collision'), collisionFile: get<HTMLInputElement>('collision-file').files?.[0], file: archiveFile, placementFile, placementEntry: selectedArchiveEntry(), associations: [...associations.values()], parents: [...parents], interior: Number(get<HTMLInputElement>('placement-interior').value) });
};

get<HTMLInputElement>('show-collision').onchange = () => preview.showCollision(get<HTMLInputElement>('show-collision').checked);
get('remove-collision').onclick = () => { get<HTMLSelectElement>('archive-collisions').value = '-1'; get<HTMLInputElement>('collision-file').value = ''; if (sceneActive) get('assemble-scene').click(); else load(); };

get('walk-scene').onclick = () => {
  if (!assembledParts) return;
  walkChannel?.close(); const token = crypto.randomUUID(), parts = assembledParts;
  const channel = walkChannel = new BroadcastChannel(`scene-test-${token}`);
  channel.onmessage = ({ data }) => { if (data.type === 'ready') channel.postMessage({ type: 'scene', parts }); else if (data.type === 'installed') channel.close(); };
  const popup = window.open(`${import.meta.env.BASE_URL}?sceneTest=${encodeURIComponent(token)}`, '_blank');
  if (!popup) { channel.close(); status.textContent = 'Allow this site to open the imported-scene test window.'; }
};
