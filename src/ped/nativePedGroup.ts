/* CPedGroup: a leader and its followers, as the script's group commands hold them.
 *
 * CPedGroupMembership keeps eight member slots. The last of them, index seven, is the leader's, and a follower
 * takes the first free slot below it; a ped already in the group is not added again, and when the slots are
 * full the ped is simply not added. Members that die leave the group, and a group whose leader has gone
 * appoints the first follower it still has. Everything here is by the handle a script holds, because that is
 * what the commands name; whether a handle still names a living ped is the caller's to say. */
export const TOTAL_PED_GROUP_MEMBERS=8,LEADER_MEM_ID=7;
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
 /** CPedGroupMembership::Process: the dead leave, and a group with followers but no leader appoints one. */
 process(alive:(handle:number)=>boolean){
  for(let slot=0;slot<TOTAL_PED_GROUP_MEMBERS;slot++){
   const member=this.members[slot];
   if(member!==undefined&&!alive(member))this.members[slot]=undefined;
  }
  this.appointNewLeader();
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
