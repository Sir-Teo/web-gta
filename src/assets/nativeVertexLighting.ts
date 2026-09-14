/** Generic RenderWare ordering: accumulate and saturate before interpolation.
 * Light inputs/attenuation remain supplied by the browser's scene adapter. */
export const nativeVertexLighting = `
 float nativeNormalLength = length(transformedNormal);
 vec3 nativeNormal = nativeNormalLength > 0.0 ? transformedNormal / nativeNormalLength : vec3(0.0);
 vec3 nativeDirect = vec3(0.0);
 IncidentLight nativeIncident;
 #if NUM_DIR_LIGHTS > 0
  for(int i=0;i<NUM_DIR_LIGHTS;i++){
   getDirectionalLightInfo(directionalLights[i],nativeIncident);
   nativeDirect += max(dot(nativeNormal,nativeIncident.direction),0.0)*nativeIncident.color;
  }
 #endif
 #if NUM_SUN_LIGHTS > 0
  for(int i=0;i<NUM_SUN_LIGHTS;i++){
   getSunLightInfo(sunLights[i],nativeIncident);
   nativeDirect += max(dot(nativeNormal,nativeIncident.direction),0.0)*nativeIncident.color;
  }
 #endif
 #if NUM_POINT_LIGHTS > 0
  for(int i=0;i<NUM_POINT_LIGHTS;i++){
   getPointLightInfo(pointLights[i],mvPosition.xyz,nativeIncident);
   nativeDirect += max(dot(nativeNormal,nativeIncident.direction),0.0)*nativeIncident.color;
  }
 #endif
 #if NUM_SPOT_LIGHTS > 0
  for(int i=0;i<NUM_SPOT_LIGHTS;i++){
   getSpotLightInfo(spotLights[i],mvPosition.xyz,nativeIncident);
   nativeDirect += max(dot(nativeNormal,nativeIncident.direction),0.0)*nativeIncident.color;
  }
 #endif
 vec3 nativeIndirect = ambientLightColor;
 #if NUM_HEMI_LIGHTS > 0
  for(int i=0;i<NUM_HEMI_LIGHTS;i++)nativeIndirect += getHemisphereLightIrradiance(hemisphereLights[i],nativeNormal);
 #endif
 #ifdef USE_LIGHT_PROBES
  nativeIndirect += getLightProbeIrradiance(lightProbe,nativeNormal);
 #endif
 vec3 nativeLight = nativeAmbient * (nativeAmbientEnabled ? nativeAmbientColor : nativeIndirect);
 nativeLight += nativeDiffuse * nativeDirect * (nativeAmbientEnabled ? nativeContactMultiplier : 1.0);
 #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
  nativeLight += vColor.rgb;
 #endif
 vNativeLight = clamp(nativeLight,0.0,1.0);
`;
