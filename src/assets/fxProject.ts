/** FX_INFO type codes from eFxInfoType.h (San Andreas, version 109). The high nibble selects the
 * emission (0x1000), movement (0x2000) or render (0x4000/0x8000) pass. */
export const FX_INFO={
 emRate:0x1001,emSize:0x1004,emSpeed:0x1008,emDir:0x1010,emAngle:0x1020,emLife:0x1040,emPos:0x1080,emWeather:0x1100,emRotation:0x1200,
 noise:0x2001,force:0x2002,friction:0x2004,attractPoint:0x2008,attractLine:0x2010,groundCollide:0x2020,wind:0x2040,jitter:0x2080,rotSpeed:0x2100,float:0x2200,underwater:0x2400,
 colour:0x4001,size:0x4002,spriteRect:0x4004,heatHaze:0x4008,trail:0x4010,flat:0x4020,dir:0x4040,animTex:0x4080,colourRange:0x4100,selfLit:0x4200,colourBright:0x4400,
 smoke:0x8001,
} as const;
/** Key storage by interpolator class: FxInterpInfoFloat_c keeps floats, FxInterpInfo32_c int16 thousandths,
 * FxInterpInfoU255_c uint16 256ths and FxInterpInfo255_c int16 128ths. Times are uint16 256ths of a second. */
type KeyKind='float'|'32'|'u255'|'255';
interface InfoLayout {name:string;count:number;kind:KeyKind}
/** FxInfoManager_c::AddFxInfo constructors: channel count and interpolator per info. */
const LAYOUT:Record<number,InfoLayout>={
 [FX_INFO.emRate]:{name:'EMRATE',count:1,kind:'float'},[FX_INFO.emSize]:{name:'EMSIZE',count:7,kind:'32'},[FX_INFO.emSpeed]:{name:'EMSPEED',count:2,kind:'32'},
 [FX_INFO.emDir]:{name:'EMDIR',count:3,kind:'32'},[FX_INFO.emAngle]:{name:'EMANGLE',count:2,kind:'float'},[FX_INFO.emLife]:{name:'EMLIFE',count:2,kind:'u255'},
 [FX_INFO.emPos]:{name:'EMPOS',count:3,kind:'float'},[FX_INFO.emWeather]:{name:'EMWEATHER',count:4,kind:'float'},[FX_INFO.emRotation]:{name:'EMROTATION',count:2,kind:'float'},
 [FX_INFO.noise]:{name:'NOISE',count:1,kind:'32'},[FX_INFO.force]:{name:'FORCE',count:3,kind:'32'},[FX_INFO.friction]:{name:'FRICTION',count:1,kind:'32'},
 [FX_INFO.attractPoint]:{name:'ATTRACTPT',count:4,kind:'32'},[FX_INFO.attractLine]:{name:'ATTRACTLINE',count:7,kind:'32'},[FX_INFO.groundCollide]:{name:'GROUNDCOLLIDE',count:3,kind:'32'},
 [FX_INFO.wind]:{name:'WIND',count:1,kind:'32'},[FX_INFO.jitter]:{name:'JITTER',count:1,kind:'32'},[FX_INFO.rotSpeed]:{name:'ROTSPEED',count:4,kind:'float'},
 [FX_INFO.float]:{name:'FLOAT',count:0,kind:'float'},[FX_INFO.underwater]:{name:'UNDERWATER',count:0,kind:'u255'},
 [FX_INFO.colour]:{name:'COLOUR',count:4,kind:'u255'},[FX_INFO.size]:{name:'SIZE',count:4,kind:'32'},[FX_INFO.spriteRect]:{name:'SPRITERECT',count:4,kind:'255'},
 [FX_INFO.heatHaze]:{name:'HEATHAZE',count:0,kind:'255'},[FX_INFO.trail]:{name:'TRAIL',count:2,kind:'u255'},[FX_INFO.flat]:{name:'FLAT',count:9,kind:'float'},
 [FX_INFO.dir]:{name:'DIR',count:3,kind:'float'},[FX_INFO.animTex]:{name:'ANIMTEX',count:1,kind:'32'},[FX_INFO.colourRange]:{name:'COLOURRANGE',count:7,kind:'u255'},
 [FX_INFO.selfLit]:{name:'SELFLIT',count:0,kind:'u255'},[FX_INFO.colourBright]:{name:'COLOURBRIGHT',count:5,kind:'u255'},[FX_INFO.smoke]:{name:'SMOKE',count:8,kind:'u255'},
};
const TYPE_BY_TAG=new Map(Object.entries(LAYOUT).map(([type,layout])=>[`FX_INFO_${layout.name}_DATA:`,Number(type)]));
export interface FxInterp {looped:boolean;/** Shared key times in seconds (the last channel's times, as loaded). */times:number[];/** Per-channel decoded key values. */keys:number[][];}
export interface FxInfoBlueprint {type:number;timeModeParticle:boolean;interp:FxInterp;}
export interface FxPrimBlueprint {
 name:string;/** FxBufferedMatrix (right, up, at, pos) in int16 32767ths, or undefined for identity. */matrix?:number[];
 textures:(string|undefined)[];alphaOn:boolean;srcBlend:number;dstBlend:number;
 /** uint16 64ths of a metre. */lodStart:number;lodEnd:number;
 infos:FxInfoBlueprint[];movementOffset:number;renderOffset:number;hasFlat:boolean;hasHeatHaze:boolean;
}
export interface FxSystemBlueprint {name:string;length:number;loopIntervalMin:number;loopLength:number;playMode:number;/** uint16 256ths of a metre. */cullDistance:number;boundingSphere?:{x:number;y:number;z:number;radius:number};prims:FxPrimBlueprint[];}
const f=Math.fround;
const wrap16=(v:number)=>{const n=((Math.trunc(v)%65536)+65536)%65536;return n>=32768?n-65536:n;};
const wrapU16=(v:number)=>((Math.trunc(v)%65536)+65536)%65536;
/** Float-to-integer key storage, then the value the interpolator reads back. */
function decodeKey(kind:KeyKind,value:number){
 const v=f(value);
 if(kind==='float')return v;
 if(kind==='32')return wrap16(f(v*1000))/1000;
 if(kind==='u255')return wrapU16(f(v*256))/256;
 return wrap16(f(v*128))/128;
}
class Lines {
 private index=0;
 constructor(private lines:string[]){}
 get done(){return this.index>=this.lines.length;}
 peek(){return this.lines[this.index];}
 next(){if(this.index>=this.lines.length)throw new Error('Unexpected end of FX project.');return this.lines[this.index++];}
 /** ReadFieldImpl: a `NAME: value` line whose name must match. */
 field(name:string){const line=this.next(),space=line.indexOf(' '),tag=space<0?line:line.slice(0,space);if(tag!==name)throw new Error(`FX project expected ${name} but read ${tag}.`);return space<0?'':line.slice(space+1).trim();}
 number(name:string){const value=Number.parseFloat(this.field(name));if(!Number.isFinite(value))throw new Error(`Invalid FX value for ${name}.`);return value;}
 tag(name:string){const line=this.next();if(line!==name)throw new Error(`FX project expected ${name} but read ${line}.`);}
}
/** FxInterpInfo*_c::Load: each channel re-reads LOOPED/NUM_KEYS and writes the shared time array. */
function readInterp(lines:Lines,layout:InfoLayout):FxInterp{
 const interp:FxInterp={looped:false,times:[],keys:[]};
 for(let channel=0;channel<layout.count;channel++){
  lines.next();lines.tag('FX_INTERP_DATA:');
  interp.looped=lines.number('LOOPED:')!==0;const count=Math.trunc(lines.number('NUM_KEYS:'));if(count<1||count>127)throw new Error('Invalid FX key count.');
  const keys:number[]=[];
  for(let key=0;key<count;key++){lines.tag('FX_KEYFLOAT_DATA:');interp.times[key]=wrapU16(f(f(lines.number('TIME:'))*256))/256;keys.push(decodeKey(layout.kind,lines.number('VAL:')));}
  interp.times.length=count;interp.keys.push(keys);
 }
 return interp;
}
/** FxManager_c::LoadFxProject over effects.fxp text (blank lines carry no fields). */
export function readFxProject(text:string):FxSystemBlueprint[]{
 if(text.length>4*1024*1024)throw new Error('FX project exceeds 4 MiB.');
 const lines=new Lines(text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0));
 lines.tag('FX_PROJECT_DATA:');
 const systems:FxSystemBlueprint[]=[];
 while(!lines.done&&lines.peek()==='FX_SYSTEM_DATA:'){
  lines.next();const version=Math.trunc(Number(lines.next()));if(!(version>=100&&version<=109))throw new Error(`Unsupported FX version ${version}.`);
  if(version>100)lines.field('FILENAME:');
  const name=lines.field('NAME:'),length=lines.number('LENGTH:');
  const loopIntervalMin=version<106?0:lines.number('LOOPINTERVALMIN:'),loopLength=version<106?0:lines.number('LENGTH:');
  const playMode=Math.trunc(lines.number('PLAYMODE:'))&255,cullDistance=wrapU16(f(f(lines.number('CULLDIST:'))*256));
  let boundingSphere:FxSystemBlueprint['boundingSphere'];
  if(version>103){const [x,y,z,radius]=lines.field('BOUNDINGSPHERE:').split(/\s+/).map(Number);if([x,y,z,radius].some(v=>!Number.isFinite(v)))throw new Error('Invalid FX bounding sphere.');if(radius>0)boundingSphere={x:f(x),y:f(y),z:f(z),radius:f(radius)};}
  const primCount=Math.trunc(lines.number('NUM_PRIMS:'));if(primCount<0||primCount>=8)throw new Error('Invalid FX prim count.');
  const prims:FxPrimBlueprint[]=[];
  for(let p=0;p<primCount;p++){
   lines.tag('FX_PRIM_EMITTER_DATA:');lines.tag('FX_PRIM_BASE_DATA:');
   const primName=lines.field('NAME:'),values=lines.field('MATRIX:').split(/\s+/).map(Number);if(values.length!==12||values.some(v=>!Number.isFinite(v)))throw new Error('Invalid FX prim matrix.');
   const identity=[1,0,0,0,1,0,0,0,1,0,0,0].every((v,i)=>f(values[i])===v);
   const matrix=identity?undefined:values.map(v=>wrap16(f(f(v)*32767))/32767);
   const textures=[lines.field('TEXTURE:')];if(version>101)textures.push(lines.field('TEXTURE2:'),lines.field('TEXTURE3:'),lines.field('TEXTURE4:'));
   const alphaOn=lines.number('ALPHAON:')!==0,srcBlend=Math.trunc(lines.number('SRCBLENDID:'))&255,dstBlend=Math.trunc(lines.number('DSTBLENDID:'))&255;
   const infoCount=Math.trunc(lines.number('NUM_INFOS:'));if(infoCount<0||infoCount>64)throw new Error('Invalid FX info count.');
   const infos:FxInfoBlueprint[]=[];
   for(let i=0;i<infoCount;i++){
    const tag=lines.next(),type=TYPE_BY_TAG.get(tag);if(type===undefined)throw new Error(`Unknown FX info ${tag}.`);
    const timeModeParticle=(type&0xf000)>0x1000?lines.number('TIMEMODEPRT:')!==0:true;
    const layout=LAYOUT[type],count=type===FX_INFO.size&&version<105?2:layout.count;
    infos.push({type,timeModeParticle,interp:readInterp(lines,{...layout,count})});
   }
   const first=(test:(type:number)=>boolean)=>{const index=infos.findIndex(info=>test(info.type));return index<0?undefined:index;};
   const renderOffset=first(t=>t>=0x4000)??infos.length,movementOffset=first(t=>t>=0x2000)??renderOffset;
   prims.push({name:primName,matrix,textures:textures.map((t,i)=>i>0&&t==='NULL'?undefined:t),alphaOn,srcBlend,dstBlend,
    lodStart:wrapU16(f(f(lines.number('LODSTART:'))*64)),lodEnd:wrapU16(f(f(lines.number('LODEND:'))*64)),
    infos,movementOffset,renderOffset,hasFlat:infos.some(i=>i.type===FX_INFO.flat),hasHeatHaze:infos.some(i=>i.type===FX_INFO.heatHaze)});
  }
  if(version>=108)lines.field('OMITTEXTURES:');
  if(version>=109)lines.field('TXDNAME:');
  systems.push({name,length:f(length),loopIntervalMin:f(loopIntervalMin),loopLength:f(loopLength),playMode,cullDistance,boundingSphere,prims});
 }
 return systems;
}
/** FxInterpInfo*_c::GetVal(values, time): piecewise-linear keys; a single key is constant, times past the last key hold it
 * and times before the second key extrapolate from the first segment, as the native search starts at key 1. */
export function fxInterpolate(interp:FxInterp,time:number,out:number[]){
 const count=interp.times.length;
 if(count===1){for(let c=0;c<interp.keys.length;c++)out[c]=interp.keys[c][0];return out;}
 let t=time;
 if(interp.looped){const total=interp.times[count-1];if(total>0)t=t-Math.floor(t/total)*total;}
 let key=1;while(key<count&&!(t<interp.times[key]))key++;
 if(key>=count){for(let c=0;c<interp.keys.length;c++)out[c]=interp.keys[c][count-1];return out;}
 const t0=interp.times[key-1],t1=interp.times[key],amount=t1>t0?(t-t0)/(t1-t0):0;
 for(let c=0;c<interp.keys.length;c++){const k=interp.keys[c];out[c]=(k[key]-k[key-1])*amount+k[key-1];}
 return out;
}
/** FxInterpInfoFloat_c::GetVal(attrib, time, delta): the channel integrated over [time - delta, time]. */
export function fxIntegrate(interp:FxInterp,channel:number,time:number,delta:number){
 if(!(delta>0))return 0;
 const start=time-delta,value=(t:number)=>fxInterpolate(interp,t,[])[channel];
 const points=[start,...interp.times.filter(t=>t>start&&t<time),time];
 let sum=0;for(let i=1;i<points.length;i++)sum+=(value(points[i-1])+value(points[i]))*.5*(points[i]-points[i-1]);
 return sum;
}
