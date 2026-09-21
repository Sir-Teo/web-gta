import {requireAsset} from '../assets/binary';
/* CTheCarGenerators and CCarGenerator's script-facing half, pinned gta-reversed ead3051
 * (`CreateCarGenerator` 0x6F31A0, `Init` 0x6F3270, `CCarGenerator::Setup` 0x6F31A0 region,
 * `SwitchOff` 0x6F2E30, `SwitchOn` 0x6F32C0, `CalcNextGen` 0x6F2E40). The array holds the
 * records a script creates; the spawning half (`Process`, `DoInternalProcessing`) already
 * lives with the world's own IPL generators in src/assets/worldCarGenerators.ts. */
/** CTheCarGenerators::NUM_CAR_GENERATORS. */
export const NUM_CAR_GENERATORS=500;
/** MODEL_VEHICLE_FIRST and MODEL_VEG_PALMKB8: CreateCarGenerator refuses anything else but -1. */
export const GENERATOR_MODEL_FIRST=400,GENERATOR_MODEL_LAST=630;
/** m_nGenerateCount for a generator that always spawns; the script asks for it with a count of 101. */
export const GENERATE_ALWAYS=0xffff,SCRIPT_GENERATE_ALWAYS=101;
export interface ScmCarGenerator {
 position:[number,number,number];
 /** m_nAngle: the heading packed into a signed byte, angle × 256/360. */
 angle:number;
 modelId:number;primaryColour:number;secondaryColour:number;
 waitUntilFarFromPlayer:boolean;highPriority:boolean;playerHasAlreadyOwnedCar:boolean;ignorePopulationLimit:boolean;
 alarmChance:number;doorLockChance:number;minDelay:number;maxDelay:number;iplId:number;
 vehicleHandle:number;nextGenTime:number;generateCount:number;used:boolean;
}
const byte=(value:number)=>{const wrapped=Math.trunc(value)&255;return wrapped>127?wrapped-256:wrapped;};
/** CTheCarGenerators: five hundred slots, of which a script fills the ones no IPL took. */
export class ScmCarGenerators {
 readonly generators:ScmCarGenerator[]=[];
 /** CTheCarGenerators::GenerateEvenIfPlayerIsCloseCounter, set when a script wants its cars now. */
 generateEvenIfPlayerIsCloseCounter=0;
 get count(){return this.generators.filter(g=>g.used).length;}
 /** CCarGenerator::CalcNextGen (0x6F2E40). */
 static calcNextGen(nowMs:number){return (nowMs+4)>>>0;}
 /** CTheCarGenerators::CreateCarGenerator (0x6F31A0): the first free slot, or -1 when the model is not a
  * vehicle or every slot is taken. The script's command does not pass an IPL identifier or the population
  * exemption, so the record takes the defaults an unlisted generator has. */
 create(options:{position:readonly [number,number,number];angle:number;modelId:number;primaryColour:number;secondaryColour:number;forceSpawn:boolean;alarmChance:number;doorLockChance:number;minDelay:number;maxDelay:number;iplId?:number;ignorePopulationLimit?:boolean},nowMs:number){
  const {modelId}=options;
  requireAsset(Number.isInteger(modelId),'Car generator model must be an integer.');
  if(modelId!==-1&&(modelId<GENERATOR_MODEL_FIRST||modelId>GENERATOR_MODEL_LAST))return -1;
  requireAsset(options.position.every(Number.isFinite)&&Number.isFinite(options.angle),'Invalid car generator placement.');
  const index=this.generators.findIndex(g=>!g.used);
  if(index<0&&this.generators.length>=NUM_CAR_GENERATORS)return -1;
  const record:ScmCarGenerator={
   position:[options.position[0],options.position[1],options.position[2]],
   angle:byte(options.angle*256/360),
   modelId,primaryColour:byte(options.primaryColour),secondaryColour:byte(options.secondaryColour),
   waitUntilFarFromPlayer:false,highPriority:options.forceSpawn,playerHasAlreadyOwnedCar:false,
   ignorePopulationLimit:!!options.ignorePopulationLimit,
   alarmChance:options.alarmChance&255,doorLockChance:options.doorLockChance&255,
   minDelay:options.minDelay&0xffff,maxDelay:options.maxDelay&0xffff,iplId:(options.iplId??0)&255,
   vehicleHandle:-1,nextGenTime:(nowMs+1)>>>0,generateCount:0,used:true,
  };
  if(index<0){this.generators.push(record);return this.generators.length-1;}
  this.generators[index]=record;return index;
 }
 at(index:number){
  requireAsset(Number.isInteger(index)&&index>=0&&index<this.generators.length,'Car generator index out of range.');
  return this.generators[index];
 }
 /** SWITCH_CAR_GENERATOR (VehicleCommands.cpp, reversed): none turns the generator off; any other count
  * switches it on, which means always, and only then is a count of a hundred or fewer written over that. The
  * script's 101 is how it asks for always, since it is the first count the overwrite leaves alone. */
 switch(index:number,count:number,nowMs:number){
  const generator=this.at(index);
  requireAsset(Number.isInteger(count)&&count>=0,'Invalid car generator count.');
  if(count===0){generator.generateCount=0;return;}
  generator.generateCount=GENERATE_ALWAYS;
  generator.nextGenTime=ScmCarGenerators.calcNextGen(nowMs);
  if(count<=100)generator.generateCount=count;
 }
 /* CSpecialPlateHandler (SpecialPlateHandler.cpp 0x6F2D90, reversed): fifteen plate entries, each a generator
  * id and its text. A sixteenth is dropped. Init leaves every id at -1. */
 readonly plates:{generator:number;text:string}[]=[];
 /** CSpecialPlateHandler::Add. */
 addPlate(generator:number,text:string){
  if(this.plates.length>=15)return false;
  this.plates.push({generator,text});return true;
 }
 /** CSpecialPlateHandler::Find: the text for a generator, or nothing. */
 plateFor(generator:number){return this.plates.find(entry=>entry.generator===generator)?.text;}
 /** SET_HAS_BEEN_OWNED_FOR_CAR_GENERATOR: bPlayerHasAlreadyOwnedCar. */
 setHasBeenOwned(index:number,owned:boolean){this.at(index).playerHasAlreadyOwnedCar=owned;}
}
