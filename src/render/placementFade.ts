import { AdditiveBlending, DoubleSide, Mesh, type Material, type Object3D, type Color } from 'three';

/** Reusable per-placement overrides; original materials/textures remain shared and untouched. */
export function placementFade(root: Object3D, ideFlags = 0) {
  const meshes: { mesh: Mesh; original: Material | Material[]; faded?: Material | Material[] }[] = [];
  root.traverse(object => { if (object instanceof Mesh) meshes.push({ mesh: object, original: object.material }); });
  const copies = new Map<Material, Material>();
  let last = 255, lastFading = false, disposed = false;
  const copy = (source: Material) => {
    let material = copies.get(source);
    if (!material) {
      material = source.clone(); material.onBeforeCompile = source.onBeforeCompile; material.customProgramCacheKey = source.customProgramCacheKey;
      material.transparent = true; material.alphaTest = 0;
      // SetBaseModelInfoFlags + VisibilityPlugins::RenderEntity/SetupRenderFadingAtomic.
      if (ideFlags & 0x8) material.blending = AdditiveBlending;
      if (ideFlags & 0x40) material.depthWrite = false;
      if (ideFlags & 0x200000) { material.side = DoubleSide; material.forceSinglePass = true; }
      const rgb = source.userData.nativeFadeColor;
      if (rgb && 'color' in material) (material.color as Color).setRGB(rgb[0], rgb[1], rgb[2]);
      copies.set(source, material);
    }
    return material;
  };
  return {
    setAlpha(alpha: number, fading = alpha < 255) {
      if (disposed) return;
      if (!Number.isInteger(alpha) || alpha < 0 || alpha > 255) throw new Error('Placement fade alpha must be a byte.');
      if (last === alpha && lastFading === fading) return; last = alpha; lastFading = fading;
      for (const entry of meshes) {
        if (!fading) entry.mesh.material = entry.original;
        else {
          entry.faded ??= Array.isArray(entry.original) ? entry.original.map(copy) : copy(entry.original);
          entry.mesh.material = entry.faded;
        }
      }
      for (const [source, material] of copies) material.opacity = Math.min(source.opacity, alpha / 255);
    },
    dispose() {
      if (disposed) return; disposed = true;
      meshes.forEach(entry => { entry.mesh.material = entry.original; });
      copies.forEach(material => material.dispose()); copies.clear();
    },
  };
}
