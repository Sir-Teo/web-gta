import {expect,test} from 'vitest';
import {PlayerScriptTasks,type PlayerTaskBody} from '../src/simulation/playerScriptTasks';

const world={animation:async()=>undefined,placeOnGround:()=>{}};
const body=(x=0,z=0,heading=0,speed=0):PlayerTaskBody=>({position:{x,y:0,z},heading,speed,onFoot:true});

test('the player walks straight at the point until inside the radius, and the task is then over',()=>{
 const tasks=new PlayerScriptTasks(world);
 tasks.give({kind:'goToPoint',x:3,y:-4,z:-100,moveState:4,radius:.5,moveStateRadius:2,seconds:Infinity},body());
 expect(tasks.active).toBe(true);
 // The script's (3, -4) is the renderer's (3, 4): the stick points along atan2(3, 4).
 const step=tasks.step(1/30,body());
 expect(step).toEqual({kind:'move',yaw:Math.atan2(3,4),walk:true,sprint:false});
 expect(tasks.step(1/30,body(3,3.7))).toEqual({kind:'hold'});
 expect(tasks.active).toBe(false);
});

test('a sprinting go-to runs inside ten units and walks inside the move-state radius',()=>{
 const tasks=new PlayerScriptTasks(world);
 tasks.give({kind:'goToPoint',x:0,y:-20,z:-100,moveState:7,radius:.5,moveStateRadius:2,seconds:Infinity},body());
 expect(tasks.step(1/30,body())).toMatchObject({walk:false,sprint:true});
 expect(tasks.step(1/30,body(0,15))).toMatchObject({walk:false,sprint:false});
 expect(tasks.step(1/30,body(0,19))).toMatchObject({walk:true,sprint:false});
});

test('the timed go-to puts the player on the point when its time runs out',()=>{
 const placed:unknown[]=[];
 const tasks=new PlayerScriptTasks({...world,placeOnGround:(x,z,y)=>{placed.push([x,z,y]);}});
 tasks.give({kind:'goToPoint',x:0,y:-50,z:12,moveState:4,radius:.5,moveStateRadius:2,seconds:.1},body());
 tasks.step(.05,body());expect(placed).toEqual([]);
 tasks.step(.06,body());expect(placed).toEqual([[0,50,12]]);
});

test('a heading is turned to at the player’s rate, and a sequence runs its tasks in order',()=>{
 const tasks=new PlayerScriptTasks(world);
 tasks.giveSequence([{kind:'standStill',seconds:.05},{kind:'achieveHeading',degrees:180}],false,body());
 expect(tasks.step(.03,body())).toEqual({kind:'hold'});
 expect(tasks.step(.03,body())).toEqual({kind:'hold'});
 // Script 180 degrees is the renderer's yaw of a whole turn, 0: nothing to turn.
 const turned=tasks.step(1/30,body(0,0,0));
 expect(turned?.kind).toBe('hold');expect(turned?.kind==='hold'?turned.facing:NaN).toBeCloseTo(0,9);
 expect(tasks.active).toBe(false);
});

test('a clip plays once and the task ends with it; clearing drops it',async()=>{
 // The clip's own clock, 0.1 long, which the character advances as it draws; a script can stop it.
 const played:unknown[]=[];let reaction:string|undefined,time=0,speed=1;
 const view={hasReaction:()=>true,installReactions:()=>{},playReaction:(name:string,...rest:unknown[])=>{played.push([name,...rest]);reaction=name;time=0;},
  clearReaction:()=>{reaction=undefined;},get reactionName(){return reaction;},reactionDuration:()=>.1,get reactionProgress(){return reaction?Math.min(1,time/.1):undefined;}};
 const tasks=new PlayerScriptTasks(world),b={...body(),view};
 const step=(dt:number)=>{time+=dt*speed;tasks.step(dt,b);};
 tasks.give({kind:'playAnim',file:'PED',name:'IDLE_chat',loop:false,keepLastFrame:false,seconds:Infinity},b);
 tasks.step(1/30,b);expect(played).toEqual([['idle_chat',undefined,false,0,false]]);
 step(.05);expect(tasks.active).toBe(true);
 // Stopped by SET_CHAR_ANIM_SPEED, the clip holds the task past its length.
 speed=0;step(.2);expect(tasks.active).toBe(true);
 speed=1;step(.06);expect(tasks.active).toBe(false);expect(reaction).toBeUndefined();
 tasks.give({kind:'playAnim',file:'PED',name:'IDLE_chat',loop:true,keepLastFrame:false,seconds:Infinity},b);
 tasks.step(1/30,b);expect(reaction).toBe('idle_chat');
 tasks.clear(b);expect(reaction).toBeUndefined();expect(tasks.active).toBe(false);
 // A looped clip goes when the script gives him his next task (CTaskSimpleAnim::MakeAbortable on the command event).
 tasks.give({kind:'playAnim',file:'PED',name:'IDLE_chat',loop:true,keepLastFrame:false,seconds:Infinity},b);
 tasks.step(1/30,b);expect(reaction).toBe('idle_chat');
 tasks.give({kind:'standStill',seconds:1},b);expect(reaction).toBeUndefined();expect(tasks.active).toBe(true);
});

test('the look-at trigger starts the head look and is over at once, letting a sequence go on',()=>{
 const looks:unknown[]=[];
 const tasks=new PlayerScriptTasks({...world,lookAt:(target,seconds)=>{looks.push([target,seconds]);}});
 tasks.give({kind:'lookAt',target:9,seconds:3},body());
 expect(looks).toEqual([[9,3]]);expect(tasks.active).toBe(false);
 tasks.giveSequence([{kind:'lookAt',target:9,seconds:1},{kind:'standStill',seconds:1}],false,body());
 expect(tasks.active).toBe(true);expect(tasks.step(.1,body())).toEqual({kind:'hold'});
});

test('TASK_ENTER_CAR_AS_DRIVER on the player walks him in through CarEntry, leaving the pad alone, until he is seated',()=>{
 let state:'none'|'entering'|'seated'='none';const asked:number[]=[];
 const tasks=new PlayerScriptTasks({...world,enterCar:vehicle=>{asked.push(vehicle);state='entering';return true;},carState:()=>state});
 tasks.give({kind:'enterCar',vehicle:9,seat:'driver',seconds:Infinity},body());
 expect(tasks.step(1/30,body())).toBeUndefined();expect(asked).toEqual([9]);
 expect(tasks.step(1/30,body())).toBeUndefined();expect(tasks.active).toBe(true);
 state='seated';tasks.step(1/30,body());expect(tasks.active).toBe(false);
});

test('the timed enter sets him in when its time runs out, and a car that cannot be entered ends the task',()=>{
 let state:'none'|'entering'|'seated'='none';const warped:number[]=[];
 const tasks=new PlayerScriptTasks({...world,enterCar:()=>{state='entering';return true;},warpIntoCar:v=>{warped.push(v);},carState:()=>state});
 tasks.give({kind:'enterCar',vehicle:9,seat:'driver',seconds:.1},body());
 tasks.step(.05,body());tasks.step(.05,body());tasks.step(.05,body());
 expect(warped).toEqual([9]);expect(tasks.active).toBe(false);
 const refused=new PlayerScriptTasks({...world,enterCar:()=>false,carState:()=>'none'});
 refused.give({kind:'enterCar',vehicle:9,seat:'driver',seconds:Infinity},body());refused.step(1/30,body());
 expect(refused.active).toBe(false);
 // Only the driver's seat is his to take.
 expect(PlayerScriptTasks.runs({kind:'enterCar',vehicle:9,seat:0,seconds:Infinity})).toBe(false);
});

test('TASK_LEAVE_ANY_CAR on the player waits for the car to be still, then he gets out',()=>{
 let state:'none'|'entering'|'seated'='seated',still=false;
 const tasks=new PlayerScriptTasks({...world,carState:()=>state,leaveCar:()=>state==='none'?'none':still?'started':'wait'});
 tasks.give({kind:'leaveCar',immediately:false},body());
 tasks.step(1/30,body());tasks.step(1/30,body());expect(tasks.active).toBe(true);
 still=true;tasks.step(1/30,body());expect(tasks.active).toBe(true);
 state='none';tasks.step(1/30,body());expect(tasks.active).toBe(false);
 // On foot there is nothing to leave.
 tasks.give({kind:'leaveCar',immediately:false},body());tasks.step(1/30,body());expect(tasks.active).toBe(false);
});

test('a driving task on the player hands his car to its autopilot until it is over, and a new task takes it back',()=>{
 let running=false;const log:string[]=[];
 const tasks=new PlayerScriptTasks({...world,startCarTask:order=>{log.push(`start ${order.kind}`);running=true;return true;},carTaskRunning:()=>running,endCarTask:()=>{log.push('end');}});
 tasks.give({kind:'carTempAction',vehicle:3,action:6,seconds:1},body());
 expect(tasks.step(1/30,body())).toBeUndefined();expect(log).toEqual(['start carTempAction']);
 tasks.step(1/30,body());expect(tasks.active).toBe(true);
 running=false;tasks.step(1/30,body());expect(tasks.active).toBe(false);expect(log).toEqual(['start carTempAction','end']);
 // Replaced mid-drive, the car is given back first.
 tasks.give({kind:'carDriveToCoord',vehicle:3,x:0,y:0,z:0,cruise:10,style:0,accurate:false,straight:false},body());tasks.step(1/30,body());
 tasks.give({kind:'standStill',seconds:1},body());
 expect(log).toEqual(['start carTempAction','end','start carDriveToCoord','end']);
 // Not in the named car: the task is over at once.
 const refused=new PlayerScriptTasks({...world,startCarTask:()=>false});
 refused.give({kind:'carTempAction',vehicle:3,action:6,seconds:1},body());refused.step(1/30,body());expect(refused.active).toBe(false);
});

test('TASK_LOOK_AT_COORD and TASK_DIE on the player start the look or the death and are over at once',()=>{
 const log:unknown[]=[];
 const tasks=new PlayerScriptTasks({...world,lookAtPoint:(x,y,z,s)=>{log.push(['look',x,y,z,s]);},die:()=>{log.push('die');}});
 tasks.giveSequence([{kind:'lookAtPoint',x:1,y:2,z:3,seconds:2},{kind:'die'}],false,body());
 expect(log).toEqual([['look',1,2,3,2],'die']);expect(tasks.active).toBe(false);
});

test('a sequence\'s TASK_USE_MOBILE_PHONE on the player takes the phone out and holds him on the call (LA1FIN2)',()=>{
 const calls:boolean[]=[];
 const tasks=new PlayerScriptTasks({...world,mobilePhone:start=>{calls.push(start);}});
 expect(PlayerScriptTasks.runs({kind:'mobilePhone'})).toBe(true);
 tasks.giveSequence([{kind:'standStill',seconds:.05},{kind:'mobilePhone'}],false,body());
 expect(calls).toEqual([]);
 tasks.step(.1,body());
 expect(calls).toEqual([true]);
 // The phone task has no end of its own: the sequence stays on it.
 for(let i=0;i<10;i++)tasks.step(1,body());
 expect(tasks.active).toBe(true);expect(tasks.progress).toBe(1);
});

test('TASK_USE_MOBILE_PHONE with 0 ends the player\'s call and his sequence goes on (LA1FIN2 lets him drive off)',()=>{
 const tasks=new PlayerScriptTasks(world);
 tasks.giveSequence([{kind:'mobilePhone'},{kind:'standStill',seconds:1}],false,body());
 tasks.step(5,body());expect(tasks.progress).toBe(0);
 // Stopping a phone he is not on changes nothing.
 tasks.stopPhone(body());expect(tasks.progress).toBe(1);
 tasks.stopPhone(body());expect(tasks.progress).toBe(1);
 tasks.step(1.1,body());expect(tasks.active).toBe(false);
 // The last task of all: stopped, nothing of the script's holds him.
 tasks.give({kind:'mobilePhone'},body());expect(tasks.active).toBe(true);
 tasks.stopPhone(body());expect(tasks.active).toBe(false);expect(tasks.step(.1,body())).toBeUndefined();
});

test('TASK_AIM_GUN_AT_CHAR on the player follows the ped, and is over when he is gone (CAT2)',()=>{
 const aims:unknown[]=[];let ped:{x:number;y:number;z:number}|undefined={x:0,y:1,z:5};
 const tasks=new PlayerScriptTasks({...world,aimAt:point=>{aims.push(point);},pedPoint:handle=>handle===7?ped:undefined});
 expect(PlayerScriptTasks.runs({kind:'gunAt',target:7,fire:false,seconds:1})).toBe(true);
 tasks.give({kind:'gunAt',target:7,fire:false,seconds:10},body());
 expect(aims).toEqual([{x:0,y:1,z:5}]);
 expect(tasks.step(.1,body())).toEqual({kind:'hold',facing:0});
 // He moves east: the aim and the facing follow him.
 ped={x:5,y:1,z:0};
 expect(tasks.step(.1,body())).toEqual({kind:'hold',facing:Math.PI/2});expect(aims.at(-1)).toEqual({x:5,y:1,z:0});
 ped=undefined;tasks.step(.1,body());
 expect(aims.at(-1)).toBeUndefined();expect(tasks.active).toBe(false);
 // One not there to start with gives no task.
 tasks.give({kind:'gunAt',target:8,fire:false,seconds:1},body());expect(tasks.active).toBe(false);
});

test('TASK_AIM_GUN_AT_COORD on the player holds his weapon on the point, facing it, for its time (CAT2)',()=>{
 const aims:unknown[]=[];
 const tasks=new PlayerScriptTasks({...world,aimAt:point=>{aims.push(point);}});
 expect(PlayerScriptTasks.runs({kind:'gunAt',point:{x:1,y:2,z:3},fire:false,seconds:1})).toBe(true);
 expect(PlayerScriptTasks.runs({kind:'gunAt',point:{x:1,y:2,z:3},fire:true,seconds:1})).toBe(false);
 // The script's (10, -10, 12) is the renderer's (10, 12, 10): north-east of a player at the origin.
 tasks.give({kind:'gunAt',point:{x:10,y:-10,z:12},fire:false,seconds:1},body());
 expect(aims).toEqual([{x:10,y:12,z:10}]);
 expect(tasks.step(.5,body())).toEqual({kind:'hold',facing:Math.atan2(10,10)});
 expect(tasks.step(.6,body())).toEqual({kind:'hold'});
 expect(aims).toEqual([{x:10,y:12,z:10},undefined]);expect(tasks.active).toBe(false);
 // Cleared early, the aim goes down too.
 tasks.give({kind:'gunAt',point:{x:1,y:0,z:1},fire:false,seconds:10},body());tasks.clear(body());
 expect(aims.at(-1)).toBeUndefined();
});

test('TASK_FOLLOW_PATH_NODES_TO_COORD on the player walks the planned nodes, planning on when they run out (CAT3)',()=>{
 const plans:unknown[]=[];
 // Two plans: two nodes north, then the target to the east of the last.
 const tasks=new PlayerScriptTasks({...world,groundUnder:()=>0,planNodeRoute:(feet,target,options)=>{
  plans.push({feet:{...feet},target:{...target},resume:options.currentNode});
  return plans.length===1?{points:[{x:0,y:1,z:-10},{x:0,y:1,z:-20}],nodes:['a','b'],lastIsTarget:false,resumeAt:0}
   :{points:[{x:15,y:1,z:-20}],nodes:['c'],lastIsTarget:true,resumeAt:0};}});
 expect(PlayerScriptTasks.runs({kind:'followNodeRoute',x:15,y:20,z:0,moveState:4,seconds:Number.POSITIVE_INFINITY})).toBe(true);
 tasks.give({kind:'followNodeRoute',x:15,y:20,z:0,moveState:4,seconds:Number.POSITIVE_INFINITY},body());
 // The target a unit over the ground under it, in the renderer's terms.
 expect(plans[0]).toEqual({feet:{x:0,y:0,z:0},target:{x:15,y:1,z:-20},resume:undefined});
 // North at a walk to the first node.
 expect(tasks.step(.1,body())).toEqual({kind:'move',yaw:Math.atan2(0,-10),walk:true,sprint:false});
 // At it, on to the second.
 expect(tasks.step(.1,body(0,-9.8))).toEqual({kind:'move',yaw:Math.atan2(0,-10.2),walk:true,sprint:false});
 // At the second the plan has run out: planned again from its last node, east to the target.
 const east=tasks.step(.1,body(0,-19.9));
 expect(plans[1]).toMatchObject({resume:'b'});
 expect(east).toEqual({kind:'move',yaw:Math.atan2(15,-.1),walk:true,sprint:false});
 // At the target the task is over.
 expect(tasks.step(.1,body(14.8,-20))).toEqual({kind:'hold'});expect(tasks.active).toBe(false);
});

test('a timed node route puts the player on the target when its time runs out',()=>{
 const placed:unknown[]=[];
 const tasks=new PlayerScriptTasks({...world,placeOnGround:(x,z,y)=>{placed.push({x,z,y});},groundUnder:()=>2,
  planNodeRoute:()=>({points:[{x:0,y:3,z:-50}],nodes:['a'],lastIsTarget:true,resumeAt:0})});
 tasks.give({kind:'followNodeRoute',x:0,y:50,z:0,moveState:6,seconds:1},body());
 expect(tasks.step(.5,body())).toMatchObject({kind:'move',walk:false,sprint:false});
 tasks.step(.6,body());
 expect(placed).toEqual([{x:0,z:-50,y:3}]);expect(tasks.active).toBe(false);
});
