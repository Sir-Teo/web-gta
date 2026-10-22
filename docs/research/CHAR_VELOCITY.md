# Captured character velocity output

GET_CHAR_VELOCITY (083D) returns units per second in the inspected iOS build.
The pinned PC source's `CharacterCommands.cpp:GetCharVelocity` returns stored
move speed directly; its source alone does not establish the mobile scale.

The arm64 handler at `0x1001fe0e4` collects a handle, shifts it right eight bits,
finds the ped using pool stride `0x9c8`, loads float32 move speed at offsets
`0x68`, `0x6c` and `0x70`, multiplies by float32 50 from `0x1005908a0`, and
stores three floats. The browser host supplies engine units per frame. The
handler now rounds host values to float32 before scaling, matching the native
load. Retaining extra JavaScript precision through multiplication could change
the result by one float32 ULP.

`scripts/research/native-char-velocity.py` executes the handler in Unicorn 2.1.4
with a synthetic pool and the real handle lookup. Only parameter collection and
storage are intercepted. Executable SHA-256 is checked against
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Fifteen fixtures cover rest, signed zero, walking, jumping, free fall,
fractional/neighboring inputs and small/large finite values. Tests invoke the SCM
command, compare output words bit-for-bit, verify the forwarded handle and check
that the condition flag stays unchanged. Six cases failed before the correction;
all fifteen now pass.

All 3,693 unit tests pass (51 skipped), the build and final typecheck pass. The
census now reports 1,343 faithful, 40 authored, seven skipped, one silent and no
stopping commands. This does not establish exact native locomotion for the
host's player or NPC physics.

The subsequent full suite passes 3,695 tests (51 skipped), and both parachute
browsers pass: high-helicopter bailout and the original script's free-fall,
canopy flight and landing. The build remains clean.
