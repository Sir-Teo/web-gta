/* clientWidth and clientHeight read during a frame make the browser lay the page out again whenever anything on it
 * changed since the last layout, and the HUD, the radar and the touch buttons change every frame: read once a frame,
 * each is a whole layout, which a phone pays for in frame time. The sizes are kept from a ResizeObserver instead, which
 * reports a box after the layout the browser makes anyway, and read from here. */
type Size={width:number;height:number};
const sizes=new WeakMap<Element,Size>();
let observer:ResizeObserver|null|undefined;
function watch(){
 if(observer===undefined)observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
  for(const entry of entries){const size=sizes.get(entry.target),el=entry.target as HTMLElement;if(size){size.width=el.clientWidth;size.height=el.clientHeight;}}
 }):null;
 return observer;
}
/** The element's clientWidth and clientHeight as of the last layout that changed its box (read directly the first time,
 * and every time where there is no ResizeObserver). */
export function elementSize(el:HTMLElement):Readonly<Size>{
 const known=sizes.get(el);if(known)return known;
 const size={width:el.clientWidth,height:el.clientHeight},o=watch();
 if(!o)return size;
 sizes.set(el,size);o.observe(el);return size;
}
