import type {ModelMaterialBinding} from '../assets/ModelObjects';
/** CVehicleModelInfo::SetDirtTextures: a car's dirt materials (the ones drawn with vehicle.txd's vehiclegrunge256) take
 * CCarFXRenderer's dirt texture for the car's m_fDirtLevel (0 to 15). InitialiseDirtTexture, which builds the sixteen
 * textures, is unreversed; its known reimplementation fades each texel toward white, texel / 16 × level +
 * (4080 − level × 255) / 16, which is mix(white, texel, level / 16) — done here in the material's shader. */
export function bindNativeCarDirt(bindings:readonly ModelMaterialBinding[]){
 const amount={value:0};let count=0;
 for(const {material,texture} of bindings){
  if(texture?.name.toLowerCase()!=='vehiclegrunge256'||!material.map)continue;count++;
  const previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
   previous(shader,renderer);
   shader.uniforms.nativeDirt=amount;
   shader.fragmentShader='uniform float nativeDirt;\n'+shader.fragmentShader.replace('#include <map_fragment>',
    '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n sampledDiffuseColor.rgb = mix( vec3( 1.0 ), sampledDiffuseColor.rgb, nativeDirt );\n diffuseColor *= sampledDiffuseColor;\n#endif');
  };
  material.customProgramCacheKey=()=>key()+'|native-car-dirt';
  material.needsUpdate=true;
 }
 return {count,setLevel(level:number){amount.value=(Math.trunc(level)&15)/16;}};
}
