import {expect,test} from 'vitest';
import fixture from './fixtures/native-pickup-ground.json';
import {ScmThread,type ScmThreadHost} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {nativePickupCoordinate} from '../src/assets/nativePickupPosition';

for(const row of fixture.cases)test(`captured ${row.input.opcode===531?'CREATE_PICKUP':'CREATE_PICKUP_WITH_AMMO'} ground: ${row.input.name}`,()=>{
 const input=row.input,parts:number[]=[input.opcode&255,input.opcode>>8];
 const operand=(type:number,value:number)=>{const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);if(type===6)view.setFloat32(0,value,true);else view.setInt32(0,value,true);parts.push(type,...bytes);};
 operand(1,input.model);operand(1,input.type);if(input.opcode===811)operand(1,input.ammo);input.position.forEach(v=>operand(6,v));parts.push(3,0,0,78,0);
 const game=new ScmGameState(),queries:number[][]=[],host:ScmThreadHost={startScript(){},game,world:{fade(){},groundZForCoord:(x,y)=>{queries.push([x,y]);return input.ground;}}};
 const thread=new ScmThread(new Uint8Array(parts),0,0,new DataView(new ArrayBuffer(34*4)),host);thread.condition=true;thread.run(0,20);
 expect(queries).toEqual(row.groundQueries);expect(game.pickups.count).toBe(1);const [pickup]=game.pickups.all;
 expect(pickup.model).toBe(row.generated.model);expect(pickup.type).toBe(row.generated.type);expect(pickup.ammo).toBe(row.generated.ammo);expect([pickup.position.x,pickup.position.y,pickup.position.z]).toEqual(row.generated.position.map(nativePickupCoordinate));expect(thread.locals.getInt32(0,true)).toBe(pickup.handle);expect(thread.condition).toBe(true);expect(thread.terminated).toBe(true);
});
