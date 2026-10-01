import type {WorldCar} from '../simulation/WorldCar';
import type {CoronaRegistration} from '../world/nativeCoronas';
/* The taxi's roof light: CAutomobile::autoFlags.bTaxiLight (SET_TAXI_LIGHTS, SetTaxiLight 0x6A3740, reversed). What
 * draws it is CAutomobile::PreRender, unreversed in SA; reVC's is followed (AUTHORED): with the light on, a yellow
 * corona over the roof sign, 0.95 up the car's axis and 0.4 back on the taxi, 0.9 up and 0.2 forward on the cabbie,
 * 0.8 in size and seen from 50 units. */
export const TAXI_SIGNS:ReadonlyMap<number,{forward:number;up:number}>=new Map([[420,{forward:-.4,up:.95}],[438,{forward:.2,up:.9}]]);
export const TAXI_LIGHT_COLOUR=[128,128,0] as const;
/** This frame's taxi-light coronas (native world units) for the cars with the light on. */
export function taxiLightCoronas(cars:Iterable<WorldCar>):CoronaRegistration[]{
 const out:CoronaRegistration[]=[];
 for(const car of cars){
  const sign=TAXI_SIGNS.get(car.modelId);
  if(!sign||!car.taxiLight||car.wrecked||car.disposed)continue;
  const w=car.worldPoint({x:0,y:sign.forward,z:sign.up});
  // A corona id no other CCoronas user shares: the body handle under a tag of its own.
  out.push({id:0x54000000+car.car.body.handle,color:TAXI_LIGHT_COLOUR,intensity:255,position:[w.x,-w.z,w.y],size:.8,range:50,reflection:false});
 }
 return out;
}
