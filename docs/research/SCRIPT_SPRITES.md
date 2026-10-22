# Script texture dictionaries and sprites

ScriptTextLayer previously skipped textured rectangles. OTB ran its text and input logic but
displayed no betting-shop background, buttons or horse icons. Both textured rectangle types now
draw their bound PC textures, interleaved with plain boxes in the script's order and routed
through the existing before/after-fade passes.

## Source contract

The pinned PC DrawCommands.cpp handlers load a dictionary into CTxdStore's `script` slot.
LOAD_SPRITE lowercases at most fifteen name characters and calls CSprite2d::SetTexture for
its one-based slot. SetTexture (`0x727270`) deletes the previous texture, then obtains a new
RwTexture reference. Already loaded sprite slots retain their bound dictionary when the
current dictionary changes. The browser records dictionary/name per slot accordingly.

CTheScripts::RemoveScriptTextureDictionary (`0x465A40`) first deletes every ScriptSprites
entry, then removes the dictionary. Explicit removal now clears both names and texture
bindings. The LOAD_TEXTURE_DICTIONARY handler registers its global dictionary with mission
cleanup; the browser's partial cleanup model releases it when a mission owning that entry ends.

CTheScripts::DrawScriptSpritesAndRectangles (`0x464980`) supplies draw order and geometry.
TEXTURED uses the rectangle's corners. MONOCOLOR_ANGLED is also textured: the native function
rotates its four corners about their midpoint. Screen stretching precedes that rotation;
the renderer follows that order, including on nonsquare viewports. Negative dimensions mirror
the image. RGB multiplies the source channels, and color alpha multiplies texture alpha.

Source identities are in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md). This is a Canvas
backend using native data and the cited geometry/state rules, not complete RenderWare parity.

## Published assets

All twenty-one dictionary names used by main.scm and its decoded streamed scripts were acquired from the same inspected PC depot
as the world and fonts: `https://z.noclip.website/GrandTheftAutoSanAndreas/models/txd/`.
LD_SHTR and LD_GRAV use lowercase filenames there; the other acquired names use uppercase.
The depot is not a certified retail release image.

The 399 textures include betting shops, pool, arcade games, dance arrows, race maps and
driving-school artwork, casino cards, tattoo previews and the plane menu. The files total
3,903,024 bytes raw and 1,263,471 bytes compressed.
Each size, URL and SHA-256 is locked in `scripts/content/world-sources.json`.
`scripts/content/package-script-sprites.mjs` validates every input before publishing raw files,
gzip resources and manifest entries. All rasters decode through the existing PC TXD reader.

## Browser integration and limits

Dictionary downloads are lazy and asynchronous. A revision redraws an unchanged cached frame
when its texture arrives. Replaced/removed bindings invalidate pending requests; an old request
cannot overwrite a new generation or resurrect deleted slots. Decoded images and canvases are
released when no bound slot needs them, and teardown ignores outstanding loads. Eight tinted
images bound the additional color cache. Debug state exposes readiness, pending/loaded
dictionaries, decoded textures, tint count and errors through `nativeScriptSprites`.

Point/linear sampling follows the base-level texture filter; native mip selection, texture
addressing outside the ordinary full-image UV range, all pixel/DPI rounding, complete TXD/ref
ownership and native synchronous streaming remain partial. Download/missing-texture errors are
observable; the command thread does not block for the browser's asset download.
TITLE_AND_MESSAGE remains outside this change.

## Checks

Three state checks cover original dictionary commands, slot ownership across switches, explicit
removal and mission cleanup. Four cache/tint checks cover shared loads, name normalization,
late generations, disposal, missing resources and RGB/alpha modulation. An asset check verifies
all twenty-one hashes, gzip round trips and 399 raster decodes.

The browser compares seven images against independent native-texture pixels: asynchronous
arrival, RGB/alpha tint, interleaved boxes, rotation after stretching, mirroring and both fade
passes. It checks the tint-cache bound, removal and disposal. A full OTB script opening renders
the native UI, selects a horse with Shift, backs out of the amount screen and exits with F.
Money stays unchanged; textures are cleared, with no skipped commands, script failures or page
errors. Screenshots are `artifacts/otb-native-{sprites,bet-amount}.png`.

A funded OTB regression uses actual Shift/WASD controls to select a horse, stake five dollars,
start the race, wait for its result and continue to script exit. It checks the deduction,
script-dependent win/loss return, gambling-stat changes and dictionary cleanup. The observed
capture won ten dollars: test balance 500 → 495 → 510. The regression accepts either native
outcome; it does not force a winner. All 57 race textures load with no skipped commands,
script failures or page errors. Screenshots are `artifacts/otb-native-race{,-result}.png`, and
logs are `artifacts/otb-native-race-{probe-final,regression}.log`. This establishes one complete
OTB bet/race/exit flow, not full minigame or campaign compatibility.

The first texture instructions from SLOT_MACHINE, ROULETTE, VIDPOK, BLACKJ, PLANES and TATTOO
also resolve and match independent raw-texture pixels. TATTOO's global string-array operand is
supplied one real preview name. These focused commands do not establish complete play-throughs
of those streamed games/shops. Seven sprite/font browser specs and both OTB flows pass.

All 3,531 unit tests pass (51 skipped), and the build passes. Historical mission sweep results
are preserved; rendering coverage does not imply campaign completion.

## DRAW_WINDOW headers

The script rectangle renderer now resolves nonempty window header keys and draws the title
immediately after that window's backing rectangle. This follows the reversed PC
`CMenuManager::DrawWindow` at `0x573EE0`: Gothic font, light gray (225) text, black
two-pixel edge, scale (1, 1.4), left + 10 and min(top, bottom) − 16, with the right
edge as wrap boundary. The script renderer uses twice the native Y scale. Empty/DUMMY
headers retain only their backing. Header resolution participates in cached-frame invalidation
and in the rectangle's before/after-fade pass.

There are twenty non-DUMMY sites in the inspected main and streamed scripts. A browser
regression executes the original RACES mission 35 instruction at offset 1048549 with its
literal bounds and RACES_0 key. Six independent atlas comparisons cover heading pixels, a
changed translation under the same key, following-rectangle occlusion, fade passes, DUMMY
and inverted vertical bounds. The fallback heading and asynchronous font arrival are checked
as well. The test supplies a short translation to isolate font geometry; it does not complete
the race-menu mission. Shared frontend font globals (including inherited proportional state),
full retail layout and other frontend message styles remain partial. All 3,531 unit tests
pass (51 skipped), and the build passes.

## Connection recovery

A bound dictionary whose request exhausts the world downloader's own HTTP retries now retries
without another script LOAD or binding change. Connection failures use delays of 2, 4, 8, 16
and then at most 30 seconds; this is a browser recovery policy, not a native streaming timing
claim. Missing/corrupt assets remain visible errors without an automatic network loop. The
retry retains its dictionary generation and increments the rendering revision on recovery,
so an unchanged cached frame redraws. Removal and disposal cancel timers; late results cannot
revive an old generation. A failed archive-open promise is released before a fresh attempt.

Five recovery checks cover unchanged bindings, backoff, removal/disposal, format errors,
late results and a fresh source after an open failure. A browser serves three HTTP 503 responses
(the lower-level downloader's full attempt set), then allows recovery. The fourth request
loads the real TXD and the unchanged frame matches independent texture pixels. The existing
sprite pixel/order/fade regression also passes. All 3,561 unit tests pass (51 skipped), and
the build passes. Census and historical sweep results are unchanged.
