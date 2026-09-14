import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions,type ScmInstruction} from './scm';
import type {WorldZones} from './worldZones';
export interface ZonePopulation {popType:number;gangStrength:number[];dealerStrength:number;races:number;noCops:boolean}
const mutations=new Set(['SET_ZONE_POPULATION_TYPE','SET_ZONE_GANG_STRENGTH','SET_ZONE_DEALER_STRENGTH','SET_ZONE_POPULATION_RACE','SET_ZONE_NO_COPS']);
/** Import the inspected INITIAL mission's straight-line initialization block.
 * This is a new-game state profile, not a script VM or mission completion. */
export function readInitialZonePopulation(bytes:Uint8Array,zones:WorldZones){
 const header=readScmHeader(bytes),main=decodeScmInstructions(bytes,header.entry,header.mainSize);
 const launch=main.find(i=>i.name==='LOAD_AND_LAUNCH_MISSION_INTERNAL');
 requireAsset(launch?.parameters[0]?.value===0,'Expected initialization mission 0.');
 const mission=header.missions[0];requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end),starts=code.filter(i=>i.name==='INIT_ZONE_POPULATION_SETTINGS');
 requireAsset(starts.length===1,'Missing or ambiguous initial zone settings block.');
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const start=code.indexOf(starts[0]),commands:ScmInstruction[]=[];
 for(const instruction of code.slice(start+1)){if(!mutations.has(instruction.name))break;requireAsset(!(instruction.opcode&0x8000),'Negated initial zone mutation.');commands.push(instruction);}
 requireAsset(commands.length>0,'Empty initial zone settings block.');
 const population:ZonePopulation[]=zones.infoLabels.map(()=>({popType:5,gangStrength:Array(10).fill(0),dealerStrength:0,races:15,noCops:false}));
 const unresolved:{label:string;offset:number;command:string}[]=[],counts:Record<string,number>={};
 for(const instruction of commands){
  counts[instruction.name]=(counts[instruction.name]??0)+1;
  const [label,...args]=instruction.parameters;requireAsset(label?.type===9&&typeof label.value==='string','Zone initialization requires a literal label.');
  const values=args.map(arg=>{requireAsset([1,4,5].includes(arg.type)&&typeof arg.value==='number'&&Number.isInteger(arg.value),'Zone initialization requires literal integers.');return arg.value;});
  const index=zones.infoLabels.indexOf(label.value);if(index<0){unresolved.push({label:label.value,offset:instruction.offset,command:instruction.name});continue;}
  const state=population[index],value=values[0];
  switch(instruction.name){
   case 'SET_ZONE_POPULATION_TYPE':requireAsset(value>=0&&value<20,'Invalid zone population type.');state.popType=value;break;
   case 'SET_ZONE_GANG_STRENGTH':requireAsset(value>=0&&value<10&&values[1]>=0&&values[1]<=255,'Invalid zone gang assignment.');state.gangStrength[value]=values[1];break;
   case 'SET_ZONE_DEALER_STRENGTH':requireAsset(value>=0&&value<=255,'Invalid zone dealer strength.');state.dealerStrength=value;break;
   case 'SET_ZONE_POPULATION_RACE':requireAsset(value>=0&&value<=15,'Invalid zone race mask.');state.races=value;break;
   case 'SET_ZONE_NO_COPS':requireAsset(value===0||value===1,'Invalid zone police flag.');state.noCops=!!value;break;
  }
 }
 return {population,unresolved,counts,mission:0,launchOffset:launch.offset,blockStart:starts[0].offset,blockEnd:commands.at(-1)!.end};
}
