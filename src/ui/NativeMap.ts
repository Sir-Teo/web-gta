import {limitRadarPoint,radarNorth,radarPoint,RADAR_MIN_RANGE} from './nativeRadar';
import {RADAR_SPRITE_NAMES,type ScmRadarBlip} from '../assets/scmRadarBlips';
import {ZONE_SQUARES,type NativeZonesVisited} from '../world/nativeZonesVisited';
import {FrontendMapView,FRONTEND_MAP_PAN_STEP,FRONTEND_MAP_TICK_MS,FRONTEND_MAP_WHEEL_STEP,FRONTEND_MAP_ZOOM_STEP} from './frontendMapView';
/** CRadar::DisplayThisBlip for a player who cannot see outside: only traces and the centre, north,
 * waypoint, mafia casino, school, triad casino and cash sprites (the menu's blip-category toggles do not exist here). */
const INDOOR_SPRITES=new Set([0,1,2,3,4,25,36,41,44,52]);
export function displayThisBlip(sprite:number,indoors:boolean){return !indoors||INDOOR_SPRITES.has(sprite);}
/** Original radar tiles use x east, native y north; browser z is -native y. */
export function worldToMap(x:number,z:number){return {x:(x+3000)/6000,y:(z+3000)/6000};}
export function mapToWorld(x:number,y:number){return {x:x*6000-3000,z:y*6000-3000};}
/** A live blip: browser x/z, a sprite by eRadarSprite or a coloured trace `size` lines each way; `dz` is its height over
 * the player's (for the trace's up and down triangles), `shortRange` hides it off the radar, `fade` keeps its own
 * alpha instead of the distance fade. */
export interface LiveBlip {x:number;z:number;sprite?:number;colour?:string;size?:number;dz?:number;shortRange?:boolean;fade?:boolean}
/** CRadar::CalculateBlipAlpha (0x583420): 255 - d/6 x 255, as an unsigned, no less than 70, kept to a byte. */
export function blipAlpha(distance:number){const a=(255-Math.trunc(distance/6*255))>>>0;return Math.max(a,70)&255;}
/** A gang territory (CRadar::DrawRadarGangOverlay): a browser x/z rectangle and its rgba colour. */
export interface ZoneOverlay {x1:number;z1:number;x2:number;z2:number;colour:string}
export class NativeMap {
 onFly?:(modelId:number)=>Promise<void>;
 onToggle?:(open:boolean)=>void;
 /** Whether the map may open now: not while the game shows its widescreen borders (a cutscene or scripted scene),
  * where the HUD, the map with it, is hidden. */
 canOpen?:()=>boolean;
 /** Letter keys the open map takes from the game, passed on to CCheat's string. */
 onLetter?:(letter:string)=>void;
 readonly element=document.createElement('section');
 private image=new Image();
 private mini:HTMLCanvasElement;
 private full:HTMLCanvasElement;
 private panel:HTMLElement;
 private status:HTMLElement;
 private position={x:2495,z:1687};
 private heading=0;
 /** Where the camera looks (atan2(dx, dz)) and CRadar::m_radarRange, for the HUD radar. */
 private radar:{viewHeading:number;range:number;ring?:number;altitude?:number;zoomed?:boolean;horizon?:number}={viewHeading:Math.PI,range:RADAR_MIN_RANGE};
 /** CHud::Draw's !bScriptDontDisplayRadar: DISPLAY_RADAR FALSE hides the radar. */
 showRadar(on:boolean){const b=this.element.querySelector<HTMLElement>('.minimap-button');if(b&&b.hidden===on)b.hidden=!on;}
 /** CHud::DrawRadar's altimeter: the bar left of the radar and its height mark. */
 private altimeter=document.createElement('div');private altimeterMark=document.createElement('div');
 private waypoint?:{x:number;z:number};
 private loaded=false;

 /** hud.txd's RADAR_DISC (tinted black once) and blip sprites, when loaded. */
 private sprites:{disc?:HTMLCanvasElement;north?:HTMLImageElement;centre?:HTMLImageElement;waypoint?:HTMLImageElement;ring?:HTMLImageElement;mapHere?:HTMLImageElement}={};
 /** DrawYouAreHereSprite's blink, and the mouse over the frontend map (0-1 across the drawn square) for its ruler. */
 private hereTimer=0;private hereShown=true;private pointer?:{x:number;y:number;held:boolean};
 /** The script's sprite blips (the INITIAL mission's) and their sprites by eRadarSprite. */
 private blips:readonly ScmRadarBlip[]=[];private blipSprites=new Map<number,HTMLImageElement>();
 /** Live blips the game adds (a gang war's attack point and attackers): browser x/z, a sprite by eRadarSprite or a
  * coloured square (CRadar::ShowRadarTrace, `size` lines each way). */
 private liveBlips:readonly LiveBlip[]=[];
 setLiveBlips(blips:readonly LiveBlip[]){this.liveBlips=blips;}
 /** CGame::currArea is not 0: the radar shows no map. */
 indoors=false;
 /** CTheZones' explored squares, which fog the frontend map and hide its short-range blips. */
 zones?:NativeZonesVisited;
 /** HIDE_ALL_FRONTEND_BLIPS, or the player off the map (SET_PLAYER_IS_IN_STADIUM): no blips on the frontend map. */
 hideMapBlips=false;
 /** CPlaceName::GetForMap: the name of the smallest zone at a native x/y, for the area under the mouse. */
 placeAt?:(x:number,y:number)=>string|undefined;
 private zoneOverlays:readonly ZoneOverlay[]=[];
 setZoneOverlays(overlays:readonly ZoneOverlay[]){this.zoneOverlays=overlays;}
 constructor(container:HTMLElement){
  this.element.className='native-navigation';
  this.element.innerHTML=`<button class="minimap-button" aria-label="Open San Andreas map"><canvas width="220" height="220" aria-label="Local roads and player position"></canvas></button><section class="world-map-panel" hidden tabindex="-1" aria-label="San Andreas map"><div class="map-toolbar"><strong>San Andreas</strong><label>Destination <select class="map-destination" aria-label="Map destination"><option value="">Choose a place</option><option value="grove">Grove Street</option><option value="meadows">Verdant Meadows airfield</option><option value="ls-airport">Los Santos airport</option><option value="sf-airport">San Fierro airport</option><option value="lv-airport">Las Venturas airport</option></select></label><label>Aircraft <select aria-label="Aircraft" class="map-aircraft"><option value="593">Dodo</option><option value="476">Rustler</option><option value="519">Shamal</option><option value="511">Beagle</option><option value="512">Cropduster</option><option value="513">Stuntplane</option><option value="553">Nevada</option><option value="487">Maverick</option><option value="425">Hunter</option><option value="520">Hydra (VTOL)</option><option value="417">Leviathan</option><option value="447">Seasparrow</option><option value="469">Sparrow</option><option value="488">News Maverick</option><option value="497">Police Maverick</option><option value="548">Cargobob</option><option value="563">Raindance</option></select></label><button class="map-fly">Fly from Verdant Meadows</button><button class="map-clear">Clear waypoint</button><button class="map-close">Close [M]</button></div><canvas width="1200" height="1200" aria-label="Full San Andreas map; click to set a waypoint"></canvas><p class="map-status" role="status">Loading original map…</p></section>`;
  container.append(this.element);
  this.altimeter.className='radar-altimeter';this.altimeterMark.className='radar-altimeter-mark';this.altimeter.hidden=this.altimeterMark.hidden=true;this.element.append(this.altimeter,this.altimeterMark);this.mini=this.element.querySelector('.minimap-button canvas')!;this.full=this.element.querySelector('.world-map-panel canvas')!;this.panel=this.element.querySelector('.world-map-panel')!;this.status=this.element.querySelector('.map-status')!;
  this.element.querySelector<HTMLButtonElement>('.minimap-button')!.onclick=()=>this.toggle();
  this.element.querySelector<HTMLButtonElement>('.map-close')!.onclick=()=>this.toggle(false);
  // Tab and Shift+Tab stay among the open map's controls, wrapping round; M closes it from any but a list.
  this.panel.addEventListener('keydown',e=>{
   // The game's keydown skips a focused control, and M stops here: those letters still go to the cheat string.
   const target=e.target as HTMLElement,letter=/^Key([A-Z])$/.exec(e.code)?.[1];
   if(letter&&!e.repeat&&!target.closest('select')&&(e.code==='KeyM'||target.closest('input, button')))this.onLetter?.(letter);
   if(e.code==='KeyM'&&!target.closest('select')){e.preventDefault();e.stopPropagation();if(!e.repeat)this.toggle(false);return;}
   // The frontend map's keys: PgUp/PgDn zoom and the arrows pan while held; Home centres on CJ (the map's opening view).
   if(['PageUp','PageDown','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&!target.closest('select')){e.preventDefault();this.mapKeys.add(e.code);this.mapKeyTick=0;this.stepMapKeys();this.draw();return;}
   if(e.code==='Home'&&!target.closest('select')){e.preventDefault();const m=worldToMap(this.position.x,this.position.z);this.view.centreOn(m.x,m.y);this.draw();return;}
   if(e.code!=='Tab')return;e.stopPropagation();
   const controls=[...this.panel.querySelectorAll<HTMLElement>('select,button')].filter(c=>!(c as HTMLButtonElement).disabled),at=controls.indexOf(document.activeElement as HTMLElement);
   if(e.shiftKey&&at<=0){e.preventDefault();controls[controls.length-1]?.focus();}else if(!e.shiftKey&&(at<0||at===controls.length-1)){e.preventDefault();controls[0]?.focus();}
  });
  this.panel.addEventListener('keyup',e=>{this.mapKeys.delete(e.code);});
  // CPad::IsMouseWheelUp zooms in, down zooms out, 28 lines a notch; a sideways scroll does nothing.
  this.full.addEventListener('wheel',e=>{e.preventDefault();if(e.deltaY===0)return;this.view.zoom(e.deltaY<0?FRONTEND_MAP_WHEEL_STEP:-FRONTEND_MAP_WHEEL_STEP);this.requestDraw();},{passive:false});
  this.element.querySelector<HTMLButtonElement>('.map-clear')!.onclick=()=>{this.notice=undefined;this.waypoint=undefined;this.element.querySelector<HTMLSelectElement>('.map-destination')!.value='';this.draw();};
  this.element.querySelector<HTMLSelectElement>('.map-destination')!.onchange=e=>{const places:Record<string,{x:number;z:number}>={grove:{x:2495,z:1687},meadows:{x:400,z:-2500},'ls-airport':{x:1685,z:2420},'sf-airport':{x:-1330,z:240},'lv-airport':{x:1450,z:-1450}};const destination=places[(e.target as HTMLSelectElement).value];if(destination){this.notice=undefined;this.waypoint={...destination};this.draw();}(e.target as HTMLSelectElement).blur();};
  const fly=this.element.querySelector<HTMLButtonElement>('.map-fly')!;
  fly.onclick=async()=>{if(!this.onFly)return;fly.disabled=true;try{await this.onFly(Number(this.element.querySelector<HTMLSelectElement>('.map-aircraft')!.value));}catch(error){this.notice=error instanceof Error?error.message:String(error);this.draw();}finally{fly.disabled=false;}};
  const track=(e:MouseEvent)=>{const r=this.full.getBoundingClientRect(),side=Math.min(r.width,r.height),u=(e.clientX-r.left-(r.width-side)/2)/side,v=(e.clientY-r.top-(r.height-side)/2)/side;this.pointer=u>=0&&u<=1&&v>=0&&v<=1?{x:u,y:v,held:(e.buttons&1)!==0}:undefined;this.requestDraw();};
  this.full.addEventListener('mousemove',track);this.full.addEventListener('mousedown',track);this.full.addEventListener('mouseup',track);this.full.addEventListener('mouseleave',()=>{this.pointer=undefined;this.requestDraw();});
  this.full.onclick=e=>{this.notice=undefined;this.element.querySelector<HTMLSelectElement>('.map-destination')!.value='';const r=this.full.getBoundingClientRect();
   // The square map is drawn contained (object-fit) in a box the panel may squeeze out of square: measure the click
   // against the drawn square, and leave the bars beside it alone.
   const side=Math.min(r.width,r.height),u=(e.clientX-r.left-(r.width-side)/2)/side,v=(e.clientY-r.top-(r.height-side)/2)/side;
   if(u<0||u>1||v<0||v>1)return;
   const m=this.view.toMap(u,v);this.waypoint=mapToWorld(m.x,m.y);this.draw();};
  this.image.onload=()=>{this.loaded=true;this.draw();};this.image.onerror=()=>{this.status.textContent='Map image could not load. Reload to retry.';};
  this.element.addEventListener('click',e=>{if(e.target instanceof HTMLButtonElement)e.target.blur();});
  // The radar is first drawn when play starts: fetch it behind what the menu is waiting on.
  this.image.fetchPriority='low';this.image.src=`${import.meta.env.BASE_URL}play/navigation/san-andreas.png`;
 }
 /** CHud's radar sprites from hud.txd (see loadHudSprites), as image URLs by raster name. */
 setRadarSprites(urls:Record<string,string>){
  const image=(name:string,then:(img:HTMLImageElement)=>void)=>{const url=urls[name];if(!url)return;const img=new Image();img.onload=()=>{then(img);this.draw();};img.src=url;};
  // CHud::DrawRadar draws RADAR_DISC in black: the texture's alpha, tinted.
  image('radardisc',img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d')!;g.drawImage(img,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);this.sprites.disc=c;});
  image('radar_north',img=>{this.sprites.north=img;});RADAR_SPRITE_NAMES.forEach((name,sprite)=>{if(name&&sprite>4)image(name,img=>{this.blipSprites.set(sprite,img);});});image('radarRingPlane',img=>{this.sprites.ring=img;});image('radar_centre',img=>{this.sprites.centre=img;});image('radar_waypoint',img=>{this.sprites.waypoint=img;});image('arrow',img=>{this.sprites.mapHere=img;});
 }
 /** The INITIAL mission's sprite blips; their sprites load with the other hud.txd rasters. */
 setScriptBlips(blips:readonly ScmRadarBlip[]){this.blips=blips;this.draw();}
 /** Names of the hud.txd rasters the script blips use. */
 static blipSpriteNames(){return RADAR_SPRITE_NAMES.filter((n,i):n is string=>!!n&&i>4);}
 get open(){return !this.panel.hidden;}
 /** Why the last flight was refused, kept in the status line (which every draw rewrites) until the next map action. */
 private notice?:string;
 toggle(open=!this.open){if(open&&!this.open&&this.canOpen?.()===false)return;if(open!==this.open){this.view.reset();this.mapKeys.clear();}this.notice=undefined;this.panel.hidden=!open;this.onToggle?.(open);
  // The open map takes the keyboard (Tab walks its controls from the panel); closed, the game has it back.
  if(open)this.panel.focus({preventScroll:true});else if(this.panel.contains(document.activeElement)||document.activeElement instanceof HTMLButtonElement)(document.querySelector('canvas.world') as HTMLCanvasElement|null)?.focus();
  this.draw();}
 update(position:{x:number;z:number},heading:number,radar?:{viewHeading:number;range:number;ring?:number;altitude?:number;zoomed?:boolean;horizon?:number}){this.stepMapKeys();if(radar)this.radar=radar;this.position={x:position.x,z:position.z};this.heading=heading;this.draw();}
 /** CRadar::DrawBlips with the frontend's map drawing (m_bDrawingMap): every trace at blip size 1 with its height
  * triangle, and every sprite, short-range ones included, sized in the screen lines the menu draws in. */
 /** `ox`, `oy` and `scale`: the frame's window on the map (map fractions) and canvas pixels per map fraction. */
 private drawMapBlips(c:CanvasRenderingContext2D,w:number,ox:number,oy:number,scale:number){
  // The radar fog: the squares not yet visited, while fewer than 80 are, in (111, 137, 170, 200).
  const zones=this.zones;
  if(zones&&zones.revealed<80){c.fillStyle='rgba(111,137,170,0.784)';const cell=scale/ZONE_SQUARES;for(let x=0;x<ZONE_SQUARES;x++)for(let y=0;y<ZONE_SQUARES;y++)if(!zones.visited[x*ZONE_SQUARES+y])c.fillRect(x*cell-ox*scale,y*cell-oy*scale,cell,cell);}
  if(this.hideMapBlips)return;
  const revealed=(x:number,z:number,shortRange?:boolean)=>!zones||zones.blipRevealed(x,-z,!!shortRange);
  const shown=this.full.clientHeight||w,u=(innerHeight/448)*(w/shown),at=(x:number,z:number)=>{const m=worldToMap(x,z);return {x:(m.x-ox)*scale,y:(m.y-oy)*scale};};
  for(const blip of this.liveBlips){
   if(blip.sprite!==undefined&&this.blipSprites.has(blip.sprite))continue;
   const q=at(blip.x,blip.z),dz=blip.dz??0,colour=blip.colour??'#fff';
   const tri=(half:number,up:boolean,fill:string,tip:number,base:number)=>{const k=up?-1:1;c.fillStyle=fill;c.beginPath();c.moveTo(q.x,q.y+k*tip*u);c.lineTo(q.x+half*u,q.y-k*base*u);c.lineTo(q.x-half*u,q.y-k*base*u);c.closePath();c.fill();};
   if(dz>2){tri(4,true,'#000',4,3);tri(2,true,colour,2,2);}
   else if(dz<-4){tri(4,false,'#000',4,3);tri(2,false,colour,2,2);}
   else{c.fillStyle='#000';c.fillRect(q.x-2*u,q.y-2*u,4*u,4*u);c.fillStyle=colour;c.fillRect(q.x-u,q.y-u,2*u,2*u);}
  }
  // DrawRadarSprite: 8 lines either side of the blip.
  const sprite=(img:HTMLImageElement,x:number,z:number)=>{const q=at(x,z);c.drawImage(img,q.x-8*u,q.y-8*u,16*u,16*u);};
  for(const blip of this.blips){const img=this.blipSprites.get(blip.sprite);if(img&&displayThisBlip(blip.sprite,this.indoors)&&revealed(blip.x,-blip.y,blip.shortRange))sprite(img,blip.x,-blip.y);}
  for(const blip of this.liveBlips){const img=blip.sprite!==undefined?this.blipSprites.get(blip.sprite):undefined;if(img&&displayThisBlip(blip.sprite!,this.indoors)&&revealed(blip.x,blip.z,blip.shortRange))sprite(img,blip.x,blip.z);}
 }
 /** The full map's zoom and pan, and the zoom and pan keys held on it. */
 private readonly view=new FrontendMapView();private readonly mapKeys=new Set<string>();private mapKeyTick=0;
 /** The frontend's map keys, one step per FRONTEND_MAP_TICK_MS while held: PgUp/PgDn zoom, the arrows pan. */
 private stepMapKeys(){
  // The map is redrawn at the menu's 10 fps, so the steps due since the last are taken together (the original's
  // frame-rate fix scales them by the time passed the same way).
  if(!this.mapKeys.size||!this.open)return;const now=performance.now(),since=now-this.mapKeyTick;if(since<=FRONTEND_MAP_TICK_MS)return;
  const ticks=this.mapKeyTick?Math.min(10,since/FRONTEND_MAP_TICK_MS):1;this.mapKeyTick=now;
  const k=this.mapKeys,zoom=(k.has('PageUp')?1:0)-(k.has('PageDown')?1:0),dx=(k.has('ArrowRight')?1:0)-(k.has('ArrowLeft')?1:0),dy=(k.has('ArrowDown')?1:0)-(k.has('ArrowUp')?1:0);
  if(zoom)this.view.zoom(zoom*FRONTEND_MAP_ZOOM_STEP*ticks);if(dx||dy)this.view.pan(dx*FRONTEND_MAP_PAN_STEP*ticks,dy*FRONTEND_MAP_PAN_STEP*ticks);
 }
 /** Pointer events come faster than frames: they ask for one redraw on the next frame rather than a redraw each. */
 private drawQueued=false;
 private requestDraw(){if(this.drawQueued)return;this.drawQueued=true;requestAnimationFrame(()=>{this.drawQueued=false;this.draw();});}
 private draw(){
  const p=worldToMap(this.position.x,this.position.z),distance=this.waypoint?Math.hypot(this.waypoint.x-this.position.x,this.waypoint.z-this.position.z):undefined;
  if(this.loaded)this.status.textContent=this.notice??(distance===undefined?'North is up · Wheel or PgUp/PgDn zooms · Arrows pan · Home finds CJ · Click to set a destination.':`Waypoint ${Math.round(distance)} m away · straight-line distance`);
  const draw=(canvas:HTMLCanvasElement,full:boolean)=>{
   const win=this.view.window,c=canvas.getContext('2d')!,w=canvas.width,span=full?win.span:700/6000,scale=w/span,ox=full?win.x:p.x-span/2,oy=full?win.y:p.y-span/2;
   c.clearRect(0,0,w,w);c.fillStyle='#79aabd';c.fillRect(0,0,w,w);
   if(this.loaded)c.drawImage(this.image,-ox*scale,-oy*scale,scale,scale);
   for(const o of this.zoneOverlays){const a=worldToMap(o.x1,o.z1),b=worldToMap(o.x2,o.z2);c.fillStyle=o.colour;c.fillRect((a.x-ox)*scale,(a.y-oy)*scale,(b.x-a.x)*scale,(b.y-a.y)*scale);}
   if(full)this.drawMapBlips(c,w,ox,oy,scale);
   const px=(p.x-ox)*scale,py=(p.y-oy)*scale;
   // The frontend map has no north blip and no line to the waypoint: the waypoint's own sprite at its spot, drawn
   // after the other blips, and the player as DrawYouAreHereSprite (below).
   const shown=this.full.clientHeight||w,u=(innerHeight/448)*(w/shown);
   if(this.waypoint){const target=worldToMap(this.waypoint.x,this.waypoint.z),tx=(target.x-ox)*scale,ty=(target.y-oy)*scale;
    if(this.sprites.waypoint)c.drawImage(this.sprites.waypoint,tx-8*u,ty-8*u,16*u,16*u);
    else{c.fillStyle='#f765ce';c.strokeStyle='#1a1321';c.lineWidth=3;c.beginPath();c.arc(tx,ty,8*u,0,Math.PI*2);c.fill();c.stroke();}}
   // CRadar::DrawYouAreHereSprite: RADAR_SPRITE_MAP_HERE (hud.txd's arrow), shown and hidden in turn every 700 ms,
   // turned to the player's heading plus 180 degrees (the browser heading itself), corners 25 lines out, and set 17
   // screen pixels from him a quarter turn round from that angle.
   const now=performance.now();if(now-this.hereTimer>700){this.hereTimer=now;this.hereShown=!this.hereShown;}
   if(this.hereShown){
    const angle=this.heading,circle=angle+Math.PI/2,px17=17*(w/shown),hx=px+px17*Math.cos(circle),hy=py-px17*Math.sin(circle);
    if(this.sprites.mapHere){const side=25*Math.SQRT2*u;c.save();c.translate(hx,hy);c.rotate(-angle);c.scale(1,-1);c.drawImage(this.sprites.mapHere,-side/2,-side/2,side,side);c.restore();}
    else{const s=13;c.save();c.translate(hx,hy);c.rotate(-this.heading);c.beginPath();c.moveTo(0,s);c.lineTo(-s*.7,-s*.8);c.lineTo(0,-s*.4);c.lineTo(s*.7,-s*.8);c.closePath();c.fillStyle='white';c.strokeStyle='#111';c.lineWidth=3;c.fill();c.stroke();c.restore();}
   }
   // The map ruler: two gold lines across the map through the mouse, while no button is held.
   if(this.pointer&&!this.pointer.held){c.fillStyle='rgb(144,98,16)';const t=Math.max(1,(w/shown));c.fillRect(this.pointer.x*w-t,0,2*t,w);c.fillRect(0,this.pointer.y*w-t,w,2*t);}
   // CPlaceName::GetForMap under the mouse, once its square is explored (or 80 are) and while no button is held:
   // pricedown at 0.8, light gray with a black edge, right-aligned 30 lines in from the map's right and bottom.
   if(this.pointer&&!this.pointer.held&&this.placeAt){
    const pm=this.view.toMap(this.pointer.x,this.pointer.y),at=mapToWorld(pm.x,pm.y),zones=this.zones;
    if(!zones||zones.revealed>=80||zones.wasVisited(at.x,-at.z)){
     const name=this.placeAt(at.x,-at.z);
     if(name){const size=16*u;c.save();c.font=`400 ${size.toFixed(1)}px Impact,'Arial Narrow',sans-serif`;c.textAlign='right';c.textBaseline='top';c.lineJoin='round';
      c.lineWidth=4*u;c.strokeStyle='#000';c.strokeText(name,w-30*u,w-30*u);c.fillStyle='rgb(225,225,225)';c.fillText(name,w-30*u,w-30*u);c.restore();}
    }
   }
  };
  /** The HUD radar (CRadar::DrawMap and DrawBlips): the map turned so the camera's view is up, the player
   * arrow at the centre, the waypoint blip limited to the rim, and the north blip on the rim. */
  const radar=(canvas:HTMLCanvasElement)=>{
   // The canvas holds CHud::DrawRadar's RADAR_DISC quarters, 42 lines from the centre to their edge, around the map's
   // 38. `u` is one line in canvas pixels.
   const c=canvas.getContext('2d')!,w=canvas.width,C=w/2,u=C/42,R=38*u,{viewHeading,range}=this.radar,k=R/range,{disc,north,centre,waypoint}=this.sprites;
   c.clearRect(0,0,w,w);if(!disc){c.fillStyle='#000';c.beginPath();c.arc(C,C,C,0,Math.PI*2);c.fill();}
   // CRadar::DrawRadarMap's sea colour (111, 137, 170) comes with DrawRadarSection; inside an interior neither is drawn.
   c.save();c.beginPath();c.arc(C,C,R,0,Math.PI*2);c.clip();if(!this.indoors){c.fillStyle='rgb(111,137,170)';c.fillRect(0,0,w,w);}
   c.translate(C,C);c.rotate(viewHeading+Math.PI);c.scale(k,k);c.translate(-this.position.x,-this.position.z);
   if(this.loaded&&!this.indoors)c.drawImage(this.image,-3000,-3000,6000,6000);
   // CRadar::DrawRadarGangOverlay: the territories over the map, under the blips.
   for(const o of this.zoneOverlays){c.fillStyle=o.colour;c.fillRect(o.x1,o.z1,o.x2-o.x1,o.z2-o.z1);}
   c.restore();
   // A plane's horizon (DrawRadarMap): with the radar turned to pi, DrawAreaOnRadar fills (20, 175, 20, 200) from
   // 2 x the pitch-roll angle in degrees behind the player to 2000 ahead, so the ground fills the disc from below.
   if(this.radar.horizon!==undefined){
    const edge=C-2*this.radar.horizon*180/Math.PI*k;
    c.save();c.beginPath();c.arc(C,C,R,0,Math.PI*2);c.clip();c.fillStyle='rgba(20,175,20,0.784)';c.fillRect(0,Math.max(0,edge),w,w);c.restore();
   }
   // A plane's RADAR_RING_PLANE: DrawRotatingRadarSprite at pi - atan2(-right.z, up.z), 78 by 59 lines out; kept round
   // at the 59 like the radar, and flipped as the rotating sprites are.
   if(this.radar.ring!==undefined&&this.sprites.ring){const side=59*Math.SQRT2*u;c.save();c.translate(C,C);c.rotate(-this.radar.ring);c.scale(1,-1);c.drawImage(this.sprites.ring,-side/2,-side/2,side,side);c.restore();}
   // The altimeter: 76 lines tall beside the radar; the mark climbs to the top at 200 units, or at 950 above 200.
   const alt=this.radar.altitude;this.altimeter.hidden=this.altimeterMark.hidden=alt===undefined;
   if(alt!==undefined){const scale=alt<=200?200:950;this.altimeterMark.style.setProperty('--height',String(Math.min(76,76*Math.max(0,alt)/scale)));}
   // The four RADAR_DISC quarters: as drawn top left, mirrored across the centre for the others.
   if(disc)for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){c.save();c.translate(C,C);c.scale(sx,sy);c.drawImage(disc,-C,-C,C,C);c.restore();}
   const screen=(p:{u:number;v:number})=>({x:C+p.u*R,y:C-p.v*R});
   // CRadar::DrawRadarSprite: 8 lines either side of the blip.
   const sprite=(img:HTMLImageElement,p:{x:number;y:number})=>c.drawImage(img,p.x-8*u,p.y-8*u,16*u,16*u);
   // CRadar::DrawBlips draws RADAR_SPRITE_NORTH first, then the blips, then the player's arrow.
   const n=screen(radarNorth(viewHeading,range)),nr=w*.06;
   if(north)sprite(north,n);
   else{
    c.fillStyle='#111';c.beginPath();c.arc(n.x,n.y,nr,0,Math.PI*2);c.fill();
    c.font=`bold ${Math.round(nr*1.5)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText('N',n.x,n.y+1);c.textAlign='start';c.textBaseline='alphabetic';
   }
   // CRadar::DrawBlips draws every trace blip first and the sprites after them. A trace sits at its radar point
   // limited to the rim, a box at the player's height, a triangle pointing up for one more than 2 above him and down
   // for one more than 4 below (ShowRadarTraceWithHeight), each with a black border a line wider, faded by distance.
   for(const blip of this.liveBlips){
    if(blip.sprite!==undefined&&this.blipSprites.has(blip.sprite))continue;
    // DrawCoordBlip tests short range only for sprites: a trace stays pinned to the rim.
    const r=radarPoint({x:blip.x-this.position.x,z:blip.z-this.position.z},viewHeading,range),d=Math.hypot(r.u,r.v);
    const p=screen(limitRadarPoint(r)),s=blip.size??1,a=blip.fade?1:blipAlpha(d)/255,dz=blip.dz??0;
    c.save();c.globalAlpha=a;
    // The apex `tip` lines up (or down), the base `base` lines the other way, `half` lines either side.
    const tri=(half:number,up:boolean,colour:string,tip:number,base:number)=>{const k=up?-1:1;c.fillStyle=colour;c.beginPath();c.moveTo(p.x,p.y+k*tip*u);c.lineTo(p.x+half*u,p.y-k*base*u);c.lineTo(p.x-half*u,p.y-k*base*u);c.closePath();c.fill();};
    if(dz>2){tri(s+3,true,'#000',s+3,s+2);tri(s+1,true,blip.colour??'#fff',s+1,s+1);}
    else if(dz<-4){tri(s+3,false,'#000',s+3,s+2);tri(s+1,false,blip.colour??'#fff',s+1,s+1);}
    else{c.fillStyle='#000';c.fillRect(p.x-(s+1)*u,p.y-(s+1)*u,2*(s+1)*u,2*(s+1)*u);c.fillStyle=blip.colour??'#fff';c.fillRect(p.x-s*u,p.y-s*u,2*s*u,2*s*u);}
    c.restore();
   }
   // CRadar::DrawBlips' sprite pass: a short-range blip only within the radar, the others limited to its rim.
   for(const blip of this.blips){
    const img=this.blipSprites.get(blip.sprite);if(!img||!displayThisBlip(blip.sprite,this.indoors))continue;
    const p=radarPoint({x:blip.x-this.position.x,z:-blip.y-this.position.z},viewHeading,range),d=Math.hypot(p.u,p.v);
    if(blip.shortRange&&d>1)continue;
    sprite(img,screen(limitRadarPoint(p)));
   }
   for(const blip of this.liveBlips){
    const img=blip.sprite!==undefined?this.blipSprites.get(blip.sprite):undefined;if(!img||!displayThisBlip(blip.sprite!,this.indoors))continue;
    const r=radarPoint({x:blip.x-this.position.x,z:blip.z-this.position.z},viewHeading,range);
    // With the script's zoom set, DrawBlips counts every blip as out of reach for the short-range test.
    if(blip.shortRange&&(this.radar.zoomed||Math.hypot(r.u,r.v)>1))continue;
    sprite(img,screen(limitRadarPoint(r)));
   }
   if(this.waypoint&&waypoint)sprite(waypoint,screen(limitRadarPoint(radarPoint({x:this.waypoint.x-this.position.x,z:this.waypoint.z-this.position.z},viewHeading,range))));
   else if(this.waypoint){const q=screen(limitRadarPoint(radarPoint({x:this.waypoint.x-this.position.x,z:this.waypoint.z-this.position.z},viewHeading,range)));c.fillStyle='#f765ce';c.strokeStyle='#1a1321';c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,Math.max(4,w*.035),0,Math.PI*2);c.fill();c.stroke();}
   // RADAR_SPRITE_CENTRE: DrawRotatingRadarSprite at heading - m_fRadarOrientation - 180 degrees, corners 8 lines out.
   // Its vertices put the texture's first row at the bottom, turned counterclockwise by the angle; the native headings
   // are the browser ones plus 180 degrees, which cancels in the difference.
   // CRadar::DrawBlips skips RADAR_SPRITE_CENTRE in a plane other than the Vortex (the ring shows the heading).
   if(this.radar.ring!==undefined){}
   else if(centre){const angle=this.heading-viewHeading-Math.PI,side=8*Math.SQRT2*u;c.save();c.translate(C,C);c.rotate(-angle);c.scale(1,-1);c.drawImage(centre,-side/2,-side/2,side,side);c.restore();}
   else{const dir=radarPoint({x:Math.sin(this.heading),z:Math.cos(this.heading)},viewHeading,1),s=w*.055;
   c.save();c.translate(C,C);c.rotate(Math.atan2(-dir.u,-dir.v));c.beginPath();c.moveTo(0,s);c.lineTo(-s*.7,-s*.8);c.lineTo(0,-s*.4);c.lineTo(s*.7,-s*.8);c.closePath();c.fillStyle='white';c.strokeStyle='#111';c.lineWidth=2;c.fill();c.stroke();c.restore();}
  };
  radar(this.mini);if(this.open)draw(this.full,true);
 }
}
