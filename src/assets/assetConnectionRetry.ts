import {WorldDownloadError} from './binary';
/** Caller-level retry after the downloader exhausts its own attempts. Invalid content is permanent. */
export function assetConnectionRetryMs(error:unknown,failures:number){
 if(!(error instanceof WorldDownloadError)&&!(error instanceof TypeError))return undefined;
 return Math.min(30000,2000*2**Math.min(Math.max(0,failures-1),4));
}
