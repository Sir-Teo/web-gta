import {expect,test} from 'vitest';
import {GAME_DATA_CACHES,clearGameData,storageSummary} from '../src/ui/storagePanel';
import {serviceWorkerSource} from '../scripts/serviceWorker.mjs';

test('the panel says how much the game keeps, and whether the browser keeps it for good',()=>{
 expect(storageSummary(123.4*1048576,true)).toBe('123 MB kept on this device for quick starts and offline play, until you clear it.');
 expect(storageSummary(5.25*1048576,false)).toBe('5.3 MB kept on this device for quick starts and offline play; the browser may clear it when space runs low.');
 expect(storageSummary(undefined,undefined)).toMatch(/kept on this device/);
});
test('clearing deletes the world\'s chunks and the service worker\'s data, and keeps the game itself',async()=>{
 const deleted:string[]=[];
 expect(await clearGameData({delete:async name=>{deleted.push(name);return name!=='web-gta-play-v1';}})).toBe(1);
 expect(deleted).toEqual(['web-gta-world-v1','web-gta-play-v1']);
 // The service worker keeps its data under the same name, and its app shell under another.
 const source=serviceWorkerSource(['index.html']);
 expect(source).toContain(`PLAY_CACHE='${GAME_DATA_CACHES[1]}'`);expect(source).toContain("CACHE='web-gta-shell-");
 expect(await clearGameData({delete:async()=>{throw new Error('blocked');}})).toBe(0);
});
