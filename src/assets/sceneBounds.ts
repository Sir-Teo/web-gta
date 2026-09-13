import type { ColModel } from './col';
import type { ScenePart } from './scene';
import { planSceneCollision } from './sceneCollision';
export interface SceneVisibilityBounds { bounds: ColModel['bounds']; sourceModel: string; inherited: boolean; }
/** Preserve model-space COL bounds; sharing these does not make an LOD entity collidable. */
export function sceneVisibilityBounds(parts: ScenePart[]) {
  const { nodes } = planSceneCollision(parts), children = new Map<string, number[]>();
  for (const node of nodes.values()) if (node.target && nodes.has(node.target)) {
    if (!children.has(node.target)) children.set(node.target, []);
    children.get(node.target)!.push(node.part);
  }
  const donors = new Map<number, Set<number>>(), notices: string[] = [];
  for (const [target, childParts] of children) {
    if (childParts.length !== 1) continue;
    const parent = nodes.get(target)!.part, child = childParts[0];
    if (!parts[child].collision) {
      notices.push(`LOD bounds for ${parts[parent].name} need unavailable collision from ${parts[child].name}.`); continue;
    }
    if (!donors.has(parent)) donors.set(parent, new Set()); donors.get(parent)!.add(child);
  }
  const bounds = parts.map((part, i): SceneVisibilityBounds | undefined => {
    const candidates = [...(donors.get(i) ?? [])];
    const collisions = new Set(candidates.map(index => parts[index].collision));
    if (collisions.size > 1) notices.push(`Ambiguous LOD bounds for ${part.name}; retaining its own bounds.`);
    const donor = candidates.length && collisions.size === 1 ? parts[candidates[0]] : part;
    return donor.collision ? { bounds: donor.collision.bounds, sourceModel: donor.name, inherited: donor !== part } : undefined;
  });
  return { bounds, notices };
}
