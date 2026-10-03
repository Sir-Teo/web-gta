# The iOS port's texture database (unfinished)

The iOS and Android port keeps its textures, the touch widgets' art among them, in War Drum's texture database
(`texdb/<name>/<name>.<format>.{toc,tmb,dat}` and a `<name>.txt` of names), read by the code around `0x100130cd8` in the
arm64 slice (the `texdb/%s/%s.pvr.tmb` family of format strings). The widgets' art is the `mobile` database. What is
established, from `mobile.pvr.*` of the `gta3sa.app` bundle:

- **`.toc`**: a `u32` (the `.dat` file's size, 8,712,314) and then one `u32` offset into `.dat` per texture (197).
- **`.tmb`**: 20-byte records, the same for every format (`mobile.pvr.tmb` and `mobile.unc.tmb` are identical).
- **`.dat` entry**: `u16` id, two flag bytes (`33 80` for most, `63 83` for 15), `u16` width, `u16` height with bit 15 set,
  `u32` payload size, then the payload. Most are 256 x 256; the rest 512, 128, 64, 32 and one 4.
- **Payload**: 16-bit RGBA4444 pixels (grey with alpha, `0x222c`, `0x888e`) in a run-length code whose marker byte is
  the payload's first byte (`11`, `10`, `06`...), chosen per texture. A run reads `marker count value value`; plain
  pixels are their two bytes. Counted that way the pixels fall short of width x height (52,180 against 65,536 for
  the first texture; 3,724 against 4,096 for a 64 x 64), so a token or the count's meaning is still missing. It is not
  zlib, raw deflate, LZMA, bzip2 or LZ4.

Next: the decoder, from the `.dat` reader that follows the `.toc` load (`%s.toc` at `0x1005408e7`), rather than more
fitting of counts.
