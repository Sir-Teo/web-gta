import type {NativeFootstepFiles} from './nativeFootsteps';
/** Optional original environment files travel with a local scene, never as URLs. */
export interface SceneEnvironmentFiles { footsteps?:NativeFootstepFiles; surfaceAudio?:File; surfaceInfo?:File; lighting?:File; water?:File; particle?:File; weather?:number; }
