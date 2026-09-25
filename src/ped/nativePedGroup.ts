/* CPedGroup: a leader and its followers, as the script's group commands hold them.
 *
 * CPedGroupMembership keeps eight member slots. The last of them, index seven, is the leader's, and a follower
 * takes the first free slot below it; a ped already in the group is not added again, and when the slots are
 * full the ped is simply not added. Members that die leave the group, and a group whose leader has gone
 * appoints the first follower it still has. Everything here is by the handle a script holds, because that is
 * what the commands name; whether a handle still names a living ped is the caller's to say. */
export const TOTAL_PED_GROUP_MEMBERS=8,LEADER_MEM_ID=7;
/** ePedGroupDefaultTaskAllocatorType. */
export const GROUP_ALLOCATOR={followAnyMeans:0,followLimited:1,standStill:2,chat:3,random:4} as const;
export class NativePedGroup{
 /** One slot per member, the leader's last, each holding a handle or nothing. */
 private readonly members:(number|undefined)[]=Array(TOTAL_PED_GROUP_MEMBERS).fill(undefined);
 get leader(){return this.members[LEADER_MEM_ID];}
 /** CPedGroupMembership::SetLeader. */
 setLeader(handle:number|undefined){
  // A ped that was following becomes the leader rather than being in the group twice.
  if(handle!==undefined)this.removeMember(handle);
  this.members[LEADER_MEM_ID]=handle;
 }
 /** CPedGroupMembership::AddFollower: nothing happens for a ped already in the group or with no slot free. */
 addFollower(handle:number){
  if(this.isMember(handle))return false;
  for(let slot=0;slot<LEADER_MEM_ID;slot++)if(this.members[slot]===undefined){this.members[slot]=handle;return true;}
  return false;
 }
 /** CPedGroupMembership::RemoveMember by the ped rather than the slot. */
 removeMember(handle:number){
  let removed=false;
  for(let slot=0;slot<TOTAL_PED_GROUP_MEMBERS;slot++)if(this.members[slot]===handle){this.members[slot]=undefined;removed=true;}
  return removed;
 }
 isMember(handle:number){return this.members.includes(handle);}
 isLeader(handle:number){return this.leader===handle;}
 isFollower(handle:number){return this.isMember(handle)&&!this.isLeader(handle);}
 /** CPedGroupMembership::CountMembers and its leaderless form. */
 countMembers(){return this.members.filter(member=>member!==undefined).length;}
 countFollowers(){return this.countMembers()-(this.leader===undefined?0:1);}
 /** Every handle the group holds, the leader last, as the slots order them. */
 all(){return this.members.filter((member):member is number=>member!==undefined);}
 /** CPedGroupMembership::Flush. */
 flush(){this.members.fill(undefined);}
 /** m_separationRange: SET_GROUP_SEPARATION_RANGE's distance, 60 until a script sets it. */
 separationRange=60;
 /** m_bMembersEnterLeadersVehicle, which SET_GROUP_FOLLOW_STATUS sets: the followers get in when the leader does. */
 membersEnterLeadersVehicle=true;
 /** CPedGroupIntelligence's default task allocator (SET_GROUP_DEFAULT_TASK_ALLOCATOR): FOLLOW_ANY_MEANS (0),
  * FOLLOW_LIMITED (1), STAND_STILL (2), CHAT (3) or RANDOM (4). */
 defaultTaskAllocator:number=GROUP_ALLOCATOR.followAnyMeans;
 /** The group decision maker SET_GROUP_DECISION_MAKER gives it (SetGroupDecisionMakerType), -1 for none. */
 decisionMaker=-1;
 /** Whether the default task has the followers keep with their leader: the two follow allocators. */
 get followsLeader(){return this.defaultTaskAllocator===GROUP_ALLOCATOR.followAnyMeans||this.defaultTaskAllocator===GROUP_ALLOCATOR.followLimited;}
 /** CPedGroupMembership::Process (0x5FBA60): the dead leave (a player leading stays), a group with followers but no
  * leader appoints one, and every follower further from the leader than the separation range leaves unless it never
  * leaves its group. */
 process(peds:{alive(handle:number):boolean;isPlayer(handle:number):boolean;neverLeavesGroup(handle:number):boolean;
  position(handle:number):{x:number;y:number;z:number}|undefined}){
  for(let slot=0;slot<TOTAL_PED_GROUP_MEMBERS;slot++){
   const member=this.members[slot];
   if(member===undefined||peds.alive(member))continue;
   if(slot===LEADER_MEM_ID&&peds.isPlayer(member))continue;
   this.members[slot]=undefined;
  }
  this.appointNewLeader();
  const leader=this.leader,at=leader===undefined?undefined:peds.position(leader);
  if(!at)return;
  for(let slot=0;slot<LEADER_MEM_ID;slot++){
   const member=this.members[slot];
   if(member===undefined||peds.neverLeavesGroup(member))continue;
   const p=peds.position(member);
   if(p&&(at.x-p.x)**2+(at.y-p.y)**2+(at.z-p.z)**2>this.separationRange**2)this.members[slot]=undefined;
  }
 }
 /** CPedGroupMembership::AppointNewLeader: the first follower still in a slot takes the leader's. */
 appointNewLeader(){
  if(this.leader!==undefined)return;
  for(let slot=0;slot<LEADER_MEM_ID;slot++){
   const member=this.members[slot];
   if(member!==undefined){this.members[slot]=undefined;this.members[LEADER_MEM_ID]=member;return;}
  }
 }
}

/** MAKE_ROOM_IN_PLAYER_GANG_FOR_MISSION_PEDS (unreversed): how many of the removable followers must go for `room` more
 * to fit beside `kept` members that stay (the ones a mission made), in a group `limit` strong. */
export function followersToRemove(removable:number,kept:number,room:number,limit:number){
 return Math.max(0,Math.min(removable,removable+kept+room-limit));
}
