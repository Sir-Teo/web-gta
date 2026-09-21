import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {readScmHeader} from '../src/assets/scm';
import {scmOpcode} from '../src/engine/scmOpcodes';

const header=()=>readScmHeader(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')));
function host(){
 const made:{vehicle:number;pedType?:number;model?:number|string;seat:number|'driver';random:boolean}[]=[];
 let next=500;
 const world:ScmWorldCommands={
  fade(){},
  createCharInsideCar:(vehicle,pedType,model,seat)=>{made.push({vehicle,pedType,model,seat,random:false});return next++;},
  createRandomCharInCar:(vehicle,seat)=>{made.push({vehicle,seat,random:true});return next++;},
 };
 return {made,world};
}
function run(bytes:Uint8Array,world:ScmWorldCommands){
 const threadHost:ScmThreadHost={startScript(){},game:new ScmGameState(),world,objectNames:header().objectNames};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),threadHost);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
/** Integer operands, then one local the command writes its handle into. */
function ints(opcode:number,values:number[],destination:number){
 const bytes=new Uint8Array(2+values.length*5+3);
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 values.forEach((value,k)=>{bytes[2+k*5]=1;view.setInt32(3+k*5,value,true);});
 const at=2+values.length*5;bytes[at]=3;view.setUint16(at+1,destination,true);
 return bytes;
}

describe('peds created straight into a car',()=>{
 test('the named form passes the ped type, model and the driver’s seat',()=>{
  const h=host();
  const thread=run(ints(scmOpcode('CREATE_CHAR_INSIDE_CAR'),[12,4,105],3),h.world);
  expect(h.made[0]).toEqual({vehicle:12,pedType:4,model:105,seat:'driver',random:false});
  expect(thread.locals.getInt32(3*4,true)).toBe(500);
 });

 test('the random driver and passenger forms ask for their own seats',()=>{
  const h=host();
  run(ints(scmOpcode('CREATE_RANDOM_CHAR_AS_DRIVER'),[20],2),h.world);
  run(ints(scmOpcode('CREATE_RANDOM_CHAR_AS_PASSENGER'),[20,1],3),h.world);
  expect(h.made[0]).toMatchObject({vehicle:20,seat:'driver',random:true});
  expect(h.made[1]).toMatchObject({vehicle:20,seat:1,random:true});
 });

 test('without a world these fail rather than inventing a ped',()=>{
  const bare={fade(){}} as ScmWorldCommands;
  expect(()=>run(ints(scmOpcode('CREATE_CHAR_INSIDE_CAR'),[1,4,105],2),bare)).toThrow('createCharInsideCar');
 });
});
