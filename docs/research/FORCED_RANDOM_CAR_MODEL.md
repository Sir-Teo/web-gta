# Forced civilian traffic models

Native research, October 22, 2026. SET_FORCE_RANDOM_CAR_MODEL (09BF) now affects new civilian traffic and resets
during mission cleanup. ZERO5 supplies model 459, Berkley's RC Van, at main.scm offset 453979.

Evidence uses the hash-verified ARM64 executable described in [remote control](REMOTE_CONTROL.md#evidence) and
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256` (`CarCtrl.cpp`, `Scripts/TheScripts.*`).

- The 2400-range dispatcher uses relative table 0x100204b0c. Entry 95 reaches handler 0x100202df4: collect one
  parameter, then copy the raw signed integer to CTheScripts::ForceRandomCarModel at 0x10079d21c. Negative values
  are not resolved through the SCM used-object table. In particular, -1 is the reset sentinel.
- CCarCtrl::ChooseModel (0x1001901a8) first chooses its traffic population category. The civilian branch at
  0x100190410 sets the output type to civilian, reads ForceRandomCarModel, and returns it directly unless it is -1.
  The ordinary resident-car draw is reached only for -1. Gang, police and other earlier category branches do not
  read the override. The override itself does not check suppression or residency.
- CTheScripts initialization stores -1 at 0x1001cd044. CMissionCleanup::Process stores -1 at 0x1001ca3c4
  (w21 receives -1 at 0x1001ca198). An ordinary thread ending is not mission cleanup.

ScmGameState now owns the signed value; the command writes it directly and ScmRuntime clears it with the other
mission cleanup state. The live fleet reads it only after the existing gang draw has fallen through to civilian
traffic. Car-park/resident model draws use the existing pool selection without this override. Existing cars keep
their models, and the normal asset-loading/spawn path still applies to new cars.

The surrounding traffic population distribution, resident model pool, streaming and browser spawn limits retain
their existing implementations. This change does not establish complete native ChooseModel parity or a complete
ZERO5 mission pass. Unsupported forced models retain existing vehicle-loader limitations.

Checks cover the raw -1 sentinel without a used-object table, persistence after ordinary thread termination,
cleanup after mission termination, suppression bypass and unforced resident draws. Browser checks exercise actual
SCM dispatch through the main fleet callback and observe a new model-459 traffic car, plus the gang branch and
car-park regression.
