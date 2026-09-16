import {requireAsset} from './binary';
export interface RoadblockNode {areaId:number;nodeId:number}
/** CRoadBlocks::Init (0x461100): data\paths\roadblox.dat is int32 count then
 * MAX_ROADBLOCKS (325) CNodeAddress entries {int16 areaId, uint16 nodeId}.
 * The retail file is 1,304 bytes. Returns the count-clamped node list. */
export const MAX_ROADBLOCKS=325;
export function readRoadblox(bytes:Uint8Array):RoadblockNode[]{
  requireAsset(bytes.length>=4+MAX_ROADBLOCKS*4,`roadblox.dat is truncated (${bytes.length} bytes).`);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const count=view.getInt32(0,true);
  requireAsset(Number.isInteger(count)&&count>=-1&&count<=MAX_ROADBLOCKS,`Unexpected roadblock count ${count}.`);
  if(count===-1)return [];
  const nodes:RoadblockNode[]=[];
  for(let i=0;i<count;i++){
    const areaId=view.getInt16(4+i*4,true),nodeId=view.getUint16(4+i*4+2,true);
    requireAsset(Number.isFinite(areaId)&&Number.isFinite(nodeId),'Invalid roadblock node.');
    nodes.push({areaId,nodeId});
  }
  return nodes;
}
