/** CHud::RenderHealthBar: under 10 health the bar is skipped on the frames where CTimer's frame counter has its 8
 * bit clear (EachFrames(8) is `(frame & 8) == 0`), so it blinks every eight frames; CHud::RenderArmorBar draws only
 * above 1 armour. */
export function healthBarHidden(health:number,frame:number){return Math.trunc(health)<10&&(frame&8)===0;}
export function armourBarHidden(armour:number){return armour<=1;}
