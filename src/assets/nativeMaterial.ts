import {nativeRasterOutput} from './nativeRasterOutput';
import { MeshLambertMaterial, Vector3, type MeshLambertMaterialParameters } from 'three';
import {nativeVertexLighting} from './nativeVertexLighting';
export const nativeAmbientState = () => ({enabled:{value:false},directMultiplier:{value:1},color:{value:new Vector3()}});
export type NativeAmbientState = ReturnType<typeof nativeAmbientState>;
/** Generic native prelight and scene lighting saturate at vertices, before
 * interpolation, material/texture modulation and fog. */
export function nativeLitMaterial(parameters: MeshLambertMaterialParameters, surface: number[], ambient = nativeAmbientState()) {
  const material = new MeshLambertMaterial(parameters);
  material.onBeforeCompile = shader => {
    shader.uniforms.nativeContactMultiplier = ambient.directMultiplier;
    shader.uniforms.nativeAmbientEnabled = ambient.enabled;
    shader.uniforms.nativeAmbientColor = ambient.color;
    shader.uniforms.nativeAmbient = { value: surface[0] };
    shader.uniforms.nativeDiffuse = { value: surface[2] };
    const declarations='uniform float nativeContactMultiplier; uniform bool nativeAmbientEnabled; uniform vec3 nativeAmbientColor;\nuniform float nativeAmbient; uniform float nativeDiffuse; varying vec3 vNativeLight;\n';
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
  material.customProgramCacheKey = () => 'native-prelight-gouraud-v3';
  return nativeRasterOutput(material);
}
