import { MeshLambertMaterial, Vector3, type MeshLambertMaterialParameters } from 'three';
export const nativeAmbientState = () => ({enabled:{value:false},color:{value:new Vector3()}});
export type NativeAmbientState = ReturnType<typeof nativeAmbientState>;
/** Scene-lit native material: prelight + ambient/diffuse lighting, clamped before modulation. */
export function nativeLitMaterial(parameters: MeshLambertMaterialParameters, surface: number[], ambient = nativeAmbientState()) {
  const material = new MeshLambertMaterial(parameters);
  material.onBeforeCompile = shader => {
    shader.uniforms.nativeAmbientEnabled = ambient.enabled;
    shader.uniforms.nativeAmbientColor = ambient.color;
    shader.uniforms.nativeAmbient = { value: surface[0] };
    shader.uniforms.nativeDiffuse = { value: surface[2] };
    shader.fragmentShader = 'uniform bool nativeAmbientEnabled; uniform vec3 nativeAmbientColor;\nuniform float nativeAmbient;\nuniform float nativeDiffuse;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #ifdef USE_COLOR_ALPHA
        diffuseColor.a *= vColor.a;
      #endif
    `).replace('#include <lights_lambert_fragment>', `
      LambertMaterial material;
      material.diffuseColor = vec3(1.0);
      material.specularStrength = specularStrength;
    `).replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `
      vec3 ambientLight = nativeAmbientEnabled ? nativeAmbientColor : PI * reflectedLight.indirectDiffuse;
      vec3 nativeLight = PI * nativeDiffuse * reflectedLight.directDiffuse + nativeAmbient * ambientLight;
      #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        nativeLight += vColor.rgb;
      #endif
      vec3 outgoingLight = diffuseColor.rgb * clamp(nativeLight, 0.0, 1.0) + totalEmissiveRadiance;
    `);
  };
  material.customProgramCacheKey = () => 'native-prelight-lambert-v2';
  return material;
}
