import type {NavigationNode} from './pathNodes';
/** CCarPathLink::OneWayLaneOffset. Output is a lane-index adjustment, not a
 * world-space displacement or complete lane center. Keep signed decoded width. */
export function pathLaneOffset(navigation:Pick<NavigationNode,'oppositeLanes'|'sameLanes'|'width'>):number {
 if(navigation.oppositeLanes)return .5-navigation.sameLanes/2;
 if(navigation.sameLanes)return .5-navigation.width/5.4/2;
 return .5-navigation.oppositeLanes/2;
}
