import type {ImgEntry} from './img';
import {readImgEntry} from './img';
import {readIpl} from './ipl';
import type {IplCarGenerator} from './iplCarGenerator';
import {requireAsset} from './binary';
export interface WorldCarGenerator extends IplCarGenerator {id:string;source:string;sourceIndex:number}
/** Index the one native world's generators. External IPLs override equal archive
 * basenames, matching placement import precedence; record order/identity is stable. */
export async function readWorldCarGenerators(archive:Blob,entries:readonly ImgEntry[],files:readonly {path:string;file:Blob}[]){
 const output:WorldCarGenerator[]=[],overrides=new Set<string>();
 const add=(source:string,bytes:Uint8Array)=>{readIpl(bytes).carGenerators.forEach((generator,sourceIndex)=>output.push({...generator,id:`${source}:${sourceIndex}`,source,sourceIndex}));requireAsset(output.length<=200000,'World exceeds the 200,000 vehicle generator limit.');};
 for(const input of [...files].sort((a,b)=>a.path.localeCompare(b.path))){if(!input.path.toLowerCase().endsWith('.ipl'))continue;const name=input.path.replace(/\\/g,'/').split('/').at(-1)!.toLowerCase();requireAsset(!overrides.has(name),`Ambiguous external generator IPL: ${name}`);overrides.add(name);add(input.path,new Uint8Array(await input.file.arrayBuffer()));}
 for(const entry of entries){if(entry.name.toLowerCase().endsWith('.ipl')&&!overrides.has(entry.name.toLowerCase()))add(`gta3.img/${entry.name}`,await readImgEntry(archive,entry));}
 return output;
}
export function carGeneratorsInRegion(records:readonly WorldCarGenerator[],region:{x:number;y:number;radius:number}){
 requireAsset([region.x,region.y,region.radius].every(Number.isFinite)&&region.radius>0,'Invalid vehicle generator region.');
 const squared=region.radius**2;return records.filter(g=>(g.position[0]-region.x)**2+(g.position[1]-region.y)**2<=squared);
}
/** CCarGenerator::DoInternalProcessing: the record's alarmChance is a percentage; an armed alarm (m_nAlarmState -1)
 * sounds for 15 s once the car collides with another vehicle (CPhysical::AddCollisionRecord). */
export function rollAlarm(alarmChance:number,random:()=>number=Math.random){
 if(!Number.isFinite(alarmChance))return false;
 return random()*100<Math.max(0,Math.min(100,alarmChance));
}
/** CCarGenerator door locks: the record's doorLockChance is a percentage; rattling a locked door three times within 30 s picks it (break-in progression). */
export function rollDoorLock(doorLockChance:number,random:()=>number=Math.random){
 if(!Number.isFinite(doorLockChance))return false;
 return random()*100<Math.max(0,Math.min(100,doorLockChance));
}

/** CFileCarGenerator flags: bit 0 force spawn (bHighPriority), bit 1 ignore the parked population limit. */
export function generatorFlags(flags:number){return {forceSpawn:(flags&1)!==0,ignorePopulationLimit:(flags&2)!==0};}
/** CCarGenerator::DoInternalProcessing: at most 5 parked cars by day and 10 between 21:00 and 7:00 (CClock::ClockHoursInRange(21, 7)). */
export function parkedCarLimit(hour:number){return hour>=21||hour<7?10:5;}
export const GENERATOR_RANGE=160,GENERATOR_NEAR_BAND=20,GENERATOR_HEIGHT=50,GENERATE_EVEN_IF_CLOSE_FRAMES=20,GENERATOR_TAKEN_WAIT_MS=60000;
/** CCarGenerator::CheckIfWithinRangeOfAnyPlayers for one generator: `rel` is the player's position less the
 * generator's on the plane (native x, y) with `dz` the height difference, `speed` the player's planar velocity.
 * Out of 160 units (or 50 high) the generator is idle and its wait-until-far flag clears; within it the start
 * window (GenerateEvenIfPlayerIsCloseCounter) allows any spawn, a waiting generator none, and otherwise only the
 * 140 to 160 band (any distance for a force-spawn record) while the player heads toward it. */
export function generatorInRange(rel:{x:number;y:number},dz:number,speed:{x:number;y:number},waitFar:boolean,forceSpawn:boolean,closeCounter:number,generationMult=1):{eligible:boolean;waitFar:boolean}{
 if(Math.abs(dz)>GENERATOR_HEIGHT)return {eligible:false,waitFar};
 const d=Math.hypot(rel.x,rel.y);
 if(d>=generationMult*GENERATOR_RANGE)return {eligible:false,waitFar:false};
 if(closeCounter>0)return {eligible:true,waitFar};
 if(waitFar)return {eligible:false,waitFar};
 const approaching=speed.x*rel.x+speed.y*rel.y<=0;
 return {eligible:(d>=generationMult*GENERATOR_RANGE-GENERATOR_NEAR_BAND||forceSpawn)&&approaching,waitFar};
}
