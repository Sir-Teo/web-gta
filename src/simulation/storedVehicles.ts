import {Matrix4,Quaternion,Vector3} from 'three';
import {STORED_CAR,type StoredCar} from '../engine/ScmGarages';
import type {PhysicalProofs} from '../combat/nativePhysicalProofs';
import {packStoredPaintjob} from '../vehicle/nativeVehicleRemap';
/** What CStoredCar::StoreCar reads of a vehicle and RestoreCar gives back: its body, and what an automobile carries. */
export interface StorableVehicle {
 modelId:number;
 car:{body:{translation():{x:number;y:number;z:number};rotation():{x:number;y:number;z:number;w:number}};nitro?:{installed:boolean;boosts:number}};
 assets:{colourIndices?:readonly number[]};
 proofs?:PhysicalProofs;bombOnBoard?:number;
 /** CVehicle::GetRemapIndex and m_anUpgrades, for an automobile. */
 paintjob?:number;upgrades?:ReadonlyMap<number,number>;
}
/** CStoredCar::StoreCar (iOS 0x1001b7d00) for the parts the port's vehicles carry: the model, the position (native
 * axes), the forward times 100 cut to whole numbers, the four colours (-1 for a vehicle that keeps none), the proofs
 * and nitro as m_nStoredCarFlags, the nitro boosts, the bomb, the upgrades (m_awCarMods) and the paintjob
 * (GetRemapIndex, byte 0x3a). */
export function storeVehicle(v:StorableVehicle):StoredCar{
 const body=v.car.body,t=body.translation(),q=body.rotation();
 // The model's forward (native +y, the renderer's -z) turned by the body, in native axes.
 const fx=-2*(q.x*q.z+q.w*q.y),fy=-2*(q.y*q.z-q.w*q.x),fz=-(1-2*(q.x*q.x+q.y*q.y));
 const p=v.proofs,nitro=v.car.nitro;
 const flags=(p?.bullet?STORED_CAR.bulletProof:0)|(p?.fire?STORED_CAR.fireProof:0)|(p?.explosion?STORED_CAR.explosionProof:0)|(p?.collision?STORED_CAR.collisionProof:0)|(p?.melee?STORED_CAR.meleeProof:0)|(nitro?.installed?STORED_CAR.nitro:0);
 const colours=v.assets.colourIndices??[-1,-1,-1,-1],bomb=v.bombOnBoard??0;
 // An int8 (no negative zero).
 const pack=(f:number)=>Math.trunc(f*100)||0;
 const mods=v.upgrades?[...v.upgrades.values()]:[];
 return {model:v.modelId,position:[t.x,-t.z,t.y],forward:[pack(fx),pack(-fz),pack(fy)],colours:[colours[0],colours[1],colours[2],colours[3]],flags,nitroBoosts:nitro?.installed?nitro.boosts:0,...(bomb?{bomb}:{}),...(mods.length?{mods}:{}),paintjob:packStoredPaintjob(v.paintjob??-1)};
}
/** RestoreCar's place and turn in renderer axes: the position as stored, the forward unpacked and squared with the up
 * as re3's RestoreCar does (right = forward × up, up = right × forward). */
export function storedPlacement(stored:StoredCar){
 const [px,py,pz]=stored.position,f=new Vector3(stored.forward[0],stored.forward[2],-stored.forward[1]).normalize();
 const right=new Vector3().crossVectors(f,new Vector3(0,1,0));if(right.lengthSq()<1e-6)right.set(1,0,0);right.normalize();
 const up=new Vector3().crossVectors(right,f).normalize(),q=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,f.clone().negate()));
 return {position:{x:px,y:pz,z:-py},rotation:{x:q.x,y:q.y,z:q.z,w:q.w}};
}
/** The rest of RestoreCar on the made vehicle: its proofs (when any is stored), its nitro with the boosts and its
 * bomb. */
export function restoreStoredParts(v:{proofs?:PhysicalProofs;bombOnBoard?:number;car:object},stored:StoredCar){
 const flag=(bit:number)=>(stored.flags&bit)!==0,automobile='bombOnBoard' in v;
 if(stored.flags&31&&automobile)v.proofs={bullet:flag(STORED_CAR.bulletProof),fire:flag(STORED_CAR.fireProof),explosion:flag(STORED_CAR.explosionProof),collision:flag(STORED_CAR.collisionProof),melee:flag(STORED_CAR.meleeProof)};
 const car=v.car as {nitrousControl?:(boost:number,timeStep:number,gas:number,pad:undefined,physics:boolean)=>void};
 if(flag(STORED_CAR.nitro)&&stored.nitroBoosts>0&&car.nitrousControl)car.nitrousControl(stored.nitroBoosts,0,0,undefined,false);
 if(stored.bomb&&automobile)v.bombOnBoard=stored.bomb;
}
