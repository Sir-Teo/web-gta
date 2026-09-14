import {createReadStream, createWriteStream} from 'node:fs';
import {mkdir, mkdtemp, rename, rm} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {createHash} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export async function matchesFile(path, expected) {
  let bytes = 0;
  const hash = createHash('sha256');
  try {
    for await (const chunk of createReadStream(path)) {
      bytes += chunk.length;
      if (bytes > expected.bytes) return false;
      hash.update(chunk);
    }
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  return bytes === expected.bytes && hash.digest('hex') === expected.sha256;
}

// Publish only complete, verified bytes; a failed attempt leaves the destination intact.
export async function installVerified(path, expected, source, transforms = []) {
  await mkdir(dirname(path), {recursive: true});
  const temp = await mkdtemp(join(dirname(path), '.acquire-'));
  const staged = join(temp, 'data');
  let bytes = 0;
  const hash = createHash('sha256');
  const verifier = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > expected.bytes) return callback(new Error(`Size exceeds ${expected.bytes}: ${path}`));
      hash.update(chunk);
      callback(null, chunk);
    },
    flush(callback) {
      const digest = hash.digest('hex');
      callback(bytes === expected.bytes && digest === expected.sha256 ? null :
        new Error(`Content mismatch: ${path} (${bytes} bytes, SHA-256 ${digest})`));
    },
  });
  try {
    await pipeline(source, ...transforms, verifier, createWriteStream(staged, {flags: 'wx'}));
    await rename(staged, path);
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
}

export async function acquireFile(path, expected) {
  if (await matchesFile(path, expected)) return 'verified cache';
  const response = await fetch(expected.url, {signal: AbortSignal.timeout(30 * 60 * 1000)});
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}: ${expected.url}`);
  }
  await installVerified(path, expected, response.body);
  return 'downloaded';
}
