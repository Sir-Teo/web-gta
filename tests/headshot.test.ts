import {expect,test} from 'vitest';
import {isInstantHitGun,pedPieceAt} from '../src/simulation/WorldPedestrians';
import {PED_PIECE} from '../src/combat/nativeDamageAnim';
test('instant-hit guns are the pistols through the sniper rifles and the minigun, not melee or launchers',()=>{
 for(const w of [22,23,24,25,26,27,28,29,30,31,32,33,34,38])expect(isInstantHitGun(w)).toBe(true);
 for(const w of [0,1,4,8,16,18,35,36,37,39,41,undefined])expect(isInstantHitGun(w)).toBe(false);
});
test('a bullet above 1.45 over the feet is in the head',()=>{
 const feet={x:0,y:10,z:0};
 expect(pedPieceAt(feet,0,{x:0,y:11.6,z:0})).toBe(PED_PIECE.head);
 expect(pedPieceAt(feet,0,{x:0,y:11.2,z:0})).toBe(PED_PIECE.torso);
});
