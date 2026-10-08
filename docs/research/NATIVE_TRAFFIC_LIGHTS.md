# Native traffic-light phases

The timing implementation follows `LightForCars1`, `LightForCars2`, their visual
variants and `LightForPeds` in the pinned
[TrafficLights.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TrafficLights.cpp).
[TrafficLights.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TrafficLights.h)
defines state codes green=0, yellow=1, red=2, off=3, and direction groups
disabled=0, north/south=1, west/east=2.

Fresh downloads returned HTTP 200 and matched the inspected local sources.
SHA-256: CPP `7419b0cf5f7234be46069f4c95df9f1e751f605d04408d2485cb55886cb0933d`;
header `2a4f7f5da202e4cd751502b4013e486468b616a20110a481fb3ab97fc1cd360a`.

## Timing contract

`nativeTrafficLights` accepts an unsigned 32-bit game millisecond timer. It uses
`floor(milliseconds / 2) & 16383`, producing a 32.768-second cycle. Future runtime
callers must advance/wrap that timer with simulation time, including pause
behavior, rather than passing wall-clock timestamps or in-game day minutes.

Intervals include the start and exclude the end:

| Cycle seconds | Vehicle group 1 | Vehicle group 2 | Pedestrian logic |
|---|---|---|---|
| 0–10 | Green | Red | Red |
| 10–12 | Yellow | Red | Red |
| 12–22 | Red | Green | Red |
| 22–24 | Red | Yellow | Red |
| 24–30.766 | Red | Red | Green |
| 30.766–32.768 | Red | Red | Yellow |

Riots force both vehicle logic states green while visible lamps alternate
yellow/off every 1,024 milliseconds. The green-lights cheat forces vehicle
logic green; riot visual flashing takes precedence. Neither override changes
the pedestrian phase. Logical and visible vehicle outputs remain separate.

## Native content and workshop inspection

The all-area path audit finds 823 navigation records in signal group 1 and 866
in group 2, with 29,777 disabled and none in reserved group 3. The separate
traffic-light-direction flag is set on 1,213 records. These are navigation
records, not counts of distinct physical lamps.

**Show native paths** now includes colored signal-phase markers. Markers use
the attached path node's native position and height; they do not claim to locate
the lamp head. Same-anchor/same-group duplicates merge. **Signal cycle** samples
the normal cycle from 0 through 32.767 seconds and updates vertex colors in place.
It is a manual inspection control, not an independent game clock. Path lines
and markers intentionally remain visible through geometry for inspection.

Validation covers every transition on both sides of its boundary, odd timer
values, cycle rollover, the unsigned timer maximum, riots/cheat precedence and
pedestrian independence. Marker tests cover native height, duplicate grouping
and area exclusion. The real-folder browser case verifies rendered points,
changed canvas pixels at 12 seconds, unchanged allocations and clearing the
control on region/model reset. Inspected
`artifacts/native-grove-signal-phase2.png` shows group colors over Grove Street.

701 tests / 150 files, two browser cases and production smoke pass. Logs:
`/tmp/web-gta-traffic-light-all-unit.log`,
`/tmp/web-gta-traffic-light-final-browser.log`,
`/tmp/web-gta-traffic-light-production.log` and
`/tmp/web-gta-traffic-light-audit.log`.

## Vehicle approach rule

`nativeShouldStopForLight` implements the pinned source's
`ShouldCarStopForLight` (0x49D610). It consumes resolved navigation records and
autopilot route addresses in native XY coordinates. Invalid/unloaded links must
be omitted by the future route owner. The current, next and previous slots map
to `m_currentAddress`, `m_startingRouteNode` and `m_endingRouteNode` respectively;
their travel signs retain `_smthCurr`, `_smthNext` and `_smthPrev`.

- Helicopters and planes are excluded.
- A nonzero signal group applies when anchor/route address equality equals the
  traffic-light-direction flag. Equality includes both area and node.
- Current and next links use a strict 12-unit projected window. Previous uses
  six units and is checked only for `STATUS_PHYSICS`.
- Travel sign -1 uses positive projection; other signs use negative projection.
  Zero and the window endpoints do not stop. The decoded direction vector is
  used directly, without normalization or lateral-distance rejection.
- An applicable green link returns false immediately, before its distance check.
  A stopping current link returns true before next/previous checks. The source's
  ordering must not be replaced with an unordered `some` over red signals.
- Yellow and red both stop. The input named `ignorePhase` corresponds to the
  source's unresolved `bUnkn` parameter: it bypasses phase only. Disabled group
  zero is always skipped; reserved group three passes normally but can stop
  under this override, matching the source branches.

Nine focused tests across timing/approach files pass, including strict distance
boundaries in all three slots, both signs, area-sensitive direction flags,
unnormalized projections, ordered green short-circuits, status restrictions,
aircraft and overrides. This is a source-derived decision rule, not a measured
retail-executable equivalence claim; arithmetic currently uses JavaScript numbers.

`nativeShouldStopForPathLight` accepts autopilot navigation addresses and resolves
them against the currently loaded `PathArea` map for each decision. Route-node
addresses remain separate from navigation-link indices: a link can live in a
different area from its attached route node. The resolver does not require the
anchor's area to remain loaded, matching the source's navigation-owner check.
It skips missing/out-of-range links and the decoded packed `0xffff` sentinel
(area 63, navigation index 1023), then evaluates subsequent slots in order.
It keeps no cached navigation references across area unload/replacement.

This address layout follows
[PathFind.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PathFind.h),
and the independent slot fields follow
[AutoPilot.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/AutoPilot.h).
The local reference-archive test exercises both approach signs and green/red
decisions for all 823 group-one and 866 group-two navigation records using their
actual decoded positions, directions, flags and addresses. Probe positions are
synthetic points five projected units from each link, not observed trajectories
or lane-center estimates. Resolver tests separately cover missing owners,
replacement on reload, the packed sentinel and independent slot addresses/signs.
All 13 tests in the four focused files pass with `GTA_CONTENT_DIR` set, including
the full-archive test; production build passes. Logs:
`/tmp/web-gta-signal-route-tests.log` and `/tmp/web-gta-signal-route-build.log`.

## Remaining work

At this change, native autopilot route ownership and application of the stop
decision, physical lamp materials/coronas, flashing pedestrian visuals and runtime
spawning/driving remained separate implementation tasks. They have since landed:
traffic spawns and drives through `src/simulation/WorldTraffic.ts` with a port of
`CCarCtrl` (`src/vehicle/nativeCarCtrl.ts`) and stops for the lights through
`nativeShouldStopForLight` (`src/world/nativeSignalStop.ts`); lit lenses and
coronas follow `CTrafficLights::DisplayActualLight`
(`src/world/nativeTrafficLightCoronas.ts`); and the walk/don't-walk signs draw
as `CShinyTexts` (`src/render/NativeShinyTexts.ts`). None of this is a claim of
original-game visual parity.
