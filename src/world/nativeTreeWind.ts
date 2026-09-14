import {requireAsset} from '../assets/binary';
import {nativeGrassWind,type NativeGrassWindState} from './nativeGrassWind';

export interface NativeTreeWindState extends NativeGrassWindState {
 /** Native entity address, used only for the calm-wind phase. */
 address:number;
 /** Native world X/Y components. Do not normalize: the source does not. */
 direction:readonly [number,number];
}
const f=Math.fround;

/** AtomicModelInfo::SetAtomicModelInfoFlags assigns special types in order.
 * Unknown, tag and breakable-statue assignments override either tree type. */
export function nativeTreeType(flags:number):'tree'|'palm'|undefined{
 requireAsset(Number.isInteger(flags)&&flags>=0&&flags<=0xffffffff,'Invalid native IDE flags.');
 if(flags&(0x80000|0x100000|0x400000))return undefined;
 return flags&0x4000?'palm':flags&0x2000?'tree':undefined;
}

/** CEntity::ModifyMatrixForTreeInWind, before local wind modifiers.
 * Returns replacement X/Y values of the native modelling matrix's at column;
 * these are neither rotation angles nor offsets to add to the entity matrix. */
export function nativeTreeWind(state:NativeTreeWindState,palm:boolean):readonly [number,number]{
 const {milliseconds,seed,address,direction}=state;
 requireAsset(Number.isInteger(address)&&address>=0&&address<=0xffffffff&&direction.length===2&&direction.every(value=>Number.isFinite(value)&&Number.isFinite(f(value))),'Invalid native tree wind state.');
 // The high-wind table and equations are shared with PlantMgr. This also
 // validates the timer, wind strength and uint16 entity seed in either branch.
 const high=nativeGrassWind(milliseconds,state.wind,seed),wind=f(state.wind);
 let bend=high;
 if(wind<.5){
  const phase=(address+milliseconds)&0xfff;
  const angle=f(phase*f(f(6.28)/4096));
  bend=f(f(Math.sin(angle))*f(.005));
  if(wind>=f(.2))bend=f(bend*f(1.6));
 }
 if(palm)bend=f(bend+f(wind*f(.03)));
 return [f(bend*f(direction[0])),f(bend*f(direction[1]))];
}
