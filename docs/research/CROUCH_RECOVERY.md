# Grove crouch recovery investigation

The post-context-recovery Grove test intermittently failed while waiting for a native character shadow to return after the second C press. Eight repeats of the original test at `acfadc7` produced two failures and six passes (`/tmp/web-gta-crouch-repro.log`).

The captured failure state had `paused: false`, `player.crouched: true`, `player.grounded: true`, health 100, and a hidden native character. The shadow had intensity zero, zero vertices and `error: null`. Thus the final missing shadow is consistent with an unsupported crouched pose; the failure did not establish a shadow-rendering exception. Ground contact in the final snapshot does not prove ground contact at the instant the stand key was consumed.

`Simulation.toggleCrouch` rejects changes while airborne, in a vehicle, during a transfer or after death/impact. `setCrouched(false)` separately rejects an intersecting standing capsule. The original browser test checked only character/shadow visibility between key presses, so it did not distinguish an accepted crouch from a temporarily hidden airborne character, or prove standing was requested under valid ground-contact conditions.

Extra observation calls altered timing: four runs with explicit snapshots and eight runs with snapshots in existing polls all passed. That is evidence of timing sensitivity, not proof of a cause. Those runs are recorded in `/tmp/web-gta-crouch-stages.log` and `/tmp/web-gta-crouch-inline-stages.log`.

The revised test requires ground contact before crouching, verifies crouch acceptance, waits for a grounded crouched stance with a hidden shadow, then verifies standing acceptance separately from shadow restoration. It still uses ordinary key input and the original visibility expectations. No runtime stance or collision rule changed, and no arbitrary sleep was added. Failure capture now includes the pre-stand stance and final game state in `/tmp/web-gta-grove-stand-failure.json`.

Eight revised runs pass (`/tmp/web-gta-crouch-ready.log`) and build passes (`/tmp/web-gta-crouch-ready-build.log`). This strengthens the lifecycle test and separates simulation from rendering failures. The exact cause of the original rejected/missed stand request remains unproven; a future reproduction should capture the state at input consumption and the standing-clearance result before changing gameplay rules.
