# Native shooting-star streak

The implementation follows [CClouds::Render_MaybeRenderStreaks](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clouds.cpp), the transcription of 0x714387–0x714640, and the [IsExtraSunny predicate](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Enums/eWeatherType.h) at the same revision. This is a separate effect from the static constellation.

## Source contract

The streak appears only before 05:00, and both old/new weather types must be extra sunny: indices 0, 2, 6, 11, 13 and 17. The static local weather selection currently stands for both endpoints; interpolated weather transitions are not implemented.

The unsigned millisecond timer repeats its visibility window every 8,192 ms, with a streak visible for the first 800 ms. The 64-cycle index controls the horizontal offset and movement direction. The direction uses normalized `((cycle % 7 - 3) * .1, ((timer & 65535) / 8192 - 4) * .1, 1)`, with integer division in the timer term. The base direction normalizes `(cycle % 9 - 5, cycle % 10 - 5, .1)` and is placed 1,000 units from the camera. The moving head is offset by `(400 - windowTime) * 2` along the movement direction; the tail lies 50 units farther along it.

The two white vertices have alpha 225 and zero. The original draws an untextured polyline with source-alpha / inverse-source-alpha blending, with the Clouds pass's depth testing/writes disabled. The browser converts native Z-up positions into Y-up coordinates.

## Runtime and limits

`nativeStreak` calculates the two camera-relative endpoints and visibility without Three.js state. `NativeStreak` owns one line, follows camera world translation, and interpolates alpha in a raw-color shader. It borrows no native assets. WorldLighting enables it only for an imported extra-sunny timecycle selection in the exterior area. Authored lighting and other weather entries hide it.

A scene-local timer accumulates active frame time and freezes when the existing lighting advance flag is false. It continues while the effect is hidden, so changing weather does not restart a streak. The timer wraps at the unsigned 32-bit boundary. Its initial phase is not synchronized with the original game's global timer or a save file; exact timer synchronization remains unfinished.

The browser line uses far-plane depth and reads the scene depth buffer to preserve foreground occlusion in Three's transparent pass. This also keeps the distant effect visible when native fog shortens the camera far clip. This is a renderer adaptation, not proof of original clipping or line rasterization equivalence. Browser one-pixel line coverage, floating-point rounding and multisampling still need calibrated original-platform comparison.

## Validation

Unit checks cover 05:00 and 800-ms exclusion boundaries, next-cycle visibility, unsigned timer wrap, native extra-sunny entries, known normalized endpoints, 50-unit tail length, world camera translation and disposal. Local-timecycle checks verify that weather selection supplies the native predicate.

The GPU test scans the rendered line for multiple opacity levels, verifies foreground occlusion with a green plane and disappearance outside the timing window, and renders with a 20-unit far clip. WorldLighting integration checks exercise pause, weather changes, interiors, expiry, repeat and clearing native lighting. The effect is verified independently of the optional particle dictionary.

Validation results: 574 unit tests in 119 files pass with native references; the production build and smoke check pass with no external runtime requests or exposed development hooks. Nine targeted browser checks pass across shooting stars, the constellation, sky bands and low clouds, including the real public particle reference. Logs: `/tmp/web-gta-streak-{focused,unit,build,browser,regression,production}.log`.
