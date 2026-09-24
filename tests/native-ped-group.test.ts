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
 const dead=new Set([100]),peds={alive:(h:number)=>!dead.has(h),isPlayer:()=>false,neverLeavesGroup:()=>false,position:()=>({x:0,y:0,z:0})};
 group.process(peds);
 // The leader died, so the first follower still in a slot took its place.
 expect(group.leader).toBe(200);
 expect(group.isFollower(300)).toBe(true);expect(group.countMembers()).toBe(2);
 dead.add(200);dead.add(300);
 group.process(peds);
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

test('a dead player keeps leading, and followers beyond the separation range leave unless they never leave',()=>{
 const group=new NativePedGroup();group.setLeader(1);group.addFollower(2);group.addFollower(3);group.addFollower(4);
 const at:Record<number,{x:number;y:number;z:number}>={1:{x:0,y:0,z:0},2:{x:59,y:0,z:0},3:{x:61,y:0,z:0},4:{x:0,y:80,z:0}};
 group.process({alive:h=>h!==1,isPlayer:h=>h===1,neverLeavesGroup:h=>h===4,position:h=>at[h]});
 expect(group.leader).toBe(1);expect(group.all().sort()).toEqual([1,2,4]);
 group.separationRange=10;group.process({alive:()=>true,isPlayer:()=>false,neverLeavesGroup:()=>false,position:h=>at[h]});
 expect(group.all()).toEqual([1]);
});
