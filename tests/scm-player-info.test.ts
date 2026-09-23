import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {CRANE_LAS_VEGAS,CRANE_MAGNO,CRANE_NONE,CRANE_QUARRY,CRANE_WRECKING_BALL} from '../src/engine/ScmPlayerInfo';
import {CLOTHES_TEXTURE} from '../src/engine/ScmClothes';
import {nativeUppercaseKey} from '../src/engine/nativeKeyGen';
import {scmOpcode} from '../src/engine/scmOpcodes';

function bytes(opcode:number,operands:readonly (readonly [number,number]|string)[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const operand of operands){
  if(typeof operand==='string'){out.push(14,operand.length,...[...operand].map(c=>c.charCodeAt(0)));continue;}
  const [type,value]=operand;
  const buffer=new Uint8Array(4),view=new DataView(buffer.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...buffer);}
  else if(type===4)out.push(4,value&0xff);
  else if(type===6){view.setFloat32(0,value,true);out.push(6,...buffer);}
  else {view.setUint16(0,value,true);out.push(type,buffer[0],buffer[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
const gvar=(offset:number)=>[2,offset] as const;
const CODE=512;
function run(game:ScmGameState,world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,global:(offset:number)=>new DataView(space.buffer).getInt32(offset,true)};
}
const one=(name:string,operands:readonly (readonly [number,number]|string)[]=[],world:Partial<ScmWorldCommands>={})=>{
 const game=new ScmGameState();
 const {thread,global}=run(game,world,bytes(scmOpcode(name),operands));
 return {game,thread,global};
};

describe('the player fields a script switches',()=>{
 test('each switch lands on its own field, and the defaults are the ones a clear leaves',()=>{
  const fresh=new ScmGameState().playerInfo;
  expect(fresh).toMatchObject({doesNotGetTired:false,fastReload:false,fireProof:false,canDoDriveBy:true,
   maxHealth:100,maxArmour:100,sprintDisabled:false,groupStuffDisabled:false,drunkenness:0});
  expect(one('SET_PLAYER_NEVER_GETS_TIRED',[int(0),int(1)]).game.playerInfo.doesNotGetTired).toBe(true);
  expect(one('SET_PLAYER_FAST_RELOAD',[int(0),int(1)]).game.playerInfo.fastReload).toBe(true);
  expect(one('MAKE_PLAYER_FIRE_PROOF',[int(0),int(1)]).game.playerInfo.fireProof).toBe(true);
  expect(one('SET_PLAYER_CAN_DO_DRIVE_BY',[int(0),int(0)]).game.playerInfo.canDoDriveBy).toBe(false);
  expect(one('DISABLE_PLAYER_SPRINT',[int(0),int(1)]).game.playerInfo.sprintDisabled).toBe(true);
 });

 test('recruitment is stored as the group switch read the other way round',()=>{
  expect(one('SET_PLAYER_GROUP_RECRUITMENT',[int(0),int(1)]).game.playerInfo.groupStuffDisabled).toBe(false);
  expect(one('SET_PLAYER_GROUP_RECRUITMENT',[int(0),int(0)]).game.playerInfo.groupStuffDisabled).toBe(true);
 });

 test('drunkenness takes a byte and starts its fade again',()=>{
  const game=new ScmGameState();
  game.playerInfo.fadeDrunkenness=40;
  run(game,{},bytes(scmOpcode('SET_PLAYER_DRUNKENNESS'),[int(0),int(120)]));
  expect(game.playerInfo).toMatchObject({drunkenness:120,fadeDrunkenness:0});
  run(game,{},bytes(scmOpcode('SET_PLAYER_DRUNKENNESS'),[int(0),int(0)]));
  expect(game.playerInfo.drunkenness).toBe(0);
 });

 test('the maxima go up by the amount and fill the ped to the new one',()=>{
  const game=new ScmGameState();
  const health:number[]=[],armour:number[]=[];
  run(game,{setPlayerMaxHealth:(_p,value)=>{health.push(value);},setPlayerMaxArmour:(_p,value)=>{armour.push(value);}},
   bytes(scmOpcode('INCREASE_PLAYER_MAX_HEALTH'),[int(0),int(50)]),
   bytes(scmOpcode('INCREASE_PLAYER_MAX_ARMOUR'),[int(0),int(25)]));
  expect(game.playerInfo.maxHealth).toBe(150);
  expect(game.playerInfo.maxArmour).toBe(125);
  expect(health).toEqual([150]);
  expect(armour).toEqual([125]);
  const {global}=run(game,{},bytes(scmOpcode('GET_PLAYER_MAX_ARMOUR'),[int(0),gvar(40)]));
  expect(global(40)).toBe(125);
 });

 test('both back-off flags stop the law only when they go on',()=>{
  for(const [name,field] of [['SET_POLICE_IGNORE_PLAYER','policeBackOff'],['SET_EVERYONE_IGNORE_PLAYER','everybodyBackOff']] as const){
   const game=new ScmGameState();let stopped=0;
   const world={stopAllLawEnforcers:()=>{stopped++;}};
   run(game,world,bytes(scmOpcode(name),[int(0),int(1)]));
   expect(game.playerInfo[field],name).toBe(true);
   expect(stopped,name).toBe(1);
   run(game,world,bytes(scmOpcode(name),[int(0),int(0)]));
   expect(game.playerInfo[field],name).toBe(false);
   expect(stopped,name).toBe(1);
  }
 });

 test('the cranes each set their own, and only the quarry one leaves the water fog alone',()=>{
  const cases:[string,number,boolean][]=[
   ['PLAYER_ENTERED_DOCK_CRANE',CRANE_MAGNO,false],
   ['PLAYER_ENTERED_BUILDINGSITE_CRANE',CRANE_WRECKING_BALL,false],
   ['PLAYER_ENTERED_LAS_VEGAS_CRANE',CRANE_LAS_VEGAS,false],
   ['PLAYER_ENTERED_QUARRY_CRANE',CRANE_QUARRY,true],
  ];
  for(const [name,crane,fog] of cases){
   const {game}=one(name);
   expect(game.playerInfo.controlsCrane,name).toBe(crane);
   expect(game.playerInfo.waterFogScript,name).toBe(fog);
  }
  const game=new ScmGameState();
  run(game,{},bytes(scmOpcode('PLAYER_ENTERED_DOCK_CRANE'),[]),bytes(scmOpcode('PLAYER_LEFT_CRANE'),[]));
  expect(game.playerInfo).toMatchObject({controlsCrane:CRANE_NONE,waterFogScript:true});
 });

 test('the two-player statics are kept although this port has one player',()=>{
  const game=new ScmGameState();
  run(game,{},bytes(scmOpcode('LIMIT_TWO_PLAYER_DISTANCE'),[float(12.5)]));
  expect(game.playerInfo).toMatchObject({limitPlayerDistance:true,maxPlayerDistance:12.5});
  run(game,{},bytes(scmOpcode('RELEASE_TWO_PLAYER_DISTANCE'),[]));
  expect(game.playerInfo.limitPlayerDistance).toBe(false);
  run(game,{},bytes(scmOpcode('SET_PLAYER_PLAYER_TARGETTING'),[int(0)]),
   bytes(scmOpcode('SET_PLAYERS_CAN_BE_IN_SEPARATE_CARS'),[int(1)]));
  expect(game.playerInfo).toMatchObject({playersCannotTargetEachOther:true,playersCanBeInSeparateCars:true});
 });
});

describe('the pad flags and the control the script takes away',()=>{
 test('each button command stores the flag the pad keeps, which is the opposite of what the script asks',()=>{
  const cases:[string,'duck'|'enterCar'|'fireWeapon'|'jump'][]=[
   ['SET_PLAYER_DUCK_BUTTON','duck'],['SET_PLAYER_ENTER_CAR_BUTTON','enterCar'],
   ['SET_PLAYER_FIRE_BUTTON','fireWeapon'],['SET_PLAYER_JUMP_BUTTON','jump'],
  ];
  for(const [name,flag] of cases){
   expect(one(name,[int(0),int(0)]).game.pads.disabled[0][flag],name).toBe(true);
   expect(one(name,[int(0),int(1)]).game.pads.disabled[0][flag],name).toBe(false);
  }
 });

 test('the brakes go to the pad the command names and no other',()=>{
  const {game}=one('APPLY_BRAKES_TO_PLAYERS_CAR',[int(1),int(1)]);
  expect(game.pads.applyBrakes).toEqual([false,true]);
 });

 test('taking control away makes the player safe, and the question reads that flag back',()=>{
  const game=new ScmGameState();const asked:boolean[]=[];
  const safe:[boolean,number][]=[];
  const world={setPlayerControl:(_p:number,control:boolean)=>{asked.push(control);},makePlayerSafe:(_p:number,on:boolean,radius:number)=>{safe.push([on,radius]);}};
  expect(run(game,world,bytes(scmOpcode('IS_PLAYER_CONTROL_ON'),[int(0)])).thread.condition).toBe(true);
  run(game,world,bytes(scmOpcode('SET_PLAYER_CONTROL'),[int(0),int(0)]));
  expect(game.pads.playerSafe[0]).toBe(true);
  expect(game.playerInfo).toMatchObject({canBeDamaged:false,everybodyBackOff:true});
  expect(run(game,world,bytes(scmOpcode('IS_PLAYER_CONTROL_ON'),[int(0)])).thread.condition).toBe(false);
  run(game,world,bytes(scmOpcode('SET_PLAYER_CONTROL'),[int(0),int(1)]));
  expect(game.playerInfo).toMatchObject({canBeDamaged:true,everybodyBackOff:false});
  expect(asked).toEqual([false,true]);
  // MakePlayerSafe(!state, 10) each way, so the player and the cars take damage again once control is back.
  expect(safe).toEqual([[true,10],[false,10]]);
 });

 test('the cutscene command makes the player safe over a very wide radius and says a cutscene is running',()=>{
  const game=new ScmGameState();const calls:unknown[]=[];
  run(game,{makePlayerSafe:(...args)=>{calls.push(args);}},bytes(scmOpcode('MAKE_PLAYER_SAFE_FOR_CUTSCENE'),[int(0)]));
  expect(calls).toEqual([[0,true,10000]]);
  expect(game.pads.safeForCutscene[0]).toBe(true);
  expect(game.pads.playerSafe[0]).toBe(true);
  expect(game.playerInfo.cutsceneProcessing).toBe(true);
 });
});

describe('what the player is wearing, and the state a shop stores',()=>{
 test('the wearing question compares the key of the name against the part',()=>{
  const game=new ScmGameState();
  game.clothes.setTextureAndModel('vest','torso',CLOTHES_TEXTURE.torso);
  const ask=(name:string)=>run(game,{},bytes(scmOpcode('IS_PLAYER_WEARING'),
   [int(0),[4,CLOTHES_TEXTURE.torso],name])).thread.condition;
  expect(ask('VEST')).toBe(true);
  expect(ask('vest')).toBe(true);
  expect(ask('suit')).toBe(false);
  expect(game.clothes.textureKeys[CLOTHES_TEXTURE.torso]).toBe(nativeUppercaseKey('vest'));
 });

 test('storing keeps a copy, and the restore only lowers the flag, as the source leaves it',()=>{
  const game=new ScmGameState();
  game.clothes.setTextureAndModel('vest','torso',CLOTHES_TEXTURE.torso);
  run(game,{},bytes(scmOpcode('STORE_CLOTHES_STATE'),[]));
  expect(game.clothes.haveBeenStored).toBe(true);
  expect(game.clothes.storedState?.textureKeys[CLOTHES_TEXTURE.torso]).toBe(nativeUppercaseKey('vest'));
  game.clothes.setTextureAndModel('suit','torso',CLOTHES_TEXTURE.torso);
  run(game,{},bytes(scmOpcode('RESTORE_CLOTHES_STATE'),[]));
  expect(game.clothes.haveBeenStored).toBe(false);
  // The restore points a local at the stored copy and does not write it back, so the player still wears the suit.
  expect(game.clothes.textureKeys[CLOTHES_TEXTURE.torso]).toBe(nativeUppercaseKey('suit'));
 });

 test('building the player model is handed to the host that owns it',()=>{
  const built:number[]=[];
  run(new ScmGameState(),{buildPlayerModel:player=>{built.push(player);}},
   bytes(scmOpcode('BUILD_PLAYER_MODEL'),[int(0)]));
  expect(built).toEqual([0]);
 });
});
