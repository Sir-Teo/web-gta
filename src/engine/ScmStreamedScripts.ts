import {requireAsset} from '../assets/binary';
/* CStreamedScripts, pinned gta-reversed ead3051 (`StreamedScripts.cpp`, reversed in full): the external script
 * files that live beside MAIN.SCM in `script.img`, which the campaign starts one at a time. The streaming
 * itself, which reads a file into a slot and reclaims it, is the host's; this is the registry that names the
 * slots, the sizes and indices the header hands them, and the reference counting a start and a release do. */
/** CStreamedScripts::NUM_STREAMED_SCRIPTS. */
export const NUM_STREAMED_SCRIPTS=82;
export interface StreamedScriptSlot {
 /** The file's name as the archive spells it, without its extension. */
 filename:string;
 /** The bytes once a host has loaded them, or nothing while the slot is empty. */
 memory?:Uint8Array;
 /** m_NumberOfUsers: every start adds one, and ReInitialise drops them all so the streamer can reclaim. */
 users:number;
 /** m_IndexUsedByScriptFile: the position this file has in MAIN.SCM's streamed table, or -1 until it is read. */
 indexUsedByScriptFile:number;
 sizeInBytes:number;
}
const emptySlot=():StreamedScriptSlot=>({filename:'',users:0,indexUsedByScriptFile:-1,sizeInBytes:0});
export class ScmStreamedScripts {
 private slots:StreamedScriptSlot[]=[];
 /** m_nLargestExternalSize, from the header's streamed chunk. */
 largestExternalSize=0;
 /** CStreamedScripts::Initialise (0x470660): every slot empty and nothing registered. */
 initialise(){this.slots=[];this.largestExternalSize=0;}
 /** CStreamedScripts::ReInitialise (0x4706A0): the files stay where they are, but nothing holds them. */
 reInitialise(){for(const slot of this.slots)slot.users=0;}
 get count(){return this.slots.length;}
 get registered():readonly StreamedScriptSlot[]{return this.slots;}
 at(index:number){
  requireAsset(Number.isInteger(index)&&index>=0&&index<this.slots.length,'Streamed script index out of range.');
  return this.slots[index];
 }
 /** CStreamedScripts::RegisterScript (0x4706C0): the archive's files in the order it lists them. */
 registerScript(name:string){
  requireAsset(this.slots.length<NUM_STREAMED_SCRIPTS,'CStreamedScripts holds eighty-two scripts.');
  const slot=emptySlot();slot.filename=name;this.slots.push(slot);
  return this.slots.length-1;
 }
 /** CStreamedScripts::FindStreamedScriptQuiet (0x4706F0): by name, ignoring case, or -1. */
 findStreamedScript(name:string){
  const wanted=name.toLowerCase();
  return this.slots.findIndex(slot=>slot.filename.toLowerCase()===wanted);
 }
 /** CStreamedScripts::GetProperIndexFromIndexUsedByScript (0x470810). */
 properIndexFromScriptIndex(scmIndex:number){return this.slots.findIndex(slot=>slot.indexUsedByScriptFile===scmIndex);}
 /** CStreamedScripts::GetStreamedScriptFilename (0x470900). */
 filename(index:number){return this.at(index).filename;}
 /** CStreamedScripts::ReadStreamedScriptData (0x470750): the header's streamed table gives each registered
  * file its size and the index the script addresses it by, in the table's own order. A name in the table that
  * no registered file matches is an out-of-bounds read in the source, so it fails here instead. */
 readStreamedScriptData(table:readonly {name:string;size:number}[],largestSize:number){
  this.largestExternalSize=largestSize;
  for(const [scriptIndex,entry] of table.entries()){
   if(scriptIndex>=this.slots.length)break;
   const index=this.findStreamedScript(entry.name);
   requireAsset(index>=0,`Streamed script ${entry.name} is not in the archive.`);
   const slot=this.slots[index];
   slot.sizeInBytes=entry.size;slot.indexUsedByScriptFile=scriptIndex;
  }
 }
 /** CStreamedScripts::LoadStreamedScript (0x470840): the slot takes the bytes the streamer read for it. */
 loadStreamedScript(index:number,bytes:Uint8Array){
  const slot=this.at(index);
  requireAsset(bytes.length>=slot.sizeInBytes,'Streamed script is shorter than the header says.');
  slot.memory=bytes.subarray(0,slot.sizeInBytes||bytes.length);
 }
 /** CStreamedScripts::RemoveStreamedScriptFromMemory (0x4708E0). */
 removeFromMemory(index:number){this.at(index).memory=undefined;}
 /** CStreamedScripts::StartNewStreamedScript (0x470890): a loaded slot hands out its bytes for a thread that
  * runs external, and counts one more user; an empty slot starts nothing. */
 startNewStreamedScript(index:number){
  const slot=this.at(index);
  if(!slot.memory)return undefined;
  slot.users++;
  return {index,bytes:slot.memory};
 }
 /** CStreamedScripts::GetStreamedScriptWithThisStartAddress (0x470910): which slot owns a running thread's
  * bytes, so a script can be named from the thread that runs it. */
 indexOfMemory(bytes:Uint8Array){return this.slots.findIndex(slot=>slot.memory===bytes);}
}
