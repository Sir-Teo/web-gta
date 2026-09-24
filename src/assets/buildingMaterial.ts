import {nativeRasterOutput} from './nativeRasterOutput';
import { MeshBasicMaterial, Vector3 } from 'three';
import { buildingAlpha } from './buildingAlpha';
import { nativeBuildingEnvMap, type NativeEnvSource } from './nativeEnvMap';

export { BUILDING_PIPELINE, BUILDING_DN_PIPELINE, isBuildingPipeline } from './buildingPipelines';
export const buildingLightingState = () => ({ night: { value: 0 }, wetness: { value: 0 }, ambient: { value: new Vector3() }, dualPass: { enabled: true, threshold: 128 } });
export type BuildingLightingState = ReturnType<typeof buildingLightingState>;

/** SkyGFX PS2 building base pass; environment/detail/UV-animation passes are separate. */
export function buildingMaterial(source: MeshBasicMaterial, ambientCoefficient: number, state: BuildingLightingState, dayNight: boolean, vertexAlpha: boolean) {
  // copy() round-trips userData through JSON, which would serialise the env texture: it is carried over by hand.
  const env = source.userData.nativeEnv as NativeEnvSource | undefined;
  if (env) delete source.userData.nativeEnv;
  const material = new MeshBasicMaterial().copy(source);
  if (env) source.userData.nativeEnv = env;
  // This shader reads immutable nativeDay/nativeNight attributes, not Three's CPU color blend.
  material.vertexColors = false;
  material.transparent = source.opacity < 1 || !!source.userData.nativeTextureAlpha || vertexAlpha;
  material.depthWrite = !material.transparent;
  material.onBeforeCompile = shader => {
    shader.uniforms.buildingNight = state.night; shader.uniforms.buildingWetness = state.wetness; shader.uniforms.buildingAmbient = state.ambient;
    shader.uniforms.buildingSurfaceAmbient = { value: ambientCoefficient };
    shader.uniforms.buildingColorScale = { value: source.map ? 255/128 : 1 };
    shader.vertexShader = `attribute vec4 nativeDay; attribute vec4 nativeNight;
      uniform float buildingNight; uniform float buildingWetness; uniform vec3 buildingAmbient;
      uniform float buildingSurfaceAmbient; uniform float buildingColorScale;
      uniform vec3 diffuse; uniform float opacity; varying vec4 buildingColor;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', `
      vec4 palette = ${dayNight ? 'vec4(mix(nativeDay.rgb, nativeNight.rgb, clamp(buildingNight, 0.0, 1.0)), mix(nativeNight.a, nativeDay.a, clamp(buildingWetness, 0.0, 1.0)))' : 'nativeDay'};
      buildingColor = palette * vec4(diffuse, opacity) / buildingColorScale;
      buildingColor.rgb += buildingAmbient * buildingSurfaceAmbient;
    `);
    shader.fragmentShader = 'varying vec4 buildingColor; uniform float buildingColorScale;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4(1.0);')
      .replace('#include <color_fragment>', 'diffuseColor *= buildingColor * buildingColorScale;');
  };
  material.customProgramCacheKey = () => `native-building-base-v1-${dayNight ? 'dn' : 'single'}`;
  nativeRasterOutput(material);
  // The source's env texture reflects the building pipeline's way (the casino roofs' carfx1).
  if (env) nativeBuildingEnvMap(material, env);
  buildingAlpha(material, state.dualPass);
  return material;
}
