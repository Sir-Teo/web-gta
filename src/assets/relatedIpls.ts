import { requireAsset } from './binary';
import type { ImgEntry } from './img';
/** CIplStore::SetupRelatedIpls matches the static name + '_stream' case-insensitively. */
export function relatedIplEntries(staticFilename: string, entries: ImgEntry[]): number[] {
  const filename = staticFilename.split(/[\\/]/).at(-1)!;
  requireAsset(/\.ipl$/i.test(filename) && filename.length > 4, 'Select a named static .ipl file first.');
  const prefix = `${filename.slice(0, -4).toLowerCase()}_stream`;
  // Keep directory order. The native rule is a prefix, not a numeric-suffix pattern.
  return entries.flatMap((entry, index) => entry.name.toLowerCase().endsWith('.ipl') && entry.name.toLowerCase().startsWith(prefix) ? [index] : []);
}
