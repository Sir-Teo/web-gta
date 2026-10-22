# Scripted attractor occupancy

`IS_CHAR_AT_SCRIPTED_ATTRACTOR` (0642) now reads arrived ownership in the existing scripted-attractor
task path. CASINO6 (mission 90) calls it at SCM 2203347 with ped local 39 and attractor local 205,
and at 2205737 with ped array 53 indexed by local 289 and the same attractor variable.

## Native evidence

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001eece8` resolves the attractor as script-thing type 6, rejecting an invalid slot, then
calls CPedAttractorManager::GetPedUsingEffect at `0x1003316ec`. The pinned reversed manager
(`PedAttractorManager.h`, PC `0x5EB740`/`0x5EBE50`) matches effect/entity identity and returns
GetHeadOfQueue. That function (`PedAttractor.cpp`, PC `0x5EB590`) returns the first arrived ped,
or null. Registration alone and proximity do not qualify. BroadcastArrival moves a ped into the
arrived list; the scripted subtype has one slot (`PedScriptedAttractor.h`, PC `0x5EEA30`).

At `0x1001f0844`, character -1 tests whether the returned pointer is non-null. A specific character
compares its resolved pointer with the result at `0x1001f0830`. The iOS invalid-character path at
`0x1001f082c` supplies null, so an invalid character compares equal when a valid attractor is empty.
An invalid attractor always answers false. These details differ from treating every null character
as the -1 wildcard in the reference command wrapper.

## Integration and checks

The existing authored use-attractor path runs approach, achieve-heading and the attractor's script
sequence. It now keeps the first registered user's task-record identity and the sequence step that
marks arrival. Queries answer only after approach and heading finish, and release ownership when
the task finishes, is replaced or is cleared, the ped dies, or the attractor is deleted. Peds created
at an attractor use the corresponding heading/sequence path after their model is ready. No spatial
test is substituted for registration.

The command remains **authored**: full native registration/arrival events, queue timing, ambient
scripted-attractor users and model-readiness behavior remain outside the existing task path. This
does not add the missing ADD_PEDTYPE_AS_ATTRACTOR_USER behavior or general queue arbitration;
concurrent task assignment retains the existing authored use-attractor limits. The query tracks
the first user rather than treating every concurrent sequence as the queue head.

Three unit checks execute both original CASINO6 operand forms, including negation, approach/heading
steps, first-user identity, task completion/replacement, death, deletion and the iOS null-pointer
cases. The browser exercises a live NPC walking to the attractor, its natural sequence completion,
explicit task clearing and a newly created user, running both original query instructions throughout.
Full CASINO6 completion remains unverified.
