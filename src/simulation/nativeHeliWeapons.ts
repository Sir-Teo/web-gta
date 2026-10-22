import type {Vec3} from '../core/math';
const f=Math.fround;
const vector=(v:Vec3):Vec3=>({x:f(v.x),y:f(v.y),z:f(v.z)});
const subtract=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
/** CCarCtrl::TestWhetherToFirePlaneGuns, shared by plane and helicopter attack missions. */
export function nativeAircraftGunRequest(position:Vec3,forward:Vec3,target:Vec3|undefined,selection:number){
 if(!target||selection!==0&&selection!==1)return false;
 const delta=subtract(vector(target),vector(position)),squared=dot(delta,delta),distance=f(Math.sqrt(squared));
 if(!(distance<150))return false;
 const inverse=squared>0?f(1/distance):0;
 const direction=squared>0?{x:f(delta.x*inverse),y:f(delta.y*inverse),z:f(delta.z*inverse)}:{...delta,x:1};
 return dot(direction,vector(forward))>f(.8);
}
/** Complete valid-target TestWhetherToFireHeliMissiles (0x1001a0ac0). */
export function heliWeaponRequests(position:Vec3,right:Vec3,forward:Vec3,target:Vec3|undefined,selection:number,nowMs:number,previousMs:number){
 const guns=nativeAircraftGunRequest(position,forward,target,selection);
 const now=nowMs>>>0,previous=previousMs>>>0,quarter=Math.floor(now/250);
 if(!target||selection!==0&&selection!==4||quarter===Math.floor(previous/250))return{guns,rocket:undefined};
 const point=vector(position),to=subtract(vector(target),point),squared=dot(to,to);
 if(!(f(Math.sqrt(squared))<80))return{guns,rocket:undefined};
 // The helper measures distance to the infinite line through position and float32(position + forward).
 const direction=vector(forward),end={x:f(point.x+direction.x),y:f(point.y+direction.y),z:f(point.z+direction.z)},line=subtract(end,point),along=dot(line,to);
 const perpendicular=f(squared-f(f(along*along)/dot(line,line))),distance=perpendicular<=0?0:f(Math.sqrt(perpendicular));
 if(!(distance<7))return{guns,rocket:undefined};
 const side=quarter%2?-1:1,axis=vector(right);
 const coordinate=(key:keyof Vec3)=>f(f(point[key]+f(direction[key]*4))+f(f(axis[key]*1.5)*side));
 return{guns,rocket:{origin:{x:coordinate('x'),y:coordinate('y'),z:coordinate('z')},direction}};
}
