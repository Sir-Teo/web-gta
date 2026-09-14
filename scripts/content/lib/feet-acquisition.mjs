import {installVerified} from './verified-file.mjs';
export function mediafireDownloadUrl(html){
 const match=html.match(/href="(https:\/\/download[^"\s]+)"/);
 if(!match)throw new Error('MediaFire page has no direct download link.');
 const url=new URL(match[1].replaceAll('&amp;','&'));
 if(url.protocol!=='https:'||!url.hostname.endsWith('.mediafire.com'))throw new Error('Unexpected audio download host.');
 return url.href;
}
export async function readLimitedPage(response,limit=2*1024*1024){
 if(!response.ok||!response.body){await response.body?.cancel();throw new Error(`Audio source page HTTP ${response.status}`);}
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Audio source page exceeds size limit.');chunks.push(chunk);}
 return Buffer.concat(chunks).toString('utf8');
}
export async function acquireArchivePrefix(path,lock,url,fetcher=fetch){
 const [start,end]=lock.downloadedRange,bytes=end-start+1;
 const response=await fetcher(url,{headers:{Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(60000)});
 if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${lock.archiveBytes}`||!response.body){
  await response.body?.cancel();throw new Error('Audio host did not return the exact requested archive range.');
 }
 await installVerified(path,{bytes,sha256:lock.prefixSha256},response.body);
}
