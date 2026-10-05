# Porting pipeline

The game already runs the original `main.scm`: every one of its 1,455 commands dispatches. What is left is
making each command *behave* like the original, and building the engine systems those commands reach. This
pipeline takes stock of all of it at once, runs the missions headless, and ranks what to port next. It is how the
rest of the game is ported without waiting for a bug report per mission.

```sh
npm run port -- census                 # static census: docs/port/CENSUS.md, census.json   (~3 s)
npm run port -- sweep 2,11,12          # headless mission sweep: artifacts/port/sweep.json (minutes per mission)
npm run port -- sweep story --seconds 600   # every mission (hours)
npm run port -- report                 # docs/port/STATUS.md from both
npm run port -- all 2,11               # all three
```

## Stage 1: census (`scripts/port/census.mjs`)

It decodes every instruction of MAIN, the 135 mission blocks and the 78 streamed scripts of `script.img` (the shops,
gyms, machines and casino games, listed right after MAIN) with the game's own decoder (loaded from `src/`
through Vite, so it can never disagree with what the game runs) and classifies each command two ways.

**How the port answers it**, read from the source:

| Status | Meaning |
|---|---|
| `core`, `nop` | the interpreter's own commands and the 242 PC no-ops |
| `faithful` | dispatches, and nothing in its handler or its `ScmMission` adapter says otherwise |
| `authored` | the handler's or adapter's comments say it is an authored stand-in (`AUTHORED`, "stands in for", "approximation", "the browser has no …") |
| `silent` | it calls an optional host member that no layer implements, so it does nothing |
| `skipped` | a required `ScmWorldCommands` member is missing: the game skips the command (its output variables read as nothing found, -1 for a handle and 0 for a number, a condition as false) and the mission runs on without it. The outputs come from `src/engine/scmCommandSignatures.ts`, generated from the Sanny Builder library by `node scripts/port/signatures.mjs` |
| `stops` | the command has no handler at all, so the thread gives up there (the streamed scripts still use a few) |

**What the reference offers**, from a gta-reversed checkout (`source/game_sa/Scripts/Commands/*.cpp`):
`handler` (reversed, with the function's file and line, and whether its body still calls into the executable),
`handler-disabled` (written, registration commented out), `nop`, `unimplemented`, or `absent`. The Sanny Builder
library (fetched once from raw.githubusercontent.com into `scripts/port/.cache`) adds each command's description.

The **work queue** in `CENSUS.md` lists every `authored`, `silent`, `skipped` and `stops` command, earliest launch first, then
by instruction sites. A row marked *portable* has a reversed handler to translate.

The census reads source, not behaviour: `faithful` is a claim to check in play, not a proof.

## Stage 2: sweep (`tests/browser/mission-sweep.spec.ts`)

A Playwright spec, skipped unless `SWEEP` is set. It boots the game, ends the opening, and launches each mission as
MAIN would (`LOAD_AND_LAUNCH_MISSION_INTERNAL`) from free roam. An autopilot stands in for the player where a static
reading allows: while the mission thread waits in a loop, CJ (and the characters the same condition group tests,
with the bike or car they ride) is put at the literal coordinates of the locate or area tests round the wait,
rotating through the candidates every fifteen seconds while the thread stays put; a loop waiting for CJ in a car or bike it names puts him in it; CJ is kept alive and unwanted.
It records, per mission: how far into its block the thread was seen, whether it ended, any command the port gave up
on, page errors, and the loop it was left waiting in.

The autopilot cannot drive a chase, win a fight or pick a menu item, so a mission it cannot finish is reported with
where it waited. `SWEEP_PLAYER_ONLY=1` moves CJ alone and leaves the mission's own characters to get where the
script sends them, as they must for a player; a mission that then waits on a homie or a chase car shows where an NPC
task is not doing its part. Each result also lists the commands the game skipped in that mission. The headless renderer runs the game several times slower than real time; give each mission
minutes, not seconds.

## Stage 3: report (`scripts/port/pipeline.mjs report`)

`STATUS.md` joins the two: per mission the census counts and the sweep's result, then the next commands to port.

## Can the whole game be ported in one go?

Not by a mechanical translation, and it is worth being plain about why:

- **There is no complete source to translate.** gta-reversed, the reference this project ports from, is a
  reverse-engineering in progress: many engine routines and 715 script commands are still `plugin::Call` into the
  retail executable or registered as unimplemented. Those behaviours exist only as x86 machine code, and an
  automatic x86-to-TypeScript translation of a whole game engine (with its D3D9 renderer, streaming and audio
  hardware paths) is not something any tool does reliably.
- **Some data is not in the published depot.** Cutscenes (`anim/cuts.img`), music and cutscene streams
  (`AUDIO/STREAMS`) are absent, and the hosts the content scripts use are not reachable from every environment. No
  code port brings those back. Mission dialogue (`AUDIO/SFX/SCRIPT`) is taken from the iOS port's bundle instead
  (`SCRIPT.osw`, packaged by `scripts/content/package-script-speech.mjs`), which also holds the cutscene archive and
  the stream packs.
- **Compiling the reference to WebAssembly** does not work either: gta-reversed is a DLL that hooks into the retail
  executable and cannot run without it.

What does scale is this pipeline: the census shows every gap at once, the reference column says which ones have a
reversed function to translate, and the sweep shows which ones actually stop a mission. Each queue item is small,
self-contained and testable, which makes it suitable for fanning out to parallel agents (one command family per
agent, each with its spec), then re-running the census and sweep to confirm.
