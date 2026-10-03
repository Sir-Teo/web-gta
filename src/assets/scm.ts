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
 return decodeScmRange(bytes,start,end,false);
}
/** Decode one executed instruction without interpreting following data as code. */
export function decodeScmInstruction(bytes:Uint8Array,start:number,end=bytes.length):ScmInstruction{
 const instruction=decodeScmRange(bytes,start,end,true)[0];
 requireAsset(instruction,'Missing SCM instruction.');return instruction;
}
/* The same decoding again, for the one caller that runs rather than reads: a script thread. It reads straight
 * from a DataView and refills a record the caller owns, so stepping an instruction allocates nothing. That
 * matters because a profile of the published game's script runtime spends about three quarters of its time in
 * the reader the plain decoder builds, one subarray per byte read.
 *
 * The record's parameter objects are reused between instructions, so a handler must read what it needs before
 * the next instruction is decoded. Every handler does: they read numbers, strings and points out and keep none
 * of the operands. `parameters` is emptied and refilled from a pool that never shrinks, so its length is the
 * real operand count while the objects behind it survive. */
export interface ScmDecodeBuffer extends ScmInstruction {pool:ScmParameter[]}
export function createScmDecodeBuffer():ScmDecodeBuffer{
 return {offset:0,end:0,opcode:0,name:'',parameters:[],pool:[]};
}
const WINDOWS_1252=new TextDecoder('windows-1252');
/* The instruction being decoded. The interpreter decodes thousands of instructions a frame, one at a time and never
 * within another: its reader state lives here, and the readers below are module functions, rather than four closures
 * and an error message (its opcode in a template string) made for every instruction, all garbage a frame later. */
let dBytes:Uint8Array=new Uint8Array(0),dView:DataView=new DataView(dBytes.buffer),dAt=0,dEnd=0,dCount=0,dPool:ScmParameter[]=[];
const need=(length:number)=>{requireAsset(dAt+length<=dEnd,'Truncated asset data.');};
function slot(){
 let entry=dPool[dCount];
 if(!entry){entry={type:0,value:0};dPool[dCount]=entry;}
 dCount++;return entry;
}
function readName(length:number){
 need(length);const from=dBytes.subarray(dAt,dAt+length),zero=from.indexOf(0);
 dAt+=length;return WINDOWS_1252.decode(zero<0?from:from.subarray(0,zero));
}
function readParameter(){
 need(1);const type=dBytes[dAt++],entry=slot();entry.type=type;
 switch(type){
  case 1:need(4);entry.value=dView.getInt32(dAt,true);dAt+=4;break;
  case 4:{need(1);const n=dBytes[dAt++];entry.value=n>=128?n-256:n;break;}
  case 5:{need(2);const n=dView.getUint16(dAt,true);dAt+=2;entry.value=n>=32768?n-65536:n;break;}
  case 6:{
   need(4);const value=dView.getFloat32(dAt,true);dAt+=4;
   // The plain reader refuses a non-finite float rather than repairing it, and so does this one.
   requireAsset(Number.isFinite(value),'Non-finite model coordinate.');entry.value=value;break;
  }
  case 2:case 3:case 10:case 11:case 16:case 17:need(2);entry.value=dView.getUint16(dAt,true);dAt+=2;break;
  case 7:case 8:case 12:case 13:case 18:case 19:{
   need(6);
   const array=Array.isArray(entry.value)&&entry.value.length===6?entry.value:(entry.value=[0,0,0,0,0,0]);
   for(let index=0;index<6;index++)array[index]=dBytes[dAt+index];
   dAt+=6;break;
  }
  case 9:entry.value=readName(8);break;
  case 15:entry.value=readName(16);break;
  case 14:{need(1);const size=dBytes[dAt++];need(size);entry.value=WINDOWS_1252.decode(dBytes.subarray(dAt,dAt+size));dAt+=size;break;}
  default:throw new Error(`Unsupported SCM parameter ${type} at ${dAt-1}.`);
 }
}
export function decodeScmInstructionInto(bytes:Uint8Array,view:DataView,start:number,end:number,target:ScmDecodeBuffer){
 requireAsset(Number.isInteger(start)&&start>=0&&start+2<=end&&end<=bytes.length,'Invalid SCM code region.');
 const {pool,parameters}=target;
 dBytes=bytes;dView=view;dAt=start;dEnd=end;dCount=0;dPool=pool;
 const opcode=view.getUint16(dAt,true);dAt+=2;
 const command=SCM_COMMANDS[opcode&0x7fff];
 if(!command)requireAsset(false,`Unknown SCM opcode at ${start}.`);
 for(const mode of command.parameters){
  if(mode==='raw128'){
   need(128);const entry=slot();entry.type=-1;
   const array=Array.isArray(entry.value)&&entry.value.length===128?entry.value:(entry.value=new Array<number>(128));
   for(let index=0;index<128;index++)array[index]=bytes[dAt+index];
   dAt+=128;
  }else if(mode==='arguments'){
   while(bytes[dAt]!==0){requireAsset(dCount<64,'Too many SCM variable arguments.');readParameter();}
   need(1);dAt++;
  }else readParameter();
 }
 parameters.length=0;
 for(let index=0;index<dCount;index++)parameters.push(pool[index]);
 target.offset=start;target.end=dAt;target.opcode=opcode;target.name=command.name;
}
function decodeScmRange(bytes:Uint8Array,start:number,end:number,one:boolean):ScmInstruction[]{
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
  if(one)break;
 }
 return output;
}
