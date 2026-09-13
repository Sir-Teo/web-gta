/** Loaded model alpha=255, LOD multipliers=1. Source VisibilityPlugins distance band. */
export function distanceFadeWidth(drawRadius: number, drawDistance: number, hasLod: boolean) {
  return !hasLod && Math.min(drawDistance, drawRadius) > 150 ? Math.min(drawDistance, drawRadius) / 15 + 10 : 20;
}
export function distanceFadeAlpha(distance: number, drawRadius: number, drawDistance: number, hasLod: boolean) {
  const width = distanceFadeWidth(drawRadius, drawDistance, hasLod);
  return Math.max(0, Math.min(255, Math.trunc(255 * Math.min((drawRadius + 20 - distance) / width, 1))));
}
