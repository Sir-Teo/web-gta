import {assetConnectionRetryMs} from '../assets/assetConnectionRetry';
import type {NativeScriptFonts} from './NativeScriptFonts';
/** Owns pending font loads and retry timers; the installed atlas belongs to the script-text layer. */
export class NativeScriptFontLoader {
 private disposed=false;private failures=0;private retry?:ReturnType<typeof setTimeout>;
 private request:Promise<void>=Promise.resolve();private pending=false;private error:string|null=null;
 constructor(private readonly load:()=>Promise<NativeScriptFonts>,private readonly install:(fonts:NativeScriptFonts)=>void){this.start();}
 private start(){
  this.retry=undefined;this.pending=true;this.error=null;
  this.request=Promise.resolve().then(()=>this.disposed?undefined:this.load()).then(fonts=>{
   if(!fonts)return;
   if(this.disposed){fonts.dispose();return;}
   try{this.install(fonts);}catch(error){fonts.dispose();throw error;}
   this.failures=0;
  }).catch(error=>{
   if(this.disposed)return;
   this.error=String(error);const delay=assetConnectionRetryMs(error,++this.failures);
   if(delay!==undefined)this.retry=setTimeout(()=>{if(!this.disposed)this.start();},delay);
  }).finally(()=>{this.pending=false;});
 }
 settled(){return this.request;}
 state(){return{pending:this.pending,retrying:this.retry!==undefined,error:this.error};}
 dispose(){if(this.disposed)return;this.disposed=true;if(this.retry!==undefined)clearTimeout(this.retry);this.retry=undefined;this.pending=false;this.error=null;}
}
