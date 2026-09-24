/* The moon, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: CClouds::Render_MaybeRenderMoon ([0x7139B2 -
 * 0x713D2A] of CClouds::Render). Visible while |minutes today - 220| < 220, its blue 220 - that distance and red and
 * green that blue faded to 0 by max(Foggyness, CloudCoverage), a sprite of half-size CCoronas::MoonSize x 2 + 4 at
 * the camera + (0, -100, 15), drawn at the far clip.
 *
 * As reversed the window is 00:00 to 07:20, brightest at 03:40, though the source's own comment reads 20:20 to 03:40;
 * the code is followed until the exe settles it. The phase mask sprite is drawn with vertex alpha 0 there, so it
 * changes nothing on screen and is left out; so is shooting the moon (MoonSize cycling). */
export const MOON_SIZE=3;
/** Native offset from the camera (x, y, z up). */
export const MOON_OFFSET=[0,-100,15] as const;
export function nativeMoon(minutesToday:number,colorBalance:number){
 const away=Math.trunc(Math.abs(minutesToday-220));if(away>=220)return undefined;
 const blue=220-away,rg=Math.trunc(blue*(1-Math.max(0,Math.min(1,colorBalance))));
 if(!rg)return undefined;
 return {color:[rg,rg,Math.trunc(blue*.85)] as [number,number,number],halfSize:MOON_SIZE*2+4};
}
