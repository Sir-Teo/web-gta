/* CStats::DisplayScriptStatUpdateMessage (0x55B980) and CHud::SetHelpMessageStatUpdate (0x588D40), pinned
 * gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: a stat that moves by more than 1 shows in the help box as its
 * name, a "+" or "-" and a bar out of 1000, unless the widescreen borders are up or a help message is showing; a
 * capped stat already at 1000 shows nothing. Respect shows whatever the change. CHud::DrawHelpText, which lays the
 * box out, is not reversed. The names are the GXT's STATnnn entries. */
export const STAT_UPDATE_STATS:ReadonlySet<number>=new Set([21,22,23,24,25,69,70,71,72,73,74,75,76,77,78,79,81,160,164,165]);
export const STAT_TOTAL_RESPECT=64;
export function showsStatUpdate(o:{stat:number;value:number;widescreen:boolean;helpShowing:boolean;capped:boolean;current:number}){
 if(o.widescreen||o.helpShowing)return false;
 if(o.capped&&o.current>=1000)return false;
 if(o.stat===STAT_TOTAL_RESPECT)return true;
 return STAT_UPDATE_STATS.has(o.stat)&&o.value>1;
}
/** The GXT key of a stat's name. */
export const statNameKey=(stat:number)=>`STAT${String(stat).padStart(3,'0')}`;
