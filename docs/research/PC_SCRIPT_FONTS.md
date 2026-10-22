# PC script-text fonts

DISPLAY_TEXT now uses the original PC font atlas masks and the same advances as the script's
width queries. Previously a substitute web typeface supplied both glyph shapes and rendering
advances, even when GET_STRING_WIDTH returned a native table width. OTB's adjacent control
labels therefore had inconsistent layout. Other HUD components still have their existing fonts.

## Reproducible assets

The files come from the same inspected PC depot as the existing world package:
`https://z.noclip.website/GrandTheftAutoSanAndreas/`. Their acquisition records are in
`scripts/content/world-sources.json`; this depot is not a certified retail release image.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| data/fonts.dat | 3,576 | 0b6ecb4493b0261eece4b025e31aa7b55ae68ca8529c4f7064b5b3b7297c913c |
| models/fonts.txd | 524,584 | 5ca77cddb15f96de29b3786cb5620492dbc310d29af2d1374e644d74f1a61cbf |

`node scripts/content/package-fonts.mjs <fonts.dat> <fonts.txd>` verifies both inputs before
publishing their raw files, gzip resources and manifest entries. The compressed resources total
32,297 bytes. `node scripts/content/font-tables.mjs` regenerates the checked-in metric tables
from the published DAT and verifies its lock. The initial iOS metric tables are replaced with
the PC widths: Gothic A, for example, advances 25 rather than 26 units at X scale one.

## Renderer and limits

The two DXT3 atlases contain white RGB pixels with glyph masks in alpha. Font2 supplies Gothic
and menu; font1 supplies subtitles and Pricedown, matching reversed CFont::SetFontStyle
(`0x719490`). Their observed cells are 32 by 40 pixels in sixteen columns, with a final
32-pixel-high row. The current renderer draws whole cells at 32 X-scale units by ten Y-scale
units (eight for the last row), then advances with float32 font-table values. The existing
subfont mapper is supported by the pinned iOS executable; complete PC mapping parity remains
unverified. Source identities and width-query contracts are in [SCRIPT_TEXT_WIDTH.md](SCRIPT_TEXT_WIDTH.md).

CFont::PrintChar (`0x718A10`) is marked unreversed in the pinned PC reference: the apparent
implementation follows a retail-call return. It does not establish exact native UVs. Cell
insets, filtering, complete wrap/justify rules and outline shape remain authored. Backgrounds
use the bounds described below, with shared HUD font state still incomplete.
Controller icons, full ProcessCurrentString state and non-PC language paths
remain incomplete. Palette/highlight color tokens are implemented as described below.
Pixel comparisons below establish correct use of the packaged masks and
current layout; they do not establish pixel-perfect retail rendering.

The renderer shares glyph selection and advances with width queries, keeps fractional pen
positions, and connects both fade passes, centering, right alignment, wrapping, backgrounds,
shadows and outlines. Four tinted atlas entries cap the color cache at 4 MiB. Game teardown
disposes the canvases; installing fonts invalidates cached frames. A web-font fallback remains
while the asynchronous atlas load is pending or unavailable. Debug state reports readiness and
load errors. Full mission completion is not inferred from font loading or focused script checks.

## Checks

Asset checks verify raw hashes, gzip round trips, raster identities and nonempty alpha masks.
Layout checks cover all four glyph mappings, fractional advances, integer width-query outputs,
fixed spacing, outline advances, wrapping and explicit line breaks.

The browser compares actual script-layer pixels against independent crops of the raw atlas for
all four styles, centering, right alignment and wrapping. It forbids browser measureText during
native draws, checks shadow/outline colors, fade routing, empty-frame clearing and disposal,
including a fallback frame followed by asynchronous font installation. The original OTB/POOL2
width instructions also pass with the active game's atlas loader ready. Full OTB/POOL2 runs
and visual comparison against a certified PC executable remain unverified.

## Palette and highlight tokens

The DOM formatter now also consumes unresolved closed numeric tokens, following
28 complete native ParseToken captures. This removes ZERO2's visible fuel-label
placeholder while retaining prior number insertion and script palettes
([evidence](HUD_NUMERIC_TOKENS.md)).

Script text retains its GXT color tags through control-name resolution. CFont::ParseToken
(`0x718F00`, reversed in the pinned PC source) selects red, green, dark blue, purple, cream,
light gray or black from CHudColours (`0x58FDA0`) while preserving the current alpha. Both
`~s~` and `~w~` select light gray; they do not restore an arbitrary initial text color.
`~h~` multiplies each current RGB channel by 1.5, saturates at 255 and truncates, and repeated
highlights compound. The native case rules are retained, including lowercase-only `~l~`.

Styled glyphs retain those colors across wrapping and explicit newlines. Tokens contribute no
advance, while backgrounds and shadows retain their own configured colors. DOM HUD messages
keep their existing plain-text path; the temporary web-font fallback now uses the same styled glyphs
and layout, with substitute glyph shapes. Controller
symbols, flashing/global string-processing state, malformed native buffer behavior and other
HUD text components remain outside this implementation.

Four additional unit checks cover palette/case rules, alpha, compounded highlights, light-gray
selection, width neutrality, newlines and input-name/control-discovery integration. Browser
pixels match independent atlas crops with native red, highlighted red and light gray at half
alpha over wrapped and explicit lines. Original OTB/POOL2 query regressions still pass.

## Literal spacing in the authored layout

Leading spaces retain their native metric advances, including after explicit newlines. Internal
runs retain each advance. Native capture later refined the initial authored wrapping correction:
automatically wrapped rows retain the entire separator, and alignment/justification use the
span rules described below. A final line ending in spaces is not emitted by the native loop.
The earlier indentation checks passed at 3,493 tests; current capture checks supersede their
initial separator/termination expectations. Full native token/language layout remains partial.

## Native string sentinels

CFont::PrintString (`0x71A700` in the reversed PC source) returns before background drawing and
layout when the first character is NUL or `*`. The pinned iOS implementation at `0x10037d05c`
confirms those tests at `0x10037d07c..0x10037d088`. The browser applies this rule before both
atlas rendering and the temporary fallback; the atlas renderer also guards direct calls.
Embedded NUL ends token/glyph parsing, matching the existing width-query string boundary.
An asterisk following a color token or a literal space is an ordinary glyph.

One added unit check covers the raw first-character rule and NUL inside ordinary text or a
malformed token. Nineteen browser assertions check visible-to-suppressed frame clearing,
background suppression, direct atlas calls, fallback behavior and embedded-NUL pixel equality.
Atlas/OTB/POOL2 regressions pass. All 3,494 unit tests pass (51 skipped), and the build passes.

## Row height and block backgrounds

Glyph cells remain twenty font-Y units tall, while CFont's row height is eighteen. The iOS
ProcessCurrentString at `0x10037d320`, specifically `0x10037d6f0..0x10037d704`, advances Y by
`2 * scaleY + (32 * scaleY) * 0.5`; the read-only float at `0x100592e28` is 32. The reference
CFont::GetHeight has the same expression. CHud::DrawScriptText halves the script Y scale before
screen stretching, so rows advance nine script-Y units, rather than the previous ten. Both
the atlas renderer and fallback now share that float32 row height. Glyph quad size is unchanged.

PC CFont::GetTextRect (`0x71A620`) supplies one background for the entire block: left-aligned
text runs from X−4 to WrapX+4; centered text uses X±(CentreSize/2+4). Top is Y−4 and bottom is
Y+4 plus row count times font height. Right-aligned text runs from RightJustifyWrap−4 to X.
The iOS PrintString/GetTextRect functions (`0x10037d05c`, `0x10037d224`) confirm the control
structure but add four pixels at that right edge; the renderer follows the PC formula.

The renderer uses initialized RightJustifyWrap=0. Native script drawing does not set that shared
global, so interactions with other HUD font users remain unmodelled. Row counts still use the
browser's partial wrapping rules; exact native layout, all viewport/DPI rounding and retail
pixel parity remain unverified. Script drawing passes false for SetBackground's enlarged-window
flag; that separate frontend frame is not added here. Disassemblies are saved as
`artifacts/native-font-{print-background,layout}.asm`.

Two added unit checks cover row height, scaled coordinates, constant padding and all three
background alignments. A browser check compares six whole-block backgrounds against independent
rectangle pixels, before and after font loading; it fails with the former per-row boxes.
Atlas comparisons now use row origins 40, 58 and 76 at script Y scale two, retaining twenty-pixel
glyph quads. All four font browser specs pass. All 3,496 unit tests pass (51 skipped), and the
build passes. Census classifications and mission completion claims are unchanged.

## Captured ASCII wrapping and justification

The shared atlas/fallback layout now follows the ordinary space-delimited branch of the pinned
iOS ProcessCurrentString (`0x10037d320`). The PC reference still delegates that function to the
retail binary, so this establishes the inspected iOS contract with PC glyph metrics, not complete
PC retail layout parity.

Automatically wrapped spans retain their trailing separator. Centered rows include it in their
width; right-aligned wrapped rows subtract one space advance. With justification enabled and
centering off, `0x10037d55c..0x10037d590` divides the remaining wrap width by the internal-space
count. The adjustment can be negative. The final ordinary row uses zero adjustment. The native
loop also omits an unfinished final span when its last character is a space, rather than emitting
that line at the terminator. This refines the earlier authored spacing correction above.

The prefix test at `0x10037d4bc..0x10037d4e0` uses bitmap `0x0800000042006809` for characters
minus 0x21. Its eight ASCII prefixes (exclamation mark, dollar sign, comma, full stop, slash,
colon, question mark and backslash) prevent an ordinary wrap before that word, even beyond
the configured bound. Other language-specific punctuation tables remain unmodelled.

[`native-font-layout.py`](../../scripts/research/native-font-layout.py) reproduces 27 captures
using Unicorn 2.1.4 and the hash-verified user-supplied executable. It executes the native layout
and GetNextSpace routines; width calls use the locked PC Gothic metrics, while RenderString is
intercepted to record spans, coordinates and signed spacing. The stack-guard indirection points
to scratch storage. No executable bytes are checked in. This isolates layout, not complete font
rendering. Metadata and expected rows are checked in as
[`native-font-layout.json`](../../tests/fixtures/native-font-layout.json).

Those 27 fixtures cover positive/negative spacing, centered/right-aligned wrapping, overlong
words, literal indentation, final-space termination, all eight prefix exceptions and an ordinary
wrapping counterexample. Browser checks compare five layouts against independent atlas crops,
including overflowing punctuation, and capture fallback glyph coordinates within 0.0001 pixels.
The atlas comparisons remain exact. Explicit newline behavior, token boundaries inside words,
non-PC languages, global font state and full viewport/DPI rounding remain partial or unverified.

All five font browser specs pass. The full suite passes 3,523 tests (51 skipped), and the build
passes. Census classifications and historical mission outcomes are unchanged.

## Connection recovery and ownership

The script-text layer now owns pending font loads and their retry timer. After the world
downloader exhausts its HTTP attempts, connection failures retry with the same bounded
2/4/8/16/30-second policy as script dictionaries. The existing fallback stays readable
until the atlas arrives; installation invalidates both cached fade passes without requiring
a changed text frame. Font diagnostics expose pending/retrying/error state. Invalid atlas
content remains an observable error without a network retry loop.

Replacing a loader or tearing down the text layer cancels its timers. A late atlas is
disposed rather than installed; cancellation before the deferred load begins prevents its
download. The installed atlas remains owned by the text layer. Five ownership/recovery
checks pass. A browser exhausts three HTTP 503 attempts, verifies readable fallback text,
then compares the recovered unchanged frame with independent native atlas pixels and verifies
teardown. The existing font pixel/fade regression and sprite recovery regression also pass.
All 3,566 unit tests pass (51 skipped), and the build passes. Census and historical mission
outcomes are unchanged.
