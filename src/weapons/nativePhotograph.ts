import {Vector3,type Camera} from 'three';
/** CWeapon::TakePhotograph (0x73C1F0): what a photo catches. A point counts when it lies within 125 units of the
 * camera and projects inside the middle 80% of the screen both ways, with a clear line of sight (the caller's).
 * The reference tests peds as within 125 and, after a refactor, objects as at least 125 away; both are taken as
 * within 125 here, the reading consistent with the peds. */
export const PHOTO_RANGE=125;
export function inPhotograph(camera:Camera,point:{x:number;y:number;z:number}){
 camera.updateMatrixWorld();
 const at=new Vector3(point.x,point.y,point.z),from=new Vector3().setFromMatrixPosition(camera.matrixWorld);
 if(at.distanceToSquared(from)>=PHOTO_RANGE*PHOTO_RANGE)return false;
 // CSprite::CalcScreenCoors refuses points behind the camera.
 const view=at.clone().applyMatrix4(camera.matrixWorldInverse);if(view.z>=0)return false;
 const ndc=at.project(camera),x=(ndc.x+1)/2,y=(1-ndc.y)/2;
 return x>.1&&x<.9&&y>.1&&y<.9;
}
