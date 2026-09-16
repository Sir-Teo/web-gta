import { TIMECYCLE_FIELDS, TIMECYCLE_HOURS, TIMECYCLE_WEATHERS, timecycleInterval, type TimecycleData, type TimecycleRow } from '../assets/timecycle';

type UnresolvedField = 'directionalR' | 'directionalG' | 'directionalB' | 'directionalMultiplier';
export type NativeColourField = Exclude<typeof TIMECYCLE_FIELDS[number], UnresolvedField>;
/** CColourSet storage units, before ambient normalization and spatial/weather effects. */
export type NativeColourSet = Record<NativeColourField, number> & {directionalMultiplier?:number};
export interface NativeTimecycle { samples: NativeColourSet[] }
const unused = new Set([6,7,8,51]);
const integerInterpolation = new Set([9,10,11,12,13,14,15,16,17,18,19,20,24,25,26,30,31,32,33,34,35,49,50]);
const floatInput = new Set([21,22,23,27,28,29,36,37,38,39,40,41,42,43,44,45,46,47,48]);
const byte = (value: number) => ((Math.trunc(value)%256)+256)%256;
const short = (value: number) => { const n=((Math.trunc(value)%65536)+65536)%65536;return n>=32768?n-65536:n; };
const f = Math.fround;

export function decodeTimecycleRow(row: TimecycleRow): NativeColourSet {
  if (row.issues.length || (row.values.length!==51 && row.values.length!==52)) throw new Error(`Timecycle line ${row.line} has unresolved field issues.`);
  const result = {} as NativeColourSet;
  TIMECYCLE_FIELDS.forEach((name,index)=>{
    if (unused.has(index)) return;
    const raw=row.values[index];
    if (!Number.isFinite(raw) || Math.abs(raw)>2147483647 || (!floatInput.has(index) && !Number.isInteger(raw))) throw new Error(`Unsupported timecycle value on line ${row.line}: ${name}.`);
    const value=floatInput.has(index)?f(raw):raw;
    let stored:number;
    if (index>=21 && index<=23) { const n=byte(f(f(value*10)+.5));stored=n>=128?n-256:n; }
    else if (index===27 || index===28) stored=short(value);
    else if (index===29) stored=byte(f(f(value*10)+.5));
    else if (index===40 || index===44) stored=byte(f(value*2));
    else stored=byte(value);
    result[name as NativeColourField]=stored;
  });
  if(row.values.length===52){
    const raw=f(row.values[51]);
    // Stock PC truncates to uint8 before multiplying by 100 (SilentPatch fixes this).
    // Reject out-of-range float-to-byte casts instead of inventing their behavior.
    if(!Number.isFinite(raw)||raw<0||raw>255)throw new Error(`Unsupported timecycle value on line ${row.line}: directionalMultiplier.`);
    result.directionalMultiplier=f(byte(Math.trunc(raw)*100)/100);
  }
  return result;
}

export function prepareTimecycle(data: TimecycleData): NativeTimecycle {
  if (data.rows.length!==TIMECYCLE_WEATHERS*8) throw new Error('Native timecycle requires 184 samples.');
  return {samples:data.rows.map((row,index)=>{
    if (row.weather!==Math.floor(index/8) || row.hour!==TIMECYCLE_HOURS[index%8]) throw new Error('Native timecycle sample order is invalid.');
    return decodeTimecycleRow(row);
  })};
}

function interpolate(a:NativeColourSet,b:NativeColourSet,amount:number):NativeColourSet {
  const result={} as NativeColourSet,t=f(amount),inverse=f(1-t);
  TIMECYCLE_FIELDS.forEach((name,index)=>{
    if (unused.has(index)) return;
    const key=name as NativeColourField,value=f(f(a[key]*inverse)+f(b[key]*t));
    result[key]=integerInterpolation.has(index)?Math.trunc(value):value;
  });
  const av=a.directionalMultiplier,bv=b.directionalMultiplier;
  result.directionalMultiplier=t===0?av:t===1?bv:av!==undefined&&bv!==undefined?f(f(av*inverse)+f(bv*t)):undefined;
  return result;
}

/** Time blends occur before the weather blend, with native integer truncation at each stage. */
export function sampleNativeTimecycle(data:NativeTimecycle,minutes:number,oldWeather:number,newWeather=oldWeather,weatherBlend=0):NativeColourSet {
  for (const weather of [oldWeather,newWeather]) if (!Number.isInteger(weather) || weather<0 || weather>=TIMECYCLE_WEATHERS) throw new Error('Invalid native weather index.');
  if (!Number.isFinite(weatherBlend) || weatherBlend<0 || weatherBlend>1) throw new Error('Weather blend must be between zero and one.');
  if (data.samples.length!==184) throw new Error('Native timecycle requires 184 samples.');
  const {current,next,blend}=timecycleInterval(minutes);
  const sample=(weather:number)=>interpolate(data.samples[weather*8+current],data.samples[weather*8+next],blend);
  return interpolate(sample(oldWeather),sample(newWeather),weatherBlend);
}
/** CTimeCycle::CalcColoursForPoint weather part: EXTRASUNNY_SMOG_LA and SUNNY_SMOG_LA hour samples first blend toward
 * their clear LA rows by camera altitude ((z - 20) / 200), then time, then CWeather::InterpolationValue. */
export function sampleNativeWeatherTimecycle(data:NativeTimecycle,minutes:number,oldWeather:number,newWeather:number,interpolation:number,cameraZ:number):NativeColourSet {
  for (const weather of [oldWeather,newWeather]) if (!Number.isInteger(weather) || weather<0 || weather>=TIMECYCLE_WEATHERS) throw new Error('Invalid native weather index.');
  if (data.samples.length!==184) throw new Error('Native timecycle requires 184 samples.');
  const {current,next,blend}=timecycleInterval(minutes),altitude=Math.min(1,Math.max(0,f((cameraZ-20)/200)));
  const hourSet=(weather:number,index:number)=>{
    const set=data.samples[weather*8+index],clear=weather===2?0:weather===3?1:undefined;
    return clear===undefined?set:interpolate(set,data.samples[clear*8+index],altitude);
  };
  const sample=(weather:number)=>interpolate(hourSet(weather,current),hourSet(weather,next),blend);
  return interpolate(sample(oldWeather),sample(newWeather),Math.min(1,Math.max(0,interpolation)));
}
