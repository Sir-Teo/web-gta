import type RAPIER from '@dimforge/rapier3d-compat';
import { Group, Matrix4, type Scene } from 'three';
import type { ScenePart } from '../assets/scene';
import { placedModelObjects } from '../assets/ModelObjects';
import { TexturePool } from '../assets/TexturePool';
import { installNativeCollision, type NativeCollisionSource } from './nativeCollision';
import { requireAsset } from '../assets/binary';
import { wrapMinutes } from '../world/timecycle';
import type { IplInstance } from '../assets/ipl';
export interface InstalledCollisionSource { modelName: string; placement: IplInstance; source: NativeCollisionSource; }
/** Commit imported visuals and fixed colliders as one owned scene, rolling back partial work on failure. */
export function installNativeScene(world: RAPIER.World, scene: Scene, parts: ScenePart[], options: { allowMissingCollision?: boolean } = {}) {
  scene.updateMatrixWorld(true);
  requireAsset(scene.matrixWorld.equals(new Matrix4()), 'Imported physics requires an untransformed scene root.');
  requireAsset(parts.length > 0 && parts.length <= 256, 'Imported scene requires 1–256 model types.');
  let instances = 0, colliders = 0, triangles = 0, vertices = 0, visualTriangles = 0, visualNodes = 0;
  const missingCollision: string[] = [];
  for (const part of parts) {
    const definition = part.definition;
    if (definition?.section === 'tobj' && (definition.timeOn !== undefined || definition.timeOff !== undefined)) requireAsset([definition.timeOn, definition.timeOff].every(n => n !== undefined && Number.isInteger(n) && n >= 0 && n <= 24), 'Timed scene objects require valid on/off hours.');
    instances += part.placements.length;
    visualTriangles += part.placements.length * part.model.atomics.filter(a => a.flags & 4).reduce((n, a) => n + part.model.geometries[a.geometry].indices.length / 3, 0);
    visualNodes += part.placements.length * (part.model.frames.length + part.model.atomics.length);
    if (!part.collision) { missingCollision.push(part.name); continue; }
    const collision = part.collision, count = part.placements.length;
    colliders += count * (collision.spheres.length + collision.boxes.length + Number(collision.mesh.indices.length > 0));
    triangles += count * collision.mesh.indices.length / 3; vertices += count * collision.mesh.positions.length / 3;
  }
  requireAsset(options.allowMissingCollision || !missingCollision.length, `Missing collision for: ${missingCollision.join(', ')}.`);
  requireAsset(instances > 0 && instances <= 4096 && colliders <= 20000 && triangles <= 2000000 && vertices <= 1000000 && visualTriangles <= 2000000 && visualNodes <= 100000, 'Imported scene exceeds the physics installation limits.');
  const root = new Group(), pool = new TexturePool(), visuals: ReturnType<typeof placedModelObjects>[] = [], physical: ReturnType<typeof installNativeCollision>[] = [];
  const sources = new Map<number, InstalledCollisionSource>(); let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.removeFromParent(); physical.forEach(p => p.dispose()); visuals.forEach(v => v.dispose()); sources.clear();
  };
  try {
    for (const part of parts) {
      const visual = placedModelObjects(part.model, part.textures, part.placements, pool); visuals.push(visual); root.add(visual.root);
      if (part.collision) for (const placement of part.placements) {
        const object = installNativeCollision(world, part.collision, placement); physical.push(object);
        object.sources.forEach((source, handle) => sources.set(handle, { modelName: part.name, placement, source }));
      }
    }
    root.updateMatrixWorld(true); scene.add(root);
  } catch (error) { dispose(); throw error; }
  let lastHour: number | undefined;
  const setTime = (minutes: number) => {
    if (disposed) return;
    requireAsset(Number.isFinite(minutes), 'Scene time must be finite.');
    const hour = Math.floor(wrapMinutes(minutes) / 60); if (hour === lastHour) return;
    for (let i = 0; i < parts.length; i++) {
      const definition = parts[i].definition;
      if (definition?.section !== 'tobj' || definition.timeOn === undefined || definition.timeOff === undefined) continue;
      const { timeOn: from, timeOff: to } = definition;
      visuals[i].root.visible = from > to ? hour >= from || hour < to : hour >= from && hour < to;
    }
    lastHour = hour;
  };
  return { root, sources, missingCollision, setTime, get visibleInstanceCount() { return disposed ? 0 : visuals.reduce((n, v, i) => n + (v.root.visible ? parts[i].placements.length : 0), 0); }, instanceCount: instances, colliderCount: colliders, setNight: (amount: number) => { if (!disposed) visuals.forEach(v => v.setNight(amount)); }, dispose };
}
