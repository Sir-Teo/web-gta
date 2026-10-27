# DAMAGE_CHAR direct field semantics

DAMAGE_CHAR (0851) now preserves its armour flag for NPCs and reaches walking
peds, mission riders and CJ. Its health/armour arithmetic is separate from
weapon damage: no pedstats weakness, player damage multiplier, physical proof,
only-player gate, friendly reduction, weapon practice or weapon kill reporting.
An ordinary positive fractional health result survives this command.

## Native evidence

The pinned iOS executable, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`,
provides the executable evidence. The 2100-range dispatcher subtracts 2100 at
`0x1001fd414`; relative jump table `0x1001fef54`, entry 29 (2129 / 0851),
resolves to `0x1001fdfc8`. The handler collects three arguments and resolves
the ped reference, then joins `0x1001fea44`:

- Convert the signed integer amount to float32. Flag zero branches directly
  to the health subtraction at `0x1001fee3c`.
- Otherwise compare amount with m_fArmour (`ped + 0x6b4`). If larger, zero
  armour and subtract the remainder from health. Otherwise subtract amount
  from armour at `0x1001fee30`, leaving zero health damage.
- Subtract from m_fHealth (`ped + 0x6ac`) and store float32. The comparison at
  `0x1001fee48` preserves every value greater than zero, including 0.5.
  Zero or lower is clamped to zero.
- The zero branch constructs CTaskComplexDie at `0x1003bf890`, with weapon 0,
  animation group 0, animation 15, blend 4 and speed 0. It adds the task through
  CEventScriptCommand at `0x1002901bc`, primary task index 3, via EventGroup::Add
  at `0x100285ba8`. It does not call the ordinary damage calculator.

Negative amounts follow the same subtraction: with the flag set they increase
armour, and without it they increase health, with no maximum clamp here.
The pure helper retains these branches and float32 stores.

The pinned gta-reversed PC reference revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`, CharacterCommands.cpp, documents
DAMAGE_CHAR and its three operands but leaves the handler unimplemented.
These arithmetic claims are mobile executable evidence, not independent PC
1.0 executable validation.

## Integration and checks

The NPC adapter forwards the flag and applies the result to either body form.
CJ uses a direct simulation method. Nonfatal script changes emit no weapon
reaction or pain event and retain the last-weapon value. Zero results use the
existing scripted death bridges; NPCs do not report a weapon kill. The player
bridge emits the existing TASK_DIE death event once to drive browser recovery.
Full native task/event scheduling and animation equivalence remain open.

Units cover absorption, equality, overflow, bypass, negative amounts, float32
stores, fractional survival and protected CJ's nonfatal/fatal behavior. A live
trial executes real 0851 instruction bytes through ScmThread against the game,
checking fifteen outcomes across walking peds, mission riders and CJ, with
proofs and a non-unit weakness. It checks script armour/death queries, retained
last weapon, zero weapon kill-counter deltas and no page errors. Existing
native reaction, choking and script-kill task regressions also pass.

Validation: 26 focused tests, 5,663 full-suite tests (51 skipped), the production
build and four live browser checks pass. The opcode trial's fifteen state
outcomes use the same adapter supplied to the running game's script threads.
