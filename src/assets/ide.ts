import { requireAsset } from './binary';
export interface IdeAssociation { id: number; model: string; dictionary: string; section: string; }
const sections = new Set(['objs', 'tobj', 'anim', 'hier', 'cars', 'peds', 'weap']);
/** Read only model/dictionary associations. Remaining section fields are not interpreted. */
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
    result.push({ id, model, dictionary, section });
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
