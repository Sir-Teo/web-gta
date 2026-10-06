/** CTaskComplexFollowLeaderInFormation::ms_offsets, native world axes (x east, y north), as the iOS executable's static
 * initialiser (0x1004366d4) fills the table at 0x1008e5100; PC's (0xC196E8) is runtime data the reversed sources do not
 * carry. CPedGroup::Teleport (iOS 0x100350088) puts follower i at the leader's point plus Offsets[i], in world axes and
 * at the leader's height, and CEntryExit::WarpGangWithPlayer takes them in turn. Before, a wedge a unit apart stood in. */
export const GROUP_TELEPORT_OFFSETS:readonly (readonly [number,number])[]=[[-1,1],[1,1],[0,1],[-1,0],[1,0],[-1,-1],[0,-1],[1,-1]];
/** ms_offsets.MovingOffsets, the walking formation behind the leader (scale 1). */
export const GROUP_MOVING_OFFSETS:readonly (readonly [number,number])[]=[[-1,0],[1,0],[0,-1.25],[-1.25,-1.25],[1.25,-1.25],[0,-2.5],[-1,-2.5],[1,-2.5]];
