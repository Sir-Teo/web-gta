# Last building model shot by a player

`IS_LAST_BUILDING_MODEL_SHOT_BY_PLAYER` (0A3A) and `CLEAR_LAST_BUILDING_MODEL_SHOT_BY_PLAYER` (0A3B) now use
the player data written by actual bullet impacts. DESERT9 asks about the used-object models `CARGO_TEST`,
`CARGO_STUFF` and `CARGO_STORE` at SCM offsets 1992752, 1992760 and 1992768, then clears the record at 1992783.

## Source behavior

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Its 2600-command table at `0x100208968` maps the query to `0x100207f54` and clear to `0x100207a40`.

The query collects a player index and model. Negative models resolve through the script's used-object table
(`0x100207f70–0x100207f88`); it compares the resulting integer against the word at
`0x1007c4640 + player*0x1d8 + 0xc8`. The clear writes -1 to that same word. The query does not clear it.
`CPlayerPedData::Init` in the reversed reference initializes `m_nModelIndexOfLastBuildingShot` to -1.

Two native impact paths write this field:

- `CWeapon::DoBulletImpact` (PC `0x73b550`, `Weapon.cpp`) requires a player **ped** creator and
  `ENTITY_TYPE_BUILDING`, then stores the victim's model index.
- `CBulletInfo::Update` (`BulletInfo.cpp`) does the equivalent for a travelling sniper bullet whose ped creator
  has player data. It records each building reached as that bullet continues through the world.

The identity is the model index, not a placement or collider handle. Subsequent hits on objects, dummies, people
or vehicles do not clear it. Misses do not clear it. A new building hit replaces it.

## Browser integration and checks

`ScmPlayerInfo` holds the initialized values for both player slots. The mission adapter resolves model names
through the existing model index, compares without consuming the value and clears only the requested slot.
An unresolved model cannot match the -1 initial sentinel.

Player instant-hit and sniper impacts notify the world independently of loaded FX. The main host accepts only
an imported IPL source classified as a building, excludes placements adopted as script objects, and records its
IPL model ID. Vehicle-created shots do not write the field, even when the player owns the vehicle; their damage
ownership remains independent.

Unit checks run all three original DESERT9 query instructions and its clear, cover negation, player-slot
isolation and unresolved models, and observe player instant-hit/sniper notifications and mounted-gun exclusion.
The browser fires a pistol into actual IPL building collision, executes 0A3A and 0A3B, and checks numeric/name
queries and preservation until clear. The live Hunter regression also passes.

The second player's storage is supported; a second live player is not integrated. This check does not establish
DESERT9 completion or full native bullet penetration and spread parity.
