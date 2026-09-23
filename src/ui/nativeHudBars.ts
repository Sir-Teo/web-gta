/** CHud::RenderHealthBar: under 10 health the bar is skipped on the frames where CTimer's frame counter has its 8
 * bit clear (EachFrames(8) is `(frame & 8) == 0`), so it blinks every eight frames; CHud::RenderArmorBar draws only
 * above 1 armour. */
export function healthBarHidden(health:number,frame:number){return Math.trunc(health)<10&&(frame&8)===0;}
export function armourBarHidden(armour:number){return armour<=1;}
/** CHud::DrawMoney: `$%08d` in HUD green, or `-$%07d` in HUD red when the player owes money. */
export function hudMoney(money:number){const whole=Math.trunc(money);return whole<0?{text:`-$${String(-whole).padStart(7,'0')}`,negative:true}:{text:`$${String(whole).padStart(8,'0')}`,negative:false};}
/** CHud::RenderHealthBar's width over the armour bar's: 109 × max health ÷ the STAT_MOD_10 modifier (176, which puts
 * a 100-health bar at the armour bar's 62), right-aligned. The fill is health over max health; armour is likewise
 * over CPlayerInfo::m_nMaxArmour. */
export function healthBarWidth(maxHealth:number){return 109*maxHealth/176/62;}
export function barFill(value:number,max:number){return Math.max(0,Math.min(100,value/Math.max(max,1)*100));}
