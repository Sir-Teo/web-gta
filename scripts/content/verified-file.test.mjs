import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createServer} from 'node:http';
import {createInflate, deflateSync} from 'node:zlib';
import {acquireFile, installVerified, matchesFile} from './lib/verified-file.mjs';
const expected = data => ({bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')});

test('failed hash, truncation and oversize preserve the previous file and clean staging', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gta-acquisition-test-'));
  try {
    const file = join(dir, 'world'), good = Buffer.from('verified world');
    await writeFile(file, good);
    for (const bad of [Buffer.from('xxxxxxxxxxxxxx'), good.subarray(0, 5), Buffer.concat([good, good])]) {
      await assert.rejects(installVerified(file, expected(good), Readable.from([bad])));
      assert.deepEqual(await readFile(file), good);
      assert.deepEqual(await readdir(dir), ['world']);
    }
    const interrupted = Readable.from((async function* () {
      yield good.subarray(0, 5);
      throw new Error('Connection interrupted');
    })());
    await assert.rejects(installVerified(file, expected(good), interrupted), /Connection interrupted/);
    assert.deepEqual(await readFile(file), good);
    assert.deepEqual(await readdir(dir), ['world']);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('inflated content is checked before publication', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gta-acquisition-test-'));
  try {
    const file = join(dir, 'world'), good = Buffer.from('VER2 native content');
    await installVerified(file, expected(good), Readable.from([deflateSync(good)]), [createInflate()]);
    assert.equal(await matchesFile(file, expected(good)), true);
    await assert.rejects(installVerified(file, expected(good), Readable.from([deflateSync(Buffer.from('different content'))]), [createInflate()]));
    assert.deepEqual(await readFile(file), good);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('HTTP acquisition repairs changed files and skips network for a valid cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gta-acquisition-test-'));
  const good = Buffer.from('native map metadata');
  let requests = 0;
  const server = createServer((_request, response) => { requests++; response.end(good); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const file = join(dir, 'map.ide');
    const resource = {...expected(good), url: `http://127.0.0.1:${server.address().port}/map.ide`};
    assert.equal(await acquireFile(file, resource), 'downloaded');
    assert.equal(await acquireFile(file, resource), 'verified cache');
    assert.equal(requests, 1);
    await writeFile(file, 'changed');
    assert.equal(await acquireFile(file, resource), 'downloaded');
    assert.equal(requests, 2);
    assert.equal(await matchesFile(file, resource), true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, {recursive: true, force: true});
  }
});
