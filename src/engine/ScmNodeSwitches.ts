import {requireAsset} from '../assets/binary';
/* CPathFind's node switches, pinned gta-reversed ead3051 (`PathCommands.cpp` and
 * `CPathFind::SwitchRoadsOffInArea` 0x452C80, both reversed): the areas a script turns the car or pedestrian
 * paths off in, and the bookkeeping that keeps them. Flipping the nodes themselves belongs to whatever holds
 * the path graph; this is the list it applies, and the list the save file carries. Native axes. */
/** CPathFind::NUM_PATH_MAP_AREAS, an eight by eight grid, which also bounds the switch list. */
export const NUM_PATH_MAP_AREAS=64;
export interface ScmNodeSwitch {
 xMin:number;xMax:number;yMin:number;yMax:number;zMin:number;zMax:number;
 /** Whether the area turns its nodes off, and whether it is the car paths rather than the pedestrian ones. */
 isOff:boolean;isCars:boolean;
}
/** The corners a command gives in either order become a box. */
export function switchArea(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
 return {xMin:Math.min(a.x,b.x),xMax:Math.max(a.x,b.x),yMin:Math.min(a.y,b.y),yMax:Math.max(a.y,b.y),zMin:Math.min(a.z,b.z),zMax:Math.max(a.z,b.z)};
}
export class ScmNodeSwitches {
 readonly switches:ScmNodeSwitch[]=[];
 /** CPathFind::SwitchRoadsOffInArea (0x452C80) after the node pass: every switch whose box lies wholly inside
  * the new one is dropped, and unless the command is the back-to-original form the new one is appended while
  * there is room.
  *
  * The removal follows retail, which shifts only one entry down and then decrements the count, so the entry
  * after the removed one ends up duplicated. The reference marks that as an R* bug and fixes it behind a flag;
  * this port keeps what the original does, since a mission's later switches see that list. */
 /** The node pass over the loaded areas (SwitchRoadsOffInAreaForOneRegion for each), which the host runs. */
 onSwitch?:(area:{xMin:number;xMax:number;yMin:number;yMax:number;zMin:number;zMax:number},isOff:boolean,isCars:boolean,backToOriginal:boolean)=>void;
 switchRoadsOffInArea(area:{xMin:number;xMax:number;yMin:number;yMax:number;zMin:number;zMax:number},isOff:boolean,isCars:boolean,backToOriginal:boolean){
  requireAsset([area.xMin,area.xMax,area.yMin,area.yMax,area.zMin,area.zMax].every(Number.isFinite),'Invalid node switch area.');
  this.onSwitch?.(area,isOff,isCars,backToOriginal);
  for(let i=0;i<this.switches.length;i++){
   const existing=this.switches[i];
   if(existing.xMin<area.xMin||existing.yMin<area.yMin||existing.zMin<area.zMin)continue;
   if(existing.xMax>area.xMax||existing.yMax>area.yMax||existing.zMax>area.zMax)continue;
   if(i+1<this.switches.length)this.switches[i]={...this.switches[i+1]};
   this.switches.pop();
   i--;
  }
  if(backToOriginal||this.switches.length>=NUM_PATH_MAP_AREAS)return;
  this.switches.push({...area,isOff,isCars});
 }
 /** CPathFind::SwitchPedRoadsOffInArea (0x452F00): the same call for the pedestrian paths. */
 switchPedRoadsOffInArea(area:{xMin:number;xMax:number;yMin:number;yMax:number;zMin:number;zMax:number},isOff:boolean,backToOriginal:boolean){
  this.switchRoadsOffInArea(area,isOff,false,backToOriginal);
 }
 /** Whether a point sits in a switch of that kind, for a host applying the list to its own nodes. */
 at(point:{x:number;y:number;z:number},isCars:boolean){
  return this.switches.filter(s=>s.isCars===isCars
   &&point.x>=s.xMin&&point.x<=s.xMax&&point.y>=s.yMin&&point.y<=s.yMax&&point.z>=s.zMin&&point.z<=s.zMax);
 }
 clear(){this.switches.length=0;}
}
