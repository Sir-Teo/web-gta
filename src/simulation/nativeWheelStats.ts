/* CPlayerInfo::Process's two-wheel, wheelie and stoppie counters (PC 0x56F8D0, unreversed; iOS 0x100253b24, the
 * block at 0x100253bac with its tails at 0x100254484 to 0x100254fa4). Each frame, with the player in a vehicle:
 * - a car (CAutomobile, every class of it) counts time and distance while one side's two wheels are off the ground
 *   and the other side's on it with no collision this frame; a frame off the pattern runs a grace buffer (each such
 *   frame adds its time, and a run on two wheels wears it down by half its time), and a run ends once a failing frame
 *   finds the buffer past 499 ms, or at once when neither side is clear. A run of 2 s or more is recorded;
 * - a bike (and a BMX) does the same for the rear wheel alone (a wheelie, recorded from 5 s) and the front wheel
 *   alone (a stoppie, from 2 s), the buffer worn down by a fifth; a wheelie ends at once when the front touches, a
 *   stoppie when the rear does. The executable's contact test is lopsided: the second of the touching wheel's two
 *   lines counts only with no collision, the first regardless;
 * - anything else, or no vehicle, clears the counters (not the distances) without recording.
 * A record overwrites the best fields (which GET_WHEELIE_STATS reads and clears) and raises the stats with
 * CStats::SetNewRecordStat: the time in whole seconds, the distance as summed. The counters are uint32 ms, the time
 * of a frame CTimer::ms_fTimeStep / 50 × 1000 truncated; the distance is m_fMovingSpeed, what the vehicle moved this
 * step. m_nCarLess3WheelCounter (fewer than three wheels down) feeds CAutomobile's in-air balance, which the port does
 * not model. */
export const STAT_LONGEST_WHEELIE_DISTANCE=10,STAT_LONGEST_STOPPIE_DISTANCE=11,STAT_LONGEST_2_WHEELS_DISTANCE=12,
 STAT_LONGEST_WHEELIE_TIME=17,STAT_LONGEST_STOPPIE_TIME=18,STAT_LONGEST_2_WHEELS_TIME=19;
/** A run lasts at least this long to be recorded, ms. */
export const TWO_WHEELS_RECORD_MS=2000,WHEELIE_RECORD_MS=5000,STOPPIE_RECORD_MS=2000;
/** The grace buffer: a run ends on a failing frame that finds it past this. */
export const WHEEL_BUFFER_LIMIT_MS=499;
export interface WheelStatsFrame {
 /** CTimer::ms_fTimeStep (50 a second). */
 timeStep:number;
 /** The player's vehicle as CPlayerInfo::Process sees it, or none. */
 vehicle?:
  /** m_fWheelsSuspensionCompressionPrev, front left, rear left, front right, rear right: 1 is off the ground. */
  {kind:'car';compression:readonly [number,number,number,number];contactWheels:number;damageIntensity:number;movingSpeed:number}
  /** m_aRatioHistory: lines 0 and 1 the front wheel, 2 and 3 the rear; 1 is off the ground. */
  |{kind:'bike';ratios:readonly [number,number,number,number];damageIntensity:number;movingSpeed:number}
  |{kind:'other'};
}
export class NativePlayerWheelStats {
 carTwoWheelCounter=0;carTwoWheelDist=0;carLess3WheelCounter=0;
 bikeRearWheelCounter=0;bikeRearWheelDist=0;bikeFrontWheelCounter=0;bikeFrontWheelDist=0;
 tempBufferCounter=0;
 bestCarTwoWheelsTimeMs=0;bestCarTwoWheelsDistM=0;bestBikeWheelieTimeMs=0;bestBikeWheelieDistM=0;bestBikeStoppieTimeMs=0;bestBikeStoppieDistM=0;
 /** CStats::SetNewRecordStat. */
 constructor(private readonly setNewRecord:(stat:number,value:number)=>void){}
 /** GET_WHEELIE_STATS: the six bests, then all six cleared. */
 takeBests(){
  const out={twoWheelsTime:this.bestCarTwoWheelsTimeMs,twoWheelsDistance:this.bestCarTwoWheelsDistM,wheelieTime:this.bestBikeWheelieTimeMs,
   wheelieDistance:this.bestBikeWheelieDistM,stoppieTime:this.bestBikeStoppieTimeMs,stoppieDistance:this.bestBikeStoppieDistM};
  this.bestCarTwoWheelsTimeMs=this.bestCarTwoWheelsDistM=this.bestBikeWheelieTimeMs=this.bestBikeWheelieDistM=this.bestBikeStoppieTimeMs=this.bestBikeStoppieDistM=0;
  return out;
 }
 process(frame:WheelStatsFrame){
  const f=Math.fround,ms=Math.trunc(f(f(frame.timeStep/50)*1000))>>>0,v=frame.vehicle;
  if(!v||v.kind==='other'){this.carTwoWheelCounter=this.carLess3WheelCounter=this.bikeRearWheelCounter=this.bikeFrontWheelCounter=this.tempBufferCounter=0;return;}
  const decay=(k:number)=>Math.trunc(Math.max(f(this.tempBufferCounter+f(ms*k)),0))>>>0;
  if(v.kind==='car'){
   this.carLess3WheelCounter=v.contactWheels>2?0:this.carLess3WheelCounter+ms>>>0;
   const c=v.compression,clean=v.damageIntensity===0;
   const outcome=c[2]===1&&c[3]===1?(c[0]<1&&c[1]<1&&clean?'on':'fail'):c[0]===1&&c[1]===1?(c[2]<1&&c[3]<1&&clean?'on':'fail'):'landed';
   let endRun=false;
   if(outcome==='on'){this.carTwoWheelCounter=this.carTwoWheelCounter+ms>>>0;this.carTwoWheelDist=f(this.carTwoWheelDist+v.movingSpeed);this.tempBufferCounter=decay(-.5);}
   else if(outcome==='fail'){
    if(this.carTwoWheelCounter===0)endRun=true;
    else if(this.tempBufferCounter>WHEEL_BUFFER_LIMIT_MS){if(this.carTwoWheelCounter>=TWO_WHEELS_RECORD_MS)this.recordTwoWheels();endRun=true;}
    else this.tempBufferCounter=this.tempBufferCounter+ms>>>0;
   }else if(this.carTwoWheelCounter!==0){if(this.carTwoWheelCounter>=TWO_WHEELS_RECORD_MS)this.recordTwoWheels();endRun=true;}
   if(endRun){this.carTwoWheelCounter=0;this.carTwoWheelDist=0;this.tempBufferCounter=0;}
   this.bikeRearWheelCounter=0;this.bikeFrontWheelCounter=0;
   return;
  }
  const r=v.ratios,clean=v.damageIntensity===0;
  let end:'wheelie'|'stoppie'|undefined;
  if(r[0]===1&&r[1]===1&&this.bikeFrontWheelCounter===0){
   if(r[2]<1||r[3]<1&&clean){this.bikeRearWheelCounter=this.bikeRearWheelCounter+ms>>>0;this.bikeRearWheelDist=f(this.bikeRearWheelDist+v.movingSpeed);this.tempBufferCounter=decay(-.2);}
   else if(this.bikeRearWheelCounter===0)end='wheelie';
   else if(this.tempBufferCounter<=WHEEL_BUFFER_LIMIT_MS)this.tempBufferCounter=this.tempBufferCounter+ms>>>0;
   else{if(this.bikeRearWheelCounter>=WHEELIE_RECORD_MS)this.recordWheelie();end='wheelie';}
  }else if(this.bikeRearWheelCounter!==0){if(this.bikeRearWheelCounter>=WHEELIE_RECORD_MS)this.recordWheelie();end='wheelie';}
  else if(r[2]===1&&r[3]===1){
   if(r[0]<1||r[1]<1&&clean){this.bikeFrontWheelCounter=this.bikeFrontWheelCounter+ms>>>0;this.bikeFrontWheelDist=f(this.bikeFrontWheelDist+v.movingSpeed);this.tempBufferCounter=decay(-.2);}
   else if(this.bikeFrontWheelCounter===0)end='stoppie';
   else if(this.tempBufferCounter<=WHEEL_BUFFER_LIMIT_MS)this.tempBufferCounter=this.tempBufferCounter+ms>>>0;
   else{if(this.bikeFrontWheelCounter>=STOPPIE_RECORD_MS)this.recordStoppie();end='stoppie';}
  }else{if(this.bikeFrontWheelCounter>=STOPPIE_RECORD_MS)this.recordStoppie();end='stoppie';}
  if(end==='wheelie'){this.bikeRearWheelCounter=0;this.bikeRearWheelDist=0;this.tempBufferCounter=0;}
  else if(end==='stoppie'){this.bikeFrontWheelCounter=0;this.bikeFrontWheelDist=0;this.tempBufferCounter=0;}
  this.carTwoWheelCounter=0;this.carLess3WheelCounter=0;
 }
 private recordTwoWheels(){
  this.bestCarTwoWheelsTimeMs=this.carTwoWheelCounter;this.bestCarTwoWheelsDistM=this.carTwoWheelDist;
  this.setNewRecord(STAT_LONGEST_2_WHEELS_TIME,Math.trunc(this.carTwoWheelCounter/1000));this.setNewRecord(STAT_LONGEST_2_WHEELS_DISTANCE,this.carTwoWheelDist);
 }
 private recordWheelie(){
  this.bestBikeWheelieTimeMs=this.bikeRearWheelCounter;this.bestBikeWheelieDistM=this.bikeRearWheelDist;
  this.setNewRecord(STAT_LONGEST_WHEELIE_TIME,Math.trunc(this.bikeRearWheelCounter/1000));this.setNewRecord(STAT_LONGEST_WHEELIE_DISTANCE,this.bikeRearWheelDist);
 }
 private recordStoppie(){
  this.bestBikeStoppieTimeMs=this.bikeFrontWheelCounter;this.bestBikeStoppieDistM=this.bikeFrontWheelDist;
  this.setNewRecord(STAT_LONGEST_STOPPIE_TIME,Math.trunc(this.bikeFrontWheelCounter/1000));this.setNewRecord(STAT_LONGEST_STOPPIE_DISTANCE,this.bikeFrontWheelDist);
 }
}
