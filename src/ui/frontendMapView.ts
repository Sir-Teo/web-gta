/** The frontend map's zoom and pan (CMenuManager::AdditionalOptionInput's SCREEN_MAP branch, gta-reversed
 * MenuManager_Input.cpp): m_fMapZoom is half the map's size in the menu's 640x448 lines, m_vMapOrigin its centre.
 * The browser's map is a square frame the height of the original's (328 lines, 60 to 388) that shows the whole map at
 * its widest; from there it zooms in to the original's 1100, about the frame's centre, and pans as the original does,
 * always kept covering the frame. Positions are map fractions (0..1, north up) and frame fractions. */
export const FRONTEND_MAP_FRAME=328;
/** The half size at which the whole map fills the square frame. */
export const FRONTEND_MAP_FIT=FRONTEND_MAP_FRAME/2;
/** FRONTEND_MAP_RANGE_MAX. */
export const FRONTEND_MAP_ZOOM_MAX=1100;
/** One PgUp/PgDn step, taken once per PAN_TICK_MS while held; a wheel notch adds 21 more. */
export const FRONTEND_MAP_ZOOM_STEP=7,FRONTEND_MAP_WHEEL_STEP=7+21;
/** PAN_STRIDE × 128: an arrow held moves the map 7 lines each tick. */
export const FRONTEND_MAP_PAN_STEP=7;
export const FRONTEND_MAP_TICK_MS=20;
export class FrontendMapView {
 /** The frame's centre, as a map fraction. */
 cx=.5;cy=.5;
 /** m_fMapZoom. */
 half=FRONTEND_MAP_FIT;
 get magnification(){return this.half/FRONTEND_MAP_FIT;}
 /** The map fraction under a frame fraction. */
 toMap(u:number,v:number){const z=this.magnification;return {x:this.cx+(u-.5)/z,y:this.cy+(v-.5)/z};}
 /** Where a map fraction lies in the frame. */
 toFrame(x:number,y:number){const z=this.magnification;return {x:(x-this.cx)*z+.5,y:(y-this.cy)*z+.5};}
 /** The part of the map the frame shows: its left/top map fraction and its span. */
 get window(){const span=1/this.magnification;return {x:this.cx-span/2,y:this.cy-span/2,span};}
 /** Zooms about the frame's centre by `lines` of m_fMapZoom, within the fit and FRONTEND_MAP_RANGE_MAX. */
 zoom(lines:number){this.half=Math.min(FRONTEND_MAP_ZOOM_MAX,Math.max(FRONTEND_MAP_FIT,this.half+lines));this.clamp();}
 /** Moves the view by frame lines (right and down positive): m_vMapOrigin moves the other way. */
 pan(dx:number,dy:number){const perLine=1/(2*this.half);this.cx+=dx*perLine;this.cy+=dy*perLine;this.clamp();}
 centreOn(x:number,y:number){this.cx=x;this.cy=y;this.clamp();}
 reset(){this.cx=.5;this.cy=.5;this.half=FRONTEND_MAP_FIT;}
 /** The frame never shows past the map's edge (the original's clamp of the origin to the frame). */
 clamp(){const r=.5/this.magnification;this.cx=Math.min(1-r,Math.max(r,this.cx));this.cy=Math.min(1-r,Math.max(r,this.cy));}
}
