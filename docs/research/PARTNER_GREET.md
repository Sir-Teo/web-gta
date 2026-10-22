# Paired NPC greetings

TASK_GREET_PARTNER (0823) now gives two on-foot NPCs coordinated approach, facing, handshake
and chat stages. It previously skipped SYN5's single site at SCM 1671665. That instruction
names the NPC in global byte offset 528 and the NPC in local 35, with bias 0.5 and style 5.
Both task records remain active until the pair finishes or is cancelled. Coverage is authored/partial.

## Native observations

The pinned iOS opcode-2000 table is `0x1001fd234`. The handler starts at `0x1001fb588`,
tail `0x1001fc67c`. It constructs two CTaskComplexPartnerGreet tasks through `0x100420a40`
(constructor body `0x10042094c`), assigning the first as lead speaker and the other as
listener, each with the other ped as partner. The derived vtable is `0x1005befb0`.

The parent CreateFirstSubTask (`0x100420308`) begins a 50-ms stand. ComputeTargetPositions
(`0x10042012c`) interpolates a shared centre with the supplied bias and normalizes the full
3D partner direction. A zero direction uses CVector's +X fallback. Horizontal distances below
0.7 shift the centre toward a 0.75-unit clearance, with bounded corrections; unresolved pairs
abort. The final targets are half a unit to either side of that centre. Walking uses move
state 4 and radius 0.1. Parent ControlSubTask (`0x1004203b8`) aborts a go-to on its 151st call.
CreateNextSubTask (`0x10041f988`) coordinates arrival, facing and final alignment with its peer.

GetPartnerSequence (`0x100420bc0`, style table `0x1004211c0`) first faces the partner, then
chooses the following group-52/GANGS clips:

| Style | Lead | Listener |
| ---: | --- | --- |
| 0 | hndshkaa | hndshkaa |
| 1 | hndshkba | hndshkba |
| 2 | hndshkca | hndshkcb |
| 3 | hndshkda | hndshkda |
| 4 | hndshkea | hndshkea |
| 5 | hndshkfa | hndshkfa |

Other styles omit the handshake clip. Each role also draws four delays of
`3000 + trunc(float32(float32((rand() & 65535) / 65536) * 4000))` milliseconds and a fifth
random low bit. After a one-second stand, the lead stands for the first delay and chats for
the second; the listener chats for the first and stands for the second. When the bit is set,
both add the third stand and fourth chat. Native DoHandSignal steps also occur in this sequence.
The PC reference's greeting sequence method is marked unreachable; these observations come
from the iOS executable rather than treating that placeholder as an implementation.

Reference identities are in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md). Ignored
disassemblies are `artifacts/native-partner-{next,greet-sequence}.asm`.

## Data, integration and limits

The published GTA3.IMG already carries gangs.ifp at offset 925761536, length 198656. Its
packed chunk is 1917, expanded offset 315392, SHA-256
`fbb234548949fac95846de0e0bf4835acf770c7d10b24663cc63a8a07d20ba2e`.
Existing animation loading supplies the handshake poses and PED/IDLE_CHAT.

The browser keeps a shared pair until both participants reach each stage. It uses actual
animation progress, retaining a finished handshake frame while the other association runs,
and timed chat/stand orders for the postlude. Replacing or clearing either primary task,
losing a participant, or approach timeout clears both memberships and records. Ordinary task
records stay associated through the pair's internal pauses.

Player, vehicle-occupant and self-partner forms fail explicitly. The shared browser stages
do not reproduce the complete native task graph, animation callbacks, abort priorities,
streamed-animation references or IK. Alignment uses the existing slide controller rather
than the native root-motion corrections and 0.99–1.01 distance gate. The native 151-call
limit is represented at the browser's thirty-Hz AI cadence. Slopes, collision interruptions,
every animation interaction and exact peer timing remain unverified. Hand-signal/finger
model steps and speech are not integrated here; SYN5's mission ped types have no gang hand
signal. Full SYN5 completion and retail pose/timing parity remain unverified.

## Checks

Four helper checks cover biased 3D targets, clearance corrections and aborts, coincident
positions, all six clip pairs and random postlude timing/roles. Three integration checks
execute SYN5's original instruction, verify both records through all stages, exercise one
partner waiting, primary-task replacement, timeout, death and explicit player rejection.

The browser executes the original SYN5 instruction with real NPCs. Both walk into handshake
range and face one another; pausing one association keeps its peer's completed clip waiting.
The real chat postlude finishes both records. A second C-style greeting selects the distinct
CA/CB clips, and clearing one participant clears both. No skipped commands, script failures
or page errors occur in that focused run.

Two 120-second SYN5 opening probes (October 22) report no skipped commands, script failures
or page errors. Neither reaches the greeting instruction: the literal-coordinate probe waits
at the first character-distance objective, and the radar bot approaches its ally on the lower
dock but does not traverse the height difference. Both report 5% instruction-offset coverage,
not mission completion. Separate state sampling confirms the initial SYN5_AA audio finishes
and local stage 88 reaches 3; this is not a stalled dialogue. Results are saved as
`artifacts/port/syn5-greeting-{mission,bot}-opening-oct22.json`, with diagnostic state in
`artifacts/syn5-opening-diagnostic.log`. The historical sweep is preserved.
