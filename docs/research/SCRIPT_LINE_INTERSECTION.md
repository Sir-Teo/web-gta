# Script segment intersection

GET_2D_LINES_INTERSECT_POINT (05B0) now returns the native finite-segment result, updates its
condition and always writes both outputs. The former handler calculated an infinite-line
intersection and never changed the condition, which left POOL2's post-shot player position
unset and sent CJ to the origin.

## Executable contract

References use the pins in [POOL_BALLS.md](POOL_BALLS.md). The inspected iOS dispatch at
`0x1001e5e90` subtracts 1403, using table `0x1001e80e0`; opcode 1456 reaches `0x1001e61d0`.
It collects eight floats, calls UpdateCompareFlag at `0x1001dc5ec` and stores two results.

The routine computes slopes in float32. A zero X difference is replaced by positive
0.000001. Equal slopes fail. It derives the candidate point from the two intercepts, then
uses the first segment's exact X or Y for its vertical or horizontal case. The point must
fall within both segments' axis-aligned bounds. Each endpoint is promoted to double before
adding ±0.01, then rounded back to float for comparison. Failure sets the condition false
and writes −1,000,000 to both outputs; success sets true and writes the candidate. The
normal script negation/condition-combination rules still apply.

This deliberately retains the native slope approximation and degenerate-segment behavior,
including its small errors for some vertical-line arrangements. It is not a general robust
geometry replacement. POOL2's four table-side tests use the condition to choose the boundary
behind the cue, then compute the shooter and post-shot positions from that boundary.

## Validation

`scripts/research/native-script-line-intersection.py` checks the pinned executable hash and
executes the complete native arithmetic/bounds/sentinel branch under Unicorn 2.1.4. Only
parameter collection/storage and UpdateCompareFlag are intercepted. Thirty-one captures
are checked in at `tests/fixtures/native-script-line-intersection.json` and match exactly.
They cover both endpoint orders, crossings, misses, shared endpoints, the tolerance boundary,
vertical/parallel/coincident/degenerate cases and a line at the real pool table's coordinates.

A further check executes POOL2's original instruction at 414183 on hit/miss inputs, with
and without negation. It verifies both stored floats and the thread condition. Earlier tests
that expected old output preservation on parallel lines now assert the native miss sentinel.
The normal pool shot regression retains CJ at the table through ball movement, turn handoff
and the opponent's responding shot.
This does not establish full pool-match completion or native correctness of other geometry
commands.

All 3,671 unit tests pass (51 skipped), and the build passes. All three pool browser
regressions pass together after this change. Census and historical sweep outcomes are unchanged.
