import {decodeScmInstruction,type ScmInstruction,type ScmParameter} from '../assets/scm';
import {requireAsset} from '../assets/binary';
import {ScmStrings} from './ScmStrings';
import {NATIVE_NOP_OPCODES} from './ScmNativeNops';
import {RANDOM_SAMPLE_MAX,randomFloatInRange,randomIntInRange} from './nativeRandomRange';
import {SCM_GAME_COMMANDS} from './ScmGameCommands';
import type {ScmGameState} from './ScmGameState';

export class UnsupportedScmCommand extends Error {
 constructor(readonly offset:number,readonly opcode:number,readonly command:string,detail=''){
  super(`Unsupported SCM command ${command} (0x${opcode.toString(16)}) at ${offset}${detail?`: ${detail}`:''}`);
 }
}
type NumericKind='int'|'float';
/** Game-world effects a script can request. Every member beyond fade is
 * optional: a missing adapter stops the script explicitly at that command. */
export interface ScmWorldCommands {
 fade(milliseconds:number,direction:number,nowMs:number):void;
 /** CPlayerInfo::IsRestartingAfterDeath() || IsRestartingAfterArrest(). */
 isPlayerRestarting?():boolean;
 /** CPlayerInfo::m_nPlayerState == PLAYERSTATE_PLAYING / HAS_DIED. */
 isPlayerPlaying?(playerId:number):boolean;
 isPlayerDead?(playerId:number):boolean;
 /** CTheScripts::DoDeathArrestCheck clears small HUD messages before resetting. */
 clearSmallMessages?():void;
 requestCollision?(x:number,y:number):void;
 /** CTimer::Stop; CStreaming::LoadScene; CTimer::Update. */
 loadScene?(x:number,y:number,z:number):void;
 /** CreatePlayer (PlayerCommands.cpp): the script receives the player index. */
 createPlayer?(playerId:number,x:number,y:number,z:number):void;
 getPlayerChar?(playerId:number):number;
 getPlayerGroup?(playerId:number):number;
 setCameraBehindPlayer?():void;
 /** SetCharHeading: ignored inside vehicles; degrees are fixed to 0..360. */
 setCharHeading?(ped:number,degrees:number):void;
 setRelationship?(relationship:number,pedType:number,otherPedType:number):void;
 setLaRiots?(enabled:boolean):void;
 /** CPlayerInfo::MakePlayerSafe(!state, 10.0). */
 setPlayerControl?(playerId:number,enabled:boolean):void;
 /** CCamera::GetFading (0x50ADE0). */
 isFading?():boolean;
 /** FrontEndMenuManager.m_bDrawingMap for CRadar::ChangeBlipScale. */
 isDrawingMap?():boolean;
 /** TheText.Get for the subtitle-only "~z~" prefix test when subtitles are off. */
 resolveText?(key:string):string|undefined;
 /** TheText.LoadMissionText. */
 loadMissionText?(name:string):void;
 /** Garage message, replay playback or running cutscene: SetHelpMessage bails. */
 helpMessageBlocked?():boolean;
 /** CHud big-message buffer blanking from ClearThisPrintBigNow. */
 clearBigMessage?(style:number):void;
 /** CWorld::PutToGroundIfTooLow for CREATE_OBJECT: the ground under a point, or undefined where the world has
  * nothing there, which leaves the point alone as the native call does. */
 groundLevel?(x:number,y:number,z:number):number|undefined;
 /** CEntity::GetDistanceFromCentreOfMassToBaseOfModel (0x536BE0): how far CREATE_OBJECT lifts the object. */
 modelBaseOffset?(model:number|string):number;
 /** What CCamera::Restore asks of the player: FindPlayerVehicle, and whether the ped state is one of
  * ENTER_CAR, CARJACK or OPEN_DOOR (the car camera) or EXIT_CAR (the on-foot camera). */
 playerCameraState?():{inVehicle:boolean;enteringCar:boolean;exitingCar:boolean};
 /** CWorld::FindGroundZForCoord, which POINT_CAMERA_AT_POINT uses for a target below minus a hundred. */
 groundZForCoord?(x:number,y:number):number;
 /** CPopCycle::m_nCurrentZoneType for GET_CURRENT_POPULATION_ZONE_TYPE. */
 currentPopulationZoneType?():number;
 /** CStreaming requests. A negative script model id names a UsedObjectArray entry. */
 requestModel?(model:number|string):void;
 hasModelLoaded?(model:number|string):boolean;
 markModelNotNeeded?(model:number|string):void;
 loadAllModelsNow?():void;
}
export interface ScmThreadHost {
 startScript(entry:number,argumentBits:readonly number[]):void;
 world?:ScmWorldCommands;nextRandom?:()=>number;game?:ScmGameState;
 loadMission?(missionId:number):void;launchMission?(label:number):void;
 terminateAllWithName?(name:string):void;
 /** Header object names for negative script model operands. */
 objectNames?:readonly string[];
}

/** CRunningScript execution core, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 * Caller owns mutable ScriptSpace and scheduling. Ordinary threads have 32
 * locals plus two timers; mission threads receive the shared mission-local
 * storage instead. Native commands outside the ported families fail
 * explicitly. This is not a campaign-complete VM. */
export class ScmThread {
 ip:number;name='noname';condition=false;logical=0;wakeTime=0;terminated=false;
 /** CRunningScript::Init defaults for the streamed-script fields: an ordinary thread is not external and has no
  * external type, which is what decides whether its objects are OBJECT_MISSION or OBJECT_MISSION2. */
 isExternal=false;externalType=-1;
 /** CRunningScript::Init defaults for the mission-lifecycle flags. */
 usesMissionCleanup=false;thisMustBeTheOnlyMissionRunning=false;deathArrestEnabled=true;doneDeathArrest=false;isTextBlockOverride=false;
 readonly stack:number[]=[];
 readonly locals:DataView;
 private readonly globals:DataView;
 private readonly strings:ScmStrings;
 constructor(readonly scriptSpace:Uint8Array,entry:number,readonly base=0,locals=new DataView(new ArrayBuffer(34*4)),readonly host?:ScmThreadHost){
  this.globals=new DataView(scriptSpace.buffer,scriptSpace.byteOffset,scriptSpace.byteLength);
  this.locals=locals;this.strings=new ScmStrings(this.globals,locals);this.ip=this.address(entry);
 }
 private address(offset:number){
  requireAsset(Number.isInteger(offset)&&offset>=0&&offset<this.scriptSpace.length,'SCM instruction address out of bounds.');return offset;
 }
 private target(label:number){return this.address(label>=0?label:this.base-label);}
 private variable(p:ScmParameter){
  if(p.type===7||p.type===8){
   requireAsset(Array.isArray(p.value)&&p.value.length===6,'Invalid SCM array reference.');
   const bytes=p.value as number[],base=bytes[0]|bytes[1]<<8,indexVariable=bytes[2]|bytes[3]<<8;
   const index=this.read({type:bytes[5]&0x80?2:3,value:indexVariable},'int');
   // Native ReadArrayInformation ignores the encoded count/type. Bounds are
   // checked against actual storage, not that advisory array length.
   const view=p.type===7?this.globals:this.locals,offset=(p.type===7?base:base*4)+index*4;
   requireAsset(Number.isInteger(offset)&&offset>=0&&offset+4<=view.byteLength,'SCM array address out of bounds.');
   return {view,offset};
  }
  requireAsset((p.type===2||p.type===3)&&typeof p.value==='number','Unsupported SCM variable reference.');
  const view=p.type===2?this.globals:this.locals,offset=p.type===2?p.value:p.value*4;
  requireAsset(Number.isInteger(offset)&&offset>=0&&offset+4<=view.byteLength,'SCM variable out of bounds.');
  return {view,offset};
 }
 private read(p:ScmParameter,kind:NumericKind):number{
  requireAsset(p,'Missing SCM operand.');
  if(p.type===2||p.type===3||p.type===7||p.type===8){const {view,offset}=this.variable(p);return kind==='int'?view.getInt32(offset,true):view.getFloat32(offset,true);}
  requireAsset([1,4,5,6].includes(p.type)&&typeof p.value==='number','Unsupported SCM numeric operand.');
  // Script parameters are an untagged 32-bit union after collection.
  const bits=new DataView(new ArrayBuffer(4));
  if(p.type===6)bits.setFloat32(0,p.value,true);else bits.setInt32(0,p.value,true);
  return kind==='int'?bits.getInt32(0,true):bits.getFloat32(0,true);
 }
 private write(p:ScmParameter,value:number,kind:NumericKind){
  requireAsset(p,'Missing SCM operand.');const {view,offset}=this.variable(p);
  if(kind==='int')view.setInt32(offset,value,true);else view.setFloat32(offset,value,true);
 }
 readInt(p:ScmParameter){return this.read(p,'int');}
 readFloat(p:ScmParameter){return this.read(p,'float');}
 writeInt(p:ScmParameter,value:number){this.write(p,value,'int');}
 writeFloat(p:ScmParameter,value:number){this.write(p,value,'float');}
 text(p:ScmParameter){requireAsset(p,'Missing SCM operand.');return this.strings.text(p);}
 /** Byte offset of a global variable operand, as native handlers read it. */
 globalOffset(p:ScmParameter){
  requireAsset(p.type===2&&typeof p.value==='number','Expected an SCM global variable operand.');this.variable(p);return p.value as number;
 }
 /** CRunningScript::UpdateCompareFlag (0x4859D0) with the opcode NOT bit. */
 updateCompareFlag(value:boolean,negated:boolean){this.compare(value,negated);}
 private compare(value:boolean,negated:boolean){
  if(negated)value=!value;
  if(this.logical===0)this.condition=value;
  else if(this.logical>=1&&this.logical<=8){this.condition=this.condition&&value;this.logical=this.logical===1?0:this.logical-1;}
  else if(this.logical>=21&&this.logical<=28){this.condition=this.condition||value;this.logical=this.logical===21?0:this.logical-1;}
 }
 /** CRunningScript::ResetIP: unwind to the outermost GOSUB return address.
  * The pinned transcription post-decrements past the top entry and is marked
  * as an original bug there; the outermost return address is the documented
  * mission-wrapper behaviour this port follows. */
 resetIp(){
  requireAsset(this.stack.length>0,'ResetIP with an empty GOSUB stack is undefined in the source.');
  this.ip=this.stack[0];this.stack.length=0;
 }
 /** Run until WAIT/termination. The watchdog throws instead of silently
  * yielding a runaway script and changing original cooperative scheduling. */
 run(nowMs:number,budget=10000,timeStep?:number):'waiting'|'terminated'{
  requireAsset(Number.isInteger(nowMs)&&nowMs>=0&&nowMs<=0xffffffff,'Invalid SCM clock.');
  requireAsset(Number.isInteger(budget)&&budget>0,'Invalid SCM instruction budget.');
  requireAsset(timeStep===undefined||Number.isFinite(timeStep)&&timeStep>=0,'Invalid SCM timestep.');
  if(this.terminated)return 'terminated';
  if(nowMs<this.wakeTime)return 'waiting';
  for(let count=0;count<budget;count++){
   const i=decodeScmInstruction(this.scriptSpace,this.ip),op=i.opcode&0x7fff,p=i.parameters;
   let next=i.end;
   if(op===0){/* NOP */}
   else if(op===1){this.wakeTime=(nowMs+(this.read(p[0],'int')>>>0))>>>0;this.ip=next;return 'waiting';}
   else if(op===2)next=this.target(this.read(p[0],'int'));
   else if(op>=4&&op<=23||op>=88&&op<=119){
    const kind:NumericKind=op%2===0?'int':'float',rhs=this.read(p[1],kind);
    if(op<=7)this.write(p[0],rhs,kind);
    else{
     const lhs=this.read(p[0],kind);let result:number;
     if(op<=11||op>=88&&op<=95)result=lhs+rhs;
     else if(op<=15||op>=96&&op<=103)result=lhs-rhs;
     else if(op<=19||op>=104&&op<=111)result=kind==='int'?Math.imul(lhs,rhs):lhs*rhs;
     else{
      if(kind==='int')requireAsset(rhs!==0&&!(lhs===-2147483648&&rhs===-1),'Invalid SCM integer division.');
      result=kind==='int'?Math.trunc(lhs/rhs):lhs/rhs;
     }
     this.write(p[0],result,kind);
    }
   }else if(op>=120&&op<=131){
    requireAsset(timeStep!==undefined,'Timed SCM arithmetic requires the native timestep.');
    const lhs=this.read(p[0],'float'),delta=Math.fround(Math.fround(timeStep)*this.read(p[1],'float'));
    this.write(p[0],op<=125?lhs+delta:lhs-delta,'float');
   }else if(op>=132&&op<=139||op===1198||op===1199){
    const kind:NumericKind=op>=134&&op<=137?'float':'int';this.write(p[0],this.read(p[1],kind),kind);
   }else if(op>=140&&op<=147){
    const kind:NumericKind=op%2===0?'int':'float',value=this.read(p[1],kind==='int'?'float':'int');
    if(kind==='int')requireAsset(Number.isFinite(value)&&Math.trunc(value)>=-2147483648&&Math.trunc(value)<=2147483647,'SCM float-to-int conversion out of range.');
    this.write(p[0],kind==='int'?Math.trunc(value):value,kind);
   }else if(op>=148&&op<=151){
    const kind:NumericKind=op<=149?'int':'float';this.write(p[0],Math.abs(this.read(p[0],kind)),kind);
   }else if(op===197||op===198){
    this.compare(op===197,!!(i.opcode&0x8000));
   }else if(op===1449||op===1450||op===1745||op===1746){
    this.strings.assign(p[0],p[1],op<=1450?8:16);
   }else if(op>=2116&&op<=2119){
    this.compare(this.strings.text(p[0]).length===0,!!(i.opcode&0x8000));
   }else if(op===1453||op===1454||op===2297||op===2298){
    this.compare(this.strings.text(p[0])===this.strings.text(p[1]),!!(i.opcode&0x8000));
   }else if(op===153||op===520||op===521){
    if(!this.host?.nextRandom)throw new UnsupportedScmCommand(i.offset,op,i.name);
    const destination=p[op===153?0:2];this.variable(destination);
    const kind:NumericKind=op===520?'float':'int';
    const sample=this.host.nextRandom();
    // GENERATE_RANDOM_INT stores the raw sample; the range commands share
    // the CGeneral interpolation with the rest of the engine.
    const value=op===153?sample
     :kind==='int'?randomIntInRange(sample,this.read(p[0],'int'),this.read(p[1],'int'))
     :randomFloatInRange(sample,this.read(p[0],'float'),this.read(p[1],'float'));
    if(op===153)requireAsset(Number.isInteger(sample)&&sample>=0&&sample<=RANDOM_SAMPLE_MAX,'Invalid native random sample.');
    this.write(destination,value,kind);
   }else if(op>=24&&op<=60||op>=66&&op<=70){
    const kind:NumericKind=op<40?(op<32?'int':'float'):op<56?(op<48?'int':'float'):op<66?'int':'float';
    const a=this.read(p[0],kind),b=this.read(p[1],kind);
    this.compare(op<40?a>b:op<56?a>=b:a===b,!!(i.opcode&0x8000));
   }else if(op===0x4a3||op===0x4a4||op>=0x4b0&&op<=0x4b7){
    // Constant-operand integer compares. 04B0-04B7 follow the IsGreater /
    // IsGreaterEqual handlers; the 04A3/04A4 equality dispatch is unreversed.
    const a=this.read(p[0],'int'),b=this.read(p[1],'int');
    this.compare(op<0x4b0?a===b:op<0x4b4?a>b:a>=b,!!(i.opcode&0x8000));
   }else if(op===0x871||op===0x872){
    // SWITCH_START / SWITCH_CONTINUED: dispatch unreversed; the jump-table
    // helpers and statics are reversed. START carries the value, case count,
    // default flag and address plus seven (value, label) pairs; CONTINUED
    // carries nine more pairs. The jump happens once every case is read.
    const state=this.host?.game;if(!state)throw new UnsupportedScmCommand(i.offset,op,i.name,'no game state');
    let at=0;
    if(op===0x871){state.switchValue=this.read(p[0],'int');state.switchEntriesToRead=this.read(p[1],'int');state.switchDefaultExists=this.read(p[2],'int')!==0;state.switchDefaultAddress=this.read(p[3],'int');at=4;}
    for(let k=0,pairs=op===0x871?7:9;k<pairs&&state.switchEntriesToRead>0;k++,at+=2){state.addSwitchCase(this.read(p[at],'int'),this.read(p[at+1],'int'));state.switchEntriesToRead--;}
    if(state.switchEntriesToRead===0)next=this.target(state.useSwitchJumpTable());
   }else if(op===0x4d){if(!this.condition)next=this.target(this.read(p[0],'int'));}
   else if(op===0x4e){this.terminated=true;this.ip=next;return 'terminated';}
   else if(op===0x4f){
    if(!this.host)throw new UnsupportedScmCommand(i.offset,op,i.name);
    const entry=this.read(p[0],'int');this.address(entry);
    requireAsset(p.length-1<=34,'SCM new-thread arguments exceed local storage.');
    // Raw union bits, including floats and referenced variables, are copied.
    const args=p.slice(1).map(parameter=>this.read(parameter,'int'));
    this.host.startScript(entry,args);
   }
   else if(op===0x50){
    next=this.target(this.read(p[0],'int'));requireAsset(this.stack.length<8,'SCM subroutine stack overflow.');this.stack.push(i.end);
   }else if(op===0x51){requireAsset(this.stack.length>0,'SCM subroutine stack underflow.');next=this.stack.pop()!;}
   else if(op===0xd6){
    const logical=this.read(p[0],'int');requireAsset(logical===0||logical>=1&&logical<=8||logical>=21&&logical<=28,'Invalid SCM logical operator.');
    this.logical=logical===0?0:logical+1;this.condition=logical>=1&&logical<=8;
   }else if(i.name==='SCRIPT_NAME'){
    requireAsset(p[0].type===9&&typeof p[0].value==='string','Unsupported SCM script name.');this.name=p[0].value;
   }else if(op===0x16a){
    if(!this.host?.world)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.world.fade(this.read(p[0],'int')>>>0,this.read(p[1],'int')&0xffff,nowMs);
   }else if(op===0xd7){
    // LAUNCH_MISSION: CTheScripts::StartNewScript(&ScriptSpace[label]).
    if(!this.host?.launchMission)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.launchMission(this.address(this.read(p[0],'int')));
   }else if(op===0x417){
    if(!this.host?.loadMission)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.loadMission(this.read(p[0],'int'));
   }else if(op===0x459){
    if(!this.host?.terminateAllWithName)throw new UnsupportedScmCommand(i.offset,op,i.name);
    this.host.terminateAllWithName(this.strings.text(p[0]));
   }else if(NATIVE_NOP_OPCODES.has(op)){/* PC 1.0 parses operands and does nothing. */}
   else{
    const handler=SCM_GAME_COMMANDS.get(op);
    if(!handler)throw new UnsupportedScmCommand(i.offset,op,i.name);
    handler(this,p,i,nowMs);
   }
   this.ip=next;
  }
  throw new Error(`SCM instruction watchdog at ${this.ip}`);
 }
}
