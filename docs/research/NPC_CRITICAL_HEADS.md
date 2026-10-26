# Nonplayer-source critical firearm hits on foot

WorldPedestrians.applyNpcBullet applied weakness and armour but never forced
critical death. An accepted rifle head hit could therefore leave an ordinary
NPC alive at several thousand HP. This entry now uses the native nonplayer-
source firearm decision before applying the ordinary health remainder.

## Reference and execution

The PC ComputeWillForceDeath entry (`0x4AD610`) delegates to retail code in
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`; its wrapper is
not an available PC implementation. The selected branch comes from the pinned
iOS arm64 executable, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`,
revision `67f70cb72eb207aeca650ea9e8c10b0e7dda166a` of Google61/gta3sa.app.
This does not independently establish original PC binary equivalence.

ComputeWillKillPed calls `0x10028a4b0` at `0x10028a218` and stores its forced-
death result at response byte 9. The native function's firearm bitmask includes
22–34, 38 and 52. For a raw nonplayer creator and a standing nonplayer victim:

- bNoCriticalHits returns false without an RNG draw.
- Rifles 33/34 skip the draw and force death for head piece 9.
- Other firearms draw `rand() & 7`, including for body contacts. Zero permits
  forced head death; the other seven outcomes keep ordinary damage.
- Actual PLAYER1/PLAYER2 victim types return false without a draw.

The separate occupied-vehicle branch forces head death independent of that
random outcome. Player-creator aim/target flags have additional branches.
The new helper is scoped to the foot-victim, nonplayer-source firearm path.
Existing seated and player-creator entries are separate work.

`scripts/research/emulate-npc-critical.py` loads only the verified native code
pages and executes this function and CPed::IsPlayer in Unicorn 2.1.4. The random
routine returns controlled integer samples 0–7; it does not run the TypeScript
implementation. The harness covers 5,760 calls across raw ped/vehicle/null
sources, standing/seated/player victim states, both critical flags, all fifteen
firearm IDs, body/head pieces and all eight sampled outcomes. Its compact
standing/player capture supplies 180 fixture rows with force bits and RNG call
counts, checked by tests/npc-critical-native-reference.test.ts.

To regenerate with a local verified binary and a Python environment containing
`unicorn==2.1.4`:

```sh
python scripts/research/emulate-npc-critical.py \
  --binary artifacts/gta3sa-ios-reference \
  --output artifacts/native-npc-critical-emulation.json \
  --fixture artifacts/npc-critical-reference-regenerated.json
```

The harness rejects a different binary. Regeneration matches the committed
fixture. Full observations and disassembly remain in ignored research artifacts;
the copyrighted binary is not added to the repository.

## Host integration and checks

Type, live group and proof rejection remain ahead of calculation. Accepted
hits spend armour using the existing weapon factor; the critical decision then
selects forced zero health or the ordinary remainder. Existing reaction and
once-only nonplayer death registration consume the resulting losses. Corpse
acceptance bypasses another calculation/draw.

Twenty-five host tests expose sixteen failures before repair. They verify all
firearms, each of the eight ordinary critical outcomes, rifle certainty,
no-critical targets, body draws, armour and rejected/corpse contacts. Together
with the 180 native reference captures and surrounding bullet tests, 251 focused
checks pass. The ordinary blood-effect fixture explicitly disables critical
hits so its surviving-head cases test ordinary wounds deterministically.

The global PC CRT generator/stream, player-creator aim flags, non-firearm forced
deaths, legacy vehicle-to-foot damage entries and matched PC combat traces
remain open. This change ports the selected native decision, not the entire
damage calculator or task/event system.

The build and live five-case native-muzzle trial pass: a selected ordinary
pistol critical and a rifle head hit force death at 5,000 HP, the noncritical
pistol head survives, critical-disabled rifle damage remains ordinary, and a
zero-draw body hit does not become critical. Armour follows the native weapon
factor before the decision; audio precedes damage and blood follows it. Two
fatal hits increment kills by others once each, including subsequent corpse
contacts. Existing nine-case NPC blood/proof/type/kill and mounted CJ regressions
also pass, with no page errors.

All 6,006 unit tests pass (51 skipped), including the 180 machine-code reference
captures and the host integration checks.
The final build and production smoke also pass, including native car entry,
saved-game return, walking, map/waypoint, pause/resume, Rustler takeoff and
landing gear, with no page errors or failed requests.
