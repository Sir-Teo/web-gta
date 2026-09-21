import {requireAsset} from '../assets/binary';
/* CSetPieces, pinned gta-reversed ead3051 (`SetPieces.cpp` 0x499500 and 0x4994F0, both reversed): the ambushes
 * a script arms, each an area and two spawn-and-target pairs. `Update` drives an eighth of them a frame and
 * spawns their cars, which belongs to a host with a traffic system; this is the table the script fills. */
/** CSetPieces::MAX_SET_PIECES. */
export const MAX_SET_PIECES=210;
export interface ScmSetPiece {
 type:number;
 /** The area, as CRect keeps it: left and right, bottom and top, whichever corner the script gave first. */
 area:{left:number;bottom:number;right:number;top:number};
 spawn1:{x:number;y:number};target1:{x:number;y:number};
 spawn2:{x:number;y:number};target2:{x:number;y:number};
}
export class ScmSetPieces {
 readonly pieces:ScmSetPiece[]=[];
 /** CSetPieces::Init (0x4994F0). */
 init(){this.pieces.length=0;}
 get count(){return this.pieces.length;}
 /** CSetPieces::AddOne (0x499500): a full table drops the request without a word. */
 addOne(type:number,cornerA:{x:number;y:number},cornerB:{x:number;y:number},spawn1:{x:number;y:number},target1:{x:number;y:number},spawn2:{x:number;y:number},target2:{x:number;y:number}){
  requireAsset(Number.isInteger(type),'Invalid set piece type.');
  if(this.pieces.length>=MAX_SET_PIECES)return false;
  this.pieces.push({type,
   area:{left:Math.min(cornerA.x,cornerB.x),bottom:Math.min(cornerA.y,cornerB.y),right:Math.max(cornerA.x,cornerB.x),top:Math.max(cornerA.y,cornerB.y)},
   spawn1:{...spawn1},target1:{...target1},spawn2:{...spawn2},target2:{...target2}});
  return true;
 }
}
