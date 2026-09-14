import {expect,test} from 'vitest';
import {readPathNodes} from '../src/assets/pathNodes';
function fixture(){
 const bytes=new Uint8Array(20+56+14+194*6+4),v=new DataView(bytes.buffer);
 [2,1,1,1,2].forEach((n,i)=>v.setUint32(i*4,n,true));
 for(let i=0;i<2;i++){
  const p=20+i*28;v.setUint32(p,0xdeadbeef,true);
  [-100,200,-300].forEach((n,j)=>v.setInt16(p+8+j*2,n,true));
  v.setInt16(p+16,i,true);v.setUint16(p+18,15,true);v.setUint16(p+20,i,true);v.setUint8(p+22,24);v.setUint8(p+23,9);
  v.setUint32(p+24,1|16|32|128|1024|(11<<16)|(2<<20),true);
 }
 const p=76;v.setInt16(p,-40,true);v.setInt16(p+2,80,true);v.setUint16(p+4,15,true);
 v.setInt8(p+8,-75);v.setInt8(p+9,25);v.setInt8(p+10,-8);v.setUint8(p+11,1|(2<<3)|64);v.setUint16(p+12,6,true);
 const links=90;v.setUint16(links,15,true);v.setUint16(links+2,1,true);v.setUint16(links+4,15,true);
 const nav=links+194*4;v.setUint16(nav,15<<10,true);v.setUint16(nav+2,65535,true);
 bytes.set([13,7,99],nav+4);bytes.set([1,2,3],nav+4+194);
 return bytes;
}
test('reads signed native coordinates, lane direction, flags and separately reserved link arrays',()=>{
 const bytes=fixture(),a=readPathNodes(bytes,15);
 expect(a.nodes[0]).toMatchObject({position:[-12.5,25,-37.5],kind:'vehicle',width:1.5,baseLink:0,linkCount:1,floodFill:9,deadEnd:true,switchedOff:true,water:true,dontWander:true,spawnProbability:11,behaviour:2});
 expect(a.nodes[1].kind).toBe('pedestrian');
 expect(a.navigation[0]).toMatchObject({position:[-5,10],attachedTo:{area:15,node:0},direction:[-.75,.25],width:-.5,oppositeLanes:1,sameLanes:2,trafficLightDirection:true,trafficLightState:2,bridgeLights:true});
 expect(a.links.slice(0,2)).toEqual([{area:15,node:1},{area:15,node:0}]);
 expect(a.navigationLinks).toEqual([{area:15,node:0},null]);
 expect(a.links.length).toBe(194);expect(a.linkCount).toBe(2);
 expect([...a.lengths.slice(0,3)]).toEqual([13,7,99]);expect([...a.intersections.slice(0,3)]).toEqual([1,2,3]);
 expect(a.bytesRead).toBe(bytes.length);
 bytes.fill(0);expect(a.lengths[0]).toBe(13);
});
test('accepts exact payloads and IMG sector padding without inventing dynamic links',()=>{
 const source=fixture(),padded=new Uint8Array(Math.ceil(source.length/2048)*2048).fill(0xcc);padded.set(source);
 expect(readPathNodes(padded,15)).toEqual(readPathNodes(source,15));
 const empty=readPathNodes(new Uint8Array(20),0);expect(empty.links).toEqual([]);expect(empty.lengths).toHaveLength(0);
});
test('rejects malformed headers, addresses, link spans and payload extents before use',()=>{
 expect(()=>readPathNodes(new Uint8Array(19),15)).toThrow('Truncated');
 for(const area of [-1,64,.5,NaN])expect(()=>readPathNodes(fixture(),area)).toThrow('path area');
 for(const [offset,value] of [[0,65536],[4,2],[12,1025],[16,32769]]){
  const b=fixture();new DataView(b.buffer).setUint32(offset,value,true);expect(()=>readPathNodes(b,15)).toThrow('counts');
 }
 for(const [offset,value] of [[38,14],[40,1],[36,65535],[36,2]]){
  const b=fixture();new DataView(b.buffer).setUint16(offset,value,true);expect(()=>readPathNodes(b,15)).toThrow(/address|links/);
 }
 for(const size of [fixture().length-1,fixture().length+1]){const b=new Uint8Array(size);b.set(fixture().subarray(0,size));expect(()=>readPathNodes(b,15)).toThrow('length');}
});
