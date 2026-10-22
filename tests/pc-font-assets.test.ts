import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {expect,test} from 'vitest';
import {readTxd,decodeTexture} from '../src/assets/txd';
import {NATIVE_FONT_METRICS} from '../src/ui/nativeFontMetrics';

test('published PC font data and atlases match their acquisition locks and compressed resources',()=>{
 const lock=JSON.parse(readFileSync('scripts/content/world-sources.json','utf8')),manifest=JSON.parse(readFileSync('public/play/world/manifest.json','utf8'));
 for(const path of ['data/fonts.dat','models/fonts.txd']){const source=lock.resources.find((r:any)=>r.path===path),published=manifest.resources.find((r:any)=>r.path===path),bytes=readFileSync(`public/play/world/files/${path}`);expect(bytes.length).toBe(source.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);expect(published.sha256).toBe(source.sha256);expect(gunzipSync(readFileSync(`public/play/world/${published.packed.file}`))).toEqual(bytes);}
 const rasters=readTxd(readFileSync('public/play/world/files/models/fonts.txd'));expect(rasters.map(t=>[t.name,t.width,t.height])).toEqual([['font2',512,512],['font1',512,512]]);
 for(const t of rasters){const rgba=decodeTexture(t,0);expect(rgba.some((v,i)=>i%4===3&&v>0)).toBe(true);expect(rgba.some((v,i)=>i%4===3&&v===0)).toBe(true);}
 expect(NATIVE_FONT_METRICS.map(f=>f.widths.length)).toEqual([208,208]);expect(NATIVE_FONT_METRICS[0].widths[33]).toBe(25);expect(NATIVE_FONT_METRICS[1].widths[55]).toBe(31);
});
