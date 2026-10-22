# Stored group sequence

`SET_GROUP_SEQUENCE` (087D) now resolves and stores a task-sequence slot on an existing group.
TWAR7 (mission 27) calls it at SCM 857970, with group global 44 and sequence local 147, after
recording a drive-by task. It does not issue individual tasks from this command.

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Native handler `0x1001fd628` resolves a group handle with script-thing type 8 and ignores an
invalid result. A non--1 sequence handle is resolved with type 4. Tail `0x1001feebc` stores
the resulting slot (including -1) at group +0x494: CPedGroupIntelligence::m_TaskSeqId, at
intelligence +0x434, with intelligence starting at group +0x60.

The intelligence constructor (`0x10034aae4`) and Flush (`0x10034ad64`) reset that field and
the adjacent decision-maker field to -1. CPedGroup::Process (`0x100350060`) calls membership
processing and intelligence Process (`0x10034c40c`). On membership changes, Process calls
ComputeScriptCommandTasks (`0x10034bd38`, reversed reference's unreversed PC `0x5F7800`) at
`0x10034c6d4`. That routine remaps existing script-command ped/task pairs to the current
membership and deletes orphaned tasks; it does not read m_TaskSeqId or create tasks from it.
The inspected native group routines therefore provide no basis for starting a recorded sequence
on every member when this setter runs.

The adapter preserves this stored-slot contract, including stale sequence handles, -1, group
isolation and reset on flush. It does not create an invalid group or change member tasks.
Two unit checks execute TWAR7's original instruction and exercise these handle/lifetime rules.
Existing group behavior retains its documented engine limits; this does not establish a full
TWAR7 mission pass or add native group task-pair migration.
