import {expect,test} from 'vitest';
import {CANNON_VOICES,CANNON_ROLL_OFF,NativeWaterCannonAudio} from '../src/audio/native/NativeWaterCannonAudio';
import {BANK,SLOT} from '../src/audio/native/NativeBankLoader';

function harness(loaded=true){
 const played:any[]=[];
 const sound=()=>{const s:any={volume:0,speed:0,stopped:false,position:{x:0,y:0,z:0},setPosition(p:any){s.position={...p};},stopSound(){s.stopped=true;}};return s;};
 const manager:any={playSound(p:any){const s=sound();s.volume=p.volume;s.speed=p.speed;s.setPosition(p.position);played.push({...p,handle:s});return s;}};
 const bank:any={isSoundBankLoaded:()=>loaded};
 return {audio:new NativeWaterCannonAudio(manager,bank),played};
}
test('the four voices are the native slots, sounds, speeds and volumes',()=>{
 expect(CANNON_VOICES.map(v=>[v.slot,v.sound,v.speed,v.volume,v.splash])).toEqual([
  [SLOT.frontendGame,0,1.78,6,false],[SLOT.collisions,3,.5,-9,false],
  [SLOT.collisions,3,1,-3,true],[SLOT.collisions,3,.5,-9,true]]);
 expect(CANNON_ROLL_OFF).toBe(2);expect(BANK.frontendGame).toBe(59);
});
test('a firing jet starts its two voices and moves them, and stops them when it does',()=>{
 const {audio,played}=harness();
 audio.service({x:1,y:2,z:3});
 expect(played).toHaveLength(2);
 expect(played.map(p=>p.slot)).toEqual([SLOT.frontendGame,SLOT.collisions]);
 expect(played[0]).toMatchObject({sound:0,volume:6,speed:1.78,rollOff:2});
 expect(audio.snapshot()).toMatchObject({playing:2,started:2,splash:false});
 // A second service moves the same sounds rather than starting more.
 audio.service({x:4,y:5,z:6});
 expect(played).toHaveLength(2);
 expect(played[0].handle.position).toEqual({x:4,y:5,z:6});
 audio.service(undefined);
 expect(played.every(p=>p.handle.stopped)).toBe(true);
 expect(audio.snapshot().playing).toBe(0);
});
test('a splash adds its own pair at the splash point and drops them when it clears',()=>{
 const {audio,played}=harness();
 audio.setSplash({x:9,y:9,z:0},4);
 audio.service({x:1,y:2,z:3});
 expect(played).toHaveLength(4);
 expect(played[2]).toMatchObject({slot:SLOT.collisions,sound:3,volume:-3,speed:1});
 expect(played[3]).toMatchObject({volume:-9,speed:.5});
 expect(played[2].handle.position).toEqual({x:9,y:9,z:0});
 expect(audio.snapshot()).toMatchObject({playing:4,splash:true});
 audio.clearSplash();audio.service({x:1,y:2,z:3});
 expect(played[2].handle.stopped).toBe(true);expect(played[0].handle.stopped).toBe(false);
 expect(audio.snapshot().playing).toBe(2);
});
test('nothing plays until both banks are loaded, and a stopped sound releases its slot',()=>{
 const quiet=harness(false);
 quiet.audio.service({x:0,y:0,z:0});
 expect(quiet.played).toHaveLength(0);
 const {audio,played}=harness();
 audio.service({x:0,y:0,z:0});
 audio.updateParameters(played[0].handle,-1);
 expect(audio.snapshot().playing).toBe(1);
 // The released slot starts a fresh sound on the next service.
 audio.service({x:0,y:0,z:0});
 expect(played).toHaveLength(3);
 audio.terminate();
 expect(audio.snapshot()).toMatchObject({playing:0,splash:false});
});
