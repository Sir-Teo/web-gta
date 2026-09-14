export interface PlaneWheelRoll {angle:number;speed:number}
/** Browser wheel presentation in radians and seconds. Contact follows the plane's
 * current ground estimate; individual tire slip/suspension is not reconstructed. */
export function stepPlaneWheelRoll(previous:PlaneWheelRoll,forwardSpeed:number,radius:number,contact:boolean,dt:number):PlaneWheelRoll{
 const speed=contact?-forwardSpeed/radius:previous.speed*Math.exp(-3*dt);
 return {angle:previous.angle+speed*dt,speed};
}
