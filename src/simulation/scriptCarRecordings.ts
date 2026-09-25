import {findIndexWithFileNameNumber,readCarRecording,readCarRecordingIndex,type CarRecordingFile,type CarRecordingFrame} from '../assets/carRecordings';
/* The streaming half of the car recordings: carrec.img's `.rrr` entries, read when the script asks for one.
 * - CVehicleRecording::RequestRecordingFile asks CStreaming for the slot FindIndexWithFileNameNumber gives: the file's
 *   own, or slot 0 for a number no entry has.
 * - Once the entry is read and CVehicleRecording::Load has run, the file counts as loaded.
 * The archive is small (2.3 MB), so it is fetched whole the first time any recording is asked for. Loaded frames stay
 * cached, so a file asked for again is loaded again at once. */
export class ScriptCarRecordingStore {
 private archive?:Promise<{blob:Blob;files:CarRecordingFile[]}>;
 private files?:CarRecordingFile[];
 private readonly frames=new Map<number,CarRecordingFrame[]>();
 private readonly reading=new Map<number,Promise<CarRecordingFrame[]>>();
 /** The last failure, for the dev API. */
 error?:string;
 constructor(private readonly fetchArchive:()=>Promise<Blob>){}
 private open(){return this.archive??=this.fetchArchive().then(async blob=>{const files=await readCarRecordingIndex(blob);this.files=files;return {blob,files};});}
 /** Stream the file in; `loaded` runs once its frames are here. */
 request(fileNumber:number,loaded:(fileNumber:number)=>void){
  void this.open().then(({blob,files})=>{
   if(!files.length)return;
   const slot=findIndexWithFileNameNumber(files,fileNumber);
   const cached=this.frames.get(slot);
   if(cached){loaded(fileNumber);return;}
   let read=this.reading.get(slot);
   if(!read){read=readCarRecording(blob,files[slot]);this.reading.set(slot,read);}
   return read.then(frames=>{this.frames.set(slot,frames);this.reading.delete(slot);loaded(fileNumber);});
  }).catch(error=>{this.error=String(error);});
 }
 /** CPath::m_pData of the file's slot, undefined until it has been streamed. */
 framesOf(fileNumber:number){
  if(!this.files?.length)return undefined;
  return this.frames.get(findIndexWithFileNameNumber(this.files,fileNumber));
 }
}
