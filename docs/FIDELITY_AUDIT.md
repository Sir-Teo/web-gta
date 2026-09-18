# Original PC 1.0 fidelity audit

Target selected by the user on September 17, 2026: one-to-one original PC 1.0 behavior and presentation, across the entire game. No subsystem is accepted merely because its browser implementation exists or its unit tests pass.

## Reference identity

- Platform/release: original PC 1.0.
- Executable hash, region, settings, frame limiter, resolution and capture setup: **unverified**.
- Algorithm research: gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`, verified against the local checkout. Routines still calling the retail executable are not available implementations.
- Original-game input traces and matched captures: **not established by this audit**.

## Open compatibility requirements

| System | Current evidence / difference | Required acceptance evidence |
| --- | --- | --- |
| Script runtime and campaign | `ScmRuntime` executes numeric/control-flow families, ordinary and mission scheduling, mission loading, native no-ops and a first set of game-state commands, separately from gameplay. With a recording world adapter, packaged MAIN reaches mission INITIAL, which stops at CREATE_LOCKED_PROPERTY_PICKUP (mission offset 868); message queues, help text, intro text lines, switch tables, streaming requests and the radar blip table are ported, and 1,190 of 1,455 distinct MAIN.SCM commands remain unsupported. Authored mission objectives are not original campaign execution. | Original threads, variables, native commands, cleanup, cutscenes, success/failure/retry and saved script state execute correctly across the campaign and side content. |
| Physics and vehicles | Rapier contacts are approximate; `planeFlight.ts` uses authored equations, including a purported ground effect without a ground-distance input. Bike lean and boat integration retain authored behavior. | Original dynamics/task semantics and repeated multi-class acceleration, braking, cornering, impact, flight and water trials. |
| Player, camera and animation | Movement/animation pieces are implemented; native constants do not prove complete transition or collision equivalence. | Matched input/pose/contact/camera traces, including occlusion, interiors and vehicle transitions. |
| Population and police | Authored recovery, spawn decisions, clamps and roadblock placement remain. | Original task/event scheduling, population selection, pursuit and mission-exception behavior. |
| Combat | Native assets/data and selected algorithms coexist with browser task integration. | Damage, targeting, animation events, projectiles, AI decisions and all equipment compared against PC 1.0. |
| Renderer, streaming and effects | Earlier PS2-inspired choices require reassessment. Sirens/skidmarks/effect triggers include approximations. | Matched PC captures and motion; correct collision/navigation/resource lifetime across traversal and interior transitions. |
| Audio | `radioSpeech.ts` substitutes frontend-bank loops for radio and combat vocals for speech. | Original station content/scheduling, speech selection and audio entity behavior. |
| Saves, stats and progression | Selected state persists; complete native world/script state is not established. | Reload equivalence for original progress, stats, entities and script state; original save compatibility or explicitly verified semantic equivalence. |
| Complete content | Vehicle/weapon/archive counts do not establish playable coverage. | Versioned inventory of campaign, side activities, interiors, UI, customization and special vehicle systems, each with end-to-end evidence. |
| Runtime reliability | Passing units coexist with browser failures. | Reproductions resolved and regression-tested; sustained traversal, cold launch and resource-lifetime checks. |

## September 17 initial reproduction

- Baseline unit suite: 1,103 passed, 41 skipped. This is implementation regression evidence, not reference matching.
- Hangar launch failed with `No runway terrain beneath the plane`: newly installed paused terrain was absent from the world ray query's broad phase. `fixedGroundDistance` queries enabled fixed colliders directly, without stepping other entities. Regression tests cover replacement, removal, dynamic bodies, disabled geometry and sensors.
- After that fix, launch and flight assertions passed; landing gear remained down. Recruitment consumed `KeyG` before checking whether the player was in an aircraft. The recruitment context now guards input consumption.
- The flight screenshot was inspected: aircraft, terrain and HUD render. This is browser visual inspection, not a PC reference comparison.

Verification after both fixes: production build passed; both new fixed-ground regression tests passed; all four aircraft browser tests passed (launch/takeoff/gear/pause, all 17 aircraft asset lifetimes, landing/exit, wheel rendering). Other browser test files were not rerun in this pass.

## Player input and swimming corrections

- Reproduced a dry-land jump failure through the production game entry screen: the swim task unconditionally cleared `controls.jump`. It now preserves the command outside swimming. The new browser check passes, and existing heavy-weapon/aiming jump restrictions still pass. Inspected the airborne screenshot.
- Corrected the grounded swim timeout from seconds to native time units using `CPed::ProcessBuoyancy` and `CTaskSimpleSwim::ProcessPed`.
- Replaced constant swim breath consumption with the source association-dependent formula. Corrected capacity overshoot and integer drowning-event damage in `CPlayerPed::HandlePlayerBreath`.
- Fourteen focused swim tests and the production build passed. The complete unit suite then passed 1,108 tests with 41 skipped; three targeted browser tests passed (dry-land jumping, weapon movement restrictions, boat boarding/driving/shore exit). Full original animation association scheduling, lung stats and player breath lifecycle remain open; see [swimming evidence](research/PLAYABLE_SWIMMING.md).

The full objective remains open. The [blueprint](FIDELITY_BLUEPRINT.md) defines comparison gates; the [gap checklist](GAPS_CHECKLIST.md) retains historical implementation detail with outstanding work restored.

## Breath ownership and vehicle drowning

- Added the source `m_bRequireHandleBreath` lifecycle. Breath now recovers after swimming ends and during ordinary vehicle travel, without double recovery while a swim/drowning callback owns it.
- Connected car and aircraft drowning states to driver breath handling; connected the boat's source inverted/slow/submerged branch separately. Original-asset browser tests verify drain, armour bypass and recovery, plus upright/inverted boat differences.
- Extended the existing death timer to occupied-vehicle frames and clear seat ownership before reset. Reset restores on-foot collision and breath ownership. Unit tests verify the delay, callback and reset state; the browser tests do not establish a retail-equivalent death sequence.
- Verification: 1,112 unit tests passed, 41 skipped; seven targeted browser tests passed (aircraft, boats and vehicle breath); production build passed. Inspected the flight screenshot from this run.
- Still open: native lung-capacity stats, bike/NPC/passenger drowning, pedestrian head-submersion outside the swim task, damage-event semantics and full vehicle buoyancy parity. These changes do not establish full swimming or survival equivalence.

## Damage and vehicle-death events

- Corrected occupied vehicle destruction: the native event sets health to zero directly; the browser previously reduced/absorbed it as ordinary damage. All four vehicle adapters now bypass armour and stat scaling for this event.
- Corrected the ordinary fatal-hit threshold to below one HP and stopped subsequent hits from restarting the death timer.
- The global 0.4 player multiplier is now explicitly marked unverified: the consuming stat routine is unreversed in the pinned source. See [damage evidence and outstanding branches](research/PLAYER_DAMAGE.md).
- Verification: production build passed; full unit suite 1,114 passed and 41 skipped; three targeted browser tests passed for vehicle death and breath. Earlier in this pass, the three existing vehicle-life browser tests also passed.

## SCM execution foundation

Added single-instruction decoding and `ScmThread` for numeric storage, arithmetic, conditional control flow, subroutines and waits. The original MAIN bytecode executes its name instruction and stops explicitly on DO_FADE at 55987. This component is not connected to gameplay and does not establish campaign compatibility. [Source semantics, tested scope and next missing systems](research/SCM_RUNTIME.md).

Verification: production build passed; 1,121 unit tests passed, 41 skipped, including existing full mission decoding and the new execution-core tests. No rendering behavior was changed in this step.

## Ordinary SCM thread scheduling

Added START_NEW_SCRIPT numeric argument copying, original active/idle list ordering, the 96-slot pool, ordinary-thread TIMERA/TIMERB updates while sleeping, and termination/slot reset. Source-ordered tests verify that new children wait for the next pass while existing threads continue. The runtime remains separate from gameplay and original MAIN still stops at DO_FADE. Mission-shared state, native handlers and cleanup are not complete.

Verification: 1,125 unit tests passed, 41 skipped; production build passed. Four new scheduler tests cover ordering, argument bits, sleeping timers, overflow, pool reuse and invalid starts. No rendering behavior changed; browser tests were not rerun for this step.

## Expanded execution and character replacement

- Added numeric array addressing, remaining basic variable arithmetic, timed arithmetic, copies, conversions and absolute values. Added the ordinary DO_FADE adapter and source visual fade state; the next original MAIN boundary is SET_TOTAL_NUMBER_OF_MISSIONS. These runtime components remain separate from gameplay, and audio/mission fade behavior remains open.
- Broad browser testing reproduced repeated animation-binding exceptions after replacing CJ with a workshop rig. Automatic packaged swim installation now checks coordinate convention and skeleton compatibility once per character instance. Custom assignments remain available. The three character browser tests pass, including an added no-page-errors assertion for repeated live replacement; inspected the diagnostic-rig screenshot.
- The pinned `CVehicle::FlyingControl` directly invokes retail address 0x6D85F0 and contains only an unfinished fragment below it. It cannot supply a full flight port; the current authored flight model remains a gap requiring further reverse engineering or reference evidence.
- `CStats::GetFatAndMuscleModifier` likewise delegates to retail address 0x559AF0. Native lung capacity depends on that routine; the current capacity of 100 remains an approximation rather than a verified PC 1.0 value.
- Corrected browser checks that had become stale: mute checks measure audible output rather than the shared weapon/speech voice pool; workshop metadata selects its named panel; the imported LOD fixture straddles current camera distances. Shadow recovery now targets the continuous world's actual entry button and no longer claims that the retired Verdant Meadows URL loads a separate scene.
- Added short/long text storage and arrays, text assignments/comparisons, true/false condition commands, and script random commands consuming an explicitly shared PC CRT stream. These additions do not change the original MAIN boundary or establish whole-engine RNG equivalence.

Browser verification: the broad sweep passed 141 tests and skipped 42, with seven failures. Retesting the corrected checks passed six unique tests, including the imported scene's complete timed-visibility and collision flow. One duplicate shadow test for a retired alternate scene was removed; it did not exercise that scene because the URL now opens Grove Street. In total, all 147 enabled unique browser tests passed across the sweep and targeted reruns; there was no second full-suite run. Inspected the recovered Grove Street shadow screenshot and diagnostic character screenshot. Skipped content tests remain unverified, and none of these runs establishes retail reference equivalence.

Final verification for this batch: 1,167 unit tests passed, 41 skipped; production build passed with existing bundling warnings; diff whitespace checks passed.

## SCM mission loading and game-state commands

- Reproduced the native ScriptSpace layout (200,000 + 69,000 bytes), mission-block loading from the MultiScriptArray, shared mission locals with once-per-frame mission timers, the fail-mission countdown and wrapper reset, the death/arrest check with its on-mission flag, LAUNCH_MISSION and name-based termination. `ShutdownThisScript` and mission cleanup remain unreversed; releasing the mission-running flag on retirement is reconstructed from that routine's purpose, not from source.
- Added the 242 PC 1.0 native no-op commands verbatim from the pinned checkout, and script-visible state for stats, clock, maximum wanted level, forced weather, fade colour, zone-name display and language, with the corresponding commands. Twelve of the new handlers follow engine routines or documented statics because their command dispatch is still unreversed; they are marked in source and in [the runtime notes](research/SCM_RUNTIME.md).
- The original MAIN now executes its whole prologue against a recording adapter, launches mission INITIAL into the mission block, and stops at that mission's first property-pickup command. Coverage over the packaged file: 196 of 1,455 distinct commands, 241,057 of 360,439 instruction sites. Entity, task, blip, text, audio and streaming commands are the outstanding families; the runtime is still not connected to the live simulation, because a partially executed prologue would leave the screen faded out.
- Verification: production build passed with the existing bundling warnings; 1,182 unit tests passed, 41 skipped, including nine new mission tests and six new game-state tests. Browser tests were not rerun; no rendering behaviour changed.

## SCM messages, switch tables and streaming requests

- Ported the CMessages brief, big-message and previous-brief queues, the CHud help-message state and the 96 intro text lines with their native defaults, keyed by GXT label because no text file is in the content depot. The pinned transcription of `CMessages::Process` shifts the queue the wrong way after an expiry; the original close-up behaviour is reproduced and noted.
- Implemented SWITCH_START/SWITCH_CONTINUED through the reversed jump-table helpers (the dispatch itself is unreversed) and verified against all 592 switches in the packaged file: sorted cases, chained continuation blocks and a non-zero default address in every one. Added the constant-operand compare family and adapter-routed model requests, model-loaded checks, release and fade status.
- Ported the 175-entry CRadar blip table with its handle counters and attribute routines; the blip command dispatch is unreversed, so the display defaults of the add commands are documented as conventional rather than verified. Sequence tasks remain open because the pinned checkout only stubs them.
- Coverage over the packaged file is now 265 of 1,455 distinct commands and 264,773 of 360,439 instruction sites. Entity, task, camera, pickup and mission-audio commands remain the open families, and the runtime is still not connected to the live simulation.
- Verification: production build passed with the existing bundling warnings; 1,199 unit tests passed, 41 skipped, including nine message tests, five switch/compare tests and three blip tests. Browser tests were not rerun; no rendering behaviour changed.

## Upstream search for the remaining blockers

The user asked for the blocked routines to be unblocked from related project
code. `gta-reversed-modern` was cloned and compared function by function
against the pinned checkout: both contain 8,304 reversed functions and differ
in five `CSprite` helpers only, so the pinned revision is already current.
`CVehicle::FlyingControl`, `CStats::GetFatAndMuscleModifier`,
`CPickups::GenerateNewOne`, `CPedDamageResponseCalculator::AccountForPedDamageStats`,
`CRunningScript::ShutdownThisScript` and `CTaskSequences::GetAvailableSlot` are
retail stubs in both. A search of GitHub code, issues and pull requests and of
the modding forums found no published reversal of the flight model; the
gta-reversed author's own partial stops at an unidentified branch. The depot
holds data files only and no executable, so the flight model, bike and quad
control, plane and heli control, trains, gunplay, melee, projectiles and
weather stay authored until someone reverses them upstream.

What the same survey did establish is that `CAutomobile::ProcessControl`,
`CCollision::ProcessColModels`, the `CPhysical` force and collision routines,
`CBoat::ProcessControl`, `CPickup::Update`, `CPopulation::AddPed`,
`CWanted::Update` and `CGameLogic::Update` are all fully reversed and
available. Vehicle, boat, population and wanted work already draws on them.
`CGameLogic::Update` did not, and is ported in this pass.

## Native wasted and busted respawn

- Replaced the authored death recovery with the reversed `CGameLogic::Update`
  sequence over the `CRestart` tables: the three and four second holds, the
  one-shot fade to black, the wait for that fade, the hospital and
  wanted-level fees, the twelve hour clock advance and the nearest hospital or
  police restart point. The eight hospital and seven police points come from
  the packaged script through a new extractor. See
  [the damage and respawn notes](research/PLAYER_DAMAGE.md).
- The previous behaviour charged a flat 100 for both outcomes, respawned at
  the current spawn point, advanced no clock and used a four second timer.
- Verification: production build passed; 1,210 unit tests passed and 41
  skipped, including eleven new restart and game-logic tests. The random range
  helper the script runtime used inline is now shared with the busted voice
  pick, and its existing tests still pass. Five browser tests passed: a new one
  confirming the live world extracts all fifteen restart points and starts in
  the playing state with no page errors, plus the existing fade, progression
  and two wanted checks, which cover the rewired arrest path.
- Not evidence of retail equivalence: no reference capture of the wasted or
  busted sequence was compared, so the timings and fees are source-matched
  rather than trace-matched.

## Native damage and death reactions

- Pedestrians hit by weapons now choose their reaction clip through the
  reversed `CEventDamage::ComputeDeathAnim` and `ComputeDamageAnim`, with
  `CPed::GetLocalDirection`. The weapon id and hit point come from the weapon
  system. Before, every gun hit and death used one flinch and one knockdown.
- Body part comes from hit height and side, because the retail hit-sphere
  table the game uses is not published. `ComputeWillForceDeath`, the
  fat-and-muscle knockback modifier and task abort results are still retail
  stubs upstream and take neutral values.
- Verification: unit tests over the reaction choice and a browser test that
  shoots three live pedestrians and checks the chest flinch, the shotgun death
  and the running partial shot.

## Street props: smashing, destruction and break pieces

- Cars used to stop dead on bins, bags, boxes and lampposts because every
  OBJECT.DAT prop was a fixed collider. The static-object branch of
  `CPhysical::ApplyCollision` and `CObject::ObjectDamage` are now ported:
  props lose health, smash, break or uproot, and the car keeps the native
  share of its momentum. Uprooted props become dynamic bodies with their
  OBJECT.DAT mass, launched by the general two-body collision response.
  Destruction sounds, causes-explosion props and OBJECT.DAT effects follow the
  same routines. Breakable props such as lampposts throw their
  breakable-plugin pieces through a port of `BreakObject_c`.
- An uprooted prop's later motion is Rapier's. Damaged-model swaps, hydrant
  jets and parking-meter money are not reproduced. See
  [the object data notes](research/OBJECT_DATA.md).
- Verification: 1,287 unit tests passed, including the damage, impact,
  two-body, effect, sound, plugin reader and piece simulation cases. Browser
  drives through three Grove Street props and into a fire hydrant pass. The
  full browser suite passed apart from four tests that failed while files were
  being edited mid-run; all four pass when rerun. The start scene package was
  rebuilt to carry the breakable plugin.

## Cars striking pedestrians

- Pedestrians took no damage from cars, and their kinematic bodies stopped
  cars like walls. Impacts now follow the ped branch of
  `CPhysical::ApplyCollision`, where the car counts ten times its mass, and
  the reversed `CTaskSimpleKillPedWithCar::ProcessPed`: run-overs, bonnet
  throws, 1000 damage with the native death animation, the push back on the
  car and the crunch sound.
- `CPed::KillPedWithCar` is a retail stub, so the kill gate (impact intensity
  12) is authored, and non-lethal hits keep the old knockdown. See
  [the combat notes](research/COMBAT_AND_POPULATION.md).
- Verification: 1,297 unit tests passed, and a browser test runs down a
  civilian at 12 m/s. Traffic, weapons, damage reaction, passenger, combat,
  prop and navigation browser tests passed; the recruitment test failed once
  and passed on rerun.

## Melee: left click, combo swings and hit reactions

- A left click never attacked unless aiming, because the left button also
  drags the camera. A short click now attacks, as SA's left button does.
- Swings play each combo stage's native clip and the ground attack on downed
  peds; combos chain at melee.dat hit and chain frames instead of an authored
  interval that made chaining impossible. Frontal combo hits play the native
  HitA reactions through the ported damage animation choice, and only the
  third hit floors the victim.
- Most of `CTaskSimpleFight` is a retail stub, so the fall on the third move
  is assumed. See [the combat notes](research/COMBAT_AND_POPULATION.md).
