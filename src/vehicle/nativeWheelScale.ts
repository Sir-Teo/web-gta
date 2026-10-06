/** The scale CAutomobile::PreRender puts on each wheel's frame (the iOS executable's, from 0x1004484ec; the wheel
 * frame code is unreversed in gta-reversed). A model whose wheels are its own atomic (vehicles.ide's wheel model -1,
 * every car here) draws a wheel `CVehicle::m_fWheelScale` times its modelled diameter, a rear wheel further by the rear
 * size over the front; a wheel upgrade's model is a unit wheel, and fitting one sets m_fWheelScale to the front wheel
 * size (CVehicle::AddVehicleUpgrade, 0x100480a44), taking it off back to 1 (0x100481218). The width (the axle, the
 * wheel's x) is the axle's wheel size over 0.7 times the diameter scale, narrowed or widened by the handling's wheel
 * flags, three times over on the Kart; a monster truck's or a quad's wheel is scaled alike in every direction. A model
 * with a wheel model of its own (index not -1) draws it at the axle's size each way. */
export interface WheelScale {width:number;diameter:number}
/** Handling flags WHEEL_F_NARROW2, _NARROW, _WIDE and _WIDE2 and the rear ones, in the order the test takes them: the
 * first one set wins. */
const FRONT_WIDTH:readonly (readonly [number,number])[]=[[0x100,.65],[0x200,.8],[0x400,1.1],[0x800,1.25]];
const REAR_WIDTH:readonly (readonly [number,number])[]=[[0x1000,.65],[0x2000,.8],[0x4000,1.1],[0x8000,1.25]];
export const MODEL_KART=571;
export function nativeWheelScale(o:{frontSize:number;rearSize:number;rear:boolean;wheelScale:number;handlingFlags:number;modelId:number;
 /** vehicles.ide's type: an "mtruck" or a "quad" (CVehicle's subtypes 1 and 2) has no width rule. */
 vehicleType:string;
 /** vehicles.ide's wheel model index is not -1. */
 wheelModel?:boolean}):WheelScale{
 const f=Math.fround,size=o.rear?o.rearSize:o.frontSize;
 let diameter:number,width:number;
 if(o.wheelModel){diameter=size;width=1;}
 else{diameter=f(o.rear?o.wheelScale*f(o.rearSize/o.frontSize):o.wheelScale);width=f(o.frontSize/f(o.wheelScale*.7));}
 const type=o.vehicleType.toLowerCase();
 if(type==='mtruck'||type==='quad')width=1;
 else for(const [bit,factor] of o.rear?REAR_WIDTH:FRONT_WIDTH)if(o.handlingFlags&bit){width=f(width*factor);break;}
 if(o.modelId===MODEL_KART)width=f(width*3);
 return {width:f(diameter*width),diameter};
}
