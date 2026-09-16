/** CVehicle::UsesSiren (0x6D8470): fire truck, ambulance, Mr Whoopee and law enforcement vehicles except the Rhino. */
export const NATIVE_SIREN_MODELS:ReadonlySet<number>=new Set([407,416,423,427,430,433,490,523,528,596,597,598,599,601]);
/** CVehicle::ProcessSirenAndHorn (0x6E0950) is not reversed; this follows reVC's player branch over CPad's five-frame bHornHistory:
 * holding the horn sounds it, a tap shorter than four frames toggles bSirenOrAlarm on siren vehicles. Call once per game frame. */
export class NativeHornInput {
 private history=[false,false,false,false,false];private current=0;
 process(vehicle:{horn:{counter:number};siren:boolean},held:boolean,usesSiren:boolean){
  this.current=(this.current+1)%5;this.history[this.current]=held;
  const now=this.history[this.current],previous=this.history[(this.current+4)%5],oldest=this.history[(this.current+1)%5];
  if(usesSiren){
   if(now)vehicle.horn.counter=previous?1:0;
   else if(previous&&!oldest){vehicle.horn.counter=0;vehicle.siren=!vehicle.siren;}
   else vehicle.horn.counter=0;
  }else vehicle.horn.counter=held?1:0;
 }
}
