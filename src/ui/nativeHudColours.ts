/* CHudColours' table and CRadar::GetRadarTraceColour, pinned gta-reversed ead3051.
 *
 * The table is the fifteen colours CHudColours' constructor sets, in the order eHudColours numbers them. The
 * trace colour is the routine that turns a blip's eBlipColour into one of them, which the radar draws every
 * blip with; a colour outside the enum is already a packed colour and is taken as it stands. */
export const HUD_COLOUR_RED=0,HUD_COLOUR_GREEN=1,HUD_COLOUR_DARK_BLUE=2,HUD_COLOUR_LIGHT_BLUE=3,
 HUD_COLOUR_LIGHT_GRAY=4,HUD_COLOUR_BLACK=5,HUD_COLOUR_GOLD=6,HUD_COLOUR_PURPLE=7,HUD_COLOUR_DARK_GRAY=8,
 HUD_COLOUR_DARK_RED=9,HUD_COLOUR_DARK_GREEN=10,HUD_COLOUR_CREAM=11,HUD_COLOUR_NIGHT_BLUE=12,
 HUD_COLOUR_BLUE=13,HUD_COLOUR_YELLOW=14,HUD_COLOUR_COUNT=15;
/** CHudColours::CHudColours (0x58FDA0), as red, green, blue. Every one of them is fully opaque. */
export const HUD_COLOURS:readonly (readonly [number,number,number])[]=[
 [180,25,29],[54,104,44],[50,60,127],[172,203,241],[225,225,225],[0,0,0],[144,98,16],[168,110,252],
 [150,150,150],[104,15,17],[38,71,31],[226,192,99],[74,90,107],[20,25,200],[255,255,0]];
/** eBlipColour. The two copies are the same colours as the ones above them, as the enum's own note says. */
export const BLIP_COLOUR_RED=0,BLIP_COLOUR_GREEN=1,BLIP_COLOUR_BLUE=2,BLIP_COLOUR_WHITE=3,BLIP_COLOUR_YELLOW=4,
 BLIP_COLOUR_REDCOPY=5,BLIP_COLOUR_BLUECOPY=6,BLIP_COLOUR_THREAT=7,BLIP_COLOUR_DESTINATION=8;
/** CRadar::GetRadarTraceColour (0x584770): the HUD colour a blip is drawn in. A bright blip takes the lighter
 * of the pair, a dull one the darker; a threat blip is blue when it is friendly and red when it is not. */
export function radarTraceHudColour(colour:number,bright:boolean,friendly:boolean){
 switch(colour){
  case BLIP_COLOUR_RED:case BLIP_COLOUR_REDCOPY:return bright?HUD_COLOUR_RED:HUD_COLOUR_DARK_RED;
  case BLIP_COLOUR_GREEN:return bright?HUD_COLOUR_GREEN:HUD_COLOUR_DARK_GREEN;
  case BLIP_COLOUR_BLUE:case BLIP_COLOUR_BLUECOPY:return bright?HUD_COLOUR_LIGHT_BLUE:HUD_COLOUR_BLUE;
  case BLIP_COLOUR_WHITE:return bright?HUD_COLOUR_LIGHT_GRAY:HUD_COLOUR_DARK_GRAY;
  case BLIP_COLOUR_YELLOW:return bright?HUD_COLOUR_CREAM:HUD_COLOUR_GOLD;
  case BLIP_COLOUR_THREAT:return friendly?HUD_COLOUR_BLUE:HUD_COLOUR_RED;
  case BLIP_COLOUR_DESTINATION:return HUD_COLOUR_CREAM;
  default:return undefined;
 }
}
/** The same as a CSS colour for the browser's own radar. A blip colour the enum does not name carries its own
 * packed value instead of an index, which the routine returns as it stands. */
export function radarTraceColour(colour:number,bright:boolean,friendly:boolean){
 const index=radarTraceHudColour(colour,bright,friendly);
 if(index===undefined){
  // CRGBA::ToInt packs red, green, blue and alpha from the low byte up.
  const r=colour&255,g=colour>>>8&255,b=colour>>>16&255;
  return `rgb(${r},${g},${b})`;
 }
 const [r,g,b]=HUD_COLOURS[index];
 return `rgb(${r},${g},${b})`;
}
