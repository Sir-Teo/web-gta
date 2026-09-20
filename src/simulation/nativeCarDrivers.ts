/** CPopulation::FindSpecificDriverModelForCar_ToUse (gta-reversed ead3051): some cars come with their own driver.
 * The Stretch has its chauffeur, the Taxi and Cabbie a cab driver, Mr Whoopee the ice-cream man, the Securicar a
 * guard, the Pizzaboy a pizza rider, the BMX its rider, and the Freeway one of two bikers on a third of the draws
 * each; every other car takes a civilian from the zone roster. */
/** CStreaming::GetDefaultCabDriverModel: two cab driver models per city (Los Santos, San Fierro, Las Venturas). */
export const CAB_DRIVER_MODELS=[['bmocd','wmycd1'],['sbmocd','swmocd'],['vbmocd','vwmycd']] as const;
export class SpecificDrivers {
 /** `s_LastRandomIndex`: the cab driver stays while his model is loaded (here: while the city is the same); the
  * first draw and each new city pick one of the city's two. */
 private cabIndex=-1;
 constructor(private random:()=>number=Math.random){}
 /** The cab driver for a zone level (1 Los Santos, 2 San Fierro, 3 Las Venturas; the countryside keeps the last one). */
 cabDriver(level:number){
  const city=level>=1&&level<=3;
  if(this.cabIndex<0||city&&Math.floor(this.cabIndex/2)!==level-1)this.cabIndex=city?2*(level-1)+Math.floor(this.random()*2):0;
  return CAB_DRIVER_MODELS[Math.floor(this.cabIndex/2)][this.cabIndex%2];
 }
 /** The fixed driver for a vehicles.ide model name, or undefined when the car takes a civilian. */
 forCar(modelName:string|undefined,level:number):string|undefined{
  switch(modelName?.toLowerCase()){
   case 'stretch':return 'wmych';
   case 'taxi':case 'cabbie':return this.cabDriver(level);
   case 'mrwhoop':return 'wmoice';
   case 'securica':return 'wmysgrd';
   case 'pizzaboy':return 'wmypizz';
   case 'bmx':return 'wmybmx';
   case 'freeway':{const draw=Math.floor(this.random()*3);return draw===0?'bikera':draw===1?'bikerb':undefined;}
  }
  return undefined;
 }
}
