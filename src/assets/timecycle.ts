/** Raw TIMECYC.DAT fields; storage quantization and display conversion are separate. */
export const TIMECYCLE_FIELDS = [
  'ambientR','ambientG','ambientB','objectAmbientR','objectAmbientG','objectAmbientB',
  'directionalR','directionalG','directionalB','skyTopR','skyTopG','skyTopB','skyBottomR','skyBottomG','skyBottomB',
  'sunCoreR','sunCoreG','sunCoreB','sunCoronaR','sunCoronaG','sunCoronaB','sunSize','spriteSize','spriteBrightness',
  'shadowStrength','lightShadowStrength','poleShadowStrength','farClip','fogStart','groundLight',
  'lowCloudR','lowCloudG','lowCloudB','bottomCloudR','bottomCloudG','bottomCloudB',
  'waterR','waterG','waterB','waterAlpha','postFx1Alpha','postFx1R','postFx1G','postFx1B',
  'postFx2Alpha','postFx2R','postFx2G','postFx2B','cloudAlpha','highlightMinimum','waterFogAlpha','directionalMultiplier',
] as const;
export const TIMECYCLE_HOURS = [0,5,6,7,12,19,20,22] as const;
export const TIMECYCLE_WEATHERS = 23;
export interface TimecycleRow { line: number; weather: number; hour: number; values: number[]; issues: string[] }
export interface TimecycleData { rows: TimecycleRow[]; warnings: string[] }
const integerColumns = new Set([...Array.from({length:21},(_,i)=>i),24,25,26,30,31,32,33,34,35,49,50]);

/** Retain malformed numeric rows for inspection; never synthesize missing lighting values. */
export function readTimecycle(text: string): TimecycleData {
  if (text.length > 1024*1024) throw new Error('Timecycle exceeds the 1 MiB text limit.');
  const rows: TimecycleRow[] = [], warnings: string[] = [];
  for (const [index, original] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()) {
    const line = original.replace(/[\x01-\x1f,]/g,' ').trim(); if (!line || line.startsWith('/')) continue;
    const tokens = line.split(/\s+/), values = tokens.map(token => {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) || !Number.isFinite(Number(token))) throw new Error(`Invalid timecycle number on line ${index+1}.`);
      return Number(token);
    });
    const weather = Math.floor(rows.length/8), hour = TIMECYCLE_HOURS[rows.length%8], issues: string[] = [];
    if (values.length !== 51 && values.length !== 52) issues.push(`Expected 51 or 52 fields, found ${values.length}; row is not safe to apply.`);
    for (const column of integerColumns) if (tokens[column] !== undefined && !/^[+-]?\d+$/.test(tokens[column])) issues.push(`${TIMECYCLE_FIELDS[column]} requires an integer token; native scanning would stop here.`);
    if (values.length === 51) warnings.push(`Line ${index+1}: directional multiplier is absent; no value was synthesized.`);
    rows.push({line:index+1,weather,hour,values,issues});
    if (rows.length > TIMECYCLE_WEATHERS*8) throw new Error('Timecycle has more than 184 sample rows.');
  }
  if (rows.length !== TIMECYCLE_WEATHERS*8) throw new Error(`Timecycle requires 184 sample rows; found ${rows.length}.`);
  return {rows,warnings};
}

/** Native nonuniform sample intervals, including the 23.999-hour upper clamp. */
export function timecycleInterval(minutes: number) {
  if (!Number.isFinite(minutes)) throw new Error('Timecycle time must be finite.');
  const hour = Math.min(23.999, ((minutes%1440)+1440)%1440/60);
  let current = 0;
  while (current < 7 && hour >= TIMECYCLE_HOURS[current+1]) current++;
  const end = current === 7 ? 24 : TIMECYCLE_HOURS[current+1];
  return {current,next:(current+1)%8,blend:(hour-TIMECYCLE_HOURS[current])/(end-TIMECYCLE_HOURS[current])};
}
