/* CStats::DisplayScriptStatUpdateMessage (0x55B980) and CHud::SetHelpMessageStatUpdate (0x588D40), pinned
 * gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: a stat that moves by more than 1 shows in the help box as its
 * name, a "+" or "-" and a bar out of 1000, unless the widescreen borders are up or a help message is showing; a
 * capped stat already at 1000 shows nothing. Respect shows whatever the change. CHud::DrawHelpText, which lays the
 * box out, is not reversed. The names are the GXT's STATnnn entries. */
export const STAT_UPDATE_STATS:ReadonlySet<number>=new Set([21,22,23,24,25,69,70,71,72,73,74,75,76,77,78,79,81,160,164,165,
 // The second group: flying skill, lung capacity, bike skill, cycling skill and luck.
 223,225,229,230,233]);
export const STAT_TOTAL_RESPECT=64;
/** The girlfriends' progress (Denise to Millie), shown whatever the change on a bar out of 100. */
const GIRLFRIEND_PROGRESS:ReadonlySet<number>=new Set([252,253,254,255,256,257]);
const STAT_PIMPING_LEVEL=210,STAT_GANG_STRENGTH=336;
/** The bar's maximum the update shows on, or undefined when it shows nothing. `maxGroup` is the gang strength's bar:
 * FindMaxNumberOfGroupMembers, at most the script's limit to the gang size. */
export function statUpdateBar(o:{stat:number;value:number;widescreen:boolean;helpShowing:boolean;capped:boolean;current:number;maxGroup?:number}):number|undefined{
 if(o.widescreen||o.helpShowing)return undefined;
 if(o.capped&&o.current>=1000)return undefined;
 if(o.stat===STAT_TOTAL_RESPECT)return 1000;
 if(STAT_UPDATE_STATS.has(o.stat))return o.value>1?1000:undefined;
 if(GIRLFRIEND_PROGRESS.has(o.stat))return 100;
 if(o.stat===STAT_PIMPING_LEVEL)return 10;
 if(o.stat===STAT_GANG_STRENGTH)return o.maxGroup;
 return undefined;
}
export function showsStatUpdate(o:Parameters<typeof statUpdateBar>[0]){return statUpdateBar(o)!==undefined;}
/** The GXT key of a stat's name. */
export const statNameKey=(stat:number)=>`STAT${String(stat).padStart(3,'0')}`;
