/** Generates src/assets/creditsTable.ts: the end credits as the iOS port's CCredits::RenderCredits draws them.
 *
 * The roll is code, not data: RenderCredits (iOS 0x1002e0084) fetches each line's text with TheText.Get and hands it to
 * PrintCreditText (0x1002e6174) with its scale and whether it is a heading, and steps the position with
 * PrintCreditSpace's sizes in between. The iOS order is the PC's (gta-reversed CCredits::RenderCredits, 0x5A87F0) with
 * War Drum Studios' block for the mobile port after CRED545 (CREWD0 to CREWD13, three of its headings the PC's own).
 * The PC american.gxt has every CRED key; the CREWD lines are taken from the iOS port's american.gxt.
 *
 * Usage: node scripts/content/credits-table.mjs <the iOS gta3sa executable (arm64)> [path to the iOS american.gxt]
 * The GXT is downloaded from the bundle's pinned revision when no path is given, and checked against its hash. */
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const START=0x1002e0084,END=0x1002e6174,PRINT_CREDIT_TEXT='1002e6174',TEXT_GET='10043afbc';
const GXT={url:'https://raw.githubusercontent.com/Google61/gta3sa.app/67f70cb72eb207aeca650ea9e8c10b0e7dda166a/american.gxt',bytes:1339196,
 sha256:'7d9134def219df21ffd8535643f4c77c1706cd50c66f5613a9671ae49a1971e1'};
const OUTPUT='src/assets/creditsTable.ts';
const [binaryPath,gxtPath]=process.argv.slice(2);
if(!binaryPath)throw new Error('Name the iOS gta3sa executable.');
const bin=await readFile(binaryPath);
const gxt=gxtPath?await readFile(gxtPath):Buffer.from(await (await fetch(GXT.url,{signal:AbortSignal.timeout(60000)})).arrayBuffer());
if(gxt.length!==GXT.bytes||createHash('sha256').update(gxt).digest('hex')!==GXT.sha256)throw new Error('The iOS american.gxt is not the pinned one.');
// The executable is a thin arm64 Mach-O whose __TEXT maps from file offset 0 at 0x100000000.
const at=address=>address-0x100000000;
const cString=address=>{let s='';for(let o=at(address);bin[o];o++)s+=String.fromCharCode(bin[o]);return s;};
const lines=execFileSync('objdump',['-d',`--start-address=0x${START.toString(16)}`,`--stop-address=0x${END.toString(16)}`,binaryPath],{maxBuffer:64<<20}).toString().split('\n');
// Registers as the function sets them: pages (adrp), addresses (adrp + add), float constants (ldr s from __TEXT's
// constants, fmov; a load from __DATA, the screen size, is not a constant and is left).
const page={},address={},float={},entries=[];let key='',heading=0,scale='';
for(const line of lines){
 let m;
 if(m=/adrp\tx(\d+), 0x([0-9a-f]+)/.exec(line))page[m[1]]=parseInt(m[2],16);
 else if(m=/add\tx(\d+), x(\d+), #0x([0-9a-f]+)$/.exec(line)){if(page[m[2]]!==undefined){address[m[1]]=page[m[2]]+parseInt(m[3],16);if(m[1]==='1')key=cString(address[m[1]]);}}
 else if(m=/mov\tx1, x(\d+)$/.exec(line)){if(address[m[1]]!==undefined)key=cString(address[m[1]]);}
 else if(m=/ldr\ts(\d+), \[x(\d+), #0x([0-9a-f]+)\]/.exec(line)){const o=page[m[2]]===undefined?-1:at(page[m[2]]+parseInt(m[3],16));if(o>=0&&o+4<=bin.length)float['s'+m[1]]=bin.readFloatLE(o);}
 else if(m=/fmov\ts(\d+), #([-0-9.e]+)/.exec(line))float['s'+m[1]]=parseFloat(m[2]);
 else if(m=/(orr\tw2, wzr, #0x1|mov\tw2, #0x0)/.exec(line))heading=m[1].startsWith('orr')?1:0;
 else if(m=/mov\.16b\tv1, v(\d+)/.exec(line))scale='s'+m[1];
 else if(line.includes(`bl\t0x${PRINT_CREDIT_TEXT}`))entries.push([key,Math.fround(float[scale]),heading]);
 else if(m=/fadd\ts0, s0, s(\d+)/.exec(line))entries.push(float['s'+m[1]]);
}
if(entries.length<700)throw new Error(`Decoded only ${entries.length} credit entries.`);
for(const e of entries)if(Array.isArray(e)&&(!/^CRE[DW]/.test(e[0])&&!/^CRD/.test(e[0])||!Number.isFinite(e[1])))throw new Error(`Undecoded credit line ${JSON.stringify(e)}.`);
// The iOS GXT's MAIN table by key hash (CKeyGen's JAM CRC of the upper-cased key).
const view=new DataView(gxt.buffer,gxt.byteOffset,gxt.byteLength),ascii=(o,n)=>String.fromCharCode(...gxt.subarray(o,o+n));
if(ascii(4,4)!=='TABL'||view.getUint16(2,true)!==16)throw new Error('Not the 16-bit iOS GXT.');
const main=view.getUint32(12+8,true);if(ascii(main,4)!=='TKEY')throw new Error('The GXT MAIN table lacks TKEY.');
const keySize=view.getUint32(main+4,true),text=main+8+keySize+8,table=new Map();
for(let k=0;k<keySize/8;k++){let s='';for(let p=text+view.getUint32(main+8+k*8,true);;p+=2){const c=view.getUint16(p,true);if(!c)break;s+=String.fromCharCode(c);}table.set(view.getUint32(main+12+k*8,true),s);}
const CRC=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const jamCrc=s=>{let c=0xffffffff;for(const ch of s.toUpperCase())c=CRC[(c^ch.charCodeAt(0))&255]^(c>>>8);return c>>>0;};
const warDrum={};
for(const e of entries)if(Array.isArray(e)&&e[0].startsWith('CREWD')){const t=table.get(jamCrc(e[0]));if(t===undefined)throw new Error(`${e[0]} is not in the iOS GXT.`);warDrum[e[0]]=t;}
const body=entries.map(e=>Array.isArray(e)?`[${JSON.stringify(e[0])},${+e[1].toFixed(2)},${e[2]}]`:String(e));
await writeFile(OUTPUT,`// Generated by scripts/content/credits-table.mjs from the iOS port's executable (CCredits::RenderCredits 0x1002e0084)
// and its american.gxt (gta3sa.app 67f70cb72e). Do not edit by hand.
/** RenderCredits' calls in order: a line [GXT key, scale, heading] (PrintCreditText) or a space in position units
 * (PrintCreditSpace's size × 25). */
export const CREDITS:readonly (readonly [key:string,scale:number,heading:0|1]|number)[]=[
 ${body.join(',')}];
/** The iOS port's own lines (War Drum Studios), which the PC american.gxt does not have. */
export const CREDITS_IOS_TEXT:Readonly<Record<string,string>>=${JSON.stringify(warDrum)};
`);
console.log(`${OUTPUT}: ${entries.filter(Array.isArray).length} lines, ${entries.filter(e=>!Array.isArray(e)).length} spaces, ${Object.keys(warDrum).length} iOS lines`);
