import type {PathArea,PathNode} from '../assets/pathNodes';

/** CPathFind::FindParkingNodeInArea (iOS 0x1001bf7ac): one shared cursor across every box and script. */
export class NativeParkingNodeSearch {
 private cursor=0;
 find(areas:ReadonlyMap<number,PathArea>|undefined,x1:number,y1:number,z1:number,x2:number,y2:number,z2:number){
  const f=Math.fround,min=[Math.min(f(x1),f(x2)),Math.min(f(y1),f(y2)),Math.min(f(z1),f(z2))],max=[Math.max(f(x1),f(x2)),Math.max(f(y1),f(y2)),Math.max(f(z1),f(z2))];
  let first:PathNode|undefined,selected:PathNode|undefined,count=0;
  for(let id=0;id<64;id++){
   const area=areas?.get(id);if(!area)continue;
   for(let i=0;i<area.vehicleCount;i++){
    const node=area.nodes[i];if(node.behaviour!==2||!node.position.every((p,k)=>p>min[k]&&p<max[k]))continue;
    first??=node;if(count===this.cursor)selected=node;count++;
   }
  }
  // A cursor beyond the new box's count returns its first match for this call, then restarts at zero.
  this.cursor=this.cursor+1>=count?0:this.cursor+1;
  const p=(selected??first)?.position;return p?{x:p[0],y:p[1],z:p[2]}:{x:0,y:0,z:0};
 }
}
