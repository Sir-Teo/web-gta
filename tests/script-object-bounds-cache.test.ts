import {readFileSync} from 'node:fs';
import {afterEach,expect,test,vi} from 'vitest';
import {Scene} from 'three';
import {ScriptObjectViews} from '../src/simulation/ScriptObjectViews';
import {readCol} from '../src/assets/col';
const open=vi.hoisted(()=>vi.fn());vi.mock('../src/assets/staticWorldArchive',()=>({openStaticWorld:(...args:unknown[])=>open(...args)}));
afterEach(()=>{vi.useRealTimers();open.mockReset();});
function fixture(){
 const col=new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v2.col')),dff=new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')),data=new Uint8Array(col.length+dff.length);data.set(col);data.set(dff,col.length);
 const entries=[{name:'fixture.col',offset:0,length:col.length,archivedSectors:0},{name:'diagnostic_col2.dff',offset:col.length,length:dff.length,archivedSectors:0}],read=vi.fn(async(from:number,to:number)=>data.slice(from,to)),file={size:data.length,readRange:read};
 open.mockResolvedValue({file,entries,entry:(name:string)=>entries.find(e=>e.name===name)});
 const views=new ScriptObjectViews(new Scene(),'fixture',[{id:102,model:'diagnostic_col2',dictionary:'none',section:'objs'},{id:103,model:'without_col',dictionary:'none',section:'objs'}]),bounds=readCol(col)[0].bounds;
 return {views,read,bounds:{min:{x:bounds.min[0],y:bounds.min[1],z:bounds.min[2]},max:{x:bounds.max[0],y:bounds.max[1],z:bounds.max[2]}}};
}

test('a collision loaded before its bounds query supplies dimensions immediately',async()=>{
 const {views,bounds}=fixture();try{expect((await views.sceneModelPart(102))?.collision).toBeDefined();expect(views.modelBounds(102)).toEqual(bounds);expect(views.modelBounds('DIAGNOSTIC_COL2')).toEqual(bounds);}finally{views.dispose();}
});

test('a bounds query during another collision consumer’s load resolves without starting a second load',async()=>{
 const {views,read,bounds}=fixture();let release!:()=>void;const gate=new Promise<void>(r=>release=r),original=read.getMockImplementation()!;read.mockImplementation(async(from,to)=>{if(from===0)await gate;return original(from,to);});
 try{const pending=views.sceneModelPart(102);await vi.waitFor(()=>expect(read).toHaveBeenCalled());expect(views.modelBounds(102)).toBeUndefined();expect(views.modelBounds(102)).toBeUndefined();release();await pending;expect(views.modelBounds(102)).toEqual(bounds);expect(read.mock.calls.filter(([from])=>from===0)).toHaveLength(2);}finally{release();views.dispose();}
});

test('missing model or absent collision resolves to null rather than pending forever',async()=>{
 const {views}=fixture();try{expect(views.modelBounds(999)).toBeNull();expect(views.modelBounds(103)).toBeUndefined();await vi.waitFor(()=>expect(views.modelBounds(103)).toBeNull());}finally{views.dispose();}
});

test('a transient collision read failure does not poison bounds as permanently absent',async()=>{
 vi.useFakeTimers();const {views,read,bounds}=fixture(),original=read.getMockImplementation()!;let failed=false;read.mockImplementation(async(from,to)=>{if(from===0&&!failed){failed=true;throw Error('temporary COL download failure');}return original(from,to);});
 try{expect(views.modelBounds(102)).toBeUndefined();await vi.waitFor(()=>expect(views.error).toContain('temporary COL'));expect(views.modelBounds(102)).toBeUndefined();await vi.advanceTimersByTimeAsync(2001);expect(views.modelBounds(102)).toBeUndefined();await vi.waitFor(()=>expect(views.modelBounds(102)).toEqual(bounds));}finally{views.dispose();}
});
