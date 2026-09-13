import type { DffModel } from '../assets/dff';
/** Resolve skin palette indices through HAnim IDs, never through incidental frame order. */
export function skinFrames(model: DffModel, boneCount: number): number[] {
  const candidates = model.frames.filter(f => f.hanim?.nodes.length === boneCount);
  if (candidates.length !== 1) throw new Error('Skin requires one unambiguous matching HAnim hierarchy.');
  const result = new Array<number>(boneCount);
  for (const node of candidates[0].hanim!.nodes) {
    const matches = model.frames.map((frame, index) => ({ frame, index })).filter(f => f.frame.hanim?.id === node.id);
    if (matches.length !== 1) throw new Error(`Missing or ambiguous HAnim frame for bone ${node.id}.`);
    result[node.index] = matches[0].index;
  }
  return result;
}
