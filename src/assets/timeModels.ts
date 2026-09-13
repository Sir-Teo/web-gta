import type { IdeAssociation } from './ide';
/** Timed definitions link to previously registered counterparts, as in the source loader. */
export function timeModelCounterparts(records: Iterable<IdeAssociation>): Map<string, string> {
  const registered = new Map<string, IdeAssociation>(), links = new Map<string, string>();
  for (const record of records) {
    const name = record.model.toLowerCase(); registered.set(name, record);
    if (record.section !== 'tobj') continue;
    const night = record.model.indexOf('_nt'), day = record.model.indexOf('_dy');
    const marker = night >= 0 ? night : day;
    if (marker < 0) continue;
    // The reference replaces from the first marker through the end of the name.
    const counterpart = (record.model.slice(0, marker) + (night >= 0 ? '_dy' : '_nt')).toLowerCase();
    if (registered.get(counterpart)?.section !== 'tobj') continue;
    links.set(name, counterpart); links.set(counterpart, name);
  }
  return links;
}
