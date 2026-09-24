/** CClothes::GetPlayerMotionGroupToLoad (0x5A7FB0): the fat group past 500 fat that outweighs the muscle, else the
 * muscular group past 500 muscle, else the player's own. */
export function playerMotionGroupToLoad(fat:number,muscle:number):'fat'|'muscular'|undefined{
 if(fat>500&&fat>muscle)return 'fat';
 return muscle<=500?undefined:'muscular';
}
/** aFatAnimations and aMuscularAnimations (0x8A8ABC, 0x8A8AD4) in the walk, run, sprint, idle and walk-start slots;
 * each group's IFP block shares its name. */
export const PLAYER_MOTION_CLIPS={
 fat:{walk:'fatwalk',run:'fatrun',sprint:'fatsprint',idle:'fatidle',walkStart:'fatwalkstart'},
 muscular:{walk:'musclewalk',run:'musclerun',sprint:'musclesprint',idle:'muscleidle',walkStart:'musclewalkstart'},
} as const;
