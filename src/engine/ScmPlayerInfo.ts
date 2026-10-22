import {requireAsset} from '../assets/binary';
/* The CPlayerInfo fields a script sets, with the CWanted back-off flags, the two-player statics of CGameLogic
 * and the crane CRopes hands the player. Pinned gta-reversed ead3051: every command below is reversed in
 * `Scripts/Commands/PlayerCommands.cpp`, and the defaults are CPlayerInfo::Clear's own. Only the fields the
 * script reaches are kept; the ped those fields belong to is a host's. */
/** eControlledCrane. */
export const CRANE_NONE=0,CRANE_MAGNO=1,CRANE_WRECKING_BALL=2,CRANE_LAS_VEGAS=3,CRANE_QUARRY=4;
export class ScmPlayerInfo {
 /** m_bDoesNotGetTired, m_bFastReload and m_bFireProof, all off after a clear. */
 doesNotGetTired=false;fastReload=false;fireProof=false;
 /** The player ped's CantBeKnockedOffBike, which SET_CHAR_CAN_BE_KNOCKED_OFF_BIKE sets: the ped keeps it through
  * death and arrest (only CGameLogic::Remove2ndPlayerIfPresent clears it), so it lives here with the player's other
  * script switches. */
 stayOnBike=false;
 /** m_bCanDoDriveBy, which a clear leaves on. */
 canDoDriveBy=true;
 /** m_nMaxHealth and m_nMaxArmour, a hundred each. */
 maxHealth=100;maxArmour=100;
 /** m_PlayerData's sprint and group switches, both of which the commands give the other way round: the script
  * asks for sprint to be disabled and for recruitment to be enabled. */
 sprintDisabled=false;groupStuffDisabled=false;
 /** m_nDrunkenness and m_nFadeDrunkenness. */
 drunkenness=0;fadeDrunkenness=0;
 /** CWanted's m_bPoliceBackOff and m_bEverybodyBackOff, read and written on the player's own CWanted. */
 get policeBackOff(){return this.wanted().policeBackOff;}
 set policeBackOff(on:boolean){this.wanted().policeBackOff=on;}
 get everybodyBackOff(){return this.wanted().everybodyBackOff;}
 set everybodyBackOff(on:boolean){this.wanted().everybodyBackOff=on;}
 constructor(private readonly wanted:()=>{policeBackOff:boolean;everybodyBackOff:boolean}){}
 /** CGameLogic's two-player statics. */
 limitPlayerDistance=false;maxPlayerDistance=0;
 playersCannotTargetEachOther=false;playersCanBeInSeparateCars=false;
 /** CRopes::PlayerControlsCrane and the water fog the crane commands switch with it. */
 controlsCrane=CRANE_NONE;waterFogScript=true;
 /** m_PlayerData.m_bCanBeDamaged, which MakePlayerSafe sets the other way from safety. */
 canBeDamaged=true;
 /** CPlayerPedData::m_nModelIndexOfLastBuildingShot for the two player slots; Init leaves each at -1. */
 readonly lastBuildingModelsShot=new Int32Array([-1,-1]);
 /** CCutsceneMgr::ms_cutsceneProcessing, which the cutscene-safe command sets. */
 cutsceneProcessing=false;
 /** INCREASE_PLAYER_MAX_HEALTH: the maximum goes up by the amount and the ped is filled to it. The command
  * takes a byte, so the field wraps as the byte it is. */
 increaseMaxHealth(amount:number){
  requireAsset(Number.isInteger(amount),'Invalid health increase.');
  this.maxHealth=(this.maxHealth+amount)&0xff;return this.maxHealth;
 }
 /** INCREASE_PLAYER_MAX_ARMOUR, the same for armour. */
 increaseMaxArmour(amount:number){
  requireAsset(Number.isInteger(amount),'Invalid armour increase.');
  this.maxArmour=(this.maxArmour+amount)&0xff;return this.maxArmour;
 }
 /** SET_PLAYER_DRUNKENNESS: the intensity is a byte, and the fade starts again from nothing. A host clears the
  * drunk blur when the script asks for none. */
 setDrunkenness(intensity:number){
  requireAsset(Number.isInteger(intensity),'Invalid drunkenness.');
  this.drunkenness=intensity&0xff;this.fadeDrunkenness=0;
 }
}
