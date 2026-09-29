/** Where a group teleport puts each follower from the leader's point, native world axes (x east, y north):
 * CTaskComplexFollowLeaderInFormation's ms_offsets are static data the reversed sources do not carry, so these stand in
 * for them, a unit apart in a wedge behind and to the sides. CPedGroup::Teleport and CEntryExit::WarpGangWithPlayer
 * both read them. */
export const GROUP_TELEPORT_OFFSETS:readonly (readonly [number,number])[]=[[-1,-1],[1,-1],[-2,-2],[2,-2],[0,-2],[-3,-3],[3,-3]];
