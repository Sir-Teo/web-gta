import {expect,test,beforeAll} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';

beforeAll(async()=>{await RAPIER.init();});
// PLAYER_TAKE_OFF_GOGGLES (iOS 0x1002056d8): with the clip, CTaskComplexUseGoggles takes them off when it ends; without,
// CPed::TakeOffGoggles at once. With no goggles on, the clip is not started.
test('the script takes the player\'s goggles off, with the clip or at once',()=>{
 const weapons=new WeaponSystem(new Simulation(),()=>undefined,()=>undefined);
 weapons.takeOffGoggles(true);expect(weapons.goggles).toBeUndefined();
 weapons.vision='nightvision';weapons.takeOffGoggles(true);
 expect(weapons.goggles).toEqual({kind:'nightvision',remaining:weapons.gogglesClipSeconds});
 weapons.vision='infrared';weapons.goggles=undefined;weapons.takeOffGoggles(false);
 expect([weapons.vision,weapons.goggles]).toEqual([null,undefined]);
});

// CPostEffects::SetNightVision / SetInfraredVision (iOS 0x100384da8, 0x100384dcc): on sets the one and clears the other;
// off clears only the one.
test('the script turns night and infrared vision on and off',()=>{
 const weapons=new WeaponSystem(new Simulation(),()=>undefined,()=>undefined);
 weapons.setVisionEffect('nightvision',true);expect(weapons.vision).toBe('nightvision');
 weapons.setVisionEffect('infrared',true);expect(weapons.vision).toBe('infrared');
 weapons.setVisionEffect('nightvision',false);expect(weapons.vision).toBe('infrared');
 weapons.setVisionEffect('infrared',false);expect(weapons.vision).toBeNull();
});
