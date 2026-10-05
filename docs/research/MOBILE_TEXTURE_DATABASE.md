# The iOS port's texture database

The iOS and Android port keeps its textures, the touch widgets' art among them, in War Drum's texture database
(`texdb/<name>/<name>.<format>.{toc,tmb,dat}` and a `<name>.txt` of names), read by the code around `0x100130cd8` in the
arm64 slice (the `texdb/%s/%s.pvr.tmb` family of format strings). The widgets' art is the `mobile` database. Decoded
(2026-10-05) by `scripts/content/mobileTextureDatabase.mjs`, from the entry reader at `0x10012d388` and its run-length
decoder at `0x10012f3f0`:

- **`.toc`**: a `u32` (the `.dat` file's size, 8,712,314) and then one `u32` offset into `.dat` per texture (197), in
  the `.txt`'s order (its `"name" width=... height=...` lines, the category lines left out).
- **`.tmb`**: 20-byte records, the same for every format (`mobile.pvr.tmb` and `mobile.unc.tmb` are identical).
- **`.dat` entry**: `u16` id, `u16` GL pixel type (`0x8033` GL_UNSIGNED_SHORT_4_4_4_4 for 182, `0x8363`
  GL_UNSIGNED_SHORT_5_6_5 for 15), `u16` width, `u16` height with bit 15 set for a mip chain, `u32` payload size, then
  the payload.
- **Payload**: a `u32` marker, then the run-length stream. The decoder's element is not a pixel but 4 bytes for the
  16-bit types (two pixels; 8 or 16 for the compressed block types, `0x10012f758`): `[marker][count][element]` is
  `count` copies of the element, any other byte starts one element as it is. A marker of 0 stores the pixels as they
  are. The stream fills every level, largest first, until width plus height comes to 2 or less (`0x10012f568`), each
  level halved to a minimum of 1 and 2 bytes a pixel (`0x10012f5c4`). Every one of the 197 entries ends exactly at its
  payload's end. Counting single pixels, as first tried, falls short (52,180 of 65,536 for the first texture), which
  was the missing piece.

What uses it: `CTouchInterface::CreateAll` (`0x1002a6280`) loads the `mobile` database and makes each widget with a
texture named in the table the config load fills (`0x100806e28`, 128 bytes an entry, the widget's id its index) and a
place from the layout file's `WIDGET_POSITION_*` (`0x100806540`, 16 bytes each). `CWidgetButton::Draw` (`0x1002acd68`)
draws the texture over the widget's rectangle at the widget's alpha (fading to 255), white, and while held
(`CWidgetButton::Update`, `0x1002accf0`) 0x99CC99. The enter widget's class (`0x1004afd8c`) swaps its texture for the
vehicle's kind (`hud_car`, `hud_bike` for a bike or quad, `hud_bicycle`, `hud_boat` and the Vortex, `hud_chopper`,
`hud_plane`, `hud_monstertruck`, `hud_train`, `hud_trailer`, `hydraulicCar` for a car fitted with hydraulics to enter)
or `hud_drop_jetpack`. `scripts/content/touch-widgets.mjs` packs the art the touch buttons draw into
`public/play/touch/widgets.png` (see the fidelity audit's "The touch buttons are the port's widgets").
