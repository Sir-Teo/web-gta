/** CKeyGen::GetKey: the CRC-32 table update without a final complement. */
const TABLE=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function nativeKey(text:string){let h=0xffffffff;for(let i=0;i<text.length;i++)h=(TABLE[(h^text.charCodeAt(i))&0xff]^(h>>>8))>>>0;return h;}
/** m_aCheatHashKeys by eCheats, from gta-reversed's cheat table. Its hash column slips a row at GangLandCheat and
 * again at MidnightCheat, whose hashes it lost, so every later hash sits one or two rows late; they are re-paired here
 * and each was checked by hashing the published PC code. Left out: the aggressive-drivers hash (lost), the two after
 * the monster truck (prostitutes pay, taxi nitro, pushed off the end), and cars on water and the unused Predator,
 * whose listed 0 would otherwise take the Rancher's JQNTDMH, which hashes to 0. */
export const CHEAT_HASHES={
 weaponSet1:0xde4b237d,weaponSet2:0xb22a28d1,weaponSet3:0x5a783fae,moneyArmourHealth:0xeeccea2b,wantedLevelUp:0x42af1e28,wantedLevelDown:0x555fc201,
 sunnyWeather:0x2a845345,extraSunnyWeather:0xe1ef01ea,cloudyWeather:0x771b83fc,rainyWeather:0x5bf12848,foggyWeather:0x44453a17,
 fasterClock:0xfcff1d08,fasterGameplay:0xb69e8532,slowerGameplay:0x8b828076,pedsAttackOther:0xdd6ed9e9,bounty:0xa290fd8c,everyoneArmed:0x3484b5a7,
 rhino:0x43db914e,bloodringBanger:0xdbc0dd65,rancher:0x00000000,hotringA:0xd08a30fe,hotringB:0x37bf1b4e,romero:0xb5d40866,stretch:0xe63b0d99,
 trashmaster:0x675b8945,caddy:0x4987d5ee,blowUpCars:0x2e8f84e8,invisibleCar:0x1a9aa3d6,perfectHandling:0xe842f3bc,suicide:0x0d5c6a4e,
 greenLights:0x74d4fcb1,pinkTraffic:0x66516ebc,blackTraffic:0x4b137e45,boatsFly:0x78520e33,
 fat:0x3a577325,muscle:0xd4966d59,skinny:0x5fd1b49d,elvis:0xa7613f99,villagePeople:0x1792d871,beachParty:0xcbc579df,gangMembers:0x4fedccff,
 gangLand:0x44b34866,ninja:0x2ef877db,loveConquersAll:0x2781e797,cheapTraffic:0x2bc1a045,fastTraffic:0xb2afe368,carsFly:0xfa8dd45b,
 hugeBunnyHop:0x8ded75bd,hydra:0x1a5526bc,vortex:0xa48a770b,smashNBoom:0xb07d3b32,allCarsNitro:0x80c1e54b,carsFloatAway:0x5dad0087,
 alwaysMidnight:0x7f80b950,orangeSky:0x6c0fa650,thunderstorm:0xf46f2fa4,sandstorm:0x70164385,megaJump:0x885d0b50,infiniteHealth:0x151bdcb3,
 infiniteOxygen:0xadfa640a,parachute:0xe57f96ce,jetpack:0x040cf761,neverWanted:0xe1b33eb9,sixStars:0xfeda77f7,megaPunch:0x8ca870dd,
 neverHungry:0x9a629401,riot:0xf53ef5a5,funhouse:0xf2aa0c1d,adrenaline:0xf36345a8,infiniteAmmo:0x8990d5e1,driveby:0xb7013b1b,
 reducedTraffic:0xcaec94ee,countryTraffic:0x31f0c3cc,recruitPistol:0xb3b3e72a,recruitAk:0xc25cdbff,rocketMayhem:0xd5cf4eff,
 maxRespect:0x680416b1,maxSexAppeal:0xcf5fda18,maxStamina:0xf01286e9,weaponSkills:0xa841cc0a,vehicleSkills:0x31ea09cf,hunter:0xe958788a,
 quad:0x02c83a7c,tanker:0xe49c3ed4,dozer:0x171ba8cc,stuntPlane:0x86988dae,monsterTruck:0x2bdd2fa1,
} as const;
export type CheatName=keyof typeof CHEAT_HASHES;
const NAMES=Object.keys(CHEAT_HASHES) as CheatName[];

/** CCheat: the typed-key string, AddToCheatString's matching and m_aCheatsActive. */
export class NativeCheats {
 private text='';
 readonly active=new Set<CheatName>();
 /** STAT_TIMES_CHEATED and m_bHasPlayerCheated. */
 timesCheated=0;hasCheated=false;
 /** Whether the cheat last matched was active before it applied: CHEAT8 ("deactivated") rather than CHEAT1. */
 wasActive=false;
 isActive(name:CheatName){return this.active.has(name);}
 toggle(name:CheatName){if(!this.active.delete(name))this.active.add(name);}
 enable(name:CheatName){this.active.add(name);}
 disable(name:CheatName){this.active.delete(name);}
 /** CCheat::AddToCheatString (0x438480): the newest key goes first; the latest 6 to 29 keys are hashed, and the last
  * table entry matching a hash wins. Returns the cheat to apply, clearing the string. */
 add(key:string):CheatName|undefined{
  this.text=(key+this.text).slice(0,29);
  if(this.text.length<6)return;
  for(let size=6;size<=this.text.length;size++){
   const hash=nativeKey(this.text.slice(0,size));
   let name:CheatName|undefined;for(const n of NAMES)if(CHEAT_HASHES[n]===hash)name=n;
   if(!name)continue;
   this.wasActive=this.isActive(name);this.timesCheated++;this.hasCheated=true;this.text='';
   return name;
  }
 }
 /** CCheat::ResetCheats (0x438450). */
 reset(){this.active.clear();this.text='';this.hasCheated=false;}
}
/** The game's single CCheat state, read where the original reads CCheat::IsActive. */
export const CHEATS=new NativeCheats();
/** CPedDamageResponseCalculator::ComputeWillKillPed and CEventDamage::ComputeDeathAnim: under CHEAT_MEGA_PUNCH a
 * blow from fists (0), brass knuckles (1) or the parachute (46) takes all the victim's health and throws the body
 * twenty times as hard. */
export function megaPunchBlow(weapon:number){return (weapon===0||weapon===1||weapon===46)&&CHEATS.isActive('megaPunch');}
