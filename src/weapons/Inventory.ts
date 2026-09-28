import {fightingStyleCombo} from '../simulation/nativeMelee';
import {CHEATS} from '../simulation/nativeCheats';
import {WEAPONS,weaponById} from './catalog';
import {WEAPON_FLAG,hasWeaponFlag,nativeShotDelayMs,nativeWeaponInfo,nativeWeaponReloadMs,playerWeaponSkill,weaponHasSkills,type NativeWeaponData,type WeaponSkill} from './weaponData';
/** CWeaponInfo::GetSkillStatIndex: the micro SMG and Tec-9 share STAT_MACHINE_PISTOL_SKILL. */
export const skillStatWeapon=(id:number)=>id===32?28:id;
const reserveFor=(clip:number,reloadable:boolean)=>reloadable?Math.max(clip*8,24):0;
export class WeaponInventory {
 selected=0;reloading=0;shots=0;
 /** CPed::m_nFightingStyle and m_nAllowedAttackMoves for the player, which GIVE_MELEE_ATTACK_TO_CHAR sets at the gyms:
  * CPlayerPed starts on STYLE_GRAB_KICK (15) with every move (15). */
 fightingStyle=15;allowedAttackMoves=15;
 /** The melee.dat combo a weapon swings with: fists and brass knuckles take the fighting style's, anything else its
  * WEAPON.DAT base combo. */
 meleeCombo(id:number){const base=this.info(id)?.baseCombo;return id===0||id===1?(this.fightingStyle>=5&&this.fightingStyle<=7?fightingStyleCombo(this.fightingStyle):base):base;}
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
 /** CPlayerInfo::m_bFastReload (SET_PLAYER_FAST_RELOAD), which the host reads from the script's player info. */
 fastReload:()=>boolean=()=>false;
 /** CStats::GetPercentageProgress() reaching 100 (the host reads the stats). */
 fullCompletion:()=>boolean=()=>false;
 /** The inventory's own clock, for the reloads weapons carry while put away. */
 private clock=0;
 /** A reload left running when its weapon was put away: CWeapon keeps m_TimeForNextShotMs per slot, so switching
  * back finishes it once that time has passed. */
 private stashedReloads=new Map<number,{endAt:number;duration:number}>();
 /** Player weapon skill stats (0-1000), keyed by skillStatWeapon. */
 readonly practice=new Map<number,number>();
 get proficiency(){return (this.practice.get(skillStatWeapon(this.selected))??0)/1000;}
 readonly ammo=new Map(WEAPONS.map(w=>[w.id,{clip:w.magazine,reserve:w.reload?w.magazine*8:0}]));
 /** The weapons the player holds (CPed::m_aWeapons). Explore starts with the whole arsenal; Busted or Wasted leaves
  * fists, and CPed::GiveWeapon then fills the thirteen slots one weapon at a time. */
 readonly owned=new Set<number>(WEAPONS.map(w=>w.id));
 /** CWeaponInfo::m_nSlot, once WEAPON.DAT has loaded. */
 slotOf(id:number){return this.info(id)?.slot;}
 /** CPed::GetWeaponInSlot: the weapon held in `slot` (fists count as none). */
 inSlot(slot:number|undefined){if(slot===undefined)return undefined;for(const id of this.owned)if(id!==0&&this.slotOf(id)===slot)return id;return undefined;}
 get weapon(){return weaponById(this.selected)!;}
 installNative(data:NativeWeaponData){
  this.native=data;
  for(const w of WEAPONS){const a=this.ammo.get(w.id)!,clip=this.magazine(w.id);if(a.clip>clip||a.clip===w.magazine&&a.reserve===(w.reload?w.magazine*8:0)){a.reserve=reserveFor(clip,this.reloadable(w.id));a.clip=clip;}}
  if(this.deferredAmmo){const rows=this.deferredAmmo;this.deferredAmmo=undefined;this.applyAmmo(rows);}
 }
 /** Saved clips larger than the base magazine (a pistol's at hitman skill) waiting for WEAPON.DAT's clip sizes. */
 private deferredAmmo?:(readonly [number,number,number])[];
 /** A save's [weapon, clip, reserve] rows: what fits the magazines known now is applied at once, the rest once the
  * native weapon data has loaded and the saved skill decides the clip. */
 restoreAmmo(rows:readonly (readonly [number,number,number])[]){
  const later=this.native?[]:rows.filter(([id,clip])=>clip>this.maxMagazine(id));
  this.applyAmmo(rows.filter(row=>!later.includes(row)));
  this.deferredAmmo=later.length?[...later]:undefined;
 }
 private applyAmmo(rows:readonly (readonly [number,number,number])[]){
  for(const [id,clip,reserve] of rows){
   const a=this.ammo.get(id);if(!a||clip>this.maxMagazine(id))continue;
   // A clip above the magazine at the current skill keeps its rounds in reserve.
   a.clip=Math.min(clip,this.magazine(id));a.reserve=reserve+clip-a.clip;
  }
 }
 /** The ammunition to save: the rows still waiting for the native data are saved as they were read. */
 ammoRows(){
  const rows=new Map([...this.ammo].map(([id,a])=>[id,[id,a.clip,a.reserve] as [number,number,number]]));
  for(const row of this.deferredAmmo??[])rows.set(row[0],[...row]);
  return [...rows.values()];
 }
 skill(id=this.selected):WeaponSkill{return this.native?playerWeaponSkill(this.native,id,this.practice.get(skillStatWeapon(id))??0):1;}
 info(id=this.selected){return this.native&&nativeWeaponInfo(this.native,id,this.skill(id));}
 magazine(id=this.selected){const w=weaponById(id)!,info=this.info(id);return info&&w.magazine?Math.max(1,info.clip):w.magazine;}
 /** Largest clip across skill levels, used to validate saved ammunition. */
 maxMagazine(id:number){const w=weaponById(id);if(!w)return 0;if(!this.native||!w.magazine)return w.magazine;return Math.max(w.magazine,...([0,1,2] as const).map(skill=>nativeWeaponInfo(this.native!,id,skill)?.clip??0));}
 private reloadable(id:number){const w=weaponById(id)!;return w.reload>0||!!this.native&&w.magazine>0&&!['nightvision','infrared','parachute','detonator'].includes(w.kind);}
 get twin(){const info=this.info();return !!info&&hasWeaponFlag(info,WEAPON_FLAG.twinPistol);}
 /** Native fire interval: the use-gun animation loop, CWeapon::Fire shot delay and one 30 Hz frame. */
 get interval(){
  const w=this.weapon,info=this.info();if(!info||w.kind==='melee'||info.fire==='use'||w.kind==='parachute')return w.interval;
  // A thrown weapon's clip of one empties on every throw: GetWeaponReloadTime, max(400, its aim offsets + 100), which
  // are all zero, so 400 ms from the fire frame.
  if(hasWeaponFlag(info,WEAPON_FLAG.throw))return .4;
  if(info.fire==='area')return 1/30;
  if(info.fire==='camera')return nativeShotDelayMs(info)/1000;
  return Math.max(info.loop.end-info.loop.start,nativeShotDelayMs(info)/1000,1/30);
 }
 get reloadDuration(){
  const info=this.info();if(!info)return this.weapon.reload*(1-this.proficiency*.2);
  // CWeapon::Fire: the player's fast reload takes a quarter of the reload time, and CWeapon::Update then skips the
  // wait for the reload animation.
  if(this.fastReload())return nativeWeaponReloadMs(this.native!,info)/4000;
  let seconds=nativeWeaponReloadMs(this.native!,info)/1000;
  // CWeapon::Update keeps RELOAD-flag weapons reloading until the clip reaches 90%; twin pistols play it twice.
  const clip=hasWeaponFlag(info,WEAPON_FLAG.reload)?this.reloadClipSeconds?.(info.type,this.crouched&&hasWeaponFlag(info,WEAPON_FLAG.crouchFire)):undefined;
  if(clip)seconds=Math.max(seconds,hasWeaponFlag(info,WEAPON_FLAG.twinPistol)?clip*1.9:clip*.9);
  return seconds;
 }
 get reloadTotal(){return this.duration||this.reloadDuration;}
 /** CPed::GiveWeapon (0x5E6080). A weapon not held takes its slot: whatever else sat there is dropped, its total ammo
  * carried over for the shotgun, SMG and rifle slots, and CWeapon::Initialise loads the clip from the new total. The
  * weapon already held gains the ammo and CWeapon::Reload refills its clip at once (a gift has no ammo). An unarmed
  * player then switches to it. */
 give(id:number,ammo:number,equipWhenUnarmed=true){
  const w=weaponById(id);if(!w)return false;const a=this.ammo.get(id)!,magazine=this.magazine(id),slot=this.slotOf(id);
  let total=a.clip+a.reserve;
  if(!this.owned.has(id)){
   total=Math.max(0,Math.floor(ammo));
   if(slot!==undefined)for(const other of [...this.owned]){
    if(other===id||other===0||this.slotOf(other)!==slot)continue;
    const held=this.ammo.get(other)!;if(slot>=3&&slot<=5)total+=held.clip+held.reserve;
    this.owned.delete(other);this.ammo.set(other,{clip:0,reserve:0});this.stashedReloads.delete(other);
    if(this.selected===other)this.selected=id;
   }
   this.owned.add(id);
  }else if(slot===10)return true;
  else total+=Math.max(0,Math.floor(ammo));
  if(magazine){total=Math.min(99999,total);const clip=Math.min(magazine,total);a.clip=clip;a.reserve=total-clip;}
  // CPed::GiveWeapon reloads the weapon it gives and leaves it WEAPONSTATE_READY: a reload that was running (on it, or
  // on the weapon it replaced in the slot) is over.
  this.stashedReloads.delete(id);if(this.selected===id){this.reloading=0;this.duration=0;}
  // A pickup's GiveWeapon(bLikeUnused=true) takes the weapon up when unarmed; CPed::GiveWeapon itself never changes the
  // active slot (the weapon-set cheats leave the fists in hand).
  if(equipWhenUnarmed&&this.selected===0&&id!==0)this.select(id);return true;
 }
 select(id:number){
  if(!weaponById(id))return false;
  // Choosing a weapon (the arsenal, a cheat, the script) means holding it.
  this.owned.add(id);
  if(id===this.selected)return true;
  if(this.reloading)this.stashedReloads.set(this.selected,{endAt:this.clock+this.reloading,duration:this.duration});
  this.selected=id;this.reloading=0;this.duration=0;
  const stashed=this.stashedReloads.get(id);this.stashedReloads.delete(id);
  if(stashed){const left=stashed.endAt-this.clock;if(left>0){this.reloading=left;this.duration=stashed.duration;}else this.finishReload();}
  return true;
 }
 /** CPlayerPed::MakeChangesForNewWeapon, which the player's weapon switch goes through: the clip is loaded from the
  * total, m_AmmoInClip = min(m_TotalAmmo, clip size), so a part-used clip is full again once switched back to. */
 loadClipForNewWeapon(id=this.selected){
  const a=this.ammo.get(id),magazine=this.magazine(id);if(!a||!magazine)return;
  const total=a.clip+a.reserve,clip=Math.min(magazine,total);a.clip=clip;a.reserve=total-clip;
 }
 /** CWeapon::Reload: the clip fills from the total. */
 private finishReload(){const a=this.ammo.get(this.selected)!,n=Math.min(this.magazine()-a.clip,a.reserve);a.clip+=n;a.reserve-=n;this.duration=0;}
 /** CPed::ClearWeapon (0x5E62B0): the weapon goes only if its slot holds it, and a held one leaves the ped unarmed. */
 clearWeapon(id:number){
  if(id===0||!this.owned.has(id))return false;
  if(this.selected===id)this.select(0);
  this.owned.delete(id);this.ammo.set(id,{clip:0,reserve:0});this.stashedReloads.delete(id);return true;
 }
 /** CPed::SetAmmo (SET_CHAR_AMMO) on a weapon the player holds: the total becomes `total` (a clip's worth loaded, the
  * rest in reserve). Nothing for a weapon he does not have. */
 setTotalAmmo(id:number,total:number){
  if(!this.owned.has(id)||id===0)return false;
  const t=Math.max(0,Math.min(99999,Math.trunc(total))),clip=Math.min(this.magazine(id),t);
  this.ammo.set(id,{clip,reserve:t-clip});return true;
 }
 /** CPed::GrantAmmo (ADD_AMMO_TO_CHAR) on a weapon the player holds: the total goes up by `amount`. */
 grantAmmo(id:number,amount:number){
  // Only m_TotalAmmo grows (to 99999): the rounds go to the reserve and the clip is left as it is.
  const a=this.ammo.get(id);if(!a||!this.owned.has(id)||id===0)return false;
  if(!this.magazine(id))return this.setTotalAmmo(id,a.clip+a.reserve+amount);
  a.reserve=Math.max(0,Math.min(99999-a.clip,a.reserve+Math.trunc(amount)));return true;
 }
 /** Busted/Wasted: CPed::ClearWeapons removes everything but plain fists. */
 strip(){for(const w of WEAPONS){if(w.id===0)continue;this.ammo.set(w.id,{clip:0,reserve:0});}this.owned.clear();this.owned.add(0);this.select(0);this.reloading=0;this.cooldowns.clear();this.stashedReloads.clear();}
 /** Weapon cycling over the weapons held, in slot order (CPlayerPed::ProcessWeaponSwitch is unreversed; the slot
  * model is CPed's). */
 cycle(delta:number){
  // CPed keeps one CWeapon per slot: brass knuckles take slot 0 in place of bare fists (CPed::GiveWeapon initialises the
  // slot's weapon as the new type), so the fists are not a stop of their own while the knuckles are held.
  const fistSlot=this.slotOf(0),knuckles=[...this.owned].some(o=>o!==0&&this.slotOf(o)===fistSlot);
  const held=WEAPONS.filter(w=>this.owned.has(w.id)&&!(w.id===0&&knuckles)).map(w=>w.id).sort((a,b)=>(this.slotOf(a)??0)-(this.slotOf(b)??0)||a-b);
  if(!held.length)return;const i=held.indexOf(this.selected);
  this.select(held[((i<0?0:i)+delta%held.length+held.length)%held.length]);
 }
 refill(){for(const w of WEAPONS){this.owned.add(w.id);const clip=this.magazine(w.id);this.ammo.set(w.id,{clip,reserve:this.native?reserveFor(clip,this.reloadable(w.id)):w.reload?w.magazine*8:0});}this.reloading=0;this.stashedReloads.clear();}
 reload(){const a=this.ammo.get(this.selected)!;if(this.reloading||!this.reloadable(this.selected)||a.clip>=this.magazine()||a.reserve<=0)return false;this.duration=this.reloadDuration;this.reloading=this.duration;return true;}
 tick(dt:number){this.clock+=dt;for(const [id,seconds] of this.cooldowns){if(seconds<=dt)this.cooldowns.delete(id);else this.cooldowns.set(id,seconds-dt);}if(this.reloading){this.reloading=Math.max(0,this.reloading-dt);if(!this.reloading)this.finishReload();}}
 fire(){
  if(this.cooldown>0||this.reloading)return false;
  if(!this.spend())return false;
  // The fire anim's loop still gates the next FireGun, reloading or not.
  this.cooldown=this.interval;return true;
 }
 /** CTaskSimpleUseGun::SetPedPosition's second FireGun of a frame: twin pistols' left hand fires its own round straight
  * after the right one, with no shot delay between them. */
 fireAgain(){return !this.reloading&&this.twin&&this.spend();}
 /** CWeapon::Fire's ammunition: the round leaves the clip, an empty clip is filled from the total and fired on the same
  * press, and one emptied with rounds left enters WEAPONSTATE_RELOADING for exactly GetWeaponReloadTime. */
 private spend(){
  const w=this.weapon,a=this.ammo.get(w.id)!,magazine=this.magazine();
  // CWeapon::Fire: the infinite ammo cheat leaves the clip and total untouched.
  // CWeapon::Fire fills an empty clip from the total and fires on the same press.
  if(magazine&&a.clip<=0){if(a.reserve<=0)return false;const n=Math.min(magazine,a.reserve);a.clip=n;a.reserve-=n;}if(magazine&&!CHEATS.isActive('infiniteAmmo')){a.clip--;
   // The player's m_TotalAmmo falls only for the detonator or below 100% (CStats::GetPercentageProgress): at full
   // completion the clip still empties and reloads, but the total stays where it was. The camera is not counted as
   // the player firing (isPlayerFiring excludes WEAPON_CAMERA), so its film runs out as for anyone else.
   if(w.id!==40&&w.id!==43&&this.fullCompletion())a.reserve++;}this.shots++;
  // CWeapon::Fire enters WEAPONSTATE_RELOADING as soon as the clip empties.
  if(this.native&&magazine&&a.clip===0&&a.reserve>0&&this.reloadable(w.id)){this.duration=this.reloadDuration;this.reloading=this.duration;}
  return true;
 }
 snapshot(){const info=this.info();return {id:this.selected,name:this.weapon.name,kind:this.weapon.kind,...this.ammo.get(this.selected)!,magazine:this.magazine(),cooldown:+this.cooldown.toFixed(3),practice:this.practice.get(skillStatWeapon(this.selected))??0,skill:this.native&&weaponHasSkills(this.selected)?(['poor','standard','hitman','cop'] as const)[this.skill()]:null,twin:this.twin,animGroup:info?info.animGroup??null:null,reloading:this.reloading,shots:this.shots};}
}
