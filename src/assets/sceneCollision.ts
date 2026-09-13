import { requireAsset } from './binary';
import type { ScenePart } from './scene';
/** LOD replacement entities keep visuals/bounds but do not participate in playable collision. */
export function planSceneCollision(parts: ScenePart[]) {
  requireAsset(parts.reduce((n, part) => n + part.placements.length, 0) <= 4096, 'Scene exceeds the placement limits.');
  const key = (ref: { namespace: string; index: number }) => `${ref.namespace}:${ref.index}`;
  const nodes = new Map<string, { target?: string }>();
  parts.forEach(part => {
    if (!part.sourceRefs) return;
    requireAsset(part.sourceRefs.length === part.placements.length, 'Scene placement references must match their instances.');
    part.sourceRefs.forEach((ref, placement) => {
      requireAsset(['primary','static'].includes(ref.namespace) && Number.isSafeInteger(ref.index) && ref.index >= 0, 'Invalid scene placement reference.');
      const id = key(ref); requireAsset(!nodes.has(id), `Duplicate scene placement reference ${id}.`);
      if (ref.lodTarget) requireAsset(['primary','static'].includes(ref.lodTarget.namespace) && Number.isSafeInteger(ref.lodTarget.index) && ref.lodTarget.index >= 0 && ref.lodTarget.index === part.placements[placement].lodIndex, 'Invalid scene LOD target.');
      nodes.set(id, { target: ref.lodTarget ? key(ref.lodTarget) : undefined });
    });
  });
  const targets = new Set<string>(), complete = new Set<string>();
  for (const id of nodes.keys()) {
    const path = new Set<string>(); let current: string | undefined = id;
    while (current && nodes.has(current) && !complete.has(current)) {
      requireAsset(!path.has(current), `Cyclic scene LOD link at ${current}.`); path.add(current);
      const target: string | undefined = nodes.get(current)!.target;
      if (target && nodes.has(target)) targets.add(target);
      current = target;
    }
    path.forEach(value => complete.add(value));
  }
  const placements = parts.map(part => part.placements.filter((_, i) => !part.sourceRefs || !targets.has(key(part.sourceRefs[i]))));
  return { placements, lodTargets: targets.size, missing: parts.flatMap((part,i) => placements[i].length && !part.collision ? [part.name] : []) };
}
