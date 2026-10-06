import {requireAsset} from '../assets/binary';
/* TheCamera's script-facing state, pinned gta-reversed ead3051 (`CameraCommands.cpp`, reversed, over
 * `CCamera::Restore` 0x50B930, `RestoreWithJumpCut` 0x50BAB0, `SetCamPositionForFixedMode` 0x50BEC0 and
 * `TakeControlNoEntity` 0x50C8B0). These routines only set fields; the camera itself reads them on its next
 * update, so a host applies this state rather than the runtime moving anything. Native axes. */
/** eCamMode values the script's restore and take-control paths use. */
export const MODE_FOLLOWPED=4,MODE_FIXED=15,MODE_CAM_ON_A_STRING=18,MODE_ATTACHCAM=47;
/** eSwitchType. */
export const SWITCH_INTERPOLATION=0,SWITCH_JUMPCUT=1;
/** m_nModeObbeCamIsInForCar, which both restores set back to thirty. */
export const OBBE_MODE_DEFAULT=30;
export interface Vec3 {x:number;y:number;z:number}
/** What CCamera::Restore asks of the player: whether they are in a vehicle, and whether their ped state is one
 * of the three that force the car camera (ENTER_CAR, CARJACK, OPEN_DOOR) or the one that forces the on-foot
 * camera (EXIT_CAR). */
export interface PlayerCameraState {inVehicle:boolean;enteringCar:boolean;exitingCar:boolean}
export class ScmCamera {
 lookingAtPlayer=true;lookingAtVector=false;
 modeToGoTo=MODE_FOLLOWPED;typeOfSwitch=SWITCH_INTERPOLATION;whoIsInControlOfTheCamera=0;
 /** SET_FIXED_CAMERA_POSITION's source and its up offset. */
 fixedModeSource:Vec3={x:0,y:0,z:0};fixedModeUpOffset:Vec3={x:0,y:0,z:0};
 /** POINT_CAMERA_AT_POINT's target. */
 fixedModeVector:Vec3={x:0,y:0,z:0};
 garageFixedCamPositionSet=false;
 startInterScript=false;restoreByJumpCut=false;cameraJustRestored=false;
 positionAlongSpline=0;startingSpline=false;useNearClipScript=false;
 /** m_fNearClipScript: SET_NEAR_CLIP's plane, used while useNearClipScript holds (either restore clears it). */
 nearClipScript=.9;
 modeObbeCamIsInForCar=OBBE_MODE_DEFAULT;scriptParametersSetForInterp=false;
 /** SET_INTERPOLATION_PARAMETERS (CCamera::SetParametersForScriptInterpolation): the share of the interpolation to
  * stop moving in and to catch up in, as fractions, and its time in ms. */
 scriptPercentageInterToStopMoving=0;scriptPercentageInterToCatchUp=0;scriptTimeForInterpolation=0;
 /** m_bIgnoreFadingStuffForMusic, which SET_MUSIC_DOES_FADE clears: CCamera::Fade leaves the music alone but for a
  * fade out. */
 ignoreFadingStuffForMusic=false;
 enable1rstPersonCamCntrlsScript=false;allow1rstPersonWeaponsCamera=false;
 useScriptZoomValuePed=false;useScriptZoomValueCar=false;avoidTheGeometryProbsTimer=0;
 /** gAllowScriptedFixedCameraCollision, and m_bBlockZoom which the persist-field-of-view command sets. */
 allowFixedCameraCollision=false;
 /** m_aCamTweak's script slot, the fifth: a model with a distance, an altitude and an angle. A reset puts the
  * model back to none and the three numbers to one, one and nothing, which is not all zeroes. */
 readonly cameraTweak={model:-1,distance:1,altitude:1,angle:0};
 setVehicleCameraTweak(model:number,distance:number,altitude:number,angle:number){
  requireAsset([distance,altitude,angle].every(Number.isFinite),'Invalid camera tweak.');
  Object.assign(this.cameraTweak,{model,distance,altitude,angle});
 }
 resetVehicleCameraTweak(){Object.assign(this.cameraTweak,{model:-1,distance:1,altitude:1,angle:0});}
 /** The zoom the script sets goes to the follow-ped camera or the car one, by which mode is active, and to
  * neither in any other mode. */
 zoomFollowPed=0;zoomCamOnAString=0;
 setCameraZoom(zoomMode:number,activeMode:number){
  if(activeMode===MODE_FOLLOWPED)this.zoomFollowPed=zoomMode;
  else if(activeMode===MODE_CAM_ON_A_STRING)this.zoomCamOnAString=zoomMode;
 }
 /** TheCamera::m_nCarZoom and m_bDisableFirstPersonInCar, which the two in-car camera commands set. */
 carZoom=1;disableFirstPersonInCar=false;
 /** SET_PLAYER_IN_CAR_CAMERA_MODE: a zoom of four is refused and leaves the field alone. */
 setCarZoom(zoom:number){if(zoom!==4)this.carZoom=zoom;}
 /** SET_FIRST_PERSON_IN_CAR_CAMERA_MODE, which also drops the zoom back to two when it turns off. */
 setFirstPersonInCar(enabled:boolean){
  this.disableFirstPersonInCar=!enabled;
  if(!enabled)this.carZoom=2;
 }
 /** CCamera::InitialiseScriptableComponents' fields: the zoom lerp and the linear track and move the script
  * drives, plus the two persist flags and the cinema switch. Times are milliseconds, -1 meaning idle. */
 trackLinearStartTime=-1;trackLinearEndTime=-1;moveLinearStartTime=-1;moveLinearEndTime=-1;
 startShakeTime=-1;endShakeTime=-1;startZoomTime=-1;endZoomTime=-1;
 zoomInFactor=0;zoomOutFactor=0;zoomMode=1;
 trackLinearWithEase=true;moveLinearWithEase=true;blockZoom=false;
 cameraPersistPosition=false;cameraPersistTrack=false;cinemaCamera=false;
 vecTrackLinearProcessed=false;vecMoveLinearProcessed=false;fovLerpProcessed=false;
 /** Which entity the camera follows once it is restored: the player's vehicle, or the player. */
 target:'vehicle'|'player'='player';
 /** CCamera::SetCamPositionForFixedMode (0x50BEC0). */
 setCamPositionForFixedMode(source:Vec3,upOffset:Vec3){
  requireAsset([source.x,source.y,source.z,upOffset.x,upOffset.y,upOffset.z].every(Number.isFinite),'Invalid fixed camera position.');
  this.fixedModeSource={...source};this.fixedModeUpOffset={...upOffset};this.garageFixedCamPositionSet=false;
 }
 /** m_pTargetEntity while the script has the camera on an entity (TakeControl), by the script's handle. */
 targetEntity?:{kind:'ped'|'vehicle';handle:number};
 /** CCamera::TakeControl (0x50C7C0): the camera on an entity. Every script command asks with the script's control
  * (CAMCONTROL_SCRIPT, 1); a request with the cinematic camera's (2) yields to the script's unless the cinema camera
  * is on. MODE_NONE means the ped's follow camera or the car's on-a-string one. */
 takeControl(entity:{kind:'ped'|'vehicle';handle:number},mode:number,switchType:number,whoIsInControl:number){
  if(!this.cinemaCamera&&whoIsInControl===2&&this.whoIsInControlOfTheCamera===1)return;
  this.whoIsInControlOfTheCamera=whoIsInControl;
  this.modeToGoTo=mode===0?(entity.kind==='ped'?MODE_FOLLOWPED:MODE_CAM_ON_A_STRING):mode;
  this.targetEntity={...entity};this.typeOfSwitch=switchType;this.attached=undefined;
  this.lookingAtPlayer=false;this.lookingAtVector=false;this.startInterScript=true;
 }
 /** m_pAttachedEntity with m_vecAttachedCamOffset, m_vecAttachedCamLookAt and m_fAttachedCamAngle: the camera
  * riding an entity (MODE_ATTACHCAM), at an offset in its space and looking at a point in its space or at the
  * target entity. */
 attached?:{kind:'ped'|'vehicle';handle:number;offset:Vec3;lookAt?:Vec3;tilt:number};
 /** CCamera::TakeControlAttachToEntity (0x50C910, unreversed in gta-reversed; iOS 0x10022de3c): a cutscene's
  * request (2) yields to the script's (1) unless the cinema camera is on, and the camera goes to MODE_ATTACHCAM on the
  * entity, looking at the target when one is given and at the look-at point otherwise. */
 takeControlAttachToEntity(target:{kind:'ped'|'vehicle';handle:number}|undefined,attached:{kind:'ped'|'vehicle';handle:number},offset:Vec3,lookAt:Vec3|undefined,tilt:number,switchType:number,whoIsInControl:number){
  requireAsset([offset.x,offset.y,offset.z,tilt].every(Number.isFinite)&&(!lookAt||[lookAt.x,lookAt.y,lookAt.z].every(Number.isFinite)),'Invalid attached camera.');
  if(!this.cinemaCamera&&whoIsInControl===2&&this.whoIsInControlOfTheCamera===1)return;
  this.whoIsInControlOfTheCamera=whoIsInControl;this.modeToGoTo=MODE_ATTACHCAM;
  // An offset of nothing is two units up, and a look-at point the same as the offset is the entity's own origin.
  const at=offset.x===0&&offset.y===0&&offset.z===0?{x:0,y:0,z:2}:{...offset};
  const look=lookAt&&(lookAt.x===offset.x&&lookAt.y===offset.y&&lookAt.z===offset.z?{x:0,y:0,z:0}:{...lookAt});
  this.attached={...attached,offset:at,lookAt:look,tilt};
  this.targetEntity=target&&{...target};this.typeOfSwitch=switchType;
  this.lookingAtPlayer=false;this.lookingAtVector=false;this.startInterScript=true;
 }
 /** CCamera::TakeControlNoEntity (0x50C8B0): a request with the cinematic camera's control (2) yields to the
  * script's (1) already in force. */
 takeControlNoEntity(target:Vec3,switchType:number,whoIsInControl:number){
  requireAsset([target.x,target.y,target.z].every(Number.isFinite),'Invalid camera target.');
  if(whoIsInControl===2&&this.whoIsInControlOfTheCamera===1)return;
  this.whoIsInControlOfTheCamera=whoIsInControl;
  this.lookingAtVector=true;this.modeToGoTo=MODE_FIXED;this.lookingAtPlayer=false;this.targetEntity=undefined;this.attached=undefined;
  this.fixedModeVector={...target};this.typeOfSwitch=switchType;this.startInterScript=true;
 }
 /** CCamera::SetNearClipScript (0x50BF90). */
 setNearClipScript(nearClip:number){this.nearClipScript=nearClip;this.useNearClipScript=true;}
 setParametersForScriptInterpolation(stopMoving:number,catchUp:number,timeMs:number){
  this.scriptTimeForInterpolation=timeMs>>>0;this.scriptParametersSetForInterp=true;
  this.scriptPercentageInterToStopMoving=stopMoving/100;this.scriptPercentageInterToCatchUp=catchUp/100;
 }
 /** The body CCamera::Restore and RestoreWithJumpCut share: both hand the camera back to the player, pick the
  * mode from what the player is doing, and reset the script's interpolation fields. */
 private restoreCommon(player:PlayerCameraState){
  this.lookingAtPlayer=true;this.lookingAtVector=false;this.targetEntity=undefined;this.attached=undefined;
  this.whoIsInControlOfTheCamera=0;this.positionAlongSpline=0;this.startingSpline=false;
  this.useNearClipScript=false;this.modeObbeCamIsInForCar=OBBE_MODE_DEFAULT;this.scriptParametersSetForInterp=false;
  this.modeToGoTo=player.inVehicle?MODE_CAM_ON_A_STRING:MODE_FOLLOWPED;
  this.target=player.inVehicle?'vehicle':'player';
  if(player.enteringCar)this.modeToGoTo=MODE_CAM_ON_A_STRING;
  if(player.exitingCar){this.modeToGoTo=MODE_FOLLOWPED;this.target='player';}
 }
 /** CCamera::Restore (0x50B930): an interpolated hand-back, which also clears the first-person and zoom
  * overrides and the geometry timer. */
 restore(player:PlayerCameraState){
  this.restoreCommon(player);
  this.typeOfSwitch=SWITCH_INTERPOLATION;
  this.enable1rstPersonCamCntrlsScript=false;this.allow1rstPersonWeaponsCamera=false;
  this.useScriptZoomValuePed=false;this.useScriptZoomValueCar=false;this.avoidTheGeometryProbsTimer=0;
  this.startInterScript=true;this.cameraJustRestored=true;
 }
 /** CCamera::RestoreWithJumpCut (0x50BAB0): the same hand-back, cut rather than interpolated, and it leaves the
  * first-person and zoom overrides alone. */
 restoreWithJumpCut(player:PlayerCameraState){
  this.restoreByJumpCut=true;
  this.restoreCommon(player);
  this.typeOfSwitch=SWITCH_JUMPCUT;
  this.startInterScript=true;
 }
 /** CamShakeNoPos's force and the time it started, and AddShakeSimple's own intensity and type. */
 camShakeForce=0;camShakeStart=0;shakeIntensity=0;shakeType=1;
 /** MAP_Z_LOW_LIMIT: a point at or below this asks the world for its ground instead. */
 static readonly MAP_Z_LOW_LIMIT=-100;
 /** CamShakeNoPos (0x50A970): a new shake only takes over when it is stronger than what is left of the last
  * one, which decays by one unit a second and is read between nothing and two. */
 camShakeNoPos(strength:number,nowMs:number){
  requireAsset(Number.isFinite(strength),'Invalid camera shake strength.');
  const left=this.camShakeForce-(nowMs-this.camShakeStart)/1000;
  if(strength>Math.min(2,Math.max(0,left))){this.camShakeForce=strength;this.camShakeStart=nowMs;}
 }
 /** CCamera::CamShake (0x50A790): the strength, 0.35 of it and less by the point's distance from the camera (nothing
  * from 100 units), takes over when it beats what is left of the current shake at that distance. */
 camShake(strength:number,distance:number,nowMs:number){
  requireAsset(Number.isFinite(strength)&&Number.isFinite(distance),'Invalid camera shake.');
  const percent=1-Math.min(100,Math.max(0,distance))/100;
  const left=(this.camShakeForce-(nowMs-this.camShakeStart)/1000)*percent,force=percent*strength*.35;
  if(force>Math.min(2,Math.max(0,left))){this.camShakeForce=force;this.camShakeStart=nowMs;}
 }
 /** What is left of the shake: the force less a unit a second, read between nothing and two. */
 shakeLeft(nowMs:number){return Math.min(2,Math.max(0,this.camShakeForce-(nowMs-this.camShakeStart)/1000));}
 /** CCamera::AddShakeSimple (0x50D2A0 region): a shake of its own intensity and type over a span. */
 addShakeSimple(durationMs:number,type:number,intensity:number,nowMs:number){
  requireAsset(Number.isFinite(durationMs),'Invalid camera shake duration.');
  this.shakeIntensity=intensity;this.shakeType=type;this.startShakeTime=nowMs;this.endShakeTime=nowMs+durationMs;
 }
 /** CCamera::VectorMoveRunning and VectorTrackRunning: the clock has not passed the end of the move. */
 vectorMoveRunning(nowMs:number){return nowMs<=this.moveLinearEndTime;}
 vectorTrackRunning(nowMs:number){return nowMs<=this.trackLinearEndTime;}
 /** CCamera::InitialiseScriptableComponents (0x50D2D0). */
 initialiseScriptableComponents(){
  this.trackLinearStartTime=-1;this.trackLinearEndTime=-1;this.startShakeTime=-1;this.endShakeTime=-1;
  this.endZoomTime=-1;this.startZoomTime=-1;this.zoomInFactor=0;this.zoomOutFactor=0;
  this.trackLinearWithEase=true;this.zoomMode=1;this.moveLinearWithEase=true;
  this.moveLinearStartTime=-1;this.moveLinearEndTime=-1;this.blockZoom=false;
  this.cameraPersistPosition=false;this.cameraPersistTrack=false;
  this.vecTrackLinearProcessed=false;this.vecMoveLinearProcessed=false;this.fovLerpProcessed=false;
 }
 /** The field of view CCamera::ProcessFOVLerp works out at `nowMs` (iOS, inlined in ProcessScriptedCommands at
  * 0x10022a824; CCam::Process then sets it on the camera, 0x10020f784): from the zoom-in factor to the zoom-out one
  * as the vector lerps run, eased when the zoom mode is 1, and after the end time held at the last value worked out
  * only while CAMERA_PERSIST_FOV's m_bBlockZoom is set. Nothing when no zoom applies. */
 private lastFov?:number;
 fovValue(nowMs:number){
  const value=linearPoint(this.startZoomTime,this.endZoomTime,{x:this.zoomInFactor,y:0,z:0},{x:this.zoomOutFactor,y:0,z:0},this.zoomMode===1,nowMs)?.x;
  if(value!==undefined){this.lastFov=value;return value;}
  return this.blockZoom&&this.startZoomTime>=0&&nowMs>this.endZoomTime?this.lastFov:undefined;
 }
 /** CCamera::LerpFOV (0x50D280): the zoom runs from now to now plus the limit, easing when the script says so. */
 lerpFOV(zoomInFactor:number,zoomOutFactor:number,timeLimit:number,ease:boolean,nowMs:number){
  requireAsset(Number.isFinite(timeLimit),'Invalid camera zoom time.');
  this.startZoomTime=nowMs;this.endZoomTime=nowMs+timeLimit;
  this.zoomMode=ease?1:0;this.zoomInFactor=zoomInFactor;this.zoomOutFactor=zoomOutFactor;
 }
 /* CCamera::VectorTrackLinear (0x50D1D0) and VectorMoveLinear (0x50D160), whose own bodies still call into the
  * executable. What the commands settle is the fields they fill: the two points, how long it runs and whether
  * it eases. Both commands give the script's from first and its to second, and both routines take the to
  * first, so the pair is swapped on the way in; keeping the script's own order here would put the camera at
  * the wrong end. The track command's duration is a whole number of milliseconds and the move's is a float. */
 readonly trackLinearFrom:Vec3={x:0,y:0,z:0};readonly trackLinearTo:Vec3={x:0,y:0,z:0};
 readonly moveLinearFrom:Vec3={x:0,y:0,z:0};readonly moveLinearTo:Vec3={x:0,y:0,z:0};
 vectorTrackLinear(from:Vec3,to:Vec3,duration:number,ease:boolean,nowMs:number){
  requireAsset(Number.isFinite(duration),'Invalid camera track duration.');
  requireAsset([from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite),'Invalid camera track points.');
  Object.assign(this.trackLinearFrom,from);Object.assign(this.trackLinearTo,to);
  this.trackLinearStartTime=nowMs;this.trackLinearEndTime=nowMs+duration;
  this.trackLinearWithEase=ease;this.vecTrackLinearProcessed=false;this.lookingAtVector=true;
 }
 vectorMoveLinear(from:Vec3,to:Vec3,duration:number,ease:boolean,nowMs:number){
  requireAsset(Number.isFinite(duration),'Invalid camera move duration.');
  requireAsset([from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite),'Invalid camera move points.');
  Object.assign(this.moveLinearFrom,from);Object.assign(this.moveLinearTo,to);
  this.moveLinearStartTime=nowMs;this.moveLinearEndTime=nowMs+duration;
  this.moveLinearWithEase=ease;this.vecMoveLinearProcessed=false;
 }
 /** Where the script's linear move has the camera and where its linear track has it look, at `nowMs`, or nothing
  * where none applies. ProcessVectorMoveLinear and ProcessVectorTrackLinear are unreversed in gta-reversed; the iOS
  * ones (inlined at 0x10022e2b0 and 0x10022e18c) are followed. While now is within the window the point is from +
  * ratio × (to − from), the ratio (1 − cos πr) / 2 when the script asks for ease. Once the time is up, nothing applies
  * unless the matching persist flag (CAMERA_PERSIST_POS, CAMERA_PERSIST_TRACK) is set; then the last point worked
  * out inside the window holds, short of the far end by up to a frame's share. InitialiseScriptableComponents ends
  * both. */
 private lastMovePoint?:Vec3;private lastTrackPoint?:Vec3;
 moveLinearPoint(nowMs:number){
  const point=linearPoint(this.moveLinearStartTime,this.moveLinearEndTime,this.moveLinearFrom,this.moveLinearTo,this.moveLinearWithEase,nowMs);
  if(point){this.lastMovePoint=point;return point;}
  return this.cameraPersistPosition&&this.moveLinearStartTime>=0&&nowMs>this.moveLinearEndTime?this.lastMovePoint:undefined;
 }
 trackLinearPoint(nowMs:number){
  const point=linearPoint(this.trackLinearStartTime,this.trackLinearEndTime,this.trackLinearFrom,this.trackLinearTo,this.trackLinearWithEase,nowMs);
  if(point){this.lastTrackPoint=point;return point;}
  return this.cameraPersistTrack&&this.trackLinearStartTime>=0&&nowMs>this.trackLinearEndTime?this.lastTrackPoint:undefined;
 }
 snapshot(){return {mode:this.modeToGoTo,switch:this.typeOfSwitch,control:this.whoIsInControlOfTheCamera,target:this.target,
  lookingAtPlayer:this.lookingAtPlayer,lookingAtVector:this.lookingAtVector,
  source:{...this.fixedModeSource},offset:{...this.fixedModeUpOffset},at:{...this.fixedModeVector}};}
}

function linearPoint(start:number,end:number,from:Vec3,to:Vec3,ease:boolean,nowMs:number):Vec3|undefined{
 if(start<0||nowMs<start||nowMs>end)return undefined;
 let ratio=end>start?(nowMs-start)/(end-start):1;
 if(ease)ratio=(Math.sin((ratio-.5)*Math.PI)+1)/2;
 return {x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio,z:from.z+(to.z-from.z)*ratio};
}
