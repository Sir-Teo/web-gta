import {expect,test} from 'vitest';
import {LEADER_MEM_ID,NativePedGroup,TOTAL_PED_GROUP_MEMBERS} from '../src/ped/nativePedGroup';

test('a group holds eight, of which the last slot is the leader’s',()=>{
 const group=new NativePedGroup();
 group.setLeader(100);
 expect(group.leader).toBe(100);expect(group.isLeader(100)).toBe(true);
 expect(group.countMembers()).toBe(1);expect(group.countFollowers()).toBe(0);
 // Seven followers fit beside the leader; the eighth has no slot and is not added.
 for(let i=0;i<LEADER_MEM_ID;i++)expect(group.addFollower(200+i)).toBe(true);
 expect(group.countMembers()).toBe(TOTAL_PED_GROUP_MEMBERS);
 expect(group.countFollowers()).toBe(LEADER_MEM_ID);
 expect(group.addFollower(999)).toBe(false);
 expect(group.isMember(999)).toBe(false);
});

test('a ped already in the group is not added twice, as a follower or as the leader',()=>{
 const group=new NativePedGroup();
 group.setLeader(100);group.addFollower(200);
 expect(group.addFollower(200)).toBe(false);
 expect(group.addFollower(100)).toBe(false);
 expect(group.countMembers()).toBe(2);
 // Making a follower the leader moves it rather than leaving it in both slots.
 group.setLeader(200);
 expect(group.leader).toBe(200);expect(group.isFollower(200)).toBe(false);
 expect(group.countMembers()).toBe(1);
});

test('the dead leave the group, and a group with followers left appoints one of them',()=>{
 const group=new NativePedGroup();
 group.setLeader(100);group.addFollower(200);group.addFollower(300);
 const dead=new Set([100]);
 group.process(handle=>!dead.has(handle));
 // The leader died, so the first follower still in a slot took its place.
 expect(group.leader).toBe(200);
 expect(group.isFollower(300)).toBe(true);expect(group.countMembers()).toBe(2);
 dead.add(200);dead.add(300);
 group.process(handle=>!dead.has(handle));
 expect(group.countMembers()).toBe(0);expect(group.leader).toBeUndefined();
});

test('removing takes a ped out wherever it sat, and a flush empties the group',()=>{
 const group=new NativePedGroup();
 group.setLeader(100);group.addFollower(200);group.addFollower(300);
 expect(group.removeMember(200)).toBe(true);
 expect(group.isMember(200)).toBe(false);expect(group.countMembers()).toBe(2);
 expect(group.removeMember(200)).toBe(false);
 // A freed slot is used again before the ones above it.
 group.addFollower(400);
 expect(group.all()).toEqual([400,300,100]);
 group.flush();
 expect(group.countMembers()).toBe(0);expect(group.leader).toBeUndefined();
});
