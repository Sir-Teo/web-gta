import {expect,test} from 'vitest';
import {serviceWorkerSource,shellVersion} from '../scripts/serviceWorker.mjs';
import {registerShell} from '../src/core/serviceWorker';

const SCOPE='https://example.test/web-gta/';
/** sw.js run over a fake worker global: Cache Storage as maps in creation order, the network as `network`. */
function worker(urls:string[],network:(url:string)=>Response|undefined,existing:Record<string,Record<string,Response>>={}){
 const stores=new Map(Object.entries(existing).map(([name,entries])=>[name,new Map(Object.entries(entries))]));
 const fetched:string[]=[];
 const fetch=async(input:string|{url:string})=>{const url=typeof input==='string'?input:input.url;fetched.push(url);const response=network(url);if(!response)throw new TypeError('Failed to fetch');return response.clone();};
 const open=async(name:string)=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name)!;return{
  addAll:async(keys:string[])=>{for(const key of keys){const response=await fetch(key);if(!response.ok)throw new TypeError(`${key} ${response.status}`);store.set(key,response);}},
  put:async(key:string,response:Response)=>{store.set(key,response);},
 };};
 const caches={open,keys:async()=>[...stores.keys()],delete:async(name:string)=>stores.delete(name),
  match:async(key:string)=>{for(const store of stores.values())if(store.has(key))return store.get(key)!.clone();return undefined;}};
 const listeners:Record<string,(event:any)=>void>={};let preload=false;
 const self={location:new URL(SCOPE),registration:{scope:SCOPE,navigationPreload:{enable:async()=>{preload=true;}}},clients:{claim:async()=>{}},skipWaiting:async()=>{},
  addEventListener:(type:string,listener:(event:any)=>void)=>{listeners[type]=listener;}};
 new Function('self','caches','fetch','Response',serviceWorkerSource(urls))(self,caches,fetch,Response);
 const lifecycle=async(type:string)=>{let wait:Promise<unknown>=Promise.resolve();listeners[type]({waitUntil:(p:Promise<unknown>)=>{wait=p;}});await wait;};
 /** The response the worker gives a request, or undefined when it leaves it to the browser. */
 const request=async(url:string,mode='cors',method='GET')=>{
  let response:Promise<Response>|undefined;const waits:Promise<unknown>[]=[];
  listeners.fetch({request:{url,mode,method},preloadResponse:Promise.resolve(undefined),respondWith:(r:Promise<Response>)=>{response=r;},waitUntil:(p:Promise<unknown>)=>waits.push(p)});
  const result=await response;await Promise.all(waits);return result;
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
 expect(await (await sw.request(SCOPE+'?touch=1','navigate'))!.text()).toBe('page 1');
 expect(await (await sw.request(SCOPE+'assets/game-a.js'))!.text()).toBe('game a');
 expect(sw.fetched.slice(fetchedBefore)).toEqual([SCOPE+'?touch=1']);
 // Offline, the page is the cached one.
 online=false;
 expect(await (await sw.request(SCOPE,'navigate'))!.text()).toBe('page 1');
 expect(await (await sw.request(SCOPE+'index.html','navigate'))!.text()).toBe('page 1');
 // The world, the viewer pages, other sites and posts are the browser's own.
 expect(await sw.request(SCOPE+'play/world/manifest.json')).toBeUndefined();
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
 expect(await (await sw.request(SCOPE+'assets/game-old.js'))!.text()).toBe('game old');
 expect(await (await sw.request(SCOPE+'assets/game-new.js'))!.text()).toBe('game new');
 // A hashed file in no shell goes to the network.
 expect((await sw.request(SCOPE+'assets/models-x.js'))!.status).toBe(404);
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
