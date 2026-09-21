import {BinaryReader,requireAsset} from './binary';

/** 2d Effect geometry plugin (rwID 0x0253F2F8, gta-reversed 2dEffectStream.h). Positions are model space, native. */
export const TWO_D_EFFECT_PLUGIN=0x253f2f8;
/** e2dEffectType. */
export const EFFECT={light:0,particle:1,attractor:3,sunGlare:4,interior:5,enex:6,roadsign:7,triggerPoint:8,coverPoint:9,escalator:10} as const;

/** t2dEffectLightStreamData, with Flags1 | Flags2 << 8 as tEffectLight::m_nFlags. */
export interface ModelLightEffect {
 color:[number,number,number,number];coronaFarClip:number;pointlightRange:number;coronaSize:number;shadowSize:number;
 /** e2dCoronaFlashType. */
 flashType:number;enableReflection:boolean;flareType:number;shadowColorMultiplier:number;
 /** m_nFlags: 1 check obstacles, 2–4 fog type, 8 without corona, 16 only long distance, 32 at day, 64 at night,
  * 128 blinking 1, 256 only from below, 512 blinking 2, 1024 update height above ground, 2048 check direction,
  * 4096 blinking 3. */
 flags:number;coronaTexture:string;shadowTexture:string;shadowZDistance:number;
 /** The optional look direction (signed bytes) that m_bCheckDirection tests. */
 offset:[number,number,number];
}
/** ePedAttractorType. */
export const PED_ATTRACTOR={atm:0,seat:1,stop:2,pizza:3,shelter:4,triggerScript:5,lookAt:6,scripted:7,park:8,step:9} as const;
/** t2dEffectPedAttractorStreamData (C2dEffectPedAttractor): the queue, use and forward directions in model space,
 * the attractor type, the external script name and the ped-existing probability. */
export interface ModelAttractorEffect {
 type:number;queueDir:[number,number,number];useDir:[number,number,number];forwardDir:[number,number,number];
 scriptName:string;probability:number;
}
/** t2dEffectRoadsignStreamData (C2dEffectRoadsign): the sign's size, its rotation about Z, X then Y (degrees), the
 * CRoadsignAttrFlags bit pairs (lines, symbols per line, text colour) and the four 16-character text lines. */
export interface ModelRoadsignEffect {size:[number,number];rotation:[number,number,number];flags:number;lines:[string,string,string,string]}
/** C2dEffect::Roadsign_GetNumLinesFromFlags, Roadsign_GetNumLettersFromFlags and Roadsign_GetPaletteIDFromFlags. */
export function roadsignNumLines(flags:number){const v=flags&3;return v===0?4:v;}
export function roadsignNumLetters(flags:number){const v=flags>>2&3;return v===1?2:v===2?4:v===3?8:16;}
export function roadsignPalette(flags:number){return flags>>4&3;}
/** t2dEffectEscalatorStreamData (C2dEffectEscalator): the sloped run's bottom and top and the upper run's end in
 * model space, with the direction (0 down, 1 up). The effect's own position is the lower run's start. */
export interface ModelEscalatorEffect {bottom:[number,number,number];top:[number,number,number];end:[number,number,number];direction:number}
export interface Model2dEffect {position:[number,number,number];type:number;light?:ModelLightEffect;particle?:string;attractor?:ModelAttractorEffect;roadsign?:ModelRoadsignEffect;escalator?:ModelEscalatorEffect}
export const LIGHT_FLAG={checkObstacles:1,withoutCorona:8,onlyLongDistance:16,atDay:32,atNight:64,blinking1:128,onlyFromBelow:256,blinking2:512,updateHeightAboveGround:1024,checkDirection:2048,blinking3:4096} as const;

/** The plugin's entry count, then per entry position, type and data size, as `t2dEffectPluginStreamRead` reads them. */
export function readTwoDEffects(bytes:Uint8Array):Model2dEffect[]{
 const r=new BinaryReader(bytes),count=r.u32();
 requireAsset(count<=4096,'2d effect count exceeds 4096.');
 const out:Model2dEffect[]=[];
 for(let i=0;i<count;i++){
  const position:[number,number,number]=[r.f32(),r.f32(),r.f32()],type=r.u32(),size=r.u32();
  requireAsset(position.every(Number.isFinite)&&size<=bytes.length-r.position,'Invalid 2d effect entry.');
  const data=new BinaryReader(r.take(size));
  const effect:Model2dEffect={position,type};
  if(type===EFFECT.light){
   requireAsset(size===76||size===80,'2d effect light needs 76 or 80 bytes.');
   const color:[number,number,number,number]=[data.u8(),data.u8(),data.u8(),data.u8()];
   const coronaFarClip=data.f32(),pointlightRange=data.f32(),coronaSize=data.f32(),shadowSize=data.f32();
   const flashType=data.u8(),enableReflection=data.u8()!==0,flareType=data.u8(),shadowColorMultiplier=data.u8(),flags1=data.u8();
   const coronaTexture=data.name(24),shadowTexture=data.name(24),shadowZDistance=data.u8(),flags2=data.u8();
   const signed=(v:number)=>v>127?v-256:v,offset:[number,number,number]=size===80?[signed(data.u8()),signed(data.u8()),signed(data.u8())]:[0,0,0];
   effect.light={color,coronaFarClip,pointlightRange,coronaSize,shadowSize,flashType,enableReflection,flareType,shadowColorMultiplier,flags:flags1|flags2<<8,coronaTexture,shadowTexture,shadowZDistance,offset};
  }else if(type===EFFECT.particle){requireAsset(size===24,'2d effect particle needs 24 bytes.');effect.particle=data.name(24);}
  else if(type===EFFECT.escalator){
   requireAsset(size===40,'2d effect escalator needs 40 bytes.');
   const vec=():[number,number,number]=>[data.f32(),data.f32(),data.f32()];
   const bottom=vec(),top=vec(),end=vec(),direction=data.u8();
   requireAsset([...bottom,...top,...end].every(Number.isFinite),'Invalid escalator points.');
   effect.escalator={bottom,top,end,direction};
  }
  else if(type===EFFECT.roadsign){
   requireAsset(size===88,'2d effect roadsign needs 88 bytes.');
   const sizeXY:[number,number]=[data.f32(),data.f32()],rotation:[number,number,number]=[data.f32(),data.f32(),data.f32()],flags=data.u16();
   requireAsset([...sizeXY,...rotation].every(Number.isFinite),'Invalid roadsign size or rotation.');
   data.u16();
   const line=()=>{const raw=data.take(16);let n=0;while(n<16&&raw[n]!==0)n++;return String.fromCharCode(...raw.subarray(0,n));};
   effect.roadsign={size:sizeXY,rotation,flags,lines:[line(),line(),line(),line()]};
  }
  else if(type===EFFECT.attractor){
   requireAsset(size===56,'2d effect ped attractor needs 56 bytes.');
   const attractorType=data.u32()|0,vec=():[number,number,number]=>[data.f32(),data.f32(),data.f32()];
   const queueDir=vec(),useDir=vec(),forwardDir=vec(),scriptName=data.name(8),probability=data.u32()|0;
   requireAsset([...queueDir,...useDir,...forwardDir].every(Number.isFinite),'Invalid ped attractor directions.');
   effect.attractor={type:attractorType,queueDir,useDir,forwardDir,scriptName,probability};
  }
  out.push(effect);
 }
 requireAsset(r.position===bytes.length,'Unexpected 2d effect plugin payload.');
 return out;
}
