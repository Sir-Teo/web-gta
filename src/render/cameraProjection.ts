import type {PerspectiveCamera} from 'three';

// Chosen baseline, not a reconstruction of the unreversed follow-ped/vehicle modes.
export const GAME_CAMERA_FOV = 70;

/** CameraSize's non-exclusive viewport branch. The source FOV belongs to the
 * larger viewport axis; Three.js expects a vertical angle instead. */
export function windowedCameraProjection(width:number,height:number,sourceFov:number){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
    !Number.isFinite(sourceFov)||sourceFov<=0||sourceFov>=180){
    throw new Error('Camera projection requires positive viewport dimensions and FOV between 0 and 180 degrees');
  }
  const aspect=width/height,window=Math.tan(sourceFov*Math.PI/360);
  const viewWindowX=window*Math.min(1,aspect),viewWindowY=window*Math.min(1,1/aspect);
  return {aspect,viewWindowX,viewWindowY,verticalFov:Math.atan(viewWindowY)*360/Math.PI};
}

export function applyWindowedCameraProjection(camera:PerspectiveCamera,width:number,height:number,sourceFov:number){
  const projection=windowedCameraProjection(width,height,sourceFov);
  camera.aspect=projection.aspect;camera.fov=projection.verticalFov;camera.updateProjectionMatrix();
}
