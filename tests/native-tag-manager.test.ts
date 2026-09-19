import {expect,test} from 'vitest';
import {NativeTagManager,ALPHA_TAGGED,tagKey} from '../src/world/nativeTagManager';
import {readWorldTags} from '../src/assets/worldTags';

const tags=[{position:[10,0,1] as const,modelId:1525},{position:[10,1,1] as const,modelId:1490},{position:[100,0,1] as const,modelId:1530}];

test('CWorld::SprayPaintWorld adds 8 alpha to each tag in reach, and CTagManager counts a tag past 228', () => {
 const m=new NativeTagManager(tags),changes:[string,number][]=[];
 expect(m.sprayPaint([0,0,1],3,(k,a)=>changes.push([k,a]))).toBe('notFound');
 expect(m.sprayPaint([10,.5,1],1,(k,a)=>changes.push([k,a]))).toBe('discovered');
 expect(changes).toEqual([[tagKey([10,0,1]),8],[tagKey([10,1,1]),8]]);
 const messages:unknown[]=[];
 let state='';for(let i=0;i<31;i++)state=m.sprayPaint([10,0,1],.5,(_k,_a,msg)=>{if(msg)messages.push(msg);});
 // 8 + 31 × 8 reaches 255 on the last shot; the tag counted once it passed 228.
 expect(state).toBe('painted');expect(m.alpha(tagKey([10,0,1]))).toBe(255);
 expect(messages).toEqual([{message:'TAG_ONE',tagged:1,total:3}]);expect(m.numTagged).toBe(1);expect(m.percentageTagged()).toBe(33);
 // Spraying a finished tag keeps it at 255 and is only discovered.
 expect(m.sprayPaint([10,0,1],.5,()=>{})).toBe('discovered');
 // Saved alphas restore.
 const restored=new NativeTagManager(tags);restored.load(m.saved());expect(restored.numTagged).toBe(1);expect(restored.alpha(tagKey([10,1,1]))).toBe(8);
 expect(ALPHA_TAGGED).toBe(228);
});

test('the last tag triggers TAG_ALL', () => {
 const m=new NativeTagManager([tags[0]]);let msg:unknown;
 for(let i=0;i<32;i++)m.sprayPaint([10,0,1],.5,(_k,_a,message)=>{if(message)msg=message;});
 expect(msg).toEqual({message:'TAG_ALL',tagged:1,total:1});
});

test('readWorldTags lists IPL instances of tag-flagged object models in load order', () => {
 const ipl=(rows:string)=>new TextEncoder().encode(`inst\n${rows}\nend\n`);
 const ide=[{id:1525,model:'tag_kilo',dictionary:'tags',section:'objs',flags:0x100004},{id:700,model:'tree',dictionary:'t',section:'objs',flags:0}];
 const out=readWorldTags(['b.ipl','a.ipl'],new Map([['a.ipl',ipl('1525, tag_kilo, 0, 1, 2, 3, 0, 0, 0, 1, -1')],['b.ipl',ipl('700, tree, 0, 5, 5, 5, 0, 0, 0, 1, -1\n1525, tag_kilo, 0, 4, 5, 6, 0, 0, 0, 1, -1')]]),ide);
 expect(out).toEqual([{position:[4,5,6],modelId:1525},{position:[1,2,3],modelId:1525}]);
});
