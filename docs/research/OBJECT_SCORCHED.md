# Scorched object lighting

`SET_OBJECT_RENDER_SCORCHED` (0654) now changes the lighting of live script objects and adopted map
placements. QUARRY (mission 118) sets this flag at SCM 2797472 and 2797769, using the local arrays
at 114 indexed by local 50 and at 111 indexed by local 48.

## Native evidence

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001eed70` writes bit 29 of CPhysical's flags at +0x64, setting it for any nonzero
second operand and clearing it for zero. It changes no collision, movement, health or visibility state.

The pinned reversed CObject::SetupLighting (`0x554FA0`, Object.cpp) selects
WorldReplaceNormalLightsWithScorched with 0.18 and returns before normal entity lighting.
That light helper (`0x7357E0`, app_light.cpp) sets the ambient light to grey and disables the
directional light. The normal entity-light setup, including contact and nearby light contributions,
is bypassed. Geometry prelight, surface coefficients, material colors and textures remain in the
existing render pipelines.

## Integration and checks

ScriptObjectViews reads each object's physical flag. Generic native lighting selects surface-ambient
times 0.18 before adding prelight; it bypasses normal scene-light contributions. The existing building
pipeline uses the fixed ambient with its existing day/night palette and surface modulation. Both
restore their ordinary lighting when the flag clears. Existing building-pipeline and scene-lighting
coverage limits remain; this command does not establish broader platform render parity.

Map placements keep their own normal/faded scorched material copies. Shared source materials,
textures and neighboring placements are unchanged. Opacity and per-material alpha changes reach the
scorched copies; turning the flag off restores the original material selection. The world host keeps
the placement key across streamed windows and reapplies the flag. No replacement visual or duplicate
collision body is created for an adopted object.

Four new unit checks cover original QUARRY array operands, adopted-host forwarding, shared-material
isolation, independent uniforms, fade/slot alpha, restoration, disposal and a real installed map's
two placements. Browser pixel checks exercise generic and building lighting with prelight 0.2:
normal lighting saturates at 255, scorched lighting gives 97 (0.38 times 255), and increasing scene
lights leaves it unchanged. A live object check executes both original mission instructions and
restores its materials. The existing native vertex-lighting pixel regression also passes.
Full QUARRY mission completion remains unverified.
