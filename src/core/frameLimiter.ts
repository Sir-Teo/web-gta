/** The PC original's frame limiter (FrontEndMenuManager.m_bPrefsFrameLimiter, on by default) caps the game at 30 frames a
 * second. The browser keeps the fixed 60 Hz simulation and paces rendering the same way: a display frame is drawn only
 * once a limiter interval has passed, and the menu, which draws nothing new, idles at 10 a second. */
export const FRAME_LIMITER_FPS=30,MENU_FPS=10;
/** `subtitles`: FrontEndMenuManager.m_bShowSubtitles, the PC's and the mobile ports' Subtitles option (on by default):
 * off, the scripts' subtitle lines (text marked ~z~) and the peds' conversation lines are not printed. */
export interface DisplaySettings {frameLimiter:boolean;subtitles:boolean}
export const DEFAULT_DISPLAY:DisplaySettings={frameLimiter:true,subtitles:true};
export function parseDisplaySettings(value:unknown):DisplaySettings{
 const data=value&&typeof value==='object'?value as Partial<DisplaySettings>:{};
 return {frameLimiter:typeof data.frameLimiter==='boolean'?data.frameLimiter:DEFAULT_DISPLAY.frameLimiter,subtitles:typeof data.subtitles==='boolean'?data.subtitles:DEFAULT_DISPLAY.subtitles};
}
export function readDisplaySettings():DisplaySettings{
 try{return parseDisplaySettings(JSON.parse(localStorage.getItem('grove-display-v1')??'null'));}catch{return {...DEFAULT_DISPLAY};}
}
export function saveDisplaySettings(settings:DisplaySettings){
 try{localStorage.setItem('grove-display-v1',JSON.stringify(settings));}catch{/* The session keeps its settings. */}
}
/** Frame pacing state: `lastDrawn` is the timestamp of the last drawn frame in the limiter's grid. */
export interface FramePacer {lastDrawn:number}
/** Whether a display frame at `now` (ms) is due, and the pacer advanced to it. A display running at a multiple of the
 * cap (60 or 120 Hz against 30) lands on every second or fourth frame; the 1.5 ms slack absorbs timer jitter. */
export function frameDue(pacer:FramePacer,now:number,fps:number|undefined){
 if(fps===undefined){pacer.lastDrawn=now;return true;}
 const interval=1000/fps;
 if(now-pacer.lastDrawn<interval-1.5)return false;
 // Stay on the grid while keeping up; resynchronise after a stall longer than two intervals.
 pacer.lastDrawn=now-pacer.lastDrawn>2*interval?now:pacer.lastDrawn+interval*Math.max(1,Math.floor((now-pacer.lastDrawn+1.5)/interval));
 return true;
}
