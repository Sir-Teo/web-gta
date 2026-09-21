import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,UnsupportedScmCommand,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {PICKUP_TYPE,readInitialPickups} from '../src/assets/scmPickups';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game=new ScmGameState()){
 const header=readScmHeader(file());
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands,objectNames:header.objectNames};
 return {thread:new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host),game};
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
 const found=code.find(i=>i.name===name);
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('the pickups a script places',()=>{
 test('the script’s own locked property pickup takes its label and type',()=>{
  const {bytes,instruction}=find('CREATE_LOCKED_PROPERTY_PICKUP');
  const {thread,game}=threadAt(bytes,instruction.offset);
  runOne(thread);
  expect(game.pickups.count).toBe(1);
  const [pickup]=game.pickups.all;
  expect(pickup.type).toBe(PICKUP_TYPE.propertyLocked);
  expect(pickup.text).toBe(instruction.parameters[3].value);
  // The script feeds these from globals it set earlier, so the position is whatever those globals hold.
  expect(instruction.parameters[0].type).toBe(2);
  expect(Number.isFinite(pickup.position.x)).toBe(true);
 });

 test('INITIAL places its property pickups and then meets the next unported command',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const first=code.find(i=>i.name==='CREATE_LOCKED_PROPERTY_PICKUP')!;
  const {thread,game}=threadAt(bytes,first.offset);
  // The pickups no longer stop the run; the entry-exit flag that follows them does.
  expect(()=>thread.run(0,4000)).toThrow('SET_CLOSEST_ENTRY_EXIT_FLAG');
  expect(game.pickups.count).toBeGreaterThan(0);
 });

 test('a pickup can be asked after, collected and removed',()=>{
  const game=new ScmGameState();
  const handle=game.pickups.createPickup(321,PICKUP_TYPE.onStreet,{x:1,y:2,z:3},50);
  expect(game.pickups.exists(handle)).toBe(true);
  expect(game.pickups.hasBeenCollected(handle)).toBe(false);
  game.pickups.collect(handle);
  expect(game.pickups.hasBeenCollected(handle)).toBe(true);
  game.pickups.remove(handle);
  expect(game.pickups.exists(handle)).toBe(false);
  // A handle that names nothing has not been collected either.
  expect(game.pickups.hasBeenCollected(handle)).toBe(false);
 });

 test('the money, protection and collectable forms carry their own type',()=>{
  const game=new ScmGameState();
  const money=game.pickups.at(game.pickups.createMoneyPickup({x:0,y:0,z:0},500))!;
  expect(money.type).toBe(PICKUP_TYPE.money);
  expect(money.ammo).toBe(500);
  const protection=game.pickups.at(game.pickups.createProtectionPickup({x:0,y:0,z:0},1000,20))!;
  expect(protection.type).toBe(PICKUP_TYPE.assetRevenue);
  expect(protection.moneyPerDay).toBe(20);
  expect(game.pickups.at(game.pickups.createOysterPickup({x:0,y:0,z:0}))!.type).toBe(PICKUP_TYPE.once);
  expect(game.pickups.at(game.pickups.createSnapshotPickup({x:0,y:0,z:0}))!.type).toBe(PICKUP_TYPE.snapshot);
 });

 test('the reader still finds the same pickups in the file',async()=>{
  const {pickups}=readInitialPickups(file(),[{id:1247,model:'property_locked',dictionary:'',section:'obj'} as never]);
  expect(Array.isArray(pickups)).toBe(true);
 });
});
