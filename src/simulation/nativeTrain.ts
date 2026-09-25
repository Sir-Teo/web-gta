import {TRAIN_TYPES,findClosestTrackNode,type TrainTrack} from './nativeTrainTracks';
/* CTrain for the trains a script makes, pinned gta-reversed Train.cpp. ProcessControl (0x6F86A0), SetTrainSpeed,
 * SetTrainCruiseSpeed, FindNumCarriagesPulled and the mission-train removal and release are reversed and followed
 * for a train on its rails. CreateMissionTrain is not reversed; what is here is what ProcessControl needs of it:
 * - the train starts at the track node nearest the point (FindClosestTrackNode, over every track);
 * - its carriages follow the type's table, engine first;
 * - each carriage behind is set its own length along the rails from the one before, so the train runs engine
 *   first: behind it for a clockwise train (which runs up the track's distance) and ahead of the one before
 *   otherwise.
 * Not modelled: a mission train stopping at stations (FindMaximumSpeedToStopAtStations is unreversed, so a mission
 * train does not stop), the player driving a train and derailing (bNotOnARailRoad), the passengers, and
 * TrainHitStuff. SET_TRAIN_FORCED_TO_SLOW_DOWN is kept, but CGameLogic::CalcDistanceToForbiddenTrainCrossing, which
 * it reads, is not ported. Everything is native (x east, y north, z up); speeds are units per 50 fps step. */
type V3=[number,number,number];
/** A carriage model's dimensions as ProcessControl reads them: the collision bounding box's y extent and its lowest
 * z, and the handling's m_fSuspensionLowerLimit. */
export interface TrainCarriageModel {model:number;boxLength:number;boxMinZ:number;suspensionLowerLimit:number}

export class NativeTrainCarriage {
 trackId=0;nodeIndex=0;
 /** m_fCurrentRailDistance, m_fTrainSpeed (signed by direction), m_fLength, m_fTrainGas and m_fTrainBrake. */
 railDistance=0;speed=0;length=0;gas=0;brake=0;
 /** m_autoPilot.m_nCruiseSpeed. */
 cruiseSpeed=0;
 clockwise=true;isFront=false;isLast=false;missionTrain=true;stopsAtStations=false;stoppedAtStation=false;
 passengersCanEnterAndLeave=false;forceSlowDown=false;notOnARailRoad=false;
 timeWhenStoppedAtStation=0;
 prev?:NativeTrainCarriage;next?:NativeTrainCarriage;
 /** The matrix ProcessControl writes, and m_vecMoveSpeed. */
 position:V3=[0,0,0];forward:V3=[0,1,0];right:V3=[1,0,0];up:V3=[0,0,1];moveSpeed:V3=[0,0,0];
 constructor(readonly model:TrainCarriageModel){}
 /** FindNumCarriagesPulled. */
 carriagesPulled(){let n=0;for(let c=this.next;c;c=c.next)n++;return n;}
 /** ProcessControl for a carriage on its rails. `timeStep` is CTimer's step in fiftieths of a second, `nowMs` the
  * game clock. */
 processControl(tracks:readonly TrainTrack[],timeStep:number,nowMs:number){
  const track=tracks[this.trackId],nodes=track.nodes,count=nodes.length,total=track.totalLength;
  const old=[...this.position] as V3;
  if(!this.isFront){
   if(this.prev){this.speed=this.prev.speed;this.railDistance=this.prev.railDistance+this.length;}
   else{this.speed*=Math.pow(.99,timeStep);this.railDistance+=this.speed*timeStep;}
  }else{
   const pulled=this.carriagesPulled();
   if(!this.clockwise)this.speed=-this.speed;
   // Not the player's train (STATUS_TRAIN_MOVING): towards the cruise speed, held at a station for its time.
   const streak=this.model.model===538;
   let target=this.cruiseSpeed;
   const atStation=(nowMs-this.timeWhenStoppedAtStation)>>>0;
   if(atStation>=(streak?20000:10000)){
    if(atStation>=(streak?28000:18000)){
     if(atStation<(streak?32000:22000)){
      // The source's loop walks the carriages but clears the engine's own flag each time.
      if(this.stoppedAtStation)for(let c:NativeTrainCarriage|undefined=this;c;c=c.next)this.stoppedAtStation=false;
     }
    }else{
     target=0;
     if(this.stoppedAtStation)for(let c:NativeTrainCarriage|undefined=this;c;c=c.next)this.passengersCanEnterAndLeave=false;
    }
   }else{
    target=0;
    if(!this.stoppedAtStation)for(let c:NativeTrainCarriage|undefined=this;c;c=c.next){this.stoppedAtStation=true;this.passengersCanEnterAndLeave=true;}
   }
   const want=target/50-this.speed;
   if(want>0){this.gas=Math.min(want*30,1)*255;this.brake=0;}
   else{this.gas=0;this.brake=Math.min(want*-30,1)*255;}
   const divisor=pulled+3;
   this.speed+=this.gas/256*timeStep*.002/divisor;
   if(this.brake!==0){
    const b=this.brake/256*timeStep*.006/divisor;
    if(Math.abs(this.speed)>=b)this.speed+=this.speed<0?b:-b;else this.speed=0;
   }
   this.speed*=Math.pow(.999750018119812,timeStep);
   if(!this.clockwise)this.speed=-this.speed;
   this.railDistance+=timeStep*this.speed;
  }
  while(this.railDistance<0)this.railDistance+=total;
  while(this.railDistance>=total)this.railDistance-=total;
  const nodeDistance=(i:number)=>i<count?nodes[i].distance:total;
  // The node this carriage's rear is past.
  let next=this.nodeIndex+1<count?this.nodeIndex+1:0,nextDistance=this.nodeIndex+1<count?nodes[this.nodeIndex+1].distance:total;
  let current=nodes[this.nodeIndex].distance;
  for(let guard=0;(this.railDistance<current||nextDistance<this.railDistance)&&guard<count*2;guard++){
   const index=current<=this.railDistance?this.nodeIndex+1:this.nodeIndex-1;
   this.nodeIndex=((index%count)+count)%count;
   current=nodes[this.nodeIndex].distance;
   next=this.nodeIndex+1<count?this.nodeIndex+1:0;nextDistance=nodeDistance(this.nodeIndex+1);
  }
  const at=(from:number,to:number,distance:number,base:number):V3=>{
   let span=nodes[to].distance-base;if(span<0)span+=total;
   const u=(distance-base)/span,a=nodes[from],b=nodes[to];
   return [a.x*(1-u)+b.x*u,a.y*(1-u)+b.y*u,a.z*(1-u)+b.z*u];
  };
  const rear=at(this.nodeIndex,next,this.railDistance,current);
  // Its front, a bounding box's length on.
  let front=this.model.boxLength+this.railDistance;if(front>total)front-=total;
  let index=this.nodeIndex;
  next=index+1<count?index+1:0;nextDistance=nodeDistance(index+1);
  for(let guard=0;(front<current||front>nextDistance)&&guard<count*2;guard++){
   index=(index+1)%count;current=nodes[index].distance;
   next=index+1<count?index+1:0;nextDistance=nodeDistance(index+1);
  }
  const ahead=at(index,next,front,current);
  this.position=[(rear[0]+ahead[0])/2,(rear[1]+ahead[1])/2,(rear[2]+ahead[2])/2+this.model.suspensionLowerLimit-this.model.boxMinZ];
  let f:V3=[ahead[0]-rear[0],ahead[1]-rear[1],ahead[2]-rear[2]];
  const fl=Math.hypot(...f)||1;f=[f[0]/fl,f[1]/fl,f[2]/fl];
  if(!this.clockwise)f=[-f[0],-f[1],-f[2]];
  // right = forward x (0, 0, 1), up = right x forward.
  let r:V3=[f[1],-f[0],0];const rl=Math.hypot(...r)||1;r=[r[0]/rl,r[1]/rl,0];
  this.forward=f;this.right=r;this.up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  const s=1/timeStep,clamp=(v:number)=>Math.max(-2,Math.min(2,v));
  this.moveSpeed=[clamp((this.position[0]-old[0])*s),clamp((this.position[1]-old[1])*s),clamp((this.position[2]-old[2])*s)];
 }
}

/** SetTrainSpeed: speed / 50, negative for a train running the other way. */
export function setTrainSpeed(train:NativeTrainCarriage,speed:number){train.speed=speed/50;if(!train.clockwise)train.speed=-train.speed;}
/** SetTrainCruiseSpeed: m_autoPilot.SetCruiseSpeed((uint8)speed). */
export function setTrainCruiseSpeed(train:NativeTrainCarriage,speed:number){train.cruiseSpeed=Math.trunc(speed)&0xff;}
/** FindCarriage (unreversed): the nth carriage from the engine, 0 being the engine. */
export function findCarriage(train:NativeTrainCarriage,n:number){let c:NativeTrainCarriage|undefined=train;for(let i=0;i<n&&c;i++)c=c.next;return c;}
/** FindCaboose (unreversed): the last carriage. */
export function findCaboose(train:NativeTrainCarriage){let c=train;while(c.next)c=c.next;return c;}

/** CreateMissionTrain's layout: the type's carriages on the track node nearest `point`, linked engine first. */
export function createMissionTrain(tracks:readonly TrainTrack[],point:{x:number;y:number;z:number},clockwise:boolean,type:number,
 model:(id:number)=>TrainCarriageModel){
 const layout=TRAIN_TYPES[type];
 if(!layout)throw new Error(`No train type ${type}.`);
 const {track,node}=findClosestTrackNode(tracks,point);
 const carriages=layout.map(id=>new NativeTrainCarriage(model(id)));
 carriages.forEach((c,i)=>{
  c.trackId=track;c.nodeIndex=node;c.clockwise=clockwise;c.missionTrain=true;
  c.isFront=i===0;c.isLast=i===carriages.length-1;
  c.prev=carriages[i-1];c.next=carriages[i+1];
  c.length=i===0?0:clockwise?-c.model.boxLength:carriages[i-1].model.boxLength;
  c.railDistance=i===0?tracks[track].nodes[node].distance:carriages[i-1].railDistance+c.length;
 });
 return carriages;
}
