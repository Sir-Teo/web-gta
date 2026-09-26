import {expect,test,vi} from 'vitest';
const open=vi.fn();
vi.mock('../src/assets/staticWorldSource',()=>({
 openStaticWorldSource:(...args:unknown[])=>open(...args),
 readStaticWorldRegion:async()=>({parts:[]}),
}));
vi.mock('../src/assets/staticWorldArchive',()=>({pruneWorldCache:async()=>0}));
test('a world source that failed to open at startup is opened again by the next terrain request',async()=>{
 const posted:{type:string;followId?:number}[]=[];
 const worker={postMessage:(message:{type:string;followId?:number})=>{posted.push(message);},onmessage:undefined as undefined|((event:{data:unknown})=>Promise<void>)};
 vi.stubGlobal('self',worker);
 const world={source:{hashes:()=>[]},carGenerators:[],occluders:[],pickups:[],stuntJumps:[],savePoints:[],radarBlips:[],restartPoints:[],garages:[],scriptBytes:new Uint8Array()};
 open.mockRejectedValueOnce(new Error('World manifest download failed.')).mockResolvedValue(world);
 await import('../src/assets/staticWorld.worker');
 await worker.onmessage!({data:{action:'initialize',base:'https://example.test/play/world/'}});
 expect(posted.map(m=>m.type)).toEqual(['error']);
 await worker.onmessage!({data:{action:'region',id:1,region:{x:0,y:0,radius:10}}});
 await vi.waitFor(()=>expect(posted.map(m=>m.type)).toEqual(['error','ready','terrain']));
 expect(open).toHaveBeenCalledTimes(2);expect(posted[2].followId).toBe(1);
 vi.unstubAllGlobals();
});
