const f=Math.fround;
export const SPRINT_MODE={ground:0,bmx:1,water:2,underwater:3} as const;
export type SprintMode=typeof SPRINT_MODE[keyof typeof SPRINT_MODE];
/** Selected iOS PLAYER_SPRINT_SET, 0x100651264; same published PC table at 0x8D2460.
 * Press boost, held decay, released decay, threshold, max, base cost, boosted cost, result curve. */
const TABLES=[
 [4,.7,.2,5,10,1,.5,.3],
 [4,.7,.2,5,10,0,.4,1],
 [4,.7,.2,5,10,1,.3,.3],
 [4,.7,.2,5,10,0,0,1],
].map(row=>row.map(f));
/** CStats::GetFatAndMuscleModifier mode 7, selected iOS 0x100266300.
 * STAT_STAMINA is float stat 22; its initial 100 gives 450 native energy units. */
export function nativeSprintCapacity(stamina:number){return f(f(f(f(stamina)/1000)*3000)+150);}
export const DEFAULT_SPRINT_CAPACITY=nativeSprintCapacity(100);
export interface NativeSprintState {energy:number;buttonSpeed:number}
export interface NativeSprintInput {
 held:boolean;justPressed:boolean;moving:boolean;inVehicle?:boolean;
 neverTired?:boolean;adrenaline?:boolean;sprintDisabled?:boolean;
}
/** CPlayerPed::HandleSprintEnergy (PC 0x60A550, selected iOS 0x100360ad0).
 * Recovery may overshoot capacity. A draining call can reach -150 and still succeed;
 * the following call fails. The browser supplies native timeStep, 50 units per second. */
export function handleNativeSprintEnergy(state:Pick<NativeSprintState,'energy'>,sprint:boolean,multiplier:number,timeStep:number,capacity:number,neverTired=false,adrenaline=false){
 state.energy=f(state.energy);multiplier=f(multiplier);timeStep=f(timeStep);
 if(sprint){
  if(neverTired||adrenaline||multiplier===0)return true;
  if(state.energy> -150){state.energy=Math.max(-150,f(state.energy-f(timeStep*multiplier)));return true;}
 }else if(f(capacity)>state.energy)state.energy=f(state.energy+f(f(timeStep*multiplier)*.5));
 return false;
}
/** CPlayerPed::GetButtonSprintResults (selected iOS 0x100361af8).
 * The PC 0x60A820 wrapper's legacy body is not an independent executable capture. */
export function nativeButtonSprintResult(buttonSpeed:number,mode:SprintMode){
 const speed=f(buttonSpeed);if(speed<=5)return speed<=0?0:1;
 return f(1+f(Math.max(0,f(f(speed/5)-1))*TABLES[mode][7]));
}
/** CPlayerPed::ControlButtonSprint (PC 0x60A610 retail delegate, selected iOS 0x10036626c).
 * Pad inputs are supplied by the caller. Button memory survives release, and retained speed
 * permits a sprint below zero energy until the native -150 floor. No authored percent hysteresis. */
export function controlNativeSprint(state:NativeSprintState,mode:SprintMode,input:NativeSprintInput,timeStep:number){
 const t=TABLES[mode],ts=f(timeStep);state.energy=f(state.energy);state.buttonSpeed=f(state.buttonSpeed);
 const processButtons=(!input.sprintDisabled&&state.buttonSpeed>0)||state.energy>0;
 if(processButtons&&input.justPressed)state.buttonSpeed=Math.min(t[4],f(state.buttonSpeed+t[0]));
 else if(processButtons&&input.held)state.buttonSpeed=Math.max(1,f(state.buttonSpeed-f(t[1]*ts)));
 else if(state.buttonSpeed>0)state.buttonSpeed=Math.max(0,f(state.buttonSpeed-f(t[2]*ts)));
 let ratio=0,cost=1;
 if(state.buttonSpeed>t[3]){ratio=f(state.buttonSpeed/t[3]);cost=t[6];}
 else if(state.buttonSpeed>0&&processButtons){ratio=1;cost=t[5];}
 if(!(input.inVehicle||input.moving)||ratio<=0)return 0;
 if(!handleNativeSprintEnergy(state,true,cost,ts,0,input.neverTired,input.adrenaline)){state.buttonSpeed=0;return 0;}
 return f(1+f(Math.max(0,f(ratio-1))*t[7]));
}
