import type {LightPool} from '../world/nativeEntityLights';

/** CShadows::StoreShadowToBeRendered's texture overload (iOS 0x100388264). */
export const SCRIPT_SHADOW_TEXTURES=['shad_car','shad_ped','shad_exp','shad_heli','headlight','bloodpool_64'] as const;
export interface ScriptShadow extends LightPool {textureType:number}
/** DRAW_SHADOW (0x1001d2770): radians, float32 sin/cos products, byte type/RGB and signed 16-bit intensity. */
export function scriptShadow(textureType:number,x:number,y:number,z:number,angle:number,length:number,intensity:number,r:number,g:number,b:number):ScriptShadow|undefined{
 textureType&=255;if(textureType<1||textureType>6)return undefined;
 const f=Math.fround,a=f(angle),l=f(length),sin=a===0?0:f(f(Math.sin(a))*l),cos=a===0?l:f(f(Math.cos(a))*l);
 return {id:0,textureType,position:[f(x),f(y),f(z)],size:0,front:[-sin,cos],side:[cos,sin],intensity:(intensity<<16)>>16,color:[r&255,g&255,b&255],maxHeight:15,maxDistance:Infinity};
}

/** Script-owned portion of the native 48-entry, single-frame stored-shadow table. */
export class NativeScriptShadowQueue {
 private shadows:ScriptShadow[]=[];
 store(shadow:ScriptShadow){if(this.shadows.length<48)this.shadows.push({...shadow,id:this.shadows.length});}
 take(){const shadows=this.shadows;this.shadows=[];return shadows;}
}
