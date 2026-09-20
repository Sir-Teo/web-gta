import {CHEATS} from '../simulation/nativeCheats';
import {WEAPONS,weaponById} from './catalog';
import {WEAPON_FLAG,hasWeaponFlag,nativeShotDelayMs,nativeWeaponInfo,nativeWeaponReloadMs,playerWeaponSkill,weaponHasSkills,type NativeWeaponData,type WeaponSkill} from './weaponData';
/** CWeaponInfo::GetSkillStatIndex: the micro SMG and Tec-9 share STAT_MACHINE_PISTOL_SKILL. */
export const skillStatWeapon=(id:number)=>id===32?28:id;
const reserveFor=(clip:number,reloadable:boolean)=>reloadable?Math.max(clip*8,24):0;
export class WeaponInventory {
 selected=0;reloading=0;shots=0;
 /** CWeapon::m_TimeForNextShotMs is per weapon, so a camera delay does not block the next item. */
 private cooldowns=new Map<number,number>();
 get cooldown(){return this.cooldowns.get(this.selected)??0;}
 set cooldown(seconds:number){if(seconds>0)this.cooldowns.set(this.selected,seconds);else this.cooldowns.delete(this.selected);}
 /** Native WEAPON.DAT rows; authored catalog tuning remains the fallback before it loads. */
 native?:NativeWeaponData;
 crouched=false;
 /** Reload clip length for the selected native animation group, when its IFP is loaded. */
 reloadClipSeconds?:(id:number,crouched:boolean)=>number|undefined;
 private duration=0;
 /** Player weapon skill stats (0-1000), keyed by skillStatWeapon. */
 readonly practice=new Map<number,number>();
 get proficiency(){return (this.practice.get(skillStatWeapon(this.selected))??0)/1000;}
 readonly ammo=new Map(WEAPONS.map(w=>[w.id,{clip:w.magazine,reserve:w.reload?w.magazine*8:0}]));
 get weapon(){return weaponById(this.selected)!;}
 installNative(data:NativeWeaponData){
  this.native=data;
  for(const w of WEAPONS){const a=this.ammo.get(w.id)!,clip=this.magazine(w.id);if(a.clip>clip||a.clip===w.magazine&&a.reserve===(w.reload?w.magazine*8:0)){a.reserve=reserveFor(clip,this.reloadable(w.id));a.clip=clip;}}
 }
 skill(id=this.selected):WeaponSkill{return this.native?playerWeaponSkill(this.native,id,this.practice.get(skillStatWeapon(id))??0):1;}
 info(id=this.selected){return this.native&&nativeWeaponInfo(this.native,id,this.skill(id));}
 magazine(id=this.selected){const w=weaponById(id)!,info=this.info(id);return info&&w.magazine?Math.max(1,info.clip):w.magazine;}
 /** Largest clip across skill levels, used to validate saved ammunition. */
 maxMagazine(id:number){const w=weaponById(id);if(!w)return 0;if(!this.native||!w.magazine)return w.magazine;return Math.max(w.magazine,...([0,1,2] as const).map(skill=>nativeWeaponInfo(this.native!,id,skill)?.clip??0));}
 private reloadable(id:number){const w=weaponById(id)!;return w.reload>0||!!this.native&&w.magazine>0&&!['nightvision','infrared','camera','parachute','detonator'].includes(w.kind);}
 get twin(){const info=this.info();return !!info&&hasWeaponFlag(info,WEAPON_FLAG.twinPistol);}
 /** Native fire interval: the use-gun animation loop, CWeapon::Fire shot delay and one 30 Hz frame. */
 get interval(){
  const w=this.weapon,info=this.info();if(!info||w.kind==='melee'||hasWeaponFlag(info,WEAPON_FLAG.throw)||info.fire==='use'||w.kind==='parachute')return w.interval;
  if(info.fire==='area')return 1/30;
  if(info.fire==='camera')return nativeShotDelayMs(info)/1000;
  return Math.max(info.loop.end-info.loop.start,nativeShotDelayMs(info)/1000,1/30);
 }
 get reloadDuration(){
  const info=this.info();if(!info)return this.weapon.reload*(1-this.proficiency*.2);
  let seconds=nativeWeaponReloadMs(this.native!,info)/1000;
  // CWeapon::Update keeps RELOAD-flag weapons reloading until the clip reaches 90%; twin pistols play it twice.
  const clip=hasWeaponFlag(info,WEAPON_FLAG.reload)?this.reloadClipSeconds?.(info.type,this.crouched&&hasWeaponFlag(info,WEAPON_FLAG.crouchFire)):undefined;
  if(clip)seconds=Math.max(seconds,hasWeaponFlag(info,WEAPON_FLAG.twinPistol)?clip*1.9:clip*.9);
  return seconds;
 }
 get reloadTotal(){return this.duration||this.reloadDuration;}
 /** CPed::GiveWeapon from a pickup: ammunition joins the weapon's total (an empty clip refills first) and an unarmed player switches to it. */
 give(id:number,ammo:number){
  const w=weaponById(id);if(!w)return false;const a=this.ammo.get(id)!,magazine=this.magazine(id);
  if(magazine){a.reserve=Math.min(99999,a.reserve+Math.max(0,Math.floor(ammo)));if(a.clip===0){const n=Math.min(magazine,a.reserve);a.clip=n;a.reserve-=n;}}
  if(this.selected===0&&id!==0)this.select(id);return true;
 }
 select(id:number){if(!weaponById(id))return false;this.selected=id;this.reloading=0;this.duration=0;return true;}
 /** Busted/Wasted: CPed::ClearWeapons removes everything but plain fists. */
 strip(){for(const w of WEAPONS){if(w.id===0)continue;this.ammo.set(w.id,{clip:0,reserve:0});}this.select(0);this.reloading=0;this.cooldowns.clear();}
 cycle(delta:number){const i=WEAPONS.findIndex(w=>w.id===this.selected);this.select(WEAPONS[(i+delta%WEAPONS.length+WEAPONS.length)%WEAPONS.length].id);}
 refill(){for(const w of WEAPONS){const clip=this.magazine(w.id);this.ammo.set(w.id,{clip,reserve:this.native?reserveFor(clip,this.reloadable(w.id)):w.reload?w.magazine*8:0});}this.reloading=0;}
 reload(){const a=this.ammo.get(this.selected)!;if(this.reloading||!this.reloadable(this.selected)||a.clip>=this.magazine()||a.reserve<=0)return false;this.duration=this.reloadDuration;this.reloading=this.duration;return true;}
 tick(dt:number){for(const [id,seconds] of this.cooldowns){if(seconds<=dt)this.cooldowns.delete(id);else this.cooldowns.set(id,seconds-dt);}if(this.reloading){this.reloading=Math.max(0,this.reloading-dt);if(!this.reloading){const a=this.ammo.get(this.selected)!,n=Math.min(this.magazine()-a.clip,a.reserve);a.clip+=n;a.reserve-=n;this.duration=0;}}}
 fire(){
  const w=this.weapon,a=this.ammo.get(w.id)!,magazine=this.magazine();if(this.cooldown>0||this.reloading)return false;
  // CWeapon::Fire: the infinite ammo cheat leaves the clip and total untouched.
  if(magazine&&a.clip<=0){this.reload();return false;}if(magazine&&!CHEATS.isActive('infiniteAmmo'))a.clip--;this.cooldown=this.interval;this.shots++;
  // CWeapon::Fire enters WEAPONSTATE_RELOADING as soon as the clip empties.
  if(this.native&&magazine&&a.clip===0&&a.reserve>0&&this.reloadable(w.id)){this.duration=Math.max(this.reloadDuration,this.cooldown);this.reloading=this.duration;}
  return true;
 }
 snapshot(){const info=this.info();return {id:this.selected,name:this.weapon.name,kind:this.weapon.kind,...this.ammo.get(this.selected)!,magazine:this.magazine(),cooldown:+this.cooldown.toFixed(3),practice:this.practice.get(skillStatWeapon(this.selected))??0,skill:this.native&&weaponHasSkills(this.selected)?(['poor','standard','hitman','cop'] as const)[this.skill()]:null,twin:this.twin,animGroup:info?info.animGroup??null:null,reloading:this.reloading,shots:this.shots};}
}
