/** CGlass and CFallingGlassPane (gta-reversed ead3051): the world's glass windows (IDE flags IS_GLASS_TYPE_1 0x200
 * and IS_GLASS_TYPE_2 0x400) crack when a bullet or a soft blow marks them and shatter into falling panes when a
 * second bullet (one in four), a hard collision or a nearby explosion breaks them altogether. Native coordinates
 * (x, y on the plane, z up). */
export const GLASS_TYPE_1=0x200,GLASS_TYPE_2=0x400;
export function isGlassDefinition(flags:number|undefined){return ((flags??0)&(GLASS_TYPE_1|GLASS_TYPE_2))!==0;}
export type Vec3=[number,number,number];
export type Vec2=[number,number];
/** CGlass::PanePolyPositions: four triangles of a unit pane. The exe holds the table (0x8D5CD8); this fan of four
 * about the centre is authored to the reversed count and layout (unit square, centres averaged as Init does). */
export const PANE_POLY_POSITIONS:readonly (readonly [Vec2,Vec2,Vec2])[]=[
 [[0,0],[1,0],[0.5,0.5]],[[1,0],[1,1],[0.5,0.5]],[[1,1],[0,1],[0.5,0.5]],[[0,1],[0,0],[0.5,0.5]],
];
/** CGlass::Init: the centre of each piece is the average of its corners. */
export const PANE_POLY_CENTERS:readonly Vec2[]=PANE_POLY_POSITIONS.map(poly=>[(poly[0][0]+poly[1][0]+poly[2][0])/3,(poly[0][1]+poly[1][1]+poly[2][1])/3]);
export const MAX_PANES=44;
export const PANE_TYPE={default:0,delayed:1,car:2} as const;
export interface GlassPane {
 piece:number;
 /** CMatrix: right, up and forward axes (up runs along the window's height) and the piece centre. */
 right:Vec3;up:Vec3;forward:Vec3;position:Vec3;
 velocity:Vec3;random:Vec3;createdTime:number;groundZ:number;renderShatter:boolean;size:number;slow:boolean;
}
export interface GlassState {hasBrokenGlass:boolean;brokenAltogether:boolean}
export const newGlassState=():GlassState=>({hasBrokenGlass:false,brokenAltogether:false});
const norm=(v:Vec3):Vec3=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
export class GlassPanes {
 readonly panes:GlassPane[]=[];
 constructor(private random:()=>number=Math.random){}
 /** CGlass::GeneratePanesForWindow: the window from `point` spanning `fwd` (its height) and `right` (its width) is
  * cut into up to 3 × 3 sections (one when `max1Section`), each into the four pieces, every piece a pane thrown
  * with `velocity` plus a random spread, pushed away from `center` by `centerDrag`; delayed panes start later the
  * farther they sit from the centre (100 ms a unit). */
 generatePanesForWindow(type:number,point:Vec3,fwd:Vec3,right:Vec3,velocity:Vec3,center:Vec3,centerDrag:number,shatter:boolean,max1Section:boolean,sections:number,slow:boolean,nowMs:number,groundZ:number){
  const totalY=Math.hypot(...fwd),totalX=Math.hypot(...right);
  const countOf=(axis:number)=>max1Section?1:Math.min(sections*Math.floor(axis+0.75),3);
  const countX=countOf(totalX),sizeX=totalX/Math.max(1,countX),countY=countOf(totalY),sizeY=totalY/Math.max(1,countY);
  if(!countY)return 0;
  const f=norm(fwd),r=norm(right);let made=0;
  for(let py=0;py<countY;py++)for(let px=0;px<countX;px++)for(let piece=0;piece<PANE_POLY_POSITIONS.length;piece++){
   if(this.panes.length>=MAX_PANES)return made;
   const paneRight=scale(r,sizeX),paneUp=scale(f,sizeY),paneForward=norm(cross(paneRight,paneUp));
   const c=PANE_POLY_CENTERS[piece],cx=(c[0]+px)*sizeX,cy=(c[1]+py)*sizeY;
   const position=add(add(point,scale(f,cy)),scale(r,cx));
   const spread=()=>((Math.floor(this.random()*128))-64)*0.0015;
   let vel:Vec3=[velocity[0]+spread(),velocity[1]+spread(),velocity[2]];
   if(centerDrag!==0){const away=norm([position[0]-center[0],position[1]-center[1],position[2]-center[2]]);vel=add(vel,scale(away,centerDrag));}
   const rnd=()=>((Math.floor(this.random()*128))-64)/500;
   const distance=Math.hypot(position[0]-center[0],position[1]-center[1],position[2]-center[2]);
   this.panes.push({piece,right:paneRight,up:paneUp,forward:paneForward,position,velocity:vel,random:[rnd(),rnd(),rnd()],
    createdTime:type===PANE_TYPE.delayed?nowMs+Math.floor(distance*100):nowMs,groundZ,renderShatter:shatter,size:sizeY,slow});
   made++;
  }
  return made;
 }
 /** CFallingGlassPane::Update over `timeStep` frames: fall (slower and lighter for the slow kind), tumble with the
  * random spin, and vanish at the ground (`onGround` gets the landing point). */
 update(timeStep:number,nowMs:number,onGround?:(at:Vec3,slow:boolean)=>void){
  for(let i=this.panes.length-1;i>=0;i--){
   const p=this.panes[i];if(nowMs<p.createdTime)continue;
   if(p.slow){p.position=add(p.position,scale(p.velocity,timeStep*0.35));p.velocity[2]-=timeStep/100;}
   else{p.position=add(p.position,scale(p.velocity,timeStep));p.velocity[2]-=timeStep/50;}
   p.right=add(p.right,cross(p.random,p.right));p.forward=add(p.forward,cross(p.random,p.forward));p.up=add(p.up,cross(p.random,p.up));
   if(p.position[2]<p.groundZ){this.panes.splice(i,1);onGround?.([p.position[0],p.position[1],p.groundZ],p.slow);}
  }
 }
 /** The three corners of a pane in native space (CFallingGlassPane::Render: piece corners less the piece centre,
  * mapped along right (x) and up (y)). */
 corners(p:GlassPane):[Vec3,Vec3,Vec3]{
  const c=PANE_POLY_CENTERS[p.piece];
  return PANE_POLY_POSITIONS[p.piece].map(([x,y])=>{const dx=x-c[0],dy=y-c[1];return [p.position[0]+p.right[0]*dx+p.up[0]*dy,p.position[1]+p.right[1]*dx+p.up[1]*dy,p.position[2]+p.right[2]*dx+p.up[2]*dy] as Vec3;}) as [Vec3,Vec3,Vec3];
 }
}
/** CGlass::CalcAlphaWithNormal: the specular highlight of the camera's reflection off the pane against the
 * (1, 1, -1) light, to the sixth, from 20 to 255. */
export function glassAlphaWithNormal(normal:Vec3,cameraForward:Vec3){
 const n=norm(normal),f=cameraForward,d=f[0]*n[0]+f[1]*n[1]+f[2]*n[2];
 const reflect:Vec3=[f[0]-2*d*n[0],f[1]-2*d*n[1],f[2]-2*d*n[2]];
 const light=norm([1,1,-1]);
 const specular=reflect[0]*light[0]+reflect[1]*light[1]+reflect[2]*light[2];
 return Math.max(0,Math.min(255,Math.round(Math.pow(specular,6)*235+20)));
}
/** CFallingGlassPane::CalculateHiLightPolyColor: the normal's alpha ramps up over the pane's first 500 ms (slow
 * panes never below 64). */
export function paneHighlightAlpha(p:GlassPane,nowMs:number,cameraForward:Vec3){
 const alpha=glassAlphaWithNormal(p.forward,cameraForward),delta=Math.max(0,Math.min(500,nowMs-p.createdTime));
 const scaled=Math.floor(alpha*delta/500);
 return p.slow?Math.max(64,scaled):scaled;
}
/** CFallingGlassPane::CalculateShatterPolyColor: 140 within 30 units of the camera, fading to 0 by 40. */
export function paneShatterAlpha(p:GlassPane,camera:Vec3){
 const d=Math.hypot(p.position[0]-camera[0],p.position[1]-camera[1],p.position[2]-camera[2]);
 return d>30?Math.max(0,Math.round((1-(d-30)/10)*140)):140;
}
/** A window's quad from its collision (two triangles, four object-space vertices) placed in the world by `transform`:
 * CGlass::WindowRespondsToCollision's vert0 at the pane's lowest z, the corner farthest from it on the plane, and
 * the height maxZ - minZ. */
export function windowFrame(vertices:readonly Vec3[],transform:(v:Vec3)=>Vec3){
 if(vertices.length<4)return undefined;
 const v=vertices.slice(0,4);
 let minZ=Infinity,maxZ=-Infinity;for(const p of v){minZ=Math.min(minZ,p[2]);maxZ=Math.max(maxZ,p[2]);}
 let far=v[0],best=-1;for(const p of v){const d=(p[0]-v[0][0])**2+(p[1]-v[0][1])**2;if(d>best){best=d;far=p;}}
 const vert0=transform([v[0][0],v[0][1],minZ]),farPos=transform([far[0],far[1],minZ]);
 return {vert0,fwd:[0,0,maxZ-minZ] as Vec3,right:[farPos[0]-vert0[0],farPos[1]-vert0[1],farPos[2]-vert0[2]] as Vec3};
}
/** CGlass::WindowRespondsToCollision: an unbroken window breaks altogether; with a two-triangle collision it also
 * throws panes (delayed under 300 damage intensity). Returns whether it broke now. */
export function windowRespondsToCollision(state:GlassState,panes:GlassPanes,frame:ReturnType<typeof windowFrame>,damageIntensity:number,moveSpeed:Vec3,point:Vec3,max1Section:boolean,nowMs:number,groundZ:number){
 if(state.brokenAltogether)return false;
 state.hasBrokenGlass=true;
 if(frame)panes.generatePanesForWindow(damageIntensity<=300?PANE_TYPE.delayed:PANE_TYPE.default,frame.vert0,frame.fwd,frame.right,moveSpeed,point,0.1,true,max1Section,1,false,nowMs,groundZ);
 state.brokenAltogether=true;
 return true;
}
/** CGlass::WasGlassHitByBullet: the first bullet cracks the window (hasBrokenGlass); later ones break it one time in
 * four. Returns 'crack', 'break' or undefined. */
export function wasGlassHitByBullet(state:GlassState,random:()=>number=Math.random):'crack'|'break'|undefined{
 if(state.brokenAltogether)return undefined;
 if(state.hasBrokenGlass)return Math.floor(random()*4)===2?'break':undefined;
 state.hasBrokenGlass=true;return 'crack';
}
/** CGlass::WindowRespondsToSoftCollision: a blow over 50 cracks an unbroken window (AE_GLASS_HIT). */
export function windowRespondsToSoftCollision(state:GlassState,damageIntensity:number){
 if(damageIntensity>50&&!state.hasBrokenGlass){state.hasBrokenGlass=true;return true;}
 return false;
}
/** CGlass::WindowRespondsToExplosion: within 10 units the window breaks (10000 damage, blown away from the blast
 * at 0.3 over the distance); within 30 it cracks. Returns the collision arguments to apply, 'crack', or undefined. */
export function windowRespondsToExplosion(windowPos:Vec3,blast:Vec3){
 const dir:Vec3=[windowPos[0]-blast[0],windowPos[1]-blast[1],windowPos[2]-blast[2]],d=Math.hypot(...dir);
 if(d>=10)return d<30?'crack' as const:undefined;
 return {damageIntensity:10000,moveSpeed:scale(dir,0.3/Math.max(1e-6,d)),point:windowPos,max1Section:true};
}

/** The two collision triangles of a car's glass (CGlass::CarWindscreenShatters): the first triangle whose material
 * the surface table marks as glass and the one after it. Returns their six model-space vertices in triangle order
 * and the first triangle's plane normal, or undefined. */
export function findGlassTriangles(mesh:{positions:Float32Array;indices:Uint32Array;materials:Uint8Array},isGlass:(material:number)=>boolean){
 const count=mesh.materials.length;let first=-1;
 for(let i=0;i<count;i++)if(isGlass(mesh.materials[i])){first=i;break;}
 if(first<0||first+1>=count)return undefined;
 const vertices:Vec3[]=[];
 for(let t=0;t<2;t++)for(let v=0;v<3;v++){const i=mesh.indices[(first+t)*3+v];vertices.push([mesh.positions[i*3],mesh.positions[i*3+1],mesh.positions[i*3+2]]);}
 const e1:Vec3=[vertices[1][0]-vertices[0][0],vertices[1][1]-vertices[0][1],vertices[1][2]-vertices[0][2]],e2:Vec3=[vertices[2][0]-vertices[0][0],vertices[2][1]-vertices[0][1],vertices[2][2]-vertices[0][2]];
 return {vertices,normal:norm(cross(e1,e2))};
}
/** CGlass::CarWindscreenShatters' frame: with the glass triangles' six world-space vertices, the pane's world
 * normal and the vehicle's right and up axes, the pane's forward runs along right × normal and its right along
 * up × normal; each vertex projects onto both, the top right is the greatest of each, the bottom left the vertex
 * with the least sum, and the extents their differences. */
export function carWindscreenFrame(vertices:readonly Vec3[],normal:Vec3,vehicleRight:Vec3,vehicleUp:Vec3){
 if(vertices.length<6)return undefined;
 const fwd=norm(cross(vehicleRight,normal)),right=norm(cross(vehicleUp,normal));
 const dot=(v:Vec3,d:Vec3)=>v[0]*d[0]+v[1]*d[1]+v[2]*d[2];
 const rightDots=vertices.map(v=>dot(v,right)),fwdDots=vertices.map(v=>dot(v,fwd));
 const maxFwd=Math.max(...fwdDots),maxRight=Math.max(...rightDots);
 let minSum=Infinity,minIdx=0;for(let i=0;i<vertices.length;i++){const s=rightDots[i]+fwdDots[i];if(s<minSum){minSum=s;minIdx=i;}}
 const extentRight=maxRight-rightDots[minIdx],extentFwd=maxFwd-fwdDots[minIdx],bl=vertices[minIdx];
 const fwdSpan=scale(fwd,extentFwd),rightSpan=scale(right,extentRight);
 return {point:bl,fwd:fwdSpan,right:rightSpan,center:add(add(bl,scale(fwdSpan,.5)),scale(rightSpan,.5)),extentFwd,extentRight};
}
