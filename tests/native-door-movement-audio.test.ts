import {expect,test,vi} from 'vitest';
import {NativeAudioEngine} from '../src/audio/native/NativeAudioEngine';
import {NativeDoorAudio,AE_DOOR} from '../src/audio/native/NativeDoorAudio';
function fixture(loaded=true){
 const played:any[]=[],clock={timeMs:0},bank:any={isSoundBankLoaded:()=>loaded,loadSoundBank:vi.fn()},manager:any={clock,areSoundsOfThisEventPlayingForThisEntity:()=>false,playSound:(p:any)=>{played.push(p);return{};},cancelSoundsOwnedByAudioEntity:vi.fn()},door=new NativeDoorAudio(manager,bank,()=>-6);return{door,manager,bank,clock,played};
}
test('entry movement uses the native sample and strict shared four-second gate, including a voice still playing',()=>{
 const {door,manager,clock,played}=fixture(),at={x:4,y:5,z:6};clock.timeMs=4000;door.addMovingDoorEvent(at);expect(played).toHaveLength(0);clock.timeMs=4001;door.addMovingDoorEvent(at);expect(played).toHaveLength(1);expect(played[0]).toMatchObject({slot:31,sound:1,event:163,position:at,volume:-6,speed:1,rollOff:2});expect(door.movingSoundsStarted).toBe(1);
 clock.timeMs=8001;door.addMovingDoorEvent(at);expect(played).toHaveLength(1);clock.timeMs=8002;manager.areSoundsOfThisEventPlayingForThisEntity=()=>true;door.addMovingDoorEvent(at);expect(played).toHaveLength(1);manager.areSoundsOfThisEventPlayingForThisEntity=()=>false;door.addMovingDoorEvent(at);expect(played).toHaveLength(2);expect(AE_DOOR.entryExitMoving).toBe(163);
 door.reset();expect(door.movingSoundsStarted).toBe(0);expect(manager.cancelSoundsOwnedByAudioEntity).toHaveBeenCalledWith(door,true);
});
test('an unavailable door bank requests the native slot and suppresses further reports until the next interval',()=>{
 const {door,clock,bank,played}=fixture(false);clock.timeMs=4001;door.addMovingDoorEvent({x:1,y:2,z:3});expect(bank.loadSoundBank).toHaveBeenCalledWith(51,31);expect(door.movingSoundsStarted).toBe(0);bank.isSoundBankLoaded=()=>true;clock.timeMs=8001;door.addMovingDoorEvent({x:1,y:2,z:3});expect(played).toHaveLength(0);clock.timeMs=8002;door.addMovingDoorEvent({x:1,y:2,z:3});expect(played).toHaveLength(1);
 const engine=Object.assign(Object.create(NativeAudioEngine.prototype),{doors:door}) as NativeAudioEngine;clock.timeMs=12003;engine.reportDoorMovement({x:7,y:8,z:9});expect(played.at(-1).position).toEqual({x:7,y:8,z:9});
});
