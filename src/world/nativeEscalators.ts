/* CEscalator and CEscalators (gta-reversed ead3051): the moving steps of an escalator. A model's escalator 2d
 * effect gives four points in object space, the effect position (the start, at the foot of the lower run), the
 * bottom and top of the sloped run and the end of the upper run, plus a direction byte (0 down, 1 up);
 * CEntity::CreateEffects transforms them into the world and hands them to CEscalators::AddOne, which fills one of
 * thirty-two slots. AddThisOne drops every point by the step model's bounding box height, counts the planes (one
 * plus two and a half per unit of the sloped run, one plus a plane every 3.2 units of each flat run, at most
 * forty-two in all) and takes the rotation from the flat direction between the start and the bottom. Update builds
 * the step objects once the camera comes within the bounding radius plus twenty, advances a position that wraps
 * every unit by the time step over twenty-five (backwards going down), lays the sloped steps back from the top and
 * the flat steps out from the start and the top at eight-unit spacings, all divided by two and a half, and drops
 * the objects again three units past the build distance. Native axes (x east, y north, z up). */
export const MAX_ESCALATORS=32,MAX_ESCALATOR_STEPS=42;
export const ESCALATOR_RENDER_DISTANCE=20,ESCALATOR_SWITCH_OFF_EXTRA=3;
export const ESCALATOR_STEP_RATE=1/25,ESCALATOR_SLOPE_PLANES_PER_UNIT=2.5,ESCALATOR_FLAT_PLANE_SPACING=3.2,ESCALATOR_PLANE_SCALE=2.5,ESCALATOR_FLAT_STEP=8,ESCALATOR_FLAT_FIRST=4;
export const ESCALATOR_STEP_SPEED=0.016;
/** The step models' half width and a step's half depth (esc_step is about 1.5 by 0.4 units; authored footprint). */
export const ESCALATOR_STEP_HALF_WIDTH=.75,ESCALATOR_STEP_HALF_DEPTH=.25;
export type Vec3=readonly [number,number,number];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const length=(a:Vec3)=>Math.hypot(a[0],a[1],a[2]);
const normalized=(a:Vec3):Vec3=>{const l=length(a);return l?[a[0]/l,a[1]/l,a[2]/l]:[0,0,0];};
export interface EscalatorPlan {
 start:Vec3;bottom:Vec3;top:Vec3;end:Vec3;moveDown:boolean;
 /** The right, forward and up rows of the steps' shared rotation. */
 rotation:[Vec3,Vec3,Vec3];
 intermediatePlanes:number;bottomPlanes:number;topPlanes:number;steps:number;
 bounding:{centre:Vec3;radius:number};
}
/** CEscalator::AddThisOne: the plan of one escalator, its points already in world space. */
export function planEscalator(start:Vec3,bottom:Vec3,top:Vec3,end:Vec3,moveDown:boolean,stepHeight:number):EscalatorPlan{
 const drop=(p:Vec3):Vec3=>[p[0],p[1],p[2]-stepHeight];
 const s=drop(start),b=drop(bottom),t=drop(top),e=drop(end);
 const intermediatePlanes=1+Math.trunc(length(sub(b,t))*ESCALATOR_SLOPE_PLANES_PER_UNIT);
 const bottomPlanes=1+Math.trunc(length(sub(b,s))/ESCALATOR_FLAT_PLANE_SPACING);
 const topPlanes=1+Math.trunc(length(sub(e,t))/ESCALATOR_FLAT_PLANE_SPACING);
 // The rotation comes from the undropped points, the flat direction from the bottom to the start.
 const flat=Math.hypot(start[0]-bottom[0],start[1]-bottom[1]);
 const dir=flat?[(start[0]-bottom[0])/flat,(start[1]-bottom[1])/flat] as const:[0,0] as const;
 const centre:Vec3=[(s[0]+e[0])/2,(s[1]+e[1])/2,(s[2]+e[2])/2];
 return {start:s,bottom:b,top:t,end:e,moveDown,
  rotation:[[dir[1],-dir[0],0],[dir[0],dir[1],0],[0,0,1]],
  intermediatePlanes,bottomPlanes,topPlanes,steps:Math.min(MAX_ESCALATOR_STEPS,intermediatePlanes+bottomPlanes+topPlanes),
  bounding:{centre,radius:length(sub(centre,s))}};
}
/** The wrapped position after a frame: forwards going up, backwards going down. */
export function advanceEscalatorPosition(position:number,timeStep:number,moveDown:boolean){
 const stepped=moveDown?position-timeStep*ESCALATOR_STEP_RATE+1:position+timeStep*ESCALATOR_STEP_RATE;
 return stepped-Math.floor(stepped);
}
/** One step's world position and its move speed, by slot: the sloped run first, then the bottom and top flats. */
export function escalatorStepPose(plan:EscalatorPlan,index:number,position:number){
 if(index<plan.intermediatePlanes){
  const t=(index-position+1)/ESCALATOR_PLANE_SCALE,dir=normalized(sub(plan.bottom,plan.top));
  return {position:add(plan.top,scale(dir,t)),speed:scale(dir,-ESCALATOR_STEP_SPEED*(plan.moveDown?-1:1))};
 }
 if(index<plan.intermediatePlanes+plan.bottomPlanes){
  const t=(ESCALATOR_FLAT_STEP*(index-plan.intermediatePlanes)+ESCALATOR_FLAT_FIRST+position)/ESCALATOR_PLANE_SCALE,dir=normalized(sub(plan.bottom,plan.start));
  return {position:add(plan.start,scale(dir,t)),speed:scale(dir,ESCALATOR_STEP_SPEED*(plan.moveDown?-1:1))};
 }
 const t=(ESCALATOR_FLAT_STEP*(index-plan.intermediatePlanes-plan.bottomPlanes)+ESCALATOR_FLAT_FIRST+position)/ESCALATOR_PLANE_SCALE,dir=normalized(sub(plan.end,plan.top));
 return {position:add(plan.top,scale(dir,t)),speed:scale(dir,ESCALATOR_STEP_SPEED*(plan.moveDown?-1:1))};
}
/** Whether a step slot takes the sloped step model rather than the flat one (MI_ESCALATORSTEP or ...STEP8). */
export function escalatorStepIsSloped(plan:EscalatorPlan,index:number){return index<plan.intermediatePlanes;}
export interface EscalatorState {plan:EscalatorPlan;built:boolean;position:number}
/** CEscalators: the world's escalators, built and dropped by camera distance. */
export class NativeEscalatorField {
 readonly escalators:EscalatorState[]=[];
 /** CEscalators::AddOne: one of thirty-two slots. */
 add(plan:EscalatorPlan){
  if(this.escalators.length>=MAX_ESCALATORS)return false;
  this.escalators.push({plan,built:false,position:0});return true;
 }
 clear(){this.escalators.length=0;}
 /** CEscalator::Update for every escalator: the ones to draw this frame, with their step poses. */
 update(cameraPos:Vec3,timeStep:number){
  const drawn:{escalator:EscalatorState;steps:{position:Vec3;speed:Vec3;sloped:boolean}[]}[]=[];
  for(const escalator of this.escalators){
   const {plan}=escalator,distance=length(sub(plan.bounding.centre,cameraPos));
   if(!escalator.built){
    if(plan.bounding.radius+ESCALATOR_RENDER_DISTANCE>distance){escalator.built=true;escalator.position=0;}
    else continue;
   }
   escalator.position=advanceEscalatorPosition(escalator.position,timeStep,plan.moveDown);
   const steps=Array.from({length:plan.steps},(_,index)=>{
    const pose=escalatorStepPose(plan,index,escalator.position);
    return {position:pose.position,speed:pose.speed,sloped:escalatorStepIsSloped(plan,index)};
   });
   drawn.push({escalator,steps});
   if(plan.bounding.radius+ESCALATOR_RENDER_DISTANCE+ESCALATOR_SWITCH_OFF_EXTRA<distance){escalator.built=false;}
  }
  return drawn;
 }
 /** The step a ped's feet rest on (native space): within the step's half width across the run, a step's depth along it
  * and a little above or below its top. Its move speed is what CPhysical carries a ped standing on it by. */
 static stepUnder(drawn:readonly {escalator:EscalatorState;steps:readonly {position:Vec3;speed:Vec3}[]}[],feet:Vec3){
  for(const {escalator,steps} of drawn){
   const [right,forward]=escalator.plan.rotation;
   for(const step of steps){
    const d=sub(feet,step.position),across=Math.abs(d[0]*right[0]+d[1]*right[1]+d[2]*right[2]),along=Math.abs(d[0]*forward[0]+d[1]*forward[1]+d[2]*forward[2]);
    if(across<ESCALATOR_STEP_HALF_WIDTH&&along<ESCALATOR_STEP_HALF_DEPTH&&Math.abs(d[2])<.6)return step;
   }
  }
  return undefined;
 }
 snapshot(){return {escalators:this.escalators.length,built:this.escalators.filter(e=>e.built).length,steps:this.escalators.filter(e=>e.built).reduce((n,e)=>n+e.plan.steps,0)};}
}
