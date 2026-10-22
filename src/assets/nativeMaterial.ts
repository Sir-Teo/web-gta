import {nativeRasterOutput} from './nativeRasterOutput';
import { MeshLambertMaterial, Vector3, type MeshLambertMaterialParameters } from 'three';
import {nativeVertexLighting} from './nativeVertexLighting';
import {nativeScorchedUniform} from './nativeScorched';
/** `direct` at 0 or above replaces the scene's directional lights with one light of that colour shining from the
 * world `direction` (SetBrightMarkerColours' fixed directional). */
export const nativeAmbientState = () => ({enabled:{value:false},directMultiplier:{value:1},color:{value:new Vector3()},direct:{value:-1},direction:{value:new Vector3(0,1,0)}});
export type NativeAmbientState = ReturnType<typeof nativeAmbientState>;
/** Generic native prelight and scene lighting saturate at vertices, before
 * interpolation, material/texture modulation and fog. */
export function nativeLitMaterial(parameters: MeshLambertMaterialParameters, surface: number[], ambient = nativeAmbientState()) {
  const material = new MeshLambertMaterial(parameters);
  // RpMaterialSetSurfaceProperties can change them later (a lit car lamp's gLightSurfProps).
  const nativeSurface = { ambient: { value: surface[0] }, diffuse: { value: surface[2] } };
  material.userData.nativeSurface = nativeSurface;
  material.onBeforeCompile = function(shader) {
    shader.uniforms.nativeRenderScorched=nativeScorchedUniform(this);
    shader.uniforms.nativeContactMultiplier = ambient.directMultiplier;
    shader.uniforms.nativeAmbientEnabled = ambient.enabled;
    shader.uniforms.nativeAmbientColor = ambient.color;
    shader.uniforms.nativeAmbient = nativeSurface.ambient;
    shader.uniforms.nativeDiffuse = nativeSurface.diffuse;
    shader.uniforms.nativeDirectOverride = ambient.direct;
    shader.uniforms.nativeDirectDirection = ambient.direction;
    const declarations='uniform bool nativeRenderScorched; uniform float nativeContactMultiplier; uniform bool nativeAmbientEnabled; uniform vec3 nativeAmbientColor;\nuniform float nativeAmbient; uniform float nativeDiffuse; uniform float nativeDirectOverride; uniform vec3 nativeDirectDirection; varying vec3 vNativeLight;\n';
    shader.vertexShader=declarations+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n#include <lights_pars_begin>')
      .replace('#include <fog_vertex>','#include <fog_vertex>\n'+nativeVertexLighting);
    shader.fragmentShader='varying vec3 vNativeLight;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `
      #ifdef USE_COLOR_ALPHA
        diffuseColor.a *= vColor.a;
      #endif
    `).replace('#include <lights_fragment_begin>','').replace('#include <lights_fragment_maps>','').replace('#include <lights_fragment_end>','')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        'vec3 outgoingLight = diffuseColor.rgb * vNativeLight + totalEmissiveRadiance;');
  };
  material.customProgramCacheKey = () => 'native-prelight-gouraud-v5';
  return nativeRasterOutput(material);
}
