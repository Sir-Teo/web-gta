import * as THREE from 'three';
import type { ModelTexture } from './modelTextures';
// Dictionary textures retain their own sampler when resolved by name, as in librw Texture::streamRead.
export function nativeTexture(source: ModelTexture) {
  const first = source.mips[0], texture = new THREE.DataTexture(first.data, first.width, first.height, THREE.RGBAFormat);
  texture.name = source.name; texture.flipY = false; texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false; texture.mipmaps = source.mips;
  const modes = [THREE.NearestFilter, THREE.NearestFilter, THREE.LinearFilter, THREE.NearestMipmapNearestFilter,
    THREE.NearestMipmapLinearFilter, THREE.LinearMipmapNearestFilter, THREE.LinearMipmapLinearFilter] as const;
  texture.minFilter = source.filter >= 1 && source.filter <= 6 ? modes[source.filter] : THREE.LinearFilter;
  texture.magFilter = [1, 3, 4].includes(source.filter) ? THREE.NearestFilter : THREE.LinearFilter;
  const wrap = (mode: number) => mode === 2 ? THREE.MirroredRepeatWrapping : mode === 3 || mode === 4 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapS = wrap(source.addressU); texture.wrapT = wrap(source.addressV || source.addressU);
  texture.needsUpdate = true;
  return texture;
}
