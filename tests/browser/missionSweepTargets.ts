/** Static locate operands for the diagnostic sweep. Variable coordinates must not be mistaken for literal radii. */
export function sweepLiteralDestination(instruction:{name:string;parameters:readonly {type:number;value:unknown}[]}){
 const dimensions=/3D$/.test(instruction.name)?3:2,box=/IN_AREA/.test(instruction.name),count=dimensions*(box?2:1),p=instruction.parameters.slice(1,1+count);
 if(p.length!==count||p.some(p=>p.type!==6||typeof p.value!=='number'||!Number.isFinite(p.value)))return undefined;
 const a=p.map(p=>p.value as number),coordinate=(axis:number)=>box?(a[axis]+a[axis+dimensions])/2:a[axis];
 return {x:coordinate(0),y:coordinate(1),...(dimensions===3?{z:coordinate(2)}:{})};
}

interface SweepDoor {rect:readonly number[];entranceZ:number;area:number;flags:number;link?:{area:number;exit:readonly number[]}}
/** Reach an interior through a live enabled ENEX, so its streaming, area and stack changes actually run.
 * Nearness identifies a destination's interior, rather than assuming that every high point is indoors. */
export function sweepEntranceForDestination(target:{x:number;y:number;z?:number},area:number,doors:readonly SweepDoor[]){
 if(target.z===undefined)return undefined;
 let best:SweepDoor|undefined,distance=Infinity;
 for(const door of doors){
  if(door.area!==area||!(door.flags&(1<<14))||!door.link||door.link.area===area)continue;
  const p=door.link.exit,xy=(p[0]-target.x)**2+(p[1]-target.y)**2,z=p[2]-target.z,d=xy+z*z;
  if(xy>100*100||Math.abs(z)>50||d>=distance)continue;best=door;distance=d;
 }
 return best?{x:(best.rect[0]+best.rect[2])/2,y:(best.rect[1]+best.rect[3])/2,z:best.entranceZ}:undefined;
}
