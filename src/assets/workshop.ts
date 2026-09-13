import type { ImgEntry } from './img';
import type { NativeTexture } from './txd';
import './workshop.css';
type Metadata = Omit<NativeTexture, 'mips' | 'palette'> & { levels: { width: number; height: number; bytes: number }[] };
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fileInput = element<HTMLInputElement>('asset-file'), status = element('status');
const entriesSelect = element<HTMLSelectElement>('entries'), textureSelect = element<HTMLSelectElement>('textures'), mipSelect = element<HTMLSelectElement>('mip');
let worker: Worker | null = null, request = 0, entries: ImgEntry[] = [], textures: Metadata[] = [];
function message(text: string, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function reset() {
  worker?.terminate(); worker = null; request++; entries = []; textures = [];
  for (const id of ['archive', 'dictionary', 'texture-preview']) element(id).hidden = true;
  element('empty').hidden = false; entriesSelect.replaceChildren(); textureSelect.replaceChildren(); mipSelect.replaceChildren();
  const canvas = element<HTMLCanvasElement>('pixels'); canvas.width = canvas.height = 1;
  element<HTMLInputElement>('search').value = '';
}
function send(action: string, values: Record<string, unknown> = {}) { worker?.postMessage({ id: ++request, action, ...values }); }
function listEntries() {
  const query = element<HTMLInputElement>('search').value.toLowerCase();
  const matching = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.name.toLowerCase().endsWith('.txd') && entry.name.toLowerCase().includes(query));
  entriesSelect.replaceChildren(...matching.slice(0, 200).map(({ entry, index }) => new Option(entry.name, String(index))));
  element('entry-count').textContent = `${matching.length} dictionaries${matching.length > 200 ? ' · first 200 shown; type to narrow' : ''}`;
  if (matching.length) entriesSelect.selectedIndex = 0;
  element<HTMLButtonElement>('open-entry').disabled = matching.length === 0;
}
function decode() {
  const index = Number(textureSelect.value), texture = textures[index]; if (!texture) return;
  message(`Decoding ${texture.name}…`); send('decode', { index, level: Number(mipSelect.value) });
}
function selectTexture() {
  const texture = textures[Number(textureSelect.value)]; if (!texture) return;
  mipSelect.replaceChildren(...texture.levels.map((m, i) => new Option(`${i} · ${m.width} × ${m.height}`, String(i))));
  // Large textures initially open at a bounded preview size; every source mip remains selectable.
  const initial = texture.levels.findIndex(m => Math.max(m.width, m.height) <= 1024); mipSelect.selectedIndex = Math.max(0, initial);
  element('texture-name').textContent = texture.name;
  element('metadata').textContent = `${texture.width} × ${texture.height} · ${texture.format} · ${texture.levels.length} mip levels · Alpha ${texture.hasAlpha ? 'yes' : 'no'} · Filter ${texture.filter} · Address U/V ${texture.addressU}/${texture.addressV}${texture.mask ? ` · Mask ${texture.mask}` : ''}`;
  element('texture-preview').hidden = true; element('empty').hidden = false; decode();
}
fileInput.onchange = () => {
  const file = fileInput.files?.[0]; if (!file) return;
  reset(); message(`Reading ${file.name} locally…`);
  worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.id !== request) return;
    if (data.kind === 'error') { message(data.message, true); return; }
    if (data.kind === 'archive') {
      entries = data.entries; element('archive').hidden = false; listEntries(); message(`${file.name}: ${entries.length} archive entries. Select a texture dictionary.`);
    } else if (data.kind === 'dictionary') {
      textures = data.textures; element('dictionary').hidden = false;
      textureSelect.replaceChildren(...textures.map((t, i) => new Option(t.name || '(unnamed texture)', String(i))));
      if (textures.length) { textureSelect.selectedIndex = 0; selectTexture(); } else message('This dictionary contains no textures.');
    } else if (data.kind === 'pixels') {
      const canvas = element<HTMLCanvasElement>('pixels'); canvas.width = data.width; canvas.height = data.height;
      canvas.getContext('2d')!.putImageData(new ImageData(data.pixels, data.width, data.height), 0, 0);
      canvas.style.width = `${Math.min(512, Math.max(data.width, 256))}px`;
      element('texture-preview').hidden = false; element('empty').hidden = true;
      message(`${textures[Number(textureSelect.value)].name} · mip ${mipSelect.value} decoded locally.`);
    }
  };
  worker.onerror = () => { worker?.terminate(); worker = null; message('The asset worker could not finish. Select the file again to retry.', true); };
  send('open', { file });
};
element('open-entry').onclick = () => {
  if (entriesSelect.selectedIndex < 0) return;
  textures = []; textureSelect.replaceChildren(); element('dictionary').hidden = true; element('texture-preview').hidden = true; element('empty').hidden = false;
  message(`Reading ${entries[Number(entriesSelect.value)].name}…`); send('dictionary', { index: Number(entriesSelect.value) });
};
element<HTMLInputElement>('search').oninput = listEntries;
textureSelect.onchange = selectTexture; mipSelect.onchange = decode;
element<HTMLInputElement>('smooth').onchange = event => { element('pixels').style.imageRendering = (event.target as HTMLInputElement).checked ? 'auto' : 'pixelated'; };
element('clear').onclick = () => { reset(); fileInput.value = ''; message('Local file cleared. Choose another file to continue.'); };
window.addEventListener('pagehide', () => worker?.terminate());
