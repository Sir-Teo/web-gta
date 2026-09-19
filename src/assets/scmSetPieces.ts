import {requireAsset} from './binary';
import {readScmHeader,decodeScmInstructions} from './scm';
/** eSetPieceType. */
export const SET_PIECE={none:0,twoCarsSlow:1,oneCarQuick:2,oneCarMedium:3,onePed:4,twoPeds:5,twoCarsQuickBeforeHit:6,twoCarsQuick:7,twoCarsMedium:8} as const;
/** A CSetPiece: native 2D area (left, bottom, right, top) and its two spawn and target points. */
export interface ScmSetPiece {type:number;area:[number,number,number,number];spawn1:[number,number];target1:[number,number];spawn2:[number,number];target2:[number,number]}
/** ADD_SET_PIECE (0x04F8) from the INITIAL mission, stored as CSetPieces::AddOne does: the corners sorted into a rect. */
export function readInitialSetPieces(bytes:Uint8Array):ScmSetPiece[]{
 const header=readScmHeader(bytes),mission=header.missions[0];
 requireAsset(mission,'Missing initialization mission.');
 const code=decodeScmInstructions(bytes,mission.start,mission.end);
 requireAsset(code[0]?.name==='SCRIPT_NAME'&&code[0]?.parameters[0]?.value==='INITIAL','Unexpected initialization mission name.');
 const out:ScmSetPiece[]=[];
 for(const instruction of code){
  if(instruction.name!=='ADD_SET_PIECE')continue;
  const v=instruction.parameters.map(p=>{requireAsset(typeof p.value==='number'&&Number.isFinite(p.value),'Set piece requires literal numbers.');return p.value as number;});
  requireAsset(v.length===13&&Number.isInteger(v[0])&&v[0]>=1&&v[0]<=8,'Invalid set piece.');
  // CSetPieces::AddOne keeps at most MAX_SET_PIECES (210).
  if(out.length>=210)break;
  out.push({type:v[0],area:[Math.min(v[1],v[3]),Math.min(v[2],v[4]),Math.max(v[1],v[3]),Math.max(v[2],v[4])],spawn1:[v[5],v[6]],target1:[v[7],v[8]],spawn2:[v[9],v[10]],target2:[v[11],v[12]]});
 }
 return out;
}
