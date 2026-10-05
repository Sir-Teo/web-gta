import {characterShadowBounds} from './characterShadowBounds';
import {HEAD_EFFECTOR_OFFSET,LOOK_AT_SPEED,applyQuat,limitHead,moveHeadToTarget,quatToEulerDeg,slerpQuat,startLookAt,stepLookAt,type LookAtTask,type Quat} from '../simulation/nativeIkLookAt';
import {playerMoveBlend} from '../animation/playerMoveBlend';
import {STAMINA_EXHAUST_FLOOR} from '../locomotion/player';
import {bindPlayerShoulders} from '../animation/playerShoulders';
import { nativeAmbientState } from '../assets/nativeMaterial';
import {nativePlayerMaterial} from './nativePlayerMaterial';
import { MotionTransition } from '../animation/MotionTransition';
import { PoseTransition } from '../animation/PoseTransition';
import { armChain, stepIkBlend, type NativeIkChain } from '../animation/nativeIkChain';
import { Group, Quaternion, MeshBasicMaterial, Matrix4, Object3D, Mesh, Vector3, type SkinnedMesh, type BufferAttribute, type DataTexture } from 'three';
import { bindAnimation,withoutForeignTracks} from '../animation/bind';
import { locomotionMotion } from '../animation/locomotion';
import { swimMotion, swimRootTrack } from '../animation/swimMotion';
import { modelObject } from '../assets/ModelObjects';
import type { DffModel } from '../assets/dff';
import type { NativeAnimation } from '../assets/ifp';
import type { ModelTexture } from '../assets/modelTextures';
import type { Controls, Simulation } from '../simulation/Simulation';
import { NativeMoveAnims, type MoveClip } from '../animation/nativeMoveAnims';
import { NativeGunMoveAnims, GUN_MOVES, type GunMoveClip } from '../animation/nativeGunMoveAnims';
import type { DuckMoveClip } from '../locomotion/nativeDuck';
export interface CharacterClip { clip: NativeAnimation; track?: number; forwardMotion?: boolean }
/** Swim roles by CTaskSimpleSwim clip: tread and glide hold station. */
export type SwimAction = 'swimTread' | 'swimBreast' | 'swimCrawl' | 'swimUnder' | 'swimGlide' | 'swimDive';
export type SwimRole = Partial<Record<'tread' | 'breast' | 'crawl' | 'under' | 'glide' | 'dive', CharacterClip>>;
export type CharacterConvention = 'feet' | 'san-andreas-ped';
export interface CharacterSource { playerBody?: boolean; convention?: CharacterConvention; model: DffModel; textures: ModelTexture[]; clip: NativeAnimation; track: number; idle?: CharacterClip; run?: CharacterClip; sprint?: CharacterClip; crouchIdle?: CharacterClip; crouchWalk?: CharacterClip; crouchWalkBack?: CharacterClip; crouchRollL?: CharacterClip; crouchRollR?: CharacterClip; airborne?: CharacterClip; fallGlide?: CharacterClip; landing?: CharacterClip; landingMoving?: CharacterClip; launch?: CharacterClip; launchRight?: CharacterClip; swim?: SwimRole;
  /** WALK_start, Run_stop and Run_stopR: with idle, walk, run and sprint they drive a player body through CPlayerPed::SetRealMoveAnim. */
  walkStart?: CharacterClip; runStop?: CharacterClip; runStopR?: CharacterClip;
  /** Gun_stand and GunMove_FWD/BWD/L/R: CTaskSimpleUseGun's stance and strafes while a gun is aimed. */
  gunStand?: CharacterClip; gunMoveFwd?: CharacterClip; gunMoveBwd?: CharacterClip; gunMoveL?: CharacterClip; gunMoveR?: CharacterClip;
  /** FIGHTIDLE and FightSH_FWD/BWD/Left/Right: CTaskSimpleFight's stance and shuffles while a melee weapon is targeted. */
  fightIdle?: CharacterClip; fightShFwd?: CharacterClip; fightShBwd?: CharacterClip; fightShL?: CharacterClip; fightShR?: CharacterClip }
type Action = 'idle' | 'walk' | 'run' | 'sprint' | 'crouchIdle' | 'crouchWalk' | 'crouchWalkBack' | 'crouchRollL' | 'crouchRollR' | 'airborne' | 'fallGlide' | 'landing' | 'landingMoving' | 'launch' | 'launchRight' | SwimAction | 'walkStart' | 'runStop' | 'runStopR' | 'move' | 'gunStand' | 'gunMoveFwd' | 'gunMoveBwd' | 'gunMoveL' | 'gunMoveR' | 'gunMove' | 'fightIdle' | 'fightShFwd' | 'fightShBwd' | 'fightShL' | 'fightShR' | 'fightMove';
/** CTaskSimpleUseGun's clips by association: the stance, the arm-aimed idle and the four strafes. */
const GUN_ACTIONS: Record<GunMoveClip, Action> = { stand: 'gunStand', idle: 'idle', fwd: 'gunMoveFwd', bwd: 'gunMoveBwd', left: 'gunMoveL', right: 'gunMoveR' };
/** CTaskSimpleFight's stance and shuffles by the same associations: the stance stands in for the idle, and the move of
 * the stick's dominant direction blends in (the gun task's aimed-with-arm rule). */
const FIGHT_ACTIONS: Record<GunMoveClip, Action> = { stand: 'fightIdle', idle: 'fightIdle', fwd: 'fightShFwd', bwd: 'fightShBwd', left: 'fightShL', right: 'fightShR' };
const MOVE_CLIPS = ['idle', 'walkStart', 'walk', 'run', 'sprint', 'runStop', 'runStopR'] as const;
const LOOPED_MOVES = new Set<MoveClip>(['idle', 'walk', 'run', 'sprint']);
const idleAction = (action: Action) => action === 'idle' || action === 'crouchIdle' || action === 'gunStand' || action === 'fightIdle' || action === 'swimTread' || action === 'swimGlide' || action === 'swimDive';
const launchAction = (action: Action) => action === 'launch' || action === 'launchRight';
const landingAction = (action: Action) => action === 'landing' || action === 'landingMoving';
const airborneAction = (action: Action) => action === 'airborne' || action === 'fallGlide';
const oneShot = (action: Action) => airborneAction(action) || landingAction(action) || launchAction(action);
/** CROUCH_ROLL_L/R play once from their first frame. */
const rollAction = (action: Action) => action === 'crouchRollL' || action === 'crouchRollR';
/** CTaskSimpleDuck::SetMoveAnim's clips by move command. */
const DUCK_ACTIONS = { fwd: 'crouchWalk', bwd: 'crouchWalkBack', rollL: 'crouchRollL', rollR: 'crouchRollR', stop: 'crouchIdle' } as const satisfies Record<DuckMoveClip, Action>;
const TRANSITION_SECONDS = .18;
/** Session-local native locomotion. The simulation owns time and physical position. */
export class NativeCharacter {
  readonly root = new Group();
  private ambient = nativeAmbientState();
  private owner: ReturnType<typeof modelObject>;
  private shoulders?: ReturnType<typeof bindPlayerShoulders>;
  private clips: Partial<Record<Action, { binding: ReturnType<typeof bindAnimation>; motion?: { between(fromSeconds: number, toSeconds: number, parentToWorld: Matrix4, loop?: boolean): { x: number; y?: number; z: number } }; parent: Matrix4; duration: number }>> = {};
  private reactions = new Map<string, ReturnType<typeof bindAnimation>>();
  private weaponPose?:string;
  /** The aim pose shown: the weapon's fire clip held at weapon.dat's loop start (CTaskSimpleUseGun::StartAnim with
   * GetAnimLoopStart), kept after aiming ends so the pose can blend out. */
  private aimPose?:{name:string;time:number};
  /** The aim clip's blend amount (m_Anim->GetBlendAmount()): in at 8 per second, out at 8, and at 4 while a weapon
   * without bMoveAim lowers it on the move. PointGunInDirection and the arm scale by it. */
  private aimBlend=0;
  private aimTransition?:PoseTransition;
  /** g_ikChainMan.PointArm for weapons aimed with the arm (CTaskSimpleUseGun::AimGun): the chain per arm, the time of
   * its blend target, and the IK clock. The solver steps once per 30 Hz frame of the PC game. */
  private pointArm?:{chains:NativeIkChain[];targetTimeMs:number;target:number;point:Vector3};
  private ikClockMs=0;private ikFrameMs=0;
  /** CPed::m_fCurrentRotation as rendered, for the torso's aim yaw. */
  private renderedHeading=0;
  /** CPed::m_fCurrentRotation at the start of the last fixed step, so the body turns smoothly between steps. */
  private stepHeading?:number;
  /** Find3rdPersonCamTargetVector's point the arm or torso points at, when the host supplies one. */
  private weaponAimPoint?:Vector3;
  private weaponReload?:{name:string;progress:number};
  setWeaponReload(name?:string,progress=0){this.weaponReload=name?{name,progress:Math.max(0,Math.min(1,progress))}:undefined;}
  private weaponAim?:Vector3;
  private twinAim=false;
  private armAim=false;
  /** `arm` follows CTaskSimpleUseGun::AimGun: standing AIMWITHARM weapons point the arm, otherwise the torso turns. */
  setWeaponAim(direction?:Vector3,twin=false,arm=false,point?:Vector3){
    // The last aim is kept while the aim clip blends out, so the correction fades with it rather than snapping off.
    if(direction){this.weaponAim=direction.clone();this.weaponAimPoint=point?.clone();}else if(this.aimBlend<=0){this.weaponAim=undefined;this.weaponAimPoint=undefined;}
    this.twinAim=twin;this.armAim=arm;}
  private bones=new Map<number,Object3D|undefined>();
  private bone(id:number){
    if(this.bones.has(id))return this.bones.get(id);
    const index=this.source.model.frames.findIndex(f=>f.hanim?.id===id);let bone:Object3D|undefined;this.owner.root.traverse(o=>{if(o.userData.nativeFrame===index)bone=o;});
    this.bones.set(id,bone);return bone;
  }
  /** The bone's world matrix (RpHAnimHierarchyGetMatrixArray's entry), or undefined without that bone. */
  boneMatrix(id:number,out=new Matrix4()){const bone=this.bone(id);if(!bone)return undefined;return out.copy(this.worldOf(bone));}
  /** CPed::GetTransformedBonePosition in the world, or undefined without that bone. */
  bonePosition(id:number,out=new Vector3()){const bone=this.bone(id);if(!bone)return undefined;return out.setFromMatrixPosition(this.worldOf(bone));}
  /** A node's world matrix from the character root down its ancestors' local matrices, without walking the whole
   * skeleton (three's parent-only update does not refresh a child under a parent that just moved). */
  private worldOf(node:Object3D){
    const root=this.root;root.updateWorldMatrix(true,false);
    if(node===root)return node.matrixWorld;
    const chain=this.chainScratch;chain.length=0;let o:Object3D|null=node;for(;o&&o!==root;o=o.parent)chain.push(o);
    if(!o){node.updateWorldMatrix(true,false);return node.matrixWorld;}
    const m=this.worldScratch.copy(root.matrixWorld);
    for(let i=chain.length-1;i>=0;i--){const o=chain[i];if(o.matrixAutoUpdate)o.updateMatrix();m.multiply(o.matrix);}
    return m;
  }
  private chainScratch:Object3D[]=[];private worldScratch=new Matrix4();
  /** CPed::GetTransformedBonePosition(BONE_HEAD) in the world, or undefined without a head bone. */
  headPosition(out=new Vector3()){return this.bonePosition(5,out);}
  /** Rotate a native bone in its parent space so the hand's +X barrel follows the aim. */
  private pointBone(boneId:number,handId:number,weight=1){
    const hand=this.hand(handId),bone=this.bone(boneId);if(!hand||!bone?.parent||!this.weaponAim||weight<=0)return;
    this.root.updateWorldMatrix(true,true);
    // The barrel converges on the target point where there is one, rather than running parallel to the camera ray.
    const aim=this.weaponAimPoint?this.weaponAimPoint.clone().sub(new Vector3().setFromMatrixPosition(hand.matrixWorld)).normalize():this.weaponAim;
    const barrel=new Vector3(1,0,0).transformDirection(hand.matrixWorld),correction=new Quaternion().setFromUnitVectors(barrel,aim);
    if(weight<1)correction.slerp(new Quaternion(),1-weight);
    const parent=bone.parent.getWorldQuaternion(new Quaternion()),local=parent.clone().invert().multiply(correction).multiply(parent);
    const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();bone.matrix.decompose(position,rotation,scale);
    bone.matrix.compose(position,local.multiply(rotation),scale);bone.matrixWorldNeedsUpdate=true;
  }
  /** Browser aim correction standing in for PointArm/PointGunInDirection IK: the right upper arm or the spine,
   * plus the left upper arm for twin pistols. */
  private aimUpperBody(){
    // A chain blending out finishes even after the aim itself has gone.
    if((this.armAim&&this.weaponAim||this.pointArm)&&this.pointArmUpdate())return;
    if(!this.weaponAim)return;
    if(!this.armAim){this.pointGunInDirection();return;}
    this.pointBone(22,24,this.aimBlend);
    if(this.twinAim){this.owner.root.updateMatrixWorld(true);this.pointBone(32,34,this.aimBlend);}
  }
  /** CPedIK::PointGunInDirection (0x5FDC00) through the normalized MoveLimb (0x5FDB60), as CTaskSimpleUseGun aims a
   * two-handed weapon: the aim's yaw off the ped's heading and its pitch, both scaled by the aim clip's blend and
   * clamped by ms_torsoInfo, turn the upper torso (BONE_SPINE1) about the spine and the ped's right axis. The SA
   * ms_torsoInfo is in the executable (0x8D22E4); these are Vice City's reversed values (reVC CPedIK::ms_torsoInfo). */
  private pointGunInDirection(){
    const torso=this.bone(3),hand=this.hand(24);if(!torso?.parent||!hand)return;
    this.root.updateWorldMatrix(true,true);
    const from=new Vector3().setFromMatrixPosition(torso.matrixWorld),to=this.weaponAimPoint?this.weaponAimPoint.clone().sub(from):this.weaponAim!.clone();
    const forward=new Vector3(Math.sin(this.renderedHeading),0,Math.cos(this.renderedHeading)),up=new Vector3(0,1,0),right=new Vector3().crossVectors(forward,up).normalize();
    const flat=Math.hypot(to.x,to.z),aimYaw=Math.atan2(forward.x*to.z-forward.z*to.x,forward.x*to.x+forward.z*to.z);
    const TORSO={maxYaw:50*Math.PI/180,maxPitch:45*Math.PI/180};
    const yaw=Math.max(-TORSO.maxYaw,Math.min(TORSO.maxYaw,-aimYaw*this.aimBlend)),pitch=Math.max(-TORSO.maxPitch,Math.min(TORSO.maxPitch,Math.atan2(to.y,flat)*this.aimBlend));
    const spine=new Vector3(1,0,0).transformDirection(torso.matrixWorld);
    const world=new Quaternion().setFromAxisAngle(right,pitch).multiply(new Quaternion().setFromAxisAngle(spine,yaw));
    const parent=torso.parent.getWorldQuaternion(new Quaternion()),local=parent.clone().invert().multiply(world).multiply(parent);
    const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();torso.matrix.decompose(position,rotation,scale);
    torso.matrix.compose(position,local.multiply(rotation),scale);torso.matrixWorldNeedsUpdate=true;
  }
  /** CTaskSimpleUseGun::AimGun's free-aim PointArm (speed 0.5, 250 ms, renewed every frame while aiming), and
   * CTaskSimpleIKChain's 250 ms blend out once it stops. False when the rig has no arm chain. */
  private pointArmUpdate(){
    const aiming=this.armAim&&!!this.weaponAim&&this.aimPose!==undefined&&this.weaponPose!==undefined&&this.aimBlend>0;
    if(!this.pointArm){
      if(!aiming)return false;
      this.root.updateWorldMatrix(true,true);
      const chains=[armChain(id=>this.bone(id),'right',.5),...(this.twinAim?[armChain(id=>this.bone(id),'left',.5)]:[])].filter((c):c is NativeIkChain=>!!c);
      if(!chains.length)return false;
      this.pointArm={chains,targetTimeMs:this.ikClockMs+250,target:1,point:new Vector3()};this.ikFrameMs=0;
    }
    const arm=this.pointArm;
    if(aiming){
      // UpdatePointArmInfo: aim at Find3rdPersonCamTargetVector's point, blend target 1, 250 ms from now.
      if(this.weaponAimPoint)arm.point.copy(this.weaponAimPoint);else{const hand=this.hand(24);if(hand)arm.point.setFromMatrixPosition(hand.matrixWorld).addScaledVector(this.weaponAim!,20);}
      arm.target=1;arm.targetTimeMs=this.ikClockMs+250;
      this.rotateTorsoForArm(arm.point);
    }else if(arm.target!==0){arm.target=0;arm.targetTimeMs=this.ikClockMs+250;}
    const frames=Math.min(3,Math.floor(this.ikFrameMs/(1000/30)));this.ikFrameMs-=frames*1000/30;
    this.root.updateWorldMatrix(true,true);
    for(let i=0;i<frames;i++)for(const chain of arm.chains){
      chain.blend=stepIkBlend(chain.blend,arm.target,this.ikClockMs,arm.targetTimeMs,1000/30);
      chain.moveToTarget(arm.point);
    }
    for(const chain of arm.chains)chain.blendKeyframes();
    if(arm.target===0&&this.ikClockMs>arm.targetTimeMs)this.pointArm=undefined;
    return true;
  }
  /** CPedIK::RotateTorsoForArm (0x5FDF90), which AimGun calls while the arm points: when the target lies 45° to 90°
   * to the ped's left, the torso turns the excess over 45°; past 60° to his right, the excess over 60°, and a flat 20°
   * past 80°; nothing otherwise. Half of it turns BONE_SPINE1 and half the neck, each about its parent's X axis
   * (RtQuatRotate post-concatenated). The neck's share is gated on bRotateWithNeck, an exe bool (0x8D2354) the
   * Android build does not test, so it always turns here. */
  private rotateTorsoForArm(target:Vector3){
    const torso=this.bone(3),neck=this.bone(4);if(!torso)return;
    this.root.updateWorldMatrix(true,false);
    const origin=new Vector3().setFromMatrixPosition(this.root.matrixWorld),fx=Math.sin(this.renderedHeading),fz=Math.cos(this.renderedHeading),tx=target.x-origin.x,tz=target.z-origin.z;
    // destRotation - m_fCurrentRotation after the wrap into ±180°: positive toward the ped's left.
    const dif=Math.atan2(fz*tx-fx*tz,fx*tx+fz*tz),deg=Math.PI/180;
    let turn:number;
    if(dif>45*deg&&dif<=90*deg)turn=dif-45*deg;
    else if(dif>=-60*deg)return;
    else turn=dif<-80*deg?-20*deg:dif+60*deg;
    const twist=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),turn/2),position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
    for(const bone of neck?[neck,torso]:[torso]){bone.matrix.decompose(position,rotation,scale);bone.matrix.compose(position,rotation.premultiply(twist),scale);bone.matrixWorldNeedsUpdate=true;}
  }
  /** CTaskSimpleUseGun::AimGun's head look for arm-aimed weapons: once the aim clip is blended past 0.98 it renews
   * g_ikChainMan.LookAt at the aim point every frame (speed 0.25, 250 ms blend, priority 3, duration 9,999,999 ms;
   * UpdateLookAtInfo keeps the current blend), and AbortIK blends it out over 250 ms when the aim ends. */
  private aimLook?:{task:LookAtTask;target:Vector3};
  /** Whether the aim's look-at holds the head, which takes the chain from a lower-priority glance. */
  get aimLooking(){return !!this.aimLook;}
  private stepAimLook(stepMs:number){
    const now=this.ikClockMs,aiming=this.armAim&&!!this.weaponAim&&this.weaponPose!==undefined;
    if(aiming&&this.aimBlend>0.98&&this.weaponAimPoint){
      if(!this.aimLook){this.aimLook={task:startLookAt(now,9999999,250),target:this.weaponAimPoint.clone()};this.aimLook.task.blend=this.externalLook?.blend??0;}
      const task=this.aimLook.task;task.endTime=now+9999999;task.targetBlend=1;task.targetTime=now+250;task.blendingOut=false;this.aimLook.target.copy(this.weaponAimPoint);
    }else if(this.aimLook&&!aiming&&!this.aimLook.task.blendingOut){
      // CTaskSimpleIKChain::BlendOut(250): the chain ends 250 ms from now and its blend falls to 0 by then.
      const task=this.aimLook.task;task.endTime=now+250;task.targetBlend=0;task.targetTime=task.endTime;task.blendingOut=true;
    }
    if(this.aimLook&&!stepLookAt(this.aimLook.task,now,stepMs))this.aimLook=undefined;
  }
  private legSwing?:{fwd:number;side:number};
  /** CTaskSimpleJetPack::ApplyRollAndPitch (0x67B720): the flier's legs hang free, swung about the bone's Z and Y. */
  setLegSwing(swing?:{fwd:number;side:number}){this.legSwing=swing;}
  private applyLegSwing(){
    const swing=this.legSwing;if(!swing)return;
    const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
    // PED_NODE_LEFT_LEG and PED_NODE_RIGHT_LEG: the thigh bones the original rotates.
    for(const id of [41,51]){
      const bone=this.bone(id);if(!bone)continue;
      bone.matrix.decompose(position,rotation,scale);
      const turned=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),swing.fwd).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),swing.side)).multiply(rotation);
      bone.matrix.compose(position,turned,scale);bone.matrixWorldNeedsUpdate=true;
    }
  }
  private heatMaterial=new MeshBasicMaterial({color:0xff6d12});
  private heatOriginals=new Map<Mesh,Mesh['material']>();
  setThermal(enabled:boolean){
    if(enabled&&this.heatOriginals.size===0)this.owner.root.traverse(o=>{if(o instanceof Mesh){this.heatOriginals.set(o,o.material);o.material=this.heatMaterial;}});
    if(!enabled&&this.heatOriginals.size){for(const [mesh,material] of this.heatOriginals)mesh.material=material;this.heatOriginals.clear();}
  }
  /** CClothes::RebuildPlayer's new body on the old skeleton (it hands the rebuilt clump its running animations back):
   * each skinned atomic takes the new model's vertices and influences, and each of its maps the new texture of its
   * name. The new model must have the same atomics and vertex counts (a blend of the bodies keeps the normal one's);
   * otherwise nothing changes and the answer is false. */
  replaceBody(model:import('../assets/dff').DffModel,textures:readonly import('../assets/modelTextures').ModelTexture[]){
    if(!this.source.playerBody)return false;
    const meshes:SkinnedMesh[]=[];this.owner.root.traverse(o=>{if((o as SkinnedMesh).isSkinnedMesh&&Number.isInteger(o.userData.nativeAtomic))meshes.push(o as SkinnedMesh);});
    const parts=meshes.map(mesh=>({mesh,source:model.geometries[model.atomics[mesh.userData.nativeAtomic]?.geometry??-1]}));
    if(!parts.length||parts.some(({mesh,source})=>!source?.skin||!source.normals||!source.uvs[0]||mesh.geometry.getAttribute('position').count*3!==source.positions.length))return false;
    for(const {mesh,source} of parts){
      const g=mesh.geometry,set=(name:string,data:ArrayLike<number>)=>{const a=g.getAttribute(name) as BufferAttribute|undefined;if(a){(a.array as Float32Array|Uint8Array).set(data);a.needsUpdate=true;}};
      set('position',source.positions);set('normal',source.normals!);set('uv',source.uvs[0]);
      // As modelObject binds them: an influence of no weight points at bone 0.
      const indices=source.skin!.indices.slice();indices.forEach((_,i)=>{if(!source.skin!.weights[i])indices[i]=0;});
      set('skinIndex',indices);set('skinWeight',source.skin!.weights);mesh.normalizeSkinWeights();
      g.computeBoundingSphere();
      const materials=this.heatOriginals.get(mesh)??mesh.material;
      for(const material of Array.isArray(materials)?materials:[materials]){
        const map=(material as MeshBasicMaterial).map as DataTexture|null|undefined,next=map&&textures.find(t=>t.name.toLowerCase()===map.name.toLowerCase());
        if(!map?.isDataTexture||!next)continue;
        // A new image, not the old one written over: the old pixels may be a dictionary's decoded raster.
        const level=next.mips[0];map.image={data:level.data,width:level.width,height:level.height};map.mipmaps=[];map.needsUpdate=true;
      }
    }
    this.bodySwaps++;
    return true;
  }
  private bodySwaps=0;
  /** The body's bind-pose half width (the largest |x| of its skinned vertices), for specs. */
  bodyExtent(){let extent=0;this.owner.root.traverse(o=>{if((o as SkinnedMesh).isSkinnedMesh){const p=(o as SkinnedMesh).geometry.getAttribute('position');for(let i=0;i<p.count;i++)extent=Math.max(extent,Math.abs(p.getX(i)));}});return extent;}
  /** Native BONE_R_HAND (24) by default; BONE_L_HAND is 34. */
  hand(boneId=24){return this.bone(boneId);}
  setWeaponPose(name?:string,time=.05){this.weaponPose=name;if(name)this.aimPose={name,time};}
  /** CTaskSimpleHoldEntity's partial clip (CRRY_PRTIAL): the arms round what he carries, over his walk. */
  private carryPose?:string;
  setCarryPose(name?:string){this.carryPose=name;}
  get carryPoseName(){return this.carryPose;}
  /** The script or reaction clip on top of the move: CAnimBlendAssociation's m_fCurrentTime and m_fSpeed, with the
   * clip time it is let go at (Infinity while held). */
  private reaction?: {name:string;time:number;end:number;speed:number;loop:boolean};
  installReactions(clips:Record<string,NativeAnimation>,upperBody=false) {
    for(const [name,source] of Object.entries(clips)){
      const own=withoutForeignTracks(this.source.model,source);
      const clip=upperBody?{...own,tracks:own.tracks.filter(t=>t.boneId>=2&&t.boneId<=5||t.boneId>=21&&t.boneId<=36)}:own;
      const track=clip.tracks.findIndex(t=>t.boneId===0&&t.translations);
      this.reactions.set(name,bindAnimation(this.source.model,this.owner.root,clip,track>=0?{track,axes:['x','y']}:undefined));
    }
  }
  /** Stop the current reaction and restore the pose it overrode. */
  clearReaction(){if(this.reaction){this.reactions.get(this.reaction.name)?.restore();this.reaction=undefined;}}
  /** The reaction clip playing, if any. */
  get reactionName(){return this.reaction?.name;}
  /** The current reaction's clip has played to its end (true with none playing): CTaskSimpleDie's m_dieAnimFinished. */
  get reactionPlayedOut(){const r=this.reaction;if(!r)return true;return r.time>=(this.reactions.get(r.name)?.duration??0);}
  /** How far through the clip the reaction is, from nothing to one (m_fCurrentTime over the hierarchy's total time):
   * a looped clip wraps, and one held past its end stays at one. */
  get reactionProgress(){
    const r=this.reaction;if(!r)return undefined;
    const clip=this.reactions.get(r.name)?.duration??0;if(!(clip>0))return undefined;
    return r.loop?(r.time%clip)/clip:Math.min(1,r.time/clip);
  }
  /** CAnimBlendAssociation::SetSpeed on the clip playing, when it is the one named (SET_CHAR_ANIM_SPEED). */
  setReactionSpeed(name:string,speed:number){const r=this.reaction;if(!r||r.name!==name)return false;r.speed=speed;return true;}
  /** CAnimBlendAssociation::SetCurrentTime at a fraction of the clip, when it is the one named
   * (SET_CHAR_ANIM_CURRENT_TIME). */
  setReactionProgress(name:string,fraction:number){
    const r=this.reaction;if(!r||r.name!==name)return false;
    r.time=fraction*(this.reactions.get(name)?.duration??0);return true;
  }
  /** Plays a vehicle clip's last frame as a reaction for `seconds`, such as the ground pose CAR_jackedLHS
   * ends on. Helper tracks the ped skeleton lacks are dropped, as installVehicleClips does. */
  holdClipEnd(name:string,source:NativeAnimation,seconds:number){
    if(!this.reactions.has(name)){
      const frames=this.source.model.frames,clip={...source,tracks:source.tracks.filter(t=>frames.filter(f=>t.boneId>=0?f.hanim?.id===t.boneId:f.name.trim().toLowerCase()===t.name.trim().toLowerCase()).length===1)};
      if(!clip.tracks.some(t=>t.times.length))return false;
      this.installReactions({[name]:clip});
    }
    const end=this.reactions.get(name)!.duration;this.playReaction(name,end+seconds,false,end);return true;
  }
  /** Keeps the current reaction on its last frame until cleared, as a ped held down. */
  holdReaction(){if(this.reaction)this.reaction.end=Infinity;}
  /** The reaction's clock stands still (a fall's lie waiting for the ground under CTaskSimpleFall). */
  reactionPaused=false;
  hasReaction(name:string){return this.reactions.has(name);}
  reactionDuration(name:string){return this.reactions.get(name)?.duration;}
  /** `loop` wraps the clip (an ANIMATION_LOOPED association); otherwise it stops on its last frame. */
  playReaction(name:string,duration?:number,fitDuration=false,startSeconds=0,loop=false,rate=1) {
    const binding=this.reactions.get(name);if(!binding)return;
    // `rate` is the association's m_Speed (CTaskSimpleSitIdle plays its clip at 0.9 to 1.5).
    const speed=(fitDuration&&duration?binding.duration/duration:1)*rate;
    this.reaction={name,time:startSeconds*speed,end:(duration??binding.duration)*speed,speed,loop};
  }
  private action: Action = 'idle';
  /** CTaskComplexJump, CTaskSimpleInAir or CTaskSimpleLand holds the ped: the launch clip, the in-air pose or the landing. */
  get jumping() { return launchAction(this.action) || airborneAction(this.action) || landingAction(this.action); }
  private lastGroundAction: Action = 'idle';
  private landingSpeed = 1;
  private swimPlaybackSpeed = 1;
  /** Actual current browser stroke weight/rate for the breath task. The
   * browser's captured-pose transition is not yet native association blending. */
  swimUnderAssociation(){
    if(this.action!=='swimUnder')return undefined;
    return {speed:this.swimPlaybackSpeed,blend:Math.min(1,this.transitionTime/this.transitionDuration)};
  }
  landingFootContacts: readonly ('right' | 'left')[] | undefined;
  private get active() { return this.clips[this.action] ?? this.clips.walk!; }
  private basis = new Matrix4();
  private seconds = 0;
  /** Where the first locomotion cycle starts, as a fraction of the clip (see startFirstCycleAt). */
  private firstCyclePhase?: number;
  /** Street peds created together would otherwise walk and step in lockstep; native peds are added one per frame. */
  startFirstCycleAt(fraction: number) { this.firstCyclePhase = Math.max(0, Math.min(1, fraction)) % 1; }
  private originHeight: number;
  private sourceShadowSphere?: {center:Vector3;radius:number};
  private poseGeneration=0;
  private sampledPose='';
  private poseRevision=0;
  private shadowRootBone?: Object3D;
  private headingOffset: number;
  private motionSpace: 'world' | 'actor';
  private wasAirborne = false;
  private swamLast = false;
  /** A climb took over from the jump or fall: no landing clip follows it. */
  resetAirborne() { this.wasAirborne = false; }
  /** m_fMoveBlendRatio (PlayerControlZelda). */
  private moveBlend = 0;
  /** The player's movement associations (CPlayerPed::SetRealMoveAnim) and their times before the last update. */
  private moveAnims?: NativeMoveAnims;
  private movePrevious = new Map<MoveClip, number>();
  /** CTaskSimpleUseGun's move associations while a gun is aimed, and their times before the last update. */
  private gunAnims?: NativeGunMoveAnims;
  private fightAnims?: NativeGunMoveAnims;
  private gunPrevious = new Map<GunMoveClip, number>();
  private gunAimLowered = false;
  private moveBlendPose?: PoseTransition;
  private observedGround = false;
  private previous = 0;
  private transition: PoseTransition;
  private motionTransition = new MotionTransition(TRANSITION_SECONDS);
  private transitionTime = TRANSITION_SECONDS;
  private transitionDuration = TRANSITION_SECONDS;
  private previousTransitionTime = TRANSITION_SECONDS;
  constructor(private source: CharacterSource) {
    if (source.convention !== undefined && source.convention !== 'feet' && source.convention !== 'san-andreas-ped') throw new Error('Unknown character coordinates.');
    if(source.playerBody!==undefined&&typeof source.playerBody!=='boolean')throw new Error('Invalid player body marker.');
    if(source.playerBody&&source.convention!=='san-andreas-ped')throw new Error('Native player bodies require San Andreas pedestrian coordinates.');
    // Native pedestrian COL bounds begin at Z=-1; simulation position denotes feet.
    // Keep this fixed during crouching: animation moves the body within its entity frame.
    this.originHeight = source.convention === 'san-andreas-ped' ? 1 : 0;
    // Native +Y forward becomes -Z after model import; the controller uses +Z.
    this.headingOffset = source.convention === 'san-andreas-ped' ? Math.PI : 0;
    this.motionSpace = source.convention === 'san-andreas-ped' ? 'actor' : 'world';
    if (!source.model.geometries.some(g => g.skin) || !(source.clip.duration > 0)) throw new Error('Character testing requires a skinned model and a nonzero-duration clip.');
    if (source.landingMoving && !source.landing) throw new Error('Assign a base landing clip before moving landing.');
    if (source.sprint && !source.run) throw new Error('Assign a run clip before sprint.');
    if (!!source.crouchIdle !== !!source.crouchWalk) throw new Error('Assign both crouched idle and crouched walk clips.');
    if (source.launchRight && !source.launch) throw new Error('Assign a base launch clip before its right-foot variant.');
    this.owner = modelObject(source.model, source.textures, undefined, undefined, { worldLighting: true, ambient: this.ambient });
    const shadowRootFrame=source.model.frames.findIndex(frame=>frame.hanim?.id===0);
    if(shadowRootFrame>=0)this.owner.root.traverse(object=>{if(object.userData.nativeFrame===shadowRootFrame)this.shadowRootBone=object;});
    // Shared-frame player parts use a conservative union of their native morph
    // bounds. Capture framing remains a related-source candidate, not SA parity.
    const sphere=characterShadowBounds(source.model,!!source.playerBody);
    if(source.convention==='san-andreas-ped'&&sphere&&sphere.radius>0&&Number.isFinite(sphere.radius)&&sphere.center.every(Number.isFinite))this.sourceShadowSphere={center:new Vector3(...sphere.center),radius:sphere.radius*1.1};
    const playerMaterials=new Set<import('three').Material>();
    this.owner.root.traverse(o => { if (o instanceof Mesh) {
      o.castShadow = true; o.receiveShadow = true;
      if(source.convention==='san-andreas-ped')for(const material of Array.isArray(o.material)?o.material:[o.material])playerMaterials.add(material);
    } });
    playerMaterials.forEach(nativePlayerMaterial);
    try {
      if(source.playerBody)this.shoulders=bindPlayerShoulders(source.model,this.owner.root);
      const swim=source.swim;
      for (const [action, assignment] of Object.entries({ walk: { clip: source.clip, track: source.track }, idle: source.idle, run: source.run, sprint: source.sprint, crouchIdle: source.crouchIdle, crouchWalk: source.crouchWalk, crouchWalkBack: source.crouchWalkBack, crouchRollL: source.crouchRollL, crouchRollR: source.crouchRollR, airborne: source.airborne, fallGlide: source.fallGlide, landing: source.landing, landingMoving: source.landingMoving, launch: source.launch, launchRight: source.launchRight, walkStart: source.walkStart, runStop: source.runStop, runStopR: source.runStopR,
        gunStand: source.gunStand, gunMoveFwd: source.gunMoveFwd, gunMoveBwd: source.gunMoveBwd, gunMoveL: source.gunMoveL, gunMoveR: source.gunMoveR,
        fightIdle: source.fightIdle, fightShFwd: source.fightShFwd, fightShBwd: source.fightShBwd, fightShL: source.fightShL, fightShR: source.fightShR,
        swimTread: swim?.tread, swimBreast: swim?.breast, swimCrawl: swim?.crawl, swimUnder: swim?.under, swimGlide: swim?.glide, swimDive: swim?.dive })) {
        if (!assignment) continue;
        this.addClip(action as Action, assignment, action.startsWith('swim'));
      }
      const tracks = [source.clip, source.idle?.clip, source.run?.clip, source.sprint?.clip, source.crouchIdle?.clip, source.crouchWalk?.clip, source.crouchWalkBack?.clip, source.crouchRollL?.clip, source.crouchRollR?.clip, source.airborne?.clip, source.fallGlide?.clip, source.landing?.clip, source.landingMoving?.clip, source.launch?.clip, source.launchRight?.clip, source.walkStart?.clip, source.runStop?.clip, source.runStopR?.clip, source.gunStand?.clip, source.gunMoveFwd?.clip, source.gunMoveBwd?.clip, source.gunMoveL?.clip, source.gunMoveR?.clip, source.fightIdle?.clip, source.fightShFwd?.clip, source.fightShBwd?.clip, source.fightShL?.clip, source.fightShR?.clip].flatMap(clip => clip?.tracks.filter(t => t.times.length) ?? []);
      const animatedFrames = new Set(source.model.frames.flatMap((f,i) => tracks.some(t => t.boneId >= 0 ? t.boneId === f.hanim?.id : t.name.trim().toLowerCase() === f.name.trim().toLowerCase()) ? [i] : []));
      const targets: Object3D[] = []; this.owner.root.traverse(o => { if (animatedFrames.has(o.userData.nativeFrame)) targets.push(o); });
      this.transition = new PoseTransition(targets);
      if (source.playerBody && MOVE_CLIPS.every(clip => this.clips[clip])) {
        this.moveDurations = Object.fromEntries(MOVE_CLIPS.map(clip => [clip, { duration: this.clips[clip]!.duration }])) as Record<MoveClip, { duration: number }>;
        this.moveAnims = new NativeMoveAnims(this.moveDurations);
        this.playerGroup = { walk: { clip: source.clip, track: source.track }, run: source.run!, sprint: source.sprint!, idle: source.idle!, walkStart: source.walkStart! };
        this.moveBlendPose = new PoseTransition(targets);
      }
      if (source.playerBody && (Object.values(GUN_ACTIONS) as Action[]).every(action => this.clips[action])) {
        this.gunAnims = new NativeGunMoveAnims(Object.fromEntries(Object.entries(GUN_ACTIONS).map(([clip, action]) => [clip, { duration: this.clips[action]!.duration }])) as Record<GunMoveClip, { duration: number }>);
        this.moveBlendPose ??= new PoseTransition(targets);
      }
      if (source.playerBody && (Object.values(FIGHT_ACTIONS) as Action[]).every(action => this.clips[action])) {
        this.fightAnims = new NativeGunMoveAnims(Object.fromEntries(Object.entries(FIGHT_ACTIONS).map(([clip, action]) => [clip, { duration: this.clips[action]!.duration }])) as Record<GunMoveClip, { duration: number }>);
        this.moveBlendPose ??= new PoseTransition(targets);
      }
      this.root.add(this.owner.root); this.samplePose(0, TRANSITION_SECONDS);
    } catch (error) { this.owner.dispose(); throw error; }
  }
  private moveDurations?: Record<MoveClip, { duration: number }>;
  private playerGroup?: Record<'walk' | 'run' | 'sprint' | 'idle' | 'walkStart', CharacterClip>;
  private motionGroup?: string;
  /** The player's motion group (CClothes::GetDefaultPlayerMotionGroup): fat.ifp's or muscular.ifp's walk, run, sprint,
   * idle and walk start in place of the player group's, or the player group's again when `group` is undefined. As
   * CPlayerPed::ReApplyMoveAnims does, each running move keeps its blend and starts the new clip from its first frame. */
  setMotionGroup(name: string | undefined, group?: Record<'walk' | 'run' | 'sprint' | 'idle' | 'walkStart', CharacterClip>) {
    const clips = name && group ? group : this.playerGroup;
    if (!clips || !this.moveDurations || (name && group ? name : undefined) === this.motionGroup) return;
    for (const [action, assignment] of Object.entries(clips)) {
      this.addClip(action as Action, assignment);
      this.moveDurations[action as MoveClip].duration = this.clips[action as Action]!.duration;
    }
    for (const a of this.moveAnims?.assocs.values() ?? []) if (a.clip in clips) a.time = 0;
    this.movePrevious.clear();
    this.motionGroup = name && group ? name : undefined;
  }
  get playerMotionGroup() { return this.motionGroup ?? 'player'; }
  /** CPed::SetMoveAnim for a ped given another anim group (SET_ANIM_GROUP_FOR_CHAR): that walkcycle's walk, run, sprint
   * and idle in place of the ones it was built with, each running move starting the new clip from its first frame. */
  setLocomotion(group: Record<'walk' | 'run' | 'sprint' | 'idle', CharacterClip>) {
    if (!this.moveDurations) return;
    for (const [action, assignment] of Object.entries(group)) {
      this.addClip(action as Action, assignment);
      this.moveDurations[action as MoveClip].duration = this.clips[action as Action]!.duration;
    }
    for (const a of this.moveAnims?.assocs.values() ?? []) if (a.clip in group) a.time = 0;
    this.movePrevious.clear();
  }
  /** Shared clip installation for constructor roles and post-construction swim roles. */
  private addClip(action: Action, assignment: CharacterClip, swim = false) {
    const { clip, track: index } = assignment;
    const forwardMotion = 'forwardMotion' in assignment && assignment.forwardMotion;
    if ('forwardMotion' in assignment && assignment.forwardMotion !== undefined && typeof assignment.forwardMotion !== 'boolean') throw new Error('Invalid forward motion marker.');
    if (forwardMotion && (!landingAction(action) && !launchAction(action) || this.source.convention !== 'san-andreas-ped')) throw new Error('Forward motion requires a native pedestrian launch or landing role.');
    if (!(clip.duration > 0)) throw new Error('Assigned clips need a nonzero duration.');
    // FALL_glide carries no root motion the pose needs (the in-air pose extracts nothing).
    if (!idleAction(action) && action !== 'fallGlide' && index === undefined) throw new Error('Moving clips need an extraction track.');
    const binding = bindAnimation(this.source.model, this.owner.root, clip, index === undefined ? undefined : { track: index, axes: forwardMotion ? ['y'] : oneShot(action) ? ['x','y','z'] : undefined });
    const parent = new Matrix4();
    let motion: { between(fromSeconds: number, toSeconds: number, parentToWorld: Matrix4, loop?: boolean): { x: number; y?: number; z: number } } | undefined;
    if (index !== undefined) {
      if (swim) { if (!idleAction(action)) motion = swimMotion(clip, { track: index }); }
      else if (forwardMotion || !oneShot(action)) motion = locomotionMotion(clip, { track: index, axes: forwardMotion ? ['y'] : undefined });
      const track = clip.tracks[index];
      const frame = this.source.model.frames.findIndex(f => track.boneId >= 0 ? f.hanim?.id === track.boneId : f.name.trim().toLowerCase() === track.name.trim().toLowerCase());
      let target: Object3D | undefined;
      this.owner.root.traverse(o => { if (o.userData.nativeFrame === frame) target = o; });
      if (!target?.parent) throw new Error('Locomotion track has no model parent.');
      for (let p: Object3D | null = target.parent; p && p !== this.owner.root; p = p.parent) {
        const ancestor = this.source.model.frames[p.userData.nativeFrame];
        if (ancestor && clip.tracks.some(t => t.times.length && (t.boneId >= 0 ? t.boneId === ancestor.hanim?.id : t.name.trim().toLowerCase() === ancestor.name.trim().toLowerCase()))) throw new Error('Locomotion extraction from an animated parent is not supported.');
      }
      parent.copy(target.parent.matrixWorld);
      if (motion) for (const time of track.times) motion.between(0, time, parent);
    }
    this.clips[action] = { binding, motion, parent, duration: clip.duration };
  }
  /** Packaged pedestrian tracks need matching coordinates and unique bones. */
  supportsNativeClips(clips:readonly NativeAnimation[]) {
    if(this.source.convention!=='san-andreas-ped')return false;
    return clips.every(clip=>clip.tracks.every(track=>!track.times.length||this.source.model.frames.filter(frame=>track.boneId>=0?frame.hanim?.id===track.boneId:frame.name.trim().toLowerCase()===track.name.trim().toLowerCase()).length===1));
  }
  /** Swim roles from a loaded swim.ifp (tread/glide hold station like idle). */
  installSwim(roles: SwimRole) {
    const map = { swimTread: roles.tread, swimBreast: roles.breast, swimCrawl: roles.crawl, swimUnder: roles.under, swimGlide: roles.glide, swimDive: roles.dive } as const;
    for (const [action, assignment] of Object.entries(map)) {
      if (!assignment || this.clips[action as SwimAction]) continue;
      this.addClip(action as Action, assignment, true);
    }
  }
  /** DeleteDuckAnimCB: set once a roll clip has played to its end, until the next clip starts. */
  duckRollDone = false;
  /** The crouched clip: the duck's move command when given (falling back to the forward walk without the back and roll
   * clips), else the forward walk whenever the stick moves. */
  private duckAction(controls: Controls, moving: boolean): Action {
    if (!controls.duck) return moving ? 'crouchWalk' : 'crouchIdle';
    const action = DUCK_ACTIONS[controls.duck.clip];
    return this.clips[action] ? action : action === 'crouchIdle' ? 'crouchIdle' : rollAction(action) ? 'crouchIdle' : 'crouchWalk';
  }
  supported(sim: Pick<Simulation, 'player'>) { return sim.player.health > 0 && (sim.player.grounded ? !sim.player.crouched || !!this.clips.crouchIdle && !!this.clips.crouchWalk : !!this.clips.airborne); }
  /** A ride ends (CTaskSimpleCarSetPedOut leaves the ped standing): the move blend ratio does not carry over from the
   * run up to the car, which would walk him on after the door closes. */
  resetLocomotion(){this.moveBlend=0;this.lastGroundAction='idle';this.moveAnims?.reset();}
  step(dt: number, controls: Controls, sim: Pick<Simulation, 'player'>): Controls {
    // BlendAnimation(aim, 8) on AIM, blend delta -8 on release, -4 when a weapon without bMoveAim lowers on the move.
    const lowered=this.action==='gunMove'&&this.gunAimLowered;
    this.ikClockMs+=dt*1000;this.ikFrameMs+=dt*1000;this.stepHeading=sim.player.heading;
    this.stepAimLook(dt*1000);
    this.aimBlend=this.weaponPose&&!lowered?Math.min(1,this.aimBlend+8*dt):Math.max(0,this.aimBlend-(this.weaponPose&&lowered?4:8)*dt);
    if(this.reaction){if(!this.reactionPaused)this.reaction.time+=dt*this.reaction.speed;if(this.reaction.time>=this.reaction.end){this.reactions.get(this.reaction.name)?.restore();this.reaction=undefined;}}
    this.landingFootContacts = undefined;
    // CTaskComplexInAirAndLand makes no land task after a climb or into water: the swim (and the climb, resetAirborne)
    // ends the air time.
    if (sim.player.swimming && this.clips.swimTread) { this.wasAirborne = false; this.swamLast = true; return this.stepSwim(dt, controls, sim); }
    // Out of the water the on-foot task starts afresh from idle: no run stop from the sprint that ran into the water.
    if (this.swamLast) { this.swamLast = false; this.moveAnims?.reset(); }
    const moving = Math.hypot(controls.x, controls.y) > 0;
    const runnable = !!(this.clips.sprint ?? this.clips.run) && sim.player.stamina > 0 && (!sim.player.sprintExhausted || sim.player.stamina >= STAMINA_EXHAUST_FLOOR);
    const landed = this.wasAirborne && sim.player.grounded;
    const footState = sim.player.health > 0;
    if (!footState) this.lastGroundAction = 'idle';
    // PlayerControlZelda does not run under the jump, in-air and land tasks, so the ratio holds through their clips.
    if (!footState) this.moveBlend = 0;
    else if (!launchAction(this.action) && !landingAction(this.action) && !airborneAction(this.action)) this.moveBlend = playerMoveBlend(this.moveBlend,controls.x,controls.y,!!controls.walk,dt);
    this.observedGround = footState && (this.observedGround || sim.player.grounded);
    // Off the ground only counts once the ped is in the air (bIsInTheAir): a step down a curb neither shows the fall
    // pose nor ends in a landing.
    const inAir = !sim.player.grounded && ((sim as Partial<Pick<Simulation,'playerInAir'>>).playerInAir ?? true);
    this.wasAirborne = this.observedGround && footState && inAir;
    const landing = !!this.clips.landing && !sim.player.crouched && (landed || landingAction(this.action) && this.seconds < this.active.duration);
    const selectedLanding = landingAction(this.action) && !landed ? this.action : this.clips.landingMoving && moving && this.moveBlend > 1.5 ? 'landingMoving' : 'landing';
    const canLaunch = this.supported(sim) && sim.player.grounded && !sim.player.crouched && !landing;
    const launchFinished = canLaunch && launchAction(this.action) && this.seconds >= this.active.duration;
    const launch = canLaunch && !!this.clips.launch && !launchFinished && (controls.jump || launchAction(this.action));
    // The current locomotion role supplies phase; original association weights are not yet available.
    const launchPhase = this.seconds / this.active.duration % 1 + .367;
    const rightFoot = !!this.clips.launchRight && (this.action === 'move' ? this.launchPhase() >= .5 : (this.action === 'walk' || this.action === 'run' || this.action === 'sprint') && (launchPhase > 1 ? launchPhase - 1 : launchPhase) >= .5);
    const selectedLaunch = launchAction(this.action) ? this.action : rightFoot ? 'launchRight' : 'launch';
    // CTaskSimpleJetPack::ProcessAnims blends the idle animation while the pack carries the ped.
    const selected: Action = !this.supported(sim) ? 'idle' : controls.jetPack && !sim.player.grounded ? 'idle' : sim.player.grounded && landing ? selectedLanding : launch ? selectedLaunch : this.clips.airborne && (inAir || (controls.jump || launchFinished) && !sim.player.crouched) ? (this.clips.fallGlide && inAir && !controls.jump && !launchFinished && !((sim as Partial<Pick<Simulation,'jumpLaunched'>>).jumpLaunched ?? true) ? 'fallGlide' : 'airborne') : sim.player.crouched ? this.duckAction(controls, moving) : !moving ? 'idle' : controls.sprint && runnable ? this.clips.sprint ? 'sprint' : 'run' : this.clips.sprint && !controls.walk ? 'run' : 'walk';
    const locomotion = selected === 'idle' || selected === 'walk' || selected === 'run' || selected === 'sprint';
    const action: Action = controls.fightMove && this.fightAnims && locomotion && sim.player.grounded ? 'fightMove' : controls.gunMove && this.gunAnims && locomotion && sim.player.grounded ? 'gunMove' : this.moveAnims && locomotion && !(controls.jetPack && !sim.player.grounded) ? 'move' : selected;
    // Aiming starts CTaskSimpleUseGun standing; putting the gun down leaves SetRealMoveAnim to rebuild the move clips.
    if (action === 'gunMove' && this.action !== 'gunMove') { this.gunAnims!.start(controls.gunMove!.aimWithArm); this.gunPrevious.clear(); }
    // Targeting with a melee weapon starts CTaskSimpleFight in its stance.
    if (action === 'fightMove' && this.action !== 'fightMove') { this.fightAnims!.start(true); this.gunPrevious.clear(); }
    // CTaskSimpleUseGun::RemoveStanceAnims: leaving the aim with the stick past 50 blends WALK in with a move blend
    // ratio of 1, so CJ walks on rather than breaking straight into the run the stick asks for.
    if (action !== 'gunMove' && action !== 'fightMove' && (this.action === 'gunMove' || this.action === 'fightMove') && this.moveAnims) {this.moveAnims.assocs.clear();this.moveAnims.headingLocked=false;if(Math.hypot(controls.x,controls.y)>50/128)this.moveBlend=Math.min(this.moveBlend,1);}
    if (sim.player.grounded && !oneShot(action)) this.lastGroundAction = action === 'move' ? this.moveAnims!.moveState === 'sprint' ? 'sprint' : 'run' : action;
    // A roll asked for again once its clip ended starts over (DeleteDuckAnimCB cleared m_MoveAnim).
    if (rollAction(action) && action === this.action && this.duckRollDone) { this.seconds = this.previous = 0; this.duckRollDone = false; }
    // CTaskSimpleLand::ProcessPed, once its clip is done: WALK, RUN and SPRINT (partial jump clips never faded them)
    // start their cycles again from frame 0, so the stride after a landing always begins at the top.
    if (landingAction(this.action) && !landingAction(action) && this.moveAnims) for (const clip of ['walk', 'run', 'sprint'] as const) { const a = this.moveAnims.assocs.get(clip); if (a) a.time = 0; }
    if (action !== this.action) {
      this.landingSpeed = landingAction(action) && this.motionSpace === 'actor' && this.lastGroundAction === 'sprint' && controls.sprint ? 2 : 1;
      this.samplePose(this.seconds, this.transitionTime);
      const fastLandingTransition = this.motionSpace === 'actor' && (landingAction(action) || this.action === 'landingMoving' && this.seconds >= this.active.duration);
      this.transition.capture(); this.transitionDuration = fastLandingTransition ? .01 : TRANSITION_SECONDS; this.poseGeneration++; this.transitionTime = 0; this.motionTransition.begin();
      const phase = this.seconds / this.active.duration;
      this.active.binding.restore();
      const preservePhase = !idleAction(action) && !idleAction(this.action) && !oneShot(action) && !oneShot(this.action) && !rollAction(action) && !rollAction(this.action);
      this.duckRollDone = false;
      this.action = action;
      this.seconds = preservePhase ? phase * this.active.duration : !idleAction(action) && !oneShot(action) && !rollAction(action) && this.firstCyclePhase !== undefined ? this.firstCyclePhase * this.active.duration : 0;
      if (!idleAction(action) && !oneShot(action)) this.firstCyclePhase = undefined;
    }
    this.previous = this.seconds;
    this.previousTransitionTime = this.transitionTime;
    this.transitionTime = Math.min(this.transitionDuration, this.transitionTime + dt);
    if (!this.supported(sim)) { this.seconds = this.previous = 0; this.transitionTime = this.previousTransitionTime = this.transitionDuration; this.motionTransition.reset(); return controls; }
    if (this.motionSpace === 'actor' && this.clips.landing && oneShot(action)) this.landingFootContacts = [];
    // The move associations keep their times under the jump, land and duck tasks; only SetRealMoveAnim waits.
    if (action !== 'move') this.moveAnims?.update(dt);
    if (launchFinished) {
      this.motionTransition.reset();
      if (airborneAction(action)) this.seconds = Math.min(this.active.duration, this.seconds + dt);
      return { ...controls, jump: true, moveAssociations: this.launchAssociations() };
    }
    if (landingAction(action) || launchAction(action)) {
      this.seconds = Math.min(this.active.duration, this.seconds + dt * (landingAction(action) ? this.landingSpeed : 1)); this.motionTransition.reset();
      if (landingAction(action) && this.landingFootContacts) this.landingFootContacts = ([['right', .1], ['left', .2]] as const).filter(([,time]) => this.previous < time && this.seconds >= time).map(([foot]) => foot);
      this.basis.makeRotationY(this.headingOffset).multiply(this.active.parent);
      // JUMP_launch and the landing clips extract their forward root motion (ANIMATION_CAN_EXTRACT_VELOCITY).
      const displacement = this.active.motion ? this.active.motion.between(this.previous,this.seconds,this.basis,false) : {x:0,z:0};
      return { ...controls, x: 0, y: 0, jump: false, sprint: false, holdMove: true, animationMotionSpace: this.motionSpace, animationMotion: displacement };
    }
    if (airborneAction(action)) { this.seconds = Math.min(this.active.duration, this.seconds + dt); this.motionTransition.reset(); return controls; }
    if (action === 'move') return this.stepMoves(dt, controls, sim, runnable);
    if (action === 'gunMove') return this.stepGunMove(dt, controls);
    if (action === 'fightMove') return this.stepGunMove(dt, controls, true);
    if (idleAction(action)) {
      if (this.clips[action]) this.seconds += dt;
      else this.seconds = this.previous = 0;
      return { ...controls, sprint: false, animationMotionSpace: this.motionSpace, animationMotion: this.motionTransition.advance({x:0,z:0},dt) };
    }
    const dx = controls.x * Math.cos(controls.cameraYaw) - controls.y * Math.sin(controls.cameraYaw);
    const dz = -controls.x * Math.sin(controls.cameraYaw) - controls.y * Math.cos(controls.cameraYaw);
    this.basis.makeRotationY((this.motionSpace === 'actor' ? 0 : Math.atan2(dx,dz))+this.headingOffset).multiply(this.active.parent);
    // CTaskSimpleDuck::SetMoveAnim plays the crouch walks at max(0.6, |m_MoveCmd.y|); a roll runs once to its end.
    const duckWalk = !!controls.duck && (action === 'crouchWalk' || action === 'crouchWalkBack');
    if (rollAction(action)) { this.seconds = Math.min(this.active.duration, this.seconds + dt); if (this.seconds >= this.active.duration) this.duckRollDone = true; }
    else this.seconds += dt * (duckWalk ? controls.duck!.speed : 1);
    const motion = rollAction(action) ? this.active.motion!.between(this.previous, this.seconds, this.basis, false) : this.active.motion!.between(this.previous, this.seconds, this.basis);
    return { ...controls, sprint: action === 'sprint' || action === 'run' && !this.clips.sprint, animationMotionSpace: this.motionSpace, animationMotion: this.motionTransition.advance(motion,dt) };
  }
  /** One frame of the player's movement associations: the clump update, then SetRealMoveAnim with the new ratio. */
  private stepMoves(dt: number, controls: Controls, sim: Pick<Simulation, 'player'>, runnable: boolean): Controls {
    const anims = this.moveAnims!;
    for (const [clip, a] of anims.assocs) this.movePrevious.set(clip, a.time);
    let x = 0, z = 0;
    for (const segment of anims.update(dt)) {
      const clip = this.clips[segment.clip]!;
      if (!clip.motion) continue;
      this.basis.makeRotationY(this.headingOffset).multiply(clip.parent);
      const looped = LOOPED_MOVES.has(segment.clip), d = clip.motion.between(segment.from, segment.wrapped ? segment.to + clip.duration : segment.to, this.basis, looped);
      x += d.x * segment.blend; z += d.z * segment.blend;
    }
    anims.setRealMoveAnim(this.moveBlend, !!controls.sprint && runnable && !controls.walk);
    this.seconds += dt; this.motionTransition.reset();
    // A run stop zeroes m_headingRate until it ends.
    return { ...controls, sprint: anims.moveState === 'sprint', facing: anims.headingLocked ? sim.player.heading : controls.facing, animationMotionSpace: this.motionSpace, animationMotion: { x, z } };
  }
  /** A frame of CTaskSimpleUseGun movement: the clump update, then ControlGunMove and SetMoveAnim. */
  private stepGunMove(dt: number, controls: Controls, fight = false): Controls {
    const anims = fight ? this.fightAnims! : this.gunAnims!, actions = fight ? FIGHT_ACTIONS : GUN_ACTIONS;
    // The fight task steps like a gun aimed with the arm that may move and strike on the move.
    const gun = fight ? { aimWithArm: true, moveAim: true, moveFire: true, firing: false, moveSpeed: 1 } : controls.gunMove!;
    for (const [clip, a] of anims.assocs) this.gunPrevious.set(clip, a.time);
    let x = 0, z = 0;
    for (const segment of anims.update(dt)) {
      const clip = this.clips[actions[segment.clip]]!;
      if (!clip.motion) continue;
      this.basis.makeRotationY(this.headingOffset).multiply(clip.parent);
      const d = clip.motion.between(segment.from, segment.wrapped ? segment.to + clip.duration : segment.to, this.basis, true);
      x += d.x * segment.blend; z += d.z * segment.blend;
    }
    // PlayerControlZeldaWeapon: the stick / 128, right and back, capped at length 1.
    const length = Math.hypot(controls.x, controls.y), scale = length > 1 ? 1 / length : 1;
    // PlayerControlFighter is not reversed; the stance takes the stick as it stands, so a sideways push shuffles sideways
    // at once rather than stepping forward while ControlGunMove's slew builds the command up.
    anims.controlGunMove({ x: controls.x * scale, y: -controls.y * scale }, fight ? Infinity : dt * 50);
    anims.setMoveAnim(gun, dt * 50);
    // Without bMoveAim the aim clip blends out while the gun moves.
    this.gunAimLowered = !gun.moveAim && anims.moving;
    this.seconds += dt; this.motionTransition.reset();
    return { ...controls, sprint: false, jump: false, animationMotionSpace: this.motionSpace, animationMotion: { x, z } };
  }
  /** The RUN and SPRINT associations CTaskSimpleJump::Launch reads. */
  private launchAssociations(): { run?: number; sprint?: number } | undefined {
    const anims = this.moveAnims;if (!anims) return undefined;
    const sprint = anims.assocs.get('sprint'), run = anims.assocs.get('run');
    return sprint ? { sprint: sprint.blend } : run ? { run: run.blend } : {};
  }
  /** StartLaunchAnim's foot choice: the SPRINT, RUN or WALK association past 0.3 blend, its progress + 0.367. */
  private launchPhase() {
    const anims = this.moveAnims!, a = (['sprint', 'run', 'walk'] as const).map(clip => anims.assocs.get(clip)).find(a => a && a.blend >= .3);
    if (!a) return 0;
    const phase = a.time / anims.clips[a.clip].duration + .367;
    return phase > 1 ? phase - 1 : phase;
  }
  /** CTaskSimpleUseGun's associations blended by weight, heaviest last. */
  private sampleGunMoves(fraction: number) {
    let total = 0;
    const fight = this.action === 'fightMove', actions = fight ? FIGHT_ACTIONS : GUN_ACTIONS;
    for (const a of (fight ? this.fightAnims! : this.gunAnims!).poses()) {
      const clip = this.clips[actions[a.clip]]!, previous = this.gunPrevious.get(a.clip) ?? a.time;
      let time = a.time;
      if (fraction < 1) { const to = a.time < previous ? a.time + clip.duration : a.time; time = (previous + (to - previous) * fraction) % clip.duration; }
      if (total === 0) { clip.binding.sample(time, true, false); total = a.blend; continue; }
      this.moveBlendPose!.capture(); this.moveBlendPose!.restoreTargets();
      clip.binding.sample(time, true, false); total += a.blend; this.moveBlendPose!.apply(a.blend / total);
    }
    if (total === 0) this.clips.idle?.binding.sample(0, true, false);
  }
  /** The associations blended by weight, heaviest last, at the render fraction between fixed steps. */
  private sampleMoves(fraction: number) {
    let total = 0;
    for (const a of this.moveAnims!.poses()) {
      const clip = this.clips[a.clip]!, looped = LOOPED_MOVES.has(a.clip), previous = this.movePrevious.get(a.clip) ?? a.time;
      let time = a.time;
      if (fraction < 1) {
        const to = looped && a.time < previous ? a.time + clip.duration : a.time;
        time = previous + (to - previous) * fraction;
        if (looped) time %= clip.duration;
      }
      if (total === 0) { clip.binding.sample(time, looped, false); total = a.blend; continue; }
      this.moveBlendPose!.capture(); this.moveBlendPose!.restoreTargets();
      clip.binding.sample(time, looped, false); total += a.blend; this.moveBlendPose!.apply(a.blend / total);
    }
  }
  /** CTaskSimpleSwim clip selection: tread holds station, breast follows the
   * move blend, crawl runs at sprint pressure, under glides without it. */
  private stepSwim(dt: number, controls: Controls, sim: Pick<Simulation, 'player'>): Controls {
    const state = sim.player.swimState ?? 0;
    // Underwater, SWIM_UNDER strokes only while the swimmer is pressing on; otherwise he glides on SWIM_GLIDE, which
    // carries no root motion (ProcessSwimAnims).
    const stroking = controls.y > .01;
    const wanted: SwimAction = state === 1 ? 'swimBreast' : state === 2 ? 'swimCrawl' : state === 4 ? (stroking ? 'swimUnder' : 'swimGlide') : state === 5 ? 'swimGlide' : state === 3 ? 'swimDive' : 'swimTread';
    const action = (this.clips[wanted] ? wanted : 'swimTread') as Action;
    const speed = action === 'swimBreast' ? Math.max(sim.player.swimBlend ?? 0, .15) : action === 'swimCrawl' ? (controls.sprint ? 1.5 : 1) : action === 'swimUnder' ? (controls.sprint ? 1.2 : .8) : 1;
    this.swimPlaybackSpeed = speed;
    if (action !== this.action) {
      this.samplePose(this.seconds, this.transitionTime);
      this.transition.capture(); this.transitionDuration = TRANSITION_SECONDS; this.poseGeneration++; this.transitionTime = 0; this.motionTransition.begin();
      this.active.binding.restore();
      this.action = action;
      this.seconds = 0;
    }
    this.previous = this.seconds;
    this.previousTransitionTime = this.transitionTime;
    this.transitionTime = Math.min(this.transitionDuration, this.transitionTime + dt);
    this.seconds += dt * speed;
    if (idleAction(action)) {
      return { ...controls, sprint: false, animationMotionSpace: this.motionSpace, animationMotion: this.motionTransition.advance({ x: 0, z: 0 }, dt) };
    }
    const dx = controls.x * Math.cos(controls.cameraYaw) - controls.y * Math.sin(controls.cameraYaw);
    const dz = -controls.x * Math.sin(controls.cameraYaw) - controls.y * Math.cos(controls.cameraYaw);
    this.basis.makeRotationY((this.motionSpace === 'actor' ? 0 : Math.atan2(dx, dz)) + this.headingOffset).multiply(this.active.parent);
    const displacement = this.active.motion!.between(this.previous, this.seconds, this.basis);
    return { ...controls, sprint: false, animationMotionSpace: this.motionSpace, animationMotion: this.motionTransition.advance({ x: displacement.x, z: displacement.z }, dt), animationMotionY: displacement.y };
  }
  /** CPed::PlayFootSteps foot-down windows (the commented decompilation of 0x5E57F0): T/15 and T/2 + T/15 into the walk,
   * run or sprint cycle, crossed by the last step. The first window reports AE_PED_FOOTSTEP_RIGHT, the second AE_PED_FOOTSTEP_LEFT. */
  footstep():{move:'walk'|'run'|'sprint';foot:'left'|'right'}|undefined{
    if(this.action==='move'){
      // The heaviest of WALK, RUN and SPRINT sets the step.
      const a=(['walk','run','sprint'] as const).map(clip=>this.moveAnims!.assocs.get(clip)).filter(a=>a&&a.playing&&a.blend>0).sort((p,q)=>q!.blend-p!.blend)[0];
      if(!a||this.reaction)return undefined;
      const duration=this.moveAnims!.clips[a.clip].duration,previous=this.movePrevious.get(a.clip)??a.time,now=a.time<previous?a.time+duration:a.time;
      const crossed=(time:number)=>Math.floor((now-time)/duration)>Math.floor((previous-time)/duration);
      const move=a.clip as 'walk'|'run'|'sprint';
      return crossed(duration/15)?{move,foot:'right'}:crossed(duration/2+duration/15)?{move,foot:'left'}:undefined;
    }
    const move=this.action;if(move!=='walk'&&move!=='run'&&move!=='sprint'||this.reaction)return undefined;
    const duration=this.active.duration;if(!(duration>0)||this.seconds<=this.previous)return undefined;
    const crossed=(time:number)=>Math.floor((this.seconds-time)/duration)>Math.floor((this.previous-time)/duration);
    const first=duration/15;
    return crossed(first)?{move,foot:'right'}:crossed(duration/2+first)?{move,foot:'left'}:undefined;
  }
  updateSeated(vehicle:Object3D,seat:Vector3){
    const binding=this.reactions.get('car_sit');if(!binding){this.root.visible=false;return;}
    this.root.position.copy(vehicle.localToWorld(seat.clone()));this.root.quaternion.copy(vehicle.getWorldQuaternion(new Quaternion()));this.root.visible=vehicle.visible;
    this.transition.restoreTargets();binding.sample(0,false,false);this.updatePoseMatrices();this.poseRevision++;
  }
  private vehicleBindings=new Map<string,ReturnType<typeof bindAnimation>>();
  private vehicleClip?:string;
  private overlayTransition?:PoseTransition;
  /** Car entry, exit and driving clips. Car tasks do not extract velocity, so the root translation stays in the pose;
   * clips named in `extracted` (CAR_rollout_*) remove root X/Y against the rest pose as the moving-shift source. */
  installVehicleClips(clips:Record<string,NativeAnimation>,extracted:readonly string[]=[]){
    for(const [name,source] of Object.entries(clips)){
      if(this.vehicleBindings.has(name))continue;
      // Some car clips carry named helper tracks (such as "Root") that the ped skeleton does not have.
      const frames=this.source.model.frames,clip={...source,tracks:source.tracks.filter(t=>frames.filter(f=>t.boneId>=0?f.hanim?.id===t.boneId:f.name.trim().toLowerCase()===t.name.trim().toLowerCase()).length===1)};
      if(!clip.tracks.some(t=>t.times.length))continue;
      const track=clip.tracks.findIndex(t=>t.boneId===0&&t.translations),extract=extracted.includes(name)&&track>=0;
      this.vehicleBindings.set(name,bindAnimation(this.source.model,this.owner.root,clip,extract?{track,axes:['x','y'],anchor:'rest-pose'}:undefined));
    }
  }
  hasVehicleClip(name:string){return this.vehicleBindings.has(name);}
  /** Extracted root X/Y motion of a vehicle clip between two times, in native ped space. */
  vehicleClipMotion(name:string,from:number,to:number){const motion=this.vehicleBindings.get(name)?.rootMotion;return motion?motion.delta(from,to,false,new Vector3()):new Vector3();}
  /** Samples a vehicle clip with the entity pinned in car space (`vehicle` + native-space `local`) or standing in the world.
   * `blend` fades from the previously rendered pose (BlendAnimation delta × time); `overlay` weights a partial clip's final
   * frame, and `overlays` several partial clips at their own times. */
  updateVehicle(frame:{vehicle?:Object3D;local?:{x:number;y:number;z:number};headingOffset?:number;position?:{x:number;y:number;z:number};heading?:number},pose:{clip:string;seconds:number;blend?:number;overlay?:{clip:string;amount:number};overlays?:readonly {clip:string;amount:number;seconds:number}[]}){
    const binding=this.vehicleBindings.get(pose.clip);if(!binding){this.root.visible=false;return false;}
    if(frame.vehicle&&frame.local){this.root.position.copy(frame.vehicle.localToWorld(new Vector3(frame.local.x,frame.local.z,-frame.local.y)));this.root.quaternion.copy(frame.vehicle.getWorldQuaternion(new Quaternion()));if(frame.headingOffset)this.root.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),frame.headingOffset));this.root.visible=frame.vehicle.visible;}
    else if(frame.position){this.root.position.set(frame.position.x,frame.position.y,frame.position.z);this.root.rotation.set(0,(frame.heading??0)+this.headingOffset,0);this.root.visible=true;}
    if(pose.clip!==this.vehicleClip){
      this.transition.capture();
      if(this.vehicleClip&&this.vehicleClip!==pose.clip)this.vehicleBindings.get(this.vehicleClip)?.restore();
      this.vehicleClip=pose.clip;
    }
    this.transition.restoreTargets();binding.sample(pose.seconds,false,false);this.transition.apply(pose.blend??1);
    // The single `overlay` holds its final frame; `overlays` play each at its own time, laid on in turn.
    const layers=pose.overlays??(pose.overlay?[{...pose.overlay,seconds:Infinity}]:[]);
    for(const layer of layers){
      const overlay=this.vehicleBindings.get(layer.clip);if(!overlay||!(layer.amount>0))continue;
      this.overlayTransition??=new PoseTransition(this.transitionTargets());
      this.overlayTransition.capture();overlay.sample(Math.min(layer.seconds,overlay.duration),false,false);this.overlayTransition.apply(layer.amount);
    }
    this.updatePoseMatrices();this.poseRevision++;return true;
  }
  /** Leaves vehicle posing; the next on-foot sample restores every bone the vehicle clips touched. */
  endVehicle(){this.transition.capture();for(const binding of this.vehicleBindings.values())binding.restore();this.vehicleClip=undefined;this.transitionTime=this.previousTransitionTime=0;this.transitionDuration=TRANSITION_SECONDS;this.poseGeneration++;}
  private transitionTargets(){const targets:Object3D[]=[];this.owner.root.traverse(o=>{if(Number.isInteger(o.userData.nativeFrame)&&this.source.model.frames[o.userData.nativeFrame]?.hanim)targets.push(o);});return targets;}
  get inVehiclePose(){return !!this.vehicleClip;}
  /** m_nMoveState is PEDMOVE_SPRINT. */
  get sprinting(){return this.moveAnims?this.action==='move'&&this.moveAnims.moveState==='sprint':this.action==='sprint';}
  /** CPlayerPedData::m_fMoveBlendRatio: 0 still, 1 walking, 2 running. */
  get moveBlendRatio(){return this.moveBlend;}
  update(sim: Pick<Simulation, 'player'>, alpha: number) {
    if(this.vehicleClip)this.endVehicle();
    // A dead CJ stays drawn: the death clip plays on his body through the wasted sequence.
    const p = sim.player; this.root.visible = p.health <= 0 || this.supported(sim);
    this.root.position.set(p.previous.x+(p.position.x-p.previous.x)*alpha,p.previous.y+(p.position.y-p.previous.y)*alpha+this.originHeight,p.previous.z+(p.position.z-p.previous.z)*alpha);
    // Heading is interpolated between fixed steps as the position is; a wrapped difference turns the short way.
    const from=this.stepHeading??p.heading,turn=Math.atan2(Math.sin(p.heading-from),Math.cos(p.heading-from)),heading=from+turn*alpha;
    // The whole rotation, not just the yaw: a seated or vehicle-clip frame copied the car's quaternion into the root,
    // and a quaternion of a car facing past ±90° reads back as the Euler triple (π, π−yaw, π); writing only the yaw
    // onto that left CJ standing on his head after getting out of a car facing that way.
    // SET_CHAR_ROTATION's matrix is CMatrix::SetRotate: the heading, then x about the ped's right and y about its
    // forward; in these axes native y is -z, so the roll turns the other way about z.
    const tilt = p.tilt;
    this.root.rotation.set(tilt ? tilt.x : 0, heading + this.headingOffset, tilt ? -tilt.y : 0, 'YXZ');this.renderedHeading=heading;
    this.samplePose(this.previous + (this.seconds-this.previous)*alpha, this.previousTransitionTime + (this.transitionTime-this.previousTransitionTime)*alpha);
  }
  private samplePose(seconds: number, transitionTime: number) {
    this.transition.restoreTargets();
    // Clips layer on local matrices; world matrices are brought up to date once, below.
    const fraction = this.seconds === this.previous ? 1 : (seconds - this.previous) / (this.seconds - this.previous);
    if (this.action === 'move') this.sampleMoves(fraction);
    else if (this.action === 'gunMove' || this.action === 'fightMove') this.sampleGunMoves(fraction);
    else this.active.binding.sample(seconds, !oneShot(this.action), false);
    this.transition.apply(transitionTime / this.transitionDuration);
    // CTaskSimpleFight owns the whole body while it shuffles (FIGHTIDLE, FightSh_*): no held weapon pose is laid over it,
    // which froze the legs under the melee clip's first frame while CJ slid along.
    const aimPose=this.aimPose&&this.aimBlend>0&&!this.reaction&&this.action!=='fightMove'?this.reactions.get(this.aimPose.name):undefined;
    if(aimPose){
      if(this.aimBlend>=1)aimPose.sample(this.aimPose!.time,false,false);
      else{this.aimTransition??=new PoseTransition(this.transitionTargets());this.aimTransition.capture();aimPose.sample(this.aimPose!.time,false,false);this.aimTransition.apply(this.aimBlend);}
    }
    if(this.carryPose&&!this.reaction)this.reactions.get(this.carryPose)?.sample(seconds,true,false);
    if(this.reaction)this.reactions.get(this.reaction.name)?.sample(this.reaction.time,this.reaction.loop,false);
    if(this.weaponReload){const binding=this.reactions.get(this.weaponReload.name);binding?.sample(this.weaponReload.progress*binding.duration,false,false);}
    if(!this.weaponReload)this.aimUpperBody();
    this.applyLegSwing();
    this.applyHeadLook();
    this.updatePoseMatrices();
    const key=`${this.action}/${seconds}/${transitionTime}/${this.poseGeneration}`;
    if(key!==this.sampledPose){this.sampledPose=key;this.poseRevision++;}
  }
  /** The player's shoulder correction starts from a full update of its own, so it needs no second pass. */
  private updatePoseMatrices(){if(this.shoulders)this.shoulders.update();else this.owner.root.updateMatrixWorld(true);}
  get shadowPoseRevision(){return this.poseRevision;}
  setAmbient(rgb?: readonly number[], multiplier=1, contactMultiplier=1) {
    if (!Number.isFinite(contactMultiplier)||contactMultiplier<0) throw new Error('Invalid native contact multiplier.');
    if (!Number.isFinite(multiplier) || multiplier < 0 || rgb && (rgb.length !== 3 || rgb.some(v=>!Number.isFinite(v)||v<0||!Number.isFinite(v*multiplier)))) throw new Error('Native character ambient light must be finite and nonnegative.');
    if (rgb) this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);
    this.ambient.directMultiplier.value=contactMultiplier;
    this.ambient.enabled.value=!!rgb;
  }
  setNight(amount: number) { this.owner.setNight(amount); }
  /** A look-at from the ped's own tasks (LookAtInterestingEntities, scripts): the world target and the blend. */
  private externalLook?:{target:Vector3;blend:number};
  /** The look-at chain's IK orientation of the head (neck space), kept while any look holds the head. */
  private lookOrientation?:Quat;
  /** IKChainManager_c::LookAt for this ped's head: aim the head at a world point with `blend` (0 clears). */
  setHeadLook(target:Vector3|undefined,blend:number){
    if(!target||blend<=0){this.externalLook=undefined;return;}
    if(!this.externalLook)this.externalLook={target:target.clone(),blend};
    else{this.externalLook.target.copy(target);this.externalLook.blend=blend;}
  }
  /** The look that holds the chain: the aim's (priority 3) over any other. */
  private activeLook(){return this.aimLook?{target:this.aimLook.target,blend:this.aimLook.task.blend}:this.externalLook;}
  get headLookBlend(){return this.activeLook()?.blend??0;}
  /** IKChain_c::Update after the clips: the head bone chases the target in its parent's space, clamps to its
   * limits and slerps the animated pose toward the result by the blend (BoneNode_c::BlendKeyframe). */
  /** What the look-at wrote to the head last frame and the animated matrix it replaced: a clip that leaves the
   * head bone alone would otherwise keep the IK pose after the chain is gone (the original rewrites the frame from
   * its keyframes every frame). */
  private headWritten?:{written:Matrix4;animated:Matrix4};
  private applyHeadLook(){
    const head=this.bone(5),neck=head?.parent;if(!head||!neck)return;
    if(this.headWritten&&head.matrix.equals(this.headWritten.written)){head.matrix.copy(this.headWritten.animated);head.matrixWorldNeedsUpdate=true;}
    const look=this.activeLook();if(!look||look.blend<=0){this.headWritten=undefined;this.lookOrientation=undefined;return;}
    this.owner.root.updateMatrixWorld(true);
    const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();head.matrix.decompose(position,rotation,scale);
    this.lookOrientation??=[rotation.x,rotation.y,rotation.z,rotation.w];
    const local=neck.worldToLocal(look.target.clone()),target:[number,number,number]=[local.x-position.x,local.y-position.y,local.z-position.z];
    const animated:Quat=[rotation.x,rotation.y,rotation.z,rotation.w];
    const pose=quatToEulerDeg(animated);
    this.lookOrientation=limitHead(moveHeadToTarget(this.lookOrientation,[...HEAD_EFFECTOR_OFFSET],target,LOOK_AT_SPEED),pose);
    const blended=slerpQuat(animated,this.lookOrientation,look.blend);
    const animatedMatrix=head.matrix.clone();
    head.matrix.compose(position,rotation.set(blended[0],blended[1],blended[2],blended[3]),scale);head.matrixWorldNeedsUpdate=true;
    this.headWritten={written:head.matrix.clone(),animated:animatedMatrix};
  }
  /** The head effector's world direction, for probes. */
  headForward(){const head=this.bone(5);if(!head)return undefined;this.owner.root.updateMatrixWorld(true);const o=head.getWorldPosition(new Vector3()),e=head.localToWorld(new Vector3(...HEAD_EFFECTOR_OFFSET));return e.sub(o).normalize();}
  private alphaApplied=1;
  private baseByMaterial=new Map<object,{opaque:boolean;opacity:number}>();
  /** CVisibilityPlugins::SetClumpAlpha for the whole clump: scales every material's own alpha by `alpha` (0 to 1). */
  setAlpha(alpha:number){
    const a=Math.max(0,Math.min(1,alpha));if(a===this.alphaApplied)return;this.alphaApplied=a;
    for(const b of this.owner.materialBindings){
      let base=this.baseByMaterial.get(b.material);if(!base){base={opaque:!b.material.transparent,opacity:Number.isFinite(b.material.opacity)?b.material.opacity:1};this.baseByMaterial.set(b.material,base);}
      b.material.opacity=base.opacity*a;const transparent=a<1||!base.opaque;
      // three compiles an opaque material with alpha forced to 1 and does not recompile when this flag flips.
      if(b.material.transparent!==transparent){b.material.transparent=transparent;b.material.needsUpdate=true;}
    }
  }
  get alpha(){return this.alphaApplied;}
  shadowSphere(){
    if(!this.sourceShadowSphere)return undefined;
    this.owner.root.updateWorldMatrix(true,false);
    return {center:this.sourceShadowSphere.center.clone().applyMatrix4(this.owner.root.matrixWorld),radius:this.sourceShadowSphere.radius};
  }
  /** StoreRealTimeShadow uses BONE_ROOT for distance, independently of capture bounds.
   * GetBonePosition falls back to the entity position when the bone is absent. */
  shadowPosition(){
    // Only the bone's ancestors need to be current, not the whole skeleton.
    return new Vector3().setFromMatrixPosition(this.worldOf(this.shadowRootBone??this.root));
  }
  /** The current locomotion action, as snapshot().action gives it, without building the snapshot. */
  get currentAction(){return this.action === 'move' ? this.moveAction() : this.action;}
  snapshot() { return { motionGroup:this.playerMotionGroup,vehicleClip:this.vehicleClip??null,reload:this.weaponReload??null,reaction:this.reaction?.name??null, gun:this.gunAnims?{cmd:{...this.gunAnims.cmd},lowered:this.gunAimLowered,poses:this.gunAnims.poses().map(a=>({clip:a.clip,blend:+a.blend.toFixed(3),playing:a.playing,speed:+a.speed.toFixed(3)}))}:null, playbackSpeed:landingAction(this.action)?this.landingSpeed:1, moveBlend:this.moveBlend, playerBody:!!this.shoulders, bodySwaps:this.bodySwaps, transition: this.transitionTime / this.transitionDuration, action: this.action === 'move' ? this.moveAction() : this.action, moves: this.moveAnims ? [...this.moveAnims.assocs.values()].map(a => ({ clip: a.clip, blend: a.blend, time: a.time })) : null, seconds: this.seconds, visible: this.root.visible }; }
  /** The gait the movement associations show, by name. */
  private moveAction(): Action { const a = this.moveAnims!; if (a.assocs.has('runStop') || a.assocs.has('runStopR')) return 'runStop'; if (a.assocs.has('walkStart')) return 'walkStart'; const w = (c: MoveClip) => a.assocs.get(c)?.blend ?? 0; return w('sprint') > .5 ? 'sprint' : w('run') > w('walk') && w('run') > w('idle') ? 'run' : w('walk') > w('idle') ? 'walk' : 'idle'; }
  dispose() { this.setThermal(false);this.heatMaterial.dispose();this.root.removeFromParent(); this.owner.dispose(); }
}
