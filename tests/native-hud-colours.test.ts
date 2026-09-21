import {expect,test} from 'vitest';
import {BLIP_COLOUR_BLUE,BLIP_COLOUR_BLUECOPY,BLIP_COLOUR_DESTINATION,BLIP_COLOUR_RED,BLIP_COLOUR_REDCOPY,
 BLIP_COLOUR_THREAT,BLIP_COLOUR_WHITE,BLIP_COLOUR_YELLOW,HUD_COLOURS,HUD_COLOUR_BLUE,HUD_COLOUR_COUNT,
 HUD_COLOUR_CREAM,HUD_COLOUR_DARK_GRAY,HUD_COLOUR_DARK_RED,HUD_COLOUR_GOLD,HUD_COLOUR_LIGHT_BLUE,
 HUD_COLOUR_LIGHT_GRAY,HUD_COLOUR_RED,radarTraceColour,radarTraceHudColour} from '../src/ui/nativeHudColours';

test('the HUD colour table is the fifteen CHudColours sets',()=>{
 expect(HUD_COLOURS.length).toBe(HUD_COLOUR_COUNT);
 expect(HUD_COLOURS[HUD_COLOUR_RED]).toEqual([180,25,29]);
 expect(HUD_COLOURS[HUD_COLOUR_CREAM]).toEqual([226,192,99]);
 expect(HUD_COLOURS[HUD_COLOUR_BLUE]).toEqual([20,25,200]);
});

test('a bright blip takes the lighter of its pair and a dull one the darker',()=>{
 expect(radarTraceHudColour(BLIP_COLOUR_RED,true,false)).toBe(HUD_COLOUR_RED);
 expect(radarTraceHudColour(BLIP_COLOUR_RED,false,false)).toBe(HUD_COLOUR_DARK_RED);
 expect(radarTraceHudColour(BLIP_COLOUR_WHITE,true,false)).toBe(HUD_COLOUR_LIGHT_GRAY);
 expect(radarTraceHudColour(BLIP_COLOUR_WHITE,false,false)).toBe(HUD_COLOUR_DARK_GRAY);
 expect(radarTraceHudColour(BLIP_COLOUR_YELLOW,true,false)).toBe(HUD_COLOUR_CREAM);
 expect(radarTraceHudColour(BLIP_COLOUR_YELLOW,false,false)).toBe(HUD_COLOUR_GOLD);
 // The two copies are the same colours as the ones they copy.
 expect(radarTraceHudColour(BLIP_COLOUR_REDCOPY,true,false)).toBe(radarTraceHudColour(BLIP_COLOUR_RED,true,false));
 expect(radarTraceHudColour(BLIP_COLOUR_BLUECOPY,true,false)).toBe(radarTraceHudColour(BLIP_COLOUR_BLUE,true,false));
 expect(radarTraceHudColour(BLIP_COLOUR_BLUE,true,false)).toBe(HUD_COLOUR_LIGHT_BLUE);
});

test('a threat blip is blue when it is friendly and red when it is not, whatever its brightness',()=>{
 expect(radarTraceHudColour(BLIP_COLOUR_THREAT,true,true)).toBe(HUD_COLOUR_BLUE);
 expect(radarTraceHudColour(BLIP_COLOUR_THREAT,false,true)).toBe(HUD_COLOUR_BLUE);
 expect(radarTraceHudColour(BLIP_COLOUR_THREAT,true,false)).toBe(HUD_COLOUR_RED);
 // A destination blip is cream however it is asked for.
 expect(radarTraceHudColour(BLIP_COLOUR_DESTINATION,false,false)).toBe(HUD_COLOUR_CREAM);
});

test('a colour outside the enum is a packed colour and is taken as it stands',()=>{
 expect(radarTraceHudColour(0x203040,true,false)).toBeUndefined();
 // CRGBA::ToInt packs red, green and blue from the low byte up.
 expect(radarTraceColour(0x00403020,true,false)).toBe('rgb(32,48,64)');
 expect(radarTraceColour(BLIP_COLOUR_DESTINATION,true,false)).toBe('rgb(226,192,99)');
});
