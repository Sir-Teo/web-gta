import {expect,test} from 'vitest';
import {MAX_ROADBLOCKS,readRoadblox} from '../src/assets/roadblox';

function synthetic(count:number){
  const bytes=new Uint8Array(4+MAX_ROADBLOCKS*4),view=new DataView(bytes.buffer);
  view.setInt32(0,count,true);
  for(let i=0;i<Math.max(0,count);i++){view.setInt16(4+i*4,i%8,true);view.setUint16(4+i*4+2,100+i,true);}
  return bytes;
}

test('roadblox.dat reads the documented count + node table',()=>{
  const nodes=readRoadblox(synthetic(3));
  expect(nodes).toEqual([{areaId:0,nodeId:100},{areaId:1,nodeId:101},{areaId:2,nodeId:102}]);
  expect(readRoadblox(synthetic(-1))).toEqual([]);
  expect(()=>readRoadblox(new Uint8Array(10))).toThrow();
  expect(()=>readRoadblox(synthetic(326))).toThrow();
});
