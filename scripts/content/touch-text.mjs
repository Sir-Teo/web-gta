/** Generates src/assets/touchGxtText.ts: the iOS port's help text for its touch controls, by table and key.
 *
 * The iOS port's american.gxt (the gta3sa.app bundle, github.com/Google61/gta3sa.app; GXT version 4, 16-bit
 * characters) rewords the PC's control help for a touch screen: "Tap" for "Press", the mouse and keys left out, and
 * each control named by its widget (~m~~widget_enter_car~) where the PC names a pad action (~k~~VEHICLE_ENTER_EXIT~).
 * A widget stands for different actions by the screen it is on (widget_mission_start is the PC's enter key at a
 * gambling table and its 2 in a vigilante vehicle), so each string's widgets are matched to the actions the PC's same
 * string names: in order where every pair is one the strings agree on elsewhere, else by those pairings' counts. The
 * text keeps the PC's ~k~ tokens, which the HUD names by the touch buttons. A string whose widgets do not answer the
 * PC's actions one for one (the iOS shops pick by tapping; its treadmill has buttons of its own) is left out: its
 * wording describes widgets this game does not have. So is one that asks for a gesture the touch controls here do not
 * read (a double tap to climb or hop, a drag across the screen or of the cue ball, a tap on a meter's bar).
 *
 * Usage: node scripts/content/touch-text.mjs [path to the iOS american.gxt]
 * Without a path it is downloaded from the bundle's pinned revision and checked against its hash. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const SOURCE={url:'https://raw.githubusercontent.com/Google61/gta3sa.app/67f70cb72eb207aeca650ea9e8c10b0e7dda166a/american.gxt',bytes:1339196,
 sha256:'7d9134def219df21ffd8535643f4c77c1706cd50c66f5613a9671ae49a1971e1'};
const PC='public/play/world/files/text/american.gxt',OUTPUT='src/assets/touchGxtText.ts';
const ios=process.argv[2]?await readFile(process.argv[2]):Buffer.from(await (await fetch(SOURCE.url,{signal:AbortSignal.timeout(60000)})).arrayBuffer());
if(ios.length!==SOURCE.bytes||createHash('sha256').update(ios).digest('hex')!==SOURCE.sha256)throw new Error('The iOS american.gxt is not the pinned one.');
/** Every table of a GXT (TABL, then each TKEY and TDAT), 8- or 16-bit, as key hash to text. */
function readGxt(b){
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength),bits=view.getUint16(2,true),ascii=(at,n)=>String.fromCharCode(...b.subarray(at,at+n));
 if(ascii(4,4)!=='TABL'||bits!==8&&bits!==16)throw new Error('Not a GXT.');
 const tables=new Map();
 for(let i=0;i<view.getUint32(8,true)/12;i++){
  const at=12+i*12,name=ascii(at,8).replace(/\0.*$/,''),offset=view.getUint32(at+8,true),keys=name==='MAIN'?offset:offset+8;
  if(ascii(keys,4)!=='TKEY')throw new Error(`GXT table ${name} lacks TKEY.`);
  const keySize=view.getUint32(keys+4,true),text=keys+8+keySize+8,out=new Map();
  for(let k=0;k<keySize/8;k++){
   let s='';
   for(let p=text+view.getUint32(keys+8+k*8,true);;p+=bits/8){const c=bits===16?view.getUint16(p,true):b[p];if(!c)break;s+=String.fromCharCode(c);}
   out.set(view.getUint32(keys+12+k*8,true),s);
  }
  tables.set(name,out);
 }
 return tables;
}
const pc=readGxt(await readFile(PC)),port=readGxt(ios);
/** The port's gestures that these touch controls do not read. */
const PORT_GESTURES=/double tap|swipe across|drag (?:your|the)|tap the (?:energy|power) bar|arcade joystick/i;
const widgets=s=>[...s.matchAll(/~m~~([A-Za-z0-9_]+)~/g)].map(m=>m[1]),actions=s=>[...s.matchAll(/~k~~([A-Z0-9_]+)~/g)].map(m=>m[1]);
/** Each pair of strings with as many widgets as actions, read in order: how often each widget stands for each action. */
const pairs=new Map(),pairings=(w,a)=>pairs.get(w)?.get(a)??0;
for(const [name,table] of port)for(const [hash,text] of table){
 const w=widgets(text),a=actions(pc.get(name)?.get(hash)??'');
 if(w.length&&w.length===a.length)w.forEach((widget,i)=>{const m=pairs.get(widget)??new Map();m.set(a[i],(m.get(a[i])??0)+1);pairs.set(widget,m);});
}
const out={};let kept=0,left=0;
for(const [name,table] of port)for(const [hash,text] of table){
 const original=pc.get(name)?.get(hash),w=widgets(text);
 if(original===undefined||!w.length||text===original)continue;
 if(PORT_GESTURES.test(text)){left++;continue;}
 const a=actions(original);
 let chosen=w.length===a.length?w.map((widget,i)=>pairings(widget,a[i])>0?a[i]:undefined):[];
 if(w.length===a.length&&chosen.includes(undefined)){const rest=[...a];chosen=w.map(widget=>{
  let best=0,at=-1;rest.forEach((action,i)=>{if(pairings(widget,action)>best){best=pairings(widget,action);at=i;}});return at<0?undefined:rest.splice(at,1)[0];});}
 if(w.length!==a.length||chosen.includes(undefined)){left++;continue;}
 let i=0;(out[name]??={})[hash]=text.replace(/~m~~[A-Za-z0-9_]+~/g,()=>`~k~~${chosen[i++]}~`);kept++;
}
const body=Object.entries(out).map(([name,table])=>` ${name}:{${Object.entries(table).map(([hash,text])=>`${hash}:${JSON.stringify(text)}`).join(',')}}`).join(',\n');
await writeFile(OUTPUT,`// Generated by scripts/content/touch-text.mjs from the iOS port's american.gxt (gta3sa.app ${SOURCE.url.split('/')[5].slice(0,10)}).
// Do not edit by hand.
/** The iOS port's touch wording of the PC's control help, by GXT table and key hash, with the PC's ~k~ controls. */
export const TOUCH_GXT_TEXT:Readonly<Record<string,Readonly<Record<number,string>>>>={
${body}};
`);
console.log(`${OUTPUT}: ${kept} strings in ${Object.keys(out).length} tables; ${left} left as the PC words them.`);
