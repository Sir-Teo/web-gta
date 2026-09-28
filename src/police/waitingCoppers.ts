/** CPopulation::CreateWaitingCoppers (0x612F90), which CEntryExit::GenerateAmbientPeds runs on an exit to the outside
 * world: for the wanted level, this many cops on foot around the door and this many empty cop cars on the nearest
 * road nodes. */
export const NUM_COPS_FOR_WANTED_LEVEL=[0,1,2,4,5,6,7] as const,NUM_CARS_FOR_WANTED_LEVEL=[0,0,0,1,1,2,2] as const;
export function waitingCoppers(wanted:number){
 const level=Math.max(0,Math.min(6,Math.trunc(wanted)));
 return {cops:NUM_COPS_FOR_WANTED_LEVEL[level],cars:NUM_CARS_FOR_WANTED_LEVEL[level]};
}
/** The i-th of the twenty tries for a cop's spot (native x/y): heading random(0, 0.4 i) − 0.2 i off the exit
 * heading, 8 to 10 units out from the door. The spot still needs a clear line of sight from the door, nothing
 * within a unit of it and ground under it. */
export function waitingCopSpot(createAt:{x:number;y:number},exitHeading:number,i:number,random:()=>number){
 const heading=random()*i*.4-i*.2+exitHeading,r=8+random()*2;
 return {x:createAt.x+Math.sin(heading)*r,y:createAt.y+Math.cos(heading)*r};
}
