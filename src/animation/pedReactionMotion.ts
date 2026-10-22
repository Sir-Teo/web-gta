/** A native ped reaction's extracted root X/Y shift in renderer space.
 * The pedestrian's heading and its native model basis also drive its displayed pose. */
export function pedReactionMotion(shift:{x:number;y:number},heading:number){
 const sin=Math.sin(heading),cos=Math.cos(heading);
 return {x:-cos*shift.x+sin*shift.y,z:sin*shift.x+cos*shift.y};
}
