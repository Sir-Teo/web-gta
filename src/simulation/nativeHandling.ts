import {HANDLING_FIELDS,type HandlingRecord} from '../assets/handling';
import {requireAsset} from '../assets/binary';

const bytes=new Set(['percentSubmerged','gears','abs','frontLights','rearLights','animationGroup']);
const integers=new Set([...bytes,'monetaryValue','modelFlags','handlingFlags']);
const f=(value:number)=>{const result=Math.fround(value);requireAsset(Number.isFinite(result),'Nonfinite prepared handling value.');return result;};
const ACCEL=f(1/2500),VELOCITY=f(f(.277778)/50);
export interface NativeGear {maxVelocity:number;changeUpVelocity:number;changeDownVelocity:number}

/** Source-based preparation with explicit float32 rounding. handlingId is the
 * native handling-table index, NOT a vehicle model ID or a guessed name match. */
export function prepareHandling(record:HandlingRecord,handlingId:number){
  requireAsset(Number.isInteger(handlingId)&&handlingId>=0&&handlingId<210,'Invalid native handling-table ID.');
  const values={...record.values};
  for(const field of HANDLING_FIELDS){
    if(field==='driveType'||field==='engineType')continue;
    const value=values[field];requireAsset(Number.isFinite(value),'Nonfinite raw handling value.');
    if(integers.has(field)){
      requireAsset(Number.isInteger(value),'Noninteger raw handling value.');
      if(bytes.has(field)){
        requireAsset(value>=-2147483648&&value<=2147483647,'Invalid raw handling byte range.');
        values[field]=((value%256)+256)%256;
      }
      else requireAsset(value>= (field==='monetaryValue'?-2147483648:0)&&value<= (field==='monetaryValue'?2147483647:4294967295),'Invalid handling integer range.');
    }else values[field]=f(value);
  }
  requireAsset(['F','R','4'].includes(values.driveType)&&['P','D','E'].includes(values.engineType),'Unsupported handling drive or engine type.');
  requireAsset(values.mass>0&&values.percentSubmerged>0,'Handling mass and narrowed submerged percentage must be positive.');
  // Six native slots include reverse; a forward gear count of six writes past them.
  requireAsset(values.gears>=1&&values.gears<=5,'Supported native forward gear count is 1 to 5.');
  requireAsset(values.maxVelocity>=0&&values.engineAcceleration>=0&&values.brakeDeceleration>=0&&values.dragMultiplier>=0,'Negative handling speed, acceleration, brake or drag is unsupported.');
  values.engineAcceleration=f(f(values.engineAcceleration*f(.4))*ACCEL);
  values.maxVelocity=f(values.maxVelocity*VELOCITY);values.brakeDeceleration=f(values.brakeDeceleration*ACCEL);
  const reciprocalMass=f(1/values.mass),buoyancy=f(f(values.mass*f(.8))/values.percentSubmerged);
  values.collisionDamageMultiplier=f(values.collisionDamageMultiplier*f(reciprocalMass*2000));
  const limit=f(values.engineAcceleration/6);let velocity=values.maxVelocity,iterations=0;
  while(velocity>0){
    requireAsset(++iterations<=100000,'Handling drag search exceeds the browser work limit.');
    const next=f(velocity-f(.01));requireAsset(next<velocity,'Handling drag search cannot advance at this float precision.');velocity=next;
    const squared=f(velocity*velocity);
    const resistance=values.dragMultiplier>=f(.01)
      ?f(f(squared*f(values.dragMultiplier/2))/1000)
      :f(f(f(1/f(f(squared*values.dragMultiplier)+1))-1)*-velocity);
    if(resistance<=limit)break;
  }
  let maxFlatVelocity:number,maxReverseVelocity:number;
  if(handlingId===38){maxFlatVelocity=velocity;maxReverseVelocity=-velocity;}
  else if((values.handlingFlags&0x01000000)!==0){
    maxFlatVelocity=f(velocity/f(1.2));maxReverseVelocity=Math.min(f(-maxFlatVelocity/4),f(-.2));
  }else{
    values.maxVelocity=f(velocity*f(1.2));maxFlatVelocity=velocity;
    maxReverseVelocity=handlingId>=162&&handlingId<=174?f(-.05):Math.min(f(-velocity*f(.3)),f(-.2));
  }
  values.engineAcceleration=f(values.engineAcceleration/(values.driveType==='4'?4:2));
  const gears:NativeGear[]=Array.from({length:6},()=>({maxVelocity:0,changeUpVelocity:0,changeDownVelocity:0}));
  const half=f(f(f(.5)*values.maxVelocity)/values.gears),remaining=f(values.maxVelocity-half);
  for(let i=1;i<=values.gears;i++){
    const gear=gears[i],previous=gears[i-1];gear.maxVelocity=f(f(f(i*remaining)/values.gears)+half);
    const difference=f(gear.maxVelocity-previous.maxVelocity);
    if(i===values.gears)gear.changeUpVelocity=values.maxVelocity;
    else{gears[i+1].changeDownVelocity=f(f(f(.42)*difference)+previous.maxVelocity);gear.changeUpVelocity=f(f(f(.6667)*difference)+previous.maxVelocity);}
  }
  gears[0]={maxVelocity:maxReverseVelocity,changeUpVelocity:f(-.01),changeDownVelocity:maxReverseVelocity};gears[1].changeDownVelocity=f(-.01);
  return {name:record.name,line:record.line,handlingId,values,reciprocalMass,buoyancy,maxFlatVelocity,maxReverseVelocity,gears,dragIterations:iterations};
}
