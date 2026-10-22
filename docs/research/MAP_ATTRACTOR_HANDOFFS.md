# Named map-attractor handoffs

TASK_USE_CLOSEST_MAP_ATTRACTOR (08A0) now selects a real named trigger-script effect,
reserves its single slot, approaches it and starts the registered external brain. The two
map-attractor queries report live registration and arrived ownership. This is an authored
integration over native selection and task evidence; procedural interior population is separate.

## Evidence

Reference identities are recorded in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md).
The pinned iOS 2200-command table is at 100200F1C. Its 2208 entry starts at 100200348:
collect six values, then an eight-byte name. With a real ped, the search origin is its current
position, and its intelligence's effect-in-use pointer is excluded. With ped −1, the supplied
XYZ is used for deferred sequence construction. Model zero becomes the native wildcard −1;
negative SCM model references resolve through UsedObjectArray.

The shared search at 100355898 asks CWorld for up to 1,024 entities in the supplied radius,
using three-dimensional entity-origin distance. For each model's effects, it rejects the prior
effect, non-attractor effects, attractor types other than trigger-script (5), a different model,
a nonmatching script name (strcmp) and, for the task form, an unavailable slot. It transforms
the effect position and ranks strict float32 squared XYZ distances, starting at 100,000,000.
Ties keep the first candidate. The successful ordinary path at 100200E64 constructs
CTaskComplexUseEffect (1003C2D98), sends the task and updates the ped's effect-in-use pointer;
the command condition is true. An empty search gives false without replacing a task.

GET_USER_OF_CLOSEST_MAP_ATTRACTOR (091C), at 100201F30, uses the same search without the
free-slot filter or prior-effect exclusion and asks the manager for the arrived queue head.
IS_CHAR_USING_MAP_ATTRACTOR (09C5), at 100205E60/1002069DC, asks the manager whether the ped
is registered with an effect; registration need not have arrived yet.

Reversed PC CPedTriggerScriptAttractor (5EE890) has one slot and a 0.125 arrival range.
CTaskComplexUseAttractor's trigger-script branch starts its registered brain; named brains are
registered by MAIN. CPedAttractor::GetHeadOfQueue returns the first arrived ped. The inspected
iOS CTaskComplexUseEffect first-subtask path at 1003C30DC accepts a map entity, or a valid
scripted effect when the entity is null. The pinned PC body's entity/index condition does not
match that path and must not be treated as executable evidence for rejecting map effects.

Disassemblies are retained in `artifacts/native-{find-map-attractor,map-attractor-handler,
use-map-effect-first,map-attractor-queries}.asm`.

## Integration

The scene exposes candidate effects after filtering placement origins in 3D. The selector
checks type, exact script name, model, availability and prior active effect, then uses float32
ranking. ScmMission keeps one reservation per ped/effect and sends its existing movement
runner a direct walking approach and heading task. Once those finish, it starts the registered
brain with the ped as local 0 and instant-use false as local 1. A previous brain may issue a
handoff before terminating later in the same script pass. The new brain waits for that exit.

Registration remains active during approach; arrived ownership becomes visible after approach
and heading finish. The brain's own animation tasks keep its registration. Clearing tasks,
external task replacement, death or brain completion releases the slot. Diagnostics are
available through `mission.mapAttractorsSnapshot()`.

All seven original sites are in PCHAIR, PCUSTOM, OTBWTCH, OTBTILL, FBOOTHR, FBOOTHL and DANCER.
Their named handoffs no longer stop at an unimplemented command. The original scripts and
published DFF effects supply the behavior, rather than a fabricated completion flag.

## Limits

This is **authored/partial**. Direct approaches use the existing movement runner; native sector
ordering/capacity, path search, approach timeout, queue events, full task priorities, scanner
pointer lifetimes and complete CScriptedBrainTaskStore ownership are not reproduced. Only
explicitly registered live map users are queried, rather than an entire native attractor manager.
The previous active effect is excluded while held. Effects in unstreamed map entities are absent.
Object-disabled-attractor policy and all entity-reference lifetimes remain incomplete.

The ped −1 deferred sequence form still raises an explicit unsupported-command error because
its captured effect/task lifetime is not implemented. None of the seven original sites uses
that form. Procedural interiors do not automatically spawn their native customer population.
The regression supplies one real NPC; this does not establish full restaurant, betting-shop,
dancer or seating cycles.

## Checks

Five unit checks cover native selection/ranking filters, reservation before arrival, exclusion,
interruption/death cleanup, brain-owned versus outside tasks, the real PCUSTOM streamed-file
handoff and all seven original instruction packets with their real conditional result.

A browser regression enters Cluckin' Bell through its entry/exit, uses the published
`cj_ff_till_que` PCUSTOM effect, supplies one NPC on the clear floor side and executes PCHAIR's
original handoff instruction. The ped walks to the effect, starts PCUSTOM and plays IDLE_CHAT.
The arrived-user query returns that ped, and task clearing releases it. No skipped commands,
script failures or page errors occur. An approach from behind the counter cannot traverse the
counter with the direct movement adapter; no general indoor navigation claim is made.

The browser also toggles only the customer model while rendering a fixed camera and checks
that its pixels change, then retains `artifacts/map-attractor-shop-customer.png`. The ordinary
view is `artifacts/map-attractor-shop-handoff.png`. CASINO6's existing scripted-attractor
browser regression passes. All 3,543 unit tests pass (51 skipped). Census: 1,342 faithful,
40 authored, eight skipped, one silent and zero stopping commands; historical sweep results
are preserved.

The build passes with the final browser regression included.

## Streaming identity and lifetime

Attractor keys now use the scene catalog's immutable dataset/source-file/placement identity,
plus the model's effect index. They no longer depend on the current window's placement index.
A retained effect keeps its key when earlier placements leave the window; a new placement
reusing local index zero cannot inherit the old reservation. Scenes without a streaming
catalog use model/interior/pose identity as a fallback. Identical duplicate placements in
that fallback remain indistinguishable.

An indexed current-effect set answers source existence without scanning every placement for
each registered ped each frame. The index refreshes when model effects arrive and clears on
disposal. A source entity absent from the committed scene aborts both an approach and an
arrived user's owned movement task, releasing its slot. This models the inspected task's
safe entity-reference lifetime at the scene level; all native destruction/event ordering and
moving map-object effects remain partial.

Two additional unit checks replace an actual installed scene with reindexed/removed placements,
verify retained and rejected keys and disposed-scene queries, and cancel approaching/arrived
users when their source disappears. The real Cluckin' Bell handoff still passes with stable
source keys and rendered NPC pixels. All 3,545 unit tests pass (51 skipped), and the build
passes. Census classifications and historical sweep outcomes are unchanged.
