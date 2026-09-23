/* CText (Text/Text.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: Load (0x6A01A0) reads the GXT's
 * version and encoding, the TABL of mission tables (CMissionTextOffsets), then the MAIN table's TKEY and TDAT;
 * LoadMissionText (0x69FBF0) reads one mission table (an eight-byte name, then its own TKEY and TDAT); Get (0x6A0050)
 * looks a key up in MAIN, then in the loaded mission table, and gives an empty string for a missing or blank key.
 * CKeyArray::Search hashes the upper-cased key with CKeyGen (the JAM CRC, a CRC-32 without its final inversion) and
 * binary-searches the sorted hashes. Strings are GXT characters, turned to text by GxtCharToUTF8's table. */
import {requireAsset} from './binary';

const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^c>>>1:c>>>1;t[n]=c>>>0;}return t;})();
/** CKeyGen::GetUppercaseKey: the JAM CRC of the key in upper case. */
export function gxtKeyHash(key:string){
 let c=0xffffffff;
 for(const ch of key.toUpperCase())c=CRC_TABLE[(c^ch.charCodeAt(0))&255]^c>>>8;
 return c>>>0;
}
/** GxtCharToUTF8's table: the font's accented letters above 0x7F, and three ASCII codes the font draws differently. */
const GXT_CHARS:Readonly<Record<number,string>>={0xb1:'´',0xaf:'¿',0x80:'À',0x81:'Á',0x82:'Â',0x83:'Ä',0x84:'Æ',0x85:'Ç',0x86:'È',0x87:'É',
 0x88:'Ê',0x89:'Ë',0x8a:'Ì',0x8b:'Í',0x8c:'Î',0x8d:'Ï',0xad:'Ñ',0x8e:'Ò',0x8f:'Ó',0x90:'Ô',0x91:'Ö',0x92:'Ù',0x93:'Ú',0x94:'Û',0x95:'Ü',
 0x96:'ß',0x97:'à',0x98:'á',0x99:'â',0x9a:'ä',0x9b:'æ',0x9c:'ç',0x9d:'è',0x9e:'é',0x9f:'ê',0xa0:'ë',0xa1:'ì',0xa2:'í',0xa3:'î',0xa4:'ï',
 0xae:'ñ',0xa5:'ò',0xa6:'ó',0xa7:'ô',0xa8:'ö',0xa9:'ù',0xaa:'ú',0xab:'û',0xac:'ü',0x5b:'<',0x5d:'>',0x5e:'¡'};
export function gxtCharsToText(bytes:Uint8Array){let out='';for(const b of bytes)out+=GXT_CHARS[b]??String.fromCharCode(b);return out;}

type Table=ReadonlyMap<number,string>;
export interface Gxt {
 main:Table;
 /** CMissionTextOffsets: each mission table's name and file offset. */
 missions:ReadonlyMap<string,number>;
 bytes:Uint8Array;
}
const ascii=(b:Uint8Array,at:number,n:number)=>String.fromCharCode(...b.subarray(at,at+n));
function readKeysAndText(b:Uint8Array,view:DataView,at:number):Map<number,string>{
 requireAsset(ascii(b,at,4)==='TKEY','GXT table lacks TKEY.');
 const keySize=view.getUint32(at+4,true),data=at+8+keySize;
 requireAsset(ascii(b,data,4)==='TDAT','GXT table lacks TDAT.');
 const text=data+8,out=new Map<number,string>();
 for(let k=0;k<keySize/8;k++){
  const offset=view.getUint32(at+8+k*8,true),hash=view.getUint32(at+12+k*8,true);
  let end=text+offset;while(b[end])end++;
  out.set(hash,gxtCharsToText(b.subarray(text+offset,end)));
 }
 return out;
}
export function readGxt(b:Uint8Array):Gxt{
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 requireAsset(view.getUint16(2,true)===8,'Only 8-bit GXT files are supported (the PC game encoding).');
 requireAsset(ascii(b,4,4)==='TABL','GXT lacks TABL.');
 const size=view.getUint32(8,true),missions=new Map<string,number>();let main:Map<number,string>|undefined;
 for(let i=0;i<size/12;i++){
  const at=12+i*12,name=ascii(b,at,8).replace(/\0.*$/,''),offset=view.getUint32(at+8,true);
  if(name==='MAIN')main=readKeysAndText(b,view,offset);else missions.set(name,offset);
 }
 requireAsset(main,'GXT lacks its MAIN table.');
 return {main,missions,bytes:b};
}

/** TheText. */
export class NativeText {
 private mission?:{name:string;table:Table};
 constructor(readonly gxt:Gxt){}
 /** CText::Get: MAIN first, then the loaded mission table; a blank or missing key gives "". */
 get(key:string){
  if(!key||key[0]===' ')return '';
  const hash=gxtKeyHash(key);
  return this.gxt.main.get(hash)??this.mission?.table.get(hash)??'';
 }
 /** Whether a key is in MAIN or the loaded mission table. */
 has(key:string){const hash=gxtKeyHash(key);return this.gxt.main.has(hash)||!!this.mission?.table.has(hash);}
 /** CText::LoadMissionText: the named mission table replaces the one loaded. */
 loadMissionText(name:string){
  const offset=this.gxt.missions.get(name);
  requireAsset(offset!==undefined,`GXT has no mission table ${name}.`);
  const b=this.gxt.bytes,view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  this.mission={name,table:readKeysAndText(b,view,offset+8)};
 }
 get missionName(){return this.mission?.name??'';}
}
let loading:Promise<NativeText>|undefined,current:NativeText|undefined;
/** TheText once it has loaded. */
export const loadedText=()=>current;
/** TheText.Get(key), or the port's own wording until the text has loaded. */
export function gxtText(key:string,fallback:string){return current?.get(key)||fallback;}
/** CMessages::InsertNumberInString: each ~1~ in turn takes the next number (-1 past the ones given). */
export function insertNumbers(text:string,...numbers:number[]){let i=0;return text.replace(/~1~/g,()=>String(numbers[i++]??-1));}
/** The controls a ~k~ token names, as the browser binds them; any other shows its action name. */
const BROWSER_CONTROLS:Readonly<Record<string,string>>={VEHICLE_ENTER_EXIT:'F',PED_SPRINT:'SHIFT',PED_JUMPING:'SPACE',PED_DUCK:'C',
 VEHICLE_RADIO_STATION_UP:'N',PED_FIREWEAPON:'LEFT MOUSE',PED_LOCK_TARGET:'RIGHT MOUSE',CAMERA_CHANGE_VIEW_ALL_SITUATIONS:'V',GROUP_CONTROL_FWD:'G'};
/** The browser HUD draws plain text: ~n~ breaks the line, a ~k~ control names its key, and colour and style tokens
 * (~w~, ~r~, ~h~, ~z~ and the rest) drop. */
export function gxtHudText(text:string){return text.replace(/~k~~([A-Z0-9_]+)~/g,(_,action:string)=>BROWSER_CONTROLS[action]??action.replace(/_/g,' ')).replace(/~n~/g,'\n').replace(/~[a-z]~/g,'');}
/** TheText from the published text/american.gxt, loaded once. */
export function loadNativeText(base:string){
 loading??=import('./staticWorldArchive').then(async({openStaticWorld})=>{
  const source=await openStaticWorld(base),resource=source.manifest.resources.find(r=>r.path==='text/american.gxt');
  requireAsset(resource,'AMERICAN.GXT is not published.');
  return current=new NativeText(readGxt(new Uint8Array(await (await source.resource(resource)).arrayBuffer())));
 });
 return loading;
}
