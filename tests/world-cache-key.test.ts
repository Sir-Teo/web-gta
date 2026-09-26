import {afterEach,expect,test} from 'vitest';
import {worldCacheKey} from '../src/assets/staticWorldArchive';
const original=Object.getOwnPropertyDescriptor(globalThis,'location');
afterEach(()=>{if(original)Object.defineProperty(globalThis,'location',original);else delete (globalThis as {location?:unknown}).location;});
const at=(href:string)=>{const url=new URL(href);Object.defineProperty(globalThis,'location',{value:{href,origin:url.origin},configurable:true});};
test('the page and a world worker cache a resource under the same key',()=>{
 at('https://example.test/?area=grove-street');const page=worldCacheKey('ab12');
 at('https://example.test/src/assets/staticWorld.worker.ts?worker_file&type=module');const worker=worldCacheKey('ab12');
 expect(worker).toBe(page);expect(page).toBe(`https://example.test${import.meta.env.BASE_URL}__world/ab12`);
});
