# Original single-player pool match coverage

The normal Ganton BAR2 portal and POOL_SCRIPT opponent brain now lead through
wagering, mouse-driven player shots, NPC responses, pockets, fouls, cue-ball
placement, a win/loss result and the rematch screen. This runs the packaged
POOL2 script rather than a replacement pool rules engine.

`tests/browser/pool-match.spec.ts` is opt-in because it plays real-time shots:

```
POOL_MATCH=1 npx playwright test tests/browser/pool-match.spec.ts --project=parallel --workers=1
```

Use the repository's configured browser or the environment's local Chromium
configuration. Run this test alone. It allows fifteen minutes, with a twelve-minute
match budget after the first NPC response. The default browser suite skips it.

The setup ends the opening story mission, enters the actual bar, seeds $500 and
places CJ beside its opponent. Thereafter it uses the original automatic target
selection, keyboard confirmation and mouse pull-back/forward strokes. It does not
write ball positions, task results, scores, winner flags or payout values. It
acknowledges player result prompts and legal placement after fouls, then observes
the original script's result and declines the offered rematch.

Two October 22 probes reached different legitimate result branches:

- A thirteen-player-shot research run reached a CJ win after fifteen potted balls:
  $450 after the committed stake became $550 after the $100 award. The next wager
  then left $500. That probe stopped at the rematch screen.
- The permanent regression completed in 1.9 minutes with an NPC win after three
  player shots. Its result screenshot shows “You Lost −$50.” The balance stayed
  $450, the next wager reduced it to $400, and declining refunded it to $450.
  CJ was unfrozen afterward; the table and opponent remained. No script or page
  errors occurred. It checks either result's accounting, rather than requiring a
  particular physics outcome.

The original script can offer another wager without terminating POOL2. Waiting
only for termination incorrectly treats that normal rematch prompt as a stall.
The regression checks the result, next stake, refund and actual quit explicitly.
Screenshots are `artifacts/pool-match-result.png` and `artifacts/pool-match-final.png`.

The final build and all 3,695 unit tests pass (51 skipped). The shorter normal
entry and player-shot/next-turn regressions also passed during this work.
Multiplayer remains unimplemented: SET_SCRIPT_COOP_GAME is still skipped (three
calls in the completed rematch/quit flow). Native ball/contact integration remains
partial as described in [POOL_BALLS.md](POOL_BALLS.md); full single-player script
coverage does not establish exact native trajectories or every possible foul.
