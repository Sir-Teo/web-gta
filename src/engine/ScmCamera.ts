import {requireAsset} from '../assets/binary';
/* TheCamera's script-facing state, pinned gta-reversed ead3051 (`CameraCommands.cpp`, reversed, over
 * `CCamera::Restore` 0x50B930, `RestoreWithJumpCut` 0x50BAB0, `SetCamPositionForFixedMode` 0x50BEC0 and
 * `TakeControlNoEntity` 0x50C8B0). These routines only set fields; the camera itself reads them on its next
 * update, so a host applies this state rather than the runtime moving anything. Native axes. */
/** eCamMode values the script's restore and take-control paths use. */
export const MODE_FOLLOWPED=4,MODE_FIXED=15,MODE_CAM_ON_A_STRING=18;
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
 modeObbeCamIsInForCar=OBBE_MODE_DEFAULT;scriptParametersSetForInterp=false;
 enable1rstPersonCamCntrlsScript=false;allow1rstPersonWeaponsCamera=false;
 useScriptZoomValuePed=false;useScriptZoomValueCar=false;avoidTheGeometryProbsTimer=0;
 /** Which entity the camera follows once it is restored: the player's vehicle, or the player. */
 target:'vehicle'|'player'='player';
 /** CCamera::SetCamPositionForFixedMode (0x50BEC0). */
 setCamPositionForFixedMode(source:Vec3,upOffset:Vec3){
  requireAsset([source.x,source.y,source.z,upOffset.x,upOffset.y,upOffset.z].every(Number.isFinite),'Invalid fixed camera position.');
  this.fixedModeSource={...source};this.fixedModeUpOffset={...upOffset};this.garageFixedCamPositionSet=false;
 }
 /** CCamera::TakeControlNoEntity (0x50C8B0): a request from the script (2) yields to one already in force
  * from a cutscene (1). */
 takeControlNoEntity(target:Vec3,switchType:number,whoIsInControl:number){
  requireAsset([target.x,target.y,target.z].every(Number.isFinite),'Invalid camera target.');
  if(whoIsInControl===2&&this.whoIsInControlOfTheCamera===1)return;
  this.whoIsInControlOfTheCamera=whoIsInControl;
  this.lookingAtVector=true;this.modeToGoTo=MODE_FIXED;this.lookingAtPlayer=false;
  this.fixedModeVector={...target};this.typeOfSwitch=switchType;this.startInterScript=true;
 }
 /** The body CCamera::Restore and RestoreWithJumpCut share: both hand the camera back to the player, pick the
  * mode from what the player is doing, and reset the script's interpolation fields. */
 private restoreCommon(player:PlayerCameraState){
  this.lookingAtPlayer=true;this.lookingAtVector=false;
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
 snapshot(){return {mode:this.modeToGoTo,switch:this.typeOfSwitch,control:this.whoIsInControlOfTheCamera,target:this.target,
  lookingAtPlayer:this.lookingAtPlayer,lookingAtVector:this.lookingAtVector,
  source:{...this.fixedModeSource},offset:{...this.fixedModeUpOffset},at:{...this.fixedModeVector}};}
}
