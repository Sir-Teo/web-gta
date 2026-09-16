import {AdditiveBlending,Quaternion,Sprite,SpriteMaterial,Vector3,type Scene} from 'three';
import {NATIVE_SIREN_MODELS} from '../audio/native/nativeHornInput';
import type {WorldCar} from '../simulation/WorldCar';
/** Authored siren-light approximation (CAutomobile::PreRender is not reversed):
 * alternating red/blue roof sprites on siren models while their siren runs. */
export const SIREN_HALF_PERIOD_MS=280;
export function sirenPhase(timeMs:number){return Math.floor(timeMs/SIREN_HALF_PERIOD_MS)%2===0?'left' as const:'right' as const;}
interface Pair {left:Sprite;right:Sprite}
/** Alternating lightbar sprites for police, emergency and siren vehicles. */
export class SirenLights {
 private pairs=new Map<number,Pair>();
 private disposed=false;
 constructor(private scene:Scene){}
 private make(color:number){
  const sprite=new Sprite(new SpriteMaterial({color,blending:AdditiveBlending,depthWrite:false,transparent:true,opacity:.9}));
  sprite.scale.set(1.1,.75,1);sprite.visible=false;this.scene.add(sprite);return sprite;
 }
 /** Roof-side anchor in browser coordinates from the body pose and COL bounds. */
 static anchor(car:WorldCar,side:-1|1){
  const p=car.car.body.translation(),q=car.car.body.rotation();
  const right=new Vector3(1,0,0).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w));
  const roof=car.assets.collision?.bounds.max[2]??2;
  return {x:p.x+right.x*side*.55,y:p.y+roof+.15,z:p.z+right.z*side*.55};
 }
 update(cars:Iterable<WorldCar>,timeMs:number){
  if(this.disposed)return;
  const phase=sirenPhase(timeMs),live=new Set<number>();
  for(const car of cars){
   if(car.wrecked||!NATIVE_SIREN_MODELS.has(car.modelId)||!car.siren)continue;
   const handle=car.car.body.handle;live.add(handle);
   let pair=this.pairs.get(handle);
   if(!pair){pair={left:this.make(0xff2222),right:this.make(0x2255ff)};this.pairs.set(handle,pair);}
   for(const [sprite,side,on] of [[pair.left,-1,phase==='left'],[pair.right,1,phase==='right']] as const){
    const at=SirenLights.anchor(car,side);
    sprite.position.set(at.x,at.y,at.z);sprite.visible=true;
    (sprite.material as SpriteMaterial).opacity=on?.95:.08;
   }
  }
  for(const [handle,pair] of this.pairs)if(!live.has(handle)){this.scene.remove(pair.left,pair.right);(pair.left.material as SpriteMaterial).dispose();(pair.right.material as SpriteMaterial).dispose();this.pairs.delete(handle);}
 }
 snapshot(){return {cars:this.pairs.size};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const pair of this.pairs.values()){this.scene.remove(pair.left,pair.right);(pair.left.material as SpriteMaterial).dispose();(pair.right.material as SpriteMaterial).dispose();}this.pairs.clear();}
}
