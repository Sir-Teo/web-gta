import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions} from './scm';
export interface ScmStuntJump {
 /** Stable save key: the command's script offset. */
 id:string;offset:number;
 /** Native axis-aligned boxes the vehicle must leave and reach. */
 start:{min:[number,number,number];max:[number,number,number]};
 end:{min:[number,number,number];max:[number,number,number]};
 /** MODE_FIXED camera source (native). */
 camera:[number,number,number];
 reward:number;
}
/** ADD_STUNT_JUMP (0x0814) from the INITIAL mission. The script passes each box as a centre and a radius: the handler is not
 * reversed, but every jump's ramp and landing sit inside centre ± radius and above the centre + radius corner, so the boxes are
 * built as CBoundingBox{centre − radius, centre + radius} before CStuntJumpManager::AddOne stores them. */
export function readInitialStuntJumps(bytes:Uint8Array){
 const header=readScmHeader(bytes),mission=header.missions[0];
 requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end);
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const jumps:ScmStuntJump[]=[];
 for(const instruction of code){
  if(instruction.name!=='ADD_STUNT_JUMP')continue;
  const values=instruction.parameters.map(p=>{requireAsset(typeof p.value==='number'&&Number.isFinite(p.value),'Stunt jump requires literal numbers.');return p.value as number;});
  requireAsset(values.length===16,'Stunt jump expects sixteen operands.');
  requireAsset(values.slice(3,6).every(v=>v>0)&&values.slice(9,12).every(v=>v>0),'Stunt jump radii must be positive.');
  requireAsset(Number.isInteger(values[15])&&values[15]>=0&&values[15]<=1000000,'Invalid stunt jump reward.');
  const box=(centre:number[],radius:number[])=>({min:centre.map((v,i)=>v-radius[i]) as [number,number,number],max:centre.map((v,i)=>v+radius[i]) as [number,number,number]});
  jumps.push({id:`jump:${instruction.offset}`,offset:instruction.offset,start:box(values.slice(0,3),values.slice(3,6)),end:box(values.slice(6,9),values.slice(9,12)),camera:values.slice(12,15) as [number,number,number],reward:values[15]});
  requireAsset(jumps.length<=256,'Too many stunt jumps.');
 }
 return jumps;
}
