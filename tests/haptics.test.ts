import {expect,test,vi} from 'vitest';
import {touchHaptic} from '../src/input/haptics';
/** A document whose inputs have the switch attribute or not, recording what is appended and clicked. */
function fakeDocument(switches:boolean){
 const appended:unknown[]=[],clicks:string[]=[];
 const element=(tag:string)=>{const el:any={tag,style:{},attributes:{} as Record<string,string>,children:[] as unknown[],
  setAttribute(name:string,value:string){this.attributes[name]=value;},append(...c:unknown[]){this.children.push(...c);},click(){clicks.push(tag);}};
  if(tag==='input'&&switches)el.switch=false;return el;};
 const doc={createElement:element,head:{append:(...c:unknown[])=>appended.push(...c)}} as unknown as Document;
 return {doc,appended,clicks};
}
test('a press vibrates where the browser can (Android)',()=>{
 const vibrate=vi.fn(()=>true),{doc,appended}=fakeDocument(true);
 touchHaptic({vibrate},doc)();expect(vibrate).toHaveBeenCalledWith(12);expect(appended).toHaveLength(0);
});
test('on an iPhone a press clicks a hidden switch\'s label, which ticks the Taptic Engine',()=>{
 const {doc,appended,clicks}=fakeDocument(true),haptic=touchHaptic({},doc);
 expect(appended).toHaveLength(1);const label=appended[0] as any;
 expect(label.tag).toBe('label');expect(label.style.display).toBe('none');expect(label.attributes['aria-hidden']).toBe('true');
 expect(label.children[0].type).toBe('checkbox');expect(label.children[0].attributes.switch).toBe('');
 haptic();haptic();expect(clicks).toEqual(['label','label']);
});
test('a browser with neither does nothing',()=>{
 const {doc,appended,clicks}=fakeDocument(false);touchHaptic({},doc)();expect(appended).toHaveLength(0);expect(clicks).toHaveLength(0);
});
