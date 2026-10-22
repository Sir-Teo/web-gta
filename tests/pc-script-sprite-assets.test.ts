import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {expect,test} from 'vitest';
import {readTxd,decodeTexture} from '../src/assets/txd';

test('all twenty-one script sprite dictionaries match their source locks and packed resources and decode',()=>{
 const lock=JSON.parse(readFileSync('scripts/content/world-sources.json','utf8')),manifest=JSON.parse(readFileSync('public/play/world/manifest.json','utf8')),resources=lock.resources.filter((r:any)=>r.path.startsWith('models/txd/'));expect(resources).toHaveLength(21);let textures=0;
 for(const source of resources){const published=manifest.resources.find((r:any)=>r.path===source.path),bytes=readFileSync(`public/play/world/files/${source.path}`);expect(bytes.length).toBe(source.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);expect(published.sha256).toBe(source.sha256);expect(gunzipSync(readFileSync(`public/play/world/${published.packed.file}`)).equals(bytes)).toBe(true);const rasters=readTxd(bytes);expect(rasters.length).toBeGreaterThan(0);for(const r of rasters)expect(decodeTexture(r,0).length).toBe(r.width*r.height*4);textures+=rasters.length;}
 expect(textures).toBe(399);
});
