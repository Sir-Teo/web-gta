/** Fetches ANIM\CUTS.IMG into a content directory, checked against cutscene-sources.json.
 * node scripts/content/acquire-cutscenes.mjs /absolute/content-directory
 * Then: GTA_PUBLISH_CUTSCENES=1 GTA_CONTENT_DIR=/absolute/content-directory npx vitest run tests/build-cutscenes.test.ts */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {acquireFile} from './lib/verified-file.mjs';
const [outputArg] = process.argv.slice(2);
if (!outputArg) throw new Error('Usage: node scripts/content/acquire-cutscenes.mjs /absolute/content-directory');
const lock = JSON.parse(await readFile(new URL('./cutscene-sources.json', import.meta.url), 'utf8'));
console.log(`${lock.cutsImg.path}: ${await acquireFile(resolve(outputArg, lock.cutsImg.path), lock.cutsImg)}`);
