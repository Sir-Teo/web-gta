type Vec3={x:number;y:number;z:number};
/** CRegisteredMotionBlurStreak: the latest three edges (left and right points) and whether each was registered. */
interface Streak {id:number;color:[number,number,number,number];left:Vec3[];right:Vec3[];history:boolean[]}
const zero=()=>({x:0,y:0,z:0});

/** CMotionBlurStreaks (MotionBlurStreaks.cpp, reversed): four ribbons that trail thrown grenades and molotovs over their
 * last two frames. CSpecialFX::AddWeaponStreak, the melee-weapon use, is unused in the original. */
export class NativeMotionBlurStreaks {
 readonly streaks:Streak[]=Array.from({length:4},()=>({id:0,color:[0,0,0,0],left:[zero(),zero(),zero()],right:[zero(),zero(),zero()],history:[false,false,false]}));
 /** CMotionBlurStreaks::RegisterStreak (0x721DC0). `id` is non-zero (the original passes the entity's address). */
 register(id:number,color:readonly [number,number,number,number],left:Vec3,right:Vec3){
  if(!id)throw new Error('Motion blur streaks need a non-zero id.');
  let streak=this.streaks.find(s=>s.id===id);
  if(!streak){streak=this.streaks.find(s=>!s.id);if(!streak)return;streak.id=id;streak.history[1]=false;}
  streak.color=[...color];streak.left[0]={...left};streak.right[0]={...right};streak.history[0]=true;
 }
 /** CRegisteredMotionBlurStreak::Update (0x721EE0) for every streak: the edges move down the history, and a streak with
  * none registered in its last two frames frees its slot. */
 update(){
  for(const s of this.streaks){
   if(!s.id)continue;
   let alive=false;
   for(let i=2;i>=1;i--){s.left[i]=s.left[i-1];s.right[i]=s.right[i-1];s.history[i]=s.history[i-1];if(alive||s.history[i])alive=true;}
   s.history[0]=false;
   if(!alive)s.id=0;
  }
 }
 /** CRegisteredMotionBlurStreak::Render (0x721F70): a quad between each pair of registered edges, a third of the
  * colour's alpha at the newest edge and less at each older one. Triangles (both faces) and RGBA bytes. */
 geometry(){
  const positions:number[]=[],colors:number[]=[];
  for(const s of this.streaks){
   if(!s.id)continue;
   for(let i=0;i<2;i++){
    if(!s.history[0]||!s.history[i+1])continue;
    const alpha=255-i*85,a1=Math.trunc(s.color[3]*alpha/3/255),a2=Math.trunc(s.color[3]*(alpha-85)/3/255);
    const v=[s.left[i],s.right[i],s.left[i+1],s.right[i+1]],a=[a1,a1,a2,a2];
    for(const k of [0,1,2,1,3,2]){positions.push(v[k].x,v[k].y,v[k].z);colors.push(s.color[0],s.color[1],s.color[2],a[k]);}
   }
  }
  return {positions,colors};
 }
}
