# SYND4 skylight and club validation

October 22, 2026. Mission 61, `SYND4` (Ice Cold Killa), uses GXT table `SYN4`.

`tests/browser/synd4-skylight.spec.ts` launches the actual mission, supplies CJ's rooftop movement and the
cutscene skip button, and enters the club through the exterior `PDOMES` ENEX. It checks the real area-3
transition and entrance stack, then moves CJ from the loaded balcony to the lower club objective. After the
club cutscene, `SYN4_05` is displayed and CJ remains grounded at height 905.3 in area 3. The mission stays active,
with no skipped commands, interpreter give-ups or page errors. The controlled opening check passes.

Earlier player-only sweeps teleported directly to the mission's interior locate coordinates at heights 921
and 905 while the world remained in area 0. CJ fell and the mission reported failure. Those probes bypassed
the required entrance transition; they do not establish an interior-streaming failure. No product change was
needed to pass the controlled skylight check.

The diagnostic sweep now routes nearby interior destinations through enabled ENEX links, respects script
control and active transitions, and calculates 3D box centers from the correct two corners. Four unit tests
cover literal operands, variable-coordinate rejection, box layouts and entrance selection. The corrected
90-second player-only probe reaches 51.9% of the mission block and the post-cutscene stage without ending,
skips, give-ups or page errors. It later waits at relative offset 5263; an NPC also falls and drowns during the
probe. This remains an incomplete heuristic run, not proof that the chase or full mission works.

The prior October 11 mission table and saved ZERO2 sweep remain intact. Ignored diagnostic outputs are
`artifacts/synd4-skylight-browser.log`, `artifacts/synd4-routed-probe.log` and
`artifacts/port/synd4-routed-player-only-90s.json`.
