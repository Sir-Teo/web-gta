import {requireAsset} from '../assets/binary';
/** eWeaponType order from CWeaponInfo::FindWeaponType (index is the native type ID). */
export const WEAPON_TYPE_NAMES=['UNARMED','BRASSKNUCKLE','GOLFCLUB','NIGHTSTICK','KNIFE','BASEBALLBAT','SHOVEL','POOLCUE','KATANA','CHAINSAW','DILDO1','DILDO2','VIBE1','VIBE2','FLOWERS','CANE','GRENADE','TEARGAS','MOLOTOV','ROCKET','ROCKET_HS','FREEFALL_BOMB','PISTOL','PISTOL_SILENCED','DESERT_EAGLE','SHOTGUN','SAWNOFF','SPAS12','MICRO_UZI','MP5','AK47','M4','TEC9','COUNTRYRIFLE','SNIPERRIFLE','RLAUNCHER','RLAUNCHER_HS','FTHROWER','MINIGUN','SATCHEL_CHARGE','DETONATOR','SPRAYCAN','EXTINGUISHER','CAMERA','NIGHTVISION','INFRARED','PARACHUTE','','ARMOUR'] as const;
export type WeaponFire='melee'|'instant'|'projectile'|'area'|'camera'|'use';
/** CWeaponInfo::flags bit layout. */
export const WEAPON_FLAG={canAim:0x1,aimWithArm:0x2,firstPerson:0x4,onlyFreeAim:0x8,moveAim:0x10,moveFire:0x20,throw:0x100,heavy:0x200,continuousFire:0x400,twinPistol:0x800,reload:0x1000,crouchFire:0x2000,reload2Start:0x4000,longReload:0x8000,slowdown:0x10000,randSpeed:0x20000,expands:0x40000} as const;
export type WeaponSkill=0|1|2|3;
export const WEAPON_SKILL={poor:0,std:1,pro:2,cop:3} as const;
export interface NativeAnimLoop {start:number;end:number;fire:number}
export interface NativeWeaponInfo {
 type:number;name:string;fire:WeaponFire;targetRange:number;weaponRange:number;models:[number,number];slot:number;flags:number;skill:WeaponSkill;
 animGroup?:string;clip:number;damage:number;fireOffset:[number,number,number];requiredStat:number;accuracy:number;moveSpeed:number;
 loop:NativeAnimLoop;loop2:NativeAnimLoop;breakout:number;speed:number;radius:number;lifespan:number;spread:number;
 baseCombo?:string;combos?:number;
}
export interface NativeAimOffset {group:string;aimX:number;aimZ:number;duckX:number;duckZ:number;reloadA:number;reloadB:number;crouchReloadA:number;crouchReloadB:number}
export interface NativeWeaponData {readonly infos:ReadonlyMap<string,NativeWeaponInfo>;readonly aim:ReadonlyMap<string,NativeAimOffset>}
const FIRE:Record<string,WeaponFire>={MELEE:'melee',INSTANT_HIT:'instant',PROJECTILE:'projectile',AREA_EFFECT:'area',CAMERA:'camera',USE:'use'};
/** FIRST_WEAPON_WITH_SKILLS..LAST_WEAPON_WITH_SKILLS */
export const weaponHasSkills=(type:number)=>type>=22&&type<=32;
const key=(type:number,skill:WeaponSkill)=>`${type}:${skill}`;
const f32=Math.fround;
/** SetAnimLoopInfos: frames at 30 Hz; the end is quantized to 50 Hz steps minus 0.006 s. */
export function nativeAnimLoop(start:number,end:number,fire:number):NativeAnimLoop{
 requireAsset([start,end,fire].every(Number.isInteger)&&start<=end,'Invalid weapon animation loop.');
 const s=f32(start/30),e=f32(end/30);
 return {start:s,end:f32(s+f32(Math.floor(f32(.1+f32(e-s)*50))/50)-.006),fire:f32(fire/30)};
}
const decimal=(token:string|undefined,label:string)=>{requireAsset(token!==undefined&&/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(token),label);return Number(token);};
const integer=(token:string|undefined,label:string)=>{requireAsset(token!==undefined&&/^[+-]?\d+$/.test(token),label);return Number(token);};
/** CWeaponInfo::LoadWeaponData for `$` guns, `%` aim offsets and the pound-sign melee rows. */
export function readWeaponData(text:string):NativeWeaponData{
 requireAsset(text.length<=1024*1024&&!text.includes('\0'),'Invalid weapon data resource.');
 const infos=new Map<string,NativeWeaponInfo>(),aim=new Map<string,NativeAimOffset>();
 for(const [index,raw] of text.split(/\r?\n/).entries()){
  const line=raw.trim(),label=`Weapon data line ${index+1}`;
  if(line.includes('ENDWEAPONDATA'))break;
  const marker=line[0];if(marker!=='$'&&marker!=='%'&&marker!=='£')continue;
  const t=line.slice(1).trim().split(/\s+/);
  if(marker==='%'){
   requireAsset(t.length>=9,`${label}: expected nine aim offset fields.`);
   const [group,...values]=t,n=values.slice(0,8).map((v,i)=>i<4?decimal(v,label):integer(v,label));
   aim.set(group.toLowerCase(),{group:group.toLowerCase(),aimX:f32(n[0]),aimZ:f32(n[1]),duckX:f32(n[2]),duckZ:f32(n[3]),reloadA:n[4],reloadB:n[5],crouchReloadA:n[6],crouchReloadB:n[7]});continue;
  }
  const type=WEAPON_TYPE_NAMES.indexOf(t[0]?.toUpperCase() as typeof WEAPON_TYPE_NAMES[number]);
  requireAsset(type>=0&&t[0]!=='',`${label}: unknown weapon type ${t[0]}.`);
  const fire=FIRE[t[1]]??'instant';
  if(marker==='£'){
   requireAsset(t.length===11,`${label}: expected eleven melee fields.`);
   infos.set(key(type,1),{type,name:t[0],fire,targetRange:f32(decimal(t[2],label)),weaponRange:f32(decimal(t[3],label)),models:[integer(t[4],label),integer(t[5],label)],slot:integer(t[6],label),baseCombo:t[7],combos:integer(t[8],label),flags:parseInt(t[9],16),animGroup:t[10].startsWith('null')?undefined:t[10].toLowerCase(),skill:1,clip:0,damage:0,fireOffset:[0,0,0],requiredStat:0,accuracy:1,moveSpeed:1,loop:{start:0,end:0,fire:0},loop2:{start:0,end:0,fire:0},breakout:0,speed:0,radius:0,lifespan:0,spread:0});
   continue;
  }
  requireAsset(t.length>=25&&t.length<=29,`${label}: expected 25 to 29 gun fields.`);
  requireAsset(/^[0-9a-f]+$/i.test(t[24]),`${label}: invalid hexadecimal flags.`);
  const skill=(weaponHasSkills(type)?integer(t[13],label):1) as WeaponSkill;requireAsset(skill>=0&&skill<=3,`${label}: invalid weapon skill.`);
  const optional=(i:number)=>t[i]===undefined?0:f32(decimal(t[i],label));
  infos.set(key(type,skill),{type,name:t[0],fire,targetRange:f32(decimal(t[2],label)),weaponRange:f32(decimal(t[3],label)),models:[integer(t[4],label),integer(t[5],label)],slot:integer(t[6],label),
   animGroup:t[7].startsWith('null')?undefined:t[7].toLowerCase(),clip:integer(t[8],label),damage:integer(t[9],label),fireOffset:[f32(decimal(t[10],label)),f32(decimal(t[11],label)),f32(decimal(t[12],label))],
   skill,requiredStat:integer(t[14],label),accuracy:f32(decimal(t[15],label)),moveSpeed:f32(decimal(t[16],label)),
   loop:nativeAnimLoop(integer(t[17],label),integer(t[18],label),integer(t[19],label)),loop2:nativeAnimLoop(integer(t[20],label),integer(t[21],label),integer(t[22],label)),
   breakout:f32(integer(t[23],label)/30),flags:parseInt(t[24],16),speed:optional(25),radius:optional(26),lifespan:optional(27),spread:optional(28)});
 }
 requireAsset(infos.size>0,'Weapon data contains no weapons.');
 return {infos,aim};
}
export function nativeWeaponInfo(data:NativeWeaponData,type:number,skill:WeaponSkill=1){return data.infos.get(key(type,weaponHasSkills(type)?skill:1));}
/** CPed::GetWeaponSkill for the player: PRO at its stat, POOR at or below the POOR stat, otherwise STD. */
export function playerWeaponSkill(data:NativeWeaponData,type:number,stat:number):WeaponSkill{
 if(!weaponHasSkills(type))return 1;
 const pro=nativeWeaponInfo(data,type,2),poor=nativeWeaponInfo(data,type,0);
 if(pro&&stat>=pro.requiredStat)return 2;
 if(poor&&stat<=poor.requiredStat)return 0;
 return 1;
}
export const hasWeaponFlag=(info:Pick<NativeWeaponInfo,'flags'>,flag:number)=>(info.flags&flag)!==0;
/** CWeaponInfo::GetWeaponReloadTime in milliseconds. */
export function nativeWeaponReloadMs(data:NativeWeaponData,info:NativeWeaponInfo){
 if(hasWeaponFlag(info,WEAPON_FLAG.reload))return hasWeaponFlag(info,WEAPON_FLAG.twinPistol)?2000:1000;
 if(hasWeaponFlag(info,WEAPON_FLAG.longReload))return 1000;
 const ao=nativeAimOffset(data,info);
 return Math.max(400,Math.max(ao?.reloadA??0,ao?.reloadB??0,ao?.crouchReloadA??0,ao?.crouchReloadB??0)+100);
}
/** m_nAimOffsetIndex is set for anim groups python..spraycan. */
export function nativeAimOffset(data:NativeWeaponData,info:NativeWeaponInfo){return info.animGroup?data.aim.get(info.animGroup):undefined;}
/** CWeapon::Fire delayNextShot: on-foot instant-hit guns rely on the use-gun animation loop. */
export function nativeShotDelayMs(info:NativeWeaponInfo,onFoot=true){
 if(info.type===43)return 1100;
 const instantLoop=[22,23,24,28,29,30,31,32,33,38].includes(info.type);
 return instantLoop&&onFoot?0:Math.trunc(f32(info.loop.end-info.loop.start)*900);
}
/** CPlayerPed::GetWeaponRadiusOnScreen. */
export function nativeWeaponRadiusOnScreen(info:NativeWeaponInfo,attackButtonCounter=0,ducking=false){
 if(info.fire==='melee')return 0;
 const accuracy=f32(.5/info.accuracy);
 if(info.type===25||info.type===26||info.type===27)return Math.max(.2,accuracy);
 const radius=f32((attackButtonCounter*.5+1)*Math.min(1,15/info.weaponRange)*accuracy);
 return ducking?Math.max(.2,radius/2):Math.max(.2,radius);
}
/** CWeaponInfo::GetTargetHeadRange. */
export const nativeTargetHeadRange=(info:NativeWeaponInfo)=>(info.skill+2)*info.weaponRange/25;
/** ms_aAnimAssocDefinitions weapon groups: IFP file and fire/crouch-fire/reload/crouch-reload names. */
export const WEAPON_ANIM_GROUPS:Readonly<Record<string,{file:string;fire:string;crouchFire:string;reload?:string;crouchReload?:string}>>={
 python:{file:'python',fire:'python_fire',crouchFire:'python_crouchfire',reload:'python_reload',crouchReload:'python_crouchreload'},
 pythonbad:{file:'python',fire:'python_fire_poor',crouchFire:'python_crouchfire',reload:'python_reload',crouchReload:'python_crouchreload'},
 colt45:{file:'colt45',fire:'colt45_fire',crouchFire:'colt45_crouchfire',reload:'colt45_reload',crouchReload:'colt45_crouchreload'},
 colt_cop:{file:'colt45',fire:'colt45_fire_2hands',crouchFire:'colt45_crouchfire',reload:'colt45_reload',crouchReload:'colt45_crouchreload'},
 colt45pro:{file:'colt45',fire:'colt45_fire',crouchFire:'2guns_crouchfire',reload:'colt45_reload',crouchReload:'colt45_crouchreload'},
 sawnoff:{file:'colt45',fire:'colt45_fire',crouchFire:'colt45_crouchfire',reload:'sawnoff_reload',crouchReload:'colt45_crouchreload'},
 sawnoffpro:{file:'colt45',fire:'colt45_fire',crouchFire:'2guns_crouchfire',reload:'sawnoff_reload',crouchReload:'colt45_crouchreload'},
 silenced:{file:'silenced',fire:'silence_fire',crouchFire:'silencecrouchfire',reload:'silence_reload',crouchReload:'crouchreload'},
 shotgun:{file:'shotgun',fire:'shotgun_fire',crouchFire:'shotgun_crouchfire'},
 shotgunbad:{file:'shotgun',fire:'shotgun_fire_poor',crouchFire:'shotgun_crouchfire'},
 buddy:{file:'buddy',fire:'buddy_fire',crouchFire:'buddy_crouchfire',reload:'buddy_reload',crouchReload:'buddy_crouchreload'},
 buddybad:{file:'buddy',fire:'buddy_fire_poor',crouchFire:'buddy_crouchfire',reload:'buddy_reload',crouchReload:'buddy_crouchreload'},
 uzi:{file:'uzi',fire:'uzi_fire',crouchFire:'uzi_crouchfire',reload:'uzi_reload',crouchReload:'uzi_crouchreload'},
 uzibad:{file:'uzi',fire:'uzi_fire_poor',crouchFire:'uzi_crouchfire',reload:'uzi_reload',crouchReload:'uzi_crouchreload'},
 rifle:{file:'rifle',fire:'rifle_fire',crouchFire:'rifle_crouchfire',reload:'rifle_load',crouchReload:'rifle_crouchload'},
 riflebad:{file:'rifle',fire:'rifle_fire_poor',crouchFire:'rifle_crouchfire',reload:'rifle_load',crouchReload:'rifle_crouchload'},
 sniper:{file:'rifle',fire:'rifle_fire',crouchFire:'rifle_crouchfire',reload:'rifle_load',crouchReload:'rifle_crouchload'},
 flame:{file:'flame',fire:'flame_fire',crouchFire:'flame_fire'},
 rocket:{file:'rocket',fire:'rocketfire',crouchFire:'rocketfire'},
 spraycan:{file:'spraycan',fire:'spraycan_fire',crouchFire:'spraycan_fire'},
};
