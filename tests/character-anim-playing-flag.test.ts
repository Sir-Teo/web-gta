import {expect,test} from 'vitest';
import {setCharacterAnim} from '../src/simulation/WorldPedestrians';

// SET_CHAR_ANIM_PLAYING_FLAG (CharacterCommands.cpp:2864) sets ANIMATION_IS_PLAYING on the clip and leaves its speed:
// a clip the script slowed and then stopped runs on at the slowed rate once started again.
test('the playing flag stops and starts the clip without touching its speed',()=>{
 const state={speed:1,playing:true};
 const view={reactionName:'GYM_BP_UP_SMOOTH',
  setReactionSpeed:(_n:string,speed:number)=>{state.speed=speed;return true;},
  setReactionProgress:()=>true,
  setReactionPlaying:(_n:string,playing:boolean)=>{state.playing=playing;return true;}};
 setCharacterAnim(view,'gym_bp_up_smooth',{speed:.5});
 setCharacterAnim(view,'gym_bp_up_smooth',{playing:false});
 expect(state).toEqual({speed:.5,playing:false});
 setCharacterAnim(view,'gym_bp_up_smooth',{playing:true});
 expect(state).toEqual({speed:.5,playing:true});
 // Another clip than the one playing is left alone.
 setCharacterAnim(view,'other',{playing:false});
 expect(state.playing).toBe(true);
});
