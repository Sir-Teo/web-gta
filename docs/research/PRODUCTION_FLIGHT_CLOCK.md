# Production smoke flight budgets

The smoke pilot uses visible controls and HUD text against the production
bundle, where the development inspection hook must be absent. Its speed,
altitude and gear assertions remain separate from native physics equivalence.

Two October 26 runs of the unchanged pilot failed its 45-second acceleration
or 20-second climb wall deadline. A dev trace and a separate optimized build
with only the inspection hook enabled both completed the same takeoff. The
optimized trace covered 11.47 simulated seconds in 40.14 wall seconds, without
terrain holds or subsystem faults. Requested and smoothed elevator input
reached the body: the nose rose from roughly one degree to 39 degrees, and
altitude exceeded 15 m before gear retraction. This supports a smoke-budget
repair; it does not establish every aircraft contact or flight behavior.

The application caps catch-up after slow frames (`FixedClock.advance`), so
wall time is not simulation time on a software renderer. In this saved-game
free-roam fixture, Simulation.clockRate is one game minute per simulated
second, with no clock cheats. The smoke pilot now samples the flight line and
visible HH:MM clock together, using textContent to avoid layout-dependent
innerText reads. Each sample retains wall time and game-clock minute.

Acceleration must reach 115 km/h or an existing climb above 15 m within 15
visible game-clock minutes; the climb must exceed 15 m within another ten.
The integer HUD clock gives up to one second of quantization. Midnight wraps
at 1,440 minutes. Separate 90- and 60-second wall deadlines still fail a
frozen clock, stalled page or insufficient renderer progress. The existing
100 ms decision cadence, held throttle, measured elevator release and gear
checks remain. Aircraft constants, input mappings and game code are unchanged.

The local inspection build and traces are diagnostic artifacts only. They
are not production acceptance runs; acceptance must use the normal bundle
and verify that window.__game is undefined. The final normal-bundle run passes
saved-game return, movement, car entry, map/waypoint, pause/resume, takeoff and
gear, with zero page errors or failed requests and no inspection hook. Rotation
speed takes seven game seconds / 51.99 wall seconds, directly exceeding the old
45-second limit; the climb takes two game seconds / 11.80 wall seconds. All
92 samples remain in the ignored flight-samples artifact. Native flight and
contact equivalence remain separate work.
