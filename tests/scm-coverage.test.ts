import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {SCM_GAME_COMMANDS} from '../src/engine/ScmGameCommands';
import {NATIVE_NOP_OPCODES} from '../src/engine/ScmNativeNops';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** The opcodes ScmThread runs itself: the numeric, string, comparison, control-flow and scheduling core. */
function isCore(op:number){
 const ranges:[number,number][]=[[4,23],[88,119],[120,131],[132,139],[140,147],[148,151],[24,60],[66,70],[0x4b0,0x4b7],[2116,2119]];
 const singles=[0,1,2,197,198,1198,1199,1449,1450,1745,1746,1453,1454,2297,2298,153,520,521,0x4a3,0x4a4,0x871,0x872,0x4d,0x4e,0x4f,0x50,0x51,0xd6,0x16a,0xd7,0x417,0x459,0x3a4];
 return singles.includes(op)||ranges.some(([low,high])=>op>=low&&op<=high);
}
/** Every instruction of MAIN and of all 135 mission blocks. */
function instructions(){
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
 const header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 return blocks.flat();
}

/* How much of the original script the runtime can already execute. The figures only move when a command family
 * goes in, so a drop means something stopped being handled. */
test('the runtime covers three quarters of the original script and does not go backwards',()=>{
 const all=instructions();
 let handled=0;const distinct=new Set<number>(),missing=new Set<number>();
 for(const instruction of all){
  const op=instruction.opcode&0x7fff;
  if(isCore(op)||NATIVE_NOP_OPCODES.has(op)||SCM_GAME_COMMANDS.has(op)){handled++;distinct.add(op);}
  else missing.add(op);
 }
 expect(all.length).toBe(360439);
 expect(handled/all.length).toBeGreaterThanOrEqual(0.7679);
 expect(distinct.size).toBeGreaterThanOrEqual(368);
 expect(missing.size).toBeLessThanOrEqual(1087);
});

test('every command family this runtime claims is reachable by opcode',()=>{
 const claimed=['ADD_HOSPITAL_RESTART','ADD_POLICE_RESTART','OVERRIDE_NEXT_RESTART','ADD_STUNT_JUMP','CREATE_CAR_GENERATOR',
  'SWITCH_CAR_GENERATOR','CREATE_OBJECT','CREATE_OBJECT_NO_OFFSET','SET_OBJECT_PROOFS','SET_ZONE_POPULATION_TYPE',
  'SET_ZONE_GANG_STRENGTH','INIT_ZONE_POPULATION_SETTINGS','SET_FIXED_CAMERA_POSITION','POINT_CAMERA_AT_POINT',
  'RESTORE_CAMERA_JUMPCUT','LOAD_SPRITE','DRAW_SPRITE','DRAW_RECT','DRAW_WINDOW','SET_PED_DENSITY_MULTIPLIER',
  'PLAYER_MADE_PROGRESS','START_SCRIPT_FIRE','REMOVE_ALL_SCRIPT_FIRES','GET_SCRIPT_FIRE_COORDS',
  'ALTER_WANTED_LEVEL','ALTER_WANTED_LEVEL_NO_DROP','IS_WANTED_LEVEL_GREATER','CLEAR_WANTED_LEVEL',
  'ADD_SCORE','STORE_SCORE','INCREMENT_INT_STAT','DECREMENT_FLOAT_STAT','SIN','COS',
  'GET_DISTANCE_BETWEEN_COORDS_2D','GET_DISTANCE_BETWEEN_COORDS_3D','ADD_SET_PIECE','CAMERA_RESET_NEW_SCRIPTABLES',
  'CAMERA_SET_LERP_FOV','IS_BUTTON_PRESSED','GET_PAD_STATE','SWITCH_ROADS_OFF','SWITCH_PED_ROADS_BACK_TO_ORIGINAL'];
 for(const name of claimed)expect(SCM_GAME_COMMANDS.has(scmOpcode(name)),name).toBe(true);
});
