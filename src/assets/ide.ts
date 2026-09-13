import { requireAsset } from './binary';
export interface IdeAssociation { id: number; model: string; dictionary: string; section: string; drawDistance?: number; flags?: number; timeOn?: number; timeOff?: number; }
const sections = new Set(['objs', 'tobj', 'anim', 'hier', 'cars', 'peds', 'weap']);
/** Preserve associations plus supported static-object visibility metadata. */
export function readIdeAssociations(text: string): IdeAssociation[] {
  requireAsset(text.length <= 4 * 1024 * 1024, 'IDE exceeds the 4 MiB text limit.');
  const result: IdeAssociation[] = [];
  let section = '';
  for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    if (line.toLowerCase() === 'end') { section = ''; continue; }
    if (!section) { section = line.toLowerCase(); continue; }
    if (!sections.has(section)) continue;
    const fields = line.replace(/,/g, ' ').split(/\s+/), id = Number(fields[0]);
    requireAsset(/^\d+$/.test(fields[0]) && Number.isSafeInteger(id) && id <= 65535 && fields.length >= 3, `IDE line ${index + 1}: invalid model association.`);
    const [model, dictionary] = fields.slice(1, 3);
    requireAsset([model, dictionary].every(name => name.length <= 24 && !/[\x00-\x20\\/.:]/.test(name)), `IDE line ${index + 1}: invalid model or dictionary name.`);
    const record: IdeAssociation = { id, model, dictionary, section };
    if ((section === 'objs' || section === 'tobj') && fields.length > 3) {
      const timed = section === 'tobj', tail = timed ? 2 : 0, first = Number(fields[3]);
      const legacy = first < 4, count = legacy ? first : 1, start = legacy ? 4 : 3;
      requireAsset(Number.isInteger(count) && count >= 1 && count <= 3 && fields.length === start + count + 1 + tail, `IDE line ${index + 1}: invalid object visibility fields.`);
      const distances = fields.slice(start, start + count).map(Number), flagText = fields[start + count], flags = Number(flagText);
      requireAsset(distances.every(n => Number.isFinite(n) && n >= 0 && n <= 1e7), `IDE line ${index + 1}: invalid draw distance.`);
      requireAsset(/^-?\d+$/.test(flagText) && Number.isInteger(flags) && flags >= -2147483648 && flags <= 4294967295, `IDE line ${index + 1}: invalid object flags.`);
      record.drawDistance = distances[0]; record.flags = flags >>> 0;
      if (timed) {
        const hours = fields.slice(-2).map(Number);
        requireAsset(hours.every(n => Number.isInteger(n) && n >= 0 && n <= 24), `IDE line ${index + 1}: invalid visibility hours.`);
        [record.timeOn, record.timeOff] = hours;
      }
    }
    result.push(record);
    requireAsset(result.length <= 50000, 'IDE exceeds the 50,000 association limit.');
  }
  return result;
}
export function mergeIdeAssociations(records: IdeAssociation[]): Map<string, IdeAssociation> {
  const models = new Map<string, IdeAssociation>();
  for (const record of records) {
    const key = record.model.toLowerCase(), prior = models.get(key);
    requireAsset(!prior || prior.dictionary.toLowerCase() === record.dictionary.toLowerCase(), `Conflicting IDE dictionaries for ${record.model}.`);
    models.set(key, record);
  }
  return models;
}

export function readIdeParents(text: string): [string, string][] {
  requireAsset(text.length <= 4 * 1024 * 1024, 'IDE exceeds the 4 MiB text limit.');
  let section = ''; const parents: [string, string][] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    if (line.toLowerCase() === 'end') { section = ''; continue; }
    if (!section) { section = line.toLowerCase(); continue; }
    if (section !== 'txdp') continue;
    const fields = line.replace(/,/g, ' ').split(/\s+/);
    requireAsset(fields.length === 2 && fields.every(n => n.length <= 31 && !/[\x00-\x20\\/.:]/.test(n)), 'Invalid IDE texture-parent definition.');
    parents.push([fields[0].toLowerCase(), fields[1].toLowerCase()]);
  }
  return parents;
}
export function textureDictionaryChain(name: string, parents: Map<string, string>): string[] {
  const chain: string[] = [], seen = new Set<string>();
  let current: string | undefined = name.toLowerCase();
  while (current) {
    requireAsset(!seen.has(current), `Cyclic texture-parent chain at ${current}.`);
    requireAsset(chain.length < 32, 'Texture-parent chain exceeds 32 dictionaries.');
    chain.push(current); seen.add(current); current = parents.get(current);
  }
  return chain;
}
export function mergeIdeParents(records: [string, string][]): Map<string, string> {
  const parents = new Map<string, string>();
  for (const [child, parent] of records) {
    requireAsset(!parents.has(child) || parents.get(child) === parent, `Conflicting texture parents for ${child}.`);
    parents.set(child, parent);
  }
  for (const child of parents.keys()) textureDictionaryChain(child, parents);
  return parents;
}
