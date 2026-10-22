# Stuck-under-car script query

`IS_CHAR_STUCK_UNDER_CAR` (095D) now reads the get-up task's existing flag for CJ or a live NPC. The packaged
script uses it in `valet.scm` and SYND4. A ped merely lying down, touching a vehicle or blocked while moving does
not satisfy this query unless the get-up task has set its stuck-under-car flag.

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Its handler at `0x100202678` collects one ped handle, resolves the ped pool entry, loads the flags at ped +0x58c
and extracts bit 35 with `UBFX` at `0x1002026b4`. It passes that bit to the ordinary conditional-result update.
There is no fresh collision, distance, health or task-type check in this handler.

The player host reads `playerStuckUnderCar`, maintained by the existing get-up reaction path; NPCs read their
existing `stuckUnderCar` field. It does not substitute `Simulation.playerStuck`, which represents a blocked
collision push. The adapter resolves a live ped and respects the normal pending-entity behavior. Negation uses
the engine's existing conditional update.

The existing get-up implementation follows `CTaskSimpleGetUp::StartAnim`: a vehicle over the origin sphere
holds the fall pose and sets the flag; removing it starts the matching get-up clip and clears the flag. Its
collision and task timing coverage remains unchanged. The second player's live simulation is not implemented.

The unit check executes 095D for player/NPC transitions and negation. The browser get-up regression also executes
095D while CJ and an adopted civilian are initially free, trapped by actual vehicle collision, and released.
These are focused checks, not full valet or SYND4 mission passes.
