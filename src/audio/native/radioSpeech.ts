/** Native radio stations (CAEVehicleAudioEntity radio): 11 SA stations by
 * VehicleAudioSettings RadioType. The bed is a CAETwinLoopSoundEntity-style
 * twin loop from the frontend bank (no music banks are local); each station
 * gets its swap interval, rate and start offsets. Switching follows the
 * native entity. */
export const RADIO_STATIONS=['Playback FM','K-Rose','K-DST','Bounce FM','SF-UR','Radio Los Santos','Radio X','CSR 103.9','K-Jah West','Master Sounds','WCTR'] as const;
export type RadioStation=(typeof RADIO_STATIONS)[number];
export function radioStationFor(type:string,index:number):RadioStation{
 const i=Math.abs(index)%RADIO_STATIONS.length;
 void type;
 return RADIO_STATIONS[i];
}
export function nextStation(current:RadioStation,dir=1){
 const i=RADIO_STATIONS.indexOf(current);
 return RADIO_STATIONS[(i+dir+RADIO_STATIONS.length)%RADIO_STATIONS.length];
}
/** Twin-loop bed parameters per station (swap interval ms, rate, start offsets). */
export function radioBedParams(station:RadioStation){
 const i=Math.max(0,RADIO_STATIONS.indexOf(station));
 return {swapMin:200+i*80,swapMax:400+i*80,speed:0.9+i*0.02,offsetA:(i*7)%100,offsetB:(i*37+50)%100};
}
/** Native ped speech (CAEPedSpeechAudioEntity): comment events mapped onto the
 * local combat-bank vocal range (dedicated speech banks are not local). */
export type SpeechEvent='pain'|'flee'|'greet'|'threat'|'busted'|'wasted'|'jacked';
export function speechSample(event:SpeechEvent,seed:number){
 const s=Math.abs(seed)%6;
 switch(event){
  case 'pain':return {bank:143,sample:30+s};
  case 'flee':return {bank:143,sample:30+(s+2)%6};
  case 'greet':return {bank:143,sample:30+(s+4)%6};
  case 'threat':return {bank:143,sample:30+(s+1)%6};
  default:return {bank:143,sample:30};
 }
}
