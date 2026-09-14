import type {NavigationNode,PathAddress} from './pathNodes';
const same=(a:PathAddress,b:PathAddress)=>a.area===b.area&&a.node===b.node;
/** Forward counterpart of DoPathSearch's sameLaneOnly test. That search expands
 * from the destination, making its linked node the forward predecessor. Preserve
 * the source's else branch even for anchors outside the connection endpoints. */
export function pathDirection(from:PathAddress,to:PathAddress,navigation:Pick<NavigationNode,'attachedTo'|'sameLanes'|'oppositeLanes'>){
 const attachedFrom=same(navigation.attachedTo,from),attachedTo=same(navigation.attachedTo,to);
 return {lanes:attachedFrom?navigation.oppositeLanes:navigation.sameLanes,
  reverseLanes:attachedTo?navigation.oppositeLanes:navigation.sameLanes,
  anchorMatchesEndpoint:attachedFrom||attachedTo};
}
