import * as THREE from 'three';
import type { ModelTexture } from './modelTextures';
// Dictionary textures retain their own sampler when resolved by name, as in librw Texture::streamRead.
export function nativeTexture(source: ModelTexture) {
  const first = source.mips[0], texture = new THREE.DataTexture(first.data, first.width, first.height, THREE.RGBAFormat);
  texture.name = source.name; texture.flipY = false; texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false; texture.mipmaps = source.mips;
  const modes = [THREE.NearestFilter, THREE.NearestFilter, THREE.LinearFilter, THREE.NearestMipmapNearestFilter,
    THREE.LinearMipmapNearestFilter, THREE.NearestMipmapLinearFilter, THREE.LinearMipmapLinearFilter] as const;
  // RW modes 4/5 distinguish bilinear texels from interpolation between mip levels.
  texture.magFilter = [1, 3, 5].includes(source.filter) ? THREE.NearestFilter : THREE.LinearFilter;
  texture.minFilter = source.mips.length > 1 && source.filter >= 1 && source.filter <= 6 ? modes[source.filter] : texture.magFilter;
  const wrap = (mode: number) => mode === 2 ? THREE.MirroredRepeatWrapping : mode === 3 || mode === 4 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapS = wrap(source.addressU); texture.wrapT = wrap(source.addressV || source.addressU);
  texture.needsUpdate = true;
  return texture;
}
