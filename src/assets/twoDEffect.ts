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
export interface Model2dEffect {position:[number,number,number];type:number;light?:ModelLightEffect;particle?:string}
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
  out.push(effect);
 }
 requireAsset(r.position===bytes.length,'Unexpected 2d effect plugin payload.');
 return out;
}
