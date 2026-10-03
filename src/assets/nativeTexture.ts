import * as THREE from 'three';
import { decodeDxt, decodeDxt1To5551 } from './dxt';
import type { ModelTexture } from './modelTextures';
let compressedUploads = false;
/** Whether the context samples S3TC blocks (WEBGL_compressed_texture_s3tc). Without it, compressed rasters are decoded
 * here: a phone's GPU (Adreno, Mali, an iPhone's before the A14) has none, as the mobile ports' PVR and ETC databases
 * say. DXT1, most of the world's rasters, decodes to 16-bit 5551, half the RGBA's memory and bandwidth; DXT3 and DXT5
 * keep their alpha's eight bits. */
export function setCompressedTextureSupport(supported: boolean) { compressedUploads = supported; }
// D3D9 reads a three-colour DXT1 block's fourth entry as transparent black, as the RGBA DXT1 format does.
const dxtFormats = { DXT1: THREE.RGBA_S3TC_DXT1_Format, DXT3: THREE.RGBA_S3TC_DXT3_Format, DXT5: THREE.RGBA_S3TC_DXT5_Format } as const;
// Dictionary textures retain their own sampler when resolved by name, as in librw Texture::streamRead.
export function nativeTexture(source: ModelTexture) {
  const first = source.mips[0], format = source.compressed;
  let texture: THREE.DataTexture | THREE.CompressedTexture;
  if (format && compressedUploads) texture = new THREE.CompressedTexture(source.mips as THREE.CompressedTextureMipmap[], first.width, first.height, dxtFormats[format]);
  else if (format) {
    const blocks = (m: ModelTexture['mips'][number]) => new Uint8Array(m.data.buffer, m.data.byteOffset, m.data.byteLength);
    texture = format === 'DXT1'
      ? decodedOnUpload(source, THREE.UnsignedShort5551Type, m => decodeDxt1To5551(blocks(m), m.width, m.height))
      : decodedOnUpload(source, THREE.UnsignedByteType, m => decodeDxt(blocks(m), m.width, m.height, format));
    // Two bytes a pixel: a one-texel-wide mip's rows are two bytes apart.
    if (format === 'DXT1') texture.unpackAlignment = 2;
  } else { texture = new THREE.DataTexture(first.data, first.width, first.height, THREE.RGBAFormat); texture.mipmaps = source.mips; }
  texture.name = source.name; texture.flipY = false; texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
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
/** A DXT raster for a GPU without S3TC: each level decoded as the renderer uploads it and let go once uploaded (three.js
 * calls onUpdate then). The blocks stay with the source, which the texture pool keeps, so script memory holds no
 * second, larger copy of every texture on screen: on a phone's GPU, about 57 MB around Grove Street. A later upload
 * (a lost context restored, a clone sampled another way) decodes again. */
function decodedOnUpload(source: ModelTexture, type: THREE.TextureDataType, decode: (mip: ModelTexture['mips'][number]) => ArrayBufferView) {
  const levels = source.mips.map(mip => {
    let data: ArrayBufferView | undefined;
    return { width: mip.width, height: mip.height, get data() { return data ??= decode(mip); }, get released() { return data === undefined; }, release() { data = undefined; } };
  });
  const texture = new THREE.DataTexture(null, levels[0].width, levels[0].height, THREE.RGBAFormat, type);
  texture.image = { width: levels[0].width, height: levels[0].height, get data() { return levels[0].data; } } as unknown as typeof texture.image;
  texture.mipmaps = levels as unknown as typeof texture.mipmaps;
  texture.onUpdate = () => { for (const level of levels) level.release(); };
  return texture;
}
