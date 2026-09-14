import {BinaryReader,requireAsset} from './binary';
import {SCM_COMMANDS} from './scmCommands';
export function readScmHeader(bytes:Uint8Array){
 requireAsset(bytes.length<=16*1024*1024,'SCM exceeds the 16 MiB browser limit.');
 const chunks:{index:number;start:number;end:number}[]=[];let at=0;
 for(const index of [115,0,1,2,3,4]){
  const r=new BinaryReader(bytes);r.position=at;requireAsset(r.u8()===2&&r.u8()===0&&r.u8()===1,'Invalid SCM header jump.');const end=r.u32();requireAsset(r.u8()===index&&end>=at+8&&end<=bytes.length,'Invalid SCM header order or bounds.');chunks.push({index,start:at,end});at=end;
 }
 const body=(i:number)=>new BinaryReader(bytes.subarray(chunks[i].start+8,chunks[i].end));
 const objects=body(1),objectCount=objects.u32();requireAsset(objectCount<=5000&&objectCount*24<=objects.bytes.length-4,'Invalid SCM object count.');const objectNames=Array.from({length:objectCount},()=>objects.name(24));
 const info=body(2),mainSize=info.u32(),largestMissionSize=info.u32(),missionCount=info.u16(),exclusiveMissions=info.u16(),missionLocals=info.u32();
 requireAsset(mainSize>=at&&mainSize<=bytes.length&&missionCount<=200&&exclusiveMissions<=missionCount&&missionCount*4<=info.bytes.length-16,'Invalid SCM mission table.');
 const offsets=Array.from({length:missionCount},()=>info.u32());
 const missions=offsets.map((start,index)=>{const end=offsets[index+1]??bytes.length;requireAsset(start>=mainSize&&end>start&&end<=bytes.length&&end-start<=largestMissionSize,'Invalid SCM mission range.');return {index,start,end};});
 const streaming=body(3),largestStreamedSize=streaming.u32(),streamCount=streaming.u32();requireAsset(streamCount<=1000&&streamCount*28<=streaming.bytes.length-8,'Invalid SCM streamed-script count.');
 const streamed=Array.from({length:streamCount},()=>{const name=streaming.name(20),offset=streaming.u32(),size=streaming.u32();requireAsset(name&&size<=largestStreamedSize,'Invalid SCM streamed-script definition.');return {name,offset,size};});
 const extra=body(5),globalBytes=extra.u32(),build=extra.u32();requireAsset(globalBytes===chunks[0].end-8,'SCM global-space sizes disagree.');
 return {chunks,entry:at,mainSize,globalBytes,objectNames,largestMissionSize,exclusiveMissions,missionLocals,missions,largestStreamedSize,streamed,build};
}
export interface ScmParameter {type:number;value:number|string|number[]}
export interface ScmInstruction {offset:number;end:number;opcode:number;name:string;parameters:ScmParameter[]}
/** Decode data only. No opcodes, scripts, branches or side effects are executed. */
export function decodeScmInstructions(bytes:Uint8Array,start:number,end:number):ScmInstruction[]{
 requireAsset(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=start&&end<=bytes.length,'Invalid SCM code region.');
 const reader=new BinaryReader(bytes.subarray(start,end)),output:ScmInstruction[]=[];
 const parameter=():ScmParameter=>{
  const type=reader.u8();let value:ScmParameter['value'];
  switch(type){
   case 1:value=reader.i32();break;
   case 4:{const n=reader.u8();value=n>=128?n-256:n;break;}
   case 5:{const n=reader.u16();value=n>=32768?n-65536:n;break;}
   case 6:value=reader.f32();break;
   case 2:case 3:case 10:case 11:case 16:case 17:value=reader.u16();break;
   case 7:case 8:case 12:case 13:case 18:case 19:value=Array.from(reader.take(6));break;
   case 9:value=reader.name(8);break;
   case 15:value=reader.name(16);break;
   case 14:{const size=reader.u8();value=new TextDecoder('windows-1252').decode(reader.take(size));break;}
   default:throw new Error(`Unsupported SCM parameter ${type} at ${start+reader.position-1}.`);
  }
  return {type,value};
 };
 while(reader.position<reader.bytes.length){
  requireAsset(output.length<500000,'SCM instruction limit exceeded.');const offset=start+reader.position,opcode=reader.u16(),command=SCM_COMMANDS[opcode&0x7fff];requireAsset(command,`Unknown SCM opcode at ${offset}.`);const parameters:ScmParameter[]=[];
  for(const mode of command.parameters){
   if(mode==='raw128'){parameters.push({type:-1,value:Array.from(reader.take(128))});}
   else if(mode==='arguments'){while(reader.bytes[reader.position]!==0){requireAsset(parameters.length<64,'Too many SCM variable arguments.');parameters.push(parameter());}reader.u8();}
   else parameters.push(parameter());
  }
  output.push({offset,end:start+reader.position,opcode,name:command.name,parameters});
 }
 return output;
}
