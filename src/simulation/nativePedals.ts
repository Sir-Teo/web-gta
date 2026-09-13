import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite pedal input.');return r;};
export interface NativePedalInput {
  accelerate:number;brake:number;forwardSpeed:number;previousGas:number;
  automaticallyHandbrake:boolean;handbrake:boolean;engineOn:boolean;drowning:boolean;
  driveByAim:boolean;rightShoulder:number;leftShoulder:number;unloadModel:boolean;
  /** Caller resolves driver/game-logic direction eligibility. */
  forwardAllowed:boolean;reverseAllowed:boolean;
}
/** ProcessControlInputs pedal subset. Burnout starts false each control frame;
 * this only detects it, not the additional rear-wheel burnout turning force. */
export function nativePedals(input:NativePedalInput){
  for(const value of [input.accelerate,input.brake,input.rightShoulder,input.leftShoulder])requireAsset(Number.isInteger(value)&&value>=0&&value<=255,'Pedals require native byte input.');
  const speed=f(input.forwardSpeed),previous=f(input.previousGas);
  requireAsset(previous>=-1&&previous<=1,'Invalid previous gas pedal.');
  let gas=0,brake=0,burnout=false;
  if(input.automaticallyHandbrake)brake=1;
  else{
    let demand=0;
    if(!(input.engineOn&&input.drowning)){
      let value=input.accelerate-input.brake;
      if(value===0&&input.driveByAim)value=input.rightShoulder-input.leftShoulder;
      demand=f((value<0&&input.unloadModel?f(value*f(.3)):value)/255);
    }
    if(Math.abs(speed)<f(.01)){
      if(input.accelerate>150&&input.brake>150){burnout=true;gas=f(input.accelerate/255);brake=f(input.brake/255);}
      else gas=demand;
    }else if(speed>=0){if(demand<0)brake=Math.abs(demand);else gas=demand;}
    else if(demand>=0&&(previous<=f(.5)||speed<=f(-.15)))brake=demand;
    else gas=demand;
  }
  if(gas>0&&!input.forwardAllowed||gas<0&&!input.reverseAllowed)gas=0;
  return {gas,brake,burnout,handbrake:input.automaticallyHandbrake||input.handbrake};
}
