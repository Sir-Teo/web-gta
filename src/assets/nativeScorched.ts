import type {Material} from 'three';
/** CObject::SetupLighting's WorldReplaceNormalLightsWithScorched: 0.18 grey ambient, no normal lights.
 * Keep the uniform on each material so placement copies can change independently of their shared source. */
export function nativeScorchedUniform(material:Material):{value:boolean}{
 return material.userData.nativeRenderScorched??=( {value:false} );
}
export function setNativeScorched(material:Material,state:boolean){nativeScorchedUniform(material).value=state;}
