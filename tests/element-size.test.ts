import {afterEach,expect,test,vi} from 'vitest';

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});

test('an element\'s size is read once, then kept from the ResizeObserver, not laid out again each frame',async()=>{
 let callback:((entries:{target:object}[])=>void)|undefined;const observed:object[]=[];
 vi.stubGlobal('ResizeObserver',class{constructor(cb:(entries:{target:object}[])=>void){callback=cb;}observe(el:object){observed.push(el);}});
 const {elementSize}=await import('../src/ui/elementSize');
 let reads=0,width=844,height=390;
 const el={get clientWidth(){reads++;return width;},get clientHeight(){reads++;return height;}} as unknown as HTMLElement;
 expect(elementSize(el)).toEqual({width:844,height:390});
 for(let frame=0;frame<10;frame++)elementSize(el);
 expect(reads).toBe(2);expect(observed).toEqual([el]);
 // The phone turns: the observer reports the new box, read once.
 width=390;height=844;callback!([{target:el}]);
 expect(elementSize(el)).toEqual({width:390,height:844});expect(reads).toBe(4);
});

test('without a ResizeObserver every read goes to the element',async()=>{
 vi.stubGlobal('ResizeObserver',undefined);
 const {elementSize}=await import('../src/ui/elementSize');
 let reads=0;const el={get clientWidth(){reads++;return 10;},get clientHeight(){reads++;return 20;}} as unknown as HTMLElement;
 elementSize(el);elementSize(el);
 expect(reads).toBe(4);
});
