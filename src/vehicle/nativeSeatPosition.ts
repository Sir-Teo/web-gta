type V3={x:number;y:number;z:number};
const ORIGIN:V3={x:0,y:0,z:0};
/** CPed::GetSeatPositionInVehicle (iOS 0x10032bd40; gta-reversed agrees): where a ped rides, in native model
 * space, from the ped_frontseat and ped_backseat dummies.
 * - The driver takes the front seat, mirrored (x negated) for every vehicle type but a boat or a bike (5 or 9 at
 *   +0x734). A boat keeps its front seat in m_avDummyPos[0], the others in [4].
 * - Passenger 0 takes the front seat as it is, or the back seat on a bike or a quad.
 * - Passenger 1 takes the back seat mirrored, passenger 2 the back seat as it is; any other the front seat.
 * A dummy the model lacks reads as the origin, as CVehicleModelInfo's zeroed m_avDummyPos does. */
export function nativeSeatPosition(o:{front?:V3;back?:V3;boat?:boolean;bike?:boolean;quad?:boolean},seat:'driver'|number):V3{
 const front=o.front??ORIGIN,back=o.back??ORIGIN;
 if(seat==='driver')return o.boat||o.bike?{...front}:{x:-front.x,y:front.y,z:front.z};
 if(seat===0)return o.bike||o.quad?{...back}:{...front};
 if(seat===1)return {x:-back.x,y:back.y,z:back.z};
 if(seat===2)return {...back};
 return {...front};
}
/** CPed::SetPedPositionInCar (PC 0x5DF910): animation group 13 seats its rear passengers across the van.
 * The left one also moves 0.6 along the vehicle's forward axis before the quarter turn. Native Z rotation and
 * renderer Y rotation have the same sign. The raw dummy is never changed. Bike lean and combine tilt are separate. */
export function nativeCarSeatPose(local:V3,seat:'driver'|number,animationGroup:number){
 if(animationGroup===13&&seat===1)return {local:{...local,y:local.y+.6},headingOffset:-Math.PI/2};
 return {local:{...local},headingOffset:animationGroup===13&&seat===2?Math.PI/2:0};
}
/** A frame's translation, by name, from a vehicle model's frame list (native model space, the dummy's own matrix). */
export function modelDummy(frames:readonly {name:string;matrix:ArrayLike<number>}[]|undefined,name:string):V3|undefined{
 const frame=frames?.find(f=>f.name.toLowerCase()===name);return frame?{x:frame.matrix[12],y:frame.matrix[13],z:frame.matrix[14]}:undefined;
}
