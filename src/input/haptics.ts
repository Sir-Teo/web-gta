/* A touch button's buzz, as a phone game's buttons give. Android's browsers vibrate (navigator.vibrate). Safari on an
 * iPhone has no vibration API, but since iOS 18 a switch (<input type="checkbox" switch>) toggled through its label
 * ticks the Taptic Engine, even hidden and clicked from a script during a touch: the press clicks a hidden one. Where
 * neither is there (a desktop browser), nothing. */
interface HapticNavigator {vibrate?:(pattern:number)=>boolean}
/** `ms`: how long, where the device can vibrate for a time (a pad's shake); an iPhone's tick is the same whatever it is. */
export function touchHaptic(nav:HapticNavigator=navigator,doc:Document=document):(ms?:number)=>void{
 if(typeof nav.vibrate==='function')return (ms=12)=>{try{nav.vibrate!(Math.max(1,Math.round(ms)));}catch{/* vibration refused */}};
 const input=doc.createElement('input');
 if(!('switch' in input))return ()=>{};
 input.type='checkbox';input.setAttribute('switch','');input.tabIndex=-1;
 const label=doc.createElement('label');label.setAttribute('aria-hidden','true');label.style.display='none';label.append(input);
 (doc.head??doc.documentElement).append(label);
 return ()=>{try{label.click();}catch{/* no tick */}};
}
