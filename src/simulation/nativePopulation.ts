/** Native population creation/removal rules.
 *
 * Sources:
 * - re3 `CPopulation` (GTA III-era, same lineage as SA `Population.cpp`):
 *   MIN_CREATION_DIST 40, CREATION_RANGE 10, OFFSCREEN_CREATION_MULT 0.5,
 *   PED_REMOVE_DIST 51, SPECIAL 65.
 * - gta-reversed `Population.cpp` (pinned 0076f901): PedCreationDistMultiplier
 *   1.0 on foot, 1.0-1.5 scaled by vehicle speed; ManagePed removal bands
 *   54.5/65 * GenerationDistMultiplier with on-screen fade vs off-screen
 *   removal and the 4 s (10 s cop) `m_nTimeTillWeNeedThisPed` grace;
 *   CanCameraSeeAPedHere 42.5 * PCDM visibility gate.
 * - gta-reversed `Wanted.cpp`: UpdateWantedLevel thresholds already mirrored
 *   in NativeWanted; the >2-star foot `addCop` path forces the onscreen
 *   40-50 m band.
 *
 * The browser follows native popcycle maxPeds/maxCars ratios with a 36/44
 * device clamp (18/26 street fallback); denser native peaks thin out through
 * the native 15–65 m creation/removal bands, so visible density matches while
 * officers keep line-of-sight. This module supplies the native distance bands
 * and decisions so spawns stop popping in at 7 m and cleanup stops deleting
 * visible peds.
 */
export const NATIVE_MIN_CREATION_DIST = 40;
export const NATIVE_CREATION_RANGE = 10;
export const NATIVE_OFFSCREEN_MULT = 0.5;
export const NATIVE_PED_REMOVE_DIST = 51;
export const NATIVE_PED_REMOVE_SPECIAL = 65;
export const NATIVE_MANAGE_REMOVE = 54.5;
export const NATIVE_MANAGE_REMOVE_FAR = 65;
export const NATIVE_VISIBLE_SPAWN_GATE = 42.5;
export const NATIVE_PED_GRACE_MS = 4000;
export const NATIVE_COP_GRACE_MS = 10000;

/** 1.0 on foot, up to 1.5 with vehicle speed (CPopulation::PedCreationDistMultiplier). */
export function pedCreationDistMultiplier(vehicleSpeed2D: number): number {
  if (!(vehicleSpeed2D > 0)) return 1;
  return Math.min(1.5, Math.max(1, vehicleSpeed2D - 0.1 + 1));
}

/** CPopulation::Update's on-screen band for AddToPopulation: 42.5 to 50.5 units, scaled by PCDM and the camera's
 * generation multiplier. */
export function onscreenSpawnBand(pcdm: number, generationMult = 1): { min: number; max: number } {
  return { min: pcdm * generationMult * 42.5, max: pcdm * generationMult * 50.5 };
}

/** Offscreen 15-25 m band (50*0.5=25 minus the 10 range). */
export function offscreenSpawnBand(pcdm: number): { min: number; max: number } {
  const max = pcdm * (NATIVE_MIN_CREATION_DIST + NATIVE_CREATION_RANGE) * NATIVE_OFFSCREEN_MULT;
  return { min: max - NATIVE_CREATION_RANGE, max };
}

/** Visible spawns must lie beyond 42.5*PCDM (CanCameraSeeAPedHere gate). */
export function visibleSpawnAllowed(distance2D: number, pcdm: number): boolean {
  return distance2D >= pcdm * NATIVE_VISIBLE_SPAWN_GATE;
}

/** Gang party size from AddToPopulation: 50% reject, else 1-4 (7/17/11/15%). */
export function gangPartySize(rand100: number): number {
  if (rand100 < 50) return 0;
  if (rand100 < 57) return 1;
  if (rand100 >= 74) return rand100 >= 85 ? 4 : 3;
  return 2;
}

/** Gang party formation offsets (CPopulation::AddToPopulation): member i sits
 * 0.75*i–0.75*(i+1) out on each axis with independent random signs. */
export function gangFormationOffset(index:number,random:()=>number=Math.random):{x:number;z:number}{
 const unit=(base:number)=>base+random()*0.75;
 let x=unit(index*0.75),z=unit(index*0.75);
 if(random()<.5)x=-x;
 if(random()<.5)z=-z;
 return {x,z};
}
/** The street gangs' index (CGangs: 0 Ballas, 1 Families, 2 Vagos, ...) as the ped type their members are (GANG1 on). */
export const gangPedType=(gang:number)=>7+gang;
/** How a gang's members come to fight the player on sight: its ped type's acquaintance with PLAYER1, which MAIN.SCM
 * sets (Ballas, Vagos and Aztecas only dislike him at the start; SWEET4 turns the Ballas' to hate). The acquaintance
 * scanner's hate event reaches the gang's group, whose RANDOM.grp answers a threat with CTaskAllocatorKillThreatsBasic
 * 200 times in 700 and with nothing otherwise; dislike draws a stare, a hassle or nothing, never an attack.
 * PED_SEEING_RANGE is CPedIntelligence's m_fSeeingRange. Respect (0–100, from 40) gates the rest: neutral gangs lean
 * on a disrespected mark inside 5 m (authored). */
export const PED_SEEING_RANGE=15,TURF_KILL_THREATS_CHANCE=200/700;
/** The Families' rivals, whose dead count to the player's respect (authored). */
export const GANG_RIVALS:ReadonlySet<number>=new Set([0,2]);
export const GANG_DISRESPECT_RADIUS = 5;
let respect = 40;
export function gangRespect(){return respect;}
/** CStats::FindMaxNumberOfGroupMembers (0x559A50) on STAT_TOTAL_RESPECT. The browser keeps respect as a 0-100 share of
 * its own, read here as that share of the stat's thousand. */
export function maxGroupMembers(totalRespect=respect*10){
 return totalRespect<10?0:totalRespect<60?2:totalRespect<160?3:totalRespect<330?4:totalRespect<540?5:totalRespect<800?6:7;
}
export function addRespect(delta:number){respect=Math.max(0,Math.min(100,respect+delta));}
export function gangHostile(gang:number|undefined,distance:number,mark=respect){
 if(gang===undefined)return false;
 // Families (1) never turn on their own; other gangs press a weak mark.
 if(gang===1)return false;
 return mark<25&&distance<GANG_DISRESPECT_RADIUS;
}
/** Escalated turf parties (give-peds-weapons script flag): one pistol appears
 * once the mark is armed or wanted, and only on turf strong enough to be armed
 * (INITIAL strength 20+); weak corners stay unarmed. */
export function gangPartyArmed(size:number,playerArmed:boolean,wanted:number,strength=255){
 return size>1&&strength>=20&&(playerArmed||wanted>0);
}
/** Soft body separation (crowd steering): overlap pushes peds apart so groups
 * and passersby stop clipping through each other. Native resolves full
 * ped-vs-ped collision; the browser steers a small impulse instead. */
export const SEPARATION_RADIUS = 0.55;
export const SEPARATION_PUSH = 1.0;
export function separationPush(point:{x:number;z:number},others:readonly {x:number;z:number}[],radius=SEPARATION_RADIUS,strength=SEPARATION_PUSH){
 let x=0,z=0;
 for(const other of others){
  const dx=point.x-other.x,dz=point.z-other.z,d=Math.hypot(dx,dz);
  if(d<=1e-4||d>=radius)continue;
  const push=(1-d/radius)*strength;
  x+=dx/d*push;z+=dz/d*push;
 }
 return {x,z};
}
/** >2-star foot `addCop` override (CPopulation::AddToPopulation). */
export function wantsCopOverride(o: { wanted: number; numCop: number; maxCops: number; playerInVehicle: boolean }): boolean {
  return o.wanted > 2 && o.numCop < o.maxCops && !o.playerInVehicle;
}

/** ManagePed removal decision. Returns 'keep' | 'fade' | 'remove'. */
export function managePed(o: {
  distance2D: number; pcdm: number; generationMult?: number; onScreen: boolean; farAwayCull: boolean;
  graceExpires: number; now: number; sniperMode: boolean; lookingAside: boolean;
}): 'keep' | 'fade' | 'remove' {
  const gen = o.generationMult ?? 1;
  const removal = o.distance2D / o.pcdm;
  const limit = gen * (o.farAwayCull ? NATIVE_MANAGE_REMOVE_FAR : NATIVE_MANAGE_REMOVE);
  if (limit <= removal) return o.onScreen ? 'fade' : 'remove';
  if (removal <= 25 || o.onScreen) return 'keep';
  if (o.now <= o.graceExpires) return 'keep';
  if (o.sniperMode || o.lookingAside) return 'keep';
  return 'remove';
}
