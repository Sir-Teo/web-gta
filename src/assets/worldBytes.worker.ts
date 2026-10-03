/* The page's world bytes, off its thread (staticWorldArchive's offThread): a chunk fetched or read back from Cache
 * Storage, checked, kept and inflated, or a loose resource fetched and checked, then handed back without a copy. */
import {AssetFormatError,WorldDownloadError} from './binary';
import {fetchStaticWorldBytes,worldChunk,type BytesFailure} from './staticWorldArchive';
type Request={id:number;abort?:boolean;url:string;resource:{bytes:number;sha256:string;expandedBytes?:number};chunk?:boolean;gzip?:boolean};
const running=new Map<number,AbortController>();
self.onmessage=async({data}:MessageEvent<Request>)=>{
 if(data.abort){running.get(data.id)?.abort(new DOMException('The page no longer wants these bytes.','AbortError'));return;}
 const controller=new AbortController();running.set(data.id,controller);
 try{
  const url=new URL(data.url),{resource}=data;
  let bytes=data.chunk?await worldChunk(url,{...resource,expandedBytes:resource.expandedBytes!},controller.signal):await fetchStaticWorldBytes(url,resource,controller.signal,data.gzip);
  if(bytes.byteOffset!==0||bytes.byteLength!==bytes.buffer.byteLength)bytes=bytes.slice();
  self.postMessage({id:data.id,bytes},{transfer:[bytes.buffer]});
 }catch(error){
  // An aborted job's page has already given up on it.
  if(controller.signal.aborted)return;
  const failure:BytesFailure={kind:error instanceof WorldDownloadError?'download':error instanceof AssetFormatError?'format':'other',message:error instanceof Error?error.message:String(error)};
  self.postMessage({id:data.id,error:failure});
 }finally{running.delete(data.id);}
};
