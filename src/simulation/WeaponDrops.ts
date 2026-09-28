import {Group} from 'three';
import {modelObject} from '../assets/ModelObjects';

export interface DropAsset { model: Parameters<typeof modelObject>[0]; textures: Parameters<typeof modelObject>[1] }
interface Drop { weapon: number; rounds: number; position: { x: number; y: number; z: number }; root?: Group; owner?: ReturnType<typeof modelObject>; age: number;
  /** PICKUP_ONCE_FOR_MISSION (bDeathPickupsPersist): never times out and is never merged into. */
  persist?: boolean;
  /** CPickup's bEmpty (ExtractAmmoFromPickup took the rounds) and bHelpMessageDisplayed. */
  empty?: boolean; helpShown?: boolean }
/** What the player's collect callback sees of a drop: the rounds it holds, whether it was emptied, whether it showed
 * its help. The callback may empty it (an exchangeable slot's weapon takes the ammo) and leave it lying. */
export type DropAmmo = { rounds: number; empty?: boolean; helpShown?: boolean };
/** re3's CPickups::GenerateNewOne gives PICKUP_ONCE_TIMEOUT 20 s (SA's is unreversed). */
export const DROP_TIMEOUT_SECONDS = 20;
/** AmmoForWeapon_OnStreet (0x8A5F50), by eWeaponType. */
export const AMMO_FOR_WEAPON_ON_STREET = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 4, 4, 30, 10, 10, 15, 10, 10, 60, 60, 80, 80, 60, 20, 10, 4, 3, 100, 500, 5, 1, 500, 500, 36, 0, 0, 1] as const;
/** WEAPON_CANE, the last melee weapon type. */
const LAST_MELEE = 15;
/** CPed::CreateDeadPedWeaponPickups: one pickup per carried weapon but fists and the detonator, a gun only while it
 * has ammo, each holding its ammo up to twice AmmoForWeapon_OnStreet. */
export function deadPedWeaponDrops(weapons: readonly { type: number; totalAmmo: number }[]) {
  const out: { weapon: number; ammo: number }[] = [];
  for (const w of weapons) {
    if (w.type === 0 || w.type === 40 || out.some(o => o.weapon === w.type)) continue;
    if (!w.totalAmmo && w.type > LAST_MELEE) continue;
    out.push({ weapon: w.type, ammo: Math.min(w.totalAmmo, (AMMO_FOR_WEAPON_ON_STREET[w.type] ?? 0) * 2) });
  }
  return out;
}
/** CPickups::TryToMerge_WeaponType's reach. */
const MERGE_RADIUS = 5;
/** A browser bound on live drops; CPickups' pool holds 620 pickups of every kind. */
const MAX_DROPS = 64;
/** Dropped weapons from dead peds (PICKUP_ONCE_TIMEOUT): reported by the street population, grounded by the host
 * raycast, merged into a same-weapon drop within 5 units, and collected on foot. They go when their time runs out,
 * not when the player walks away (CPickup::Update). */
export class WeaponDrops {
  private drops: Drop[] = [];
  private loading = new Map<number, Promise<DropAsset | undefined>>();
  constructor(private scene: { add(o: Group): void }, private assets: { load: (weapon: number) => Promise<{ asset?: { model: DropAsset['model']; textures: DropAsset['textures'] } }> }, private ground: (point: { x: number; y: number; z: number }) => number | undefined) {}
  /** Queue a dropped weapon, or add its ammo to a same-weapon drop within 5 units (TryToMerge_WeaponType). */
  async report(position: { x: number; y: number; z: number }, weapon: number, rounds: number, persist = false) {
   if (!Number.isFinite(position.x + position.y + position.z) || !Number.isInteger(weapon) || !(rounds >= 0)) return false;
   // CPed::CreateDeadPedWeaponPickups tries TryToMerge_WeaponType into a PICKUP_ONCE_TIMEOUT pickup first whether or
   // not the ped's own drops persist; only a new pickup takes PICKUP_ONCE_FOR_MISSION.
   const merge = this.drops.find(d => !d.persist && d.weapon === weapon && Math.hypot(d.position.x - position.x, d.position.y - position.y, d.position.z - position.z) < MERGE_RADIUS);
   if (merge) { merge.rounds += Math.floor(rounds); return true; }
   while (this.drops.length >= MAX_DROPS) { const i = Math.max(0, this.drops.findIndex(d => !d.persist)); this.retire(this.drops.splice(i, 1)[0]); }
   // Listed at once, so a second body dropping the same weapon this frame merges into it.
   const drop: Drop = { weapon, rounds: Math.floor(rounds), position: { ...position }, age: 0, persist };
   this.drops.push(drop);
    let pending = this.loading.get(weapon);
    if (!pending) {
      pending = this.assets.load(weapon).then(loaded => (loaded.asset ? { model: loaded.asset.model, textures: loaded.asset.textures } : undefined)).catch(() => undefined);
      this.loading.set(weapon, pending);
    }
    const resolved = await pending;
    const ground = resolved && this.drops.includes(drop) ? this.ground(position) : undefined;
    if (!resolved || ground === undefined) { const i = this.drops.indexOf(drop); if (i >= 0) this.drops.splice(i, 1); return false; }
    const owner = modelObject(resolved.model, resolved.textures);
    owner.root.position.set(position.x, ground + 0.15, position.z);
    this.scene.add(owner.root);
    drop.position.y = ground + 0.15; drop.root = owner.root; drop.owner = owner;
    return true;
  }
  /** Age out old drops and hand nearby ones to the player on foot: CPickup::Update's reach is under √1.8 across and
   * under 2 in height. */
  step(dt: number, player: { position: { x: number; y: number; z: number }; alive: boolean; onFoot: boolean }, collect: (weapon: number, drop: DropAmmo) => string | undefined) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.age += dt;
      if (drop.age > DROP_TIMEOUT_SECONDS && !drop.persist) { this.retire(drop); this.drops.splice(i, 1); continue; }
      if (!drop.root || !player.alive || !player.onFoot) continue;
      if (Math.hypot(drop.position.x - player.position.x, drop.position.z - player.position.z) >= Math.sqrt(1.8) || Math.abs(drop.position.y - player.position.y) >= 2) continue;
      const name = collect(drop.weapon, drop);
      if (name === undefined) continue;
      this.retire(drop); this.drops.splice(i, 1);
    }
  }
  /** CPickups::PassTime moves the drops' timeouts on: a minute of passed game time is a second. */
  passTime(minutes: number) { for (const drop of this.drops) drop.age += Math.max(0, minutes); }
  /** CPickups::RemoveUnnecessaryPickups: the PICKUP_ONCE_TIMEOUT drops inside the sphere go. */
  removeInSphere(at: { x: number; y: number; z: number }, radius: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.persist || Math.hypot(drop.position.x - at.x, drop.position.y - at.y, drop.position.z - at.z) > radius) continue;
      this.retire(drop); this.drops.splice(i, 1);
    }
  }
  private retire(drop: Drop) { drop.root?.removeFromParent(); drop.owner?.dispose(); }
  snapshot() { return this.drops.filter(d => d.root).map(d => ({ weapon: d.weapon, rounds: d.rounds, position: { ...d.position }, age: d.age })); }
  dispose() { for (const drop of this.drops) this.retire(drop); this.drops.length = 0; this.loading.clear(); }
}
