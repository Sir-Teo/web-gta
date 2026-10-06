import type {WorldCar} from '../simulation/WorldCar';
import type {CoronaRegistration} from '../world/nativeCoronas';
import type {EntityPointLight} from '../world/nativeEntityLights';
/* The taxi's roof light: CAutomobile::autoFlags.bTaxiLight (SET_TAXI_LIGHTS, SetTaxiLight 0x6A3740, reversed). What
 * draws it is CAutomobile::PreRender, unreversed in gta-reversed and read from the iOS executable (0x100449314 for
 * the Cabbie, 0x10044932c for the Taxi): with the light on, a yellow corona over the roof sign, 0.4 back and 0.95 up
 * on the Taxi, 0.85 up on the Cabbie, and a faint yellow point light there. The Taxi's is drawn only at high FX
 * quality or above (Fx_c's quality at least 2); the Cabbie's always. */
export const TAXI_SIGNS:ReadonlyMap<number,{forward:number;up:number;highQualityOnly:boolean}>=new Map([
 [420,{forward:-.4,up:.95,highQualityOnly:true}],[438,{forward:0,up:.85,highQualityOnly:false}]]);
/** The sign's red and green: CTimeCycle::m_CurrentColours.m_fSpriteBrightness / 10 × 100, truncated (blue is 0). */
export function taxiLightLevel(spriteBrightness:number){return Math.trunc(Math.fround(Math.fround(spriteBrightness/10)*100));}
export interface TaxiLightFrame {spriteBrightness:number;lodMultiplier:number;highQuality:boolean}
/** This frame's taxi-light coronas and point lights (native world units) for the cars with the light on. */
export function taxiLights(cars:Iterable<WorldCar>,frame:TaxiLightFrame){
 const coronas:CoronaRegistration[]=[],pointLights:EntityPointLight[]=[];
 const level=taxiLightLevel(frame.spriteBrightness);
 for(const car of cars){
  const sign=TAXI_SIGNS.get(car.modelId);
  if(!sign||!car.taxiLight||car.wrecked||car.disposed||sign.highQualityOnly&&!frame.highQuality)continue;
  const w=car.worldPoint({x:0,y:sign.forward,z:sign.up}),position:[number,number,number]=[w.x,-w.z,w.y];
  // RegisterCorona(CORONATYPE_HEADLIGHT, reflected, 150 × the LOD multiplier); an id no other CCoronas user shares
  // (the executable's is the vehicle's address + 17).
  coronas.push({id:0x54000000+car.car.body.handle,color:[level,level,0],intensity:255,position,size:.8,range:150*frame.lodMultiplier,
   reflection:true,pullTowardsCamera:1.5,fadeSpeed:15});
  // CPointLights::AddLight(PLTYPE_POINTLIGHT, the sign, radius 10, (0.1, 0.1, 0.05), shadows on).
  pointLights.push({position:[...position],radius:10,color:[.1,.1,.05]});
 }
 return {coronas,pointLights};
}
