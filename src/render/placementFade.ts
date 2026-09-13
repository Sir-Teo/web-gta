import { AdditiveBlending, DoubleSide, Mesh, type Material, type Object3D, type Color } from 'three';
import {nativeAlphaReference} from './nativeAlphaReference';

/** Reusable per-placement overrides; original materials/textures remain shared and untouched. */
export function placementFade(root: Object3D, ideFlags = 0, interior = 0,worldRendering=false) {
  const meshes: { mesh: Mesh; original: Material | Material[]; order: number; normal?: Material | Material[]; faded?: Material | Material[] }[] = [];
  root.traverse(object => { if (object instanceof Mesh) meshes.push({ mesh: object, original: object.material, order: object.renderOrder }); });
  const copies = new Map<Material, Material>();
  const normalCopies = new Map<Material, Material>();
  const clone = (source: Material) => {
    const material = source.clone(); material.onBeforeCompile = source.onBeforeCompile; material.onBeforeRender = source.onBeforeRender; material.customProgramCacheKey = source.customProgramCacheKey;
    return material;
  };
  if (worldRendering || ideFlags & (0x200000 | 0x4 | 0x40)) {
    const normal = (source: Material) => {
      let material = normalCopies.get(source);
      if (!material) {
        material = clone(source);
        if(worldRendering&&!('nativeDepthWrite' in material.userData)&&(ideFlags&0x4||!interior&&!(ideFlags&0x1))){
          material.depthWrite=!(ideFlags&0x40);
          // Known exterior non-road pass. Road/interior startup state is separate.
          nativeAlphaReference(material,interior||ideFlags&0x40?0:ideFlags&0x4?100:140);
        }
        if (ideFlags & 0x40) material.depthWrite = false;
        if (ideFlags & 0x200000) { material.side = DoubleSide; material.forceSinglePass = true; }
        if (ideFlags & 0x4) { material.transparent = true; material.alphaTest = interior || ideFlags & 0x40 ? 0 : 100/255; if (ideFlags & 0x40) material.depthWrite = false; }
        if ('nativeDepthWrite' in material.userData) {
          material.userData.nativeDepthWrite = !(ideFlags & 0x40);
          if (ideFlags & 0x4) material.userData.nativeAlphaTest = material.alphaTest;
        }
        normalCopies.set(source, material);
      }
      return material;
    };
    for (const entry of meshes) {
      entry.normal = Array.isArray(entry.original) ? entry.original.map(normal) : normal(entry.original);
      entry.mesh.material = entry.normal;
    }
  }
  let last = 255, lastFading = false, disposed = false;
  const copy = (source: Material) => {
    let material = copies.get(source);
    if (!material) {
      material = clone(source);
      material.transparent = true; material.alphaTest = 0;
      if(worldRendering&&!('nativeDepthWrite' in material.userData)){material.depthWrite=!(ideFlags&0x40);nativeAlphaReference(material,0);}
      // SetBaseModelInfoFlags + VisibilityPlugins::RenderEntity/SetupRenderFadingAtomic.
      if (ideFlags & 0x8) material.blending = AdditiveBlending;
      if (ideFlags & 0x40) material.depthWrite = false;
      if (ideFlags & 0x200000) { material.side = DoubleSide; material.forceSinglePass = true; }
      const rgb = source.userData.nativeFadeColor;
      if (rgb && 'color' in material) (material.color as Color).setRGB(rgb[0], rgb[1], rgb[2]);
      if ('nativeDepthWrite' in material.userData) { material.userData.nativeDepthWrite = !(ideFlags & 0x40); material.userData.nativeAlphaTest = 0; }
      copies.set(source, material);
    }
    return material;
  };
  return {
    setDistance(distance: number) {
      if (disposed) return;
      if (!Number.isFinite(distance) || distance < 0) throw new Error('Placement render distance must be finite and nonnegative.');
      for (const entry of meshes) entry.mesh.renderOrder = lastFading || ideFlags & 0x4 ? -distance : entry.order;
    },
    setAlpha(alpha: number, fading = alpha < 255) {
      if (disposed) return;
      if (!Number.isInteger(alpha) || alpha < 0 || alpha > 255) throw new Error('Placement fade alpha must be a byte.');
      if (last === alpha && lastFading === fading) return; last = alpha; lastFading = fading;
      for (const entry of meshes) {
        if (!fading) entry.mesh.material = entry.normal ?? entry.original;
        else {
          entry.faded ??= Array.isArray(entry.original) ? entry.original.map(copy) : copy(entry.original);
          entry.mesh.material = entry.faded;
        }
      }
      for (const [source, material] of copies) material.opacity = Math.min(source.opacity, alpha / 255);
    },
    dispose() {
      if (disposed) return; disposed = true;
      meshes.forEach(entry => { entry.mesh.material = entry.original; entry.mesh.renderOrder = entry.order; });
      copies.forEach(material => material.dispose()); copies.clear();
      normalCopies.forEach(material => material.dispose()); normalCopies.clear();
    },
  };
}
