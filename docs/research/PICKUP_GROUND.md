# Ground placement requested by standard pickup commands

CREATE_PICKUP (0213; iOS `0x1001d45c0`) and CREATE_PICKUP_WITH_AMMO (032B;
`0x1001d7fa8`) compare the supplied float32 Z with −100. At or below that
threshold they call CWorld::FindGroundZForCoord using the original X/Y, then
add float32 0.5. Higher explicit heights are preserved. GenerateNewOne compresses
the resulting position afterward; ground is not queried at the compressed X/Y.

Both commands now follow that branch using the existing `groundZForCoord` host.
It queries from Z=1000 and returns 20 if no ground is found, as the reference
function does. A ground-sentinel pickup can therefore finish at Z=20.5 without
terrain. The half-unit offset is applied before native position compression.

`scripts/research/native-pickup-ground.py` executes both native handlers under
Unicorn 2.1.4, checking the executable SHA-256 recorded in the fixtures. Parameter
collection/storage, output-variable reading, ground lookup and pickup generation
are intercepted. Comparison, float32 offset arithmetic and operand selection
execute natively. Twenty cases cover explicit heights, −100 and either side,
inputs rounding to the threshold, negative/fractional/interior ground heights,
type, ammo and output storage.

The tests run the actual SCM commands and check query coordinates/counts, final
compressed positions, type/ammo, output handles and unchanged conditions.
All twenty pass. The subsequent full suite passes 3,732 tests (51 skipped), and
the build passes. The live-world WITH_AMMO sentinel assertion also passed before
an older dead-ped test exposed an independent angle-sampling bug.

An offline scan found no direct float-literal low-Z sites for these two commands
in MAIN and the missions; it does not resolve variable or streamed-script inputs.
This establishes command behavior rather than new campaign completion. Other
pickup command families' ground rules are not inferred from these two handlers.
Verdant's explicit Z=9.5077 is preserved, so this is not a relocation of that disc.

Final validation after the independent dead-ped angle correction: all 3,749 unit
tests pass (51 skipped), the build and all four pickup browsers pass, including
the WITH_AMMO sentinel against the installed world. Census and historical mission
sweep outcomes remain unchanged.
