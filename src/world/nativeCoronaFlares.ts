/** eCoronaFlareType. Only the sun registers a flare here: none of gta3.img's 1,022 2d effect lights asks for one, and
 * the headlight flares belong to the unreversed vehicle lights. */
export const FLARE={none:0,sun:1,headlights:2} as const;
/** CFlareDefinition: where the sprite sits along the line from the screen centre through the corona, its size, the
 * colour multipliers (int16 / 65535) and the headlight intensity multiplier (int16 / 256). */
export interface FlareDefinition {position:number;size:number;color:readonly [number,number,number];intensity:number}
const def=(position:number,size:number,color:readonly [number,number,number],intensity=200):FlareDefinition=>({position,size,color,intensity});
/** SunFlareDef (0x8D4B68). */
export const SUN_FLARE:readonly FlareDefinition[]=[
 def(4,8,[36,30,24]),def(3,11.2,[24,18,15]),def(2,8,[24,12,12]),def(1.5,9.6,[54,54,48]),def(1.25,8,[24,24,18]),
 def(.8,22.4,[36,30,24]),def(.6,6.4,[24,15,12]),def(.25,16,[36,30,30]),def(.1,9.6,[18,18,18]),def(.05,22.4,[36,30,24]),
 def(-.03,4.8,[18,18,18]),def(-.1,9.6,[42,42,42]),def(-.3,8,[18,6,6]),def(-.4,96,[18,12,9]),def(-.55,6.4,[18,18,12]),
 def(-.75,22.4,[42,24,18]),def(-.9,8.32,[21,12,18]),def(-1,17.6,[42,13,18]),def(-1.2,5.6,[21,12,12]),def(-1.35,14.4,[42,42,24]),
 def(-1.7,86.8,[21,15,15]),def(-2,8,[48,30,30]),def(-2.5,7.2,[21,15,12]),def(-3,22.4,[42,30,24]),def(-6,38.4,[42,42,30]),
 def(-9,22.4,[42,30,36]),
];
/** HeadLightsFlareDef (0x8D4D88), for the unported vehicle headlights. */
export const HEADLIGHTS_FLARE:readonly FlareDefinition[]=[
 def(4,5,[60,60,60]),def(3,7,[40,40,40]),def(2,5,[40,40,40]),def(1.5,6,[90,90,90]),def(1.25,5,[40,40,40]),
 def(.8,14,[60,60,60]),def(.6,4,[40,40,40]),def(.25,10,[60,60,60]),def(.1,6,[30,30,30]),def(.05,14,[50,50,50]),
 def(-.03,3,[30,30,30]),def(-.1,6,[60,60,60]),def(-.3,5,[30,30,30]),def(-.4,60,[30,30,30]),def(-.55,4,[40,40,40]),
 def(-.75,14,[50,50,50]),def(-.9,5.2,[35,35,35]),def(-1,11,[55,55,55]),def(-1.2,3.5,[35,35,35]),def(-1.35,9,[50,50,50]),
 def(-1.7,54,[35,35,35]),def(-2,5,[50,50,50]),def(-2.5,4.5,[35,35,35]),def(-3,14,[50,50,50]),def(-6,24,[70,70,70]),
 def(-9,14,[70,50,70]),
];
/** One CSprite::RenderBufferedOneXLUSprite2D of a flare: a screen position in normalised device coordinates, a half
 * size in raster pixels and the sprite's colour bytes. */
export interface FlareSprite {position:[number,number];halfSize:number;color:[number,number,number]}
/** CCoronas::Render's flare pass (0x6FB2F3): with the corona's line to the camera clear of vehicles and peds, its
 * flare's 26 `coronastar` sprites are strung along the line from the screen centre through it, each at the corona's
 * colour times a random 0.7 to 1 of the faded intensity and its own multipliers. They are additive, untested against
 * depth and four times the listed size. `screen` is the corona's position in normalised device coordinates. */
export function coronaFlares(type:number,screen:readonly [number,number],color:readonly [number,number,number],fadedIntensity:number,random:()=>number=Math.random):FlareSprite[]{
 const definitions=type===FLARE.sun?SUN_FLARE:type===FLARE.headlights?HEADLIGHTS_FLARE:undefined;
 if(!definitions||fadedIntensity<=0)return [];
 const variation=(.7+random()*.3)*fadedIntensity;
 // RenderBufferedOneXLUSprite2D scales the colour by its intensity, 255 here.
 const byte=(c:number,multiplier:number)=>((Math.trunc(c*variation*multiplier/65535)&255)*255)>>8;
 return definitions.map(d=>({position:[screen[0]*d.position,screen[1]*d.position],halfSize:d.size*4,
  color:[byte(color[0],d.color[0]),byte(color[1],d.color[1]),byte(color[2],d.color[2])]}));
}
