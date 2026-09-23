/* CRoadBlocks (RoadBlocks.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: GenerateRoadBlocks
 * (0x4629E0), GetRoadBlockNodeInfo (0x460EE0) and RegisterScriptRoadBlock (0x460DF0). Each ROADBLOX.DAT node rolls once
 * as the wanted, driving player comes within 90 units of it, against CWanted::m_nChanceOnRoadBlock out of 128.
 * CreateRoadBlockBetween2Points, which puts the cars and cops between the two points, is a retail stub: the host
 * stands in for it. Coordinates are native (Z up). */
import type {RoadblockNode} from '../assets/roadblox';
import {MAX_ROADBLOCKS} from '../assets/roadblox';
import type {NavigationNode,PathAddress,PathNode} from '../assets/pathNodes';

export const MAX_SCRIPT_ROADBLOCKS=16;
type V3={x:number;y:number;z:number};

/** What the generator reads of the loaded path areas. */
export interface RoadBlockPaths {
 /** A loaded node, or nothing when its area is not loaded. */
 node(address:PathAddress):PathNode|undefined;
 /** The navigation node behind link `baseLink + i` of a node's area, when its own area is loaded. */
 naviLink(area:number,link:number):NavigationNode|undefined;
}
interface ScriptRoadBlock {cornerA:V3;cornerB:V3;active:boolean;safeToCreate:boolean;gang:boolean}

/** CRoadBlocks::GetRoadBlockNodeInfo: the road's width from its widest navigation link, (lanes + 1) × 5, and the
 * direction across it, the right perpendicular of the step from the first navigation link to the second. */
export function roadBlockNodeInfo(node:PathNode,paths:RoadBlockPaths):{width:number;dir:{x:number;y:number}}|undefined{
 if(node.linkCount<2)return;
 const a=paths.naviLink(node.address.area,node.baseLink),b=paths.naviLink(node.address.area,node.baseLink+1);
 if(!a||!b)return;
 const lanes=Math.max(a.oppositeLanes+a.sameLanes,b.oppositeLanes+b.sameLanes);
 const dx=b.position[0]-a.position[0],dy=b.position[1]-a.position[1],l=Math.hypot(dx,dy);
 // CVector2D::GetPerpRight is (y, -x); Normalized() of a zero vector is (1, 0, 0).
 return {width:(lanes+1)*5,dir:l>0?{x:dy/l,y:-dx/l}:{x:1,y:0}};
}

export class NativeRoadBlocks {
 readonly inOrOut=Array<boolean>(MAX_ROADBLOCKS).fill(true);
 generateDynamic=false;
 readonly script:ScriptRoadBlock[]=Array.from({length:MAX_SCRIPT_ROADBLOCKS},()=>({cornerA:{x:0,y:0,z:0},cornerB:{x:0,y:0,z:0},active:false,safeToCreate:false,gang:false}));
 constructor(readonly nodes:readonly RoadblockNode[]){}
 /** CRoadBlocks::RegisterScriptRoadBlock. */
 registerScript(cornerA:V3,cornerB:V3,gang:boolean){
  const free=this.script.find(s=>!s.active);if(!free)return;
  Object.assign(free,{cornerA:{...cornerA},cornerB:{...cornerB},active:true,safeToCreate:true,gang});
 }
 /** CRoadBlocks::ClearScriptRoadBlocks. */
 clearScript(){for(const s of this.script)s.active=false;}
 /** CRoadBlocks::GenerateRoadBlocks for one frame. `chance` is m_nChanceOnRoadBlock (0 with the law backed off),
  * `inVehicle` is FindPlayerVehicle(), `random128` is CGeneral::GetRandomNumberInRange(128), `clearLine` is the
  * buildings-only line of sight between two points and `create` is CreateRoadBlockBetween2Points. */
 generate(frame:number,chance:number,inVehicle:boolean,player:V3,paths:RoadBlockPaths,random128:()=>number,clearLine:(a:V3,b:V3)=>boolean,create:(a:V3,b:V3,gang:boolean)=>void){
  if(chance&&inVehicle){
   if(!this.generateDynamic){this.inOrOut.fill(true);this.generateDynamic=true;}
   const counter1=MAX_ROADBLOCKS*(frame%16+1),count=Math.min(this.nodes.length,Math.trunc((counter1%16+counter1)/16));
   for(let i=Math.trunc(MAX_ROADBLOCKS*(frame%16)/16);i<count;i++){
    const main=paths.node({area:this.nodes[i].areaId,node:this.nodes[i].nodeId});if(!main)continue;
    const [mx,my,mz]=main.position;
    if(Math.abs(player.x-mx)>=90||Math.abs(player.y-my)>=90||Math.hypot(player.x-mx,player.y-my)>=90){this.inOrOut[i]=false;continue;}
    if(this.inOrOut[i])continue;
    this.inOrOut[i]=true;
    if(random128()>=chance)continue;
    const info=roadBlockNodeInfo(main,paths);if(!info)continue;
    const {width:w,dir}=info,at=(k:number)=>({x:mx+dir.x*k,y:my+dir.y*k,z:mz});
    if(main.width){
     create(at(w/2+main.width),at(main.width),false);
     create(at(-main.width),at(-(w/2+main.width)),false);
     continue;
    }
    // Without a path width of its own, a node only makes a roadblock with a partner node: within 30 units, as wide,
    // facing the same way, not yet rolled and in sight. The reversed routine also carries an unreachable
    // "i == NumRoadBlocks" block inside this loop that reads like a lone-node fallback misplaced from after it; the
    // port follows the reversed code as written, so a lone node makes nothing.
    for(let j=0;j<this.nodes.length;j++){
     if(j===i||this.inOrOut[j])continue;
     const other=paths.node({area:this.nodes[j].areaId,node:this.nodes[j].nodeId});if(!other)continue;
     const [ox,oy,oz]=other.position;
     if(Math.abs(mx-ox)>=30||Math.abs(my-oy)>=30)continue;
     const otherInfo=roadBlockNodeInfo(other,paths);if(!otherInfo)continue;
     if(w!==otherInfo.width||otherInfo.dir.x*dir.x+otherInfo.dir.y*dir.y<=.7)continue;
     if(!clearLine({x:mx,y:my,z:mz+1},{x:ox,y:oy,z:oz+1}))continue;
     const dx=ox-mx,dy=oy-my,dz=oz-mz,l=Math.hypot(dx,dy,dz)||1,u={x:dx/l,y:dy/l,z:dz/l};
     create({x:ox+u.x*w/2,y:oy+u.y*w/2,z:oz+u.z*w/2},{x:mx-u.x*w/2,y:my-u.y*w/2,z:mz-u.z*w/2},false);
     this.inOrOut[j]=true;
    }
   }
  }else this.generateDynamic=false;
  const s=this.script[frame%MAX_SCRIPT_ROADBLOCKS];
  if(s.active){
   const c={x:(s.cornerA.x+s.cornerB.x)/2,y:(s.cornerA.y+s.cornerB.y)/2,z:(s.cornerA.z+s.cornerB.z)/2};
   if(Math.hypot(player.x-c.x,player.y-c.y,player.z-c.z)>=90)s.safeToCreate=true;
   else if(s.safeToCreate){create(s.cornerA,s.cornerB,s.gang);s.safeToCreate=false;}
  }
 }
}
