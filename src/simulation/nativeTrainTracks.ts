/* The train tracks, data\paths\tracks*.dat, as CTrain::InitTrains loads them (gta-reversed Train.cpp, whose reader
 * ReadAndInterpretTrackFile is unreversed; CTrainNode, TrainNode.cpp, is reversed).
 * - InitTrains reads tracks.dat, tracks3.dat, tracks2.dat and tracks4.dat, in that order, into tracks 0 to 3.
 * - A file is a node count and then a line per node: x, y, z and a fourth number, which nothing here reads.
 * - CTrainNode keeps x, y and z as int16s of eighths of a unit, and the distance from the track's start as a uint16
 *   of thirds of a unit (SetDistanceFromStart truncates dist * 3 through an int16).
 * - A node's distance is the length of the track up to it. A track is a loop: the last node joins the first, and
 *   the total length includes that join. Vice City's ReadAndInterpretTrackFile, which SA's comes from, measures each
 *   join in 2D (Magnitude2D), and that is followed.
 * Coordinates are native (x east, y north, z up). */
export const TRAIN_TRACK_FILES=['tracks.dat','tracks3.dat','tracks2.dat','tracks4.dat'] as const;

export interface TrainNode {x:number;y:number;z:number;distance:number}
export interface TrainTrack {nodes:TrainNode[];totalLength:number}

/** A C float-to-int16 conversion: truncated toward zero, then wrapped into 16 bits. */
const int16=(v:number)=>(Math.trunc(v)<<16)>>16;

export function readTrainTrack(text:string):TrainTrack{
 const lines=text.split(/\r?\n/);
 const count=Number.parseInt(lines[0]??'',10);
 if(!(count>0))throw new Error('A train track needs a node count.');
 const raw:[number,number,number][]=[];
 for(let i=1;i<lines.length&&raw.length<count;i++){
  const [x,y,z]=lines[i].trim().split(/\s+/).map(Number);
  if([x,y,z].every(Number.isFinite))raw.push([x,y,z]);
 }
 if(raw.length!==count)throw new Error('A train track holds fewer nodes than it says.');
 const nodes:TrainNode[]=[];let t=0;
 for(let i=0;i<count;i++){
  const [x,y,z]=raw[i];
  nodes.push({x:int16(x*8)*.125,y:int16(y*8)*.125,z:int16(z*8)*.125,distance:(int16(t*3)&0xffff)/3});
  const [nx,ny]=raw[(i+1)%count];
  t+=Math.hypot(nx-x,ny-y);
 }
 return {nodes,totalLength:Math.fround(t)};
}

/** The six stations (iOS 0x1006541a0): Unity, Market, Cranberry, Yellow Bell, Linden Station and Sobell Rail Yards. */
export const TRAIN_STATIONS:readonly (readonly [number,number,number])[]=[[1741,-1954,15],[1297,-1898,3],[-1945,128,29],[1434,2632,13],[2783,1758,12],[2865,1281,12]];
/** CTrain::InitTrains' StationDist (iOS 0x1004712a4): each station's distance along the rails. The node nearest the
 * station is looked for over all four tracks, and its index read back from track 0's nodes. */
export function stationDistances(tracks:readonly TrainTrack[]){
 return TRAIN_STATIONS.map(([x,y,z])=>tracks[0]?.nodes[findClosestTrackNode(tracks,{x,y,z}).node]?.distance??0);
}
/** CTrain::FindClosestTrackNode (unreversed): the node nearest the point over every track. */
export function findClosestTrackNode(tracks:readonly TrainTrack[],point:{x:number;y:number;z:number}){
 let best={track:0,node:0},bestDistance=Infinity;
 tracks.forEach((track,t)=>track.nodes.forEach((node,n)=>{
  const d=(node.x-point.x)**2+(node.y-point.y)**2+(node.z-point.z)**2;
  if(d<bestDistance){bestDistance=d;best={track:t,node:n};}
 }));
 return best;
}

/** The carriages of each CREATE_MISSION_TRAIN type, engine first (the table at 0x8D44F8, as the Sanny Builder
 * documentation lists it): 537 FREIGHT, 569 FREIFLAT, 538 STREAK, 570 STREAKC, 449 TRAM. */
const FREIGHT=537,FREIFLAT=569,STREAK=538,STREAKC=570,TRAM=449;
export const TRAIN_TYPES:readonly (readonly number[])[]=[
 [FREIGHT,FREIFLAT,FREIFLAT,FREIFLAT,FREIFLAT],
 [STREAK,STREAKC,STREAKC],[STREAK,STREAKC,STREAKC],
 [FREIGHT,FREIFLAT,FREIFLAT,FREIFLAT],
 [STREAK,STREAKC,STREAKC],
 [STREAK,STREAKC,STREAKC,STREAKC],
 [FREIGHT,FREIFLAT,FREIFLAT],
 [STREAK,STREAKC,STREAKC],
 [TRAM,TRAM],[TRAM],
 [FREIGHT,FREIFLAT],
 [STREAK,STREAKC,STREAKC],
 [FREIGHT,FREIFLAT,FREIFLAT,FREIFLAT,FREIGHT],
 [FREIGHT,FREIFLAT,FREIFLAT,FREIFLAT,FREIFLAT,FREIFLAT],
 [TRAM],
 [STREAK],
];
