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
 const played:unknown[]=[];let reaction:string|undefined;
 const view={hasReaction:()=>true,installReactions:()=>{},playReaction:(name:string,...rest:unknown[])=>{played.push([name,...rest]);reaction=name;},
  clearReaction:()=>{reaction=undefined;},get reactionName(){return reaction;},reactionDuration:()=>.1};
 const tasks=new PlayerScriptTasks(world),b={...body(),view};
 tasks.give({kind:'playAnim',file:'PED',name:'IDLE_chat',loop:false,keepLastFrame:false,seconds:Infinity},b);
 tasks.step(1/30,b);expect(played).toEqual([['idle_chat',undefined,false,0,false]]);
 tasks.step(.05,b);expect(tasks.active).toBe(true);
 tasks.step(.06,b);expect(tasks.active).toBe(false);expect(reaction).toBeUndefined();
 tasks.give({kind:'playAnim',file:'PED',name:'IDLE_chat',loop:true,keepLastFrame:false,seconds:Infinity},b);
 tasks.step(1/30,b);expect(reaction).toBe('idle_chat');
 tasks.clear(b);expect(reaction).toBeUndefined();expect(tasks.active).toBe(false);
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
