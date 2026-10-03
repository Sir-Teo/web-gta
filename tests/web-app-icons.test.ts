import {expect,test} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
/** A PNG's width and height from its IHDR chunk. */
const pngSize=(path:string)=>{const b=readFileSync(path);expect(b.subarray(1,4).toString('latin1')).toBe('PNG');return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;};
/** Whether a PNG has an alpha channel (IHDR colour type 4 or 6) or a transparency chunk. */
const pngAlpha=(path:string)=>{const b=readFileSync(path);return b[25]===4||b[25]===6||b.includes(Buffer.from('tRNS'));};
type Icon={src:string;sizes:string;type:string;purpose?:string};
const manifest=()=>JSON.parse(readFileSync('public/manifest.webmanifest','utf8')) as {id:string;description:string;icons:Icon[]};
test('a phone\'s home screen gets the game\'s icon: a PNG for iOS, and PNG sizes in the manifest',()=>{
 // iOS draws no SVG there and would take a snapshot of the page instead.
 const html=readFileSync('index.html','utf8'),apple=/<link rel="apple-touch-icon" href="%BASE_URL%([^"]+)"/.exec(html);
 expect(apple?.[1]).toBe('apple-touch-icon.png');expect(pngSize(`public/${apple![1]}`)).toBe('180x180');
 const pngs=manifest().icons.filter(icon=>icon.type==='image/png'&&!icon.purpose);
 expect(pngs.map(icon=>icon.sizes).sort()).toEqual(['192x192','512x512']);
 for(const icon of pngs)expect(pngSize(`public/${icon.src}`)).toBe(icon.sizes);
 for(const icon of manifest().icons)expect(existsSync(`public/${icon.src}`)).toBe(true);
});
test('Android\'s adaptive launcher gets a maskable icon that fills its shape',()=>{
 // A launcher that masks icons puts one without the purpose on a white disc, shrunk; the maskable one is full bleed
 // (no transparent corners), the palm inside the centred circle of 40% radius any mask keeps.
 const maskable=manifest().icons.filter(icon=>icon.purpose==='maskable'&&icon.type==='image/png');
 expect(maskable.map(icon=>icon.sizes).sort()).toEqual(['192x192','512x512']);
 for(const icon of maskable){expect(pngSize(`public/${icon.src}`)).toBe(icon.sizes);expect(pngAlpha(`public/${icon.src}`)).toBe(false);}
 expect(pngAlpha('public/icon-512.png')).toBe(true);
 // Chrome shows the description in its install sheet. No id: one resolves against the site's origin, not this folder,
 // so "./" would be another app than the one installed from start_url (Chrome's id when none is given).
 expect(manifest().id).toBeUndefined();expect(manifest().description.length).toBeGreaterThan(20);
});
