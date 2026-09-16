import {Group} from 'three';
import {modelObject} from '../assets/ModelObjects';

export interface DropAsset { model: Parameters<typeof modelObject>[0]; textures: Parameters<typeof modelObject>[1] }
interface Drop { weapon: number; rounds: number; position: { x: number; y: number; z: number }; root: Group; owner: ReturnType<typeof modelObject>; age: number }
/** Dropped guns from dead armed peds: reported by the street population,
 * grounded by the host raycast, collected on foot for their leftover rounds.
 * Drops never regenerate (CPickup random drops are one-shot). */
export class WeaponDrops {
  private drops: Drop[] = [];
  private loading = new Map<number, Promise<DropAsset | undefined>>();
  constructor(private scene: { add(o: Group): void }, private assets: { load: (weapon: number) => Promise<{ asset?: { model: DropAsset['model']; textures: DropAsset['textures'] } }> }, private ground: (point: { x: number; y: number; z: number }) => number | undefined) {}
  /** Queue a dropped gun; skips empty magazines and caps eight live drops. */
  async report(position: { x: number; y: number; z: number }, weapon: number, rounds: number) {
   if (!Number.isFinite(position.x + position.y + position.z) || !Number.isInteger(weapon) || !(rounds > 0)) return false;
   while (this.drops.length >= 8) this.retire(this.drops.shift()!);
    let pending = this.loading.get(weapon);
    if (!pending) {
      pending = this.assets.load(weapon).then(loaded => (loaded.asset ? { model: loaded.asset.model, textures: loaded.asset.textures } : undefined)).catch(() => undefined);
      this.loading.set(weapon, pending);
    }
    const resolved = await pending;
    if (!resolved) return false;
    const ground = this.ground(position);
    if (ground === undefined) return false;
    const owner = modelObject(resolved.model, resolved.textures);
    owner.root.position.set(position.x, ground + 0.15, position.z);
    this.scene.add(owner.root);
    this.drops.push({ weapon, rounds: Math.floor(rounds), position: { x: position.x, y: ground + 0.15, z: position.z }, root: owner.root, owner, age: 0 });
    return true;
  }
  /** Age out old drops and hand nearby ones to the player on foot. */
  step(dt: number, player: { position: { x: number; y: number; z: number }; alive: boolean; onFoot: boolean }, collect: (weapon: number, rounds: number) => string | undefined) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.age += dt;
      const far = Math.hypot(drop.position.x - player.position.x, drop.position.z - player.position.z) > 65;
      if (drop.age > 120 || far) { this.retire(drop); this.drops.splice(i, 1); continue; }
      if (!player.alive || !player.onFoot) continue;
      if (Math.hypot(drop.position.x - player.position.x, drop.position.y - player.position.y, drop.position.z - player.position.z) > 1.5) continue;
      const name = collect(drop.weapon, drop.rounds);
      if (name === undefined) continue;
      this.retire(drop); this.drops.splice(i, 1);
    }
  }
  private retire(drop: Drop) { drop.root.removeFromParent(); drop.owner.dispose(); }
  snapshot() { return this.drops.map(d => ({ weapon: d.weapon, rounds: d.rounds, position: { ...d.position }, age: d.age })); }
  dispose() { for (const drop of this.drops) this.retire(drop); this.drops.length = 0; this.loading.clear(); }
}
