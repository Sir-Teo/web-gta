/** CTaskComplexFollowLeaderInFormation::ms_offsets, native world axes (x east, y north), as the iOS executable's static
 * initialiser (0x1004366d4) fills the table at 0x1008e5100; PC's (0xC196E8) is runtime data the reversed sources do not
 * carry. CPedGroup::Teleport (iOS 0x100350088) puts follower i at the leader's point plus Offsets[i], in world axes and
 * at the leader's height, and CEntryExit::WarpGangWithPlayer takes them in turn. Before, a wedge a unit apart stood in. */
export const GROUP_TELEPORT_OFFSETS:readonly (readonly [number,number])[]=[[-1,1],[1,1],[0,1],[-1,0],[1,0],[-1,-1],[0,-1],[1,-1]];
/** ms_offsets.MovingOffsets, the walking formation behind the leader (scale 1). */
export const GROUP_MOVING_OFFSETS:readonly (readonly [number,number])[]=[[-1,0],[1,0],[0,-1.25],[-1.25,-1.25],[1.25,-1.25],[0,-2.5],[-1,-2.5],[1,-2.5]];
type V2={x:number;y:number};type V3={x:number;y:number;z:number};
/** CTaskComplexGangFollower's formation offset (+0x34) and the leader position it was latched at (+0x28, flag bit 4). */
export interface GangFollowerState {offset:V2;latch?:V3;latched:boolean}
/** CTaskComplexGangFollower::CalculateOffsetPosition (iOS 0x1003fb0d0) for the follower in member slot `slot` (0 to 6):
 * while the leader walks, runs or sprints, MovingOffsets[slot] turned by his matrix (x along his right, y along his
 * forward); otherwise Offsets[slot] in world axes, latched until he has moved 3 units from where it was taken (an offset
 * already latched is kept, the stuck mirror included). Native axes. ms_offsets.Scale is never read. */
export function gangFollowerOffset(slot:number,leader:{position:V3;right:V2;forward:V2;moving:boolean},state:GangFollowerState){
 if(leader.moving){
  const [x,y]=GROUP_MOVING_OFFSETS[slot];
  state.offset={x:leader.right.x*x+leader.forward.x*y,y:leader.right.y*x+leader.forward.y*y};state.latched=false;
 }else if(!state.latched||!state.latch||(leader.position.x-state.latch.x)**2+(leader.position.y-state.latch.y)**2+(leader.position.z-state.latch.z)**2>9){
  const [x,y]=GROUP_TELEPORT_OFFSETS[slot];
  state.latch={...leader.position};state.offset={x,y};state.latched=true;
 }
 return state.offset;
}
/** CTaskComplexGangFollower's seek (CTaskComplexSeekEntity<XYOffset>: arrived within 0.5, move-state radius 5, capped
 * at a sprint): the gait by the 2D distance to the formation point, walking under 5 units, running under 10 and
 * sprinting beyond. */
export function gangFollowerGait(distance:number):'arrived'|'walk'|'run'|'sprint'{
 return distance<=.5?'arrived':distance<5?'walk':distance<10?'run':'sprint';
}
/** m_AnotherStaticCounter's limits for a follower: over 30 frames (1 s at 30 fps) it stands still instead of seeking;
 * from 9 frames within 8 units of the leader it gives up the seek and aims past him. */
export const FOLLOWER_STUCK_SECONDS=1,FOLLOWER_UNSTICK_SECONDS=.3,FOLLOWER_UNSTICK_RANGE=8;
/** CTaskSimpleStandStill(500) and the CTaskSimplePause(50) after it, before a follower seeks again. */
export const FOLLOWER_STAND_SECONDS=.5,FOLLOWER_PAUSE_SECONDS=.05;
/** CPedGroupMembership::m_fSeparationRange for the player's group: 120, set at every recruit (iOS 0x100365c88). */
export const PLAYER_GROUP_SEPARATION_RANGE=120;
/** CPlayerPed::ProcessGroupBehaviour (iOS 0x1003615d8): holding GROUP_CONTROL_FWD or GROUP_CONTROL_BWD this long, in
 * CPlayerPedData::m_nPadUpPressedInMilliseconds and m_nPadDownPressedInMilliseconds, disbands the group. */
export const GROUP_DISBAND_HOLD_MS=1200;
/** One frame of a group button's hold count. While the button is held and the group can be commanded (it has a
 * member and the player targets nobody), the frame's whole milliseconds (CTimer::ms_fTimeStep / 50 × 1000, truncated)
 * are added; otherwise the count goes back to 0. `disband` is the frame the count reaches GROUP_DISBAND_HOLD_MS.
 * (BWD's count disbands at 1200 or more; FWD's compares for exactly 1200, which a steady 30 fps step of 33 ms never
 * lands on. The port disbands on both as the count reaches it, as the help text has it.) */
export function stepGroupButtonHold(count:number,held:boolean,commandable:boolean,frameMs:number){
 if(!held||!commandable)return {count:0,disband:false};
 const next=count+Math.trunc(frameMs);
 return {count:next,disband:count<GROUP_DISBAND_HOLD_MS&&next>=GROUP_DISBAND_HOLD_MS};
}
