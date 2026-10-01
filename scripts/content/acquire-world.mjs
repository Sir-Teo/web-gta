/** Reproduce the inspected native map depot without an application backend.
 * node scripts/content/acquire-world.mjs /absolute/content-directory [--verify-only]
 * Lock hashes identify the inspected public dataset, not a certified retail release. */
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {createInflate} from 'node:zlib';
import {acquireFile, installVerified, matchesFile} from './lib/verified-file.mjs';

const [outputArg, ...flags] = process.argv.slice(2);
if (!outputArg || flags.some(flag => flag !== '--verify-only')) {
  throw new Error('Usage: node scripts/content/acquire-world.mjs /absolute/content-directory [--verify-only]');
}
const output = resolve(outputArg);
const lock = JSON.parse(await readFile(new URL('./world-sources.json', import.meta.url), 'utf8'));
const verifyOnly = flags.includes('--verify-only');
const pathFor = name => {
  const path = resolve(output, name), rel = relative(output, path);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(`Invalid content destination: ${name}`);
  }
  return path;
};
// Further IMGs the game opens after gta3.img (MODELS\\GTA_INT.IMG), hosted uncompressed.
const all = [lock.archive, ...lock.resources, ...(lock.extraArchives ?? [])];
const paths = new Set();
for (const item of [...all, lock.compressedArchive]) {
  const path = pathFor(item.path);
  if (paths.has(path) || !Number.isSafeInteger(item.bytes) || item.bytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256)) {
    throw new Error(`Invalid or duplicate locked resource: ${item.path}`);
  }
  paths.add(path);
}
if (verifyOnly) {
  const failures = [];
  for (const item of all) if (!await matchesFile(pathFor(item.path), item)) failures.push(item.path);
  if (failures.length) throw new Error(`Missing or changed content:\n${failures.join('\n')}`);
  console.log(`Verified ${all.length} files against the inspected dataset. No network requests.`);
} else {
  const archivePath = pathFor(lock.archive.path);
  if (await matchesFile(archivePath, lock.archive)) console.log('gta3.img: verified cache');
  else {
    const compressed = pathFor(lock.compressedArchive.path);
    console.log('Acquiring native archive (533 MB compressed)…');
    await acquireFile(compressed, lock.compressedArchive);
    await installVerified(archivePath, lock.archive, createReadStream(compressed), [createInflate()]);
    console.log('gta3.img: inflated and verified');
  }
  for (const item of lock.extraArchives ?? []) console.log(`${item.path}: ${await acquireFile(pathFor(item.path), item)}`);
  for (let i = 0; i < lock.resources.length; i += 4) {
    const batch = await Promise.allSettled(lock.resources.slice(i, i + 4).map(async item => {
      const result = await acquireFile(pathFor(item.path), item);
      console.log(`${item.path}: ${result}`);
    }));
    const failures = batch.filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Content acquisition failed; rerun to reuse verified files.');
  }
  console.log(`Ready: ${output}\nOpen the model workshop and choose this local content folder.`);
}
