import {requireAsset} from './binary';
import type {HandlingSupplement} from './handling';
/** Vehicle entry animation slots, in ANIM_ID_CAR_ALIGN_LHS order (aCarAnimDescs). */
export const VEHICLE_ANIM={alignLHS:0,alignRHS:1,alignHiLHS:2,alignHiRHS:3,openLHS:4,openRHS:5,openRearLHS:6,openRearRHS:7,getinLHS:8,getinRHS:9,getinRearLHS:10,getinRearRHS:11,getinBike:12,pulloutLHS:13,pulloutRHS:14,closedoorLHS:16,closedoorRHS:17,closedoorRearLHS:18,closedoorRearRHS:19,shuffle:20,shuffleRear:21,getoutLHS:22,getoutRHS:23,getoutRearLHS:24,getoutRearRHS:25,jackedLHS:27,jackedRHS:28,closeLHS:29,closeRHS:30,closeRearLHS:31,closeRearRHS:32,rolloutLHS:33,rolloutRHS:34,rolldoor:35,falloutLHS:36,falloutRHS:37,doorlockedLHS:38,doorlockedRHS:39} as const;
/** CVehicleAnimGroup::GetGroup: the second-group flag bit that selects each slot. */
export function vehicleAnimFlagBit(slot:number){
 if(slot<=3)return 0;if(slot<=5)return 1;if(slot<=7)return 2;if(slot<=9||slot===12)return 3;if(slot<=11)return 4;if(slot<=15)return 5;
 if(slot<=17)return 6;if(slot<=19)return 7;if(slot<=21)return 8;if(slot<=23)return 9;if(slot<=25)return 10;if(slot<=28)return 11;
 if(slot<=30)return 12;if(slot<=32)return 13;if(slot<=34)return 14;if(slot===35)return 15;if(slot<=37)return 16;return 17;
}
const std=['CAR_align_LHS','CAR_align_RHS','CAR_alignHI_LHS','CAR_alignHI_RHS','CAR_open_LHS','CAR_open_RHS','CAR_open_LHS','CAR_open_RHS','CAR_getin_LHS','CAR_getin_RHS','CAR_getin_LHS','CAR_getin_RHS','','CAR_pullout_LHS','CAR_pullout_RHS','','CAR_closedoor_LHS','CAR_closedoor_RHS','CAR_closedoor_LHS','CAR_closedoor_RHS','CAR_shuffle_RHS','CAR_shuffle_RHS','CAR_getout_LHS','CAR_getout_RHS','CAR_getout_LHS','CAR_getout_RHS','','CAR_jackedLHS','CAR_jackedRHS','CAR_close_LHS','CAR_close_RHS','CAR_close_LHS','CAR_close_RHS','CAR_rollout_LHS','CAR_rollout_RHS','CAR_rolldoor','CAR_fallout_LHS','CAR_fallout_RHS','CAR_doorlocked_LHS','CAR_doorlocked_RHS'];
const low=['CAR_align_LHS','CAR_align_RHS','CAR_alignHI_LHS','CAR_alignHI_RHS','CAR_open_LHS','CAR_open_RHS','CAR_open_LHS','CAR_open_RHS','CAR_getinL_LHS','CAR_getinL_RHS','CAR_getinL_LHS','CAR_getinL_RHS','','CAR_pulloutL_LHS','CAR_pulloutL_RHS','','CAR_closedoorL_LHS','CAR_closedoorL_RHS','CAR_closedoorL_LHS','CAR_closedoorL_RHS','CAR_Lshuffle_RHS','CAR_Lshuffle_RHS','CAR_getoutL_LHS','CAR_getoutL_RHS','CAR_getoutL_LHS','CAR_getoutL_RHS','','CAR_LjackedLHS','CAR_LjackedRHS','CAR_close_LHS','CAR_close_RHS','CAR_close_LHS','CAR_close_RHS','CAR_rollout_LHS','CAR_rollout_RHS','CAR_rolldoorLO','CAR_fallout_LHS','CAR_fallout_RHS','CAR_doorlocked_LHS','CAR_doorlocked_RHS'];
const blank=(entries:Record<number,string>)=>Array.from({length:40},(_,i)=>entries[i]??'');
const truck=blank({0:'TRUCK_ALIGN_LHS',1:'TRUCK_ALIGN_RHS',2:'TRUCK_ALIGN_LHS',3:'TRUCK_ALIGN_LHS',4:'TRUCK_open_LHS',5:'TRUCK_open_RHS',6:'TRUCK_open_LHS',7:'TRUCK_open_RHS',8:'TRUCK_getin_LHS',9:'TRUCK_getin_RHS',10:'TRUCK_getin_LHS',11:'TRUCK_getin_RHS',13:'TRUCK_pullout_LHS',14:'TRUCK_pullout_RHS',16:'TRUCK_closedoor_LHS',17:'TRUCK_closedoor_RHS',18:'TRUCK_closedoor_LHS',19:'TRUCK_closedoor_RHS',20:'TRUCK_Shuffle',21:'TRUCK_Shuffle',22:'TRUCK_getout_LHS',23:'TRUCK_getout_RHS',24:'TRUCK_getout_LHS',25:'TRUCK_getout_RHS',27:'TRUCK_jackedLHS',28:'TRUCK_jackedRHS',29:'TRUCK_close_LHS',30:'TRUCK_close_RHS',31:'TRUCK_close_LHS',32:'TRUCK_close_RHS'});
const conv=std.map((name,i)=>i===8||i===10?'CAR_jumpin_LHS':name);
const van=blank({6:'VAN_open_back_LHS',7:'VAN_open_back_RHS',10:'VAN_getin_back_LHS',11:'VAN_getin_back_RHS',18:'VAN_close_back_LHS',19:'VAN_close_back_RHS',24:'VAN_getout_back_LHS',25:'VAN_getout_back_RHS'});
const rustler=blank({0:'Plane_align_LHS',4:'Plane_open',8:'Plane_getin',16:'Plane_close',22:'Plane_getout',35:'Plane_close'});
const harrier=blank({4:'Plane_open',8:'Plane_getin',16:'Plane_close',22:'Plane_getout',35:'Plane_close'});
const lear=blank({0:'SHAMAL_align',4:'SHAMAL_open',8:'SHAMAL_getin_LHS',22:'SHAMAL_getout_LHS'});
const nevada=blank({8:'NEVADA_getin',22:'NEVADA_getout'});
const coach=blank({4:'COACH_opnL',5:'COACH_opnR',6:'COACH_opnL',7:'COACH_opnR',8:'COACH_inL',9:'COACH_inR',10:'COACH_inL',11:'COACH_inR',22:'COACH_outL',23:'COACH_outR',24:'COACH_outL',25:'COACH_outR'});
const bus=blank({4:'BUS_open',5:'BUS_open_RHS',6:'BUS_open',8:'BUS_getin_LHS',9:'BUS_getin_RHS',10:'BUS_getin_LHS',13:'BUS_pullout_LHS',14:'BUS_pullout_LHS',16:'BUS_close',18:'BUS_close',22:'BUS_getout_LHS',23:'BUS_getout_RHS',24:'BUS_getout_LHS',27:'BUS_jacked_LHS',28:'BUS_jacked_LHS',29:'BUS_close',31:'BUS_close'});
const dozer=blank({0:'DOZER_align_LHS',1:'DOZER_align_RHS',2:'DOZER_align_LHS',3:'DOZER_align_LHS',8:'DOZER_getin_LHS',9:'DOZER_getin_RHS',10:'DOZER_getin_LHS',11:'DOZER_getin_RHS',13:'DOZER_pullout_LHS',14:'DOZER_pullout_RHS',22:'DOZER_getout_LHS',23:'DOZER_getout_RHS',24:'DOZER_getout_LHS',25:'DOZER_getout_RHS',27:'DOZER_Jacked_LHS',28:'DOZER_Jacked_RHS'});
const kart=blank({8:'KART_getin_LHS',9:'KART_getin_RHS',22:'KART_getout_LHS',23:'KART_getout_RHS'});
const hover=blank({8:'CAR_jumpin_LHS',9:'CAR_jumpin_RHS',22:'vortex_getout_LHS',23:'vortex_getout_RHS'});
const tank=blank({0:'TANK_align_LHS',4:'TANK_open_LHS',8:'TANK_getin_LHS',16:'TANK_close_LHS',22:'TANK_getout_LHS',38:'TANK_doorlocked'});
const bfinj=blank({8:'BF_getin_LHS',9:'BF_getin_RHS',22:'BF_getout_LHS',23:'BF_getout_RHS'});
/** ms_aAnimAssocDefinitions car groups (AssocGroupId 88 + n): IFP block ('ped' is ped.ifp) and slot names. Bike groups 3–12 are omitted. */
export const VEHICLE_ANIM_GROUP_TABLES:Readonly<Record<number,{file:string;anims:readonly string[]}>>={
 0:{file:'ped',anims:std},1:{file:'ped',anims:low},2:{file:'truck',anims:truck},13:{file:'van',anims:van},14:{file:'rustler',anims:rustler},15:{file:'coach',anims:coach},16:{file:'bus',anims:bus},17:{file:'dozer',anims:dozer},18:{file:'kart',anims:kart},
 19:{file:'ped',anims:conv},20:{file:'truck',anims:truck},21:{file:'coach',anims:coach},22:{file:'ped',anims:std},23:{file:'vortex',anims:hover},24:{file:'tank',anims:tank},25:{file:'bf_injection',anims:bfinj},26:{file:'shamal',anims:lear},27:{file:'rustler',anims:harrier},28:{file:'ped',anims:std},29:{file:'nevada',anims:nevada},
};
export const ANIM_GROUP={std:0,low:1,truck:2,van:13,rustler:14,coach:15,bus:16,dozer:17,kart:18,conv:19,mtruck:20,train:21,stdTall:22,hover:23,tank:24,bfinj:25,lear:26,harrier:27,stdUpright:28,nevada:29} as const;
export interface VehicleAnimGroupData {
 id:number;first:number;second:number;flags:number;special:number;
 /** Critical blend times (CVehicleAnimGroup::ComputeCriticalBlendTime), not durations. */
 times:{getIn:number;jumpOut:number;getOut:number;jackedOut:number;fallOut:number};
 openOut:[number,number];closeIn:[number,number];openIn:[number,number];closeOut:[number,number];
}
/** Special flags from handling.cfg: 1 don't close after getting out, 2 after getting in, 4 kart, 8 truck drive, 16 hover, 32 locked door, 64 don't open door. */
export const VEHICLE_ANIM_SPECIAL={noCloseAfterOut:1,noCloseAfterIn:2,kart:4,truckDrive:8,hover:16,specialLocked:32,noOpenDoor:64} as const;
/** CVehicleAnimGroup::InitFromData for handling.cfg `^` rows (35 fields including the ID). */
export function readVehicleAnimGroups(supplements:readonly HandlingSupplement[]){
 const groups=new Map<number,VehicleAnimGroupData>();
 for(const row of supplements){
  if(row.kind!=='animation')continue;const t=row.tokens;
  requireAsset(t.length>=35,`Handling line ${row.line}: expected 35 vehicle anim group fields.`);
  const n=t.slice(0,35).map(Number);requireAsset(n.every(Number.isFinite),`Handling line ${row.line}: invalid vehicle anim group value.`);
  let flags=0;for(let i=0;i<18;i++)if(n[3+i])flags|=1<<i;
  groups.set(n[0],{id:n[0],first:n[1],second:n[2],flags,special:n[34],times:{getIn:n[21],jumpOut:n[22],getOut:n[23],jackedOut:n[24],fallOut:n[25]},openOut:[n[26],n[27]],closeIn:[n[28],n[29]],openIn:[n[30],n[31]],closeOut:[n[32],n[33]]});
 }
 return groups;
}
/** Resolves a slot through the vehicle's two-group selection to an IFP block and animation name. */
export function vehicleAnimation(data:VehicleAnimGroupData,slot:number){
 const group=data.flags&(1<<vehicleAnimFlagBit(slot))?data.second:data.first,table=VEHICLE_ANIM_GROUP_TABLES[group];
 const name=table?.anims[slot];return table&&name?{group,file:table.file,name}:undefined;
}
export type DoorAnimKind='open'|'closeInside'|'getOut'|'closeOutside'|'jacked'|'fallOut'|'pullout'|'rollout';
const TIMED_GROUPS=new Set([0,1,2,14,15,19,20,22,25]);
/** CVehicle::ProcessOpenDoor for one animation time in seconds. Returns the new open ratio, or undefined when
 * the door is left alone (inside an only-increasing or only-decreasing window, or exactly on a window edge). */
export function nativeDoorAnimRatio(data:VehicleAnimGroupData,kind:DoorAnimKind,time:number,current:number,animGroup=data.first){
 const window=(start:number,end:number,closing:boolean,monotonic:boolean)=>{
  if(time<start)return closing?1:0;if(time>end)return closing?0:1;
  if(!(time>start&&time<end))return undefined;
  const u=(time-start)/(end-start),next=closing?1-u:u;
  return !monotonic||(closing?current>next:current<next)?next:undefined;
 };
 switch(kind){
  case 'open':return window(data.openOut[0],data.openOut[1],false,true);
  case 'closeOutside':return window(data.closeOut[0],data.closeOut[1],true,true);
  case 'closeInside':return window(data.closeIn[0],data.closeIn[1],true,false);
  case 'getOut':return window(data.openIn[0],data.openIn[1],false,true);
  case 'jacked':case 'fallOut':return time<.1?0:time>.4?1:time>.1&&time<.4?(time-.1)*(10/3):undefined;
  case 'pullout':return [0,1,2,15,16,19,20,22,25].includes(animGroup)?1:undefined;
  case 'rollout':return TIMED_GROUPS.has(animGroup)?window(.01,.1,false,true):undefined;
 }
}
