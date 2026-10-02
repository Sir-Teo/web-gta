import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
/** A PNG's width and height from its IHDR chunk. */
const pngSize=(path:string)=>{const b=readFileSync(path);expect(b.subarray(1,4).toString('latin1')).toBe('PNG');return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;};
test('a phone\'s home screen gets the game\'s icon: a PNG for iOS, and PNG sizes in the manifest',()=>{
 // iOS draws no SVG there and would take a snapshot of the page instead.
 const html=readFileSync('index.html','utf8'),apple=/<link rel="apple-touch-icon" href="%BASE_URL%([^"]+)"/.exec(html);
 expect(apple?.[1]).toBe('apple-touch-icon.png');expect(pngSize(`public/${apple![1]}`)).toBe('180x180');
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8')) as {icons:{src:string;sizes:string;type:string}[]};
 const pngs=manifest.icons.filter(icon=>icon.type==='image/png');
 expect(pngs.map(icon=>icon.sizes).sort()).toEqual(['192x192','512x512']);
 for(const icon of pngs)expect(pngSize(`public/${icon.src}`)).toBe(icon.sizes);
});
