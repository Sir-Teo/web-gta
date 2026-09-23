import {requireAsset} from './binary';
import {readImgEntry,readImgIndex,type ImgEntry} from './img';
/* The car recordings (data\paths\carrec.img), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166
 * (`VehicleRecording.cpp`/`.h`, every function below registered reversed):
 * - CStreaming::LoadCdDirectory (Streaming.cpp) hands each `.rrr` entry (extension compared case-blind) to
 *   CVehicleRecording::RegisterRecordingFile 0x459F80, in directory order: the entry's streaming slot is the order it
 *   was registered in (RRRToModelId, TOTAL_RRR_MODEL_IDS 475 of them) and its number is read from the name.
 * - CVehicleRecording::Load 0x45A8F0 reads the whole streamed entry (its sector-rounded size), prunes the recording at
 *   the first frame after the zeroth whose time is zero (the sector padding), then SmoothRecording 0x45A0F0.
 * - CVehicleStateEachFrame is 0x20 bytes. VehicleRecording.h declares the steering, gas and brake bytes
 *   `FixedFloat<uint8,..>`, but the retail file stores them signed: steering bytes run 0..15 and 239..255 (left and
 *   right locks of about -0.85..0.75 rad) and reversing frames carry gas bytes above 100 (-0.32 is 224). An unsigned
 *   read would put a 12 rad lock on every left turn, so these three are read as int8 here (the III/VC chase-record
 *   format, re3's CRecordDataForChase, keeps them int8 too). FixedFloat converts to float by division, no rounding.
 * Coordinates are native (Z up); nothing here maps to the browser frame. */
export type CarRecordingVector=[number,number,number];
/** CVehicleStateEachFrame, decoded. */
export interface CarRecordingFrame {
 /** m_nTime, milliseconds from the start of the recording (uint32). SmoothRecording rewrites it. */
 time:number;
 /** m_sVelocity, int16 / 16383.5: the move speed in units per 50 fps frame. */
 velocity:CarRecordingVector;
 /** m_bRight and m_bTop, int8 / 127: the matrix right and forward axes. */
 right:CarRecordingVector;top:CarRecordingVector;
 /** m_bSteeringAngle / 20 (radians), m_bGasPedalPower and m_bBreakPedalPower / 100; see the header on sign. */
 steer:number;gas:number;brake:number;
 handbrake:boolean;
 /** m_vecPosn. */
 position:CarRecordingVector;
}
/** sizeof(CVehicleStateEachFrame). */
export const CAR_RECORDING_FRAME_BYTES=0x20;
/** TOTAL_RRR_MODEL_IDS (constants.h): the streaming slots car recordings can take. */
export const TOTAL_RRR_MODEL_IDS=475;
const f32=Math.fround;
/** CVehicleRecording::RegisterRecordingFile's number: `sscanf(name,"carrec%d")`, else `"CARREC%d"`, else the 850 it
 * starts from (the source VERIFYs that one of the two matches). `%d` skips leading white space and takes a sign. */
export function recordingFileNumber(name:string){
 const match=/^carrec\s*([+-]?\d+)/.exec(name)??/^CARREC\s*([+-]?\d+)/.exec(name);
 return match?Number(match[1])|0:850;
}
/** Every whole 0x20-byte frame in `bytes`, as the streamed buffer holds them (no pruning). */
export function decodeCarRecordingFrames(bytes:Uint8Array):CarRecordingFrame[]{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),frames:CarRecordingFrame[]=[];
 for(let at=0;at+CAR_RECORDING_FRAME_BYTES<=bytes.byteLength;at+=CAR_RECORDING_FRAME_BYTES){
  const i16=(o:number)=>f32(view.getInt16(at+o,true)/16383.5),i8=(o:number,scale:number)=>f32(view.getInt8(at+o)/scale);
  frames.push({time:view.getUint32(at,true),velocity:[i16(4),i16(6),i16(8)],right:[i8(10,127),i8(11,127),i8(12,127)],top:[i8(13,127),i8(14,127),i8(15,127)],
   steer:i8(16,20),gas:i8(17,100),brake:i8(18,100),handbrake:view.getUint8(at+19)!==0,
   position:[view.getFloat32(at+20,true),view.getFloat32(at+24,true),view.getFloat32(at+28,true)]});
 }
 return frames;
}
/** CVehicleRecording::SmoothRecording 0x45A0F0, in place: from the fifth frame on, the frame before takes the mean of
 * its neighbours' times, the earlier neighbour already smoothed. The first three and the last frame keep theirs. */
export function smoothRecording(frames:CarRecordingFrame[]){
 for(let i=4;i<frames.length;i++)frames[i-1].time=Math.trunc(f32(f32((frames[i].time+frames[i-2].time)>>>0)/2))>>>0;
 return frames;
}
/** CVehicleRecording::Load 0x45A8F0 over the bytes the streamer read: decode, prune at the first zero time after the
 * zeroth frame, smooth. */
export function loadCarRecording(bytes:Uint8Array){
 const frames=decodeCarRecordingFrames(bytes);
 const end=frames.findIndex((frame,i)=>i!==0&&frame.time===0);
 if(end>=0)frames.length=end;
 return smoothRecording(frames);
}
/** One CPath slot of CVehicleRecording::StreamingArray before its data is streamed. */
export interface CarRecordingFile {streamingIndex:number;fileNumber:number;entry:ImgEntry}
/** The `.rrr` entries of an IMG as LoadCdDirectory registers them: directory order, streaming index, file number.
 * LoadCdDirectory takes the extension from the first '.' and compares its first three letters case-blind. */
export function registerCarRecordingFiles(entries:readonly ImgEntry[]):CarRecordingFile[]{
 const files:CarRecordingFile[]=[];
 for(const entry of entries){
  const dot=entry.name.indexOf('.');
  if(dot<0||entry.name.slice(dot+1,dot+4).toUpperCase()!=='RRR')continue;
  requireAsset(files.length<TOTAL_RRR_MODEL_IDS,'More car recordings than TOTAL_RRR_MODEL_IDS.');
  files.push({streamingIndex:files.length,fileNumber:recordingFileNumber(entry.name.slice(0,dot)),entry});
 }
 return files;
}
/** CVehicleRecording::FindIndexWithFileNameNumber 0x459FF0: the first slot with that number, and 0 (the first slot)
 * when none has it, which StartPlaybackRecordedCar then plays. */
export function findIndexWithFileNameNumber(files:readonly {fileNumber:number}[],fileNumber:number){
 const index=files.findIndex(file=>file.fileNumber===fileNumber);
 return index<0?0:index;
}
/** CVehicleRecording::FindRecording: the slot with that number, or undefined. */
export function findRecording<T extends {fileNumber:number}>(files:readonly T[],fileNumber:number):T|undefined{
 if(!files.length)return undefined;
 const index=findIndexWithFileNameNumber(files,fileNumber);
 return index!==0||files[index].fileNumber===fileNumber?files[index]:undefined;
}
/** carrec.img's recordings, registered, with no frames read yet. */
export async function readCarRecordingIndex(file:Blob){return registerCarRecordingFiles(await readImgIndex(file));}
/** One recording streamed in and loaded (CStreaming reads the entry's whole sectors, then CVehicleRecording::Load). */
export async function readCarRecording(file:Blob,recording:CarRecordingFile){
 requireAsset(recording.entry.length<=9_999_999,'Car recording exceeds the size Load reads.');
 return loadCarRecording(await readImgEntry(file,recording.entry));
}
