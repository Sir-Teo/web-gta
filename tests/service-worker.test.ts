import {expect,test} from 'vitest';
import {serviceWorkerSource,shellVersion} from '../scripts/serviceWorker.mjs';
import {registerShell} from '../src/core/serviceWorker';

const SCOPE='https://example.test/web-gta/';
/** sw.js run over a fake worker global: Cache Storage as maps in creation order, the network as `network`. */
function worker(urls:string[],network:(url:string,request?:{headers?:Headers;cache?:string})=>Response|undefined,existing:Record<string,Record<string,Response>>={}){
 const stores=new Map(Object.entries(existing).map(([name,entries])=>[name,new Map(Object.entries(entries))]));
 const fetched:string[]=[];
 const fetch=async(input:string|{url:string;headers?:Headers;cache?:string})=>{const url=typeof input==='string'?input:input.url;fetched.push(url);const response=network(url,typeof input==='string'?undefined:input);if(!response)throw new TypeError('Failed to fetch');return response.clone();};
 const open=async(name:string)=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name)!;return{
  addAll:async(keys:string[])=>{for(const key of keys){const response=await fetch(key);if(!response.ok)throw new TypeError(`${key} ${response.status}`);store.set(key,response);}},
  put:async(key:string,response:Response)=>{store.set(key,response);},
  match:async(key:string)=>store.get(key)?.clone(),
 };};
 const caches={open,keys:async()=>[...stores.keys()],delete:async(name:string)=>stores.delete(name),
  match:async(key:string)=>{for(const store of stores.values())if(store.has(key))return store.get(key)!.clone();return undefined;}};
 const listeners:Record<string,(event:any)=>void>={};let preload=false;
 const self={location:new URL(SCOPE),registration:{scope:SCOPE,navigationPreload:{enable:async()=>{preload=true;}}},clients:{claim:async()=>{}},skipWaiting:async()=>{},
  addEventListener:(type:string,listener:(event:any)=>void)=>{listeners[type]=listener;}};
 new Function('self','caches','fetch','Response',serviceWorkerSource(urls))(self,caches,fetch,Response);
 const lifecycle=async(type:string)=>{let wait:Promise<unknown>=Promise.resolve();listeners[type]({waitUntil:(p:Promise<unknown>)=>{wait=p;}});await wait;};
 /** The response the worker gives a request, or undefined when it leaves it to the browser. */
 const request=async(url:string,mode='cors',method='GET',headers:Record<string,string>={})=>{
  let response:Promise<Response>|undefined;const waits:Promise<unknown>[]=[];
  listeners.fetch({request:{url,mode,method,headers:new Headers(headers)},preloadResponse:Promise.resolve(undefined),respondWith:(r:Promise<Response>)=>{response=r;},waitUntil:(p:Promise<unknown>)=>waits.push(p)});
  if(!response){await Promise.all(waits);return undefined;}
  const result=await response.catch(()=>'failed' as const);await Promise.all(waits);return result;
 };
 return{stores,fetched,lifecycle,request,preload:()=>preload};
}
const page=(body:string)=>new Response(body,{status:200,headers:{'content-type':'text/html'}});

test('a build\'s shell files make its version, whatever their order',()=>{
 expect(shellVersion(['index.html','assets/game-a.js'])).toBe(shellVersion(['assets/game-a.js','index.html']));
 expect(shellVersion(['index.html','assets/game-a.js'])).not.toBe(shellVersion(['index.html','assets/game-b.js']));
 expect(shellVersion(['index.html'])).toMatch(/^[0-9a-f]{16}$/);
});

test('the shell installs from the network and then answers without it, the page falling back to its copy',async()=>{
 let online=true;const sw=worker(['index.html','assets/game-a.js'],url=>online?url.endsWith('.js')?new Response('game a'):page('page 1'):undefined);
 await sw.lifecycle('install');await sw.lifecycle('activate');expect(sw.preload()).toBe(true);
 expect([...sw.stores.keys()]).toEqual([`web-gta-shell-${shellVersion(['index.html','assets/game-a.js'])}`]);
 // Online, the page is the network's (a new deploy shows at once), and the script the cached one.
 const fetchedBefore=sw.fetched.length;
 expect(await ((await sw.request(SCOPE+'?touch=1','navigate')) as Response).text()).toBe('page 1');
 expect(await ((await sw.request(SCOPE+'assets/game-a.js')) as Response).text()).toBe('game a');
 expect(sw.fetched.slice(fetchedBefore)).toEqual([SCOPE+'?touch=1']);
 // Offline, the page is the cached one.
 online=false;
 expect(await ((await sw.request(SCOPE,'navigate')) as Response).text()).toBe('page 1');
 expect(await ((await sw.request(SCOPE+'index.html','navigate')) as Response).text()).toBe('page 1');
 // The viewer pages, other sites and posts are the browser's own.
 expect(await sw.request(SCOPE+'models.html','navigate')).toBeUndefined();
 expect(await sw.request('https://elsewhere.test/web-gta/assets/game-a.js')).toBeUndefined();
 expect(await sw.request(SCOPE+'assets/game-a.js','cors','POST')).toBeUndefined();
});

test('a new build keeps the last one\'s shell for a page still running it, and drops older ones',async()=>{
 const old={[SCOPE+'assets/game-old.js']:new Response('game old')};
 const sw=worker(['index.html','assets/game-new.js'],url=>url.endsWith('.js')?url.endsWith('game-new.js')?new Response('game new'):new Response('gone',{status:404}):page('page 2'),
  {'web-gta-shell-oldest':{},'web-gta-world-v1':{},'web-gta-shell-previous':old});
 await sw.lifecycle('install');await sw.lifecycle('activate');
 expect([...sw.stores.keys()]).toEqual(['web-gta-world-v1','web-gta-shell-previous',`web-gta-shell-${shellVersion(['index.html','assets/game-new.js'])}`]);
 // The server has replaced the old chunk; the running page still gets it.
 expect(await ((await sw.request(SCOPE+'assets/game-old.js')) as Response).text()).toBe('game old');
 expect(await ((await sw.request(SCOPE+'assets/game-new.js')) as Response).text()).toBe('game new');
 // A hashed file in no shell goes to the network.
 expect(((await sw.request(SCOPE+'assets/models-x.js')) as Response).status).toBe(404);
});

test('the shell registers once the page has loaded, in a production build and not under automation',()=>{
 const registered:string[]=[],loads:(()=>void)[]=[];
 const nav={serviceWorker:{register:async(url:string,{scope}:{scope:string})=>{registered.push(`${url} ${scope}`);}}};
 const win=(readyState:string)=>({document:{readyState},addEventListener:(_type:'load',listener:()=>void)=>{loads.push(listener);}});
 expect(registerShell(nav,win('loading'),true,'/web-gta/')).toBe(true);expect(registered).toEqual([]);
 loads[0]();expect(registered).toEqual(['/web-gta/sw.js /web-gta/']);
 expect(registerShell(nav,win('complete'),true,'/')).toBe(true);expect(registered).toEqual(['/web-gta/sw.js /web-gta/','/sw.js /']);
 // The dev server, a browser spec and a browser without service workers register nothing.
 expect(registerShell(nav,win('complete'),false,'/')).toBe(false);
 expect(registerShell({...nav,webdriver:true},win('complete'),true,'/')).toBe(false);
 expect(registerShell({},win('complete'),true,'/')).toBe(false);
 expect(registered).toHaveLength(2);
});

test('the game\'s data is the network\'s and kept, so a start without a connection plays on what was fetched before',async()=>{
 let online=true;const served:string[]=[];
 const sw=worker(['index.html'],url=>{if(!online)return undefined;served.push(url.slice(SCOPE.length));
  if(url.endsWith('missing.bin'))return new Response('gone',{status:404});return url.endsWith('.html')?page('page'):new Response(`data ${served.length}`);});
 await sw.lifecycle('install');await sw.lifecycle('activate');
 const text=async(url:string,headers?:Record<string,string>)=>{const r=await sw.request(url,'cors','GET',headers);return r instanceof Response?r.text():r;};
 // Online, every fetch is the network's (a republished file shows at once), and the newest copy is kept.
 expect(await text(SCOPE+'play/world-start.scene.bin')).toBe('data 2');expect(await text(SCOPE+'play/world-start.scene.bin')).toBe('data 3');
 expect(await text(SCOPE+'play/world/manifest.json')).toBe('data 4');expect(await text(SCOPE+'play/audio/bank-39.bin')).toBe('data 5');
 // Kept by their checksum elsewhere, or asked for in part, or not found: passed through, nothing kept.
 for(const path of ['play/world/chunks/00f4.bin','play/world/int/chunks/0a.bin','play/world/packed/00b7.bin','play/world/directory.bin','play/world/int/directory.bin'])
  expect(await sw.request(SCOPE+path)).toBeUndefined();
 expect(await text(SCOPE+'play/world/int/manifest.json')).toBe('data 6');
 expect(await sw.request(SCOPE+'play/audio/bank-1.bin','cors','GET',{range:'bytes=0-9'})).toBeUndefined();
 expect(((await sw.request(SCOPE+'play/missing.bin')) as Response).status).toBe(404);
 const kept=sw.stores.get('web-gta-play-v1')!;
 expect([...kept.keys()].map(k=>k.slice(SCOPE.length)).sort()).toEqual(['play/audio/bank-39.bin','play/world-start.scene.bin','play/world/int/manifest.json','play/world/manifest.json']);
 // Offline, the kept copies answer (the latest, query aside), and what was never fetched fails as before.
 online=false;
 expect(await text(SCOPE+'play/world-start.scene.bin?v=2')).toBe('data 3');expect(await text(SCOPE+'play/world/manifest.json')).toBe('data 4');
 expect(await sw.request(SCOPE+'play/audio/bank-2.bin')).toBe('failed');
});

test('a kept copy of the game\'s data is asked after by its ETag: unchanged, it answers without its bytes coming again',async()=>{
 let online=true,version='v1';const asked:{conditional:string|null;since:string|null;cache?:string}[]=[];let bodies=0;
 const sw=worker(['index.html'],(url,request)=>{if(!online)return undefined;if(url.endsWith('.html'))return page('page');
  const tag=`"${version}"`,conditional=request?.headers?.get('if-none-match')??null;asked.push({conditional,since:request?.headers?.get('if-modified-since')??null,cache:request?.cache});
  if(url.endsWith('old.bin'))return new Response(`old ${version}`,{status:200,headers:{'last-modified':'Fri, 02 Oct 2026 14:17:09 GMT'}});
  if(conditional===tag)return new Response(null,{status:304,headers:{etag:tag}});
  bodies++;return new Response(`scene ${version}`,{status:200,headers:{etag:tag}});});
 await sw.lifecycle('install');await sw.lifecycle('activate');
 const text=async(url:string)=>{const r=await sw.request(url);return r instanceof Response?r.text():r;};
 const scene=SCOPE+'play/world-start.scene.bin';
 // The first time it comes whole, past the browser's own cache, and is kept.
 expect(await text(scene)).toBe('scene v1');expect(asked.at(-1)).toEqual({conditional:null,since:null,cache:'no-store'});expect(bodies).toBe(1);
 // Again: asked after by its ETag, not changed, so the kept copy answers and no body comes.
 expect(await text(scene)).toBe('scene v1');expect(asked.at(-1)?.conditional).toBe('"v1"');expect(bodies).toBe(1);
 // Republished: the new one comes, and is kept in its place.
 version='v2';expect(await text(scene)).toBe('scene v2');expect(bodies).toBe(2);
 expect(await text(scene)).toBe('scene v2');expect(asked.at(-1)?.conditional).toBe('"v2"');expect(bodies).toBe(2);
 // A copy with only a date is asked after by it.
 await text(SCOPE+'play/old.bin');await text(SCOPE+'play/old.bin');expect(asked.at(-1)).toMatchObject({conditional:null,since:'Fri, 02 Oct 2026 14:17:09 GMT'});
 // Without a network the kept copy answers, as before.
 online=false;expect(await text(scene)).toBe('scene v2');
});
