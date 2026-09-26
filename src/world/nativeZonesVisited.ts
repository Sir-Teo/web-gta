/** CTheZones' map exploration: ZonesVisited, a 10 x 10 grid of 600-unit squares over the map (x from the west, y
 * from the north), and ZonesRevealed, how many are visited. CTheZones::Update marks the player's square once he has
 * been able to see outside for more than 5 s (the code from 0x572800), unless the script has him off the map. The
 * frontend map fogs the squares not visited while fewer than 80 are, and hides the short-range blips in them
 * (CRadar::HasThisBlipBeenRevealed). */
export const ZONE_SQUARES=10;
const DELAY_MS=5000;
/** GetZoneWasVisited's square for a native x/y, clamped to the map as FIX_BUGS clamps it. */
export function zoneSquare(x:number,y:number){
 const clamp=(v:number)=>Math.min(2999,Math.max(-2999,v));
 const column=Math.trunc((clamp(x)+3000)/600),row=ZONE_SQUARES-1-Math.trunc((clamp(y)+3000)/600);
 return column*ZONE_SQUARES+row;
}
export class NativeZonesVisited {
 readonly visited=new Array<boolean>(ZONE_SQUARES*ZONE_SQUARES).fill(false);
 revealed=0;
 /** CountSeconds: when the player last could not see outside. */
 private countSince:number|undefined;
 /** CTheZones::Update for a frame at game time `nowMs`, the player at native (x, y). */
 update(nowMs:number,x:number,y:number,outside:boolean,offTheMap:boolean){
  this.countSince??=nowMs-DELAY_MS;
  if(!outside){this.countSince=nowMs;return;}
  if(nowMs-this.countSince<=DELAY_MS||offTheMap)return;
  const square=zoneSquare(x,y);
  if(!this.visited[square]){this.visited[square]=true;this.revealed++;}
 }
 /** CTheZones::GetCurrentZoneLockedOrUnlocked. */
 wasVisited(x:number,y:number){return this.visited[zoneSquare(x,y)];}
 /** CRadar::HasThisBlipBeenRevealed on the frontend map. */
 blipRevealed(x:number,y:number,shortRange:boolean){return !shortRange||this.revealed>80||this.wasVisited(x,y);}
 /** CTheZones::Save's grid, row by row, as a string of 0s and 1s. */
 save(){return this.visited.map(v=>v?'1':'0').join('');}
 load(saved:unknown){
  if(typeof saved!=='string'||saved.length!==this.visited.length||!/^[01]+$/.test(saved))return false;
  for(let i=0;i<saved.length;i++)this.visited[i]=saved[i]==='1';
  this.revealed=this.visited.filter(Boolean).length;return true;
 }
}
