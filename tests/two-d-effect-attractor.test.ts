import {expect,test} from 'vitest';
import {readTwoDEffects,EFFECT,PED_ATTRACTOR} from '../src/assets/twoDEffect';

test('a ped attractor 2dfx entry reads its type, directions, script name and probability from the 56-byte block',()=>{
 const bytes=new Uint8Array(4+12+8+56),v=new DataView(bytes.buffer);let o=0;
 v.setUint32(o,1,true);o+=4;
 for(const f of [1.5,2.5,0.5]){v.setFloat32(o,f,true);o+=4;}
 v.setUint32(o,EFFECT.attractor,true);o+=4;v.setUint32(o,56,true);o+=4;
 v.setInt32(o,PED_ATTRACTOR.seat,true);o+=4;
 for(const f of [0,-1,0, 1,0,0, 0,1,0]){v.setFloat32(o,f,true);o+=4;}
 for(const c of 'SEAT\0\0\0\0')bytes[o++]=c.charCodeAt(0);
 v.setInt32(o,60,true);o+=4;bytes[o++]=1;bytes[o++]=0;bytes[o++]=2;bytes[o++]=0;
 const [effect]=readTwoDEffects(bytes);
 expect(effect.type).toBe(EFFECT.attractor);expect(effect.position).toEqual([1.5,2.5,0.5]);
 expect(effect.attractor).toEqual({type:PED_ATTRACTOR.seat,queueDir:[0,-1,0],useDir:[1,0,0],forwardDir:[0,1,0],scriptName:'SEAT',probability:60});
});
