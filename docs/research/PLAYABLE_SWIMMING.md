# Playable swimming

## Sources

- gta-reversed `CTaskSimpleSwim` (fully reversed, no plugin calls at the pinned revision): six swim states, player input mapping, resistance blending, breath/drowning, water FX (`water_ripples`, `m_Wake`, `water_swim`) and swim audio events.
- `animations/swim.ifp` from the verified archive (34,816 bytes): `Swim_Tread` (1.30 s), `Swim_Breast` (1.30 s), `SWIM_crawl` (0.90 s), `Swim_Dive_Under` (1.07 s), `Swim_Under` (1.50 s), `Swim_Glide` (1.47 s), `Swim_jumpout` (0.33 s), all with 26–32 tracks.

## Slices

1. Clip inventory (`tests/native-swim.test.ts`): every mapped clip exists in the packaged IFP.
2. Movement core (`src/simulation/nativeSwim.ts`, `tests/native-swim-core.test.ts`): six states, the 0.6 m entry rule, surface state selection, the blend ramp, resistance blending, the submerge servo and breath/drowning. Lung capacity defaults to 100 without the stat modifier; the buoyancy-ratio entry trigger is omitted.
3. State machine wiring, clips, input, FX, audio, boat exits: unfinished.
