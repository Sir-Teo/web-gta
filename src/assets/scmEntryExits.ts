import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions,type ScmParameter} from './scm';

/** An entry exit change the INITIAL mission makes: SWITCH_ENTRY_EXIT by name, or SET_CLOSEST_ENTRY_EXIT_FLAG. */
export type ScmEntryExitSwitch=
 {kind:'switch';name:string;on:boolean}|
 {kind:'closest';x:number;y:number;radius:number;flag:number;on:boolean};

const LITERAL=new Set([1,4,5,6]);
/** INITIAL's entry exit commands in order, read without running the script: its global assignments give the
 * coordinates, and its entry exit section runs straight through on a new game. */
export function readInitialEntryExitSwitches(bytes:Uint8Array):ScmEntryExitSwitch[]{
 const header=readScmHeader(bytes),mission=header.missions[0];requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end);
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const globals=new Map<number,number>(),out:ScmEntryExitSwitch[]=[];
 const read=(p:ScmParameter|undefined)=>{
  if(!p||typeof p.value!=='number')return undefined;
  if(LITERAL.has(p.type))return p.value;
  if(p.type===2)return globals.get(p.value);
  return undefined;
 };
 for(const instruction of code){
  const [a,b,c,d,e]=instruction.parameters;
  if(instruction.name==='SET_VAR_INT'||instruction.name==='SET_VAR_FLOAT'){if(a?.type===2&&typeof a.value==='number'){const v=read(b);if(v!==undefined)globals.set(a.value,v);}continue;}
  if(instruction.name==='SWITCH_ENTRY_EXIT'){const on=read(b);if(typeof a?.value==='string'&&on!==undefined)out.push({kind:'switch',name:a.value,on:on!==0});continue;}
  if(instruction.name==='SET_CLOSEST_ENTRY_EXIT_FLAG'){
   const x=read(a),y=read(b),radius=read(c),flag=read(d),on=read(e);
   if(x!==undefined&&y!==undefined&&radius!==undefined&&flag!==undefined&&on!==undefined)out.push({kind:'closest',x,y,radius,flag,on:on!==0});
  }
 }
 return out;
}
