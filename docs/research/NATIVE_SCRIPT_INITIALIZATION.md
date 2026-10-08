# Original script initialization data

The browser imports a bounded new-game zone profile from the original `MAIN.SCM` (`src/assets/scmZonePopulation.ts`). This document covers that data extraction. The script itself now runs as well: the SCM runtime (`src/engine/ScmRuntime.ts`) executes MAIN, its missions and the streamed scripts, including the zone commands (`INIT_ZONE_POPULATION_SETTINGS` and `SET_ZONE_POPULATION_TYPE` in `src/engine/ScmGameCommands.ts`); see the [porting pipeline](../port/README.md).

## Reproducible sources

- [Original MAIN.SCM](https://z.noclip.website/GrandTheftAutoSanAndreas/data/script/main.scm): 3,079,744 bytes, SHA-256 `c06162725bbc5429f7a871a29633ae5faa5b1f6a23ddbaa42c8d2fed70021b3e`. Included in the static acquisition lock and manifest as `scripts/main.scm`.
- [SCM chunk definitions](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Scripts/SCMChunks.hpp) and [parameter decoding](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Scripts/RunningScript.cpp).
- [Zone commands](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Scripts/Commands/ZoneCommands.cpp) and [zone defaults](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/ZoneInfo.h).
- [Pinned Sanny Builder opcode schema](https://github.com/sannybuilder/library/blob/d595b7e0e8e95fbb0e26b3ae0b4ac4a034dd7603/sa/sa.json), SHA-256 `141e23c803ad3fa48ac45830e49e7e5cf1d18bffcfc08130e57e10d277fd6ad3`. The generated module retains command IDs, names and operand modes only.

## Decoding evidence

Six linked headers identify 43,800 global bytes, 389 object slots, 135 mission sections and 79 external streamed scripts. Entry is byte 55,976; main code ends at 194,125. All 16,587 main instructions and 343,852 mission instructions decode to exact section boundaries. Streamed-script offsets describe external payloads and may start at or beyond MAIN.SCM EOF.

Typed scalar, variable, array and string operands preserve their kinds. Variable arguments end with type zero. SAVE_STRING_TO_DEBUG_FILE instead contains an untyped 128-byte payload; interpreting it as typed operands desynchronizes decoding. Truncated regions, unsupported parameter types, unknown opcodes and malformed header chains fail explicitly.

## Imported profile

The inspected main entry launches mission zero at byte 56,361; mission zero is named INITIAL. Its INIT_ZONE_POPULATION_SETTINGS at 234,130 starts a contiguous assignment block ending at 240,464. It contains 340 population-type, 72 gang-strength, 37 dealer-strength, 26 race-mask and one no-cops assignments. The importer identifies this block structurally; it does not evaluate the earlier mission branches.

Native defaults are population type 5, ten zero gang strengths, zero dealer strength, race mask 15 and no-cops false. Assignments use exact normalized info labels and shared zone-info indices. Every source label resolves, including VERO2, whose ZON label has trailing whitespace. Unknown labels are retained as diagnostics and ignored without a guessed replacement.

Grove Street GAN1 receives population type 7, San Fierro WESTP2 type 4, and Meadows MEAD retains default 5. The world worker attaches the profile to the continuous map; the fleet tracks the player's current population type. This import alone did not enable ambient traffic or reproduce loaded-model population scheduling; ambient traffic now runs separately (`src/simulation/WorldTraffic.ts`).

## Verification

Tests decode every mission section, assert source assignment counts and representative zone results, exercise missing-label diagnostics and malformed bytecode, and check the live browser's Grove population type alongside driving and map navigation.
