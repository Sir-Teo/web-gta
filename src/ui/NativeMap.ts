/** Original radar tiles use x east, native y north; browser z is -native y. */
export function worldToMap(x:number,z:number){return {x:(x+3000)/6000,y:(z+3000)/6000};}
export function mapToWorld(x:number,y:number){return {x:x*6000-3000,z:y*6000-3000};}
export class NativeMap {
 onToggle?:(open:boolean)=>void;
 readonly element=document.createElement('section');
 private image=new Image();
 private mini:HTMLCanvasElement;
 private full:HTMLCanvasElement;
 private panel:HTMLElement;
 private status:HTMLElement;
 private position={x:2495,z:1687};
 private heading=0;
 private vehicle?:{x:number;z:number};
 private waypoint?:{x:number;z:number};
 private loaded=false;
 private last=0;
 constructor(container:HTMLElement){
  this.element.className='native-navigation';
  this.element.innerHTML=`<button class="minimap-button" aria-label="Open San Andreas map"><canvas width="220" height="220" aria-label="Local roads and player position"></canvas><span class="map-distance">N ↑ · Map [M]</span></button><section class="world-map-panel" hidden aria-label="San Andreas map"><div class="map-toolbar"><strong>San Andreas</strong><span>Click to set a waypoint</span><button class="map-clear">Clear waypoint</button><button class="map-close">Close [M]</button></div><canvas width="1200" height="1200" aria-label="Full San Andreas map; click to set a waypoint"></canvas><p class="map-status" role="status">Loading original map…</p></section>`;
  container.append(this.element);this.mini=this.element.querySelector('.minimap-button canvas')!;this.full=this.element.querySelector('.world-map-panel canvas')!;this.panel=this.element.querySelector('.world-map-panel')!;this.status=this.element.querySelector('.map-status')!;
  this.element.querySelector<HTMLButtonElement>('.minimap-button')!.onclick=()=>this.toggle();
  this.element.querySelector<HTMLButtonElement>('.map-close')!.onclick=()=>this.toggle(false);
  this.element.querySelector<HTMLButtonElement>('.map-clear')!.onclick=()=>{this.waypoint=undefined;this.draw();};
  this.full.onclick=e=>{const r=this.full.getBoundingClientRect();this.waypoint=mapToWorld((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);this.draw();};
  this.image.onload=()=>{this.loaded=true;this.draw();};this.image.onerror=()=>{this.status.textContent='Map image could not load. Reload to retry.';};
  this.element.addEventListener('click',e=>{if(e.target instanceof HTMLButtonElement)e.target.blur();});
  this.image.src=`${import.meta.env.BASE_URL}play/navigation/san-andreas.png`;
 }
 get open(){return !this.panel.hidden;}
 toggle(open=!this.open){this.panel.hidden=!open;this.onToggle?.(open);if(document.activeElement instanceof HTMLButtonElement)document.activeElement.blur();this.draw();}
 update(position:{x:number;z:number},heading:number,vehicle?:{x:number;z:number}){this.vehicle=vehicle;this.position={x:position.x,z:position.z};this.heading=heading;if(performance.now()-this.last>80){this.last=performance.now();this.draw();}}
 private draw(){
  const p=worldToMap(this.position.x,this.position.z),distance=this.waypoint?Math.hypot(this.waypoint.x-this.position.x,this.waypoint.z-this.position.z):undefined;
  this.element.querySelector('.map-distance')!.textContent=distance===undefined?'N ↑ · Map [M]':`${Math.round(distance)} m · Map [M]`;
  if(this.loaded)this.status.textContent=distance===undefined?'North is up · Cyan marker: Greenwood · Click anywhere to set a destination.':`Waypoint ${Math.round(distance)} m away · straight-line distance`;
  const draw=(canvas:HTMLCanvasElement,full:boolean)=>{
   const c=canvas.getContext('2d')!,w=canvas.width,span=full?1:700/6000,scale=w/span,ox=full?0:p.x-span/2,oy=full?0:p.y-span/2;
   c.clearRect(0,0,w,w);c.fillStyle='#79aabd';c.fillRect(0,0,w,w);
   if(this.loaded)c.drawImage(this.image,-ox*scale,-oy*scale,scale,scale);
   if(this.vehicle){const v=worldToMap(this.vehicle.x,this.vehicle.z),vx=(v.x-ox)*scale,vy=(v.y-oy)*scale;c.fillStyle='#51e4ef';c.strokeStyle='#111';c.lineWidth=2;c.fillRect(vx-4,vy-6,8,12);c.strokeRect(vx-4,vy-6,8,12);}
   const px=(p.x-ox)*scale,py=(p.y-oy)*scale;
   if(this.waypoint){const target=worldToMap(this.waypoint.x,this.waypoint.z),tx=(target.x-ox)*scale,ty=(target.y-oy)*scale;c.strokeStyle='#f765ce';c.lineWidth=full?3:2;c.setLineDash([6,5]);c.beginPath();c.moveTo(px,py);c.lineTo(tx,ty);c.stroke();c.setLineDash([]);c.fillStyle='#f765ce';c.strokeStyle='#1a1321';c.beginPath();c.arc(Math.max(9,Math.min(w-9,tx)),Math.max(9,Math.min(w-9,ty)),full?10:6,0,Math.PI*2);c.fill();c.stroke();}
   c.save();c.translate(px,py);c.rotate(-this.heading);const s=full?13:9;c.beginPath();c.moveTo(0,s);c.lineTo(-s*.7,-s*.8);c.lineTo(0,-s*.4);c.lineTo(s*.7,-s*.8);c.closePath();c.fillStyle='white';c.strokeStyle='#111';c.lineWidth=full?3:2;c.fill();c.stroke();c.restore();
   c.font=`bold ${full?25:16}px sans-serif`;c.fillStyle='#fff';c.strokeStyle='#111';c.lineWidth=3;c.strokeText('N',12,full?34:24);c.fillText('N',12,full?34:24);
  };
  draw(this.mini,false);if(this.open)draw(this.full,true);
 }
}
