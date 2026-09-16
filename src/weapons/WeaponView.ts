import {BufferAttribute,BufferGeometry,Group,LineBasicMaterial,LineSegments,Matrix4,Mesh,MeshBasicMaterial,SphereGeometry,Vector3} from 'three';
import type {Scene} from 'three';
import {bindAnimation} from '../animation/bind';
import {modelObject} from '../assets/ModelObjects';
import {openWeaponAssets,type WeaponAssets} from './assets';
import {weaponById} from './catalog';
import {WEAPON_ANIM_GROUPS,WEAPON_FLAG,hasWeaponFlag} from './weaponData';
import type {NativeCharacter} from '../render/NativeCharacter';
import type {WeaponSystem} from './WeaponSystem';
/** Guns whose poses come from native animation association groups. */
const groupedKind=(kind:string)=>['bullet','shotgun','flame','spray','extinguisher','rocket','guided'].includes(kind);
const upperBodyKind=(kind:string)=>['bullet','shotgun','flame','spray','extinguisher'].includes(kind);
/** RenderWeaponPedsForPC left gun: left-hand matrix, 180 degrees about X, then (0.04,-0.05,0). */
interface WornGoggles {id:number;owner:NativeCharacter;object?:ReturnType<typeof modelObject>}
const LEFT_WEAPON=new Matrix4().makeRotationX(Math.PI).multiply(new Matrix4().makeTranslation(.04,-.05,0));
export class WeaponView {
 private catalog:ReturnType<typeof openWeaponAssets>;
 private held?:ReturnType<typeof modelObject>;
 private leftHeld?:ReturnType<typeof modelObject>;
 private projectileLoads=new Set<number>();
 private assets=new Map<string,WeaponAssets>();
 private projectileViews=new Map<number,ReturnType<typeof modelObject>>();
 private serial=0;private disposed=false;private selected=-1;private group?:string;private twin=false;
 error?:string;
 icon?:string;
 private owner?:NativeCharacter;
 private effects=new Group();
 private sphere=new SphereGeometry(1,8,6);
 private effectMaterial=new MeshBasicMaterial({color:0xffae3e,transparent:true,opacity:.45,depthWrite:false});
 private particleViews:Mesh[]=[];
 private lines=new LineSegments(new BufferGeometry(),new LineBasicMaterial({color:0xffe8a0,transparent:true,opacity:.9}));
 private positions=new Float32Array(128*6);
 visible=()=>true;
 aimDirection?:()=>Vector3;
 private canopyPlayerClip?:import('../assets/ifp').NativeAnimation;
 private canopyBinding?:ReturnType<typeof bindAnimation>;
 private canopy?:ReturnType<typeof modelObject>;
 private goggles?:WornGoggles;
 /** CPed render: worn goggles use the BONE_HEAD matrix with a (0, 0.084, 0) head-space offset. */
 private updateGoggles(owner:NativeCharacter|undefined){
  const id=this.weapons.vision==='nightvision'?44:this.weapons.vision==='infrared'?45:undefined;
  if(this.goggles&&(this.goggles.id!==id||this.goggles.owner!==owner)){this.goggles.object?.dispose();this.goggles=undefined;}
  if(id===undefined||!owner||this.goggles)return;
  const goggles:WornGoggles={id,owner};this.goggles=goggles;
  const attach=(a:WeaponAssets)=>{if(this.goggles!==goggles||!a.asset||this.disposed)return;const head=owner.hand(5);if(!head)return;const object=modelObject(a.asset.model,a.asset.textures);object.root.traverse(o=>{const index=o.userData.nativeFrame;if(index!==undefined&&a.asset!.model.frames[index].parent<0){o.matrix.identity();o.matrixWorldNeedsUpdate=true;}delete o.userData.nativeFrame;});object.root.rotation.set(0,0,0);object.root.position.set(0,.084,0);head.add(object.root);goggles.object=object;};
  const cached=this.assets.get(this.key(id));if(cached)attach(cached);else void this.catalog.then(c=>c.load(id)).then(a=>{this.assets.set(this.key(id),a);attach(a);}).catch(e=>{if(!this.disposed)this.error=String(e);});
 }
 constructor(private scene:Scene,private character:()=>NativeCharacter|undefined,base:string,private weapons:WeaponSystem){
  this.catalog=openWeaponAssets(base);void this.catalog.catch(e=>{this.error=String(e);});
  // update() re-equips when the native skill group differs from the loaded pose.
  void this.catalog.then(c=>c.weaponData()).then(data=>{if(!this.disposed)weapons.installNative(data);}).catch(e=>{if(!this.disposed)this.error=String(e);});
  this.lines.geometry.setAttribute('position',new BufferAttribute(this.positions,3));this.lines.frustumCulled=false;scene.add(this.effects,this.lines);
  weapons.onUse=w=>{const a=this.current(),crouch=this.weapons.sim.player.crouched&&!!a?.crouchClip,name=(crouch?a!.crouchClip!:a?.clip)?.name.toLowerCase()??w.clip?.toLowerCase()??'';this.character()?.playReaction(name,Math.max(.3,Math.min(this.weapons.inventory.interval,.7)),true);};
  weapons.inventory.reloadClipSeconds=(id,crouched)=>{const a=this.current();if(!a||this.selected!==id)return undefined;return (crouched?a.crouchReloadClip??a.reloadClip:a.reloadClip)?.duration;};
 }
 private key(id:number,group?:string){return `${id}/${group??''}`;}
 private current(){return this.assets.get(this.key(this.selected,this.group));}
 async equip(id:number){
  const generation=++this.serial,w=weaponById(id)!,info=this.weapons.inventory.info(id),group=info?.animGroup&&groupedKind(w.kind)&&WEAPON_ANIM_GROUPS[info.animGroup]?info.animGroup:undefined,twin=!!info&&hasWeaponFlag(info,WEAPON_FLAG.twinPistol);
  this.weapons.ready=false;this.selected=id;this.group=group;this.twin=twin;this.icon=undefined;this.error=undefined;this.owner=this.character();this.held?.dispose();this.held=undefined;this.leftHeld?.root.userData.pivot?.removeFromParent();this.leftHeld?.dispose();this.leftHeld=undefined;this.character()?.setWeaponPose();this.character()?.setWeaponAim();this.character()?.setWeaponReload();
  try{
   const key=this.key(id,group);let assets=this.assets.get(key);if(!assets){assets=await (await this.catalog).load(id,group);this.assets.set(key,assets);while(this.assets.size>8)this.assets.delete(this.assets.keys().next().value!);}
   if(this.disposed||generation!==this.serial)return;
   if(assets.icon){const c=document.createElement('canvas');c.width=assets.icon.width;c.height=assets.icon.height;c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(assets.icon.data),c.width,c.height),0,0);this.icon=c.toDataURL();}
   this.owner=this.character();if(!this.owner){this.weapons.ready=true;return;}
   const upper=upperBodyKind(w.kind);
   for(const clip of [assets.clip,assets.crouchClip])if(clip)this.owner.installReactions({[clip.name.toLowerCase()]:clip},upper);
   for(const clip of [assets.reloadClip,assets.crouchReloadClip])if(clip)this.owner.installReactions({[clip.name.toLowerCase()]:clip},true);
   const hand=this.owner.hand();
   const attach=(held:ReturnType<typeof modelObject>)=>{held.root.rotation.set(0,0,0);held.root.traverse(o=>{const index=o.userData.nativeFrame;if(index!==undefined&&assets!.asset!.model.frames[index].parent<0){o.matrix.identity();o.matrixWorldNeedsUpdate=true;}delete o.userData.nativeFrame;});};
   if(assets.asset){
    this.held=modelObject(assets.asset.model,assets.asset.textures);attach(this.held);if(!hand)throw new Error('Character has no right-hand weapon attachment.');hand.add(this.held.root);
    if(twin){const left=this.owner.hand(34);if(!left)throw new Error('Character has no left-hand weapon attachment.');this.leftHeld=modelObject(assets.asset.model,assets.asset.textures);attach(this.leftHeld);const pivot=new Group();pivot.matrixAutoUpdate=false;pivot.matrix.copy(LEFT_WEAPON);pivot.add(this.leftHeld.root);left.add(pivot);this.leftHeld.root.userData.pivot=pivot;}
   }
   if(id===46&&!this.canopy){const asset=await (await this.catalog).canopy();if(this.disposed||generation!==this.serial)return;this.canopy=modelObject(asset.model,asset.textures);this.canopyBinding=bindAnimation(asset.model,this.canopy.root,asset.clip);this.canopyBinding.sample(0);this.canopyPlayerClip=asset.playerClip;this.scene.add(this.canopy.root);this.canopy.root.visible=false;}
   if(this.canopyPlayerClip)this.owner?.installReactions({para_float:this.canopyPlayerClip});
   this.error=undefined;this.weapons.ready=true;
  }catch(e){if(generation===this.serial&&!this.disposed){this.error=String(e);this.weapons.ready=false;}}
 }
 muzzle(left=false){let muzzle:import('three').Object3D|undefined;(left&&this.leftHeld?this.leftHeld:this.held)?.root.traverse(o=>{if(o.name.toLowerCase()==='gunflash')muzzle=o;});return muzzle?.getWorldPosition(new Vector3());}
 update(){
  const owner=this.character(),inventory=this.weapons.inventory;if(owner&&owner!==this.owner)void this.equip(inventory.selected);
  // Skill changes swap the native association group (for example colt45 to colt45pro twin pistols).
  const info=inventory.info(),w=inventory.weapon,group=info?.animGroup&&groupedKind(w.kind)&&WEAPON_ANIM_GROUPS[info.animGroup]?info.animGroup:undefined;
  if(owner&&inventory.selected===this.selected&&this.weapons.ready&&(group!==this.group||!!info&&hasWeaponFlag(info,WEAPON_FLAG.twinPistol)!==this.twin))void this.equip(inventory.selected);
  const a=this.current(),crouched=this.weapons.sim.player.crouched,reloading=inventory.reloading;
  const reloadClip=a&&(crouched&&a.crouchReloadClip&&info&&hasWeaponFlag(info,WEAPON_FLAG.crouchFire)?a.crouchReloadClip:a.reloadClip);
  owner?.setWeaponReload(reloading&&reloadClip?reloadClip.name.toLowerCase():undefined,reloadClip?this.reloadProgress(reloadClip.duration):0);
  owner?.setWeaponAim(!reloading&&(this.weapons.aiming||inventory.cooldown>0)&&upperBodyKind(w.kind)?this.aimDirection?.():undefined,this.twin,!crouched&&!!info&&hasWeaponFlag(info,WEAPON_FLAG.aimWithArm));
  const pose=a&&(crouched&&a.crouchClip?a.crouchClip:a.clip);
  owner?.setWeaponPose(this.weapons.parachute?'para_float':this.weapons.stealthTarget()?'kill_partial':this.weapons.aiming?(pose?.name.toLowerCase()??w.clip?.toLowerCase()):undefined);
  const flash=inventory.cooldown>inventory.interval-.065;
  if(this.held)for(const b of this.held.materialBindings)if(b.source.texture.toLowerCase().startsWith('muzzle'))b.material.visible=flash&&this.weapons.lastHand==='right';
  if(this.leftHeld)for(const b of this.leftHeld.materialBindings)if(b.source.texture.toLowerCase().startsWith('muzzle'))b.material.visible=flash&&this.weapons.lastHand==='left';
  // PutOnGoggles sets m_DontPlaceInHand while the goggles are worn.
  if(this.held)this.held.root.visible=this.visible()&&w.kind!=='parachute'&&!((w.kind==='nightvision'||w.kind==='infrared')&&this.weapons.vision);
  this.updateGoggles(owner);if(this.goggles?.object)this.goggles.object.root.visible=this.visible();
  if(this.leftHeld)this.leftHeld.root.visible=this.visible();
  const active=new Set(this.weapons.projectiles.map(p=>p.id));for(const [id,view] of this.projectileViews)if(!active.has(id)){view.dispose();this.projectileViews.delete(id);}
  for(const p of this.weapons.projectiles){let view=this.projectileViews.get(p.id);const loaded=[...this.assets.entries()].find(([k])=>k.startsWith(`${p.weapon}/`))?.[1],asset=loaded?.projectileAsset??loaded?.asset;if(!asset&&!this.projectileLoads.has(p.weapon)){this.projectileLoads.add(p.weapon);void this.catalog.then(c=>c.load(p.weapon)).then(a=>{if(!this.disposed)this.assets.set(this.key(p.weapon),a);}).catch(e=>{if(!this.disposed)this.error=String(e);});}if(!view&&asset){view=modelObject(asset.model,asset.textures);this.scene.add(view.root);this.projectileViews.set(p.id,view);}if(view){view.root.position.set(p.position.x,p.position.y,p.position.z);if(p.weapon===35||p.weapon===36)view.root.quaternion.setFromUnitVectors(new Vector3(0,1,0),new Vector3(p.velocity.x,p.velocity.y,p.velocity.z).normalize());}}
  let line=0,particle=0;for(const effect of this.weapons.effects){
   if(effect.kind==='tracer'){this.positions.set([effect.from.x,effect.from.y,effect.from.z,effect.to.x,effect.to.y,effect.to.z],line++*6);continue;}
   // Native FX systems draw impacts, explosions, fire and area weapons once effects.fxp has loaded.
   if(this.weapons.fx?.ready)continue;
   let mesh=this.particleViews[particle++];if(!mesh){mesh=new Mesh(this.sphere,this.effectMaterial.clone());this.particleViews.push(mesh);this.effects.add(mesh);}
   const material=mesh.material as MeshBasicMaterial;material.color.set(effect.kind==='extinguisher'?0xeeeeee:effect.kind==='gas'?0xa8ba89:effect.kind==='spray'?0x983dcc:0xff9f24);material.opacity=effect.kind==='explosion'?Math.min(.8,effect.life):.45;
   mesh.visible=true;mesh.position.set(effect.to.x,effect.to.y,effect.to.z);mesh.scale.setScalar(effect.kind==='explosion'?effect.radius*(1-effect.life/.9):effect.radius);
   if(['spray','extinguisher','flame'].includes(effect.kind)&&new Vector3().subVectors(effect.to,effect.from).length()>.1){mesh.position.lerp(new Vector3(effect.from.x,effect.from.y,effect.from.z),.5);mesh.lookAt(effect.to.x,effect.to.y,effect.to.z);mesh.scale.z=Math.hypot(effect.to.x-effect.from.x,effect.to.y-effect.from.y,effect.to.z-effect.from.z)/2;}
  }
  for(let i=particle;i<this.particleViews.length;i++)this.particleViews[i].visible=false;
  this.lines.geometry.setDrawRange(0,line*2);this.lines.geometry.attributes.position.needsUpdate=true;
  if(this.canopy&&owner){this.canopy.root.visible=this.weapons.parachute;if(this.weapons.parachute){this.canopy.root.position.copy(owner.root.position);this.canopy.root.rotation.y=owner.root.rotation.y;}}
 }
 /** Native reloads run the clip once (twice for twin pistols) across the reload timer. */
 private reloadProgress(clipSeconds:number){
  const inventory=this.weapons.inventory,total=inventory.reloadTotal,elapsed=total-inventory.reloading;if(!total)return 0;
  if(!inventory.native||!(clipSeconds>0))return 1-inventory.reloading/total;
  return elapsed<clipSeconds*(this.twin?2:1)?elapsed%clipSeconds/clipSeconds:1;
 }
 dispose(){this.disposed=true;this.serial++;this.goggles?.object?.dispose();this.goggles=undefined;this.held?.dispose();this.leftHeld?.root.userData.pivot?.removeFromParent();this.leftHeld?.dispose();this.canopy?.dispose();for(const v of this.projectileViews.values())v.dispose();for(const p of this.particleViews)(p.material as MeshBasicMaterial).dispose();this.effects.removeFromParent();this.lines.removeFromParent();this.lines.geometry.dispose();this.lines.material.dispose();this.sphere.dispose();this.effectMaterial.dispose();this.assets.clear();}
}
