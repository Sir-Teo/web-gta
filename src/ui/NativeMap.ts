import {limitRadarPoint,radarNorth,radarPoint,RADAR_MIN_RANGE} from './nativeRadar';
import {RADAR_SPRITE_NAMES,type ScmRadarBlip} from '../assets/scmRadarBlips';
/** Original radar tiles use x east, native y north; browser z is -native y. */
export function worldToMap(x:number,z:number){return {x:(x+3000)/6000,y:(z+3000)/6000};}
export function mapToWorld(x:number,y:number){return {x:x*6000-3000,z:y*6000-3000};}
export class NativeMap {
 onFly?:(modelId:number)=>Promise<void>;
 onToggle?:(open:boolean)=>void;
 readonly element=document.createElement('section');
 private image=new Image();
 private mini:HTMLCanvasElement;
 private full:HTMLCanvasElement;
 private panel:HTMLElement;
 private status:HTMLElement;
 private position={x:2495,z:1687};
 private heading=0;
 /** Where the camera looks (atan2(dx, dz)) and CRadar::m_radarRange, for the HUD radar. */
 private radar:{viewHeading:number;range:number;ring?:number;altitude?:number}={viewHeading:Math.PI,range:RADAR_MIN_RANGE};
 /** CHud::DrawRadar's altimeter: the bar left of the radar and its height mark. */
 private altimeter=document.createElement('div');private altimeterMark=document.createElement('div');
 private vehicles:readonly {x:number;z:number;name?:string}[]=[];
 private waypoint?:{x:number;z:number};
 private loaded=false;
 private last=0;
 /** hud.txd's RADAR_DISC (tinted black once) and blip sprites, when loaded. */
 private sprites:{disc?:HTMLCanvasElement;north?:HTMLImageElement;centre?:HTMLImageElement;waypoint?:HTMLImageElement;ring?:HTMLImageElement}={};
 /** The script's sprite blips (the INITIAL mission's) and their sprites by eRadarSprite. */
 private blips:readonly ScmRadarBlip[]=[];private blipSprites=new Map<number,HTMLImageElement>();
 constructor(container:HTMLElement){
  this.element.className='native-navigation';
  this.element.innerHTML=`<button class="minimap-button" aria-label="Open San Andreas map"><canvas width="220" height="220" aria-label="Local roads and player position"></canvas></button><section class="world-map-panel" hidden aria-label="San Andreas map"><div class="map-toolbar"><strong>San Andreas</strong><label>Destination <select class="map-destination" aria-label="Map destination"><option value="">Choose a place</option><option value="grove">Grove Street</option><option value="meadows">Verdant Meadows airfield</option><option value="ls-airport">Los Santos airport</option><option value="sf-airport">San Fierro airport</option><option value="lv-airport">Las Venturas airport</option></select></label><label>Aircraft <select aria-label="Aircraft" class="map-aircraft"><option value="593">Dodo</option><option value="476">Rustler</option><option value="519">Shamal</option><option value="511">Beagle</option><option value="512">Cropduster</option><option value="513">Stuntplane</option><option value="553">Nevada</option><option value="487">Maverick</option><option value="425">Hunter</option><option value="520">Hydra (VTOL)</option><option value="417">Leviathan</option><option value="447">Seasparrow</option><option value="469">Sparrow</option><option value="488">News Maverick</option><option value="497">Police Maverick</option><option value="548">Cargobob</option><option value="563">Raindance</option></select></label><button class="map-fly">Fly from Verdant Meadows</button><button class="map-clear">Clear waypoint</button><button class="map-close">Close [M]</button></div><canvas width="1200" height="1200" aria-label="Full San Andreas map; click to set a waypoint"></canvas><p class="map-status" role="status">Loading original map…</p></section>`;
  container.append(this.element);
  this.altimeter.className='radar-altimeter';this.altimeterMark.className='radar-altimeter-mark';this.altimeter.hidden=this.altimeterMark.hidden=true;this.element.append(this.altimeter,this.altimeterMark);this.mini=this.element.querySelector('.minimap-button canvas')!;this.full=this.element.querySelector('.world-map-panel canvas')!;this.panel=this.element.querySelector('.world-map-panel')!;this.status=this.element.querySelector('.map-status')!;
  this.element.querySelector<HTMLButtonElement>('.minimap-button')!.onclick=()=>this.toggle();
  this.element.querySelector<HTMLButtonElement>('.map-close')!.onclick=()=>this.toggle(false);
  this.element.querySelector<HTMLButtonElement>('.map-clear')!.onclick=()=>{this.waypoint=undefined;this.element.querySelector<HTMLSelectElement>('.map-destination')!.value='';this.draw();};
  this.element.querySelector<HTMLSelectElement>('.map-destination')!.onchange=e=>{const places:Record<string,{x:number;z:number}>={grove:{x:2495,z:1687},meadows:{x:400,z:-2500},'ls-airport':{x:1685,z:2420},'sf-airport':{x:-1330,z:240},'lv-airport':{x:1450,z:-1450}};const destination=places[(e.target as HTMLSelectElement).value];if(destination){this.waypoint={...destination};this.draw();}(e.target as HTMLSelectElement).blur();};
  const fly=this.element.querySelector<HTMLButtonElement>('.map-fly')!;
  fly.onclick=async()=>{if(!this.onFly)return;fly.disabled=true;try{await this.onFly(Number(this.element.querySelector<HTMLSelectElement>('.map-aircraft')!.value));}catch(error){this.status.textContent=String(error);}finally{fly.disabled=false;}};
  this.full.onclick=e=>{this.element.querySelector<HTMLSelectElement>('.map-destination')!.value='';const r=this.full.getBoundingClientRect();this.waypoint=mapToWorld((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);this.draw();};
  this.image.onload=()=>{this.loaded=true;this.draw();};this.image.onerror=()=>{this.status.textContent='Map image could not load. Reload to retry.';};
  this.element.addEventListener('click',e=>{if(e.target instanceof HTMLButtonElement)e.target.blur();});
  this.image.src=`${import.meta.env.BASE_URL}play/navigation/san-andreas.png`;
 }
 /** CHud's radar sprites from hud.txd (see loadHudSprites), as image URLs by raster name. */
 setRadarSprites(urls:Record<string,string>){
  const image=(name:string,then:(img:HTMLImageElement)=>void)=>{const url=urls[name];if(!url)return;const img=new Image();img.onload=()=>{then(img);this.draw();};img.src=url;};
  // CHud::DrawRadar draws RADAR_DISC in black: the texture's alpha, tinted.
  image('radardisc',img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d')!;g.drawImage(img,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);this.sprites.disc=c;});
  image('radar_north',img=>{this.sprites.north=img;});RADAR_SPRITE_NAMES.forEach((name,sprite)=>{if(name&&sprite>4)image(name,img=>{this.blipSprites.set(sprite,img);});});image('radarRingPlane',img=>{this.sprites.ring=img;});image('radar_centre',img=>{this.sprites.centre=img;});image('radar_waypoint',img=>{this.sprites.waypoint=img;});
 }
 /** The INITIAL mission's sprite blips; their sprites load with the other hud.txd rasters. */
 setScriptBlips(blips:readonly ScmRadarBlip[]){this.blips=blips;this.draw();}
 /** Names of the hud.txd rasters the script blips use. */
 static blipSpriteNames(){return RADAR_SPRITE_NAMES.filter((n,i):n is string=>!!n&&i>4);}
 get open(){return !this.panel.hidden;}
 toggle(open=!this.open){this.panel.hidden=!open;this.onToggle?.(open);if(document.activeElement instanceof HTMLButtonElement)document.activeElement.blur();this.draw();}
 update(position:{x:number;z:number},heading:number,vehicles:readonly {x:number;z:number;name?:string}[]=[],radar?:{viewHeading:number;range:number;ring?:number;altitude?:number}){if(radar)this.radar=radar;this.vehicles=vehicles;this.position={x:position.x,z:position.z};this.heading=heading;if(performance.now()-this.last>80){this.last=performance.now();this.draw();}}
 private draw(){
  const p=worldToMap(this.position.x,this.position.z),distance=this.waypoint?Math.hypot(this.waypoint.x-this.position.x,this.waypoint.z-this.position.z):undefined;
  if(this.loaded)this.status.textContent=distance===undefined?'North is up · Cyan markers: parked vehicles · Click anywhere to set a destination.':`Waypoint ${Math.round(distance)} m away · straight-line distance`;
  const draw=(canvas:HTMLCanvasElement,full:boolean)=>{
   const c=canvas.getContext('2d')!,w=canvas.width,span=full?1:700/6000,scale=w/span,ox=full?0:p.x-span/2,oy=full?0:p.y-span/2;
   c.clearRect(0,0,w,w);c.fillStyle='#79aabd';c.fillRect(0,0,w,w);
   if(this.loaded)c.drawImage(this.image,-ox*scale,-oy*scale,scale,scale);
   for(const vehicle of this.vehicles){const v=worldToMap(vehicle.x,vehicle.z),vx=(v.x-ox)*scale,vy=(v.y-oy)*scale;c.fillStyle='#51e4ef';c.strokeStyle='#111';c.lineWidth=2;c.fillRect(vx-4,vy-6,8,12);c.strokeRect(vx-4,vy-6,8,12);}
   const px=(p.x-ox)*scale,py=(p.y-oy)*scale;
   if(this.waypoint){const target=worldToMap(this.waypoint.x,this.waypoint.z),tx=(target.x-ox)*scale,ty=(target.y-oy)*scale;c.strokeStyle='#f765ce';c.lineWidth=full?3:2;c.setLineDash([6,5]);c.beginPath();c.moveTo(px,py);c.lineTo(tx,ty);c.stroke();c.setLineDash([]);c.fillStyle='#f765ce';c.strokeStyle='#1a1321';c.beginPath();c.arc(Math.max(9,Math.min(w-9,tx)),Math.max(9,Math.min(w-9,ty)),full?10:6,0,Math.PI*2);c.fill();c.stroke();}
   c.save();c.translate(px,py);c.rotate(-this.heading);const s=full?13:9;c.beginPath();c.moveTo(0,s);c.lineTo(-s*.7,-s*.8);c.lineTo(0,-s*.4);c.lineTo(s*.7,-s*.8);c.closePath();c.fillStyle='white';c.strokeStyle='#111';c.lineWidth=full?3:2;c.fill();c.stroke();c.restore();
   c.font=`bold ${full?25:16}px sans-serif`;c.fillStyle='#fff';c.strokeStyle='#111';c.lineWidth=3;c.strokeText('N',12,full?34:24);c.fillText('N',12,full?34:24);
  };
  /** The HUD radar (CRadar::DrawMap and DrawBlips): the map turned so the camera's view is up, the player
   * arrow at the centre, the waypoint blip limited to the rim, and the north blip on the rim. */
  const radar=(canvas:HTMLCanvasElement)=>{
   // The canvas holds CHud::DrawRadar's RADAR_DISC quarters, 42 lines from the centre to their edge, around the map's
   // 38. `u` is one line in canvas pixels.
   const c=canvas.getContext('2d')!,w=canvas.width,C=w/2,u=C/42,R=38*u,{viewHeading,range}=this.radar,k=R/range,{disc,north,centre,waypoint}=this.sprites;
   c.clearRect(0,0,w,w);if(!disc){c.fillStyle='#000';c.beginPath();c.arc(C,C,C,0,Math.PI*2);c.fill();}
   c.save();c.beginPath();c.arc(C,C,R,0,Math.PI*2);c.clip();c.fillStyle='#79aabd';c.fillRect(0,0,w,w);
   c.translate(C,C);c.rotate(viewHeading+Math.PI);c.scale(k,k);c.translate(-this.position.x,-this.position.z);
   if(this.loaded)c.drawImage(this.image,-3000,-3000,6000,6000);
   c.restore();
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
   // CRadar::DrawBlips' sprite pass: a short-range blip only within the radar, the others limited to its rim.
   for(const blip of this.blips){
    const img=this.blipSprites.get(blip.sprite);if(!img)continue;
    const p=radarPoint({x:blip.x-this.position.x,z:-blip.y-this.position.z},viewHeading,range),d=Math.hypot(p.u,p.v);
    if(blip.shortRange&&d>1)continue;
    sprite(img,screen(limitRadarPoint(p)));
   }
   if(this.waypoint&&waypoint)sprite(waypoint,screen(limitRadarPoint(radarPoint({x:this.waypoint.x-this.position.x,z:this.waypoint.z-this.position.z},viewHeading,range))));
   else if(this.waypoint){const q=screen(limitRadarPoint(radarPoint({x:this.waypoint.x-this.position.x,z:this.waypoint.z-this.position.z},viewHeading,range)));c.fillStyle='#f765ce';c.strokeStyle='#1a1321';c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,Math.max(4,w*.035),0,Math.PI*2);c.fill();c.stroke();}
   // RADAR_SPRITE_CENTRE: DrawRotatingRadarSprite at heading - m_fRadarOrientation - 180 degrees, corners 8 lines out.
   // Its vertices put the texture's first row at the bottom, turned counterclockwise by the angle; the native headings
   // are the browser ones plus 180 degrees, which cancels in the difference.
   if(centre){const angle=this.heading-viewHeading-Math.PI,side=8*Math.SQRT2*u;c.save();c.translate(C,C);c.rotate(-angle);c.scale(1,-1);c.drawImage(centre,-side/2,-side/2,side,side);c.restore();}
   else{const dir=radarPoint({x:Math.sin(this.heading),z:Math.cos(this.heading)},viewHeading,1),s=w*.055;
   c.save();c.translate(C,C);c.rotate(Math.atan2(-dir.u,-dir.v));c.beginPath();c.moveTo(0,s);c.lineTo(-s*.7,-s*.8);c.lineTo(0,-s*.4);c.lineTo(s*.7,-s*.8);c.closePath();c.fillStyle='white';c.strokeStyle='#111';c.lineWidth=2;c.fill();c.stroke();c.restore();}
  };
  radar(this.mini);if(this.open)draw(this.full,true);
 }
}
