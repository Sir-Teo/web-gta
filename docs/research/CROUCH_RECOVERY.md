# Grove crouch recovery investigation

The post-context-recovery Grove test intermittently failed while waiting for a native character shadow to return after the second C press. Eight repeats of the original test at `acfadc7` produced two failures and six passes (`/tmp/web-gta-crouch-repro.log`).

The captured failure state had `paused: false`, `player.crouched: true`, `player.grounded: true`, health 100, and a hidden native character. The shadow had intensity zero, zero vertices and `error: null`. Thus the final missing shadow is consistent with an unsupported crouched pose; the failure did not establish a shadow-rendering exception. Ground contact in the final snapshot does not prove ground contact at the instant the stand key was consumed.

`Simulation.toggleCrouch` rejects changes while airborne, in a vehicle, during a transfer or after death/impact. `setCrouched(false)` separately rejects an intersecting standing capsule. The original browser test checked only character/shadow visibility between key presses, so it did not distinguish an accepted crouch from a temporarily hidden airborne character, or prove standing was requested under valid ground-contact conditions.

Extra observation calls altered timing: four runs with explicit snapshots and eight runs with snapshots in existing polls all passed. That is evidence of timing sensitivity, not proof of a cause. Those runs are recorded in `/tmp/web-gta-crouch-stages.log` and `/tmp/web-gta-crouch-inline-stages.log`.

The revised test requires ground contact before crouching, verifies crouch acceptance, waits for a grounded crouched stance with a hidden shadow, then verifies standing acceptance separately from shadow restoration. It still uses ordinary key input and the original visibility expectations. No runtime stance or collision rule changed, and no arbitrary sleep was added. Failure capture now includes the pre-stand stance and final game state in `/tmp/web-gta-grove-stand-failure.json`.

Eight revised runs pass (`/tmp/web-gta-crouch-ready.log`) and build passes (`/tmp/web-gta-crouch-ready-build.log`). This strengthens the lifecycle test and separates simulation from rendering failures. The exact cause of the original rejected/missed stand request remains unproven; a future reproduction should capture the state at input consumption and the standing-clearance result before changing gameplay rules.

## Body/collider synchronization follow-up

A subsequent save/reset audit found a concrete stale-pose mechanism. In the installed Rapier runtime, calling `RigidBody.setTranslation` immediately changes the body but leaves `Collider.translation()` at its previous world pose until physics propagates it. The game's character movement query runs before `world.step()`. After changing stance, that query therefore used the shortened capsule at the old standing center, temporarily lifting its bottom away from the floor. A rapid stand request can encounter the airborne guard. Teleporting during reset/save restore similarly queried collision at the old location; reset also retained its old `grounded` flag.

The measured elevated-restore probe reported body position `(0, 2.900000095, 0)` while the collider still reported approximately `(-3, 0.825100005, 4.999997139)`. This establishes stale collider pose independently of the browser test's timing. Player stance changes, reset, save restore and vehicle-to-foot placement now synchronize the collider's world translation with the body before another movement query. Reset clears the old grounded flag; the next collision query establishes destination contact.

Regression tests verify ten consecutive crouch/stand cycles without lost ground or foot-height drift, a reset that reacquires contact before jumping, and an elevated save restore that falls rather than using the old contact to jump. All three fail against the previous code and pass after the fix. All 551 tests/114 files and build pass. Four current Grove runs pass, and eight runs of the original `acfadc7` Grove test (without the later readiness guards) also pass. The guarded test was restored afterward. Logs: `/tmp/web-gta-player-collider-{before,unit,build,grove,original-grove}.log`; raw stale-pose probe `/tmp/web-gta-reset-contact-probe.log`.

This fixes a reproducible collision-state defect consistent with the earlier missed stand request. Eight passing timing-sensitive runs are regression evidence, not proof that every possible input/clearance failure is eliminated.
