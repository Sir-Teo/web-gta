import { ShaderChunk } from 'three';

/** The game owns its WebGL shader library: imported Fog uses a linear camera-depth factor. */
export function installNativeFogCurve() {
  ShaderChunk.fog_fragment = ShaderChunk.fog_fragment.replace(
    'smoothstep( fogNear, fogFar, vFogDepth )',
    'clamp( ( vFogDepth - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 )',
  );
}
