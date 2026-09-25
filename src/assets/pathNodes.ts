import {BinaryReader,requireAsset} from './binary';
export interface PathAddress {area:number;node:number;}
export interface PathNode {
 address:PathAddress;position:[number,number,number];kind:'vehicle'|'pedestrian';
 baseLink:number;linkCount:number;width:number;floodFill:number;flags:number;
 deadEnd:boolean;switchedOff:boolean;water:boolean;dontWander:boolean;
 /** CPathNode::m_isSwitchedOffOriginal: the switch as the area loaded, which the back-to-original switches restore. */
 switchedOffOriginal:boolean;
 spawnProbability:number;behaviour:number;
}
export interface NavigationNode {
 position:[number,number];attachedTo:PathAddress;direction:[number,number];width:number;
 oppositeLanes:number;sameLanes:number;trafficLightDirection:boolean;trafficLightState:number;bridgeLights:boolean;flags:number;
}
export interface PathArea {
 area:number;vehicleCount:number;pedestrianCount:number;linkCount:number;
 nodes:PathNode[];navigation:NavigationNode[];links:PathAddress[];
 navigationLinks:(PathAddress|null)[];lengths:Uint8Array;intersections:Uint8Array;bytesRead:number;
}
/** Original PC nodes*.dat layout. Coordinates remain native Z-up. Pointer/search
 * fields are serialized runtime state, never executable addresses in the browser. */
export function readPathNodes(bytes:Uint8Array,area:number):PathArea{
 requireAsset(Number.isInteger(area)&&area>=0&&area<64,'Invalid exterior path area.');
 requireAsset(bytes.length<=4*1024*1024,'Path area exceeds the byte limit.');
 const r=new BinaryReader(bytes),count=r.u32(),vehicleCount=r.u32(),pedestrianCount=r.u32(),navigationCount=r.u32(),linkCount=r.u32();
 requireAsset(count===vehicleCount+pedestrianCount&&count<=65535&&navigationCount<=1024&&linkCount<=32768,'Invalid path area counts.');
 const slots=linkCount?linkCount+192:0;
 const expected=20+count*28+navigationCount*14+slots*6+linkCount*2;
 requireAsset(bytes.length===expected||bytes.length===Math.ceil(expected/2048)*2048,'Invalid path area length or archive padding.');
 const i16=()=>{const n=r.u16();return n>=32768?n-65536:n;};
 const i8=()=>{const n=r.u8();return n>=128?n-256:n;};
 const address=():PathAddress=>({area:r.u16(),node:r.u16()});
 const nodes:PathNode[]=[],navigation:NavigationNode[]=[];
 for(let index=0;index<count;index++){
  r.take(8);
  const position:[number,number,number]=[i16()/8,i16()/8,i16()/8];
  r.take(2);
  const baseLink=i16(),nodeAddress=address(),width=r.u8()/16,floodFill=r.u8(),flags=r.u32(),numLinks=flags&15;
  requireAsset(nodeAddress.area===area&&nodeAddress.node===index,'Path node address does not match its area/index.');
  requireAsset(numLinks===0||baseLink>=0&&baseLink+numLinks<=linkCount,'Path node links exceed the static address table.');
  nodes.push({address:nodeAddress,position,kind:index<vehicleCount?'vehicle':'pedestrian',baseLink,linkCount:numLinks,width,floodFill,flags,
   deadEnd:!!(flags&16),switchedOff:!!(flags&32),switchedOffOriginal:!!(flags&32),water:!!(flags&128),dontWander:!!(flags&1024),spawnProbability:(flags>>>16)&15,behaviour:(flags>>>20)&15});
 }
 for(let index=0;index<navigationCount;index++){
  const position:[number,number]=[i16()/8,i16()/8],attachedTo=address(),direction:[number,number]=[i8()/100,i8()/100],width=i8()/16,lanes=r.u8(),flags=r.u16();
  navigation.push({position,attachedTo,direction,width,oppositeLanes:lanes&7,sameLanes:(lanes>>>3)&7,trafficLightDirection:!!(lanes&64),trafficLightState:flags&3,bridgeLights:!!(flags&4),flags:lanes|(flags<<8)});
 }
 const links=Array.from({length:slots},address);
 const navigationLinks=Array.from({length:linkCount},()=>{const packed=r.u16();return packed===65535?null:{area:packed>>>10,node:packed&1023};});
 const lengths=r.take(slots).slice(),intersections=r.take(slots).slice();
 return {area,vehicleCount,pedestrianCount,linkCount,nodes,navigation,links,navigationLinks,lengths,intersections,bytesRead:r.position};
}
