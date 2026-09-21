import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions} from './scm';

/** One `CRestart` entry: native coordinates, heading in degrees and the
 * `STAT_CITY_UNLOCKED` threshold the point becomes eligible at. */
export interface ScmRestartPoint {position:[number,number,number];heading:number;townId:number}
export interface ScmRestartPoints {hospitals:ScmRestartPoint[];police:ScmRestartPoint[]}

/** CRestart::MAX_RESTART_POINTS (Restart.h): ten slots per table. */
const MAX_RESTART_POINTS=10;

/** The INITIAL mission's ADD_HOSPITAL_RESTART (016C) and ADD_POLICE_RESTART
 * (016D) calls. Both take literal x/y/z, a heading in degrees and the town
 * identifier compared against STAT_CITY_UNLOCKED in
 * `CRestart::FindClosestHospitalRestartPoint`. This is data extraction: the
 * commands are read in source order, not executed. */
export function readInitialRestartPoints(bytes:Uint8Array):ScmRestartPoints{
 const header=readScmHeader(bytes),mission=header.missions[0];
 requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end);
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const hospitals:ScmRestartPoint[]=[],police:ScmRestartPoint[]=[];
 for(const instruction of code){
  const hospital=instruction.name==='ADD_HOSPITAL_RESTART';
  if(!hospital&&instruction.name!=='ADD_POLICE_RESTART')continue;
  const operands=instruction.parameters;
  requireAsset(operands.length===5,'Unexpected restart-point operand count.');
  const numbers=operands.map(operand=>{
   requireAsset([1,4,5,6].includes(operand.type)&&typeof operand.value==='number',`Restart point at ${instruction.offset} is not a literal.`);
   return operand.value as number;
  });
  const [x,y,z,heading,townId]=numbers;
  requireAsset(Number.isInteger(townId)&&townId>=0&&townId<=2,'Restart town identifier outside Los Santos/San Fierro/Las Venturas.');
  const target=hospital?hospitals:police;
  target.push({position:[x,y,z],heading,townId});
  requireAsset(target.length<=MAX_RESTART_POINTS,'Native restart-point capacity exceeded.');
 }
 requireAsset(hospitals.length>0&&police.length>0,'Missing hospital or police restart points.');
 return {hospitals,police};
}
