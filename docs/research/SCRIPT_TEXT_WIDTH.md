# Script text width

GET_STRING_WIDTH (09FD) and GET_STRING_WIDTH_WITH_NUMBER (0A08) now return measured integer
advances from the native font data and the pending script-text style. They previously wrote a
skipped output of zero. OTB uses three queries to place adjacent control labels; POOL2 uses
the numbered query to advance a list of ball numbers separated by commas.

## Data and native contract

`scripts/content/font-tables.mjs` reproducibly generates `src/ui/nativeFontMetrics.ts` from
the PC depot's `data/fonts.dat`, locked in `scripts/content/world-sources.json`.
The input is 3,576 bytes, SHA-256
`0b6ecb4493b0261eece4b025e31aa7b55ae68ca8529c4f7064b5b3b7297c913c`.
Each of the two fonts has 208 proportional widths, a replacement-space width and a fixed
advance. The generator checks the source hash; a local input path permits offline regeneration.
CFont::LoadFontValues (`0x7187C0`) in gta-reversed confirms this file layout.

The pinned iOS handlers are `0x10020599c` and `0x100206550`. The first looks up its GXT key
and calls GetStringWidth with full-string and script-text flags enabled. The second inserts
the first number (later missing numbers are -1), updates ordinary CFont globals, and calls the
same measurement path. Both truncate the float result to a signed integer.

GetStringWidth (`0x10037d8f4`, script branch `0x10037db7c`) reads the current intro text line,
not the last displayed line: X scale at +0, proportional mode at +0x1c, signed outline byte
at +0x22 and font style at +0x28. Styles 0/1 select the two ordinary font tables; styles 2/3
select menu/pricedown subfonts from those tables. Each advance and accumulation is float32.
The ASCII path copies at most 399 characters and ignores formatting tokens. A lowercase
`~m~` token adds a control-icon advance from the ordinary CFont global scale.

FindSubFontCharacter is `0x10037b49c`. Its special punctuation, digit, letter and accent
remapping is reproduced, including the menu ampersand/underscore behavior that differs from
the PC candidate, which is marked unreversed. The decoder's accented/remapped PC GXT characters recover
their original font codes before measurement. Source identities for the executable and the
gta-reversed checkout are recorded in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md).

## Integration and limits

The adapters resolve native GXT keys, insert numbers and replace control tokens with the
browser's active keyboard/touch/pad names. The latter corresponds to the reversed PC
GetStringWidth's InsertPlayerControlKeysInString step. They measure the pending line without
claiming it. OTB's original DISPLAY_TEXT and arithmetic therefore advance the next label by
the computed width plus eight, rather than by eight alone.

Both commands remain authored. Script text now draws the PC atlas glyphs using these same
advances ([renderer and data provenance](PC_SCRIPT_FONTS.md)). The first implementation used
iOS widths; replacing them with the published PC tables corrects several letter advances.
Complete CFont global-state side effects,
native controller icons, non-PC language paths, all encoding variants and malformed text
behavior remain incomplete. An icon query requiring the unmodelled global scale, an unsupported
font style or a missing remapped glyph fails explicitly. No Canvas measureText estimate is used.

Six added unit checks cover the tables' observed advances, spacing, signed outline bytes,
four styles, punctuation/accent remapping, native text limits, formatting, input naming and all
four original instructions. The browser runs the original OTB width/display/arithmetic block,
verifies the next label moves from 60.1776 to 165.1776 at X scale 0.527, checks its exit/back
labels and touch wording, and runs POOL2's original positive/negative number query. Full OTB
and POOL2 completion remain unverified.
