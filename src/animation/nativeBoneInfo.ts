/* BoneNodeManager_c::ms_boneInfos (PC 0x8D26D0), which gta-reversed leaves in the executable: read from the iOS one
 * (0x100651658, 32 BoneInfo_t of 0x28 bytes). BoneNode_c::InitLimits clamps a bone's Tait-Bryan XYZ angles (QuatToEuler,
 * degrees) between pose − min and pose + max on each axis. The poses are the skeleton's own where the IK leaves a bone
 * be (the belly, breasts, jaw and toes match the ped DFFs' bind rotations to 0.1°); along the arms, neck and head they
 * are the pose the limits are centred on. */
export interface BoneInfo {tag:number;parent:number;pose:readonly [number,number,number];min:readonly [number,number,number];max:readonly [number,number,number]}
export const BONE_INFOS:readonly BoneInfo[]=[
 {tag:0,parent:-1,pose:[-0.2,0.4,87.3],min:[0,0,0],max:[0,0,0]},
 {tag:1,parent:0,pose:[-180,-88.5,90],min:[0,0,0],max:[0,0,0]},
 {tag:2,parent:1,pose:[2.1,0,-0.8],min:[30,20,5],max:[30,20,60]},
 {tag:3,parent:2,pose:[2.6,0.4,6.1],min:[10,10,15],max:[10,10,10]},
 {tag:4,parent:3,pose:[0,0,0],min:[0,0,0],max:[0,0,0]},
 {tag:5,parent:4,pose:[-1.8,-0.5,-7.3],min:[65,15,45],max:[65,15,45]},
 {tag:6,parent:5,pose:[-1.4,-9,81.5],min:[0,0,0],max:[0,0,0]},
 {tag:7,parent:5,pose:[3.2,6.7,81.7],min:[0,0,0],max:[0,0,0]},
 {tag:8,parent:5,pose:[0,0,111],min:[0,0,0],max:[0,0,0]},
 {tag:21,parent:4,pose:[22,80.6,-166.7],min:[0,0,0],max:[0,0,0]},
 {tag:22,parent:21,pose:[-5.4,-45,-13],min:[0,0,90],max:[0,115,45]},
 {tag:23,parent:22,pose:[0,0,-13.6],min:[0,0,135],max:[0,0,13]},
 {tag:24,parent:23,pose:[113.4,-4,6.5],min:[0,0,0],max:[0,0,0]},
 {tag:25,parent:24,pose:[0,0,19.5],min:[0,0,0],max:[0,0,0]},
 {tag:26,parent:25,pose:[0,0,13.3],min:[0,0,0],max:[0,0,0]},
 {tag:31,parent:4,pose:[-22,-80.6,-166.7],min:[0,0,0],max:[0,0,0]},
 {tag:32,parent:31,pose:[5.4,45.6,-13],min:[0,115,90],max:[0,0,45]},
 {tag:33,parent:32,pose:[0,0,-13.6],min:[0,0,135],max:[0,0,13]},
 {tag:34,parent:33,pose:[-113.4,4,6.5],min:[0,0,0],max:[0,0,0]},
 {tag:35,parent:34,pose:[0,0,19.5],min:[0,0,0],max:[0,0,0]},
 {tag:36,parent:35,pose:[0,0,13.3],min:[0,0,0],max:[0,0,0]},
 {tag:41,parent:1,pose:[176,-7.7,165.9],min:[0,20,30],max:[0,5,0]},
 {tag:42,parent:41,pose:[0,0,-24.4],min:[0,0,110],max:[0,0,0]},
 {tag:43,parent:42,pose:[-1.4,-5,10],min:[0,0,0],max:[0,0,0]},
 {tag:44,parent:43,pose:[0,0,90],min:[0,0,0],max:[0,0,0]},
 {tag:51,parent:1,pose:[-176,7.7,165.9],min:[0,5,30],max:[0,20,0]},
 {tag:52,parent:51,pose:[0,0,-24.4],min:[0,0,110],max:[0,0,0]},
 {tag:53,parent:52,pose:[1.4,5,10],min:[0,0,0],max:[0,0,0]},
 {tag:54,parent:53,pose:[0,0,90],min:[0,0,0],max:[0,0,0]},
 {tag:302,parent:3,pose:[15.1,-1.9,81],min:[0,0,0],max:[0,0,0]},
 {tag:301,parent:3,pose:[-6,2,84.3],min:[0,0,0],max:[0,0,0]},
 {tag:201,parent:2,pose:[0,0,88.1],min:[0,0,0],max:[0,0,0]},
];
const byTag=new Map(BONE_INFOS.map(info=>[info.tag,info]));
/** BoneNodeManager_c::GetBoneInfoFromTag. */
export const boneInfo=(tag:number)=>byTag.get(tag);
/** BoneNode_c::InitLimits: the clamp range of each axis. */
export function boneLimits(info:BoneInfo){
 return {min:[info.pose[0]-info.min[0],info.pose[1]-info.min[1],info.pose[2]-info.min[2]] as [number,number,number],
  max:[info.pose[0]+info.max[0],info.pose[1]+info.max[1],info.pose[2]+info.max[2]] as [number,number,number]};
}
/** CPedIK::ms_torsoInfo (PC 0x8D22E4), read from the iOS executable (0x100650cd0, where PointGunInDirection's inlined
 * MoveLimb reads it): the upper torso's yaw within ±50° and its pitch from 55° up to 60° down (CPedIK's pitch is
 * positive aiming down), stepping 3° and 5° a frame when not normalized. Vice City's, which the port had, was ±50°,
 * ±45°, 15° and 7°. Degrees. */
export const TORSO_INFO={maxYaw:50,minYaw:-50,yawStep:3,maxPitch:60,minPitch:-55,pitchStep:5} as const;
