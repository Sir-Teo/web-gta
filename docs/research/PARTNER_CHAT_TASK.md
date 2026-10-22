# Script partner conversations

TASK_CHAT_WITH_CHAR constructs CTaskComplexPartnerChat (type 1204), rather than
CTaskComplexChat. The previous NPC path mapped its last script argument to an
inner chat stage and ran a single simple chat. CJ rejected the order entirely,
which stopped Air Raid's original result sequence at PERFORM_SEQUENCE_TASK
(SCM 1873065) after the defence and celebration.

The shared nativePartnerChat controller now runs the initial stand, reciprocal
partner check, approach points, walk, facing synchronization and repeated
conversation fallback sequences. Both NPCs and CJ expose their current reciprocal
state. A task on an unrelated ped does not count as a match. Missing partners,
clearing and replacing a task end the pair; a lone speaker or listener ends
after the initial stand rather than leaving the listener waiting indefinitely.
The host retains actual movement, collision and animation loading.

## Native evidence

All captures verify executable SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
They require Unicorn 2.1.4 and the pinned iOS executable.

- `native-partner-chat-handler.py`: 18 cases execute the handler at
  `0x1001ee6cc` and constructor at `0x1004211d8`. Parameter collection,
  allocation, base-task initialization, reference registration, strcpy and task
  assignment are intercepted. Native constructor stores select PartnerChat,
  distance multiplier 0.5, initial state 1, first-to-target -1, conversation
  enabled and fallback allowed. Conversation-enabled construction overrides
  the command's direction-count argument with four updates.
- `native-partner-chat-transitions.py`: 108 cases execute NextSubTask at
  `0x10041f988`, varying state, counterpart state, speaker, current subtask,
  presence and reciprocal identity. Task lookup, allocation, constructors and
  sequence creation are intercepted. The target-point helper and vector
  normalization execute when called. This captures the 50 ms waits, target
  assignment, walk/turn transitions, synchronization, repetition and rejection
  of a missing or unrelated partner.
- `native-partner-chat-sequence.py`: 28 cases execute the approach helper at
  `0x10042012c` and complete fallback sequence builder at `0x100421468`.
  Vector normalization executes; type/partner queries, allocation, constructors
  and sequence appends are intercepted. Captures cover coincident positions,
  vertical separation, original roof coordinates, speaker/listener and each
  direction update. The fallback starts with a turn, then alternates IDLE_chat
  and standing. Float32 position/count arithmetic determines both durations.

The PC reference's Partner and PartnerChat implementations delegate their
transition functions to the executable. Its reversed ComplexChat implementation
is the inner speech task, not the script command's complete controller.

## Scope

The browser has no native ped-conversation audio broker. This controller uses
the captured unavailable-conversation fallback; it does not fabricate speech
completion or claim the native speech-backed branch. General Partner variants,
secondary retreat tasks, event priorities and exact movement/animation timing
remain outside this implementation. The native 151-frame approach abort and
existing host heading/movement controllers bound an obstructed approach.

The focused native suite passes all 156 checks, including constructor, transition
and sequence comparisons plus runtime pairing checks. The full suite passes 4,956 tests (51 skipped), including the player ped-origin
regression; the build passes.
The live `script-chat.spec.ts` passes in about a minute. Its trace records all
four NPC rounds and gestures from both partners, a player conversation with
controls disabled and actual approach movement, unpaired speaker/listener
completion, and cancellation of both sides. No skipped commands, give-ups or
page errors occur. Trace: `artifacts/script-chat.json`.

Host movement positions are feet; approach and sequence inputs add the native
ped-origin offset before the captured math. The player regression verifies the
resulting target heights and reciprocal-state removal on clear.
